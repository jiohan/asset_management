'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_CATEGORIES = [
  // 지출 9개
  { type: 'expense', name: '주거/통신' },
  { type: 'expense', name: '보험' },
  { type: 'expense', name: '구독료' },
  { type: 'expense', name: '식비' },
  { type: 'expense', name: '교통' },
  { type: 'expense', name: '쇼핑' },
  { type: 'expense', name: '의료/건강' },
  { type: 'expense', name: '카페/간식' },
  { type: 'expense', name: '기타지출' },
  // 수입 5개
  { type: 'income', name: '급여' },
  { type: 'income', name: '용돈' },
  { type: 'income', name: '부수입' },
  { type: 'income', name: '환불/취소' },
  { type: 'income', name: '기타수입' },
] as const

export async function seedUserData(userId: string, email: string, nickname: string) {
  const supabase = createAdminClient()

  // profiles upsert
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, email, nickname }, { onConflict: 'id' })

  if (profileError) throw profileError

  // 기본 카테고리 insert (이미 있으면 skip)
  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (!existingCategories || existingCategories.length === 0) {
    const { error: categoryError } = await supabase.from('categories').insert(
      DEFAULT_CATEGORIES.map((cat) => ({
        user_id: userId,
        type: cat.type,
        name: cat.name,
        is_default: true,
        is_active: true,
      }))
    )
    if (categoryError) throw categoryError
  }
}
