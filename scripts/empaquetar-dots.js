#!/usr/bin/env node
'use strict';

/**
 * Genera assets/downloads/dots.html: Dots en un único archivo que se puede jugar
 * sin conexión. Toma el marcado, los estilos y el JavaScript de las fuentes de la
 * página, así que no hay que editarlo a mano.
 *
 *   npm run empaquetar:dots
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const outputFile = path.join(rootDir, 'assets', 'downloads', 'dots.html');

const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8').replace(/\r\n/g, '\n');

function extract(text, start, end, name) {
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`No se encuentran las marcas «${start}» y «${end}» en ${name}`);
  }
  return text.slice(from + start.length, to).trim();
}

// La imagen va incrustada para que el archivo no dependa de ningún otro.
function embedSkin(markup) {
  return markup.replace(/ data-skin="([^"]+)"/, (match, file) => {
    const image = fs.readFileSync(path.join(rootDir, file)).toString('base64');
    return ` data-skin="data:image/webp;base64,${image}"`;
  });
}

function generarDescargable() {
  const markup = embedSkin(extract(read('portfolio-details-dots.html'), '<!-- dots:start -->', '<!-- dots:end -->', 'portfolio-details-dots.html'));
  const styles = extract(read('assets', 'css', 'main.css'), '/* === JUEGO DOTS === */', '/* === FIN JUEGO DOTS === */', 'main.css');
  const scripts = ['dots-core.js', 'dots-render.js', 'dots-audio.js', 'dots-game.js']
    .map(file => read('assets', 'js', 'dots', file).trim())
    .join('\n\n');
  if (/<\/script/i.test(scripts)) throw new Error('El JavaScript del juego no puede contener </script');

  return `<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Dots</title>
  <meta name="description" content="Dots, de Daniel Salado. Versión para jugar sin conexión.">
  <style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
}

body {
  overflow: hidden;
  background-color: #e3d3b4;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.5;
}

${styles}

.dots-game {
  height: 100vh;
  height: 100svh;
  border-radius: 0;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
  }
}
  </style>
</head>

<body>
  ${markup}

  <script>
${scripts}
  </script>
</body>

</html>
`;
}

module.exports = { generarDescargable, outputFile };

if (require.main === module) {
  const html = generarDescargable();
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, html);
  console.log(`Generado ${path.relative(rootDir, outputFile)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}
