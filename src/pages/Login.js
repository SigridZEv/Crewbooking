import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')

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
    if (result.error) setError(result.error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #2D3A8C 0%, #3B5BDB 35%, #7048E8 65%, #9C36B5 100%)',
      padding: '1rem',
      fontFamily: "'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 20,
        padding: '2.5rem 2rem',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 20px 60px rgba(26,27,46,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #3B5BDB, #7048E8)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 22, color: '#fff', fontWeight: 700,
          }}>Z</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4C6EF5', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Z Event</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#1A1B2E', letterSpacing: '-0.02em' }}>Crew booking</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
            {mode === 'login' ? 'Logg inn med din Z Event-konto' : 'Opprett konto'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-post</label>
          <input
            style={{
              width: '100%', padding: '11px 14px', fontSize: 14,
              borderRadius: 9, border: '1px solid #C7D0F0',
              background: '#F8F9FE', color: '#1A1B2E',
              fontFamily: "'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif", boxSizing: 'border-box', marginBottom: 16, outline: 'none',
            }}
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="navn@zevent.no" required
          />
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passord</label>
          <input
            style={{
              width: '100%', padding: '11px 14px', fontSize: 14,
              borderRadius: 9, border: '1px solid #C7D0F0',
              background: '#F8F9FE', color: '#1A1B2E',
              fontFamily: "'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif", boxSizing: 'border-box', marginBottom: 6, outline: 'none',
            }}
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required
          />
          {error && <p style={{ fontSize: 13, color: '#C92A2A', margin: '6px 0 10px', background: '#FFF0F0', padding: '8px 12px', borderRadius: 7 }}>{error}</p>}
          <button
            style={{
              marginTop: 14, width: '100%', padding: '13px',
              fontSize: 15, fontWeight: 700, borderRadius: 9,
              border: 'none',
              background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #3B5BDB, #7048E8)',
              color: '#fff', cursor: loading ? 'default' : 'pointer',
              fontFamily: "'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif", boxShadow: '0 3px 10px rgba(76,110,245,0.35)',
            }}
            type="submit" disabled={loading}
          >
            {loading ? 'Laster…' : mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
          {mode === 'login' ? 'Ny bruker? ' : 'Har du konto? '}
          <button
            style={{ background: 'none', border: 'none', color: '#3B5BDB', cursor: 'pointer', fontSize: 13, fontFamily: "'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif", fontWeight: 600 }}
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Opprett konto' : 'Logg inn'}
          </button>
        </p>
      </div>
    </div>
  )
}
