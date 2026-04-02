import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/features/auth/actions'
import SidebarNav from './SidebarNav'
import UserMenu from './UserMenu'

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
      {/* 스킵 링크: 키보드/스크린리더 사용자가 사이드바를 건너뛰고 메인 컨텐츠로 바로 이동 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
      >
        메인 컨텐츠로 이동
      </a>
      <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-gray-100 min-h-screen">
        <div className="px-6 py-5">
          <span className="text-base font-semibold text-gray-900">가계부</span>
        </div>
        <SidebarNav />
        <UserMenu nickname={profile?.nickname ?? ''} signOutAction={signOut} />
      </aside>
      <main id="main-content" className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
