'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Account } from '@/features/accounts/balance-calculator'
import type { Category } from '@/features/categories/queries'
import type { TransactionWithRelations } from '@/features/transactions/queries'

type TransactionType = 'income' | 'expense' | 'transfer'

const TYPE_BUTTONS: { value: TransactionType; label: string }[] = [
  { value: 'income', label: '수입' },
  { value: 'expense', label: '지출' },
  { value: 'transfer', label: '이체' },
]

function toDateInput(dateStr: string) {
  return dateStr.slice(0, 10)
}

function todayStr() {
  // 로컬 날짜 기준 (toISOString은 UTC라 KST 새벽에 전날이 됨)
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 계좌 타입별 출발 계좌 허용 여부
// 카드: expense만 허용(카드 지출), income/transfer 불가
// 투자: transfer만 허용, income/expense 불가 — transfer 출발은 허용 (balance-calculator 지원)
function isAccountAllowedAsSource(accountType: string, type: TransactionType): boolean {
  if (type === 'income') return accountType !== 'card' && accountType !== 'investment'
  if (type === 'expense') return accountType !== 'investment'
  // transfer: 카드는 출발 불가, 투자는 출발 허용 (잔액 계산 모델이 투자의 transfer 송신을 처리함)
  return accountType !== 'card'
}

export default function TransactionForm({
  accounts,
  categories,
  action,
  defaultValues,
  showContinueButton,
  onSaved,
  onSavedContinue,
}: {
  accounts: Account[]
  categories: Category[]
  action: (formData: FormData) => Promise<{ error?: string } | undefined | void>
  defaultValues?: Partial<TransactionWithRelations> & { id?: string }
  showContinueButton?: boolean
  onSaved?: () => void
  onSavedContinue?: (meta: { type: TransactionType; accountId: string }) => void
}) {
  const initialType: TransactionType =
    (defaultValues?.type as TransactionType) ?? 'expense'

  const [type, setType] = useState<TransactionType>(initialType)
  const [accountId, setAccountId] = useState(defaultValues?.account?.id ?? '')
  const [memo, setMemo] = useState(defaultValues?.memo ?? '')
  const [amountDisplay, setAmountDisplay] = useState(() => {
    if (defaultValues?.amount) return defaultValues.amount.toLocaleString('ko-KR')
    return ''
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const continueRef = useRef(false)

  const filteredCategories = categories.filter((c) => c.type === type)

  // 출발 계좌: 활성 + 타입에 맞는 계좌. 수정 시 기존 거래의 계좌는 비활성이어도 포함.
  const sourceAccounts = accounts.filter(
    (a) =>
      (isAccountAllowedAsSource(a.account_type, type) && a.is_active) ||
      a.id === defaultValues?.account?.id
  )

  // 도착 계좌: 출발 계좌 제외. 수정 시 기존 거래의 도착 계좌는 비활성이어도 포함.
  const destinationAccounts = accounts.filter(
    (a) => a.id !== accountId &&
      (a.is_active || a.id === defaultValues?.transfer_to_account?.id)
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await action(formData)
    setLoading(false)

    if (result?.error) {
      setServerError(result.error)
      continueRef.current = false
      return
    }

    // result가 defined = 리다이렉트 없는 드로어 액션 (addTransaction)
    if (result !== undefined) {
      if (continueRef.current) {
        onSavedContinue?.({ type, accountId })
      } else {
        onSaved?.()
      }
      continueRef.current = false
    }
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setAmountDisplay(raw ? Number(raw).toLocaleString('ko-KR') : '')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {defaultValues?.id && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}

      {/* 거래 타입 */}
      <div className="space-y-1.5">
        <Label>거래 타입</Label>
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {TYPE_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => setType(btn.value)}
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors',
                type === btn.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      {/* 출발 계좌 */}
      <div className="space-y-1.5">
        <Label htmlFor="account_id">
          {type === 'transfer' ? '출발 계좌' : '계좌'}
        </Label>
        <select
          id="account_id"
          name="account_id"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          required
        >
          <option value="">계좌를 선택하세요</option>
          {sourceAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}{!a.is_active ? ' (비활성)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 도착 계좌 (이체만) */}
      {type === 'transfer' && (
        <div className="space-y-1.5">
          <Label htmlFor="transfer_to_account_id">도착 계좌</Label>
          <select
            id="transfer_to_account_id"
            name="transfer_to_account_id"
            defaultValue={defaultValues?.transfer_to_account?.id ?? ''}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">도착 계좌를 선택하세요</option>
            {destinationAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 카테고리 (수입/지출만) */}
      {type !== 'transfer' && (
        <div className="space-y-1.5">
          <Label htmlFor="category_id">카테고리</Label>
          <select
            key={type}
            id="category_id"
            name="category_id"
            defaultValue={defaultValues?.category?.id ?? ''}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">카테고리를 선택하세요</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 금액 */}
      <div className="space-y-1.5">
        <Label htmlFor="amount-display">금액 (원)</Label>
        {/* 실제 제출값은 hidden input */}
        <input
          type="hidden"
          name="amount"
          value={amountDisplay.replace(/,/g, '')}
        />
        <Input
          id="amount-display"
          type="text"
          inputMode="numeric"
          value={amountDisplay}
          onChange={handleAmountChange}
          placeholder="금액을 입력하세요"
          required
        />
      </div>

      {/* 날짜 */}
      <div className="space-y-1.5">
        <Label htmlFor="transaction_date">날짜</Label>
        <Input
          id="transaction_date"
          name="transaction_date"
          type="date"
          defaultValue={
            defaultValues?.transaction_date
              ? toDateInput(defaultValues.transaction_date)
              : todayStr()
          }
          required
        />
      </div>

      {/* 메모 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="memo">메모 (선택)</Label>
          <span className="text-xs text-gray-400">{100 - (memo?.length ?? 0)}자 남음</span>
        </div>
        <textarea
          id="memo"
          name="memo"
          maxLength={100}
          rows={2}
          value={memo ?? ''}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모를 입력하세요"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {serverError && (
        <p className="text-sm text-rose-600">{serverError}</p>
      )}

      <div className="flex gap-3 pt-2">
        {showContinueButton && (
          <Button
            type="submit"
            variant="outline"
            className="flex-1"
            disabled={loading}
            onClick={() => { continueRef.current = true }}
          >
            저장 후 계속
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1"
          disabled={loading}
          onClick={() => { continueRef.current = false }}
        >
          {defaultValues?.id ? '수정' : '저장'}
        </Button>
      </div>
    </form>
  )
}
