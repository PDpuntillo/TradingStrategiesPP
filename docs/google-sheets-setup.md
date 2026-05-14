# Setup de Google Sheets (Fase 2)

Guía paso a paso para crear las **3 spreadsheets** (una por ticker: `GGAL`, `YPF`, `PAMP`) que consume el backend vía Google Sheets API Key (read-only, sheets públicas).

> El backend lee **únicamente la pestaña `RAW_DATA`** desde Sheets. Las 6 pestañas `STRATEGY_*` y `BACKTEST_RESULTS` son **opcionales** — sirven como espejo / sanity check en la propia sheet. Los cálculos reales viven en Python ([strategy_service.py](../backend/app/services/strategy_service.py)).

---

## 1. Obtener la API Key de Google Sheets

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/).
2. Creá un proyecto (o seleccioná uno existente). Sugerencia de nombre: `trading-strategy-analyzer`.
3. **APIs & Services → Library** → buscar `Google Sheets API` → **Enable**.
4. **APIs & Services → Credentials → + Create Credentials → API Key**.
5. Copiá la key (empieza con `AIzaSy...`).
6. **Restringí la key** (importante, evita abuso si se filtra):
   - **Application restrictions**: `None` (o `IP addresses` con tu IP pública si vas a deployar fijo)
   - **API restrictions**: `Restrict key` → seleccionar **solo Google Sheets API**.
7. Pegala en `backend/.env` como `GOOGLE_SHEETS_API_KEY=AIzaSy...`.

---

## 2. Crear las 3 Spreadsheets

Repetir el mismo flujo para cada ticker. Usaremos `GGAL` como ejemplo.

