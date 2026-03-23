'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createTransactionSchema, updateTransactionSchema } from './schemas'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// 거래 생성 공통 검증 + DB insert 헬퍼
// createTransaction(리다이렉트)과 addTransaction(드로어) 양쪽에서 사용
async function insertTransactionRecord(
  supabase: SupabaseServerClient,
  userId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const raw = Object.fromEntries(formData)
  if (!raw.transfer_to_account_id) raw.transfer_to_account_id = null as unknown as string
  if (!raw.category_id) raw.category_id = null as unknown as string
  if (!raw.memo) raw.memo = undefined as unknown as string

  const parsed = createTransactionSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, account_type')
    .eq('id', parsed.data.account_id)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()
  if (!account) return { error: '유효하지 않은 계좌입니다' }

  if (account.account_type === 'card' && parsed.data.type === 'income') {
    return { error: '카드 계좌에는 수입을 등록할 수 없습니다' }
  }
  if (account.account_type === 'investment' && parsed.data.type !== 'transfer') {
    return { error: '투자 계좌에는 이체만 등록할 수 있습니다' }
  }

  if (parsed.data.transfer_to_account_id) {
    const { data: toAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', parsed.data.transfer_to_account_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()
    if (!toAccount) return { error: '유효하지 않은 도착 계좌입니다' }
  }

  if (parsed.data.category_id) {
    const { data: category } = await supabase
      .from('categories')
      .select('id, type')
      .eq('id', parsed.data.category_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()
    if (!category) return { error: '유효하지 않은 카테고리입니다' }
    if (category.type !== parsed.data.type) {
      return { error: '카테고리 유형이 거래 유형과 일치하지 않습니다' }
    }
  }

  const { error } = await supabase.from('transactions').insert({
    ...parsed.data,
    user_id: userId,
    transfer_to_account_id: parsed.data.transfer_to_account_id ?? null,
    category_id: parsed.data.category_id ?? null,
  })

  if (error) return { error: error.message }
  return {}
}

// 페이지 방식: 저장 후 /transactions로 리다이렉트
export async function createTransaction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await insertTransactionRecord(supabase, user.id, formData)
  if (result.error) return result

  revalidatePath('/transactions')
  redirect('/transactions')
}

// 드로어 방식: 리다이렉트 없이 결과 반환 (드로어가 직접 상태 관리)
export async function addTransaction(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다' }

  const result = await insertTransactionRecord(supabase, user.id, formData)
  if (result.error) return result

  revalidatePath('/transactions')
  return {}
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

  const { data: tx } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .single()
  if (!tx) return { error: '거래를 찾을 수 없습니다' }

  // 수정 시 출발 계좌는 비활성 허용 — 기존 거래 보존 가능
  const { data: account } = await supabase
    .from('accounts')
    .select('id, account_type')
    .eq('id', parsed.data.account_id)
    .eq('user_id', user.id)
    .single()
  if (!account) return { error: '유효하지 않은 계좌입니다' }

  if (account.account_type === 'card' && parsed.data.type === 'income') {
    return { error: '카드 계좌에는 수입을 등록할 수 없습니다' }
  }
  if (account.account_type === 'investment' && parsed.data.type !== 'transfer') {
    return { error: '투자 계좌에는 이체만 등록할 수 있습니다' }
  }

  if (parsed.data.transfer_to_account_id) {
    // 수정 시 도착 계좌도 비활성 허용 — 기존 거래 보존 가능 (출발 계좌와 동일 기준)
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
    if (category.type !== parsed.data.type) {
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
