# MVP Vertical Slice 개발 로드맵

Vertical Slice 방식으로 개발한다. 각 Phase는 DB부터 UI까지 수직으로 완성되는 독립 단위다.

**원칙**: Phase 완료 기준을 통과하기 전까지 다음 Phase로 넘어가지 않는다.

---

## 전체 Phase 요약

| Phase | 이름 | DB 마이그레이션 | 완료 기준 | 상세 문서 |
|-------|------|----------------|-----------|-----------|
| 1 | 환경 구성 + 인증 | profiles, accounts, categories, transactions | 회원가입→인증→로그인→seed 확인→로그아웃 전 흐름 동작 | [slice1.md](slice1.md) |
| 2 | 핵심 장부 기능 | 없음 (Phase 1과 동일) | 지출 입력→목록 확인→계좌 잔액 반영까지 동작 | slice2.md (예정) |
| 3 | 대시보드 | 없음 | 총자산, 이번 달 수입/지출/순수입 차트까지 표시 | slice3.md (예정) |
| 4 | 투자 기능 | investment_assets, investment_trades, investment_events | 매수→잔액 반영→보유 수량 계산까지 동작 | slice4.md (예정) |
| 5 | AI 리포트 | ai_monthly_reports | 리포트 생성→저장→목록→상세까지 동작 | slice5.md (예정) |
| 6 | 설정 + Export | 없음 | 닉네임 변경, CSV export 동작 | slice6.md (예정) |

---

## Phase 1: 환경 구성 + 인증

**목표**: 사용자가 가입하고 로그인한 뒤 앱에 진입하는 전체 흐름을 완성한다.

**DB 마이그레이션**
- `profiles` — 사용자 프로필 (auth.users와 1:1)
- `accounts` — 계좌 (Phase 2에서 사용, Phase 1에서 seed로 1개 생성)
- `categories` — 카테고리 (Phase 2에서 사용, Phase 1에서 seed로 14개 생성)
- `transactions` — 거래 (Phase 2에서 사용, 테이블만 생성)

**터치하는 디렉터리**
- `src/features/auth/` — 모든 인증 로직
- `src/lib/supabase/` — 클라이언트 설정
- `src/middleware.ts` — 라우트 보호
- `src/app/(auth)/` — 인증 화면들
- `src/app/(app)/dashboard/` — 빈 placeholder

**완료 기준**

아래 흐름이 실제 브라우저에서 전부 동작해야 Phase 1 완료:
1. `/signup` → 가입 → 인증 이메일 수신 확인
2. 이메일 링크 클릭 → `/dashboard` 이동
3. DB 확인: profiles 1행, accounts 1행(기본 계좌), categories 14행 생성됨
4. 로그아웃 → `/login` 이동
5. `/dashboard` 직접 접근(미로그인) → `/login` 리다이렉트
6. `/login` 접근(로그인 상태) → `/dashboard` 리다이렉트
7. Google 로그인 → `/nickname` → `/dashboard` 흐름 동작
8. 비밀번호 재설정 이메일 수신 및 새 비밀번호 설정 동작
9. RLS smoke check 통과 (다른 사용자 데이터 접근 불가 확인)

**다음 Phase 진입 조건**: 위 완료 기준 전부 통과

---

## Phase 2: 핵심 장부 기능

**목표**: 수입/지출/이체를 입력하고, 거래 목록과 계좌 잔액이 정확히 반영되는 첫 Vertical Slice 완성.

**DB 마이그레이션**: 없음 (Phase 1 테이블 재사용)

**터치하는 디렉터리**
- `src/features/accounts/` — 계좌 CRUD, 잔액 계산 (`balance-calculator.ts`)
- `src/features/categories/` — 카테고리 CRUD
- `src/features/transactions/` — 거래 CRUD
- `src/app/(app)/transactions/` — 거래 화면
- `src/app/(app)/accounts/` (설정 내 또는 별도)

**완료 기준**

아래 흐름이 실제 브라우저에서 전부 동작해야 Phase 2 완료:
1. 계좌 생성 → 초기 잔액 입력 → 계좌 목록에 표시
2. 지출 1건 입력 (계좌, 카테고리, 금액, 날짜) → 거래 목록 확인
3. 해당 계좌 잔액이 `opening_balance - 지출액`으로 정확히 표시됨
4. 이체 1건 입력 → 두 계좌 잔액 모두 변경됨
5. 카드 계좌 지출 → 결제 예정액으로 표시됨
6. 거래 수정 → 잔액 재계산 반영
7. 거래 삭제 (확인 모달) → 잔액 재계산 반영
8. 월별/계좌/카테고리 필터 동작
9. Vitest: balance-calculator.ts 단위 테스트 통과

