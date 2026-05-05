import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = [
  { bg: '#B5D4F4', text: '#0C447C' },
  { bg: '#9FE1CB', text: '#085041' },
  { bg: '#FAC775', text: '#633806' },
  { bg: '#F4C0D1', text: '#72243E' },
  { bg: '#CECBF6', text: '#3C3489' },
  { bg: '#D3D1C7', text: '#2C2C2A' },
  { bg: '#C0DD97', text: '#27500A' },
  { bg: '#F5C4B3', text: '#712B13' },
]

const STATUS = {
  free:        { label: 'L', full: 'Ledig',             bg: '#E1F5EE', c: '#0F6E56' },
  booked:      { label: 'B', full: 'Booket',            bg: '#FCEBEB', c: '#A32D2D' },
  requested:   { label: 'F', full: 'Forespurt',         bg: '#FAEEDA', c: '#854F0B' },
  unavailable: { label: '-', full: 'Ikke tilgjengelig', bg: '#F1EFE8', c: '#888780' },
}

function getWeekDates(offset) {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function fmtDay(d) {
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function dk(d) {
  return d.toISOString().slice(0, 10)
}

export default function BookingPage({ user }) {
  const [view, setView] = useState('cal')
  const [crew, setCrew] = useState([])
  const [bookings, setBookings] = useState({})
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchCal, setSearchCal] = useState('')
  const [filterAvail, setFilterAvail] = useState('')
  const [searchCrew, setSearchCrew] = useState('')
  const [profileOpen, setProfileOpen] = useState(null)
  const [changeTarget, setChangeTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [newSkillInput, setNewSkillInput] = useState('')
  const [editingComment, setEditingComment] = useState(null)
  const [addForm, setAddForm] = useState({ first: '', last: '', rate: '', jobs: '', bio: '', skills: '', colorIndex: 0 })
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [projectInput, setProjectInput] = useState('')
  const [bookedByInput, setBookedByInput] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadCrew = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('crew').select('*, skills(*)').order('name')
    if (data) setCrew(data)
    setLoading(false)
  }, [])

  const loadBookings = useCallback(async () => {
    const days = getWeekDates(weekOffset)
    const { data } = await supabase.from('bookings').select('*').gte('date', dk(days[0])).lte('date', dk(days[6]))
    if (data) {
      const map = {}
      data.forEach(b => { map[b.crew_id + '_' + b.date] = b })
      setBookings(map)
    }
  }, [weekOffset])

  useEffect(() => { loadCrew() }, [loadCrew])
  useEffect(() => { loadBookings() }, [loadBookings])

  function getBooking(crewId, date) { return bookings[crewId + '_' + date] || null }

  function getStatus(crewId, date) {
    const b = getBooking(crewId, date)
    if (b) return b.status
    const seed = (crewId.charCodeAt(0) * 37 + parseInt(date.replace(/-/g, '').slice(-4))) % 7
    if (seed < 2) return 'booked'
    if (seed === 2) return 'requested'
    if (seed === 5) return 'unavailable'
    return 'free'
  }

  function openChange(c, date, dateLabel) {
    setChangeTarget({ crew: c, date, dateLabel })
    setPendingStatus(null)
    setProjectInput('')
    setBookedByInput('')
  }

  async function confirmStatus() {
    if (!changeTarget || !pendingStatus) return
    const { crew: c, date } = changeTarget
    setSaving(true)
    const payload = { crew_id: c.id, date, status: pendingStatus, project: projectInput.trim(), booked_by: bookedByInput.trim() }
    await supabase.from('bookings').upsert(payload, { onConflict: 'crew_id,date' })
    setBookings(prev => ({ ...prev, [c.id + '_' + date]: payload }))
    setChangeTarget(null)
    setPendingStatus(null)
    setSaving(false)
    showToast('Status oppdatert: ' + STATUS[pendingStatus].full)
  }

  async function saveSimpleStatus(status) {
    if (!changeTarget) return
    const { crew: c, date } = changeTarget
    setSaving(true)
    const payload = { crew_id: c.id, date, status, project: '', booked_by: '' }
    await supabase.from('bookings').upsert(payload, { onConflict: 'crew_id,date' })
    setBookings(prev => ({ ...prev, [c.id + '_' + date]: payload }))
    setChangeTarget(null)
    setSaving(false)
    showToast('Status oppdatert: ' + STATUS[status].full)
  }

  async function addCrew() {
    const { first, last, rate, jobs, bio, skills: skillsRaw, colorIndex } = addForm
    if (!first || !last || !rate) { setAddError('Fyll ut alle obligatoriske felt.'); return }
    setAddError(''); setSaving(true)
    const { data: newCrew, error } = await supabase.from('crew').insert({ name: first + ' ' + last, initials: (first[0] + last[0]).toUpperCase(), rate: parseInt(rate), jobs: parseInt(jobs) || 0, bio, color_index: colorIndex }).select().single()
    if (error || !newCrew) { setAddError('Noe gikk galt.'); setSaving(false); return }
    if (skillsRaw.trim()) await supabase.from('skills').insert(skillsRaw.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ crew_id: newCrew.id, name: s, comment: '' })))
    await loadCrew()
    setAddOpen(false)
    setAddForm({ first: '', last: '', rate: '', jobs: '', bio: '', skills: '', colorIndex: 0 })
    setSaving(false)
    showToast(first + ' ' + last + ' er lagt til!')
  }

  async function addSkill() {
    if (!newSkillInput.trim() || !profileOpen) return
    const { data } = await supabase.from('skills').insert({ crew_id: profileOpen.id, name: newSkillInput.trim(), comment: '' }).select().single()
    if (data) {
      setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, skills: [...(c.skills || []), data] } : c))
      setProfileOpen(prev => ({ ...prev, skills: [...(prev.skills || []), data] }))
      setNewSkillInput('')
    }
  }

  async function deleteSkill(skillId) {
    await supabase.from('skills').delete().eq('id', skillId)
    setCrew(prev => prev.map(c => ({ ...c, skills: (c.skills || []).filter(s => s.id !== skillId) })))
    setProfileOpen(prev => ({ ...prev, skills: (prev.skills || []).filter(s => s.id !== skillId) }))
  }

  async function saveComment(skillId, comment) {
    await supabase.from('skills').update({ comment }).eq('id', skillId)
    setCrew(prev => prev.map(c => ({ ...c, skills: (c.skills || []).map(s => s.id === skillId ? { ...s, comment } : s) })))
    setProfileOpen(prev => ({ ...prev, skills: (prev.skills || []).map(s => s.id === skillId ? { ...s, comment } : s) }))
    setEditingComment(null)
  }

  async function logout() { await supabase.auth.signOut() }

  const days = getWeekDates(weekOffset)
  const filteredCal = crew.filter(c => {
    if (searchCal && !c.name.toLowerCase().includes(searchCal.toLowerCase())) return false
    if (filterAvail && !days.some(d => getStatus(c.id, dk(d)) === filterAvail)) return false
    return true
  })
  const filteredCrew = crew.filter(c => {
    if (!searchCrew) return true
    const q = searchCrew.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.skills || []).some(s => s.name.toLowerCase().includes(q))
  })

  if (loading) return <div style={s.loading}>Laster...</div>

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div><span style={s.brand}>Z Event</span><h1 style={s.title}>Crew booking</h1></div>
        <div style={s.headerRight}>
          <button style={s.addBtn} onClick={() => setAddOpen(true)}>+ Legg til crew</button>
          <div style={s.tabs}>
            <button style={{...s.tab, ...(view==='cal'?s.tabActive:{})}} onClick={() => setView('cal')}>Kalender</button>
            <button style={{...s.tab, ...(view==='crew'?s.tabActive:{})}} onClick={() => setView('crew')}>Crew</button>
          </div>
          <button style={s.logoutBtn} onClick={logout}>Logg ut</button>
        </div>
      </div>

      {view === 'cal' && (
        <div>
          <div style={s.filterBar}>
            <select style={s.select} value={filterAvail} onChange={e => setFilterAvail(e.target.value)}>
              <option value="">Alle statuser</option>
              <option value="free">Ledig</option>
              <option value="booked">Booket</option>
              <option value="requested">Forespurt</option>
              <option value="unavailable">Ikke tilgjengelig</option>
            </select>
            <input style={s.search} value={searchCal} onChange={e => setSearchCal(e.target.value)} placeholder="Sok navn..." />
            <button style={s.clearBtn} onClick={() => { setSearchCal(''); setFilterAvail('') }}>Nullstill</button>
          </div>
          <div style={s.weekNav}>
            <button style={s.navBtn} onClick={() => setWeekOffset(w => w-1)}>Forrige</button>
            <span style={s.weekLabel}>{days[0].toLocaleDateString('nb-NO',{day:'numeric',month:'long'})} - {days[6].toLocaleDateString('nb-NO',{day:'numeric',month:'long',year:'numeric'})}</span>
            <button style={s.navBtn} onClick={() => setWeekOffset(w => w+1)}>Neste</button>
          </div>
          <div style={s.legend}>
            {Object.entries(STATUS).map(([k,v]) => <span key={k} style={s.legendItem}><span style={{...s.dot,background:v.bg,border:'1px solid '+v.c}}/>{v.full}</span>)}
          </div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr>
                <th style={{...s.th,textAlign:'left',minWidth:150}}>Crew</th>
                {days.map(d => <th key={dk(d)} style={s.th}>{fmtDay(d)}</th>)}
              </tr></thead>
              <tbody>
                {filteredCal.length === 0 && <tr><td colSpan={8} style={s.empty}>Ingen crew matcher filteret.</td></tr>}
                {filteredCal.map(c => {
                  const col = COLORS[c.color_index % COLORS.length]
                  return <tr key={c.id}>
                    <td style={s.crewCell}>
                      <div style={s.crewInfo} onClick={() => setProfileOpen(c)}>
                        <div style={{...s.avatar,background:col.bg,color:col.text}}>{c.initials}</div>
                        <span style={s.crewName}>{c.name}</span>
                      </div>
                    </td>
                    {days.map(d => {
                      const date = dk(d)
                      const st = getStatus(c.id, date)
                      const cfg = STATUS[st]
                      const booking = getBooking(c.id, date)
                      return <td key={date} style={s.dayCell}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                          <button style={{...s.pill,background:cfg.bg,color:cfg.c}}
                            title={booking && booking.project ? cfg.full + ' - ' + booking.project + (booking.booked_by ? ' (av ' + booking.booked_by + ')' : '') : cfg.full}
                            onClick={() => openChange(c, date, fmtDay(d))}>{cfg.label}</button>
                          {booking && booking.project && <span style={s.projectLabel}>{booking.project.length > 8 ? booking.project.slice(0,7)+'...' : booking.project}</span>}
                        </div>
                      </td>
                    })}
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'crew' && (
        <div>
          <div style={s.filterBar}>
            <input style={s.search} value={searchCrew} onChange={e => setSearchCrew(e.target.value)} placeholder="Sok navn eller ferdighet..." />
            <button style={s.clearBtn} onClick={() => setSearchCrew('')}>Nullstill</button>
          </div>
          <div style={s.crewGrid}>
            {filteredCrew.map(c => {
              const col = COLORS[c.color_index % COLORS.length]
              const skills = c.skills || []
              return <div key={c.id} style={s.crewCard} onClick={() => setProfileOpen(c)}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <div style={{...s.avatar,width:40,height:40,background:col.bg,color:col.text}}>{c.initials}</div>
                  <div style={s.crewName}>{c.name}</div>
                </div>
                <div style={s.rate}>{c.rate} kr<span style={s.rateUnit}>/t</span></div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:10}}>
                  {skills.slice(0,3).map(sk => <span key={sk.id} style={s.skillTag}>{sk.name}</span>)}
                  {skills.length > 3 && <span style={{fontSize:11,color:'#888',padding:'3px 4px'}}>+{skills.length-3}</span>}
                </div>
              </div>
            })}
          </div>
        </div>
      )}

      {profileOpen && (
        <div style={s.overlay} onClick={() => setProfileOpen(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setProfileOpen(null)}>X</button>
            {(() => {
              const c = profileOpen
              const col = COLORS[c.color_index % COLORS.length]
              const freeDays = days.filter(d => getStatus(c.id, dk(d)) === 'free').length
              const skills = c.skills || []
              const weekBookings = days.map(d => ({day: fmtDay(d), b: getBooking(c.id, dk(d))})).filter(x => x.b && x.b.status === 'booked' && x.b.project)
              return <>
                <div style={{...s.modalAvatar,background:col.bg,color:col.text}}>{c.initials}</div>
                <div style={{fontSize:18,fontWeight:500,color:'#1a1a18',marginBottom:2}}>{c.name}</div>
                <div style={{display:'flex',alignItems:'baseline',gap:4,margin:'6px 0 1rem'}}>
                  <span style={s.rate}>{c.rate} kr</span><span style={s.rateUnit}>/ time</span>
                </div>
                <div style={s.statsGrid}>
                  <div style={s.statCard}><div style={s.statLabel}>Ledige dager (uke)</div><div style={s.statVal}>{freeDays} av 7</div></div>
                  <div style={s.statCard}><div style={s.statLabel}>Gjennomforte jobber</div><div style={s.statVal}>{c.jobs}</div></div>
                </div>
                {weekBookings.length > 0 && <div style={s.msec}>
                  <div style={s.msecHdr}>Bookinger denne uken</div>
                  {weekBookings.map((x,i) => <div key={i} style={s.bookingRow}>
                    <span style={s.bookingDay}>{x.day}</span>
                    <span style={s.bookingProject}>{x.b.project}</span>
                    {x.b.booked_by && <span style={s.bookingBy}>av {x.b.booked_by}</span>}
                  </div>)}
                </div>}
                <div style={s.msec}><div style={s.msecHdr}>Om</div><p style={{fontSize:13,color:'#666',lineHeight:1.6}}>{c.bio || '-'}</p></div>
                <div style={s.msec}>
                  <div style={s.msecHdr}>Kompetanse</div>
                  {skills.map(sk => <div key={sk.id} style={s.skillRow}>
                    <span style={s.skillName}>{sk.name}</span>
                    {editingComment && editingComment.skillId === sk.id
                      ? <input autoFocus style={s.commentInput} value={editingComment.value}
                          onChange={e => setEditingComment({...editingComment, value: e.target.value})}
                          onBlur={() => saveComment(sk.id, editingComment.value)}
                          onKeyDown={e => { if(e.key==='Enter') saveComment(sk.id, editingComment.value) }} />
                      : <span style={{...s.comment,...(sk.comment?{}:s.commentEmpty)}} onClick={() => setEditingComment({skillId:sk.id,value:sk.comment||''})}>
                          {sk.comment || 'Legg til kommentar...'}
                        </span>}
                    <button style={s.delSkill} onClick={() => deleteSkill(sk.id)}>X</button>
                  </div>)}
                  <div style={{display:'flex',gap:6,marginTop:10}}>
                    <input style={{...s.commentInput,flex:1}} value={newSkillInput} onChange={e => setNewSkillInput(e.target.value)} placeholder="Legg til ny ferdighet..." onKeyDown={e => { if(e.key==='Enter') addSkill() }} />
                    <button style={s.miniBtn} onClick={addSkill}>Legg til</button>
                  </div>
                </div>
              </>
            })()}
          </div>
        </div>
      )}

      {changeTarget && (
        <div style={s.overlay} onClick={() => setChangeTarget(null)}>
          <div style={{...s.modal,maxWidth:340}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setChangeTarget(null)}>X</button>
            <div style={{fontSize:15,fontWeight:500,marginBottom:2,color:'#1a1a18'}}>{changeTarget.crew.name}</div>
            <div style={{fontSize:12,color:'#888',marginBottom:16}}>{changeTarget.dateLabel}</div>
            {!pendingStatus ? <>
              {Object.entries(STATUS).map(([k,v]) => <button key={k} style={s.statusOpt} onClick={() => {
                if (k === 'free' || k === 'unavailable') { setPendingStatus(k); saveSimpleStatus(k) }
                else setPendingStatus(k)
              }}>
                <span style={{...s.dot,background:v.bg,border:'1px solid '+v.c,flexShrink:0}}/>{v.full}
              </button>)}
            </> : (pendingStatus === 'booked' || pendingStatus === 'requested') ? <>
              <div style={{fontSize:13,color:'#888',marginBottom:12}}>{STATUS[pendingStatus].full} — fyll inn detaljer</div>
              <label style={s.formLabel}>Prosjekt / arrangement</label>
              <input style={{...s.formInput,marginBottom:10}} value={projectInput} onChange={e => setProjectInput(e.target.value)} placeholder="f.eks. Telenor konferanse" autoFocus />
              <label style={s.formLabel}>Booket av</label>
              <input style={{...s.formInput,marginBottom:16}} value={bookedByInput} onChange={e => setBookedByInput(e.target.value)} placeholder="Ditt navn" />
              <div style={{display:'flex',gap:8}}>
                <button style={{...s.miniBtn,flex:1}} onClick={() => setPendingStatus(null)}>Tilbake</button>
                <button style={{...s.submitBtn,flex:2,padding:'8px'}} onClick={confirmStatus} disabled={saving}>{saving ? 'Lagrer...' : 'Bekreft'}</button>
              </div>
            </> : null}
          </div>
        </div>
      )}

      {addOpen && (
        <div style={s.overlay} onClick={() => setAddOpen(false)}>
          <div style={{...s.modal,maxWidth:460}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setAddOpen(false)}>X</button>
            <div style={{fontSize:17,fontWeight:500,marginBottom:20,color:'#1a1a18'}}>Legg til crew</div>
            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Fornavn *</label><input style={s.formInput} value={addForm.first} onChange={e => setAddForm(f=>({...f,first:e.target.value}))} placeholder="Sara" /></div>
              <div><label style={s.formLabel}>Etternavn *</label><input style={s.formInput} value={addForm.last} onChange={e => setAddForm(f=>({...f,last:e.target.value}))} placeholder="Haugen" /></div>
            </div>
            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Timelnn (kr) *</label><input style={s.formInput} type="number" value={addForm.rate} onChange={e => setAddForm(f=>({...f,rate:e.target.value}))} placeholder="600" /></div>
              <div><label style={s.formLabel}>Antall jobber</label><input style={s.formInput} type="number" value={addForm.jobs} onChange={e => setAddForm(f=>({...f,jobs:e.target.value}))} placeholder="0" /></div>
            </div>
            <div style={{marginBottom:14}}><label style={s.formLabel}>Kompetanse (kommaseparert)</label><input style={s.formInput} value={addForm.skills} onChange={e => setAddForm(f=>({...f,skills:e.target.value}))} placeholder="Sony FX9, Drone" /></div>
            <div style={{marginBottom:14}}><label style={s.formLabel}>Kort bio</label><textarea style={{...s.formInput,resize:'vertical'}} rows={2} value={addForm.bio} onChange={e => setAddForm(f=>({...f,bio:e.target.value}))} placeholder="Kort beskrivelse..." /></div>
            <div style={{marginBottom:14}}>
              <label style={s.formLabel}>Avatarfarge</label>
              <div style={{display:'flex',gap:8,marginTop:6,flexWrap:'wrap'}}>
                {COLORS.map((col,i) => <div key={i} onClick={() => setAddForm(f=>({...f,colorIndex:i}))} style={{width:26,height:26,borderRadius:'50%',background:col.bg,cursor:'pointer',border:addForm.colorIndex===i?'2px solid #1a1a18':'2px solid transparent'}} />)}
              </div>
            </div>
            {addError && <p style={{fontSize:12,color:'#A32D2D',marginBottom:8}}>{addError}</p>}
            <button style={s.submitBtn} onClick={addCrew} disabled={saving}>{saving?'Lagrer...':'Legg til'}</button>
          </div>
        </div>
      )}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}

const s = {
  page:{maxWidth:960,margin:'0 auto',padding:'1.5rem 1rem',fontFamily:'system-ui, sans-serif',color:'#1a1a18',position:'relative',minHeight:'100vh'},
  loading:{padding:'3rem',textAlign:'center',color:'#888',fontFamily:'system-ui, sans-serif'},
  header:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',flexWrap:'wrap',gap:10},
  headerRight:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'},
  brand:{fontSize:11,fontWeight:500,color:'#888',letterSpacing:'0.08em',textTransform:'uppercase'},
  title:{fontSize:20,fontWeight:500,margin:0},
  addBtn:{padding:'7px 14px',fontSize:13,borderRadius:8,border:'0.5px solid #d0cfc8',background:'#fff',color:'#1a1a18',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'},
  logoutBtn:{padding:'7px 14px',fontSize:13,borderRadius:8,border:'0.5px solid #d0cfc8',background:'none',color:'#888',cursor:'pointer',fontFamily:'inherit'},
  tabs:{display:'flex',gap:4,background:'#f1f0ea',borderRadius:8,padding:4},
  tab:{padding:'6px 14px',fontSize:13,border:'none',background:'transparent',color:'#888',borderRadius:6,cursor:'pointer',fontFamily:'inherit'},
  tabActive:{background:'#fff',color:'#1a1a18',border:'0.5px solid #d0cfc8'},
  filterBar:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:'1rem',alignItems:'center'},
  select:{fontSize:13,padding:'6px 10px',borderRadius:8,border:'0.5px solid #d0cfc8',background:'#fff',color:'#1a1a18',fontFamily:'inherit'},
  search:{fontSize:13,padding:'6px 10px',borderRadius:8,border:'0.5px solid #d0cfc8',background:'#fff',color:'#1a1a18',fontFamily:'inherit',minWidth:160},
  clearBtn:{fontSize:12,color:'#888',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:'4px 6px'},
  weekNav:{display:'flex',alignItems:'center',gap:10,marginBottom:'.75rem'},
  navBtn:{background:'none',border:'0.5px solid #d0cfc8',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:13,color:'#1a1a18',fontFamily:'inherit'},
  weekLabel:{fontSize:13,color:'#888'},
  legend:{display:'flex',gap:14,flexWrap:'wrap',marginBottom:'.75rem'},
  legendItem:{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#888'},
  dot:{width:10,height:10,borderRadius:'50%',display:'inline-block'},
  tableWrap:{overflowX:'auto'},
  table:{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:580},
  th:{padding:'8px 4px',fontWeight:500,color:'#888',textAlign:'center',fontSize:11,borderBottom:'0.5px solid #e0dfd8'},
  crewCell:{padding:'8px 10px',borderBottom:'0.5px solid #e0dfd8',whiteSpace:'nowrap'},
  crewInfo:{display:'flex',alignItems:'center',gap:8,cursor:'pointer'},
  avatar:{width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500,flexShrink:0},
  crewName:{fontSize:13,fontWeight:500,color:'#1a1a18'},
  dayCell:{padding:'6px 4px',textAlign:'center',borderBottom:'0.5px solid #e0dfd8',borderLeft:'0.5px solid #e0dfd8',minWidth:250},
  pill:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:'50%',fontSize:11,cursor:'pointer',fontWeight:500,border:'none',fontFamily:'inherit'},
  projectLabel:{fontSize:10,color:'#555',maxWidth:144,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3,marginTop:2},
  crewGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12},
  crewCard:{background:'#fff',borderRadius:12,border:'0.5px solid #e0dfd8',padding:'1.25rem',cursor:'pointer'},
  rate:{fontSize:20,fontWeight:500,color:'#1a1a18'},
  rateUnit:{fontSize:12,fontWeight:400,color:'#888'},
  skillTag:{background:'#f5f4f0',border:'0.5px solid #e0dfd8',borderRadius:20,padding:'3px 8px',fontSize:11,color:'#1a1a18'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'2rem'},
  modal:{background:'#fff',borderRadius:16,border:'0.5px solid #e0dfd8',padding:'1.5rem',width:'100%',maxWidth:480,position:'relative',maxHeight:'85vh',overflowY:'auto',margin:'0 1rem'},
  closeBtn:{position:'absolute',top:12,right:12,background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#888',fontFamily:'inherit'},
  modalAvatar:{width:56,height:56,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,marginBottom:10},
  statsGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:6},
  statCard:{background:'#f5f4f0',borderRadius:8,padding:'10px 12px'},
  statLabel:{fontSize:11,color:'#888',marginBottom:3},
  statVal:{fontSize:16,fontWeight:500,color:'#1a1a18'},
  msec:{marginTop:'1.1rem'},
  msecHdr:{fontSize:11,fontWeight:500,color:'#888',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8},
  bookingRow:{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'0.5px solid #e0dfd8',fontSize:13},
  bookingDay:{color:'#888',minWidth:80,fontSize:12},
  bookingProject:{fontWeight:500,color:'#1a1a18',flex:1},
  bookingBy:{fontSize:11,color:'#aaa'},
  skillRow:{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'0.5px solid #e0dfd8'},
  skillName:{fontSize:13,fontWeight:500,color:'#1a1a18',minWidth:110},
  comment:{flex:1,fontSize:12,color:'#444',lineHeight:1.5,cursor:'pointer',padding:'2px 4px',borderRadius:4},
  commentEmpty:{color:'#aaa',fontStyle:'italic'},
  commentInput:{flex:1,fontSize:12,padding:'4px 8px',borderRadius:6,border:'0.5px solid #b0afaa',background:'#fff',color:'#1a1a18',fontFamily:'inherit',outline:'none'},
  delSkill:{background:'none',border:'none',cursor:'pointer',color:'#aaa',fontSize:13,padding:'2px 4px',lineHeight:1,fontFamily:'inherit',flexShrink:0},
  miniBtn:{padding:'5px 10px',fontSize:12,borderRadius:8,border:'0.5px solid #d0cfc8',background:'#fff',color:'#1a1a18',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'},
  statusOpt:{padding:'10px 12px',borderRadius:8,border:'0.5px solid #d0cfc8',cursor:'pointer',display:'flex',alignItems:'center',gap:10,background:'none',textAlign:'left',fontFamily:'inherit',fontSize:13,color:'#1a1a18',width:'100%',marginBottom:6},
  formRow2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14},
  formLabel:{display:'block',fontSize:12,fontWeight:500,color:'#666',marginBottom:5},
  formInput:{width:'100%',padding:'8px 10px',fontSize:13,borderRadius:8,border:'0.5px solid #d0cfc8',background:'#fff',color:'#1a1a18',fontFamily:'inherit',boxSizing:'border-box'},
  submitBtn:{width:'100%',padding:10,fontSize:14,borderRadius:8,border:'none',background:'#1a1a18',color:'#fff',cursor:'pointer',fontFamily:'inherit',fontWeight:500,marginTop:4},
  empty:{padding:'2rem',textAlign:'center',color:'#888',fontSize:13},
  toast:{position:'fixed',bottom:'1.5rem',left:'50%',transform:'translateX(-50%)',background:'#fff',border:'0.5px solid #d0cfc8',borderRadius:8,padding:'8px 16px',fontSize:13,color:'#1a1a18',zIndex:300,whiteSpace:'nowrap'},
}
