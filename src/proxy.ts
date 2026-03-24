import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const AUTH_ROUTES = ['/signup', '/login', '/forgot-password', '/verify-email']
// (app) 그룹 전체 보호 — Phase 2에서 /transactions, /accounts 추가됨
const PROTECTED_PREFIXES = ['/dashboard', '/transactions', '/accounts', '/setup-account']

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // 미로그인 상태로 보호된 경로 접근
  if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
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
