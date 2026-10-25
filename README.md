# Cash Dashboard

Dashboard de *cash collected* estilo Stripe para tus empresas (Estonia, EE. UU., Paraguay).
Filtros de periodo (Hoy / Ayer / Esta semana / Este mes / Últimos 30 días + rango de fechas),
gráfica con degradado y **números editables** (se guardan en el navegador vía `localStorage`).

Sitio **estático** (HTML + CSS + JS, sin build). Listo para Vercel.

## Archivos
- `index.html` — estructura
- `styles.css` — estilo (Stripe-like, claro)
- `app.js` — lógica: datos, filtros, gráfica SVG, edición

## Probarlo en local
Abre `index.html` en el navegador, o levanta un servidor:
```bash
python -m http.server 8137
```
y entra en http://127.0.0.1:8137

## Subirlo a Vercel
**Opción rápida (CLI):**
```bash
npm i -g vercel
cd cash-dashboard
vercel
```
Sigue el asistente (scope = tu cuenta, es un proyecto nuevo). Para producción: `vercel --prod`.

**Opción con GitHub:**
```bash
cd cash-dashboard
git init && git add . && git commit -m "Cash dashboard inicial"
git branch -M main
git remote add origin https://github.com/jorgeacz00-code/cash-dashboard.git
git push -u origin main
```
Luego en vercel.com → *Add New Project* → importa el repo. Como es estático, no hace falta
configurar build (framework = "Other").

## Cómo editar los números
Botón **✎ Editar datos** (arriba a la derecha) → tabla con un día por fila e importes por
empresa. Se guardan solos y la gráfica + KPIs se actualizan en vivo. Botón para añadir días o
restablecer el ejemplo.

## Siguiente: conectar las APIs de los bancos (cuando quieras)
Ahora los datos salen de `localStorage` (ejemplo editable). Para traer el cash real:
1. Añade funciones serverless en una carpeta `/api` (Vercel las despliega solas).
2. Cada función llama a la API del banco/pasarela correspondiente (Stripe, Wise, el banco de
   Estonia, el de EE. UU., el de Paraguay…) y devuelve `{date, estonia, usa, paraguay}`.
3. En `app.js`, sustituye `load()` por un `fetch('/api/cash')` que rellene `DATA`.
4. Guarda las claves de API como *Environment Variables* en Vercel (nunca en el código).

El modelo de datos ya es el adecuado: un array de `{date, estonia, usa, paraguay}` en USD.
