import { createClient } from '@/lib/supabase/server'

export type TransactionFilters = {
  month?: string
  account_id?: string
  category_id?: string
  type?: 'income' | 'expense' | 'transfer'
}

export type TransactionWithRelations = {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  transaction_date: string
  memo: string | null
  account: { id: string; name: string }
  transfer_to_account: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

export async function getTransactions(
  filters?: TransactionFilters
): Promise<TransactionWithRelations[]> {
  const supabase = await createClient()
  let query = supabase
    .from('transactions')
    .select(
      '*, account:accounts!account_id(id,name), transfer_to_account:accounts!transfer_to_account_id(id,name), category:categories(id,name)'
    )
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.month) {
    const [year, month] = filters.month.split('-').map(Number)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    query = query.gte('transaction_date', from).lt('transaction_date', nextMonth)
  }

  if (filters?.account_id) {
    query = query.or(`account_id.eq.${filters.account_id},transfer_to_account_id.eq.${filters.account_id}`)
  }

  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id)
  }

  if (filters?.type) {
    query = query.eq('type', filters.type)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as TransactionWithRelations[]
}

export async function getTransactionById(id: string): Promise<TransactionWithRelations | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select(
      '*, account:accounts!account_id(id,name), transfer_to_account:accounts!transfer_to_account_id(id,name), category:categories(id,name)'
    )
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as TransactionWithRelations
}
