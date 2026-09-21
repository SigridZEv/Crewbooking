import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Vises når noen kommer inn via en invitasjonslenke eller «glemt passord»-lenke.
// Brukeren er allerede innlogget via lenken, men har ikke (nytt) passord enda.

const font = "'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"
const input = { width: '100%', padding: '11px 14px', fontSize: 14, borderRadius: 9, border: '1px solid #C7D0F0', background: '#F8F9FE', color: '#1A1B2E', fontFamily: font, boxSizing: 'border-box', marginBottom: 14, outline: 'none' }
const label = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }

export default function SetPassword({ user, kind, onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const firstName = (user?.user_metadata?.full_name || '').split(' ')[0]
  const isInvite = kind === 'invite'

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 6) { setError('Passordet må være minst 6 tegn.'); return }
    if (pw !== pw2) { setError('Passordene er ikke like.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { setSaving(false); setError(error.message); return }
    if (isInvite) {
      // Marker at invitasjonen er fullført (crew kan oppdatere egen rad)
      await supabase.from('crew').update({ invite_accepted_at: new Date().toISOString() }).eq('user_id', user.id)
    }
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1B3A78 0%, #2C5FA8 30%, #3D9CBA 65%, #84C58E 100%)', padding: '1rem', fontFamily: font }}>
      <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 20, padding: '2.5rem 2rem', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(26,27,46,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/Z_logo.png" alt="Z Event" style={{ width: 70, height: 70, objectFit: 'contain', margin: '0 auto 14px', display: 'block' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: '#1A1B2E' }}>
            {isInvite ? `Velkommen${firstName ? ', ' + firstName : ''}!` : 'Nytt passord'}
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
            {isInvite
              ? 'Z Event har opprettet en profil til deg i Crewbooking. Velg et passord, så er du klar.'
              : 'Velg et nytt passord for kontoen din.'}
          </p>
          {user?.email && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' }}>{user.email}</p>}
        </div>
        <form onSubmit={submit}>
          <label style={label}>Passord</label>
          <input style={input} type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Minst 6 tegn" autoFocus required />
          <label style={label}>Gjenta passord</label>
          <input style={input} type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="••••••••" required />
          {error && <p style={{ fontSize: 13, color: '#C92A2A', margin: '0 0 10px', background: '#FFF0F0', padding: '8px 12px', borderRadius: 7 }}>{error}</p>}
          <button type="submit" disabled={saving} style={{ width: '100%', padding: '13px', fontSize: 15, fontWeight: 700, borderRadius: 9, border: 'none', background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #1B3A78, #3D9CBA)', color: '#fff', cursor: saving ? 'default' : 'pointer', fontFamily: font, boxShadow: '0 3px 10px rgba(27,58,120,0.35)' }}>
            {saving ? 'Lagrer…' : (isInvite ? 'Lagre og gå til min side' : 'Lagre nytt passord')}
          </button>
        </form>
      </div>
    </div>
  )
}
