# Phase 2: 핵심 장부 기능

**목표**: 수입/지출/이체를 입력하고, 거래 목록과 계좌 잔액이 정확히 반영되는 첫 Vertical Slice 완성.

**전제**: Phase 1 완료 기준 전부 통과 확인 후 시작.

---

## DB 현황

Phase 2에서 소규모 마이그레이션 1개 추가. Phase 1 테이블 구조는 그대로 사용하되,
transactions 테이블에 데이터 정합성 제약을 추가한다.

| 테이블 | 용도 |
|--------|------|
| `accounts` | 계좌 목록, 잔액 계산 기준 |
| `categories` | 수입/지출 카테고리 |
| `transactions` | 수입/지출/이체 기록 |

핵심 컬럼 재확인:

**transactions**
- `type`: `income` / `expense` / `transfer`
- `account_id`: 출발 계좌 (transfer도 동일)
- `transfer_to_account_id`: 도착 계좌 (transfer일 때만 사용. 나머지는 NULL)
- `amount`: KRW 양수 정수
- `category_id`: income/expense만 사용. transfer는 NULL
- `transaction_date`: DATE. 기본값 오늘(CURRENT_DATE). 미래 날짜 허용(예약 기록)
- `memo`: 최대 100자 선택

**accounts**
- `account_type`: `cash` / `checking` / `savings` / `investment` / `card`
- `opening_balance`: 0 이상 정수. 계좌 생성 시 1회만 입력, 이후 변경 불가
- `is_active`: false = 비활성 (거래 선택 불가, 잔액 계산엔 포함)

---

## Phase 2 마이그레이션

**파일**: `supabase/migrations/20260323080310_phase2_transactions_constraints.sql`

transactions 테이블에 아래 4가지 제약을 추가한다. Zod 앱 레벨 검증과 이중으로 보호한다.

```sql
-- transfer는 category_id NULL 강제
ALTER TABLE transactions
  ADD CONSTRAINT transactions_transfer_no_category
    CHECK (type != 'transfer' OR category_id IS NULL);

-- income/expense는 transfer_to_account_id NULL 강제
ALTER TABLE transactions
  ADD CONSTRAINT transactions_non_transfer_no_destination
    CHECK (type = 'transfer' OR transfer_to_account_id IS NULL);

-- 자기 자신으로 이체 불가
ALTER TABLE transactions
  ADD CONSTRAINT transactions_no_self_transfer
    CHECK (account_id != transfer_to_account_id);

-- transaction_date 기본값 오늘
ALTER TABLE transactions
  ALTER COLUMN transaction_date SET DEFAULT CURRENT_DATE;
```

마이그레이션 적용:
```bash
npx supabase db push
```

---

## 잔액 계산 공식

```
// 일반 계좌 (cash / checking / savings)
balance = opening_balance
         + Σ income (where account_id = 계좌)
         - Σ expense (where account_id = 계좌)
         + Σ transfer (where transfer_to_account_id = 계좌)   // 수신
         - Σ transfer (where account_id = 계좌)               // 송신

// 카드 계좌 (부채)
balance = opening_balance
         + Σ expense (where account_id = 계좌)
         - Σ transfer (where transfer_to_account_id = 계좌)   // 납부

// 투자 계좌 — Phase 2에서는 transfer만 처리, investment_trades 연산은 Phase 4
balance = opening_balance
         + Σ transfer (where transfer_to_account_id = 계좌)
         - Σ transfer (where account_id = 계좌)

// 총자산 — 투자 계좌 현금도 포함
totalAssets = Σ(일반+투자 계좌 잔액) - Σ 카드 계좌 잔액
```

**중요**:
- 잔액은 DB에 저장하지 않고 매번 계산한다.
- 미래 날짜 거래도 잔액 계산에 포함한다 (사용자가 의도적으로 입력한 예약 기록).
- 비활성 계좌(`is_active = false`)도 잔액 계산에 포함한다.

---

## 터치하는 디렉터리

