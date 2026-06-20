// Simplex or Perlin noise approximation for organic paint boundaries
class SimplexNoise {
  constructor() {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.p = new Uint8Array(256);
    for (let i=0; i<256; i++) {
      this.p[i] = Math.floor(Math.random() * 256);
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i=0; i<512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = (this.perm[i] % 12);
    }
  }

  noise2D(xin, yin) {
    let n0, n1, n2;
    const s = (xin+yin)*0.366025403;
    const i = Math.floor(xin+s);
    const j = Math.floor(yin+s);
    const t = (i+j)*0.211324865;
    const X0 = i-t;
    const Y0 = j-t;
    const x0 = xin-X0;
    const y0 = yin-Y0;
    let i1, j1;
    if (x0>y0) {i1=1; j1=0;}
    else {i1=0; j1=1;}
    const x1 = x0 - i1 + 0.211324865;
    const y1 = y0 - j1 + 0.211324865;
    const x2 = x0 - 1.0 + 2.0 * 0.211324865;
    const y2 = y0 - 1.0 + 2.0 * 0.211324865;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii+this.perm[jj]];
    const gi1 = this.permMod12[ii+i1+this.perm[jj+j1]];
    const gi2 = this.permMod12[ii+1+this.perm[jj+1]];
    let t0 = 0.5 - x0*x0-y0*y0;
    if (t0<0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * (this.grad3[gi0][0]*x0 + this.grad3[gi0][1]*y0);
    }
    let t1 = 0.5 - x1*x1-y1*y1;
    if (t1<0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * (this.grad3[gi1][0]*x1 + this.grad3[gi1][1]*y1);
    }
    let t2 = 0.5 - x2*x2-y2*y2;
    if (t2<0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * (this.grad3[gi2][0]*x2 + this.grad3[gi2][1]*y2);
    }
    return 70.0 * (n0 + n1 + n2);
  }
}

const simplex = new SimplexNoise();

// Curated watercolor pigments mapped to 12 notes (C to B)
// Indigo, sienna, ochre, teal, rose, cobalt, slate, gold, copper, violet, crimson, olive
export const COLOR_PALETTE = {
  "C":  { r: 24,  g: 48,  b: 89,  name: "Indigo Blue" },
  "C#": { r: 122, g: 39,  b: 62,  name: "Crimson Alizarin" },
  "D":  { r: 196, g: 114, b: 51,  name: "Raw Sienna" },
  "D#": { r: 85,  g: 130, b: 121, name: "Teal Green" },
  "E":  { r: 217, g: 173, b: 67,  name: "Yellow Ochre" },
  "F":  { r: 201, g: 91,  b: 104, name: "Rose Madder" },
  "F#": { r: 52,  g: 101, b: 77,  name: "Viridian" },
  "G":  { r: 41,  g: 88,  b: 140, name: "Cobalt Blue" },
  "G#": { r: 94,  g: 65,  b: 115, name: "Cobalt Violet" },
  "A":  { r: 219, g: 107, b: 61,  name: "Burnt Orange" },
  "A#": { r: 60,  g: 71,  b: 77,  name: "Payne's Grey" },
  "B":  { r: 156, g: 158, b: 79,  name: "Olive Green" }
};

class WatercolorBlob {
  constructor(x, y, r, g, b, initialRadius, maxSustain, spectralCentroid) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.g = g;
    this.b = b;
    this.baseRadius = initialRadius;
    this.currentRadius = initialRadius;
    
    // Lifespan & Diffusion parameters
    this.age = 0;
    this.maxAge = 120 + Math.random() * 80; // duration of wet diffusion (frames)
    this.sustain = maxSustain; // normalized sustain duration
    
    // Diffusion rate: Centroid dictates texture/granulation/edge sharpness
    this.granularity = spectralCentroid; // higher = sharper/more speckled edges
    this.spreadRate = 0.5 + (1 - spectralCentroid) * 1.5; // low brightness spreads further/softer
    
    // Shape deformation array to build a organic fractal edge
    this.numPoints = 64;
    this.angles = [];
    this.offsets = [];
    
