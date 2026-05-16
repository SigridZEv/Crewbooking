import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { COLORS, ALLERGIES, STATUS, CATEGORIES } from '../lib/constants'
import { getWeekDates, fmtDay, dk, getMonthDates, fmtMonth } from '../lib/dateUtils'
import { s } from '../lib/styles'

export default function BookingPage({ user }) {
  const [view, setView] = useState('cal')
  const [crew, setCrew] = useState([])
  const [bookings, setBookings] = useState({})
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [calMode, setCalMode] = useState('week') // 'week' | 'month'
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
  const [addForm, setAddForm] = useState({ first: '', last: '', rate: '', jobs: '', bio: '', skills: '', colorIndex: 0, phone: '', email: '', employment_form: '', category: '', is_new: false, birthdate: '', location: '', allergy: '', certificate: '' })
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
  const [editingCategory, setEditingCategory] = useState(false)
  const [categoryInput, setCategoryInput] = useState('')
  // pendingIsNew: null = no pending change, true/false = local edit that needs to be saved
  const [pendingIsNew, setPendingIsNew] = useState(null)
  // Local buffers — all changes to skills/comments live here until saveAll commits them.
  // Skills excludes allergi/sertifikat (those are handled via allergyInput/certificateInput).
  // New items get an id starting with '_tmp_' so we can tell pending-adds from existing ones.
  const [localSkills, setLocalSkills] = useState([])
  const [localComments, setLocalComments] = useState([])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadCrew = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('crew').select('*, skills(*)').order('name')
    if (data) setCrew(data)
    setLoading(false)
  }, [])

  const loadBookings = useCallback(async () => {
    const days = calMode === 'month' ? getMonthDates(monthOffset) : getWeekDates(weekOffset)
    const { data } = await supabase.from('bookings').select('*').gte('date', dk(days[0])).lte('date', dk(days[days.length - 1]))
    if (data) {
      const map = {}
      data.forEach(b => { map[b.crew_id + '_' + b.date] = b })
      setBookings(map)
    }
  }, [weekOffset, monthOffset, calMode])

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
    return b ? b.status : 'free'
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
    setLocalComments([])
    setNewComment('')
    supabase.from('crew_comments').select('*').eq('crew_id', c.id).order('created_at', { ascending: true }).then(({ data }) => {
      if (data) {
        setCrewComments(data)
        setLocalComments(data)
      }
    })
    // Initialize local skills buffer (excluding allergi/sertifikat which are handled separately)
    setLocalSkills((c.skills || []).filter(sk => !sk.name.startsWith('Allergi:') && !sk.name.startsWith('Sertifikat:')))
    setNewSkillInput('')
    setEditingComment(null)
    setCertificateInput(certSk ? certSk.name.replace('Sertifikat: ', '').replace('Sertifikat:', '').trim() : '')
    setEditingName(false)
    setNameInput(c.name)
    setEditingCategory(false)
    setCategoryInput(c.category || '')
    setPendingIsNew(null)
    setEditingLocation(false)
    setLocationInput(c.location || '')
    setEditingNotes(false)
    setNotesInput(c.notes || '')
    setEditingBirthdate(false)
    setBirthdateInput(c.birthdate || '')
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

  async function saveCategory() {
    if (!profileOpen) return
    const newVal = categoryInput || ''
    await supabase.from('crew').update({ category: newVal }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, category: newVal } : c))
    setProfileOpen(prev => ({ ...prev, category: newVal }))
    setEditingCategory(false)
    showToast('Kategori oppdatert')
  }

  // Compare current pending values with the persisted ones.
  function isDirty() {
    if (!profileOpen) return false
    const c = profileOpen
    if (nameInput.trim() !== c.name) return true
    if (bioInput !== (c.bio || '')) return true
    const parsedRate = parseInt(rateInput, 10)
    if (!Number.isNaN(parsedRate) && parsedRate !== c.rate) return true
    if (categoryInput !== (c.category || '')) return true
    if (pendingIsNew !== null && pendingIsNew !== !!c.is_new) return true
    if (notesInput !== (c.notes || '')) return true
    if (locationInput !== (c.location || '')) return true
    if ((birthdateInput || '') !== (c.birthdate || '')) return true
    const existingAllergy = (c.skills || []).find(sk => sk.name.startsWith('Allergi:'))
    const currAllergy = existingAllergy ? existingAllergy.name.replace(/^Allergi:\s*/, '').trim() : ''
    if ((allergyInput || '').trim() !== currAllergy) return true
    const existingCert = (c.skills || []).find(sk => sk.name.startsWith('Sertifikat:'))
    const currCert = existingCert ? existingCert.name.replace(/^Sertifikat:\s*/, '').trim() : ''
    if ((certificateInput || '').trim() !== currCert) return true
    // Skills (non-allergi/sertifikat) changes
    const originalSkills = (c.skills || []).filter(sk => !sk.name.startsWith('Allergi:') && !sk.name.startsWith('Sertifikat:'))
    if (localSkills.length !== originalSkills.length) return true
    const origById = Object.fromEntries(originalSkills.map(s => [s.id, s]))
    for (const ls of localSkills) {
      if (String(ls.id).startsWith('_tmp_')) return true
      const orig = origById[ls.id]
      if (!orig || (ls.comment || '') !== (orig.comment || '')) return true
    }
    // Comments changes
    if (localComments.length !== crewComments.length) return true
    const crewCommentIds = new Set(crewComments.map(cc => cc.id))
    const localIds = new Set(localComments.map(lc => lc.id))
    for (const lc of localComments) {
      if (String(lc.id).startsWith('_tmp_')) return true
      if (!crewCommentIds.has(lc.id)) return true
    }
    for (const cc of crewComments) {
      if (!localIds.has(cc.id)) return true
    }
    return false
  }

  // Commit all pending field edits to the database in one shot.
  async function saveAll() {
    if (!profileOpen) return
    const c = profileOpen

    // Validation: name cannot be blank
    const trimmedName = nameInput.trim()
    if (!trimmedName) {
      showToast('Navn kan ikke være tomt')
      return
    }
    // Validation: rate must be a positive number if changed
    const parsedRate = parseInt(rateInput, 10)
    if (Number.isNaN(parsedRate) || parsedRate < 0) {
      showToast('Timepris må være et tall')
      return
    }

    setSaving(true)

    // Build the crew-table update payload (only changed columns)
    const updates = {}
    if (trimmedName !== c.name) {
      updates.name = trimmedName
      updates.initials = trimmedName.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    }
    if (bioInput !== (c.bio || '')) updates.bio = bioInput
    if (parsedRate !== c.rate) updates.rate = parsedRate
    if (categoryInput !== (c.category || '')) updates.category = categoryInput
    if (pendingIsNew !== null && pendingIsNew !== !!c.is_new) updates.is_new = pendingIsNew
    if (notesInput !== (c.notes || '')) updates.notes = notesInput
    if (locationInput !== (c.location || '')) updates.location = locationInput
    if ((birthdateInput || '') !== (c.birthdate || '')) updates.birthdate = birthdateInput || null

    if (Object.keys(updates).length > 0) {
      await supabase.from('crew').update(updates).eq('id', c.id)
    }

    // Allergi (skills row med 'Allergi:'-prefix)
    const existingAllergy = (c.skills || []).find(sk => sk.name.startsWith('Allergi:'))
    const allergyText = (allergyInput || '').trim()
    if (existingAllergy && allergyText && allergyText !== existingAllergy.name.replace(/^Allergi:\s*/, '').trim()) {
      await supabase.from('skills').update({ name: 'Allergi: ' + allergyText }).eq('id', existingAllergy.id)
    } else if (existingAllergy && !allergyText) {
      await supabase.from('skills').delete().eq('id', existingAllergy.id)
    } else if (!existingAllergy && allergyText) {
      await supabase.from('skills').insert({ crew_id: c.id, name: 'Allergi: ' + allergyText, comment: '' })
    }

    // Sertifikat (skills row med 'Sertifikat:'-prefix)
    const existingCert = (c.skills || []).find(sk => sk.name.startsWith('Sertifikat:'))
    const certText = (certificateInput || '').trim()
    if (existingCert && certText && certText !== existingCert.name.replace(/^Sertifikat:\s*/, '').trim()) {
      await supabase.from('skills').update({ name: 'Sertifikat: ' + certText }).eq('id', existingCert.id)
    } else if (existingCert && !certText) {
      await supabase.from('skills').delete().eq('id', existingCert.id)
    } else if (!existingCert && certText) {
      await supabase.from('skills').insert({ crew_id: c.id, name: 'Sertifikat: ' + certText, comment: '' })
    }

    // Skills (non-allergi/sertifikat)
    const originalSkills = (c.skills || []).filter(sk => !sk.name.startsWith('Allergi:') && !sk.name.startsWith('Sertifikat:'))
    const origSkillsById = Object.fromEntries(originalSkills.map(s => [s.id, s]))
    const localSkillIds = new Set(localSkills.map(s => s.id))
    // Inserts
    const toInsertSkills = localSkills
      .filter(ls => String(ls.id).startsWith('_tmp_'))
      .map(ls => ({ crew_id: c.id, name: ls.name, comment: ls.comment || '' }))
    if (toInsertSkills.length > 0) {
      await supabase.from('skills').insert(toInsertSkills)
    }
    // Deletes
    const toDeleteSkills = originalSkills.filter(os => !localSkillIds.has(os.id)).map(os => os.id)
    if (toDeleteSkills.length > 0) {
      await supabase.from('skills').delete().in('id', toDeleteSkills)
    }
    // Comment updates on existing skills
    for (const ls of localSkills) {
      if (String(ls.id).startsWith('_tmp_')) continue
      const orig = origSkillsById[ls.id]
      if (orig && (ls.comment || '') !== (orig.comment || '')) {
        await supabase.from('skills').update({ comment: ls.comment || '' }).eq('id', ls.id)
      }
    }

    // Comments (erfaring/referanser)
    const crewCommentIds = new Set(crewComments.map(cc => cc.id))
    const localCommentIds = new Set(localComments.map(lc => lc.id))
    const toInsertComments = localComments
      .filter(lc => String(lc.id).startsWith('_tmp_'))
      .map(lc => ({
        crew_id: c.id,
        author: lc.author,
        author_id: lc.author_id,
        content: lc.content,
      }))
    if (toInsertComments.length > 0) {
      await supabase.from('crew_comments').insert(toInsertComments)
    }
    const toDeleteComments = crewComments.filter(cc => !localCommentIds.has(cc.id)).map(cc => cc.id)
    if (toDeleteComments.length > 0) {
      await supabase.from('crew_comments').delete().in('id', toDeleteComments)
    }

    // Reload crew list so the calendar view stays in sync
    await loadCrew()
    // Refetch THIS crew with its skills so localSkills/profileOpen have real DB ids (no more _tmp_)
    const { data: freshCrew } = await supabase.from('crew').select('*, skills(*)').eq('id', c.id).single()
    if (freshCrew) {
      setProfileOpen(freshCrew)
      setLocalSkills((freshCrew.skills || []).filter(sk => !sk.name.startsWith('Allergi:') && !sk.name.startsWith('Sertifikat:')))
    }
    // Reload comments so we have proper DB ids/timestamps
    const { data: freshComments } = await supabase.from('crew_comments').select('*').eq('crew_id', c.id).order('created_at', { ascending: true })
    if (freshComments) {
      setCrewComments(freshComments)
      setLocalComments(freshComments)
    }
    setPendingIsNew(null)
    setSaving(false)
    showToast('Endringer lagret')
  }

  // Discard all pending field edits and reset inputs to the persisted values.
  function cancelAll() {
    if (!profileOpen) return
    const c = profileOpen
    setBioInput(c.bio || '')
    setRateInput(String(c.rate))
    setCategoryInput(c.category || '')
    setPendingIsNew(null)
    setNotesInput(c.notes || '')
    setLocationInput(c.location || '')
    setBirthdateInput(c.birthdate || '')
    setNameInput(c.name)
    const allergySk = (c.skills || []).find(sk => sk.name.startsWith('Allergi:'))
    setAllergyInput(allergySk ? allergySk.name.replace(/^Allergi:\s*/, '').trim() : '')
    const certSk = (c.skills || []).find(sk => sk.name.startsWith('Sertifikat:'))
    setCertificateInput(certSk ? certSk.name.replace(/^Sertifikat:\s*/, '').trim() : '')
    setEditingBio(false)
    setEditingRate(false)
    setEditingCategory(false)
    setEditingNotes(false)
    setEditingLocation(false)
    setEditingBirthdate(false)
    setEditingName(false)
    setEditingAllergy(false)
    setEditingCertificate(false)
    // Reset skills + comments back to persisted state
    setLocalSkills((c.skills || []).filter(sk => !sk.name.startsWith('Allergi:') && !sk.name.startsWith('Sertifikat:')))
    setLocalComments(crewComments)
    setNewSkillInput('')
    setNewComment('')
    setEditingComment(null)
    showToast('Endringer forkastet')
  }

  // Try to close the profile modal. If there are unsaved changes, ask first.
  function tryCloseProfile() {
    if (isDirty()) {
      const ok = window.confirm('Du har ulagrede endringer. Lukk uten å lagre?')
      if (!ok) return
    }
    setProfileOpen(null)
  }

  // Toggle the local pending value without saving. If the new value matches
  // the persisted value, clear the pending state (user toggled back).
  function toggleNewPending() {
    if (!profileOpen) return
    const current = pendingIsNew !== null ? pendingIsNew : !!profileOpen.is_new
    const next = !current
    setPendingIsNew(next === !!profileOpen.is_new ? null : next)
  }

  async function saveNewFlag() {
    if (!profileOpen || pendingIsNew === null) return
    const newVal = pendingIsNew
    await supabase.from('crew').update({ is_new: newVal }).eq('id', profileOpen.id)
    setCrew(prev => prev.map(c => c.id === profileOpen.id ? { ...c, is_new: newVal } : c))
    setProfileOpen(prev => ({ ...prev, is_new: newVal }))
    setPendingIsNew(null)
    showToast(newVal ? 'Markert som NY' : 'Fjernet NY-merket')
  }

  // Local-only: adds the comment to localComments with a temporary id. Persisted on saveAll.
  function addCrewComment() {
    if (!newComment.trim() || !profileOpen) return
    const tempId = '_tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    setLocalComments(prev => [...prev, {
      id: tempId,
      crew_id: profileOpen.id,
      author: userName || 'Ukjent',
      author_id: userId,
      content: newComment.trim(),
      created_at: new Date().toISOString(),
    }])
    setNewComment('')
  }

  // Local-only: removes the comment from localComments. Persisted on saveAll.
  function deleteCrewComment(id) {
    setLocalComments(prev => prev.filter(c => c.id !== id))
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
    const { first, last, rate, jobs, bio, skills: skillsRaw, colorIndex, phone, email, employment_form, category, is_new, birthdate, location, allergy, certificate } = addForm
    if (!first || !last || !rate) { setAddError('Fyll ut alle obligatoriske felt.'); return }
    setAddError(''); setSaving(true)
    const insertPayload = {
      name: (first.trim() + ' ' + last.trim()),
      initials: (first[0] + last[0]).toUpperCase(),
      rate: parseInt(rate, 10),
      jobs: parseInt(jobs, 10) || 0,
      bio: bio || '',
      color_index: colorIndex,
      phone: phone || '',
      email: email || '',
      employment_form: employment_form || '',
      category: category || '',
      is_new: !!is_new,
      birthdate: birthdate || null,
      location: location || '',
    }
    const { data: newCrew, error } = await supabase.from('crew').insert(insertPayload).select().single()
    if (error || !newCrew) { setAddError('Noe gikk galt.'); setSaving(false); return }
    // Generic skills (comma-separated)
    const skillRows = []
    if (skillsRaw.trim()) {
      skillRows.push(...skillsRaw.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ crew_id: newCrew.id, name: s, comment: '' })))
    }
    // Allergi and Sertifikat as special-prefixed skill rows (same convention as the profile modal)
    if (allergy && allergy.trim()) {
      skillRows.push({ crew_id: newCrew.id, name: 'Allergi: ' + allergy.trim(), comment: '' })
    }
    if (certificate && certificate.trim()) {
      skillRows.push({ crew_id: newCrew.id, name: 'Sertifikat: ' + certificate.trim(), comment: '' })
    }
    if (skillRows.length > 0) {
      await supabase.from('skills').insert(skillRows)
    }
    await loadCrew()
    setAddOpen(false)
    setAddForm({ first: '', last: '', rate: '', jobs: '', bio: '', skills: '', colorIndex: 0, phone: '', email: '', employment_form: '', category: '', is_new: false, birthdate: '', location: '', allergy: '', certificate: '' })
    setSaving(false)
    showToast(first + ' ' + last + ' er lagt til!')
  }

  // Local-only: adds the skill to localSkills with a temporary id. Persisted on saveAll.
  function addSkill() {
    if (!newSkillInput.trim() || !profileOpen) return
    const tempId = '_tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    setLocalSkills(prev => [...prev, { id: tempId, name: newSkillInput.trim(), comment: '' }])
    setNewSkillInput('')
  }

  // Local-only: removes the skill from localSkills. Persisted on saveAll.
  function deleteSkill(skillId) {
    setLocalSkills(prev => prev.filter(s => s.id !== skillId))
  }

  // Local-only: updates the comment of a skill in localSkills. Persisted on saveAll.
  function saveComment(skillId, comment) {
    setLocalSkills(prev => prev.map(s => s.id === skillId ? { ...s, comment } : s))
    setEditingComment(null)
  }

  async function logout() { await supabase.auth.signOut() }

  const days = calMode === 'month' ? getMonthDates(monthOffset) : getWeekDates(weekOffset)

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

  const todayStr = dk(new Date())

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <img src="/Z_logo.png" alt="Z Event" style={s.brandLogo} />
          <div>
            <span style={s.brand}>Z Event</span>
            <h1 style={s.title}>Crew Portal</h1>
          </div>
        </div>
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
            <div style={s.calModeToggle}>
              <button style={calMode === 'week' ? s.calModeBtnActive : s.calModeBtn} onClick={() => setCalMode('week')}>Uke</button>
              <button style={calMode === 'month' ? s.calModeBtnActive : s.calModeBtn} onClick={() => setCalMode('month')}>Måned</button>
            </div>
            {calMode === 'week' ? (
              <>
                <button style={s.navBtn} onClick={() => setWeekOffset(w => w-1)}>Forrige</button>
                {weekOffset !== 0 && <button style={s.todayBtn} onClick={() => setWeekOffset(0)}>I dag</button>}
                <span style={s.weekLabel}>{days[0].toLocaleDateString('nb-NO',{day:'numeric',month:'long'})} - {days[days.length-1].toLocaleDateString('nb-NO',{day:'numeric',month:'long',year:'numeric'})}</span>
                <button style={s.navBtn} onClick={() => setWeekOffset(w => w+1)}>Neste</button>
              </>
            ) : (
              <>
                <button style={s.navBtn} onClick={() => setMonthOffset(m => m-1)}>Forrige</button>
                {monthOffset !== 0 && <button style={s.todayBtn} onClick={() => setMonthOffset(0)}>I dag</button>}
                <span style={s.weekLabel}>{fmtMonth(days[0])}</span>
                <button style={s.navBtn} onClick={() => setMonthOffset(m => m+1)}>Neste</button>
              </>
            )}
          </div>
          <div style={s.legend}>
            {Object.entries(STATUS).map(([k,v]) => <span key={k} style={s.legendItem}><span style={{...s.dot,background:v.bg,border:'1px solid '+v.c}}/>{v.full}</span>)}
          </div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead><tr>
                <th style={{...s.th,textAlign:'left',minWidth:150}}>Crew</th>
                {days.map((d, i) => {
                  const dStr = dk(d)
                  const dow = d.getDay() // 0=Sun, 6=Sat
                  const isWeekend = dow === 0 || dow === 6
                  const isToday = dStr === todayStr
                  return <th key={dStr} style={{
                    ...s.th,
                    ...(calMode === 'month' ? {minWidth:30, padding:'6px 2px', fontSize:10} : {}),
                    ...(isWeekend ? s.weekendHeader : {}),
                    ...(isToday ? s.todayHeader : {}),
                    ...(filterDay===dStr ? {background:'#f0f7ff'} : {}),
                  }}>{calMode === 'month' ? d.getDate() : fmtDay(d)}</th>
                })}
              </tr></thead>
              <tbody>
                {filteredCal.length === 0 && <tr><td colSpan={8} style={s.empty}>Ingen crew matcher filteret.</td></tr>}
                {filteredCal.map(c => {
                  const col = COLORS[c.color_index % COLORS.length]
                  return <tr key={c.id}>
                    <td style={s.crewCell}>
                      <div style={s.crewInfo} onClick={() => openProfile(c)}>
                        <div style={{...s.avatar,background:col.bg,color:col.text}}>{c.initials}</div>
                        <span style={s.crewName}>{c.name}{c.is_new && <span style={s.newStar}>★ NY</span>}</span>
                      </div>
                    </td>
                    {days.map((d, i) => {
                      const date = dk(d)
                      const st = getStatus(c.id, date)
                      const cfg = STATUS[st]
                      const booking = getBooking(c.id, date)
                      const isHighlighted = filterDay === date
                      const dow = d.getDay()
                      const isWeekend = dow === 0 || dow === 6
                      const isToday = date === todayStr
                      return <td key={date} style={{
                        ...s.dayCell,
                        ...(calMode === 'month' ? {minWidth:30, padding:'4px 2px'} : {}),
                        ...(isWeekend ? s.weekendCell : {}),
                        ...(isToday ? s.todayCell : {}),
                        ...(isHighlighted ? {background:'#f0f7ff'} : {}),
                      }}>
                        {calMode === 'month' ? (
                          <button style={{...s.miniPill,background:cfg.bg}}
                            title={booking && booking.project ? cfg.full + ' — ' + booking.project : cfg.full}
                            onClick={() => openChange(c, date, fmtDay(d))} />
                        ) : (
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                            <button style={{...s.pill,background:cfg.bg,color:cfg.c}}
                              title={booking && booking.project ? cfg.full + ' - ' + booking.project : cfg.full}
                              onClick={() => openChange(c, date, fmtDay(d))}>{cfg.short}</button>
                            {booking && booking.project && <span style={s.projectLabel}>{booking.project}</span>}
                            {booking && booking.booked_by && <span style={s.bookedByLabel}>av {booking.booked_by}</span>}
                          </div>
                        )}
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
                  <div style={s.crewName}>{c.name}{c.is_new && <span style={s.newStar}>★ NY</span>}</div>
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
        <div style={s.overlay} onClick={tryCloseProfile}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={tryCloseProfile}>X</button>
            {(() => {
              const c = profileOpen
              const col = COLORS[c.color_index % COLORS.length]
              const freeDays = days.filter(d => getStatus(c.id, dk(d)) === 'free').length
              const skills = localSkills
              const weekBookings = days.map(d => ({day: fmtDay(d), b: getBooking(c.id, dk(d))})).filter(x => x.b && x.b.status === 'booked' && x.b.project)
              return <>
                <div style={{...s.modalAvatar,background:col.bg,color:col.text}}>{c.initials}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  {editingName ? (
                    <div style={{display:'flex',gap:8,flex:1}}>
                      <input style={{...s.formInput,flex:1,fontSize:16}} value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') setEditingName(false) }} autoFocus />
                      <button style={s.miniBtn} onClick={() => setEditingName(false)}>Ferdig</button>
                      <button style={s.clearBtn} onClick={() => { setNameInput(c.name); setEditingName(false) }}>Avbryt</button>
                    </div>
                  ) : (
                    <>
                      <div style={{fontSize:18,fontWeight:500,color:'#1a1a18',flex:1}}>{nameInput}</div>
                      <button style={s.editBtn} onClick={() => setEditingName(true)}>Rediger navn</button>
                    </>
                  )}
                </div>

                {/* Kategori + NY-flagg */}
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
                  {editingCategory ? (
                    <>
                      <select style={s.selectInput} value={categoryInput} onChange={e => setCategoryInput(e.target.value)} autoFocus>
                        <option value="">— Ingen kategori —</option>
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <button style={s.miniBtn} onClick={() => setEditingCategory(false)}>Ferdig</button>
                      <button style={s.clearBtn} onClick={() => { setCategoryInput(c.category || ''); setEditingCategory(false) }}>Avbryt</button>
                    </>
                  ) : (
                    <>
                      <span style={categoryInput ? s.categoryBadge : s.categoryBadgeEmpty}>{categoryInput || 'Ingen kategori'}</span>
                      <button style={s.editBtn} onClick={() => setEditingCategory(true)}>Endre</button>
                    </>
                  )}
                  {(() => {
                    const displayedIsNew = pendingIsNew !== null ? pendingIsNew : !!c.is_new
                    return <button
                      style={displayedIsNew ? s.newBadgeActive : s.newBadgeInactive}
                      onClick={toggleNewPending}
                      title={displayedIsNew ? 'Klikk for å fjerne NY-merket' : 'Klikk for å markere som ny'}>
                      {displayedIsNew ? '★ NY' : '+ NY'}
                    </button>
                  })()}
                </div>

                {/* Editable bio */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Om</div>
                    {!editingBio && <button style={s.editBtn} onClick={() => setEditingBio(true)}>Rediger</button>}
                  </div>
                  {editingBio ? (
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <textarea style={{...s.formInput,resize:'vertical'}} rows={3} value={bioInput} onChange={e => setBioInput(e.target.value)} autoFocus />
                      <div style={{display:'flex',gap:8}}>
                        <button style={s.miniBtn} onClick={() => setEditingBio(false)}>Ferdig</button>
                        <button style={s.clearBtn} onClick={() => { setBioInput(c.bio || ''); setEditingBio(false) }}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{fontSize:13,color:'#666',lineHeight:1.6,margin:0}}>{bioInput || '-'}</p>
                  )}
                </div>

                {/* Skills — chips */}
                <div style={s.msec}>
                  <div style={s.msecHdr}>Ferdigheter</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                    {skills.length === 0 && (
                      <span style={{fontSize:13,color:'#aaa',fontStyle:'italic'}}>Ingen ferdigheter lagt til</span>
                    )}
                    {skills.map(sk => (
                      <span key={sk.id} style={s.skillChip}>
                        {sk.name}
                        <button style={s.skillChipDelete} onClick={() => deleteSkill(sk.id)} title="Fjern ferdighet">×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <input style={{...s.formInput,flex:1}} value={newSkillInput} onChange={e => setNewSkillInput(e.target.value)} placeholder="Legg til ny ferdighet..." onKeyDown={e => { if(e.key==='Enter') addSkill() }} />
                    <button style={s.miniBtn} onClick={addSkill}>Legg til</button>
                  </div>
                </div>
                {/* Erfaring / referanser — author-attributed comments */}
                <div style={s.msec}>
                  <div style={s.msecHdr}>Erfaring / referanser</div>
                  {localComments.length === 0 && (
                    <p style={{fontSize:13,color:'#aaa',margin:'4px 0 10px'}}>Ingen referanser lagt til enda</p>
                  )}
                  {localComments.map(cm => {
                    const isPending = String(cm.id).startsWith('_tmp_')
                    return <div key={cm.id} style={s.commentItem}>
                      <div style={s.commentHead}>
                        <span style={s.commentAuthor}>{cm.author || 'Ukjent'}{isPending && ' · ulagret'}</span>
                        <span style={s.commentDate}>{new Date(cm.created_at).toLocaleDateString('nb-NO',{day:'numeric',month:'short',year:'numeric'})}</span>
                      </div>
                      <p style={s.commentBody}>{cm.content}</p>
                      {cm.author_id === userId && (
                        <button style={s.commentDelete} onClick={() => deleteCrewComment(cm.id)}>Slett min kommentar</button>
                      )}
                    </div>
                  })}
                  <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
                    <textarea
                      style={{...s.formInput,resize:'vertical'}}
                      rows={2}
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Skriv en erfaring eller referanse — navnet ditt og dato lagres automatisk"
                    />
                    <div>
                      <button
                        style={{...s.miniBtn,opacity:newComment.trim()?1:0.5,cursor:newComment.trim()?'pointer':'not-allowed'}}
                        disabled={!newComment.trim()}
                        onClick={addCrewComment}
                      >Legg til</button>
                    </div>
                  </div>
                </div>

                {/* Sertifikat */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Sertifikat</div>
                    {!editingCertificate && <button style={s.editBtn} onClick={() => setEditingCertificate(true)}>Rediger</button>}
                  </div>
                  {editingCertificate ? (
                    <div style={{display:'flex',gap:8}}>
                      <input style={{...s.formInput,flex:1}} value={certificateInput} onChange={e => setCertificateInput(e.target.value)} placeholder="f.eks. JA, Klasse B, Truck..." autoFocus onKeyDown={e => { if(e.key==='Enter') setEditingCertificate(false) }} />
                      <button style={s.miniBtn} onClick={() => setEditingCertificate(false)}>Ferdig</button>
                      <button style={s.clearBtn} onClick={() => { const certSk = (c.skills || []).find(sk => sk.name.startsWith('Sertifikat:')); setCertificateInput(certSk ? certSk.name.replace(/^Sertifikat:\s*/, '').trim() : ''); setEditingCertificate(false) }}>Avbryt</button>
                    </div>
                  ) : (
                    <div style={{fontSize:13,color: certificateInput ? '#1a1a18' : '#555'}}>{certificateInput || 'Ikke registrert'}</div>
                  )}
                </div>

                {/* Editable rate */}
                <div style={s.msec}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                    <div style={s.msecHdr}>Timepris</div>
                    {!editingRate && <button style={s.editBtn} onClick={() => setEditingRate(true)}>Rediger</button>}
                  </div>
                  {editingRate ? (
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input style={{...s.formInput,width:120}} type="number" value={rateInput} onChange={e => setRateInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter') setEditingRate(false) }} autoFocus />
                      <span style={{fontSize:13,color:'#888'}}>kr/t</span>
                      <button style={s.miniBtn} onClick={() => setEditingRate(false)}>Ferdig</button>
                      <button style={s.clearBtn} onClick={() => { setRateInput(String(c.rate)); setEditingRate(false) }}>Avbryt</button>
                    </div>
                  ) : (
                    <div style={{fontSize:24,fontWeight:500,color:'#1a1a18'}}>{rateInput} kr<span style={{fontSize:13,fontWeight:400,color:'#888'}}>/t</span></div>
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
                        <button style={s.miniBtn} onClick={() => setEditingBirthdate(false)}>Ferdig</button>
                        <button style={s.clearBtn} onClick={() => { setBirthdateInput(c.birthdate || ''); setEditingBirthdate(false) }}>X</button>
                      </div>
                    ) : (
                      <div style={{fontSize:13,color:birthdateInput?'#1a1a18':'#aaa'}}>
                        {birthdateInput ? new Date(birthdateInput).toLocaleDateString('nb-NO') : 'Ikke registrert'}
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
                        <input style={{...s.formInput,flex:1}} value={locationInput} onChange={e => setLocationInput(e.target.value)} placeholder='f.eks. Oslo' autoFocus onKeyDown={e => { if(e.key==='Enter') setEditingLocation(false) }} />
                        <button style={s.miniBtn} onClick={() => setEditingLocation(false)}>Ferdig</button>
                        <button style={s.clearBtn} onClick={() => { setLocationInput(c.location || ''); setEditingLocation(false) }}>X</button>
                      </div>
                    ) : (
                      <div style={{fontSize:13,color:locationInput?'#1a1a18':'#aaa'}}>{locationInput || 'Ikke registrert'}</div>
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
                      <input style={{...s.formInput}} value={allergyInput} onChange={e => setAllergyInput(e.target.value)} placeholder="Eller skriv fritt..." autoFocus onKeyDown={e => { if(e.key==='Enter') setEditingAllergy(false) }} />
                      <div style={{display:'flex',gap:8}}>
                        <button style={s.miniBtn} onClick={() => setEditingAllergy(false)}>Ferdig</button>
                        <button style={s.clearBtn} onClick={() => { const allergySk = (c.skills || []).find(sk => sk.name.startsWith('Allergi:')); setAllergyInput(allergySk ? allergySk.name.replace(/^Allergi:\s*/, '').trim() : ''); setEditingAllergy(false) }}>Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{fontSize:13,color: allergyInput ? '#A32D2D' : '#aaa'}}>{allergyInput || 'Ingen registrert'}</div>
                  )}
                </div>

                <div style={s.statsGrid}>
                  <div style={s.statCard}><div style={s.statLabel}>Ledige dager ({calMode === 'month' ? 'måned' : 'uke'})</div><div style={s.statVal}>{freeDays} av {days.length}</div></div>
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

                {/* Sticky save bar — only visible when there are unsaved changes */}
                {isDirty() && (
                  <div style={s.saveBar}>
                    <div style={s.saveBarText}>Du har ulagrede endringer</div>
                    <div style={{display:'flex',gap:8}}>
                      <button style={s.saveBarCancel} onClick={cancelAll} disabled={saving}>Avbryt</button>
                      <button style={s.saveBarSave} onClick={saveAll} disabled={saving}>{saving ? 'Lagrer…' : 'Lagre alle endringer'}</button>
                    </div>
                  </div>
                )}

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
              <div><label style={s.formLabel}>Telefon</label><input style={s.formInput} value={addForm.phone} onChange={e => setAddForm(f=>({...f,phone:e.target.value}))} placeholder="99 99 99 99" /></div>
              <div><label style={s.formLabel}>E-post</label><input style={s.formInput} type="email" value={addForm.email} onChange={e => setAddForm(f=>({...f,email:e.target.value}))} placeholder="navn@eksempel.no" /></div>
            </div>
            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Timelonn (kr) *</label><input style={s.formInput} type="number" value={addForm.rate} onChange={e => setAddForm(f=>({...f,rate:e.target.value}))} placeholder="600" /></div>
              <div><label style={s.formLabel}>Lønnform</label>
                <select style={s.formInput} value={addForm.employment_form} onChange={e => setAddForm(f=>({...f,employment_form:e.target.value}))}>
                  <option value="">— Velg —</option>
                  <option value="Lønn">Lønn</option>
                  <option value="Faktura">Faktura</option>
                  <option value="Honorar">Honorar etter avtale</option>
                </select>
              </div>
            </div>
            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Kategori</label>
                <select style={s.formInput} value={addForm.category} onChange={e => setAddForm(f=>({...f,category:e.target.value}))}>
                  <option value="">— Ingen kategori —</option>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'#1a1a18',cursor:'pointer',padding:'8px 0'}}>
                  <input type="checkbox" checked={addForm.is_new} onChange={e => setAddForm(f=>({...f,is_new:e.target.checked}))} />
                  Marker som NY
                </label>
              </div>
            </div>
            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Bosted</label><input style={s.formInput} value={addForm.location} onChange={e => setAddForm(f=>({...f,location:e.target.value}))} placeholder="f.eks. Oslo" /></div>
              <div><label style={s.formLabel}>Fødselsdato</label><input style={s.formInput} type="date" value={addForm.birthdate} onChange={e => setAddForm(f=>({...f,birthdate:e.target.value}))} /></div>
            </div>
            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Allergi / kosthold</label><input style={s.formInput} value={addForm.allergy} onChange={e => setAddForm(f=>({...f,allergy:e.target.value}))} placeholder="f.eks. Nøtter, Laktose" /></div>
              <div><label style={s.formLabel}>Sertifikat</label><input style={s.formInput} value={addForm.certificate} onChange={e => setAddForm(f=>({...f,certificate:e.target.value}))} placeholder="f.eks. Klasse B" /></div>
            </div>
            <div style={s.formRow2}>
              <div><label style={s.formLabel}>Antall jobber</label><input style={s.formInput} type="number" value={addForm.jobs} onChange={e => setAddForm(f=>({...f,jobs:e.target.value}))} placeholder="0" /></div>
              <div></div>
            </div>
            <div style={{marginBottom:14}}><label style={s.formLabel}>Ferdigheter (kommaseparert)</label><input style={s.formInput} value={addForm.skills} onChange={e => setAddForm(f=>({...f,skills:e.target.value}))} placeholder="Sony FX9, Drone, Lyd" /></div>
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
