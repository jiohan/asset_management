import { test, expect, type Page } from '@playwright/test'

// 인증이 필요한 테스트는 아래 환경 변수 설정 후 실행:
//   TEST_USER_EMAIL=xxx@example.com TEST_USER_PASSWORD=secret npx playwright test
const TEST_EMAIL = process.env.TEST_USER_EMAIL
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

// ₩10,000 → 10000
function parseKRW(text: string | null): number {
  return parseInt((text ?? '0').replace(/[₩,]/g, ''), 10)
}

// ---------------------------------------------------------------------------
// Smoke: 인증 없이 항상 실행
// ---------------------------------------------------------------------------

test('로그인 페이지 접근 가능', async ({ page }) => {
  await page.goto('/login')
  // CardTitle은 shadcn/ui에서 <div>로 렌더링되므로 getByText 사용
  await expect(page.getByText('로그인', { exact: true }).first()).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()
})

test('미인증 상태로 /dashboard 접근 시 /login으로 리다이렉트', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// ---------------------------------------------------------------------------
// 인증 흐름: TEST_USER_EMAIL / TEST_USER_PASSWORD 없으면 beforeEach에서 skip
// ---------------------------------------------------------------------------

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(/\/(dashboard|setup-account)/, { timeout: 10_000 })
}

test.describe('핵심 장부 흐름', () => {
  test.beforeEach(async ({ page }) => {
    // describe 레벨 test.skip()은 Playwright 버전에 따라 condition 무시 이슈가 있어
    // beforeEach에서 처리
    if (!hasCredentials) {
      test.skip()
      return
    }
    await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!)
  })

  // -------------------------------------------------------------------------
  // 지출 입력 → 거래 목록 반영 + 계좌 잔액 감소 확인
  // Phase 2 완료 기준: vertical-slices.md line 73-74
  // -------------------------------------------------------------------------
  test('지출 입력 → 거래 목록 반영 + 계좌 잔액 감소', async ({ page }) => {
    // 1. 계좌 페이지에서 첫 번째 활성 비카드·비투자 계좌 이름/잔액 기록
    await page.goto('/accounts')
    const rows = page.locator('.divide-y.divide-gray-100 > div')
    let targetAccountName: string | null = null
    let initialBalance = 0

    const rowCount = await rows.count()
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i)
      const typeLabel = await row.locator('.text-xs.text-gray-400').first().textContent()
      // 비활성 계좌는 Badge에 정확히 "비활성" 텍스트가 있음. "비활성화" 버튼과 구분하려면 exact 매칭 필요
      const isInactive = (await row.getByText('비활성', { exact: true }).count()) > 0
      // 카드·투자 제외 (카드는 지출 시 잔액 증가 방향이 반대, 투자는 expense 불가)
      if (!isInactive && typeLabel && !typeLabel.includes('카드') && !typeLabel.includes('투자')) {
        targetAccountName = await row.locator('span.font-medium').first().textContent()
        const balanceText = await row.locator('p.font-medium').first().textContent()
        initialBalance = parseKRW(balanceText)
        break
      }
    }

    if (!targetAccountName) {
      test.skip()
      return
    }

    // 2. 해당 계좌로 지출 10,000원 입력
    await page.goto('/transactions/new')
    await page.locator('[name="account_id"]').selectOption({ label: targetAccountName })
    await page.locator('[name="category_id"]').selectOption({ index: 1 })
    await page.locator('#amount-display').fill('10000')
    await page.getByRole('button', { name: '저장' }).click()
    await page.waitForURL(/\/transactions$/, { timeout: 10_000 })

    // 거래 목록에 금액 표시 확인
    await expect(page.getByText('10,000').first()).toBeVisible()

    // 3. 계좌 페이지에서 잔액 10,000원 감소 확인
    await page.goto('/accounts')
    const targetRow = page.locator('.divide-y.divide-gray-100 > div').filter({ hasText: targetAccountName })
    const newBalanceText = await targetRow.locator('p.font-medium').first().textContent()
    const newBalance = parseKRW(newBalanceText)

    expect(newBalance).toBe(initialBalance - 10_000)
  })

  // -------------------------------------------------------------------------
  // 이체 입력 → 두 계좌 잔액 반영 확인
  // Phase 2 완료 기준: vertical-slices.md line 75
  // -------------------------------------------------------------------------
  test('이체 입력 → 출발·도착 두 계좌 잔액 반영됨', async ({ page }) => {
    // 1. 이체 가능한 계좌(비카드) 두 개 찾기
    await page.goto('/accounts')
    const rows = page.locator('.divide-y.divide-gray-100 > div')
    const transferableAccounts: { name: string; balance: number }[] = []

    const rowCount = await rows.count()
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i)
      const typeLabel = await row.locator('.text-xs.text-gray-400').first().textContent()
      const isInactive = (await row.getByText('비활성', { exact: true }).count()) > 0
      if (!isInactive && typeLabel && !typeLabel.includes('카드')) {
        const name = await row.locator('span.font-medium').first().textContent()
        const balanceText = await row.locator('p.font-medium').first().textContent()
        transferableAccounts.push({ name: name!, balance: parseKRW(balanceText) })
      }
    }

    if (transferableAccounts.length < 2) {
      test.skip()
      return
    }

    const [fromAccount, toAccount] = transferableAccounts

    // 2. 이체 5,000원 입력
    await page.goto('/transactions/new')
    await page.getByRole('button', { name: '이체' }).click()
    await page.locator('[name="account_id"]').selectOption({ label: fromAccount.name })
    await page.locator('[name="transfer_to_account_id"]').selectOption({ label: toAccount.name })
    await page.locator('#amount-display').fill('5000')
    await page.getByRole('button', { name: '저장' }).click()
    await page.waitForURL(/\/transactions$/, { timeout: 10_000 })

    // 3. 두 계좌 잔액 변화 확인
    await page.goto('/accounts')

    const fromRow = page.locator('.divide-y.divide-gray-100 > div').filter({ hasText: fromAccount.name })
    const toRow = page.locator('.divide-y.divide-gray-100 > div').filter({ hasText: toAccount.name })

    const fromNewBalance = parseKRW(await fromRow.locator('p.font-medium').first().textContent())
    const toNewBalance = parseKRW(await toRow.locator('p.font-medium').first().textContent())

    // 출발 계좌 -5,000 / 도착 계좌 +5,000
    expect(fromNewBalance).toBe(fromAccount.balance - 5_000)
    expect(toNewBalance).toBe(toAccount.balance + 5_000)
  })
})

// ---------------------------------------------------------------------------
// RLS smoke: 다른 사용자 데이터 접근 불가
//
// 브라우저 E2E로는 두 사용자 세션을 동시에 다루기 어렵기 때문에
// Vitest + Supabase 클라이언트 직접 사용으로 검증한다.
// → src/features/auth/rls-smoke.test.ts
// ---------------------------------------------------------------------------
