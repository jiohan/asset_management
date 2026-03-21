# Domain Rules

에이전트가 코드 작성 시 반드시 참조해야 하는 도메인 규칙 모음.
잔액 계산 공식은 CLAUDE.md를 기준으로 하고, 여기서는 DB 스키마·운영 정책·입력 규칙을 다룬다.

---

## DB 스키마 (컬럼 기준)

### profiles
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | auth.users.id FK |
| email | TEXT | |
| nickname | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### accounts
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | profiles.id FK |
| name | TEXT | |
| account_type | TEXT | cash / checking / savings / investment / card |
| opening_balance | INTEGER | 양수. 계좌 생성 시 입력 |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### categories
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | profiles.id FK |
| type | TEXT | income / expense |
| name | TEXT | |
| color | TEXT | 표시용 색상 |
| icon | TEXT | 표시용 아이콘 |
| is_default | BOOLEAN | Seed로 생성된 기본 카테고리 여부 |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### transactions
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | profiles.id FK |
| type | TEXT | income / expense / transfer |
| account_id | UUID | accounts.id FK (출발 계좌) |
| transfer_to_account_id | UUID | accounts.id FK. transfer일 때만 사용 |
| amount | INTEGER | KRW 양수 정수 |
| category_id | UUID | categories.id FK. transfer는 NULL |
| transaction_date | DATE | |
| memo | TEXT | 선택. 최대 100자 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### investment_assets
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | profiles.id FK |
| account_id | UUID | accounts.id FK (투자 계좌) |
| market | TEXT | v1 고정값: KRX |
| name | TEXT | 종목명 (표시용) |
| symbol | TEXT | 종목 심볼 (식별 기준) |
| asset_type | TEXT | stock / etf |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

UNIQUE: `(user_id, account_id, market, symbol)`

### investment_trades
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | profiles.id FK |
| account_id | UUID | accounts.id FK (투자 계좌) |
| asset_id | UUID | investment_assets.id FK |
| trade_type | TEXT | buy / sell |
| quantity | INTEGER | 양의 정수 (KRX 1주 단위) |
| unit_price | INTEGER | KRW 양수 정수 |
| costs | INTEGER | 제비용 합산. 0 이상 |
| trade_date | DATE | |
| memo | TEXT | 선택 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### investment_events
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | profiles.id FK |
| account_id | UUID | accounts.id FK (투자 계좌) |
| asset_id | UUID | investment_assets.id FK |
| event_type | TEXT | dividend / distribution |
| amount | INTEGER | KRW 양수 정수 |
| event_date | DATE | |
| memo | TEXT | 선택 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### ai_monthly_reports
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | profiles.id FK |
| target_month | DATE | 항상 해당 월의 1일 (예: 2026-03-01) |
| summary | TEXT | AI 요약 |
| spending_analysis | TEXT | 소비 분석 |
| improvement_tips | TEXT | 개선 제안 |
| investment_comment | TEXT | 투자 코멘트 |
| raw_stats_json | JSONB | 생성 시점 데이터 스냅샷 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

UNIQUE 제약 없음 — 같은 월에 여러 개 저장 가능.

---

## v1 제외 항목 (구현 금지)

아래 기능은 v1 범위 밖이다. 에이전트가 임의로 구현하지 않는다.

- 카드/은행 자동 연동
- CSV 가져오기 (export는 가능, import는 불가)
- 실시간 시세 연동
- 투자 평가손익 자동 계산
- 채팅형 AI
- 여러 통화 지원 (KRW 고정)
- 팀/가족 공유
- 구독/결제 시스템
- 오프라인 저장
- 분할 거래
- PWA (데스크탑 완성 이후)

---

## 인증 흐름 상세

### 이메일 회원가입
```
/signup → (폼: 이메일, 비밀번호, 닉네임)
→ Supabase 인증 이메일 발송
→ /verify-email (안내 화면)
→ 이메일 링크 클릭 → /auth/callback
→ /dashboard
```

### 이메일 로그인
```
/login → (폼: 이메일, 비밀번호)
→ 이메일 미인증 상태: 인증 요청 안내 표시
→ 인증 완료: /dashboard
```

### Google 첫 로그인
```
/login → Google OAuth
→ /auth/callback
→ 신규 사용자(닉네임 없음): /nickname
→ 닉네임 입력 완료: /dashboard
→ 기존 사용자: /dashboard 바로
```

### 비밀번호 재설정
```
/login → "비밀번호 찾기" → /forgot-password
→ 이메일 입력 → 재설정 링크 발송 → 안내 화면
→ 링크 클릭 → /auth/callback → /reset-password
→ 새 비밀번호 입력 완료 → /login
```

