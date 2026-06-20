/**
 * watercolor.js — Authentic Watercolor Brush Engine
 *
 * Key behaviours:
 *  - Smooth bezier-interpolated continuous brush paths
 *  - Per-stroke radial gradient with soft-edge "bleed" bleeding into paper
 *  - Layered wet-on-wet transparency (low opacity, multiply-like stacking)
 *  - Noise-warped organic blob edges (capillary action)
 *  - Pigment darkening at outer rim (granulation / edge bloom)
 *  - Volume → stroke width / opacity mapping
 *  - Pitch → colour palette mapping (12 watercolor pigments)
 */

/* ───────────────────────────────────────────────────────────────────
   Lightweight 2D Simplex Noise
   ─────────────────────────────────────────────────────────────────── */
class SimplexNoise {
  constructor(seed = Math.random()) {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
    ];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with a deterministic seed
    let s = (seed * 0xffffffff) >>> 0;
    for (let i = 255; i > 0; i--) {
      s = (s ^ (s << 13)) >>> 0;
      s = (s ^ (s >>> 17)) >>> 0;
      s = (s ^ (s << 5)) >>> 0;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  noise2D(xin, yin) {
    const g = this.grad3;
    const perm = this.perm, pm12 = this.permMod12;
    const F2 = 0.366025403, G2 = 0.211324865;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 > 0) { t0 *= t0; n0 = t0*t0*(g[pm12[ii+perm[jj]]][0]*x0+g[pm12[ii+perm[jj]]][1]*y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 > 0) { t1 *= t1; n1 = t1*t1*(g[pm12[ii+i1+perm[jj+j1]]][0]*x1+g[pm12[ii+i1+perm[jj+j1]]][1]*y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 > 0) { t2 *= t2; n2 = t2*t2*(g[pm12[ii+1+perm[jj+1]]][0]*x2+g[pm12[ii+1+perm[jj+1]]][1]*y2); }
    return 70 * (n0 + n1 + n2);
  }
}

const simplex = new SimplexNoise(0.314159);

/* ───────────────────────────────────────────────────────────────────
   Pigment Palette — 12 chromatic watercolor pigments keyed to notes
   ─────────────────────────────────────────────────────────────────── */
export const COLOR_PALETTE = {
  "C":  { r: 24,  g: 48,  b: 89,  name: "Indigo Blue"      },
  "C#": { r: 122, g: 39,  b: 62,  name: "Crimson Alizarin"  },
  "D":  { r: 196, g: 114, b: 51,  name: "Raw Sienna"        },
  "D#": { r: 85,  g: 130, b: 121, name: "Teal Green"        },
  "E":  { r: 217, g: 173, b: 67,  name: "Yellow Ochre"      },
  "F":  { r: 201, g: 91,  b: 104, name: "Rose Madder"       },
  "F#": { r: 52,  g: 101, b: 77,  name: "Viridian"          },
  "G":  { r: 41,  g: 88,  b: 140, name: "Cobalt Blue"       },
  "G#": { r: 94,  g: 65,  b: 115, name: "Cobalt Violet"     },
  "A":  { r: 219, g: 107, b: 61,  name: "Burnt Orange"      },
  "A#": { r: 60,  g: 71,  b: 77,  name: "Payne's Grey"      },
  "B":  { r: 156, g: 158, b: 79,  name: "Olive Green"       },
};

/* ───────────────────────────────────────────────────────────────────
   WatercolorBlob — A single wet paint blob with organic capillary edges
   ─────────────────────────────────────────────────────────────────── */
class WatercolorBlob {
  /**
   * @param {number} x, y     — center position
   * @param {number} r,g,b    — RGB pigment colour
   * @param {number} radius   — initial radius (px)
   * @param {number} vx, vy   — brush velocity at spawn time
   * @param {number} opacity  — base layer opacity (0–1) driven by volume
   * @param {number} granularity — spectral centroid (0–1); affects pigment clumping
   */
  constructor(x, y, r, g, b, radius, vx, vy, opacity, granularity) {
    this.x = x;
    this.y = y;
    this.r = r; this.g = g; this.b = b;

    this.baseRadius = radius;
    this.currentRadius = radius * 0.35; // start as a tight brush contact

    this.vx = vx * 0.35;
    this.vy = vy * 0.35;

    this.baseOpacity  = Math.min(0.22, Math.max(0.05, opacity));
    this.granularity  = granularity;

    this.age    = 0;
    this.maxAge = 55 + Math.random() * 35;

    // Capillary / bleed direction (random preference for organic spread)
    this.bleedAngle = Math.random() * Math.PI * 2;
    this.bleedForce = 0.6 + Math.random() * 1.2;

    // Organic contour control points
    this.numPts   = 80;
    this.offsets  = [];
    this.dOffsets = []; // velocity of each contour point
    const seed = Math.random() * 999;
    for (let i = 0; i < this.numPts; i++) {
      const a  = (i / this.numPts) * Math.PI * 2;
      const nx = Math.cos(a), ny = Math.sin(a);
      const n  = simplex.noise2D(nx * 1.6 + seed, ny * 1.6 + seed);
      this.offsets.push(0.88 + n * 0.18);
      this.dOffsets.push(0.008 + Math.random() * 0.03);
    }
  }

  update() {
    this.age++;
    if (this.age >= this.maxAge) return;

    const p = this.age / this.maxAge; // 0 → 1

    // Brush drift decays as stroke ages
    this.x += this.vx * (1 - p);
    this.y += this.vy * (1 - p);

    // Expand blob (wet-on-paper diffusion curve)
    const expansion = Math.pow(p, 0.45) * (this.baseRadius * 0.72);
    this.currentRadius = this.baseRadius * 0.28 + expansion;

    // Evolve organic contour — capillary action
    for (let i = 0; i < this.numPts; i++) {
      const a  = (i / this.numPts) * Math.PI * 2;
      const nx = Math.cos(a), ny = Math.sin(a);
      const flowNoise = simplex.noise2D(
        nx * 2.8 + this.age * 0.04,
        ny * 2.8 + this.age * 0.04
      ) * 0.025;
      const directional = Math.cos(a - this.bleedAngle) * 0.035 * this.bleedForce;
      this.offsets[i] += (this.dOffsets[i] + flowNoise + directional) * (1 - p * 0.92);
    }
  }

  isDried() { return this.age >= this.maxAge; }

  /**
   * Render the blob onto a canvas context.
   * Renders as a soft-edged radial gradient with a clipped organic path.
   */
  draw(ctx) {
    const p  = Math.min(1, this.age / this.maxAge);
    // Opacity builds up quickly then settles (wet paint look)
    const lifeAlpha = p < 0.15
      ? p / 0.15              // ramp in
      : 1 - (p - 0.15) * 0.18; // very slow fade

    const alpha = this.baseOpacity * Math.max(0, lifeAlpha);
    if (alpha <= 0.001) return;

    ctx.save();

    // ── Build clipping path ─────────────────────────────────────────
    ctx.beginPath();
    for (let i = 0; i < this.numPts; i++) {
      const a  = (i / this.numPts) * Math.PI * 2;
      const r  = this.currentRadius * this.offsets[i];
      const px = this.x + Math.cos(a) * r;
      const py = this.y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();

    // ── Watercolor radial gradient ──────────────────────────────────
    // Inner: lighter (wet wash / bead of water dilutes pigment)
    // Mid:   full pigment colour
    // Rim:   slightly darker (granulation / edge bloom — classic watercolor)
    // Edge:  feather to transparent for soft bleed

    const cx = this.x - this.currentRadius * 0.08;
    const cy = this.y - this.currentRadius * 0.08;
    const grad = ctx.createRadialGradient(cx, cy, 0, this.x, this.y, this.currentRadius * 1.05);

    const { r, g, b } = this;
    grad.addColorStop(0.00, `rgba(${r},${g},${b},${alpha * 0.30})`);   // watery centre
    grad.addColorStop(0.35, `rgba(${r},${g},${b},${alpha * 0.75})`);   // body
    grad.addColorStop(0.72, `rgba(${r},${g},${b},${alpha * 1.00})`);   // peak density
    // Edge bloom — darkened rim, signature of drying watercolor
    const dr = Math.max(0, r - 35), dg = Math.max(0, g - 35), db = Math.max(0, b - 35);
    grad.addColorStop(0.88, `rgba(${dr},${dg},${db},${alpha * 0.85})`);
    grad.addColorStop(1.00, `rgba(${r},${g},${b},0)`);                 // feathered edge

    ctx.fillStyle = grad;
    ctx.fill();

    // ── Pigment granulation (speckled texture at high clarity) ──────
    if (this.granularity > 0.25 && alpha > 0.04) {
      const grainAlpha = 0.035 * this.granularity * alpha / this.baseOpacity;
      ctx.fillStyle = `rgba(${dr},${dg},${db},${grainAlpha})`;
      const numGrains = Math.floor(this.currentRadius * 1.2);
      for (let k = 0; k < numGrains; k++) {
        const theta = Math.random() * Math.PI * 2;
        const rad   = Math.pow(Math.random(), 0.5) * this.currentRadius;
        ctx.fillRect(
          this.x + Math.cos(theta) * rad,
          this.y + Math.sin(theta) * rad,
          1.5, 1.5
        );
      }
    }

    ctx.restore();
  }
}

/* ───────────────────────────────────────────────────────────────────
   Brush Path — accumulates control points and renders bezier strokes
   for a continuous fluid brush path between spawn calls.
   ─────────────────────────────────────────────────────────────────── */
class BrushPath {
  /**
   * @param {number} r,g,b       — pigment colour
   * @param {number} strokeWidth — px width of the brush stroke line
   * @param {number} opacity     — stroke opacity (0–1)
   */
  constructor(r, g, b, strokeWidth, opacity) {
    this.r = r; this.g = g; this.b = b;
    this.strokeWidth = strokeWidth;
    this.opacity     = Math.min(0.55, Math.max(0.07, opacity));
    this.points      = []; // { x, y }
    this.age         = 0;
    this.maxAge      = 90;
    this.active      = true; // still receiving points
  }

  addPoint(x, y) {
    this.points.push({ x, y });
  }

  update() { this.age++; }

  isDried() { return this.age >= this.maxAge; }

  /**
   * Draw a smooth catmull-rom / quadratic-bezier path through accumulated points.
   * Also applies a soft glow to simulate watercolor bleeding beyond brush edge.
   */
  draw(ctx) {
    if (this.points.length < 2) return;

    const p = Math.min(1, this.age / this.maxAge);
    const lifeAlpha = p < 0.25
      ? p / 0.25
      : 1 - (p - 0.25) * 0.55;
    const alpha = this.opacity * Math.max(0, lifeAlpha);
    if (alpha <= 0.001) return;

    ctx.save();

    // ── Outer glow / bleed halo (drawn first, behind stroke) ───────
    const glowWidth = this.strokeWidth * 2.8;
    ctx.beginPath();
    this._tracePath(ctx);
    ctx.lineWidth   = glowWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = `rgba(${this.r},${this.g},${this.b},${alpha * 0.06})`;
    ctx.stroke();

    // ── Secondary soft bleed ────────────────────────────────────────
    ctx.beginPath();
    this._tracePath(ctx);
    ctx.lineWidth   = this.strokeWidth * 1.8;
    ctx.strokeStyle = `rgba(${this.r},${this.g},${this.b},${alpha * 0.12})`;
    ctx.stroke();

    // ── Core stroke ─────────────────────────────────────────────────
    ctx.beginPath();
    this._tracePath(ctx);
    ctx.lineWidth   = this.strokeWidth;
    ctx.strokeStyle = `rgba(${this.r},${this.g},${this.b},${alpha * 0.55})`;
    ctx.stroke();

    ctx.restore();
  }

  /** Trace the smooth bezier path through this.points */
  _tracePath(ctx) {
    const pts = this.points;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) * 0.5;
      const my = (pts[i].y + pts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
  }
}

/* ───────────────────────────────────────────────────────────────────
   WatercolorEngine — orchestrates the dual-buffer painting system
   ─────────────────────────────────────────────────────────────────── */
export class WatercolorEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Off-screen "dried" buffer — older strokes are composited here
    this.dryCanvas = document.createElement('canvas');
    this.dryCtx    = this.dryCanvas.getContext('2d');

    this.blobs       = [];  // live wet blobs
    this.paths       = [];  // live brush stroke paths
    this.strokeCount = 0;

    // Smooth brush position (lerped toward target)
    this.brushX = 0; this.brushY = 0;
    this.lastBrushX = 0; this.lastBrushY = 0;
    this.targetBrushX = 0; this.targetBrushY = 0;

    // Current active continuous path
    this._activePath = null;

    this.resize();
    this.clear();

    // Start brush at canvas center
    this.brushX = this.targetBrushX = this.lastBrushX = this.width  / 2;
    this.brushY = this.targetBrushY = this.lastBrushY = this.height / 2;
  }

  /* ── Resize / re-initialise canvases ──────────────────────────── */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width  = Math.max(100, rect.width);
    this.height = Math.max(100, rect.height);

    // Preserve existing dry canvas content during resize
    const tmp = document.createElement('canvas');
    tmp.width  = this.dryCanvas.width;
    tmp.height = this.dryCanvas.height;
    tmp.getContext('2d').drawImage(this.dryCanvas, 0, 0);

    this.canvas.width    = this.width;
    this.canvas.height   = this.height;
    this.dryCanvas.width = this.width;
    this.dryCanvas.height = this.height;

    this._fillPaper(this.dryCtx);
    this.dryCtx.drawImage(tmp, 0, 0, this.width, this.height);
  }

