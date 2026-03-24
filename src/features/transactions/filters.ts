import type { TransactionFilters } from './queries'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseTransactionFilters(
  searchParams: Record<string, string | undefined>
): TransactionFilters {
  const filters: TransactionFilters = {}

  if (searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month)) {
    filters.month = searchParams.month
  }

  if (searchParams.account_id && UUID_REGEX.test(searchParams.account_id)) {
    filters.account_id = searchParams.account_id
  }

  if (searchParams.category_id && UUID_REGEX.test(searchParams.category_id)) {
    filters.category_id = searchParams.category_id
  }

  if (
    searchParams.type === 'income' ||
    searchParams.type === 'expense' ||
    searchParams.type === 'transfer'
  ) {
    filters.type = searchParams.type
  }

  return filters
}
