'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Account } from '@/features/accounts/balance-calculator'
import type { Category } from '@/features/categories/queries'

const TYPE_OPTIONS = [
  { value: '', label: '전체 타입' },
  { value: 'income', label: '수입' },
  { value: 'expense', label: '지출' },
  { value: 'transfer', label: '이체' },
]

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    options.push({ value, label })
  }
  return options
}

export default function TransactionFilters({
  accounts,
  categories,
}: {
  accounts: Account[]
  categories: Category[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else if (key === 'month') {
      // month는 빈 문자열로 명시해야 "전체 기간" 의도가 서버에 전달됨
      params.set(key, '')
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const monthOptions = getMonthOptions()
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">기간</label>
        <select
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          value={searchParams.get('month') ?? currentMonth}
          onChange={(e) => update('month', e.target.value)}
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          <option value="">전체 기간</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">계좌</label>
        <select
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          value={searchParams.get('account_id') ?? ''}
          onChange={(e) => update('account_id', e.target.value)}
        >
          <option value="">전체 계좌</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">카테고리</label>
        <select
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          value={searchParams.get('category_id') ?? ''}
          onChange={(e) => update('category_id', e.target.value)}
        >
          <option value="">전체 카테고리</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">타입</label>
        <select
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          value={searchParams.get('type') ?? ''}
          onChange={(e) => update('type', e.target.value)}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
