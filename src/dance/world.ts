import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { World } from "../engine/Stage";
import { rng, canvasTex } from "../engine/tex";
import { PersonSprite, Look, CW, CH, FOOT } from "../film/person";
import { NDMaterial } from "../engine/post";

export const smooth = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x: number, z: number) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v); };
const fbm = (x: number, z: number) => vnoise(x * 0.04, z * 0.04) + vnoise(x * 0.11, z * 0.11) * 0.45 + vnoise(x * 0.3, z * 0.3) * 0.1;

// ---------------- layout (metres) ----------------
export const HALL = { x: 700, z: 0 }; // council hall interior lives far east, off the terrain
export const CHAPEL = { x: 38, z: 188 };
export const ALLEY = { x: -260, z: 260 }; // hunger set on its own plateau
export const ROAD: [number, number][] = [[0, 70], [0, 120], [4, 140], [16, 152], [30, 166], [40, 178], [38, 186]];
const distToRoad = (x: number, z: number) => { let best = 1e9; for (let i = 0; i < ROAD.length - 1; i++) { const [ax, az] = ROAD[i], [bx, bz] = ROAD[i + 1]; const dx = bx - ax, dz = bz - az; const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k)); } return best; };
export const terrainH = (x: number, z: number) => {
  const r = Math.hypot(x, z);
  const rise = Math.pow(Math.max(0, r - 135) / 150, 1.35) * 46;
  const n = (fbm(x + 30, z - 11) - 0.75) * 9 * smooth((r - 120) / 40);
  let h = rise + n;
  const dr = distToRoad(x, z); if (r > 110) h = lerp(h, h - 0.5, 1 - smooth(dr / 4)); // road bed
  const pa = Math.hypot(x - ALLEY.x, z - ALLEY.z); h = lerp(0.2, h, smooth((pa - 42) / 30));
  const pc = Math.hypot(x - CHAPEL.x, z - CHAPEL.z); h = lerp(terrainH0(CHAPEL.x, CHAPEL.z) + 0.1, h, smooth((pc - 9) / 14));
  return h;
};
function terrainH0(x: number, z: number) { const r = Math.hypot(x, z); return Math.pow(Math.max(0, r - 135) / 150, 1.35) * 46; }

// ---------------- moods ----------------
export type Mood = { sky: string; skyTop: string; fog: string; fogN: number; fogF: number; sun: string; sunI: number; amb: string; ambI: number; grass: string; stars: number; night: number; sunDir: [number, number, number] };
export const MOODS: Record<string, Mood> = {
  morning: { sky: "#f6dcc0", skyTop: "#6fa6dc", fog: "#ecdcc8", fogN: 130, fogF: 760, sun: "#ffe2b8", sunI: 2.2, amb: "#a9c0e8", ambI: 1.05, grass: "#86ad63", stars: 0, night: 0, sunDir: [-50, 55, 50] },
  noon: { sky: "#cfe6f6", skyTop: "#4a92dc", fog: "#d4e6f2", fogN: 150, fogF: 900, sun: "#fff4dc", sunI: 2.4, amb: "#a8c8f0", ambI: 1.15, grass: "#7fb05a", stars: 0, night: 0, sunDir: [-20, 90, 30] },
  dusk: { sky: "#f0a878", skyTop: "#5a5fa8", fog: "#dca88c", fogN: 100, fogF: 700, sun: "#ff8c4a", sunI: 1.5, amb: "#8c86c0", ambI: 0.85, grass: "#a89a58", stars: 0.15, night: 0.35, sunDir: [70, 22, 40] },
  night: { sky: "#1c2a55", skyTop: "#050a1e", fog: "#17224a", fogN: 60, fogF: 520, sun: "#8aa6ff", sunI: 0.55, amb: "#4a5fa8", ambI: 0.8, grass: "#3a5a52", stars: 1, night: 1, sunDir: [-40, 60, -40] },
  dawn: { sky: "#f4c8c0", skyTop: "#6a86c0", fog: "#e4cfd6", fogN: 100, fogF: 700, sun: "#ffd9b0", sunI: 1.6, amb: "#a6b0dc", ambI: 0.95, grass: "#8fae6c", stars: 0.1, night: 0.15, sunDir: [-70, 20, 30] },
  gloom: { sky: "#c3bfc6", skyTop: "#7f869c", fog: "#bcb8c2", fogN: 60, fogF: 520, sun: "#e6dede", sunI: 1.0, amb: "#9ea4bc", ambI: 1.1, grass: "#7d8c68", stars: 0, night: 0.15, sunDir: [-30, 70, 20] },
  autumn: { sky: "#f2d0a0", skyTop: "#7e9ec8", fog: "#ecd6b4", fogN: 110, fogF: 760, sun: "#ffd2a0", sunI: 1.75, amb: "#b0b4d8", ambI: 1.0, grass: "#b4a24e", stars: 0, night: 0, sunDir: [-60, 38, 40] },
  hall: { sky: "#cfe6f6", skyTop: "#4a92dc", fog: "#6a5a4a", fogN: 40, fogF: 140, sun: "#fff0d0", sunI: 2.6, amb: "#d8b890", ambI: 0.75, grass: "#7fb05a", stars: 0, night: 0.5, sunDir: [-40, 40, 70] },
};
const mixMood = (a: Mood, b: Mood, k: number): Mood => {
  const c = (x: string, y: string) => "#" + new THREE.Color(x).lerp(new THREE.Color(y), k).getHexString();
  return { sky: c(a.sky, b.sky), skyTop: c(a.skyTop, b.skyTop), fog: c(a.fog, b.fog), fogN: lerp(a.fogN, b.fogN, k), fogF: lerp(a.fogF, b.fogF, k), sun: c(a.sun, b.sun), sunI: lerp(a.sunI, b.sunI, k), amb: c(a.amb, b.amb), ambI: lerp(a.ambI, b.ambI, k), grass: c(a.grass, b.grass), stars: lerp(a.stars, b.stars, k), night: lerp(a.night, b.night, k), sunDir: [0, 1, 2].map((i) => lerp(a.sunDir[i], b.sunDir[i], k)) as [number, number, number] };
};

// ---------------- the cast ----------------
const skin = ["side", "curly", "bald", "none"] as const;
const COATS = ["#8a4a2e", "#3e5f7a", "#6a7a3e", "#7a3e5a", "#b0763a", "#4a4f6a", "#9a5a3a", "#2f6a5a", "#a04a4a", "#5a4a3a"];
const DRESS = ["#b0443a", "#3a6a9a", "#7a9a4a", "#9a4a7a", "#d09a3a", "#4a8a8a", "#a06a4a", "#6a5aa0"];
const HAIRC = ["#4a2e1e", "#8a5a2a", "#2a2220", "#c4903a", "#6a3a2a", "#a0a0a0"];
export const FRAU: Look = { seed: 301, coat: "#e8dcc0", vest: "#c0392b", skirt: "#c0392b", hat: "bonnet", hairColor: "#f4ecd8", apron: undefined, trousers: "#4a3020" };
export const makeLook = (i: number): Look => {
  const R = rng(900 + i * 17);
  const woman = i % 2 === 1;
  const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)];
  if (woman) return { seed: 400 + i, coat: pick(COATS), vest: "#efe6d2", skirt: pick(DRESS), hat: R() > 0.35 ? "bonnet" : "none", hairColor: R() > 0.5 ? "#f0e8d6" : pick(HAIRC), hair: "side", trousers: "#4a3020", bodyW: 235 };
  const hat = pick(["cap", "cap", "bowler", "none", "none"] as const);
  return { seed: 400 + i, coat: pick(COATS), vest: "#e9e0cc", tie: R() > 0.6 ? "#c0392b" : undefined, hat, hairColor: pick(HAIRC), hair: pick(skin), trousers: pick(["#3a2f2a", "#2b3550", "#4a3a2a", "#3e4a3a"]), mustache: R() > 0.65, beard: R() > 0.85 ? "wedge" : "none", bodyW: 250 + Math.floor(R() * 30) };
};
export const OFFICIAL = (i: number): Look => ({ seed: 700 + i, coat: ["#6a2a3a", "#2a3a5a", "#3a2a4a", "#5a3a2a"][i % 4], vest: "#efe6d2", tie: "#d9a441", hat: "top", hairColor: "#9a9a9a", sideburns: i % 2 ? "#9a96a2" : undefined, hair: "bald", mustache: i % 3 === 0, trousers: "#2a2630", bodyW: 270 });
export const DOCTOR = (i: number): Look => ({ seed: 750 + i, coat: "#23232e", vest: "#efe6d2", tie: "#8a1c2a", hat: "bowler", hairColor: "#555", beard: i % 2 ? "wedge" : "none", glasses: i % 2 === 0, mustache: i % 2 === 1, trousers: "#23232e", bodyW: 260 });
export const THIN = (i: number): Look => ({ seed: 800 + i, coat: ["#6a5a4a", "#5a5a58", "#7a6a52"][i % 3], vest: "#b8ae98", hat: i % 2 ? "cap" : "none", hairColor: "#6a6a6a", hair: "side", trousers: "#3a3530", bodyW: 190, bodyH: 440 });
export const GUARD = (i: number): Look => ({ seed: 850 + i, coat: "#2c3e6e", vest: "#c0392b", tie: "#d9a441", hat: "spike", trousers: "#2b2d3e", mustache: true, bodyW: 270 });
export const PRIEST: Look = { seed: 880, coat: "#2a2630", vest: "#f2ecdc", hat: "none", hair: "bald", trousers: "#2a2630", skirt: "#2a2630", bodyW: 250 };

