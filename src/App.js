import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import BookingPage from './pages/BookingPage'
import CrewPage from './pages/CrewPage'
import NoAccess from './pages/NoAccess'

// Hvem er admin? Speiler regelen i databasen (handle_new_user i schema.sql).
// Brukes bare som reserve hvis profilen ikke er lastet enda — selve
// tilgangen håndheves alltid av databasen (RLS), ikke av denne sjekken.
function isZeventEmail(email) {
  return (email || '').toLowerCase().endsWith('@zevent.no')
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // access: null = ikke lastet, 'admin', 'crew' (koblet), 'none' (ingen kobling)
  const [access, setAccess] = useState(null)
  const [myCrew, setMyCrew] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) { setAccess(null); setMyCrew(null) }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Når vi har en innlogget bruker: finn rolle og evt. koblet crew-rad
  useEffect(() => {
    if (!session) return
    let cancelled = false
    async function resolveAccess() {
      const user = session.user
      const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle()
      const role = profile?.role || (isZeventEmail(user.email) ? 'admin' : 'crew')
      if (cancelled) return
      if (role === 'admin') { setAccess('admin'); return }
      // Crew: finn egen rad (RLS gjør at bare egen rad er synlig)
      const { data: crewRow } = await supabase.from('crew').select('*, skills(*)').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      if (crewRow) { setMyCrew(crewRow); setAccess('crew') }
      else setAccess('none')
    }
    resolveAccess()
    return () => { cancelled = true }
  }, [session])

  if (loading || (session && access === null)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#888' }}>
        Laster…
      </div>
    )
  }

  if (!session) return <Login />
  if (access === 'admin') return <BookingPage user={session.user} />
  if (access === 'crew') return <CrewPage user={session.user} initialCrew={myCrew} />
  return <NoAccess user={session.user} />
}
