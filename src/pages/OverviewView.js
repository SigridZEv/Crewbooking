import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { COLORS } from '../lib/constants'
import { dk } from '../lib/dateUtils'
import { s } from '../lib/styles'
import { projectLabel } from './ProjectsView'
import { useIsMobile } from '../components/Sidebar'

// Startsiden: status for denne måneden på et blunk.
// - Tall øverst (prosjekter, crew booket, forespørsler som venter, prosjekter uten crew)
// - Liste over månedens prosjekter med hvor mange som er booket/forespurt
// - «Trenger oppfølging»: forespørsler som ikke er besvart, prosjekter som nærmer
//   seg uten crew, og crew som ikke har opprettet innlogging.

function fmtRange(a, b) {
  if (!a) return ''
  const da = new Date(a + 'T12:00:00'), db = new Date((b || a) + 'T12:00:00')
  const opt = { day: 'numeric', month: 'short' }
  if (a === (b || a)) return da.toLocaleDateString('nb-NO', opt)
  return da.toLocaleDateString('nb-NO', { day: 'numeric' }) + '–' + db.toLocaleDateString('nb-NO', opt)
}
function daysUntil(dateStr, todayStr) {
  return Math.round((new Date(dateStr + 'T12:00:00') - new Date(todayStr + 'T12:00:00')) / 86400000)
}
function inDays(n) {
  if (n <= 0) return 'i dag'
  if (n === 1) return 'i morgen'
  return 'om ' + n + ' dager'
}

