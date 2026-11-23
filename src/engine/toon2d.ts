// 2D toon character drawing (Canvas 2D) in the Ricks Clips style.
// Measured rules: bun head W:H 0.95-1.08 with flat chin + flat top-right shoulder, bulges right-middle & lower-left;
// brush outline 4-4.5 % of head width on shadow/bottom side, ~1 % (broken) on the lit top-right; ink #3e3941;
// head fill #fcf9f0, soft shadow side 5-8 % darker; limbs = dark strokes ~4 % of head width with cream rim.
import { rng } from "./tex";

export type G = CanvasRenderingContext2D;
export type V = [number, number];

export let INK = "#3e3941";
export let HEAD = "#fcf9f0";
// per-composition style (the accepted 1:1 test uses the defaults; the film calls setToonStyle(FILM_TOON))
export const STYLE = { outlineK: 0.13, minK: 0.12, shade: "rgba(150,140,175,0.12)", limbScale: 1, limbRim: true, footScale: 1, round: 0, noise: 0.15 };
export const setToonStyle = (s: Partial<typeof STYLE> & { ink?: string; head?: string }) => { if (s.ink) INK = s.ink; if (s.head) HEAD = s.head; Object.assign(STYLE, s); };
export const DEFAULT_TOON = { ink: "#3e3941", head: "#fcf9f0", outlineK: 0.13, minK: 0.12, shade: "rgba(150,140,175,0.12)", limbScale: 1, limbRim: true, footScale: 1, round: 0, noise: 0.15 };
export const FILM_TOON = { ink: "#2e1c2c", head: "#fcf9f0", outlineK: 0.115, minK: 0.28, shade: "rgba(150,130,150,0.16)", limbScale: 1.2, limbRim: false, footScale: 1.5, round: 0.32, noise: 0.05 };   // v6: plum variable ink and a bun head (guide), was #141017 / round 0.78

// closed Catmull-Rom sampled polyline
export const smoothClosed = (pts: V[], per = 18): V[] => {
  const out: V[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
};
export const smoothOpen = (pts: V[], per = 14): V[] => {
  const out: V[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]);
  return out;
};

const path = (g: G, pts: V[], close = true) => {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
};

// Brush outline: variable width ring around a closed curve. Thick where the outward normal points to `shadowDir`.
export const brushOutline = (g: G, pts: V[], base: number, opts: { shadowDir?: V; minK?: number; color?: string; seed?: number; inner?: number } = {}) => {
  const sd = opts.shadowDir || [0.62, 0.78];
  const minK = opts.minK ?? 0.22;
  const R = rng(opts.seed || 7);
  const n = pts.length;
  // orientation sign (so normals point outward)
  let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1;
  const outer: V[] = [], inner: V[] = [];
  let noise = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    const nx = ty * sgn, ny = -tx * sgn;
    const d = nx * sd[0] + ny * sd[1];
    const k = minK + (1 - minK) * smoothstep(-0.45, 0.75, d);
    noise = noise * 0.85 + (R() - 0.5) * STYLE.noise;
    const w = base * k * (1 + noise);
    const fin = opts.inner ?? 0.45;
    outer.push([pts[i][0] + nx * w * (1 - fin), pts[i][1] + ny * w * (1 - fin)]);
    inner.push([pts[i][0] - nx * w * fin, pts[i][1] - ny * w * fin]);
  }
  g.save();
  g.fillStyle = opts.color || INK;
  g.beginPath();
  g.moveTo(outer[0][0], outer[0][1]);
  for (const p of outer) g.lineTo(p[0], p[1]);
  g.closePath();
  g.moveTo(inner[0][0], inner[0][1]);
  for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i][0], inner[i][1]);
  g.closePath();
  g.fill("evenodd");
  g.restore();
};

export const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// unit bun head control points (y down): uneven bun, bulges upper-left, tapers to lower-right
export const headShape = (seed: number, wh = 1.02): V[] => {
  const R = rng(seed);
  const j = () => (R() - 0.5) * 0.06;
  const raw: V[] = [
    [-0.12, -1.02], [0.42, -0.95], [0.8, -0.66],
    [0.98, -0.18], [0.94, 0.24], [0.72, 0.62],
    [0.34, 0.86], [-0.16, 0.92],
    [-0.62, 0.8], [-0.98, 0.42],
    [-1.08, -0.1], [-0.92, -0.62], [-0.56, -0.94],
  ];
  return raw.map(([x, y]) => { const a = Math.atan2(y, x); const cx = Math.cos(a) * 0.98, cy = Math.sin(a) * 0.98; const k = STYLE.round; return [((x + j()) * (1 - k) + cx * k) * wh, (y + j()) * (1 - k) + cy * k] as V; });
};

