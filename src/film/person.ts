// Generic Ricks-Clips style 2D person drawn on a canvas card (billboard in 3D).
// Canvas 700x1280, feet line at y=1235, head ~30 % of height (measured on the originals).
import * as THREE from "three";
import { G, V, INK, drawHead, blobFill, limb, foot, smoothClosed, Face, path } from "../engine/toon2d";
import { NDMaterial } from "../engine/post";

export type Arm = { sh: number; el: number; len?: number; hold?: (g: G, x: number, y: number) => void }; // angles (rad, 0 = down, + = outward)
export type PersonPose = {
  face: Face;
  sway?: number;
  armL?: Arm;
  armR?: Arm;
  lean?: number; // rad
  bob?: number; // px
  walk?: number; // phase 0..1 (0 = standing)
  sit?: boolean;
  drink?: number; // 0..1: glass at the mouth, tilted
  drinkFill?: "cloudy" | "clear" | "empty";
  drinkLevel?: number;
  medal?: boolean;
  headTilt?: number;
};

export type Look = {
  seed: number;
  headR?: number;
  coat: string; // torso colour
  coatShade?: string;
  vest?: string; // inner shirt strip
  tie?: string; // necktie / bow colour
  trousers?: string;
  beard?: "wedge" | "none";
  mustache?: boolean;
  sideburns?: string; // colour of mutton-chop sideburns (Pettenkofer)
  hair?: "bald" | "side" | "curly" | "cap" | "none";
  hairColor?: string;
  glasses?: boolean;
  apron?: string;
  hat?: "top" | "bowler" | "spike" | "cap" | "bonnet" | "none";
  lab?: boolean; // white lab coat over coat
  bodyW?: number;
  bodyH?: number;
  skirt?: string; // long dress instead of trousers
};

export const CW = 700, CH = 1280, FOOT = 1235;
let CLOCK = 0;
export const setClock = (t: number) => { CLOCK = t; };

export const coatBody = (g: G, cx: number, top: number, w: number, h: number, look: Look) => {
  const pts = smoothClosed([[cx - w * 0.34, top + h * 0.05], [cx, top - h * 0.02], [cx + w * 0.36, top + h * 0.06], [cx + w * 0.52, top + h * 0.62], [cx + w * 0.44, top + h * 0.98], [cx, top + h * 1.02], [cx - w * 0.46, top + h * 0.97], [cx - w * 0.52, top + h * 0.6]], 14);
  const fill = look.lab ? "#f4f2ec" : look.coat;
  blobFill(g, pts, fill, { outline: 12, shade: look.lab ? "rgba(120,120,150,0.18)" : "rgba(40,20,30,0.25)", rim: "rgba(255,240,220,0.5)", seed: look.seed + 5 });
  g.save();
  path(g, pts); g.clip();
  if (look.vest) {
    g.fillStyle = look.vest;
    g.beginPath(); g.moveTo(cx - w * 0.12, top); g.lineTo(cx + w * 0.12, top); g.lineTo(cx + w * 0.06, top + h * 0.55); g.lineTo(cx - w * 0.06, top + h * 0.55); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
  }
  if (look.lab) {
    // lapels + inner coat colour
    g.fillStyle = look.coat;
    g.beginPath(); g.moveTo(cx - w * 0.1, top); g.lineTo(cx + w * 0.1, top); g.lineTo(cx, top + h * 0.5); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.moveTo(cx, top + h * 0.5); g.lineTo(cx, top + h); g.stroke();
    g.fillStyle = "#cfcbc2"; g.fillRect(cx + w * 0.12, top + h * 0.55, w * 0.18, h * 0.12); g.strokeRect(cx + w * 0.12, top + h * 0.55, w * 0.18, h * 0.12);
  }
  if (look.apron) {
    g.fillStyle = look.apron;
    g.fillRect(cx - w * 0.38, top + h * 0.2, w * 0.76, h);
    g.strokeStyle = "rgba(255,230,190,0.85)"; g.setLineDash([9, 8]); g.lineWidth = 4;
    g.strokeRect(cx - w * 0.32, top + h * 0.25, w * 0.64, h); g.setLineDash([]);
  }
  // buttons
  if (!look.apron && !look.lab) for (let i = 0; i < 3; i++) { g.fillStyle = INK; g.beginPath(); g.arc(cx + w * 0.02, top + h * (0.6 + i * 0.12), 6, 0, 7); g.fill(); }
  g.restore();
  if (look.tie) {
    g.fillStyle = look.tie; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - 30, top + 8); g.lineTo(cx, top + 26); g.lineTo(cx + 30, top + 8); g.lineTo(cx + 30, top + 44); g.lineTo(cx, top + 26); g.lineTo(cx - 30, top + 44); g.closePath(); g.fill(); g.stroke();
  }
};

