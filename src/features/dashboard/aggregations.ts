import type { TransactionWithRelations } from '@/features/transactions/queries'

export type MonthlyStats = {
  totalIncome: number
  totalExpense: number
  netIncome: number
  totalTransfer: number
}

export type CategoryExpense = {
  categoryId: string
  categoryName: string
  amount: number
  percentage: number
}

export type MonthlyTrendPoint = {
  month: string // YYYY-MM
  income: number
  expense: number
}

/**
 * 선택 월의 거래를 집계해 수입/지출/순수입/이체 합계를 반환한다.
 * transfer 거래는 1건당 1회만 집계한다 (이체는 두 계좌에 영향을 미치지만 금액은 한 번만).
 */
export function getMonthlyStats(transactions: TransactionWithRelations[]): MonthlyStats {
  let totalIncome = 0
  let totalExpense = 0
  let totalTransfer = 0

  for (const tx of transactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount
    } else if (tx.type === 'expense') {
      totalExpense += tx.amount
    } else if (tx.type === 'transfer') {
      totalTransfer += tx.amount
    }
  }

  return {
    totalIncome,
    totalExpense,
    netIncome: totalIncome - totalExpense,
    totalTransfer,
  }
}

/**
 * expense 거래를 카테고리별로 그룹화해 합산한다.
 * category가 null인 거래(이체 등)는 건너뛴다.
 * 지출이 없으면 빈 배열을 반환한다.
 */
export function getCategoryExpenses(transactions: TransactionWithRelations[]): CategoryExpense[] {
  const grouped = new Map<string, { name: string; amount: number }>()

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.category) continue
    const existing = grouped.get(tx.category.id)
    if (existing) {
      existing.amount += tx.amount
    } else {
      grouped.set(tx.category.id, { name: tx.category.name, amount: tx.amount })
    }
  }

  const total = Array.from(grouped.values()).reduce((sum, { amount }) => sum + amount, 0)
  if (total === 0) return []

  return Array.from(grouped.entries())
    .map(([id, { name, amount }]) => ({
      categoryId: id,
      categoryName: name,
      amount,
      percentage: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * 여러 달 거래를 월별로 그룹화해 수입/지출 합계를 반환한다.
 * 트렌드 차트(최근 6개월)용 순수 함수.
 * 빈 달은 포함하지 않는다 — 호출 측에서 표시할 달 목록과 병합한다.
 */
export function getMonthlyTrend(transactions: TransactionWithRelations[]): MonthlyTrendPoint[] {
  const grouped = new Map<string, { income: number; expense: number }>()

  for (const tx of transactions) {
    if (tx.type === 'transfer') continue
    const month = tx.transaction_date.slice(0, 7) // YYYY-MM
    const entry = grouped.get(month) ?? { income: 0, expense: 0 }
    if (tx.type === 'income') entry.income += tx.amount
    else if (tx.type === 'expense') entry.expense += tx.amount
    grouped.set(month, entry)
  }

  return Array.from(grouped.entries())
    .map(([month, { income, expense }]) => ({ month, income, expense }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
