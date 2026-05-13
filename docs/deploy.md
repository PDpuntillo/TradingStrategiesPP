# Deploy (Fase 4)

Stack:
- **Frontend** → Vercel
- **Backend** → Render
- **CI** → GitHub Actions (`.github/workflows/ci.yml`)

Tiempo estimado: ~20-30 min para el primer deploy. Después, cada push a `main` re-deploya solo.

---

## 0. Pre-requisitos

- Repo en GitHub (lo tenés: `PDpuntillo/Tradingstrategyspablo1`)
- API Key de Google Sheets + 3 spreadsheet IDs (lo tenés, está en `backend/.env` local — ese archivo no se sube)

## 1. CI con GitHub Actions

**No hace falta hacer nada.** Una vez mergeado este branch, el workflow corre solo en cada PR contra `main` y en cada push.

Lo que valida:
- Backend: `pytest -v` con dummies como env vars
- Frontend: `npm ci && npm run build`
- Docker: `docker build` del backend (verifica el Dockerfile)

Vas a ver checkmarks verdes/rojos en la pestaña Actions del repo y al pie de cada PR.

---

## 2. Backend en Render

### 2.1. Crear cuenta
1. Andá a [render.com](https://render.com) → **Get Started for Free**
2. Login con GitHub (1 click)

### 2.2. Crear el web service
1. Dashboard → **New +** → **Web Service**
2. **Connect a repository** → autorizá a Render a ver tu cuenta de GitHub
3. Seleccioná `PDpuntillo/Tradingstrategyspablo1`
4. Configurá:

| Campo | Valor |
|---|---|
| **Name** | `tradingstrategys-backend` (o lo que quieras) |
| **Region** | Oregon (US West) o el más cercano |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Docker` (lo detecta solo si encontró el Dockerfile) |
| **Instance Type** | **Free** |

### 2.3. Configurar env vars
En la sección **Environment Variables** agregá:

| Key | Value |
|---|---|
| `GOOGLE_SHEETS_API_KEY` | tu API key (la que tenés en `backend/.env`) |
| `SPREADSHEET_ID_GGAL` | el ID de la sheet GGAL |
| `SPREADSHEET_ID_YPF` | el ID de la sheet YPF |
| `SPREADSHEET_ID_PAMP` | el ID de la sheet PAMP |
| `CORS_ORIGINS` | `http://localhost:5173` (lo actualizamos después con la URL de Vercel) |
| `CACHE_TTL_SECONDS` | `300` |

> ⚠️ **No pongas `PORT`** — Render lo inyecta automáticamente. El Dockerfile lo lee con `${PORT:-8000}`.

### 2.4. Deploy
1. Click **Create Web Service**
2. Render empieza a buildear la imagen (1-2 min)
3. Cuando termina vas a ver la URL pública: `https://tradingstrategys-backend.onrender.com`
4. Probá: abrí `https://tradingstrategys-backend.onrender.com/api/tickers` en el browser — debería devolver `["GGAL","YPF","PAMP"]`

### Sobre el plan free
- App **duerme tras 15 min de inactividad**
- Primer request después del sueño tarda ~30s en despertar (cold start)
- Para uso esporádico personal es ok; si quieres always-on, $7/mes

---

## 3. Frontend en Vercel

### 3.1. Crear cuenta
1. [vercel.com/signup](https://vercel.com/signup) → **Continue with GitHub**

### 3.2. Importar el proyecto
1. Dashboard → **Add New...** → **Project**
2. Encontrá `Tradingstrategyspablo1` → **Import**
3. Configurá:

| Campo | Valor |
|---|---|
| **Project Name** | `tradingstrategyspablo1` (o lo que quieras) |
| **Framework Preset** | `Vite` (lo detecta solo) |
| **Root Directory** | `frontend` ← **importante** |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `dist` (default) |

### 3.3. Configurar env var
Expandí **Environment Variables**:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://tradingstrategys-backend.onrender.com/api` (la URL del Render del paso 2.4, **con `/api` al final**) |

### 3.4. Deploy
1. Click **Deploy**
2. Vercel buildea (30-60s)
3. Vas a tener URL `https://tradingstrategyspablo1.vercel.app` o similar

---

## 4. Cerrar el círculo — CORS

El backend rechazará las requests del frontend porque su origen (`tradingstrategyspablo1.vercel.app`) no está en la lista CORS.

### Actualizar CORS en Render
1. Render dashboard → tu service → **Environment**
2. Editá `CORS_ORIGINS`:
   ```
   http://localhost:5173,https://tradingstrategyspablo1.vercel.app
   ```
   (CSV, sin espacios)
3. **Save** → Render hace redeploy automático (1 min)

### Probar el flujo end-to-end
1. Abrí `https://tradingstrategyspablo1.vercel.app`
2. Esperá ~30s la primera vez (Render despierta el backend)
3. Los 3 lanes deberían cargar con data real

---

## 5. Flujo después del setup inicial

- **Push a `main`** → Vercel + Render redespliegan automáticamente
- **Abrir PR** → GitHub Actions corre tests/build (ver checkmarks). Vercel además crea un **preview deploy** con URL única
- **Cambiar env vars** → editás en cada dashboard, no se commitea nada

---

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| `CORS error` en console del browser | `CORS_ORIGINS` no incluye la URL de Vercel | Paso 4 |
| Frontend en Vercel muestra `undefined` o `/api/...` | `VITE_API_BASE_URL` no seteado o sin `/api` al final | Paso 3.3 |
| Backend tarda 30s la primera vez | Render free durmió | Normal, no es bug |
| `503 Service Unavailable` | Render aún levantando | Esperar 30s y reintentar |
| `API_KEY_INVALID` en logs de Render | Env var mal copiada | Re-pegar en Render dashboard |
| GitHub Actions falla en `pytest` | Test depende de algo que no está en CI | Mirar el log del job |
| Docker build falla | `requirements.txt` cambió y falló install | Mirar el log de Render |

---

## Checklist final

- [ ] PR de CI/CD mergeado a `main`
- [ ] GitHub Actions corre en verde en `main`
- [ ] Render web service creado, con 6 env vars, deploy en verde
- [ ] `https://tu-backend.onrender.com/api/tickers` devuelve JSON
- [ ] Vercel project creado, con `VITE_API_BASE_URL`, deploy en verde
- [ ] `CORS_ORIGINS` en Render incluye la URL de Vercel
- [ ] Frontend en `*.vercel.app` carga los 3 lanes con data real
