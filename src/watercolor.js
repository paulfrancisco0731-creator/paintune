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
  constructor(x, y, r, g, b, initialRadius, velocityX, velocityY, centroid) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.g = g;
    this.b = b;
    this.baseRadius = initialRadius;
    this.currentRadius = initialRadius * 0.4; // Start narrow like a brush tip contact
    
    // Physics and life loops
    this.age = 0;
    this.maxAge = 40 + Math.random() * 30; // Shorter diffusion lifespan for fluid brush motion
    
    // Flow/drift velocity mapping (moves with the velocity vector of the brush)
    this.vx = velocityX * 0.4;
    this.vy = velocityY * 0.4;
    
    // Bleed / capillary action factors
    this.bleedDirection = Math.random() * Math.PI * 2;
    this.bleedForce = 0.5 + Math.random() * 1.5;
    this.granularity = centroid; // High pitch = more granular pigment deposition

    // Detailed organic contouring (128 steps for extreme organic fidelity)
    this.numPoints = 96;
    this.angles = [];
    this.offsets = [];
    this.velocities = []; // dynamic bleeding points
    
    const seed = Math.random() * 1000;
    for (let i = 0; i < this.numPoints; i++) {
      const angle = (i / this.numPoints) * Math.PI * 2;
      this.angles.push(angle);
      
      // Seed noise for natural non-circular paint expansion
      const nx = Math.cos(angle);
      const ny = Math.sin(angle);
      const noiseVal = simplex.noise2D(nx * 1.8 + seed, ny * 1.8 + seed);
      
      this.offsets.push(0.9 + noiseVal * 0.2);
      this.velocities.push(0.01 + Math.random() * 0.04);
    }
  }

  update() {
    this.age++;
    if (this.age < this.maxAge) {
      const progress = this.age / this.maxAge;
      
      // 1. Move the center along the brush drag direction (fades out as brush lifts)
      this.x += this.vx * (1 - progress);
      this.y += this.vy * (1 - progress);
      
      // 2. Expand the wetness blob (flow diffusion rate)
      const expansion = Math.pow(progress, 0.4) * (this.baseRadius * 0.75);
      this.currentRadius = (this.baseRadius * 0.25) + expansion;
      
      // 3. Bleed contours as paint flows into paper fibers (capillary action)
      for (let i = 0; i < this.numPoints; i++) {
        const angle = this.angles[i];
        
        // Simplex turbulence at contour boundaries
        const nx = Math.cos(angle);
        const ny = Math.sin(angle);
        const flowNoise = simplex.noise2D(nx * 3.0 + this.age * 0.05, ny * 3.0 + this.age * 0.05) * 0.03;
        
        // Bleed direction affinity (gravitational / capillary bleed)
        const directionalFlow = Math.cos(angle - this.bleedDirection) * 0.04 * this.bleedForce;
        
        this.offsets[i] += (this.velocities[i] + flowNoise + directionalFlow) * (1 - progress * 0.95);
      }
    }
  }

  isDried() {
    return this.age >= this.maxAge;
  }

  draw(ctx) {
    const progress = this.age / this.maxAge;
    // Opacity fades as paint is absorbed into paper teeth
    const opacity = this.isDried() ? 0.9 : Math.max(0.1, 1.0 - progress * 0.2);
    if (opacity <= 0) return;

    ctx.save();
    ctx.beginPath();
    
    // Draw organic deformed contour path
    for (let i = 0; i < this.numPoints; i++) {
      const angle = this.angles[i];
      const r = this.currentRadius * this.offsets[i];
      const px = this.x + Math.cos(angle) * r;
      const py = this.y + Math.sin(angle) * r;
      
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.clip(); // Ensure all painting is masked to the fluid edges

    // Draw wet color gradient to represent natural pooling
    const grad = ctx.createRadialGradient(
      this.x - this.currentRadius * 0.1, // Offset center to simulate directional light/pools
      this.y - this.currentRadius * 0.1, 
      0, 
      this.x, 
      this.y, 
      this.currentRadius
    );

    const baseAlpha = 0.28 * opacity; // Strong visible opacity
    
    grad.addColorStop(0, `rgba(${this.r}, ${this.g}, ${this.b}, ${baseAlpha * 0.65})`);
    grad.addColorStop(0.65, `rgba(${this.r}, ${this.g}, ${this.b}, ${baseAlpha * 0.5})`);
    // Watercolor edges pool pigments forming a darker ring
    const rimAlpha = baseAlpha * (1.6 + this.granularity * 0.6);
    grad.addColorStop(0.92, `rgba(${Math.max(0, this.r - 28)}, ${Math.max(0, this.g - 28)}, ${Math.max(0, this.b - 28)}, ${rimAlpha})`);
    grad.addColorStop(1, `rgba(${this.r}, ${this.g}, ${this.b}, 0)`);
    
    ctx.fillStyle = grad;
    ctx.fill();

    // Speckled grain deposition
    if (this.granularity > 0.3) {
      ctx.fillStyle = `rgba(${Math.max(0, this.r - 30)}, ${Math.max(0, this.g - 30)}, ${Math.max(0, this.b - 30)}, ${0.03 * this.granularity * opacity})`;
      const numGrains = Math.floor(this.currentRadius * 1.5);
      for (let k = 0; k < numGrains; k++) {
        const theta = Math.random() * Math.PI * 2;
        const rad = Math.random() * this.currentRadius;
        ctx.fillRect(this.x + Math.cos(theta) * rad, this.y + Math.sin(theta) * rad, 1.2, 1.2);
      }
    }

    ctx.restore();
  }
}

export class WatercolorEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.dryCanvas = document.createElement('canvas');
    this.dryCtx = this.dryCanvas.getContext('2d');

    this.blobs = [];
    
    // Smooth coordinate tracking for brush flow physics
    this.brushX = 0;
    this.brushY = 0;
    this.lastBrushX = 0;
    this.lastBrushY = 0;
    
    this.targetBrushX = 0;
    this.targetBrushY = 0;
    
    this.resize();
    this.clear();
    
    // Initialise coordinates to canvas center
    this.brushX = this.width / 2;
    this.brushY = this.height / 2;
    this.lastBrushX = this.brushX;
    this.lastBrushY = this.brushY;
    
    this.targetBrushX = this.brushX;
    this.targetBrushY = this.brushY;
  }

  resize() {
    // Responsive bounds matching wrapper bounds
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.dryCanvas.width;
    tempCanvas.height = this.dryCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.dryCanvas, 0, 0);

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.dryCanvas.width = this.width;
    this.dryCanvas.height = this.height;
    
    this.dryCtx.fillStyle = '#f5f2eb'; // Warm watercolor paper tone
    this.dryCtx.fillRect(0, 0, this.width, this.height);
    this.dryCtx.drawImage(tempCanvas, 0, 0, this.width, this.height);
  }

  clear() {
    this.blobs = [];
    this.dryCtx.fillStyle = '#f5f2eb';
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
      
      const vx = (this.brushX - this.lastStrokeX) / (steps || 1);
      const vy = (this.brushY - this.lastStrokeY) / (steps || 1);
      const count = clarity < 0.6 ? 2 : 1;

      for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * (initialRadius * 0.45);
        const offsetY = (Math.random() - 0.5) * (initialRadius * 0.45);
        
        const blob = new WatercolorBlob(
          interpX + offsetX,
          interpY + offsetY,
          color.r,
          color.g,
          color.b,
          initialRadius * (0.8 + Math.random() * 0.4),
          vx,
          vy,
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
