# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

한국어 개인 재정 관리 웹앱 (가계부 + 투자 + AI 리포트). 공개 가입 서비스로, 데스크탑 우선 개발 후 모바일 반응형 확장 예정.

도메인 규칙 상세 (카테고리 목록, 거래 입력 규칙, v1 제외 항목, 투자/리포트 정책 등) → [`docs/domain-rules.md`](docs/domain-rules.md)

디자인 규칙 (색상 4개, 타이포그래피, spacing, 컴포넌트 규칙, 금액 표시 포맷 등) → [`docs/design-rules.md`](docs/design-rules.md)

## Tech Stack

| Role | Choice |
|------|--------|
| Framework | Next.js 16 (App Router) + TypeScript |
| DB / Auth | Supabase (PostgreSQL + RLS + Auth) |
| Schema management | Supabase CLI migrations (대시보드 직접 SQL 금지) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Server state | TanStack Query v5 (현재 미도입. Server Component + revalidatePath 패턴 유지 중. 필요 시 도입 검토) |
| Forms | Zod (Server Actions에서 직접 safeParse). 인증 폼(로그인/회원가입)만 React Hook Form 사용. 앱 폼(거래/계좌)은 미사용 |
| Charts | Recharts v3 |
| AI report | Anthropic Claude API (Phase 5 시작 직전 모델 ID 재확인) |
| Email | Resend (Supabase SMTP에 연동) |
| Testing | Vitest + Testing Library + Playwright |
| Deploy | Vercel |
| Package manager | npm |

## Commands

프로젝트 생성 후 아래 명령어를 기준으로 사용:

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드
npm run lint         # ESLint

npx vitest           # 단위 테스트 전체 실행
npx vitest run <파일>  # 단일 테스트 파일 실행
npx playwright test  # E2E 테스트

supabase migration new <name>   # 새 마이그레이션 파일 생성
supabase db push                # 마이그레이션 적용
```

## Architecture

### Data Flow

```
Browser
  └─ Next.js App Router (Server Components 기본, 필요 시 Client Components)
       ├─ Server Actions / Route Handlers
       │    ├─ Supabase DB (RLS 적용, 사용자 데이터 완전 분리)
       │    ├─ Resend (이메일 인증 / 비밀번호 재설정)
       │    └─ Anthropic Claude API (AI 월간 리포트)
       └─ TanStack Query (현재 미도입 — Server Component + revalidatePath 패턴으로 대체)
```

### DB Tables

`profiles` → `accounts` → `transactions` (income/expense/transfer)
`accounts` (investment type) → `investment_assets` → `investment_trades`, `investment_events`
`categories` (income/expense only, transfer는 카테고리 없음)
`ai_monthly_reports`

### Critical Balance Calculation Rules

계좌 현재 잔액은 DB에 저장하지 않고 매번 계산:

- **일반 계좌**: `opening_balance + Σincome - Σexpense + Σtransfer수신 - Σtransfer송신`
- **투자 계좌**: `opening_balance + Σtransfer수신 - Σtransfer송신 - Σ매수(qty×price+costs) + Σ매도(qty×price-costs) + Σinvestment_events`
- **카드 계좌** (부채): `opening_balance + Σexpense - Σtransfer수신(납부)` — DB는 양수 저장, UI에서 부채 표시
- **사용 가능 자산**: `Σ(cash/checking/savings 잔액) - Σ카드계좌잔액`
- **투자 자산**: `Σ투자계좌현금 + Σ보유주식장부가` (장부가 기준)
- **전체 자산**: `사용 가능 자산 + 투자 자산`

투자 매수/매도는 `transactions`에 기록하지 않음. `investment_trades`만으로 투자 계좌 현금 변화를 계산.

**카드 계좌 제약**: 카드 계좌는 transfer의 출발 계좌로 사용 불가. 잔액 계산 모델이 카드의 transfer 송신을 처리하지 않아 총자산이 부풀려지기 때문. 카드 계좌에서 허용되는 거래는 expense와 transfer 수신(납부)뿐.

### Auth Flow

`/auth/callback` → 신규 Google 사용자는 `/nickname` → `/dashboard`
미인증 상태로 `(app)` 보호 라우트(`/dashboard`, `/transactions`, `/accounts`, `/investments`, `/setup-account`) 접근 시 → `/login` (미들웨어/프록시 처리)
회원가입/Google 로그인 완료 후 서버 액션에서 기본 카테고리 14개 자동 생성 (계좌는 /setup-account에서 수동 등록)

### Development Phases (Vertical Slice)

각 Phase의 완료 기준, 터치하는 디렉터리, DB 마이그레이션 상세 → [`docs/vertical-slices.md`](docs/vertical-slices.md)

Phase 진행 시: vertical-slices.md를 기반으로 상세 계획 문서(slice1.md 등)를 별도 작성 후 진행.

1. **Phase 1** — 환경 구성 + 인증 (profiles, accounts, categories, transactions 테이블)
2. **Phase 2** — 핵심 장부 기능 (거래 CRUD, 계좌 잔액 계산)
3. **Phase 3** — 대시보드 (통계, 차트)
4. **Phase 4** — 투자 기능 (investment_assets, investment_trades, investment_events 테이블 추가)
5. **Phase 5** — AI 리포트 (ai_monthly_reports 테이블 추가, 모델 ID 이 시점에 확정)
6. **Phase 6** — 설정 + CSV Export

## Key Constraints

- **`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용** — 클라이언트 코드에 절대 노출 금지
- **모든 테이블에 RLS 필수** — 사용자는 본인 데이터만 접근 가능
- **Supabase CLI migrations 필수** — 대시보드에서 SQL 직접 실행 금지
- **금액은 KRW 정수로 저장** (소수 없음, v2에서 해외 주식 추가 시 decimal.js 도입 검토)
- **날짜 컬럼**: `transaction_date`, `trade_date`, `event_date`, `target_month`는 `DATE` 타입, `created_at`/`updated_at`은 `TIMESTAMPTZ`
- **`target_month`는 항상 해당 월의 1일로 저장** (예: 2026-03-01)
- **accounts, categories(기본/거래있음)는 하드 삭제 없음** — `is_active = false`로 비활성화
- **`opening_balance`와 `account_type`은 계좌 생성 시 1회만 설정, 이후 변경 불가** — 소급 수정은 잔액·총자산 히스토리 전체를 바꾸는 무결성 문제. DB 트리거(`trg_prevent_account_immutable_fields`)로 이중 차단
- **회원가입 Seed 로직은 Supabase 트리거가 아닌 Next.js 서버 액션**으로 처리
- **Vercel Hobby 플랜**: 개인·비상업 용도 전제. 유료화·광고·유급 팀원 발생 시 Pro 플랜 전환 필요

## MVP Testing Minimum

- 잔액 계산 함수 + 보유 주식 계산 함수(holdings) 단위 테스트 (Vitest)
- 회원가입 → 지출 1건 → 잔액 반영까지 E2E 1개 (Playwright)
- RLS smoke check — 다른 사용자 데이터 접근 불가 확인

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # 서버 전용
ANTHROPIC_API_KEY=             # Phase 5 시작 시 발급
RESEND_API_KEY=                # 베타 오픈 전 설정
NEXT_PUBLIC_SITE_URL=          # 로컬: http://localhost:3000
```

Supabase SMTP(Resend 연동) 설정은 `.env`가 아니라 Supabase 대시보드에서 직접 입력.
