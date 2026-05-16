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
import { useChartOverlays } from '../hooks/useChartOverlays'
import { useStrategyParams, STRATEGY_DEFAULTS } from '../hooks/useStrategyParams'
import styles from './ChartPanel.module.css'

// EMA con lambda decay (eq. 320 del paper, mirror del backend strategy_service.py)
const EMA_LAMBDA = 0.94

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
 * ChartPanel — velas OHLC + overlays per-estrategia opcionales.
 *
 * Las velas se dibujan con un Bar de Recharts + custom shape SVG (rect body
 * + line wick). Los overlays (líneas de MAs, canal Donchian, levels de
 * pivot) se computan client-side a partir de los params LIVE de cada
 * estrategia (useStrategyParams) y se muestran/ocultan según
 * useChartOverlays — el toggle es el botón con forma de ojo en cada row
 * del rail.
 *
 * Pasamos la SERIE COMPLETA al ComposedChart y controlamos el viewport
 * con <Brush>. Los botones de período son presets que setean la ventana;
 * después el usuario puede arrastrar el brush para pan/resize manual.
 */
export default function ChartPanel({ ticker, data, signals, loading }) {
  const [period, setPeriod] = useState('6M')
  const [scale, setScale] = useState('linear')

  const { overlays } = useChartOverlays(ticker)
  const [p11] = useStrategyParams(ticker, 11)
  const [p12] = useStrategyParams(ticker, 12)
  const [p13] = useStrategyParams(ticker, 13)
  const [p15] = useStrategyParams(ticker, 15)

  // Serie completa con O/H/L/C + columnas de overlays por estrategia.
  // Computamos todas las columnas siempre (es barato) y luego renderizamos
  // condicionalmente las Lines según el set de overlays activos.
  const series = useMemo(() => {
    if (!data?.bars) return []
    const closes = data.bars.map((b) => b.close)

    const sma = (period) => (idx) => {
      if (period < 1 || idx < period - 1) return null
      let s = 0
      for (let i = idx - period + 1; i <= idx; i++) s += closes[i]
      return s / period
    }
    // EMA del paper: weighted average over una ventana, NO recursivo
    const ema = (period, lambda) => (idx) => {
      if (period < 1 || idx < period - 1) return null
      let num = 0
      let denom = 0
      for (let t = 0; t < period; t++) {
        const p = closes[idx - t]
        const w = Math.pow(lambda, t)
        num += w * p
        denom += w
      }
      return num / denom
    }
    const maOf = (period, type) =>
      type === 'EMA' ? ema(period, EMA_LAMBDA) : sma(period)

    // Donchian: max/min sobre los `period` bars ANTES del actual (mirror backend)
    const rollMaxClose = (period) => (idx) => {
      if (period < 1 || idx < period) return null
      let m = -Infinity
      for (let i = idx - period; i < idx; i++) m = Math.max(m, closes[i])
      return m
    }
    const rollMinClose = (period) => (idx) => {
      if (period < 1 || idx < period) return null
      let m = Infinity
      for (let i = idx - period; i < idx; i++) m = Math.min(m, closes[i])
      return m
    }

    const d11 = STRATEGY_DEFAULTS[11]
    const d12 = STRATEGY_DEFAULTS[12]
    const d13 = STRATEGY_DEFAULTS[13]
    const d15 = STRATEGY_DEFAULTS[15]
    const s11 = maOf(p11.ma_period ?? d11.ma_period, p11.ma_type ?? d11.ma_type)
    const s12Fast = sma(p12.ma_short_period ?? d12.ma_short_period)
    const s12Slow = sma(p12.ma_long_period ?? d12.ma_long_period)
    const s13Fast = sma(p13.ma1_period ?? d13.ma1_period)
    const s13Mid = sma(p13.ma2_period ?? d13.ma2_period)
    const s13Slow = sma(p13.ma3_period ?? d13.ma3_period)
    const s15Up = rollMaxClose(p15.channel_period ?? d15.channel_period)
    const s15Dn = rollMinClose(p15.channel_period ?? d15.channel_period)

    return data.bars.map((b, i) => ({
      ts: b.timestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      hl: [b.low, b.high],
      s11_ma: s11(i),
      s12_fast: s12Fast(i),
      s12_slow: s12Slow(i),
      s13_fast: s13Fast(i),
      s13_mid: s13Mid(i),
      s13_slow: s13Slow(i),
      s15_upper: s15Up(i),
      s15_lower: s15Dn(i),
    }))
  }, [data, p11, p12, p13, p15])

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

  const pivot = signals?.strategy_14

  // YAxis domain: usar high/low (no close) para que las wicks entren bien,
  // y sumar los valores de los overlays VISIBLES para que las líneas no se
  // salgan del canvas cuando estén lejos del precio.
  const yDomain = useMemo(() => {
    if (!visibleSlice.length) return ['auto', 'auto']
    const vals = []
    const show = (n) => overlays.has(n)
    for (const r of visibleSlice) {
      if (r.high != null) vals.push(r.high)
      if (r.low != null) vals.push(r.low)
      if (show(11) && r.s11_ma != null) vals.push(r.s11_ma)
      if (show(12)) {
        if (r.s12_fast != null) vals.push(r.s12_fast)
        if (r.s12_slow != null) vals.push(r.s12_slow)
      }
      if (show(13)) {
        if (r.s13_fast != null) vals.push(r.s13_fast)
        if (r.s13_mid != null) vals.push(r.s13_mid)
        if (r.s13_slow != null) vals.push(r.s13_slow)
      }
      if (show(15)) {
        if (r.s15_upper != null) vals.push(r.s15_upper)
        if (r.s15_lower != null) vals.push(r.s15_lower)
      }
    }
    if (show(14) && pivot) {
      if (pivot.resistance != null) vals.push(pivot.resistance)
      if (pivot.pivot != null) vals.push(pivot.pivot)
      if (pivot.support != null) vals.push(pivot.support)
    }
    if (!vals.length) return ['auto', 'auto']
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.03 || max * 0.01
    if (scale === 'log') {
      return [Math.max(min - pad, min * 0.97), max + pad]
    }
    return [min - pad, max + pad]
  }, [visibleSlice, scale, overlays, pivot])

  if (loading) {
    return <div className={styles.empty}>CARGANDO PRECIOS…</div>
  }
  if (!data?.bars?.length) {
    return <div className={styles.empty}>SIN DATOS</div>
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

          {/* S14 — Pivot levels (horizontales, computados del bar previo) */}
          {overlays.has(14) && pivot && (
            <>
              <ReferenceLine y={pivot.resistance} stroke="var(--sig-short)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'R', position: 'left', fill: 'var(--sig-short)', fontSize: 11, fontWeight: 700 }} />
              <ReferenceLine y={pivot.pivot} stroke="var(--overlay-pivot)" strokeDasharray="3 3" strokeOpacity={0.7} label={{ value: 'P', position: 'left', fill: 'var(--overlay-pivot)', fontSize: 11, fontWeight: 700 }} />
              <ReferenceLine y={pivot.support} stroke="var(--sig-long)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: 'S', position: 'left', fill: 'var(--sig-long)', fontSize: 11, fontWeight: 700 }} />
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

          {/* S11 — Single MA (SMA o EMA según ma_type del drawer) */}
          {overlays.has(11) && (
            <Line
              type="monotone"
              dataKey="s11_ma"
              name={`S11 ${p11.ma_type ?? 'SMA'}(${p11.ma_period ?? 20})`}
              stroke="var(--overlay-s11)"
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}

          {/* S12 — Dual MA (fast + slow) */}
          {overlays.has(12) && (
            <>
              <Line
                type="monotone"
                dataKey="s12_fast"
                name={`S12 fast(${p12.ma_short_period ?? 10})`}
                stroke="var(--overlay-s12-fast)"
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="s12_slow"
                name={`S12 slow(${p12.ma_long_period ?? 30})`}
                stroke="var(--overlay-s12-slow)"
                strokeWidth={1.4}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </>
          )}

          {/* S13 — Triple MA (fast + mid + slow) */}
          {overlays.has(13) && (
            <>
              <Line
                type="monotone"
                dataKey="s13_fast"
                name={`S13 fast(${p13.ma1_period ?? 3})`}
                stroke="var(--overlay-s13-fast)"
                strokeWidth={1.25}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="s13_mid"
                name={`S13 mid(${p13.ma2_period ?? 10})`}
                stroke="var(--overlay-s13-mid)"
                strokeWidth={1.25}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="s13_slow"
                name={`S13 slow(${p13.ma3_period ?? 21})`}
                stroke="var(--overlay-s13-slow)"
                strokeWidth={1.25}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </>
          )}

          {/* S15 — Donchian channel (rolling max/min de los últimos N closes) */}
          {overlays.has(15) && (
            <>
              <Line
                type="monotone"
                dataKey="s15_upper"
                name={`S15 upper(${p15.channel_period ?? 20})`}
                stroke="var(--overlay-donchian)"
                strokeWidth={1.25}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="s15_lower"
                name={`S15 lower(${p15.channel_period ?? 20})`}
                stroke="var(--overlay-donchian)"
                strokeWidth={1.25}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </>
          )}

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
