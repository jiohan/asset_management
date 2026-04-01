import { getAccounts, getAllTransactionsForBalance } from '@/features/accounts/queries'
import { calculateAllBalances, calculateTotalAssets } from '@/features/accounts/balance-calculator'
import { formatKRW } from '@/lib/format'
import AccountList from './AccountList'
import CreateAccountForm from './CreateAccountForm'

export default async function AccountsPage() {
  const [accounts, transactions] = await Promise.all([
    getAccounts(),
    getAllTransactionsForBalance(),
  ])

  const balancesMap = calculateAllBalances(accounts, transactions)
  const balances = Object.fromEntries(balancesMap)
  const totalAssets = calculateTotalAssets(accounts, balancesMap)
  const cardBalance = accounts
    .filter((a) => a.account_type === 'card')
    .reduce((sum, a) => sum + (balancesMap.get(a.id) ?? 0), 0)
  const usableBalance = totalAssets + cardBalance

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">총 자산</span>
          <span className={`text-2xl font-semibold tabular-nums ${totalAssets < 0 ? 'text-rose-600' : 'text-gray-900'}`}>{formatKRW(totalAssets)}</span>
        </div>
        <div className="flex justify-between items-center mt-3">
          <span className="text-sm text-gray-500">사용 가능</span>
          <span className="text-sm tabular-nums text-gray-700">{formatKRW(usableBalance)}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm text-gray-500">카드 미결제</span>
          <span className="text-sm tabular-nums text-rose-600">{formatKRW(cardBalance)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">계좌 관리</h1>
        <CreateAccountForm />
      </div>
      <AccountList accounts={accounts} balances={balances} />
    </div>
  )
}