export type DWorld = World & {
  setMood: (a: string, b?: string, k?: number) => Mood;
  pool: PersonSprite[];
  crowd: { set: (list: [number, number, number, number, number][]) => void; mesh: THREE.InstancedMesh; setLight: (c: THREE.ColorRepresentation) => void };
  boards: Record<string, THREE.Mesh>;
  strings: THREE.LineSegments;
  leaves: THREE.Points;
  lampLights: THREE.PointLight[];
  hallLights: THREE.PointLight[];
  sunL: THREE.DirectionalLight;
  beam: THREE.Mesh;
  glow: (k: number) => void;
  redrawText: () => void;
  ground: THREE.Mesh;
};

// ---------------- textures ----------------
const T = "#4a3120";
const wallTex = (plaster: string, shutter: string, seed: number, flowers: boolean, door = false) => canvasTex(256, 256, (g, w, h) => {
  const R = rng(seed);
  g.fillStyle = plaster; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(80,60,40,${0.03 + R() * 0.05})`; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 9, 0, 7); g.fill(); }
  g.fillStyle = T; g.fillRect(0, 0, w, 15); g.fillRect(0, h - 15, w, 15); g.fillRect(0, 0, 13, h); g.fillRect(w - 13, 0, 13, h);
  g.strokeStyle = T; g.lineWidth = 12; g.lineCap = "butt";
  g.beginPath(); g.moveTo(13, h - 15); g.lineTo(64, 120); g.moveTo(w - 13, h - 15); g.lineTo(w - 64, 120); g.moveTo(13, 15); g.lineTo(52, 58); g.moveTo(w - 13, 15); g.lineTo(w - 52, 58); g.stroke();
  const wx = 82, wy = 66, ww = 92, wh = 104;
  g.fillStyle = T; g.fillRect(wx - 8, wy - 8, ww + 16, wh + 16);
  const gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, "#9ab4c4"); gr.addColorStop(1, "#4e6678"); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
  g.strokeStyle = T; g.lineWidth = 6; g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * 0.42); g.lineTo(wx + ww, wy + wh * 0.42); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(wx + 6, wy + 6, 14, wh * 0.36);
  for (const s of [-1, 1]) { const sx = s < 0 ? wx - 36 : wx + ww + 8; g.fillStyle = shutter; g.fillRect(sx, wy - 6, 28, wh + 12); g.strokeStyle = "rgba(40,24,16,0.75)"; g.lineWidth = 3; g.strokeRect(sx, wy - 6, 28, wh + 12); for (let y = wy + 4; y < wy + wh + 4; y += 14) { g.beginPath(); g.moveTo(sx + 3, y); g.lineTo(sx + 25, y); g.stroke(); } }
  if (flowers) { g.fillStyle = "#5a3a22"; g.fillRect(wx - 12, wy + wh + 2, ww + 24, 16); const cols = ["#d9433a", "#f08fa0", "#f4f0e0", "#e8b83a"]; for (let i = 0; i < 12; i++) { g.fillStyle = "#3f7a3a"; g.beginPath(); g.arc(wx - 6 + i * 9.5, wy + wh - 2, 7, 0, 7); g.fill(); g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(wx - 6 + i * 9.5 + 2, wy + wh - 8, 5, 0, 7); g.fill(); } }
  void door;
}, { repeat: true });
const roofTex = (base: string, dark: string, seed: number) => canvasTex(256, 256, (g, w, h) => {
  const R = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const rows = 8, rh = h / rows;
  for (let r = 0; r < rows; r++) for (let c = -1; c < 9; c++) { const x = c * 32 + (r % 2) * 16, y = r * rh; const k = R(); g.fillStyle = k < 0.33 ? base : k < 0.66 ? dark : "rgba(255,230,200,0.12)"; if (k >= 0.66) { g.fillStyle = base; } g.fillRect(x + 1, y + 1, 30, rh - 1); g.strokeStyle = "rgba(30,15,10,0.55)"; g.lineWidth = 2.5; g.beginPath(); g.arc(x + 16, y + rh * 0.1, 15, 0.1, Math.PI - 0.1); g.stroke(); g.fillStyle = `rgba(0,0,0,${R() * 0.1})`; g.fillRect(x, y, 32, rh); }
}, { repeat: true });
const cobbleTex = () => canvasTex(512, 512, (g, w, h) => {
  const R = rng(5);
  g.fillStyle = "#5e5249"; g.fillRect(0, 0, w, h);
  const cols = ["#a89a8c", "#b4a592", "#9a8d80", "#bcae9c", "#a19076", "#8f857a", "#b0a090"];
  for (let y = 0; y < h; y += 21) for (let x = -12; x < w; x += 25) { const ox = x + (R() - 0.5) * 4 + ((y / 21) % 2) * 12, oy = y + (R() - 0.5) * 3; g.fillStyle = cols[Math.floor(R() * cols.length)]; g.beginPath(); g.roundRect(ox + 1, oy + 1, 21 + R() * 2, 17 + R() * 2, 6); g.fill(); g.fillStyle = "rgba(255,255,255,0.14)"; g.beginPath(); g.ellipse(ox + 8, oy + 6, 6, 3, -0.3, 0, 7); g.fill(); g.fillStyle = `rgba(30,20,10,${0.05 + R() * 0.1})`; g.fillRect(ox + 1, oy + 10, 22, 8); }
}, { repeat: true });
const stoneTex = (seed: number, window: boolean) => canvasTex(256, 256, (g, w, h) => {
  const R = rng(seed);
  g.fillStyle = "#c7745e"; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) { g.strokeStyle = "rgba(90,40,30,0.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = ((y / 32) % 2) * 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${R() > 0.5 ? "255,220,200" : "70,30,30"},${0.04 + R() * 0.06})`; g.fillRect(R() * w, R() * h, 10 + R() * 30, 5 + R() * 10); }
  if (window) { g.fillStyle = "#2c3140"; g.beginPath(); g.moveTo(98, 232); g.lineTo(98, 90); g.quadraticCurveTo(98, 36, 128, 22); g.quadraticCurveTo(158, 36, 158, 90); g.lineTo(158, 232); g.closePath(); g.fill(); g.strokeStyle = "#8a4a3a"; g.lineWidth = 8; g.stroke(); g.strokeStyle = "#8a4a3a"; g.lineWidth = 5; g.beginPath(); g.moveTo(128, 30); g.lineTo(128, 232); g.moveTo(98, 150); g.lineTo(158, 150); g.stroke(); }
}, { repeat: true });
const slateTex = (seed: number, base: string) => canvasTex(256, 256, (g, w, h) => { const R = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 12; x < w; x += 24) { g.fillStyle = `rgba(0,0,0,${R() * 0.18})`; g.fillRect(x, y, 23, 15); g.strokeStyle = "rgba(0,30,20,0.4)"; g.strokeRect(x, y, 24, 16); } }, { repeat: true });
const woodTex = (a: string, b: string, seed: number) => canvasTex(256, 256, (g, w, h) => { const R = rng(seed); g.fillStyle = a; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = R() > 0.5 ? b : a; g.fillRect(x, 0, 30, h); g.strokeStyle = "rgba(30,15,5,0.55)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); for (let k = 0; k < 6; k++) { g.strokeStyle = "rgba(40,20,5,0.2)"; g.lineWidth = 1.5; const y = R() * h; g.beginPath(); g.moveTo(x + 4 + R() * 20, y); g.lineTo(x + 6 + R() * 20, y + 20 + R() * 60); g.stroke(); } } }, { repeat: true });
const stripeTex = (a: string, b: string) => canvasTex(128, 128, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, h); } g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(0, h - 10, w, 10); }, { repeat: true });

// ---------------- geometry helpers ----------------
const addColor = (geo: THREE.BufferGeometry, color: string) => { const g = geo.index ? geo.toNonIndexed() : geo; if (g.attributes.uv) g.deleteAttribute("uv"); if (!g.attributes.normal) g.computeVertexNormals(); const c = new THREE.Color(color); const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
const scaleUV = (g: THREE.BufferGeometry, ku: number, kv: number, from = 0, to = Infinity) => { const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = from; i < Math.min(to, uv.count); i++) uv.setXY(i, uv.getX(i) * ku, uv.getY(i) * kv); };
const boxT = (w: number, h: number, d: number) => { const g = new THREE.BoxGeometry(w, h, d); scaleUV(g, d / 3, h / 3, 0, 8); scaleUV(g, w / 3, d / 3, 8, 16); scaleUV(g, w / 3, h / 3, 16, 24); g.translate(0, h / 2, 0); return g; };

