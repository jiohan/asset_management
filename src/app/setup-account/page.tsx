import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/features/auth/actions'
import SetupAccountForm from './SetupAccountForm'

export default async function SetupAccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 이미 계좌가 있으면 대시보드로
  const { data: firstAccount } = await supabase
    .from('accounts')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (firstAccount) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#F9F9F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">첫 계좌를 등록해주세요</h1>
          <p className="text-sm text-gray-500">
            가계부를 시작하려면 계좌가 1개 이상 필요합니다.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <SetupAccountForm />
        </div>
        <div className="mt-4 text-center">
          <form action={signOut}>
            <button type="submit" className="text-xs text-gray-400 hover:text-gray-600">
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
