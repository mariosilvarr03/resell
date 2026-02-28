import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Header() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header
      style={{
        borderBottom: '1px solid #ddd',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {/* LEFT */}
      <Link href="/dashboard" style={{ fontWeight: 700, fontSize: 18 }}>
        ResellTracker
      </Link>

      {/* RIGHT */}
      <nav style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        {user && (
          <>
            <Link href="/dashboard">Dashboard Mensal</Link>
            <Link href="/dashboard/annual">Dashboard Anual</Link>
            <Link href="/dashboard/total">Dashboard Total</Link>
            <Link href="/items">Inventário</Link>
          </>
        )}

        {!user ? (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </>
        ) : (
          <form action="/auth/logout" method="post">
            <button type="submit">Logout</button>
          </form>
        )}
      </nav>
    </header>
  )
}