/**
 * Dots: dibujo del juego en un canvas 2D.
 *
 * Recibe una partida de dots-core.js y pinta la arena, los globos de agua, las
 * membranas de las pompas al unirse y las gotas que saltan.
 */
(function (root) {
  'use strict';

  const { CONFIG, PALETTE, TAU, clamp, getDirections } = root.DotsCore;

  const COLORS = {
    arena: '#f4e9d3',
    arenaEdge: '#eddfc3',
    outside: '#e3d3b4',
    outsideVeil: 'rgba(227, 211, 180, 0.66)',
    grid: '150, 122, 78',
    rim: 'rgba(160, 130, 85, 0.55)',
    shadow: 'rgba(120, 90, 45, 0.16)'
  };
  // El jugador: [base, claro, oscuro].
  const PLAYER_COLORS = ['#ffffff', '#ffffff', '#d9c9ae'];
  // Tonos irisados de la película de jabón.
  const SOAP = ['#ffb7d5', '#ffe6a8', '#b8f0d0', '#a9d8ff', '#d9b8ff', '#ffb7d5'];
  const INK_LIFE = 1.6;

  const getColors = index => (index < 0 ? PLAYER_COLORS : PALETTE[index]);

  function withAlpha(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  function createRenderer(canvas, options = {}) {
    const context = canvas.getContext('2d', { alpha: false });
    const reducedMotion = options.reducedMotion || (() => false);
    const view = { width: 1, height: 1, ratio: 1, scale: 1, x: 0, y: 0 };
    let drops = [];
    let rings = [];

    function resize(width, height, ratio) {
      view.width = Math.max(1, width);
      view.height = Math.max(1, height);
      view.ratio = ratio;
      canvas.width = Math.round(view.width * ratio);
      canvas.height = Math.round(view.height * ratio);
    }

    const toScreenX = x => view.width / 2 + (x - view.x) * view.scale;
    const toScreenY = y => view.height / 2 + (y - view.y) * view.scale;

    /* --- Arena --- */

    function drawArena(game) {
      const cx = toScreenX(0);
      const cy = toScreenY(0);
      const radius = CONFIG.arenaRadius * view.scale;
      context.fillStyle = COLORS.outside;
      context.fillRect(0, 0, view.width, view.height);
      context.fillStyle = COLORS.arena;
      context.beginPath();
      context.arc(cx, cy, radius, 0, TAU);
      context.fill();
      drawGrid(game);
    }

    // Punteado que da sensación de movimiento; su separación se adapta al zoom.
    function drawGrid() {
      const R = CONFIG.arenaRadius;
      let spacing = 20;
      while (spacing * view.scale < 38) spacing *= 2;
      const fade = clamp((spacing * view.scale - 38) / 38, 0, 1);
      const left = Math.max(-R, view.x - view.width / 2 / view.scale);
      const right = Math.min(R, view.x + view.width / 2 / view.scale);
      const top = Math.max(-R, view.y - view.height / 2 / view.scale);
      const bottom = Math.min(R, view.y + view.height / 2 / view.scale);
      const draw = (alpha, coarse) => {
        context.fillStyle = `rgba(${COLORS.grid}, ${alpha})`;
        context.beginPath();
        for (let row = Math.ceil(top / spacing); row * spacing <= bottom; row++) {
          for (let column = Math.ceil(left / spacing); column * spacing <= right; column++) {
            const isCoarse = row % 2 === 0 && column % 2 === 0;
            if (isCoarse !== coarse) continue;
            const x = column * spacing;
            const y = row * spacing;
            if (x * x + y * y > R * R) continue;
            context.rect(toScreenX(x) - 1, toScreenY(y) - 1, 2, 2);
          }
        }
        context.fill();
      };
      draw(0.2, true);
      draw(0.2 * fade, false);
    }

    // Velo sobre lo que queda fuera de la arena y borde de esta.
    function drawArenaEdge() {
      const cx = toScreenX(0);
      const cy = toScreenY(0);
      const radius = CONFIG.arenaRadius * view.scale;
      const corner = Math.hypot(
        Math.abs(cx - view.width / 2) + view.width / 2,
        Math.abs(cy - view.height / 2) + view.height / 2
      );
      if (corner < radius - 8) return;
      context.fillStyle = COLORS.outsideVeil;
      context.beginPath();
      context.rect(0, 0, view.width, view.height);
      context.arc(cx, cy, radius, 0, TAU, true);
      context.fill('evenodd');
      context.lineWidth = 3;
      context.strokeStyle = COLORS.rim;
      context.beginPath();
      context.arc(cx, cy, radius, 0, TAU);
      context.stroke();
    }

    /* --- Globos --- */

    function buildPath(dot, x, y, r) {
      const path = new Path2D();
      const { count, h } = dot;
      const { cos, sin } = getDirections(count);
      const px = i => x + cos[i] * r * (1 + h[i]);
      const py = i => y + sin[i] * r * (1 + h[i]);
      let previousX = px(count - 1);
      let previousY = py(count - 1);
      let currentX = px(0);
      let currentY = py(0);
      path.moveTo((previousX + currentX) / 2, (previousY + currentY) / 2);
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        const nextX = px(next);
        const nextY = py(next);
        path.quadraticCurveTo(currentX, currentY, (currentX + nextX) / 2, (currentY + nextY) / 2);
        currentX = nextX;
        currentY = nextY;
      }
      path.closePath();
      return path;
    }

    function isVisible(x, y, r) {
      const reach = r * 1.5 + 4;
      return x + reach > 0 && x - reach < view.width && y + reach > 0 && y - reach < view.height;
    }

    function drawDot(dot) {
      const x = toScreenX(dot.x);
      const y = toScreenY(dot.y);
      const r = dot.r * view.scale;
      if (!isVisible(x, y, r)) return;
      const [base, light, dark] = getColors(dot.color);
      const isPlayer = dot.color < 0;
      const path = buildPath(dot, x, y, r);

      // Sombra suave sobre la arena.
      const offset = Math.min(r * 0.1, 9);
      context.save();
      context.translate(offset * 0.6, offset);
      context.fillStyle = COLORS.shadow;
      context.fill(path);
      context.restore();

      if (r < 5) {
        context.fillStyle = base;
        context.fill(path);
        return;
      }

      // Agua: más clara donde entra la luz y más densa hacia el borde opuesto.
      const body = context.createRadialGradient(x - r * 0.28, y - r * 0.34, r * 0.08, x, y, r * 1.22);
      body.addColorStop(0, light);
      body.addColorStop(isPlayer ? 0.72 : 0.5, base);
      body.addColorStop(1, dark);
      context.fillStyle = body;
      context.fill(path);

      if (dot.inks.length || r > 10) {
        context.save();
        context.clip(path);
        drawInks(dot, x, y, r);
        if (r > 10) drawLights(dot, x, y, r, isPlayer);
        context.restore();
      }

      context.lineWidth = clamp(r * 0.035, 1, 3.2);
      context.strokeStyle = withAlpha(dark, isPlayer ? 0.95 : 0.7);
      context.stroke(path);

      if (dot.shine > 0.02 && !reducedMotion()) {
        context.save();
        context.globalAlpha = Math.min(0.85, dot.shine);
        context.lineWidth = clamp(r * 0.05, 1.5, 5);
        context.strokeStyle = getSoapStroke(x, y, r, dot.id);
        context.stroke(path);
        context.restore();
      }
    }

    // Color de la presa diluyéndose dentro del globo.
    function drawInks(dot, x, y, r) {
      for (const ink of dot.inks) {
        const age = ink.age / INK_LIFE;
        if (age >= 1) continue;
        const size = r * (ink.size * (1 + age * 1.2) + age * 0.35);
        const ix = x + ink.x * r;
        const iy = y + ink.y * r;
        const [base] = getColors(ink.color);
        const gradient = context.createRadialGradient(ix, iy, 0, ix, iy, size);
        const alpha = Math.pow(1 - age, 1.4) * 0.9;
        gradient.addColorStop(0, withAlpha(base, alpha));
        gradient.addColorStop(0.55, withAlpha(base, alpha * 0.6));
        gradient.addColorStop(1, withAlpha(base, 0));
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(ix, iy, size, 0, TAU);
        context.fill();
      }
    }

    // Reflejo superior y luz de rebote inferior; acompañan a la deformación.
    function drawLights(dot, x, y, r, isPlayer) {
      const { count, h } = dot;
      const stretch = angle => 1 + h[Math.round((angle / TAU) * count) % count];
      const top = stretch(TAU * 0.64);
      const bottom = stretch(TAU * 0.14);
      context.fillStyle = isPlayer ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.62)';
      context.beginPath();
      context.ellipse(x - r * 0.42 * top, y - r * 0.5 * top, r * 0.24, r * 0.12, -0.7, 0, TAU);
      context.fill();
      context.beginPath();
      context.arc(x - r * 0.66 * top, y - r * 0.2 * top, r * 0.05, 0, TAU);
      context.fill();
      context.lineCap = 'round';
      context.lineWidth = r * 0.07;
      context.strokeStyle = isPlayer ? 'rgba(255, 250, 240, 0.75)' : 'rgba(255, 255, 255, 0.3)';
      context.beginPath();
      context.arc(x, y, r * 0.8 * bottom, TAU * 0.06, TAU * 0.2);
      context.stroke();
    }

    function getSoapStroke(x, y, r, seed) {
      if (typeof context.createConicGradient === 'function') {
        const gradient = context.createConicGradient(seed % TAU, x, y);
        SOAP.forEach((color, index) => gradient.addColorStop(index / (SOAP.length - 1), color));
        return gradient;
      }
      const gradient = context.createLinearGradient(x - r, y - r, x + r, y + r);
      SOAP.forEach((color, index) => gradient.addColorStop(index / (SOAP.length - 1), color));
      return gradient;
    }

    /* --- Pompas de jabón --- */

    // Membrana compartida por dos pompas en contacto.
    function drawFilm(merge) {
      const { eater, prey, nx, ny, distance } = merge;
      const r = prey.r * view.scale;
      if (r < 4) return;
      const plane = (distance * distance + eater.r * eater.r - prey.r * prey.r) / (2 * distance);
      const half = Math.sqrt(Math.max(0, eater.r * eater.r - plane * plane));
      if (half <= 0) return;
      const cx = toScreenX(eater.x + nx * plane);
      const cy = toScreenY(eater.y + ny * plane);
      const length = half * view.scale;
      const bulge = -length * 0.3 * (1 - prey.r / eater.r);
      const x1 = cx - ny * length;
      const y1 = cy + nx * length;
      const x2 = cx + ny * length;
      const y2 = cy - nx * length;
      const gradient = context.createLinearGradient(x1, y1, x2, y2);
      SOAP.forEach((color, index) => gradient.addColorStop(index / (SOAP.length - 1), color));
      context.lineCap = 'round';
      context.lineWidth = clamp(r * 0.14 * (1 - merge.time / merge.duration * 0.6), 1.5, 9);
      context.strokeStyle = gradient;
      context.beginPath();
      context.moveTo(x1, y1);
      context.quadraticCurveTo(cx + nx * bulge, cy + ny * bulge, x2, y2);
      context.stroke();
    }

    // Al reventar la membrana saltan gotitas y una onda fina.
    function addRupture(event) {
      if (reducedMotion() || event.r * view.scale < 3) return;
      const [base, light] = getColors(event.color);
      const amount = Math.round(clamp(4 + event.r * view.scale * 0.14, 5, 16));
      for (let i = 0; i < amount; i++) {
        const side = i % 2 ? 1 : -1;
        const spread = (Math.random() - 0.5) * 1.1;
        const angle = Math.atan2(event.nx * side, -event.ny * side) + spread;
        const speed = event.r * (1.4 + Math.random() * 2.8);
        drops.push({
          x: event.x - event.ny * event.r * 0.5 * side,
          y: event.y + event.nx * event.r * 0.5 * side,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: event.r * (0.05 + Math.random() * 0.08),
          color: Math.random() < 0.5 ? base : light,
          age: 0,
          life: 0.35 + Math.random() * 0.3
        });
      }
      rings.push({ x: event.x, y: event.y, r: event.r, age: 0, life: 0.32 });
      if (drops.length > 160) drops = drops.slice(-160);
      if (rings.length > 16) rings = rings.slice(-16);
    }

    function drawEffects(dt) {
      for (const drop of drops) {
        drop.age += dt;
        drop.x += drop.vx * dt;
        drop.y += drop.vy * dt;
        drop.vx *= Math.exp(-dt * 4);
        drop.vy *= Math.exp(-dt * 4);
        const left = 1 - drop.age / drop.life;
        if (left <= 0) continue;
        context.fillStyle = withAlpha(drop.color, 0.9);
        context.beginPath();
        context.arc(toScreenX(drop.x), toScreenY(drop.y), Math.max(0.6, drop.r * view.scale * left), 0, TAU);
        context.fill();
      }
      for (const ring of rings) {
        ring.age += dt;
        const progress = ring.age / ring.life;
        if (progress >= 1) continue;
        context.lineWidth = Math.max(0.8, 2.4 * (1 - progress));
        context.strokeStyle = `rgba(255, 255, 255, ${0.75 * (1 - progress)})`;
        context.beginPath();
        context.arc(toScreenX(ring.x), toScreenY(ring.y), ring.r * view.scale * (0.4 + progress * 0.9), 0, TAU);
        context.stroke();
      }
      drops = drops.filter(drop => drop.age < drop.life);
      rings = rings.filter(ring => ring.age < ring.life);
    }

    function draw(game, dt) {
      const { camera } = game;
      view.x = camera.x;
      view.y = camera.y;
      view.scale = view.height / (2 * camera.halfHeight);
      context.setTransform(view.ratio, 0, 0, view.ratio, 0, 0);
      drawArena(game);
      for (const dot of game.dots) drawDot(dot);
      if (!game.player.removed) {
        // El borde de la arena queda por debajo del jugador, que nunca sale de ella.
        drawArenaEdge();
        drawDot(game.player);
      } else {
        drawArenaEdge();
      }
      for (const merge of game.merges) drawFilm(merge);
      drawEffects(dt);
    }

    function clearEffects() {
      drops = [];
      rings = [];
    }

    return { resize, draw, addRupture, clearEffects };
  }

  root.DotsRender = { createRenderer };
})(typeof self !== 'undefined' ? self : this);
