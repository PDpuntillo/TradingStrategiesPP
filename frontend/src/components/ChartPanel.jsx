import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Bar,
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
 * ChartPanel — velas OHLC + MAs + Pivot/Donchian.
 *
 * Las velas se dibujan con un Bar de Recharts + custom shape que renderea
 * SVG (rect body + line wick), sin depender de librerías externas.
 *
 * Pasamos la SERIE COMPLETA al ComposedChart y controlamos el viewport
 * con <Brush>. Los botones de período son presets que setean la ventana;
 * después el usuario puede arrastrar el brush para pan/resize manual.
 */
export default function ChartPanel({ data, signals, loading }) {
  const [period, setPeriod] = useState('6M')
  const [scale, setScale] = useState('linear')

  // Serie completa con O/H/L/C + MAs
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
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      // dataKey para el Bar de velas: [low, high] = rango total del candle
      hl: [b.low, b.high],
      MA10: ma1(i),
      MA20: ma2(i),
      MA50: ma3(i),
    }))
  }, [data])

  const [window, setWindow] = useState({ start: 0, end: 0 })

  useEffect(() => {
    if (!series.length) return
    const cfg = PERIODS.find((p) => p.key === period) ?? PERIODS[2]
    const total = series.length
    const bars = cfg.bars === Infinity ? total : Math.min(cfg.bars, total)
    setWindow({ start: total - bars, end: total - 1 })
  }, [period, series.length])

  const visibleSlice = useMemo(() => {
    if (!series.length) return []
    return series.slice(window.start, window.end + 1)
  }, [series, window])

  // YAxis domain: usar high/low (no close) para que las wicks de las
  // velas entren bien
  const yDomain = useMemo(() => {
    if (!visibleSlice.length) return ['auto', 'auto']
    const vals = []
    for (const r of visibleSlice) {
      if (r.high != null) vals.push(r.high)
      if (r.low != null) vals.push(r.low)
      if (r.MA10 != null) vals.push(r.MA10)
      if (r.MA20 != null) vals.push(r.MA20)
      if (r.MA50 != null) vals.push(r.MA50)
    }
    if (!vals.length) return ['auto', 'auto']
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.03 || max * 0.01
    if (scale === 'log') {
      return [Math.max(min - pad, min * 0.97), max + pad]
    }
    return [min - pad, max + pad]
  }, [visibleSlice, scale])

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
        <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
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
          <Tooltip
            content={<AmberReadout />}
            cursor={{ stroke: 'var(--accent-blue)', strokeOpacity: 0.5, strokeWidth: 1 }}
          />

          {pivot && (
            <>
              <ReferenceLine y={pivot.resistance} stroke="var(--sig-short)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'R', position: 'left', fill: 'var(--sig-short)', fontSize: 11, fontWeight: 700 }} />
              <ReferenceLine y={pivot.pivot} stroke="var(--overlay-pivot)" strokeDasharray="3 3" strokeOpacity={0.7} label={{ value: 'P', position: 'left', fill: 'var(--overlay-pivot)', fontSize: 11, fontWeight: 700 }} />
              <ReferenceLine y={pivot.support} stroke="var(--sig-long)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'S', position: 'left', fill: 'var(--sig-long)', fontSize: 11, fontWeight: 700 }} />
            </>
          )}

          {channel && (
            <>
              <ReferenceLine y={channel.band_upper} stroke="var(--overlay-donchian)" strokeOpacity={0.5} strokeDasharray="6 3" />
              <ReferenceLine y={channel.band_lower} stroke="var(--overlay-donchian)" strokeOpacity={0.5} strokeDasharray="6 3" />
            </>
          )}

          {/* Velas — Bar con custom shape. dataKey "hl" da el rango low-high
              al shape como [y_high_pixel, y_low_pixel], y leemos open/close
              del payload para dibujar el body. */}
          <Bar
            dataKey="hl"
            shape={<Candle />}
            isAnimationActive={false}
            legendType="none"
          />

          <Line type="monotone" dataKey="MA10" stroke="var(--overlay-cyan)" strokeWidth={1.25} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="MA20" stroke="var(--overlay-blue)" strokeWidth={1.25} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="MA50" stroke="var(--overlay-violet)" strokeWidth={1.25} dot={false} isAnimationActive={false} />

          <Legend
            verticalAlign="top"
            align="left"
            height={20}
            iconType="plainline"
            wrapperStyle={{ fontSize: 10, color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
          />

          <Brush
            dataKey="ts"
            height={32}
            stroke="var(--brush-stroke)"
            fill="var(--brush-fill)"
            travellerWidth={8}
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
                stroke="var(--accent-blue)"
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/*
 * Candle — custom shape para el Bar de Recharts.
 *
 * Recharts pasa al shape: x, y, width, height (basados en el dataKey "hl"
 * que es [low, high], así que y = pixel de high, y+height = pixel de low),
 * más el payload completo de la row.
 *
 * Computamos open/close en pixels via ratio = height / (high - low),
 * dibujamos:
 *   - wick line vertical de high a low (centerX)
 *   - body rect de min(open,close) a max(open,close), ancho ~70% del slot
 *
 * Color: verde si close >= open (bullish), rojo si close < open (bearish).
 */
function Candle(props) {
  const { x, y, width, height, payload } = props
  if (!payload) return null
  const { open, high, low, close } = payload
  if (open == null || close == null || high == null || low == null) return null

  const range = high - low
  if (range <= 0) {
    // doji o sin spread — solo dibuja una línea horizontal en el body
    const cx = x + width / 2
    const bodyWidth = Math.max(2, width * 0.7)
    return (
      <line
        x1={cx - bodyWidth / 2}
        y1={y + height / 2}
        x2={cx + bodyWidth / 2}
        y2={y + height / 2}
        stroke="var(--fg-secondary)"
        strokeWidth={1.5}
      />
    )
  }

  const isUp = close >= open
  const color = isUp ? 'var(--sig-long)' : 'var(--sig-short)'

  const ratio = height / range
  const openY = y + (high - open) * ratio
  const closeY = y + (high - close) * ratio
  const bodyTop = Math.min(openY, closeY)
  const bodyBottom = Math.max(openY, closeY)
  const bodyHeight = Math.max(1, bodyBottom - bodyTop)

  const centerX = x + width / 2
  const bodyWidth = Math.max(2, width * 0.7)
  const bodyX = centerX - bodyWidth / 2

  return (
    <g>
      {/* Wick: vertical line from high to low */}
      <line
        x1={centerX}
        y1={y}
        x2={centerX}
        y2={y + height}
        stroke={color}
        strokeWidth={1}
      />
      {/* Body: rect from open to close */}
      <rect
        x={bodyX}
        y={bodyTop}
        width={bodyWidth}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  )
}
