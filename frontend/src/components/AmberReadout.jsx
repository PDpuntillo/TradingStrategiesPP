import { fmt } from '../lib/format'
import styles from './AmberReadout.module.css'

/*
 * Tooltip del chart — light glass popover.
 *
 * Lee del payload el row completo (OHLC + MAs) y lo muestra agrupado:
 *   - Header: fecha
 *   - OHLC block: O/H/L/C + change% (close vs open)
 *   - MAs: cada línea con su color
 */
export default function AmberReadout({ active, payload, label }) {
  if (!active || !payload?.length) return null

  // El primer entry suele tener el row completo en payload.payload
  const row = payload[0]?.payload
  if (!row) return null

  const { open, high, low, close } = row
  const isUp = close != null && open != null && close >= open
  const changePct = open && close ? (close - open) / open : null

  // Series no-OHLC (MAs) — vienen de payload con dataKey diferente
  const maEntries = payload.filter(
    (p) => p.dataKey && !['hl'].includes(p.dataKey)
  )

  return (
    <div className={styles.readout}>
      <div className={styles.head}>{fmt.date(label)}</div>

      {/* OHLC */}
      {open != null && (
        <div className={styles.ohlc}>
          <div className={styles.ohlcRow}>
            <span className={styles.key}>O</span>
            <span className={`${styles.val} tabular`}>{fmt.price(open)}</span>
            <span className={styles.key}>H</span>
            <span className={`${styles.val} tabular`}>{fmt.price(high)}</span>
          </div>
          <div className={styles.ohlcRow}>
            <span className={styles.key}>L</span>
            <span className={`${styles.val} tabular`}>{fmt.price(low)}</span>
            <span className={styles.key}>C</span>
            <span
              className={`${styles.val} tabular`}
              style={{ color: isUp ? 'var(--sig-long)' : 'var(--sig-short)' }}
            >
              {fmt.price(close)}
            </span>
          </div>
          {changePct != null && (
            <div className={styles.change}>
              <span
                className="tabular"
                style={{ color: isUp ? 'var(--sig-long)' : 'var(--sig-short)' }}
              >
                {isUp ? '+' : ''}{fmt.pct(changePct)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* MAs */}
      {maEntries.length > 0 && (
        <div className={styles.mas}>
          {maEntries.map((p) => (
            <div key={p.dataKey} className={`${styles.row} tabular`}>
              <span className={styles.swatch} style={{ background: p.color }} />
              <span className={styles.key}>{p.dataKey}</span>
              <span className={styles.val}>{fmt.price(p.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
