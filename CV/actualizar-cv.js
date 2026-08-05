#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const apiUrl = 'https://portfolio-web-daniel.onrender.com/api/portfolio';
const outputPath = path.join(__dirname, 'datos-cv.js');

async function actualizarCv() {
  const response = await fetch(apiUrl, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`La API ha respondido con el estado ${response.status}.`);
  }

  const portfolio = await response.json();
  const cvData = {
    perfil: portfolio.perfil,
    contacto: portfolio.contacto,
    habilidades: (portfolio.habilidades || []).map(category => ({
      categoria: category.categoria,
      items: (category.items || []).map(skill => ({ nombre: skill.nombre }))
    })),
    experiencia: (portfolio.experiencia || []).map(entry => ({
      puesto: entry.puesto,
      empresa: entry.empresa,
      ubicacion: entry.ubicacion,
      periodo: entry.periodo,
      inicio: entry.inicio,
      fin: entry.fin,
      finalizacion: entry.finalizacion,
      responsabilidades: entry.responsabilidades,
      logros: entry.logros
    })),
    formacion: (portfolio.formacion || []).map(entry => ({
      titulo: entry.titulo,
      centro: entry.centro
    }))
  };
  const content = `/* Generado automáticamente el ${new Date().toISOString()} */\nwindow.CV_DATA = ${JSON.stringify(cvData, null, 2)};\n`;
  await fs.writeFile(outputPath, content, 'utf8');
  console.log('Datos del CV actualizados correctamente.');
}

actualizarCv().catch(error => {
  console.error(`No se han podido actualizar los datos del CV: ${error.message}`);
  process.exitCode = 1;
});
