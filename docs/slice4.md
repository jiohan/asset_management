# Phase 4: 투자 기능

**목표**: 투자 계좌 현금 잔액 연동 + 보유 수량 계산까지 작동하는 투자 기록 Vertical Slice 완성. 대시보드에서 사용 가능 자산 / 투자 자산 / 전체 자산을 분리 표시한다.

**전제**: Phase 3 완료 기준 전부 통과 확인 후 시작.

---

## DB 현황

Phase 4에서 신규 테이블 3개를 추가한다. 기존 테이블(accounts, transactions 등)은 구조 변경 없이 그대로 사용한다.

**기존 테이블 중 투자와 연관된 것**

`accounts` 테이블의 `account_type = 'investment'` 계좌가 투자의 출발점이다. Phase 2에서 이미 생성 가능하며, 현재 잔액 계산은 transfer만 반영하고 있다. Phase 4에서 이 계좌의 잔액 계산 공식을 확장한다.

**신규 테이블: investment_assets**

종목 정보를 저장한다. 사용자가 투자 계좌에 종목을 등록하면 이 테이블에 한 행이 생성된다.

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

UNIQUE 제약: `(user_id, account_id, market, symbol)` — 같은 투자 계좌에서 같은 심볼을 중복 등록할 수 없다.

삭제 정책: 매수/매도 거래가 연결된 종목은 삭제 불가. 거래가 없는 종목은 하드 삭제 허용.

**신규 테이블: investment_trades**

매수/매도 거래 1건씩을 기록한다. 이 테이블의 데이터가 투자 계좌의 현금 잔액과 보유 수량 계산의 원천이 된다.

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

삭제 정책: 하드 삭제 허용. 확인 모달 필수.

**신규 테이블: investment_events**

배당, 분배금 등 투자 이벤트를 기록한다. 이벤트가 발생하면 투자 계좌의 현금이 증가한다.

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

삭제 정책: 하드 삭제 허용. 확인 모달 필수.

---

## Phase 4 마이그레이션

파일 1개로 3개 테이블 생성 + RLS + 트리거를 모두 처리한다.

파일명: `supabase/migrations/20260330000000_phase4_investments.sql`

**테이블 생성**

investment_assets → investment_trades → investment_events 순서로 생성한다. FK 참조 순서를 지킨다. 각 테이블에 `updated_at` 자동 갱신 트리거를 달아준다.

**RLS 정책**

3개 테이블 모두 동일한 패턴을 적용한다: `user_id = auth.uid()` 조건으로 SELECT, INSERT, UPDATE, DELETE를 각각 보호한다. investment_assets는 공유 참조 데이터가 아니라 사용자별 소유 데이터이므로 다른 사용자의 종목을 볼 수 없다.

**DB 레벨 CHECK 제약**

3개 테이블에 다음 CHECK 제약을 추가한다:
- `investment_assets.market`: 'KRX'만 허용
- `investment_assets.asset_type`: 'stock', 'etf'만 허용
- `investment_trades.trade_type`: 'buy', 'sell'만 허용
- `investment_trades.quantity`: 양의 정수 (> 0)
- `investment_trades.unit_price`: 양의 정수 (> 0)
- `investment_trades.costs`: 0 이상 정수 (>= 0)
- `investment_events.event_type`: 'dividend', 'distribution'만 허용
- `investment_events.amount`: 양의 정수 (> 0)

**소유권 검증 트리거**

3개 테이블 모두 INSERT/UPDATE 시 BEFORE 트리거로 소유권을 검증한다.

`investment_assets`를 INSERT/UPDATE할 때: account_id가 해당 사용자 소유인지, 그리고 `account_type = 'investment'`인지 검사한다.

`investment_trades`와 `investment_events`를 INSERT/UPDATE할 때: account_id와 asset_id가 모두 해당 사용자 소유인지 검사한다. 추가로 `asset_id`가 참조하는 `investment_assets.account_id`가 해당 row의 `account_id`와 일치하는지도 반드시 검증한다 — 이 검증이 없으면 A계좌 자산에 대한 거래를 B계좌 명의로 기록할 수 있고, holdings와 현금 잔액 계산이 즉시 깨진다.

`investment_assets`의 `account_id` FK와 `investment_trades`·`investment_events`의 `asset_id` FK에는 `ON DELETE RESTRICT`를 명시한다 — PostgreSQL 기본값이지만 서버 액션 우회 시에도 고아 레코드가 생기지 않도록 이중 보호한다.

