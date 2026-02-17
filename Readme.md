# FinBoard - Dashboard Financiero

Este repo ahora tiene dos opciones:

1. `frontend/` con Next.js + Tailwind (UI moderna y componentizada).
2. `backend/` con FastAPI (datos de mercado + exportacion Excel).

El `app.py` de Streamlit se mantiene como fallback/prototipo.

## Arquitectura Nueva

### Backend (`backend/`)

- API FastAPI
- Fuentes: `FRED`, `Stooq`, `Yahoo Finance`
- Mercados soportados:
  - `indices_etfs`
  - `monedas`
- Endpoints:
  - `GET /api/health`
  - `GET /api/assets?market=indices_etfs|monedas`
  - `POST /api/fetch`
  - `POST /api/fetch/stream` (progreso real para recarga)
  - `POST /api/export`
  - `POST /api/detail`
  - `GET /api/settings`
  - `POST /api/settings`

Instalacion:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Configurar FRED key (opcional pero recomendado):

```bash
export FRED_KEY="TU_FRED_KEY"
```

Ejecutar backend:

```bash
uvicorn backend.app.main:app --reload --port 8000
```

### Frontend (`frontend/`)

- Next.js (App Router)
- Tailwind CSS
- Estructura: `app/`, `components/`, `hooks/`, `styles/`, `public/`
- Rutas:
  - `/indices-etfs`
  - `/monedas`
  - `/detalle` (panel individual tipo Yahoo)
  - `/ajustes` (configuracion de FRED key y proveedores API)

Instalacion:

```bash
cd frontend
npm install
```

Configurar URL del backend:

```bash
cp .env.example .env.local
# por defecto: NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Ejecutar frontend:

```bash
cd frontend
npm run dev
```

Atajos utiles:

```bash
cd frontend
npm run dev:reset   # limpia .next y levanta dev
npm run test        # tests frontend (Vitest)
```

Abrir:

- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/docs`

## Deploy (Render + Netlify)

### 1) Backend en Render (plan gratuito)

1. Entra a Render y crea un `Web Service`:
   - https://render.com/docs/deploy-fastapi
2. Conecta este repo.
3. Configura el servicio:
   - `Root Directory`: `backend`
   - `Build Command`: `pip install -r requirements.txt`
   - `Start Command`: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Variables de entorno:
   - `FRED_KEY=tu_fred_key`
5. Despliega y copia la URL publica del backend, por ejemplo:
   - `https://finboard-api.onrender.com`

Tip:
- En Render Free el servicio puede "dormirse" tras inactividad y tardar en responder el primer request.
- Documentacion oficial: https://render.com/docs/free

### 2) Frontend en Netlify

Desde `frontend/`:

```bash
# link/create del sitio
npx netlify deploy --create-site finboard-zpu --team aguante-zpu --build

# apuntar frontend al backend publico de Render
npx netlify env:set NEXT_PUBLIC_API_BASE_URL https://TU-BACKEND-RENDER.onrender.com --context production deploy-preview

# deploy a produccion
npx netlify deploy --prod --build
```

## Netlify Sin Backend Separado

Si, es posible, pero con una condicion importante:

- No en modo estatico puro del frontend actual.
- Si en un solo proyecto Netlify, moviendo la API de `backend/` a funciones server-side en Next/Netlify (Node/TypeScript) dentro de `frontend/`.

Para este proyecto en su estado actual:
- Se usa logica server-side (FRED, Stooq, Yahoo, export Excel, claves API).
- Por eso hoy necesitas un backend ejecutandose en algun host (Render, Railway, etc.).

Si quieres eliminar el backend separado, el siguiente paso es una migracion:
1. Crear endpoints equivalentes en `frontend/app/api/*`.
2. Portar logica de `backend/app/services/market_data.py` a TypeScript.
3. Mantener el frontend consumiendo `/api/*` del mismo dominio Netlify.

## Flujo de uso

1. Abre `http://localhost:3000/indices-etfs` o `http://localhost:3000/monedas`.
2. Usa los chips superiores (rango, temporalidad, frecuencia, instrumento, actualizar).
3. Haz click en cualquier instrumento de la tabla para abrir su panel individual en `/detalle`.
4. Exporta con `Exportar Excel` (respeta filtros e inversiones activas).
5. La app recuerda preferencias de vista por mercado (filtros, modo, orden y opciones de matriz).

## Fallback Streamlit (Legado)

Si quieres usar la version monolitica original:

```bash
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## Changelog

- Historial de cambios: `CHANGELOG.md`
