# Portfolio Web — Daniel Salado Romero

Portafolio profesional online que muestra mi trayectoria como Analista de Ciberseguridad Junior y Desarrollador Full Stack, proyectos realizados, habilidades técnicas y formación académica.

**[Ver en vivo](https://dsalado97.github.io/PortfolioWeb/)**

## Stack

- **HTML5** semántico y accesible
- **CSS3** con variables personalizadas y modo oscuro (preferencia del sistema + selector manual, sin parpadeo)
- **Bootstrap 5.3** — grid y utilidades (solo CSS)
- **JavaScript** vanilla — interactividad, animaciones y lógica
- **Librerías**: AOS (animaciones), Typed.js (texto animado), Isotope (filtrado de portfolio), Bootstrap Icons
- **Datos**: snapshot JSON estático (`assets/data/portfolio.json`) generado desde MongoDB local
- **Servidor local opcional**: Node.js, Express y driver oficial de MongoDB

## Estructura

```
portfolio-web/
├── index.html                          # Página principal (HTML estático sincronizado con el snapshot)
├── portfolio-details-*.html            # Páginas de detalle de proyectos
├── 404.html                            # Página de error para GitHub Pages
├── server.js                           # Servidor local opcional (vista previa y API)
├── package.json                        # Dependencias y comandos
├── PENDIENTES.md                       # Tareas que requieren intervención manual
├── assets/
│   ├── css/main.css                    # Estilos principales
│   ├── data/portfolio.json             # Snapshot del contenido (sin datos privados)
│   ├── downloads/dots.html             # Dots en un solo archivo (generado, no editar)
│   ├── js/
│   │   ├── main.js                     # Interactividad (menú, tema, filtros, acordeones, hero)
│   │   ├── portfolio-render.js         # Generadores de HTML (navegador y Node)
│   │   ├── portfolio-data.js           # Carga el snapshot y actualiza la portada si cambió
│   │   └── dots/                       # Juego Dots: simulación, dibujo, sonido y controles
│   ├── img/                            # Imágenes WebP/JPG, iconos y og-image
│   │   └── projects/                   # Miniaturas, vídeos WebM/MP4 y pósters
│   └── vendor/                         # Librerías de terceros (no modificar)
├── scripts/
│   ├── exportar-snapshot.js            # MongoDB local → assets/data/portfolio.json
│   ├── sincronizar-html.js             # snapshot → bloques estáticos de index.html
│   ├── completar-mongo.js              # Añade a MongoDB lo publicado que le falte (ensayo por defecto)
│   ├── empaquetar-dots.js              # Genera assets/downloads/dots.html
│   └── verificar.js                    # Comprobaciones automáticas
└── .gitignore
```

## Flujo de datos: MongoDB local → snapshot → web

El contenido se edita en MongoDB local (Compass), pero la web **no depende de ningún servidor** para cargar:

1. `npm run snapshot` lee MongoDB (variable `MONGODB_URI` del `.env`) y escribe `assets/data/portfolio.json`, quitando `_id`, teléfono, fecha de nacimiento y notas internas. Si la base de datos tiene menos contenido que el publicado, se detiene sin exportar (`--forzar` para retirarlo a propósito). Después ejecuta `scripts/sincronizar-html.js`, que regenera en `index.html` los bloques de proyectos, tecnologías, experiencia, formación, contacto y el JSON-LD.
2. El HTML ya contiene el contenido final, así que no hay saltos al cargar. En el navegador, `portfolio-data.js` descarga el snapshot (mismo origen) y solo vuelve a pintar la portada si `data-snapshot` del `<body>` no coincide con el campo `generado` del JSON.
3. Haz commit de `assets/data/portfolio.json` y `index.html` y sube a `main`: GitHub Pages lo publica.

Si cambias el contenido a mano en el JSON, ejecuta `npm run sincronizar` para actualizar el HTML estático. Las páginas de detalle de proyecto tienen el texto en su propio HTML.

El orden de experiencia, formación y habilidades lo marca el campo `orden` (1 = primero); sin él, la entrada aparece al principio.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Servidor Express en `http://localhost:3000` (solo archivos públicos). No necesita MongoDB para ver la web con el snapshot |
| `npm run snapshot` | MongoDB → snapshot JSON → HTML estático |
| `npm run sincronizar` | Regenera el HTML estático desde el snapshot |
| `npm run verificar` | Comprobaciones automáticas (pesos, alt, rutas, privacidad, SEO, sintaxis…). Sale con código 1 si algo falla |
| `npm run empaquetar:dots` | Regenera la versión descargable de Dots. Hazlo tras cambiar el juego (JS, estilos o marcado) |
| `npm run completar:mongo` | Ensayo: qué contenido publicado falta en MongoDB local (`-- --aplicar` para añadirlo) |

## Servidor local opcional

`server.js` sirve para previsualizar la web y ofrece `GET /api/portfolio`, `/api/portfolio/projects/:slug` y `/api/health`. No se despliega en ningún sitio: la web publicada no lo usa.

### Uso local con MongoDB Compass

1. Instala Node.js (≥ 20) y ejecuta `npm install`.
2. Copia `.env.example` a `.env` y revisa `MONGODB_DB_NAME`.
3. Comprueba que MongoDB está iniciado y ejecuta `npm run snapshot`.
4. Ejecuta `npm start` y abre `http://localhost:3000`.

No publiques nunca `.env` ni una URI con usuario y contraseña. La carpeta `CV/` es local: contiene el teléfono y no se versiona.

## Despliegue

El sitio se despliega automáticamente en **GitHub Pages** desde la rama `main`. Antes de subir cambios, ejecuta `npm run verificar`.

## Licencia

El template base es [MyResume](https://bootstrapmade.com/free-html-bootstrap-template-my-resume/) de BootstrapMade, bajo su [licencia](https://bootstrapmade.com/license/). El contenido del portfolio es propio.

---

*Última actualización: noviembre de 2026*
