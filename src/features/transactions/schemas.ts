import { z } from 'zod'

export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, '계좌를 선택하세요'),
  transfer_to_account_id: z.string().optional().nullable(),
  amount: z.coerce.number().int().positive('금액은 1원 이상이어야 합니다').max(2147483647, '금액은 21억 원을 초과할 수 없습니다'),
  category_id: z.string().optional().nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다'),
  memo: z.string().max(100, '메모는 100자 이내여야 합니다').optional(),
}).superRefine((data, ctx) => {
  // transfer: 도착 계좌 필수
  if (data.type === 'transfer' && !data.transfer_to_account_id) {
    ctx.addIssue({ code: 'custom', message: '도착 계좌를 선택하세요', path: ['transfer_to_account_id'] })
  }
  // transfer: 자기 자신 이체 불가
  if (data.type === 'transfer' && data.transfer_to_account_id === data.account_id) {
    ctx.addIssue({ code: 'custom', message: '출발 계좌와 도착 계좌는 같을 수 없습니다', path: ['transfer_to_account_id'] })
  }
  // transfer: category_id 있으면 오류
  if (data.type === 'transfer' && data.category_id) {
    ctx.addIssue({ code: 'custom', message: '이체에는 카테고리를 선택할 수 없습니다', path: ['category_id'] })
  }
  // income/expense: 카테고리 필수
  if (data.type !== 'transfer' && !data.category_id) {
    ctx.addIssue({ code: 'custom', message: '카테고리를 선택하세요', path: ['category_id'] })
  }
  // income/expense: transfer_to_account_id 있으면 오류
  if (data.type !== 'transfer' && data.transfer_to_account_id) {
    ctx.addIssue({ code: 'custom', message: '수입/지출에는 도착 계좌를 선택할 수 없습니다', path: ['transfer_to_account_id'] })
  }
})

export const updateTransactionSchema = createTransactionSchema.extend({
  id: z.string().min(1),
})
