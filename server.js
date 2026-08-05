require('dotenv').config();

const express = require('express');
const path = require('node:path');
const { MongoClient } = require('mongodb');

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const databaseName = process.env.MONGODB_DB_NAME || 'portfolio_daniel';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const client = new MongoClient(mongoUri);
let connectionPromise;

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function configureCors(request, response, next) {
  const origin = request.get('Origin');
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Vary', 'Origin');
  }
  next();
}

async function getDatabase() {
  if (!connectionPromise) {
    connectionPromise = client.connect().catch(error => {
      connectionPromise = undefined;
      throw error;
    });
  }
  await connectionPromise;
  return client.db(databaseName);
}

async function readCollection(database, collectionName, sort = { _id: 1 }) {
  return database.collection(collectionName).find({}).sort(sort).toArray();
}

async function readPortfolio() {
  const database = await getDatabase();
  const [perfil, proyectos, habilidades, experiencia, formacion, contacto] = await Promise.all([
    database.collection('perfil').findOne({}),
    readCollection(database, 'proyectos'),
    readCollection(database, 'habilidades'),
    readCollection(database, 'experiencia', { _id: -1 }),
    readCollection(database, 'formacion'),
    database.collection('contacto').findOne({})
  ]);

  return {
    perfil,
    proyectos: proyectos.map(project => ({ ...project, slug: project.slug || slugify(project.nombre) })),
    habilidades,
    experiencia,
    formacion,
    contacto: contacto || null
  };
}

app.use(express.json());
app.use(configureCors);
app.use('/api', (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', async (request, response) => {
  try {
    const database = await getDatabase();
    await database.command({ ping: 1 });
    response.json({ ok: true, database: databaseName });
  } catch (error) {
    console.error('MongoDB no está disponible:', error.message);
    response.status(503).json({ ok: false, error: 'MongoDB no está disponible' });
  }
});

app.get('/api/portfolio', async (request, response) => {
  try {
    response.json(await readPortfolio());
  } catch (error) {
    console.error('No se pudo leer el portfolio:', error.message);
    response.status(503).json({ error: 'No se han podido cargar los datos del portfolio' });
  }
});

app.get('/api/portfolio/projects/:slug', async (request, response) => {
  try {
    const portfolio = await readPortfolio();
    const project = portfolio.proyectos.find(item => item.slug === request.params.slug);
    if (!project) {
      return response.status(404).json({ error: 'Proyecto no encontrado' });
    }
    response.json(project);
  } catch (error) {
    console.error('No se pudo leer el proyecto:', error.message);
    response.status(503).json({ error: 'No se ha podido cargar el proyecto' });
  }
});

app.use((request, response, next) => {
  const blockedFiles = new Set(['/server.js', '/package.json', '/package-lock.json', '/.env', '/.env.example']);
  if (blockedFiles.has(request.path)) {
    return response.sendStatus(404);
  }
  next();
});

app.use(express.static(path.join(__dirname)));

app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Portfolio disponible en http://localhost:${port}`);
  console.log(`Base de datos configurada: ${databaseName}`);
});

process.on('SIGINT', async () => {
  await client.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await client.close();
  process.exit(0);
});
