# PENDIENTES

Tareas que requieren intervención manual (credenciales, datos personales o decisiones tuyas).

## Obligatorias antes de publicar

1. **Alinear MongoDB con la web** (no se ha escrito nada en ninguna base de datos remota):
   ```powershell
   npm run actualizar:mongo              # ensayo: revisa la lista de cambios
   npm run actualizar:mongo -- --aplicar # aplica los cambios
   npm run snapshot                      # regenera assets/data/portfolio.json e index.html desde MongoDB
   npm run verificar
   ```
   El snapshot actual se construyó **sin acceso a MongoDB**: la API de Render no respondió en 60 s, así que se generó a partir de `CV/datos-cv.js` (exportado el 2026-09-23) más el contenido del HTML anterior. Al ejecutar `npm run snapshot` se sustituirá por los datos reales; revisa el resultado con `git diff`.
2. **Descripciones de habilidades que faltan**: Claude, Codex, OpenCode, n8n y Google Apps Script no tenían descripción en `datos-cv.js` ni en el HTML; se muestran solo con el nombre. Añádelas en MongoDB si quieres.
3. **Fechas de experiencia y formación** (`periodo`): están a `null` en MongoDB y no se han inventado. Rellénalas (p. ej. `"2023 - 2024"`) en la colección `experiencia`; `renderExperience` ya las muestra si existen. En formación el campo es `periodo` también.
4. **Teléfono y fecha de nacimiento** ya no están en el sitio ni en el snapshot, y `actualizar-mongo.js` los elimina de `perfil` y `contacto`. **Atención**: la carpeta `CV/` (`CV/datos-cv.js`, `CV/index.html`) sigue conteniéndolos y se publica en GitHub Pages en `/CV/`. Decide si quieres excluirla del despliegue o quitar esos campos allí. No se ha tocado porque tienes cambios sin commitear en esos archivos.
5. **Revisar la descripción del perfil**: se mantiene el texto actual (genérico). Conviene sustituirlo por algo más concreto con logros reales, y reflejar el rol de ciberseguridad.

## Recomendadas

- **PDF del CV**: generar un PDF desde `CV/index.html` (imprimir → guardar como PDF) y, si quieres, enlazarlo con un botón «Descargar CV» en `index.html`. No se ha podido generar automáticamente.
- **`CV/actualizar-cv.js`**: el plan preveía que leyera del snapshot en vez de la API de Render. No se ha modificado porque tenía cambios tuyos sin commitear. Cambia `apiUrl` por una lectura de `assets/data/portfolio.json` cuando lo cierres.
- **Proyecto de ciberseguridad** (CTF, write-ups, laboratorio) para respaldar el nuevo perfil: requiere contenido tuyo.
- **Textos de detalle de proyecto**: la API de Render no respondió, así que el snapshot no incluye `descripcion_larga`, mecánicas, etc. Las páginas `portfolio-details-*.html` conservan su texto estático (ya no se sobreescribe desde la API). Si quieres que MongoDB vuelva a ser su fuente, habría que exportarlo y renderizarlo en el snapshot.
- **Fase 6 (diseño, opcional)**: no se ha abordado (etiquetas de tecnologías en las tarjetas, timeline con fechas, revisión de contraste).
- **Lighthouse y validadores**: no se han ejecutado (sin acceso a Lighthouse ni a los validadores web). Pasar Lighthouse y validar JSON-LD (schema.org) y HTML (W3C) antes de publicar.
- **Render**: puede seguir desplegado; la web ya no lo llama. Si lo mantienes, `server.js` sirve solo archivos públicos y `/CV` únicamente fuera de producción.
- **Tipografías**: siguen cargándose desde Google Fonts (con menos pesos). Si quieres cero peticiones externas, alójalas en `assets/fonts/`.

## Notas de la implementación

- **Conversión de vídeo**: `ffmpeg` no estaba en el `PATH`; se usó el binario ya presente en el paquete Python `imageio-ffmpeg` (instalado previamente en el equipo; no se ha descargado ni instalado nada). Los vídeos se codificaron a 530×1000 (la proporción con la que se mostraban los GIF).
- **Iconos de tecnologías**: se convirtieron a WebP de 100 px de alto (en lugar de SVG) para conservar el aspecto actual.
- **`.codegraph/`**: se ha dejado de versionar y se añadió a `.gitignore`; tus ficheros locales no se han tocado.
- **Cambios tuyos sin commitear** (`CV/*.js`, `server.js` línea de ordenación de `formacion`, `.codegraph/`) no se han incluido en los commits.