### 2.1. Crear la spreadsheet
1. Abrir [sheets.google.com](https://sheets.google.com) → **+ Blank**.
2. Renombrar el archivo a `GGAL.BA` (clic en el título arriba a la izquierda).

### 2.2. Crear las 8 pestañas
Click derecho en la pestaña inferior → **Rename** / **Duplicate**. Los nombres deben coincidir **exactamente** con los que espera el backend:

| # | Nombre de la pestaña | Uso |
|---|---|---|
| 1 | `RAW_DATA` | **Consumida por backend** — OHLCV vía GOOGLEFINANCE |
| 2 | `STRATEGY_11_SMA` | Opcional — espejo Strategy 11 |
| 3 | `STRATEGY_12_DMA` | Opcional — espejo Strategy 12 |
| 4 | `STRATEGY_13_TMA` | Opcional — espejo Strategy 13 |
| 5 | `STRATEGY_14_PIVOT` | Opcional — espejo Strategy 14 |
| 6 | `STRATEGY_15_CHANNEL` | Opcional — espejo Strategy 15 |
| 7 | `STRATEGY_18_PORTFOLIO` | Opcional — espejo Strategy 18 |
| 8 | `BACKTEST_RESULTS` | Opcional — log de backtests |

> ⚠️ Los nombres son **case-sensitive** y sin espacios. Si los cambiás, también hay que cambiarlos en [sheets_service.py](../backend/app/services/sheets_service.py) (mapa `sheet_map`, líneas 146–153).

---

## 3. Llenar `RAW_DATA` con GOOGLEFINANCE

El backend espera el siguiente layout (ver [sheets_service.py:89-127](../backend/app/services/sheets_service.py#L89)):

```
A         B      C      D      E       F
Timestamp Open   High   Low    Close   Volume
```

- **Row 1** = encabezados (el backend lee desde `A2`, los headers son solo para humanos).
- **Row 2 en adelante** = data, una fila por barra diaria.

### 3.1. Encabezados (fila 1)
Pegá en `A1`:
```
Timestamp	Open	High	Low	Close	Volume
```
(separadores tab → cada palabra va a su columna)

### 3.2. Fórmula GOOGLEFINANCE (celda `A2`)
Pegá **una sola fórmula** en `A2`. GOOGLEFINANCE devuelve un array que rellena hacia abajo y hacia la derecha:

```
=GOOGLEFINANCE("BCBA:GGAL", "all", TODAY()-365, TODAY(), "DAILY")
```

Esto produce las **7 columnas** que devuelve GOOGLEFINANCE: `Date, Open, High, Low, Close, Volume, +blank`. Como el backend espera 6 columnas (sin `Volume` extra), está bien — la 7ma queda fuera del rango `A2:F`.

#### Símbolos para los 3 tickers

| Ticker .env | Símbolo GOOGLEFINANCE | Ejemplo de fórmula en `A2` |
|---|---|---|
| `GGAL` | `BCBA:GGAL` | `=GOOGLEFINANCE("BCBA:GGAL","all",TODAY()-365,TODAY(),"DAILY")` |
| `YPF` | `BCBA:YPFD` | `=GOOGLEFINANCE("BCBA:YPFD","all",TODAY()-365,TODAY(),"DAILY")` |
| `PAMP` | `BCBA:PAMP` | `=GOOGLEFINANCE("BCBA:PAMP","all",TODAY()-365,TODAY(),"DAILY")` |

> **Nota sobre símbolos Merval**: GOOGLEFINANCE usa el prefijo `BCBA:` (Bolsa de Comercio de Buenos Aires). YPF cotiza como `YPFD` localmente. Si GOOGLEFINANCE no encuentra el símbolo, probá `NYSE:YPF` (ADR) como fallback.

#### Variantes útiles de la fórmula
```js
// Últimos 6 meses
=GOOGLEFINANCE("BCBA:GGAL", "all", TODAY()-180, TODAY(), "DAILY")

// Últimas 100 barras (más liviano)
=GOOGLEFINANCE("BCBA:GGAL", "all", TODAY()-150, TODAY(), "DAILY")

// Rango fijo (reproducible en backtests)
=GOOGLEFINANCE("BCBA:GGAL", "all", DATE(2024,1,1), DATE(2025,12,31), "DAILY")
```

### 3.3. Validación
Después de pegar la fórmula deberías ver ~250 filas (1 año hábil ≈ 252 ruedas). Verificá:
- `A2` tiene un timestamp (no `#N/A`).
- `F2` tiene un volumen numérico.
- No hay filas vacías intermedias.

Si ves `#N/A`, probá otro símbolo (ver tabla arriba) o esperá unos segundos — GOOGLEFINANCE a veces demora.

---

## 4. (Opcional) Llenar las pestañas `STRATEGY_*`

El backend **no las lee**, pero son útiles para validar visualmente que la lógica de Python coincide con lo que se ve en la sheet. Fórmulas de ejemplo:

### `STRATEGY_11_SMA` — Single Moving Average (T=20)
Headers (`A1:D1`):
```
Date	Close	SMA_20	Signal
```
En `A2`:
```
=RAW_DATA!A2
```
En `B2`:
```
=RAW_DATA!E2
```
En `C22` (primera MA válida con T=20):
```
=AVERAGE(B3:B22)
```
En `D22`:
```
=IF(B22>C22,"LONG","SHORT")
```
Arrastrar `C22:D22` hacia abajo.

### `STRATEGY_12_DMA` — Two MAs + Stop-Loss (T1=10, T2=50, stop=3%)
Headers (`A1:F1`):
```
Date	Close	SMA_10	SMA_50	Crossover	Signal
```
En `E52`:
```
=IF(AND(C52>D52, C51<=D51), "BULL_CROSS", IF(AND(C52<D52, C51>=D51), "BEAR_CROSS", ""))
```
En `F52`:
```
=IF(C52>D52, "LONG", "SHORT")
```

### `STRATEGY_13_TMA` — Three MAs Filter (T1=5, T2=20, T3=50)
Headers:
```
Date	Close	SMA_5	SMA_20	SMA_50	Signal
```
En la columna `F` (después de la fila 50):
```
=IF(AND(C52>D52, D52>E52), "LONG_CONFIRMED", IF(AND(C52<D52, D52<E52), "SHORT_CONFIRMED", "NEUTRAL"))
```

### `STRATEGY_14_PIVOT` — Pivot Points
Headers:
```
Date	High	Low	Close	Pivot	R1	S1
```
Para la fila 3 en adelante (Pivot usa la barra **anterior**):
```
E3: =(RAW_DATA!C2+RAW_DATA!D2+RAW_DATA!E2)/3
F3: =2*E3-RAW_DATA!D2
G3: =2*E3-RAW_DATA!C2
```

### `STRATEGY_15_CHANNEL` — Donchian Channel (T=20)
Headers:
```
Date	Close	Upper	Lower	Position
```
En `C22` (rolling max de las 20 barras previas, sin incluir la actual):
```
=MAX(B2:B21)
```
En `D22`:
```
=MIN(B2:B21)
```
En `E22`:
```
=IF(B22>=C22,"BREAKOUT_UP", IF(B22<=D22,"BREAKOUT_DOWN","INSIDE"))
```

### `STRATEGY_18_PORTFOLIO`
La optimización Sharpe-max requiere álgebra matricial (covarianza inversa × retornos esperados) que Sheets resuelve con `MINVERSE` + `MMULT`. Es engorroso; mejor usar el endpoint `/api/strategy/18` y dejar esta pestaña como **log manual** de los pesos devueltos por el backend:

Headers:
```
Run_Date	Ticker	Weight	Expected_Return	Volatility	Sharpe_Used
```

---

## 5. Compartir cada spreadsheet como pública

Sin esto, la API Key no puede leer el contenido.

1. Botón **Share** (arriba a la derecha).
2. En "General access": cambiar de **Restricted** a **Anyone with the link**.
3. Rol: **Viewer** (NO Editor).
4. Click **Done**.

> 🔒 Solo damos lectura. La API Key no puede escribir aunque alguien la robe.

---

## 6. Copiar los Spreadsheet IDs al `.env`

El ID está en la URL:
```
https://docs.google.com/spreadsheets/d/  1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789  /edit
                                       └─────────── este es el ID ──────────────┘
```

Editá [backend/.env](../backend/.env) (copiado de `.env.example`):
```env
GOOGLE_SHEETS_API_KEY=AIzaSy...
SPREADSHEET_ID_GGAL=1AbC...
SPREADSHEET_ID_YPF=1DeF...
SPREADSHEET_ID_PAMP=1GhI...
```

---

## 7. Probar la conexión

### 7.1. Desde PowerShell (sin levantar el backend)
```powershell
$env:API_KEY = "AIzaSy_tu_key"
$env:SHEET_ID = "1AbC_id_de_ggal"
curl "https://sheets.googleapis.com/v4/spreadsheets/$env:SHEET_ID/values/RAW_DATA!A2:F10?key=$env:API_KEY"
```
Debería devolver JSON con `values: [[...]]`.

### 7.2. Desde el backend
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```
Abrir [http://127.0.0.1:8000/api/ticker/GGAL](http://127.0.0.1:8000/api/ticker/GGAL) — debería devolver `TickerData` con barras.

---

## 8. Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `403 PERMISSION_DENIED` | Sheet no es pública | Paso 5 (Share → Anyone with link) |
| `400 API key not valid` | Key no habilitada para Sheets API | Paso 1.3 (Enable API) |
| `Requested entity was not found` | `SPREADSHEET_ID_*` mal copiado | Re-copiar de la URL |
| `#N/A` en `A2` | Símbolo GOOGLEFINANCE incorrecto | Probar `BCBA:XXX` o `NYSE:XXX` |
| Solo 1 fila de datos | Fórmula sin rango de fechas | Usar `TODAY()-365, TODAY(), "DAILY"` |
| `Formato de fecha no reconocido` | Locale de la sheet en español (DD/MM/YYYY) | Ya soportado en [sheets_service.py:163](../backend/app/services/sheets_service.py#L163) |
| Cache stale tras actualizar la sheet | TTL 5 min | `POST /api/cache/clear` |

---

## 8.5. (Opcional) Sheet `FUNDAMENTALS` para la estrategia Value

La estrategia cross-sectional **Value (B/P)** necesita el **Book Value per Share** de cada ticker. GOOGLEFINANCE no provee este dato; se ingresa **a mano** (~4 veces al año, cuando salen los balances).

### Cómo configurarlo

1. En cada spreadsheet de ticker (`GGAL.BA`, `YPF.BA`, etc.), agregá una **pestaña nueva** llamada **exactamente** `FUNDAMENTALS`
2. Layout:

| | A (Metric) | B (Value) | C (As of, opcional) |
|---|---|---|---|
| 1 | `Metric` | `Value` | `AsOf` |
| 2 | `BookValuePerShare` | `39804.28` | `2026-Q1` |
| 3 | `Shares` | `393310000` | `2026-Q1` |
| 4 | `MarketCap` | `26200000000` | `2026-Q1` |

- Fila 1 = headers (el backend la skipea)
- Columna A = nombre del metric, **case-sensitive y sin espacios**
- Columna B = valor numérico (en ARS — moneda del ticker)
- Columna C = trimestre/fecha, opcional (no se usa, sólo referencia)

### Métricas soportadas hoy

| Metric | Usada por | Notas |
|---|---|---|
| `BookValuePerShare` | Value (B/P) | **Required para Value** |
| `Shares` | (futuro) | Para weighted strategies — opcional |
| `MarketCap` | (futuro) | Idem |

### Dónde sacar el Book Value

- [investing.com](https://www.investing.com/) → buscás el ticker → tab "Financial Summary" → "Book Value/Share MRQ"
- O Yahoo Finance, Stock Analysis, etc.
- Para Argentina/Merval, valores en ARS

### Cómo el backend lo consume

- Lee `FUNDAMENTALS!A2:C` cuando corrés `/api/cross/value`
- Cache 5 min (mismo que RAW_DATA)
- Si un ticker no tiene la sheet o no tiene `BookValuePerShare`, queda como `—` en el ranking (no rompe el resto)

---

## 9. Checklist de Fase 2

- [ ] API Key creada y restringida a Sheets API
- [ ] 3 spreadsheets creadas: `GGAL.BA`, `YPF.BA`, `PAMP.BA`
- [ ] Cada una con las 8 pestañas (nombres exactos)
- [ ] `RAW_DATA` poblada con GOOGLEFINANCE en las 3
- [ ] Las 3 compartidas como **Anyone with link → Viewer**
- [ ] `backend/.env` con `GOOGLE_SHEETS_API_KEY` + 3 `SPREADSHEET_ID_*`
- [ ] `GET /api/ticker/GGAL` devuelve datos sin error
