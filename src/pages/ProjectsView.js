import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { COLORS, STATUS } from '../lib/constants'
import { getMonthDates, getWeekDates, fmtMonth, fmtDay, dk } from '../lib/dateUtils'
import { s } from '../lib/styles'

// Prosjektkalender: én strek per prosjekt over dagene det varer (som heldags-
// hendelser i iPhone-kalenderen). Trykk på en strek → panel fra høyre med
// hvilke crew som er booket/forespurt per dag.
//
// Prosjekter kommer fra tabellen `projects`. Gamle bookinger som bare har
// fritekst i 'project' vises også (grå strek), og kan gjøres om til et ekte
// prosjekt med ett klikk.

export function projectLabel(p) {
  if (!p) return ''
  return (p.project_number ? p.project_number + ' — ' : '') + p.name
}

const WEEKDAY_SHORT = ['sø', 'ma', 'ti', 'on', 'to', 'fr', 'lø']

function capFirst(t) { return t.charAt(0).toUpperCase() + t.slice(1) }
function fmtDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return capFirst(d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }))
}
function fmtRange(a, b) {
  if (!a) return 'Dato ikke satt'
  const da = new Date(a + 'T12:00:00'), db = new Date((b || a) + 'T12:00:00')
  const opt = { day: 'numeric', month: 'short' }
  if (a === (b || a)) return da.toLocaleDateString('nb-NO', { ...opt, year: 'numeric' })
  return da.toLocaleDateString('nb-NO', opt) + ' – ' + db.toLocaleDateString('nb-NO', { ...opt, year: 'numeric' })
}
function legacyKey(text) { return 'legacy:' + text.trim().toLowerCase() }