export default function OverviewView({ projects, crew, openProfile, openProject, userName }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [yearBookings, setYearBookings] = useState(null) // alle bookede dager i år (til funfacts)
  const [factIdx, setFactIdx] = useState(0)
  const isMobile = useIsMobile()

  const now = new Date()
  const todayStr = dk(now)
  const monthStart = dk(new Date(now.getFullYear(), now.getMonth(), 1))
  const monthEnd = dk(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const monthName = now.toLocaleDateString('nb-NO', { month: 'long' })
  const year = now.getFullYear()
  const yearStart = year + '-01-01', yearEnd = year + '-12-31'

  useEffect(() => {
    let cancelled = false
    supabase.from('bookings').select('*').gte('date', monthStart).lte('date', monthEnd).in('status', ['booked', 'requested'])
      .then(({ data }) => { if (!cancelled) { setBookings(data || []); setLoading(false) } })
    return () => { cancelled = true }
  }, [monthStart, monthEnd])

  // Funfacts: bookinger i år (kun booket). Teller person × prosjekt, så én person på fem jobber = 5.
  useEffect(() => {
    let cancelled = false
    supabase.from('bookings').select('crew_id, project_id, project, date').eq('status', 'booked').gte('date', yearStart).lte('date', yearEnd)
      .then(({ data }) => { if (!cancelled) setYearBookings(data || []) })
    return () => { cancelled = true }
  }, [yearStart, yearEnd])

  // Funfacts – alle vi kan regne ut, så viser vi tre om gangen og ruller
  const facts = useMemo(() => {
    const yb = yearBookings || []
    const yearProjects = projects.filter(p => p.start_date && p.start_date >= yearStart && p.start_date <= yearEnd)
    const done = yearProjects.filter(p => (p.end_date || p.start_date) < todayStr).length
    const left = yearProjects.length - done
    const jobKey = b => b.crew_id + '|' + (b.project_id || (b.project || '').trim().toLowerCase() || b.date)
    const jobs = new Set(yb.map(jobKey)).size
    const out = [
      { key: 'done', n: done, text: 'prosjekter fullført i ' + year, bg: '#E1F5EE', color: '#0F6E56' },
      { key: 'left', n: left, text: 'prosjekter igjen i ' + year, bg: '#E3EAF7', color: '#1B3A78' },
      { key: 'jobs', n: yearBookings ? jobs : null, text: 'crew-jobber booket i ' + year, bg: '#FAEEDA', color: '#854F0B' },
    ]
    if (yb.length) {
      out.push({ key: 'days', n: yb.length, text: 'crew-dager booket i ' + year, bg: '#F3E8F5', color: '#6B3A7A' })
      // Travleste måned
      const perMonth = {}
      for (const b of yb) perMonth[b.date.slice(5, 7)] = (perMonth[b.date.slice(5, 7)] || 0) + 1
      const [bm, bn] = Object.entries(perMonth).sort((a, b) => b[1] - a[1])[0]
      out.push({ key: 'busy', n: bn, text: 'crew-dager i ' + new Date(year, Number(bm) - 1, 1).toLocaleDateString('nb-NO', { month: 'long' }) + ' – årets travleste måned', bg: '#FCEBEB', color: '#A32D2D' })
      // Flest jobber
      const perCrew = {}
      for (const k of new Set(yb.map(jobKey))) { const id = k.split('|')[0]; perCrew[id] = (perCrew[id] || 0) + 1 }
      const top = Object.entries(perCrew).sort((a, b) => b[1] - a[1])[0]
      const tc = top && crew.find(c => c.id === top[0])
      if (tc && top[1] >= 2) out.push({ key: 'top', n: top[1], text: 'jobber for ' + tc.name.split(' ')[0] + ' – flest av alle i ' + year, bg: '#E1F5EE', color: '#0F6E56' })
      // Helgejobber
      const weekend = yb.filter(b => { const d = new Date(b.date + 'T12:00:00').getDay(); return d === 0 || d === 6 }).length
      if (weekend) out.push({ key: 'weekend', n: weekend, text: 'crew-dager på lørdag eller søndag i ' + year, bg: '#E3EAF7', color: '#1B3A78' })
    }
    const clients = new Set(yearProjects.map(p => (p.client || '').trim().toLowerCase()).filter(Boolean)).size
    if (clients) out.push({ key: 'clients', n: clients, text: 'ulike kunder med prosjekt i ' + year, bg: '#FAEEDA', color: '#854F0B' })
    const longest = yearProjects.map(p => ({ p, d: daysUntil(p.end_date || p.start_date, p.start_date) + 1 })).sort((a, b) => b.d - a.d)[0]
    if (longest && longest.d >= 3) out.push({ key: 'longest', n: longest.d, text: 'dager varer årets lengste prosjekt: ' + longest.p.name, bg: '#F3E8F5', color: '#6B3A7A' })
    const next = projects.filter(p => p.start_date && p.start_date > todayStr).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
    if (next) out.push({ key: 'next', n: daysUntil(next.start_date, todayStr), text: 'dager til neste prosjekt: ' + next.name, bg: '#E1F5EE', color: '#0F6E56' })
    const perTeam = {}
    for (const p of yearProjects) if (p.team) perTeam[p.team] = (perTeam[p.team] || 0) + 1
    const teamTop = Object.entries(perTeam).sort((a, b) => b[1] - a[1])[0]
    if (teamTop) out.push({ key: 'team', n: teamTop[1], text: 'prosjekter for team ' + teamTop[0] + ' – flest i ' + year, bg: '#E3EAF7', color: '#1B3A78' })
    const newCrew = crew.filter(c => c.created_at && c.created_at.slice(0, 4) === String(year)).length
    if (newCrew) out.push({ key: 'newcrew', n: newCrew, text: 'nye crew-medlemmer i ' + year, bg: '#FCEBEB', color: '#A32D2D' })
    out.push({ key: 'crew', n: crew.length, text: 'crew-medlemmer i Crewbooking totalt', bg: '#FAEEDA', color: '#854F0B' })
    return out
  }, [yearBookings, projects, crew, year, yearStart, yearEnd, todayStr])

  // Rullér: bytt ut én boble hvert 12. sekund
  useEffect(() => {
    if (facts.length <= 3) return
    const id = setInterval(() => setFactIdx(i => i + 1), 12000)
    return () => clearInterval(id)
  }, [facts.length])
  const shownFacts = [0, 1, 2].map(k => facts[(factIdx + k) % facts.length]).filter(Boolean)

  const crewById = useMemo(() => Object.fromEntries(crew.map(c => [c.id, c])), [crew])

  // Månedens prosjekter med tellinger
  const rows = useMemo(() => {
    const byProject = {}
    for (const b of bookings) if (b.project_id) (byProject[b.project_id] = byProject[b.project_id] || []).push(b)
    return projects
      .filter(p => p.start_date && (p.end_date || p.start_date) >= monthStart && p.start_date <= monthEnd)
      .map(p => {
        const bs = byProject[p.id] || []
        const booked = new Set(bs.filter(b => b.status === 'booked').map(b => b.crew_id)).size
        const requested = new Set(bs.filter(b => b.status === 'requested').map(b => b.crew_id)).size
        return { p, booked, requested, bookings: bs, end: p.end_date || p.start_date }
      })
      .sort((a, b) => a.p.start_date.localeCompare(b.p.start_date) || a.p.name.localeCompare(b.p.name))
  }, [projects, bookings, monthStart, monthEnd])

  const crewBookedCount = new Set(bookings.filter(b => b.status === 'booked').map(b => b.crew_id)).size
  const requestedRows = bookings.filter(b => b.status === 'requested')
  const withoutCrew = rows.filter(r => r.booked + r.requested === 0 && r.end >= todayStr)

  // Oppfølging: forespørsler gruppert per crew + prosjekt
  const followUps = useMemo(() => {
    const out = []
    const groups = {}
    for (const b of requestedRows) {
      const k = b.crew_id + '|' + (b.project_id || b.project || '')
      groups[k] = groups[k] || { crew_id: b.crew_id, project_id: b.project_id, project: b.project, booked_by: b.booked_by, dates: [] }
      groups[k].dates.push(b.date)
    }
    for (const g of Object.values(groups)) {
      const c = crewById[g.crew_id]
      if (!c) continue
      const p = projects.find(x => x.id === g.project_id)
      g.dates.sort()
      out.push({
        kind: 'requested', c, p, sort: g.dates[0],
        text: c.name + ' er forespurt på ' + (p ? p.name : (g.project || 'ukjent prosjekt')) + ' ' + fmtRange(g.dates[0], g.dates[g.dates.length - 1]),
        sub: g.booked_by ? 'Forespurt av ' + g.booked_by : '',
      })
    }
    for (const r of withoutCrew) {
      const n = daysUntil(r.p.start_date, todayStr)
      out.push({
        kind: 'nocrew', p: r.p, sort: r.p.start_date,
        text: r.p.name + (n < 0 ? ' er i gang uten crew' : ' starter ' + inDays(n) + ' uten crew'),
        sub: [(r.p.status || '').toLowerCase() === 'pending' ? 'Pending i Qondor' : '', r.p.place].filter(Boolean).join(' · '),
      })
    }
    out.sort((a, b) => a.sort.localeCompare(b.sort))
    const noLogin = crew.filter(c => !c.user_id).length
    if (noLogin > 0) out.push({ kind: 'nologin', count: noLogin, sort: 'zzz', text: noLogin + ' crew har ikke opprettet innlogging enda', sub: 'De får tilgang til sin egen side når de har registrert seg' })
    return out
  }, [requestedRows, withoutCrew, crewById, projects, crew, todayStr])

  const hour = now.getHours()
  const greeting = hour < 10 ? 'God morgen' : hour < 17 ? 'Hei' : 'God kveld'
  const firstName = (userName || '').split(' ')[0]
  const weekNo = (() => { const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())); const dayNum = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - dayNum); const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil((((d - y0) / 86400000) + 1) / 7) })()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{greeting}{firstName ? ', ' + firstName : ''} 👋</h2>
        <span style={{ fontSize: 13, color: '#888' }}>{now.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })} · uke {weekNo}</span>
      </div>

      <div style={{ ...ov.tiles, gridTemplateColumns: isMobile ? '1fr 1fr' : ov.tiles.gridTemplateColumns }}>
        <Tile label={'Prosjekter i ' + monthName} value={rows.length} />
        <Tile label="Crew booket denne måneden" value={crewBookedCount} sub={crewBookedCount === 1 ? 'person' : 'personer'} />
        <Tile label="Venter på svar" value={new Set(requestedRows.map(b => b.crew_id + b.project_id)).size} sub="forespørsler" color={requestedRows.length ? '#854F0B' : undefined} />
        <Tile label="Uten crew" value={withoutCrew.length} sub={withoutCrew.length === 1 ? 'prosjekt' : 'prosjekter'} color={withoutCrew.length ? '#A32D2D' : undefined} />
      </div>

      <div style={{ ...ov.cols, gridTemplateColumns: isMobile ? '1fr' : ov.cols.gridTemplateColumns }}>
        <div style={ov.card}>
          <div style={ov.cardHdr}><span>Prosjekter i {monthName}</span><button style={ov.link} onClick={() => openProject(null)}>Åpne prosjektkalenderen →</button></div>
          {loading && <p style={ov.muted}>Laster…</p>}
          {!loading && rows.length === 0 && <p style={ov.muted}>Ingen prosjekter denne måneden.</p>}
          {rows.map(r => {
            const col = COLORS[(r.p.color_index || 0) % COLORS.length]
            const past = r.end < todayStr
            return <div key={r.p.id} style={{ ...ov.row, opacity: past ? 0.55 : 1 }} onClick={() => openProject(r.p)}
              onMouseEnter={e => e.currentTarget.style.background = '#FAF9F6'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: col.text, flexShrink: 0 }} />
              <span style={{ ...ov.rowDate, width: isMobile ? 74 : 92 }}>{fmtRange(r.p.start_date, r.p.end_date)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...ov.rowName, whiteSpace: isMobile ? 'normal' : 'nowrap' }}>{isMobile ? r.p.name : projectLabel(r.p)}</div>
                <div style={ov.rowSub}>{[r.p.place, r.p.team ? 'Team ' + r.p.team : '', (r.p.status || '').toLowerCase() === 'pending' ? 'Pending' : ''].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: isMobile ? 'column' : 'row', alignItems: 'flex-end' }}>
                {r.booked > 0 && <span style={{ ...ov.tag, background: '#E1F5EE', color: '#0F6E56' }}>{r.booked} booket</span>}
                {r.requested > 0 && <span style={{ ...ov.tag, background: '#FAEEDA', color: '#854F0B' }}>{r.requested} forespurt</span>}
                {r.booked + r.requested === 0 && <span style={{ ...ov.tag, background: past ? '#F1EFE8' : '#FCEBEB', color: past ? '#888' : '#A32D2D' }}>Uten crew</span>}
              </div>
            </div>
          })}
        </div>

        <div style={ov.card}>
          <div style={ov.cardHdr}><span>Trenger oppfølging</span></div>
          {!loading && followUps.length === 0 && <p style={ov.muted}>Alt er i rute. 🎉</p>}
          {followUps.map((f, i) => {
            let av
            if (f.kind === 'requested') { const cc = COLORS[(f.c.color_index || 0) % COLORS.length]; av = <div style={{ ...s.avatar, width: 28, height: 28, fontSize: 10, background: cc.bg, color: cc.text }}>{f.c.initials}</div> }
            else if (f.kind === 'nocrew') av = <div style={{ ...s.avatar, width: 28, height: 28, fontSize: 13, background: '#FCEBEB', color: '#A32D2D', fontWeight: 700 }}>!</div>
            else av = <div style={{ ...s.avatar, width: 28, height: 28, fontSize: 11, background: '#F1EFE8', color: '#888' }}>{f.count}</div>
            const onClick = f.kind === 'requested' ? () => openProfile(f.c) : f.kind === 'nocrew' ? () => openProject(f.p) : undefined
            return <div key={i} style={{ ...ov.todo, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}
              onMouseEnter={e => { if (onClick) e.currentTarget.style.background = '#FAF9F6' }} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {av}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#1a1a18' }}>{f.text}</div>
                {f.sub && <div style={ov.rowSub}>{f.sub}</div>}
              </div>
              {f.kind === 'requested' && <span style={{ ...ov.tag, background: '#FAEEDA', color: '#854F0B' }}>Forespurt</span>}
            </div>
          })}
        </div>
      </div>

      {/* Funfacts – bobler som flyter sakte */}
      <div style={ov.bubbles}>
        {shownFacts.map((f, i) => <Bubble key={f.key} n={f.n} text={f.text} bg={f.bg} color={f.color} dur={['9s', '11s', '10s'][i]} delay={['0s', '-3s', '-6s'][i]} size={[150, 170, 160][i]} />)}
      </div>
    </div>
  )
}

