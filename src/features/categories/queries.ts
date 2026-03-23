import { createClient } from '@/lib/supabase/server'

export type Category = {
  id: string
  type: 'income' | 'expense'
  name: string
  is_default: boolean
  is_active: boolean
}

export async function getActiveCategories(type?: 'income' | 'expense'): Promise<Category[]> {
  const supabase = await createClient()
  let query = supabase
    .from('categories')
    .select('id, type, name, is_default, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Category[]
}
