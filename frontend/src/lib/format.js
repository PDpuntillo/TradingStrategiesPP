/*
 * Formatters — todos los números pasan por acá.
 * Tabular nums + locale es-AR.
 */

const nf = (digits) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

const F2 = nf(2)
const F4 = nf(4)
const F0 = nf(0)
const PCT = new Intl.NumberFormat('es-AR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const fmt = {
  price: (v) => (v == null ? '—' : F2.format(v)),
  pct: (v) => (v == null ? '—' : PCT.format(v)),
  ratio: (v) => (v == null ? '—' : F4.format(v)),
  int: (v) => (v == null ? '—' : F0.format(v)),
  // Formato manual DD/MM/YYYY HH:MM — evita que el locale del browser
  // o el OS reordene a MM/DD (que es lo que pasaba en Chrome bajo
  // Windows en español-AR cuando había datos sin TZ explícita).
  ts: (v) => {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d.getTime())) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
  },
  // DD/MM corto para ejes de chart (sin año, sin hora).
  date: (v) => {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d.getTime())) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}`
  },
}

// Mapeo SignalType → color semantic
export const signalColor = (sig) => {
  if (sig === 'LONG') return 'var(--sig-long)'
  if (sig === 'SHORT') return 'var(--sig-short)'
  return 'var(--sig-neutral)'
}

// Mapeo SignalType → glyph
export const signalGlyph = (sig) => {
  if (sig === 'LONG') return '↑'
  if (sig === 'SHORT') return '↓'
  return '—'
}
