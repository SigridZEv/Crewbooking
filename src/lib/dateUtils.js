// Date helpers used across the app.
// Pure functions — no React, no Supabase.

// Returns the 7 dates of the week, offset by `offset` weeks from today.
// Week starts on Monday (Norwegian convention).
export function getWeekDates(offset) {
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

// Format a Date as a short Norwegian day label (e.g. "man. 13. mai")
export function fmtDay(d) {
  return d.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Format a Date as an ISO date string (YYYY-MM-DD) for database queries.
// Uses the LOCAL date — toISOString() would convert to UTC first, and since
// Norway is ahead of UTC, local midnight would become the previous day.
export function dk(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Returns all dates of a calendar month, offset by `offset` months from today.
// offset=0 means current month, +1 means next month, -1 means last month.
export function getMonthDates(offset) {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => new Date(target.getFullYear(), target.getMonth(), i + 1))
}

// Format a Date as "Juni 2026" (Norwegian)
export function fmtMonth(d) {
  return d.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })
}

// ---- Norske helligdager ----
// Regnes ut for et vilkårlig år: faste dager + de som følger påskedagen.
// Returnerer et objekt { 'YYYY-MM-DD': 'Navn' }.
function easterSunday(year) {
  // Anonym gregoriansk algoritme
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const holidayCache = {}
export function norwegianHolidays(year) {
  if (holidayCache[year]) return holidayCache[year]
  const easter = easterSunday(year)
  const out = {}
  const put = (d, name) => { const k = dk(d); if (!out[k]) out[k] = name }
  // Faste dager legges først, så de «vinner» hvis de faller på en bevegelig (f.eks. 17. mai 2027)
  put(new Date(year, 0, 1), 'Første nyttårsdag')
  put(new Date(year, 4, 1), 'Arbeidernes dag')
  put(new Date(year, 4, 17), 'Grunnlovsdag')
  put(new Date(year, 11, 25), 'Første juledag')
  put(new Date(year, 11, 26), 'Andre juledag')
  put(addDays(easter, -3), 'Skjærtorsdag')
  put(addDays(easter, -2), 'Langfredag')
  put(easter, 'Første påskedag')
  put(addDays(easter, 1), 'Andre påskedag')
  put(addDays(easter, 39), 'Kristi himmelfartsdag')
  put(addDays(easter, 49), 'Første pinsedag')
  put(addDays(easter, 50), 'Andre pinsedag')
  holidayCache[year] = out
  return out
}

// Navn på helligdagen for en dato-nøkkel ('YYYY-MM-DD'), eller null.
export function holidayName(dateKey) {
  return norwegianHolidays(Number(dateKey.slice(0, 4)))[dateKey] || null
}
