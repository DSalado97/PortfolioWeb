/**
 * Carga assets/data/portfolio.json (mismo origen, sin depender de ninguna API)
 * y actualiza la portada solo si el snapshot es distinto del que ya se generó
 * en el HTML estático (atributo data-snapshot del <body>).
 */
(function loadPortfolioData() {
  'use strict';

  const SNAPSHOT_URL = 'assets/data/portfolio.json';
  const render = window.PortfolioRender;

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  }

  function setHtml(selector, html) {
    const element = document.querySelector(selector);
    if (element) {
      element.innerHTML = html;
    }
  }

  function setSocialLink(link, url) {
    if (link && /^https?:\/\//i.test(url || '')) {
      link.href = url;
    }
  }

  function renderProfile(portfolio) {
    const profile = portfolio.perfil || {};
    const networks = profile.redes || {};

    setText('[data-portfolio-name]', profile.nombre);
    setText('[data-portfolio-title]', profile.titulo);
    setText('[data-portfolio-description]', profile.descripcion);
    setHtml('[data-portfolio-about-details]', render.renderAboutDetails({
      ...profile,
      email: profile.email || (portfolio.contacto || {}).email
    }));

    const rolesElement = document.querySelector('[data-portfolio-roles]');
    if (rolesElement && Array.isArray(profile.roles)) {
      rolesElement.dataset.typedItems = profile.roles.join(',');
    }

    document.querySelectorAll('[data-portfolio-social]').forEach(link => {
      setSocialLink(link, networks[link.dataset.portfolioSocial]);
    });
  }

  function renderHome(portfolio) {
    renderProfile(portfolio);
    setHtml('[data-portfolio-projects]', render.renderProjectCards(portfolio.proyectos));
    setHtml('[data-portfolio-skills]', render.renderSkills(portfolio.habilidades));
    setHtml('[data-portfolio-experience]', render.renderExperience(portfolio.experiencia));
    setHtml('[data-portfolio-education]', render.renderEducation(portfolio.formacion));
    setHtml('[data-portfolio-contact]', render.renderContact({
      ...(portfolio.contacto || {}),
      email: (portfolio.contacto || {}).email || (portfolio.perfil || {}).email
    }));
  }

  async function fetchSnapshot() {
    const response = await fetch(SNAPSHOT_URL, {
      cache: 'no-cache',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`No se pudo cargar el snapshot (${response.status})`);
    }
    return response.json();
  }

  async function init() {
    if (!render) {
      return;
    }
    try {
      const portfolio = await fetchSnapshot();
      if (document.body.dataset.snapshot === portfolio.generado) {
        document.body.dataset.portfolioDataState = 'static';
        return;
      }
      renderHome(portfolio);
      document.body.dataset.snapshot = portfolio.generado;
      document.body.dataset.portfolioDataState = 'rendered';
      document.dispatchEvent(new CustomEvent('portfolio:rendered'));
    } catch (error) {
      // El HTML estático ya contiene el contenido, así que la página sigue siendo usable.
      console.warn('Se mantiene el contenido estático:', error.message);
      document.body.dataset.portfolioDataState = 'error';
    }
  }

  init();
})();
