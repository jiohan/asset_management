import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function VerifyEmailPage() {
  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border-0 text-center">
      <CardHeader>
        <CardTitle className="text-2xl">이메일을 확인해 주세요</CardTitle>
      </CardHeader>
      <CardContent className="text-neutral-600 space-y-2">
        <p>가입하신 이메일 주소로 인증 링크를 보냈습니다.</p>
        <p className="text-sm text-neutral-400">메일이 오지 않으면 스팸 폴더를 확인해 주세요.</p>
      </CardContent>
    </Card>
  )
}
