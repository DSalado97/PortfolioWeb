(function () {
  "use strict";

  /**
   * Header toggle
   */
  const headerToggleBtn = document.querySelector('.header-toggle');

  function headerToggle() {
    document.querySelector('#header').classList.toggle('header-show');
    headerToggleBtn.classList.toggle('bi-list');
    headerToggleBtn.classList.toggle('bi-x');
  }
  headerToggleBtn.addEventListener('click', headerToggle);

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', () => {
      if (document.querySelector('.header-show')) {
        headerToggle();
      }
    });

  });

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function (e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      e.stopImmediatePropagation();
    });
  });

  /**
   * Preloader
   */
  const preloader = document.querySelector('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.remove();
    });
  }

  /**
   * Scroll top button
   */
  let scrollTop = document.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  scrollTop.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  window.addEventListener('load', toggleScrollTop);
  document.addEventListener('scroll', toggleScrollTop);

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', aosInit);

  /**
   * Init typed.js
   */
  function initTyped() {
    const selectTyped = document.querySelector('.typed');
    if (!selectTyped || !selectTyped.dataset.typedItems || selectTyped.dataset.typedInitialized) return;
    if (selectTyped.hasAttribute('data-portfolio-roles') && !document.body.dataset.portfolioDataState) return;
    const typedStrings = selectTyped.dataset.typedItems.split(',');
    new Typed('.typed', {
      strings: typedStrings,
      loop: true,
      typeSpeed: 100,
      backSpeed: 50,
      backDelay: 2000
    });
    selectTyped.dataset.typedInitialized = 'true';
  }
  initTyped();
  document.addEventListener('portfolio:data-loaded', initTyped);
  document.addEventListener('portfolio:data-error', initTyped);

  /**
   * Initiate Pure Counter
   */
  new PureCounter();

  /**
   * Animate the skills items on reveal
   */
  let skillsAnimation = document.querySelectorAll('.skills-animation');
  skillsAnimation.forEach((item) => {
    new Waypoint({
      element: item,
      offset: '80%',
      handler: function (direction) {
        let progress = item.querySelectorAll('.progress .progress-bar');
        progress.forEach(el => {
          el.style.width = el.getAttribute('aria-valuenow') + '%';
        });
      }
    });
  });

  /**
   * Initiate glightbox
   */
  const glightbox = GLightbox({
    selector: '.glightbox'
  });

  /**
   * Init isotope layout and filters
   */
  function initIsotopeLayouts() {
    document.querySelectorAll('.isotope-layout').forEach(function (isotopeItem) {
      if (!isotopeItem.querySelector('.isotope-item')) return;
      if (isotopeItem.querySelector('[data-portfolio-projects]') && !document.body.dataset.portfolioDataState) return;
    let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
    let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
    let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

    let initIsotope;
    imagesLoaded(isotopeItem.querySelector('.isotope-container'), function () {
      initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
        itemSelector: '.isotope-item',
        layoutMode: layout,
        filter: filter,
        sortBy: sort
      });
    });

    isotopeItem.querySelectorAll('.isotope-filters li').forEach(function (filters) {
      filters.addEventListener('click', function () {
        isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
        this.classList.add('filter-active');
        initIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        if (typeof aosInit === 'function') {
          aosInit();
        }
      }, false);
    });

    });
  }
  initIsotopeLayouts();
  document.addEventListener('portfolio:data-loaded', initIsotopeLayouts);
  document.addEventListener('portfolio:data-error', initIsotopeLayouts);

  /**
   * Init swiper sliders
   */
  function initSwiper() {
    document.querySelectorAll(".init-swiper").forEach(function (swiperElement) {
      const swiperConfig = swiperElement.querySelector(".swiper-config");
      if (!swiperConfig) return;
      let config = JSON.parse(
        swiperConfig.innerHTML.trim()
      );

      if (swiperElement.classList.contains("swiper-tab")) {
        initSwiperWithCustomPagination(swiperElement, config);
      } else {
        new Swiper(swiperElement, config);
      }
    });
  }

  window.addEventListener("load", initSwiper);

  /**
   * Correct scrolling position upon page load for URLs containing hash links.
   */
  window.addEventListener('load', function (e) {
    if (window.location.hash) {
      if (document.querySelector(window.location.hash)) {
        setTimeout(() => {
          let section = document.querySelector(window.location.hash);
          let scrollMarginTop = getComputedStyle(section).scrollMarginTop;
          window.scrollTo({
            top: section.offsetTop - parseInt(scrollMarginTop),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  });

  /**
   * Navmenu Scrollspy
   */
  let navmenulinks = document.querySelectorAll('.navmenu a');

  function navmenuScrollspy() {
    navmenulinks.forEach(navmenulink => {
      if (!navmenulink.hash) return;
      let section = document.querySelector(navmenulink.hash);
      if (!section) return;
      let position = window.scrollY + 200;
      if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
        document.querySelectorAll('.navmenu a.active').forEach(link => link.classList.remove('active'));
        navmenulink.classList.add('active');
      } else {
        navmenulink.classList.remove('active');
      }
    })
  }
  window.addEventListener('load', navmenuScrollspy);
  document.addEventListener('scroll', navmenuScrollspy);

  /*
    Calcular Edad
  */
  function calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  const edadElement = document.getElementById("edad");
  if (edadElement) {
    edadElement.textContent = calcularEdad("1997-10-25");
  }



  /* 
    Modo Oscuro
  */
  function toggleTheme(forceTheme = null) {
    const body = document.body;
    const icon = document.querySelector("#toggle-theme i");
    const span = document.querySelector("#toggle-theme span");

    let isDark = body.classList.contains("dark-background");

    if (forceTheme !== null) {
      isDark = forceTheme === "dark";
    } else {
      isDark = !isDark;
    }

    if (isDark) {
      body.classList.add("dark-background");
      body.classList.remove("light-background");
      icon.classList.remove("bi-moon");
      icon.classList.add("bi-sun");
      span.textContent = "Modo claro";
      localStorage.setItem("theme", "dark");
    } else {
      body.classList.add("light-background");
      body.classList.remove("dark-background");
      icon.classList.remove("bi-sun");
      icon.classList.add("bi-moon");
      span.textContent = "Modo oscuro";
      localStorage.setItem("theme", "light");
    }

  }

  window.onload = () => {
    const toggleThemeButton = document.getElementById("toggle-theme");
    if (toggleThemeButton) {
      toggleThemeButton.addEventListener("click", function (event) {
        event.preventDefault();
        toggleTheme();
      });
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    toggleTheme(savedTheme);
  };

  document.querySelectorAll('.toggle-title').forEach(title => {
    title.addEventListener('click', () => {
      const item = title.closest('.skills-item');
      item.classList.toggle('active');
    });
  });

  /**
   * Portfolio hover: swap static image with animated GIF preview
   */
  document.querySelectorAll('.portfolio-item img[data-gif]').forEach(img => {
    const staticSrc = img.src;
    const gifSrc = img.getAttribute('data-gif');
    img.addEventListener('mouseenter', () => { img.src = gifSrc; });
    img.addEventListener('mouseleave', () => { img.src = staticSrc; });
  });

  /**
   * Hero canvas: a full screen of 0s and 1s that randomly flip.
   * hero-bg.jpg is only a mask: dark pixels are land (white digits),
   * light pixels are sea (dark digits).
   */
  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) {
    const ctx = heroCanvas.getContext('2d');
    // Personalisation: change these three values to tune the digit style.
    const FONT_SIZE = 18;
    const FONT_WEIGHT = 'bold';
    const FONT_FAMILY = 'Consolas, "Courier New", monospace';
    const FONT = FONT_WEIGHT + ' ' + FONT_SIZE + 'px ' + FONT_FAMILY;
    const MOBILE_BREAKPOINT = 768;
    const LAND_CHAR_COLOR = '#ffffff';
    const SEA_CHAR_COLOR = '#4a4a4a';
    const BACKGROUND_COLOR = '#000000';
    const LIGHT_LAND_CHAR_COLOR = '#111111';
    const LIGHT_SEA_CHAR_COLOR = '#747474';
    const LIGHT_BACKGROUND_COLOR = '#ffffff';
    // A file:// page cannot read pixels from an external image in a canvas.
    // Keep a local copy of the mask only for that case so double-clicking
    // index.html works just like a page served by a local web server.
    const HERO_MASK_SOURCE = window.location.protocol === 'file:'
      ? 'data:image/jpeg;base64,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'
      : 'assets/img/hero-bg.jpg';

    let cells = [];          // [{x, y, char, isLand, nextFlip}, ...]
    let charWidth = 0;       // measured, never assumed
    let animId = null;
    let rainDrops = [];

    function measureFont() {
      ctx.font = FONT;
      ctx.textBaseline = 'top';
      charWidth = ctx.measureText('0').width;
    }

    function isMobileScreen() {
      return window.innerWidth < MOBILE_BREAKPOINT;
    }

    function buildMatrix() {
      if (isMobileScreen()) {
        buildRain();
        return;
      }

      const img = new Image();
      img.onload = function () {
        if (isMobileScreen()) {
          buildRain();
          return;
        }
        // Draw mask to offscreen canvas to read pixel data
        const off = document.createElement('canvas');
        const oCtx = off.getContext('2d');
        off.width = img.width;
        off.height = img.height;
        oCtx.drawImage(img, 0, 0);

        // Get the full pixel buffer once
        const imageData = oCtx.getImageData(0, 0, off.width, off.height).data;

        const cols = Math.floor(heroCanvas.width / charWidth);
        const rows = Math.floor(heroCanvas.height / FONT_SIZE);

        cells = [];

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            // Map grid position to image position
            const ix = Math.floor((col / cols) * img.width);
            const iy = Math.floor((row / rows) * img.height);
            const idx = (iy * img.width + ix) * 4; // RGBA stride
            const r = imageData[idx];
            const g = imageData[idx + 1];
            const b = imageData[idx + 2];
            const brightness = (r + g + b) / 3;

            // The grid always covers the whole hero. The mask only decides
            // whether this digit belongs to bright land or dark sea.
            cells.push({
              x: col * charWidth,
              y: row * FONT_SIZE,
              char: Math.random() < 0.5 ? '0' : '1',
              isLand: brightness < 128,
              nextFlip: performance.now() + 1000 + Math.random() * 4000
            });
          }
        }

        render();
        startAnimation();
      };
      img.onerror = function () {
        // Fallback: render the dark sea pattern across the whole canvas.
        const cols = Math.floor(heroCanvas.width / charWidth);
        const rows = Math.floor(heroCanvas.height / FONT_SIZE);
        cells = [];

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            cells.push({
              x: col * charWidth,
              y: row * FONT_SIZE,
              char: Math.random() < 0.5 ? '0' : '1',
              isLand: false,
              nextFlip: performance.now() + 1000 + Math.random() * 4000
            });
          }
        }
        render();
        startAnimation();
      };
      img.src = HERO_MASK_SOURCE;
    }

    function getPalette() {
      const isDarkTheme = document.body.classList.contains('dark-background');
      return isDarkTheme
        ? {
          background: BACKGROUND_COLOR,
          land: LAND_CHAR_COLOR,
          sea: SEA_CHAR_COLOR
        }
        : {
          background: LIGHT_BACKGROUND_COLOR,
          land: LIGHT_LAND_CHAR_COLOR,
          sea: LIGHT_SEA_CHAR_COLOR
        };
    }

    function render() {
      if (isMobileScreen()) {
        renderRain();
        return;
      }

      const palette = getPalette();

      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      ctx.font = FONT;
      ctx.textBaseline = 'top';
      for (let i = 0; i < cells.length; i++) {
        ctx.fillStyle = cells[i].isLand ? palette.land : palette.sea;
        ctx.fillText(cells[i].char, cells[i].x, cells[i].y);
      }
    }

    function buildRain() {
      const columns = Math.ceil(heroCanvas.width / charWidth);
      const rows = Math.ceil(heroCanvas.height / FONT_SIZE);
      rainDrops = Array.from({ length: columns }, () => Math.random() * rows);
      ctx.fillStyle = getPalette().background;
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      startAnimation();
    }

    function renderRain() {
      const palette = getPalette();
      const isDarkTheme = document.body.classList.contains('dark-background');

      // A translucent fill retains a soft trail rather than redrawing every
      // column from scratch on every frame.
      ctx.fillStyle = isDarkTheme ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.16)';
      ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      ctx.font = FONT;
      ctx.textBaseline = 'top';
      ctx.fillStyle = palette.land;

      for (let col = 0; col < rainDrops.length; col++) {
        const y = rainDrops[col] * FONT_SIZE;
        ctx.fillText(Math.random() < 0.5 ? '0' : '1', col * charWidth, y);
        rainDrops[col] += 0.55 + Math.random() * 0.35;

        if (y > heroCanvas.height && Math.random() > 0.96) {
          rainDrops[col] = -Math.random() * 20;
        }
      }
    }

    function updateMap() {
      const timestamp = performance.now();
      let dirty = false;
      for (let i = 0; i < cells.length; i++) {
        if (timestamp >= cells[i].nextFlip) {
          cells[i].char = cells[i].char === '0' ? '1' : '0';
          cells[i].nextFlip = timestamp + 1000 + Math.random() * 4000;
          dirty = true;
        }
      }
      if (dirty) render();
    }

    function startAnimation() {
      if (animId) clearInterval(animId);
      animId = setInterval(isMobileScreen() ? renderRain : updateMap, isMobileScreen() ? 80 : 250);
    }

    function resizeHeroCanvas() {
      const hero = document.querySelector('.hero');
      if (!hero) return;
      heroCanvas.width = hero.offsetWidth;
      heroCanvas.height = hero.offsetHeight;
      measureFont();
      buildMatrix();
    }

    window.addEventListener('resize', resizeHeroCanvas);
    new MutationObserver(() => {
      if (isMobileScreen()) {
        ctx.fillStyle = getPalette().background;
        ctx.fillRect(0, 0, heroCanvas.width, heroCanvas.height);
      } else {
        render();
      }
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    resizeHeroCanvas();
  }

})();
