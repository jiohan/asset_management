'use client'

import { LogOut } from 'lucide-react'

export default function UserMenu({
  nickname,
  signOutAction,
}: {
  nickname: string
  signOutAction: () => Promise<void>
}) {
  const initials = nickname.slice(0, 2).toUpperCase()

  return (
    <div className="mt-auto px-4 py-4 border-t border-gray-100">
      <div className="flex items-center gap-3 px-2 mb-2">
        {/* 이니셜 아바타 */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold select-none">
          {initials}
        </div>
        <span className="text-sm font-medium text-gray-700 truncate">{nickname}</span>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </form>
    </div>
  )
}
