import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'

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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">
          안녕하세요, {profile?.nickname ?? user?.email}님
        </h1>
        <form action={signOut}>
          <Button variant="outline" type="submit">로그아웃</Button>
        </form>
      </div>
      <p className="text-neutral-400 text-sm">Phase 2에서 실제 대시보드가 구현됩니다.</p>
    </main>
  )
}
