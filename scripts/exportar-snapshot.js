#!/usr/bin/env node
'use strict';

/**
 * Exporta el contenido del portfolio a assets/data/portfolio.json (snapshot
 * estático que carga la web). MongoDB sigue siendo la fuente de verdad.
 *
 * Uso:
 *   node scripts/exportar-snapshot.js                 # lee de MongoDB (MONGODB_URI del .env)
 *   node scripts/exportar-snapshot.js --api <URL>     # lee de una API ya desplegada (solo GET)
 *   node scripts/exportar-snapshot.js --forzar        # no aborta si faltan archivos de imagen/vídeo
 *   node scripts/exportar-snapshot.js --salida ruta   # otro archivo de salida
 *
 * Se eliminan siempre los datos que no deben ser públicos (_id, teléfono y
 * fecha de nacimiento). Después de exportar, ejecuta `npm run sincronizar`
 * (o usa `npm run snapshot`, que hace las dos cosas) para regenerar el HTML.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const defaultOutput = path.join(rootDir, 'assets', 'data', 'portfolio.json');
const FORBIDDEN_KEYS = new Set(['_id', 'telefono', 'nacimiento']);

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Quita recursivamente las claves privadas y convierte tipos de MongoDB (ObjectId, fechas) en texto.
function sanitize(value) {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !FORBIDDEN_KEYS.has(key))
        .map(([key, item]) => [key, sanitize(item)])
    );
  }
  return value;
}

async function readFromMongo() {
  require('dotenv').config();
  const { MongoClient } = require('mongodb');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGODB_URI (defínela en .env o como variable de entorno).');
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const database = client.db(process.env.MONGODB_DB_NAME || 'portfolio_daniel');
    const readCollection = (name, sort = { _id: 1 }) => database.collection(name).find({}).sort(sort).toArray();
    const [perfil, proyectos, habilidades, experiencia, formacion, contacto] = await Promise.all([
      database.collection('perfil').findOne({}),
      readCollection('proyectos'),
      readCollection('habilidades'),
      readCollection('experiencia', { _id: -1 }),
      readCollection('formacion', { _id: -1 }),
      database.collection('contacto').findOne({})
    ]);
    return { perfil, proyectos, habilidades, experiencia, formacion, contacto };
  } finally {
    await client.close();
  }
}

async function readFromApi(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`La API respondió con ${response.status}`);
  }
  return response.json();
}

function checkLocalFiles(snapshot) {
  const missing = [];
  const visit = (value, trail) => {
    if (typeof value === 'string') {
      if (/^assets\//.test(value) && !fs.existsSync(path.join(rootDir, value))) {
        missing.push(`${trail} → ${value}`);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${trail}[${index}]`));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => visit(item, trail ? `${trail}.${key}` : key));
    }
  };
  visit(snapshot, '');
  return missing;
}

async function main() {
  const apiUrl = getOption('--api');
  const outputPath = path.resolve(getOption('--salida') || defaultOutput);
  const raw = apiUrl ? await readFromApi(apiUrl) : await readFromMongo();

  const snapshot = sanitize({
    generado: new Date().toISOString(),
    perfil: raw.perfil || {},
    contacto: raw.contacto || {},
    proyectos: (raw.proyectos || []).map(project => ({ ...project, slug: project.slug || slugify(project.nombre) })),
    habilidades: raw.habilidades || [],
    experiencia: raw.experiencia || [],
    formacion: raw.formacion || []
  });

  const missing = checkLocalFiles(snapshot);
  if (missing.length && !process.argv.includes('--forzar')) {
    console.error('Los datos apuntan a archivos que no existen en el proyecto:');
    missing.forEach(item => console.error(`  - ${item}`));
    console.error('\nSi los datos de MongoDB aún tienen las rutas antiguas (GIF/PNG), ejecuta antes:');
    console.error('  npm run actualizar:mongo -- --aplicar');
    console.error('o repite con --forzar para exportar igualmente.');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Snapshot escrito en ${path.relative(rootDir, outputPath)} (${snapshot.proyectos.length} proyectos, ${snapshot.habilidades.length} categorías de habilidades).`);
}

main().catch(error => {
  console.error(`No se pudo exportar el snapshot: ${error.message}`);
  process.exitCode = 1;
});
