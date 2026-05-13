// Shared constants for the booking app.

// Avatar colors for crew. Each color has a background and a matching text color.
export const COLORS = [
  { bg: '#B5D4F4', text: '#0C447C' },
  { bg: '#9FE1CB', text: '#085041' },
  { bg: '#FAC775', text: '#633806' },
  { bg: '#F4C0D1', text: '#72243E' },
  { bg: '#CECBF6', text: '#3C3489' },
  { bg: '#D3D1C7', text: '#2C2C2A' },
  { bg: '#C0DD97', text: '#27500A' },
  { bg: '#F5C4B3', text: '#712B13' },
]

// Categories for grouping crew (matches the structure of the Excel master list).
// Stored in crew.category as a plain string.
export const CATEGORIES = [
  'Erfarne',
  'Uerfarne',
  'Utenfor Oslo',
  'Fast jobb',
  'Ekstern',
]

// Allergies the user can select from in a crew profile.
export const ALLERGIES = [
  'Ingen',
  'Melk / laktose',
  'Gluten / hvete',
  'Egg',
  'Nøtter',
  'Fisk',
  'Skalldyr',
  'Soya',
  'Sesamfrø',
]

// Booking status definitions.
//   label = legacy one-letter chip (kept for compatibility)
//   short = label shown on the calendar pill
//   full  = spoken label used in legend, tooltips and status filter
//   bg, c = pill background and text color
export const STATUS = {
  free:        { label: 'L', short: 'Ledig',     full: 'Ledig',             bg: '#E1F5EE', c: '#0F6E56' },
  booked:      { label: 'B', short: 'Booket',    full: 'Booket',            bg: '#FCEBEB', c: '#A32D2D' },
  requested:   { label: 'F', short: 'Forespurt', full: 'Forespurt',         bg: '#FAEEDA', c: '#854F0B' },
  unavailable: { label: '-', short: 'Borte',     full: 'Ikke tilgjengelig', bg: '#F1EFE8', c: '#888780' },
}
