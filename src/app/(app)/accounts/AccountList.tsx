'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatKRW } from '@/lib/format'
import { EditAccountDialog, DeactivateAccountDialog } from './AccountActions'
import type { Account } from '@/features/accounts/balance-calculator'
import { Banknote, CreditCard, PiggyBank, TrendingUp, Wallet } from 'lucide-react'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: '현금',
  checking: '입출금',
  savings: '저축',
  investment: '투자',
  card: '카드',
}

const ACCOUNT_TYPE_ICONS = {
  cash: Banknote,
  checking: Wallet,
  savings: PiggyBank,
  investment: TrendingUp,
  card: CreditCard,
}

export default function AccountList({
  accounts,
  balances,
}: {
  accounts: Account[]
  balances: Record<string, number>
}) {
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Account | null>(null)

  return (
    <>
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {accounts.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-gray-400">
            등록된 계좌가 없습니다.
          </p>
        )}
        {accounts.map((account) => {
          const balance = balances[account.id] ?? 0
          const isCard = account.account_type === 'card'
          const TypeIcon = ACCOUNT_TYPE_ICONS[account.account_type as keyof typeof ACCOUNT_TYPE_ICONS] ?? Wallet

          return (
            <div
              key={account.id}
              className="flex items-center justify-between px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${account.is_active ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-300'}`}>
                  <TypeIcon size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={account.is_active ? 'text-sm font-medium text-gray-900' : 'text-sm font-medium text-gray-400'}>
                      {account.name}
                    </span>
                    {!account.is_active && (
                      <Badge variant="secondary" className="text-xs">비활성</Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {ACCOUNT_TYPE_LABELS[account.account_type] ?? account.account_type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  {isCard ? (
                    <div>
                      <p className="text-xs text-gray-400">결제 예정</p>
                      <p className={account.is_active ? 'text-sm font-medium text-rose-600' : 'text-sm font-medium text-gray-400'}>
                        {formatKRW(balance)}
                      </p>
                    </div>
                  ) : (
                    <p className={account.is_active ? 'text-sm font-medium text-gray-900' : 'text-sm font-medium text-gray-400'}>
                      {formatKRW(balance)}
                    </p>
                  )}
                </div>
                {account.is_active && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditTarget(account)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => setDeactivateTarget(account)}
                    >
                      비활성화
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editTarget && (
        <EditAccountDialog
          account={editTarget}
          open={true}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deactivateTarget && (
        <DeactivateAccountDialog
          account={deactivateTarget}
          open={true}
          onClose={() => setDeactivateTarget(null)}
        />
      )}
    </>
  )
}