### 리다이렉트 규칙
- `/dashboard` 이하 전체: 미로그인 시 `/login` 리다이렉트 (미들웨어 처리)
- `(auth)` 라우트 그룹: 로그인 상태에서 접근 시 `/dashboard` 리다이렉트
- 로그아웃: 어디서든 → `/login`

### Google 사용자 비밀번호 변경 UI
- Google 로그인 사용자는 설정에서 비밀번호 변경 항목을 표시하지 않는다.

---

## 기본 카테고리 14개 (Seed)

회원가입/Google 첫 로그인 완료 직후 서버 액션에서 자동 생성.

### 지출 카테고리 (9개)
1. 주거/통신
2. 보험
3. 구독료
4. 식비
5. 교통
6. 쇼핑
7. 의료/건강
8. 카페/간식
9. 기타지출

### 수입 카테고리 (5개)
1. 급여
2. 용돈
3. 부수입
4. 환불/취소
5. 기타수입

### 기본 계좌 (1개)
- 이름: `기본 계좌`
- 타입: `checking`
- `opening_balance`: 0

---

## 거래 입력 규칙

### 필수값
| 필드 | income | expense | transfer |
|------|--------|---------|----------|
| 타입 | 필수 | 필수 | 필수 |
| 계좌 (`account_id`) | 필수 | 필수 | 출발 계좌 필수 |
| 도착 계좌 (`transfer_to_account_id`) | - | - | 필수 |
| 금액 (`amount`) | 필수 | 필수 | 필수 |
| 카테고리 (`category_id`) | 필수 | 필수 | NULL |
| 날짜 (`transaction_date`) | 필수 | 필수 | 필수 |
| 메모 | 선택 | 선택 | 선택 |

### 입력값 제약
- `amount`: 양의 정수만. 0 불가.
- `transaction_date`: 기본값은 오늘. 미래 날짜 허용 (예약 기록 가능).
- `memo`: 최대 100자.
- `transfer_to_account_id`: `account_id`와 같은 계좌 불가 (자기 자신으로 이체 불가).
- 비활성화 계좌 선택 불가.

### 환불/취소 처리
- 실제 돈이 다시 들어온 경우 → `income` 타입, 카테고리 `환불/취소` 사용
- 단순 입력 실수 → 기존 거래 수정으로 처리 (새 거래 추가 아님)

### transfer 저장 방식
- DB에 **1건**으로 저장: `account_id` = 출발 계좌, `transfer_to_account_id` = 도착 계좌
- 2건으로 분리 저장하지 않는다.

---

## 카테고리 정책

### 카테고리 타입
- `income` / `expense` 두 가지만. `transfer`용 카테고리 없음.

### 삭제 정책
| 카테고리 종류 | 처리 방식 |
|-------------|----------|
| 기본 카테고리 (Seed로 생성된 것) | 삭제 불가. `is_active = false` 비활성화만 가능 |
| 사용자 생성 카테고리 (거래 있음) | 삭제 불가. 비활성화 또는 다른 카테고리로 이동 후 삭제 |
| 사용자 생성 카테고리 (거래 없음) | 하드 삭제 허용 |

### 수정 정책
- 이름 수정 가능. 변경 시 과거 거래에도 변경된 이름이 반영됨 (FK 참조 구조).

---

## 계좌 정책

### 계좌 타입 (5가지)
`cash` / `checking` / `savings` / `investment` / `card`

### 보호 규칙
- 거래/이체/투자 기록이 연결된 계좌는 삭제 불가. `is_active = false` 비활성화만.
- 비활성화 계좌도 과거 거래 조회 및 잔액 계산에는 유지.
- 새 거래 입력 시 비활성화 계좌는 선택 불가.

### 카드 계좌 표시 규칙
- DB에 양수로 저장 (미결제 누적 금액).
- UI에서만 "결제 예정액 ₩X" 레이블로 부채 표시.
- 총자산 계산 시 차감.

---

## 투자 기능 규칙 (v1 범위)

### v1 대상 자산
- 국내 주식, 국내 ETF만. 해외 주식 제외.
- 거래 유형: 매수 / 매도만.

### 종목 식별 규칙
- 종목 식별 기준: `market + symbol` 조합.
- v1 `market` 값은 `KRX` 고정.
- 같은 사용자 + 같은 투자 계좌 + 같은 `market` + 같은 `symbol` → 중복 생성 불가.

### 투자 거래 필수값
- 투자 계좌, 자산, 거래 유형(buy/sell), 수량, 단가, 제비용, 거래일
- 수량: 양의 정수만 (KRX 1주 단위). 0 불가.
- 단가: 양의 정수 (KRW). 0 불가.
- 제비용: 0 이상 정수. 0 허용 (수수료 없는 경우).
- 매도 시: 현재 보유 수량 >= 매도 수량 이어야 저장 가능. 서버 액션에서 검증.

