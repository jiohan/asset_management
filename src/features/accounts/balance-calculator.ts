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

export function calculateBalance(
  account: AccountForBalance,
  transactions: TransactionForBalance[]
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
      // 투자 계좌: transfer만 계산 (Phase 4에서 매수/매도 추가)
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

  return balance
}

export function calculateAllBalances(
  accounts: AccountForBalance[],
  transactions: TransactionForBalance[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const account of accounts) {
    map.set(account.id, calculateBalance(account, transactions))
  }
  return map
}

export function calculateTotalAssets(
  accounts: AccountForBalance[],
  balances: Map<string, number>
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
  return total
}
