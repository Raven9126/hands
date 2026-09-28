# Hands — Limpieza profesional para alojamientos

Aplicación web de Hands: cotización, armado de servicio, reservas, evidencia fotográfica (antes/después), informe publicado y calificación.

HTML, CSS y JavaScript. Persistencia en el navegador (`localStorage` / `sessionStorage`). Sin API en esta versión.

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
| Persistencia | `localStorage` / `sessionStorage` |
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
| Landing | Hero con carrusel, cotización rápida (~20 s), servicios y proceso |
| Wizard | Ciudad, tamaño, insumos/kit, intensidad, agenda, cotización y checkout |
| Tarifas | Total con comisión Hands (12%); el host puede proponer otra tarifa |
| Layout | Navbar y footer por rol (`components/` + `layout.js`) |
| i18n | ES / EN en toda la interfaz |
| Evidencia | Flujo host → admin → provider → informe |
| PDF | Desde el detalle de la reserva |

Pagos Bold / Wompi y API quedan fuera de esta versión (confirmación de demostración sin cobro real).

---

## Mapa del sitio

| Sección | Archivo | Descripción |
|---------|---------|-------------|
| Inicio | `frontend/index.html` | Landing y cotización rápida |
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
    │   ├── layout.js
    │   ├── i18n.js
    │   ├── auth.js
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

Rama de trabajo: `Dev`. Publicación en Pages desde `main`.

---

## Despliegue (GitHub Pages)

1. Repositorio https://github.com/Raven9126/hands  
2. Settings → Pages → branch `main`, carpeta `/ (root)`  
3. `index.html` en la raíz redirige a `frontend/index.html`  
4. Sitio: https://raven9126.github.io/hands/

---

*Hands — Espacios limpios. Mejores días.*
