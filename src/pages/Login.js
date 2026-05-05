import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let result
    if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.signUp({ email, password })
    }

    if (result.error) {
      setError(result.error.message)
    }
    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Z Event</div>
        <h1 style={styles.title}>Crew booking</h1>
        <p style={styles.sub}>
          {mode === 'login' ? 'Logg inn med din Z Event-konto' : 'Opprett konto'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>E-post</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="navn@zevent.no"
            required
          />

          <label style={styles.label}>Passord</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Laster…' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>

        <p style={styles.toggle}>
          {mode === 'login' ? 'Ny bruker? ' : 'Har du konto? '}
          <button
            style={styles.link}
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Opprett konto' : 'Logg inn'}
          </button>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f4f0',
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    border: '0.5px solid #e0dfd8',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 380,
  },
  logo: {
    fontSize: 13,
    fontWeight: 500,
    color: '#888',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 500,
    margin: '0 0 6px',
    color: '#1a1a18',
  },
  sub: {
    fontSize: 14,
    color: '#888',
    margin: '0 0 1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#666',
    marginTop: 8,
  },
  input: {
    padding: '9px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: '0.5px solid #d0cfc8',
    outline: 'none',
    fontFamily: 'inherit',
    color: '#1a1a18',
    background: '#fff',
  },
  error: {
    fontSize: 13,
    color: '#A32D2D',
    margin: '4px 0 0',
  },
  btn: {
    marginTop: 16,
    padding: '11px',
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 8,
    border: 'none',
    background: '#1a1a18',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  toggle: {
    marginTop: 20,
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#1a1a18',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    textDecoration: 'underline',
  },
}
