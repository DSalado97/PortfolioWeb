/**
 * Lógica principal del portfolio: menú, tema, filtros, acordeones, animaciones
 * y fondo animado del hero. Vanilla JS; las librerías vendor son opcionales
 * (cada página carga solo las que necesita).
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  /**
   * Menú móvil (botón accesible con aria-expanded)
   */
  function initHeaderToggle() {
    const header = document.getElementById('header');
    const toggle = document.querySelector('.header-toggle');
    if (!header || !toggle) return;

    const icon = toggle.querySelector('i');

    function setMenuOpen(isOpen) {
      header.classList.toggle('header-show', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
      if (icon) {
        icon.classList.toggle('bi-list', !isOpen);
        icon.classList.toggle('bi-x', isOpen);
      }
    }

    toggle.addEventListener('click', () => {
      setMenuOpen(!header.classList.contains('header-show'));
    });

    // Cierra el menú al elegir una sección y con la tecla Escape.
    header.querySelectorAll('#navmenu a').forEach(link => {
      link.addEventListener('click', () => setMenuOpen(false));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && header.classList.contains('header-show')) {
        setMenuOpen(false);
        toggle.focus();
      }
    });
  }

  /**
   * Preloader
   */
  function initPreloader() {
    const preloader = document.getElementById('preloader');
    if (!preloader) return;
    const removePreloader = () => preloader.remove();
    if (document.readyState === 'complete') {
      removePreloader();
    } else {
      window.addEventListener('load', removePreloader);
    }
  }

  /**
   * Botón de volver arriba
   */
  function initScrollTop() {
    const scrollTop = document.getElementById('scroll-top');
    if (!scrollTop) return;

    function toggleScrollTop() {
      scrollTop.classList.toggle('active', window.scrollY > 100);
    }

    scrollTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotionQuery.matches ? 'auto' : 'smooth' });
    });
    window.addEventListener('scroll', toggleScrollTop, { passive: true });
    toggleScrollTop();
  }

  /**
   * Animaciones al hacer scroll (AOS), desactivadas con prefers-reduced-motion
   */
  function initAos() {
    if (typeof AOS === 'undefined') return;
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false,
      disable: () => reducedMotionQuery.matches
    });
  }

  /**
   * Texto animado (Typed.js)
   */
  let typedInstance = null;
  let typedItems = '';

  function initTyped() {
    const element = document.querySelector('.typed');
    if (!element || !element.dataset.typedItems || typeof Typed === 'undefined') return;
    if (typedInstance && typedItems === element.dataset.typedItems) return;

    if (typedInstance) {
      typedInstance.destroy();
      typedInstance = null;
    }
    typedItems = element.dataset.typedItems;
    const strings = typedItems.split(',').map(item => item.trim()).filter(Boolean);

    if (reducedMotionQuery.matches) {
      element.textContent = strings[0] || '';
      return;
    }
    typedInstance = new Typed(element, {
      strings,
      loop: true,
      typeSpeed: 100,
      backSpeed: 50,
      backDelay: 2000
    });
  }

  /**
   * Filtros del portafolio (Isotope)
   */
  let isotopeInstance = null;

  function initIsotope() {
    const layoutElement = document.querySelector('.isotope-layout');
    if (!layoutElement || typeof Isotope === 'undefined') return;
    const container = layoutElement.querySelector('.isotope-container');
    if (!container || !container.querySelector('.isotope-item')) return;

    if (isotopeInstance) {
      isotopeInstance.destroy();
    }
    const activeButton = layoutElement.querySelector('.isotope-filters .filter-active');
    isotopeInstance = new Isotope(container, {
      itemSelector: '.isotope-item',
      layoutMode: layoutElement.dataset.layout || 'masonry',
      filter: activeButton ? activeButton.dataset.filter : (layoutElement.dataset.defaultFilter || '*'),
      sortBy: layoutElement.dataset.sort || 'original-order'
    });

    // Las miniaturas llevan width/height, así que el masonry conoce sus proporciones
    // sin esperar a que se descarguen (y las imágenes siguen cargándose en diferido).
  }

  function initPortfolioFilters() {
    const layoutElement = document.querySelector('.isotope-layout');
    if (!layoutElement) return;

    layoutElement.addEventListener('click', event => {
      const button = event.target.closest('.isotope-filters [data-filter]');
      if (!button) return;

      layoutElement.querySelectorAll('.isotope-filters [data-filter]').forEach(item => {
        const isActive = item === button;
        item.classList.toggle('filter-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      if (isotopeInstance) {
        isotopeInstance.arrange({ filter: button.dataset.filter });
      }
      if (typeof AOS !== 'undefined') {
        AOS.refresh();
      }
    });

    initIsotope();
  }

  /**
   * Acordeones de tecnologías (delegación de eventos: también vale para el contenido renderizado)
   */
  function initAccordions() {
    document.addEventListener('click', event => {
      const button = event.target.closest('.toggle-button');
      if (!button) return;
      const item = button.closest('.skills-item');
      if (!item) return;
      const isActive = item.classList.toggle('active');
      button.setAttribute('aria-expanded', String(isActive));
    });
  }

  /**
   * Vídeos de proyecto: con prefers-reduced-motion se pausan y se muestran los controles
   */
  function initProjectVideos() {
    document.querySelectorAll('.project-video').forEach(video => {
      if (reducedMotionQuery.matches) {
        video.pause();
        video.removeAttribute('autoplay');
        video.controls = true;
      }
    });
  }

  /**
   * Scroll a la sección indicada en la URL al cargar
   */
  function initHashScroll() {
    window.addEventListener('load', () => {
      if (!window.location.hash) return;
      const section = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!section) return;
      setTimeout(() => {
        const scrollMarginTop = parseInt(getComputedStyle(section).scrollMarginTop, 10) || 0;
        window.scrollTo({
          top: section.offsetTop - scrollMarginTop,
          behavior: reducedMotionQuery.matches ? 'auto' : 'smooth'
        });
      }, 100);
    });
  }

  /**
   * Menú lateral: resalta la sección visible (IntersectionObserver)
   */
  function initScrollspy() {
    if (!('IntersectionObserver' in window)) return;
    const links = [...document.querySelectorAll('.navmenu a')]
      .filter(link => link.hash && link.pathname === window.location.pathname);
    const entries = links
      .map(link => ({ link, section: document.getElementById(link.hash.slice(1)) }))
      .filter(entry => entry.section);
    if (!entries.length) return;

    const observer = new IntersectionObserver(observed => {
      observed.forEach(observation => {
        if (!observation.isIntersecting) return;
        document.querySelectorAll('.navmenu a.active').forEach(link => link.classList.remove('active'));
        const match = entries.find(entry => entry.section === observation.target);
        if (match) match.link.classList.add('active');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    entries.forEach(entry => observer.observe(entry.section));
  }

  /**
   * Modo claro / oscuro. La clase inicial la pone el script inline del <head>
   * (preferencia guardada o prefers-color-scheme) para evitar el parpadeo.
   */
  function initTheme() {
    const button = document.getElementById('toggle-theme');
    const icon = button ? button.querySelector('i') : null;
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    function getSavedTheme() {
      try {
        return localStorage.getItem('theme');
      } catch (error) {
        return null;
      }
    }

    function applyTheme(theme) {
      const isDark = theme === 'dark';
      root.classList.toggle('dark-background', isDark);
      root.classList.toggle('light-background', !isDark);
      if (button) {
        button.setAttribute('aria-pressed', String(isDark));
      }
      if (icon) {
        icon.classList.toggle('bi-sun', isDark);
        icon.classList.toggle('bi-moon', !isDark);
      }
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    }

    applyTheme(root.classList.contains('dark-background') ? 'dark' : 'light');

    if (button) {
      button.addEventListener('click', () => {
        const nextTheme = root.classList.contains('dark-background') ? 'light' : 'dark';
        applyTheme(nextTheme);
        try {
          localStorage.setItem('theme', nextTheme);
        } catch (error) {
          // Sin almacenamiento disponible: el cambio solo dura esta visita.
        }
      });
    }

    // Sin preferencia guardada, se sigue el cambio del sistema.
    colorSchemeQuery.addEventListener('change', event => {
      if (!getSavedTheme()) {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Fondo del hero: pantalla llena de 0 y 1 que cambian al azar.
   * hero-bg.jpg solo es una máscara: los píxeles oscuros son tierra (dígitos
   * claros) y los claros son mar (dígitos oscuros). En pantallas pequeñas se
   * usa una lluvia de dígitos. La animación se pausa cuando el hero no está
   * visible o la pestaña está en segundo plano, y se desactiva con
   * prefers-reduced-motion.
   */
  function initHeroCanvas() {
    const heroCanvas = document.getElementById('hero-canvas');
    const hero = document.querySelector('.hero');
    if (!heroCanvas || !hero) return;

    const ctx = heroCanvas.getContext('2d');
    const FONT_SIZE = 18;
    const FONT = `bold ${FONT_SIZE}px Consolas, "Courier New", monospace`;
    const MOBILE_BREAKPOINT = 768;
    const DESKTOP_INTERVAL = 250;
    const MOBILE_INTERVAL = 80;
    const MASK_SOURCE = 'assets/img/hero-bg.jpg';
    const PALETTES = {
      dark: { background: '#000000', land: '#ffffff', sea: '#4a4a4a', fade: 'rgba(0, 0, 0, 0.16)' },
      // Modo claro: dígitos suavizados para que el título y los iconos resalten.
      light: { background: '#ffffff', land: '#6e6e6e', sea: '#bcbcbc', fade: 'rgba(255, 255, 255, 0.16)' }
    };

    let mask = null;          // { data, width, height } leído una sola vez
    let cells = [];           // [{ x, y, char, isLand, nextFlip }]
    let rainDrops = [];
    let charWidth = 0;
    let frameId = null;
    let lastFrame = 0;
    let heroVisible = true;
    let resizeTimer = null;

    const isMobileScreen = () => window.innerWidth < MOBILE_BREAKPOINT;
    const getPalette = () => (root.classList.contains('dark-background') ? PALETTES.dark : PALETTES.light);
    const randomBit = () => (Math.random() < 0.5 ? '0' : '1');
    const nextFlipTime = now => now + 1000 + Math.random() * 4000;

    function measureFont() {
      ctx.font = FONT;
      ctx.textBaseline = 'top';
      charWidth = ctx.measureText('0').width;
    }

    function buildCells() {
      const columns = Math.floor(heroCanvas.width / charWidth);
      const rows = Math.floor(heroCanvas.height / FONT_SIZE);
      const now = performance.now();
      cells = [];

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < columns; col++) {
          let isLand = false;
          if (mask) {
            const ix = Math.floor((col / columns) * mask.width);
            const iy = Math.floor((row / rows) * mask.height);
            const index = (iy * mask.width + ix) * 4;
            isLand = (mask.data[index] + mask.data[index + 1] + mask.data[index + 2]) / 3 < 128;
          }
          cells.push({ x: col * charWidth, y: row * FONT_SIZE, char: randomBit(), isLand, nextFlip: nextFlipTime(now) });
        }
      }
    }

    function buildRain() {
      const columns = Math.ceil(heroCanvas.width / charWidth);
      const rows = Math.ceil(heroCanvas.height / FONT_SIZE);
      rainDrops = Array.from({ length: columns }, () => Math.random() * rows);
      ctx.fillStyle = getPalette().background;
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
    }

    function renderMap() {
      const palette = getPalette();
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      ctx.font = FONT;
      ctx.textBaseline = 'top';
      cells.forEach(cell => {
        ctx.fillStyle = cell.isLand ? palette.land : palette.sea;
        ctx.fillText(cell.char, cell.x, cell.y);
      });
    }

    function renderRain() {
      const palette = getPalette();
      // Un relleno translúcido deja una estela suave en vez de repintar cada columna.
      ctx.fillStyle = palette.fade;
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      ctx.font = FONT;
      ctx.textBaseline = 'top';
      ctx.fillStyle = palette.land;

      rainDrops.forEach((drop, col) => {
        const y = drop * FONT_SIZE;
        ctx.fillText(randomBit(), col * charWidth, y);
        rainDrops[col] += 0.55 + Math.random() * 0.35;
        if (y > heroCanvas.height && Math.random() > 0.96) {
          rainDrops[col] = -Math.random() * 20;
        }
      });
    }

    function updateMap(now) {
      let changed = false;
      cells.forEach(cell => {
        if (now >= cell.nextFlip) {
          cell.char = cell.char === '0' ? '1' : '0';
          cell.nextFlip = nextFlipTime(now);
          changed = true;
        }
      });
      if (changed) renderMap();
    }

    function drawStaticFrame() {
      if (isMobileScreen()) {
        buildRain();
        for (let step = 0; step < 40; step++) renderRain();
      } else {
        renderMap();
      }
    }

    function loop(now) {
      frameId = requestAnimationFrame(loop);
      const interval = isMobileScreen() ? MOBILE_INTERVAL : DESKTOP_INTERVAL;
      if (now - lastFrame < interval) return;
      lastFrame = now;
      if (isMobileScreen()) {
        renderRain();
      } else {
        updateMap(now);
      }
    }

    function updateAnimationState() {
      const shouldRun = heroVisible && !document.hidden && !reducedMotionQuery.matches;
      if (shouldRun && frameId === null) {
        frameId = requestAnimationFrame(loop);
      } else if (!shouldRun && frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    }

    function rebuild() {
      heroCanvas.width = hero.offsetWidth;
      heroCanvas.height = hero.offsetHeight;
      measureFont();
      if (!isMobileScreen()) {
        buildCells();
      }
      drawStaticFrame();
      updateAnimationState();
    }

    function loadMask(callback) {
      const image = new Image();
      image.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = image.width;
        offscreen.height = image.height;
        const offscreenContext = offscreen.getContext('2d');
        offscreenContext.drawImage(image, 0, 0);
        try {
          mask = { data: offscreenContext.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height };
        } catch (error) {
          mask = null;
        }
        callback();
      };
      // Sin máscara se dibuja el patrón de "mar" en toda la pantalla.
      image.onerror = callback;
      image.src = MASK_SOURCE;
    }

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 150);
    });
    document.addEventListener('visibilitychange', updateAnimationState);
    document.addEventListener('themechange', drawStaticFrame);
    reducedMotionQuery.addEventListener('change', () => {
      drawStaticFrame();
      updateAnimationState();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        updateAnimationState();
      }).observe(hero);
    }

    loadMask(rebuild);
  }

  /**
   * Inicialización
   */
  initHeaderToggle();
  initPreloader();
  initScrollTop();
  initTheme();
  initAccordions();
  initProjectVideos();
  initHashScroll();
  initScrollspy();
  initPortfolioFilters();
  initTyped();
  initHeroCanvas();
  window.addEventListener('load', initAos);

  // Si el snapshot cambia el contenido en el cliente, se reinician filtros y texto animado.
  document.addEventListener('portfolio:rendered', () => {
    initIsotope();
    initTyped();
  });
})();
