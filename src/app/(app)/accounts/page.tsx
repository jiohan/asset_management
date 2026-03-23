import { getAccounts, getAllTransactionsForBalance } from '@/features/accounts/queries'
import { calculateAllBalances } from '@/features/accounts/balance-calculator'
import AccountList from './AccountList'
import CreateAccountForm from './CreateAccountForm'

export default async function AccountsPage() {
  const [accounts, transactions] = await Promise.all([
    getAccounts(),
    getAllTransactionsForBalance(),
  ])

  const balancesMap = calculateAllBalances(accounts, transactions)
  const balances = Object.fromEntries(balancesMap)

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">계좌 관리</h1>
        <CreateAccountForm />
      </div>
      <AccountList accounts={accounts} balances={balances} />
    </div>
  )
}
