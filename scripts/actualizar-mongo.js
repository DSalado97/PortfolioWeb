#!/usr/bin/env node
'use strict';

/**
 * Aplica a MongoDB los mismos cambios de datos que ya están en el snapshot
 * assets/data/portfolio.json, para que la base de datos (fuente de verdad)
 * quede alineada con la web:
 *
 *   - Proyectos: rutas nuevas de imagen WebP/JPG, vídeo WebM/MP4 con póster
 *     (se elimina el campo "gif"), dimensiones y archivo de detalle.
 *   - Perfil y contacto: se eliminan teléfono y fecha de nacimiento; se
 *     actualizan el título y los roles.
 *   - Erratas: ItelliJ → IntelliJ, Sprint Boot → Spring Boot,
 *     Jupyter Books → Jupyter Notebooks, "C\#" → "C#" y punto final sobrante
 *     en el nombre de categorías de habilidades.
 *   - Formación: añade el máster si aún no existe.
 *
 * Por defecto es un ENSAYO (--dry-run): solo lee y muestra lo que cambiaría.
 * Para escribir de verdad hay que pasar --aplicar explícitamente:
 *
 *   npm run actualizar:mongo                  # ensayo, no escribe nada
 *   npm run actualizar:mongo -- --aplicar     # aplica los cambios
 *
 * Usa MONGODB_URI / MONGODB_DB_NAME del .env (o de variables de entorno).
 * El script es idempotente: volver a ejecutarlo no repite cambios.
 */

const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config();
const { MongoClient } = require('mongodb');

const rootDir = path.join(__dirname, '..');
const snapshotPath = path.join(rootDir, 'assets', 'data', 'portfolio.json');
const shouldApply = process.argv.includes('--aplicar') && !process.argv.includes('--dry-run');

const TYPO_FIXES = [
  [/ItelliJ/g, 'IntelliJ'],
  [/Sprint Boot/g, 'Spring Boot'],
  [/Jupyter Books/g, 'Jupyter Notebooks'],
  [/C\\#/g, 'C#']
];
const PRIVATE_FIELDS = ['telefono', 'nacimiento'];
const PROJECT_FIELDS = ['imagen', 'imagen_fallback', 'ancho', 'alto', 'video', 'detalle'];

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fixTypos(value) {
  if (typeof value === 'string') {
    return TYPO_FIXES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
  }
  if (Array.isArray(value)) {
    return value.map(fixTypos);
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fixTypos(item)]));
  }
  return value;
}

function summarize(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const lines = [];
  for (const key of keys) {
    if (key === '_id') continue;
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    const show = value => (value === undefined ? '(sin definir)' : JSON.stringify(value).slice(0, 90));
    lines.push(`      ${key}: ${show(before[key])} → ${show(after[key])}`);
  }
  return lines;
}

async function main() {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Falta MONGODB_URI (defínela en .env o como variable de entorno).');
  }

  console.log(shouldApply
    ? 'MODO APLICAR: se escribirán los cambios en MongoDB.\n'
    : 'MODO ENSAYO (--dry-run): no se escribe nada. Usa --aplicar para aplicar los cambios.\n');

  const client = new MongoClient(uri);
  let pendingChanges = 0;

  try {
    await client.connect();
    const database = client.db(process.env.MONGODB_DB_NAME || 'portfolio_daniel');

    async function processCollection(name, transform) {
      const documents = await database.collection(name).find({}).toArray();
      for (const original of documents) {
        const { _id: documentId, ...body } = original;
        const updated = transform(fixTypos(JSON.parse(JSON.stringify(body))), original);

        // Solo se tocan los campos que cambian (con $set / $unset), nunca se reemplaza el documento entero.
        const toSet = {};
        const toUnset = {};
        for (const key of Object.keys(updated)) {
          if (JSON.stringify(updated[key]) !== JSON.stringify(body[key])) toSet[key] = updated[key];
        }
        for (const key of Object.keys(body)) {
          if (!(key in updated)) toUnset[key] = '';
        }
        if (!Object.keys(toSet).length && !Object.keys(toUnset).length) continue;

        pendingChanges++;
        const label = original.nombre || original.titulo || original.categoria || original.puesto || String(documentId);
        console.log(`  [${name}] ${label}`);
        summarize(body, updated).forEach(line => console.log(line));
        if (shouldApply) {
          const operation = {};
          if (Object.keys(toSet).length) operation.$set = toSet;
          if (Object.keys(toUnset).length) operation.$unset = toUnset;
          await database.collection(name).updateOne({ _id: documentId }, operation);
        }
      }
    }

    console.log('Perfil');
    await processCollection('perfil', document => {
      PRIVATE_FIELDS.forEach(field => delete document[field]);
      if (snapshot.perfil?.titulo) document.titulo = snapshot.perfil.titulo;
      if (Array.isArray(snapshot.perfil?.roles)) document.roles = snapshot.perfil.roles;
      return document;
    });

    console.log('Contacto');
    await processCollection('contacto', document => {
      PRIVATE_FIELDS.forEach(field => delete document[field]);
      return document;
    });

    console.log('Proyectos');
    await processCollection('proyectos', document => {
      const slug = document.slug || slugify(document.nombre);
      const target = snapshot.proyectos.find(project => project.slug === slug || slugify(project.nombre) === slug);
      if (target) {
        PROJECT_FIELDS.forEach(field => {
          if (target[field] !== undefined) document[field] = target[field];
        });
        document.slug = target.slug;
        delete document.gif;
      }
      return document;
    });

    console.log('Habilidades');
    await processCollection('habilidades', document => {
      if (typeof document.categoria === 'string') {
        document.categoria = document.categoria.replace(/\.\s*$/, '');
      }
      return document;
    });

    console.log('Experiencia');
    await processCollection('experiencia', document => document);

    console.log('Formación');
    await processCollection('formacion', document => document);
    const existingTitles = new Set((await database.collection('formacion').find({}).toArray()).map(item => item.titulo));
    // Solo se añade el máster (lo único que puede faltar); el resto de la formación no se duplica.
    for (const entry of (snapshot.formacion || []).filter(item => /^Máster/i.test(item.titulo))) {
      if (existingTitles.has(entry.titulo)) continue;
      pendingChanges++;
      console.log(`  [formacion] + ${entry.titulo}`);
      if (shouldApply) {
        await database.collection('formacion').insertOne({ titulo: entry.titulo, centro: entry.centro });
      }
    }
  } finally {
    await client.close();
  }

  console.log(`\n${pendingChanges} documento(s) ${shouldApply ? 'actualizado(s)' : 'con cambios pendientes'}.`);
  if (!shouldApply && pendingChanges) {
    console.log('Revisa la lista y ejecuta de nuevo con --aplicar para escribirlos.');
  }
}

main().catch(error => {
  console.error(`No se pudo actualizar MongoDB: ${error.message}`);
  process.exitCode = 1;
});
