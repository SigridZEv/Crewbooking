import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Load Avenir-like Google Font as web fallback
const fontLink = document.createElement('link')
fontLink.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap'
fontLink.rel = 'stylesheet'
document.head.appendChild(fontLink)

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

const ALLERGIES = ['Ingen', 'Melk / laktose', 'Gluten / hvete', 'Nøtter', 'Egg', 'Fisk', 'Skalldyr', 'Soya', 'Sesamfrø', 'Annet']


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

function ProjectCard({ p, crew }) {
  const crewList = p.bookings.map(b => b.crew).filter(Boolean)
  const uniqueCrew = crewList.filter((c, idx) => crewList.findIndex(x => x.id === c.id) === idx)
  const dates = p.bookings.map(b => b.date).sort()
  const fromDate = new Date(dates[0]).toLocaleDateString('nb-NO', {day:'numeric',month:'long'})
  const toDate = new Date(dates[dates.length-1]).toLocaleDateString('nb-NO', {day:'numeric',month:'long',year:'numeric'})
  const allergies = []
  uniqueCrew.forEach(c => {
    const fullCrew = crew.find(x => x.id === c.id)
    const allergy = (fullCrew?.skills || []).find(s => s.name.startsWith('Allergi:'))
    if (allergy) allergies.push({ name: c.name, allergy: allergy.name.replace('Allergi: ', '').replace('Allergi:', '').trim() })
  })
  return (
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7F0',padding:'1.5rem',marginBottom:16,boxShadow:'0 1px 4px rgba(59,91,219,0.05)'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:'#1A1B2E',marginBottom:4}}>{p.project}</div>
          <div style={{fontSize:13,color:'#6B7280'}}>📅 {fromDate}{dates.length > 1 ? ' — ' + toDate : ''}</div>
        </div>
        <div style={{fontSize:12,fontWeight:600,color:'#3B5BDB',background:'#EEF2FF',borderRadius:20,padding:'4px 12px'}}>{uniqueCrew.length} crew</div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Crew</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {uniqueCrew.map((c, j) => {
            const fullCrew = crew.find(x => x.id === c.id)
            const col = COLORS[(fullCrew?.color_index || j) % COLORS.length]
            return (
              <div key={j} style={{display:'flex',alignItems:'center',gap:6,background:'#F8F9FE',borderRadius:8,padding:'6px 10px',border:'1px solid #E5E7F0'}}>
                <div style={{width:24,height:24,borderRadius:'50%',background:col.bg,color:col.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>{c.initials}</div>
                <span style={{fontSize:13,fontWeight:500,color:'#1A1B2E'}}>{c.name}</span>
              </div>
            )
          })}
        </div>
      </div>
      {allergies.length > 0 && (
        <div style={{background:'#FFF8F0',borderRadius:8,padding:'12px 14px',border:'1px solid #FFD8A8'}}>
          <div style={{fontSize:11,fontWeight:700,color:'#854F0B',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>⚠️ Allergier / kosthold</div>
          {allergies.map((a, j) => <div key={j} style={{fontSize:13,color:'#854F0B',marginBottom:4}}><strong>{a.name}:</strong> {a.allergy}</div>)}
        </div>
      )}
      {allergies.length === 0 && <div style={{fontSize:12,color:'#9CA3AF'}}>✅ Ingen registrerte allergier</div>}
    </div>
  )
}

export default function BookingPage({ user }) {
  const [view, setView] = useState('cal')
  const [myProjects, setMyProjects] = useState([])
  const [crew, setCrew] = useState([])
  const [bookings, setBookings] = useState({})
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchCal, setSearchCal] = useState('')
  const [filterAvail, setFilterAvail] = useState('')
  const [filterDay, setFilterDay] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchCrew, setSearchCrew] = useState('')
  const [profileOpen, setProfileOpen] = useState(null)
  const [changeTarget, setChangeTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [newSkillInput, setNewSkillInput] = useState('')
  const [editingComment, setEditingComment] = useState(null)
  const [addForm, setAddForm] = useState({ first: '', last: '', rate: '', jobs: '', bio: '', skills: '', colorIndex: 0, birthdate: '', location: '', allergy: '', notes: '' })
  const [addError, setAddError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [settingName, setSettingName] = useState(false)
  const [nameInputVal, setNameInputVal] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedCrew, setSelectedCrew] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  const [bulkProject, setBulkProject] = useState('')
  const [bulkStatus, setBulkStatus] = useState('booked')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
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
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [profileBookings, setProfileBookings] = useState([])
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
    const savedProfile = localStorage.getItem('zcrew_profile')
    if (savedProfile) {
      try { setMyProfileForm(JSON.parse(savedProfile)) } catch(e) {}
    }
    const saved = localStorage.getItem('zcrew_username')
    if (saved) setUserName(saved)
    else setSettingName(true)
  }, [])
  useEffect(() => { loadBookings() }, [loadBookings])

  function getBooking(crewId, date) { return bookings[crewId + '_' + date] || null }

  function getStatus(crewId, date) {
    const b = getBooking(crewId, date)
    if (b) return b.status
    return 'free'
  }

  function openChange(c, date, dateLabel) {
    setChangeTarget({ crew: c, date, dateLabel })
    setPendingStatus(null)
    setProjectInput('')
    setBookedByInput(userName)
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
    setEditingName(false)
    setNameInput(c.name)
    setEditingCertificate(false)
    const certSk = (c.skills || []).find(s => s.name.startsWith('Sertifikat:'))
    setCertificateInput(certSk ? certSk.name.replace('Sertifikat: ', '').replace('Sertifikat:', '').trim() : '')
  }

  async function saveRate() {
    if (!profileOpen) return
    const newRate = parseInt(rateInput)
    if (!newRate || newRate < 1) return
    await supabase.from('crew').update({ rate: newRate }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, rate: newRate } : c))
    setProfileOpen(prev => ({ ...prev, rate: newRate }))
    setEditingRate(false)
    showToast('Timelønn oppdatert')
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

  function saveMyProfile() {
    localStorage.setItem('zcrew_profile', JSON.stringify(myProfileForm))
    setMyProfileOpen(false)
    showToast('Profil oppdatert!')
  }

  function saveMyProfile() {
    localStorage.setItem('zcrew_profile', JSON.stringify(myProfileForm))
    setMyProfileOpen(false)
    showToast('Profil oppdatert!')
  }

  function saveUserName() {
    if (!nameInputVal.trim()) return
    localStorage.setItem('zcrew_username', nameInputVal.trim())
    setUserName(nameInputVal.trim())
    setSettingName(false)
    showToast('Navn lagret: ' + nameInputVal.trim())
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

  async function saveBulkBooking() {
    if (!bulkFrom || !bulkTo || !bulkProject || selectedCrew.length === 0) return
    setBulkSaving(true)
    const dates = []
    let cur = new Date(bulkFrom)
    const end = new Date(bulkTo)
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    const rows = []
    selectedCrew.forEach(crewId => {
      dates.forEach(date => {
        rows.push({ crew_id: crewId, date, status: bulkStatus, project: bulkProject, booked_by: userName })
      })
    })
    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from('bookings').upsert(rows.slice(i, i + 50), { onConflict: 'crew_id,date' })
    }
    // Update local state
    const newBookings = { ...bookings }
    rows.forEach(r => { newBookings[r.crew_id + '_' + r.date] = r })
    setBookings(newBookings)
    setBulkSaving(false)
    setBulkOpen(false)
    setBulkMode(false)
    setSelectedCrew([])
    setBulkFrom('')
    setBulkTo('')
    setBulkProject('')
    showToast(`${selectedCrew.length} crew booket på ${bulkProject}!`)
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
    const { first, last, rate, jobs, bio, skills: skillsRaw, colorIndex, birthdate, location, allergy, notes } = addForm
    if (!first || !last || !rate) { setAddError('Fyll ut alle obligatoriske felt.'); return }
    setAddError(''); setSaving(true)
    const { data: newCrew, error } = await supabase.from('crew').insert({
      name: first + ' ' + last,
      initials: (first[0] + last[0]).toUpperCase(),
      rate: parseInt(rate),
      jobs: parseInt(jobs) || 0,
      bio,
      color_index: colorIndex,
      birthdate: birthdate || null,
      location: location || '',
      notes: notes || '',
    }).select().single()
    if (error || !newCrew) { setAddError('Noe gikk galt.'); setSaving(false); return }
    const skillsList = skillsRaw.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ crew_id: newCrew.id, name: s, comment: '' }))
    if (allergy.trim()) skillsList.push({ crew_id: newCrew.id, name: 'Allergi: ' + allergy.trim(), comment: '' })
    if (skillsList.length > 0) await supabase.from('skills').insert(skillsList)
    await loadCrew()
    setAddOpen(false)
    setAddForm({ first: '', last: '', rate: '', jobs: '', bio: '', skills: '', colorIndex: 0, birthdate: '', location: '', allergy: '', notes: '' })
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

  async function loadMyProjects() {
    const { data } = await supabase
      .from('bookings')
      .select('*, crew(*)')
      .eq('booked_by', userName)
      .not('project', 'eq', '')
      .order('date', { ascending: true })
    if (data) {
      const grouped = {}
      data.forEach(b => {
        if (!grouped[b.project]) grouped[b.project] = []
        grouped[b.project].push(b)
      })
      setMyProjects(grouped)
    }
  }

  async function logout() { await supabase.auth.signOut() }

  const days = getWeekDates(weekOffset)

  function getDatesInRange(from, to) {
    if (!from || !to) return []
    const result = []
    let cur = new Date(from)
    const end = new Date(to)
    while (cur <= end) {
      result.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }

  const rangeDates = getDatesInRange(filterFrom, filterTo)

  const filteredCalBase = crew.filter(c => {
    if (searchCal && !c.name.toLowerCase().includes(searchCal.toLowerCase())) return false
    if (!filterFrom || !filterTo || rangeDates.length === 0) {
      if (filterAvail && filterDay) {
        if (getStatus(c.id, filterDay) !== filterAvail) return false
      } else if (filterAvail) {
        if (!days.some(d => getStatus(c.id, dk(d)) === filterAvail)) return false
      }
    }
    return true
  })

  // Sort by free days in period (most free days first) when period filter is active
  const filteredCal = filterFrom && filterTo && rangeDates.length > 0
    ? [...filteredCalBase].sort((a, b) => {
        const aFree = rangeDates.filter(date => getStatus(a.id, date) === 'free').length
        const bFree = rangeDates.filter(date => getStatus(b.id, date) === 'free').length
        return bFree - aFree
      })
    : filteredCalBase

  // Count for badge
  const periodFreeCounts = filterFrom && filterTo && rangeDates.length > 0
    ? Object.fromEntries(filteredCal.map(c => [c.id, rangeDates.filter(date => getStatus(c.id, date) === 'free').length]))
    : {}

  const filteredCrew = crew.filter(c => {
    if (!searchCrew) return true
    const q = searchCrew.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.skills || []).some(s => s.name.toLowerCase().includes(q))
  })

  if (loading) return <div style={s.loading}>Laster...</div>

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <img src="/Z_logo.png" alt="Z Event" style={{width:52,height:52,objectFit:'contain'}} />
          <div>
            <span style={s.brand}>Z Event</span>
            <h1 style={s.title}>Z Crew Portal</h1>
          </div>
        </div>
        <div style={s.headerRight}>
          <button style={s.addBtn} onClick={() => setAddOpen(true)}>+ Legg til crew</button>
          <div style={s.tabs}>
            <button style={{...s.tab, ...(view==='cal'?s.tabActive:{})}} onClick={() => setView('cal')}>Kalender</button>
            <button style={{...s.tab, ...(view==='crew'?s.tabActive:{})}} onClick={() => setView('crew')}>Crew</button>
            <button style={{...s.tab, ...(view==='mine'?s.tabActive:{})}} onClick={() => { setView('mine'); loadMyProjects() }}>Mine prosjekter</button>
          </div>
          <div style={{position:'relative'}} onMouseEnter={() => setShowUserMenu(true)} onMouseLeave={() => setShowUserMenu(false)}>
            <button style={s.changePassBtn}>👤 {userName || 'Sett navn'}</button>
            {showUserMenu && (
              <div style={{position:'absolute',top:'100%',right:0,background:'#fff',borderRadius:10,border:'1px solid #E5E7F0',boxShadow:'0 8px 24px rgba(26,27,46,0.12)',minWidth:190,zIndex:200,overflow:'hidden',marginTop:4}}>
                <button style={s.menuItem} onClick={() => { setMyProfileOpen(true); setShowUserMenu(false) }}>👤 Min profil</button>
                <button style={s.menuItem} onClick={() => { setView('mine'); loadMyProjects(); setShowUserMenu(false) }}>📋 Mine prosjekter</button>
                <div style={{borderTop:'1px solid #F0F2FF'}} />
                <button style={{...s.menuItem, color:'#C92A2A'}} onClick={logout}>🚪 Logg ut</button>
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
            <input style={s.search} value={searchCal} onChange={e => setSearchCal(e.target.value)} placeholder="Sok navn..." />
            <button style={s.clearBtn} onClick={() => { setSearchCal(''); setFilterAvail(''); setFilterDay(''); setFilterFrom(''); setFilterTo('') }}>Nullstill</button>
          </div>
          <div style={s.periodBar}>
            <span style={{fontSize:12,color:'#888',whiteSpace:'nowrap'}}>Filtrer periode:</span>
            <input style={s.dateInput} type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
            <span style={{fontSize:12,color:'#888'}}>til</span>
            <input style={s.dateInput} type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
            {filterFrom && filterTo && rangeDates.length > 0 && (
              <span style={s.filterBadge}>
                {filteredCal.length} crew — sortert etter ledige dager
              </span>
            )}
            {filterFrom && filterTo && !filterAvail && (
              <span style={{fontSize:12,color:'#888',fontStyle:'italic'}}>Velg en status ovenfor for a filtrere</span>
            )}
          </div>
          {filterAvail && filterDay && !filterFrom && (
            <div style={s.filterInfo}>
              Viser crew med status <strong>{STATUS[filterAvail].full}</strong> pa {days.find(d => dk(d) === filterDay) ? fmtDay(days.find(d => dk(d) === filterDay)) : filterDay} - {filteredCal.length} person(er)
            </div>
          )}
          {filterFrom && filterTo && rangeDates.length > 0 && (
            <div style={s.filterInfo}>
              Periode: <strong>{new Date(filterFrom).toLocaleDateString('nb-NO')} - {new Date(filterTo).toLocaleDateString('nb-NO')}</strong> ({rangeDates.length} dager) — sortert etter flest ledige dager
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
                <th style={{...s.th,textAlign:'left',minWidth:150}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:4}}>
                    <span style={{fontSize:22,fontWeight:700,color:'#1A1B2E'}}>Crew</span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <button style={{fontSize:15,fontWeight:600,border:'none',background:'none',cursor:'pointer',color:bulkMode?'#3B5BDB':'#6B7280',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",padding:0,textTransform:'none',letterSpacing:0}}
                        onClick={() => { setBulkMode(!bulkMode); setSelectedCrew([]) }}>
                        {bulkMode ? `☑ ${selectedCrew.length} valgt` : '☐ Velg flere'}
                      </button>
                      {bulkMode && selectedCrew.length > 0 && (
                        <button style={{...s.addBtn,padding:'3px 10px',fontSize:11}} onClick={() => setBulkOpen(true)}>
                          Book {selectedCrew.length}
                        </button>
                      )}
                    </div>
                  </div>
                </th>
                {days.map(d => <th key={dk(d)} style={{...s.th, background: filterDay===dk(d)?'#f0f7ff':undefined}}>{fmtDay(d)}</th>)}
              </tr></thead>
              <tbody>
                {filteredCal.length === 0 && <tr><td colSpan={8} style={s.empty}>Ingen crew matcher filteret.</td></tr>}
                {filteredCal.map(c => {
                  const col = COLORS[c.color_index % COLORS.length]
                  return <tr key={c.id}>
                    <td style={s.crewCell}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {bulkMode && (
                          <input type="checkbox" checked={selectedCrew.includes(c.id)}
                            onChange={e => setSelectedCrew(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
                            style={{width:16,height:16,cursor:'pointer',accentColor:'#3B5BDB'}} />
                        )}
                        <div style={s.crewInfo} onClick={() => bulkMode ? setSelectedCrew(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]) : openProfile(c)}>
                          <div style={{...s.avatar,background:col.bg,color:col.text}}>{c.initials}</div>
                          <div>
                            <span style={s.crewName}>{c.name}</span>
                            {filterFrom && filterTo && rangeDates.length > 0 && (
                              <div style={{fontSize:10,color:'#0F6E56',marginTop:1}}>
                                {periodFreeCounts[c.id] || 0} av {rangeDates.length} dager ledig
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const date = dk(d)
                      const st = getStatus(c.id, date)
                      const cfg = STATUS[st]
                      const booking = getBooking(c.id, date)
                      const isHighlighted = filterDay === date
                      const isInRange = filterFrom && filterTo && date >= filterFrom && date <= filterTo
                      const isFreeInRange = isInRange && st === 'free'
                      return <td key={date} style={{
                        ...s.dayCell,
                        background: isFreeInRange ? '#E8F8F0' : isHighlighted ? '#f0f7ff' : undefined,
                        borderTop: isFreeInRange ? '2px solid #1D9E75' : undefined
                      }}>
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

      {/* Mine prosjekter view */}
                      )}
                    </div>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:'#6B7280',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8}}>Datoer</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {dates.map(d => <span key={d} style={{background:'#EEF2FF',color:'#3B5BDB',borderRadius:20,padding:'4px 12px',fontSize:12,fontWeight:500}}>{new Date(d).toLocaleDateString('nb-NO',{weekday:'short',day:'numeric',month:'short'})}</span>)}
                  </div>
                </div>
              )
            })
          )}
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
              const today = new Date().toISOString().slice(0,10)
              const upcomingBookings = profileBookings.filter(b => b.date >= today && b.project)
              const pastBookings = profileBookings.filter(b => b.date < today && b.project)
              const totalJobs = profileBookings.filter(b => b.status === 'booked').length
              return <>
                <div style={{background:'linear-gradient(135deg,#3B5BDB,#7048E8)',margin:'-2rem -2rem 1.25rem',padding:'24px 24px 20px',borderRadius:'14px 14px 0 0'}}>
                  <div style={{width:60,height:60,borderRadius:'50%',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:'#fff',marginBottom:12}}>{c.initials}</div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    {editingName ? (
                      <div style={{display:'flex',gap:8,flex:1}}>
                        <input autoFocus style={{flex:1,fontSize:16,padding:'6px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,0.4)',background:'rgba(255,255,255,0.15)',color:'#fff',fontFamily:"'Avenir','Avenir Next',sans-serif",outline:'none'}} value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') saveName() }} />
                        <button style={{...s.miniBtn,background:'rgba(255,255,255,0.2)',border:'1px solid rgba(255,255,255,0.4)',color:'#fff'}} onClick={saveName}>Lagre</button>
                        <button style={{...s.clearBtn,color:'rgba(255,255,255,0.7)'}} onClick={() => setEditingName(false)}>Avbryt</button>
                      </div>
                    ) : (
                      <div style={{fontSize:22,fontWeight:700,color:'#fff'}}>{c.name}</div>
                    )}
                    {!editingName && <button style={{fontSize:11,color:'rgba(255,255,255,0.8)',background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontWeight:500}} onClick={() => { setEditingName(true); setNameInput(c.name) }}>Rediger navn</button>}
                  </div>
                  <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',marginTop:6,fontWeight:500}}>{c.rate} kr/t</div>
                  <div style={{display:'flex',gap:24,marginTop:14}}>
                    <div><div style={{fontSize:10,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:2}}>Ledige dager</div><div style={{fontSize:22,fontWeight:700,color:'#fff'}}>{freeDays} av 7</div></div>
                    <div><div style={{fontSize:10,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:2}}>Gjønnomførte jobber</div><div style={{fontSize:22,fontWeight:700,color:'#fff'}}>{totalJobs}</div></div>
                  </div>
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

                {/* Editable allergy */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Allergi / kosthold</div>
                    {!editingAllergy && <button style={s.editBtn} onClick={() => setEditingAllergy(true)}>Rediger</button>}
                  </div>
                  {editingAllergy ? (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {ALLERGIES.map(a => (
                          <button key={a} onClick={() => setAllergyInput(a === 'Ingen' ? '' : (allergyInput ? allergyInput + ', ' + a : a))}
                            style={{padding:'5px 12px',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:"'Avenir','Avenir Next',sans-serif",fontWeight:500,border:'1px solid #C7D0F0',background:allergyInput.includes(a)?'#3B5BDB':'#EEF2FF',color:allergyInput.includes(a)?'#fff':'#3B5BDB'}}>
                            {a}
                          </button>
                        ))}
                      </div>
                      <input style={{...s.formInput}} value={allergyInput} onChange={e => setAllergyInput(e.target.value)} placeholder="Eller skriv fritt..." onKeyDown={e => { if(e.key==='Enter') saveAllergy() }} />
                      <div style={{display:'flex',gap:8}}>
                        <button style={s.miniBtn} onClick={saveAllergy}>Lagre</button>
                        <button style={s.clearBtn} onClick={() => setEditingAllergy(false)}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:13,color: allergyInput ? '#A32D2D' : '#aaa'}}>{allergyInput || 'Ingen registrert'}</div>
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
                    <div style={{fontSize:13,color: certificateInput ? '#1A1B2E' : '#aaa'}}>{certificateInput || 'Ikke registrert'}</div>
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
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                    <div style={s.msecHdr}>Erfaringer/referanse</div>
                    {!editingNotes && <button style={s.editBtn} onClick={() => { setEditingNotes(true); setNotesInput(c.notes || '') }}>Rediger</button>}
                  </div>
                  {editingNotes ? (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <textarea style={{...s.formInput,resize:'vertical'}} rows={3} value={notesInput} onChange={e => setNotesInput(e.target.value)} placeholder='Erfaringer, referanser, tidligere jobber...' autoFocus />
                      <div style={{display:'flex',gap:8}}>
                        <button style={s.miniBtn} onClick={saveNotes}>Lagre</button>
                        <button style={s.clearBtn} onClick={() => setEditingNotes(false)}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{fontSize:13,color:c.notes?'#444':'#aaa',lineHeight:1.6,margin:0}}>{c.notes || 'Ingen erfaringer registrert'}</p>
                  )}
                </div>


                {upcomingBookings.length > 0 && <div style={s.msec}>
                  <div style={s.msecHdr}>Kommende bookinger</div>
                  {upcomingBookings.map((b,i) => <div key={i} style={{...s.bookingRow, background: i%2===0?'#fafaf8':undefined, padding:'8px 4px'}}>
                    <span style={s.bookingDay}>{new Date(b.date).toLocaleDateString('nb-NO',{day:'numeric',month:'short',year:'numeric'})}</span>
                    <span style={s.bookingProject}>{b.project}</span>
                    {b.booked_by && <span style={s.bookingBy}>av {b.booked_by}</span>}
                  </div>)}
                </div>}
                {pastBookings.length > 0 && <div style={s.msec}>
                  <div style={s.msecHdr}>Jobbhistorikk ({pastBookings.length} jobber)</div>
                  {pastBookings.map((b,i) => <div key={i} style={{...s.bookingRow, background: i%2===0?'#fafaf8':undefined, padding:'8px 4px'}}>
                    <span style={s.bookingDay}>{new Date(b.date).toLocaleDateString('nb-NO',{day:'numeric',month:'short',year:'numeric'})}</span>
                    <span style={s.bookingProject}>{b.project}</span>
                    {b.booked_by && <span style={s.bookingBy}>av {b.booked_by}</span>}
                  </div>)}
                </div>}
                {profileBookings.length === 0 && <div style={s.msec}>
                  <div style={s.msecHdr}>Jobbhistorikk</div>
                  <p style={{fontSize:13,color:'#aaa',margin:0}}>Ingen bookinger registrert enda.</p>
                </div>}

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
              </>
            })()}
          </div>
        </div>
      )}

      {/* Status change modal */}
      {view === 'mine' && (
        <div>
          <div style={{marginBottom:'1rem',fontSize:13,color:'#6B7280'}}>
            Viser prosjekter du har booket som <strong>{userName || 'deg'}</strong>
          </div>
          {loadingProjects && <div style={s.empty}>Laster prosjekter...</div>}
          {!loadingProjects && myProjects.length === 0 && (
            <div style={s.empty}>Ingen prosjekter funnet. Bookinger du gjør vises her.</div>
          )}
          {(() => {
            const today = new Date().toISOString().slice(0,10)
            const upcoming = myProjects.filter(p => p.bookings.some(b => b.date >= today))
            const past = myProjects.filter(p => p.bookings.every(b => b.date < today))
            return <>
              {upcoming.length > 0 && <>
                <div style={{fontSize:16,fontWeight:700,color:'#1A1B2E',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
                  🗓 Kommende prosjekter <span style={{fontSize:12,fontWeight:600,color:'#3B5BDB',background:'#EEF2FF',borderRadius:20,padding:'2px 10px'}}>{upcoming.length}</span>
                </div>
                {upcoming.map((p,i) => <ProjectCard key={i} p={p} i={i} crew={crew} />)}
              </>}
              {past.length > 0 && <>
                <div style={{fontSize:16,fontWeight:700,color:'#6B7280',marginBottom:12,marginTop:upcoming.length>0?24:0,display:'flex',alignItems:'center',gap:8}}>
                  ✅ Fullførte prosjekter <span style={{fontSize:12,fontWeight:600,color:'#6B7280',background:'#F0F2FF',borderRadius:20,padding:'2px 10px'}}>{past.length}</span>
                </div>
                {past.map((p,i) => <ProjectCard key={i+upcoming.length} p={p} i={i} crew={crew} />)}
              </>}
            </>
          })()}
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
          <div style={{...s.modal,maxWidth:520}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setAddOpen(false)}>✕</button>
            <div style={{fontSize:20,fontWeight:700,marginBottom:24,color:'#1A1B2E'}}>Legg til crew</div>

            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Fornavn *</label><input style={s.formInput} value={addForm.first} onChange={e => setAddForm(f=>({...f,first:e.target.value}))} placeholder="Sara" /></div>
              <div><label style={s.formLabel}>Etternavn *</label><input style={s.formInput} value={addForm.last} onChange={e => setAddForm(f=>({...f,last:e.target.value}))} placeholder="Haugen" /></div>
            </div>

            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Timelønn (kr) *</label><input style={s.formInput} type="number" value={addForm.rate} onChange={e => setAddForm(f=>({...f,rate:e.target.value}))} placeholder="600" /></div>
              <div><label style={s.formLabel}>Fødselsdato</label><input style={s.formInput} type="date" value={addForm.birthdate} onChange={e => setAddForm(f=>({...f,birthdate:e.target.value}))} /></div>
            </div>

            <div style={{marginBottom:16}}><label style={s.formLabel}>Bosted</label><input style={s.formInput} value={addForm.location} onChange={e => setAddForm(f=>({...f,location:e.target.value}))} placeholder="f.eks. Oslo" /></div>

            <div style={{marginBottom:16}}><label style={s.formLabel}>Allergi / kosthold</label><input style={s.formInput} value={addForm.allergy} onChange={e => setAddForm(f=>({...f,allergy:e.target.value}))} placeholder="f.eks. Laktose, gluten..." /></div>

            <div style={{marginBottom:16}}><label style={s.formLabel}>Kompetanse <span style={{fontWeight:400,textTransform:'none',letterSpacing:0}}>(kommaseparert)</span></label><input style={s.formInput} value={addForm.skills} onChange={e => setAddForm(f=>({...f,skills:e.target.value}))} placeholder="Sony FX9, Drone, Steadicam" /></div>

            <div style={{marginBottom:16}}><label style={s.formLabel}>Bio</label><textarea style={{...s.formInput,resize:'vertical'}} rows={2} value={addForm.bio} onChange={e => setAddForm(f=>({...f,bio:e.target.value}))} placeholder="Kort beskrivelse av erfaring..." /></div>

            <div style={{marginBottom:16}}><label style={s.formLabel}>Erfaringer/referanse</label><textarea style={{...s.formInput,resize:'vertical'}} rows={2} value={addForm.notes} onChange={e => setAddForm(f=>({...f,notes:e.target.value}))} placeholder="Erfaringer, referanser, tidligere jobber..." /></div>

            <div style={{marginBottom:20}}>
              <label style={s.formLabel}>Avatarfarge</label>
              <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
                {COLORS.map((col,i) => <div key={i} onClick={() => setAddForm(f=>({...f,colorIndex:i}))} style={{width:30,height:30,borderRadius:'50%',background:col.bg,cursor:'pointer',border:addForm.colorIndex===i?'3px solid #3B5BDB':'2px solid transparent',transition:'border 0.1s'}} />)}
              </div>
            </div>

            <p style={{fontSize:11,color:'#9CA3AF',marginBottom:12}}>* Obligatorisk felt</p>
            {addError && <p style={{fontSize:13,color:'#C92A2A',marginBottom:12,background:'#FFF0F0',padding:'8px 12px',borderRadius:7}}>{addError}</p>}
            <button style={s.submitBtn} onClick={addCrew} disabled={saving}>{saving?'Lagrer...':'Legg til crew'}</button>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div style={s.overlay} onClick={() => setBulkOpen(false)}>
          <div style={{...s.modal, maxWidth: 420}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setBulkOpen(false)}>✕</button>
            <div style={{fontSize:20,fontWeight:700,marginBottom:6,color:'#1A1B2E'}}>☑ Book {selectedCrew.length} crew</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:20}}>
              {selectedCrew.map(id => crew.find(c => c.id === id)?.name).join(', ')}
            </div>
            <div style={s.formRow2}>
              <div>
                <label style={s.formLabel}>Fra dato *</label>
                <input style={s.formInput} type="date" value={bulkFrom} onChange={e => setBulkFrom(e.target.value)} />
              </div>
              <div>
                <label style={s.formLabel}>Til dato *</label>
                <input style={s.formInput} type="date" value={bulkTo} onChange={e => setBulkTo(e.target.value)} />
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={s.formLabel}>Prosjekt / arrangement *</label>
              <input style={s.formInput} value={bulkProject} onChange={e => setBulkProject(e.target.value)} placeholder="f.eks. Telenor konferanse" autoFocus />
            </div>
            <div style={{marginBottom:20}}>
              <label style={s.formLabel}>Status</label>
              <select style={s.formInput} value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
                <option value="booked">Booket</option>
                <option value="requested">Forespurt</option>
                <option value="unavailable">Ikke tilgjengelig</option>
              </select>
            </div>
            {bulkFrom && bulkTo && bulkProject && (
              <div style={{fontSize:13,color:'#6B7280',marginBottom:16,background:'#EEF2FF',padding:'10px 14px',borderRadius:8}}>
                📅 {new Date(bulkFrom).toLocaleDateString('nb-NO')} — {new Date(bulkTo).toLocaleDateString('nb-NO')} · {Math.ceil((new Date(bulkTo)-new Date(bulkFrom))/(1000*60*60*24))+1} dager · {selectedCrew.length} crew
              </div>
            )}
            <button style={s.submitBtn} onClick={saveBulkBooking} disabled={bulkSaving || !bulkFrom || !bulkTo || !bulkProject}>
              {bulkSaving ? 'Booker...' : `Book ${selectedCrew.length} crew`}
            </button>
          </div>
        </div>
      )}

      {myProfileOpen && (
        <div style={s.overlay} onClick={() => setMyProfileOpen(false)}>
          <div style={{...s.modal,maxWidth:400}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setMyProfileOpen(false)}>✕</button>
            <div style={{background:'linear-gradient(135deg,#3B5BDB,#7048E8)',margin:'-2rem -2rem 1.5rem',padding:'24px',borderRadius:'14px 14px 0 0'}}>
              <div style={{fontSize:28,marginBottom:8}}>👤</div>
              <div style={{fontSize:20,fontWeight:700,color:'#fff'}}>{userName || 'Din profil'}</div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={s.formLabel}>Navn</label>
              <input style={s.formInput} value={userName} onChange={e => { localStorage.setItem('zcrew_username', e.target.value); }} placeholder="Ditt navn" onBlur={e => { localStorage.setItem('zcrew_username', e.target.value); }} />
            </div>
            <div style={{marginBottom:14}}>
              <label style={s.formLabel}>Tittel / rolle</label>
              <input style={s.formInput} value={myProfileForm.title} onChange={e => setMyProfileForm(f => ({...f, title: e.target.value}))} placeholder="f.eks. Prosjektleder" />
            </div>
            <div style={{marginBottom:14}}>
              <label style={s.formLabel}>Telefonnummer</label>
              <input style={s.formInput} value={myProfileForm.phone} onChange={e => setMyProfileForm(f => ({...f, phone: e.target.value}))} placeholder="f.eks. 98765432" type="tel" />
            </div>
            <div style={{marginBottom:20}}>
              <label style={s.formLabel}>E-post</label>
              <input style={s.formInput} value={myProfileForm.email} onChange={e => setMyProfileForm(f => ({...f, email: e.target.value}))} placeholder="navn@zevent.no" type="email" />
            </div>
            <button style={s.submitBtn} onClick={saveMyProfile}>Lagre profil</button>
            <button style={{...s.submitBtn,marginTop:10,background:'none',border:'1px solid #C7D0F0',color:'#3B5BDB',boxShadow:'none'}} onClick={() => { setMyProfileOpen(false); setChangePasswordOpen(true); setPasswordError(''); setPasswordSuccess(false) }}>🔑 Bytt passord</button>
          </div>
        </div>
      )}

      {settingName && (
        <div style={s.overlay} onClick={() => { if(userName) setSettingName(false) }}>
          <div style={{...s.modal, maxWidth: 380}} onClick={e => e.stopPropagation()}>
            {userName && <button style={s.closeBtn} onClick={() => setSettingName(false)}>✕</button>}
            <div style={{fontSize:20,fontWeight:700,marginBottom:8,color:'#1A1B2E'}}>👤 Ditt navn</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:20}}>Skriv inn navnet ditt slik det skal vises når du booker crew.</div>
            <label style={s.formLabel}>Navn</label>
            <input style={{...s.formInput, marginBottom:16}} value={nameInputVal} onChange={e => setNameInputVal(e.target.value)} placeholder="f.eks. Sigrid Flesjå" autoFocus onKeyDown={e => { if(e.key==='Enter') saveUserName() }} />
            <button style={s.submitBtn} onClick={saveUserName}>Lagre navn</button>
          </div>
        </div>
      )}

      {changePasswordOpen && (
        <div style={s.overlay} onClick={() => setChangePasswordOpen(false)}>
          <div style={{...s.modal, maxWidth: 380}} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setChangePasswordOpen(false)}>✕</button>
            <div style={{fontSize:20,fontWeight:700,marginBottom:8,color:'#1A1B2E'}}>Bytt passord 🔑</div>
            <div style={{fontSize:13,color:'#6B7280',marginBottom:20}}>Velg et nytt passord for din konto.</div>
            {passwordSuccess ? (
              <div style={{textAlign:'center',padding:'1.5rem',color:'#0F6E56',fontSize:15,fontWeight:600}}>✅ Passordet er oppdatert!</div>
            ) : (
              <>
                <label style={s.formLabel}>Nytt passord</label>
                <input style={{...s.formInput, marginBottom:14}} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minst 6 tegn" autoFocus />
                <label style={s.formLabel}>Bekreft passord</label>
                <input style={{...s.formInput, marginBottom:14}} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Gjenta passordet" onKeyDown={e => { if(e.key==='Enter') saveNewPassword() }} />
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
  page:{maxWidth:1200,margin:'0 auto',padding:'2rem 1.5rem',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",color:'#1A1B2E',position:'relative',minHeight:'100vh',background:'#F8F9FE'},
  loading:{padding:'3rem',textAlign:'center',color:'#6B7280',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  header:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'2rem',flexWrap:'wrap',gap:12,borderBottom:'1px solid #E5E7F0',paddingBottom:'1.25rem'},
  headerRight:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'},
  brand:{fontSize:11,fontWeight:700,color:'#4C6EF5',letterSpacing:'0.15em',textTransform:'uppercase'},
  title:{fontSize:28,fontWeight:700,margin:0,letterSpacing:'-0.02em',color:'#1A1B2E'},
  addBtn:{padding:'10px 20px',fontSize:14,fontWeight:600,borderRadius:8,border:'none',background:'linear-gradient(135deg, #3B5BDB, #7048E8)',color:'#fff',cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(76,110,245,0.3)'},
  changePassBtn:{padding:'10px 18px',fontSize:13,borderRadius:8,border:'1px solid #E5E7F0',background:'#fff',color:'#6B7280',cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  logoutBtn:{padding:'10px 18px',fontSize:13,borderRadius:8,border:'1px solid #E5E7F0',background:'#fff',color:'#6B7280',cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  tabs:{display:'flex',gap:2,background:'#E8ECF8',borderRadius:8,padding:3},
  tab:{padding:'8px 18px',fontSize:13,fontWeight:500,border:'none',background:'transparent',color:'#6B7280',borderRadius:6,cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  tabActive:{background:'#fff',color:'#3B5BDB',fontWeight:700,boxShadow:'0 1px 4px rgba(59,91,219,0.15)'},
  filterBar:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:'0.75rem',alignItems:'center'},
  periodBar:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:'1rem',alignItems:'center',padding:'12px 16px',background:'#fff',borderRadius:10,border:'1px solid #E5E7F0'},
  dateInput:{fontSize:13,padding:'7px 10px',borderRadius:7,border:'1px solid #C7D0F0',background:'#F8F9FE',color:'#1A1B2E',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  filterBadge:{fontSize:12,fontWeight:600,color:'#3B5BDB',background:'#EEF2FF',borderRadius:20,padding:'4px 12px',whiteSpace:'nowrap'},
  filterInfo:{fontSize:12,color:'#6B7280',marginBottom:'0.75rem',padding:'8px 12px',background:'#EEF2FF',borderRadius:8,borderLeft:'3px solid #4C6EF5'},
  select:{fontSize:14,padding:'9px 12px',borderRadius:8,border:'1px solid #C7D0F0',background:'#fff',color:'#1A1B2E',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  search:{fontSize:14,padding:'9px 12px',borderRadius:8,border:'1px solid #C7D0F0',background:'#fff',color:'#1A1B2E',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",minWidth:180},
  clearBtn:{fontSize:12,color:'#6B7280',background:'none',border:'none',cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",padding:'4px 8px'},
  weekNav:{display:'flex',alignItems:'center',gap:12,marginBottom:'1rem'},
  navBtn:{background:'#fff',border:'1px solid #C7D0F0',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:500,color:'#1A1B2E',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  weekLabel:{fontSize:16,fontWeight:600,color:'#1A1B2E'},
  legend:{display:'flex',gap:16,flexWrap:'wrap',marginBottom:'1rem'},
  legendItem:{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#6B7280',fontWeight:500},
  dot:{width:10,height:10,borderRadius:'50%',display:'inline-block'},
  tableWrap:{overflowX:'auto',background:'#fff',borderRadius:12,border:'1px solid #E5E7F0',overflow:'hidden'},
  table:{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:580},
  th:{padding:'12px 10px',fontWeight:700,color:'#6B7280',textAlign:'center',fontSize:11,borderBottom:'1px solid #E5E7F0',letterSpacing:'0.06em',textTransform:'uppercase',background:'#F8F9FE'},
  crewCell:{padding:'10px 14px',borderBottom:'1px solid #F0F2FF',whiteSpace:'nowrap',background:'#fff'},
  crewInfo:{display:'flex',alignItems:'center',gap:10,cursor:'pointer'},
  avatar:{width:34,height:34,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0},
  crewName:{fontSize:15,fontWeight:600,color:'#1A1B2E'},
  dayCell:{padding:'10px 8px',textAlign:'center',borderBottom:'1px solid #F0F2FF',borderLeft:'1px solid #F0F2FF',minWidth:110,verticalAlign:'top',background:'#fff'},
  pill:{display:'inline-flex',alignItems:'center',justifyContent:'center',width:34,height:34,borderRadius:'50%',fontSize:11,cursor:'pointer',fontWeight:700,border:'none',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif"},
  projectLabel:{fontSize:10,color:'#4C6EF5',lineHeight:1.4,marginTop:3,wordBreak:'break-word',maxWidth:100,textAlign:'center',fontWeight:500},
  bookedByLabel:{fontSize:9,color:'#9CA3AF',lineHeight:1.3,textAlign:'center'},
  crewGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16},
  crewCard:{background:'#fff',borderRadius:12,border:'1px solid #E5E7F0',padding:'1.5rem',cursor:'pointer',transition:'all 0.15s',boxShadow:'0 1px 3px rgba(59,91,219,0.05)'},
  rate:{fontSize:24,fontWeight:700,color:'#1A1B2E'},
  rateUnit:{fontSize:13,fontWeight:400,color:'#6B7280'},
  skillTag:{background:'#EEF2FF',border:'none',borderRadius:20,padding:'4px 10px',fontSize:11,color:'#3B5BDB',fontWeight:500},
  overlay:{position:'fixed',inset:0,background:'rgba(26,27,46,0.5)',zIndex:100,display:'flex',alignItems:'flex-start',justifyContent:'center',paddingTop:'2rem'},
  modal:{background:'#fff',borderRadius:16,border:'1px solid #E5E7F0',padding:'2rem',width:'100%',maxWidth:520,position:'relative',maxHeight:'88vh',overflowY:'auto',margin:'0 1rem',boxShadow:'0 8px 32px rgba(59,91,219,0.12)'},
  closeBtn:{position:'absolute',top:14,right:14,background:'#F0F2FF',border:'none',fontSize:16,cursor:'pointer',color:'#6B7280',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'},
  editBtn:{fontSize:11,color:'#4C6EF5',background:'#EEF2FF',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",fontWeight:500},
  modalAvatar:{width:64,height:64,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,marginBottom:12},
  infoGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:'1.1rem'},
  infoCell:{background:'#F8F9FE',borderRadius:10,padding:'12px 14px',border:'1px solid #E5E7F0'},
  statsGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:'1.1rem'},
  statCard:{background:'linear-gradient(135deg, #EEF2FF, #F0F2FF)',borderRadius:10,padding:'12px 14px',border:'1px solid #C7D0F0'},
  statLabel:{fontSize:11,color:'#6B7280',marginBottom:4,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em'},
  statVal:{fontSize:20,fontWeight:700,color:'#3B5BDB'},
  msec:{marginTop:'1.25rem'},
  msecHdr:{fontSize:12,fontWeight:700,color:'#1A1B2E',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8},
  bookingRow:{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #F0F2FF',fontSize:13},
  bookingDay:{color:'#6B7280',minWidth:90,fontSize:12,fontWeight:500},
  bookingProject:{fontWeight:600,color:'#1A1B2E',flex:1},
  bookingBy:{fontSize:11,color:'#9CA3AF'},
  skillRow:{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid #F0F2FF'},
  skillName:{fontSize:13,fontWeight:600,color:'#1A1B2E',minWidth:120},
  comment:{flex:1,fontSize:12,color:'#6B7280',lineHeight:1.5,cursor:'pointer',padding:'3px 6px',borderRadius:5},
  commentEmpty:{color:'#9CA3AF',fontStyle:'italic'},
  commentInput:{flex:1,fontSize:12,padding:'5px 9px',borderRadius:7,border:'1px solid #C7D0F0',background:'#F8F9FE',color:'#1A1B2E',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",outline:'none'},
  delSkill:{background:'none',border:'none',cursor:'pointer',color:'#9CA3AF',fontSize:13,padding:'2px 4px',lineHeight:1,fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",flexShrink:0},
  miniBtn:{padding:'6px 12px',fontSize:12,borderRadius:7,border:'1px solid #C7D0F0',background:'#fff',color:'#3B5BDB',cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",whiteSpace:'nowrap',fontWeight:500},
  statusOpt:{padding:'12px 14px',borderRadius:9,border:'1px solid #E5E7F0',cursor:'pointer',display:'flex',alignItems:'center',gap:12,background:'#fff',textAlign:'left',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",fontSize:14,color:'#1A1B2E',width:'100%',marginBottom:8,fontWeight:500},
  formRow2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16},
  formLabel:{display:'block',fontSize:12,fontWeight:600,color:'#6B7280',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'},
  formInput:{width:'100%',padding:'10px 12px',fontSize:14,borderRadius:8,border:'1px solid #C7D0F0',background:'#F8F9FE',color:'#1A1B2E',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",boxSizing:'border-box'},
  submitBtn:{width:'100%',padding:12,fontSize:14,borderRadius:9,border:'none',background:'linear-gradient(135deg, #3B5BDB, #7048E8)',color:'#fff',cursor:'pointer',fontFamily:"'Avenir', 'Avenir Next', 'Century Gothic', 'Nunito', sans-serif",fontWeight:700,marginTop:6,boxShadow:'0 2px 8px rgba(76,110,245,0.3)'},
  empty:{padding:'3rem',textAlign:'center',color:'#9CA3AF',fontSize:14},
  toast:{position:'fixed',bottom:'1.5rem',left:'50%',transform:'translateX(-50%)',background:'#1A1B2E',border:'none',borderRadius:10,padding:'10px 20px',fontSize:13,color:'#fff',zIndex:300,whiteSpace:'nowrap',boxShadow:'0 4px 12px rgba(26,27,46,0.3)',fontWeight:500},
}