export const armPts = (sx: number, sy: number, side: number, a: Arm, L = 250): V[] => {
  const l1 = (a.len || L) * 0.5, l2 = (a.len || L) * 0.5;
  const s1 = a.sh * side, s2 = (a.sh + a.el) * side;
  const ex = sx + Math.sin(s1) * l1, ey = sy + Math.cos(s1) * l1;
  const hx = ex + Math.sin(s2) * l2, hy = ey + Math.cos(s2) * l2;
  return [[sx, sy], [ex + side * 8, ey], [hx, hy]];
};

export const drawPerson = (g: G, look: Look, p: PersonPose) => {
  const sway = p.sway || 0;
  const cx = CW / 2 + sway * 3;
  const bob = p.bob ?? Math.round(Math.sin(Math.floor(CLOCK * 15) / 15 * 2.6 + look.seed) * 4);
  const Rw = look.headR || 190;
  const bw = look.bodyW || 250, bh = look.bodyH || 440;
  const top = 430 + bob;
  g.save();
  if (p.lean) { g.translate(cx, FOOT); g.rotate(p.lean); g.translate(-cx, -FOOT); }
  // legs
  const wk = p.walk ? Math.sin(p.walk * Math.PI * 2) : 0;
  const legTop = top + bh * 0.92;
  const lc = look.trousers || INK;
  if (p.sit) {
    limb(g, [[cx - 40, legTop], [cx - 120, legTop + 30], [cx - 130, FOOT]], 14, { color: lc });
    limb(g, [[cx + 40, legTop], [cx + 110, legTop + 30], [cx + 120, FOOT]], 14, { color: lc });
  } else {
    limb(g, [[cx - 36, legTop], [cx - 52 - wk * 50, (legTop + FOOT) / 2], [cx - 44 - wk * 90, FOOT - Math.max(0, wk) * 30]], 14, { color: lc });
    limb(g, [[cx + 36, legTop], [cx + 54 + wk * 50, (legTop + FOOT) / 2], [cx + 48 + wk * 90, FOOT - Math.max(0, -wk) * 30]], 14, { color: lc });
  }
  foot(g, cx - 44 - wk * 90, FOOT + 3, 14, -1); foot(g, cx + 48 + wk * 90, FOOT + 3, 14, 1);
  if (look.skirt && !p.sit) {
    // long dress: bell skirt over the legs, hem swings with the stride
    const sw = wk * 34, top0 = legTop - 70, hem = FOOT - 30;
    const sk: V[] = [[cx - 120, top0], [cx - 190 + sw * 0.4, (top0 + hem) / 2 + 30], [cx - 236 + sw, hem], [cx - 120 + sw * 0.6, hem + 18], [cx + 10 + sw * 0.3, hem + 8], [cx + 130 + sw * 0.6, hem + 18], [cx + 236 + sw, hem], [cx + 190 + sw * 0.4, (top0 + hem) / 2 + 30], [cx + 120, top0]];
    blobFill(g, smoothClosed(sk, 10), look.skirt, { outline: 12, shade: "rgba(40,20,30,0.25)", rim: "rgba(255,240,220,0.45)", seed: look.seed + 9 });
    g.strokeStyle = "rgba(255,240,220,0.7)"; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 200 + sw, hem - 26); g.quadraticCurveTo(cx + sw * 0.5, hem + 6, cx + 200 + sw, hem - 26); g.stroke();
  }
  // arms behind body when hanging, drawn after body when raised
  const aL = p.armL || { sh: 0.25, el: -0.15 }, aR = p.armR || { sh: 0.25, el: -0.15 };
  const drawArm = (a: Arm, side: number) => {
    const pts = armPts(cx + side * bw * 0.42, top + 60, side, a);
    limb(g, pts, 15);
    const h = pts[2];
    g.fillStyle = INK; g.beginPath(); g.arc(h[0], h[1], 16, 0, 7); g.fill();
    if (a.hold) a.hold(g, h[0], h[1]);
  };
  coatBody(g, cx, top, bw, bh, look);
  drawArm(aL, -1); if (p.drink === undefined) drawArm(aR, 1);
  // head
  const hy = top - Rw * 0.82;
  drawHead(g, cx, hy, Rw, look.seed, p.face, {
    tilt: p.headTilt,
    beard: look.beard === "wedge" ? "wedge" : "none",
    mustache: look.mustache && !look.sideburns,
    extraBeforeOutline: (gg) => {
      if (look.hair === "side" || look.hair === "curly") {
        gg.fillStyle = look.hairColor || "#5a3a28";
        gg.beginPath(); gg.ellipse(cx - Rw * 0.1, hy - Rw * 0.78, Rw * 0.85, Rw * 0.32, -0.08, Math.PI, 0); gg.fill();
        if (look.hair === "curly") for (let i = 0; i < 7; i++) { gg.beginPath(); gg.arc(cx - Rw * 0.7 + i * Rw * 0.23, hy - Rw * 0.8, Rw * 0.16, 0, 7); gg.fill(); }
      }
      if (look.hair === "bald") {
        gg.fillStyle = "rgba(255,255,255,0.6)"; gg.beginPath(); gg.ellipse(cx - Rw * 0.3, hy - Rw * 0.6, Rw * 0.22, Rw * 0.09, -0.4, 0, 7); gg.fill();
      }
    },
  });
  if (look.sideburns) {
    for (const sd of [-1, 1]) {
      // mutton-chop: crescent hugging the cheek from ear level to the jaw, fluffy lower edge
      const pts: V[] = [];
      const N = 8;
      for (let i = 0; i <= N; i++) { const a0 = -0.62 + (i / N) * 0.82; pts.push([cx + sd * Math.cos(a0) * Rw * (1.08 + 0.06 * Math.sin(i * 2.1)), hy + Math.sin(a0) * Rw * 0.98]); }
      for (let i = N; i >= 0; i -= 2) { const a0 = -0.62 + (i / N) * 0.82; const r = Rw * 0.9; pts.push([cx + sd * Math.cos(a0) * r, hy + Math.sin(a0) * r * 0.98]); }
      blobFill(g, smoothClosed(pts, 4), look.sideburns, { outline: Rw * 0.07, shade: "rgba(40,30,50,0.2)", seed: look.seed + sd, minK: 0.7 });
    }
    // mustache redrawn on top
    if (look.mustache) {
      const my = hy + Rw * 0.36;
      g.fillStyle = "#1c181f"; g.strokeStyle = INK; g.lineWidth = Rw * 0.02;
      const mo = p.face.mouth || "line";
      const upR = mo === "smile" || mo === "grin" || mo === "teeth" ? 1 : mo === "smirk" ? 1 : 0;
      const upL = mo === "smile" || mo === "grin" || mo === "teeth" ? 1 : mo === "smirk" ? 0.25 : 0;
      const eL = my + Rw * (0.08 - 0.26 * upL), eR = my + Rw * (0.08 - 0.26 * upR);
      if (upL > 0.5 || upR > 0.5) { // visible mouth under the moustache
        g.save(); g.strokeStyle = INK; g.lineWidth = Rw * 0.045; g.lineCap = "round"; g.beginPath();
        if (upL > 0.5) { g.moveTo(cx - Rw * 0.26, my + Rw * 0.1); g.quadraticCurveTo(cx, my + Rw * 0.3, cx + Rw * 0.26, my + Rw * 0.1); }
        else { g.moveTo(cx + Rw * 0.02, my + Rw * 0.16); g.quadraticCurveTo(cx + Rw * 0.2, my + Rw * 0.2, cx + Rw * 0.32, my + Rw * 0.04); }
        g.stroke(); g.restore();
      }
      g.beginPath(); g.moveTo(cx, my - Rw * 0.14);
      g.bezierCurveTo(cx - Rw * 0.25, my - Rw * 0.22, cx - Rw * 0.5, my - Rw * 0.05 - Rw * 0.2 * upL, cx - Rw * 0.5, eL);
      g.bezierCurveTo(cx - Rw * 0.3, my + Rw * 0.02 - Rw * 0.06 * upL, cx - Rw * 0.12, my + Rw * 0.04, cx, my - Rw * 0.02);
      g.bezierCurveTo(cx + Rw * 0.12, my + Rw * 0.04, cx + Rw * 0.3, my + Rw * 0.02 - Rw * 0.06 * upR, cx + Rw * 0.5, eR);
      g.bezierCurveTo(cx + Rw * 0.5, my - Rw * 0.05 - Rw * 0.2 * upR, cx + Rw * 0.25, my - Rw * 0.22, cx, my - Rw * 0.14);
      g.fill(); g.stroke();
    }
  }
  if (look.glasses) {
    g.strokeStyle = INK; g.lineWidth = 7;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * Rw * 0.3, hy - Rw * 0.02, Rw * 0.18, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - Rw * 0.12, hy - Rw * 0.04); g.lineTo(cx + Rw * 0.12, hy - Rw * 0.04); g.stroke();
  }
  if (p.drink !== undefined) {
    const dk = p.drink;
    const mx = cx + Rw * (0.2 + 0.15 * (1 - dk)), my = hy + Rw * (0.55 + 0.2 * (1 - dk));
    const sx = cx + bw * 0.42, sy = top + 60;
    limb(g, [[sx, sy], [sx + 90, sy + 120 - 60 * dk], [mx + 40, my + 50]], 15);
    g.fillStyle = INK; g.beginPath(); g.arc(mx + 40, my + 50, 16, 0, 7); g.fill();
    g.save(); g.translate(mx, my + 40); g.rotate(-(0.25 + 1.05 * dk)); glassProp(p.drinkFill || "cloudy", true, p.drinkLevel ?? 1)(g, 0, 0); g.restore();
  }
  if (p.medal) { const mx = cx - bw * 0.22, my = top + 120; g.fillStyle = "#c33a3a"; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(mx - 18, my - 50); g.lineTo(mx + 18, my - 50); g.lineTo(mx + 12, my); g.lineTo(mx - 12, my); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#e9b93c"; g.beginPath(); g.arc(mx, my + 32, 36, 0, 7); g.fill(); g.stroke(); g.fillStyle = INK; g.font = "bold 24px Georgia"; g.textAlign = "center"; g.fillText("1854", mx, my + 41); }
  if (look.hat === "bowler") {
    g.fillStyle = "#2f2a33"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.78, Rw * 1.05, Rw * 0.16, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.85, Rw * 0.66, Rw * 0.55, 0, Math.PI, 0); g.fill(); g.stroke();
  }
  if (look.hat === "spike") {
    g.strokeStyle = INK; g.lineWidth = 8;
    g.fillStyle = "#2b2a33"; g.beginPath(); g.ellipse(cx, hy - Rw * 0.55, Rw * 0.98, Rw * 0.72, 0, Math.PI * 1.02, -0.02); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#d9a441"; g.beginPath(); g.moveTo(cx - Rw * 0.12, hy - Rw * 1.2); g.lineTo(cx, hy - Rw * 1.75); g.lineTo(cx + Rw * 0.12, hy - Rw * 1.2); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.8, Rw * 0.22, Rw * 0.2, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#1e1c24"; g.beginPath(); g.ellipse(cx + Rw * 0.2, hy - Rw * 0.52, Rw * 1.0, Rw * 0.12, 0.05, 0, 7); g.fill(); g.stroke();
  }
  if (look.hat === "top") {
    g.fillStyle = "#26222b"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.78, Rw * 1.0, Rw * 0.15, 0, 0, 7); g.fill(); g.stroke();
    g.fillRect(cx - Rw * 0.6, hy - Rw * 1.6, Rw * 1.2, Rw * 0.82); g.strokeRect(cx - Rw * 0.6, hy - Rw * 1.6, Rw * 1.2, Rw * 0.82);
    g.fillStyle = "#7a2b32"; g.fillRect(cx - Rw * 0.6, hy - Rw * 0.98, Rw * 1.2, Rw * 0.14);
  }
  if (look.hat === "cap" || look.hat === "bonnet") drawHat(g, look, cx, hy, Rw);
  g.restore();
};

