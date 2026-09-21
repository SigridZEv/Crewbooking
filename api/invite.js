// Vercel-funksjon: send invitasjon til en crew-person.
//
// Kalles fra appen (POST /api/invite med { crew_id }) av en innlogget
// prosjektleder/admin. Kjører på serveren fordi invitasjoner krever Supabase
// sin "service role"-nøkkel, som aldri skal ligge i nettleseren.
//
// Miljøvariabler i Vercel (Settings → Environment Variables):
//   SUPABASE_URL               – samme som REACT_APP_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  – fra Supabase → Project Settings → API (service_role)
//   SITE_URL                   – https://crewbooking.vercel.app

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const siteUrl = process.env.SITE_URL || 'https://crewbooking.vercel.app'
  if (!url || !serviceKey) return res.status(500).json({ error: 'Serveren mangler oppsett (SUPABASE_SERVICE_ROLE_KEY).' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Ikke innlogget.' })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // Hvem spør? Må være admin eller prosjektleder.
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Ugyldig innlogging.' })
  const { data: profile } = await admin.from('user_profiles').select('role, display_name').eq('id', userData.user.id).maybeSingle()
  if (!profile || !['admin', 'pl'].includes(profile.role)) return res.status(403).json({ error: 'Bare prosjektledere og admin kan sende invitasjoner.' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const crewId = body?.crew_id
  if (!crewId) return res.status(400).json({ error: 'Mangler crew_id.' })

  const { data: crew } = await admin.from('crew').select('id, name, email, user_id').eq('id', crewId).maybeSingle()
  if (!crew) return res.status(404).json({ error: 'Fant ikke crew-personen.' })
  const email = (crew.email || '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Legg inn e-postadresse på profilen først.' })

  // Allerede invitert men ikke fullført? Da fjerner vi den uferdige kontoen og sender på nytt.
  if (crew.user_id) {
    const { data: existing } = await admin.auth.admin.getUserById(crew.user_id)
    const u = existing?.user
    if (u && (u.email_confirmed_at || u.last_sign_in_at)) {
      return res.status(400).json({ error: crew.name + ' har allerede innlogging.' })
    }
    if (u) await admin.auth.admin.deleteUser(u.id)
  }

  const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: siteUrl,
    data: { crew_id: crew.id, full_name: crew.name },
  })
  if (invErr) {
    const m = (invErr.message || '').toLowerCase()
    if (m.includes('already') || m.includes('registered')) {
      return res.status(400).json({ error: 'Det finnes allerede en konto med ' + email + '. Be personen logge inn, eller bruke «Glemt passord».' })
    }
    return res.status(500).json({ error: 'Kunne ikke sende invitasjon: ' + invErr.message })
  }

  await admin.from('crew').update({ invited_at: new Date().toISOString(), invited_by: profile.display_name || userData.user.email }).eq('id', crew.id)
  return res.status(200).json({ ok: true, email })
}
