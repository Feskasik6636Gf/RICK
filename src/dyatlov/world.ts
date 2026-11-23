import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { World } from "../engine/Stage";
import { rng, canvasTex } from "../engine/tex";
import { PersonSprite, Look } from "../film/person";

// ---------- helpers ----------
export const smooth = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x: number, z: number) => { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v); };
const fbm = (x: number, z: number) => vnoise(x * 0.05, z * 0.05) * 1 + vnoise(x * 0.12, z * 0.12) * 0.45 + vnoise(x * 0.3, z * 0.3) * 0.12;

// terrain: tent slope at origin, valley falls towards +z where the forest is, big mountains behind (-z) and on the left (-x)
export const terrainH = (x: number, z: number) => {
  const slope = -0.2 * z;
  const bowl = Math.max(0, -z - 90) * 0.12 + Math.max(0, -x - 90) * 0.14;
  const flat = smooth(1 - Math.hypot(x, z - 4) / 14);
  const n = (fbm(x + 40, z + 17) - 0.8) * 5;
  return lerp(slope + bowl + n, -0.2 * 4 + 0.15, flat * 0.9);
};

export type Mood = { sky: string; skyTop: string; fog: string; sun: string; sunI: number; amb: string; ambI: number; snow: string; stars: number };
export const MOODS: Record<string, Mood> = {
  day: { sky: "#bfe0f7", skyTop: "#3f92dc", fog: "#cfe6f6", sun: "#fff1d6", sunI: 2.3, amb: "#b4cff5", ambI: 1.35, snow: "#e9f0fb", stars: 0 },
  dusk: { sky: "#f0b8a0", skyTop: "#5d6fb0", fog: "#e8c2b8", sun: "#ff9a5a", sunI: 2.0, amb: "#a8a2d6", ambI: 1.2, snow: "#f6e8ee", stars: 0.2 },
  night: { sky: "#1c2a55", skyTop: "#050a1e", fog: "#17224a", sun: "#8aa6ff", sunI: 0.55, amb: "#4a5fa8", ambI: 0.75, snow: "#a9bde8", stars: 1 },
  deep: { sky: "#0e1636", skyTop: "#02040f", fog: "#0c1230", sun: "#6a86e8", sunI: 0.35, amb: "#34448a", ambI: 0.6, snow: "#8296c8", stars: 1 },
  dawn: { sky: "#f4c8c0", skyTop: "#6a86c0", fog: "#e4cfd6", sun: "#ffd9b0", sunI: 1.9, amb: "#b4bce8", ambI: 1.15, snow: "#f4e8f0", stars: 0.1 },
};

const mixMood = (a: Mood, b: Mood, k: number): Mood => {
  const c = (x: string, y: string) => "#" + new THREE.Color(x).lerp(new THREE.Color(y), k).getHexString();
  return { sky: c(a.sky, b.sky), skyTop: c(a.skyTop, b.skyTop), fog: c(a.fog, b.fog), sun: c(a.sun, b.sun), sunI: lerp(a.sunI, b.sunI, k), amb: c(a.amb, b.amb), ambI: lerp(a.ambI, b.ambI, k), snow: c(a.snow, b.snow), stars: lerp(a.stars, b.stars, k) };
};

// ---------- looks of the nine hikers ----------
const parka = (seed: number, coat: string, hat: Look["hat"], hair: string, extra: Partial<Look> = {}): Look => ({ seed, coat, vest: "#eae4d8", hat, hairColor: hair, trousers: "#2b3550", hair: "none", ...extra });
export const HIKERS: Look[] = [
  parka(101, "#d8532e", "cap", "#8a2a1c"),
  parka(102, "#2f7fb8", "bonnet", "#e8c24a"),
  parka(103, "#4a8a4a", "cap", "#2e5e30"),
  parka(104, "#e0a82c", "bonnet", "#c0392b", { beard: "wedge" }),
  parka(105, "#8a4aa8", "cap", "#4a2a64", { mustache: true }),
  parka(106, "#c63b5a", "bonnet", "#f0eee6"),
  parka(107, "#3aa59a", "cap", "#1f5e58", { glasses: true }),
  parka(108, "#e3743a", "bonnet", "#2f6fb0"),
  parka(109, "#5a6cc4", "cap", "#2a3a80"),
];

