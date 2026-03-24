import { z } from 'zod'

export const createAccountSchema = z.object({
  name: z.string().min(1, '계좌명을 입력하세요').max(30),
  account_type: z.enum(['cash', 'checking', 'savings', 'investment', 'card']),
  opening_balance: z.coerce.number().int().min(0, '초기 잔액은 0 이상이어야 합니다'),
})

export const updateAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, '계좌명을 입력하세요').max(30),
  // opening_balance는 생성 시 1회만 입력, 이후 변경 불가
})
