/**
 * Dots: simulación del juego (sin DOM ni canvas).
 *
 * Cada punto es un globo de agua: un centro y un anillo de radios unidos por
 * muelles que ondula y conserva su área. Al comer, los dos puntos se unen como
 * pompas de jabón. Este archivo funciona en el navegador (window.DotsCore) y en
 * Node (require), lo que permite simular partidas sin pantalla.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DotsCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const STEP = 1 / 120;

  const CONFIG = {
    arenaRadius: 2400,
    startRadius: 20,
    // Duración de referencia: marca la curva de crecimiento esperada (segundos).
    targetTime: 310,
    // Relaciones de tamaño respecto al jugador.
    edibleRatio: 0.92,
    deadlyRatio: 1.1,
    // Roce permitido antes de que se forme la pompa (fracción del radio menor).
    eatOverlap: 0.05,
    deathOverlap: 0.14,
    // Desde esta fracción del radio de la arena los grandes solo asoman por el borde.
    peekFrom: 0.3,
    // Desde esta fracción ya no hay peligro: solo queda llenar la arena.
    frenzyFrom: 0.9,
    winAt: 0.985,
    // Velocidad del jugador en «medias pantallas» por segundo, al empezar y al acabar.
    speedStart: 0.95,
    speedEnd: 0.62,
    // Segundos sin comer que rompen el combo.
    comboWindow: 3
  };

  // Colores pastel de los puntos: [base, claro, oscuro].
  const PALETTE = [
    ['#f7b5b0', '#fde0dd', '#e08f88'],
    ['#f9cba0', '#fee8d2', '#e2a873'],
    ['#f5dc8f', '#fdf1c9', '#dcbc5f'],
    ['#c9e0a2', '#e8f3d4', '#a3c274'],
    ['#a5dcbc', '#d6f1e1', '#77bf97'],
    ['#9fdbd8', '#d3f1ef', '#70bcb8'],
    ['#a6cff0', '#d8eafa', '#76aad6'],
    ['#b6bdf0', '#dfe3fb', '#8c95d8'],
    ['#d0b5ec', '#ebdffa', '#ac8ad2'],
    ['#f2b4d4', '#fbdfed', '#d889b2']
  ];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, value) => {
    const t = clamp((value - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Generador pseudoaleatorio con semilla (mulberry32).
  function createRandom(seed) {
    let state = seed >>> 0;
    return function random() {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tablas de direcciones de los nodos del anillo, compartidas por número de nodos.
  const directionTables = new Map();
  function getDirections(count) {
    let table = directionTables.get(count);
    if (!table) {
      const cos = new Float64Array(count);
      const sin = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        cos[i] = Math.cos((i / count) * TAU);
        sin[i] = Math.sin((i / count) * TAU);
      }
      table = { cos, sin };
      directionTables.set(count, table);
    }
    return table;
  }

  function getNodeCount(relativeRadius) {
    if (relativeRadius < 0.05) return 16;
    if (relativeRadius < 0.1) return 24;
    if (relativeRadius < 0.22) return 40;
    if (relativeRadius < 0.45) return 64;
    return 96;
  }

  /* ---------------------------------------------------------------------
   * Globo de agua: anillo elástico de radios
   * ------------------------------------------------------------------- */

  function setNodes(dot, count) {
    if (dot.count === count) return;
    const h = new Float64Array(count);
    const hv = new Float64Array(count);
    if (dot.count) {
      for (let i = 0; i < count; i++) {
        const position = (i / count) * dot.count;
        const a = Math.floor(position) % dot.count;
        const b = (a + 1) % dot.count;
        const t = position - Math.floor(position);
        h[i] = lerp(dot.h[a], dot.h[b], t);
        hv[i] = lerp(dot.hv[a], dot.hv[b], t);
      }
    }
    dot.count = count;
    dot.h = h;
    dot.hv = hv;
  }

  // Deforma el globo con un modo (2 = óvalo, 3 = triángulo...) en un ángulo dado.
  function exciteMode(dot, mode, angle, amount) {
    const { count, hv } = dot;
    for (let i = 0; i < count; i++) {
      hv[i] += Math.cos(mode * ((i / count) * TAU - angle)) * amount;
    }
  }

  // Bulto de área conocida en una dirección (absorción de presas diminutas).
  function addBump(dot, angle, areaRatio, width) {
    const { count, h } = dot;
    const spread = Math.max(width, (TAU / count) * 1.6);
    const height = Math.min(0.3, (areaRatio * Math.PI) / (spread * Math.sqrt(TAU)));
    for (let i = 0; i < count; i++) {
      let delta = Math.abs((i / count) * TAU - angle) % TAU;
      if (delta > Math.PI) delta = TAU - delta;
      h[i] += height * Math.exp(-(delta * delta) / (2 * spread * spread));
    }
  }

  // Mantiene el área: lo que se hunde por un lado sale por el resto del contorno.
  function conserveArea(dot) {
    const { count, h } = dot;
    let sum = 0;
    for (let i = 0; i < count; i++) {
      h[i] = clamp(h[i], -0.75, 1.6);
      sum += (1 + h[i]) * (1 + h[i]);
    }
    const scale = Math.sqrt(count / sum);
    for (let i = 0; i < count; i++) {
      h[i] = (1 + h[i]) * scale - 1;
    }
  }

  function stepRing(dot, dt, viewRadius) {
    const { count, h, hv } = dot;
    // Los globos grandes ondulan más despacio.
    const relative = dot.r / viewRadius;
    const waveSpeed = 6.2 * clamp(Math.pow(0.12 / Math.max(relative, 0.01), 0.3), 0.5, 1.15);
    const stiffness = waveSpeed * waveSpeed * Math.pow(count / TAU, 2);
    const restore = 26;
    const damping = 2.1;
    const viscosity = 0.024 * Math.pow(count / TAU, 2);
    const first = h[0];
    const firstVelocity = hv[0];
    let previous = h[count - 1];
    let previousVelocity = hv[count - 1];
    for (let i = 0; i < count; i++) {
      const current = h[i];
      const currentVelocity = hv[i];
      const next = i + 1 < count ? h[i + 1] : first;
      const nextVelocity = i + 1 < count ? hv[i + 1] : firstVelocity;
      const force = stiffness * (next - 2 * current + previous)
        - restore * current
        - damping * currentVelocity
        + viscosity * (nextVelocity - 2 * currentVelocity + previousVelocity);
      hv[i] = currentVelocity + force * dt;
      previous = current;
      previousVelocity = currentVelocity;
    }
    for (let i = 0; i < count; i++) {
      h[i] += hv[i] * dt;
    }
    conserveArea(dot);
  }

  // Aplana el contorno contra un plano situado a `distance` en la dirección (nx, ny).
  function flatten(dot, nx, ny, distance, strength) {
    const { count, h, hv } = dot;
    const { cos, sin } = getDirections(count);
    const plane = Math.max(distance, dot.r * 0.3);
    for (let i = 0; i < count; i++) {
      const projection = cos[i] * nx + sin[i] * ny;
      if (projection < 0.12) continue;
      const limit = plane / (dot.r * projection) - 1;
      if (h[i] > limit) {
        h[i] += (limit - h[i]) * strength;
        if (hv[i] > 0) hv[i] *= 1 - strength;
      }
    }
  }

  /* ---------------------------------------------------------------------
   * Partida
   * ------------------------------------------------------------------- */

  function createGame(options = {}) {
    const random = createRandom(options.seed ?? Math.floor(Math.random() * 4294967296));
    // Modo ligero: sin anillos (solo para simular partidas rápido).
    const lite = Boolean(options.lite);
    const R = CONFIG.arenaRadius;
    const logRange = Math.log(R / CONFIG.startRadius);

    let nextId = 1;
    const between = (min, max) => min + (max - min) * random();

    function createDot(x, y, r, color) {
      const dot = {
        id: nextId++,
        x, y, r,
        area: r * r,
        vx: 0, vy: 0,
        dirX: 0, dirY: 0, drift: 0,
        color,
        kind: 'food',
        mass: r * r,
        merging: null,
        removed: false,
        inks: [],
        shine: 0,
        count: 0, h: null, hv: null
      };
      setNodes(dot, getNodeCount(r / game.camera.viewRadius));
      return dot;
    }

    const game = {
      config: CONFIG,
      state: 'playing',
      time: 0,
      endTime: 0,
      eaten: 0,
      combo: 0,
      bestCombo: 0,
      comboTime: 0,
      frenzy: false,
      player: null,
      dots: [],
      merges: [],
      events: [],
      threats: 0,
      camera: { x: 0, y: 0, viewRadius: 200, halfWidth: 200, halfHeight: 200 },
      aspect: options.aspect || 16 / 9,
      domain: 400
    };

    // Progreso de 0 a 1 en escala logarítmica: crece a ritmo constante en la partida.
    function getProgress(r = Math.sqrt(game.player.area)) {
      return clamp(Math.log(r / CONFIG.startRadius) / logRange, 0, 1);
    }

    // Fracción de la media pantalla que ocupa el jugador: del 10 % al 90 %.
    const getScreenFraction = progress => 0.1 + 0.8 * progress * progress;

    function updateCameraShape() {
      const { camera } = game;
      const aspect = game.aspect;
      camera.halfHeight = aspect >= 1 ? camera.viewRadius : camera.viewRadius / aspect;
      camera.halfWidth = camera.halfHeight * aspect;
      game.domain = Math.hypot(camera.halfWidth, camera.halfHeight) * 1.12;
    }

    function updateCamera(dt) {
      const { camera, player } = game;
      const progress = getProgress();
      const targetRadius = Math.min(player.r / getScreenFraction(progress), R * 1.12);
      camera.viewRadius += (targetRadius - camera.viewRadius) * (1 - Math.exp(-dt * 1.6));
      // Cuando la arena empieza a caber en pantalla, la cámara se centra en ella.
      const follow = 1 - smoothstep(0.5, 1, camera.viewRadius / R);
      const rate = 1 - Math.exp(-dt * 7);
      camera.x += (player.x * follow - camera.x) * rate;
      camera.y += (player.y * follow - camera.y) * rate;
      updateCameraShape();
    }

    /* --- Aparición de puntos --- */

    const pickColor = () => Math.floor(random() * PALETTE.length);

    // Tamaño de la comida: la mayoría pequeña y alguna pieza grande.
    function pickFoodRadius(progress) {
      const view = game.camera.viewRadius;
      const player = game.player.r;
      const pick = random();
      let r;
      if (pick < 0.62) r = between(0.018, 0.04 + 0.03 * progress) * view;
      else if (pick < 0.9) r = between(0.035, 0.07 + 0.06 * progress) * view;
      else r = between(0.5, 0.85) * Math.min(player, view * 0.3);
      return Math.min(r, player * 0.86);
    }

    function setMotion(dot, targetX, targetY, speed) {
      const dx = targetX - dot.x;
      const dy = targetY - dot.y;
      const length = Math.hypot(dx, dy) || 1;
      dot.dirX = dx / length;
      dot.dirY = dy / length;
      dot.drift = speed;
      dot.vx = dot.dirX * speed;
      dot.vy = dot.dirY * speed;
    }

    // Punto de paso al azar, dentro de la pantalla y de la arena.
    function pickTarget() {
      const { camera } = game;
      const angle = random() * TAU;
      const distance = Math.sqrt(random()) * Math.min(camera.viewRadius * 1.1, R * 0.95);
      let x = camera.x + Math.cos(angle) * distance * (camera.viewRadius < R * 0.6 ? camera.halfWidth / camera.viewRadius : 1);
      let y = camera.y + Math.sin(angle) * distance * (camera.viewRadius < R * 0.6 ? camera.halfHeight / camera.viewRadius : 1);
      const fromCenter = Math.hypot(x, y);
      if (fromCenter > R * 0.95) {
        x *= (R * 0.95) / fromCenter;
        y *= (R * 0.95) / fromCenter;
      }
      return { x, y };
    }

    // Ángulo de entrada: si el jugador avanza, aparecen más por delante.
    function pickEntryAngle() {
      const { player, camera } = game;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > camera.viewRadius * 0.25 && random() < 0.65) {
        return Math.atan2(player.vy, player.vx) + between(-1.1, 1.1);
      }
      return random() * TAU;
    }

    function finishSpawn(dot) {
      if (!lite) {
        exciteMode(dot, 2, random() * TAU, between(0.2, 0.7));
        exciteMode(dot, 3, random() * TAU, between(0.1, 0.4));
      }
      game.dots.push(dot);
      return dot;
    }

    function spawnFood(progress, scattered) {
      const { camera } = game;
      const r = pickFoodRadius(progress);
      let x;
      let y;
      if (scattered) {
        const angle = random() * TAU;
        const distance = Math.sqrt(random()) * game.domain;
        x = camera.x + Math.cos(angle) * distance;
        y = camera.y + Math.sin(angle) * distance;
        if (Math.hypot(x - game.player.x, y - game.player.y) < game.player.r * 3 + r) return null;
      } else {
        const angle = pickEntryAngle();
        const distance = game.domain * between(1, 1.06) + r;
        x = camera.x + Math.cos(angle) * distance;
        y = camera.y + Math.sin(angle) * distance;
      }
      // Los puntos solo aparecen fuera de la arena si la arena entera cabe en pantalla.
      if (camera.viewRadius < R * 0.5 && Math.hypot(x, y) > R + camera.viewRadius * 0.4) return null;
      const dot = createDot(x, y, r, pickColor());
      const target = game.frenzy ? { x: between(-0.3, 0.3) * R, y: between(-0.3, 0.3) * R } : pickTarget();
      const speed = game.frenzy ? between(0.3, 0.5) : between(0.06, 0.17) + 0.09 * progress;
      setMotion(dot, target.x, target.y, speed * camera.viewRadius);
      return finishSpawn(dot);
    }

    // Distancia mínima futura entre las trayectorias de dos puntos (segundos próximos).
    function closestApproach(a, b, seconds) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dvx = b.vx - a.vx;
      const dvy = b.vy - a.vy;
      const speed2 = dvx * dvx + dvy * dvy;
      const t = speed2 > 1e-6 ? clamp(-(dx * dvx + dy * dvy) / speed2, 0, seconds) : 0;
      return Math.hypot(dx + dvx * t, dy + dvy * t);
    }

    // Hueco libre exigido entre dos puntos peligrosos: menor según avanza la partida.
    const getGap = progress => game.player.r * 2 * lerp(2.2, 1.35, progress);

    // Los tamaños se comparan con el radio real del jugador, que nunca baja. El visible
    // se hincha un instante al comer y, al relajarse, volvería mortal un punto parecido.
    const getPlayerSize = () => Math.sqrt(game.player.area);

    function isThreat(dot) {
      return dot.r > getPlayerSize() * CONFIG.deadlyRatio;
    }

    function isEdible(dot) {
      return dot.r <= getPlayerSize() * CONFIG.edibleRatio;
    }

    function respectsGap(candidate, progress) {
      const gap = getGap(progress);
      return game.dots.every(dot => !isThreat(dot)
        || closestApproach(candidate, dot, 14) - dot.r - candidate.r > gap);
    }

    function spawnThreat(progress) {
      const { camera, player } = game;
      for (let attempt = 0; attempt < 6; attempt++) {
        const maxRatio = lerp(2.1, 1.5, progress);
        const r = Math.max(player.r * 1.16, Math.min(player.r * between(1.2, maxRatio), camera.viewRadius * 0.72));
        const angle = pickEntryAngle();
        const distance = game.domain * between(1, 1.08) + r;
        const x = camera.x + Math.cos(angle) * distance;
        const y = camera.y + Math.sin(angle) * distance;
        if (camera.viewRadius < R * 0.5 && Math.hypot(x, y) > R + r) continue;
        const dot = createDot(x, y, r, pickColor());
        const target = pickTarget();
        setMotion(dot, target.x, target.y, (between(0.08, 0.17) + 0.07 * progress) * camera.viewRadius);
        dot.kind = 'threat';
        dot.mass *= 8;
        if (respectsGap(dot, progress)) return finishSpawn(dot);
      }
      return null;
    }

    function isOnScreen(x, y, r) {
      const { camera } = game;
      const dx = Math.max(Math.abs(x - camera.x) - camera.halfWidth, 0);
      const dy = Math.max(Math.abs(y - camera.y) - camera.halfHeight, 0);
      return dx * dx + dy * dy < r * r;
    }

    // Un punto peligroso deja de contar cuando ya ha salido de la arena y se aleja.
    function hasLeftArena(dot) {
      return Math.hypot(dot.x, dot.y) - dot.r > R && dot.x * dot.vx + dot.y * dot.vy > 0;
    }

    // Final de partida: un punto mayor que no cabe en la arena cruza asomando por el borde.
    // Siempre deja libre una franja algo más ancha que el jugador.
    function spawnPeek(progress) {
      const { player, camera } = game;
      const ratio = player.r / R;
      const r = player.r * between(1.14, lerp(1.5, 1.25, smoothstep(0.3, 0.9, ratio)));
      const margin = lerp(0.42, 0.04, smoothstep(CONFIG.peekFrom, CONFIG.frenzyFrom, ratio));
      const maxIntrusion = Math.min(2 * R - 2 * player.r * (1 + margin), R * 1.15);
      const intrusion = Math.max(R * 0.04, maxIntrusion * between(0.72, 1));
      const angle = random() * TAU;
      const side = random() < 0.5 ? -1 : 1;
      const offset = R - intrusion + r;
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      // Empieza justo fuera de la pantalla.
      let along = 0;
      while (isOnScreen(nx * offset - ny * along * side, ny * offset + nx * along * side, r * 1.08)) {
        along += R * 0.05;
      }
      const dot = createDot(nx * offset - ny * along * side, ny * offset + nx * along * side, r, pickColor());
      setMotion(dot, nx * offset + ny * along * side, ny * offset - nx * along * side,
        lerp(0.46, 0.38, progress) * camera.viewRadius);
      dot.kind = 'peek';
      dot.mass *= 40;
      return finishSpawn(dot);
    }

    let peekWait = 0;

    function direct(dt) {
      const { camera, player, domain } = game;
      const progress = getProgress();
      const view2 = camera.viewRadius * camera.viewRadius;
      const domainArea = (Math.PI * domain * domain) / view2;
      const ratio = player.r / R;

      // Recoge los puntos que ya se alejan fuera de la zona de juego.
      let food = 0;
      let threats = 0;
      let threatArea = 0;
      for (const dot of game.dots) {
        if (dot.merging) continue;
        const dx = dot.x - camera.x;
        const dy = dot.y - camera.y;
        const distance = Math.hypot(dx, dy);
        const leaving = dx * dot.vx + dy * dot.vy > 0;
        if (distance - dot.r > domain * 1.1 && (leaving || distance - dot.r > domain * 1.6)) {
          dot.removed = true;
          continue;
        }
        if (isThreat(dot)) {
          if (!hasLeftArena(dot)) threats++;
          threatArea += (Math.PI * dot.r * dot.r) / view2;
        } else {
          food++;
        }
      }
      game.dots = game.dots.filter(dot => !dot.removed);
      game.threats = threats;

      if (!game.frenzy && ratio >= CONFIG.frenzyFrom) {
        game.frenzy = true;
        game.events.push({ type: 'frenzy' });
      }

      // Comida: más densidad según avanza la partida.
      const foodTarget = Math.round(domainArea * lerp(3.1, 3.7, progress) * (game.frenzy ? 1.3 : 1));
      for (let i = 0; i < 4 && food < foodTarget; i++) {
        if (spawnFood(progress, false)) food++;
      }

      if (game.frenzy) return;
      if (ratio < CONFIG.peekFrom) {
        const occupancy = lerp(0.016, 0.28, Math.pow(progress, 1.15));
        if (game.time > 5 && threats < 14 && threatArea < domainArea * occupancy) {
          spawnThreat(progress);
        }
      } else if (threats === 0) {
        peekWait -= dt;
        if (peekWait <= 0) {
          spawnPeek(progress);
          peekWait = between(0.2, 0.8);
        }
      }
    }

    /* --- Uniones de pompa de jabón --- */

    function startMerge(eater, prey) {
      const dx = prey.x - eater.x;
      const dy = prey.y - eater.y;
      const distance = Math.hypot(dx, dy) || 1;
      const merge = {
        eater, prey,
        nx: dx / distance, ny: dy / distance,
        distance,
        time: 0,
        duration: 0.09 + 0.1 * Math.min(1, prey.r / eater.r)
      };
      prey.merging = merge;
      game.merges.push(merge);
      game.events.push({ type: 'touch', merge });
      if (prey === game.player) {
        game.state = 'losing';
        game.events.push({ type: 'losing' });
      }
    }

    // Ganancia de área al comer: mantiene la partida cerca de los 5 minutos.
    function getGain() {
      const progress = getProgress();
      const expected = clamp(game.time / CONFIG.targetTime, 0, 1);
      const ahead = (progress - expected) * logRange;
      const base = lerp(0.62, 0.8, progress);
      if (game.frenzy) return 0.5;
      return clamp(base * Math.exp(-3.4 * ahead), 0.06, 1.6);
    }

    function rupture(merge) {
      const { eater, prey, nx, ny } = merge;
      const angle = Math.atan2(ny, nx);
      const preyArea = prey.r * prey.r;
      const eaterArea = eater.r * eater.r;
      const totalRadius = Math.sqrt(eaterArea + preyArea);
      const relative = prey.r / eater.r;

      if (!lite) {
        const angularWidth = Math.asin(Math.min(0.95, prey.r / Math.max(merge.distance, 1)));
        if (angularWidth > (TAU / eater.count) * 2.2) {
          uniteProfiles(eater, prey, totalRadius);
        } else {
          addBump(eater, (angle + TAU) % TAU, preyArea / eaterArea, relative * 0.9);
          // Onda que recorre todo el globo: se nota aunque la presa sea pequeña.
          exciteMode(eater, 2, angle, Math.min(1.1, 0.25 + relative * 2));
        }
        eater.inks.push({
          x: nx * Math.min(merge.distance, eater.r) / eater.r,
          y: ny * Math.min(merge.distance, eater.r) / eater.r,
          size: Math.max(relative, 0.06),
          color: prey === game.player ? -1 : prey.color,
          age: 0
        });
        if (eater.inks.length > 14) eater.inks.shift();
        eater.shine = Math.max(eater.shine, Math.min(1, 0.35 + relative));
      }

      if (eater === game.player) {
        game.eaten++;
        game.combo++;
        game.comboTime = CONFIG.comboWindow;
        game.bestCombo = Math.max(game.bestCombo, game.combo);
      }

      const gain = eater === game.player ? getGain() : 1;
      eater.area += preyArea * gain;
      eater.r = totalRadius;
      // Conserva la cantidad de movimiento del conjunto.
      const share = preyArea / (eaterArea + preyArea);
      eater.vx += (prey.vx - eater.vx) * share * 0.4;
      eater.vy += (prey.vy - eater.vy) * share * 0.4;

      game.events.push({
        type: 'rupture',
        x: prey.x - nx * prey.r, y: prey.y - ny * prey.r,
        nx, ny, r: prey.r,
        color: prey === game.player ? -1 : prey.color,
        byPlayer: eater === game.player,
        combo: game.combo,
        relative
      });

      prey.removed = true;
      prey.merging = null;
      if (prey === game.player) {
        eater.kind = 'food';
        eater.drift *= 0.25;
        game.state = 'lost';
        game.endTime = game.time;
        game.events.push({ type: 'lost' });
      }
    }

    // El contorno nuevo es la silueta de los dos puntos vista desde su centro común;
    // a partir de ahí la tensión del anillo lo redondea oscilando, como una pompa.
    function uniteProfiles(eater, prey, totalRadius) {
      const eaterArea = eater.r * eater.r;
      const preyArea = prey.r * prey.r;
      const share = preyArea / (eaterArea + preyArea);
      const centerX = eater.x + (prey.x - eater.x) * share;
      const centerY = eater.y + (prey.y - eater.y) * share;
      const { count } = eater;
      const { cos, sin } = getDirections(count);
      const profile = new Float64Array(count);
      const farHit = (cx, cy, r, ux, uy) => {
        const dx = cx - centerX;
        const dy = cy - centerY;
        const along = dx * ux + dy * uy;
        const across = dx * uy - dy * ux;
        const inside = r * r - across * across;
        return inside > 0 ? along + Math.sqrt(inside) : 0;
      };
      for (let i = 0; i < count; i++) {
        const own = farHit(eater.x, eater.y, eater.r * (1 + eater.h[i] * 0.8), cos[i], sin[i]);
        const other = farHit(prey.x, prey.y, prey.r, cos[i], sin[i]);
        profile[i] = Math.max(own, other, totalRadius * 0.3);
      }
      // Suaviza el cuello que une ambos círculos.
      for (let pass = 0; pass < 2; pass++) {
        const copy = profile.slice();
        for (let i = 0; i < count; i++) {
          profile[i] = (copy[(i + count - 1) % count] + 2 * copy[i] + copy[(i + 1) % count]) / 4;
        }
      }
      for (let i = 0; i < count; i++) {
        eater.h[i] = profile[i] / totalRadius - 1;
        eater.hv[i] *= 0.4;
      }
      eater.x = centerX;
      eater.y = centerY;
      conserveArea(eater);
    }

    function stepMerges(dt) {
      if (!game.merges.length) return;
      const pending = [];
      for (const merge of game.merges) {
        const { eater, prey } = merge;
        if (eater.removed) {
          prey.merging = null;
          continue;
        }
        merge.time += dt;
        const target = (eater.r + prey.r) * 0.92;
        merge.distance += (target - merge.distance) * (1 - Math.exp(-dt * 16));
        prey.x = eater.x + merge.nx * merge.distance;
        prey.y = eater.y + merge.ny * merge.distance;
        prey.vx = eater.vx;
        prey.vy = eater.vy;
        flattenPair(eater, prey, merge.nx, merge.ny, merge.distance, 0.6);
        if (merge.time >= merge.duration) {
          rupture(merge);
        } else {
          pending.push(merge);
        }
      }
      game.merges = pending;
      game.dots = game.dots.filter(dot => !dot.removed);
    }

    /* --- Choques --- */

    // Plano de contacto entre dos globos (eje radical de sus círculos).
    function flattenPair(a, b, nx, ny, distance, strength) {
      if (lite) return;
      const plane = (distance * distance + a.r * a.r - b.r * b.r) / (2 * distance);
      flatten(a, nx, ny, plane, strength);
      flatten(b, -nx, -ny, distance - plane, strength);
    }

    function collide(a, b, dt, scale) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = a.r + b.r;
      const distance2 = dx * dx + dy * dy;
      if (distance2 >= reach * reach) return;
      const distance = Math.sqrt(distance2) || 1e-3;
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = reach - distance;
      const smaller = Math.min(a.r, b.r);
      const reduced = (a.mass * b.mass) / (a.mass + b.mass);
      const frequency = 9;
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      const squeeze = 1 + 3 * Math.min(1, overlap / smaller);
      let force = reduced * (frequency * frequency * overlap * squeeze + 2 * 0.16 * frequency * closing) * scale;
      force = Math.max(0, force);
      const impulse = force * dt;
      a.vx -= (impulse / a.mass) * nx;
      a.vy -= (impulse / a.mass) * ny;
      b.vx += (impulse / b.mass) * nx;
      b.vy += (impulse / b.mass) * ny;
      flattenPair(a, b, nx, ny, distance, 0.45);
    }

    function stepCollisions(dt) {
      const { dots, player } = game;
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        if (a.merging) continue;
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          if (b.merging) continue;
          const reach = a.r + b.r;
          if (Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach) {
            collide(a, b, dt, 1);
          }
        }
      }
      if (game.state !== 'playing') return;
      for (const dot of dots) {
        if (dot.merging) continue;
        const dx = dot.x - player.x;
        const dy = dot.y - player.y;
        const reach = dot.r + player.r;
        if (Math.abs(dx) >= reach || Math.abs(dy) >= reach) continue;
        const overlap = reach - Math.hypot(dx, dy);
        if (overlap <= 0) continue;
        if (isEdible(dot)) {
          if (overlap > dot.r * CONFIG.eatOverlap) startMerge(player, dot);
          else flattenPair(player, dot, dx / (reach - overlap), dy / (reach - overlap), reach - overlap, 0.4);
        } else if (isThreat(dot)) {
          if (overlap > player.r * CONFIG.deathOverlap) {
            startMerge(dot, player);
            return;
          }
          collide(player, dot, dt, 0.35);
        } else {
          collide(player, dot, dt, 1);
        }
      }
    }

    /* --- Jugador --- */

    function stepPlayer(dt, input) {
      const { player, camera } = game;
      const progress = getProgress();
      const maxSpeed = camera.viewRadius * lerp(CONFIG.speedStart, CONFIG.speedEnd, progress);
      let ix = input.x;
      let iy = input.y;
      const length = Math.hypot(ix, iy);
      if (length > 1) {
        ix /= length;
        iy /= length;
      }
      const rate = 1 - Math.exp(-dt * 5.5);
      const ax = (ix * maxSpeed - player.vx) * rate;
      const ay = (iy * maxSpeed - player.vy) * rate;
      player.vx += ax;
      player.vy += ay;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      if (!lite) {
        // Al acelerar el agua se queda atrás; en marcha, el globo se estira un poco.
        const acceleration = Math.hypot(ax, ay) / dt / maxSpeed;
        if (acceleration > 0.02) {
          exciteMode(player, 2, Math.atan2(ay, ax), acceleration * dt * 1.5);
          exciteMode(player, 1, Math.atan2(-ay, -ax), acceleration * dt * 0.7);
        }
        const speed = Math.hypot(player.vx, player.vy) / maxSpeed;
        exciteMode(player, 2, Math.atan2(player.vy, player.vx), speed * dt * 4.5);
      }

      // Borde de la arena: empuja el centro y aplasta el contorno.
      const distance = Math.hypot(player.x, player.y);
      const overlap = distance + player.r - R;
      if (overlap > 0 && distance > 1e-6) {
        const nx = player.x / distance;
        const ny = player.y / distance;
        const outward = player.vx * nx + player.vy * ny;
        const pull = overlap * 150 * dt + Math.max(0, outward) * Math.min(1, dt * 9);
        player.vx -= nx * pull;
        player.vy -= ny * pull;
        const maxOverlap = player.r * 0.16;
        if (overlap > maxOverlap) {
          player.x -= nx * (overlap - maxOverlap);
          player.y -= ny * (overlap - maxOverlap);
        }
      }
      if (!lite && overlap > -player.r * 0.3) clampToArena(player);
    }

    function clampToArena(dot) {
      const { count, h, hv } = dot;
      const { cos, sin } = getDirections(count);
      const distance2 = dot.x * dot.x + dot.y * dot.y;
      for (let i = 0; i < count; i++) {
        const along = dot.x * cos[i] + dot.y * sin[i];
        const limit = (Math.sqrt(Math.max(0, along * along + R * R - distance2)) - along) / dot.r - 1;
        if (h[i] > limit) {
          h[i] = limit;
          if (hv[i] > 0) hv[i] *= 0.3;
        }
      }
    }

    function stepDots(dt) {
      const { dots, player } = game;
      for (const dot of dots) {
        if (dot.merging) continue;
        // Recupera poco a poco su deriva después de un choque.
        const heavy = dot.kind !== 'food';
        const speed = Math.hypot(dot.vx, dot.vy) || 1e-6;
        if (heavy) {
          const rate = 1 - Math.exp(-dt * 0.8);
          dot.vx += (dot.dirX * dot.drift - dot.vx) * rate;
          dot.vy += (dot.dirY * dot.drift - dot.vy) * rate;
        } else {
          const rate = 1 - Math.exp(-dt * 0.7);
          const wanted = speed + (dot.drift - speed) * rate;
          dot.vx *= wanted / speed;
          dot.vy *= wanted / speed;
        }
        // En el tramo final los grandes que queden se desinflan.
        if (game.frenzy && dot.r > player.r * 0.7) {
          dot.area *= Math.exp(-dt * 0.5);
        }
        dot.x += dot.vx * dt;
        dot.y += dot.vy * dt;
      }
    }

    function relaxRadius(dot, dt) {
      const target = Math.sqrt(dot.area);
      if (Math.abs(target - dot.r) > 1e-4) {
        dot.r += (target - dot.r) * (1 - Math.exp(-dt * 1.5));
        dot.mass = dot.r * dot.r * (dot.kind === 'peek' ? 40 : dot.kind === 'threat' ? 8 : 1);
      }
    }

    function stepShapes(dt) {
      const view = game.camera.viewRadius;
      const update = dot => {
        relaxRadius(dot, dt);
        if (lite) return;
        stepRing(dot, dt, view);
        dot.shine = Math.max(0, dot.shine - dt * 1.4);
        if (dot.inks.length) {
          for (const ink of dot.inks) {
            ink.age += dt;
            ink.x *= 1 - dt * 1.4;
            ink.y *= 1 - dt * 1.4;
          }
          if (dot.inks[0].age > 1.6) dot.inks.shift();
        }
      };
      game.dots.forEach(update);
      if (!game.player.removed) update(game.player);
    }

    // Ajusta el detalle del contorno al tamaño en pantalla (con histéresis).
    function updateDetail(dot) {
      const count = getNodeCount(dot.r / game.camera.viewRadius);
      const low = getNodeCount((dot.r / game.camera.viewRadius) * 1.15);
      if (count > dot.count || low < dot.count) setNodes(dot, Math.max(count, Math.min(low, dot.count)));
    }

    let detailTimer = 0;

    function step(dt, input) {
      const playing = game.state === 'playing';
      if (playing) {
        game.time += dt;
        if (game.combo) {
          game.comboTime -= dt;
          if (game.comboTime <= 0) {
            game.combo = 0;
            game.comboTime = 0;
          }
        }
      }

      if (playing || game.state === 'losing') {
        const control = playing ? input : { x: 0, y: 0 };
        stepPlayer(dt, control);
      } else if (game.state === 'won') {
        // El jugador termina de llenar la arena, centrado.
        const { player } = game;
        player.x *= Math.exp(-dt * 3);
        player.y *= Math.exp(-dt * 3);
        player.vx = 0;
        player.vy = 0;
        player.area += (R * R - player.area) * (1 - Math.exp(-dt * 2));
        if (!lite) clampToArena(player);
      }

      stepDots(dt);
      stepCollisions(dt);
      stepMerges(dt);
      stepShapes(dt);
      if (!lite && !game.player.removed && Math.hypot(game.player.x, game.player.y) + game.player.r * 1.3 > R) {
        clampToArena(game.player);
      }
      if (!game.player.removed) updateCamera(dt);

      detailTimer -= dt;
      if (detailTimer <= 0) {
        detailTimer = 0.1;
        if (game.state === 'playing' || game.state === 'demo') direct(0.1);
        if (!lite) {
          game.dots.forEach(updateDetail);
          updateDetail(game.player);
        }
      }

      if (game.state === 'playing' && Math.sqrt(game.player.area) >= R * CONFIG.winAt) {
        game.state = 'won';
        game.endTime = game.time;
        game.events.push({ type: 'won' });
      }
    }

    function reset() {
      game.player = createDot(0, 0, CONFIG.startRadius, -1);
      game.player.kind = 'player';
      game.camera.viewRadius = CONFIG.startRadius / getScreenFraction(0);
      updateCameraShape();
      setNodes(game.player, getNodeCount(0.1));
      const domainArea = (Math.PI * game.domain * game.domain) / (game.camera.viewRadius * game.camera.viewRadius);
      for (let i = 0; i < domainArea * 3; i++) spawnFood(0, true);
    }

    reset();

    // Escena de fondo para el menú: puntos flotando, sin jugador.
    if (options.demo) {
      game.state = 'demo';
      game.player.removed = true;
    }

    return Object.assign(game, {
      step,
      getProgress,
      getScreenFraction,
      isThreat,
      isEdible,
      setAspect(aspect) {
        game.aspect = clamp(aspect, 0.4, 3);
        updateCameraShape();
      },
      // Porcentaje del ancho de la arena que ocupa el jugador.
      getFilled() {
        return clamp(getPlayerSize() / R, 0, 1);
      }
    });
  }

  return { CONFIG, PALETTE, STEP, TAU, clamp, lerp, smoothstep, createGame, createRandom, getDirections };
});
