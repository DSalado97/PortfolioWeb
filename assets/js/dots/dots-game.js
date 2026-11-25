/**
 * Dots: bucle de juego, controles, paneles y pantalla completa.
 * Lo usan la página del proyecto y la versión descargable.
 */
(function () {
  'use strict';

  const RECORD_KEY = 'dots-record';
  const MUTED_KEY = 'dots-silencio';
  const SECRET = 'daniel';
  const DIRECTION_KEYS = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0]
  };

  function initDots() {
    const stage = document.getElementById('dots-game');
    if (!stage || !window.DotsCore || !window.DotsRender || !window.DotsAudio) return;

    const { CONFIG, STEP, clamp, createGame } = window.DotsCore;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const find = id => document.getElementById(id);

    const canvas = find('dots-canvas');
    const panel = find('dots-panel');
    const panelTitle = find('dots-panel-title');
    const panelText = find('dots-panel-text');
    const panelStats = find('dots-panel-stats');
    const primaryButton = find('dots-primary');
    const restartButton = find('dots-restart');
    const pauseButton = find('dots-pause');
    const soundButton = find('dots-sound');
    const fullscreenButton = find('dots-fullscreen');
    const toast = find('dots-toast');
    const hudTime = find('dots-time');
    const hudEaten = find('dots-eaten');
    const hudFilled = find('dots-filled');
    const hudBar = find('dots-bar');
    const combo = find('dots-combo');
    const comboCount = find('dots-combo-count');
    const comboBar = find('dots-combo-bar');

    const renderer = window.DotsRender.createRenderer(canvas, {
      reducedMotion: () => reducedMotionQuery.matches
    });

    const audio = window.DotsAudio.createAudio();

    // Estados: menu, playing, paused, ended.
    let state = 'menu';
    let game = createGame({ demo: true });
    let endTimer = 0;
    let accumulator = 0;
    let lastFrame = 0;
    let frameRequest = 0;
    let maxRatio = 2;
    let slowFrames = 0;
    let stageVisible = true;
    let lastFullscreenChange = -1000;
    let toastTimer = 0;
    let shownCombo = 0;
    let muted = readMuted();
    let typed = '';
    let skinRequested = false;

    const pointer = { active: false, x: 0, y: 0 };
    const touch = { id: null, anchorX: 0, anchorY: 0, x: 0, y: 0 };
    const keys = new Set();

    /* --- Textos --- */

    function formatTime(seconds) {
      const total = Math.floor(seconds);
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    }

    function formatFilled(value) {
      const percent = value * 100;
      return `${percent.toLocaleString('es-ES', { maximumFractionDigits: percent < 10 ? 1 : 0 })} %`;
    }

    function showToast(message, seconds) {
      toast.textContent = message;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), seconds * 1000);
    }

    /* --- Sonido --- */

    function readMuted() {
      try {
        return localStorage.getItem(MUTED_KEY) === '1';
      } catch (error) {
        return false;
      }
    }

    function applyMuted() {
      const label = muted ? 'Activar sonido' : 'Silenciar';
      stage.classList.toggle('is-muted', muted);
      soundButton.setAttribute('aria-label', label);
      soundButton.title = `${label} (M)`;
      audio.setMuted(muted);
    }

    function toggleMuted() {
      muted = !muted;
      try {
        localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
      } catch (error) {
        // Sin almacenamiento disponible: la preferencia solo dura esta visita.
      }
      applyMuted();
    }

    /* --- Skin secreta --- */

    // Recuerda las últimas letras pulsadas, sin tocar los controles (A y D también mueven).
    function watchSecret(event) {
      if (event.repeat || !/^[a-z]$/i.test(event.key)) return;
      typed = (typed + event.key.toLowerCase()).slice(-SECRET.length);
      if (typed === SECRET) loadSkin();
    }

    // La imagen solo se descarga al descubrirla.
    function loadSkin() {
      if (skinRequested || !stage.dataset.skin) return;
      skinRequested = true;
      const image = new Image();
      image.addEventListener('load', () => renderer.setSkin(image));
      image.addEventListener('error', () => {
        skinRequested = false;
      });
      image.src = stage.dataset.skin;
    }

    /* --- Récord --- */

    function readRecord() {
      try {
        return JSON.parse(localStorage.getItem(RECORD_KEY));
      } catch (error) {
        return null;
      }
    }

    function isBetter(result, record) {
      if (!record) return true;
      if (result.won !== record.won) return result.won;
      return result.won ? result.time < record.time : result.filled > record.filled;
    }

    function saveRecord(result) {
      const record = readRecord();
      if (!isBetter(result, record)) return false;
      try {
        localStorage.setItem(RECORD_KEY, JSON.stringify(result));
      } catch (error) {
        // Sin almacenamiento disponible: el récord no se guarda.
      }
      return true;
    }

    function describeRecord(record) {
      return record.won
        ? `arena completa en ${formatTime(record.time)}`
        : `${formatFilled(record.filled)} de la arena`;
    }

    /* --- Paneles --- */

    function setState(next) {
      state = next;
      stage.dataset.state = next;
      pauseButton.hidden = next !== 'playing';
    }

    function showPanel({ title, text, primary, restart, stats }) {
      panelTitle.textContent = title;
      panelText.textContent = text;
      primaryButton.textContent = primary;
      restartButton.hidden = !restart;
      panelStats.replaceChildren();
      (stats || []).forEach(([label, value]) => {
        const item = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value;
        item.append(term, detail);
        panelStats.append(item);
      });
      panelStats.hidden = !stats;
      panel.hidden = false;
      primaryButton.focus({ preventScroll: true });
    }

    function hidePanel() {
      panel.hidden = true;
      canvas.focus({ preventScroll: true });
    }

    function startGame() {
      audio.unlock();
      game = createGame({ aspect: stage.clientWidth / Math.max(1, stage.clientHeight) });
      game.setAspect(stage.clientWidth / Math.max(1, stage.clientHeight));
      renderer.clearEffects();
      clearTimeout(endTimer);
      endTimer = 0;
      typed = '';
      accumulator = 0;
      keys.clear();
      touch.id = null;
      pointer.active = false;
      setState('playing');
      hidePanel();
      updateHud();
      requestFrame();
    }

    function pauseGame() {
      if (state !== 'playing' || game.state !== 'playing') return;
      setState('paused');
      keys.clear();
      touch.id = null;
      showPanel({
        title: 'Pausa',
        text: 'Pulsa Esc para seguir jugando.',
        primary: 'Continuar',
        restart: true
      });
    }

    function resumeGame() {
      audio.unlock();
      setState('playing');
      hidePanel();
      requestFrame();
    }

    function finishGame() {
      const won = game.state === 'won';
      const result = { won, time: game.endTime, filled: won ? 1 : game.lastFilled, eaten: game.eaten };
      const isRecord = saveRecord(result);
      const record = readRecord();
      setState('ended');
      showPanel({
        title: won ? '¡Has llenado la arena!' : 'Te han comido',
        text: isRecord
          ? '¡Nuevo récord!'
          : (record ? `Tu récord: ${describeRecord(record)}.` : 'Inténtalo otra vez.'),
        primary: 'Jugar otra vez',
        restart: false,
        stats: [
          ['Tiempo', formatTime(result.time)],
          ['Comidos', String(result.eaten)],
          ['Mejor combo', `×${game.bestCombo}`],
          ['Arena', formatFilled(result.filled)]
        ]
      });
    }

    function handlePrimary() {
      if (state === 'paused') resumeGame();
      else if (state !== 'playing') startGame();
    }

    /* --- Controles --- */

    function getInput() {
      let x = 0;
      let y = 0;
      keys.forEach(code => {
        x += DIRECTION_KEYS[code][0];
        y += DIRECTION_KEYS[code][1];
      });
      if (x || y) {
        const length = Math.hypot(x, y);
        return { x: x / length, y: y / length };
      }
      if (touch.id !== null) {
        const dx = touch.x - touch.anchorX;
        const dy = touch.y - touch.anchorY;
        const length = Math.hypot(dx, dy);
        if (length < 6) return { x: 0, y: 0 };
        const strength = Math.min(1, length / 55) / length;
        return { x: dx * strength, y: dy * strength };
      }
      if (!pointer.active) return { x: 0, y: 0 };
      // El punto va hacia el cursor y frena al llegar.
      const { camera, player } = game;
      const scale = stage.clientHeight / (2 * camera.halfHeight);
      const dx = pointer.x - (stage.clientWidth / 2 + (player.x - camera.x) * scale);
      const dy = pointer.y - (stage.clientHeight / 2 + (player.y - camera.y) * scale);
      const length = Math.hypot(dx, dy);
      if (length < 3) return { x: 0, y: 0 };
      const reach = Math.min(stage.clientWidth, stage.clientHeight) * 0.16;
      const strength = Math.min(1, length / reach) / length;
      return { x: dx * strength, y: dy * strength };
    }

    function updatePointer(event) {
      const bounds = stage.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
    }

    function initControls() {
      window.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') {
          if (event.pointerId !== touch.id) return;
          touch.x = event.clientX;
          touch.y = event.clientY;
          // El ancla sigue al dedo para poder cambiar de sentido al momento.
          const dx = touch.x - touch.anchorX;
          const dy = touch.y - touch.anchorY;
          const length = Math.hypot(dx, dy);
          if (length > 70) {
            touch.anchorX += dx * (1 - 70 / length);
            touch.anchorY += dy * (1 - 70 / length);
          }
          return;
        }
        if (state !== 'playing') return;
        keys.clear();
        pointer.active = true;
        updatePointer(event);
      }, { passive: true });

      canvas.addEventListener('pointerdown', event => {
        if (state !== 'playing' || event.pointerType !== 'touch' || touch.id !== null) return;
        event.preventDefault();
        touch.id = event.pointerId;
        touch.anchorX = touch.x = event.clientX;
        touch.anchorY = touch.y = event.clientY;
      });
      ['pointerup', 'pointercancel'].forEach(type => {
        window.addEventListener(type, event => {
          if (event.pointerId === touch.id) touch.id = null;
        });
      });
      canvas.addEventListener('contextmenu', event => {
        if (state === 'playing') event.preventDefault();
      });

      document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (state === 'playing') watchSecret(event);
        if (event.key === 'F11' && document.fullscreenElement === stage) {
          event.preventDefault();
          document.exitFullscreen();
          return;
        }
        if (event.key === 'Escape' && !event.repeat) {
          // Si el navegador usa Esc para salir de pantalla completa, ya ha pausado.
          if (performance.now() - lastFullscreenChange < 400) return;
          if (state === 'playing') {
            event.preventDefault();
            pauseGame();
          } else if (state === 'paused') {
            event.preventDefault();
            resumeGame();
          }
          return;
        }
        if (event.code === 'KeyM' && !event.repeat && (state === 'playing' || state === 'paused')) {
          toggleMuted();
          return;
        }
        if (state !== 'playing') return;
        if (DIRECTION_KEYS[event.code]) {
          event.preventDefault();
          pointer.active = false;
          keys.add(event.code);
        } else if (event.code === 'Space' && event.target === canvas) {
          event.preventDefault();
        }
      });
      document.addEventListener('keyup', event => keys.delete(event.code));

      primaryButton.addEventListener('click', handlePrimary);
      restartButton.addEventListener('click', startGame);
      pauseButton.addEventListener('click', pauseGame);
      soundButton.addEventListener('click', () => {
        toggleMuted();
        if (state === 'playing') canvas.focus({ preventScroll: true });
      });
    }

    /* --- Pantalla completa --- */

    function initFullscreen() {
      if (!document.fullscreenEnabled || !stage.requestFullscreen) {
        fullscreenButton.hidden = true;
        return;
      }

      fullscreenButton.addEventListener('click', () => {
        if (document.fullscreenElement === stage) {
          document.exitFullscreen();
          return;
        }
        stage.requestFullscreen().then(() => {
          // Chrome y Edge: permite que Esc siga siendo la tecla de pausa.
          if (navigator.keyboard && navigator.keyboard.lock) {
            navigator.keyboard.lock(['Escape']).catch(() => {});
          }
        }).catch(() => showToast('El navegador no permite la pantalla completa.', 4));
        if (state === 'playing') canvas.focus({ preventScroll: true });
      });

      document.addEventListener('fullscreenchange', () => {
        lastFullscreenChange = performance.now();
        const isFullscreen = document.fullscreenElement === stage;
        const label = isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
        stage.classList.toggle('is-fullscreen', isFullscreen);
        fullscreenButton.setAttribute('aria-label', label);
        fullscreenButton.title = label;
        if (isFullscreen) {
          showToast(coarsePointerQuery.matches
            ? 'Toca de nuevo el botón para volver a pantalla normal'
            : 'Pulsa F11 para volver a pantalla normal', 5);
        } else {
          toast.classList.remove('is-visible');
          if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
          pauseGame();
        }
      });
    }

    /* --- Bucle --- */

    function updateHud() {
      const filled = game.state === 'won' ? 1 : game.lastFilled || 0;
      hudTime.textContent = formatTime(game.endTime || game.time);
      hudEaten.textContent = String(game.eaten);
      hudFilled.textContent = formatFilled(filled);
      hudBar.style.transform = `scaleX(${filled})`;
      updateCombo();
    }

    // El contador aparece con la segunda pompa seguida; la barra marca lo que queda.
    function updateCombo() {
      const active = game.state === 'playing' && game.combo > 1;
      combo.classList.toggle('is-visible', active);
      if (!active) {
        shownCombo = 0;
        return;
      }
      comboBar.style.transform = `scaleX(${clamp(game.comboTime / CONFIG.comboWindow, 0, 1)})`;
      if (game.combo === shownCombo) return;
      shownCombo = game.combo;
      comboCount.textContent = `×${game.combo}`;
      if (comboCount.animate && !reducedMotionQuery.matches) {
        comboCount.animate(
          [{ transform: 'scale(1.35)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1)' }],
          { duration: 240, easing: 'ease-out' }
        );
      }
    }

    function handleEvents() {
      for (const event of game.events) {
        if (event.type === 'rupture') {
          renderer.addRupture(event);
          if (event.byPlayer) audio.pop({ size: event.relative, combo: event.combo });
        } else if (event.type === 'frenzy') {
          showToast('¡Ya no queda nadie mayor que tú! Cómetelo todo', 5);
        } else if (event.type === 'lost' || event.type === 'won') {
          pauseButton.hidden = true;
          endTimer = setTimeout(finishGame, event.type === 'won' ? 2600 : 1400);
        }
      }
      game.events.length = 0;
    }

    function needsFrames() {
      if (state === 'playing') return true;
      if (state === 'menu') return stageVisible && !reducedMotionQuery.matches;
      return state === 'ended' && stageVisible && !reducedMotionQuery.matches;
    }

    function requestFrame() {
      if (!frameRequest) {
        lastFrame = 0;
        frameRequest = requestAnimationFrame(frame);
      }
    }

    function frame(now) {
      frameRequest = 0;
      const elapsed = lastFrame ? (now - lastFrame) / 1000 : STEP;
      const dt = Math.min(elapsed, 0.08);
      lastFrame = now;
      accumulator += dt;
      const input = state === 'playing' ? getInput() : { x: 0, y: 0 };
      while (accumulator >= STEP) {
        game.step(STEP, input);
        accumulator -= STEP;
      }
      if (!game.player.removed) game.lastFilled = game.getFilled();
      handleEvents();
      renderer.draw(game, dt);
      if (state === 'playing') updateHud();
      watchPerformance(elapsed);
      if (needsFrames()) {
        frameRequest = requestAnimationFrame(frame);
      }
    }

    // Si el equipo no llega a la fluidez, se baja la resolución interna.
    function watchPerformance(elapsed) {
      if (state !== 'playing' || maxRatio === 1) return;
      slowFrames = elapsed > 0.024 && elapsed < 0.2 ? slowFrames + 1 : Math.max(0, slowFrames - 0.5);
      if (slowFrames > 45) {
        maxRatio = 1;
        resize();
      }
    }

    function resize() {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      renderer.resize(width, height, clamp(window.devicePixelRatio || 1, 1, maxRatio));
      game.setAspect(width / height);
      renderer.draw(game, 0);
    }

    function initVisibility() {
      new ResizeObserver(resize).observe(stage);
      window.addEventListener('blur', pauseGame);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) pauseGame();
      });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
          const ratio = entries[entries.length - 1].intersectionRatio;
          stageVisible = ratio > 0;
          if (ratio < 0.2) pauseGame();
          if (needsFrames()) requestFrame();
        }, { threshold: [0, 0.2, 0.5] }).observe(stage);
      }
    }

    initControls();
    soundButton.hidden = !audio.available;
    applyMuted();
    initFullscreen();
    resize();
    initVisibility();

    const record = readRecord();
    if (record) panelText.textContent += ` Tu récord: ${describeRecord(record)}.`;
    setState('menu');
    requestFrame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDots);
  } else {
    initDots();
  }
})();
