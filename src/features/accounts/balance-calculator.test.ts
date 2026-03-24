import { describe, it, expect } from 'vitest'
import {
  calculateBalance,
  calculateAllBalances,
  calculateTotalAssets,
  type AccountForBalance,
  type TransactionForBalance,
} from './balance-calculator'

const checking: AccountForBalance = {
  id: 'acc-1',
  account_type: 'checking',
  opening_balance: 100000,
  is_active: true,
}

const card: AccountForBalance = {
  id: 'acc-card',
  account_type: 'card',
  opening_balance: 0,
  is_active: true,
}

const investment: AccountForBalance = {
  id: 'acc-invest',
  account_type: 'investment',
  opening_balance: 0,
  is_active: true,
}

describe('calculateBalance', () => {
  it('1. 거래 없을 때 = opening_balance', () => {
    expect(calculateBalance(checking, [])).toBe(100000)
  })

  it('2. 일반 계좌: 수입 후 잔액 증가', () => {
    const txs: TransactionForBalance[] = [
      { type: 'income', amount: 50000, account_id: 'acc-1', transfer_to_account_id: null },
    ]
    expect(calculateBalance(checking, txs)).toBe(150000)
  })

  it('3. 일반 계좌: 지출 후 잔액 감소', () => {
    const txs: TransactionForBalance[] = [
      { type: 'expense', amount: 30000, account_id: 'acc-1', transfer_to_account_id: null },
    ]
    expect(calculateBalance(checking, txs)).toBe(70000)
  })

  it('4. 일반 계좌: 이체 수신 시 잔액 증가', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 20000, account_id: 'acc-2', transfer_to_account_id: 'acc-1' },
    ]
    expect(calculateBalance(checking, txs)).toBe(120000)
  })

  it('5. 일반 계좌: 이체 송신 시 잔액 감소', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 20000, account_id: 'acc-1', transfer_to_account_id: 'acc-2' },
    ]
    expect(calculateBalance(checking, txs)).toBe(80000)
  })

  it('6. 카드 계좌: 지출 시 잔액 증가 (부채 누적)', () => {
    const txs: TransactionForBalance[] = [
      { type: 'expense', amount: 50000, account_id: 'acc-card', transfer_to_account_id: null },
    ]
    expect(calculateBalance(card, txs)).toBe(50000)
  })

  it('7. 카드 계좌: 이체 수신(납부) 시 잔액 감소', () => {
    const txs: TransactionForBalance[] = [
      { type: 'expense', amount: 50000, account_id: 'acc-card', transfer_to_account_id: null },
      { type: 'transfer', amount: 50000, account_id: 'acc-1', transfer_to_account_id: 'acc-card' },
    ]
    expect(calculateBalance(card, txs)).toBe(0)
  })

  it('9. 비활성 계좌도 잔액 계산에 포함', () => {
    const inactiveAccount: AccountForBalance = { ...checking, is_active: false }
    const txs: TransactionForBalance[] = [
      { type: 'income', amount: 10000, account_id: 'acc-1', transfer_to_account_id: null },
    ]
    expect(calculateBalance(inactiveAccount, txs)).toBe(110000)
  })

  it('10. 미래 날짜 거래도 잔액 계산에 포함 (필터 없음)', () => {
    // calculateBalance는 날짜 필터가 없으므로 미래 거래도 포함됨
    const txs: TransactionForBalance[] = [
      { type: 'income', amount: 999999, account_id: 'acc-1', transfer_to_account_id: null },
    ]
    expect(calculateBalance(checking, txs)).toBe(1099999)
  })
})

describe('calculateAllBalances', () => {
  it('여러 계좌 잔액을 Map으로 반환', () => {
    const accounts = [checking, card]
    const txs: TransactionForBalance[] = [
      { type: 'income', amount: 50000, account_id: 'acc-1', transfer_to_account_id: null },
      { type: 'expense', amount: 30000, account_id: 'acc-card', transfer_to_account_id: null },
    ]
    const balances = calculateAllBalances(accounts, txs)
    expect(balances.get('acc-1')).toBe(150000)
    expect(balances.get('acc-card')).toBe(30000)
  })
})

describe('calculateTotalAssets', () => {
  it('8. 총자산: Σ(일반+투자) - Σ카드', () => {
    const accounts = [checking, investment, card]
    const balances = new Map([
      ['acc-1', 200000],
      ['acc-invest', 500000],
      ['acc-card', 100000],
    ])
    // 200000 + 500000 - 100000 = 600000
    expect(calculateTotalAssets(accounts, balances)).toBe(600000)
  })
})
