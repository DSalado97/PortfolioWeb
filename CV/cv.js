(function renderCv() {
  'use strict';

  const portfolio = window.CV_DATA;
  if (!portfolio) {
    document.body.classList.add('has-error');
    return;
  }

  const createElement = (tagName, text, className) => {
    const element = document.createElement(tagName);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  };

  const formatDate = value => {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
  };

  const renderLinks = (profile, contact) => {
    const container = document.querySelector('[data-contact-links]');
    const links = [
      ['Correo', profile.email || contact.email, 'mailto:'],
      ['Teléfono', profile.telefono || contact.telefono, 'tel:'],
      ['LinkedIn', profile.redes?.linkedin || contact.linkedin, ''],
      ['GitHub', profile.redes?.github || contact.github, '']
    ].filter(([, value]) => value);

    links.forEach(([label, value, protocol]) => {
      const link = createElement('a');
      link.href = `${protocol}${value}`;
      link.appendChild(createElement('strong', `${label}:`));
      link.appendChild(createElement('span', protocol ? value : value.replace(/^https?:\/\//, '').replace(/\/$/, '')));
      if (!protocol || protocol === 'mailto:') {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      container.appendChild(link);
    });
  };

  const renderSkills = skills => {
    const container = document.querySelector('[data-skills]');
    (skills || []).forEach(category => {
      const block = createElement('div', null, 'skill-group');
      block.appendChild(createElement('h3', category.categoria));
      const list = createElement('p');
      list.textContent = (category.items || []).map(skill => skill.nombre).filter(Boolean).join(' · ');
      block.appendChild(list);
      container.appendChild(block);
    });
  };

  const renderExperience = entries => {
    const container = document.querySelector('[data-experience]');
    (entries || []).forEach(entry => {
      const article = createElement('article', null, 'timeline-item');
      const heading = createElement('div', null, 'entry-heading');
      heading.appendChild(createElement('h3', entry.puesto));
      const period = entry.periodo || [formatDate(entry.inicio), formatDate(entry.fin || entry.finalizacion)].filter(Boolean).join(' — ');
      if (period) heading.appendChild(createElement('span', period));
      article.appendChild(heading);
      article.appendChild(createElement('p', [entry.empresa, entry.ubicacion].filter(Boolean).join(' · '), 'entry-company'));

      const items = [...(entry.responsabilidades || []), ...(Array.isArray(entry.logros) ? entry.logros : entry.logros ? [entry.logros] : [])].filter(Boolean);
      if (items.length) {
        const list = createElement('ul');
        items.forEach(item => list.appendChild(createElement('li', item)));
        article.appendChild(list);
      }
      container.appendChild(article);
    });
  };

  const renderEducation = entries => {
    const container = document.querySelector('[data-education]');
    (entries || []).forEach(entry => {
      const article = createElement('article', null, 'education-item');
      article.appendChild(createElement('h3', entry.titulo));
      if (entry.centro) article.appendChild(createElement('p', entry.centro));
      container.appendChild(article);
    });
  };

  const profile = portfolio.perfil || {};
  const contact = portfolio.contacto || {};
  setText('[data-name]', profile.nombre);
  setText('[data-title]', profile.titulo);
  setText('[data-summary]', profile.descripcion);
  setText('[data-location]', [profile.ciudad, profile.pais].filter(Boolean).join(', '));
  document.title = `CV | ${profile.nombre || 'Daniel Salado Romero'}`;
  renderLinks(profile, contact);
  renderSkills(portfolio.habilidades);
  renderExperience(portfolio.experiencia);
  renderEducation(portfolio.formacion);
})();
