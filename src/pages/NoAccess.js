import { supabase } from '../lib/supabase'

// Vises når en innlogget bruker ikke er admin og ikke er koblet til en crew-profil.
export default function NoAccess({ user }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1B3A78 0%, #2C5FA8 30%, #3D9CBA 65%, #84C58E 100%)',
      padding: '1rem', fontFamily: "'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",
    }}>
      <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: 20, padding: '2.5rem 2rem', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(26,27,46,0.3)', textAlign: 'center' }}>
        <img src="/Z_logo.png" alt="Z Event" style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto 16px', display: 'block' }} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 10px', color: '#1A1B2E' }}>Kontoen er ikke koblet enda</h1>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: '0 0 8px' }}>
          Du er logget inn som <strong style={{ color: '#1A1B2E' }}>{user.email}</strong>, men vi finner ingen crew-profil med denne e-postadressen.
        </p>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px' }}>
          Ta kontakt med Z Event og be dem registrere denne e-posten på profilen din. Når det er gjort, logger du bare inn igjen.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ padding: '11px 22px', fontSize: 14, fontWeight: 600, borderRadius: 9, border: '1px solid #C7D0F0', background: '#fff', color: '#1B3A78', cursor: 'pointer', fontFamily: 'inherit' }}
        >Logg ut</button>
      </div>
    </div>
  )
}
