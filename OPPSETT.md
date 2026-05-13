# Crew Portal — Oppsettguide for Z Event

Følg disse stegene for å få nettsiden live. Det tar ca. 20–30 minutter totalt.

---

## Steg 1 — Opprett Supabase-prosjekt

1. Gå til **https://supabase.com** og opprett gratis konto
2. Klikk **"New project"**
3. Gi prosjektet navnet `crew-portal` og velg et sterkt passord
4. Velg region: **West EU (Ireland)** (nærmest Norge)
5. Klikk **"Create new project"** og vent ~1 minutt mens det settes opp

---

## Steg 2 — Kjør databaseskjemaet

1. I Supabase-dashboardet, klikk **"SQL Editor"** i venstremenyen
2. Klikk **"New query"**
3. Åpne filen `supabase/schema.sql` fra denne mappen
4. Kopier alt innholdet og lim det inn i SQL-editoren
5. Klikk **"Run"** (grønn knapp)
6. Du skal se "Success" — databasen er klar

---

## Steg 3 — Hent API-nøklene dine

1. I Supabase-dashboardet, gå til **Settings → API**
2. Kopier disse to verdiene:
   - **Project URL** (ser ut som `https://abcdefgh.supabase.co`)
   - **anon public** key (lang tekststreng)

---

## Steg 4 — Legg inn nøklene i prosjektet

1. Åpne mappen `crew-portal` på din datamaskin
2. Kopier filen `.env.example` og gi kopien navnet `.env.local`
3. Åpne `.env.local` og fyll inn:

```
REACT_APP_SUPABASE_URL=https://DIN-URL.supabase.co
REACT_APP_SUPABASE_ANON_KEY=din-anon-key-her
```

---

## Steg 5 — Publiser på Vercel

1. Gå til **https://vercel.com** og opprett gratis konto (logg inn med GitHub anbefales)
2. Last opp `crew-portal`-mappen til et nytt GitHub-repository (eller bruk Vercel CLI)
3. I Vercel: klikk **"Add New Project"** → velg repositoryet ditt
4. Under **"Environment Variables"**, legg til:
   - `REACT_APP_SUPABASE_URL` = din Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY` = din anon-nøkkel
5. Klikk **"Deploy"**
6. Etter ~2 minutter får du en URL som `crew-portal.vercel.app`

---

## Steg 6 — Inviter teamet

1. Del URL-en med alle i prosjektavdelingen
2. Første gang de besøker siden klikker de **"Opprett konto"** med sin e-post
3. De logger deretter inn med e-post og passord

### Vil du begrense hvem som kan registrere seg?
Gå til Supabase Dashboard → **Authentication → Settings** og skru av "Enable email signups". Da kan du invitere folk manuelt via **Authentication → Users → Invite user**.

---

## Hjelp

Noe som ikke fungerer? Vanlige problemer:

- **Blank side**: Sjekk at `.env.local` har riktige verdier og at du restartet appen
- **"Invalid API key"**: Kopier anon-nøkkelen på nytt fra Supabase — ikke service_role-nøkkelen
- **Kan ikke logge inn**: Gå til Supabase → Authentication → Users og se om brukeren finnes
