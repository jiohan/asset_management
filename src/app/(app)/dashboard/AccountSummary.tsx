import { formatKRW } from '@/lib/format'
import type { Account } from '@/features/accounts/balance-calculator'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: '현금',
  checking: '입출금',
  savings: '저축',
  investment: '투자',
  card: '카드',
}

export default function AccountSummary({
  accounts,
  balances,
}: {
  accounts: Account[]
  balances: Record<string, number>
}) {
  const activeAccounts = accounts.filter((a) => a.is_active)

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">계좌별 잔액</h2>
      {activeAccounts.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
          등록된 계좌가 없습니다
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {activeAccounts.map((account) => {
            const balance = balances[account.id] ?? 0
            const isCard = account.account_type === 'card'
            return (
              <li key={account.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{account.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                  </p>
                </div>
                <div className="text-right">
                  {isCard ? (
                    <>
                      <p className="text-xs text-gray-400">결제 예정</p>
                      <p className="text-sm font-semibold text-rose-600 tabular-nums">
                        {formatKRW(balance)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">
                      {formatKRW(balance)}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
