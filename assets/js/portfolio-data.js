(function loadPortfolioData() {
  'use strict';

  const configuredApiBaseUrl = document.body.dataset.apiBaseUrl || window.PORTFOLIO_API_BASE_URL || '';
  const apiBaseUrl = configuredApiBaseUrl.replace(/\/$/, '');
  const projectSlug = document.body.dataset.projectSlug;

  function createElement(tagName, textContent, className) {
    const element = document.createElement(tagName);
    if (textContent !== undefined && textContent !== null) {
      element.textContent = textContent;
    }
    if (className) {
      element.className = className;
    }
    return element;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  }

  function setLink(link, url, label) {
    if (!link || !url || !/^https?:\/\//i.test(url)) {
      return false;
    }
    link.href = url;
    if (label && !link.querySelector('i')) {
      link.textContent = label;
    }
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return true;
  }

  function formatBirthDate(value) {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }

  function addParagraphs(container, paragraphs) {
    (Array.isArray(paragraphs) ? paragraphs : [paragraphs])
      .filter(Boolean)
      .forEach(paragraph => container.appendChild(createElement('p', paragraph)));
  }

  function addList(container, items) {
    const list = createElement('ul');
    (items || []).filter(Boolean).forEach(item => {
      list.appendChild(createElement('li', item));
    });
    container.appendChild(list);
  }

  function renderProfile(portfolio) {
    const profile = portfolio.perfil || {};
    const contact = portfolio.contacto || {};
    const networks = profile.redes || {};

    setText('[data-portfolio-name]', profile.nombre);
    setText('[data-portfolio-title]', profile.titulo);
    setText('[data-portfolio-description]', profile.descripcion);
    setText('[data-portfolio-birth]', profile.nacimiento && formatBirthDate(profile.nacimiento));
    setText('[data-portfolio-phone]', profile.telefono || contact.telefono);
    setText('[data-portfolio-city]', [profile.ciudad, profile.pais].filter(Boolean).join(', '));
    setText('[data-portfolio-email]', profile.email || contact.email);
    setText('[data-portfolio-availability]', profile.disponibilidad || contact.disponibilidad);

    const rolesElement = document.querySelector('[data-portfolio-roles]');
    if (rolesElement && Array.isArray(profile.roles)) {
      rolesElement.dataset.typedItems = profile.roles.join(',');
    }

    const socialLinks = document.querySelectorAll('[data-portfolio-social]');
    socialLinks.forEach(link => {
      const network = link.dataset.portfolioSocial;
      setLink(link, networks[network] || contact[network], network);
    });
  }

  function renderProjects(projects) {
    const container = document.querySelector('[data-portfolio-projects]');
    if (!container) {
      return;
    }
    container.replaceChildren();

    (projects || []).forEach(project => {
      const slug = project.slug || project.nombre.toLowerCase().replace(/\s+/g, '-');
      const category = String(project.categoria || '').toLowerCase();
      const item = createElement('div', null, `col-lg-4 col-md-6 portfolio-item isotope-item ${category === 'web' ? 'filter-web' : 'filter-games'}`);
      const image = createElement('img', null, 'img-fluid');
      image.src = project.imagen || '';
      image.alt = project.nombre || 'Proyecto';
      image.loading = 'lazy';
      item.appendChild(image);

      const info = createElement('div', null, 'portfolio-info');
      info.appendChild(createElement('h4', project.nombre));
      info.appendChild(createElement('p', project.descripcion_corta));
      const detailsLink = createElement('a', null, 'details-link');
      detailsLink.href = `portfolio-details-${slug}.html`;
      detailsLink.title = 'Más detalles';
      detailsLink.setAttribute('aria-label', `Más detalles sobre ${project.nombre}`);
      detailsLink.appendChild(createElement('i', null, 'bi bi-info-circle'));
      info.appendChild(detailsLink);
      item.appendChild(info);
      container.appendChild(item);
    });
  }

  function renderSkills(categories) {
    const container = document.querySelector('[data-portfolio-skills]');
    if (!container) {
      return;
    }
    container.replaceChildren();

    (categories || []).forEach(category => {
      const item = createElement('div', null, 'skills-item');
      const title = createElement('h3', null, 'resume-title toggle-title');
      title.appendChild(document.createTextNode(category.categoria || 'Habilidades'));
      title.appendChild(createElement('i', null, 'bi bi-chevron-down toggle-icon'));
      item.appendChild(title);

      const content = createElement('div', null, 'resume-item toggle-content');
      (category.items || []).forEach(skill => {
        const entry = createElement('div', null, 'resume-entry');
        if (skill.nombre) {
          entry.appendChild(createElement('h4', skill.nombre));
        }
        addParagraphs(entry, skill.descripcion);
        content.appendChild(entry);
      });
      item.appendChild(content);
      container.appendChild(item);
    });

    container.querySelectorAll('.toggle-title').forEach(title => {
      title.addEventListener('click', () => title.closest('.skills-item').classList.toggle('active'));
    });
  }

  function renderResume(portfolio) {
    const renderEntries = (selector, entries, titleKey, placeKey, detailsKey) => {
      const container = document.querySelector(selector);
      if (!container) {
        return;
      }
      const sectionTitle = container.querySelector(':scope > .resume-title');
      container.replaceChildren();
      if (sectionTitle) {
        container.appendChild(sectionTitle);
      }
      (entries || []).forEach(entry => {
        const item = createElement('div', null, 'resume-item');
        item.appendChild(createElement('h4', entry[titleKey]));
        item.appendChild(createElement('p')).appendChild(createElement('em', entry[placeKey]));
        addList(item, entry[detailsKey] || entry.responsabilidades);
        container.appendChild(item);
      });
    };

    renderEntries('[data-portfolio-experience]', portfolio.experiencia, 'puesto', 'empresa', 'responsabilidades');
    renderEntries('[data-portfolio-education]', portfolio.formacion, 'titulo', 'centro', 'detalles');
  }

  function renderContact(portfolio) {
    const contact = portfolio.contacto || portfolio.perfil || {};
    setText('[data-contact-phone]', contact.telefono);
    setText('[data-contact-email]', contact.email);
    setText('[data-contact-city]', contact.ciudad || [contact.ciudad, contact.pais].filter(Boolean).join(', '));
    setLink(document.querySelector('[data-contact-linkedin]'), contact.linkedin || contact.redes?.linkedin, 'in/saladodaniel/');
    setLink(document.querySelector('[data-contact-github]'), contact.github || contact.redes?.github, 'github.com/DSalado97');
  }

  function renderHome(portfolio) {
    renderProfile(portfolio);
    renderProjects(portfolio.proyectos);
    renderSkills(portfolio.habilidades);
    renderResume(portfolio);
    renderContact(portfolio);
  }

  function renderProjectDetail(project) {
    setText('[data-project-title]', `Más sobre la aplicación ${project.nombre}`);
    document.title = `DSR - Detalles ${project.nombre}`;

    const description = document.querySelector('[data-project-description]');
    if (description) {
      description.replaceChildren();
      description.appendChild(createElement('h2', 'Introducción'));
      addParagraphs(description, project.descripcion_larga || project.descripcion_corta);
      if (project.mecanicas?.length) {
        description.appendChild(createElement('h2', 'Mecánicas y características'));
        addList(description, project.mecanicas);
      }
      if (project.tecnicas_programacion?.length) {
        description.appendChild(createElement('h2', 'Sobre la programación'));
        addList(description, project.tecnicas_programacion);
      }
      if (project.secciones?.length) {
        description.appendChild(createElement('h2', 'Estructura y navegación'));
        addList(description, project.secciones);
      }
      description.appendChild(createElement('h2', 'Acceso al proyecto'));
      addParagraphs(description, 'El código y los recursos disponibles se encuentran en los enlaces del proyecto.');
    }

    const info = document.querySelector('[data-project-info]');
    if (!info) {
      return;
    }
    info.replaceChildren();
    info.appendChild(createElement('h3', 'Información del proyecto'));
    const list = createElement('ul');
    const addInfo = (label, value) => {
      if (!value) {
        return;
      }
      const row = createElement('li');
      row.appendChild(createElement('strong', label));
      row.appendChild(document.createTextNode(' '));
      row.appendChild(createElement('span', Array.isArray(value) ? value.join(', ') : value));
      list.appendChild(row);
    };
    addInfo('Categoría', project.categoria || project.tipo);
    addInfo(project.ide ? 'IDE' : 'Editor', project.ide || project.editor);
    addInfo('Tecnologías', project.tecnologias);

    if (project.repositorio) {
      const row = createElement('li');
      row.appendChild(createElement('strong', 'Repositorio'));
      row.appendChild(document.createTextNode(' '));
      const link = createElement('a', 'GitHub');
      setLink(link, project.repositorio, 'GitHub');
      row.appendChild(link);
      list.appendChild(row);
    }
    if (project.descarga) {
      const row = createElement('li');
      row.appendChild(createElement('strong', 'Descargar'));
      row.appendChild(document.createTextNode(' '));
      const link = createElement('a', 'Drive');
      setLink(link, project.descarga, 'Drive');
      row.appendChild(link);
      list.appendChild(row);
    }
    info.appendChild(list);

    if (project.gif) {
      const image = createElement('img', null, 'img-gif');
      image.src = project.gif;
      image.alt = `Vista previa de ${project.nombre}`;
      image.loading = 'lazy';
      info.appendChild(image);
    }
  }

  async function fetchJson(url) {
    const response = await fetch(`${apiBaseUrl}${url}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`La API respondió con ${response.status}`);
    }
    return response.json();
  }

  async function init() {
    try {
      const data = projectSlug
        ? await fetchJson(`/api/portfolio/projects/${encodeURIComponent(projectSlug)}`)
        : await fetchJson('/api/portfolio');

      if (projectSlug) {
        renderProjectDetail(data);
      } else {
        renderHome(data);
      }
      document.body.dataset.portfolioDataState = 'loaded';
      document.dispatchEvent(new CustomEvent('portfolio:data-loaded'));
    } catch (error) {
      console.error('No se han podido cargar los datos de MongoDB:', error);
      document.body.dataset.portfolioDataState = 'error';
      document.dispatchEvent(new CustomEvent('portfolio:data-error', { detail: error }));
    }
  }

  init();
})();
