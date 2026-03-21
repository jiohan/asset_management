# Phase 1: 환경 구성 + 인증 — 상세 구현 계획

## 개요

**목표**: 사용자가 가입하고 로그인한 뒤 앱에 진입하는 전체 흐름을 완성한다.

**전제 조건**:
- Supabase 프로젝트 생성 완료
- `.env.local`에 실제 키 입력 완료
- Next.js 프로젝트 미스캐폴딩 상태 (package.json 없음)
- `supabase/` 디렉터리 없음 (Supabase CLI 미초기화)

**완료 후 상태**: 이메일 회원가입 / Google 로그인 / 비밀번호 재설정이 실제 브라우저에서 동작하고, 로그인한 사용자의 `/dashboard` 접근이 가능한 상태.

---

## 개발자 수동 설정 (코드 작업 전 필수)

아래 항목은 자동화할 수 없으므로 개발자가 직접 처리해야 한다.

| # | 항목 | 위치 |
|---|------|------|
| 1 | Supabase CLI 설치 | 터미널: `npm install -g supabase` 또는 Homebrew |
| 2 | Supabase CLI 로그인 | 터미널: `supabase login` |
| 3 | Google OAuth 앱 등록 | Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 생성 |
| 4 | Google OAuth 리다이렉트 URI 등록 | Google Cloud Console → 승인된 리디렉션 URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback` |
| 5 | Supabase Google Provider 활성화 | Supabase 대시보드 → Authentication → Providers → Google → Client ID / Secret 입력 |
| 6 | Supabase Redirect URL 등록 | Supabase 대시보드 → Authentication → URL Configuration → Redirect URLs: `http://localhost:3000/auth/callback` |
| 7 | Supabase Site URL 설정 | Supabase 대시보드 → Authentication → URL Configuration → Site URL: `http://localhost:3000` |
| 8 | 이메일 Confirm 설정 확인 | Supabase 대시보드 → Authentication → Email → "Confirm email" 활성화 상태 확인 |

---

## Step 1: Next.js 스캐폴딩

프로젝트 루트(`/home/jioha/projects/asset_management`)에서 실행:

```bash
npx create-next-app@16 . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git
```

옵션 선택 안내:
- Would you like to use ESLint? → **Yes**
- Would you like to use Turbopack? → **Yes** (개발 서버 속도 향상)

이후 shadcn/ui 초기화:

```bash
npx shadcn@latest init
```

shadcn init 옵션:
- Style → **Default**
- Base color → **Neutral**
- CSS variables → **Yes**

설치 후 확인:
```bash
npm run dev   # http://localhost:3000 정상 접근 확인
```

---

## Step 2: 핵심 의존성 설치

```bash
npm install @supabase/ssr @supabase/supabase-js
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install react-hook-form @hookform/resolvers zod
```

shadcn/ui 컴포넌트 (Phase 1에서 사용할 것들만):
```bash
npx shadcn@latest add button card form input label
```

---

## Step 3: Supabase CLI 초기화 및 연결

```bash
supabase init
supabase link --project-ref <프로젝트-ref>
```

`<프로젝트-ref>`는 Supabase 대시보드 URL 또는 Project Settings → General에서 확인.

완료 후 생성되는 파일:
- `supabase/config.toml`
- `supabase/.gitignore`

`.gitignore`에 추가 확인 (create-next-app이 이미 포함했을 수 있음):
```
.env.local
supabase/.branches
supabase/.temp
```

---

## Step 4: DB 마이그레이션 작성 및 적용

### 4-1. 마이그레이션 파일 생성

```bash
supabase migration new phase1_init
```

`supabase/migrations/YYYYMMDDHHMMSS_phase1_init.sql` 파일이 생성된다.

### 4-2. SQL 작성

생성된 파일에 아래 SQL을 작성한다.

```sql
-- ============================================================
-- 공통 updated_at 자동 갱신 함수
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  nickname    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profiles" ON profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- accounts
-- ============================================================
CREATE TABLE accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  account_type     TEXT NOT NULL CHECK (account_type IN ('cash', 'checking', 'savings', 'investment', 'card')),
  opening_balance  INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_accounts" ON accounts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  name        TEXT NOT NULL,
  color       TEXT,
  icon        TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_categories" ON categories
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- transactions
-- ============================================================
CREATE TABLE transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                     TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  account_id               UUID NOT NULL REFERENCES accounts(id),
  transfer_to_account_id   UUID REFERENCES accounts(id),
  amount                   INTEGER NOT NULL CHECK (amount > 0),
  category_id              UUID REFERENCES categories(id),
  transaction_date         DATE NOT NULL,
  memo                     TEXT CHECK (char_length(memo) <= 100),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_transactions" ON transactions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 4-3. 마이그레이션 적용

```bash
supabase db push
```

Supabase 대시보드 → Table Editor에서 4개 테이블 생성 확인.

---

## Step 5: Supabase 클라이언트 설정

3종의 클라이언트를 각각 분리해서 작성한다.

### 5-1. 브라우저 클라이언트

`src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 5-2. 서버 클라이언트