export type Face = {
  eyes?: "half" | "open" | "closed" | "ring" | "happy" | "squint";
  brows?: "flat" | "angry" | "worried" | "up" | "smug" | "none";
  mouth?: "line" | "smirk" | "grin" | "o" | "frown" | "smile" | "teeth" | "open";
  look?: V;
  blink?: number;
  sweat?: boolean;
  turn?: number; // -1..1 three-quarter turn
};

export const drawHead = (g: G, cx: number, cy: number, Rw: number, seed: number, face: Face, opts: { fill?: string; shade?: string; beard?: "wedge" | "goatee" | "none"; mustache?: boolean; extraBeforeOutline?: (g: G) => void; tilt?: number } = {}) => {
  const shape = headShape(seed);
  const tilt = opts.tilt ?? 0.22;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const pts = smoothClosed(shape, 16).map(([x, y]) => [cx + (x * ct - y * st) * Rw, cy + (x * st + y * ct) * Rw * 0.98] as V);
  const fill = opts.fill || HEAD;
  g.save();
  path(g, pts);
  g.fillStyle = fill;
  g.fill();
  g.clip();
  // shadow crescent along the lower-right
  g.fillStyle = opts.shade || STYLE.shade;
  g.beginPath();
  g.rect(cx - Rw * 2, cy - Rw * 2, Rw * 4, Rw * 4);
  g.ellipse(cx - Rw * 0.1, cy - Rw * 0.12, Rw * 1.0, Rw * 0.98, 0, 0, Math.PI * 2, true);
  g.fill();
  g.restore();
  if (opts.extraBeforeOutline) opts.extraBeforeOutline(g);
  brushOutline(g, pts, Rw * STYLE.outlineK, { seed, minK: STYLE.minK, shadowDir: [0.7, 0.71] });
  const turn = face.turn || 0;
  drawFace(g, cx + turn * Rw * 0.24, cy, Rw, face, opts);
  if (opts.beard === "wedge") drawBeardWedge(g, cx + turn * Rw * 0.2, cy, Rw, seed, turn);
  return pts;
};

export const drawBeardWedge = (g: G, cx: number, cy: number, Rw: number, seed: number, turn: number) => {
  const top = cy + Rw * 0.42, half = Rw * 0.55;
  const tip: V = [cx - Rw * 0.32 - turn * Rw * 0.1, cy + Rw * 1.55];
  g.save();
  g.beginPath();
  g.moveTo(cx - half, top + Rw * 0.04);
  g.quadraticCurveTo(cx - Rw * 0.05, top + Rw * 0.16, cx + half, top + Rw * 0.02);
  g.quadraticCurveTo(cx + half * 0.7, top + Rw * 0.6, tip[0], tip[1]);
  g.quadraticCurveTo(cx - half * 0.95, top + Rw * 0.5, cx - half, top + Rw * 0.04);
  g.closePath();
  g.fillStyle = "#fbf9f4";
  g.fill();
  g.strokeStyle = INK; g.lineWidth = Rw * 0.05; g.lineJoin = "round"; g.stroke();
  g.clip();
  g.strokeStyle = "rgba(120,110,130,0.35)"; g.lineWidth = Rw * 0.022; g.lineCap = "round";
  for (let i = 0; i < 3; i++) { const x0 = cx - Rw * 0.25 + i * Rw * 0.22; g.beginPath(); g.moveTo(x0, top + Rw * 0.2); g.lineTo(x0 + (tip[0] - x0) * 0.55, top + Rw * 0.75); g.stroke(); }
  g.restore();
  void seed;
};

