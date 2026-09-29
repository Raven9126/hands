# Hands — Limpieza profesional para alojamientos

Aplicación web de Hands: cotización, armado de servicio, reservas, evidencia fotográfica (antes/después), informe publicado y calificación.

HTML, CSS y JavaScript. El acceso (login, registro y sesión) usa la API Spring Boot a través de `js/api.js`. Reservas y paneles de admin/provider siguen en almacenamiento local del navegador mientras se migran a la API.

Guía de arranque del front y conexión a la API: [`frontend/README.md`](frontend/README.md).

---

## Enlaces

| Recurso | URL |
|---------|-----|
| Sitio | https://raven9126.github.io/hands/ |
| Repositorio | https://github.com/Raven9126/hands |

---

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Tipografía | Outfit, Playfair Display |
| Idiomas | Español / English |
| Auth | API REST + JWT (`js/api.js`) |
| Datos locales | Reservas y operación admin/provider en `localStorage` |
| API (desarrollo) | Spring Boot en `http://localhost:8081` — ver `frontend/README.md` |
| Informe PDF | Impresión del navegador |
| Despliegue | GitHub Pages (`main`) |

---

## Roles

| Rol | Funciones |
|-----|-----------|
| **Host** | Cotización, armado de servicio, reservas, contraoferta de tarifa, evidencia publicada, calificación, cancelación, cuenta |
| **Admin** | Asignación de prestador, estados, revisión de evidencia, publicación del informe, aprobación de tarifas propuestas |
| **Provider** | Trabajos asignados, envío y corrección de evidencia |

```text
Host → Admin asigna → Provider evidencia → Admin publica → Host informe / PDF / rating
```

Si el host propone otra tarifa, Admin aprueba o rechaza antes del checkout.

---

## Cuentas de demostración

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Host | `host@hands.co` | `Hands@2026Co!` |
| Admin | `admin@hands.co` | `Hands@2026Co!` |
| Provider | `carlos@hands.co` | `Hands@2026Co!` |

Reserva de ejemplo con informe y calificación:

`frontend/booking-detail.html?id=job-demo-showcase`

---

## Funcionalidad

| Área | Detalle |
|------|---------|
| Landing | Hero con carrusel, cotización rápida (~20 s) con las mismas tarjetas de tamaño del wizard, servicios y proceso |
| Wizard | Ciudad, tamaño (casitas isométricas), insumos/kit, intensidad, agenda, cotización y checkout |
| Tarifas | Total con comisión Hands (12%); el host puede proponer otra tarifa |
| Layout | Navbar y footer por rol (`components/` + `layout.js`) |
| i18n | ES / EN en toda la interfaz |
| Evidencia | Flujo host → admin → provider → informe |
| PDF | Desde el detalle de la reserva |

Pagos en línea (Bold / Wompi) aún no están en el front estático. El checkout de demostración no realiza cobro real.

---

## Mapa del sitio

| Sección | Archivo | Descripción |
|---------|---------|-------------|
| Inicio | `frontend/index.html` | Landing y cotización rápida (`#cotizar`) |
| Armar servicio | `frontend/build.html` | Wizard de reserva |
| Login / Registro | `frontend/login.html` · `register.html` | Acceso por rol |
| Mis reservas | `frontend/bookings.html` | Listado y cancelación |
| Detalle | `frontend/booking-detail.html` | Resumen, fotos, rating, PDF |
| Mi cuenta | `frontend/account.html` | Perfil y propiedad |
| Provider | `frontend/provider.html` | Portal de evidencia |
| Admin | `frontend/admin.html` | Operación y tarifas |
| Resultados | `frontend/results.html` | Antes / después |
| Contacto | `frontend/contact.html` | Formulario de contacto |
| Servicio | `frontend/service.html` | Detalle de oferta |

---

## Estructura

```text
hands/
├── README.md
├── index.html                 # Redirect a frontend/
├── .gitignore
└── frontend/
    ├── *.html
    ├── css/styles.css
    ├── js/
    │   ├── api.js
    │   ├── auth.js
    │   ├── layout.js
    │   ├── i18n.js
    │   ├── main.js
    │   ├── bookings.js
    │   ├── admin.js
    │   ├── provider.js
    │   ├── hero-carousel.js
    │   └── …
    ├── components/
    │   ├── navbar/
    │   └── footer/
    └── img/
        ├── brand/
        ├── icons/
        ├── photos/
        └── diagrams/
```

---

## Desarrollo local

Servir `frontend` por HTTP (no `file://`):

```bash
cd frontend
npx --yes serve -l 8777 .
```

http://localhost:8777

Para auth contra la API en local: Postgres en el puerto `5433` y Spring Boot en `8081` (detalle en [`frontend/README.md`](frontend/README.md)).

Rama de trabajo: `Dev`. Publicación en Pages desde `main`.

---

## Despliegue (GitHub Pages)

1. Repositorio https://github.com/Raven9126/hands  
2. Settings → Pages → branch `main`, carpeta `/ (root)`  
3. `index.html` en la raíz redirige a `frontend/index.html`  
4. Sitio: https://raven9126.github.io/hands/

---

*Hands — Espacios limpios. Mejores días.*
