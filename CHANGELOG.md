# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

Formato inspirado en Keep a Changelog.

## [Unreleased]

### Added
- Politica de registro continuo de cambios en `CHANGELOG.md`.
- Endpoint backend de recarga con progreso real:
  - `POST /api/fetch/stream` (SSE) para actualizar datos mostrando avance por instrumento.
- Capa de cache TTL para consultas de mercado:
  - servicio `backend/app/services/fetch_cache.py`.
  - uso en `POST /api/fetch` y `POST /api/fetch/stream`.
- Persistencia de preferencias en frontend:
  - utilidades `frontend/lib/prefs.ts` para guardar/cargar estado por mercado.
- Base de pruebas automatizadas:
  - backend `pytest` en `backend/tests/test_api.py`.
  - frontend `vitest` en `frontend/lib/date.test.ts`.
- Pipeline CI:
  - workflow `.github/workflows/ci.yml` con backend tests + frontend lint/test/build.
- Flujo de alta dinamica de instrumentos:
  - endpoint backend `GET /api/instrument-search` para buscar coincidencias en Yahoo + FRED.
  - modal frontend `+ Añadir nuevo instrumento` con buscador, checklist y alta de seleccionados.
- Soporte de instrumentos custom en payloads de datos:
  - `custom_assets` en `POST /api/fetch` y `POST /api/export`.
  - resolucion custom en `POST /api/detail` via `custom_source/custom_symbol`.

### Changed
- Navegacion superior simplificada:
  - se removio el item `Dashboard` del menu principal.
  - se removio el bloque derecho del header (`buscar`, `notificaciones`, `avatar`).
- Se removio la linea breadcrumb superior (`Analisis de Mercado > ...`) en vistas principales de mercado.
- `Readme.md` actualizado con:
  - guia de deploy `Render (backend) + Netlify (frontend)`.
  - aclaracion tecnica sobre el escenario `Netlify sin backend separado` y migracion necesaria.
- Boton `Actualizar` conectado a progreso real de backend:
  - ya no depende de animacion simulada.
  - el porcentaje avanza con eventos reales de carga.
- Persistencia de estado de consulta en `useDashboardData`:
  - rango, frecuencia, temporalidad, instrumentos seleccionados/incluidos, inversiones y custom assets.
- Persistencia de estado visual por mercado:
  - modo `Mercados/Matriz`, busqueda, filtros de instrumento, orden, `Ver %` y `Heatmap`.
- Frontend (`Next.js`) ahora incluye scripts de recuperacion de cache:
  - `npm run clean:next`
  - `npm run dev:reset`
  - `npm run build:reset`
- Reemplazo de flechas de paginacion inferior por boton `+ Añadir nuevo instrumento`.
- Vista `Matriz` actualizada para mostrar todas las filas filtradas en una sola tabla (sin paginacion por flechas).
- Apertura de detalle mejorada para instrumentos custom:
  - envio de metadata (`source` y `symbol`) desde frontend cuando aplica.
- Exportacion de metadatos en Excel extendida para incluir instrumentos custom (no solo catalogo fijo).
- Chip superior de actualizacion:
  - `Conexion en vivo` reemplazado por `Actualizar`.
  - al hacer click el relleno se anima dentro del propio boton (verde claro).
  - el progreso avanza lento mientras carga y solo llega a 100% cuando termina la actualizacion real.
- Validacion anti-error en fechas:
  - los inputs `DD/MM/AAAA` ahora bloquean fechas futuras (maximo = hoy).
  - `Aplicar rango` queda deshabilitado si hay fecha invalida o fuera de rango.
  - mensaje de error aclarado para formato invalido/fecha futura.
- Etiqueta de vista cambiada:
  - boton `Snapshot` renombrado a `Mercados`.
- Columna final de tabla de mercados renovada:
  - se removio el control `Invertir` por fila.
  - ahora muestra mini-graficos tipo sparkline (estilo mercado/Coingecko) por instrumento.
- Se removieron las tarjetas inferiores de resumen:
  - `Mayor Ganancia (24H)`, `Mayor Perdida (24H)`, `Alertas Activas`, `Estado del Sistema`.
  - tambien se removio el toggle de configuracion asociado a esas tarjetas.
- Modo `Matriz` rediseñado para estilo tabla matricial:
  - cabecera sticky con mini sparklines por instrumento.
  - columna `Fecha` sticky a la izquierda.
  - filas alternadas y scrolling interno mas similar a layout de terminal financiera.
  - toggle `Ver %` para alternar entre precio absoluto y variacion porcentual diaria.
  - toggle `Heatmap` para colorear celdas por intensidad positiva/negativa.