export const drawFace = (g: G, cx: number, cy: number, Rw: number, f: Face, opts: { mustache?: boolean; beard?: string } = {}) => {
  const ex = Rw * 0.3, ey = cy - Rw * 0.05;
  const look = f.look || [0, 0];
  const blink = f.blink || 0;
  g.save();
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineCap = "round";
  const eye = (sx: number) => {
    const x = cx + sx * ex * (1 - Math.abs(f.turn || 0) * 0.12), y = ey;
    const px = look[0] * Rw * 0.05, py = look[1] * Rw * 0.03;
    const type = blink > 0.5 ? "closed" : f.eyes || "half";
    if (type === "closed") { g.lineWidth = Rw * 0.05; g.beginPath(); g.moveTo(x - Rw * 0.11, y + Rw * 0.02); g.lineTo(x + Rw * 0.11, y + Rw * 0.02); g.stroke(); return; }
    if (type === "happy") { g.lineWidth = Rw * 0.05; g.beginPath(); g.arc(x, y + Rw * 0.06, Rw * 0.1, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); return; }
    if (type === "squint") { g.lineWidth = Rw * 0.05; g.beginPath(); g.moveTo(x - sx * Rw * 0.1, y - Rw * 0.06); g.lineTo(x + sx * Rw * 0.08, y); g.lineTo(x - sx * Rw * 0.1, y + Rw * 0.06); g.stroke(); return; }
    if (type === "ring") {
      g.lineWidth = Rw * 0.04; g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(x, y, Rw * 0.13, Rw * 0.14, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(x + px, y + py, Rw * 0.05, 0, 7); g.fill(); return;
    }
    const lidY = y - Rw * 0.02 + blink * Rw * 0.06;
    g.save();
    g.fillStyle = "#2a2320";
    g.beginPath(); g.ellipse(x + px, lidY + Rw * 0.005, Rw * 0.105, Rw * (type === "open" ? 0.14 : 0.12), 0, 0, Math.PI); g.closePath(); g.fill();
    g.restore();
    g.lineWidth = Rw * 0.05;
    g.beginPath(); g.moveTo(x - Rw * 0.15, lidY + Rw * 0.01); g.quadraticCurveTo(x, lidY - Rw * 0.02, x + Rw * 0.15, lidY + Rw * 0.01); g.stroke();
  };
  eye(-1); eye(1);
  const bw = f.brows || "flat";
  if (bw !== "none") {
    const by = ey - Rw * 0.135;
    const brow = (sx: number) => {
      const xc = cx + sx * ex;
      const x0 = xc - sx * Rw * 0.17, x1 = xc + sx * Rw * 0.19;
      let y0 = by, y1 = by;
      if (bw === "angry") { y0 = by + Rw * 0.09; y1 = by - Rw * 0.06; }
      if (bw === "worried") { y0 = by - Rw * 0.08; y1 = by + Rw * 0.05; }
      if (bw === "up") { y0 = by - Rw * 0.12; y1 = by - Rw * 0.1; }
      if (bw === "smug") { if (sx > 0) { y0 = by - Rw * 0.13; y1 = by - Rw * 0.17; } else { y0 = by + Rw * 0.03; y1 = by; } }
      const th = Rw * 0.085;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - th * 1.3, x1, y1 - th * 0.2);
      g.lineTo(x1, y1);
      g.lineTo(x0, y0 + th * 0.1);
      g.closePath(); g.fill();
      g.lineWidth = Rw * 0.03; g.stroke();
    };
    brow(-1); brow(1);
  }
  const my = cy + Rw * 0.34;
  const mt = f.mouth || "line";
  if (opts.mustache) {
    g.beginPath();
    g.moveTo(cx, my - Rw * 0.14);
    g.bezierCurveTo(cx - Rw * 0.22, my - Rw * 0.24, cx - Rw * 0.48, my - Rw * 0.06, cx - Rw * 0.62, my - Rw * 0.22);
    g.bezierCurveTo(cx - Rw * 0.56, my + Rw * 0.08, cx - Rw * 0.24, my + Rw * 0.04, cx, my - Rw * 0.03);
    g.bezierCurveTo(cx + Rw * 0.24, my + Rw * 0.04, cx + Rw * 0.56, my + Rw * 0.08, cx + Rw * 0.62, my - Rw * 0.22);
    g.bezierCurveTo(cx + Rw * 0.48, my - Rw * 0.06, cx + Rw * 0.22, my - Rw * 0.24, cx, my - Rw * 0.14);
    g.fill();
  }
  const mo = opts.mustache ? Rw * 0.1 : 0;
  g.lineWidth = Rw * 0.045;
  if (mt === "line") { g.beginPath(); g.moveTo(cx - Rw * 0.08, my + mo); g.lineTo(cx + Rw * 0.08, my + mo); g.stroke(); }
  if (mt === "smirk") { g.beginPath(); g.moveTo(cx - Rw * 0.1, my + mo + Rw * 0.01); g.quadraticCurveTo(cx + Rw * 0.05, my + mo + Rw * 0.05, cx + Rw * 0.16, my + mo - Rw * 0.05); g.stroke(); }
  if (mt === "frown") { g.beginPath(); g.moveTo(cx - Rw * 0.1, my + mo + Rw * 0.03); g.quadraticCurveTo(cx, my + mo - Rw * 0.04, cx + Rw * 0.1, my + mo + Rw * 0.03); g.stroke(); }
  if (mt === "smile") { g.beginPath(); g.moveTo(cx - Rw * 0.14, my + mo - Rw * 0.02); g.quadraticCurveTo(cx, my + mo + Rw * 0.1, cx + Rw * 0.14, my + mo - Rw * 0.02); g.stroke(); }
  if (mt === "o") { g.beginPath(); g.ellipse(cx, my + mo - Rw * 0.04, Rw * 0.07, Rw * 0.035, 0, 0, 7); g.fill(); }
  if (mt === "open") {
    g.beginPath(); g.moveTo(cx - Rw * 0.2, my + mo - Rw * 0.04); g.quadraticCurveTo(cx, my + mo - Rw * 0.02, cx + Rw * 0.2, my + mo - Rw * 0.04); g.quadraticCurveTo(cx + Rw * 0.12, my + mo + Rw * 0.2, cx, my + mo + Rw * 0.2); g.quadraticCurveTo(cx - Rw * 0.12, my + mo + Rw * 0.2, cx - Rw * 0.2, my + mo - Rw * 0.04); g.closePath(); g.fill();
    g.fillStyle = "#d9677a"; g.beginPath(); g.ellipse(cx, my + mo + Rw * 0.14, Rw * 0.08, Rw * 0.04, 0, 0, 7); g.fill();
  }
  if (mt === "grin" || mt === "teeth") {
    const w = Rw * (mt === "grin" ? 0.4 : 0.28), h = Rw * 0.18;
    const x0 = cx - w / 2, y0 = my + mo - h * 0.35;
    g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, y0 - Rw * 0.03, x0 + w, y0); g.quadraticCurveTo(x0 + w, y0 + h, cx, y0 + h); g.quadraticCurveTo(x0, y0 + h, x0, y0); g.closePath();
    g.fill(); g.lineWidth = Rw * 0.04; g.stroke();
    g.lineWidth = Rw * 0.022;
    for (let i = 1; i < 4; i++) { const x = x0 + (w * i) / 4; g.beginPath(); g.moveTo(x, y0 + Rw * 0.01); g.lineTo(x, y0 + h * 0.95); g.stroke(); }
    g.beginPath(); g.moveTo(x0 + w * 0.05, y0 + h * 0.48); g.lineTo(x0 + w * 0.95, y0 + h * 0.48); g.stroke();
  }
  if (f.sweat) {
    const sx = cx + Rw * 0.78, sy = cy - Rw * 0.4;
    g.fillStyle = "#9bd0f0"; g.lineWidth = Rw * 0.03;
    g.beginPath(); g.moveTo(sx, sy - Rw * 0.18); g.quadraticCurveTo(sx + Rw * 0.11, sy, sx, sy + Rw * 0.07); g.quadraticCurveTo(sx - Rw * 0.11, sy, sx, sy - Rw * 0.18); g.fill(); g.stroke();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(sx - Rw * 0.02, sy - Rw * 0.01, Rw * 0.022, 0, 7); g.fill();
  }
  g.restore();
};

