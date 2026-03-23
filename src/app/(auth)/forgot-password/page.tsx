'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas'
import { forgotPassword } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('email', values.email)
    const result = await forgotPassword(formData)
    if (result?.error) setServerError(result.error)
    else setSent(true)
  }

  if (sent) {
    return (
      <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border-0 text-center">
        <CardContent className="pt-6 text-neutral-600">
          <p>비밀번호 재설정 링크를 이메일로 보냈습니다.</p>
          <p className="text-sm text-neutral-400 mt-2">메일이 오지 않으면 스팸 폴더를 확인해 주세요.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">비밀번호 찾기</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>가입한 이메일 *</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '처리 중...' : '재설정 링크 보내기'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
