import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/database.types'

export type TransactionFilters = {
  month?: string
  // month 대신 직접 날짜 범위를 지정할 때 사용 (YYYY-MM-DD 형식)
  // month와 동시에 사용하지 않는다 — 호출 측에서 둘 중 하나만 사용한다.
  dateFrom?: string
  dateTo?: string
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

// Supabase join 쿼리 결과 형태. type 컬럼은 DB에서 string으로 저장되므로
// TransactionWithRelations로 매핑할 때 union 타입으로 좁혀준다.
type SupabaseTransactionRow = Tables<'transactions'> & {
  account: { id: string; name: string }
  transfer_to_account: { id: string; name: string } | null
  category: { id: string; name: string } | null
}

const VALID_TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const

function mapRow(row: SupabaseTransactionRow): TransactionWithRelations {
  if (!VALID_TRANSACTION_TYPES.includes(row.type as TransactionWithRelations['type'])) {
    throw new Error(`알 수 없는 거래 타입: ${row.type}`)
  }
  return {
    id: row.id,
    type: row.type as TransactionWithRelations['type'],
    amount: row.amount,
    transaction_date: row.transaction_date,
    memo: row.memo,
    account: row.account,
    transfer_to_account: row.transfer_to_account,
    category: row.category,
  }
}

const TRANSACTION_SELECT =
  '*, account:accounts!account_id(id,name), transfer_to_account:accounts!transfer_to_account_id(id,name), category:categories(id,name)'

export async function getTransactions(
  filters?: TransactionFilters
): Promise<TransactionWithRelations[]> {
  const supabase = await createClient()
  let query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters?.month) {
    const [year, month] = filters.month.split('-').map(Number)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    query = query.gte('transaction_date', from).lt('transaction_date', nextMonth)
  } else if (filters?.dateFrom || filters?.dateTo) {
    if (filters.dateFrom) query = query.gte('transaction_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('transaction_date', filters.dateTo)
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
  return (data as unknown as SupabaseTransactionRow[]).map(mapRow)
}

export async function getTransactionById(id: string): Promise<TransactionWithRelations | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .eq('id', id)
    .single()

  if (error) return null
  return mapRow(data as unknown as SupabaseTransactionRow)
}
