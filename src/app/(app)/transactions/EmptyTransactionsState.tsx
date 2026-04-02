'use client'

import { ReceiptText } from 'lucide-react'
import TransactionDrawer from './TransactionDrawer'
import type { Account } from '@/features/accounts/balance-calculator'
import type { Category } from '@/features/categories/queries'

export default function EmptyTransactionsState({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  return (
    <div className="py-14 text-center space-y-3">
      <div className="flex justify-center">
        <ReceiptText size={36} className="text-gray-200" />
      </div>
      <p className="text-sm text-gray-400">조건에 맞는 거래가 없습니다.</p>
      <TransactionDrawer accounts={accounts} categories={categories} />
    </div>
  )
}