function Bubble({ n, text, bg, color, dur, delay, size }) {
  return (
    <div style={{ width: size, height: size, animation: 'zFadeIn .8s ease-out' }}>
    <div style={{ ...ov.bubble, width: size, height: size, background: bg, color, animationDuration: dur, animationDelay: delay }}>
      <div style={{ fontSize: size > 160 ? 40 : 34, fontWeight: 700, lineHeight: 1 }}>{n === null || n === undefined ? '…' : n}</div>
      <div style={{ fontSize: 12, marginTop: 6, opacity: .85, padding: '0 18px', lineHeight: 1.3 }}>{text}</div>
    </div>
    </div>
  )
}

function Tile({ label, value, sub, color }) {
  return (
    <div style={ov.tile}>
      <div style={ov.tileLabel}>{label}</div>
      <div style={{ ...ov.tileValue, color: color || '#1a1a18' }}>{value}{sub && <span style={ov.tileSub}> {sub}</span>}</div>
    </div>
  )
}

const ov = {
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 },
  tile: { background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e6e5df' },
  tileLabel: { fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#888', textTransform: 'uppercase' },
  tileValue: { fontSize: 26, fontWeight: 600, marginTop: 4, lineHeight: 1.1 },
  tileSub: { fontSize: 13, color: '#888', fontWeight: 400 },
  cols: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)', gap: 16 },
  card: { background: '#fff', borderRadius: 14, border: '0.5px solid #e6e5df', padding: '16px 18px', minWidth: 0 },
  cardHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#666', marginBottom: 8 },
  link: { fontSize: 12, color: '#1B3A78', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'none', letterSpacing: 0, padding: 0 },
  muted: { fontSize: 13, color: '#aaa' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', margin: '0 -6px', borderRadius: 8, borderBottom: '0.5px solid #f0efe9', fontSize: 13, cursor: 'pointer' },
  rowDate: { width: 92, color: '#666', fontSize: 12, flexShrink: 0 },
  rowName: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowSub: { fontSize: 11, color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tag: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' },
  bubbles: { display: 'flex', gap: 28, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', padding: '40px 0 24px', minHeight: 220 },
  bubble: { borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', animationName: 'zFloat', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', boxShadow: '0 10px 30px rgba(26,27,46,0.08)' },
  todo: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 6px', margin: '0 -6px', borderRadius: 8, borderBottom: '0.5px solid #f0efe9' },
}