// ---------- props held in hands ----------
export const glassProp = (fill: "cloudy" | "clear" | "fizz" | "empty", vibrios = true, level = 1) => (g: G, x: number, y: number) => {
  const w = 70, h = 120, x0 = x - w / 2, y0 = y - h + 20;
  g.save();
  if (fill !== "empty") {
    g.fillStyle = fill === "cloudy" ? "rgba(214,222,190,0.92)" : "rgba(200,232,246,0.75)";
    const lh = (h - 36) * level; g.fillRect(x0 + 5, y0 + h - 6 - lh, w - 10, lh);
    if (fill === "cloudy" && vibrios) { g.strokeStyle = "#2f9ca2"; g.lineWidth = 5; g.lineCap = "round"; for (const [a, b] of [[14, 60], [40, 82], [24, 104], [52, 50]]) { g.beginPath(); g.arc(x0 + a, y0 + b, 7, 0.4, 2.6); g.stroke(); } }
    if (fill === "fizz") { g.fillStyle = "#ffffff"; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x0 + 12 + (i * 37) % 46, y0 + 40 + (i * 23) % 70, 4, 0, 7); g.fill(); } }
  }
  g.strokeStyle = INK; g.lineWidth = 6;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 6, y0 + h); g.lineTo(x0 + w - 6, y0 + h); g.lineTo(x0 + w, y0); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(x0 + 10, y0 + 12, 8, h - 30);
  g.restore();
};

