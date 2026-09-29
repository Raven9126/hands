# Hands — Frontend

Interfaz web de Hands (HTML, CSS y JavaScript). Login, registro y sesión se autentican contra la API Spring Boot mediante `js/api.js`. Reservas, admin y evidencia permanecen en `localStorage` hasta que existan los endpoints correspondientes.

El README del repositorio describe el producto y el mapa del sitio. Este documento cubre el arranque local y la configuración de la API.

---

## Arranque local

Servir esta carpeta por HTTP (no abrir los HTML con `file://`):

```bash
cd frontend
npx --yes serve -l 8777 .
```

Abrir http://localhost:8777

Puertos habituales (`5500`, `3000`, `8777`) deben estar permitidos en CORS del backend.

---

## Conexión a la API

| Ítem | Valor |
|------|--------|
| Base URL por defecto | `http://localhost:8081` |
| Auth | Bearer JWT (`localStorage` clave `hands-access-token`) |
| Cliente HTTP | `js/api.js` → `window.HandsApi` |
| Sesión de interfaz | `js/auth.js` → `window.HandsAuth` |

### Override de la URL base

Se resuelve en este orden:

1. `window.HANDS_API_URL`
2. `<meta name="hands-api-url" content="https://…">`
3. `localStorage` clave `hands-api-url`
4. Valor por defecto: `http://localhost:8081`

### API en desarrollo local

```bash
cd backend
docker compose up -d
cd api
set -a && source ../.env && set +a
./mvnw spring-boot:run
```

- Base de datos: Postgres en el host, puerto `5433`
- API: http://localhost:8081
- Health: http://localhost:8081/actuator/health

### Cuentas de demostración

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Host | `host@hands.co` | `Hands@2026Co!` |
| Admin | `admin@hands.co` | `Hands@2026Co!` |
| Provider | `carlos@hands.co` | `Hands@2026Co!` |

---

## Scripts principales

| Archivo | Responsabilidad |
|---------|-----------------|
| `js/api.js` | Cliente HTTP (`/api/v1/*`), token y auth |
| `js/auth.js` | Sesión de UI; login y registro vía API |
| `js/auth-pages.js` | Formularios de `login.html` y `register.html` |
| `js/bookings.js` | Reservas (almacenamiento local) |
| `js/layout.js` | Navbar y footer según rol |

Las páginas HTML cargan `api.js` antes de `auth.js`.

---

## Notas

- El paquete `backend/` es local por ahora y no forma parte del despliegue en GitHub Pages.
- Cuando exista un entorno de staging, configurar la URL con `HANDS_API_URL` o la meta `hands-api-url`.