**매수 가능 금액 제약은 DB 레벨에서 하지 않는다.** 잔액은 집계 계산이기 때문에 CHECK 제약으로 표현할 수 없다. 서버 액션에서 현재 잔액을 계산한 후 매수 금액과 비교해 검증한다.

마이그레이션 적용:
```bash
supabase db push
```

타입 재생성:
```bash
supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

---

## 자산 표시 설계

### 핵심 원칙

투자 계좌는 **장부에서는 자산으로 포함하되, 화면에서는 분리 표시**한다.

이유: 실시간 시세 연동 없이 장부가만 관리하기 때문에 투자 자산 숫자의 정확도는 사용자가 마지막으로 거래를 기록한 시점에 머문다. 이걸 일반 계좌와 합산해 단일 "총자산"으로 강조하면 사용자가 정확한 현재 자산으로 오해한다. 그러나 장부 구조에서 투자 계좌를 자산에서 제외하면 예금 → 투자 계좌 이체 시 그 금액이 총자산에서 사라진 것처럼 보인다.

이 두 문제를 동시에 해결하는 방식: **장부는 통합, 화면은 분리.**

### 세 숫자 정의

**사용 가능 자산** (화면 메인 강조)
```
= cash + checking + savings 잔액 합계
- card 잔액 합계
```
언제나 정확한 숫자다. 투자 계좌는 포함하지 않는다.

**투자 자산** (별도 카드, "장부가 기준" 뱃지 표시)
```
= 투자 계좌 현금 잔액 합계
+ 보유 주식 장부가 합계
```
보유 주식 장부가 = Σ(매수 qty × unit_price + costs) - Σ(매도 qty × unit_price - costs)

실시간 시세가 아닌 기록된 원가 기준이다. "장부가 기준" 뱃지로 이 점을 명시한다. 별도 갱신 버튼은 없다 — 새 거래를 기록할 때마다 자동으로 반영된다.

**전체 자산** (접힌 상태 또는 소형 표시)
```
= 사용 가능 자산 + 투자 자산
```
= 기존 `calculateTotalAssets` 결과와 동일 (장부 기준).

### 이체 시나리오 검증

예금 300만원 → 투자 계좌 이체 후:

| 항목 | 이체 전 | 이체 후 |
|------|---------|---------|
| 사용 가능 자산 | 1,000만원 | 700만원 |
| 투자 자산 | 0원 | 300만원 |
| 전체 자산 | 1,000만원 | 1,000만원 |

사용 가능 자산은 줄지만 전체 자산은 유지된다. 돈이 이동했음을 두 숫자로 확인 가능하다.

투자 계좌 현금 300만원으로 주식 매수 후:

| 항목 | 매수 전 | 매수 후 |
|------|---------|---------|
| 사용 가능 자산 | 700만원 | 700만원 |
| 투자 계좌 현금 | 300만원 | 0원 |
| 보유 주식 장부가 | 0원 | 300만원 |
| 투자 자산 합계 | 300만원 | 300만원 |
| 전체 자산 | 1,000만원 | 1,000만원 |

매수해도 어떤 숫자도 줄지 않는다. 현금이 주식 장부가로 전환됐을 뿐이다.

---

## 잔액 계산 공식 확장

**현재 상태**

`src/features/accounts/balance-calculator.ts`의 `calculateBalance` 함수는 투자 계좌(`account_type === 'investment'`) 분기에서 transfer 수신/송신만 처리하고 있다. 코드 주석에도 "Phase 4에서 매수/매도 추가"라고 명시되어 있다.

**Phase 4에서 추가할 것**

투자 계좌의 완전한 현금 잔액 공식:

```
투자 계좌 현금 잔액
= opening_balance
+ Σ transfer 수신 (transfer_to_account_id = 계좌)
- Σ transfer 송신 (account_id = 계좌)
- Σ 매수 (quantity × unit_price + costs)
+ Σ 매도 (quantity × unit_price - costs)
+ Σ investment_events.amount
```

이를 구현하기 위해 `calculateBalance` 함수의 시그니처를 확장한다. 투자 거래와 이벤트를 위한 새 입력 타입 `TradeForBalance`와 `EventForBalance`를 정의하고, 투자 계좌 분기에서 이 데이터를 추가로 반영한다. 일반 계좌와 카드 계좌의 기존 로직은 손대지 않는다.

`calculateAllBalances`도 같은 방식으로 확장한다. 쿼리 레이어(`queries.ts` 또는 새 `src/features/investments/queries.ts`)에서 투자 거래·이벤트 데이터를 가져와 계산 함수에 전달하는 흐름이 된다.

이 변경으로 대시보드와 계좌 목록의 투자 계좌 잔액이 매수/매도/배당을 모두 반영한 값으로 자동 갱신된다.

**신규 계산 함수 두 개 추가**

`calculateLiquidAssets(accounts, balances)`: investment와 card를 제외한 일반 계좌 잔액 합계에서 card 잔액을 차감한 값. "사용 가능 자산" 숫자를 만든다.

`calculateInvestmentValue(accounts, balances, trades)`: 투자 계좌 현금 잔액 합계 + 보유 주식 장부가 합계. "투자 자산" 숫자를 만든다. 장부가 계산은 holdings.ts의 함수를 재사용한다.

`calculateTotalAssets`는 `trades` 파라미터를 추가해 보유 주식 장부가를 포함하도록 확장한다 (기본값 `[]`로 기존 호출 호환 유지). 세 숫자의 관계: `전체 자산 = calculateLiquidAssets + calculateInvestmentValue` 가 항상 성립한다. 이 항등식은 balance-calculator.test.ts의 단위 테스트로 검증한다.

---

## 보유 수량 계산

`src/features/investments/holdings.ts`를 신규 생성한다. balance-calculator.ts와 동일한 순수 함수 방식으로 작성한다 — DB 접근 없이 입력 데이터만으로 계산한다.

**계산 로직**

특정 자산의 현재 보유 수량 = Σ(buy quantity) - Σ(sell quantity)

asset_id 별로 그룹핑해서 Map 형태로 반환하는 함수를 만든다.

**초과 매도 방지**

매도 서버 액션에서 다음 순서로 검증한다:
1. 해당 asset_id의 모든 trades를 조회한다.
2. holdings.ts의 계산 함수로 현재 보유 수량을 산출한다.
3. 요청한 매도 수량 > 현재 보유 수량이면 에러를 반환한다.
4. 검증 통과 후 INSERT한다.

DB 트리거가 아닌 서버 액션 레벨에서만 처리한다. domain-rules.md에 "서버 액션에서 검증"이라고 명시되어 있다.

**매수 삭제 시 holdings 무결성 검증**

`deleteTrade`는 domain-rules.md 기준 하드 삭제가 허용되지만, 매수(buy) 거래를 삭제하면 보유 수량이 음수가 될 수 있다. 삭제 서버 액션에서 다음 순서로 검증한다:
1. 삭제 대상 trade를 조회한다.
2. `trade_type = 'buy'`인 경우에만 검증이 필요하다. sell 삭제는 항상 안전하다.
3. 해당 asset_id의 모든 trades에서 삭제 대상을 제외한 후 holdings 계산 함수로 잔여 수량을 산출한다.
4. 잔여 수량 < 0이면 "이 매수 거래를 삭제하면 현재 보유 수량이 음수가 됩니다" 에러를 반환한다.
5. 검증 통과 후 DELETE한다.

---

## 구현 순서

아래 순서대로 진행한다. 각 단계가 완료된 후 다음으로 넘어간다.

**1단계: DB 마이그레이션**

마이그레이션 파일 작성 후 `supabase db push`. 타입 재생성까지 완료. Supabase 대시보드에서 테이블 3개와 RLS 정책 확인.

**2단계: features/investments 핵심 로직**

`src/features/investments/` 디렉터리 아래에 schemas.ts, queries.ts, actions.ts, holdings.ts를 순서대로 작성한다. 이 시점에 balance-calculator.ts도 확장한다.

**3단계: Vitest 단위 테스트**

holdings.ts와 수정된 balance-calculator.ts에 대한 단위 테스트를 작성하고 통과시킨다. UI 작업 전에 핵심 로직이 올바른지 확인한다.

**4단계: proxy.ts + SidebarNav.tsx 업데이트**

`src/proxy.ts`의 `PROTECTED_PREFIXES`에 `'/investments'` 추가. `src/app/(app)/SidebarNav.tsx`에 투자 메뉴 항목 추가. 이 두 파일을 먼저 수정해야 이후 UI 라우트가 올바르게 보호된다.

**5단계: app/(app)/investments UI**

투자 화면 페이지와 컴포넌트를 작성한다.

**6단계: 잔액 계산 연동 확인**

투자 계좌 잔액이 대시보드 계좌 요약, 계좌 관리 페이지, 총자산에 올바르게 반영되는지 브라우저에서 확인한다. 특히 매수 입력 후 `/accounts` 페이지와 `/dashboard` 두 곳 모두 잔액이 줄어드는지 확인한다.

---

## features/investments/ 구조

```
src/features/investments/
  ├─ schemas.ts     — Zod 검증 스키마
  ├─ queries.ts     — DB 조회 함수
  ├─ actions.ts     — Server Actions
  └─ holdings.ts    — 보유 수량 계산 순수 함수
