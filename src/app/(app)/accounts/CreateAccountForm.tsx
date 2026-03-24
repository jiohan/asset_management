'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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

export default function CreateAccountForm() {
  const [open, setOpen] = useState(false)
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
      router.refresh()
      setOpen(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ 계좌 추가</Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>계좌 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="py-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">계좌명</Label>
                <Input id="name" name="name" placeholder="계좌명을 입력하세요" maxLength={30} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account_type">계좌 유형</Label>
                <select
                  id="account_type"
                  name="account_type"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  defaultValue="checking"
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
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" disabled={loading}>추가</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
