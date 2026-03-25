# Slice 3: 대시보드

## 목표

이번 달 재정 현황(수입/지출/순수입/이체)과 총자산, 계좌별 잔액, 지출 카테고리 차트, 최근 거래를 한 화면에 표시하는 대시보드를 완성한다.

**완료 기준**: vertical-slices.md Phase 3 항목 전부 통과

---

## 사전 준비

```bash
npm install recharts
```

CLAUDE.md에 Recharts v3 명시. DB 마이그레이션 없음.

---

## 터치하는 파일

| 상태 | 파일 | 역할 |
|------|------|------|
| 신규 | `src/features/dashboard/aggregations.ts` | 월간 통계 집계 순수 함수 |
| 신규 | `src/features/dashboard/aggregations.test.ts` | aggregations.ts 단위 테스트 (Vitest) |
| 신규 | `src/app/(app)/dashboard/MonthSelector.tsx` | 월 이동 UI (Client) |
| 신규 | `src/app/(app)/dashboard/StatsCards.tsx` | 수치 카드 4개 |
| 신규 | `src/app/(app)/dashboard/TrendChart.tsx` | 월간 수입/지출 트렌드 바 차트 (Client) |
| 신규 | `src/app/(app)/dashboard/CategoryChart.tsx` | 지출 카테고리 도넛 차트 (Client) |
| 신규 | `src/app/(app)/dashboard/AccountSummary.tsx` | 계좌별 잔액 목록 |
| 신규 | `src/app/(app)/dashboard/RecentTransactions.tsx` | 최근 거래 5건 |
| 수정 | `src/app/(app)/dashboard/page.tsx` | placeholder → 실제 구현 |

---

## 데이터 설계

### 쿼리 구조

`page.tsx`에서 `Promise.all`로 3개 쿼리를 병렬 실행한다.

| 쿼리 함수 | 목적 | 이유 |
|-----------|------|------|
| `getAccounts()` | 계좌 목록 (비활성 포함) | 계좌별 잔액 계산에 비활성 계좌도 필요 |
| `getAllTransactionsForBalance()` | 전체 거래 기간 기준 최소 필드 거래 | 잔액은 개설 시점부터 전체 거래 기반으로 계산 |
| `getTransactions({ month })` | 선택한 달의 거래 (category 관계 포함) | 월별 통계·차트용. 관계 데이터 필요 |

두 번의 transactions 쿼리가 필요한 이유: 잔액 계산은 전체 거래가 필요하고, 통계는 해당 월 거래만 필요하며 카테고리 정보를 포함해야 한다. 역할이 다르므로 기존 두 함수를 그대로 재사용한다.

### 집계 흐름

1. `calculateAllBalances(accounts, allTransactions)` → 계좌별 잔액 Map
2. `calculateTotalAssets(accounts, balancesMap)` → 총자산
3. `getMonthlyStats(monthlyTransactions)` → 월간 수입/지출/순수입/이체
4. `getCategoryExpenses(monthlyTransactions)` → 카테고리별 지출 배열 (차트용)
5. `monthlyTransactions.slice(0, 5)` → 최근 거래 5건

### 월 선택 처리

URL searchParam `?month=YYYY-MM`으로 선택 월을 관리한다. `transactions/page.tsx`와 동일한 방식이다.

- 파라미터 없음 → 현재 월 기본값
- 잘못된 형식 → 현재 월 폴백
- `MonthSelector`가 URL을 변경하면 Server Component가 리렌더된다

**월 유효성 검증 강화**

기존 `transactions` 패턴(`/^\d{4}-\d{2}$/` 정규식만 사용)은 `2026-13`, `2026-00` 같은 잘못된 월 값도 통과시킨다. 이 값이 `queries.ts`에서 날짜 문자열로 조합되면(`2026-13-01`) Supabase 쿼리 오동작 또는 에러가 발생할 수 있다. 대시보드에서는 정규식 + 월 범위 검사를 함께 적용한다.

```ts
// 올바른 검증: 형식 + 범위 동시 확인
function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const month = parseInt(value.split('-')[1], 10)
  return month >= 1 && month <= 12
}
```

**서버/클라이언트 시간 동기화 주의**

서버(`page.tsx`)와 클라이언트(`MonthSelector.tsx`) 모두 `new Date()`로 현재 월을 계산하면, UTC 기준 서버와 KST(UTC+9) 기준 브라우저가 월말 경계(예: KST 4월 1일 00:30 = UTC 3월 31일 15:30)에서 서로 다른 달을 가리킬 수 있다.