  clear() {
    this.blobs       = [];
    this.paths       = [];
    this._activePath = null;
    this.strokeCount = 0;
    this._fillPaper(this.dryCtx);
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  _fillPaper(ctx) {
    // Warm cotton watercolor paper
    ctx.fillStyle = '#f5f2eb';
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /* ── Main render loop (called every animation frame) ─────────── */
  tick() {
    // Smooth brush drift
    this.brushX += (this.targetBrushX - this.brushX) * 0.055;
    this.brushY += (this.targetBrushY - this.brushY) * 0.055;

    // Auto-wander when close to target (idle generative drift)
    if (
      Math.abs(this.brushX - this.targetBrushX) < 6 &&
      Math.abs(this.brushY - this.targetBrushY) < 6
    ) {
      this.targetBrushX = 80 + Math.random() * (this.width  - 160);
      this.targetBrushY = 80 + Math.random() * (this.height - 160);
    }

    // Composite dry layer
    this.ctx.drawImage(this.dryCanvas, 0, 0);

    // Update & render blobs
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      b.update();
      b.draw(this.ctx);
      if (b.isDried()) {
        b.draw(this.dryCtx);
        this.blobs.splice(i, 1);
      }
    }

    // Update & render paths
    for (let i = this.paths.length - 1; i >= 0; i--) {
      const path = this.paths[i];
      path.update();
      path.draw(this.ctx);
      if (path.isDried()) {
        path.draw(this.dryCtx);
        this.paths.splice(i, 1);
      }
    }
  }

  /* ── Spawn a new watercolor brush stroke from audio data ─────── */
  /**
   * @param {string} note      — musical note name e.g. "C#"
   * @param {number} volume    — 0–1 normalised volume (RMS)
   * @param {number} clarity   — 0–1 pitch clarity / confidence
   * @param {number} centroid  — 0–1 normalised spectral centroid
   */
  spawnStroke(note, volume, clarity, centroid) {
    const color = COLOR_PALETTE[note] || { r: 60, g: 71, b: 77, name: "Payne's Grey" };
    const { r, g, b } = color;

    // Volume drives stroke width & opacity (dilution effect)
    const strokeWidth = 8  + volume * 65;
    const blobRadius  = 18 + volume * 160;
    const opacity     = 0.07 + volume * 0.35;  // quiet → transparent like watery wash

    // ── Interpolate brush position in steps ─────────────────────────
    const dx   = this.brushX - this.lastBrushX;
    const dy   = this.brushY - this.lastBrushY;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.min(12, Math.ceil(dist / 12)));

    // ── Continue or start a new BrushPath ──────────────────────────
    // Start a new path if: no active path, or colour changed, or stroke lifted
    if (!this._activePath || this._activePath.r !== r) {
      if (this._activePath) this._activePath.active = false;
      this._activePath = new BrushPath(r, g, b, strokeWidth, opacity * clarity);
      this.paths.push(this._activePath);
    }

    for (let s = 0; s <= steps; s++) {
      const t    = s / steps;
      const ix   = this.lastBrushX + dx * t;
      const iy   = this.lastBrushY + dy * t;

      // Add point to current brush path (continuous stroke)
      this._activePath.addPoint(ix, iy);

      // Spawn underlying wet blobs (1–3 per step, count driven by volume)
      const blobCount = volume > 0.5 ? 3 : volume > 0.2 ? 2 : 1;
      for (let k = 0; k < blobCount; k++) {
        const jitter = blobRadius * 0.3;
        this.blobs.push(new WatercolorBlob(
          ix + (Math.random() - 0.5) * jitter,
          iy + (Math.random() - 0.5) * jitter,
          r, g, b,
          blobRadius * (0.55 + Math.random() * 0.45),
          dx / (steps || 1),
          dy / (steps || 1),
          opacity * (0.7 + Math.random() * 0.3),
          centroid
        ));
      }

      // Occasional extra "splash" blob at high volume (wet-on-wet pooling)
      if (volume > 0.6 && Math.random() < 0.3) {
        const splashR = blobRadius * (0.3 + Math.random() * 0.5);
        const angle   = Math.random() * Math.PI * 2;
        this.blobs.push(new WatercolorBlob(
          ix + Math.cos(angle) * blobRadius * 0.6,
          iy + Math.sin(angle) * blobRadius * 0.6,
          r, g, b,
          splashR, dx * 0.5, dy * 0.5,
          opacity * 0.5, centroid
        ));
      }
    }

    this.lastBrushX = this.brushX;
    this.lastBrushY = this.brushY;
    this.strokeCount++;

    // Nudge target to create organic wandering motion
    const wanderScale = 180 + volume * 220;
    this.targetBrushX = Math.max(80, Math.min(this.width  - 80,
      this.targetBrushX + (Math.random() - 0.5) * wanderScale));
    this.targetBrushY = Math.max(80, Math.min(this.height - 80,
      this.targetBrushY + (Math.random() - 0.5) * wanderScale));
  }
}
