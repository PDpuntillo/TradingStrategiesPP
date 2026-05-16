/*
 * EyeIcon — ícono shared para los toggles de visibilidad.
 * Usado por:
 *   - ConsensusRail: prender/apagar overlay de cada indicador sobre el chart
 *   - LaneConfigPanel: prender/apagar visibilidad de cada lane
 *
 * Siempre outline + pupila. El color lo controla el parent vía `color`
 * (currentColor): gris cuando inactive, blanco cuando active sobre fondo
 * azul. Trazo más grueso cuando active para más presencia.
 */
export default function EyeIcon({ active, size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
    >
      <path
        d="M8 3.5C4.5 3.5 2 8 2 8s2.5 4.5 6 4.5S14 8 14 8s-2.5-4.5-6-4.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 1.6 : 1.2}
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.8" fill="currentColor" />
    </svg>
  )
}
