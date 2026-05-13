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

// Format a Date as an ISO date string (YYYY-MM-DD) for database queries
export function dk(d) {
  return d.toISOString().slice(0, 10)
}
