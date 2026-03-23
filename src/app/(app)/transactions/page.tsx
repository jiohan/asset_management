import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { getTransactions } from '@/features/transactions/queries'
import { parseTransactionFilters } from '@/features/transactions/filters'
import { getAccounts } from '@/features/accounts/queries'
import { getActiveCategories } from '@/features/categories/queries'
import { formatKRW } from '@/lib/format'
import TransactionFilters from './TransactionFilters'
import DeleteTransactionButton from './DeleteTransactionButton'

const TYPE_LABELS: Record<string, string> = {
  income: '수입',
  expense: '지출',
  transfer: '이체',
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const currentMonth = getCurrentMonth()

  // 기본값: 이번 달. 잘못된 month 파라미터는 기본월로 폴백 (전체 기간은 month='' 로 명시)
  const monthParam = params.month
  const month =
    monthParam === ''
      ? undefined // 전체 기간 명시
      : monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : currentMonth // 미입력 또는 잘못된 값 → 이번 달

  const filters = parseTransactionFilters({ ...params, month })

  const [transactions, accounts, categories] = await Promise.all([
    getTransactions(filters),
    getAccounts(),
    getActiveCategories(),
  ])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">거래 내역</h1>
        <Link
          href="/transactions/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground transition-all"
        >
          + 거래 추가
        </Link>
      </div>

      <div className="mb-4">
        <Suspense fallback={<div className="h-9" />}>
          <TransactionFilters accounts={accounts} categories={categories} />
        </Suspense>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {transactions.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            조건에 맞는 거래가 없습니다.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">타입</th>
                <th className="px-4 py-3 font-medium">계좌</th>
                <th className="px-4 py-3 font-medium">카테고리</th>
                <th className="px-4 py-3 font-medium">메모</th>
                <th className="px-4 py-3 font-medium text-right">금액</th>
                <th className="px-4 py-3 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {tx.transaction_date.slice(5)}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3 text-gray-700">
                    {tx.type === 'transfer' && tx.transfer_to_account
                      ? `${tx.account.name} → ${tx.transfer_to_account.name}`
                      : tx.account.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {tx.category?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">
                    {tx.memo ?? ''}
                  </td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                    {tx.type === 'income' ? (
                      <span className="text-emerald-600">+{formatKRW(tx.amount)}</span>
                    ) : tx.type === 'expense' ? (
                      <span className="text-rose-600">-{formatKRW(tx.amount)}</span>
                    ) : (
                      <span className="text-gray-500">{formatKRW(tx.amount)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/transactions/${tx.id}/edit`}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition-colors"
                        title="수정"
                      >
                        <Pencil size={15} />
                      </Link>
                      <DeleteTransactionButton id={tx.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
