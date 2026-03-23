import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAccounts } from '@/features/accounts/queries'
import { getActiveCategories } from '@/features/categories/queries'
import { getTransactionById } from '@/features/transactions/queries'
import { updateTransaction } from '@/features/transactions/actions'
import TransactionForm from '../../TransactionForm'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [transaction, accounts, categories] = await Promise.all([
    getTransactionById(id),
    getAccounts(),
    getActiveCategories(),
  ])

  if (!transaction) notFound()

  // 소유권 체크 — getTransactionById는 RLS로 필터되므로 없으면 notFound
  // 추가로 user 확인은 RLS에 위임

  return (
    <div className="p-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/transactions" className="text-sm text-gray-500 hover:text-gray-900">
          ← 거래 내역
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">거래 수정</h1>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          action={updateTransaction}
          defaultValues={{ ...transaction, id }}
        />
      </div>
    </div>
  )
}