---

## Phase 3: 대시보드

**목표**: 이번 달 재정 현황과 총자산을 한눈에 볼 수 있는 대시보드 완성.

**DB 마이그레이션**: 없음

**터치하는 디렉터리**
- `src/features/dashboard/` — 집계 로직 (`aggregations.ts`)
- `src/app/(app)/dashboard/` — 대시보드 화면

**완료 기준**
1. 이번 달 총수입 / 총지출 / 순수입 / 이체 총액 정확히 표시
2. 총자산 = Σ(일반 계좌) - Σ(카드 계좌) 공식 적용 확인
3. 계좌별 잔액 요약 표시
4. 지출 카테고리 차트 표시 (Recharts)
5. 최근 거래 목록 표시

---

## Phase 4: 투자 기능

**목표**: 투자 계좌 현금 잔액 연동 + 보유 수량 계산까지 작동하는 투자 기록 완성.

**DB 마이그레이션 추가**
- `investment_assets` — 종목 정보
- `investment_trades` — 매수/매도 기록
- `investment_events` — 배당/분배금 기록

**터치하는 디렉터리**
- `src/features/investments/` — 투자 로직 (`cash-balance.ts`, `holdings.ts`)
- `src/app/(app)/investments/` — 투자 화면

**완료 기준**
1. 투자 계좌 생성 → 초기 잔액 입력
2. 종목 등록 → 매수 입력 → 투자 계좌 현금 감소 확인
3. 매도 입력 → 투자 계좌 현금 증가, 보유 수량 감소 확인
4. 초과 매도 시도 → 오류 메시지 표시
5. 배당 이벤트 입력 → 투자 계좌 현금 증가 확인
6. Vitest: cash-balance.ts, holdings.ts 단위 테스트 통과

**⚠️ AI 모델 재확인**: Phase 5 시작 전, Anthropic 공식 문서에서 최신 모델 ID 확인 후 확정.

---

## Phase 5: AI 리포트

**목표**: 월별 재정 데이터를 Claude API로 분석해 AI 리포트를 생성하고 저장한다.

**DB 마이그레이션 추가**
- `ai_monthly_reports` — 리포트 저장

**터치하는 디렉터리**
- `src/features/reports/` — 리포트 생성 로직 (`report-generator.ts`)
- `src/app/api/reports/route.ts` — Claude API 호출 Route Handler
- `src/app/(app)/reports/` — 리포트 화면

**완료 기준**
1. 월 선택 → 리포트 생성 버튼 → 로딩 → 리포트 저장
2. 리포트 목록에 표시
3. 리포트 상세 보기 (summary, spending_analysis, improvement_tips, investment_comment)
4. 리포트 삭제
5. `.env.local`에 `ANTHROPIC_API_KEY` 설정 후 실제 API 응답 확인

---

## Phase 6: 설정 + Export

**목표**: 프로필 관리, 카테고리/계좌 관리, CSV export 완성.

**DB 마이그레이션**: 없음

**터치하는 디렉터리**
- `src/features/exports/` — CSV 생성 (`transaction-csv.ts`, `investment-csv.ts`)
- `src/app/(app)/settings/` — 설정 화면들

**완료 기준**
1. 닉네임 변경 저장 확인
2. 비밀번호 변경 이메일 수신 확인
3. 계정 삭제 → 데이터 CASCADE 삭제 확인
4. 카테고리 추가/비활성화 동작
5. 거래 내역 CSV 다운로드 → 컬럼/데이터 정확성 확인
6. 투자 내역 CSV 다운로드 확인

---

## 공개 베타 오픈 전 체크리스트

Phase 6 완료 후, 베타 오픈 전 별도 확인:

- [ ] Resend 커스텀 SMTP 연동 (Supabase 대시보드 → Authentication → SMTP Settings)
- [ ] Cloudflare Turnstile CAPTCHA 활성화 (Supabase 대시보드 → Authentication → Bot Protection)
- [ ] Google OAuth redirect URL을 프로덕션 URL로 등록
- [ ] Vercel 프로덕션 환경변수 전체 설정 확인
- [ ] RLS 정책 전체 테이블 적용 재확인
- [ ] Supabase 자동 백업 활성화 확인
