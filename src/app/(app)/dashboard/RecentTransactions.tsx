import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatKRW } from '@/lib/format'
import type { TransactionWithRelations } from '@/features/transactions/queries'

const TYPE_LABELS: Record<string, string> = {
  income: '수입',
  expense: '지출',
  transfer: '이체',
}

export default function RecentTransactions({
  transactions,
}: {
  transactions: TransactionWithRelations[]
}) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-700">최근 거래</h2>
        <Link
          href="/transactions"
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
        >
          전체 보기 →
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          이번 달 거래 내역이 없습니다
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-50">
                <th className="pb-3 text-xs font-medium text-gray-400">날짜</th>
                <th className="pb-3 text-xs font-medium text-gray-400">타입</th>
                <th className="pb-3 text-xs font-medium text-gray-400">계좌</th>
                <th className="pb-3 text-xs font-medium text-gray-400">카테고리</th>
                <th className="pb-3 text-xs font-medium text-gray-400 max-w-[140px]">메모</th>
                <th className="pb-3 text-xs font-medium text-gray-400 text-right">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 text-xs text-gray-500 whitespace-nowrap">
                    {tx.transaction_date.slice(5)}
                  </td>
                  <td className="py-3">
                    <Badge
                      variant={
                        tx.type === 'income'
                          ? 'default'
                          : tx.type === 'expense'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {TYPE_LABELS[tx.type]}
                    </Badge>
                  </td>
                  <td className="py-3 text-xs text-gray-700 whitespace-nowrap">
                    {tx.type === 'transfer' && tx.transfer_to_account
                      ? `${tx.account.name} → ${tx.transfer_to_account.name}`
                      : tx.account.name}
                  </td>
                  <td className="py-3 text-xs text-gray-400">
                    {tx.category?.name ?? '-'}
                  </td>
                  <td className="py-3 text-xs text-gray-400 max-w-[140px] truncate">
                    {tx.memo ?? ''}
                  </td>
                  <td className="py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                    {tx.type === 'income' ? (
                      <span className="text-emerald-600">+{formatKRW(tx.amount)}</span>
                    ) : tx.type === 'expense' ? (
                      <span className="text-rose-600">-{formatKRW(tx.amount)}</span>
                    ) : (
                      <span className="text-gray-500">{formatKRW(tx.amount)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