### Fixed
- Cache de fetch invalidada al guardar ajustes (`POST /api/settings`) para evitar respuestas viejas tras cambio de `FRED_KEY`.
- Endpoint stream devuelve eventos `progress/result/error/complete` consistentes para el frontend.
- Mini-graficas de `Tendencia` corregidas:
  - se evita convertir `null` a `0` al construir la serie (caida falsa al final).
  - color de sparkline basado en su propia pendiente real (ultimo vs primero), no solo en `Cambio %`.
- Columna `Tendencia` alineada con el cambio diario de la fila:
  - la mini-grafica ahora se construye con `prev_close/open/high/low/close` (movimiento del dia).
  - se evita desalineacion visual con `% Cambio` cuando la serie YTD viene bajista pero el dia cierra al alza.
- Estabilidad en entorno local:
  - `NEXT_PUBLIC_API_BASE_URL` de ejemplo y fallback interno actualizado a `http://127.0.0.1:8000` para evitar fallos `localhost` (IPv6/IPv4) que se ven como CORS `status null`.
  - `suppressHydrationWarning` agregado en `<html>` para reducir ruido de hidratacion causado por extensiones que inyectan clases/atributos.
- Deploy Netlify corregido:
  - frontend ajustado a `output: "export"` para publicar estatico en `out/`.
  - agregado `frontend/netlify.toml` (`build` + `publish = out`).
  - se evita publicar `.next` directamente (causaba 404/MIME en chunks JS).

### Verified
- Backend:
  - `./.venv/bin/python -m pytest -q backend/tests` OK (`3 passed`).
- Frontend:
  - `npm run test` OK (Vitest).
  - `npm run lint` OK.
  - `npm run build` OK.

## [2026-02-17]

### Added
- Nueva arquitectura full-stack separada:
  - `backend/` con FastAPI.
  - `frontend/` con Next.js + Tailwind.
- API backend inicial en `backend/app/main.py` con endpoints:
  - `GET /api/health`
  - `GET /api/assets`
  - `POST /api/fetch`
  - `POST /api/export`
- Endpoint nuevo:
  - `POST /api/detail` para panel individual por instrumento.
- Endpoints de ajustes:
  - `GET /api/settings`
  - `POST /api/settings`
- Servicio de datos de mercado en `backend/app/services/market_data.py`:
  - Integracion con FRED, Stooq y Yahoo.
  - Frecuencias `D/B/W/M`.
  - Construccion de series base y snapshot.
  - Inversion global y por instrumento (`1/x`).
  - Exportacion Excel.
- Soporte de mercado dual en backend:
  - `indices_etfs` (catalogo original).
  - `monedas` (pares FX con fallback de tickers Yahoo).
- Esquemas de validacion backend en `backend/app/schemas.py`.
- Configuracion compartida backend en `backend/app/config.py`.
- Frontend modularizado en:
  - `frontend/app`
  - `frontend/components`
  - `frontend/hooks`
  - `frontend/lib`
  - `frontend/styles`
  - `frontend/types`
- Hook de datos `frontend/hooks/useDashboardData.ts`.
- Hook de tabla snapshot `frontend/hooks/useSnapshotTable.ts`.
- Componentes UI:
  - `TopBar`
  - `ChipRow`
  - `ConfigPanel`
  - `SnapshotTable`
  - `KpiCards`
  - `MarketDashboard`
  - `DetailPageClient`
- Cliente API frontend en `frontend/lib/api.ts`.
- Utilidades de fecha/formato en `frontend/lib/date.ts` y `frontend/lib/format.ts`.
- Configuracion de proyecto frontend (`package.json`, Tailwind, TypeScript, ESLint, Next config).
- Rutas frontend nuevas:
  - `/indices-etfs`
  - `/monedas`
  - `/detalle`
  - `/ajustes`
- `backend/.env.example`, `frontend/.env.example`, `Makefile` y `.gitignore`.

### Changed
- `Readme.md` actualizado para documentar:
  - Ejecucion backend + frontend.
  - Endpoints API y mercados.
  - Flujo de fallback Streamlit.
- UI principal unificada al estilo dashboard de referencia:
  - chips superiores funcionales conservando estilo visual.
  - tabla con filtros, paginacion y exportacion.
  - click en instrumento para abrir panel individual.
- Ajustes del sistema:
  - formulario para guardar/limpiar `FRED_KEY` desde UI.
  - seccion informativa de proveedores API usados (FRED, Yahoo, Stooq).