`src/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 호출 시 무시 (미들웨어가 처리)
          }
        },
      },
    }
  )
}
```

### 5-3. 서비스 롤 클라이언트 (Seed 전용)

`src/lib/supabase/admin.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// 서버 전용. 클라이언트 컴포넌트에서 import 금지.
export function createAdminClient() {
  return createClient(
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
```

### 5-4. 미들웨어용 클라이언트

`src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신 (토큰 만료 처리)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
```

---

## Step 6: 미들웨어 (라우트 보호)

`src/middleware.ts`

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const AUTH_ROUTES = ['/signup', '/login', '/forgot-password', '/verify-email']
const PROTECTED_PREFIX = '/dashboard'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // 미로그인 상태로 보호된 경로 접근
  if (!user && pathname.startsWith(PROTECTED_PREFIX)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인 상태로 인증 페이지 접근
  if (user && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|reset-password|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## Step 7: /auth/callback Route Handler

`src/app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    // 비밀번호 재설정 링크
    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    // Google 신규 사용자: nickname이 없으면 /nickname으로
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()

      if (!profile?.nickname) {
        return NextResponse.redirect(`${origin}/nickname`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

---

## Step 8: Server Actions — 인증 + Seed

### 8-1. Seed 로직

`src/features/auth/seed.ts`

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_CATEGORIES = [
  // 지출 9개
  { type: 'expense', name: '주거/통신' },
  { type: 'expense', name: '보험' },
  { type: 'expense', name: '구독료' },
  { type: 'expense', name: '식비' },
  { type: 'expense', name: '교통' },
  { type: 'expense', name: '쇼핑' },
  { type: 'expense', name: '의료/건강' },
  { type: 'expense', name: '카페/간식' },
  { type: 'expense', name: '기타지출' },
  // 수입 5개
  { type: 'income', name: '급여' },
  { type: 'income', name: '용돈' },
  { type: 'income', name: '부수입' },
  { type: 'income', name: '환불/취소' },
  { type: 'income', name: '기타수입' },
] as const

export async function seedUserData(userId: string, email: string, nickname: string) {
  const supabase = createAdminClient()

  // profiles upsert
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, email, nickname }, { onConflict: 'id' })

  if (profileError) throw profileError

  // 기본 계좌 insert (이미 있으면 skip)
  const { data: existingAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (!existingAccounts || existingAccounts.length === 0) {
    const { error: accountError } = await supabase.from('accounts').insert({
      user_id: userId,
      name: '기본 계좌',
      account_type: 'checking',
      opening_balance: 0,
    })
    if (accountError) throw accountError
  }

  // 기본 카테고리 insert (이미 있으면 skip)
  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (!existingCategories || existingCategories.length === 0) {
    const { error: categoryError } = await supabase.from('categories').insert(
      DEFAULT_CATEGORIES.map((cat) => ({
        user_id: userId,
        type: cat.type,
        name: cat.name,
        is_default: true,
        is_active: true,
      }))
    )
    if (categoryError) throw categoryError
  }
}
```

### 8-2. 인증 Server Actions

`src/features/auth/actions.ts`

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { seedUserData } from './seed'

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nickname = formData.get('nickname') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  if (data.user) {
    try {
      await seedUserData(data.user.id, email, nickname)
    } catch {
      return { error: '계정 초기화 중 오류가 발생했습니다.' }
    }
  }

  redirect('/verify-email')
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      return { error: '이메일 인증이 필요합니다. 받은 편지함을 확인해 주세요.' }
    }
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signInWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }
  if (data.url) redirect(data.url)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`,
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const newPassword = formData.get('newPassword') as string

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) return { error: error.message }

  redirect('/login')
}

export async function setNickname(formData: FormData) {
  const supabase = await createClient()
  const nickname = formData.get('nickname') as string

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  try {
    await seedUserData(user.id, user.email!, nickname)
  } catch {
    return { error: '닉네임 설정 중 오류가 발생했습니다.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
```

---

## Step 9: 인증 페이지 UI

라우트 그룹 `src/app/(auth)/`를 생성하고, 공통 레이아웃을 만든다.

### 9-1. (auth) 레이아웃

`src/app/(auth)/layout.tsx`

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9F9F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

### 9-2. Zod 스키마

`src/features/auth/schemas.ts`

```typescript
import { z } from 'zod'

export const signUpSchema = z
  .object({
    email: z.string().email('올바른 이메일 형식을 입력해 주세요.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    passwordConfirm: z.string(),
    nickname: z.string().min(2, '닉네임은 2자 이상이어야 합니다.').max(20, '닉네임은 20자 이하여야 합니다.'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  })

export const signInSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('올바른 이메일 형식을 입력해 주세요.'),
})

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['newPasswordConfirm'],
  })

export const nicknameSchema = z.object({
  nickname: z.string().min(2, '닉네임은 2자 이상이어야 합니다.').max(20, '닉네임은 20자 이하여야 합니다.'),
})

export type SignUpValues = z.infer<typeof signUpSchema>
export type SignInValues = z.infer<typeof signInSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
export type NicknameValues = z.infer<typeof nicknameSchema>
```

