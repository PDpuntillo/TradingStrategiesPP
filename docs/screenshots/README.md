# Screenshots

Esta carpeta contiene las capturas que el README principal referencia. Por ahora están vacías — droppeá tus PNG acá con estos nombres exactos para que los links del README anden:

| Archivo | Qué capturar |
|---|---|
| `dashboard.png` | Vista general del dashboard con las 3 ticker lanes cargadas (GGAL/YPF/PAMP), consensus rail visible, charts con MAs, signals strip con LONG/SHORT |
| `drawer.png` | Drawer lateral abierto sobre alguna estrategia (ej. S11 Single MA de GGAL), mostrando el form de params + bloque RESULTADO |
| `portfolio.png` | Sección PortfolioOptimizer al pie, después de hacer click EJECUTAR — con stats Sharpe/Return/Vol y las 3 bars horizontales por ticker |

## Cómo capturar

1. Abrir https://tradingstrategyspablo1.vercel.app
2. Esperar que carguen los 3 lanes (puede tardar 30-60s la primera vez por cold start de Render)
3. **Para `dashboard.png`**: capturar el viewport completo (Win+Shift+S, área rectangular)
4. **Para `drawer.png`**: clickear cualquier segmento del consensus rail o row del signals strip → screenshot
5. **Para `portfolio.png`**: bajar al final, clickear EJECUTAR en el optimizer → screenshot del bloque resultado

## Recomendaciones

- Resolución mínima 1600px de ancho
- Browser en dark mode (combina con la estética)
- Sin extensiones que metan overlays (FinanzasOverlay, AdBlock, etc.)
- DevTools cerradas
