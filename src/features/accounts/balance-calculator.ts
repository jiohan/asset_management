export type AccountForBalance = {
  id: string
  account_type: 'cash' | 'checking' | 'savings' | 'investment' | 'card'
  opening_balance: number
  is_active: boolean
}

export type Account = AccountForBalance & {
  name: string
  created_at: string
  updated_at: string
}

export type TransactionForBalance = {
  type: 'income' | 'expense' | 'transfer'
  amount: number
  account_id: string
  transfer_to_account_id: string | null
}

export type TradeForBalance = {
  account_id: string
  trade_type: 'buy' | 'sell'
  quantity: number
  unit_price: number
  costs: number
}

export type EventForBalance = {
  account_id: string
  amount: number
}

export function calculateBalance(
  account: AccountForBalance,
  transactions: TransactionForBalance[],
  trades: TradeForBalance[] = [],
  events: EventForBalance[] = []
): number {
  let balance = account.opening_balance

  for (const tx of transactions) {
    if (account.account_type === 'card') {
      // 카드(부채): 지출 시 잔액 증가, 납부(이체 수신) 시 감소
      if (tx.type === 'expense' && tx.account_id === account.id) {
        balance += tx.amount
      } else if (tx.type === 'transfer' && tx.transfer_to_account_id === account.id) {
        balance -= tx.amount
      }
    } else if (account.account_type === 'investment') {
      // 투자 계좌: transfer 수신/송신 (매수/매도/이벤트는 아래 별도 처리)
      if (tx.type === 'transfer' && tx.transfer_to_account_id === account.id) {
        balance += tx.amount
      } else if (tx.type === 'transfer' && tx.account_id === account.id) {
        balance -= tx.amount
      }
    } else {
      // 일반 계좌 (cash / checking / savings)
      if (tx.type === 'income' && tx.account_id === account.id) {
        balance += tx.amount
      } else if (tx.type === 'expense' && tx.account_id === account.id) {
        balance -= tx.amount
      } else if (tx.type === 'transfer' && tx.transfer_to_account_id === account.id) {
        balance += tx.amount
      } else if (tx.type === 'transfer' && tx.account_id === account.id) {
        balance -= tx.amount
      }
    }
  }

  // 투자 계좌 현금: 매수/매도/이벤트 반영
  // 매수: qty×price+costs 차감 / 매도: qty×price-costs 추가 / 이벤트: amount 추가
  if (account.account_type === 'investment') {
    for (const trade of trades) {
      if (trade.account_id !== account.id) continue
      if (trade.trade_type === 'buy') {
        balance -= trade.quantity * trade.unit_price + trade.costs
      } else {
        balance += trade.quantity * trade.unit_price - trade.costs
      }
    }
    for (const event of events) {
      if (event.account_id === account.id) {
        balance += event.amount
      }
    }
  }

  return balance
}

export function calculateAllBalances(
  accounts: AccountForBalance[],
  transactions: TransactionForBalance[],
  trades: TradeForBalance[] = [],
  events: EventForBalance[] = []
): Map<string, number> {
  const map = new Map<string, number>()
  for (const account of accounts) {
    map.set(account.id, calculateBalance(account, transactions, trades, events))
  }
  return map
}

/**
 * 전체 자산 = 사용 가능 자산 + 투자 자산
 *
 * balances는 투자 계좌 현금을 이미 포함한다.
 * trades를 받아 보유 주식 장부가(book value)를 추가한다.
 * 장부가 = Σ(매수 qty×price+costs) - Σ(매도 qty×price-costs)
 *
 * Phase 4 이전(trades = [])에는 기존 동작과 동일하다.
 */
export function calculateTotalAssets(
  accounts: AccountForBalance[],
  balances: Map<string, number>,
  trades: TradeForBalance[] = []
): number {
  let total = 0
  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0
    if (account.account_type === 'card') {
      total -= balance
    } else {
      total += balance
    }
  }
  for (const trade of trades) {
    if (trade.trade_type === 'buy') {
      total += trade.quantity * trade.unit_price + trade.costs
    } else {
      total -= trade.quantity * trade.unit_price - trade.costs
    }
  }
  return total
}

/**
 * 사용 가능 자산 = Σ(cash/checking/savings 잔액) - Σ(card 잔액)
 * investment 계좌는 포함하지 않는다.
 */
export function calculateLiquidAssets(
  accounts: AccountForBalance[],
  balances: Map<string, number>
): number {
  let total = 0
  for (const account of accounts) {
    if (account.account_type === 'investment') continue
    const balance = balances.get(account.id) ?? 0
    if (account.account_type === 'card') {
      total -= balance
    } else {
      total += balance
    }
  }
  return total
}

/**
 * 투자 자산 = 투자 계좌 현금 합계 + 보유 주식 장부가 합계
 * calculateLiquidAssets + calculateInvestmentValue === calculateTotalAssets 항등식이 성립한다.
 */
export function calculateInvestmentValue(
  accounts: AccountForBalance[],
  balances: Map<string, number>,
  trades: TradeForBalance[]
): number {
  let cash = 0
  for (const account of accounts) {
    if (account.account_type !== 'investment') continue
    cash += balances.get(account.id) ?? 0
  }
  let bookValue = 0
  for (const trade of trades) {
    if (trade.trade_type === 'buy') {
      bookValue += trade.quantity * trade.unit_price + trade.costs
    } else {
      bookValue -= trade.quantity * trade.unit_price - trade.costs
    }
  }
  return cash + bookValue
}
