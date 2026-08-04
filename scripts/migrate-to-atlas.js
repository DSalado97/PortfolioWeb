const path = require('node:path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH || path.resolve(process.cwd(), 'atlas-credentials.env')
});

const sourceUri = process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const sourceDatabaseName = process.env.SOURCE_MONGODB_DB_NAME || 'portfolio_daniel';
const targetUri = process.env.TARGET_MONGODB_URI;
const targetDatabaseName = process.env.TARGET_MONGODB_DB_NAME || sourceDatabaseName;
const collections = ['perfil', 'proyectos', 'habilidades', 'experiencia', 'formacion', 'contacto'];

if (!targetUri) {
  throw new Error('Falta TARGET_MONGODB_URI en el archivo de credenciales.');
}

if (process.env.REPLACE_TARGET !== 'true') {
  throw new Error('La migración requiere REPLACE_TARGET=true para confirmar el reemplazo en Atlas.');
}

async function migrate() {
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    await Promise.all([sourceClient.connect(), targetClient.connect()]);
    const sourceDatabase = sourceClient.db(sourceDatabaseName);
    const targetDatabase = targetClient.db(targetDatabaseName);

    for (const collectionName of collections) {
      const documents = await sourceDatabase.collection(collectionName).find({}).toArray();
      const targetCollection = targetDatabase.collection(collectionName);
      await targetCollection.deleteMany({});
      if (documents.length > 0) {
        await targetCollection.insertMany(documents);
      }
      console.log(`${collectionName}: ${documents.length} documento(s) migrado(s)`);
    }

    console.log(`Migración completada en la base de datos ${targetDatabaseName}.`);
  } finally {
    await Promise.all([sourceClient.close(), targetClient.close()]);
  }
}

migrate().catch(error => {
  console.error(`No se pudo completar la migración: ${error.message}`);
  process.exitCode = 1;
});
