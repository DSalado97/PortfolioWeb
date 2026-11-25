#!/usr/bin/env node
'use strict';

/**
 * Exporta el contenido del portfolio a assets/data/portfolio.json (snapshot
 * estático que carga la web). MongoDB sigue siendo la fuente de verdad.
 *
 * Uso:
 *   node scripts/exportar-snapshot.js                 # lee de MongoDB (MONGODB_URI del .env)
 *   node scripts/exportar-snapshot.js --forzar        # no aborta si faltan archivos o se pierde contenido
 *   node scripts/exportar-snapshot.js --salida ruta   # otro archivo de salida
 *
 * Se eliminan siempre los datos que no deben ser públicos (_id, teléfono, fecha
 * de nacimiento y notas internas) y se aborta si la base de datos tiene menos
 * contenido que el snapshot publicado. Después, ejecuta `npm run sincronizar`
 * (o usa `npm run snapshot`, que hace las dos cosas) para regenerar el HTML.
 */

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const defaultOutput = path.join(rootDir, 'assets', 'data', 'portfolio.json');
const FORBIDDEN_KEYS = new Set(['_id', 'telefono', 'nacimiento', 'nota', 'orden']);

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
  require('dotenv').config({ quiet: true });
  const { MongoClient } = require('mongodb');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGODB_URI (defínela en .env o como variable de entorno).');
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const database = client.db(process.env.MONGODB_DB_NAME || 'portfolio_daniel');
    const readCollection = (name, sort = { _id: 1 }) => database.collection(name).find({}).sort(sort).toArray();
    const [perfil, proyectos, habilidades, experiencia, formacion, contacto] = await Promise.all([
      database.collection('perfil').findOne({}),
      readCollection('proyectos'),
      readCollection('habilidades', { orden: 1, _id: 1 }),
      readCollection('experiencia', { orden: 1, _id: -1 }),
      readCollection('formacion', { orden: 1, _id: -1 }),
      database.collection('contacto').findOne({})
    ]);
    return { perfil, proyectos, habilidades, experiencia, formacion, contacto };
  } finally {
    await client.close();
  }
}

// Contenido publicado que ya no está en los datos nuevos (evita borrar entradas sin querer).
function findLostContent(previous, next) {
  const lost = [];
  const compare = (label, before, after, keyOf) => {
    const keys = new Set((after || []).map(keyOf));
    (before || []).filter(entry => !keys.has(keyOf(entry))).forEach(entry => lost.push(`${label}: ${keyOf(entry)}`));
  };
  compare('proyecto', previous.proyectos, next.proyectos, entry => entry.slug);
  compare('experiencia', previous.experiencia, next.experiencia, entry => `${entry.puesto} — ${entry.empresa}`);
  compare('formación', previous.formacion, next.formacion, entry => entry.titulo);
  compare('categoría', previous.habilidades, next.habilidades, entry => entry.categoria);
  (previous.habilidades || []).forEach(category => {
    const match = (next.habilidades || []).find(entry => entry.categoria === category.categoria);
    if (match) {
      compare(`habilidad de ${category.categoria}`, category.items, match.items, item => item.nombre);
    }
  });
  return lost;
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
  const outputPath = path.resolve(getOption('--salida') || defaultOutput);
  const raw = await readFromMongo();

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
    console.error('\nCorrige las rutas en MongoDB o repite con --forzar.');
    process.exitCode = 1;
    return;
  }

  if (fs.existsSync(defaultOutput)) {
    const lost = findLostContent(JSON.parse(fs.readFileSync(defaultOutput, 'utf8')), snapshot);
    if (lost.length && !process.argv.includes('--forzar')) {
      console.error('La base de datos no tiene contenido que sí está publicado:');
      lost.forEach(item => console.error(`  - ${item}`));
      console.error('\nNo se ha exportado nada. Añádelo a MongoDB o repite con --forzar si quieres retirarlo.');
      process.exitCode = 1;
      return;
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Snapshot escrito en ${path.relative(rootDir, outputPath)} (${snapshot.proyectos.length} proyectos, ${snapshot.habilidades.length} categorías de habilidades).`);
}

main().catch(error => {
  console.error(`No se pudo exportar el snapshot: ${error.message}`);
  process.exitCode = 1;
});
