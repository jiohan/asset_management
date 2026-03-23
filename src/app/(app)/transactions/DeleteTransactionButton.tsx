'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { deleteTransaction } from '@/features/transactions/actions'

export default function DeleteTransactionButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.set('id', id)
    const result = await deleteTransaction(formData)
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
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 text-gray-400 hover:text-rose-600 rounded transition-colors"
        title="삭제"
      >
        <Trash2 size={15} />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>거래 삭제</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-sm text-gray-600">이 거래를 삭제하면 되돌릴 수 없습니다. 삭제하시겠습니까?</p>
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>삭제</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
