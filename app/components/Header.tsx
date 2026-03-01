import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
    >
      {children}
    </Link>
  )
}

function LogoutButton() {
  return (
    <form action="/auth/logout" method="post">
      <button
        type="submit"
        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
      >
        Logout
      </button>
    </form>
  )
}

export default async function Header() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const signedIn = !!user

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* LEFT */}
        <Link href="/dashboard" className="text-base font-semibold tracking-tight sm:text-lg">
          ResellTracker
        </Link>

        {/* RIGHT - Desktop */}
        <nav className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <>
              <NavLink href="/dashboard">Dashboard Mensal</NavLink>
              <NavLink href="/dashboard/annual">Dashboard Anual</NavLink>
              <NavLink href="/dashboard/total">Dashboard Total</NavLink>
              <NavLink href="/items">Inventário</NavLink>
              <LogoutButton />
            </>
          ) : (
            <>
              <NavLink href="/login">Login</NavLink>
              <NavLink href="/register">Register</NavLink>
            </>
          )}
        </nav>

        {/* RIGHT - Mobile (no JS) */}
        <div className="md:hidden">
          <details className="relative">
            <summary className="list-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer">
              Menu
            </summary>

            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
              <div className="grid gap-1 p-2">
                {signedIn ? (
                  <>
                    <Link className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/dashboard">
                      Dashboard Mensal
                    </Link>
                    <Link className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/dashboard/annual">
                      Dashboard Anual
                    </Link>
                    <Link className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/dashboard/total">
                      Dashboard Total
                    </Link>
                    <Link className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/items">
                      Inventário
                    </Link>

                    <div className="my-1 border-t border-zinc-100" />

                    <form action="/auth/logout" method="post">
                      <button
                        type="submit"
                        className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                      >
                        Logout
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/login">
                      Login
                    </Link>
                    <Link className="rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100" href="/register">
                      Register
                    </Link>
                  </>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  )
}