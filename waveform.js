// ============================================
// NoteLM — Shared Waveform Rendering
// Used by both main player and mini row previews
// ============================================

/**
 * Render min/max waveform bars on a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - CSS width
 * @param {number} h - CSS height
 * @param {Float32Array} samples
 * @param {object} opts
 * @param {string} opts.playedColor - fill style for played bars
 * @param {string} opts.unplayedColor - fill style for unplayed bars
 * @param {number} [opts.progress=0] - 0–1 progress
 * @param {number} [opts.barWidth=1] - pixel width per bar
 */
export function renderBars(ctx, w, h, samples, {
  playedColor = 'rgba(45, 212, 191, 0.8)',
  unplayedColor = 'rgba(45, 212, 191, 0.2)',
  progress = 0,
  barWidth = 1,
} = {}) {
  const step = Math.ceil(samples.length / w);

  for (let i = 0; i < w; i += barWidth) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const v = samples[i * step + j];
      if (v !== undefined) { if (v < min) min = v; if (v > max) max = v; }
    }
    const y1 = (1 + min) * h / 2;
    const y2 = (1 + max) * h / 2;
    const height = Math.max(y2 - y1, 1);

    ctx.fillStyle = (i / w) <= progress ? playedColor : unplayedColor;
    ctx.fillRect(i, y1, barWidth, height);
  }
}

/**
 * Draw a full waveform with DPR scaling, progress overlay, and playhead.
 * Used by the main player canvas.
 */
export function drawMainWaveform(canvas, samples, progress = 0) {
  if (!canvas || !samples) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  renderBars(ctx, w, h, samples, {
    playedColor: 'rgba(45, 212, 191, 0.9)',
    unplayedColor: 'rgba(45, 212, 191, 0.25)',
    progress,
  });

  // Playhead
  if (progress > 0) {
    const x = Math.round(progress * w);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(x - 1, 0, 2, h);
  }
}

/**
 * Draw a mini waveform for a script line row.
 * Uses smaller DPR scaling and flat colors.
 */
export function drawMiniWaveform(canvas, samples, progress = 0) {
  if (!canvas || !samples) return;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  renderBars(ctx, w, h, samples, {
    playedColor: 'rgba(45, 212, 191, 0.7)',
    unplayedColor: 'rgba(45, 212, 191, 0.2)',
    progress,
  });
}
