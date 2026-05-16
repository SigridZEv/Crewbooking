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
