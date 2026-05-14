# Tradingstrategys

Dashboard cuantitativo en tiempo real para el panel líder del Merval. Implementa 6 estrategias del paper **"151 Trading Strategies"** de Kakushadze & Serur (2018) con datos OHLCV de Google Sheets, backend FastAPI y frontend React/Vite con estética de terminal Bloomberg.

[![CI](https://github.com/PDpuntillo/Tradingstrategyspablo1/actions/workflows/ci.yml/badge.svg)](https://github.com/PDpuntillo/Tradingstrategyspablo1/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#licencia)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)

---

## Producción

| | |
|---|---|
| **Frontend** | https://tradingstrategyspablo1.vercel.app |
| **Backend API** | https://tradingstrategyspablo1.onrender.com |
| **Swagger UI** | https://tradingstrategyspablo1.onrender.com/docs |

> ⚠️ El backend está en plan free de Render: duerme tras 15 min sin uso. La primera carga después puede tardar **30-60 segundos** (cold start). Después responde instantáneo.

---

## Capturas

> Las imágenes viven en `docs/screenshots/`. Si todavía no las dropeaste ahí, los links van a estar rotos.

![Dashboard general](docs/screenshots/dashboard.png)
*Las 3 ticker lanes (GGAL/YPF/PAMP) con consensus rail vertical, chart con MAs y signals strip.*

![Strategy drawer](docs/screenshots/drawer.png)
*Drawer lateral para re-ejecutar una estrategia con parámetros custom.*

![Portfolio Optimizer](docs/screenshots/portfolio.png)
*Strategy 18 — pesos óptimos por Sharpe maximization con bars horizontales.*

---

## Estrategias implementadas

| # | Nombre | Lógica | Endpoint |
|---|---|---|---|
| **11** | Single Moving Average | `Close > MA(T) ⇒ LONG` | `POST /api/strategy/11` |
| **12** | Two MAs + Stop-Loss | Cruce de medias + Δ% stop | `POST /api/strategy/12` |
| **13** | Three MAs Filter | `MA(T₁) > MA(T₂) > MA(T₃) ⇒ LONG confirmado` | `POST /api/strategy/13` |
| **14** | Support/Resistance (Pivot) | `P = (H+L+C)/3, R=2P−L, S=2P−H` | `POST /api/strategy/14` |
| **15** | Donchian Channel | `B↑ = max(P), B↓ = min(P)` en ventana T | `POST /api/strategy/15` |
| **18** | Portfolio Optimization | Sharpe maximization (eq. 353/358) | `POST /api/strategy/18` |

Las 5 primeras corren por ticker; la 18 es multi-ticker (optimiza pesos sobre los 3 simultáneamente).

**Tickers MVP**: GGAL, YPF, PAMP — panel líder Merval.

---

## Stack

| Capa | Tech | Notas |
|---|---|---|
| **Backend** | FastAPI 0.115 + Pydantic v2 | Threadpool para handlers sync, lock global alrededor del client de Google (no thread-safe) |
| **Cálculos** | NumPy 2.1 + SciPy 1.14 + Pandas 2.2 | Sharpe-max via álgebra lineal en SciPy |
| **Cache** | `cachetools.TTLCache` 5 min + in-flight request dedup | 1 call a Google por ticker incluso con N requests concurrentes |
| **Data** | Google Sheets API Key (read-only) | Las 3 sheets son públicas con `GOOGLEFINANCE` |
| **Frontend** | React 18 + Vite 5 + Recharts 2 | CSS modules, sin Tailwind ni UI lib |
| **Estética** | Bloomberg-terminal heritage | JetBrains Mono everywhere, ámbar accent, borders-only depth |
| **CI** | GitHub Actions | pytest + vite build + docker build en cada PR |
| **Deploy** | Render (backend) + Vercel (frontend) | Plan free en ambos |

---

## Estructura del repo

```
Tradingstrategyspablo1/
├── backend/                          ← FastAPI server
│   ├── app/
│   │   ├── main.py                   ← Entrypoint + CORS + startup
│   │   ├── config.py                 ← Pydantic Settings
│   │   ├── models/strategy.py        ← Schemas Pydantic
│   │   ├── services/
│   │   │   ├── sheets_service.py     ← Google Sheets + cache + dedup + lock
│   │   │   └── strategy_service.py   ← Lógica de las 6 estrategias
│   │   └── routes/strategies.py      ← 10 endpoints REST
│   ├── tests/                        ← pytest, 16 tests, fixtures sintéticos
│   ├── Dockerfile                    ← python:3.11-slim
│   ├── .python-version               ← 3.11.9 (pin para Render)
│   ├── requirements.txt
│   └── .env.example
├── frontend/                         ← React/Vite SPA
│   ├── src/
│   │   ├── pages/Dashboard.jsx
│   │   ├── components/               ← 8 componentes (TickerLane, ConsensusRail, etc.)
│   │   ├── hooks/                    ← useApi, useTickerData, useSignals, etc.
│   │   ├── lib/                      ← api.js, format.js
│   │   └── styles/                   ← tokens.css, base.css
│   ├── vite.config.js                ← Proxy /api → :8000 en dev
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── deploy.md                     ← Guía Vercel + Render paso a paso
│   ├── google-sheets-setup.md        ← Cómo crear las 3 spreadsheets
│   └── screenshots/                  ← (drop tus PNG acá)
├── sheets-templates/
│   └── RAW_DATA_template.csv         ← Headers de referencia
├── .github/workflows/ci.yml          ← pytest + vite build + docker build
├── .gitignore
└── README.md
```

---

## Setup local (Windows)

### 1. Pre-requisitos

```powershell
# Python 3.11 (NO 3.13 — scipy/pandas no tienen wheels)
python --version
# Si no lo tenés:
winget install Python.Python.3.11

# Node 20+
node --version
# Si no lo tenés:
winget install OpenJS.NodeJS.LTS

# Git
git --version
```

### 2. Clonar repo

```powershell
cd D:\Documents\GitHub          # o donde prefieras
git clone https://github.com/PDpuntillo/Tradingstrategyspablo1.git
cd Tradingstrategyspablo1
```

### 3. Crear las 3 Google Sheets + API Key

Seguí la guía completa en **[docs/google-sheets-setup.md](docs/google-sheets-setup.md)**:
- Habilitar Google Sheets API en Google Cloud Console
- Crear 3 spreadsheets públicas (`GGAL.BA`, `YPF.BA`, `PAMP.BA`)
- Pegar fórmula `=GOOGLEFINANCE("BCBA:GGAL", "all", TODAY()-365, TODAY(), "DAILY")` en cada `RAW_DATA!A2`
- Compartir como **Anyone with link → Viewer**
- Copiar los IDs de las URLs

### 4. Backend

```powershell
cd backend

# Virtual env
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Si PowerShell te bloquea el script:
# Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Deps
pip install -r requirements.txt

# .env desde el template
copy .env.example .env
notepad .env
# → completar GOOGLE_SHEETS_API_KEY + 3 SPREADSHEET_ID_*

# Correr
uvicorn app.main:app --reload
```

→ Backend en http://127.0.0.1:8000 · Swagger en http://127.0.0.1:8000/docs

### 5. Frontend (otra terminal)

```powershell
cd frontend
npm install
npm run dev
```

→ Frontend en http://localhost:5173

> Vite proxea `/api/*` a `:8000` en dev (ver `vite.config.js`), por eso no hace falta CORS local ni `VITE_API_BASE_URL`.

### 6. Tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -v
# 16 passed in ~1s
```

---

## API Reference

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/` | Health + info |
| `GET` | `/api/tickers` | `["GGAL","YPF","PAMP"]` |
| `GET` | `/api/ticker/{ticker}` | OHLCV del ticker (default 500 barras) |
| `POST` | `/api/strategy/11` | Single MA |
| `POST` | `/api/strategy/12` | Dual MA + stop-loss |
| `POST` | `/api/strategy/13` | Triple MA filter |
| `POST` | `/api/strategy/14` | Pivot points |
| `POST` | `/api/strategy/15` | Donchian channel |
| `POST` | `/api/strategy/18` | Portfolio optimization (Sharpe-max) |
| `GET` | `/api/signals/{ticker}` | Todas las señales + consensus |
| `POST` | `/api/cache/clear` | Forzar refresh de Sheets |

Schemas completos en [Swagger UI](https://tradingstrategyspablo1.onrender.com/docs).

### Ejemplos

```powershell
# RAW_DATA del ticker
curl https://tradingstrategyspablo1.onrender.com/api/ticker/GGAL

# Strategy 11 con params custom
curl -X POST https://tradingstrategyspablo1.onrender.com/api/strategy/11 `
  -H "Content-Type: application/json" `
  -d '{\"ticker\": \"GGAL\", \"ma_period\": 50, \"ma_type\": \"EMA\"}'

# Portfolio optimization
curl -X POST https://tradingstrategyspablo1.onrender.com/api/strategy/18 `
  -H "Content-Type: application/json" `
  -d '{\"tickers\": [\"GGAL\",\"YPF\",\"PAMP\"], \"lookback_days\": 252, \"dollar_neutral\": false, \"total_investment\": 100000}'
```

---

## Deploy

Setup completo paso a paso en **[docs/deploy.md](docs/deploy.md)** — incluye:

- Sign up de Vercel + Render
- Configuración de root dir, env vars y CORS
- Troubleshooting (cold start, Python version, scipy wheels)
- Checklist de verificación end-to-end

Stack de deploy:

| | |
|---|---|
| **Render** (backend) | Free tier, plan paid $7/mes para evitar sleep |
| **Vercel** (frontend) | Free tier, preview deploys por PR |
| **GitHub Actions** | CI gratis (3 jobs: pytest + vite build + docker build) en cada PR |

---

## Estado del proyecto

- ✅ **Fase 1**: Backend FastAPI + 16 tests
- ✅ **Fase 2**: Google Sheets setup (guía + templates CSV)
- ✅ **Fase 3**: Frontend React/Vite con dashboard, drawer, optimizer
- ✅ **Fase 4**: CI/CD + deploy en Render + Vercel
- ✅ **Fase 5**: README final + screenshots

### Próximos posibles

- [ ] Backtesting engine (signals históricos para evaluar performance)
- [ ] Loading skeletons (versión sin SVG, compatible con Recharts)
- [ ] UptimeRobot ping para evitar cold starts en Render free
- [ ] Selector de tickers dinámico (más allá de los 3 hardcodeados)
- [ ] Live signals via WebSocket
- [ ] Tests de integración (frontend + backend)

---

## Convenciones

- **Comentarios en código**: español
- **Identificadores y APIs**: inglés
- **Mensajes de commit**: inglés, [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`)
- **PRs contra `main`**, CI debe estar verde antes de mergear

---

## Referencia académica

> Kakushadze, Z. & Serur, J. A. (2018). *151 Trading Strategies*. SSRN.
> [https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3247865](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3247865)

Las estrategias 11–15 corresponden a la sección de Trend Following del paper; la 18 es de la sección de Portfolio Optimization.

---

## Licencia

MIT — ver header del repo. Hacé fork, modificá, deployá tu versión. Si lo usás en algo serio, **acordate que las señales son educacionales**: no son recomendación financiera, no es advice, podés perder plata.

---

**Author**: Pablo Puntillo · [@PDpuntillo](https://github.com/PDpuntillo) · pdpuntillo@gmail.com
