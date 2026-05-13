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
  ts: (v) => {
    if (!v) return '—'
    const d = new Date(v)
    return d.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  },
  date: (v) => {
    if (!v) return '—'
    const d = new Date(v)
    return d.toLocaleDateString('es-AR', {
      month: '2-digit',
      day: '2-digit',
    })
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
