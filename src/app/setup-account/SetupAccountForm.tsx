'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAccount } from '@/features/accounts/actions'

const ACCOUNT_TYPES = [
  { value: 'cash', label: '현금' },
  { value: 'checking', label: '입출금' },
  { value: 'savings', label: '저축' },
  { value: 'investment', label: '투자' },
  { value: 'card', label: '카드' },
]

export default function SetupAccountForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await createAccount(formData)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">계좌명</Label>
        <Input
          id="name"
          name="name"
          placeholder="예: 국민은행 입출금, 현금 지갑"
          maxLength={30}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="account_type">계좌 유형</Label>
        <select
          id="account_type"
          name="account_type"
          defaultValue="checking"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="opening_balance">초기 잔액 (원)</Label>
        <Input
          id="opening_balance"
          name="opening_balance"
          type="number"
          min={0}
          step={1}
          defaultValue={0}
          inputMode="numeric"
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        계좌 등록하고 시작하기
      </Button>
    </form>
  )
}
