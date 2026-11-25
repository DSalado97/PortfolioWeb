/**
 * Dots: sonido de pompa al comer, generado con Web Audio (sin archivos).
 *
 * Cada pompa es un tono corto que sube de golpe, como una burbuja, con un leve
 * chasquido y un eco suave. Las grandes suenan más graves y el combo hace subir
 * la melodía por una escala pentatónica, que siempre suena afinada.
 */
(function (root) {
  'use strict';

  // Semitonos de la escala pentatónica mayor, dos octavas.
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  // En combos largos la melodía sube y baja por la octava alta en vez de seguir subiendo.
  const LOOP_START = 4;
  const BASE_FREQUENCY = 277;
  const MIN_GAP = 0.04;
  const MAX_VOICES = 10;

  function getScaleStep(combo) {
    const index = Math.max(combo - 1, 0);
    const top = SCALE.length - 1;
    if (index <= top) return index;
    const span = top - LOOP_START;
    const position = (index - top) % (span * 2);
    return position <= span ? top - position : LOOP_START + position - span;
  }

  function getPopNote({ size, combo }) {
    const step = getScaleStep(combo);
    // size: tamaño de la presa respecto al jugador (0 a 1).
    const depth = Math.min(1, Math.max(0, size));
    return {
      frequency: BASE_FREQUENCY * Math.pow(2, (SCALE[step] - depth * 7) / 12),
      duration: 0.13 + depth * 0.14,
      volume: 0.2 + depth * 0.16
    };
  }

  // Programa una pompa en cualquier contexto de audio (también sin conexión, para pruebas).
  function schedulePop(context, output, start, options) {
    const { frequency, duration, volume } = getPopNote(options);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    envelope.connect(output);

    // Cuerpo: el tono sube con rapidez, como el aire que escapa de una burbuja.
    const body = context.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(frequency * 0.62, start);
    body.frequency.exponentialRampToValueAtTime(frequency * 1.35, start + duration * 0.55);
    body.connect(envelope);
    body.start(start);
    body.stop(start + duration + 0.02);

    // Brillo: un armónico muy breve que da el «plop».
    const sparkle = context.createOscillator();
    const sparkleGain = context.createGain();
    sparkle.type = 'triangle';
    sparkle.frequency.setValueAtTime(frequency * 2.4, start);
    sparkle.frequency.exponentialRampToValueAtTime(frequency * 1.6, start + 0.05);
    sparkleGain.gain.setValueAtTime(volume * 0.22, start);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
    sparkle.connect(sparkleGain).connect(output);
    sparkle.start(start);
    sparkle.stop(start + 0.07);

    return body;
  }

  function createAudio() {
    const AudioContextClass = root.AudioContext || root.webkitAudioContext;
    let context = null;
    let output = null;
    let muted = false;
    let lastPop = -1;
    let voices = 0;

    function buildOutput() {
      output = context.createGain();
      output.gain.value = muted ? 0 : 0.8;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 6;

      // Eco corto y apagado: da sensación de agua sin ensuciar.
      const delay = context.createDelay(0.5);
      const feedback = context.createGain();
      const filter = context.createBiquadFilter();
      const wet = context.createGain();
      delay.delayTime.value = 0.11;
      feedback.gain.value = 0.22;
      filter.type = 'lowpass';
      filter.frequency.value = 1600;
      wet.gain.value = 0.2;

      output.connect(compressor);
      output.connect(delay);
      delay.connect(filter);
      filter.connect(feedback).connect(delay);
      filter.connect(wet).connect(compressor);
      compressor.connect(context.destination);
    }

    return {
      available: Boolean(AudioContextClass),

      // Los navegadores solo permiten sonido tras un gesto: se llama al pulsar «Jugar».
      unlock() {
        if (!AudioContextClass) return;
        try {
          if (!context) {
            context = new AudioContextClass();
            buildOutput();
          }
          if (context.state === 'suspended') context.resume().catch(() => {});
        } catch (error) {
          // Sin salida de audio: el juego sigue en silencio.
          context = null;
        }
      },

      setMuted(value) {
        muted = value;
        if (output) output.gain.setTargetAtTime(muted ? 0 : 0.8, context.currentTime, 0.015);
      },

      pop(options) {
        if (muted || !context || context.state !== 'running') return;
        // Si se comen varias a la vez, se escalonan un poco en lugar de sumarse.
        const start = Math.max(context.currentTime, lastPop + MIN_GAP);
        if (voices >= MAX_VOICES || start - context.currentTime > 0.2) return;
        lastPop = start;
        voices++;
        schedulePop(context, output, start, options).addEventListener('ended', () => {
          voices--;
        });
      }
    };
  }

  root.DotsAudio = { createAudio, schedulePop, getPopNote };
})(typeof self !== 'undefined' ? self : this);
