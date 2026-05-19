# Deployment — Powerbuilding.gym

## A. Railway — PostgreSQL

1. En [railway.app](https://railway.app), crear un nuevo proyecto.
2. Agregar servicio **PostgreSQL** (Add Service → Database → PostgreSQL).
3. Copiar `DATABASE_URL` desde la pestaña **Variables** del servicio PostgreSQL.
4. Conectarse a la base de datos (Railway Shell o cliente externo como DBeaver/psql):
   ```
   psql $DATABASE_URL
   ```
5. Ejecutar el schema:
   ```bash
   psql $DATABASE_URL -f backend/src/db/schema.sql
   ```
6. Ejecutar el seed (usuarios y bloques iniciales):
   ```bash
   psql $DATABASE_URL -f backend/src/db/seed.sql
   ```
7. Verificar que las tablas existan:
   ```sql
   \dt
   ```

---

## B. Railway — Backend (Express)

1. En el mismo proyecto Railway, agregar un nuevo servicio **GitHub Repo**.
2. Conectar el repositorio y configurar:
   - **Root Directory**: `backend`
   - **Start Command**: `npm start`
3. Ir a **Variables** del servicio backend y agregar:

   | Variable       | Valor                                      |
   |----------------|--------------------------------------------|
   | `DATABASE_URL` | (copiada del servicio PostgreSQL)          |
   | `JWT_SECRET`   | cadena aleatoria segura (mín. 32 chars)    |
   | `JWT_EXPIRES_IN` | `7d`                                     |
   | `FRONTEND_URL` | URL de Netlify (se agrega tras el deploy)  |
   | `NODE_ENV`     | `production`                               |
   | `PORT`         | Railway lo asigna automáticamente          |

4. Railway desplegará automáticamente al detectar el directorio `backend`.
5. Probar los endpoints:
   ```
   GET https://TU-BACKEND.up.railway.app/api/ping
   GET https://TU-BACKEND.up.railway.app/api/db-test
   ```
   Ambos deben responder `{ ok: true, ... }`.
6. Copiar la URL pública del backend (ej. `https://powerbuilding-api.up.railway.app`).

---

## C. Netlify — Frontend

1. En [netlify.com](https://app.netlify.com), crear un nuevo sitio:
   - **Add new site → Import an existing project → GitHub**.
   - Seleccionar el repositorio.
   - **Base directory**: dejar vacío (o `/` si lo pide).
   - **Publish directory**: `/` (raíz del repo — donde está `index.html`).
   - **Build command**: dejar vacío (es HTML estático).
2. Hacer deploy inicial.
3. **Antes de usar en producción**, editar `index.html` y reemplazar:
   ```html
   <!-- Para producción: reemplazar por window.API_BASE_URL = "https://TU-BACKEND.up.railway.app/api"; -->
   <script>window.API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000/api';</script>
   ```
   Por:
   ```html
   <script>window.API_BASE_URL = 'https://TU-BACKEND.up.railway.app/api';</script>
   ```
   Reemplazar `TU-BACKEND.up.railway.app` con la URL real de Railway.
4. Volver a Railway y actualizar la variable `FRONTEND_URL` con la URL de Netlify
   (ej. `https://powerbuilding-gym.netlify.app`).
5. Hacer redeploy del backend en Railway para que tome el nuevo CORS.
6. Hacer commit y push del `index.html` modificado → Netlify redeploya automáticamente.
7. Probar login en la URL de Netlify.

---

## D. Checklist post-deploy

Abrir la URL de Netlify y verificar cada ítem con DevTools → Network abierto:

### Auth
- [ ] Login como admin (`admin@powerbuilding.gym` / contraseña del seed)
- [ ] Login como alumno (`carlos@gmail.com` / contraseña del seed)
- [ ] Logout y re-login
- [ ] Token guardado en `localStorage` como `pb_token`

### Landing (alumno)
- [ ] Bloques se cargan correctamente por día
- [ ] Reservar un bloque
- [ ] Cancelar una reserva

### Admin — Bloques
- [ ] Listar bloques
- [ ] Crear un bloque nuevo
- [ ] Editar un bloque existente
- [ ] Suspender / activar bloque
- [ ] Eliminar un bloque de prueba

### Admin — Clientes
- [ ] Listar clientes
- [ ] Buscar por nombre
- [ ] Crear un cliente nuevo
- [ ] Ver ficha de cliente (bloques reservados)
- [ ] Editar cliente
- [ ] Cambiar estado del cliente

### Admin — Asistencia
- [ ] Seleccionar día y ver bloques con alumnos
- [ ] Marcar asistencia
- [ ] Desmarcar asistencia

### Admin — Dashboard
- [ ] KPI cards cargan con valores reales
- [ ] Gráfico de reservas por día
- [ ] Gráfico de ocupación por bloque
- [ ] Alertas y actividad reciente

### Admin — Negocio
- [ ] KPI cards
- [ ] Ranking de bloques
- [ ] Gráfico de retención
- [ ] Gráfico de tendencia semanal
- [ ] Tabla de clientes en riesgo

### Consola y red
- [ ] Sin errores rojos en consola
- [ ] Sin peticiones CORS bloqueadas
- [ ] Todas las respuestas de API retornan 200/201

---

## Variables de entorno necesarias en Railway

```
DATABASE_URL=postgresql://...    # auto-generado por el servicio PostgreSQL
JWT_SECRET=<string-aleatorio-32-chars>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://TU-SITIO.netlify.app
NODE_ENV=production
```

`PORT` **no** debe setearse manualmente — Railway lo inyecta automáticamente.

---

## Notas de producción

- **Zona horaria**: `diaHoyEs()` ya usa `America/Santiago`. El cálculo de `CURRENT_DATE` en PostgreSQL usará la zona horaria del servidor de Railway (UTC). Si hay diferencia de madrugada en las consultas de asistencia, agregar `AT TIME ZONE 'America/Santiago'` en las queries correspondientes.
- **HTTPS**: Railway y Netlify proveen HTTPS por defecto. No se requiere configuración adicional.
- **Variables sensibles**: Nunca subir `.env` real al repositorio — está ignorado por `.gitignore`.
