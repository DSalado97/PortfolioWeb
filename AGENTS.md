# AGENTS.md — portfolio-web

Instrucciones para agentes de IA que trabajen en este proyecto.

## Idioma

- Todo el contenido de cara al usuario, comentarios en código, commits y documentación va en **Español (España, es-ES)**.
- Los nombres técnicos (clases CSS, ids, variables JS, selectores) se mantienen en inglés cuando siguen convenciones de librerías (Bootstrap, AOS, etc.).
- Los mensajes de commit usan español con formato convencional: `tipo: descripción breve`.

## Stack y arquitectura

- **HTML5** semántico con Bootstrap 5.3 (grid, componentes, utilidades).
- **CSS3** con variables personalizadas (`:root`) para colores, tipografía y modo oscuro.
- **JavaScript vanilla** (sin frameworks) para interactividad, animaciones y lógica.
- **Librerías vendor**: AOS (animaciones scroll), Typed.js, Isotope (filtrado), Swiper (sliders), GLightbox, PureCounter, Waypoints, ImagesLoaded, Bootstrap Icons.
- **Deploy**: GitHub Pages desde rama `main`. Todo el sitio es estático, sin build step.

## Estructura del proyecto

```
portfolio-web/
├── index.html                      # Página principal
├── portfolio-details-*.html        # Páginas de detalle de proyectos
├── assets/
│   ├── css/
│   │   └── main.css                # Estilos principales
│   ├── js/
│   │   ├── main.js                 # Lógica principal
│   │   ├── api-config.js            # Configuración de la API
│   │   └── portfolio-data.js        # Carga de datos del portfolio
│   ├── img/                        # Imágenes y recursos visuales
│   └── vendor/                     # Librerías de terceros (no modificar)
├── robots.txt
├── sitemap.xml
├── .gitignore
└── README.md
```

## Reglas de código

### HTML
- Usar etiquetas semánticas (`<section>`, `<article>`, `<nav>`, `<header>`, `<footer>`).
- Incluir atributos `aria-*` relevantes para accesibilidad.
- Los `id` deben ser descriptivos y en kebab-case: `portfolio-filters`, `hero-section`.
- Referenciar Bootstrap 5.3 desde vendor local, nunca desde CDN.

### CSS
- Las variables CSS van en `:root` dentro de `main.css`.
- Usar las clases de utilidad de Bootstrap antes que escribir CSS custom.
- Los estilos custom van en `main.css`, organizados por sección (header, hero, portfolio, etc.) con comentarios `/* === SECCIÓN === */`.
- Modo oscuro: preferencia del sistema vía `prefers-color-scheme` con toggle manual.
- No modificar archivos dentro de `assets/vendor/`.

### JavaScript
- Sin dependencias de npm. Todo es vanilla.
- Inicializar librerías vendor dentro de `DOMContentLoaded`.
- Usar `const` y `let`, nunca `var`.
- Funciones con nombres descriptivos en camelCase.
- Evitar código inline en atributos HTML (`onclick`, etc.); usar `addEventListener`.

### Assets
- Imágenes optimizadas para web (comprimir antes de añadir).
- Usar formatos modernos (WebP) cuando sea posible, con fallback.
- Nombres de archivo en kebab-case: `hero-bg.webp`, `project-rpg.webp`.

## Git y PRs

- Ramas: `main` es producción. Features en ramas con prefijo `feature/` o `fix/`.
- Commits atómicos y descriptivos en español.
- No commitear archivos de sistema (`.DS_Store`, `Thumbs.db`) ni map files de vendor.
- PRs: descripción en español explicando qué y por qué, con captura si hay cambios visuales.
- El deploy a GitHub Pages es automático al pushear a `main`.

## OpenCode / SDD

- El skill registry está en `.atl/skill-registry.md`. Los agentes deben leerlo antes de trabajar.
- Para cambios grandes, usar SDD con artefactos en `openspec/` (proposal → spec → design → tasks → apply → verify → archive).
- Los tests manuales/visuales son aceptables (no hay test runner automatizado para HTML/CSS/JS vanilla).
- Skills relevantes: `cognitive-doc-design` para documentación, `work-unit-commits` para commits atómicos, `comment-writer` para PRs.

## Estilo visual

- Diseño moderno, limpio, profesional.
- Consistencia con el modo oscuro ya implementado.
- Tipografía: sistema de Bootstrap + Google Fonts definidas en `main.css`.
- Animaciones sutiles con AOS (no abusar).
