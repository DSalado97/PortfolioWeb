# PENDIENTES

Tareas que requieren datos personales o decisiones tuyas.

## Contenido

1. **Fechas de experiencia y formación** (`periodo`): están a `null` en MongoDB. Al rellenarlas (p. ej. `"2023 - 2024"`) aparecen en la web y en el CV.
2. **Descripciones de habilidades**: Claude, Codex, OpenCode, n8n y Google Apps Script solo muestran el nombre.
3. **Descripción del perfil**: es genérica; conviene sustituirla por logros concretos y el rol de ciberseguridad.
4. **Proyecto de ciberseguridad** (CTF, write-ups, laboratorio) que respalde el nuevo perfil.
5. **Textos de detalle de proyecto**: `portfolio-details-*.html` lleva su propio texto; no se genera desde MongoDB.
6. **Tarjeta de Dots**: la portada aún dice «Juego móvil inspirado en Agar.io» y el resto de campos describe la versión Android. Actualizar `descripcion_corta`, `descripcion_larga`, `mecanicas`, `tecnicas_programacion` y `tecnologias` en MongoDB y ejecutar `npm run snapshot`.
7. **Vídeos de Dots**: ya no se usan en su página, pero `video` en MongoDB los sigue citando. Quitar el campo antes de borrar los archivos.

## Cuentas externas

- Suspender o borrar el servicio de Render: cada push sigue lanzando un despliegue.
- Comprobar si el clúster de Atlas sigue existiendo (pausado) antes de darlo por perdido.

## Mejoras opcionales

- Etiquetas de tecnologías en las tarjetas, timeline con fechas y revisión de contraste.
- Pasar Lighthouse y los validadores de schema.org y W3C.
- Alojar las tipografías en `assets/fonts/` para no depender de Google Fonts.
