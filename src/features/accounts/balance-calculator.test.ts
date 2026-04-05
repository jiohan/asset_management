import { describe, it, expect } from 'vitest'
import {
  calculateBalance,
  calculateAllBalances,
  calculateTotalAssets,
  calculateLiquidAssets,
  calculateInvestmentValue,
  type AccountForBalance,
  type TransactionForBalance,
  type TradeForBalance,
  type EventForBalance,
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

  // 투자 계좌
  it('11. 투자 계좌: transfer 수신 후 현금 증가', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 1000000, account_id: 'acc-1', transfer_to_account_id: 'acc-invest' },
    ]
    expect(calculateBalance(investment, txs)).toBe(1000000)
  })

  it('12. 투자 계좌: 매수 1건 후 현금 감소 (opening_balance - qty×price+costs)', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 1000000, account_id: 'acc-1', transfer_to_account_id: 'acc-invest' },
    ]
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest', trade_type: 'buy', quantity: 10, unit_price: 90000, costs: 1350 },
    ]
    // 1000000 - (10×90000 + 1350) = 1000000 - 901350 = 98650
    expect(calculateBalance(investment, txs, trades)).toBe(98650)
  })

  it('13. 투자 계좌: 매도 1건 후 현금 증가 (qty×price-costs)', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 1000000, account_id: 'acc-1', transfer_to_account_id: 'acc-invest' },
    ]
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest', trade_type: 'buy', quantity: 10, unit_price: 90000, costs: 1350 },
      { account_id: 'acc-invest', trade_type: 'sell', quantity: 5, unit_price: 100000, costs: 750 },
    ]
    // 매수: -901350, 매도: +(5×100000 - 750) = +499250
    // 1000000 - 901350 + 499250 = 597900
    expect(calculateBalance(investment, txs, trades)).toBe(597900)
  })

  it('14. 투자 계좌: costs가 0인 매수도 올바르게 처리', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 500000, account_id: 'acc-1', transfer_to_account_id: 'acc-invest' },
    ]
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest', trade_type: 'buy', quantity: 5, unit_price: 100000, costs: 0 },
    ]
    expect(calculateBalance(investment, txs, trades)).toBe(0)
  })

  it('15. 투자 계좌: 배당 이벤트 후 현금 증가', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 1000000, account_id: 'acc-1', transfer_to_account_id: 'acc-invest' },
    ]
    const events: EventForBalance[] = [
      { account_id: 'acc-invest', amount: 50000 },
    ]
    expect(calculateBalance(investment, txs, [], events)).toBe(1050000)
  })

  it('16. 투자 계좌: transfer + 매수 + 배당 이벤트 복합 케이스', () => {
    const txs: TransactionForBalance[] = [
      { type: 'transfer', amount: 1000000, account_id: 'acc-1', transfer_to_account_id: 'acc-invest' },
    ]
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest', trade_type: 'buy', quantity: 10, unit_price: 90000, costs: 1350 },
    ]
    const events: EventForBalance[] = [
      { account_id: 'acc-invest', amount: 30000 },
    ]
    // 1000000 - 901350 + 30000 = 128650
    expect(calculateBalance(investment, txs, trades, events)).toBe(128650)
  })

  it('17. 다른 계좌의 거래는 투자 계좌 잔액에 영향 없음', () => {
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest-2', trade_type: 'buy', quantity: 10, unit_price: 100000, costs: 0 },
    ]
    // acc-invest-2 거래가 acc-invest 잔액에 영향 없음
    expect(calculateBalance(investment, [], trades)).toBe(0)
  })

  it('18. 일반 계좌에 trades/events 전달해도 잔액에 영향 없음 (regression)', () => {
    const trades: TradeForBalance[] = [
      { account_id: 'acc-1', trade_type: 'buy', quantity: 10, unit_price: 100000, costs: 0 },
    ]
    const txs: TransactionForBalance[] = [
      { type: 'income', amount: 50000, account_id: 'acc-1', transfer_to_account_id: null },
    ]
    expect(calculateBalance(checking, txs, trades)).toBe(150000)
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
  it('8. 총자산: Σ(일반+투자 현금) - Σ카드 (trades 없을 때 기존 동작 유지)', () => {
    const accounts = [checking, investment, card]
    const balances = new Map([
      ['acc-1', 200000],
      ['acc-invest', 500000],
      ['acc-card', 100000],
    ])
    // 200000 + 500000 - 100000 = 600000
    expect(calculateTotalAssets(accounts, balances)).toBe(600000)
  })

  it('19. 총자산: 매수 후 장부가를 포함하여 총자산 불변', () => {
    const accounts = [checking, investment, card]
    // 매수 전: 투자 현금 3000000, 매수 후: 투자 현금 0
    const balancesBeforeBuy = new Map([
      ['acc-1', 7000000],
      ['acc-invest', 3000000],
      ['acc-card', 0],
    ])
    const balancesAfterBuy = new Map([
      ['acc-1', 7000000],
      ['acc-invest', 0],      // 300만 매수 후 현금 0
      ['acc-card', 0],
    ])
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest', trade_type: 'buy', quantity: 30, unit_price: 100000, costs: 0 },
    ]
    const before = calculateTotalAssets(accounts, balancesBeforeBuy)
    const after = calculateTotalAssets(accounts, balancesAfterBuy, trades)
    // 매수 전: 7000000 + 3000000 = 10000000
    // 매수 후: 7000000 + 0 + 장부가(3000000) = 10000000
    expect(before).toBe(10000000)
    expect(after).toBe(10000000)
  })
})