export const weakTubeProp = (g: G, x: number, y: number) => {
  g.save(); g.translate(x, y); g.scale(1.9, 1.9); g.translate(-x, -y);
  const w = 46, h = 190, x0 = x - w / 2, y0 = y - h + 30;
  g.save();
  g.fillStyle = "rgba(226,232,190,0.92)"; g.beginPath(); g.moveTo(x0 + 4, y0 + 40); g.lineTo(x0 + 4, y0 + h - 20); g.arc(x, y0 + h - 20, w / 2 - 4, Math.PI, 0, true); g.lineTo(x0 + w - 4, y0 + 40); g.closePath(); g.fill();
  // a limp, sleeping comma lying at the bottom
  g.strokeStyle = "#2f9ca2"; g.lineWidth = 9; g.lineCap = "round"; g.beginPath(); g.arc(x, y0 + h - 34, 13, 0.2, 2.9); g.stroke();
  g.fillStyle = INK; g.font = "bold 26px Georgia"; g.fillText("z", x + 12, y0 + h - 64); g.font = "bold 20px Georgia"; g.fillText("z", x + 22, y0 + h - 86);
  g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y0 + h - 20); g.arc(x, y0 + h - 20, w / 2, Math.PI, 0, true); g.lineTo(x0 + w, y0); g.stroke();
  g.fillStyle = "#f4ecd8"; g.fillRect(x0 - 24, y0 + 52, w + 48, 34); g.strokeRect(x0 - 24, y0 + 52, w + 48, 34); g.fillStyle = INK; g.font = "bold 14px Georgia"; g.textAlign = "center"; g.fillText("СЛАБАЯ", x, y0 + 74);
  g.restore(); g.restore();
};

