import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_USER_EMAIL
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD
const hasCredentials = Boolean(TEST_EMAIL && TEST_PASSWORD)

// ──────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(/\/(dashboard|setup-account)/, { timeout: 10_000 })
}

// ──────────────────────────────────────────────────────────────────────────────
// Smoke: 인증 없이 항상 실행
// ──────────────────────────────────────────────────────────────────────────────

test('미인증 /dashboard → /login 리다이렉트 (dashboard.spec)', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

test('잘못된 month 파라미터 → 로그인 후 대시보드 오류 없이 렌더링', async ({ page }) => {
  // 인증 없이 접근하면 로그인으로 리다이렉트되므로 smoke 수준만 검증
  await page.goto('/dashboard?month=2026-13')
  await expect(page).toHaveURL(/\/login/)
})

// ──────────────────────────────────────────────────────────────────────────────
// 인증 필요 테스트
// ──────────────────────────────────────────────────────────────────────────────

test.describe('대시보드 Phase 3', () => {
  test.beforeEach(async ({ page }) => {
    if (!hasCredentials) {
      test.skip()
      return
    }
    await loginAs(page, TEST_EMAIL!, TEST_PASSWORD!)
    // setup-account로 리다이렉트되면 /dashboard로 명시 이동
    if (page.url().includes('setup-account')) {
      test.skip()
      return
    }
  })

  // --------------------------------------------------------------------------
  // 기본 구조 렌더링 (완료 기준 1~6)
  // --------------------------------------------------------------------------
  test('대시보드 4개 통계 카드 + 주요 섹션 렌더링', async ({ page }) => {
    await page.goto('/dashboard')

    // 통계 카드 레이블
    await expect(page.getByText('총자산')).toBeVisible()
    await expect(page.getByText('이번 달 수입')).toBeVisible()
    await expect(page.getByText('이번 달 지출')).toBeVisible()
    await expect(page.getByText('순수입')).toBeVisible()

    // 섹션 헤더
    await expect(page.getByText('월간 수입 / 지출 트렌드')).toBeVisible()
    await expect(page.getByText('지출 카테고리')).toBeVisible()
    await expect(page.getByText('계좌별 잔액')).toBeVisible()
    await expect(page.getByText('최근 거래')).toBeVisible()

    // 전체 보기 링크
    await expect(page.getByText('전체 보기 →')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // 이체 총액 항상 표시 (완료 기준 1, 9)
  // 이체가 없는 달에도 "이체 ₩0" 보조 텍스트가 렌더링되어야 한다.
  // --------------------------------------------------------------------------
  test('이체 총액 보조 텍스트 항상 표시 (₩0 포함)', async ({ page }) => {
    await page.goto('/dashboard')
    // "이체 ₩" 패턴이 항상 존재해야 함
    await expect(page.getByText(/이체 ₩/)).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // 월 선택 UI (완료 기준 7)
  // --------------------------------------------------------------------------
  test('현재 달 표시 + 다음 달 버튼 비활성', async ({ page }) => {
    await page.goto('/dashboard')

    // 현재 달이 표시되어야 함 (YYYY년 M월 형식)
    const now = new Date()
    const yearStr = String(now.getFullYear())
    const monthStr = String(now.getMonth() + 1)
    await expect(page.getByText(new RegExp(`${yearStr}년 ${monthStr}월`))).toBeVisible()

    // 현재 달에서 다음 달 버튼은 비활성
    await expect(page.getByRole('button', { name: '다음 달' })).toBeDisabled()
  })

  test('이전 달 버튼 클릭 → URL ?month 파라미터 변경 + 대시보드 재렌더', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '이전 달' }).click()

    // URL에 ?month=YYYY-MM 형식이 추가되어야 함
    await expect(page).toHaveURL(/[?&]month=\d{4}-\d{2}/)

    // 이동 후에도 기본 구조 유지
    await expect(page.getByText('총자산')).toBeVisible()
    await expect(page.getByText('이체 ₩')).toBeVisible()
  })

  test('이전 달 이동 후 다음 달 버튼 활성화', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.waitForURL(/month=/)

    // 이전 달로 간 상태에서는 다음 달(= 현재 달)이 존재하므로 버튼 활성
    await expect(page.getByRole('button', { name: '다음 달' })).toBeEnabled()
  })

  // --------------------------------------------------------------------------
  // 잘못된 month 파라미터 → 현재 달 폴백 (완료 기준 10)
  // --------------------------------------------------------------------------
  test('?month=2026-13 → 현재 달로 폴백, 오류 없이 렌더링', async ({ page }) => {
    await page.goto('/dashboard?month=2026-13')

    // 오류 페이지가 아니라 정상 대시보드
    await expect(page.getByText('총자산')).toBeVisible()

    // 현재 달이 표시되어야 함
    const now = new Date()
    await expect(
      page.getByText(new RegExp(`${now.getFullYear()}년 ${now.getMonth() + 1}월`))
    ).toBeVisible()
  })

  test('?month=invalid → 현재 달로 폴백, 오류 없이 렌더링', async ({ page }) => {
    await page.goto('/dashboard?month=invalid')
    await expect(page.getByText('총자산')).toBeVisible()
  })

  test('?month=2026-00 → 현재 달로 폴백 (월 범위 0은 무효)', async ({ page }) => {
    await page.goto('/dashboard?month=2026-00')
    await expect(page.getByText('총자산')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // 거래 없는 달 → 모든 수치 ₩0 (완료 기준 9)
  // 데이터가 없을 가능성이 높은 과거 달로 이동해 검증한다.
  // --------------------------------------------------------------------------
  test('거래 없는 달 → ₩0 표시 + 카테고리 빈 상태 메시지', async ({ page }) => {
    // 1900-01은 거래가 없을 것이 확실한 달
    await page.goto('/dashboard?month=1900-01')

    // 통계 수치가 ₩0으로 표시되어야 함
    // (+₩0은 수입, -₩0은 지출 없으므로 ₩0, 이체도 ₩0)
    const zeroPattern = /₩0/
    const zeroElements = await page.getByText(zeroPattern).all()
    expect(zeroElements.length).toBeGreaterThanOrEqual(3) // 수입·지출·이체 최소 3개

    // 카테고리 차트 빈 상태 메시지 (완료 기준 8)
    await expect(page.getByText('이번 달 지출 내역이 없습니다')).toBeVisible()

    // 최근 거래 빈 상태
    await expect(page.getByText('이번 달 거래 내역이 없습니다')).toBeVisible()
  })

  // --------------------------------------------------------------------------
  // 전체 보기 링크 → /transactions (완료 기준 연관)
  // --------------------------------------------------------------------------
  test('최근 거래 전체 보기 → /transactions 이동', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByText('전체 보기 →').click()
    await expect(page).toHaveURL(/\/transactions/)
  })

  // --------------------------------------------------------------------------
  // 월 이동 후 트렌드 차트 섹션 유지 (완료 기준 7 연관)
  // --------------------------------------------------------------------------
  test('월 이동 후 트렌드 차트 섹션 유지', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.waitForURL(/month=/)

    // 트렌드 차트 섹션이 여전히 표시되어야 함
    await expect(page.getByText('월간 수입 / 지출 트렌드')).toBeVisible()
    // 계좌별 잔액 섹션도 유지
    await expect(page.getByText('계좌별 잔액')).toBeVisible()
  })
})