### 9-3. 각 페이지

**`src/app/(auth)/signup/page.tsx`**

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas'
import { signUp } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

export default function SignUpPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', passwordConfirm: '', nickname: '' },
  })

  async function onSubmit(values: SignUpValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('email', values.email)
    formData.append('password', values.password)
    formData.append('nickname', values.nickname)
    const result = await signUp(formData)
    if (result?.error) setServerError(result.error)
  }

  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">회원가입</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일 *</FormLabel>
                  <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호 *</FormLabel>
                  <FormControl><Input type="password" placeholder="8자 이상" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호 확인 *</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '처리 중...' : '가입하기'}
            </Button>
          </form>
        </Form>
        <p className="text-sm text-center text-neutral-500 mt-4">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">로그인</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

**`src/app/(auth)/login/page.tsx`**

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInSchema, type SignInValues } from '@/features/auth/schemas'
import { signIn, signInWithGoogle } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: SignInValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append('email', values.email)
    formData.append('password', values.password)
    const result = await signIn(formData)
    if (result?.error) setServerError(result.error)
  }

  return (
    <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">로그인</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일 *</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호 *</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && <p className="text-sm text-rose-600">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '처리 중...' : '로그인'}
            </Button>
          </form>
        </Form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-neutral-200" />
          </div>
          <div className="relative flex justify-center text-xs text-neutral-400">
            <span className="bg-white px-2">또는</span>
          </div>
        </div>

        <form action={signInWithGoogle}>
          <Button type="submit" variant="outline" className="w-full">
            Google로 계속하기
          </Button>
        </form>

        <div className="flex justify-between text-sm text-neutral-500">
          <Link href="/signup" className="hover:underline">회원가입</Link>
          <Link href="/forgot-password" className="hover:underline">비밀번호 찾기</Link>
        </div>
      </CardContent>
    </Card>
  )
}
```

**`src/app/(auth)/verify-email/page.tsx`**

```typescript
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
```

**`src/app/(auth)/forgot-password/page.tsx`**

```typescript
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
```

**`src/app/(auth)/reset-password/page.tsx`**

```typescript
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
```

**`src/app/(auth)/nickname/page.tsx`**

```typescript
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
```

---

## Step 10: /dashboard Placeholder

`src/app/(app)/` 라우트 그룹을 만들고, 공통 레이아웃 + 대시보드 placeholder를 만든다.

**`src/app/(app)/layout.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <div className="min-h-screen bg-[#F9F9F8]">{children}</div>
}
```

**`src/app/(app)/dashboard/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user!.id)
    .single()

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">
          안녕하세요, {profile?.nickname ?? user?.email}님
        </h1>
        <form action={signOut}>
          <Button variant="outline" type="submit">로그아웃</Button>
        </form>
      </div>
      <p className="text-neutral-400 text-sm">Phase 2에서 실제 대시보드가 구현됩니다.</p>
    </main>
  )
}
```

---

## 파일 구조 최종 확인

Phase 1 완료 후 생성되어야 하는 파일 목록:

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── signup/page.tsx
│   │   ├── login/page.tsx
│   │   ├── verify-email/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── nickname/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   └── dashboard/page.tsx
│   └── auth/
│       └── callback/route.ts
├── features/
│   └── auth/
│       ├── actions.ts
│       ├── schemas.ts
│       └── seed.ts
├── lib/
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       ├── admin.ts
│       └── middleware.ts
└── middleware.ts

supabase/
├── config.toml
└── migrations/
    └── YYYYMMDDHHMMSS_phase1_init.sql
```

---

## 완료 기준 검증 체크리스트

Phase 1은 아래 9개를 전부 통과해야 완료로 인정한다.

| # | 검증 항목 | 방법 |
|---|-----------|------|
| 1 | `/signup` 가입 → 인증 이메일 수신 | 브라우저 + 받은 편지함 직접 확인 |
| 2 | 이메일 링크 클릭 → `/dashboard` 이동 | 브라우저에서 URL 확인 |
| 3 | profiles 1행, accounts 1행, categories 14행 생성 | Supabase 대시보드 → Table Editor |
| 4 | 로그아웃 → `/login` 이동 | 브라우저에서 URL 확인 |
| 5 | 미로그인 → `/dashboard` 직접 접근 → `/login` 리다이렉트 | 브라우저 시크릿 모드에서 확인 |
| 6 | 로그인 상태 → `/login` 접근 → `/dashboard` 리다이렉트 | 로그인 후 URL 직접 입력 |
| 7 | Google 로그인 → `/nickname` → `/dashboard` 흐름 | 브라우저에서 전체 흐름 확인 |
| 8 | 비밀번호 재설정 이메일 수신 + 새 비밀번호 설정 완료 | 받은 편지함 + 로그인 재시도 |
| 9 | RLS smoke check | Supabase SQL Editor에서: `SET LOCAL role = 'authenticated'; SET LOCAL "request.jwt.claims" = '{"sub":"<다른-user-id>"}'; SELECT * FROM profiles;` → 빈 결과 확인 |
