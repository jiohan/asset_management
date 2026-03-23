'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAccountSchema, updateAccountSchema } from './schemas'

export async function createAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const raw = Object.fromEntries(formData)
  const parsed = createAccountSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('accounts')
    .insert({ ...parsed.data, user_id: user.id })

  if (error) return { error: error.message }

  revalidatePath('/accounts')
}

export async function updateAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const raw = Object.fromEntries(formData)
  const parsed = updateAccountSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .single()

  if (!account) return { error: '계좌를 찾을 수 없습니다' }

  const { error } = await supabase
    .from('accounts')
    .update({ name: parsed.data.name, opening_balance: parsed.data.opening_balance })
    .eq('id', parsed.data.id)

  if (error) return { error: error.message }

  revalidatePath('/accounts')
}

export async function deactivateAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string
  if (!id) return { error: '계좌 ID가 필요합니다' }

  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!account) return { error: '계좌를 찾을 수 없습니다' }

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/accounts')
}
