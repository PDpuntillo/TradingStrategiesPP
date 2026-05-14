import { useEffect, useMemo, useState } from 'react'
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
  Brush,
} from 'recharts'
import AmberReadout from './AmberReadout'
import { fmt } from '../lib/format'
import styles from './ChartPanel.module.css'

// Períodos de visualización (en barras de trading, ~252 por año).
const PERIODS = [
  { key: '1M', label: '1M', bars: 21 },
  { key: '3M', label: '3M', bars: 63 },
  { key: '6M', label: '6M', bars: 126 },
  { key: '1Y', label: '1Y', bars: 252 },
  { key: '2Y', label: '2Y', bars: 504 },
  { key: 'MAX', label: 'MAX', bars: Infinity },
]

/*
 * ChartPanel — precio + MAs + bandas (Donchian) + pivot.
 *
 * Pasamos la SERIE COMPLETA al LineChart y controlamos el viewport con
 * <Brush> (mini-strip abajo). Los botones de período son presets que
 * setean la ventana del brush; después el usuario puede arrastrar para
 * pan/resize manual sin cambiar de período.
 *
 * Convención de terminal: eje Y a la DERECHA, grid casi invisible.
 */
export default function ChartPanel({ data, signals, loading }) {
  const [period, setPeriod] = useState('6M')
  // Escala del eje Y: 'linear' o 'log'. Log es útil para ver cambios
  // porcentuales constantes a la misma altura visual (ej. duplicaciones).
  const [scale, setScale] = useState('linear')

  // Serie COMPLETA con MAs computadas sobre todo (preciso desde
  // el primer bar visible al hacer pan).
  const series = useMemo(() => {
    if (!data?.bars) return []
    const closes = data.bars.map((b) => b.close)
    const ma = (mp) => (idx) => {
      if (idx < mp - 1) return null
      let s = 0
      for (let i = idx - mp + 1; i <= idx; i++) s += closes[i]
      return s / mp
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

  // Ventana visible (índices al array completo). Se inicializa con el
  // período seleccionado y se updatea cuando el usuario mueve el brush.
  const [window, setWindow] = useState({ start: 0, end: 0 })

  // Snap a período cuando cambia (botón clickeado o data nueva).
  useEffect(() => {
    if (!series.length) return
    const cfg = PERIODS.find((p) => p.key === period) ?? PERIODS[2]
    const total = series.length
    const bars = cfg.bars === Infinity ? total : Math.min(cfg.bars, total)
    setWindow({ start: total - bars, end: total - 1 })
  }, [period, series.length])

  // Para que el YAxis se auto-ajuste al subset visible (Recharts NO lo
  // hace nativo cuando hay Brush en algunas configs), calculamos el
  // domain a partir de la ventana actual.
  const visibleSlice = useMemo(() => {
    if (!series.length) return []
    return series.slice(window.start, window.end + 1)
  }, [series, window])

  const yDomain = useMemo(() => {
    if (!visibleSlice.length) return ['auto', 'auto']
    const vals = []
    for (const r of visibleSlice) {
      if (r.close != null) vals.push(r.close)
      if (r.MA10 != null) vals.push(r.MA10)
      if (r.MA20 != null) vals.push(r.MA20)
      if (r.MA50 != null) vals.push(r.MA50)
    }
    if (!vals.length) return ['auto', 'auto']
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    // Padding del 3% para que la línea no toque el borde
    const pad = (max - min) * 0.03 || max * 0.01
    if (scale === 'log') {
      // Log no acepta negativos ni 0; clampear min a algo > 0
      return [Math.max(min - pad, min * 0.97), max + pad]
    }
    return [min - pad, max + pad]
  }, [visibleSlice, scale])

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
      <div className={styles.periodBar}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`${styles.periodBtn} ${p.key === period ? styles.periodBtnActive : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
        <div className={styles.scaleGroup}>
          <button
            type="button"
            className={`${styles.periodBtn} ${scale === 'linear' ? styles.periodBtnActive : ''}`}
            onClick={() => setScale('linear')}
            title="Escala lineal (default)"
          >
            LIN
          </button>
          <button
            type="button"
            className={`${styles.periodBtn} ${scale === 'log' ? styles.periodBtnActive : ''}`}
            onClick={() => setScale('log')}
            title="Escala logarítmica (mejor para movimientos % constantes)"
          >
            LOG
          </button>
        </div>
      </div>
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
            scale={scale}
            domain={yDomain}
            allowDataOverflow
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

          <Brush
            dataKey="ts"
            height={28}
            stroke="var(--accent-amber-dim)"
            fill="var(--bg-input)"
            travellerWidth={6}
            startIndex={window.start}
            endIndex={window.end}
            onChange={({ startIndex, endIndex }) => {
              if (startIndex != null && endIndex != null) {
                setWindow({ start: startIndex, end: endIndex })
              }
            }}
            tickFormatter={fmt.dateY}
          >
            <LineChart>
              <Line
                type="monotone"
                dataKey="close"
                stroke="var(--fg-tertiary)"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </Brush>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