해결 원칙: **서버가 현재 월 기본값을 결정하고, 클라이언트는 서버가 내려준 값을 따른다.** `page.tsx`에서 계산한 `currentMonth`를 `MonthSelector`에 `props`로 전달해 클라이언트에서 독자적으로 `new Date()`를 호출하지 않도록 한다.

### 직렬화 주의

`calculateAllBalances`가 반환하는 `Map<string, number>`는 Client Component에 props로 직접 전달할 수 없다. `Object.fromEntries(balancesMap)`으로 `Record<string, number>`로 변환 후 전달한다. (기존 `accounts/page.tsx`와 동일한 패턴)

---

## 화면 설계

데스크탑 기준 1280px, 단일 컬럼에 5개 섹션을 수직 배치한다.

```
┌──────────────────────────────────────────────────────────────┐
│  [< 2026년 2월]    2026년 3월    [2026년 4월 >]               │
│                                          (미래 월: 비활성)    │
├────────────┬────────────┬────────────┬───────────────────────┤
│  총자산     │  이번 달   │  이번 달   │  순수입               │
│  ₩X,XXX   │  수입      │  지출      │  ±₩X,XXX             │
│            │  +₩X,XXX  │  -₩X,XXX  │                       │
│            │            │            │  이체 ₩X,XXX (보조)   │
├──────────────────────────────────────────────────────────────┤
│  월간 수입 / 지출 트렌드                                       │
│  [Recharts BarChart — 최근 6개월, 수입(emerald) vs 지출(rose)]│
│  X축: 월, Y축: 금액, Tooltip: 월별 수입·지출 합계             │
├────────────────────────────┬─────────────────────────────────┤
│  지출 카테고리             │  계좌별 잔액                     │
│                            │  현금 / 입출금 / 저축 / 투자     │
│  [Recharts Donut Chart]   │  카드: "결제 예정" 표시          │
│  범례: 카테고리명 + 금액   │                                  │
├────────────────────────────┴─────────────────────────────────┤
│  최근 거래                                       전체 보기 →  │
│  날짜 / 타입 / 계좌 / 카테고리 / 메모 / 금액                  │
│  (5건, 읽기 전용)                                             │
└──────────────────────────────────────────────────────────────┘
```

카드 스타일은 design-rules.md 기준: `bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]`

---

## 컴포넌트별 설계 방향

### `aggregations.ts`

두 개의 순수 함수만 포함한다. DB 접근 없음. `TransactionWithRelations`를 입력으로 받는다.

**`getMonthlyStats(transactions)`**
- income / expense / transfer 거래를 각각 합산한다
- 순수입 = 수입 합계 - 지출 합계
- 이체 총액: transfer 거래 1건당 amount를 1회만 집계한다 (이체는 두 계좌에 영향을 미치지만 이체 자체의 금액은 1건)
- 반환 타입: `{ totalIncome, totalExpense, netIncome, totalTransfer }`

**`getCategoryExpenses(transactions)`**
- expense 타입 거래를 카테고리별로 그룹화해 합산한다
- category가 null인 거래(이체)는 건너뛴다
- 전체 지출 대비 퍼센티지를 계산해 포함한다
- 지출이 없으면 빈 배열 반환 → UI에서 빈 상태 처리

### `page.tsx`

Server Component. `searchParams`에서 month를 추출하고, Promise.all로 3개 쿼리를 병렬 실행한다. 집계 함수를 호출해 결과를 자식 컴포넌트에 props로 전달한다.

`MonthSelector`는 `useSearchParams`를 사용하므로 `<Suspense>`로 래핑해야 한다. (Next.js 요구사항, `transactions/page.tsx`의 `TransactionFilters` 처리와 동일)

### `MonthSelector.tsx`

**Client Component.** `useSearchParams` + `useRouter`로 URL `?month=YYYY-MM` 파라미터를 변경한다.

- 이전 월 / 현재 월 표시 / 다음 월 버튼 3개
- 현재 달 이후(미래)는 다음 월 버튼 비활성
- 표시 형식: `2026년 3월` (한국어 연·월)

URL을 변경하면 Server Component가 새 month로 리렌더되어 모든 수치가 재계산된다.

### `StatsCards.tsx`

Server Component. props만 받는다.

총자산 / 수입 / 지출 / 순수입 4개 카드를 그리드로 표시한다.

