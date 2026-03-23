import { createClient } from '@/lib/supabase/server'
import type { Account, TransactionForBalance } from './balance-calculator'

export type { Account, TransactionForBalance }

export async function getAccounts(): Promise<Account[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, account_type, opening_balance, is_active, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Account[]
}

export async function getActiveAccounts(): Promise<Account[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, account_type, opening_balance, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Account[]
}

export async function getAllTransactionsForBalance(): Promise<TransactionForBalance[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, account_id, transfer_to_account_id')

  if (error) throw error
  return (data ?? []) as TransactionForBalance[]
}
