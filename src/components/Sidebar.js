import { useState, useEffect } from 'react'

// Fast meny til venstre (bunnmeny på mobil). Ren visning – all logikk ligger i BookingPage.

export const NAV = [
  { key: 'overview', label: 'Oversikt', icon: '▦' },
  { key: 'projects', label: 'Prosjekter', icon: '▤' },
  { key: 'crew', label: 'Crew', icon: '◉' },
  { key: 'timesheets', label: 'Timelister', icon: '▥', soon: true },
]

export function useIsMobile(breakpoint = 820) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return mobile
}

export default function Sidebar({ view, setView, userName, roleLabel, badges = {}, onMyProfile, onLogout, mobile }) {
  const initials = (userName || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  if (mobile) {
    return (
      <nav style={sb.bottomNav}>
        {NAV.map(n => {
          const active = view === n.key
          return <button key={n.key} style={{ ...sb.bottomItem, color: active ? '#1B3A78' : '#888', fontWeight: active ? 700 : 500 }} onClick={() => setView(n.key)}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
            <span style={{ fontSize: 10 }}>{n.label}</span>
            {badges[n.key] > 0 && <span style={sb.bottomBadge}>{badges[n.key]}</span>}
          </button>
        })}
        <button style={{ ...sb.bottomItem, color: '#888' }} onClick={onMyProfile}>
          <span style={{ ...sb.avatar, width: 22, height: 22, fontSize: 9 }}>{initials}</span>
          <span style={{ fontSize: 10 }}>Meg</span>
        </button>
      </nav>
    )
  }

  return (
    <aside style={sb.side}>
      <div style={sb.brand}>
        <img src="/Z_logo.png" alt="Z Event" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <div>
          <div style={sb.brandSmall}>Z Event</div>
          <div style={sb.brandTitle}>Crew Portal</div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(n => {
          const active = view === n.key
          return <button key={n.key} style={{ ...sb.item, ...(active ? sb.itemActive : {}) }} onClick={() => setView(n.key)}>
            <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{n.icon}</span>
            <span>{n.label}</span>
            {n.soon && <span style={sb.soon}>snart</span>}
            {!n.soon && badges[n.key] > 0 && <span style={{ ...sb.badge, ...(active ? { background: 'rgba(255,255,255,.22)', color: '#fff' } : {}) }}>{badges[n.key]}</span>}
          </button>
        })}
      </nav>
      <div style={sb.bottom}>
        <button style={sb.me} onClick={onMyProfile} title="Min profil">
          <span style={sb.avatar}>{initials}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName || 'Min konto'}</span>
            <span style={{ display: 'block', fontSize: 11, color: '#999' }}>{roleLabel} · Min profil</span>
          </span>
        </button>
        <button style={sb.logout} onClick={onLogout}>Logg ut</button>
      </div>
    </aside>
  )
}

const sb = {
  side: { width: 210, flexShrink: 0, background: '#fff', borderRight: '0.5px solid #e0dfd8', display: 'flex', flexDirection: 'column', padding: '20px 12px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 20px' },
  brandSmall: { fontSize: 10, fontWeight: 700, color: '#1B3A78', letterSpacing: '0.14em', textTransform: 'uppercase' },
  brandTitle: { fontSize: 16, fontWeight: 600, color: '#1a1a18', letterSpacing: '-0.01em' },
  item: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, fontSize: 14, color: '#444', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%' },
  itemActive: { background: '#1B3A78', color: '#fff', fontWeight: 600 },
  soon: { marginLeft: 'auto', fontSize: 10, color: '#999', border: '0.5px solid #ddd', padding: '1px 6px', borderRadius: 8 },
  badge: { marginLeft: 'auto', fontSize: 11, background: '#FCEBEB', color: '#A32D2D', padding: '1px 7px', borderRadius: 10, fontWeight: 700 },
  bottom: { marginTop: 'auto', borderTop: '0.5px solid #eee', paddingTop: 10 },
  me: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', borderRadius: 10, color: '#1a1a18' },
  avatar: { width: 30, height: 30, borderRadius: '50%', background: '#FAEEDA', color: '#854F0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 },
  logout: { display: 'block', padding: '6px 12px', fontSize: 12, color: '#999', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  bottomNav: { position: 'fixed', left: 0, right: 0, bottom: 0, display: 'flex', background: '#fff', borderTop: '0.5px solid #e0dfd8', zIndex: 150, paddingBottom: 'env(safe-area-inset-bottom)' },
  bottomItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px 6px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', position: 'relative' },
  bottomBadge: { position: 'absolute', top: 4, right: '22%', fontSize: 9, background: '#A32D2D', color: '#fff', padding: '1px 5px', borderRadius: 8, fontWeight: 700 },
}