```
src/
├── features/
│   ├── accounts/
│   │   ├── actions.ts             # 계좌 CRUD Server Actions
│   │   ├── schemas.ts             # Zod 유효성 스키마
│   │   ├── queries.ts             # Supabase 조회 함수 (Server Component용)
│   │   └── balance-calculator.ts  # 잔액 계산 순수 함수 (테스트 대상)
│   ├── categories/
│   │   └── queries.ts             # 카테고리 조회 (CRUD는 Phase 6)
│   └── transactions/
│       ├── actions.ts             # 거래 CRUD Server Actions
│       ├── schemas.ts
│       ├── queries.ts
│       └── filters.ts             # 필터 파라미터 타입 및 파싱
├── app/(app)/
│   ├── layout.tsx                 # 기존 인증/닉네임 가드 유지 + 앱 셸(사이드바) 추가
│   ├── dashboard/
│   │   └── page.tsx               # 기존 placeholder 유지 (Phase 3에서 구현)
│   ├── transactions/
│   │   ├── page.tsx               # 거래 목록 페이지
│   │   ├── new/page.tsx           # 거래 입력 페이지
│   │   └── [id]/edit/page.tsx     # 거래 수정 페이지
│   └── accounts/
│       └── page.tsx               # 계좌 관리 페이지
├── components/
│   └── ui/
│       ├── select.tsx             # shadcn Select (드롭다운)
│       ├── dialog.tsx             # 확인 모달용
│       ├── textarea.tsx           # 메모 입력
│       ├── badge.tsx              # 카테고리/타입 뱃지
│       └── separator.tsx          # 섹션 구분선
└── lib/
    └── format.ts                  # formatKRW() 금액 포맷 헬퍼 (신규)
```

---

## 구현 단계

### Step 0 — 선행 작업: 테스트 스택 설치 및 마이그레이션 적용

