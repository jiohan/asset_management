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
import { updateAccount, deactivateAccount } from '@/features/accounts/actions'
import type { Account } from '@/features/accounts/balance-calculator'

export function EditAccountDialog({
  account,
  open,
  onClose,
}: {
  account: Account
  open: boolean
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await updateAccount(formData)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>계좌 수정</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="id" value={account.id} />
          <div className="py-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">계좌명</Label>
              <Input id="edit-name" name="name" defaultValue={account.name} maxLength={30} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-opening-balance">초기 잔액 (원)</Label>
              <Input
                id="edit-opening-balance"
                name="opening_balance"
                type="number"
                min={0}
                step={1}
                defaultValue={account.opening_balance}
                inputMode="numeric"
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit" disabled={loading}>저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeactivateAccountDialog({
  account,
  open,
  onClose,
}: {
  account: Account
  open: boolean
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await deactivateAccount(formData)
    setLoading(false)
    if (result?.error) {
      setError(result.error)
    } else {
      router.refresh()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>계좌 비활성화</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="id" value={account.id} />
          <div className="py-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{account.name}</span> 계좌를 비활성화합니다.
              비활성화된 계좌는 거래 입력에서 선택할 수 없지만 잔액 계산에는 포함됩니다.
            </p>
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="submit" variant="destructive" disabled={loading}>비활성화</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