```

balance-calculator.ts의 투자 계좌 현금 잔액 계산은 기존 파일(`src/features/accounts/balance-calculator.ts`)을 확장하는 방식으로 처리한다. 별도 `cash-balance.ts` 파일을 만들지 않고 기존 계산 함수의 시그니처를 넓히는 쪽이 일관성이 있다. 단위 테스트도 기존 `balance-calculator.test.ts`에 투자 케이스를 추가한다.

참고: `vertical-slices.md`의 Phase 4 섹션은 `cash-balance.ts`를 별도 파일로 두는 방식으로 적혀 있는데, 실제 코드 구조상 기존 `balance-calculator.ts` 확장이 더 일관성이 있어 이 문서 방향을 따른다. Phase 4 구현 완료 후 `vertical-slices.md`의 해당 줄을 `balance-calculator.ts` 확장으로 수정한다.

**schemas.ts**

createAssetSchema: 종목 등록 시 입력 검증. account_id(투자 계좌), market(KRX 고정), name, symbol, asset_type(stock/etf)를 검증한다.

createTradeSchema: 매수/매도 입력 검증. account_id, asset_id, trade_type(buy/sell), quantity(양의 정수), unit_price(양의 정수), costs(0 이상), trade_date를 검증한다.

createEventSchema: 배당/분배금 입력 검증. account_id, asset_id, event_type(dividend/distribution), amount(양의 정수), event_date를 검증한다.

**queries.ts**

`getInvestmentAssets(accountId)`: 특정 투자 계좌의 종목 목록. 보유 수량 계산을 위해 trades도 함께 조회하거나, 별도 함수를 만든다.

`getTradesByAsset(assetId)`: 특정 종목의 모든 매수/매도 기록. 보유 수량 계산에 사용.

`getAllTradesForBalance()`: 사용자 전체 투자 계좌의 모든 매수/매도 기록을 한 번에 조회한다. accountId 단위로 나누지 않는다. 기존 `getAllTransactionsForBalance()`가 사용자 전체 거래를 한 번에 가져오는 것과 같은 패턴이다. 여러 투자 계좌가 있을 때 N+1이 발생하지 않도록 하기 위함이다.

`getAllEventsForBalance()`: 사용자 전체 투자 계좌의 모든 이벤트를 한 번에 조회한다. 같은 이유로 accountId 단위로 나누지 않는다.

**actions.ts**

`createAsset(formData)`: 종목 등록. account_id는 사용자 소유 + is_active = true + account_type = 'investment'인지 서버 액션에서 검증한다. 같은 (account_id, market, symbol) 조합의 UNIQUE 제약 위반 시 에러 반환.

`createTrade(formData)`: 매수/매도 기록. account_id는 is_active = true인 투자 계좌만 허용한다. 매도 시 초과 매도 검증 포함. 성공 시 `/investments/[accountId]`와 `/accounts`, `/dashboard` 모두 revalidatePath — 잔액이 3곳에 표시되기 때문이다.

`createEvent(formData)`: 배당/분배금 기록. account_id는 is_active = true인 투자 계좌만 허용한다. 성공 시 `/investments/[accountId]`, `/accounts`, `/dashboard` 모두 revalidatePath.

`deleteTrade(formData)`: 매수/매도 삭제. 확인 모달은 UI 레이어에서 처리. 성공 시 `/investments/[accountId]`, `/accounts`, `/dashboard` 모두 revalidatePath — 잔액·총자산이 세 곳에 표시되기 때문이다.

`deleteEvent(formData)`: 이벤트 삭제. 성공 시 동일하게 `/investments/[accountId]`, `/accounts`, `/dashboard` revalidatePath.

`deleteAsset(formData)`: 종목 삭제. 연결된 trades 또는 events가 있으면 에러 반환 (`investment_trades`, `investment_events` 두 테이블을 모두 체크해야 한다). 없으면 하드 삭제.

---

## app/(app)/investments/ 구조

```
src/app/(app)/investments/
  ├─ page.tsx                    — 투자 계좌 목록 + 계좌 선택 진입점
  ├─ [accountId]/
  │    ├─ page.tsx               — 선택된 투자 계좌의 종목 목록 + 거래 내역
  │    ├─ AssetList.tsx          — 종목별 보유 수량 + 현재 현금 잔액 표시
  │    ├─ TradeList.tsx          — 매수/매도 거래 목록
  │    ├─ EventList.tsx          — 배당/분배금 이벤트 목록
  │    ├─ AddAssetForm.tsx       — 종목 등록 폼 (Dialog)
  │    ├─ AddTradeForm.tsx       — 매수/매도 입력 폼 (Dialog 또는 Drawer)
  │    ├─ AddEventForm.tsx       — 배당/분배금 입력 폼 (Dialog)
  │    └─ DeleteConfirmButton.tsx — 거래/이벤트 삭제 확인 모달 공용 컴포넌트
