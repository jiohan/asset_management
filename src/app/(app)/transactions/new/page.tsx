import Link from 'next/link'
import { getActiveAccounts } from '@/features/accounts/queries'
import { getActiveCategories } from '@/features/categories/queries'
import { createTransaction } from '@/features/transactions/actions'
import TransactionForm from '../TransactionForm'

export default async function NewTransactionPage() {
  const [accounts, categories] = await Promise.all([
    getActiveAccounts(),
    getActiveCategories(),
  ])

  return (
    <div className="p-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/transactions" className="text-sm text-gray-500 hover:text-gray-900">
          ← 거래 내역
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">거래 추가</h1>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          action={createTransaction}
        />
      </div>
    </div>
  )
}
