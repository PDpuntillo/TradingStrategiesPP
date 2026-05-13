import { signalColor } from '../lib/format'
import styles from './ConsensusRail.module.css'

/*
 * ConsensusRail — SIGNATURE del producto.
 * 5 segmentos verticales (uno por estrategia 11..15), pintados
 * verde/rojo/gris según LONG/SHORT/NEUT. Footer = consensus.
 * De un vistazo: "¿cuántas dicen LONG?".
 */
const STRATS = [
  { n: 11, label: 'SMA' },
  { n: 12, label: 'DMA' },
  { n: 13, label: 'TMA' },
  { n: 14, label: 'PVT' },
  { n: 15, label: 'CHN' },
]

export default function ConsensusRail({ signals, consensus, loading, onSegmentClick }) {
  // signals: { strategy_11: { signal: 'LONG' | 'SHORT' | ... }, ... }
  const getSig = (n) => signals?.[`strategy_${n}`]?.signal ?? null

  return (
    <div className={styles.rail} aria-label="Consensus rail">
      <div className={styles.segments}>
        {STRATS.map(({ n, label }) => {
          const sig = loading ? null : getSig(n)
          return (
            <button
              key={n}
              className={styles.segment}
              style={{ '--seg-color': sig ? signalColor(sig) : 'var(--bg-elev-3)' }}
              onClick={() => onSegmentClick?.(n)}
              title={`S${n} · ${label} · ${sig ?? '—'}`}
            >
              <span className={styles.segLabel}>S{n}</span>
              <span className={styles.segName}>{label}</span>
              <span className={styles.segDot} />
            </button>
          )
        })}
      </div>

      <div
        className={styles.consensus}
        style={{ '--seg-color': consensus ? signalColor(consensus) : 'var(--fg-muted)' }}
      >
        <span className={styles.consensusLabel}>CONSENSUS</span>
        <span className={styles.consensusValue}>{loading ? '...' : consensus ?? '—'}</span>
      </div>
    </div>
  )
}