    // Generate initial noisy circle offsets
    const seed = Math.random() * 100;
    for (let i = 0; i < this.numPoints; i++) {
      const angle = (i / this.numPoints) * Math.PI * 2;
      this.angles.push(angle);
      // Generate initial organic offset using Simplex noise
      const ox = Math.cos(angle);
      const oy = Math.sin(angle);
      const val = simplex.noise2D(ox * 1.5 + seed, oy * 1.5 + seed) * 0.15;
      this.offsets.push(1.0 + val);
    }
  }

  update() {
    this.age++;
    if (this.age < this.maxAge) {
      // Simulate wet spread
      const progress = this.age / this.maxAge;
      // Spread slows down as the paint "dries" (logistic growth approximation)
      const currentSpread = Math.sin(progress * Math.PI * 0.5) * this.baseRadius * this.spreadRate;
      this.currentRadius = this.baseRadius + currentSpread;
      
      // Gradually evolve the edge deformation (wet bleeding action)
      for (let i = 0; i < this.numPoints; i++) {
        const angle = this.angles[i];
        const ox = Math.cos(angle);
        const oy = Math.sin(angle);
        
        // Feed time/age into simplex to make edges bleed dynamic, not static
        const timeFactor = this.age * 0.02;
        const bleedVal = simplex.noise2D(ox * 2.0 + timeFactor, oy * 2.0 + timeFactor) * 0.08;
        this.offsets[i] += bleedVal * (1 - progress); // less bleeding as it dries
      }
    }
  }

  isDried() {
    return this.age >= this.maxAge;
  }

  draw(ctx) {
    // When a blob is active, its opacity slowly moves from 1 to a stable resting opacity.
    // When it finishes drying, it is drawn at this resting opacity on the dry layer.
    const opacity = this.isDried() ? 0.8 : (1.0 - (this.age / this.maxAge) * 0.2);
    if (opacity <= 0) return;

    ctx.save();
    ctx.beginPath();
    
    // Build path using deformed offsets
    for (let i = 0; i < this.numPoints; i++) {
      const angle = this.angles[i];
      const radius = this.currentRadius * this.offsets[i];
      const px = this.x + Math.cos(angle) * radius;
      const py = this.y + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.clip(); // Restrict grading and granulation within the deformed outline

    // 1. Draw soft radial gradient representing wet diffusion bleed
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.currentRadius * 1.2);
    const alpha = 0.18 * opacity; // Increased opacity for richer paint strokes
    
    grad.addColorStop(0, `rgba(${this.r}, ${this.g}, ${this.b}, ${alpha})`);
    grad.addColorStop(0.7, `rgba(${this.r}, ${this.g}, ${this.b}, ${alpha * 0.8})`);
    
    // Darker rim (watercolor pigment pooling at edges of water boundary)
    const rimAlpha = alpha * (1.3 + this.granularity * 0.8);
    grad.addColorStop(0.95, `rgba(${Math.max(0, this.r - 20)}, ${Math.max(0, this.g - 20)}, ${Math.max(0, this.b - 20)}, ${rimAlpha})`);
    grad.addColorStop(1, `rgba(${this.r}, ${this.g}, ${this.b}, 0)`);
    
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Draw micro-granulation texture (representing pigment graininess)
    if (this.granularity > 0.3) {
      ctx.fillStyle = `rgba(${Math.max(0, this.r - 30)}, ${Math.max(0, this.g - 30)}, ${Math.max(0, this.b - 30)}, ${0.015 * this.granularity * opacity})`;
      // Quick stipple simulation for granulation
      const granCount = Math.floor(this.currentRadius * 2);
      for (let k = 0; k < granCount; k++) {
        const randAngle = Math.random() * Math.PI * 2;
        const randDist = Math.random() * this.currentRadius;
        const gx = this.x + Math.cos(randAngle) * randDist;
        const gy = this.y + Math.sin(randAngle) * randDist;
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    ctx.restore();
  }
}

export class WatercolorEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Create an offscreen buffer canvas to store dried painting elements permanently
    // preventing canvas slowdown from rendering millions of path nodes
    this.dryCanvas = document.createElement('canvas');
    this.dryCtx = this.dryCanvas.getContext('2d');

    this.blobs = [];
    this.resize();
    this.clear();
    
    // Dynamic brush travel coordinate (drifts over time or is mapped)
    this.brushX = this.width / 2;
    this.brushY = this.height / 2;
    this.targetBrushX = this.width / 2;
    this.targetBrushY = this.height / 2;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    
    // Store dried contents before resize
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.dryCanvas.width;
    tempCanvas.height = this.dryCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.dryCanvas, 0, 0);

    // Apply dimensions to main canvas
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Apply to dry canvas buffer
    this.dryCanvas.width = this.width;
    this.dryCanvas.height = this.height;
    
    // Re-draw background & previous dry layers
    this.dryCtx.fillStyle = '#f8f6f0';
    this.dryCtx.fillRect(0, 0, this.width, this.height);
    this.dryCtx.drawImage(tempCanvas, 0, 0, this.width, this.height);
  }

  clear() {
    this.blobs = [];
    this.dryCtx.fillStyle = '#f8f6f0';
    this.dryCtx.fillRect(0, 0, this.width, this.height);
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  // Draw loop
  tick() {
    // 1. Move target brush coordinate slowly (smooth fluid drift)
    this.brushX += (this.targetBrushX - this.brushX) * 0.04;
    this.brushY += (this.targetBrushY - this.brushY) * 0.04;
    
    // Keep brush within window boundaries with safe margin
    if (Math.abs(this.brushX - this.targetBrushX) < 5 && Math.abs(this.brushY - this.targetBrushY) < 5) {
      this.targetBrushX = 100 + Math.random() * (this.width - 200);
      this.targetBrushY = 100 + Math.random() * (this.height - 200);
    }

    // 2. Draw dry canvas background
    this.ctx.drawImage(this.dryCanvas, 0, 0);

    // 3. Update & render all wet active blobs
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const blob = this.blobs[i];
      blob.update();
      blob.draw(this.ctx);

      // If dried up, commit it permanently to the dry canvas so it stops using computational power
      if (blob.isDried()) {
        blob.draw(this.dryCtx);
        this.blobs.splice(i, 1);
      }
    }
  }

  // Spawns a watercolor note/brushstroke, interpolating from the previous position to create a flow
  spawnStroke(note, volume, clarity, centroid) {
    const color = COLOR_PALETTE[note] || { r: 60, g: 71, b: 77 };
    const initialRadius = 25 + volume * 220; // Increased base stroke size

    // Keep track of last stroke coordinates to interpolate path (simulates brush movement)
    if (!this.lastStrokeX) {
      this.lastStrokeX = this.brushX;
      this.lastStrokeY = this.brushY;
    }

    const dist = Math.hypot(this.brushX - this.lastStrokeX, this.brushY - this.lastStrokeY);
    // Interpolate steps along the path if brush has moved
    const steps = Math.max(1, Math.min(8, Math.floor(dist / 15)));

    for (let s = 0; s <= steps; s++) {
      const t = steps > 0 ? s / steps : 0;
      const interpX = this.lastStrokeX + (this.brushX - this.lastStrokeX) * t;
      const interpY = this.lastStrokeY + (this.brushY - this.lastStrokeY) * t;
      
      const count = clarity < 0.6 ? 2 : 1; 
      
      for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * (initialRadius * 0.4);
        const offsetY = (Math.random() - 0.5) * (initialRadius * 0.4);
        
        const blob = new WatercolorBlob(
          interpX + offsetX,
          interpY + offsetY,
          color.r,
          color.g,
          color.b,
          initialRadius * (0.7 + Math.random() * 0.5),
          1.0,
          centroid
        );
        this.blobs.push(blob);
      }
    }

    // Save position for next flow connection
    this.lastStrokeX = this.brushX;
    this.lastStrokeY = this.brushY;

    // Jump target coordinate slightly to keep the artwork moving
    this.targetBrushX = Math.max(100, Math.min(this.width - 100, this.targetBrushX + (Math.random() - 0.5) * 300));
    this.targetBrushY = Math.max(100, Math.min(this.height - 100, this.targetBrushY + (Math.random() - 0.5) * 300));
  }
}