export type DWorld = World & {
  setMood: (a: string, b?: string, k?: number) => void;
  hikers: PersonSprite[];
  tent: THREE.Group;
  tentOpen: { v: number };
  fire: THREE.PointLight;
  lantern: THREE.PointLight;
  snowPts: THREE.Points;
  place: (i: number, x: number, z: number, vis?: boolean, scale?: number) => void;
  boards: Record<string, THREE.Mesh>;
};

export const buildWorld = (W: number, H: number): DWorld => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 2500);
  const R = rng(7);

  // lights
  const amb = new THREE.AmbientLight("#8fb0e0", 1);
  const hemi = new THREE.HemisphereLight("#aac8f0", "#e8f0ff", 0.55);
  const sun = new THREE.DirectionalLight("#fff0d8", 2);
  sun.position.set(-60, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0006;
  scene.add(amb, hemi, sun, sun.target);

  // sky dome (gradient + stars), follows camera
  const skyU = { top: { value: new THREE.Color("#5fa8dc") }, hor: { value: new THREE.Color("#cfe6f4") }, stars: { value: 0 } };
  const skyM = new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: "varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform float stars; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){ vec3 d=normalize(vP); float k=pow(clamp(d.y,0.0,1.0),0.55); vec3 c=mix(hor,top,k);
        vec2 g=floor(vec2(atan(d.x,d.z)*90.0, d.y*90.0)); float s=step(0.9965,h(g)); c+=vec3(s)*stars*smoothstep(0.08,0.3,d.y)*(0.6+0.4*h(g+3.0));
        gl_FragColor=vec4(c,1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyM);
  sky.userData.ndHide = true; sky.renderOrder = -10; scene.add(sky);
  scene.fog = new THREE.Fog("#d8ecf6", 90, 1200);
  scene.background = new THREE.Color("#cfe6f4");

  // terrain
  const N = 180, SZ = 900;
  const tg = new THREE.PlaneGeometry(SZ, SZ, N, N); tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainH(x, z); pos.setY(i, y);
    const n = 0.93 + 0.07 * vnoise(x * 0.4, z * 0.4) + (hash(x, z) - 0.5) * 0.03;
    cols[i * 3] = n; cols[i * 3 + 1] = n; cols[i * 3 + 2] = Math.min(1, n + 0.03);
  }
  tg.setAttribute("color", new THREE.BufferAttribute(cols, 3)); tg.computeVertexNormals();
  const terrainMat = new THREE.MeshLambertMaterial({ color: "#f4f9ff", vertexColors: true });
  const terrain = new THREE.Mesh(tg, terrainMat); terrain.receiveShadow = true; scene.add(terrain);

  // far mountains: faceted cones around the valley
  const mg: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.62 + 1.1 * (i / 25)) + (R() - 0.5) * 0.1; // arc behind (-z) and left (-x)
    const r = 230 + R() * 150, hgt = 110 + R() * 130, w = 70 + R() * 70;
    const g = new THREE.ConeGeometry(w, hgt, 5 + Math.floor(R() * 3), 1);
    g.translate(0, hgt / 2 - 8, 0); g.rotateY(R() * 6);
    g.translate(Math.cos(a) * r, 0, -Math.abs(Math.sin(a)) * r - 40);
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let k = 0; k < g.attributes.position.count; k++) { const y = g.attributes.position.getY(k) / hgt; const rock = y < 0.55 ? 1 : 0; c[k * 3] = lerp(0.97, 0.45, rock); c[k * 3 + 1] = lerp(0.98, 0.5, rock); c[k * 3 + 2] = lerp(1, 0.62, rock); }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3)); mg.push(g.toNonIndexed());
  }
  const mountains = new THREE.Mesh(mergeGeometries(mg)!, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); scene.add(mountains);

  // trees: forest down the valley + scattered
  const tg2: THREE.BufferGeometry[] = [];
  const addTree = (x: number, z: number, s: number) => {
    const y = terrainH(x, z);
    const parts: [number, number, number, string][] = [[1.9 * s, 3.2 * s, 1.2 * s, "#1f4a3a"], [1.5 * s, 2.8 * s, 3.1 * s, "#255a42"], [1.05 * s, 2.4 * s, 4.7 * s, "#2c684c"]];
    for (const [rad, h, yy, col] of parts) {
      const g = new THREE.ConeGeometry(rad, h, 7, 1); g.translate(x, y + yy + h / 2 - 0.4, z);
      const c = new Float32Array(g.attributes.position.count * 3); const cc = new THREE.Color(col);
      for (let k = 0; k < g.attributes.position.count; k++) { const up = (g.attributes.position.getY(k) - (y + yy - 0.4)) / h; const sn = Math.max(0, up - 0.55) * 1.4 + (up > 0.1 && up < 0.35 ? 0.15 : 0); const m = new THREE.Color().copy(cc).lerp(new THREE.Color("#eef5ff"), Math.min(0.9, sn)); c[k * 3] = m.r; c[k * 3 + 1] = m.g; c[k * 3 + 2] = m.b; }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3)); tg2.push(g.toNonIndexed());
    }
    const tr = new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 1.6 * s, 6); tr.translate(x, y + 0.5 * s, z);
    const c = new Float32Array(tr.attributes.position.count * 3); for (let k = 0; k < c.length; k += 3) { c[k] = 0.3; c[k + 1] = 0.2; c[k + 2] = 0.14; }
    tr.setAttribute("color", new THREE.BufferAttribute(c, 3)); tg2.push(tr.toNonIndexed());
  };
  for (let i = 0; i < 520; i++) { const x = (R() - 0.5) * 260, z = 78 + R() * 120; if (Math.abs(x) < 3 && z < 100) continue; addTree(x, z, 1.2 + R() * 1.6); }
  for (let i = 0; i < 70; i++) { const x = (R() - 0.5) * 220, z = -40 + R() * 118; if (Math.abs(x) < 30) continue; addTree(x, z, 0.8 + R() * 1.0); }
  const trees = new THREE.Mesh(mergeGeometries(tg2)!, new THREE.MeshLambertMaterial({ vertexColors: true })); trees.castShadow = true; trees.receiveShadow = true; scene.add(trees);

  // the cedar where the fire is (big tree at the forest edge)
  const cedar = new THREE.Group(); {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 7), new THREE.MeshLambertMaterial({ color: "#4a3426" })); trunk.position.y = 4.5; cedar.add(trunk);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(4.2 - i * 0.8, 4.6, 8), new THREE.MeshLambertMaterial({ color: i % 2 ? "#285c44" : "#1f4c3a" })); c.position.y = 6 + i * 2.2; cedar.add(c); }
    cedar.position.set(6, terrainH(6, 92), 92); cedar.traverse((o) => { (o as any).castShadow = true; }); scene.add(cedar);
  }

  // tent
  const tent = new THREE.Group(); const tentOpen = { v: 0 };
  const TENT_Y = terrainH(0, 4);
  {
    const canvasTexT = canvasTex(256, 256, (g) => { g.fillStyle = "#ef7b2a"; g.fillRect(0, 0, 256, 256); const r = rng(3); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(120,50,10,${0.05 + r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 2 + r() * 40, 1.5); } g.strokeStyle = "rgba(255,230,190,0.9)"; g.lineWidth = 6; g.strokeRect(10, 10, 236, 236); }, { repeat: true });
    const shape = new THREE.Shape(); shape.moveTo(-1.5, 0); shape.lineTo(1.5, 0); shape.lineTo(0, 2.1); shape.closePath();
    const len = 4.6;
    const prism = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false }), new THREE.MeshLambertMaterial({ map: canvasTexT, side: THREE.DoubleSide }));
    prism.geometry.translate(0, 0, -len / 2); prism.castShadow = true; prism.receiveShadow = true; tent.add(prism);
    // snow lid on the ridge
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, len * 0.96), new THREE.MeshLambertMaterial({ color: "#f4f8ff" })); lid.position.y = 2.0; lid.rotation.z = 0; tent.add(lid);
    // inner floor + sleeping bags + lantern
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3, len), new THREE.MeshLambertMaterial({ color: "#3a4a6a" })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.04; tent.add(floor);
    for (let i = 0; i < 9; i++) { const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 4, 8), new THREE.MeshLambertMaterial({ color: HIKERS[i].coat })); sb.rotation.x = Math.PI / 2; sb.position.set(-1.0 + (i % 3) * 0.5 + (i > 4 ? 0.0 : 0), 0.28, -1.8 + Math.floor(i / 2) * 0.82 * (i % 2 ? 1 : 1)); sb.position.x = -1.1 + (i % 2) * 2.2 - (i === 8 ? 1.1 : 0); sb.position.z = -1.9 + Math.floor(i / 2) * 0.95; tent.add(sb); }
    // slit (dark cut that grows on the left slope)
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.9), new THREE.MeshBasicMaterial({ color: "#06080f", side: THREE.DoubleSide }));
    { const xa = new THREE.Vector3(0, 0, 1), ya = new THREE.Vector3(1.5, 2.1, 0).normalize(), za = new THREE.Vector3().crossVectors(xa, ya); slit.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, za)); slit.position.set(-1.5 + ya.x * 1.25 + za.x * 0.03, ya.y * 1.25 + za.y * 0.03, 0.4); }
    slit.scale.set(1, 0.001, 1); tent.add(slit);
    tent.userData.slit = slit;
    tent.position.set(0, TENT_Y, 4); tent.rotation.y = 0; scene.add(tent);
    // skis poles (entrance): two crossed poles
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5), new THREE.MeshLambertMaterial({ color: "#6a4a30" })); p.position.set(s * 0.6, TENT_Y + 1.2, 4 + len / 2 + 0.15); p.rotation.z = s * 0.28; scene.add(p); }
  }
  const lantern = new THREE.PointLight("#ffbe6a", 0, 9, 1.6); lantern.position.set(0, TENT_Y + 1.5, 4); scene.add(lantern);

  // fire at the cedar
  const fireG = new THREE.Group(); const fy = terrainH(4.2, 92.3);
  const fire = new THREE.PointLight("#ff8a2a", 0, 30, 1.5); fire.position.set(4.2, fy + 1.4, 92.3); scene.add(fire);
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.34 - i * 0.04, 1.1 + i * 0.2, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? "#ffd04a" : "#ff6a1a", fog: false })); f.userData.ndHide = true; f.position.set(4.2 + (i - 1.5) * 0.12, fy + 0.7, 92.3); flames.push(f); fireG.add(f); }
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 5), new THREE.MeshLambertMaterial({ color: "#3a2618" })); l.position.set(4.2, fy + 0.12, 92.3); l.rotation.set(Math.PI / 2, 0, i * 1.05); fireG.add(l); }
  scene.add(fireG);

  // footprints from the tent to the forest (barefoot dark prints in the snow, alternating)
  const prints = new THREE.Group();
  {
    const pg = new THREE.CircleGeometry(0.16, 8); pg.scale(1, 1.9, 1); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.MeshBasicMaterial({ color: "#6f86b4", fog: true, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 86; i++) {
      const z = 9 + i * 0.95; const x = 0.12 * Math.sin(i * 0.7) + (i % 2 ? 0.28 : -0.28) + i * 0.012;
      const m = new THREE.Mesh(pg, pm); m.position.set(x, terrainH(x, z) + 0.07, z); m.userData.ndHide = true; m.rotation.y = 0.1 * Math.sin(i); prints.add(m);
    }
  }
  scene.add(prints);

  // scattered abandoned items near the tent (shoes / backpacks) and signs (text planes)
  const boards: Record<string, THREE.Mesh> = {};
  const board = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex(512, Math.round(512 * h / w), draw), transparent: true, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, y, z); m.userData.ndHide = true; m.visible = false; scene.add(m); boards[key] = m; return m;
  };
  const sign = (txt: string, col = "#ffffff") => (g: CanvasRenderingContext2D, w: number, h: number) => { g.fillStyle = "rgba(10,14,30,0.0)"; g.fillRect(0, 0, w, h); g.font = `${h * 0.7}px TitanOne, Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = h * 0.12; g.strokeStyle = "#000"; g.strokeText(txt, w / 2, h / 2); g.fillStyle = col; g.fillText(txt, w / 2, h / 2); };
  board("temp", 6, 2.2, sign("-25°C", "#9fe0ff"), 0, TENT_Y + 5.5, 4 + 2.6);
  board("year", 8, 2.2, sign("1959", "#ffd24a"), 0, 13, -22);
  board("y2020", 8, 2.2, sign("2020", "#ffd24a"), 0, 13, -22);
  board("km", 6, 2, sign("1 km", "#ffffff"), 0, TENT_Y + 5, 20);

  // people
  const hikers = HIKERS.map((l) => { const p = new PersonSprite(l, 1.75); p.mesh.visible = false; scene.add(p.mesh); return p; });
  const place = (i: number, x: number, z: number, vis = true, scale = 1) => { const m = hikers[i].mesh; m.visible = vis; m.position.set(x, terrainH(x, z), z); m.scale.setScalar(scale); };

  // snowfall around camera
  const SN = 2600; const sg = new THREE.BufferGeometry(); const sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = (R() - 0.5) * 80; sp[i * 3 + 1] = R() * 40; sp[i * 3 + 2] = (R() - 0.5) * 80; }
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const snowPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: "#ffffff", map: (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d")!; const gr = g.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })(), size: 0.3, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  snowPts.frustumCulled = false; snowPts.userData.ndHide = true; scene.add(snowPts);

  // ---- mood ----
  const setMood = (a: string, b?: string, k = 0) => {
    const m = b ? mixMood(MOODS[a], MOODS[b], k) : MOODS[a];
    skyU.top.value.set(m.skyTop); skyU.hor.value.set(m.sky); skyU.stars.value = m.stars;
    (scene.fog as THREE.Fog).color.set(m.fog); (scene.background as THREE.Color).set(m.sky);
    sun.color.set(m.sun); sun.intensity = m.sunI; amb.color.set(m.amb); amb.intensity = m.ambI * 0.7; hemi.color.set(m.amb); hemi.intensity = 0.4 + 0.2 * m.ambI;
    terrainMat.color.set(m.snow);
  };

  return {
    scene, camera, hikers, tent, tentOpen, fire, lantern, snowPts, place, boards, setMood,
    update: (t, f, post) => {
      // flames flicker (on twos)
      const q = Math.floor(f / 2) * 2 / 30;
      flames.forEach((m, i) => { m.scale.set(1 + 0.2 * Math.sin(q * 23 + i * 2), 0.85 + 0.35 * Math.sin(q * 19 + i * 5), 1); });
      fire.userData.flick = 0.85 + 0.25 * Math.sin(q * 31) + 0.1 * Math.sin(q * 13);
      void post; void t;
    },
  } as DWorld;
};
