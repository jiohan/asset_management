import { Suspense } from 'react'
import { getAccounts, getAllTransactionsForBalance } from '@/features/accounts/queries'
import { calculateAllBalances, calculateTotalAssets } from '@/features/accounts/balance-calculator'
import { getTransactions } from '@/features/transactions/queries'
import {
  getMonthlyStats,
  getCategoryExpenses,
  getMonthlyTrend,
} from '@/features/dashboard/aggregations'
import MonthSelector from './MonthSelector'
import StatsCards from './StatsCards'
import TrendChart from './TrendChart'
import CategoryChart from './CategoryChart'
import AccountSummary from './AccountSummary'
import RecentTransactions from './RecentTransactions'

// 서버가 현재 월 기본값을 결정한다.
// 클라이언트(MonthSelector)는 이 값을 props로 받아 독자적으로 new Date()를 호출하지 않는다.
// (UTC/KST 월말 경계 불일치 방지)
function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// 형식(YYYY-MM) + 월 범위(01-12) 동시 검증
// 기존 transactions 패턴은 정규식만 사용해 2026-13 같은 값이 통과됨.
// 대시보드에서는 Supabase 쿼리 오동작 방지를 위해 월 범위도 확인한다.
function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const month = parseInt(value.split('-')[1], 10)
  return month >= 1 && month <= 12
}

// 기준 월 포함 최근 N개월 목록을 오름차순으로 반환 (YYYY-MM 형식)
function getRecentMonths(baseMonth: string, count: number): string[] {
  const [year, month] = baseMonth.split('-').map(Number)
  const months: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    let m = month - i
    let y = year
    while (m <= 0) {
      m += 12
      y--
    }
    months.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return months
}

// 해당 월의 마지막 날짜를 YYYY-MM-DD 형식으로 반환
// new Date(year, month, 0)은 month(1-indexed) 이전 달의 마지막 날을 반환한다.
// ex) new Date(2026, 4, 0) → 2026-04-30, new Date(2026, 2, 0) → 2026-02-28
function getLastDayOfMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(year, m, 0).getDate()
  return `${month}-${String(lastDay).padStart(2, '0')}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const currentMonth = getCurrentMonth()

  // 잘못된 month 파라미터 → 현재 월 폴백 (오동작 없음)
  const selectedMonth =
    params.month && isValidMonth(params.month) ? params.month : currentMonth

  // 트렌드 차트: 선택 달 기준 최근 6개월
  // selectedMonth 기준으로 계산해야 월 이동 시 트렌드도 재계산된다.
  // currentMonth 기준으로 고정하면 ?month=2026-01 선택 시 트렌드가 갱신되지 않음.
  const trendMonths = getRecentMonths(selectedMonth, 6)
  const trendFrom = trendMonths[0] + '-01'
  // 선택 달의 실제 마지막 날로 계산 (하드코딩 '-31'은 4월/2월에 유효하지 않은 날짜 생성)
  const trendTo = getLastDayOfMonth(selectedMonth)

  // 3개 쿼리 병렬 실행 (+ 트렌드용 1개)
  // - getAccounts: 잔액 계산용 전체 계좌 (비활성 포함)
  // - getAllTransactionsForBalance: 개설 시점부터 전체 거래 (잔액 계산)
  // - getTransactions(month): 선택 달 거래 (통계·차트·최근 거래용, category 관계 포함)
  // - getTransactions(dateRange): 최근 6개월 거래 (트렌드 차트용)
  const [accounts, allTransactions, monthlyTransactions, trendTransactions] = await Promise.all([
    getAccounts(),
    getAllTransactionsForBalance(),
    getTransactions({ month: selectedMonth }),
    getTransactions({ dateFrom: trendFrom, dateTo: trendTo }),
  ])

  // 잔액·총자산 집계
  const balancesMap = calculateAllBalances(accounts, allTransactions)
  const balances = Object.fromEntries(balancesMap)
  const totalAssets = calculateTotalAssets(accounts, balancesMap)

  // 월간 통계
  const stats = getMonthlyStats(monthlyTransactions)
  const categoryExpenses = getCategoryExpenses(monthlyTransactions)
  const recentTransactions = monthlyTransactions.slice(0, 5)

  // 트렌드 데이터: 실제 데이터와 6개월 목록을 병합해 빈 달도 0으로 채운다
  const trendPoints = getMonthlyTrend(trendTransactions)
  const trendMap = new Map(trendPoints.map((p) => [p.month, p]))
  const trendData = trendMonths.map((month) => ({
    month,
    income: trendMap.get(month)?.income ?? 0,
    expense: trendMap.get(month)?.expense ?? 0,
  }))

  return (
    <main className="min-h-screen bg-[#F9F9F8]">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* 헤더: 제목 + 월 선택 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">대시보드</h1>
          {/* useSearchParams 사용으로 Suspense 래핑 필요 */}
          <Suspense
            fallback={
              <div className="h-10 w-48 rounded-lg bg-gray-100 animate-pulse" />
            }
          >
            <MonthSelector currentMonth={currentMonth} />
          </Suspense>
        </div>

        {/* 통계 카드 4개 */}
        <StatsCards totalAssets={totalAssets} stats={stats} />

        {/* 월간 수입/지출 트렌드 바 차트 */}
        <TrendChart data={trendData} />

        {/* 지출 카테고리 도넛 차트 + 계좌별 잔액 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryChart data={categoryExpenses} />
          <AccountSummary accounts={accounts} balances={balances} />
        </div>

        {/* 최근 거래 5건 */}
        <RecentTransactions transactions={recentTransactions} />
      </div>
    </main>
  )
}
