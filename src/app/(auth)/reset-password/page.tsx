'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/schemas'
import { updatePassword } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export default function ResetPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', newPasswordConfirm: '' },
  })

  async function onSubmit(values: ResetPasswordValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('newPassword', values.newPassword)
    const result = await updatePassword(formData)
    if (result?.error) setServerError(result.error)
  }

  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">새 비밀번호 설정</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>새 비밀번호 *</FormLabel>
                  <FormControl><Input type="password" placeholder="8자 이상" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPasswordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>새 비밀번호 확인 *</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '처리 중...' : '비밀번호 변경'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