// ---------- sprite wrapper ----------
export class PersonSprite {
  canvas: HTMLCanvasElement;
  g: G;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  look: Look;
  constructor(look: Look, heightM = 1.8) {
    this.look = look;
    this.canvas = document.createElement("canvas");
    this.canvas.width = CW; this.canvas.height = CH;
    this.g = this.canvas.getContext("2d")!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    const s = heightM / CH;
    const geo = new THREE.PlaneGeometry(CW * s, CH * s);
    geo.translate(0, -(CH / 2 - FOOT) * s + 0.016, 0);
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.02, fog: false });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uLitL = this.litL; sh.uniforms.uLitR = this.litR;
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uLitL; uniform vec3 uLitR;").replace("#include <map_fragment>", "#include <map_fragment>\n  { float k = smoothstep(0.25, 0.75, vMapUv.x); vec3 lit = mix(uLitL, uLitR, k); float lum = dot(diffuseColor.rgb, vec3(0.333)); diffuseColor.rgb *= mix(vec3(1.0), lit, smoothstep(0.08, 0.35, lum)); }"); };
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.userData.nd = NDMaterial({ alphaMap: this.tex, noEdge: true });
    this.mesh.renderOrder = 2;
    this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
  }
  litL = { value: new THREE.Color(1.0, 0.97, 0.92) };
  litR = { value: new THREE.Color(0.84, 0.82, 0.92) };
  setLight(l: THREE.ColorRepresentation, r: THREE.ColorRepresentation) { this.litL.value.set(l); this.litR.value.set(r); }
  tint(c: THREE.ColorRepresentation) { (this.mesh.material as THREE.MeshBasicMaterial).color.set(c); }
  draw(p: PersonPose, extra?: (g: G) => void) {
    this.g.clearRect(0, 0, CW, CH);
    drawPerson(this.g, this.look, p);
    if (extra) extra(this.g);
    this.tex.needsUpdate = true;
  }
  face(camera: THREE.Camera) {
    // cylindrical billboard (stays upright)
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    this.mesh.rotation.set(0, e.y, 0);
  }
}

