import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) setError(err.message)
      else setMessage(`Controlla la tua email (${email}) per confermare la registrazione.`)
    }
    setLoading(false)
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'signup' : 'login')
    setError(null)
    setMessage(null)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>🛒 Spesa</h1>
        <p className="auth-sub">Lista della spesa intelligente</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-msg">{message}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? `Attendere…` : mode === 'login' ? `Accedi` : `Registrati`}
          </button>
        </form>
        <button className="auth-switch" onClick={switchMode}>
          {mode === 'login' ? `Non hai un account? Registrati` : `Hai già un account? Accedi`}
        </button>
      </div>
    </div>
  )
}
