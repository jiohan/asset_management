'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function formatMonthDisplay(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return `${year}년 ${m}월`
}

function addMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const month = parseInt(value.split('-')[1], 10)
  return month >= 1 && month <= 12
}

export default function MonthSelector({ currentMonth }: { currentMonth: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selected = (() => {
    const param = searchParams.get('month')
    if (param && isValidMonth(param)) return param
    return currentMonth
  })()

  const prevMonth = addMonth(selected, -1)
  const nextMonth = addMonth(selected, 1)
  const isNextDisabled = nextMonth > currentMonth

  function navigate(month: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', month)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => navigate(prevMonth)}
        className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-400 hover:text-gray-700"
        aria-label="이전 달"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-base font-semibold text-gray-900 min-w-[120px] text-center">
        {formatMonthDisplay(selected)}
      </span>
      <button
        onClick={() => navigate(nextMonth)}
        disabled={isNextDisabled}
        className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:shadow-none"
        aria-label="다음 달"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