### v1에서 하지 않는 것
- 평가손익 계산
- 실시간 시세 기반 자산 평가
- 수익률 고도화
- 평균단가 기반 분석

### 투자 이벤트 타입 (v1)
`dividend` (배당) / `distribution` (분배금)

---

## AI 리포트 정책

- 사용자가 버튼을 눌렀을 때만 생성 (자동 생성 없음).
- 같은 월에 여러 개 생성 가능.
- 생성된 리포트는 수정 불가.
- 생성된 리포트는 삭제 가능.
- 목록 정렬: 최신 생성 순.
- 월별 필터 가능.
- 리포트는 생성 시점 기준 데이터 스냅샷으로 저장 (`raw_stats_json`).
- 리포트 톤: 분석형 + 조언형 중간. MVP에서 고정 (사용자 선택 없음).

### 리포트가 답해야 하는 질문
1. 지난달 대비 어떤 소비가 늘었는가
2. 이번 달 소비 패턴의 특징은 무엇인가
3. 다음 달에 적용할 수 있는 소비 전략은 무엇인가

### 이체/환불/투자 이벤트 처리
- 이체: 소비 분석에 직접 포함하지 않음
- 환불/취소: 일반 수입과 분리해서 해석
- 투자 이벤트: 일반 소비와 다른 성격의 현금 흐름으로 해석

---

## 월별 통계 규칙

- 총수입: `income` 거래 합계 (transfer 제외)
- 총지출: `expense` 거래 합계 (transfer 제외)
- 순수입: 총수입 - 총지출
- 이체: 총수입/지출에 포함하지 않음. 별도 항목으로 표시.
- 대시보드 기본 기간: 이번 달.
- 카테고리 차트: 지출 기준만 제공 (v1).

---

## CSV Export 규칙

### 거래 내역 CSV 컬럼
| 컬럼 | 값 |
|------|----|
| 날짜 | `transaction_date` |
| 거래 타입 | income / expense / transfer |
| 계좌명 | account 이름 |
| 카테고리 | category 이름 (transfer는 빈 값) |
| 금액 | amount |
| 메모 | memo |

### 투자 거래 CSV 컬럼
| 컬럼 | 값 |
|------|----|
| 날짜 | `trade_date` |
| 투자 계좌명 | account 이름 |
| 종목명 | asset name |
| 심볼 | symbol |
| 거래 유형 | buy / sell |
| 수량 | quantity |
| 단가 | unit_price |
| 제비용 | costs |
| 메모 | memo |

### 투자 이벤트 CSV 컬럼
| 컬럼 | 값 |
|------|----|
| 날짜 | `event_date` |
| 투자 계좌명 | account 이름 |
| 종목명 | asset name |
| 심볼 | symbol |
| 이벤트 유형 | dividend / distribution |
| 금액 | amount |
| 메모 | memo |

---

## 대시보드 집계 응답 Shape

```typescript
type DashboardStats = {
  // 이번 달 기준
  totalIncome: number           // 총수입 (KRW 정수)
  totalExpense: number          // 총지출 (KRW 정수)
  netIncome: number             // 순수입 = totalIncome - totalExpense
  totalTransfer: number         // 이체 총액 (정보용, 수입/지출 미포함)

  // 전체 기준
  totalAssets: number           // 총자산 = 일반 계좌 합계 - 카드 계좌 합계

  accountBalances: Array<{
    id: string
    name: string
    accountType: 'cash' | 'checking' | 'savings' | 'investment' | 'card'
    currentBalance: number      // 양수. 카드는 결제 예정액
    isActive: boolean
  }>

  expenseByCategory: Array<{
    categoryId: string
    categoryName: string
    total: number
  }>

  recentTransactions: Array<{
    id: string
    type: 'income' | 'expense' | 'transfer'
    amount: number
    categoryName: string | null
    accountName: string
    transactionDate: string     // 'YYYY-MM-DD'
    memo: string | null
  }>
}
```

---

## 삭제 정책 요약

| 테이블 | 삭제 방식 |
|--------|----------|
| `accounts` | `is_active = false` 전용 (하드 삭제 없음) |
| `categories` (기본 또는 거래 있음) | `is_active = false` 전용 |
| `categories` (사용자 생성, 거래 없음) | 하드 삭제 허용 |
| `transactions` | 하드 삭제 허용 (확인 모달 필수) |
| `investment_trades` / `investment_events` | 하드 삭제 허용 (확인 모달 필수) |
| `investment_assets` (거래 있음) | 삭제 불가 |
| `ai_monthly_reports` | 하드 삭제 허용 |

`deleted_at` soft delete 패턴 사용 금지. 테이블별 위 정책을 따른다.
