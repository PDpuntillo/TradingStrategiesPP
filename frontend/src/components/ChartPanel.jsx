import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import AmberReadout from './AmberReadout'
import { fmt } from '../lib/format'
import styles from './ChartPanel.module.css'

/*
 * ChartPanel — precio + MAs + bandas (Donchian) + pivot.
 *
 * data: array de PriceBar (timestamp, open, high, low, close, volume)
 * overlays (opcional): { ma1, ma2, ma3, channel: {upper, lower}, pivot: {pivot, r1, s1} }
 *
 * Convención de terminal: eje Y a la DERECHA, grid casi invisible.
 */
export default function ChartPanel({ data, signals, loading }) {
  const series = useMemo(() => {
    if (!data?.bars) return []

    // Calculo MAs in-place (cheap, evitamos otro endpoint).
    const closes = data.bars.map((b) => b.close)
    const ma = (period) => (idx) => {
      if (idx < period - 1) return null
      let s = 0
      for (let i = idx - period + 1; i <= idx; i++) s += closes[i]
      return s / period
    }
    const ma1 = ma(10)
    const ma2 = ma(20)
    const ma3 = ma(50)

    return data.bars.map((b, i) => ({
      ts: b.timestamp,
      close: b.close,
      MA10: ma1(i),
      MA20: ma2(i),
      MA50: ma3(i),
    }))
  }, [data])

  // Bandas Donchian (S15) y pivots (S14) como ReferenceLines horizontales
  const channel = signals?.strategy_15
  const pivot = signals?.strategy_14

  if (loading) {
    return <div className={styles.empty}>cargando precios…</div>
  }
  if (!data?.bars?.length) {
    return <div className={styles.empty}>sin datos</div>
  }

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--overlay-grid)" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={fmt.date}
            stroke="var(--fg-muted)"
            tick={{ fontSize: 10, fill: 'var(--fg-tertiary)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            minTickGap={48}
          />
          <YAxis
            orientation="right"
            stroke="var(--fg-muted)"
            tick={{ fontSize: 10, fill: 'var(--fg-tertiary)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickFormatter={(v) => fmt.price(v)}
            domain={['auto', 'auto']}
            width={64}
          />
          <Tooltip content={<AmberReadout />} cursor={{ stroke: 'var(--accent-amber)', strokeOpacity: 0.4 }} />

          {/* Pivot / S / R como líneas horizontales (Strategy 14) */}
          {pivot && (
            <>
              <ReferenceLine y={pivot.resistance} stroke="var(--sig-short)" strokeDasharray="2 4" strokeOpacity={0.5} label={{ value: 'R', position: 'left', fill: 'var(--sig-short)', fontSize: 10 }} />
              <ReferenceLine y={pivot.pivot} stroke="var(--accent-amber)" strokeDasharray="2 4" strokeOpacity={0.7} label={{ value: 'P', position: 'left', fill: 'var(--accent-amber)', fontSize: 10 }} />
              <ReferenceLine y={pivot.support} stroke="var(--sig-long)" strokeDasharray="2 4" strokeOpacity={0.5} label={{ value: 'S', position: 'left', fill: 'var(--sig-long)', fontSize: 10 }} />
            </>
          )}

          {/* Donchian bands (Strategy 15) */}
          {channel && (
            <>
              <ReferenceLine y={channel.band_upper} stroke="var(--overlay-cyan)" strokeOpacity={0.4} strokeDasharray="4 2" />
              <ReferenceLine y={channel.band_lower} stroke="var(--overlay-cyan)" strokeOpacity={0.4} strokeDasharray="4 2" />
            </>
          )}

          <Line type="monotone" dataKey="close" stroke="var(--fg-primary)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="MA10" stroke="var(--overlay-cyan)" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="MA20" stroke="var(--overlay-blue)" strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="MA50" stroke="var(--overlay-violet)" strokeWidth={1} dot={false} isAnimationActive={false} />

          <Legend
            verticalAlign="top"
            align="left"
            height={20}
            iconType="plainline"
            wrapperStyle={{ fontSize: 10, color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