- 총자산: 중립색 (전체 기간 기준, 월 선택과 무관)
- 수입: emerald-600, `+₩X,XXX` 형식
- 지출: rose-600, `-₩X,XXX` 형식
- 순수입: 양수이면 emerald-600, 음수이면 rose-600
- 이체 총액은 카드 아래 보조 텍스트로 별도 표시 (회색, text-sm)
- 수치는 Display 단계: `text-2xl font-semibold` (design-rules.md 기준)

### `TrendChart.tsx`

**Client Component.** Recharts의 `BarChart`를 사용해 최근 6개월 수입·지출 트렌드를 표시한다.

- `page.tsx`에서 `getTransactions` 범위를 최근 6개월로 확장해 트렌드 데이터 준비 (또는 `aggregations.ts`의 `getMonthlyTrend` 순수 함수로 분리)
- `ResponsiveContainer` → `BarChart` → `Bar` 2개 (수입: emerald-500, 지출: rose-500)
- `XAxis`: 월 표시 (`3월`, `4월` 형식), `YAxis`: 금액, `Tooltip`: 해당 월 수입·지출 합계
- `Legend`: 수입 / 지출
- 빈 상태: 6개월 데이터가 모두 없으면 "데이터가 없습니다" 표시

**그래프로 표현해야 하는 데이터 정책**

수치만으로 파악이 어렵거나 시각적 비교·비중 파악이 필요한 데이터는 반드시 그래프로 표시한다:

| 데이터 | 그래프 형식 | 이유 |
|--------|-------------|------|
| 카테고리별 지출 비중 | Donut Chart | 전체 대비 각 항목의 상대 비중 직관 파악 |
| 월간 수입/지출 추이 | Bar Chart (grouped) | 기간별 변화 및 수입·지출 상호 비교 |

수치 카드(StatsCards)는 단순 집계값이므로 그래프 불필요. 계좌별 잔액은 목록 형태가 정보 밀도상 유리하므로 그래프 미사용.

### `CategoryChart.tsx`

**Client Component.** Recharts의 `PieChart`를 도넛 형태로 렌더한다.

- `ResponsiveContainer` → `PieChart` → `Pie` (innerRadius, outerRadius 설정)
- 색상: 카테고리 `color` 컬럼은 `TransactionWithRelations`에 포함되지 않으므로 이 단계에서는 미사용. 인덱스 기반 하드코딩 팔레트(indigo/rose/amber/emerald 등 9색)를 사용한다. Phase 6 카테고리 설정 기능 추가 후 연결 예정.
- `Tooltip`: 카테고리명 + 금액 + 퍼센트
- `Legend`: 카테고리명 + 금액
- 빈 상태: `data` 배열이 비어있으면 도넛 대신 "이번 달 지출 내역이 없습니다" 텍스트 표시

### `AccountSummary.tsx`

Server Component. 활성 계좌(`is_active === true`)만 표시한다. 비활성 계좌는 숨긴다(잔액 계산에는 포함되지만 요약 표시는 불필요).

- 계좌 타입 한국어 표시: 현금 / 입출금 / 저축 / 투자 / 카드
- 카드 계좌: "결제 예정" 레이블 + rose-600 (기존 `AccountList.tsx` 패턴과 동일)
- 잔액은 `Record<string, number>` 형태로 props 수신

### `RecentTransactions.tsx`

Server Component. `page.tsx`에서 `monthlyTransactions.slice(0, 5)`를 props로 받는다.

- 기존 `transactions/page.tsx` 테이블 UI 패턴 재사용
- 수정/삭제 버튼 없음 (읽기 전용)
- 오른쪽 상단 "전체 보기" 링크 → `/transactions`
- 거래 없을 때 빈 상태 메시지 표시

### `aggregations.test.ts`

`aggregations.ts`의 모든 순수 함수는 Vitest로 단위 테스트를 작성한다. `balance-calculator.test.ts` 패턴을 따른다.

필수 테스트 케이스:

| 함수 | 테스트 케이스 |
|------|---------------|
| `getMonthlyStats` | income/expense/transfer 혼합 거래 → 각 합계 정확성 |
| `getMonthlyStats` | 빈 배열 → 모든 값 0 |
| `getMonthlyStats` | transfer 거래 중복 합산 없음 (이체 1건 = 1회 집계) |
| `getCategoryExpenses` | 카테고리별 그룹핑 및 합산 정확성 |
| `getCategoryExpenses` | category null 거래(이체) 건너뜀 |
| `getCategoryExpenses` | 지출 없음 → 빈 배열 |
| `getCategoryExpenses` | 퍼센티지 합계 ≈ 100% |

