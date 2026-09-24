# Hands — Limpieza profesional para alojamientos

Frontend de **Hands**: servicio de limpieza para alojamientos con armado de pedido, reserva, evidencia fotográfica (antes/después), informe publicado y calificación.

Construido con **HTML, CSS y JavaScript** vanilla. La persistencia es local (`localStorage` / `sessionStorage`); no incluye API ni backend en esta versión.

---

## Enlaces

| Recurso | URL |
|---------|-----|
| **Sitio** | https://raven9126.github.io/hands/ |
| **Repositorio** | https://github.com/Raven9126/hands |

---

## Stack

| Capa | Tecnologías |
|------|-------------|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Tipografía | Outfit, Playfair Display (Google Fonts) |
| Idiomas | Español / English |
| Persistencia | `localStorage` / `sessionStorage` |
| Informe PDF | Impresión del navegador (Guardar como PDF) |
| Despliegue | GitHub Pages |

---

## Roles

| Rol | Funciones |
|-----|-----------|
| **Host** | Registro, armado de servicio, reservas, evidencia publicada, calificación, cancelación (pending / assigned), cuenta |
| **Admin** | Asignación de prestador, estados, revisión de evidencia, selección de fotos y publicación del informe |
| **Provider** | Jobs asignados, envío y corrección de evidencia |

```text
Host → Admin asigna → Provider evidencia → Admin publica → Host ve informe / PDF / rating
```

---

## Cuentas de demostración

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Host | `host@hands.co` | `Hands@2026Co!` |
| Admin | `admin@hands.co` | `Hands@2026Co!` |
| Provider | `carlos@hands.co` | `Hands@2026Co!` |

Reserva de ejemplo con informe publicado y calificación:

`frontend/booking-detail.html?id=job-demo-showcase`

---

## Mapa del sitio

| Sección | Archivo | Descripción |
|---------|---------|-------------|
| Inicio | `frontend/index.html` | Landing, servicios, proceso |
| Armar servicio | `frontend/build.html` | Wizard de reserva |
| Login / Registro | `frontend/login.html` · `register.html` | Autenticación por rol |
| Mis reservas | `frontend/bookings.html` | Listado y cancelación |
| Detalle | `frontend/booking-detail.html` | Resumen, fotos, rating, PDF |
| Mi cuenta | `frontend/account.html` | Perfil y propiedad |
| Provider | `frontend/provider.html` | Portal de evidencia |
| Admin | `frontend/admin.html` | Operación y revisión |
| Resultados | `frontend/results.html` | Antes / después |
| Contacto | `frontend/contact.html` | Formulario de contacto |

---

## Estructura

```
hands/
├── README.md
├── index.html              # Redirect a frontend/
├── .gitignore
├── frontend/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── img/
│       ├── brand/
│       ├── photos/
│       └── diagrams/
└── backend/                # Preparación futura
```

---

## Desarrollo local

Servir la carpeta `frontend` por HTTP (no usar `file://`):

```bash
cd frontend
npx --yes serve -l 8777 .
```

http://localhost:8777

---

## Despliegue (GitHub Pages)

1. Repositorio público `hands` en https://github.com/Raven9126  
2. Settings → Pages → branch `main`, carpeta **/ (root)**  
3. El `index.html` de la raíz redirige a `frontend/index.html`  
4. Sitio: https://raven9126.github.io/hands/

---

## Alcance actual

Incluye el circuito host → admin → provider → informe → rating, i18n ES/EN, cuenta editable, contacto y PDF desde el detalle.

**Pendiente de etapas posteriores:** API, autenticación en servidor, carga real de archivos, pagos y notificaciones. Por ahora, la evidencia del prestador usa imágenes locales de `img/photos/`; el contacto se almacena en el navegador.

---

*Hands — Espacios limpios. Mejores días.*