// ---------- cast of the film ----------
export const PETTENKOFER: Look = { seed: 81, coat: "#3b3f58", vest: "#e9e2d6", tie: "#d9a441", sideburns: "#9a96a2", hair: "bald", mustache: true, trousers: "#2b2d3e" };
export const KOCH: Look = { seed: 82, coat: "#2a3e4a", vest: "#e9e2d6", tie: "#2f9ca2", beard: "wedge", glasses: true, hair: "side", hairColor: "#5b4a3e", trousers: "#2a2d36" };
export const STUDENT_A: Look = { seed: 83, coat: "#7a5a3a", vest: "#eae4d8", tie: "#d9a441", hair: "side", hairColor: "#3e2c22", trousers: "#3a2f2a" };
export const STUDENT_B: Look = { seed: 84, coat: "#5b6e3e", vest: "#eae4d8", tie: "#d9a441", hair: "curly", hairColor: "#c48a3a", trousers: "#3a3a2e" };
export const KOCHMAN_A: Look = { seed: 85, coat: "#e9e7e1", lab: true, tie: "#2f9ca2", hair: "side", hairColor: "#2e2630", glasses: true, trousers: "#33363e" };
export const KOCHMAN_B: Look = { seed: 86, coat: "#5a3e5a", tie: "#c0392b", vest: "#e9e2d6", hair: "curly", hairColor: "#c48a3a", mustache: true, trousers: "#33363e", bodyW: 1.12 };
export const PETT_SOLDIER: Look = { seed: 81, coat: "#2c3e6e", vest: "#c0392b", tie: "#d9a441", sideburns: "#9a96a2", hair: "bald", mustache: true, trousers: "#2b2d3e", hat: "spike" };
export const HAMBURGER: Look = { seed: 87, coat: "#6b5a7a", vest: "#d8cfc2", hat: "bowler", trousers: "#2e2a33" };

// hats for the continuous rig (same drawings as drawPerson)
export const drawHat = (g: G, look: Look, cx: number, hy: number, Rw: number) => {
  if (look.hat === "bowler") {
    g.fillStyle = "#2f2a33"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.78, Rw * 1.05, Rw * 0.16, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.85, Rw * 0.66, Rw * 0.55, 0, Math.PI, 0); g.fill(); g.stroke();
  }
  if (look.hat === "spike") {
    g.strokeStyle = INK; g.lineWidth = 8;
    g.fillStyle = "#2b2a33"; g.beginPath(); g.ellipse(cx, hy - Rw * 0.55, Rw * 0.98, Rw * 0.72, 0, Math.PI * 1.02, -0.02); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = "#d9a441"; g.beginPath(); g.moveTo(cx - Rw * 0.12, hy - Rw * 1.2); g.lineTo(cx, hy - Rw * 1.75); g.lineTo(cx + Rw * 0.12, hy - Rw * 1.2); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.8, Rw * 0.22, Rw * 0.2, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#1e1c24"; g.beginPath(); g.ellipse(cx + Rw * 0.2, hy - Rw * 0.52, Rw * 1.0, Rw * 0.12, 0.05, 0, 7); g.fill(); g.stroke();
  }
  if (look.hat === "top") {
    g.fillStyle = "#26222b"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.78, Rw * 1.0, Rw * 0.15, 0, 0, 7); g.fill(); g.stroke();
    g.fillRect(cx - Rw * 0.6, hy - Rw * 1.6, Rw * 1.2, Rw * 0.82); g.strokeRect(cx - Rw * 0.6, hy - Rw * 1.6, Rw * 1.2, Rw * 0.82);
    g.fillStyle = "#7a2b32"; g.fillRect(cx - Rw * 0.6, hy - Rw * 0.98, Rw * 1.2, Rw * 0.14);
  }
  if (look.hat === "cap") {
    g.fillStyle = look.hairColor || "#4a4f5e"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.62, Rw * 0.95, Rw * 0.5, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(cx + Rw * 0.45, hy - Rw * 0.62, Rw * 0.55, Rw * 0.1, 0, 0, 7); g.fill(); g.stroke();
  }
  if (look.hat === "bonnet") {
    g.fillStyle = look.hairColor || "#c9a46a"; g.strokeStyle = INK; g.lineWidth = 8;
    g.beginPath(); g.ellipse(cx, hy - Rw * 0.35, Rw * 1.12, Rw * 0.92, 0, Math.PI * 1.05, -0.05); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#c0392b"; g.lineWidth = 12; g.beginPath(); g.moveTo(cx - Rw * 0.9, hy - Rw * 0.3); g.quadraticCurveTo(cx, hy - Rw * 0.55, cx + Rw * 0.9, hy - Rw * 0.3); g.stroke();
  }
};
