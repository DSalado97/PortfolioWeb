# Portfolio Web — Daniel Salado Romero

Portafolio profesional online que muestra mi trayectoria como Desarrollador Full Stack, proyectos realizados, habilidades técnicas y formación académica.

🌐 **[Ver en vivo](https://dsalado97.github.io/PortfolioWeb/)**

## 🛠️ Stack

- **HTML5** semántico y accesible
- **CSS3** con variables personalizadas y modo oscuro
- **Bootstrap 5.3** — grid, componentes y utilidades
- **JavaScript** vanilla — interactividad, animaciones y lógica
- **Librerías**: AOS (animaciones), Typed.js (texto animado), Isotope (filtrado de portfolio), Swiper (sliders), GLightbox, PureCounter
- **Backend**: Node.js, Express y driver oficial de MongoDB

## 📂 Estructura

```
portfolio-web/
├── index.html                          # Página principal
├── portfolio-details-*.html            # Páginas de detalle de proyectos
├── server.js                            # API y servidor de archivos estáticos
├── render.yaml                           # Configuración del despliegue en Render
├── atlas-credentials.env.example         # Plantilla de migración local a Atlas
├── package.json                         # Dependencias y comandos del servidor
├── .env.example                         # Configuración local de MongoDB
├── assets/
│   ├── css/
│   │   ├── main.css                    # Estilos principales
│   │   └── chatbot.css                 # Estilos del chatbot asistente
│   ├── js/
│   │   ├── main.js                     # Interactividad y librerías vendor
│   │   ├── api-config.js                # URL pública de la API
│   │   ├── portfolio-data.js            # Renderizado de datos desde la API
│   │   └── chatbot.js                  # Asistente virtual (Chipp.ai)
│   ├── img/                            # Imágenes y recursos
│   └── vendor/                         # Librerías de terceros
│       ├── bootstrap/
│       ├── bootstrap-icons/
│       ├── aos/
│       ├── glightbox/
│       ├── swiper/
│       ├── typed.js/
│       ├── isotope-layout/
│       ├── purecounter/
│       ├── waypoints/
│       ├── imagesloaded/
│       └── php-email-form/
└── .gitignore
```

## 🗄️ Conexión con MongoDB

La web ya no lee el contenido del HTML como fuente de datos. Al cargarla, el navegador solicita los datos a `GET /api/portfolio`; el servidor consulta las colecciones `perfil`, `proyectos`, `habilidades`, `experiencia`, `formacion` y `contacto` de MongoDB.

MongoDB no se conecta directamente desde el navegador. La variable `MONGODB_URI` solo existe en el servidor y nunca se publica en el frontend.

### Uso local con MongoDB Compass

1. Instala Node.js si todavía no está instalado.
2. Abre PowerShell en la carpeta del proyecto.
3. Instala las dependencias con `npm install`.
4. Copia `.env.example` a `.env` y revisa `MONGODB_DB_NAME`.
5. Comprueba que el servicio de MongoDB está iniciado.
6. Ejecuta `npm start`.
7. Abre `http://localhost:3000`, no `index.html` directamente.
8. Comprueba la conexión en `http://localhost:3000/api/health`.

Los cambios realizados en Compass se verán al recargar la página. La API utiliza `Cache-Control: no-store` para evitar que el navegador muestre una respuesta antigua. Si la API no está disponible, la web conserva temporalmente el contenido estático incluido en el repositorio.

### Despliegue público

GitHub Pages solo sirve archivos estáticos y no puede ejecutar `server.js` ni acceder a una base de datos local. Para que la web pública utilice MongoDB necesitas:

- MongoDB Atlas u otra base de datos accesible desde Internet.
- Desplegar `server.js` en un servicio Node.js como Render, Railway o Fly.io.
- Configurar en ese servicio `MONGODB_URI`, `MONGODB_DB_NAME`, `PORT` y `ALLOWED_ORIGINS`.
- Cambiar `window.PORTFOLIO_API_BASE_URL` en `assets/js/api-config.js` por la URL pública de la API.

La opción más sencilla es desplegar la web y `server.js` como un único servicio en Render. En ese caso no hace falta cambiar `data-api-base-url`, porque la web y la API compartirán dominio. Render leerá `MONGODB_URI` desde sus variables privadas y no desde el repositorio.

### Migrar las colecciones locales a Atlas

1. En Atlas crea el clúster y un usuario con permisos de escritura temporal para la migración.
2. En **Network Access**, añade tu IP actual para conectar Compass. Para Render necesitarás permitir las conexiones del servicio; si usas `0.0.0.0/0`, utiliza una contraseña fuerte y el usuario de API con permisos de solo lectura.
3. Copia `atlas-credentials.env.example` a `atlas-credentials.env`.
4. Sustituye `TARGET_MONGODB_URI` por la URI de Atlas. No la publiques ni la envíes por chat.
5. Cambia `REPLACE_TARGET` a `true` solo si quieres reemplazar las colecciones existentes en Atlas.
6. Ejecuta `npm run migrate:atlas`.

El script migra `perfil`, `proyectos`, `habilidades`, `experiencia`, `formacion` y `contacto`. El archivo `atlas-credentials.env` está excluido de Git.

No publiques nunca `.env` ni una URI con usuario y contraseña en los archivos HTML o JavaScript.

## 🚀 Despliegue

El sitio se despliega automáticamente en **GitHub Pages** desde la rama `main`.

## 📄 Licencia

El template base es [MyResume](https://bootstrapmade.com/free-html-bootstrap-template-my-resume/) de BootstrapMade, bajo su [licencia](https://bootstrapmade.com/license/). El contenido del portfolio es propio.

---

*Última actualización: 2025*
