import * as THREE from "three";

export const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 4294967296;
  };
};

export type Ctx = CanvasRenderingContext2D;

export const canvasTex = (w: number, h: number, draw: (g: Ctx, w: number, h: number) => void, opts: { repeat?: boolean; srgb?: boolean } = {}) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
};

// value noise for speckles
export const speckle = (g: Ctx, w: number, h: number, n: number, color: string, rmin: number, rmax: number, seed: number, alpha = 0.25) => {
  const R = rng(seed);
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.4 + R() * 0.6);
    const r = rmin + R() * (rmax - rmin);
    g.beginPath();
    g.ellipse(R() * w, R() * h, r, r * (0.6 + R() * 0.5), R() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
};

// soft painterly mottling: many large low-alpha blobs
export const mottle = (g: Ctx, w: number, h: number, colors: string[], n: number, seed: number, alpha = 0.08, rmin = 0.05, rmax = 0.2) => {
  const R = rng(seed);
  g.save();
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * (0.5 + R());
    g.fillStyle = colors[Math.floor(R() * colors.length)];
    const r = (rmin + R() * (rmax - rmin)) * Math.max(w, h);
    const x = R() * w, y = R() * h;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, g.fillStyle as string);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    // wrap copies for tiling
    for (const [dx, dy] of [[w, 0], [-w, 0], [0, h], [0, -h]]) {
      if (x + dx - r < w && x + dx + r > 0 && y + dy - r < h && y + dy + r > 0) {
        const g2 = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g2.addColorStop(0, colors[0]);
        g2.addColorStop(1, "rgba(0,0,0,0)");
      }
    }
  }
  g.restore();
};

// a hand-drawn wobbly line
export const inkLine = (g: Ctx, pts: [number, number][], width: number, color: string, seed = 1, wob = 0.6) => {
  const R = rng(seed);
  g.save();
  g.strokeStyle = color;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    g.lineWidth = width * (0.75 + R() * 0.5);
    g.beginPath();
    g.moveTo(x0 + (R() - 0.5) * wob, y0 + (R() - 0.5) * wob);
    const mx = (x0 + x1) / 2 + (R() - 0.5) * wob * 2, my = (y0 + y1) / 2 + (R() - 0.5) * wob * 2;
    g.quadraticCurveTo(mx, my, x1 + (R() - 0.5) * wob, y1 + (R() - 0.5) * wob);
    g.stroke();
  }
  g.restore();
};

export const hex = (c: string) => new THREE.Color(c);

export const shade = (c: string, k: number) => {
  const col = new THREE.Color(c);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  col.setHSL(hsl.h, Math.min(1, hsl.s * (k < 1 ? 1.08 : 0.95)), Math.max(0, Math.min(1, hsl.l * k)));
  return "#" + col.getHexString();
};
