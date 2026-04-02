'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addTransaction } from '@/features/transactions/actions'
import type { Account } from '@/features/accounts/balance-calculator'
import type { Category } from '@/features/categories/queries'
import TransactionForm from './TransactionForm'

type TransactionType = 'income' | 'expense' | 'transfer'

interface PersistedDefaults {
  type: TransactionType
  accountId: string
}

export default function TransactionDrawer({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [persisted, setPersisted] = useState<PersistedDefaults>({
    type: 'expense',
    accountId: '',
  })

  function openDrawer() {
    setOpen(true)
  }

  function closeDrawer() {
    setOpen(false)
  }

  function handleSaved() {
    router.refresh()
    closeDrawer()
  }

  function handleSavedContinue({ type, accountId }: { type: TransactionType; accountId: string }) {
    router.refresh()
    setPersisted({ type, accountId })
    setFormKey((k) => k + 1)
  }

  // 퍼시스트된 defaultValues — account.name은 select 렌더링에 사용 안 되므로 빈 문자열
  const defaultValues = persisted.accountId
    ? {
        type: persisted.type,
        account: { id: persisted.accountId, name: '' },
      }
    : { type: persisted.type }

  return (
    <>
      <Button
        onClick={openDrawer}
        className="h-8 px-2.5 text-sm"
      >
        + 거래 추가
      </Button>

      {/* 백드롭 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={closeDrawer}
        />
      )}

      {/* 드로어 패널 */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[480px] bg-white shadow-xl transition-transform duration-300 ease-in-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">거래 추가</h2>
          <button
            onClick={closeDrawer}
            className="rounded-md p-1 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 폼 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {open && (
            <TransactionForm
              key={formKey}
              accounts={accounts}
              categories={categories}
              action={addTransaction}
              defaultValues={defaultValues}
              showContinueButton
              onSaved={handleSaved}
              onSavedContinue={handleSavedContinue}
            />
          )}
        </div>
      </div>
    </>
  )
}