export default function ProjectsView({ projects, crew, onProjectsChanged, onBookingsChanged, openProfile, showToast, userName, userId }) {
  const [calMode, setCalMode] = useState('month') // 'week' | 'month'
  // Visning: 'cal' (kalender) | '2026' | '2027' | '2028' (liste per år) | 'done' (fullførte)
  const [viewSel, setViewSel] = useState('cal')
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [monthBookings, setMonthBookings] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [panelBookings, setPanelBookings] = useState([])
  const [panelLoading, setPanelLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showPast, setShowPast] = useState(true)
  const [teamFilter, setTeamFilter] = useState('')
  const [search, setSearch] = useState('')

  const days = calMode === 'week' ? getWeekDates(weekOffset) : getMonthDates(monthOffset)
  const offset = calMode === 'week' ? weekOffset : monthOffset
  const setOffset = calMode === 'week' ? setWeekOffset : setMonthOffset
  const todayStr = dk(new Date())
  const isList = viewSel !== 'cal'
  // Datointervallet radene hentes for
  let monthStart, monthEnd
  if (viewSel === 'cal') { monthStart = dk(days[0]); monthEnd = dk(days[days.length - 1]) }
  else if (viewSel === 'done') { monthStart = '2000-01-01'; monthEnd = todayStr }
  else { monthStart = viewSel + '-01-01'; monthEnd = viewSel + '-12-31' }
  const years = useMemo(() => {
    const ys = new Set(projects.map(p => (p.start_date || '').slice(0, 4)).filter(Boolean))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort()
  }, [projects])
  const crewById = useMemo(() => Object.fromEntries(crew.map(c => [c.id, c])), [crew])

  // Bookinger i måneden (kun de som faktisk er jobber)
  const loadMonth = useCallback(async () => {
    const { data } = await supabase.from('bookings').select('*')
      .gte('date', monthStart).lte('date', monthEnd)
      .in('status', ['booked', 'requested'])
    setMonthBookings(data || [])
  }, [monthStart, monthEnd])
  useEffect(() => { loadMonth() }, [loadMonth])

  // Bygg radene: ekte prosjekter + "legacy" fritekst-prosjekter
  const rows = useMemo(() => {
    const byProject = {}
    const legacy = {}
    for (const b of monthBookings) {
      if (b.project_id) {
        (byProject[b.project_id] = byProject[b.project_id] || []).push(b)
      } else if (b.project && b.project.trim()) {
        const k = legacyKey(b.project)
        legacy[k] = legacy[k] || { key: k, name: b.project.trim(), bookings: [] }
        legacy[k].bookings.push(b)
      }
    }
    const out = []
    for (const p of projects) {
      const bs = byProject[p.id] || []
      let start = p.start_date, end = p.end_date || p.start_date
      if (!start && bs.length) {
        const ds = bs.map(b => b.date).sort()
        start = ds[0]; end = ds[ds.length - 1]
      }
      if (!start) continue
      if (end < monthStart || start > monthEnd) continue
      out.push({ key: p.id, project: p, name: projectLabel(p), start, end, count: new Set(bs.map(b => b.crew_id)).size, colorIndex: p.color_index || 0, legacy: false, pending: (p.status || '').toLowerCase() === 'pending', team: p.team || '' })
    }
    for (const l of Object.values(legacy)) {
      const ds = l.bookings.map(b => b.date).sort()
      out.push({ key: l.key, project: null, name: l.name, start: ds[0], end: ds[ds.length - 1], count: new Set(l.bookings.map(b => b.crew_id)).size, colorIndex: -1, legacy: true, legacyText: l.name })
    }
    let res = out
    if (viewSel === 'done') res = out.filter(r => r.end < todayStr).sort((a, b) => b.end.localeCompare(a.end))
    else res = out.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
    return res
  }, [projects, monthBookings, monthStart, monthEnd, viewSel, todayStr])

  const teams = useMemo(() => [...new Set(projects.map(p => p.team).filter(Boolean))].sort(), [projects])
  const q = search.trim().toLowerCase()
  const visibleRows = rows.filter(r =>
    (isList || showPast || r.end >= todayStr) &&
    (!teamFilter || r.legacy || r.team === teamFilter) &&
    (!q || r.name.toLowerCase().includes(q) || (r.project?.client || '').toLowerCase().includes(q) || (r.project?.project_leader || '').toLowerCase().includes(q))
  )
  const selected = rows.find(r => r.key === selectedKey) || null

  // Når et prosjekt velges: hent ALLE bookingene dets (også utenfor måneden)
  useEffect(() => {
    if (!selected) { setPanelBookings([]); return }
    let cancelled = false
    setPanelLoading(true)
    const q = supabase.from('bookings').select('*').in('status', ['booked', 'requested']).order('date')
    const run = selected.legacy
      ? q.is('project_id', null).ilike('project', selected.legacyText)
      : q.eq('project_id', selected.project.id)
    run.then(({ data }) => { if (!cancelled) { setPanelBookings(data || []); setPanelLoading(false) } })
    return () => { cancelled = true }
  }, [selectedKey, selected?.legacy, selected?.legacyText, selected?.project?.id])

  function openPanel(key) {
    setSelectedKey(key)
    setEditing(false)
  }
  function closePanel() { setSelectedKey(null); setEditing(false) }

  function startEdit() {
    const p = selected.project
    setEditForm({
      project_number: p.project_number || '', name: p.name || '', client: p.client || '',
      start_date: p.start_date || '', end_date: p.end_date || '', project_leader: p.project_leader || '',
      color_index: p.color_index || 0, notes: p.notes || '',
      place: p.place || '', team: p.team || '', status: p.status || '', producer: p.producer || '', creative: p.creative || '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!editForm.name.trim()) { showToast('Prosjektet må ha et navn'); return }
    setSaving(true)
    const { error } = await supabase.from('projects').update({
      project_number: editForm.project_number.trim(),
      name: editForm.name.trim(),
      client: editForm.client.trim(),
      start_date: editForm.start_date || null,
      end_date: editForm.end_date || editForm.start_date || null,
      project_leader: editForm.project_leader.trim(),
      color_index: editForm.color_index,
      notes: editForm.notes,
      place: editForm.place.trim(), team: editForm.team.trim(), status: editForm.status.trim(),
      producer: editForm.producer.trim(), creative: editForm.creative.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', selected.project.id)
    // Oppdater visningsteksten på bookingene også, så kalenderen viser nytt navn
    if (!error) {
      await supabase.from('bookings').update({ project: projectLabel({ project_number: editForm.project_number.trim(), name: editForm.name.trim() }) }).eq('project_id', selected.project.id)
    }
    setSaving(false)
    if (error) { showToast('Kunne ikke lagre'); return }
    setEditing(false)
    showToast('Prosjekt oppdatert')
    onProjectsChanged(); onBookingsChanged(); loadMonth()
  }

  async function deleteProject() {
    if (!window.confirm('Slette prosjektet «' + selected.name + '»? Bookingene beholdes, men mister koblingen til prosjektet.')) return
    setSaving(true)
    const { error } = await supabase.from('projects').delete().eq('id', selected.project.id)
    setSaving(false)
    if (error) { showToast('Kunne ikke slette'); return }
    closePanel()
    showToast('Prosjekt slettet')
    onProjectsChanged(); loadMonth()
  }

  // Gjør en fritekst-gruppe til et ekte prosjekt og koble bookingene til det
  async function convertLegacy() {
    setSaving(true)
    const { data, error } = await supabase.from('projects').insert({
      name: selected.legacyText, start_date: selected.start, end_date: selected.end,
      project_leader: userName || '', color_index: projects.length % COLORS.length, created_by: userId,
    }).select().single()
    if (error || !data) { setSaving(false); showToast('Kunne ikke opprette prosjekt'); return }
    await supabase.from('bookings').update({ project_id: data.id, project: projectLabel(data) }).is('project_id', null).ilike('project', selected.legacyText)
    setSaving(false)
    showToast('Gjort til prosjekt')
    await onProjectsChanged(); await loadMonth(); onBookingsChanged()
    setSelectedKey(data.id)
  }

  // Grupper panel-bookinger per dag
  const panelByDay = useMemo(() => {
    const m = {}
    for (const b of panelBookings) (m[b.date] = m[b.date] || []).push(b)
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
  }, [panelBookings])
  const panelCrewCount = new Set(panelBookings.map(b => b.crew_id)).size

  const N = days.length
  const labelCol = 190

  return (
    <div>
      <div style={{ ...s.weekNav, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select style={{ ...s.select, fontWeight: 600 }} value={viewSel} onChange={e => setViewSel(e.target.value)}>
            <option value="cal">Kalender</option>
            {years.map(y => <option key={y} value={y}>Prosjekter {y}</option>)}
            <option value="done">Fullførte prosjekter</option>
          </select>
          {!isList && <>
          <div style={s.calModeToggle}>
            <button style={calMode === 'week' ? s.calModeBtnActive : s.calModeBtn} onClick={() => setCalMode('week')}>Uke</button>
            <button style={calMode === 'month' ? s.calModeBtnActive : s.calModeBtn} onClick={() => setCalMode('month')}>Måned</button>
          </div>
          <button style={s.navBtn} onClick={() => setOffset(o => o - 1)}>Forrige</button>
          {offset !== 0 && <button style={s.todayBtn} onClick={() => setOffset(0)}>I dag</button>}
          <span style={{ ...s.weekLabel, fontSize: 15, fontWeight: 600, color: '#1a1a18' }}>
            {calMode === 'week'
              ? days[0].toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }) + ' – ' + days[6].toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
              : capFirst(fmtMonth(days[0]))}
          </span>
          <button style={s.navBtn} onClick={() => setOffset(o => o + 1)}>Neste</button>
          </>}
          {isList && <span style={{ fontSize: 13, color: '#888' }}>{visibleRows.length} prosjekter</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input style={s.search} value={search} onChange={e => setSearch(e.target.value)} placeholder="Søk prosjekt, kunde, PL…" />
          {teams.length > 1 && (
            <select style={s.select} value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="">Alle team</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {!isList && <label style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} /> Vis avsluttede
          </label>}
        </div>
      </div>

      {isList && (
        <div style={{ ...s.tableWrap, border: '0.5px solid #e0dfd8', borderRadius: 12, background: '#fff' }}>
          <table style={{ ...s.table, minWidth: 720 }}>
            <thead><tr>
              <th style={{ ...s.th, textAlign: 'left' }}>Dato</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Nr.</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Prosjekt</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Kunde</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Team</th>
              <th style={{ ...s.th, textAlign: 'left' }}>PL</th>
              <th style={{ ...s.th, textAlign: 'left' }}>Status</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Crew</th>
            </tr></thead>
            <tbody>
              {visibleRows.length === 0 && <tr><td colSpan={8} style={s.empty}>Ingen prosjekter her.</td></tr>}
              {visibleRows.map(r => {
                const p = r.project
                const col = r.legacy ? { bg: '#E9E7E0', text: '#5a5952' } : COLORS[r.colorIndex % COLORS.length]
                const isSel = r.key === selectedKey
                return <tr key={r.key} onClick={() => openPanel(r.key)} style={{ cursor: 'pointer', background: isSel ? '#F0F6FF' : 'transparent' }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#FAFAF7' }} onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                  <td style={listCell}><span style={{ whiteSpace: 'nowrap' }}>{fmtRange(r.start, r.end)}</span></td>
                  <td style={{ ...listCell, color: '#888', fontSize: 12 }}>{p?.project_number || ''}</td>
                  <td style={{ ...listCell, fontWeight: 600 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: col.bg, border: '1px solid ' + col.text, marginRight: 8, verticalAlign: 'middle' }} />
                    {p ? p.name : r.name}
                  </td>
                  <td style={listCell}>{p?.client || ''}</td>
                  <td style={listCell}>{p?.team || ''}</td>
                  <td style={listCell}>{p?.project_leader || ''}</td>
                  <td style={listCell}>{p?.status ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: p.status === 'Confirmed' ? '#E1F5EE' : '#FAEEDA', color: p.status === 'Confirmed' ? '#0F6E56' : '#854F0B' }}>{p.status === 'Confirmed' ? 'Bekreftet' : p.status}</span> : (r.legacy ? <span style={{ fontSize: 11, color: '#999' }}>fritekst</span> : '')}</td>
                  <td style={{ ...listCell, textAlign: 'right', fontWeight: 600, color: r.count ? '#1a1a18' : '#bbb' }}>{r.count || '–'}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isList && <div style={{ ...s.tableWrap, border: '0.5px solid #e0dfd8', borderRadius: 12, background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `${labelCol}px repeat(${N}, minmax(${calMode === 'week' ? 90 : 28}px, 1fr))`, minWidth: labelCol + N * (calMode === 'week' ? 90 : 28) }}>
          {/* Header */}
          <div style={{ ...hdrCell, textAlign: 'left', paddingLeft: 12, position: 'sticky', left: 0, background: '#fff', zIndex: 2 }}>Prosjekt</div>
          {days.map(d => {
            const ds = dk(d); const dow = d.getDay(); const we = dow === 0 || dow === 6; const today = ds === todayStr
            return <div key={ds} style={{ ...hdrCell, ...(we ? { background: '#FAF8F4', color: '#A09A8E' } : {}), ...(today ? { color: '#1B3A78', fontWeight: 700, background: '#F0F6FF' } : {}) }}>
              {calMode === 'week' ? <div style={{ fontSize: 12, padding: '4px 0' }}>{fmtDay(d)}</div> : <>
                <div style={{ fontSize: 9, textTransform: 'uppercase' }}>{WEEKDAY_SHORT[dow]}</div>
                <div>{d.getDate()}</div>
              </>}
            </div>
          })}

          {visibleRows.length === 0 && (
            <div style={{ gridColumn: `1 / ${N + 2}`, ...s.empty }}>Ingen prosjekter i denne {calMode === 'week' ? 'uken' : 'måneden'}. Prosjekter fra Qondor og bookinger vises her.</div>
          )}

          {visibleRows.map((r, i) => {
            const startIdx = Math.max(0, days.findIndex(d => dk(d) === r.start))
            const endIdxRaw = days.findIndex(d => dk(d) === r.end)
            const endIdx = endIdxRaw === -1 ? (r.end > monthEnd ? N - 1 : startIdx) : endIdxRaw
            const clippedLeft = r.start < monthStart, clippedRight = r.end > monthEnd
            const col = r.legacy ? { bg: '#E9E7E0', text: '#5a5952' } : COLORS[r.colorIndex % COLORS.length]
            const isSel = r.key === selectedKey
            const row = i + 2
            return <>
              <div key={r.key + '_l'} onClick={() => openPanel(r.key)} style={{ gridRow: row, gridColumn: 1, ...labelCell, position: 'sticky', left: 0, background: isSel ? '#F0F6FF' : '#fff', zIndex: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.legacy ? '#bbb' : col.bg, border: '1px solid ' + (r.legacy ? '#999' : col.text), display: 'inline-block', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</span>
              </div>
              {days.map((d, di) => {
                const dow = d.getDay(); const we = dow === 0 || dow === 6
                return <div key={r.key + '_' + di} style={{ gridRow: row, gridColumn: di + 2, borderBottom: '0.5px solid #f0efe9', borderLeft: '0.5px solid #f0efe9', background: we ? '#FBFAF6' : (isSel ? '#F7FAFF' : 'transparent'), minHeight: 40 }} />
              })}
              <button key={r.key + '_bar'} onClick={() => openPanel(r.key)} title={r.name + ' · ' + r.count + ' crew'} style={{
                gridRow: row, gridColumn: `${startIdx + 2} / ${endIdx + 3}`, alignSelf: 'center', margin: '0 2px', height: calMode === 'week' ? 32 : 26,
                background: r.pending ? 'transparent' : col.bg, color: col.text,
                border: isSel ? '2px solid ' + col.text : (r.pending ? '1.5px dashed ' + col.text : 'none'),
                opacity: r.pending && !isSel ? 0.85 : 1,
                borderRadius: clippedLeft && clippedRight ? 0 : clippedLeft ? '0 13px 13px 0' : clippedRight ? '13px 0 0 13px' : 13,
                fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: '0 10px',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', zIndex: 1,
              }}>
                {r.name}{r.count > 0 && <span style={{ opacity: 0.7, fontWeight: 500 }}> · {r.count} crew</span>}{r.pending && <span style={{ opacity: 0.6, fontWeight: 500 }}> · pending</span>}
              </button>
            </>
          })}
        </div>
      </div>}
      {!isList && <div style={{ ...s.legend, marginTop: 10 }}>
        <span style={s.legendItem}><span style={{ ...s.dot, background: 'transparent', border: '1.5px dashed #1B3A78' }} />Stiplet = Pending i Qondor</span>
        <span style={s.legendItem}><span style={{ ...s.dot, background: '#E9E7E0', border: '1px solid #999' }} />Grå = fritekst-prosjekt (ikke i prosjektlisten enda)</span>
      </div>}

      {/* Sidepanel */}
      {selected && (
        <>
          <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 90 }} />
          <aside style={panel}>
            <button style={s.closeBtn} onClick={closePanel}>×</button>
            {(() => {
              const p = selected.project
              const col = selected.legacy ? { bg: '#E9E7E0', text: '#5a5952' } : COLORS[selected.colorIndex % COLORS.length]
              return <>
                <div style={{ height: 6, borderRadius: 3, background: col.bg, border: '1px solid ' + col.text, marginBottom: 14, width: 60 }} />
                {!editing ? (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a18', lineHeight: 1.3, paddingRight: 24 }}>{p ? p.name : selected.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      {p?.project_number && <span>Nr. {p.project_number}</span>}
                      {p?.client && <span>{p.client}</span>}
                      {p?.team && <span>Team {p.team}</span>}
                      {p?.status && <span style={{ padding: '1px 8px', borderRadius: 10, fontWeight: 600, background: p.status === 'Confirmed' ? '#E1F5EE' : '#FAEEDA', color: p.status === 'Confirmed' ? '#0F6E56' : '#854F0B' }}>{p.status === 'Confirmed' ? 'Bekreftet' : p.status}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#1a1a18', marginTop: 8 }}>{fmtRange(p ? (p.start_date || selected.start) : selected.start, p ? (p.end_date || selected.end) : selected.end)}{p?.place ? <span style={{ color: '#888' }}> · {p.place}</span> : null}</div>
                    {p && (p.project_leader || p.producer || p.creative) && (
                      <div style={{ fontSize: 12, color: '#666', marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
                        {p.project_leader && <><span style={{ color: '#999' }}>Prosjektleder</span><span>{p.project_leader}</span></>}
                        {p.producer && <><span style={{ color: '#999' }}>Produsent</span><span>{p.producer}</span></>}
                        {p.creative && <><span style={{ color: '#999' }}>Kreativ</span><span>{p.creative}</span></>}
                      </div>
                    )}
                    {p?.source === 'qondor' && <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>Fra Qondor-prosjektlisten</div>}
                    {p?.notes && <p style={{ fontSize: 13, color: '#666', marginTop: 8, whiteSpace: 'pre-wrap' }}>{p.notes}</p>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                      {p && <button style={s.miniBtn} onClick={startEdit}>Rediger prosjekt</button>}
                      {p && <button style={{ ...s.miniBtn, color: '#A32D2D' }} onClick={deleteProject} disabled={saving}>Slett</button>}
                      {selected.legacy && <button style={{ ...s.miniBtn, background: '#1B3A78', color: '#fff', border: 'none' }} onClick={convertLegacy} disabled={saving}>{saving ? 'Lagrer…' : 'Gjør til prosjekt i lista'}</button>}
                    </div>
                    {selected.legacy && <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>Dette er et fritekst-navn fra bookinger. Gjør det til et prosjekt for å få datoer, kunde og Qondor-nummer.</p>}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 6 }}>
                      <div><label style={s.formLabel}>Qondor-nr</label><input style={s.formInput} value={editForm.project_number} onChange={e => setEditForm(f => ({ ...f, project_number: e.target.value }))} /></div>
                      <div><label style={s.formLabel}>Navn *</label><input style={s.formInput} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
                    </div>
                    <div><label style={s.formLabel}>Kunde</label><input style={s.formInput} value={editForm.client} onChange={e => setEditForm(f => ({ ...f, client: e.target.value }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div><label style={s.formLabel}>Sted</label><input style={s.formInput} value={editForm.place} onChange={e => setEditForm(f => ({ ...f, place: e.target.value }))} /></div>
                      <div><label style={s.formLabel}>Team</label><input style={s.formInput} value={editForm.team} onChange={e => setEditForm(f => ({ ...f, team: e.target.value }))} placeholder="Oslo / Trondheim / Bergen" /></div>
                    </div>
                    <div><label style={s.formLabel}>Status</label>
                      <select style={s.formInput} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="">—</option><option value="Confirmed">Confirmed</option><option value="Pending">Pending</option>
                      </select>
                    </div>
                    <div><label style={s.formLabel}>Prosjektleder</label><input style={s.formInput} value={editForm.project_leader} onChange={e => setEditForm(f => ({ ...f, project_leader: e.target.value }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div><label style={s.formLabel}>Produsent</label><input style={s.formInput} value={editForm.producer} onChange={e => setEditForm(f => ({ ...f, producer: e.target.value }))} /></div>
                      <div><label style={s.formLabel}>Kreativ</label><input style={s.formInput} value={editForm.creative} onChange={e => setEditForm(f => ({ ...f, creative: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div><label style={s.formLabel}>Fra</label><input style={s.formInput} type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                      <div><label style={s.formLabel}>Til</label><input style={s.formInput} type="date" value={editForm.end_date} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} /></div>
                    </div>
                    <div>
                      <label style={s.formLabel}>Farge</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {COLORS.map((c, i) => <div key={i} onClick={() => setEditForm(f => ({ ...f, color_index: i }))} style={{ width: 22, height: 22, borderRadius: '50%', background: c.bg, cursor: 'pointer', border: editForm.color_index === i ? '2px solid #1a1a18' : '2px solid transparent' }} />)}
                      </div>
                    </div>
                    <div><label style={s.formLabel}>Notat</label><textarea style={{ ...s.formInput, resize: 'vertical' }} rows={2} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...s.miniBtn, background: '#1B3A78', color: '#fff', border: 'none' }} onClick={saveEdit} disabled={saving}>{saving ? 'Lagrer…' : 'Lagre'}</button>
                      <button style={s.clearBtn} onClick={() => setEditing(false)}>Avbryt</button>
                    </div>
                  </div>
                )}

                <div style={{ ...s.msec, marginTop: 18 }}>
                  <div style={s.msecHdr}>Crew ({panelCrewCount})</div>
                  {panelLoading && <p style={{ fontSize: 13, color: '#aaa' }}>Laster…</p>}
                  {!panelLoading && panelByDay.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>Ingen crew booket på dette prosjektet enda.</p>}
                  {panelByDay.map(([date, list]) => (
                    <div key={date} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: date === todayStr ? '#1B3A78' : '#666', marginBottom: 4 }}>{fmtDateLong(date)}</div>
                      {list.map(b => {
                        const c = crewById[b.crew_id]
                        if (!c) return null
                        const cc = COLORS[c.color_index % COLORS.length]
                        const st = STATUS[b.status]
                        return <div key={b.id} onClick={() => openProfile(c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 8, cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F5F4F0'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div style={{ ...s.avatar, width: 26, height: 26, fontSize: 10, background: cc.bg, color: cc.text }}>{c.initials}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                            {(c.phone || b.booked_by) && <div style={{ fontSize: 11, color: '#999' }}>{[c.phone, b.booked_by ? 'booket av ' + b.booked_by : ''].filter(Boolean).join(' · ')}</div>}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.c }}>{st.short}</span>
                        </div>
                      })}
                    </div>
                  ))}
                </div>
              </>
            })()}
          </aside>
        </>
      )}
    </div>
  )
}

const listCell = { padding: '9px 10px', borderBottom: '0.5px solid #f0efe9', fontSize: 13, color: '#1a1a18', verticalAlign: 'middle' }
const hdrCell = { padding: '6px 2px', fontSize: 11, fontWeight: 500, color: '#888', textAlign: 'center', borderBottom: '0.5px solid #e0dfd8', lineHeight: 1.2 }
const labelCell = { display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', fontSize: 13, fontWeight: 500, color: '#1a1a18', borderBottom: '0.5px solid #f0efe9', borderRight: '0.5px solid #e0dfd8', cursor: 'pointer', minHeight: 40 }
const panel = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '92vw', background: '#fff', zIndex: 100,
  boxShadow: '-12px 0 40px rgba(26,27,46,0.18)', padding: '1.5rem 1.25rem', overflowY: 'auto',
  fontFamily: "'Avenir Next','Avenir','Century Gothic','Nunito','system-ui',sans-serif", color: '#1a1a18',
  animation: 'zSlideIn .18s ease-out',
}