---

## UI/UX 품질 기준

프론트엔드 구현 시 **`ui-ux-pro-max` skill**을 활용해 고품질 디자인을 적용한다. 구현 전 해당 skill로 컴포넌트 설계를 검토하고, 색상·타이포그래피·spacing은 design-rules.md 기준을 따른다.

- 카드, 차트, 목록 모두 design-rules.md 컴포넌트 규칙 준수
- 차트 색상 팔레트는 design-rules.md의 4색 기반으로 확장 (indigo/rose/amber/emerald 계열)
- 반응형: 모바일에서 그리드 컬럼 수 조정 (`grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-4`)
- 로딩/빈 상태 UI 일관성 유지

---

## 기술 결정 사항

| 결정 | 이유 |
|------|------|
| **TanStack Query 미도입** | 대시보드는 Server Component + searchParams 패턴으로 충분하다. 상태 변이 없는 순수 읽기 작업이므로 클라이언트 캐싱 불필요 |
| **aggregations.ts 분리** | 집계 로직을 page.tsx에 직접 작성하면 테스트할 수 없다. 순수 함수로 분리해 Vitest 단위 테스트 가능하게 한다 |
| **aggregations.test.ts 필수** | `balance-calculator.test.ts`와 동일 기준. income/expense/transfer 합산, 카테고리 그룹핑, 빈 달 처리 등 핵심 로직을 테스트로 고정하지 않으면 회귀 보장 불가 |
| **월 검증 강화** | 기존 `transactions` 패턴의 정규식만으로는 `2026-13` 같은 값이 통과되어 쿼리 오동작 가능. 형식 + 월 범위(01-12) 동시 검사 |
| **현재 월 서버 결정** | 서버/클라이언트 모두 독자적으로 `new Date()`를 호출하면 UTC/KST 경계에서 불일치 발생. 서버가 결정한 `currentMonth`를 props로 내려받아 클라이언트는 재계산 없이 사용 |
| **카테고리 색상 하드코딩** | `TransactionWithRelations`에 color 필드가 없다. Phase 6에서 카테고리 설정 기능 추가 시 쿼리에 color를 포함하고 이 부분을 교체한다 |
| **기존 쿼리 재사용** | `getAllTransactionsForBalance`(잔액용 전체 거래)와 `getTransactions`(통계용 월별+관계)는 역할이 달라 분리 유지가 올바르다. 새 쿼리 함수를 만들 필요 없다 |
| **도넛 차트 + 바 차트** | 카테고리 도넛: 상대 비중 직관 파악. 트렌드 바 차트: 월간 수입·지출 변화 및 상호 비교. 수치만으로는 파악 어려운 데이터는 반드시 그래프로 표시 |
| **Client Component 최소화** | Recharts는 클라이언트 전용, MonthSelector는 useSearchParams 사용 — 이 세 개(TrendChart 포함)만 Client Component. 나머지는 Server Component로 유지한다 |

---

## 완료 기준 체크리스트

아래 항목이 실제 브라우저에서 모두 동작해야 Phase 3 완료:

- [ ] 1. 이번 달 총수입 / 총지출 / 순수입 / 이체 총액 정확히 표시
- [ ] 2. 총자산 = Σ(일반+투자 계좌) - Σ(카드 계좌) 공식 적용 확인
- [ ] 3. 계좌별 잔액 요약 표시 (카드 계좌는 "결제 예정" 표시)
- [ ] 4. 지출 카테고리 차트 표시 (Recharts 도넛)
- [ ] 5. 월간 수입/지출 트렌드 바 차트 표시 (최근 6개월)
- [ ] 6. 최근 거래 목록 5건 표시
- [ ] 7. 월 선택 (이전/다음) 시 통계·차트·최근 거래 전부 재계산 반영
- [ ] 8. 지출 없는 달 → 카테고리 차트 빈 상태 메시지 표시
- [ ] 9. 거래 없는 달 → 모든 수치 ₩0 표시
- [ ] 10. `?month=2026-13` 등 잘못된 월 값 → 현재 월 폴백 (오동작 없음)
- [ ] 11. `aggregations.test.ts` 전체 테스트 통과

**다음 Phase 진입 조건**: 위 11개 항목 전부 통과 시 Phase 4 (투자 기능) 진행
