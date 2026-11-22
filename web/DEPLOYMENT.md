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
   psql $DATABASE_URL -f web/backend/src/db/schema.sql
   ```
6. Ejecutar el seed (solo bloques horarios iniciales; no crea usuarios ni contraseñas):
   ```bash
   psql $DATABASE_URL -f web/backend/src/db/seed.sql
   ```
7. Crear el primer administrador. Las credenciales se pasan por variables de entorno, nunca se escriben en el repositorio ni en archivos versionados:
   ```bash
   cd web/backend
   ADMIN_EMAIL="correo@ejemplo.cl" ADMIN_PASSWORD="<clave de al menos 10 caracteres, con mayúscula, minúscula y número>" npm run create-admin
   ```
   El script valida la fortaleza de la clave, guarda solo su hash (bcrypt) y no sobrescribe un usuario que ya exista.
8. Verificar que las tablas existan:
   ```sql
   \dt
   ```

---

## B. Railway — Backend (Express)

1. En el mismo proyecto Railway, agregar un nuevo servicio **GitHub Repo**.
2. Conectar el repositorio y configurar:
   - **Root Directory**: `web/backend`
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

   Pagos en línea (opcionales, solo en modo prueba por ahora):

   | Variable | Valor |
   |---|---|
   | `BACKEND_PUBLIC_URL` | URL pública de la API en Railway (sin `/` final); Mercado Pago la usa para redirigir y notificar |
   | `MP_HABILITADO` | `1` para activar Mercado Pago |
   | `MP_MODO_PRUEBA` | `1` para declarar que el token es de **prueba**. Sin esta variable Mercado Pago queda deshabilitado |
   | `MP_ACCESS_TOKEN` | Access Token de las **credenciales de prueba** de Mercado Pago. Hoy empieza con `APP_USR-` igual que el de producción, por eso el prefijo no sirve para distinguirlos: usar solo el de *Credenciales de prueba* y nunca el de producción |

   Antes de activar Mercado Pago hay que aplicar a mano la migración `007_metodo_mercadopago.sql` en la base de producción.

4. Railway desplegará automáticamente al detectar el directorio `backend`.
5. Probar los endpoints:
   ```
   GET https://TU-BACKEND.up.railway.app/api/ping
   ```
   Debe responder `{ ok: true, ... }`. El diagnóstico de base de datos (`GET /api/db-test`) requiere sesión de administrador (cabecera `Authorization: Bearer <token>`).
6. Copiar la URL pública del backend (ej. `https://powerbuilding-api.up.railway.app`).

---

## C. Netlify — Frontend

1. En [netlify.com](https://app.netlify.com), crear un nuevo sitio:
   - **Add new site → Import an existing project → GitHub**.
   - Seleccionar el repositorio.
   - **Base directory**: dejar vacío (o `web`).
   - **Publish directory**: `web` (carpeta donde está `index.html`).
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
- [ ] Login como admin (con el administrador creado con `npm run create-admin`)
- [ ] Registro de un alumno nuevo e inicio de sesión con esa cuenta
- [ ] Registro con un correo que ya tiene ficha creada por el gimnasio: debe responder "te enviamos un correo", llegar el enlace (revisar spam) y, al abrirlo, quedar la cuenta activa con la ficha enlazada. Requiere `EMAIL_PROVIDER=brevo`, `EMAIL_API_KEY`, `EMAIL_FROM` y `FRONTEND_URL` configuradas en Railway
- [ ] Pago en línea con Mercado Pago (sandbox): elegir el método, completar el pago de prueba y verificar que la membresía quede activa y llegue el comprobante
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