```

**page.tsx (최상위)**

사용자의 투자 계좌 목록을 Server Component에서 조회해 표시한다. 투자 계좌가 없으면 계좌 생성 안내를 보여준다. 투자 계좌를 클릭하면 `[accountId]` 라우트로 이동한다.

**[accountId]/page.tsx**

URL의 accountId로 해당 계좌를 조회한다. 해당 계좌가 존재하지 않거나 `account_type !== 'investment'`이면 `/investments`로 redirect한다. 페이지 상단에 현재 현금 잔액을 표시하고, 종목 목록 + 보유 수량, 매수/매도 거래 내역, 배당 이벤트 내역을 세 섹션으로 나눠 보여준다.

**AssetList.tsx**

종목별로 보유 수량을 표시한다. 보유 수량이 0인 종목(전량 매도)도 표시하되 시각적으로 구분한다. 거래가 없는 종목에만 삭제 버튼을 표시한다.

**AddTradeForm.tsx**

매수/매도 타입을 radio로 선택한다. 종목은 현재 계좌에 등록된 종목 중 선택한다. 매도 선택 시 현재 보유 수량을 안내 텍스트로 표시해 사용자가 초과 입력 전에 인지할 수 있도록 한다. 서버 액션에서 초과 매도 에러가 반환되면 폼 아래에 에러 메시지를 표시한다.

---

## 잔액 계산 연동 (대시보드 + 계좌 목록)

Phase 4 완료 후 투자 계좌 잔액이 대시보드와 계좌 관리 페이지 양쪽에서 올바르게 반영되어야 한다.

**변경이 필요한 파일**

`src/features/accounts/queries.ts`의 `getAllTransactionsForBalance`는 transactions 테이블만 조회한다. Phase 4에서 확장된 `calculateBalance`는 trades와 events 데이터도 필요로 하므로, 이 두 데이터를 공급하는 함수가 추가된다.

변경 대상 페이지는 두 곳이다:
- `src/app/(app)/dashboard/page.tsx` — `Promise.all`에 `getAllTradesForBalance()`, `getAllEventsForBalance()` 추가
- `src/app/(app)/accounts/page.tsx` — 동일. 이 파일도 `calculateAllBalances`를 호출하므로 동일하게 수정해야 한다

**대시보드 UI 변경**

`StatsCards.tsx`는 현재 `totalAssets` 하나만 받는다. Phase 4에서 `liquidAssets`, `investmentValue`, `totalAssets` 세 개를 받도록 props를 확장한다.

화면 레이아웃:
- 상단 강조 영역: "사용 가능 자산" 크게 표시 (기존 totalAssets 자리)
- 투자 자산 카드: "투자 자산" 숫자 + "장부가 기준" 뱃지 + 계좌별 현금/종목 장부가 목록
- 전체 자산: 접힌 상태 기본값, 펼치면 = 사용 가능 자산 + 투자 자산 합계 표시

`AccountSummary.tsx`와 `AccountList.tsx`는 변경하지 않는다 — 계좌별 잔액 숫자는 기존 그대로.

**proxy.ts와 SidebarNav.tsx 업데이트**

`/investments` 경로는 (app) 그룹 보호 라우트에 포함해야 한다. `src/proxy.ts`의 `PROTECTED_PREFIXES` 배열에 `'/investments'`를 추가한다. 누락 시 미로그인 사용자가 /investments에 직접 접근할 수 있다.

`src/app/(app)/SidebarNav.tsx`의 `navItems` 배열에 투자 메뉴 항목을 추가한다. 아이콘은 lucide-react에서 `TrendingUp` 또는 `BarChart2`를 사용한다.

---

## 완료 기준

아래 흐름이 실제 브라우저에서 전부 동작해야 Phase 4 완료.

**1. 투자 계좌 생성 → 대시보드 자산 표시 확인**

accounts 페이지에서 account_type = investment로 계좌를 생성하고 opening_balance를 입력한다. 대시보드에서 사용 가능 자산은 변화 없고, 투자 자산과 전체 자산에 반영됨을 확인한다.

**2. 예금 → 투자 계좌 이체 → 전체 자산 불변 확인**

예금 계좌에서 투자 계좌로 이체한다. 사용 가능 자산은 이체액만큼 줄고, 투자 자산은 이체액만큼 늘고, 전체 자산은 변화 없음을 확인한다. 이 확인이 핵심이다 — 이체가 "지출처럼 보이지 않는다"는 것을 검증하는 기준이다.

**3. 종목 등록 → 매수 입력 → 투자 자산 구성 변화 확인**

/investments/[accountId]에서 종목을 등록하고 매수 거래를 입력한다. 매수 후: 투자 계좌 현금은 줄고, 보유 주식 장부가가 그만큼 생기며, 투자 자산 합계와 전체 자산은 변화 없음을 확인한다.

**4. 매도 입력 → 보유 수량 감소, 투자 계좌 현금 증가 확인**

매도 거래를 입력하면 보유 수량이 줄고, 투자 계좌 현금이 `quantity × unit_price - costs`만큼 늘어남을 확인한다.

**5. 초과 매도 시도 → 오류 메시지 표시**

현재 보유 수량을 초과하는 매도 수량을 입력하면 폼에 에러 메시지가 표시되고 저장되지 않음을 확인한다.

**6. 배당 이벤트 입력 → 투자 자산 증가 확인**

배당(dividend) 또는 분배금(distribution) 이벤트를 입력하면 투자 계좌 현금이 amount만큼 증가하고, 투자 자산과 전체 자산도 같은 금액만큼 증가함을 확인한다.

**7. 대시보드 세 숫자 표시 확인**

대시보드에서 사용 가능 자산(강조), 투자 자산("장부가 기준" 뱃지 포함), 전체 자산(접힌 기본값)이 각각 올바른 숫자로 표시되는지 확인한다.

**8. Vitest 단위 테스트 통과**

아래 파일의 테스트가 모두 통과해야 한다:
- `balance-calculator.test.ts` — 투자 계좌 현금 잔액, calculateLiquidAssets, calculateInvestmentValue 케이스 포함
- `holdings.test.ts` (신규) — 보유 수량 및 장부가 계산 케이스

---

## 단위 테스트 계획

**balance-calculator.test.ts 추가 케이스**

- 투자 계좌: 매수 1건 후 현금 잔액이 `opening_balance - (quantity × unit_price + costs)`인지
- 투자 계좌: 매도 1건 후 현금 잔액이 `opening_balance + (quantity × unit_price - costs)`인지
- 투자 계좌: transfer 수신 + 매수 + 배당 이벤트가 모두 반영되는지
- 투자 계좌: costs가 0인 매수도 올바르게 처리되는지
- 일반 계좌의 기존 계산에 영향이 없는지 (regression)
- `calculateLiquidAssets`: investment 계좌를 제외하고 card를 차감한 값이 맞는지
- `calculateInvestmentValue`: 현금 잔액 + 보유 주식 장부가 합계가 맞는지
- `calculateLiquidAssets + calculateInvestmentValue === calculateTotalAssets` 항등식이 성립하는지

**holdings.test.ts 케이스**

- 매수만 있는 경우: 보유 수량 = 매수 수량 합계
- 매수 후 일부 매도: 보유 수량 = 매수 합계 - 매도 합계
- 전량 매도: 보유 수량 = 0
- 여러 종목이 있을 때 asset_id별로 독립적으로 계산되는지
- 거래 없는 asset_id: 보유 수량 = 0 반환 (Map에 없는 키 접근 처리)
- 장부가 계산: 매수 원가 합계 - 매도 회수액 합계가 맞는지

**Playwright E2E smoke (신규)**

기존 E2E(ledger.spec.ts, dashboard.spec.ts)에 투자 플로우 smoke 1개를 추가한다:
- 투자 계좌 생성 → 대시보드에서 투자 자산 카드 노출 확인
- 예금 → 투자 이체 → 전체 자산 변화 없음 확인 (사용 가능 자산 감소, 투자 자산 증가)
- 종목 등록 → 매수 입력 → 투자 자산 합계 불변, 보유 종목 장부가 노출 확인
- 초과 매도 시도 → 에러 메시지 표시 확인