// filled shape with brush outline and optional shade/rim
export const blobFill = (g: G, pts: V[], fill: string, opts: { shade?: string; shadeFrom?: V; outline?: number; rim?: string; seed?: number; minK?: number } = {}) => {
  g.save();
  path(g, pts);
  g.fillStyle = fill;
  g.fill();
  if (opts.shade) {
    g.clip();
    // shadow on the right side (scene light from the left/front in v3 close-ups), hard-edged band
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    g.fillStyle = opts.shade;
    g.beginPath();
    g.ellipse(x1 + (x1 - x0) * 0.25, (y0 + y1) / 2, (x1 - x0) * 0.52, (y1 - y0) * 0.75, 0, 0, 7);
    g.fill();
  }
  g.restore();
  if (opts.rim) {
    g.save(); path(g, pts); g.clip();
    g.strokeStyle = opts.rim; g.lineWidth = (opts.outline || 8) * 0.9;
    g.translate(-(opts.outline || 8) * 0.55, 0);
    path(g, pts); g.stroke();
    g.restore();
  }
  if (opts.outline) brushOutline(g, pts, opts.outline, { seed: opts.seed || 3, minK: opts.minK ?? 0.35, shadowDir: [0.62, 0.78] });
};

// rubber-hose limb: dark stroke with a thin cream rim on one side
export const limb = (g: G, pts: V[], w: number, opts: { color?: string; rim?: string | null; cap?: CanvasLineCap } = {}) => {
  const sm = smoothOpen(pts, 10);
  g.save();
  g.lineCap = opts.cap || "round";
  g.lineJoin = "round";
  g.strokeStyle = opts.color || INK;
  w *= STYLE.limbScale;
  g.lineWidth = w;
  path(g, sm, false);
  g.stroke();
  if (opts.rim !== null && STYLE.limbRim) {
    g.strokeStyle = opts.rim || "rgba(255,244,226,0.85)";
    g.lineWidth = w * 0.28;
    g.translate(-w * 0.55, 0);
    path(g, sm, false);
    g.stroke();
  }
  g.restore();
};

export const foot = (g: G, x: number, y: number, w: number, dir = 1) => {
  g.save();
  w *= STYLE.footScale; y -= w * 0.4;
  g.strokeStyle = INK; g.lineCap = "round"; g.lineWidth = w;
  g.beginPath(); g.moveTo(x, y - w * 0.3); g.lineTo(x + dir * w * 2.6, y); g.stroke();
  g.restore();
};

export { path };
