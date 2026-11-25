#!/usr/bin/env node
'use strict';

/**
 * Verificación automática del portfolio (Node >= 20, sin dependencias).
 * Sale con código 1 si falla cualquier comprobación.
 *
 *   npm run verificar
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.join(__dirname, '..');
const SITE_BASE_URL = 'https://dsalado97.github.io/PortfolioWeb/';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES_TOTAL_BYTES = 10 * 1024 * 1024;

const results = [];

function check(name, failures) {
  const list = Array.isArray(failures) ? failures : [];
  results.push({ name, failures: list });
}

function rel(file) {
  return path.relative(rootDir, file).split(path.sep).join('/');
}

function walk(directory, filter = () => true) {
  const files = [];
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath, filter));
    } else if (filter(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

const read = file => fs.readFileSync(file, 'utf8');

// Páginas HTML públicas (raíz del proyecto) y JavaScript propio (sin vendor ni node_modules).
const htmlFiles = fs.readdirSync(rootDir)
  .filter(name => name.endsWith('.html'))
  .map(name => path.join(rootDir, name));
const publicJsFiles = walk(path.join(rootDir, 'assets', 'js'), file => file.endsWith('.js'));
const ownJsFiles = [
  ...publicJsFiles,
  ...walk(path.join(rootDir, 'scripts'), file => file.endsWith('.js')),
  ...walk(path.join(rootDir, 'CV'), file => file.endsWith('.js')),
  path.join(rootDir, 'server.js')
].filter(file => fs.existsSync(file));

function stripJsCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, '""');
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[2] ?? match[3]) : null;
}

// 1. Peso de imágenes
(function checkImageWeights() {
  const failures = [];
  const files = walk(path.join(rootDir, 'assets', 'img'));
  let total = 0;
  for (const file of files) {
    const { size } = fs.statSync(file);
    total += size;
    if (size > MAX_IMAGE_BYTES) {
      failures.push(`${rel(file)} pesa ${(size / 1048576).toFixed(2)} MB (máximo 2 MB)`);
    }
  }
  if (total >= MAX_IMAGES_TOTAL_BYTES) {
    failures.push(`assets/img pesa ${(total / 1048576).toFixed(2)} MB (máximo 10 MB)`);
  }
  check(`Imágenes: ningún archivo > 2 MB y total < 10 MB (${(total / 1048576).toFixed(2)} MB)`, failures);
})();

// 2. Atributo alt en <img>
(function checkAltAttributes() {
  const failures = [];
  for (const file of htmlFiles) {
    for (const [tag] of read(file).matchAll(/<img\b[^>]*>/gi)) {
      const alt = getAttribute(tag, 'alt');
      const decorative = /aria-hidden\s*=\s*"true"/i.test(tag) || /role\s*=\s*"presentation"/i.test(tag);
      if (alt === null) {
        failures.push(`${rel(file)}: <img> sin alt → ${tag.slice(0, 80)}`);
      } else if (alt.trim() === '' && !decorative) {
        failures.push(`${rel(file)}: <img> con alt vacío que no es decorativo → ${tag.slice(0, 80)}`);
      }
    }
  }
  check('Todas las <img> tienen alt (vacío solo si son decorativas)', failures);
})();

// 3. Rutas locales existentes (HTML y snapshot)
(function checkLocalReferences() {
  const failures = [];
  const isExternal = value => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);

  for (const file of htmlFiles) {
    const html = read(file);
    const references = [];
    for (const [, attribute, value] of html.matchAll(/\s(src|href|poster)\s*=\s*"([^"]*)"/gi)) {
      references.push([attribute, value]);
    }
    for (const [, value] of html.matchAll(/\ssrcset\s*=\s*"([^"]*)"/gi)) {
      value.split(',').forEach(part => references.push(['srcset', part.trim().split(/\s+/)[0]]));
    }
    for (const [attribute, value] of references) {
      if (!value || isExternal(value)) continue;
      const target = path.resolve(path.dirname(file), value.split('#')[0].split('?')[0]);
      if (!fs.existsSync(target)) {
        failures.push(`${rel(file)}: ${attribute}="${value}" no existe`);
      }
    }
    // Las imágenes sociales usan URL absolutas: deben corresponder a un archivo real.
    for (const [, value] of html.matchAll(/<meta[^>]+(?:og:image|twitter:image)"[^>]*content="([^"]*)"/gi)) {
      if (value.startsWith(SITE_BASE_URL) && !fs.existsSync(path.join(rootDir, value.slice(SITE_BASE_URL.length)))) {
        failures.push(`${rel(file)}: imagen social ${value} no existe en el proyecto`);
      }
    }
  }

  const snapshotFile = path.join(rootDir, 'assets', 'data', 'portfolio.json');
  if (fs.existsSync(snapshotFile)) {
    try {
      const visit = (value, trail) => {
        if (typeof value === 'string') {
          if (!isExternal(value) && /^assets\/|\.(webp|jpe?g|png|svg|webm|mp4|html)$/i.test(value) && !/\s/.test(value)) {
            if (!fs.existsSync(path.join(rootDir, value))) {
              failures.push(`assets/data/portfolio.json: ${trail} → ${value} no existe`);
            }
          }
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => visit(item, `${trail}[${index}]`));
        } else if (value && typeof value === 'object') {
          Object.entries(value).forEach(([key, item]) => visit(item, trail ? `${trail}.${key}` : key));
        }
      };
      visit(JSON.parse(read(snapshotFile)), '');
    } catch (error) {
      failures.push(`assets/data/portfolio.json no se puede leer: ${error.message}`);
    }
  }
  check('Todas las rutas locales de los HTML y del snapshot existen', failures);
})();

// 4. Librerías retiradas
(function checkRemovedLibraries() {
  const failures = [];
  for (const file of htmlFiles) {
    const match = read(file).match(/php-email-form|purecounter|waypoints|glightbox|swiper/i);
    if (match) failures.push(`${rel(file)} referencia "${match[0]}"`);
  }
  for (const file of publicJsFiles) {
    const match = read(file).match(/PureCounter|Waypoint|GLightbox|Swiper|initSwiperWithCustomPagination/);
    if (match) failures.push(`${rel(file)} usa "${match[0]}"`);
  }
  check('Sin php-email-form, PureCounter, Waypoints, GLightbox ni Swiper', failures);
})();

// 5. Snapshot JSON
(function checkSnapshot() {
  const failures = [];
  const snapshotFile = path.join(rootDir, 'assets', 'data', 'portfolio.json');
  try {
    const text = read(snapshotFile);
    const data = JSON.parse(text);
    const forbidden = new Set(['telefono', 'nacimiento', '_id', 'nota']);
    const visit = (value, trail) => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${trail}[${index}]`));
      } else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
          if (forbidden.has(key)) failures.push(`El snapshot contiene la clave "${key}" en ${trail || 'raíz'}`);
          visit(item, trail ? `${trail}.${key}` : key);
        }
      }
    };
    visit(data, '');
    for (const word of forbidden) {
      if (text.includes(`"${word}"`)) failures.push(`El texto del snapshot contiene "${word}"`);
    }
  } catch (error) {
    failures.push(`assets/data/portfolio.json no es JSON válido o no existe: ${error.message}`);
  }
  check('assets/data/portfolio.json es válido y sin teléfono, nacimiento ni _id', failures);
})();

// 6. Estructura SEO y semántica
(function checkPageStructure() {
  const failures = [];
  for (const file of htmlFiles) {
    const name = rel(file);
    const html = read(file);
    if (!/<html\b[^>]*\slang="es"/i.test(html)) failures.push(`${name}: falta <html lang="es">`);
    if (!/<title>[^<]+<\/title>/i.test(html)) failures.push(`${name}: falta <title>`);
    if (!/<meta\s+name="description"\s+content="[^"]+"/i.test(html)) failures.push(`${name}: falta meta description`);
    if (!/<link\s+rel="canonical"\s+href="[^"]+"/i.test(html)) failures.push(`${name}: falta canonical`);

    const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    if (!blocks.length) failures.push(`${name}: falta JSON-LD`);
    blocks.forEach((block, index) => {
      try {
        JSON.parse(block[1]);
      } catch (error) {
        failures.push(`${name}: JSON-LD #${index + 1} no es JSON válido (${error.message})`);
      }
    });
  }
  const indexFile = path.join(rootDir, 'index.html');
  const h1Count = (read(indexFile).match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) failures.push(`index.html tiene ${h1Count} <h1> (debe tener exactamente 1)`);
  check('index.html con un único <h1>; cada página con lang, title, description, canonical y JSON-LD válido', failures);
})();

// 7. Privacidad: se revisan TODOS los archivos versionados, porque GitHub publica
// el repositorio entero. Los patrones son genéricos para no repetir aquí los datos;
// si existe CV/datos-privados.json (solo en local) se busca además su valor exacto.
(function checkPrivacy() {
  const failures = [];
  const listing = spawnSync('git', ['ls-files', '-z'], { cwd: rootDir, encoding: 'utf8' });
  if (listing.status !== 0) {
    failures.push('No se ha podido ejecutar "git ls-files"');
  }
  const trackedFiles = (listing.stdout || '').split('\0').filter(Boolean);

  for (const name of trackedFiles) {
    if (/^CV\//i.test(name)) failures.push(`${name}: la carpeta CV/ no debe versionarse`);
    if (/(^|\/)\.env($|\.(?!example$))/.test(name)) failures.push(`${name}: los .env no deben versionarse`);
    if (/\.pdf$/i.test(name)) failures.push(`${name}: el PDF del CV contiene el teléfono`);
  }

  const privateFile = path.join(rootDir, 'CV', 'datos-privados.json');
  const privateDigits = fs.existsSync(privateFile)
    ? String(JSON.parse(read(privateFile)).telefono || '').replace(/\D/g, '').slice(-9)
    : '';
  const patterns = [
    [/(?<![\w.+-])(?:(?:\+|00)34[\s.-]?)?[67]\d{2}(?:[\s.-]?\d{2}){3}(?![\w.])/, 'un teléfono móvil'],
    [/(?<![\w.+-])(?:(?:\+|00)34[\s.-]?)?[67]\d{2}(?:[\s.-]?\d{3}){2}(?![\w.])/, 'un teléfono móvil'],
    [/nacimiento["'`]?\s*[:=]\s*["'`]?\d/i, 'una fecha de nacimiento'],
    [/nacimiento:?\s*(?:<[^>]*>\s*)+\d/i, 'una fecha de nacimiento'],
    [/onrender\.com/i, 'un enlace a Render (retirado)']
  ];
  const textFiles = trackedFiles.filter(name =>
    /\.(html|js|json|css|md|txt|xml|ya?ml|svg|example)$/i.test(name)
    && !/^(assets\/vendor\/|package-lock\.json$)/.test(name)
    && fs.existsSync(path.join(rootDir, name))
  );
  for (const name of textFiles) {
    const text = read(path.join(rootDir, name));
    for (const [pattern, label] of patterns) {
      if (pattern.test(text)) failures.push(`${name} contiene ${label}`);
    }
    if (privateDigits && text.replace(/[\s.-]/g, '').includes(privateDigits)) {
      failures.push(`${name} contiene el teléfono de CV/datos-privados.json`);
    }
  }
  for (const file of [...htmlFiles, ...publicJsFiles]) {
    if (/calcularEdad|calculateAge|id="edad"|getElementById\(['"]edad['"]\)/.test(read(file))) {
      failures.push(`${rel(file)} contiene el cálculo de la edad`);
    }
  }
  check(`Privacidad: ${textFiles.length} archivos versionados sin teléfono, nacimiento, CV, .env ni Render`, failures);
})();

// 8. Calidad del código: sin var, sin on*=, un único script inline (tema)
(function checkCodeStyle() {
  const failures = [];
  for (const file of ownJsFiles) {
    if (/(^|[^\w$.])var\s+[\w$]/m.test(stripJsCommentsAndStrings(read(file)))) {
      failures.push(`${rel(file)} usa "var"`);
    }
  }
  for (const file of htmlFiles) {
    const name = rel(file);
    const html = read(file);
    for (const [tag] of html.matchAll(/<[a-z][^>]*>/gi)) {
      const handler = tag.match(/\s(on[a-z]+)\s*=/i);
      if (handler) failures.push(`${name}: atributo ${handler[1]} en ${tag.slice(0, 60)}`);
    }
    const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
      .filter(([, attributes]) => !/\ssrc\s*=/i.test(attributes) && !/type\s*=\s*"application\/ld\+json"/i.test(attributes));
    if (inlineScripts.length !== 1) {
      failures.push(`${name}: tiene ${inlineScripts.length} scripts inline (debe haber exactamente 1: el del tema)`);
    } else {
      const headEnd = html.indexOf('</head>');
      if (html.indexOf(inlineScripts[0][0]) > headEnd || !/localStorage/.test(inlineScripts[0][2])) {
        failures.push(`${name}: el único script inline debe ser el del tema y estar en <head>`);
      }
    }
  }
  check('JS sin "var"; HTML sin atributos on*; único script inline = tema en <head>', failures);
})();

// 9. Sitemap actualizado
(function checkSitemap() {
  const failures = [];
  const sitemapFile = path.join(rootDir, 'sitemap.xml');
  if (!fs.existsSync(sitemapFile)) {
    failures.push('Falta sitemap.xml');
  } else {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const dates = [...read(sitemapFile).matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(match => match[1].trim());
    if (!dates.length) failures.push('sitemap.xml no tiene <lastmod>');
    for (const value of dates) {
      const parsed = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime()) || parsed > today) {
        failures.push(`lastmod "${value}" no es una fecha válida o es futura`);
      }
    }
  }
  check('sitemap.xml con lastmod válido', failures);
})();

// 10. Página 404
check('Existe 404.html', fs.existsSync(path.join(rootDir, '404.html')) ? [] : ['Falta 404.html']);

// 11. Sintaxis de todos los .js propios
(function checkSyntax() {
  const failures = [];
  for (const file of ownJsFiles) {
    const outcome = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (outcome.status !== 0) {
      failures.push(`${rel(file)}: ${(outcome.stderr || '').split('\n').find(Boolean) || 'error de sintaxis'}`);
    }
  }
  check(`node --check pasa en los ${ownJsFiles.length} archivos .js propios`, failures);
})();

// 12. index.html sincronizado con el snapshot
(function checkSnapshotSync() {
  const failures = [];
  try {
    const { generarIndex } = require('./sincronizar-html.js');
    const snapshot = JSON.parse(read(path.join(rootDir, 'assets', 'data', 'portfolio.json')));
    const current = read(path.join(rootDir, 'index.html')).replace(/\r\n/g, '\n');
    if (generarIndex(current, snapshot) !== current) {
      failures.push('index.html no coincide con el snapshot. Ejecuta: npm run sincronizar');
    }
  } catch (error) {
    failures.push(`No se pudo comprobar la sincronización: ${error.message}`);
  }
  check('index.html está sincronizado con assets/data/portfolio.json', failures);
})();

// 13. Versión descargable de Dots al día
(function checkDotsDownload() {
  const failures = [];
  try {
    const { generarDescargable, outputFile } = require('./empaquetar-dots.js');
    if (!fs.existsSync(outputFile) || read(outputFile).replace(/\r\n/g, '\n') !== generarDescargable()) {
      failures.push(`${rel(outputFile)} no coincide con las fuentes. Ejecuta: npm run empaquetar:dots`);
    }
  } catch (error) {
    failures.push(`No se pudo comprobar la versión descargable de Dots: ${error.message}`);
  }
  check('assets/downloads/dots.html está al día con el juego', failures);
})();

// Informe
let failed = 0;
for (const { name, failures } of results) {
  if (failures.length) {
    failed++;
    console.log(`✘ ${name}`);
    failures.forEach(failure => console.log(`    - ${failure}`));
  } else {
    console.log(`✔ ${name}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas.`);
process.exitCode = failed ? 1 : 0;
