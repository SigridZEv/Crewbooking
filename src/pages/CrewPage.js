import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { COLORS, ALLERGIES, STATUS } from '../lib/constants'
import { getMonthDates, fmtMonth, dk } from '../lib/dateUtils'
import { s } from '../lib/styles'

// Siden crew-medlemmer ser når de logger inn.
// Databasen (RLS) sørger for at de kun får tak i egne data — denne siden
// viser bare det som er relevant for dem: egne jobber, egen tilgjengelighet
// og egne kontaktopplysninger. Timepris, referanser og interne notater vises ikke.

const WEEKDAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']

function fmtLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const txt = d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

function allergyFromSkills(skills) {
  const sk = (skills || []).find(x => x.name.startsWith('Allergi:'))
  return sk ? sk.name.replace(/^Allergi:\s*/, '').trim() : ''
}

export default function CrewPage({ user, initialCrew }) {
  const [crew, setCrew] = useState(initialCrew)
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [monthOffset, setMonthOffset] = useState(0)
  const [showPast, setShowPast] = useState(false)
  const [toast, setToast] = useState('')
  const [busyDate, setBusyDate] = useState(null)
  const [saving, setSaving] = useState(false)

  // Kontaktskjema — lokalt til «Lagre» trykkes
  const [form, setForm] = useState({
    phone: initialCrew.phone || '',
    email: initialCrew.email || user.email || '',
    location: initialCrew.location || '',
    allergy: allergyFromSkills(initialCrew.skills),
  })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true)
    const { data } = await supabase.from('bookings').select('*').eq('crew_id', crew.id).order('date', { ascending: true })
    setBookings(data || [])
    setLoadingBookings(false)
  }, [crew.id])

  useEffect(() => { loadBookings() }, [loadBookings])

  async function logout() { await supabase.auth.signOut() }

  // ---------- Mine jobber ----------
  const todayStr = dk(new Date())
  const jobs = bookings.filter(b => b.status === 'booked' || b.status === 'requested')
  const upcoming = jobs.filter(b => b.date >= todayStr)
  const past = jobs.filter(b => b.date < todayStr).reverse()

  // ---------- Tilgjengelighet ----------
  const days = getMonthDates(monthOffset)
  const byDate = Object.fromEntries(bookings.map(b => [b.date, b]))
  // Tomme celler før den 1. slik at uken starter på mandag
  const firstDow = days[0].getDay() // 0 = søndag
  const leadingBlanks = firstDow === 0 ? 6 : firstDow - 1

  async function toggleUnavailable(dateStr) {
    const existing = byDate[dateStr]
    if (existing && (existing.status === 'booked' || existing.status === 'requested')) {
      showToast('Denne dagen er satt av Z Event og kan ikke endres her')
      return
    }
    if (dateStr < todayStr) return
    setBusyDate(dateStr)
    if (existing && existing.status === 'unavailable') {
      // Tilbake til ledig
      const { error } = await supabase.from('bookings').delete().eq('id', existing.id)
      if (error) showToast('Noe gikk galt — prøv igjen')
      else setBookings(prev => prev.filter(b => b.id !== existing.id))
    } else if (existing) {
      // En 'free'-rad finnes fra før → oppdater til unavailable
      const { data, error } = await supabase.from('bookings').update({ status: 'unavailable' }).eq('id', existing.id).select().single()
      if (error) showToast('Noe gikk galt — prøv igjen')
      else setBookings(prev => prev.map(b => b.id === existing.id ? data : b))
    } else {
      const { data, error } = await supabase.from('bookings').insert({ crew_id: crew.id, date: dateStr, status: 'unavailable', project: '', booked_by: '' }).select().single()
      if (error) showToast('Noe gikk galt — prøv igjen')
      else setBookings(prev => [...prev, data])
    }
    setBusyDate(null)
  }

  // ---------- Mine opplysninger ----------
  const formDirty =
    form.phone !== (crew.phone || '') ||
    form.email !== (crew.email || '') ||
    form.location !== (crew.location || '') ||
    form.allergy.trim() !== allergyFromSkills(crew.skills)

  async function saveForm() {
    setSaving(true)
    const { data: updated, error } = await supabase.from('crew')
      .update({ phone: form.phone.trim(), email: form.email.trim(), location: form.location.trim() })
      .eq('id', crew.id).select().single()
    if (error) { showToast('Kunne ikke lagre — prøv igjen'); setSaving(false); return }

    // Allergi lagres som en egen rad i skills med prefiks «Allergi: »
    const existing = (crew.skills || []).find(x => x.name.startsWith('Allergi:'))
    const text = form.allergy.trim()
    let skills = crew.skills || []
    if (existing && text) {
      const { data } = await supabase.from('skills').update({ name: 'Allergi: ' + text }).eq('id', existing.id).select().single()
      if (data) skills = skills.map(x => x.id === existing.id ? data : x)
    } else if (existing && !text) {
      await supabase.from('skills').delete().eq('id', existing.id)
      skills = skills.filter(x => x.id !== existing.id)
    } else if (!existing && text) {
      const { data } = await supabase.from('skills').insert({ crew_id: crew.id, name: 'Allergi: ' + text, comment: '' }).select().single()
      if (data) skills = [...skills, data]
    }

    setCrew({ ...crew, ...updated, skills })
    setSaving(false)
    showToast('Opplysningene er lagret')
  }

  function toggleAllergyChip(a) {
    if (a === 'Ingen') { setForm(f => ({ ...f, allergy: '' })); return }
    const parts = form.allergy.split(',').map(x => x.trim()).filter(Boolean)
    const next = parts.includes(a) ? parts.filter(x => x !== a) : [...parts, a]
    setForm(f => ({ ...f, allergy: next.join(', ') }))
  }

  const col = COLORS[(crew.color_index || 0) % COLORS.length]
  const selectedAllergies = form.allergy.split(',').map(x => x.trim()).filter(Boolean)

  return (
    <div style={{ ...s.page, maxWidth: 760 }}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <img src="/Z_logo.png" alt="Z Event" style={s.brandLogo} />
          <div>
            <span style={s.brand}>Z Event</span>
            <h1 style={s.title}>Crew Portal</h1>
          </div>
        </div>
        <div style={s.headerRight}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ ...s.avatar, background: col.bg, color: col.text }}>{crew.initials}</div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{crew.name}</span>
          </div>
          <button style={s.logoutBtn} onClick={logout}>Logg ut</button>
        </div>
      </div>

      {/* Mine jobber */}
      <section style={card}>
        <div style={cardHdr}>Mine jobber</div>
        {loadingBookings ? (
          <p style={muted}>Laster…</p>
        ) : upcoming.length === 0 ? (
          <p style={muted}>Ingen kommende jobber registrert enda.</p>
        ) : (
          upcoming.map(b => <JobRow key={b.id} b={b} />)
        )}
        {past.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <button style={s.clearBtn} onClick={() => setShowPast(v => !v)}>
              {showPast ? 'Skjul tidligere jobber' : `Vis tidligere jobber (${past.length})`}
            </button>
            {showPast && past.map(b => <JobRow key={b.id} b={b} past />)}
          </div>
        )}
      </section>

      {/* Tilgjengelighet */}
      <section style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={cardHdr}>Min tilgjengelighet</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={s.navBtn} onClick={() => setMonthOffset(m => m - 1)}>‹</button>
            {monthOffset !== 0 && <button style={s.todayBtn} onClick={() => setMonthOffset(0)}>I dag</button>}
            <span style={{ ...s.weekLabel, minWidth: 120, textAlign: 'center' }}>{fmtMonth(days[0]).charAt(0).toUpperCase() + fmtMonth(days[0]).slice(1)}</span>
            <button style={s.navBtn} onClick={() => setMonthOffset(m => m + 1)}>›</button>
          </div>
        </div>
        <p style={{ ...muted, marginTop: 4 }}>
          Trykk på en ledig dag for å markere at du <strong>ikke</strong> er tilgjengelig. Trykk igjen for å angre.
          Dager Z Event har booket eller forespurt kan ikke endres her.
        </p>
        <div style={grid7}>
          {WEEKDAYS.map(w => <div key={w} style={gridHead}>{w}</div>)}
          {Array.from({ length: leadingBlanks }).map((_, i) => <div key={'b' + i} />)}
          {days.map(d => {
            const dateStr = dk(d)
            const b = byDate[dateStr]
            const st = b ? b.status : 'free'
            const cfg = STATUS[st]
            const locked = st === 'booked' || st === 'requested'
            const isPast = dateStr < todayStr
            const isToday = dateStr === todayStr
            const dow = d.getDay()
            const weekend = dow === 0 || dow === 6
            return (
              <button
                key={dateStr}
                disabled={isPast || busyDate === dateStr}
                onClick={() => toggleUnavailable(dateStr)}
                title={locked ? `${cfg.full}${b.project ? ' — ' + b.project : ''}` : (st === 'unavailable' ? 'Trykk for å bli ledig igjen' : 'Trykk for å markere som ikke tilgjengelig')}
                style={{
                  ...dayBtn,
                  background: cfg.bg,
                  color: cfg.c,
                  opacity: isPast ? 0.4 : 1,
                  cursor: isPast ? 'default' : (locked ? 'not-allowed' : 'pointer'),
                  outline: isToday ? '2px solid #1B3A78' : 'none',
                  outlineOffset: -2,
                  fontWeight: weekend ? 400 : 600,
                }}
              >
                <span style={{ fontSize: 13 }}>{d.getDate()}</span>
                <span style={{ fontSize: 9, lineHeight: 1.1, marginTop: 2, textAlign: 'center' }}>
                  {locked ? (b.project ? b.project : cfg.short) : (st === 'unavailable' ? 'Borte' : '')}
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ ...s.legend, marginTop: 12, marginBottom: 0 }}>
          {Object.entries(STATUS).map(([k, v]) => <span key={k} style={s.legendItem}><span style={{ ...s.dot, background: v.bg, border: '1px solid ' + v.c }} />{v.full}</span>)}
        </div>
      </section>

      {/* Mine opplysninger */}
      <section style={card}>
        <div style={cardHdr}>Mine opplysninger</div>
        <p style={muted}>Hold disse oppdatert så Z Event alltid får tak i deg og vet hva du kan spise.</p>
        <div style={s.formRow2}>
          <div><label style={s.formLabel}>Telefon</label><input style={s.formInput} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="99 99 99 99" /></div>
          <div><label style={s.formLabel}>E-post</label><input style={s.formInput} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="navn@eksempel.no" /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.formLabel}>Bosted</label>
          <input style={s.formInput} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="f.eks. Oslo" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.formLabel}>Allergi / kosthold</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {ALLERGIES.map(a => {
              const active = a === 'Ingen' ? selectedAllergies.length === 0 : selectedAllergies.includes(a)
              return (
                <button key={a} type="button" onClick={() => toggleAllergyChip(a)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                    border: '1px solid ' + (active ? '#1B3A78' : '#C7D0F0'),
                    background: active ? '#1B3A78' : '#EEF2FF', color: active ? '#fff' : '#3B5BDB' }}>
                  {a}
                </button>
              )
            })}
          </div>
          <input style={s.formInput} value={form.allergy} onChange={e => setForm(f => ({ ...f, allergy: e.target.value }))} placeholder="Eller skriv fritt, f.eks. «Vegetar, nøtter»" />
        </div>
        <button style={{ ...s.submitBtn, opacity: formDirty ? 1 : 0.5, cursor: formDirty ? 'pointer' : 'default' }} disabled={!formDirty || saving} onClick={saveForm}>
          {saving ? 'Lagrer…' : 'Lagre opplysninger'}
        </button>
      </section>

      <p style={{ ...muted, textAlign: 'center', marginTop: 24 }}>
        Er noe feil i profilen din, eller mangler en jobb? Ta kontakt med Z Event.
      </p>

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}

function JobRow({ b, past }) {
  const cfg = STATUS[b.status]
  return (
    <div style={{ ...s.bookingRow, padding: '10px 0', opacity: past ? 0.7 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a18' }}>{b.project || 'Uten prosjektnavn'}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{fmtLong(b.date)}{b.booked_by ? ` · booket av ${b.booked_by}` : ''}</div>
      </div>
      <span style={{ ...s.pill, background: cfg.bg, color: cfg.c, cursor: 'default', minWidth: 0 }}>{cfg.short}</span>
    </div>
  )
}

// Lokale stiler for denne siden
const card = { background: '#fff', borderRadius: 14, border: '0.5px solid #e0dfd8', padding: '1.25rem 1.25rem 1.5rem', marginBottom: 16 }
const cardHdr = { ...s.msecHdr, marginBottom: 8 }
const muted = { fontSize: 13, color: '#888', lineHeight: 1.55, margin: '0 0 12px' }
const grid7 = { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }
const gridHead = { fontSize: 11, color: '#888', textAlign: 'center', padding: '4px 0', fontWeight: 500 }
const dayBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 8, border: 'none', padding: '4px 2px', fontFamily: 'inherit', overflow: 'hidden' }
