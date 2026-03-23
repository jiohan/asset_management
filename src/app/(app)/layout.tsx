import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/features/auth/actions'
import SidebarNav from './SidebarNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 닉네임 미설정 시 /nickname으로 강제 이동 (Google 신규 사용자 등)
  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.nickname) redirect('/nickname')

  // 계좌 미등록 시 /setup-account로 강제 이동
  const { data: firstAccount } = await supabase
    .from('accounts')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (!firstAccount) redirect('/setup-account')

  return (
    <div className="flex min-h-screen bg-[#F9F9F8]">
      <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-gray-100 min-h-screen">
        <div className="px-6 py-5">
          <span className="text-base font-semibold text-gray-900">가계부</span>
        </div>
        <SidebarNav />
        <div className="mt-auto px-4 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2 px-2">{profile?.nickname}</p>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left text-sm text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded hover:bg-gray-50"
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
