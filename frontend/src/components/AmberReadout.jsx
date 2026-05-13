import { fmt } from '../lib/format'
import styles from './AmberReadout.module.css'

/*
 * Custom Recharts tooltip — amber terminal readout.
 * Sin radius, sin sombra, sin caja blanca. Mono.
 */
export default function AmberReadout({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className={styles.readout}>
      <div className={styles.head}>{fmt.date(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className={`${styles.row} tabular`}>
          <span className={styles.swatch} style={{ background: p.color }} />
          <span className={styles.key}>{p.dataKey}</span>
          <span className={styles.val}>{fmt.price(p.value)}</span>
        </div>
      ))}
    </div>
  )
}
