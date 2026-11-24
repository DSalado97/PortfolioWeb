# Portfolio Web — Daniel Salado Romero

Portafolio profesional online que muestra mi trayectoria como Analista de Ciberseguridad Junior y Desarrollador Full Stack, proyectos realizados, habilidades técnicas y formación académica.

**[Ver en vivo](https://dsalado97.github.io/PortfolioWeb/)**

## Stack

- **HTML5** semántico y accesible
- **CSS3** con variables personalizadas y modo oscuro (preferencia del sistema + selector manual, sin parpadeo)
- **Bootstrap 5.3** — grid y utilidades (solo CSS)
- **JavaScript** vanilla — interactividad, animaciones y lógica
- **Librerías**: AOS (animaciones), Typed.js (texto animado), Isotope (filtrado de portfolio), Bootstrap Icons
- **Datos**: snapshot JSON estático (`assets/data/portfolio.json`) generado desde MongoDB
- **Backend opcional**: Node.js, Express y driver oficial de MongoDB (API en Render)

## Estructura

```
portfolio-web/
├── index.html                          # Página principal (HTML estático sincronizado con el snapshot)
├── portfolio-details-*.html            # Páginas de detalle de proyectos
├── 404.html                            # Página de error para GitHub Pages
├── server.js                           # API y servidor de archivos públicos (opcional)
├── render.yaml                         # Configuración del despliegue en Render
├── package.json                        # Dependencias y comandos
├── PENDIENTES.md                       # Tareas que requieren intervención manual
├── assets/
│   ├── css/main.css                    # Estilos principales
│   ├── data/portfolio.json             # Snapshot del contenido (sin datos privados)
│   ├── js/
│   │   ├── main.js                     # Interactividad (menú, tema, filtros, acordeones, hero)
│   │   ├── portfolio-render.js         # Generadores de HTML (navegador y Node)
│   │   └── portfolio-data.js           # Carga el snapshot y actualiza la portada si cambió
│   ├── img/                            # Imágenes WebP/JPG, iconos y og-image
│   │   └── projects/                   # Miniaturas, vídeos WebM/MP4 y pósters
│   └── vendor/                         # Librerías de terceros (no modificar)
├── scripts/
│   ├── exportar-snapshot.js            # MongoDB (o API) → assets/data/portfolio.json
│   ├── sincronizar-html.js             # snapshot → bloques estáticos de index.html
│   ├── actualizar-mongo.js             # Aplica a MongoDB los cambios de datos (ensayo por defecto)
│   ├── verificar.js                    # Comprobaciones automáticas
│   └── migrate-to-atlas.js             # Migración local → Atlas
├── CV/                                 # Versión imprimible del CV
└── .gitignore
```

## Flujo de datos: MongoDB → snapshot → web

MongoDB sigue siendo la fuente de verdad, pero la web **no depende de ningún servidor** para cargar:

1. `npm run snapshot` lee MongoDB (variable `MONGODB_URI` del `.env`) y escribe `assets/data/portfolio.json`, quitando `_id`, teléfono y fecha de nacimiento. Después ejecuta `scripts/sincronizar-html.js`, que regenera en `index.html` los bloques de proyectos, tecnologías, experiencia, formación, contacto y el JSON-LD.
2. El HTML ya contiene el contenido final, así que no hay saltos al cargar. En el navegador, `portfolio-data.js` descarga el snapshot (mismo origen) y solo vuelve a pintar la portada si `data-snapshot` del `<body>` no coincide con el campo `generado` del JSON.
3. Haz commit de `assets/data/portfolio.json` y `index.html` y sube a `main`: GitHub Pages lo publica.

Si cambias el contenido a mano en el JSON, ejecuta `npm run sincronizar` para actualizar el HTML estático. Las páginas de detalle de proyecto tienen el texto en su propio HTML.

### Actualizar MongoDB con los cambios de esta versión

`scripts/actualizar-mongo.js` aplica a la base de datos los mismos cambios de datos que ya están en el snapshot (rutas de imágenes y vídeos, sin teléfono ni fecha de nacimiento, erratas, título y máster). Es un **ensayo por defecto**:

```powershell
npm run actualizar:mongo              # solo muestra lo que cambiaría
npm run actualizar:mongo -- --aplicar # escribe los cambios
```

Ejecútalo **antes** de `npm run snapshot` (que se niega a exportar rutas de archivos que no existan).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Servidor Express en `http://localhost:3000` (solo archivos públicos). No necesita MongoDB para ver la web con el snapshot |
| `npm run snapshot` | MongoDB → snapshot JSON → HTML estático |
| `npm run sincronizar` | Regenera el HTML estático desde el snapshot |
| `npm run verificar` | Comprobaciones automáticas (pesos, alt, rutas, privacidad, SEO, sintaxis…). Sale con código 1 si algo falla |
| `npm run actualizar:mongo` | Ensayo de actualización de MongoDB (`-- --aplicar` para escribir) |
| `npm run migrate:atlas` | Migra las colecciones locales a Atlas |

## Backend opcional en Render

`server.js` sigue disponible para quien quiera la API (`GET /api/portfolio`, `/api/portfolio/projects/:slug`, `/api/health`). Solo sirve las páginas HTML públicas y `assets/`; cachea la lectura de MongoDB 5 minutos y no expone `x-powered-by`. Configura `MONGODB_URI`, `MONGODB_DB_NAME`, `PORT` y `ALLOWED_ORIGINS` en el servicio. La web publicada ya no llama a esta API al cargar.

### Uso local con MongoDB Compass

1. Instala Node.js (≥ 20) y ejecuta `npm install`.
2. Copia `.env.example` a `.env` y revisa `MONGODB_DB_NAME`.
3. Comprueba que MongoDB está iniciado y ejecuta `npm run snapshot`.
4. Ejecuta `npm start` y abre `http://localhost:3000`.

No publiques nunca `.env`, `atlas-credentials.env` ni una URI con usuario y contraseña.

### Migrar las colecciones locales a Atlas

1. Copia `atlas-credentials.env.example` a `atlas-credentials.env` y rellena `TARGET_MONGODB_URI`.
2. Cambia `REPLACE_TARGET` a `true` solo si quieres reemplazar las colecciones existentes en Atlas.
3. Ejecuta `npm run migrate:atlas`.

## Despliegue

El sitio se despliega automáticamente en **GitHub Pages** desde la rama `main`. Antes de subir cambios, ejecuta `npm run verificar`.

## Licencia

El template base es [MyResume](https://bootstrapmade.com/free-html-bootstrap-template-my-resume/) de BootstrapMade, bajo su [licencia](https://bootstrapmade.com/license/). El contenido del portfolio es propio.

---

*Última actualización: noviembre de 2026*