- Texto introductorio de indices/ETFs simplificado (se removio descripcion larga solicitada).
- Mejora visual de monedas:
  - iconos por par (banderas de ambas divisas).
  - punto de color por moneda base en tabla y detalle.
  - badges de par en KPIs y panel de detalle.
- Mejora visual de indices/ETFs:
  - emoji/simbolo por instrumento en columna `Instrumento`.
  - simbolos de token para cripto cuando aplica (`₿`, `Ξ`, etc.).
  - iconos coherentes en KPIs, dropdown de instrumento y panel detalle.
  - fallback inteligente por nombre/ticker (fuzzy match) para mantener iconos aunque cambie levemente el label.
- Controles superiores actualizados:
  - `Preset` renombrado a `Temporalidad` con dropdown.
  - `Frecuencia` convertida a dropdown.
  - `Registros` reemplazado por dropdown de instrumento (moneda/indice/ETF).
- Tabla snapshot con ordenamiento interactivo por encabezado:
  - flechas en `Fecha`, `Instrumento`, `Apertura`, `Maximo`, `Minimo`, `Cierre` y `Cambio %`.
  - toggle asc/desc al hacer click.
- Chip `Rango` mejorado:
  - abre selector tipo calendario (`Desde/Hasta`) al hacer click.
  - muestra calculo de `Dias seleccionados`.
  - permite aplicar rango custom directamente desde el popover.
- Entradas de fecha mejoradas:
  - `Desde/Hasta` ahora usan 3 cajones (`DD/MM/AAAA`) en lugar del picker nativo.
  - soporte de pegado rapido (`dd/mm/aaaa` o `yyyy-mm-dd`) para carga manual sin desplegar calendario.
  - en el popover de rango, `Dias seleccionados`, `Cancelar` y `Aplicar rango` quedaron en una misma fila.
- Chip `Instrumento` mejorado:
  - selector multiseleccion con checkboxes para ver varios instrumentos a la vez.
  - boton `Reset` para limpiar la seleccion sin desmarcar uno por uno.
  - boton `Todos` para restaurar vista completa rapidamente.
- Tarjetas inferiores configurables:
  - toggle en `Configurar Vista` para mostrar/ocultar `Alertas Activas` y `Estado del Sistema`.
  - `Mayor Ganancia` y `Mayor Perdida` se mantienen visibles.
- Nueva vista de tabla `Matriz`:
  - boton para alternar entre `Snapshot` y `Matriz`.
  - `Matriz` muestra instrumentos como columnas y fechas en filas (estilo dataframe).
  - mantiene paginacion y buscador en ambas vistas.
- Ajuste de snapshot:
  - se muestran todos los instrumentos cargados en la misma vista (sin corte de 10 filas).
  - la paginacion inferior queda solo para la vista `Matriz`.
- Zona horaria de actualizacion ajustada:
  - visualizacion de `ULTIMA ACTUALIZACION` convertida de UTC a hora Bogota (`COT`, UTC-5).
  - mismo ajuste aplicado en el panel de detalle.

### Fixed
- Error de servidor en Next (`Cannot find module './454.js'`) mitigado con regeneracion limpia de `.next` y flujo de reset disponible via scripts.
- Serializacion de `base_rows` para usar clave `date` consistente en API.
- Error JSX en `ConfigPanel` por texto `D -> B` (escapado correcto para lint/build).

### Verified
- Backend:
  - Compilacion Python OK.
  - `GET /api/health` OK.
- `GET /api/assets` OK para `indices_etfs` y `monedas`.
- `POST /api/fetch` OK.
- `POST /api/export` OK (archivo Excel generado).
- `POST /api/detail` OK.
- `GET /api/settings` y `POST /api/settings` OK.
- Frontend:
  - `npm run lint` OK.
  - `npm run build` OK.

## [2026-02-16]

### Added
- Mejoras fuertes de UI en Streamlit para acercar el look & feel al dashboard de referencia.
- Chips superiores interactivos para:
  - Rango
  - Frecuencia
  - Registros
  - Conexion en vivo
- Columna `Invertir` funcional por instrumento (toggle `1/x`) en snapshot.

### Changed
- Ajustes de estilo para conservar formato de chips tipo "botonsitos".
- Densidad y responsive optimizados para `1366x768` sin romper movil/tablet.

### Fixed
- Manejo de estado para evitar error de Streamlit al modificar `cfg_included_assets` despues de instanciar widget.
