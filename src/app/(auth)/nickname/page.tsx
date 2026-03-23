'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { nicknameSchema, type NicknameValues } from '@/features/auth/schemas'
import { setNickname } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export default function NicknamePage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<NicknameValues>({
    resolver: zodResolver(nicknameSchema),
    defaultValues: { nickname: '' },
  })

  async function onSubmit(values: NicknameValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('nickname', values.nickname)
    const result = await setNickname(formData)
    if (result?.error) setServerError(result.error)
  }

  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">닉네임을 입력해 주세요</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>닉네임 *</FormLabel>
                  <FormControl><Input placeholder="2~20자" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '처리 중...' : '시작하기'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
