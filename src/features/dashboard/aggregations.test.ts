import { describe, it, expect } from 'vitest'
import {
  getMonthlyStats,
  getCategoryExpenses,
  getMonthlyTrend,
} from './aggregations'
import type { TransactionWithRelations } from '@/features/transactions/queries'

// ──────────────────────────────────────────────────────────────
// 헬퍼 팩토리
// ──────────────────────────────────────────────────────────────

function makeTx(
  overrides: Partial<TransactionWithRelations> & Pick<TransactionWithRelations, 'type' | 'amount'>
): TransactionWithRelations {
  return {
    id: 'tx-' + Math.random(),
    transaction_date: '2026-03-15',
    memo: null,
    account: { id: 'acc-1', name: '입출금' },
    transfer_to_account: null,
    category: null,
    ...overrides,
  }
}

const FOOD_CAT = { id: 'cat-food', name: '식비' }
const TRANS_CAT = { id: 'cat-trans', name: '교통' }

// ──────────────────────────────────────────────────────────────
// getMonthlyStats
// ──────────────────────────────────────────────────────────────

describe('getMonthlyStats', () => {
  it('빈 배열 → 모든 값 0', () => {
    const result = getMonthlyStats([])
    expect(result).toEqual({
      totalIncome: 0,
      totalExpense: 0,
      netIncome: 0,
      totalTransfer: 0,
    })
  })

  it('income/expense/transfer 혼합 → 각 합계 정확', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'income', amount: 200000 }),
      makeTx({ type: 'income', amount: 100000 }),
      makeTx({ type: 'expense', amount: 50000, category: FOOD_CAT }),
      makeTx({ type: 'expense', amount: 30000, category: TRANS_CAT }),
      makeTx({
        type: 'transfer',
        amount: 70000,
        transfer_to_account: { id: 'acc-2', name: '저축' },
      }),
    ]
    const result = getMonthlyStats(txs)
    expect(result.totalIncome).toBe(300000)
    expect(result.totalExpense).toBe(80000)
    expect(result.netIncome).toBe(220000) // 300000 - 80000
    expect(result.totalTransfer).toBe(70000)
  })

  it('transfer 거래 1건 = 1회만 집계 (중복 없음)', () => {
    // transfer는 두 계좌에 영향을 미치지만 totalTransfer는 1건당 1회
    const txs: TransactionWithRelations[] = [
      makeTx({
        type: 'transfer',
        amount: 100000,
        transfer_to_account: { id: 'acc-2', name: '저축' },
      }),
    ]
    const result = getMonthlyStats(txs)
    expect(result.totalTransfer).toBe(100000)
    expect(result.totalIncome).toBe(0)
    expect(result.totalExpense).toBe(0)
  })

  it('수입만 있는 경우 순수입 = 수입', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'income', amount: 500000 }),
    ]
    const result = getMonthlyStats(txs)
    expect(result.netIncome).toBe(500000)
  })

  it('지출 > 수입인 경우 순수입 음수', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'income', amount: 100000 }),
      makeTx({ type: 'expense', amount: 200000, category: FOOD_CAT }),
    ]
    const result = getMonthlyStats(txs)
    expect(result.netIncome).toBe(-100000)
  })
})

// ──────────────────────────────────────────────────────────────
// getCategoryExpenses
// ──────────────────────────────────────────────────────────────

describe('getCategoryExpenses', () => {
  it('지출 없음 → 빈 배열', () => {
    expect(getCategoryExpenses([])).toEqual([])
  })

  it('income/transfer만 있으면 빈 배열', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'income', amount: 100000 }),
      makeTx({ type: 'transfer', amount: 50000, transfer_to_account: { id: 'acc-2', name: '저축' } }),
    ]
    expect(getCategoryExpenses(txs)).toEqual([])
  })

  it('category가 null인 expense 건너뜀', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'expense', amount: 10000, category: null }),
    ]
    expect(getCategoryExpenses(txs)).toEqual([])
  })

  it('카테고리별 그룹핑 및 합산 정확', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'expense', amount: 30000, category: FOOD_CAT }),
      makeTx({ type: 'expense', amount: 20000, category: FOOD_CAT }),
      makeTx({ type: 'expense', amount: 10000, category: TRANS_CAT }),
    ]
    const result = getCategoryExpenses(txs)
    expect(result).toHaveLength(2)

    const food = result.find((r) => r.categoryId === FOOD_CAT.id)
    const trans = result.find((r) => r.categoryId === TRANS_CAT.id)

    expect(food?.amount).toBe(50000)
    expect(trans?.amount).toBe(10000)
  })

  it('퍼센티지 합계 ≈ 100%', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'expense', amount: 75000, category: FOOD_CAT }),
      makeTx({ type: 'expense', amount: 25000, category: TRANS_CAT }),
    ]
    const result = getCategoryExpenses(txs)
    const total = result.reduce((sum, r) => sum + r.percentage, 0)
    // Math.round로 인해 99~101 범위. 정확히 나눠지는 케이스이므로 100
    expect(total).toBe(100)
  })

  it('금액 내림차순 정렬', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'expense', amount: 10000, category: TRANS_CAT }),
      makeTx({ type: 'expense', amount: 50000, category: FOOD_CAT }),
    ]
    const result = getCategoryExpenses(txs)
    expect(result[0].categoryId).toBe(FOOD_CAT.id) // 더 큰 금액이 먼저
  })
})

// ──────────────────────────────────────────────────────────────
// getMonthlyTrend
// ──────────────────────────────────────────────────────────────

describe('getMonthlyTrend', () => {
  it('빈 배열 → 빈 배열', () => {
    expect(getMonthlyTrend([])).toEqual([])
  })

  it('월별 수입/지출 집계 정확', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'income', amount: 200000, transaction_date: '2026-02-10' }),
      makeTx({ type: 'expense', amount: 50000, transaction_date: '2026-02-20', category: FOOD_CAT }),
      makeTx({ type: 'income', amount: 300000, transaction_date: '2026-03-05' }),
      makeTx({ type: 'expense', amount: 100000, transaction_date: '2026-03-15', category: TRANS_CAT }),
    ]
    const result = getMonthlyTrend(txs)
    expect(result).toHaveLength(2)

    const feb = result.find((r) => r.month === '2026-02')
    const mar = result.find((r) => r.month === '2026-03')

    expect(feb?.income).toBe(200000)
    expect(feb?.expense).toBe(50000)
    expect(mar?.income).toBe(300000)
    expect(mar?.expense).toBe(100000)
  })

  it('transfer 거래는 트렌드에서 제외', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({
        type: 'transfer',
        amount: 100000,
        transaction_date: '2026-03-10',
        transfer_to_account: { id: 'acc-2', name: '저축' },
      }),
    ]
    expect(getMonthlyTrend(txs)).toEqual([])
  })

  it('월 오름차순 정렬', () => {
    const txs: TransactionWithRelations[] = [
      makeTx({ type: 'income', amount: 100000, transaction_date: '2026-03-01' }),
      makeTx({ type: 'income', amount: 100000, transaction_date: '2026-01-01' }),
      makeTx({ type: 'income', amount: 100000, transaction_date: '2026-02-01' }),
    ]
    const result = getMonthlyTrend(txs)
    expect(result.map((r) => r.month)).toEqual(['2026-01', '2026-02', '2026-03'])
  })
})
