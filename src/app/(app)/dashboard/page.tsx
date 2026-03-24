import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user!.id)
    .single()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold mb-2">
        안녕하세요, {profile?.nickname ?? user?.email}님
      </h1>
      <p className="text-neutral-400 text-sm">Phase 3에서 대시보드 통계/차트가 구현됩니다.</p>
    </main>
  )
}
