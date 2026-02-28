'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function RegisterPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // Dependendo do teu Supabase Auth settings, pode pedir confirmação por email.
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Criar conta</h1>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={6}
            style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
          />
        </label>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, borderRadius: 8, border: '1px solid #333' }}
        >
          {loading ? 'A criar...' : 'Criar conta'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Já tens conta? <a href="/login">Login</a>
      </p>
    </main>
  )
}