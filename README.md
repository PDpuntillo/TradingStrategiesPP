# 📈 Trading Strategy Analyzer

Sistema full-stack de análisis de estrategias de trading basado en el paper **"151 Trading Strategies"** de Kakushadze & Serur (2018).

Implementa las estrategias:
- **11** - Single Moving Average
- **12** - Two Moving Averages + Stop-Loss
- **13** - Three Moving Averages (Trend Filter)
- **14** - Support & Resistance (Pivot Points)
- **15** - Donchian Channel
- **18** - Portfolio Optimization (Sharpe Ratio Maximization)

**Tickers MVP:** GGAL.BA, YPF.BA, PAMP.BA (panel líder Merval)

---

## 🏗️ Stack

| Capa | Tech |
|---|---|
| Frontend | React 18 + Vite + Recharts |
| Backend | FastAPI + Pydantic v2 + NumPy/SciPy |
| Data | Google Sheets (API Key, read-only) |
| Deploy | GitHub Actions → Vercel + Railway |

---

## 📂 Estructura

```
trading-strategy-analyzer/
├── backend/                 ← FastAPI server
│   ├── app/
│   │   ├── main.py          ← Entrypoint
│   │   ├── config.py        ← Pydantic Settings
│   │   ├── models/          ← Pydantic schemas
│   │   ├── services/        ← Lógica de negocio
│   │   └── routes/          ← Endpoints REST
│   ├── tests/               ← pytest
│   └── requirements.txt
├── frontend/                ← (próxima fase)
├── sheets-templates/        ← Templates de Google Sheets
└── .github/workflows/       ← CI/CD
```

---

## 🚀 Setup (Windows local)

### **1. Pre-requisitos**

```powershell
# Verificar Python 3.11+
python --version

# Si no lo tenés, instalar con winget:
winget install Python.Python.3.12
```

### **2. Clonar repo**

```powershell
cd C:\Users\Pablo\projects   # o donde prefieras
git clone https://github.com/PDpuntillo/trading-strategy-analyzer.git
cd trading-strategy-analyzer
```

### **3. Backend setup**

```powershell
cd backend

# Crear virtual env
python -m venv venv
.\venv\Scripts\Activate.ps1   # PowerShell
# o: venv\Scripts\activate.bat  ← CMD

# Instalar deps
pip install -r requirements.txt

# Crear .env desde el template
copy .env.example .env
# Editar .env con tu API key y spreadsheet IDs
notepad .env
```

### **4. Google Sheets API Key**

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear/seleccionar un proyecto
3. **APIs & Services → Library → Google Sheets API → Enable**
4. **APIs & Services → Credentials → Create Credentials → API Key**
5. Copiar la key en tu `.env` como `GOOGLE_SHEETS_API_KEY`
6. (Recomendado) Restringir la API Key:
   - Application restrictions: IP address
   - API restrictions: Google Sheets API only

### **5. Google Sheets templates**

Para cada ticker (GGAL, YPF, PAMP):

1. Crear una spreadsheet nueva en Google Sheets
2. Renombrar con el ticker (ej: `GGAL.BA`)
3. Crear las 8 pestañas:
   - `RAW_DATA` (columnas: Timestamp, Open, High, Low, Close, Volume)
   - `STRATEGY_11_SMA`
   - `STRATEGY_12_DMA`
   - `STRATEGY_13_TMA`
   - `STRATEGY_14_PIVOT`
   - `STRATEGY_15_CHANNEL`
   - `STRATEGY_18_PORTFOLIO`
   - `BACKTEST_RESULTS`
4. En `RAW_DATA!B2`, pegar fórmulas tipo:
   ```
   =GOOGLEFINANCE("BCBA:GGAL", "all", TODAY()-180, TODAY(), "DAILY")
   ```
5. **Share → "Anyone with the link" → Viewer**
6. Copiar el ID (de la URL) al `.env`:
   ```
   SPREADSHEET_ID_GGAL=1AbC...
   SPREADSHEET_ID_YPF=1DeF...
   SPREADSHEET_ID_PAMP=1GhI...
   ```

### **6. Correr backend**

```powershell
# Desde backend/
uvicorn app.main:app --reload --port 8000

# Abrir en navegador:
# http://127.0.0.1:8000/docs   ← Swagger UI
```

### **7. Correr tests**

```powershell
cd backend
pytest -v
```

---

## 📡 Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/` | Health + info |
| GET | `/api/tickers` | Lista de tickers soportados |
| GET | `/api/ticker/{ticker}` | RAW_DATA del ticker |
| POST | `/api/strategy/11` | Single MA signal |
| POST | `/api/strategy/12` | Dual MA + Stop-Loss |
| POST | `/api/strategy/13` | Triple MA Filter |
| POST | `/api/strategy/14` | Pivot Points |
| POST | `/api/strategy/15` | Donchian Channel |
| POST | `/api/strategy/18` | Portfolio Optimization |
| GET | `/api/signals/{ticker}` | Todas las señales + consensus |
| POST | `/api/cache/clear` | Limpiar cache de Sheets |

---

## 🧪 Ejemplo de uso

```bash
# Obtener datos de GGAL
curl http://127.0.0.1:8000/api/ticker/GGAL

# Strategy 11 (Single MA)
curl -X POST http://127.0.0.1:8000/api/strategy/11 \
  -H "Content-Type: application/json" \
  -d '{"ticker": "GGAL", "ma_period": 20, "ma_type": "SMA"}'

# Portfolio optimization
curl -X POST http://127.0.0.1:8000/api/strategy/18 \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["GGAL", "YPF", "PAMP"],
    "lookback_days": 252,
    "dollar_neutral": false,
    "total_investment": 100000
  }'
```

---

## 📋 Roadmap

- [x] **Fase 1: Backend foundation** ← VOS ESTÁS ACÁ
- [ ] **Fase 2:** Google Sheets templates automatizados
- [ ] **Fase 3:** Frontend React + skill `interface-design`
- [ ] **Fase 4:** CI/CD GitHub Actions → Vercel + Railway
- [ ] **Fase 5:** Backtesting engine
- [ ] **Fase 6:** Live signals con webhooks

---

## 📚 Referencia

> Kakushadze, Z. & Serur, J.A. (2018). *151 Trading Strategies*.
> [SSRN: 3247865](https://ssrn.com/abstract=3247865)

---

**License:** MIT
**Author:** Pablo
