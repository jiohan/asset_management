import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// 서버 전용. 클라이언트 컴포넌트에서 import 금지.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
