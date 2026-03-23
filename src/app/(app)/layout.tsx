import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

  return <div className="min-h-screen bg-[#F9F9F8]">{children}</div>
}
