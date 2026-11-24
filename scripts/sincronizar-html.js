#!/usr/bin/env node
'use strict';

/**
 * Regenera el HTML estático de index.html a partir de assets/data/portfolio.json.
 *
 * Rellena los bloques marcados con <!-- snapshot:NOMBRE:start --> / end, los
 * textos enlazados con atributos data-portfolio-* y el JSON-LD de la portada.
 * Usa assets/js/portfolio-render.js, el mismo generador que usa el navegador,
 * así que el contenido estático y el renderizado en cliente son idénticos.
 *
 * Uso:
 *   node scripts/sincronizar-html.js              # escribe index.html
 *   node scripts/sincronizar-html.js --comprobar  # sale con código 1 si index.html no está sincronizado
 */

const fs = require('node:fs');
const path = require('node:path');
const render = require('../assets/js/portfolio-render.js');

const rootDir = path.join(__dirname, '..');
const snapshotPath = path.join(rootDir, 'assets', 'data', 'portfolio.json');
const indexPath = path.join(rootDir, 'index.html');
const { escapeHtml } = render;

function replaceBlock(html, name, content) {
  const pattern = new RegExp(
    `(<!-- snapshot:${name}:start -->)[\\s\\S]*?(<!-- snapshot:${name}:end -->)`
  );
  if (!pattern.test(html)) {
    throw new Error(`No se encuentra el bloque snapshot:${name} en index.html`);
  }
  return html.replace(pattern, () => `<!-- snapshot:${name}:start -->\n${content}\n<!-- snapshot:${name}:end -->`);
}

function replaceBoundText(html, attribute, value) {
  const pattern = new RegExp(`(<(\\w+)\\b[^>]*\\b${attribute}\\b[^>]*>)[\\s\\S]*?(</\\2>)`);
  if (!pattern.test(html)) {
    throw new Error(`No se encuentra el elemento con ${attribute} en index.html`);
  }
  return html.replace(pattern, (match, open, tag, close) => `${open}${escapeHtml(value)}${close}`);
}

function buildPersonJsonLd(snapshot) {
  const profile = snapshot.perfil || {};
  const networks = profile.redes || {};
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.nombre,
    jobTitle: profile.titulo,
    url: profile.web,
    image: 'https://dsalado97.github.io/PortfolioWeb/assets/img/og-image.jpg',
    address: {
      '@type': 'PostalAddress',
      addressLocality: profile.ciudad,
      addressCountry: profile.pais
    },
    sameAs: [networks.github, networks.linkedin].filter(Boolean)
  };
  // Evita cerrar el <script> por accidente si algún texto contuviera "</script>".
  return JSON.stringify(person, null, 2).replace(/</g, '\\u003c');
}

function generarIndex(html, snapshot) {
  const profile = snapshot.perfil || {};
  const contact = snapshot.contacto || {};
  // En Windows Git puede dejar los archivos con CRLF: se normaliza a LF (Git lo convierte al confirmar).
  let result = html.replace(/\r\n/g, '\n');

  result = replaceBoundText(result, 'data-portfolio-name', profile.nombre);
  result = replaceBoundText(result, 'data-portfolio-title', profile.titulo);
  result = replaceBoundText(result, 'data-portfolio-description', profile.descripcion);

  if (Array.isArray(profile.roles) && profile.roles.length) {
    result = result.replace(
      /(data-typed-items=")[^"]*(")/,
      (match, open, close) => `${open}${escapeHtml(profile.roles.join(','))}${close}`
    );
  }

  result = replaceBlock(result, 'about-details', render.renderAboutDetails({ ...profile, email: profile.email || contact.email }));
  result = replaceBlock(result, 'projects', render.renderProjectCards(snapshot.proyectos));
  result = replaceBlock(result, 'skills', render.renderSkills(snapshot.habilidades));
  result = replaceBlock(result, 'experience', render.renderExperience(snapshot.experiencia));
  result = replaceBlock(result, 'education', render.renderEducation(snapshot.formacion));
  result = replaceBlock(result, 'contact', render.renderContact({ ...contact, email: contact.email || profile.email }));

  result = result.replace(/(<body[^>]*\bdata-snapshot=")[^"]*(")/, (match, open, close) => `${open}${escapeHtml(snapshot.generado)}${close}`);
  result = result.replace(
    /(<script type="application\/ld\+json" id="json-ld-person">)[\s\S]*?(<\/script>)/,
    (match, open, close) => `${open}\n${buildPersonJsonLd(snapshot)}\n  ${close}`
  );
  return result;
}

function main() {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const current = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');
  const updated = generarIndex(current, snapshot);

  if (process.argv.includes('--comprobar')) {
    if (current !== updated) {
      console.error('index.html no está sincronizado con assets/data/portfolio.json. Ejecuta: npm run sincronizar');
      process.exitCode = 1;
    } else {
      console.log('index.html está sincronizado con el snapshot.');
    }
    return;
  }

  if (current !== updated) {
    fs.writeFileSync(indexPath, updated, 'utf8');
    console.log('index.html actualizado a partir de assets/data/portfolio.json');
  } else {
    console.log('index.html ya estaba sincronizado.');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`No se pudo sincronizar el HTML: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { generarIndex };