**테스트 패키지 설치** (아직 안 했다면):
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom @playwright/test
npx playwright install chromium
```

`vitest.config.ts` 생성:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

`package.json` scripts 추가:
```json
"test": "vitest",
"test:e2e": "playwright test"
```

**Phase 2 마이그레이션 적용**:
```bash
npx supabase db push
```

---

### Step 1 — 공통 레이아웃 (사이드바)

**파일**: `src/app/(app)/layout.tsx`

**주의**: 이 파일은 이미 `getUser()` 인증 가드와 닉네임 가드를 담당한다.
기존 가드 로직을 그대로 유지한 채 앱 셸(사이드바 + 메인 영역)을 감싸는 구조로 확장한다.
가드 코드를 제거하거나 덮어쓰면 인증 우회 버그가 발생한다.

구성:
- 좌측 사이드바 (w-60): 로고 + 네비게이션 + 닉네임 + 로그아웃
- 우측 메인 콘텐츠 영역 (flex-1, overflow-y-auto)

네비게이션 항목:
| 메뉴 | 경로 | 아이콘 |
|------|------|--------|
| 대시보드 | `/dashboard` | LayoutDashboard |
| 거래 내역 | `/transactions` | ArrowLeftRight |
| 계좌 관리 | `/accounts` | Wallet |

디자인 기준:
- 사이드바 배경: `bg-white`
- 페이지 배경: `bg-[#F9F9F8]`
- 사이드바 우측 구분선: `border-r border-gray-100`
- 활성 메뉴: `bg-gray-100 text-gray-900 font-medium`
- 비활성 메뉴: `text-gray-500 hover:bg-gray-50`

**라우트 보호 참고**: `src/proxy.ts`는 이미 `/dashboard`, `/transactions`, `/accounts` 세 경로를 보호한다. Phase 2에서 새 경로가 추가되면 `PROTECTED_PREFIXES` 배열에 추가한다.

---

### Step 2 — shadcn UI 컴포넌트 추가

Phase 2에서 새로 필요한 컴포넌트. Phase 1 기존 컴포넌트(Button, Card, Form, Input, Label) 그대로 재사용.

| 컴포넌트 | 용도 |
|----------|------|
| `select.tsx` | 계좌/카테고리 드롭다운 |
| `dialog.tsx` | 삭제 확인 모달 |
| `textarea.tsx` | 메모 입력 |
| `badge.tsx` | 거래 타입, 카테고리 표시 |
| `separator.tsx` | 섹션 구분선 |

---

### Step 3 — 금액 포맷 헬퍼

**파일**: `src/lib/format.ts`

```typescript
export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}
```

---

### Step 4 — 계좌 기능

#### 4-1. 타입 정의

두 타입을 명확히 분리한다.

```typescript
// 잔액 계산용 — 순수 함수에서 사용, DB 컬럼과 1:1 대응
export type AccountForBalance = {
  id: string
  account_type: 'cash' | 'checking' | 'savings' | 'investment' | 'card'
  opening_balance: number
  is_active: boolean  // 비활성도 계산에 포함하므로 필요
}

// UI 표시용 — DB 컬럼 전체 포함
export type Account = AccountForBalance & {
  name: string
  created_at: string
  updated_at: string
}
```

#### 4-2. 잔액 계산기 (`balance-calculator.ts`)

순수 함수로 작성. Supabase / Next.js 의존성 없음. Vitest 단위 테스트 대상.

```typescript
// src/features/accounts/balance-calculator.ts

export type TransactionForBalance = {
  type: 'income' | 'expense' | 'transfer'
  amount: number
  account_id: string
  transfer_to_account_id: string | null
}

export function calculateBalance(
  account: AccountForBalance,
  transactions: TransactionForBalance[]
): number

export function calculateAllBalances(
  accounts: AccountForBalance[],
  transactions: TransactionForBalance[]
): Map<string, number>

export function calculateTotalAssets(
  accounts: AccountForBalance[],
  balances: Map<string, number>
): number
// 총자산 = Σ(일반+투자 계좌) - Σ카드 계좌
```

Vitest 테스트 케이스 (`balance-calculator.test.ts`):
1. 일반 계좌: 거래 없을 때 = `opening_balance`
2. 일반 계좌: 수입 후 잔액 증가
3. 일반 계좌: 지출 후 잔액 감소
4. 일반 계좌: 이체 수신 시 잔액 증가
5. 일반 계좌: 이체 송신 시 잔액 감소
6. 카드 계좌: 지출 시 잔액 증가 (부채 누적)
7. 카드 계좌: 이체 수신(납부) 시 잔액 감소
8. 총자산: `Σ(일반+투자) - Σ카드`
9. 비활성 계좌도 잔액 계산에 포함
10. 미래 날짜 거래도 잔액 계산에 포함

```bash
npx vitest run src/features/accounts/balance-calculator.test.ts
```

#### 4-3. 계좌 쿼리 (`queries.ts`)

```typescript
// Server Component용 (await createClient() 사용, RLS로 자동 필터)
export async function getAccounts(): Promise<Account[]>
// 전체 계좌 목록 (비활성 포함). 잔액 계산 + UI 표시용.

export async function getActiveAccounts(): Promise<Account[]>
// is_active = true만. 거래 입력 드롭다운용.

export async function getAllTransactionsForBalance(): Promise<TransactionForBalance[]>
// 잔액 계산에 필요한 컬럼만 select (type, amount, account_id, transfer_to_account_id).
// 날짜 필터 없음 — 미래 날짜 포함 전체 계산.
```

#### 4-4. 계좌 Zod 스키마 (`schemas.ts`)

```typescript
export const createAccountSchema = z.object({
  name: z.string().min(1, '계좌명을 입력하세요').max(30),
  account_type: z.enum(['cash', 'checking', 'savings', 'investment', 'card']),
  opening_balance: z.coerce.number().int().min(0, '초기 잔액은 0 이상이어야 합니다'),
})

export const updateAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, '계좌명을 입력하세요').max(30),
  // account_type, opening_balance는 생성 후 변경 불가
})
```

#### 4-5. 계좌 Server Actions (`actions.ts`)

```typescript
export async function createAccount(formData: FormData)
// 유효성 검증 → user_id 주입 → insert → revalidatePath('/accounts')

export async function updateAccount(formData: FormData)
// id 소유권 확인 (user_id = 로그인 사용자) → name만 수정 → revalidatePath

export async function deactivateAccount(formData: FormData)
// id 소유권 확인 → is_active = false → revalidatePath
// 하드 삭제 없음. UI에서 "삭제" 대신 "비활성화" 텍스트 사용.
```

**소유권 확인 패턴** (모든 update/delete에 적용):
```typescript
const { data: account } = await supabase
  .from('accounts')
  .select('id')
  .eq('id', id)
  .eq('user_id', user.id)  // RLS와 이중 보호
  .single()
if (!account) return { error: '계좌를 찾을 수 없습니다' }
```

#### 4-6. 계좌 관리 UI (`/accounts/page.tsx`)

Server Component.

```
계좌 관리                              [+ 계좌 추가]

┌─────────────────────────────────────────────────┐
│ 기본 계좌           checking        ₩1,234,567  │
│                                  [수정] [비활성화] │
├─────────────────────────────────────────────────┤
│ 신한카드            card   결제 예정 ₩234,000   │
│                                  [수정] [비활성화] │
├─────────────────────────────────────────────────┤
│ 구 계좌 (비활성)    checking             ₩0     │
│ [비활성]                                          │
└─────────────────────────────────────────────────┘
```

- 잔액: 서버에서 `calculateAllBalances()` 호출 → props 전달
- 카드 계좌: "결제 예정 ₩X" 레이블
- 비활성 계좌: `text-gray-400` + `[비활성]` 배지. 잔액은 표시하되 흐리게.
- 계좌 추가: Dialog 모달 또는 `/accounts/new/page.tsx` 별도 페이지 (구현자 선택)

---

### Step 5 — 카테고리 조회

카테고리 CRUD(추가/비활성화)는 Phase 6 범위. Phase 2에서는 거래 입력 폼 드롭다운용 조회만 구현.

**파일**: `src/features/categories/queries.ts`

```typescript
export type Category = {
  id: string
  type: 'income' | 'expense'
  name: string
  is_default: boolean
  is_active: boolean
}

export async function getActiveCategories(
  type?: 'income' | 'expense'
): Promise<Category[]>
// is_active = true만. type 파라미터로 income/expense 필터 가능.
```

---

### Step 6 — 거래 기능

#### 6-1. 거래 Zod 스키마 (`schemas.ts`)

"필수값 검증" + "금지 조합 검증" 두 가지를 모두 처리한다.

```typescript
export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().uuid('계좌를 선택하세요'),
  transfer_to_account_id: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().int().positive('금액은 1원 이상이어야 합니다'),
  category_id: z.string().uuid().nullable().optional(),
  transaction_date: z.string().date('날짜 형식이 올바르지 않습니다'),
  memo: z.string().max(100, '메모는 100자 이내여야 합니다').optional(),
}).superRefine((data, ctx) => {
  // transfer: 도착 계좌 필수
  if (data.type === 'transfer' && !data.transfer_to_account_id) {
    ctx.addIssue({ code: 'custom', message: '도착 계좌를 선택하세요', path: ['transfer_to_account_id'] })
  }
  // transfer: 자기 자신 이체 불가
  if (data.type === 'transfer' && data.transfer_to_account_id === data.account_id) {
    ctx.addIssue({ code: 'custom', message: '출발 계좌와 도착 계좌는 같을 수 없습니다', path: ['transfer_to_account_id'] })
  }
  // transfer: category_id 있으면 오류 (금지 조합)
  if (data.type === 'transfer' && data.category_id) {
    ctx.addIssue({ code: 'custom', message: '이체에는 카테고리를 선택할 수 없습니다', path: ['category_id'] })
  }
  // income/expense: 카테고리 필수
  if (data.type !== 'transfer' && !data.category_id) {
    ctx.addIssue({ code: 'custom', message: '카테고리를 선택하세요', path: ['category_id'] })
  }
  // income/expense: transfer_to_account_id 있으면 오류 (금지 조합)
  if (data.type !== 'transfer' && data.transfer_to_account_id) {
    ctx.addIssue({ code: 'custom', message: '수입/지출에는 도착 계좌를 선택할 수 없습니다', path: ['transfer_to_account_id'] })
  }
})

export const updateTransactionSchema = createTransactionSchema.extend({
  id: z.string().uuid(),
})
```

#### 6-2. 거래 쿼리 (`queries.ts`)

```typescript
export type TransactionFilters = {
  month?: string        // 'YYYY-MM' → transaction_date >= 'YYYY-MM-01' AND < 다음달
  account_id?: string
  category_id?: string
  type?: 'income' | 'expense' | 'transfer'
}

export type TransactionWithRelations = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  transaction_date: string
  memo: string | null
  account: { id: string; name: string }
  transfer_to_account: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

export async function getTransactions(
  filters?: TransactionFilters
): Promise<TransactionWithRelations[]>
// Supabase 관계 조회:
// .select('*, account:accounts!account_id(id,name), transfer_to_account:accounts!transfer_to_account_id(id,name), category:categories(id,name)')

export async function getTransactionById(id: string): Promise<TransactionWithRelations | null>
```

#### 6-3. 필터 파라미터 파싱 (`filters.ts`)

```typescript
// URL searchParams → TransactionFilters 변환
export function parseTransactionFilters(
  searchParams: Record<string, string | undefined>
): TransactionFilters
// month, account_id, category_id, type 파싱. 유효하지 않은 값은 무시.
```

#### 6-4. 거래 Server Actions (`actions.ts`)

```typescript
export async function createTransaction(formData: FormData)
// 1. 유효성 검증 (createTransactionSchema)
// 2. account_id 소유권 + 활성 상태 확인
// 3. transfer_to_account_id 소유권 + 활성 상태 확인 (transfer일 때)
// 4. category_id 소유권 + 활성 상태 확인 (income/expense일 때)
// 5. insert → revalidatePath('/transactions') → redirect('/transactions')

export async function updateTransaction(formData: FormData)
// 1. 거래 id 소유권 확인
// 2. 유효성 검증 (updateTransactionSchema)
// 3. 연결 계좌/카테고리 소유권 + 활성 상태 확인
// 4. update → revalidatePath → redirect('/transactions')

export async function deleteTransaction(formData: FormData)
// 1. 거래 id 소유권 확인
// 2. delete → revalidatePath('/transactions')
// redirect 없음 (클라이언트 모달에서 처리)
```

**소유권 + 활성 상태 확인 패턴**:
```typescript
// 계좌 확인
const { data: account } = await supabase
  .from('accounts')
  .select('id')
  .eq('id', account_id)
  .eq('user_id', user.id)
  .eq('is_active', true)  // 비활성 계좌로 새 거래 불가
  .single()
if (!account) return { error: '유효하지 않은 계좌입니다' }

// 카테고리 확인 (income/expense일 때)
const { data: category } = await supabase
  .from('categories')
  .select('id')
  .eq('id', category_id)
  .eq('user_id', user.id)
  .eq('is_active', true)
  .single()
if (!category) return { error: '유효하지 않은 카테고리입니다' }
```

#### 6-5. 거래 목록 UI (`/transactions/page.tsx`)

Server Component. URL searchParams로 필터 상태 관리.

```
거래 내역                                        [+ 거래 추가]

[이번 달 ▾]  [전체 계좌 ▾]  [전체 카테고리 ▾]  [전체 타입 ▾]

┌────────┬──────┬──────────┬──────────┬────────┬───────────────┬────┐
│날짜    │타입  │계좌      │카테고리  │메모    │금액           │    │
├────────┼──────┼──────────┼──────────┼────────┼───────────────┼────┤
│3/15    │지출  │기본 계좌 │식비      │점심    │-₩12,000      │✏ 🗑│
│3/14    │수입  │기본 계좌 │급여      │3월급여 │+₩3,500,000   │✏ 🗑│
│3/14    │이체  │기본 계좌→투자계좌 │-  │₩500,000      │✏ 🗑│
└────────┴──────┴──────────┴──────────┴────────┴───────────────┴────┘

거래 없을 때: "조건에 맞는 거래가 없습니다." 빈 상태 메시지
```

금액 색상:
- 수입: `text-emerald-600` + `+₩X,XXX`
- 지출: `text-rose-600` + `-₩X,XXX`
- 이체: `text-gray-500` + `₩X,XXX` (부호 없음)

필터 UI: `<form>` + `<select onChange={() => form.submit()>` 로 선택 즉시 URL 갱신.
삭제 버튼: Dialog 확인 모달 트리거 → Client Component로 분리.

#### 6-6. 거래 입력 폼 (`/transactions/new/page.tsx`)

Server Component(계좌/카테고리 데이터 fetch) + Client Component(폼 인터랙션) 분리.

Server Component: `getActiveAccounts()` + `getActiveCategories()` fetch → Client Form에 props 전달.

Client Form 필드:
1. **거래 타입** (세그먼트 버튼): `수입` / `지출` / `이체`
2. **계좌** (Select): 활성 계좌만
3. **도착 계좌** (Select): `type === 'transfer'`일 때만 렌더링. 출발 계좌 제외
4. **카테고리** (Select): `type !== 'transfer'`일 때만 렌더링. 선택된 type에 맞는 것만
5. **금액** (Input): `inputMode="numeric"`. 천 단위 콤마 표시
6. **날짜** (Input, type="date"): 기본값 오늘
7. **메모** (Textarea): 선택. 잔여 글자수 표시 (`{100 - memo.length}자 남음`)

#### 6-7. 거래 수정 폼 (`/transactions/[id]/edit/page.tsx`)

Server Component: `getTransactionById(id)` → 없거나 타인 것이면 `notFound()` → Client Form에 기존값 전달.
모든 필드 수정 가능.

---

### Step 7 — 완료 기준 수동 검증

브라우저에서 직접 확인:

1. 기본 계좌 `opening_balance = 0`
2. 수입 ₩100,000 입력 → 계좌 잔액 ₩100,000 확인
3. 지출 ₩30,000 입력 → 잔액 ₩70,000 확인
4. 새 계좌 생성 (checking, `opening_balance = 0`)
5. 기본 계좌 → 새 계좌 이체 ₩20,000 → 기본 계좌 ₩50,000 / 새 계좌 ₩20,000 확인
6. 카드 계좌 생성 → 지출 ₩50,000 → "결제 예정 ₩50,000" 표시 확인
7. 거래 수정: 지출 ₩30,000 → ₩50,000 변경 → 잔액 재계산 확인
8. 거래 삭제 (확인 모달 → 확인) → 잔액 재계산 확인
9. 월별/계좌/카테고리 필터 동작 확인

---

## 완료 기준 (Definition of Done)

| # | 기준 | 확인 방법 |
|---|------|-----------|
| 1 | 계좌 생성 → 초기 잔액 입력 → 계좌 목록에 표시 | 브라우저 |
| 2 | 지출 1건 입력 (계좌, 카테고리, 금액, 날짜) → 거래 목록 확인 | 브라우저 |
| 3 | 해당 계좌 잔액이 `opening_balance - 지출액`으로 표시 | 계좌 목록 |
| 4 | 이체 1건 입력 → 두 계좌 잔액 모두 변경 | 브라우저 |
| 5 | 카드 계좌 지출 → "결제 예정액 ₩X" 레이블 표시 | 브라우저 |
| 6 | 거래 수정 → 잔액 재계산 반영 | 브라우저 |
| 7 | 거래 삭제 (확인 모달) → 잔액 재계산 반영 | 브라우저 |
| 8 | 월별/계좌/카테고리 필터 동작 | 브라우저 |
| 9 | `balance-calculator.ts` 단위 테스트 통과 | `npx vitest run` |

---

## 구현 순서 권장

```
Step 0: 테스트 스택 설치 + 마이그레이션 적용 (npx supabase db push)
  → Step 1: 사이드바 레이아웃 (기존 가드 유지)
    → Step 2: UI 컴포넌트 추가
      → Step 3: format.ts 금액 포맷 헬퍼
        → Step 4: balance-calculator.ts + 단위 테스트 통과 확인
          → Step 5: 계좌 queries + schemas + actions + UI
            → Step 6: 카테고리 queries
              → Step 7: 거래 schemas + queries + filters
                → Step 8: 거래 actions
                  → Step 9: 거래 목록 UI
                    → Step 10: 거래 입력/수정 폼
                      → Step 11: 완료 기준 수동 검증
```

---

## 재사용 패턴 (Phase 1에서 확립)

### Server Action 기본 구조

```typescript
'use server'

export async function someAction(formData: FormData) {
  const supabase = await createClient()  // src/lib/supabase/server.ts
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const raw = Object.fromEntries(formData)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  // 소유권 확인 (연결된 계좌/카테고리)
  // ...

  const { error } = await supabase.from('table').insert({ ...parsed.data, user_id: user.id })
  if (error) return { error: error.message }

  revalidatePath('/path')
  redirect('/path')
}
```

### Client Form 기본 구조

```typescript
'use client'

export default function SomeForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm({ resolver: zodResolver(schema) })

  async function onSubmit(values) {
    const formData = new FormData()
    Object.entries(values).forEach(([k, v]) => formData.append(k, String(v ?? '')))
    const result = await serverAction(formData)
    if (result?.error) setServerError(result.error)
  }

  return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)}>...</form></Form>
}
```

---

## 주의사항

- **계좌 삭제 없음**: `is_active = false`만 허용. UI에서 "삭제" 대신 "비활성화" 텍스트.
- **이체 1건 저장**: `transfer` 거래는 DB에 1건만 저장. 2건 분리 금지.
- **비활성 계좌**: 거래 선택 드롭다운에서 제외. 잔액 계산에는 포함.
- **거래 삭제**: 확인 모달 필수. `deleted_at` soft delete 패턴 사용 금지, 하드 삭제.
- **카테고리 CRUD**: Phase 2 범위 외. `getActiveCategories()` 조회만 구현.
- **TanStack Query**: Phase 2에서는 Server Component + `revalidatePath` 패턴으로 충분.
- **투자 계좌 잔액**: Phase 2에서는 transfer만 계산. `investment_trades` 연산은 Phase 4.
- **`opening_balance` 변경 불가**: 계좌 수정 시 이름만 변경 가능.
- **`SUPABASE_SERVICE_ROLE_KEY`**: 클라이언트 코드 노출 금지. `admin.ts`는 Server Action 전용.
