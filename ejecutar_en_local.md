# Ejecutar en Local

Parece que el error `zsh: command not found: uvicorn` ocurría porque tu carpeta cambió de nombre (de `Dashboard Financiero` a `-- 04 Dashboard Financiero`), lo cual rompió las rutas absolutas dentro de los binarios del entorno virtual (`.venv/bin/uvicorn`).

Para solucionarlo, he recreado el entorno virtual por ti. 

A partir de ahora, para levantar el proyecto sigue estos pasos:

## 1. Moverse a la carpeta del proyecto
Abre una terminal y asegúrate de estar en el directorio correcto:
```bash
cd "/Users/santiagocordoba/GITHUBS/-- 04 Dashboard Financiero"
```

## 2. Iniciar el Backend (Terminal 1)
En esa misma terminal, activa el entorno virtual y arranca el servidor FastAPI:
```bash
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```
*Esto dejará la API de datos y la IA de Gemini corriendo en el puerto 8000.*

## 3. Iniciar el Frontend (Terminal 2)
Abre **otra pestaña o ventana de terminal**, asegúrate de estar en la carpeta del proyecto, y ejecuta:
```bash
cd frontend
npm run dev
```

## 4. Usar la aplicación
Abre tu navegador web y entra a:
👉 [http://localhost:3000](http://localhost:3000)

**Tip:** Si en algún momento vuelves a cambiar de nombre o mover esta carpeta, probablemente necesites borrar la carpeta `.venv` y volver a instalar las dependencias con `python3 -m venv .venv` y `pip install -r backend/requirements.txt`.
