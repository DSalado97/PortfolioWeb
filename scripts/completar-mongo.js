#!/usr/bin/env node
'use strict';

/**
 * Añade a MongoDB LOCAL lo que está publicado en assets/data/portfolio.json y
 * todavía no existe en la base de datos (experiencia, formación, categorías e
 * ítems de habilidades) y guarda el orden publicado en el campo "orden".
 *
 * Nunca sobrescribe ni borra contenido: donde hay diferencias manda MongoDB.
 * Por defecto es un ENSAYO; para escribir hay que pasar --aplicar:
 *
 *   npm run completar:mongo                 # ensayo, no escribe nada
 *   npm run completar:mongo -- --aplicar    # aplica los cambios
 *
 * Solo acepta bases de datos locales. Es idempotente.
 */

const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ quiet: true });
const { MongoClient } = require('mongodb');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017';
const LOCAL_URI_PATTERN = /^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;
const snapshotPath = path.join(__dirname, '..', 'assets', 'data', 'portfolio.json');
const shouldApply = process.argv.includes('--aplicar');

// Ítems del snapshot antiguo que en MongoDB ya existen con otro nombre.
const RENAMED_SKILLS = new Set([
  'Redes y Protocolos de Comunicación|Formación',
  'Sistemas de Seguridad y Ciberseguridad|Formación'
]);

async function main() {
  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  if (!LOCAL_URI_PATTERN.test(uri)) {
    throw new Error('MONGODB_URI no apunta a una base de datos local; no se escribe nada.');
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  let changes = 0;

  console.log(shouldApply ? 'MODO APLICAR\n' : 'MODO ENSAYO: no se escribe nada (usa --aplicar).\n');

  try {
    await client.connect();
    const database = client.db(process.env.MONGODB_DB_NAME || 'portfolio_daniel');

    // Inserta los documentos que faltan y fija "orden" solo en los que no lo tienen.
    async function completeCollection(name, entries, keyOf) {
      const collection = database.collection(name);
      const existing = await collection.find({}).toArray();
      for (const [index, entry] of entries.entries()) {
        const order = index + 1;
        const match = existing.find(document => keyOf(document) === keyOf(entry));
        if (!match) {
          changes++;
          console.log(`  [${name}] + ${keyOf(entry)} (orden ${order})`);
          if (shouldApply) await collection.insertOne({ ...entry, orden: order });
        } else if (match.orden === undefined) {
          changes++;
          console.log(`  [${name}] ${keyOf(entry)}: orden ${order}`);
          if (shouldApply) await collection.updateOne({ _id: match._id }, { $set: { orden: order } });
        }
      }
    }

    await completeCollection('experiencia', snapshot.experiencia, entry => `${entry.puesto} — ${entry.empresa}`);
    await completeCollection('formacion', snapshot.formacion, entry => entry.titulo);
    await completeCollection('habilidades', snapshot.habilidades, entry => entry.categoria);

    const skills = database.collection('habilidades');
    for (const category of snapshot.habilidades) {
      const stored = await skills.findOne({ categoria: category.categoria });
      if (!stored) continue; // En el ensayo aún no se ha insertado; ya se ha listado arriba.
      const names = new Set((stored.items || []).map(item => item.nombre));
      const missing = category.items.filter(item =>
        !names.has(item.nombre) && !RENAMED_SKILLS.has(`${category.categoria}|${item.nombre}`)
      );
      if (!missing.length) continue;
      changes += missing.length;
      console.log(`  [habilidades] ${category.categoria} + ${missing.map(item => item.nombre).join(', ')}`);
      if (shouldApply) {
        await skills.updateOne({ _id: stored._id }, { $push: { items: { $each: missing } } });
      }
    }
  } finally {
    await client.close();
  }

  console.log(`\n${changes} cambio(s) ${shouldApply ? 'aplicado(s)' : 'pendiente(s)'}.`);
}

main().catch(error => {
  console.error(`No se pudo completar MongoDB: ${error.message}`);
  process.exitCode = 1;
});
