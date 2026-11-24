/**
 * Generadores de HTML del portfolio a partir de assets/data/portfolio.json.
 *
 * Este mismo archivo lo usan:
 *  - el navegador (assets/js/portfolio-data.js), que expone window.PortfolioRender;
 *  - Node (scripts/sincronizar-html.js), que lo carga con require() para
 *    escribir el HTML estático de index.html con exactamente el mismo marcado.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PortfolioRender = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Algunos proyectos no siguen el patrón portfolio-details-<slug>.html.
  const DETAIL_FILE_ALIASES = {
    'portafolio-web': 'portfolio',
    'portfolio-web': 'portfolio'
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toArray(value) {
    return (Array.isArray(value) ? value : [value]).filter(Boolean);
  }

  function renderList(items) {
    const entries = toArray(items);
    if (!entries.length) {
      return '';
    }
    return `<ul>${entries.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function renderParagraphs(value) {
    return toArray(value).map(text => `<p>${escapeHtml(text)}</p>`).join('');
  }

  function isSafeUrl(url) {
    return /^https?:\/\//i.test(String(url || ''));
  }

  function getDetailFile(project) {
    if (project.detalle) {
      return project.detalle;
    }
    const slug = project.slug || String(project.nombre || '').toLowerCase().replace(/\s+/g, '-');
    return `portfolio-details-${DETAIL_FILE_ALIASES[slug] || slug}.html`;
  }

  function renderProjectCards(projects) {
    return (projects || []).map(project => {
      const isWeb = String(project.categoria || '').toLowerCase() === 'web';
      const filterClass = isWeb ? 'filter-web' : 'filter-games';
      const name = project.nombre || 'Proyecto';
      const dimensions = project.ancho && project.alto
        ? ` width="${escapeHtml(project.ancho)}" height="${escapeHtml(project.alto)}"`
        : '';
      const fallback = project.imagen_fallback || project.imagen || '';
      const webp = project.imagen && /\.webp$/i.test(project.imagen)
        ? `<source srcset="${escapeHtml(project.imagen)}" type="image/webp">`
        : '';
      return [
        `<div class="col-lg-4 col-md-6 portfolio-item isotope-item ${filterClass}">`,
        `<picture>${webp}<img src="${escapeHtml(fallback)}" class="img-fluid" alt="${escapeHtml(`Captura del proyecto ${name}`)}"${dimensions} loading="lazy" decoding="async"></picture>`,
        '<div class="portfolio-info">',
        `<h4>${escapeHtml(name)}</h4>`,
        `<p>${escapeHtml(project.descripcion_corta)}</p>`,
        `<a href="${escapeHtml(getDetailFile(project))}" title="Más detalles" aria-label="${escapeHtml(`Más detalles sobre ${name}`)}" class="details-link"><i class="bi bi-info-circle" aria-hidden="true"></i></a>`,
        '</div>',
        '</div>'
      ].join('\n');
    }).join('\n');
  }

  function renderSkills(categories) {
    return (categories || []).map((category, index) => {
      const toggleId = `skills-toggle-${index}`;
      const panelId = `skills-panel-${index}`;
      const entries = [...(category.items || [])]
        .sort((first, second) => String(first.nombre || '').localeCompare(String(second.nombre || ''), 'es', { sensitivity: 'base' }))
        .map(skill => {
          const description = Array.isArray(skill.descripcion) && skill.descripcion.length > 1
            ? renderList(skill.descripcion)
            : renderParagraphs(skill.descripcion);
          const heading = skill.nombre ? `<h4>${escapeHtml(skill.nombre)}</h4>` : '';
          return `<div class="resume-entry">${heading}${description}</div>`;
        }).join('\n');
      return [
        '<div class="skills-item">',
        `<h3 class="resume-title toggle-title"><button type="button" class="toggle-button" id="${toggleId}" aria-expanded="false" aria-controls="${panelId}"><span>${escapeHtml(category.categoria || 'Habilidades')}</span><i class="bi bi-chevron-down toggle-icon" aria-hidden="true"></i></button></h3>`,
        `<div class="resume-item toggle-content" id="${panelId}" role="region" aria-labelledby="${toggleId}">`,
        entries,
        '</div>',
        '</div>'
      ].join('\n');
    }).join('\n');
  }

  function renderResumeEntries(entries, titleKey, placeKey, detailsKey) {
    return (entries || []).map(entry => {
      const place = [entry[placeKey], entry.ubicacion].filter(Boolean).join(' - ');
      const achievements = toArray(entry.logros);
      const achievementsBlock = achievements.length
        ? `<div class="resume-achievements"><h5>Logros</h5>${Array.isArray(entry.logros) ? renderList(achievements) : renderParagraphs(achievements)}</div>`
        : '';
      return [
        '<div class="resume-item">',
        `<h4>${escapeHtml(entry[titleKey])}</h4>`,
        entry.periodo ? `<p class="resume-period">${escapeHtml(entry.periodo)}</p>` : '',
        `<p><em>${escapeHtml(place)}</em></p>`,
        renderList(entry[detailsKey] || entry.responsabilidades),
        achievementsBlock,
        '</div>'
      ].filter(Boolean).join('\n');
    }).join('\n');
  }

  function renderExperience(entries) {
    return renderResumeEntries(entries, 'puesto', 'empresa', 'responsabilidades');
  }

  function renderEducation(entries) {
    return renderResumeEntries(entries, 'titulo', 'centro', 'detalles');
  }

  function renderAboutDetails(profile) {
    const city = [profile.ciudad, profile.pais].filter(Boolean).join(', ');
    const item = (label, content) =>
      `<li><i class="bi bi-chevron-right" aria-hidden="true"></i> <strong>${label}:</strong> ${content}</li>`;
    const emailContent = profile.email
      ? `<a href="mailto:${escapeHtml(profile.email)}" data-portfolio-email>${escapeHtml(profile.email)}</a>`
      : '';
    return [
      '<div class="col-lg-6">',
      '<ul>',
      item('Ciudad', `<span data-portfolio-city>${escapeHtml(city)}</span>`),
      item('Disponibilidad', `<span data-portfolio-availability>${escapeHtml(profile.disponibilidad)}</span>`),
      '</ul>',
      '</div>',
      '<div class="col-lg-6">',
      '<ul>',
      item('Email', emailContent),
      '</ul>',
      '</div>'
    ].join('\n');
  }

  function shortenUrl(url, network) {
    const clean = String(url || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    return network === 'linkedin' ? clean.replace(/^linkedin\.com\//i, '') + '/' : clean;
  }

  function renderContact(contact) {
    const items = [];
    if (contact.email) {
      items.push({
        icon: 'envelope',
        title: 'Correo',
        link: `<a href="mailto:${escapeHtml(contact.email)}" data-contact-email>${escapeHtml(contact.email)}</a>`
      });
    }
    if (isSafeUrl(contact.linkedin)) {
      items.push({
        icon: 'linkedin',
        title: 'LinkedIn',
        link: `<a href="${escapeHtml(contact.linkedin)}" data-contact-linkedin target="_blank" rel="noopener noreferrer">${escapeHtml(shortenUrl(contact.linkedin, 'linkedin'))}</a>`
      });
    }
    if (isSafeUrl(contact.github)) {
      items.push({
        icon: 'github',
        title: 'GitHub',
        link: `<a href="${escapeHtml(contact.github)}" data-contact-github target="_blank" rel="noopener noreferrer">${escapeHtml(shortenUrl(contact.github, 'github'))}</a>`
      });
    }
    const columns = items.length ? Math.floor(12 / items.length) : 12;
    return items.map((item, index) => [
      `<div class="col-lg-${columns} col-md-${columns}">`,
      `<div class="info-item d-flex flex-column align-items-center text-center" data-aos="fade-up" data-aos-delay="${(index + 1) * 100}">`,
      `<i class="bi bi-${item.icon}" aria-hidden="true"></i>`,
      `<h3>${item.title}</h3>`,
      `<p>${item.link}</p>`,
      '</div>',
      '</div>'
    ].join('\n')).join('\n');
  }

  return {
    escapeHtml,
    renderProjectCards,
    renderSkills,
    renderExperience,
    renderEducation,
    renderAboutDetails,
    renderContact
  };
});
