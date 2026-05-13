import { fmt, signalColor, signalGlyph } from '../lib/format'
import styles from './SignalsStrip.module.css'

/*
 * SignalsStrip — columna derecha de cada lane.
 * Listado denso de las 5 strategies: nombre · glyph · señal · ref price.
 */
const ROWS = [
  { n: 11, label: 'Single MA',  refKey: 'ma_value',     refLbl: 'MA20' },
  { n: 12, label: 'Dual MA',    refKey: 'ma_long',      refLbl: 'MA30' },
  { n: 13, label: 'Triple MA',  refKey: 'ma3',          refLbl: 'MA21' },
  { n: 14, label: 'Pivot',      refKey: 'pivot',        refLbl: 'P' },
  { n: 15, label: 'Donchian',   refKey: 'band_upper',   refLbl: 'BUP' },
]

export default function SignalsStrip({ signals, loading, onSelectStrategy }) {
  if (loading) {
    return <div className={styles.strip}><div className={styles.empty}>...</div></div>
  }

  return (
    <div className={styles.strip}>
      <div className={styles.head}>STRATEGY SIGNALS</div>

      {ROWS.map(({ n, label, refKey, refLbl }) => {
        const s = signals?.[`strategy_${n}`]
        const sig = s?.signal
        const refVal = s?.[refKey]
        const price = s?.current_price

        return (
          <button
            key={n}
            className={styles.row}
            onClick={() => onSelectStrategy?.(n)}
            disabled={!s}
          >
            <span className={styles.rowNum}>S{n}</span>
            <span className={styles.rowName}>{label}</span>

            <span className={styles.rowGlyph} style={{ color: signalColor(sig) }}>
              {signalGlyph(sig)}
            </span>

            <span className={styles.rowSig} style={{ color: signalColor(sig) }}>
              {sig ?? '—'}
            </span>

            <span className={styles.rowMeta}>
              <span className={styles.metaLbl}>{refLbl}</span>
              <span className={`${styles.metaVal} tabular`}>{fmt.price(refVal)}</span>
            </span>

            <span className={styles.rowMeta}>
              <span className={styles.metaLbl}>PX</span>
              <span className={`${styles.metaVal} tabular`}>{fmt.price(price)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
