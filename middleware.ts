import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute =
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/register')

  // Se não estiver autenticado e tentar entrar em rotas privadas
  if (!user && !isAuthRoute) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Se estiver autenticado e tentar ir para login/register, manda para dashboard
  if (user && isAuthRoute) {
    const dashboardUrl = req.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return res
}

// Define quais rotas passam pelo middleware
export const config = {
  matcher: [
    /*
      Rotas privadas:
      - /dashboard
      - /items
      E também impedir acesso direto à home se quiseres
    */
    '/dashboard/:path*',
    '/items/:path*',
    '/login',
    '/register',
  ],
}