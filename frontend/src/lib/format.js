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

// Mes abreviado en español. Usado en chart axis y tooltips
// para evitar la ambigüedad DD/MM vs MM/DD.
const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

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
  // Formato manual con MES EN TEXTO para eliminar la ambigüedad DD/MM vs MM/DD.
  // `02 Nov '25 17:00` es inmediatamente legible — no hay forma de confundir
  // el día con el mes porque "Nov" es texto.
  ts: (v) => {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d.getTime())) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mon = MONTHS_ES[d.getMonth()]
    const yy = String(d.getFullYear()).slice(-2)
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${dd} ${mon} '${yy} ${hh}:${mi}`
  },
  // `02 Nov` corto para ejes de chart (sin año, sin hora).
  date: (v) => {
    if (!v) return '—'
    const d = new Date(v)
    if (isNaN(d.getTime())) return '—'
    const dd = String(d.getDate()).padStart(2, '0')
    const mon = MONTHS_ES[d.getMonth()]
    return `${dd} ${mon}`
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
