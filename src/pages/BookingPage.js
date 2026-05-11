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

const ALLERGIES = ['Ingen', 'Melk / laktose', 'Gluten / hvete', 'Egg', 'Nøtter', 'Fisk', 'Skalldyr', 'Soya', 'Sesamfrø']

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
  const [filterDay, setFilterDay] = useState('')
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
  const [userName, setUserName] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [myProfileOpen, setMyProfileOpen] = useState(false)
  const [myProfileForm, setMyProfileForm] = useState({ title: '', phone: '', email: '' })
  const [userId, setUserId] = useState(null)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [projectInput, setProjectInput] = useState('')
  const [bookedByInput, setBookedByInput] = useState('')
  // Profile editing
  const [editingRate, setEditingRate] = useState(false)
  const [rateInput, setRateInput] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')
  const [allergyInput, setAllergyInput] = useState('')
  const [editingAllergy, setEditingAllergy] = useState(false)
  const [editingCertificate, setEditingCertificate] = useState(false)
  const [certificateInput, setCertificateInput] = useState('')
  const [crewComments, setCrewComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesInput, setNotesInput] = useState('')
  const [editingBirthdate, setEditingBirthdate] = useState(false)
  const [birthdateInput, setBirthdateInput] = useState('')

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
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
      if (data) {
        setUserName(data.display_name || '')
        setMyProfileForm({ title: data.title || '', phone: data.phone || '', email: data.email || user.email || '' })
      } else {
        setMyProfileForm(f => ({ ...f, email: user.email || '' }))
      }
    }
    loadProfile()
  }, [])
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

  function openProfile(c) {
    setProfileOpen(c)
    setEditingRate(false)
    setEditingBio(false)
    setEditingAllergy(false)
    setRateInput(String(c.rate))
    setBioInput(c.bio || '')
    // Find allergy skill
    const allergySk = (c.skills || []).find(s => s.name.startsWith('Allergi:'))
    setAllergyInput(allergySk ? allergySk.name.replace('Allergi: ', '').replace('Allergi:', '') : '')
    setEditingCertificate(false)
    const certSk = (c.skills || []).find(s => s.name.startsWith('Sertifikat:'))
    setCrewComments([])
    setNewComment('')
    supabase.from('crew_comments').select('*').eq('crew_id', c.id).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) setCrewComments(data)
    })
    setCertificateInput(certSk ? certSk.name.replace('Sertifikat: ', '').replace('Sertifikat:', '').trim() : '')
    setEditingName(false)
    setNameInput(c.name)
  }

  async function saveRate() {
    if (!profileOpen) return
    const newRate = parseInt(rateInput)
    if (!newRate || newRate < 1) return
    await supabase.from('crew').update({ rate: newRate }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, rate: newRate } : c))
    setProfileOpen(prev => ({ ...prev, rate: newRate }))
    setEditingRate(false)
    showToast('Timelonn oppdatert')
  }

  async function saveBio() {
    if (!profileOpen) return
    await supabase.from('crew').update({ bio: bioInput }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, bio: bioInput } : c))
    setProfileOpen(prev => ({ ...prev, bio: bioInput }))
    setEditingBio(false)
    showToast('Bio oppdatert')
  }

  async function saveAllergy() {
    if (!profileOpen) return
    const c = profileOpen
    const skills = c.skills || []
    const existingAllergySkill = skills.find(s => s.name.startsWith('Allergi:'))
    const newVal = allergyInput.trim()
    if (existingAllergySkill) {
      if (newVal) {
        await supabase.from('skills').update({ name: 'Allergi: ' + newVal }).eq('id', existingAllergySkill.id)
        const updated = skills.map(s => s.id === existingAllergySkill.id ? { ...s, name: 'Allergi: ' + newVal } : s)
        setCrew(prev => prev.map(cr => cr.id === c.id ? { ...cr, skills: updated } : cr))
        setProfileOpen(prev => ({ ...prev, skills: updated }))
      } else {
        await supabase.from('skills').delete().eq('id', existingAllergySkill.id)
        const updated = skills.filter(s => s.id !== existingAllergySkill.id)
        setCrew(prev => prev.map(cr => cr.id === c.id ? { ...cr, skills: updated } : cr))
        setProfileOpen(prev => ({ ...prev, skills: updated }))
      }
    } else if (newVal) {
      const { data } = await supabase.from('skills').insert({ crew_id: c.id, name: 'Allergi: ' + newVal, comment: '' }).select().single()
      if (data) {
        const updated = [...skills, data]
        setCrew(prev => prev.map(cr => cr.id === c.id ? { ...cr, skills: updated } : cr))
        setProfileOpen(prev => ({ ...prev, skills: updated }))
      }
    }
    setEditingAllergy(false)
    showToast('Allergi oppdatert')
  }

  async function saveName() {
    if (!profileOpen || !nameInput.trim()) return
    const newName = nameInput.trim()
    const parts = newName.split(' ')
    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : newName.slice(0,2).toUpperCase()
    await supabase.from('crew').update({ name: newName, initials }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, name: newName, initials } : c))
    setProfileOpen(prev => ({ ...prev, name: newName, initials }))
    setEditingName(false)
    showToast('Navn oppdatert')
  }

  async function saveBirthdate() {
    if (!profileOpen) return
    await supabase.from('crew').update({ birthdate: birthdateInput || null }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, birthdate: birthdateInput } : c))
    setProfileOpen(prev => ({ ...prev, birthdate: birthdateInput }))
    setEditingBirthdate(false)
    showToast('Fodselsdato oppdatert')
  }

  async function saveLocation() {
    if (!profileOpen) return
    await supabase.from('crew').update({ location: locationInput }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, location: locationInput } : c))
    setProfileOpen(prev => ({ ...prev, location: locationInput }))
    setEditingLocation(false)
    showToast('Bosted oppdatert')
  }

  async function saveNotes() {
    if (!profileOpen) return
    await supabase.from('crew').update({ notes: notesInput }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, notes: notesInput } : c))
    setProfileOpen(prev => ({ ...prev, notes: notesInput }))
    setEditingNotes(false)
    showToast('Kommentar oppdatert')
  }

  async function addCrewComment() {
    if (!newComment.trim() || !profileOpen) return
    const { data } = await supabase.from('crew_comments').insert({
      crew_id: profileOpen.id,
      author: userName || 'Ukjent',
      author_id: userId,
      content: newComment.trim()
    }).select().single()
    if (data) {
      setCrewComments(prev => [...prev, data])
      setNewComment('')
    }
  }

  async function deleteCrewComment(id) {
    await supabase.from('crew_comments').delete().eq('id', id)
    setCrewComments(prev => prev.filter(c => c.id !== id))
  }

  async function saveCertificate() {
    if (!profileOpen) return
    const c = profileOpen
    const skills = c.skills || []
    const existingCert = skills.find(s => s.name.startsWith('Sertifikat:'))
    const newVal = certificateInput.trim()
    if (existingCert) {
      if (newVal) {
        await supabase.from('skills').update({ name: 'Sertifikat: ' + newVal }).eq('id', existingCert.id)
        const updated = skills.map(s => s.id === existingCert.id ? { ...s, name: 'Sertifikat: ' + newVal } : s)
        setCrew(prev => prev.map(cr => cr.id === c.id ? { ...cr, skills: updated } : cr))
        setProfileOpen(prev => ({ ...prev, skills: updated }))
      } else {
        await supabase.from('skills').delete().eq('id', existingCert.id)
        const updated = skills.filter(s => s.id !== existingCert.id)
        setCrew(prev => prev.map(cr => cr.id === c.id ? { ...cr, skills: updated } : cr))
        setProfileOpen(prev => ({ ...prev, skills: updated }))
      }
    } else if (newVal) {
      const { data } = await supabase.from('skills').insert({ crew_id: c.id, name: 'Sertifikat: ' + newVal, comment: '' }).select().single()
      if (data) {
        const updated = [...skills, data]
        setCrew(prev => prev.map(cr => cr.id === c.id ? { ...cr, skills: updated } : cr))
        setProfileOpen(prev => ({ ...prev, skills: updated }))
      }
    }
    setEditingCertificate(false)
    showToast('Sertifikat oppdatert')
  }

  async function saveMyProfile() {
    if (!userId) return
    await supabase.from('user_profiles').upsert({
      id: userId,
      display_name: userName,
      title: myProfileForm.title,
      phone: myProfileForm.phone,
      email: myProfileForm.email,
      updated_at: new Date().toISOString()
    })
    setMyProfileOpen(false)
    showToast('Profil oppdatert!')
  }

  async function saveNewPassword() {
    setPasswordError('')
    if (newPassword.length < 6) { setPasswordError('Passordet må være minst 6 tegn.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passordene stemmer ikke overens.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPasswordError('Noe gikk galt. Prøv igjen.'); return }
    setPasswordSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => { setChangePasswordOpen(false); setPasswordSuccess(false) }, 2000)
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
    if (filterAvail && filterDay) {
      if (getStatus(c.id, filterDay) !== filterAvail) return false
    } else if (filterAvail) {
      if (!days.some(d => getStatus(c.id, dk(d)) === filterAvail)) return false
    }
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
          <div style={{position:'relative'}} onMouseEnter={() => setShowUserMenu(true)} onMouseLeave={() => setShowUserMenu(false)}>
            <button style={s.logoutBtn}>👤 {userName || 'Min konto'}</button>
            {showUserMenu && (
              <div style={{position:'absolute',top:'100%',right:0,paddingTop:8,zIndex:200}}>
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #E5E7F0',boxShadow:'0 8px 24px rgba(26,27,46,0.12)',minWidth:190,overflow:'hidden'}}>
                  <button style={s.menuItem} onClick={() => { setMyProfileOpen(true); setShowUserMenu(false) }}>👤 Min profil</button>
                  <div style={{borderTop:'1px solid #F0F2FF'}} />
                  <button style={{...s.menuItem,color:'#C92A2A'}} onClick={() => { logout(); setShowUserMenu(false) }}>🚪 Logg ut</button>
                </div>
              </div>
            )}
          </div>
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
            <select style={s.select} value={filterDay} onChange={e => setFilterDay(e.target.value)}>
              <option value="">Alle dager</option>
              {days.map(d => <option key={dk(d)} value={dk(d)}>{fmtDay(d)}</option>)}
            </select>
            <input style={s.search} value={searchCal} onChange={e => setSearchCal(e.target.value)} placeholder="Sok navn..." />
            <button style={s.clearBtn} onClick={() => { setSearchCal(''); setFilterAvail(''); setFilterDay('') }}>Nullstill</button>
          </div>
          {filterAvail && filterDay && (
            <div style={s.filterInfo}>
              Viser crew med status <strong>{STATUS[filterAvail].full}</strong> pa {days.find(d => dk(d) === filterDay) ? fmtDay(days.find(d => dk(d) === filterDay)) : filterDay} - {filteredCal.length} person(er)
            </div>
          )}
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
                {days.map(d => <th key={dk(d)} style={{...s.th, background: filterDay===dk(d)?'#f0f7ff':undefined}}>{fmtDay(d)}</th>)}
              </tr></thead>
              <tbody>
                {filteredCal.length === 0 && <tr><td colSpan={8} style={s.empty}>Ingen crew matcher filteret.</td></tr>}
                {filteredCal.map(c => {
                  const col = COLORS[c.color_index % COLORS.length]
                  return <tr key={c.id}>
                    <td style={s.crewCell}>
                      <div style={s.crewInfo} onClick={() => openProfile(c)}>
                        <div style={{...s.avatar,background:col.bg,color:col.text}}>{c.initials}</div>
                        <span style={s.crewName}>{c.name}</span>
                      </div>
                    </td>
                    {days.map(d => {
                      const date = dk(d)
                      const st = getStatus(c.id, date)
                      const cfg = STATUS[st]
                      const booking = getBooking(c.id, date)
                      const isHighlighted = filterDay === date
                      return <td key={date} style={{...s.dayCell, background: isHighlighted?'#f0f7ff':undefined}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                          <button style={{...s.pill,background:cfg.bg,color:cfg.c}}
                            title={booking && booking.project ? cfg.full + ' - ' + booking.project : cfg.full}
                            onClick={() => openChange(c, date, fmtDay(d))}>{cfg.label}</button>
                          {booking && booking.project && <span style={s.projectLabel}>{booking.project}</span>}
                          {booking && booking.booked_by && <span style={s.bookedByLabel}>av {booking.booked_by}</span>}
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
              const skills = (c.skills || []).filter(s => !s.name.startsWith('Allergi:'))
              const allergy = (c.skills || []).find(s => s.name.startsWith('Allergi:'))
              return <div key={c.id} style={s.crewCard} onClick={() => openProfile(c)}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                  <div style={{...s.avatar,width:40,height:40,background:col.bg,color:col.text}}>{c.initials}</div>
                  <div style={s.crewName}>{c.name}</div>
                </div>
                <div style={s.rate}>{c.rate} kr<span style={s.rateUnit}>/t</span></div>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:10}}>
                  {skills.slice(0,3).map(sk => <span key={sk.id} style={s.skillTag}>{sk.name}</span>)}
                  {skills.length > 3 && <span style={{fontSize:11,color:'#888',padding:'3px 4px'}}>+{skills.length-3}</span>}
                </div>
                {allergy && <div style={{marginTop:8,fontSize:11,color:'#A32D2D',background:'#FCEBEB',borderRadius:6,padding:'3px 8px',display:'inline-block'}}>{allergy.name}</div>}
              </div>
            })}
          </div>
        </div>
      )}

      {/* Profile modal */}
      {profileOpen && (
        <div style={s.overlay} onClick={() => setProfileOpen(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setProfileOpen(null)}>X</button>
            {(() => {
              const c = profileOpen
              const col = COLORS[c.color_index % COLORS.length]
              const freeDays = days.filter(d => getStatus(c.id, dk(d)) === 'free').length
              const skills = (c.skills || []).filter(s => !s.name.startsWith('Allergi:'))
              const weekBookings = days.map(d => ({day: fmtDay(d), b: getBooking(c.id, dk(d))})).filter(x => x.b && x.b.status === 'booked' && x.b.project)
              return <>
                <div style={{...s.modalAvatar,background:col.bg,color:col.text}}>{c.initials}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  {editingName ? (
                    <div style={{display:'flex',gap:8,flex:1}}>
                      <input style={{...s.formInput,flex:1,fontSize:16}} value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') saveName() }} autoFocus />
                      <button style={s.miniBtn} onClick={saveName}>Lagre</button>
                      <button style={s.clearBtn} onClick={() => setEditingName(false)}>Avbryt</button>
                    </div>
                  ) : (
                    <>
                      <div style={{fontSize:18,fontWeight:500,color:'#1a1a18',flex:1}}>{c.name}</div>
                      <button style={s.editBtn} onClick={() => { setEditingName(true); setNameInput(c.name) }}>Rediger navn</button>
                    </>
                  )}
                </div>

                {/* Editable bio */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Om</div>
                    {!editingBio && <button style={s.editBtn} onClick={() => { setEditingBio(true); setBioInput(c.bio || '') }}>Rediger</button>}
                  </div>
                  {editingBio ? (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <textarea style={{...s.formInput,resize:'vertical'}} rows={3} value={bioInput} onChange={e => setBioInput(e.target.value)} autoFocus />
                      <div style={{display:'flex',gap:8}}>
                        <button style={s.miniBtn} onClick={saveBio}>Lagre</button>
                        <button style={s.clearBtn} onClick={() => setEditingBio(false)}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{fontSize:13,color:'#666',lineHeight:1.6,margin:0}}>{c.bio || '-'}</p>
                  )}
                </div>

                {/* Skills */}
                <div style={s.msec}>
                  <div style={s.msecHdr}>Ferdigheter</div>
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
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                    <div style={s.msecHdr}>Erfaringer/referanse</div>
                    {!editingNotes && <button style={s.editBtn} onClick={() => { setEditingNotes(true); setNotesInput(c.notes || '') }}>Rediger</button>}
                  </div>
                  {editingNotes ? (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <textarea style={{...s.formInput,resize:'vertical'}} rows={3} value={notesInput} onChange={e => setNotesInput(e.target.value)} placeholder='Interne kommentarer...' autoFocus />
                      <div style={{display:'flex',gap:8}}>
                        <button style={s.miniBtn} onClick={saveNotes}>Lagre</button>
                        <button style={s.clearBtn} onClick={() => setEditingNotes(false)}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{fontSize:13,color:c.notes?'#444':'#aaa',lineHeight:1.6,margin:0}}>{c.notes || 'Ingen erfaringer registrert'}</p>
                  )}
                </div>
                {/* Sertifikat */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Sertifikat</div>
                    {!editingCertificate && <button style={s.editBtn} onClick={() => setEditingCertificate(true)}>Rediger</button>}
                  </div>
                  {editingCertificate ? (
                    <div style={{display:'flex',gap:8}}>
                      <input style={{...s.formInput,flex:1}} value={certificateInput} onChange={e => setCertificateInput(e.target.value)} placeholder="f.eks. JA, Klasse B, Truck..." autoFocus onKeyDown={e => { if(e.key==='Enter') saveCertificate() }} />
                      <button style={s.miniBtn} onClick={saveCertificate}>Lagre</button>
                      <button style={s.clearBtn} onClick={() => setEditingCertificate(false)}>Avbryt</button>
                    </div>
                  ) : (
                    <div style={{fontSize:13,color: certificateInput ? '#1a1a18' : '#555'}}>{certificateInput || 'Ikke registrert'}</div>
                  )}
                </div>

                {/* Editable rate */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Timepris</div>
                    {!editingRate && <button style={s.editBtn} onClick={() => { setEditingRate(true); setRateInput(String(c.rate)) }}>Rediger</button>}
                  </div>
                  {editingRate ? (
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input style={{...s.formInput,width:120}} type="number" value={rateInput} onChange={e => setRateInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') saveRate() }} autoFocus />
                      <span style={{fontSize:13,color:'#888'}}>kr/t</span>
                      <button style={s.miniBtn} onClick={saveRate}>Lagre</button>
                      <button style={s.clearBtn} onClick={() => setEditingRate(false)}>Avbryt</button>
                    </div>
                  ) : (
                    <div style={{fontSize:24,fontWeight:500,color:'#1a1a18'}}>{c.rate} kr<span style={{fontSize:13,fontWeight:400,color:'#888'}}>/t</span></div>
                  )}
                </div>

                <div style={s.infoGrid}>
                  <div style={s.infoCell}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                      <div style={s.msecHdr}>Fodselsdato</div>
                      {!editingBirthdate && <button style={s.editBtn} onClick={() => setEditingBirthdate(true)}>Rediger</button>}
                    </div>
                    {editingBirthdate ? (
                      <div style={{display:'flex',gap:6}}>
                        <input style={{...s.formInput,flex:1}} type='date' value={birthdateInput} onChange={e => setBirthdateInput(e.target.value)} autoFocus />
                        <button style={s.miniBtn} onClick={saveBirthdate}>Lagre</button>
                        <button style={s.clearBtn} onClick={() => setEditingBirthdate(false)}>X</button>
                      </div>
                    ) : (
                      <div style={{fontSize:13,color:c.birthdate?'#1a1a18':'#aaa'}}>
                        {c.birthdate ? new Date(c.birthdate).toLocaleDateString('nb-NO') : 'Ikke registrert'}
                      </div>
                    )}
                  </div>
                  <div style={s.infoCell}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                      <div style={s.msecHdr}>Bosted</div>
                      {!editingLocation && <button style={s.editBtn} onClick={() => setEditingLocation(true)}>Rediger</button>}
                    </div>
                    {editingLocation ? (
                      <div style={{display:'flex',gap:6}}>
                        <input style={{...s.formInput,flex:1}} value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder='f.eks. Oslo' autoFocus onKeyDown={e => { if(e.key==='Enter') saveLocation() }} />
                        <button style={s.miniBtn} onClick={saveLocation}>Lagre</button>
                        <button style={s.clearBtn} onClick={() => setEditingLocation(false)}>X</button>
                      </div>
                    ) : (
                      <div style={{fontSize:13,color:c.location?'#1a1a18':'#aaa'}}>{c.location || 'Ikke registrert'}</div>
                    )}
                  </div>
                </div>
                {/* Editable allergy */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Allergi / kosthold</div>
                    {!editingAllergy && <button style={s.editBtn} onClick={() => setEditingAllergy(true)}>Rediger</button>}
                  </div>
                  {editingAllergy ? (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {ALLERGIES.map(a => (
                          <button key={a} onClick={() => setAllergyInput(a === 'Ingen' ? '' : (allergyInput ? allergyInput + ', ' + a : a))}
                            style={{padding:'5px 12px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid #C7D0F0',background:'#EEF2FF',color:'#3B5BDB',fontWeight:500,fontFamily:"'Avenir','Avenir Next',sans-serif"}}>
                            {a}
                          </button>
                        ))}
                      </div>
                      <input style={{...s.formInput}} value={allergyInput} onChange={e => setAllergyInput(e.target.value)} placeholder="Eller skriv fritt..." autoFocus onKeyDown={e => { if(e.key==='Enter') saveAllergy() }} />
                      <div style={{display:'flex',gap:8}}>
                        <button style={s.miniBtn} onClick={saveAllergy}>Lagre</button>
                        <button style={s.clearBtn} onClick={() => setEditingAllergy(false)}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:13,color: allergyInput ? '#A32D2D' : '#aaa'}}>{allergyInput || 'Ingen registrert'}</div>
                  )}
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

              </>
            })()}
          </div>
        </div>
      )}

      {/* Status change modal */}
      {changeTarget && (
        <div style={s.overlay} onClick={() => setChangeTarget(null)}>
          <div style={{...s.modal,maxWidth:340}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setChangeTarget(null)}>X</button>
            <div style={{fontSize:15,fontWeight:500,marginBottom:2,color:'#1a1a18'}}>{changeTarget.crew.name}</div>
            <div style={{fontSize:12,color:'#888',marginBottom:16}}>{changeTarget.dateLabel}</div>
            {!pendingStatus ? <>
              {Object.entries(STATUS).map(([k,v]) => <button key={k} style={s.statusOpt} onClick={() => {
                if (k === 'free' || k === 'unavailable') saveSimpleStatus(k)
                else setPendingStatus(k)
              }}>
                <span style={{...s.dot,background:v.bg,border:'1px solid '+v.c,flexShrink:0}}/>{v.full}
              </button>)}
            </> : <>
              <div style={{fontSize:13,color:'#888',marginBottom:12}}>{STATUS[pendingStatus].full} - fyll inn detaljer</div>
              <label style={s.formLabel}>Prosjekt / arrangement</label>
              <input style={{...s.formInput,marginBottom:10}} value={projectInput} onChange={e => setProjectInput(e.target.value)} placeholder="f.eks. Telenor konferanse" autoFocus />
              <label style={s.formLabel}>Booket av</label>
              <input style={{...s.formInput,marginBottom:16}} value={bookedByInput} onChange={e => setBookedByInput(e.target.value)} placeholder="Ditt navn" />
              <div style={{display:'flex',gap:8}}>
                <button style={{...s.miniBtn,flex:1}} onClick={() => setPendingStatus(null)}>Tilbake</button>
                <button style={{...s.submitBtn,flex:2,padding:'8px'}} onClick={confirmStatus} disabled={saving}>{saving ? 'Lagrer...' : 'Bekreft'}</button>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* Add crew modal */}
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
              <div><label style={s.formLabel}>Timelonn (kr) *</label><input style={s.formInput} type="number" value={addForm.rate} onChange={e => setAddForm(f=>({...f,rate:e.target.value}))} placeholder="600" /></div>
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

      {myProfileOpen && (
        <div style={s.overlay} onClick={() => setMyProfileOpen(false)}>
          <div style={{...s.modal,maxWidth:400}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setMyProfileOpen(false)}>×</button>
            <div style={{background:'linear-gradient(135deg,#3B5BDB,#7048E8)',margin:'-1.5rem -1.5rem 1.5rem',padding:'24px',borderRadius:'14px 14px 0 0'}}>
              <div style={{fontSize:28,marginBottom:8}}>👤</div>
              <div style={{fontSize:20,fontWeight:700,color:'#fff'}}>{userName || 'Din profil'}</div>
              {myProfileForm.title && <div style={{fontSize:14,color:'rgba(255,255,255,0.8)',marginTop:4}}>{myProfileForm.title}</div>}
            </div>
            <div style={{marginBottom:14}}><label style={s.formLabel}>Navn</label><input style={s.formInput} value={userName} onChange={e => { setUserName(e.target.value); localStorage.setItem('zcrew_username', e.target.value) }} placeholder="Ditt navn" /></div>
            <div style={{marginBottom:14}}><label style={s.formLabel}>Tittel / rolle</label><input style={s.formInput} value={myProfileForm.title} onChange={e => setMyProfileForm(f => ({...f,title:e.target.value}))} placeholder="f.eks. Prosjektleder" /></div>
            <div style={{marginBottom:14}}><label style={s.formLabel}>Telefon</label><input style={s.formInput} type="tel" value={myProfileForm.phone} onChange={e => setMyProfileForm(f => ({...f,phone:e.target.value}))} placeholder="f.eks. 98765432" /></div>
            <div style={{marginBottom:20}}><label style={s.formLabel}>E-post</label><input style={s.formInput} type="email" value={myProfileForm.email} onChange={e => setMyProfileForm(f => ({...f,email:e.target.value}))} placeholder="navn@zevent.no" /></div>
            <button style={s.submitBtn} onClick={saveMyProfile}>Lagre profil</button>
            <button style={{...s.submitBtn,marginTop:10,background:'none',border:'1px solid #C7D0F0',color:'#3B5BDB',boxShadow:'none'}} onClick={() => { setMyProfileOpen(false); setChangePasswordOpen(true) }}>🔑 Bytt passord</button>
          </div>
        </div>
      )}

      {changePasswordOpen && (
        <div style={s.overlay} onClick={() => setChangePasswordOpen(false)}>
          <div style={{...s.modal,maxWidth:380}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setChangePasswordOpen(false)}>×</button>
            <div style={{fontSize:20,fontWeight:700,marginBottom:8,color:'#1A1B2E'}}>Bytt passord 🔑</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:20}}>Velg et nytt passord for din konto.</div>
            {passwordSuccess ? (
              <div style={{textAlign:'center',padding:'1.5rem',color:'#0F6E56',fontSize:15,fontWeight:600}}>✅ Passordet er oppdatert!</div>
            ) : (
              <>
                <label style={s.formLabel}>Nytt passord</label>
                <input style={{...s.formInput,marginBottom:14}} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minst 6 tegn" autoFocus />
                <label style={s.formLabel}>Bekreft passord</label>
                <input style={{...s.formInput,marginBottom:14}} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Gjenta passordet" onKeyDown={e => { if(e.key==='Enter') saveNewPassword() }} />
                {passwordError && <p style={{fontSize:13,color:'#C92A2A',marginBottom:12,background:'#FFF0F0',padding:'8px 12px',borderRadius:7}}>{passwordError}</p>}
                <button style={s.submitBtn} onClick={saveNewPassword}>Lagre nytt passord</button>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}

const s = {
  page:{maxWidth:1200,margin:'0 auto',padding:'1.5rem 1rem',fontFamily:'system-ui, sans-serif',color:'#1a1a18',position:'relative',minHeight:'100vh'},
  loading:{padding:'3rem',textAlign:'center',color:'#888',fontFamily:'system-ui, sans-serif'},
  header:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem',flexWrap:'wrap',gap:10},
  headerRight:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'},
  brand:{fontSize:11,fontWeight:500,color:'#888',letterSpacing:'0.08em',textTransform:'uppercase'},
  title:{fontSize:20,fontWeight:500,margin:0},
  addBtn:{padding:'7px 14px',fontSize:13,borderRadius:8,border:'0.5px solid #d0cfc8',background:'#fff',color:'#1a1a18',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'},
  menuItem:{display:'block',width:'100%',padding:'11px 16px',fontSize:14,fontWeight:500,border:'none',background:'none',color:'#1A1B2E',cursor:'pointer',textAlign:'left',fontFamily:'inherit'},
  logoutBtn:{padding:'7px 14px',fontSize:13,borderRadius:8,border:'0.5px solid #d0cfc8',background:'none',color:'#888',cursor:'pointer',fontFamily:'inherit'},
  tabs:{display:'flex',gap:4,background:'#f1f0ea',borderRadius:8,padding:4},
  tab:{padding:'6px 14px',fontSize:13,border:'none',background:'transparent',color:'#888',borderRadius:6,cursor:'pointer',fontFamily:'inherit'},
  tabActive:{background:'#fff',color:'#1a1a18',border:'0.5px solid #d0cfc8'},
  filterBar:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:'0.5rem',alignItems:'center'},
  filterInfo:{fontSize:12,color:'#555',marginBottom:'0.75rem',padding:'6px 10px',background:'#f0f7ff',borderRadius:6},
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
  th:{padding:'8px 6px',fontWeight:500,color:'#888',textAlign:'center',fontSize:11,borderBottom:'0.5px solid #e0dfd8'},
  crewCell:{padding:'8px 10px',borderBottom:'0.5px solid #e0dfd8',whiteSpace:'nowrap'},
  crewInfo:{display:'flex',alignItems:'center',gap:8,cursor:'pointer'},
  avatar:{width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500,flexShrink:0},
  crewName:{fontSize:13,fontWeight:500,color:'#1a1a18'},
  dayCell:{padding:'8px 6px',textAlign:'center',borderBottom:'0.5px solid #e0dfd8',borderLeft:'0.5px solid #e0dfd8',minWidth:110,verticalAlign:'top'},
  pill:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:'50%',fontSize:11,cursor:'pointer',fontWeight:500,border:'none',fontFamily:'inherit'},
  projectLabel:{fontSize:10,color:'#444',lineHeight:1.4,marginTop:2,wordBreak:'break-word',maxWidth:100,textAlign:'center'},
  bookedByLabel:{fontSize:9,color:'#aaa',lineHeight:1.3,textAlign:'center'},
  crewGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12},
  crewCard:{background:'#fff',borderRadius:12,border:'0.5px solid #e0dfd8',padding:'1.25rem',cursor:'pointer'},
  rate:{fontSize:20,fontWeight:500,color:'#1a1a18'},
  rateUnit:{fontSize:12,fontWeight:400,color:'#888'},
  skillTag:{background:'#f5f4f0',border:'0.5px solid #e0dfd8',borderRadius:20,padding:'3px 8px',fontSize:11,color:'#1a1a18'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'2rem'},
  modal:{background:'#fff',borderRadius:16,border:'0.5px solid #e0dfd8',padding:'1.5rem',width:'100%',maxWidth:480,position:'relative',maxHeight:'85vh',overflowY:'auto',margin:'0 1rem'},
  closeBtn:{position:'absolute',top:12,right:12,background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#888',fontFamily:'inherit'},
  editBtn:{fontSize:11,color:'#666',background:'none',border:'0.5px solid #d0cfc8',borderRadius:6,padding:'3px 8px',cursor:'pointer',fontFamily:'inherit'},
  modalAvatar:{width:56,height:56,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:500,marginBottom:10},
  infoGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:'1.1rem'},
  infoCell:{background:'#f5f4f0',borderRadius:8,padding:'10px 12px'},
  statsGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:'1.1rem'},
  statCard:{background:'#f5f4f0',borderRadius:8,padding:'10px 12px'},
  statLabel:{fontSize:11,color:'#888',marginBottom:3},
  statVal:{fontSize:16,fontWeight:500,color:'#1a1a18'},
  msec:{marginTop:0,paddingTop:'1rem',borderTop:'1px solid #f0f0ea'},
  msecHdr:{fontSize:12,fontWeight:700,color:'#1a1a18',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6},
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