// ---------------- the builder ----------------
export const buildWorld = (W: number, H: number): DWorld => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 3000);
  const R = rng(1518);

  // lights
  const amb = new THREE.AmbientLight("#a8c8f0", 1);
  const hemi = new THREE.HemisphereLight("#aac8f0", "#d8c8b0", 0.55);
  const sun = new THREE.DirectionalLight("#fff0d8", 2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 320; sun.shadow.bias = -0.0005;
  scene.add(amb, hemi, sun, sun.target);
  const lampLights = [0, 1, 2].map(() => { const l = new THREE.PointLight("#ffb865", 0, 26, 1.5); scene.add(l); return l; });
  const hallLights = [0, 1, 2].map((i) => { const l = new THREE.PointLight("#ffc27a", 0, 17, 1.4); l.position.set(HALL.x + (i - 1) * 4.2, 4.6, HALL.z); scene.add(l); return l; });

  // sky dome
  const skyU = { top: { value: new THREE.Color("#5fa8dc") }, hor: { value: new THREE.Color("#cfe6f4") }, stars: { value: 0 } };
  const skyM = new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform float stars; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){ vec3 d=normalize(vP); float k=pow(clamp(d.y,0.0,1.0),0.5); vec3 c=mix(hor,top,k);
        vec2 g=floor(vec2(atan(d.x,d.z)*90.0, d.y*90.0)); float s=step(0.9965,h(g)); c+=vec3(s)*stars*smoothstep(0.08,0.3,d.y)*(0.6+0.4*h(g+3.0));
        gl_FragColor=vec4(c,1.0); }` });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), skyM); sky.userData.ndHide = true; sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  scene.fog = new THREE.Fog("#d4e6f2", 150, 900); scene.background = new THREE.Color("#cfe6f4");

  // ---- batched static geometry ----
  const batches = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const reg = (key: string, mat: () => THREE.Material) => { if (!batches.has(key)) batches.set(key, { mat: mat(), geos: [] }); return batches.get(key)!; };
  const vcMat = () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const vc = (geo: THREE.BufferGeometry, color: string) => reg("vc", vcMat).geos.push(addColor(geo, color));
  const tex = (key: string, mat: THREE.Material, geo: THREE.BufferGeometry) => { reg(key, () => mat).geos.push(geo.index ? geo.toNonIndexed() : geo); };
  const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) => { const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, y, z); g.applyMatrix4(m); return g; };

  const WALLS = [["#eadcc0", "#3f7a52", 1], ["#e0b878", "#8a2a2a", 2], ["#d9a08a", "#2f5f8a", 3], ["#b4c8c8", "#8a3a2a", 4], ["#f0e4c8", "#2f5a42", 5], ["#e3c89a", "#4a4f8a", 6]] as const;
  const wallMats = WALLS.map(([p, s, sd], i) => new THREE.MeshLambertMaterial({ map: wallTex(p, s, sd, i % 2 === 0) }));
  const roofCols: [string, string][] = [["#b4553a", "#8a3a28"], ["#5a6580", "#3e4860"], ["#9a5a44", "#744030"]];
  const roofMats = roofCols.map(([a, b], i) => new THREE.MeshLambertMaterial({ map: roofTex(a, b, 20 + i), side: THREE.DoubleSide }));

  const house = (cx: number, cz: number, w: number, d: number, floors: number, ry: number, variant: number, opts: { door?: boolean; ridgeFront?: boolean } = {}) => {
    const h = floors * 3;
    const v = variant % WALLS.length, rv = variant % roofMats.length;
    const rH = Math.min(w * 0.7, 7.5);
    const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(cx, 0, cz);
    const wallG = boxT(w, h, d); wallG.applyMatrix4(m); tex("wall" + v, wallMats[v], wallG);
    // gable triangles (front +z, back -z)
    for (const s of [1, -1]) {
      const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, rH);
      const gg = new THREE.ShapeGeometry(sh); const uv = gg.attributes.uv as THREE.BufferAttribute; const ps = gg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 3 + 0.5, ps.getY(i) / 3);
      if (s < 0) gg.rotateY(Math.PI);
      gg.translate(0, h, s * (d / 2 + 0.002));
      gg.applyMatrix4(m); tex("wall" + v, wallMats[v], gg);
    }
    // roof slopes
    const ov = 0.45, half = w / 2 + ov, L = Math.hypot(half, rH + 0.15), a = Math.atan2(rH + 0.15, half);
    for (const s of [-1, 1]) {
      const pg = new THREE.PlaneGeometry(L, d + 0.9); pg.rotateX(-Math.PI / 2); scaleUV(pg, L / 3, (d + 0.9) / 3);
      pg.rotateZ(s * -a); pg.translate(s * half / 2, h + (rH + 0.15) / 2 - 0.1, 0); pg.applyMatrix4(m); tex("roof" + rv, roofMats[rv], pg);
    }
    // timber under-eave band + chimney + door
    vc(place(new THREE.BoxGeometry(w + 0.2, 0.28, d + 0.2), 0, h - 0.1, 0, 0).applyMatrix4(m), T);
    if (floors > 2) vc(new THREE.BoxGeometry(w + 0.25, 0.3, d + 0.25).translate(0, 3.1, 0).applyMatrix4(m), T);
    vc(new THREE.BoxGeometry(0.9, 2.4, 0.9).translate(w * 0.28, h + rH * 0.55 + 1, -d * 0.2).applyMatrix4(m), "#8a6a58");
    if (opts.door !== false) { vc(new THREE.BoxGeometry(1.3, 2.4, 0.22).translate((R() - 0.5) * (w - 4), 1.2, d / 2 + 0.08).applyMatrix4(m), "#5a3a22"); vc(new THREE.BoxGeometry(1.9, 0.18, 0.7).translate(0, 0.09, d / 2 + 0.4).applyMatrix4(m), "#9a8e80"); }
  };

  // ---- ground ----
  const N = 200, SZ = 1000;
  const tg = new THREE.PlaneGeometry(SZ, SZ, N, N); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position as THREE.BufferAttribute; const cols = new Float32Array(tp.count * 3);
  const grass = new THREE.Color("#86ad63"), dirt = new THREE.Color("#b69a6e"), rockC = new THREE.Color("#8a8478");
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i); const y = terrainH(x, z); tp.setY(i, y);
    const r = Math.hypot(x, z); const road = 1 - smooth((distToRoad(x, z) - 1.6) / 1.8);
    const c = new THREE.Color().copy(grass).multiplyScalar(0.92 + 0.12 * vnoise(x * 0.3, z * 0.3) + (hash(x, z) - 0.5) * 0.04);
    c.lerp(rockC, smooth((y - 22) / 18) * 0.6);
    c.lerp(dirt, Math.max(road * (r > 100 ? 1 : 0), 1 - smooth((r - 96) / 20)));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  tg.setAttribute("color", new THREE.BufferAttribute(cols, 3)); tg.computeVertexNormals();
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const ground = new THREE.Mesh(tg, terrainMat); ground.receiveShadow = true; scene.add(ground);
  const cob = cobbleTex(); cob.repeat.set(100 / 4, 100 / 4);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(104, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: cob })); plaza.position.y = 0.03; plaza.receiveShadow = true;
  // uv of circle is 0..1: scale to world metres (4 m per tile)
  { const uv = plaza.geometry.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 65, uv.getY(i) * 65); cob.repeat.set(1, 1); }
  scene.add(plaza);
  // alley plateau floor (hunger set) and chapel yard
  const alleyFloor = new THREE.Mesh(new THREE.CircleGeometry(46, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: "#6e6558" })); alleyFloor.position.set(ALLEY.x, 0.25, ALLEY.z); alleyFloor.receiveShadow = true; scene.add(alleyFloor);

  // ---- the square: ring of houses with street gaps ----
  const SQ = { x0: -30, x1: 30, z0: -24, z1: 24 };
  let vi = 0;
  const row = (axis: "x" | "z", line: number, from: number, to: number, side: 1 | -1, gaps: [number, number][]) => {
    let p = from; const dep = 9;
    while (p < to - 5) {
      const w = 6 + Math.floor(R() * 5), fl = 3 + Math.floor(R() * 3);
      const c = p + w / 2; if (gaps.some(([a, b]) => c + w / 2 > a && c - w / 2 < b)) { p += 2; continue; }
      const off = line + side * (dep / 2);
      if (axis === "x") house(c, off, w, dep, fl, side > 0 ? Math.PI : 0, vi++);
      else house(off, c, w, dep, fl, side > 0 ? -Math.PI / 2 : Math.PI / 2, vi++);
      p += w + 0.4;
    }
  };
  row("x", SQ.z0, SQ.x0, SQ.x1, -1, [[-6, 6]]);                 // north row (front +z)
  row("x", SQ.z1, SQ.x0, SQ.x1, 1, [[-7, 7]]);                 // south row
  row("z", SQ.x0, SQ.z0, SQ.z1, -1, [[-6, 6]]);                // west row
  row("z", SQ.x1, SQ.z0, SQ.z1, 1, [[-30, -29]]);              // east row
  // fix: the lines above place centres on the wrong side for some rows; the square is open towards +/- so mirror via rotation already; blocks outside:
  for (let gi = -4; gi <= 4; gi++) for (let gj = -4; gj <= 4; gj++) {
    const bx = gi * 24, bz = gj * 24; if (Math.abs(bx) < 46 && Math.abs(bz) < 40) continue; if (Math.hypot(bx, bz) > 108) continue; if (Math.abs(bx) < 8 && bz < 0) continue; // street to the cathedral
    if (Math.abs(bx) < 30 && bz < -60) continue; if (Math.abs(bz) < 7 && bx < 0) continue; if (Math.abs(bx) < 7 && bz > 0 && bz < 110) continue;
    for (let k = 0; k < 4; k++) { const hx = bx + (k % 2 ? 6 : -6) + (R() - 0.5) * 2, hz = bz + (k < 2 ? -5 : 5) + (R() - 0.5) * 2; house(hx, hz, 7 + Math.floor(R() * 4), 8 + Math.floor(R() * 3), 2 + Math.floor(R() * 4), Math.floor(R() * 4) * Math.PI / 2, vi++, { door: false }); }
  }

  // street rows: west street (to the hills), south road, north street (to the cathedral)
  { let x = -32; while (x > -106) { const w = 6 + Math.floor(R() * 4); house(x - w / 2, -10.6, w, 9, 3 + Math.floor(R() * 3), 0, vi++); x -= w + 0.4; }
    x = -32; while (x > -106) { const w = 6 + Math.floor(R() * 4); house(x - w / 2, 10.6, w, 9, 3 + Math.floor(R() * 3), Math.PI, vi++); x -= w + 0.4; }
    let z = 34; while (z < 104) { const w = 6 + Math.floor(R() * 4); house(-10.6, z + w / 2, w, 9, 3 + Math.floor(R() * 3), Math.PI / 2, vi++); house(10.6, z + w / 2, w, 9, 3 + Math.floor(R() * 3), -Math.PI / 2, vi++); z += w + 0.4; }
    z = -34; while (z > -76) { const w = 6 + Math.floor(R() * 4); house(-10.6, z - w / 2, w, 9, 3 + Math.floor(R() * 3), Math.PI / 2, vi++); house(10.6, z - w / 2, w, 9, 3 + Math.floor(R() * 3), -Math.PI / 2, vi++); z -= w + 0.4; } }
  // ---- cathedral (north) ----
  const CZ = -86; const stoneM = new THREE.MeshLambertMaterial({ map: stoneTex(3, true) }), stoneP = new THREE.MeshLambertMaterial({ map: stoneTex(4, false) });
  const sBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat = stoneM, key = "st") => { const g = boxT(w, h, d); g.translate(x, y, z); tex(key, mat, g); };
  sBox(34, 38, 4, 0, 0, CZ, stoneP, "stp");                           // facade slab
  sBox(26, 28, 44, 0, 0, CZ - 24, stoneM, "st");                      // nave
  sBox(12, 66, 12, -10, 0, CZ, stoneM, "st");                         // spire tower
  sBox(12, 56, 12, 10, 0, CZ, stoneM, "st");                          // stub tower
  sBox(13.2, 1.6, 13.2, -10, 64, CZ, stoneP, "stp"); sBox(13.2, 1.6, 13.2, 10, 54, CZ, stoneP, "stp");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { vc(new THREE.ConeGeometry(0.7, 6, 6).translate(10 + sx * 5.2, 59.5, CZ + sz * 5.2), "#b86a56"); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) vc(new THREE.ConeGeometry(0.9, 8, 6).translate(-10 + sx * 5.0, 70, CZ + sz * 5.0), "#c7745e");
  { const sp = new THREE.ConeGeometry(5.0, 74, 8, 1); sp.translate(-10, 65 + 37, CZ); tex("stp", stoneP, scaleSpire(sp)); }
  function scaleSpire(g: THREE.BufferGeometry) { scaleUV(g, 3, 8); return g; }
  vc(new THREE.ConeGeometry(0.5, 6, 6).translate(-10, 142, CZ), "#c7745e");
  // nave roof (green copper) + buttresses
  { const sh = new THREE.Shape(); sh.moveTo(-14, 0); sh.lineTo(14, 0); sh.lineTo(0, 12); const gg = new THREE.ShapeGeometry(sh); gg.translate(0, 28, CZ - 1.9); vc(gg, "#a8a89a");
    const L = Math.hypot(14, 12), a = Math.atan2(12, 14); const slate = new THREE.MeshLambertMaterial({ map: slateTex(9, "#5f8f82"), side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const pg = new THREE.PlaneGeometry(L, 44.5); pg.rotateX(-Math.PI / 2); scaleUV(pg, L / 4, 44.5 / 4); pg.rotateZ(s * -a); pg.translate(s * 7, 34, CZ - 24); tex("slate", slate, pg); } }
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) sBox(2.2, 24, 2.2, s * 14.8, 0, CZ - 8 - i * 7, stoneP, "stp");
  // facade: rose window + three portals as one painted plane
  const facadeTex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = "#c7745e"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 40) { g.strokeStyle = "rgba(90,40,30,0.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const arch = (cx: number, base: number, ww: number, hh: number, fill: string) => { g.fillStyle = fill; g.beginPath(); g.moveTo(cx - ww / 2, base); g.lineTo(cx - ww / 2, base - hh * 0.6); g.quadraticCurveTo(cx - ww / 2, base - hh * 0.95, cx, base - hh); g.quadraticCurveTo(cx + ww / 2, base - hh * 0.95, cx + ww / 2, base - hh * 0.6); g.lineTo(cx + ww / 2, base); g.closePath(); g.fill(); g.strokeStyle = "#8a4a3a"; g.lineWidth = 12; g.stroke(); };
    arch(512, 1024, 280, 400, "#3a2a24"); arch(230, 1024, 200, 300, "#3a2a24"); arch(794, 1024, 200, 300, "#3a2a24");
    for (const [cx, bs, ww, hh] of [[512, 1024, 280, 400], [230, 1024, 200, 300], [794, 1024, 200, 300]] as number[][]) { arch(cx, bs - 20, ww * 0.55, hh * 0.7, "#5a4034"); }
    g.save(); g.translate(512, 360); g.fillStyle = "#8a4a3a"; g.beginPath(); g.arc(0, 0, 175, 0, 7); g.fill(); g.fillStyle = "#2f3550"; g.beginPath(); g.arc(0, 0, 150, 0, 7); g.fill();
    const rc = ["#d94a3a", "#e8b83a", "#3a7ad9", "#4aa04a"]; for (let i = 0; i < 16; i++) { g.save(); g.rotate((i / 16) * Math.PI * 2); g.fillStyle = rc[i % 4]; g.beginPath(); g.ellipse(95, 0, 52, 17, 0, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = "#8a4a3a"; g.beginPath(); g.arc(0, 0, 34, 0, 7); g.fill(); g.fillStyle = "#e8b83a"; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill(); g.restore();
    for (const cx of [140, 884]) { g.fillStyle = "#2c3140"; g.beginPath(); g.moveTo(cx - 40, 560); g.lineTo(cx - 40, 240); g.quadraticCurveTo(cx - 40, 150, cx, 120); g.quadraticCurveTo(cx + 40, 150, cx + 40, 240); g.lineTo(cx + 40, 560); g.fill(); g.strokeStyle = "#8a4a3a"; g.lineWidth = 8; g.stroke(); }
  });
  { const fp = new THREE.Mesh(new THREE.PlaneGeometry(34, 38), new THREE.MeshLambertMaterial({ map: facadeTex })); fp.position.set(0, 19, CZ + 2.02); scene.add(fp); fp.receiveShadow = true; }
  // cathedral steps
  vc(new THREE.BoxGeometry(18, 0.5, 3).translate(0, 0.25, CZ + 3.5), "#a89a8a"); vc(new THREE.BoxGeometry(16, 0.5, 2).translate(0, 0.75, CZ + 3), "#b0a292");

  // ---- square furniture ----
  const fountain = (x: number, z: number) => {
    vc(new THREE.CylinderGeometry(3.2, 3.4, 0.9, 12).translate(x, 0.45, z), "#a89a8c"); vc(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 12).translate(x, 0.88, z), "#7fb4d8");
    vc(new THREE.CylinderGeometry(0.35, 0.5, 3.2, 8).translate(x, 2.2, z), "#b4a898"); vc(new THREE.CylinderGeometry(1.2, 0.8, 0.5, 10).translate(x, 3.5, z), "#b4a898"); vc(new THREE.SphereGeometry(0.45, 8, 6).translate(x, 4.1, z), "#c4b8a8");
  };
  fountain(14, -9);
  const barrel = (x: number, z: number) => { vc(new THREE.CylinderGeometry(0.45, 0.5, 0.95, 10).translate(x, 0.48, z), "#7a4a2a"); vc(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 10).translate(x, 0.3, z), "#3a2a20"); vc(new THREE.CylinderGeometry(0.47, 0.47, 0.06, 10).translate(x, 0.7, z), "#3a2a20"); };
  const crate = (x: number, z: number, s = 0.8, c = "#9a7040") => vc(new THREE.BoxGeometry(s, s * 0.7, s).translate(x, s * 0.35, z).rotateY(0), c);
  const stripes = [stripeTex("#c0392b", "#f4ecd8"), stripeTex("#2f6aa8", "#f4ecd8"), stripeTex("#d9a441", "#f4ecd8"), stripeTex("#3a8a4a", "#f4ecd8")];
  const stripeMats = stripes.map((t) => new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
  const stall = (x: number, z: number, ry: number, ci: number) => {
    const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, 0, z);
    for (const [px, pz] of [[-1.6, -1], [1.6, -1], [-1.6, 1.0], [1.6, 1.0]]) vc(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 5).translate(px, 1.3, pz).applyMatrix4(m), "#6a4a2a");
    const cg = new THREE.PlaneGeometry(3.8, 2.6); cg.rotateX(-Math.PI / 2 + 0.28); cg.translate(0, 2.55, 0); cg.applyMatrix4(m); tex("stripe" + ci, stripeMats[ci], cg);
    vc(new THREE.BoxGeometry(3.2, 0.12, 1.3).translate(0, 0.95, 0.1).applyMatrix4(m), "#8a6a40"); vc(new THREE.BoxGeometry(3.0, 0.95, 1.1).translate(0, 0.47, 0.1).applyMatrix4(m), "#7a5a34");
    const pc = ["#d9433a", "#e8b83a", "#6aa84a", "#d98a3a"]; for (let i = 0; i < 12; i++) vc(new THREE.SphereGeometry(0.17, 6, 5).translate(-1.3 + (i % 6) * 0.5, 1.2, -0.1 + Math.floor(i / 6) * 0.45).applyMatrix4(m), pc[(i + ci) % 4]);
  };
  [[-22, 8, 0], [-17, 8, 0], [-12, 8, 0], [-22, 14, Math.PI], [-17, 14, Math.PI], [-12, 14, Math.PI], [-8, 18, 0.3]].forEach(([x, z, r], i) => stall(x, z, r, i % 4));
  for (let i = 0; i < 9; i++) { barrel(-24 + R() * 14, 10 + R() * 10); crate(-24 + R() * 14, 10 + R() * 10, 0.7 + R() * 0.3, ["#9a7040", "#8a6038"][i % 2]); }
  // lamp posts around the square (emissive lanterns)
  const lampPos: [number, number][] = [[-24, -18], [24, -18], [-24, 18], [24, 18], [5, -20], [5, 20], [-10, 0], [10, 0]];
  const lampMat = new THREE.MeshBasicMaterial({ color: "#ffd488" }); const lampMesh: THREE.Mesh[] = [];
  lampPos.forEach(([x, z]) => { vc(new THREE.CylinderGeometry(0.1, 0.13, 3.4, 6).translate(x, 1.7, z), "#2a2420"); const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), lampMat); l.position.set(x, 3.7, z); l.userData.ndHide = false; scene.add(l); lampMesh.push(l); vc(new THREE.ConeGeometry(0.42, 0.4, 4).rotateY(Math.PI / 4).translate(x, 4.25, z), "#2a2420"); });

  // ---- stage with bunting ----
  const STG = { x: 18, z: 8 };
  vc(new THREE.BoxGeometry(12, 1.1, 8).translate(STG.x, 0.55, STG.z), "#a8793e"); vc(new THREE.BoxGeometry(12.4, 0.12, 8.4).translate(STG.x, 1.12, STG.z), "#c49a5a");
  for (let i = 0; i < 3; i++) vc(new THREE.BoxGeometry(3, 0.4 + i * 0.35, 1).translate(STG.x - 6.5 - i * 0.5, 0.2 + i * 0.18, STG.z + 2.2), "#8a6030");
  vc(new THREE.BoxGeometry(12, 5, 0.3).translate(STG.x, 3.6, STG.z - 3.9), "#8a2a32"); vc(new THREE.BoxGeometry(12, 0.5, 0.35).translate(STG.x, 6.2, STG.z - 3.9), "#d9a441");
  for (const [px, pz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) vc(new THREE.CylinderGeometry(0.12, 0.14, 7, 6).translate(STG.x + px, 3.5, STG.z + pz), "#6a4a2a");
  const bunt = (ax: number, az: number, bx: number, bz: number, y: number, n = 10) => { const cc = ["#c0392b", "#e8b83a", "#2f6aa8", "#f4ecd8", "#3a8a4a"]; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const px = lerp(ax, bx, t), pz = lerp(az, bz, t), py = y - Math.sin(t * Math.PI) * 0.9; const g = new THREE.BufferGeometry(); const dx = (bx - ax) / n * 0.4, dz = (bz - az) / n * 0.4; g.setAttribute("position", new THREE.Float32BufferAttribute([px - dx, py, pz - dz, px + dx, py, pz + dz, px, py - 0.7, pz], 3)); g.computeVertexNormals(); vc(g, cc[i % 5]); } };
  bunt(STG.x - 6, STG.z + 4, STG.x + 6, STG.z + 4, 6.9, 12); bunt(STG.x - 6, STG.z - 4, STG.x + 6, STG.z - 4, 6.9, 12); bunt(STG.x - 6, STG.z + 4, STG.x - 6, STG.z - 4, 6.9, 8); bunt(STG.x + 6, STG.z + 4, STG.x + 6, STG.z - 4, 6.9, 8);
  bunt(STG.x + 6, STG.z + 4, 26, 18, 6.4, 8); bunt(STG.x - 6, STG.z + 4, 6, 18, 6.4, 10);
  // instruments on stage (static): drum, horn, lute x2
  const drum = (x: number, z: number) => { vc(new THREE.CylinderGeometry(0.55, 0.55, 0.6, 12).translate(x, 1.7, z), "#a8322a"); vc(new THREE.CylinderGeometry(0.57, 0.57, 0.04, 12).translate(x, 2.01, z), "#efe0c0"); };
  drum(STG.x - 3.6, STG.z + 0.6);
  vc(new THREE.ConeGeometry(0.45, 1.5, 8).rotateZ(Math.PI / 2).translate(STG.x + 1.6, 2.5, STG.z + 0.8), "#d9a441");
  for (const dx of [-1.2, 3.8]) { vc(new THREE.SphereGeometry(0.42, 8, 6).scale(1, 1.2, 0.6).translate(STG.x + dx, 1.95, STG.z + 0.7), "#b8782e"); vc(new THREE.BoxGeometry(0.1, 1.1, 0.08).rotateZ(-0.8).translate(STG.x + dx + 0.55, 2.55, STG.z + 0.7), "#5a3a1a"); }

  // ---- notice board (ban) ----
  const boards: Record<string, THREE.Mesh> = {};
  const texts: (() => void)[] = [];
  const mkBoard = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, x: number, y: number, z: number, ry = 0, ndHide = false) => {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = Math.round(512 * h / w); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
    const redraw = () => { const g = cv.getContext("2d")!; g.clearRect(0, 0, cv.width, cv.height); draw(g, cv.width, cv.height); tx.needsUpdate = true; };
    redraw(); texts.push(redraw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tx, transparent: false, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; scene.add(m); boards[key] = m; if (ndHide) m.userData.ndHide = true; return m;
  };
  const FONT = "NunitoBlack, 'Arial Black', Impact, sans-serif";
  const BAN = { x: -8, z: 4 };
  vc(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6).translate(BAN.x - 1.1, 1.4, BAN.z), "#4a3220"); vc(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6).translate(BAN.x + 1.1, 1.4, BAN.z), "#4a3220");
  mkBoard("ban", 2.6, 1.9, (g, w, h) => {
    g.fillStyle = "#e8dcb8"; g.fillRect(0, 0, w, h); g.strokeStyle = "#4a3220"; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    g.fillStyle = "#8a1c1c"; g.font = `900 ${h * 0.17}px ${FONT}`; g.textAlign = "center"; g.fillText("ЗАПРЕТ", w / 2, h * 0.24);
    // dancing stick figure crossed out
    g.strokeStyle = "#2a1c14"; g.lineWidth = 12; g.lineCap = "round"; const cx = w / 2, cy = h * 0.62; g.beginPath(); g.arc(cx, cy - h * 0.2, h * 0.07, 0, 7); g.moveTo(cx, cy - h * 0.12); g.lineTo(cx, cy + h * 0.08); g.moveTo(cx, cy - h * 0.08); g.lineTo(cx - h * 0.14, cy - h * 0.2); g.moveTo(cx, cy - h * 0.08); g.lineTo(cx + h * 0.14, cy - h * 0.0); g.moveTo(cx, cy + h * 0.08); g.lineTo(cx - h * 0.12, cy + h * 0.26); g.moveTo(cx, cy + h * 0.08); g.lineTo(cx + h * 0.14, cy + h * 0.2); g.stroke();
    g.strokeStyle = "#c0392b"; g.lineWidth = 22; g.beginPath(); g.arc(cx, cy, h * 0.3, 0, 7); g.moveTo(cx - h * 0.21, cy - h * 0.21); g.lineTo(cx + h * 0.21, cy + h * 0.21); g.stroke();
  }, BAN.x, 2.0, BAN.z + 0.1);
  boards["ban"].visible = false;

  // ---- chapel of St. Vitus (hill) ----
  const chY = terrainH(CHAPEL.x, CHAPEL.z);
  { const base = new THREE.Matrix4().makeTranslation(CHAPEL.x, chY, CHAPEL.z);
    const wallG = new THREE.BoxGeometry(8, 6, 11).translate(0, 3, 0); wallG.applyMatrix4(base); vc(wallG, "#d8cfbe");
    const sh = new THREE.Shape(); sh.moveTo(-4, 0); sh.lineTo(4, 0); sh.lineTo(0, 3.4); const gg = new THREE.ShapeGeometry(sh); gg.translate(0, 6, 5.51); gg.applyMatrix4(base); vc(gg, "#d8cfbe");
    for (const s of [-1, 1]) { const pg = new THREE.PlaneGeometry(Math.hypot(4.4, 3.5), 12); pg.rotateX(-Math.PI / 2); pg.rotateZ(s * -Math.atan2(3.5, 4.4)); pg.translate(s * 2.2, 7.7, 0); pg.applyMatrix4(base); vc(pg, "#a8442e"); }
    const bt = new THREE.BoxGeometry(2.4, 5, 2.4).translate(0, 8.5, -4); bt.applyMatrix4(base); vc(bt, "#cfc6b4"); const bc = new THREE.ConeGeometry(2, 3.4, 4).rotateY(Math.PI / 4).translate(0, 12.7, -4); bc.applyMatrix4(base); vc(bc, "#a8442e");
    const door = new THREE.BoxGeometry(2.0, 3.4, 0.3).translate(0, 1.7, 5.6); door.applyMatrix4(base); vc(door, "#3a2418");
    const cr1 = new THREE.BoxGeometry(0.2, 1.6, 0.2).translate(0, 15.2, -4); cr1.applyMatrix4(base); vc(cr1, "#2a2420"); const cr2 = new THREE.BoxGeometry(0.9, 0.2, 0.2).translate(0, 15.4, -4); cr2.applyMatrix4(base); vc(cr2, "#2a2420");
    for (const sx of [-1, 1]) { const w2 = new THREE.BoxGeometry(0.12, 1.6, 1.0).translate(sx * 4.05, 3.3, 1.5); w2.applyMatrix4(base); vc(w2, "#c8a458"); }
    // statue of St. Vitus on a plinth in front
    const sx0 = CHAPEL.x + 5.5, sz0 = CHAPEL.z + 7.5, sy = terrainH(sx0, sz0);
    vc(new THREE.BoxGeometry(1.8, 1.4, 1.8).translate(sx0, sy + 0.7, sz0), "#9a9488"); vc(new THREE.CylinderGeometry(0.45, 0.62, 2.0, 8).translate(sx0, sy + 2.4, sz0), "#b8b2a4"); vc(new THREE.SphereGeometry(0.4, 8, 6).translate(sx0, sy + 3.7, sz0), "#c4beb0"); vc(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 5).rotateZ(0.5).translate(sx0 + 0.6, sy + 3.0, sz0), "#b8b2a4"); vc(new THREE.TorusGeometry(0.34, 0.05, 5, 12).translate(sx0, sy + 4.25, sz0), "#e8c860");
    // stone cross + steps + low wall
    for (let i = 0; i < 4; i++) vc(new THREE.BoxGeometry(4 + i * 0.4, 0.3, 1.2).translate(CHAPEL.x, chY + 0.15 + (3 - i) * 0.0, CHAPEL.z + 6.2 + i * 0.9), "#a8a094");
  }
  // trees (hill + town)
  { const tr: [number, number, number, number][] = []; for (let i = 0; i < 700; i++) { const a = R() * Math.PI * 2, r = 120 + R() * 280; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (distToRoad(x, z) < 8 || Math.hypot(x - CHAPEL.x, z - CHAPEL.z) < 20 || Math.hypot(x - ALLEY.x, z - ALLEY.z) < 50) continue; if (Math.abs(x) < 120 && z < -60 && z > -140) continue; tr.push([x, terrainH(x, z), z, 0.8 + R() * 1.4]); }
    for (const [x, y, z, s] of tr) { const pine = R() > 0.5; if (pine) { vc(new THREE.ConeGeometry(1.9 * s, 5 * s, 7).translate(x, y + 3.6 * s, z), R() > 0.5 ? "#2c6a48" : "#34785a"); vc(new THREE.ConeGeometry(1.4 * s, 4 * s, 7).translate(x, y + 5.6 * s, z), "#3a8a5a"); } else { vc(new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2.4 * s, 5).translate(x, y + 1.2 * s, z), "#5a3e2a"); vc(new THREE.IcosahedronGeometry(2.4 * s, 0).translate(x, y + 3.6 * s, z), ["#5f9a3e", "#78ae44", "#4f8a3a", "#a8a838"][Math.floor(R() * 4)]); } } }
  for (const [x, z] of [[-26, -19], [26, -19], [-26, 19], [26, 19]]) { vc(new THREE.CylinderGeometry(0.3, 0.4, 3, 6).translate(x, 1.5, z), "#5a3e2a"); vc(new THREE.IcosahedronGeometry(1.9, 0).translate(x, 4.2, z), "#6aa24a"); }
  // distant ridges (Vosges)
  for (let layer = 0; layer < 3; layer++) { const cols = ["#8fa7a0", "#a8bcb6", "#bccdd0"]; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + layer * 0.2, r = 560 + layer * 120, hh = 80 + R() * 70 - layer * 16; const g = new THREE.ConeGeometry(110 + R() * 70, hh, 6).translate(Math.cos(a) * r, hh / 2 + 10, Math.sin(a) * r); vc(g, cols[layer]); } }
  // clouds
  for (let i = 0; i < 16; i++) { const a = R() * 6.28, r = 200 + R() * 300, y = 120 + R() * 70; for (let k = 0; k < 4; k++) vc(new THREE.IcosahedronGeometry(14 + R() * 10, 1).scale(1.5, 0.5, 1).translate(Math.cos(a) * r + k * 16, y + R() * 4, Math.sin(a) * r + (R() - 0.5) * 10), "#fdfaf4"); }

  // ---- hunger set (alley plateau) ----
  const A = ALLEY;
  { const ay = 0.25;
    house(A.x - 14, A.z - 16, 9, 9, 3, 0, 5, { door: false }); house(A.x + 6, A.z - 17, 8, 9, 3, 0, 3, { door: false }); house(A.x + 22, A.z - 4, 9, 9, 3, -Math.PI / 2, 1, { door: false });
    // granary with a chained door
    const gg = new THREE.BoxGeometry(10, 6.5, 8).translate(A.x - 6, ay + 3.25, A.z + 14); vc(gg, "#8a7458"); const gt = new THREE.Shape(); gt.moveTo(-5, 0); gt.lineTo(5, 0); gt.lineTo(0, 3.4); const gp = new THREE.ShapeGeometry(gt); gp.translate(A.x - 6, ay + 6.5, A.z + 10.01); vc(gp, "#8a7458");
    for (const s of [-1, 1]) { const pg = new THREE.PlaneGeometry(Math.hypot(5.5, 3.5), 8.8); pg.rotateX(-Math.PI / 2); pg.rotateZ(s * -Math.atan2(3.5, 5.5)); pg.translate(A.x - 6 + s * 2.75, ay + 8.2, A.z + 14); vc(pg, "#6a4a38"); }
    vc(new THREE.BoxGeometry(3.4, 4.2, 0.3).translate(A.x - 6, ay + 2.1, A.z + 9.9), "#4a3220"); vc(new THREE.BoxGeometry(0.15, 4.2, 0.34).translate(A.x - 6, ay + 2.1, A.z + 9.86), "#1f1a16");
    for (const y of [1.2, 2.2, 3.1]) vc(new THREE.BoxGeometry(3.6, 0.16, 0.36).translate(A.x - 6, ay + y, A.z + 9.82), "#3a3a3e");
    vc(new THREE.BoxGeometry(0.6, 0.7, 0.3).translate(A.x - 6, ay + 1.7, A.z + 9.66), "#c8a438"); vc(new THREE.TorusGeometry(0.2, 0.05, 6, 10).translate(A.x - 6, ay + 2.2, A.z + 9.66), "#c8a438");
    // table with empty bowls and a dry loaf
    vc(new THREE.BoxGeometry(3.6, 0.14, 1.4).translate(A.x + 4, ay + 0.95, A.z + 6), "#6a4a2a"); for (const sx of [-1, 1]) for (const sz of [-1, 1]) vc(new THREE.BoxGeometry(0.14, 0.95, 0.14).translate(A.x + 4 + sx * 1.6, ay + 0.47, A.z + 6 + sz * 0.55), "#5a3a22");
    for (let i = 0; i < 4; i++) { vc(new THREE.CylinderGeometry(0.32, 0.18, 0.2, 10).translate(A.x + 3 + i * 0.7, ay + 1.12, A.z + 6.1), "#8a6a50"); vc(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 10).translate(A.x + 3 + i * 0.7, ay + 1.2, A.z + 6.1), "#2a2018"); }
    vc(new THREE.CapsuleGeometry(0.16, 0.5, 3, 8).rotateZ(Math.PI / 2).translate(A.x + 5.6, ay + 1.15, A.z + 6.1), "#a8803e");
    barrel(A.x + 9, A.z + 4); barrel(A.x + 10, A.z + 5.2); crate(A.x + 8, A.z + 6.8, 0.8, "#7a5a34");
    // dead tree + crows (dark boxes)
    vc(new THREE.CylinderGeometry(0.2, 0.5, 6, 6).translate(A.x + 16, ay + 3, A.z + 9), "#2a2420"); vc(new THREE.CylinderGeometry(0.1, 0.18, 3, 5).rotateZ(0.9).translate(A.x + 17.2, ay + 5.6, A.z + 9), "#2a2420"); vc(new THREE.CylinderGeometry(0.1, 0.18, 3, 5).rotateZ(-0.8).translate(A.x + 14.9, ay + 5.4, A.z + 9), "#2a2420");
  }
  // bread/bowls sign + "ЗЕРНО"
  mkBoard("grain", 3, 0.9, (g, w, h) => { g.fillStyle = "#c8b890"; g.fillRect(0, 0, w, h); g.strokeStyle = "#4a3220"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = "#3a2418"; g.font = `900 ${h * 0.5}px ${FONT}`; g.textAlign = "center"; g.fillText("ЗЕРНО", w / 2, h * 0.68); }, A.x - 6, ALLEY_Y() + 5.3, A.z + 9.7, Math.PI);
  function ALLEY_Y() { return 0.25; }

  // merge batches into meshes
  batches.forEach((b, key) => { const g = mergeGeometries(b.geos, false); if (!g) return; const m = new THREE.Mesh(g, b.mat); m.castShadow = key !== "vc" || true; m.receiveShadow = true; scene.add(m); });

  // ---- council hall (interior, far east) ----
  { const hx = HALL.x, hz = HALL.z; const W2 = 15, D2 = 11, H2 = 6.2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W2, D2), new THREE.MeshLambertMaterial({ map: (() => { const t = woodTex("#8a5c34", "#7a4e2c", 31); t.repeat.set(W2 / 4, D2 / 4); return t; })() })); floor.rotation.x = -Math.PI / 2; floor.position.set(hx, 0.01, hz); floor.receiveShadow = true; scene.add(floor);
    const pan = (() => { const t = woodTex("#6a4426", "#5e3c20", 32); t.repeat.set(W2 / 3, 1); return t; })();
    const plaster = new THREE.MeshLambertMaterial({ color: "#e8dcc0", side: THREE.DoubleSide }), panelM = new THREE.MeshLambertMaterial({ map: pan, side: THREE.DoubleSide });
    const wallAt = (w: number, x: number, z: number, ry: number, hole = false) => {
      const lower = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, 0.3), panelM); lower.position.set(0, 1.1, 0); const g = new THREE.Group(); g.add(lower);
      if (!hole) { const up = new THREE.Mesh(new THREE.BoxGeometry(w, H2 - 2.2, 0.3), plaster); up.position.set(0, 2.2 + (H2 - 2.2) / 2, 0); g.add(up); }
      else { for (const s of [-1, 1]) { const up = new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 2.4, H2 - 2.2, 0.3), plaster); up.position.set(s * (w / 4 + 1.2), 2.2 + (H2 - 2.2) / 2, 0); g.add(up); } const top = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.1, 0.3), plaster); top.position.set(0, H2 - 0.55, 0); g.add(top); const sill = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.0, 0.3), plaster); sill.position.set(0, 2.7, 0); g.add(sill); }
      g.position.set(x, 0, z); g.rotation.y = ry; g.traverse((o) => { (o as THREE.Mesh).receiveShadow = true; }); scene.add(g); };
    wallAt(W2, hx, hz - D2 / 2, 0, true); wallAt(W2, hx, hz + D2 / 2, 0); wallAt(D2, hx - W2 / 2, hz, Math.PI / 2); wallAt(D2, hx + W2 / 2, hz, Math.PI / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W2, D2), new THREE.MeshLambertMaterial({ color: "#5a3e28", side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(hx, H2, hz); scene.add(ceil);
    for (let i = -3; i <= 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, D2), new THREE.MeshLambertMaterial({ color: "#3e2a1c" })); b.position.set(hx + i * 2.1, H2 - 0.22, hz); scene.add(b); }
    // window glass (bright sky outside, mullions)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.2), new THREE.MeshBasicMaterial({ color: "#d8ecf8", fog: false })); glass.position.set(hx, 4.3, hz - D2 / 2 - 0.2); glass.userData.ndHide = true; scene.add(glass);
    for (const [bx, by, bw, bh] of [[0, 4.3, 0.12, 3.2], [0, 4.3, 4.8, 0.12], [-1.2, 4.3, 0.08, 3.2], [1.2, 4.3, 0.08, 3.2]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.14), new THREE.MeshLambertMaterial({ color: "#3a2a20" })); m.position.set(hx + bx, by, hz - D2 / 2 + 0.02); scene.add(m); }
    // table + chairs + scrolls
    const tableM = new THREE.MeshLambertMaterial({ color: "#5a3a22" }), felt = new THREE.MeshLambertMaterial({ color: "#2f6a4a" });
    const tb = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 2.4), tableM); tb.position.set(hx, 1.0, hz + 0.2); tb.castShadow = true; scene.add(tb);
    const tf = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.04, 1.9), felt); tf.position.set(hx, 1.1, hz + 0.2); scene.add(tf);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 0.25), tableM); l.position.set(hx + sx * 4.2, 0.5, hz + 0.2 + sz * 1.0); scene.add(l); }
    for (let i = 0; i < 5; i++) for (const sz of [-1, 1]) { const c = new THREE.Group(); const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.8), tableM); seat.position.y = 0.55; const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.1), tableM); back.position.set(0, 1.15, sz * 0.4); c.add(seat, back); for (const [lx, lz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), tableM); l.position.set(lx, 0.27, lz); c.add(l); } c.position.set(hx - 3.6 + i * 1.8, 0, hz + 0.2 + sz * 2.0); scene.add(c); }
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), new THREE.MeshLambertMaterial({ color: "#efe2bc" })); s.rotation.z = Math.PI / 2; s.rotation.y = i; s.position.set(hx - 3 + i * 1.2, 1.2, hz + 0.2 + (i % 2 ? 0.3 : -0.3)); scene.add(s); const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 8), new THREE.MeshLambertMaterial({ color: "#1c1c26" })); ink.position.set(hx - 3.4 + i * 1.3, 1.22, hz + 0.9); scene.add(ink); }
    // banners (Strasbourg red/white), map, chandelier
    for (const sx of [-1, 1]) { const b1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.2), new THREE.MeshLambertMaterial({ color: "#c0392b", side: THREE.DoubleSide })); b1.position.set(hx + sx * 5.5, 3.8, hz - D2 / 2 + 0.2); scene.add(b1); const b2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshLambertMaterial({ color: "#f4ecd8", side: THREE.DoubleSide })); b2.position.set(hx + sx * 5.5, 2.6, hz - D2 / 2 + 0.21); scene.add(b2); }
    mkBoard("map", 4.4, 3.0, (g, w, h) => { g.fillStyle = "#e6d8a8"; g.fillRect(0, 0, w, h); g.strokeStyle = "#5a4020"; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.strokeStyle = "#7a9ac0"; g.lineWidth = 14; g.beginPath(); g.moveTo(40, h * 0.7); g.bezierCurveTo(w * 0.3, h * 0.4, w * 0.6, h * 0.9, w - 40, h * 0.35); g.stroke(); g.fillStyle = "#6a5030"; for (let i = 0; i < 26; i++) { g.fillRect(70 + (i * 37) % (w - 140), 60 + (i * 53) % (h - 120), 14, 12); } g.fillStyle = "#c0392b"; g.beginPath(); g.arc(w * 0.52, h * 0.5, 34, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = `900 52px ${FONT}`; g.textAlign = "center"; g.fillText("!", w * 0.52, h * 0.5 + 18); }, hx + 5.5 - 0.0, 3.2, hz + D2 / 2 - 0.2, Math.PI);
    boards["map"].position.set(hx - 4.2, 3.4, hz + D2 / 2 - 0.2);
    const chand = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 18), new THREE.MeshLambertMaterial({ color: "#2a2420" })); ring.rotation.x = Math.PI / 2; chand.add(ring); const flame = new THREE.MeshBasicMaterial({ color: "#ffd488" }); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), new THREE.MeshLambertMaterial({ color: "#efe2bc" })); c.position.set(Math.cos(a) * 1.1, 0.16, Math.sin(a) * 1.1); chand.add(c); const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), flame); f.position.set(Math.cos(a) * 1.1, 0.38, Math.sin(a) * 1.1); chand.add(f); } const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), new THREE.MeshLambertMaterial({ color: "#2a2420" })); chain.position.y = 0.9; chand.add(chain); chand.position.set(hx, H2 - 1.9, hz); scene.add(chand);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 0.16), new THREE.MeshLambertMaterial({ color: "#4a2e1c" })); door.position.set(hx + W2 / 2 - 0.2, 1.6, hz + 3); door.rotation.y = Math.PI / 2; scene.add(door);
  }
  // sun beam through the hall window
  const beamTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,240,200,0.55)"); gr.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 11), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); beam.userData.ndHide = true;
  beam.position.set(HALL.x + 1.2, 3.0, HALL.z - 2.0); beam.rotation.set(-0.95, 0, 0.0); scene.add(beam);

  // ---- people ----
  const pool: PersonSprite[] = [];
  for (let i = 0; i < 56; i++) { const look = i === 0 ? FRAU : makeLook(i); const p = new PersonSprite(look, 1.72 + (i % 5) * 0.04); p.mesh.visible = false; scene.add(p.mesh); pool.push(p); }
  // special cast appended: officials 56..61, doctors 62..65, thin 66..71, guards 72..75, priest 76, musicians use makeLook
  const extra: Look[] = [0, 1, 2, 3, 4, 5].map(OFFICIAL).concat([0, 1, 2, 3].map(DOCTOR), [0, 1, 2, 3, 4, 5].map(THIN), [0, 1, 2, 3].map(GUARD), [PRIEST]);
  extra.forEach((l, i) => { const p = new PersonSprite(l, 1.74); p.mesh.visible = false; scene.add(p.mesh); pool.push(p); void i; });

  // ---- instanced crowd (atlas of dancing figures) ----
  const CT = 12, CF = 6, CELLW = 175, CELLH = 320;
  const atlas = document.createElement("canvas"); atlas.width = CT * CELLW; atlas.height = CF * CELLH; const ag = atlas.getContext("2d")!;
  const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4;
  const crowdBuilt = { v: false };
  const buildAtlas = () => {
    if (crowdBuilt.v) return; crowdBuilt.v = true;
    for (let t = 0; t < CT; t++) { const sp = new PersonSprite(makeLook(100 + t * 3 + (t % 2)), 1.75);
      for (let f = 0; f < CF; f++) { const ph = f / CF; const fl = f % 2 ? 1 : -1;
        sp.draw({ face: { eyes: "ring", brows: "worried", mouth: "o", sweat: f % 3 === 0 }, walk: ph, bob: -Math.abs(Math.sin(ph * Math.PI)) * 26, sway: fl * 5, lean: fl * 0.07, armL: { sh: 1.9 + Math.sin(ph * 6.28) * 0.7, el: -0.3 }, armR: { sh: 1.9 - Math.sin(ph * 6.28) * 0.7, el: -0.3 } });
        ag.drawImage(sp.canvas, t * CELLW, f * CELLH, CELLW, CELLH); } sp.tex.dispose(); }
    atlasTex.needsUpdate = true;
  };
  const MAXC = 520; const cg = new THREE.PlaneGeometry(CW * 1.75 / CH, 1.75); cg.translate(0, -(CH / 2 - FOOT) * (1.75 / CH) + 0.016, 0);
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAXC * 2), 2); cg.setAttribute("aCell", cellAttr);
  const crowdU = { atlas: { value: atlasTex }, cells: { value: new THREE.Vector2(CT, CF) }, tint: { value: new THREE.Color(1, 1, 1) } };
  const cVS = `attribute vec2 aCell; uniform vec2 cells; varying vec2 vUv;
    void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.); float s = length(instanceMatrix[0].xyz);
      vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
      vec3 p = wp.xyz + right*position.x*s + vec3(0.,1.,0.)*position.y*s;
      vUv = (aCell + uv)/cells; gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0); }`;
  const crowdMat = new THREE.ShaderMaterial({ uniforms: crowdU, vertexShader: cVS, transparent: false, side: THREE.DoubleSide,
    fragmentShader: `uniform sampler2D atlas; uniform vec3 tint; varying vec2 vUv; void main(){ vec4 c = texture2D(atlas, vUv); if(c.a<0.35) discard; gl_FragColor = vec4(c.rgb*tint,1.0); }` });
  const crowdND = new THREE.ShaderMaterial({ uniforms: { atlas: crowdU.atlas, cells: crowdU.cells }, vertexShader: cVS + "", side: THREE.DoubleSide,
    fragmentShader: `uniform sampler2D atlas; varying vec2 vUv; void main(){ vec4 c = texture2D(atlas, vUv); if(c.a<0.35) discard; gl_FragColor = vec4(0.0,0.0,0.0, gl_FragCoord.z*0.0 + 1.0); }` });
  // depth value for ND pass must be view-space distance: patch through a varying
  crowdND.vertexShader = cVS.replace("varying vec2 vUv;", "varying vec2 vUv; varying float vD;").replace("gl_Position = projectionMatrix*viewMatrix*vec4(p,1.0);", "vec4 mv = viewMatrix*vec4(p,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv;");
  crowdND.fragmentShader = `uniform sampler2D atlas; varying vec2 vUv; varying float vD; void main(){ vec4 c = texture2D(atlas, vUv); if(c.a<0.35) discard; gl_FragColor = vec4(0.0,0.0,0.0,vD); }`;
  const crowdMesh = new THREE.InstancedMesh(cg, crowdMat, MAXC); crowdMesh.count = 0; crowdMesh.frustumCulled = false; crowdMesh.userData.nd = crowdND; crowdMesh.renderOrder = 2; scene.add(crowdMesh);
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), dp = new THREE.Vector3(), ds = new THREE.Vector3();
  const crowd = {
    mesh: crowdMesh,
    set: (list: [number, number, number, number, number][]) => { buildAtlas(); const n = Math.min(list.length, MAXC); for (let i = 0; i < n; i++) { const [x, z, s, type, frame] = list[i]; dp.set(x, 0.02, z); ds.set(s, s, s); dm.compose(dp, dq, ds); crowdMesh.setMatrixAt(i, dm); cellAttr.setXY(i, ((type % CT) + CT) % CT, CF - 1 - (((frame % CF) + CF) % CF)); } crowdMesh.count = n; crowdMesh.instanceMatrix.needsUpdate = true; cellAttr.needsUpdate = true; },
    setLight: (c: THREE.ColorRepresentation) => { crowdU.tint.value.set(c); },
  };

  // puppet strings
  const strGeo = new THREE.BufferGeometry(); strGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(256 * 6), 3)); strGeo.setDrawRange(0, 0);
  const strings = new THREE.LineSegments(strGeo, new THREE.LineBasicMaterial({ color: "#f0e6c8" })); strings.frustumCulled = false; strings.userData.ndHide = true; scene.add(strings);
  // falling leaves
  const LN = 700; const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LN * 3), 3));
  { const lc = new Float32Array(LN * 3); const pal = ["#d9822b", "#e8b83a", "#b8452a", "#c89a3a"].map((c) => new THREE.Color(c)); for (let i = 0; i < LN; i++) { const c = pal[i % 4]; lc[i * 3] = c.r; lc[i * 3 + 1] = c.g; lc[i * 3 + 2] = c.b; } lg.setAttribute("color", new THREE.BufferAttribute(lc, 3)); }
  const leaves = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: false })); leaves.frustumCulled = false; leaves.userData.ndHide = true; leaves.visible = false; scene.add(leaves);

  // ---- mood ----
  const setMood = (a: string, b?: string, k = 0) => {
    const m = b ? mixMood(MOODS[a], MOODS[b], k) : MOODS[a];
    skyU.top.value.set(m.skyTop); skyU.hor.value.set(m.sky); skyU.stars.value = m.stars;
    const fog = scene.fog as THREE.Fog; fog.color.set(m.fog); fog.near = m.fogN; fog.far = m.fogF; (scene.background as THREE.Color).set(m.sky);
    sun.color.set(m.sun); sun.intensity = m.sunI; amb.color.set(m.amb); amb.intensity = m.ambI * 0.7; hemi.color.set(m.amb); hemi.intensity = 0.4 + 0.2 * m.ambI; terrainMat.color.set(m.grass).lerp(new THREE.Color("#ffffff"), 0.6);
    lampMat.color.set(new THREE.Color("#ffd488").multiplyScalar(0.55 + 0.9 * m.night));
    return m;
  };
  const glow = (k: number) => { lampLights.forEach((l, i) => { l.intensity = k * (i === 0 ? 10 : 6); }); };

  return {
    scene, camera, pool, crowd, boards, strings, leaves, lampLights, hallLights, sunL: sun, beam, glow, setMood, ground,
    redrawText: () => texts.forEach((f) => f()),
    update: () => { /* driven by the film */ },
  } as unknown as DWorld;
};
