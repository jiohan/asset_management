'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createTransactionSchema, updateTransactionSchema } from './schemas'

export async function createTransaction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const raw = Object.fromEntries(formData)
  // 빈 문자열 nullable 처리
  if (!raw.transfer_to_account_id) raw.transfer_to_account_id = null as unknown as string
  if (!raw.category_id) raw.category_id = null as unknown as string
  if (!raw.memo) raw.memo = undefined as unknown as string

  const parsed = createTransactionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // account_id 소유권 + 활성 + 타입 확인
  const { data: account } = await supabase
    .from('accounts')
    .select('id, account_type')
    .eq('id', parsed.data.account_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  if (!account) return { error: '유효하지 않은 계좌입니다' }

  const accountType = (account as { id: string; account_type: string }).account_type
  if (accountType === 'card' && parsed.data.type === 'income') {
    return { error: '카드 계좌에는 수입을 등록할 수 없습니다' }
  }
  if (accountType === 'investment' && parsed.data.type !== 'transfer') {
    return { error: '투자 계좌에는 이체만 등록할 수 있습니다' }
  }

  // transfer_to_account_id 소유권 + 활성 확인
  if (parsed.data.transfer_to_account_id) {
    const { data: toAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', parsed.data.transfer_to_account_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    if (!toAccount) return { error: '유효하지 않은 도착 계좌입니다' }
  }

  // category_id 소유권 + 활성 + 타입 일치 확인
  if (parsed.data.category_id) {
    const { data: category } = await supabase
      .from('categories')
      .select('id, type')
      .eq('id', parsed.data.category_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    if (!category) return { error: '유효하지 않은 카테고리입니다' }
    const catType = (category as { id: string; type: string }).type
    if (catType !== parsed.data.type) {
      return { error: '카테고리 유형이 거래 유형과 일치하지 않습니다' }
    }
  }

  const { error } = await supabase.from('transactions').insert({
    ...parsed.data,
    user_id: user.id,
    transfer_to_account_id: parsed.data.transfer_to_account_id ?? null,
    category_id: parsed.data.category_id ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath('/transactions')
  redirect('/transactions')
}

export async function updateTransaction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const raw = Object.fromEntries(formData)
  if (!raw.transfer_to_account_id) raw.transfer_to_account_id = null as unknown as string
  if (!raw.category_id) raw.category_id = null as unknown as string
  if (!raw.memo) raw.memo = undefined as unknown as string

  const parsed = updateTransactionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // 거래 소유권 확인
  const { data: tx } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .single()
  if (!tx) return { error: '거래를 찾을 수 없습니다' }

  // account_id 소유권 확인 (수정 시 비활성 계좌 허용 — 기존 거래 유지 가능)
  const { data: account } = await supabase
    .from('accounts')
    .select('id, account_type')
    .eq('id', parsed.data.account_id)
    .eq('user_id', user.id)
    .single()
  if (!account) return { error: '유효하지 않은 계좌입니다' }

  const accountType = (account as { id: string; account_type: string }).account_type
  if (accountType === 'card' && parsed.data.type === 'income') {
    return { error: '카드 계좌에는 수입을 등록할 수 없습니다' }
  }
  if (accountType === 'investment' && parsed.data.type !== 'transfer') {
    return { error: '투자 계좌에는 이체만 등록할 수 있습니다' }
  }

  if (parsed.data.transfer_to_account_id) {
    const { data: toAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', parsed.data.transfer_to_account_id)
      .eq('user_id', user.id)
      .single()
    if (!toAccount) return { error: '유효하지 않은 도착 계좌입니다' }
  }

  if (parsed.data.category_id) {
    const { data: category } = await supabase
      .from('categories')
      .select('id, type')
      .eq('id', parsed.data.category_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    if (!category) return { error: '유효하지 않은 카테고리입니다' }
    const catType = (category as { id: string; type: string }).type
    if (catType !== parsed.data.type) {
      return { error: '카테고리 유형이 거래 유형과 일치하지 않습니다' }
    }
  }

  const { id, ...rest } = parsed.data
  const { error } = await supabase.from('transactions').update({
    ...rest,
    transfer_to_account_id: rest.transfer_to_account_id ?? null,
    category_id: rest.category_id ?? null,
  }).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/transactions')
  redirect('/transactions')
}

export async function deleteTransaction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = formData.get('id') as string
  if (!id) return { error: '거래 ID가 필요합니다' }

  const { data: tx } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!tx) return { error: '거래를 찾을 수 없습니다' }

  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/transactions')
}