describe('calculateLiquidAssets', () => {
  it('20. 사용 가능 자산: investment 제외, card 차감', () => {
    const accounts = [checking, investment, card]
    const balances = new Map([
      ['acc-1', 700000],
      ['acc-invest', 300000],
      ['acc-card', 50000],
    ])
    // 700000 - 50000 = 650000 (투자 300000 제외)
    expect(calculateLiquidAssets(accounts, balances)).toBe(650000)
  })

  it('21. investment 계좌만 있을 때 0 반환', () => {
    const accounts = [investment]
    const balances = new Map([['acc-invest', 500000]])
    expect(calculateLiquidAssets(accounts, balances)).toBe(0)
  })
})

describe('calculateInvestmentValue', () => {
  it('22. 투자 자산: 투자 계좌 현금 + 보유 주식 장부가', () => {
    const accounts = [checking, investment]
    const balances = new Map([
      ['acc-1', 700000],
      ['acc-invest', 0],   // 매수 후 현금 0
    ])
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest', trade_type: 'buy', quantity: 30, unit_price: 100000, costs: 0 },
    ]
    // 현금 0 + 장부가 3000000 = 3000000
    expect(calculateInvestmentValue(accounts, balances, trades)).toBe(3000000)
  })

  it('23. 투자 계좌 없을 때 0 반환', () => {
    const accounts = [checking, card]
    const balances = new Map([['acc-1', 500000], ['acc-card', 100000]])
    expect(calculateInvestmentValue(accounts, balances, [])).toBe(0)
  })
})

describe('항등식: calculateLiquidAssets + calculateInvestmentValue === calculateTotalAssets', () => {
  it('24. 세 함수의 합이 항상 성립해야 한다', () => {
    const accounts = [checking, investment, card]
    const balances = new Map([
      ['acc-1', 7000000],
      ['acc-invest', 0],
      ['acc-card', 500000],
    ])
    const trades: TradeForBalance[] = [
      { account_id: 'acc-invest', trade_type: 'buy', quantity: 30, unit_price: 100000, costs: 0 },
    ]
    const liquid = calculateLiquidAssets(accounts, balances)
    const investValue = calculateInvestmentValue(accounts, balances, trades)
    const total = calculateTotalAssets(accounts, balances, trades)
    expect(liquid + investValue).toBe(total)
  })
})
