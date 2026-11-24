import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import * as THREE from "three";
import { Stage } from "../engine/Stage";
import { PostParams } from "../engine/post";
import { setToonStyle, FILM_TOON } from "../engine/toon2d";
import { setClock, PersonPose } from "../film/person";
import { buildWorld, DWorld, terrainH as G, smooth, lerp, HALL, CHAPEL, ALLEY, ROAD } from "./world";
import { Captions, groupWords, FONT, fontsPromise } from "./Captions";
import { WORDS } from "./words";
import { Cam, CamKey, keysCam, shk } from "./cam";

export const FPS = 30;
export const DUR = 98.0;
const CARDS = groupWords(WORDS as any);

// ---- pool layout ----
const FRAU = 0, OFF = 56, DOC = 62, THIN = 66, GRD = 72, PRIEST = 76;
const rngS = (seed: number) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; }; };

// ---- faces ----
const calm = { eyes: "half", brows: "flat", mouth: "line" } as const;
const trance = { eyes: "ring", brows: "flat", mouth: "line" } as const;
const shock = { eyes: "ring", brows: "up", mouth: "o" } as const;
const worry = { eyes: "open", brows: "worried", mouth: "frown" } as const;
const tired = { eyes: "squint", brows: "worried", mouth: "open", sweat: true } as const;
const pain = { eyes: "squint", brows: "angry", mouth: "teeth", sweat: true } as const;
const smug = { eyes: "half", brows: "smug", mouth: "smirk" } as const;
const happy = { eyes: "happy", brows: "up", mouth: "smile" } as const;
const stern = { eyes: "half", brows: "angry", mouth: "frown" } as const;

type Show = { x: number; z: number; y?: number; walk?: number; face?: PersonPose["face"]; pose?: Partial<PersonPose>; lie?: number; yaw?: number; scale?: number; sit?: boolean };
const blinkAt = (t: number, i: number) => (Math.abs(((t + i * 0.83) % 2.6) - 1.3) < 0.07 ? 1 : 0);
const walkPose = (ph: number, k = 0.5) => ({ walk: ph, armL: { sh: 0.3 + k * Math.sin(ph * Math.PI * 2), el: -0.25 }, armR: { sh: 0.3 - k * Math.sin(ph * Math.PI * 2), el: -0.25 } });
const dance = (t: number, i: number, a = 1): Partial<PersonPose> => {
  const ph = ((t * 2.1 + i * 0.31) % 1 + 1) % 1; const s = Math.sin(ph * Math.PI * 2);
  return { walk: ph, bob: -Math.abs(Math.sin(ph * Math.PI)) * 26 * a, sway: Math.sin(t * 4.2 + i) * 2.5, lean: Math.sin(t * 2.1 * Math.PI + i) * 0.09 * a, headTilt: Math.sin(t * 3.3 + i) * 0.18, armL: { sh: 1.7 + 0.8 * s * a, el: -0.35 }, armR: { sh: 1.7 - 0.8 * s * a, el: -0.35 } };
};
const spot = (k: number, cx: number, cz: number, rad: number, t: number, sp = 0.2): [number, number] => {
  const a = k * 2.399 + t * sp * (((k % 3) - 1) || 0.7); const r = rad * Math.sqrt(0.1 + 0.9 * ((k * 0.618) % 1));
  return [cx + Math.cos(a) * r + Math.sin(t * 1.7 + k) * 0.25, cz + Math.sin(a) * r + Math.cos(t * 1.3 + k * 2) * 0.25];
};
// instanced crowd list (x, z, scale, type, frame)
const crowdList = (n: number, rmin: number, rmax: number, t: number, seed: number, cx = 0, cz = 0, avoid?: (x: number, z: number) => boolean): [number, number, number, number, number][] => {
  const R = rngS(seed); const out: [number, number, number, number, number][] = [];
  for (let i = 0; i < n * 2 && out.length < n; i++) {
    const a = R() * 6.2832, r = rmin + (rmax - rmin) * Math.sqrt(R()); const x = cx + Math.cos(a) * r * 1.15, z = cz + Math.sin(a) * r * 0.85; const type = Math.floor(R() * 12), off = R() * 6, sc = 0.92 + R() * 0.2, ph = R() * 6;
    if (Math.abs(x) > 28 || z < -22 || z > 22) continue; if (avoid && avoid(x, z)) continue;
    const jx = Math.sin(t * 2.0 + ph) * 0.18, jz = Math.cos(t * 1.7 + ph) * 0.18;
    out.push([x + jx, z + jz, sc, type, Math.floor(t * 10 + off) % 6]);
  } return out;
};

type Ctx = { cx: number; cz: number; night?: number; hall?: number; sprite?: [string, string]; count?: number; fall?: number; strings?: number[][] };
type MoodSpec = [string, string?, number?];
type Shot = {
  t0: number; t1: number;
  mood: (lt: number) => MoodSpec;
  cam: (lt: number) => Cam;
  shake?: number; roll?: (lt: number) => number;
  setup?: (w: DWorld, lt: number, t: number, show: (i: number, s: Show) => void, ctx: Ctx) => void;
  ink?: string; vig?: number; dof?: number; leaves?: boolean; hall?: boolean; sprite?: [string, string]; flash?: string;
};
const M = (a: string, b?: string, k?: number) => (): MoodSpec => [a, b, k];
const DAY: [string, string] = ["#fff4e4", "#d8d6ee"], NIGHT: [string, string] = ["#ffc890", "#6a78b8"], DUSK: [string, string] = ["#ffc89a", "#b89ac0"], GLOOM: [string, string] = ["#dcd8e0", "#a8a8b8"], HALLC: [string, string] = ["#ffdcae", "#c8a888"];

const orbit = (cx: number, cz: number, r: number, a0: number, w: number, y: number, ty: number, fov: number) => (lt: number): Cam => { const a = a0 + lt * w; return { p: [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], q: [cx, ty, cz], fov }; };
const hx = HALL.x, hz = HALL.z;
const roadPos = (u: number): [number, number] => { let acc = 0; for (let i = 0; i < ROAD.length - 1; i++) { const [ax, az] = ROAD[i], [bx, bz] = ROAD[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (u <= acc + L) { const k = (u - acc) / L; return [lerp(ax, bx, k), lerp(az, bz, k)]; } acc += L; } return ROAD[ROAD.length - 1]; };
const hillCam = (keys: [number, [number, number, number], [number, number, number], number][]) => { const f = keysCam(keys); return (lt: number): Cam => { const c = f(lt); return { p: [c.p[0], G(c.p[0], c.p[2]) + c.p[1], c.p[2]], q: [c.q[0], G(c.q[0], c.q[2]) + c.q[1], c.q[2]], fov: c.fov }; }; };
const A = ALLEY;

// ---- the cut ----
const SHOTS: Shot[] = [
  // 1. 0-9: calm Strasbourg, glide through the market then crane up to the rooftops and the cathedral spire
  { t0: 0, t1: 9.0, mood: M("morning"), sprite: DAY, shake: 0.12,
    cam: keysCam([[0, [-12, 1.5, 19], [-1, 1.5, 6], 42], [1.5, [-7, 1.9, 16], [1, 1.6, 4], 42], [3.0, [0, 6, 22], [0, 3, 0], 48], [4.7, [10, 24, 34], [-4, 10, -30], 58], [6.6, [22, 55, 62], [-6, 20, -70], 62], [9.0, [34, 92, 78], [-8, 52, -84], 60]]),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 6; for (let i = 1; i <= 16; i++) { const dir = i % 2 ? 1 : -1; const x = ((i * 7.3 + t * 1.1 * dir) % 50 + 50) % 50 - 25; const z = -13 + ((i * 3.7) % 27); show(i, { x, z, walk: t * 1.8 + i * 0.2, face: { ...calm, blink: blinkAt(t, i) }, pose: walkPose(t * 1.8 + i * 0.2) }); } } },
  // 2. 9-15: one woman comes out into the street and starts dancing
  { t0: 9.0, t1: 15.0, mood: M("morning"), sprite: DAY, shake: 0.1,
    cam: keysCam([[0, [-94, 1.6, 2.2], [-66, 1.5, 0], 38], [2.5, [-88, 1.55, 1.6], [-66, 1.5, 0], 36], [3.9, [-80, 1.5, 1.2], [-66, 1.5, 0], 34], [4.6, [-76, 1.2, 0.6], [-66, 1.7, 0], 30], [6.0, [-73, 1.0, 0.3], [-66, 1.8, 0], 27]]),
    setup: (w, lt, t, show, c) => { c.cx = -66; c.cz = 0; const wx = lt < 3.4 ? lerp(-50, -66, smooth(lt / 3.4)) : -66; const dancing = lt > 4.0; show(FRAU, { x: wx, z: 0, face: dancing ? { ...trance, blink: 0 } : { ...calm, blink: blinkAt(t, 0) }, pose: dancing ? dance(t, 0, Math.min(1, (lt - 4.0) / 0.4)) : walkPose(t * 1.8 + 0.3) });
      for (let i = 1; i <= 6; i++) { const dir = i % 2 ? 1 : -1; const x = ((-98 + i * 9 + t * 1.2 * dir) % 60 + 60) % 60 - 100 + 38; show(i, { x, z: (i % 3 - 1) * 2.4 + 1, walk: t * 1.8 + i, face: { ...calm, blink: blinkAt(t, i) }, pose: walkPose(t * 1.8 + i) }); } } },
  // 3. 15-23.96: the square — she dances alone in silence while people stare; orbit then feet
  { t0: 15.0, t1: 23.96, mood: M("noon"), sprite: DAY, shake: 0.1,
    cam: (lt) => lt < 5.2 ? orbit(0, 0, 6.6, 0.2, 0.28, 1.6, 1.3, 38)(lt) : (() => { const c0 = orbit(0, 0, 6.6, 0.2, 0.28, 1.6, 1.3, 38)(5.2); return keysCam([[5.2, c0.p, c0.q, 38], [5.6, [1.0, 0.5, 3.0], [0, 0.35, 0], 42], [7.2, [1.6, 0.55, 3.6], [0, 0.4, 0], 40], [8.96, [8, 6.5, 13], [0, 1.2, 0], 46]])(lt); })(),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 0; show(FRAU, { x: 0, z: 0, face: { ...trance, blink: 0 }, pose: dance(t, 0) });
      for (let i = 1; i <= 14; i++) { const a = i * 0.45 + 0.3, r = 6.5 + (i % 3) * 1.4; const f = i % 4 === 0 ? stern : i % 4 === 1 ? shock : i % 4 === 2 ? worry : { ...calm, mouth: "frown" as const }; show(i, { x: Math.cos(a) * r * 1.2, z: Math.sin(a) * r * 0.8, face: { ...f, blink: blinkAt(t, i) }, pose: { sway: Math.sin(t * 2 + i) * 1.2, armL: { sh: i % 5 === 0 ? 2.5 : 0.25, el: i % 5 === 0 ? -2.2 : -0.15 }, armR: { sh: 0.25, el: -0.15 } } }); } } },
  // 4. 23.96-31: time-lapse sun, moon, dawn; others join
  { t0: 23.96, t1: 31.0, mood: (lt) => lt < 2.3 ? ["noon", "dusk", lt / 2.3] : lt < 4.2 ? ["dusk", "night", (lt - 2.3) / 1.9] : lt < 5.8 ? ["night", "dawn", (lt - 4.2) / 1.6] : ["dawn", "morning", (lt - 5.8) / 1.24], shake: 0.08,
    cam: (lt) => { const a = 0.4 + lt * 0.32; const r = 9.5 - lt * 0.35; return { p: [Math.cos(a) * r, 2.0 + lt * 0.18, Math.sin(a) * r], q: [0, 1.3, 0], fov: 42 }; },
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 0; c.night = 1; show(FRAU, { x: 0, z: 0, face: lt < 3 ? { ...trance, blink: 0 } : { ...tired }, pose: dance(t, 0, 0.9) });
      for (let i = 1; i <= 7; i++) { const dt = lt - (4.9 + i * 0.12); if (dt < 0) continue; const [tx, tz] = spot(i, 0, 0, 5.5, t, 0.1); const k = smooth(dt / 1.1); const sx = (i % 2 ? 14 : -14), sz = (i * 3 % 5) - 2; show(i, { x: lerp(sx, tx, k), z: lerp(sz, tz, k), face: k > 0.9 ? { ...trance } : { ...shock }, pose: k > 0.9 ? dance(t, i) : walkPose(t * 2 + i) }); } } },
  // 5a. 31-35.5: the market — the crowd grows
  { t0: 31.0, t1: 35.5, mood: M("morning", "noon", 0.5), sprite: DAY, shake: 0.14,
    cam: keysCam([[0, [-4, 1.5, 21], [-14, 1.6, 12], 48], [2.0, [-12, 1.7, 19], [-18, 1.5, 10], 52], [4.5, [-2, 4.5, 20], [-14, 1.5, 9], 58]]),
    setup: (w, lt, t, show, c) => { c.cx = -14; c.cz = 12; const n = 8 + Math.floor(lt * 5.5); for (let i = 0; i < Math.min(n, 30); i++) { const [x, z] = spot(i + 1, -13, 12, 8.5, t, 0.15); show(i === 0 ? FRAU : i, { x, z, face: { ...(i % 3 === 0 ? tired : trance), blink: 0 }, pose: dance(t, i) }); } } },
  // 5b. 35.5-38: glazed faces, they lose control
  { t0: 35.5, t1: 38.0, mood: M("noon"), sprite: DAY, shake: 0.3, roll: (lt) => 0.05 * Math.sin(lt * 5),
    cam: keysCam([[0, [-8.5, 1.5, 15.5], [-11, 1.6, 12.5], 30], [1.2, [-10.0, 1.5, 15.0], [-11.4, 1.6, 12.2], 26], [2.5, [-10.6, 1.55, 14.2], [-11.6, 1.6, 12.4], 22]]),
    setup: (w, lt, t, show, c) => { c.cx = -11; c.cz = 12; for (let i = 0; i < 18; i++) { const [x, z] = spot(i + 1, -11.5, 12.4, 3.2, t, 0.25); show(i === 0 ? FRAU : i, { x, z, scale: 1, face: { ...trance, look: [0.3, 0] }, pose: dance(t * 1.2, i, 1.1) }); } } },
  // 6. 38-44: you step out of the house and see hundreds
  { t0: 38.0, t1: 44.0, mood: M("noon"), sprite: DAY, shake: 0.1,
    cam: keysCam([[0, [0, 1.62, 23.2], [0, 1.7, 10], 50], [1.6, [0.0, 1.62, 21.0], [0, 1.6, 8], 52], [2.6, [0, 4, 17], [0, 1.5, 5], 56], [4.2, [-8, 16, 24], [0, 1, -2], 62], [6.0, [-18, 34, 38], [0, 0, 0], 64]]),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 6; w.crowd.set(crowdList(380, 2, 21, t, 77, 0, -2, (x, z) => lt < 2.6 && z > 18 && Math.abs(x) < 4)); for (let i = 0; i < 24; i++) { const [x, z] = spot(i + 1, 0, 9, 6, t, 0.2); show(i === 0 ? FRAU : i, { x, z, face: { ...trance, blink: 0 }, pose: dance(t, i) }); } } },
  // 7. 44-49.94: they fall, others keep going despite the pain
  { t0: 44.0, t1: 49.94, mood: M("noon", "gloom", 0.4), sprite: GLOOM, shake: 0.25,
    cam: keysCam([[0, [-7, 0.8, 7], [0, 0.6, 0], 46], [2.4, [-2.5, 0.7, 4.2], [1, 0.6, -1], 44], [3.4, [0.5, 0.6, 3.0], [1.5, 0.4, 0.2], 40], [4.0, [1.9, 1.5, 2.4], [0, 1.45, 0], 30], [5.94, [1.3, 1.55, 1.6], [0, 1.5, 0], 26]]),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 0; const down: [number, number, number][] = [[-3.4, 1.5, 0.4], [-1.4, -1.6, -0.8], [0.6, 3.1, 0.2], [2.8, 0.5, 1.0], [-4.8, 4.0, -0.3], [1.6, -3.5, 0.6]]; down.forEach(([x, z, yaw], k) => { const t0 = 0.2 + k * 0.28; if (lt > t0) show(20 + k, { x, z, lie: 1, yaw, face: { eyes: "closed", brows: "worried", mouth: "open", sweat: true } }); });
      show(FRAU, { x: 0, z: 0, face: { ...pain }, pose: dance(t * 0.9, 0, 0.8) }); for (let i = 1; i <= 12; i++) { const [x, z] = spot(i, 0, 0.3, 5.5, t, 0.12); show(i, { x, z, face: { ...(i % 2 ? pain : tired) }, pose: dance(t * 0.85, i, 0.85) }); } } },
  // 8a. 49.94-54.9: council hall panic
  { t0: 49.94, t1: 54.9, mood: M("hall"), sprite: HALLC, hall: true, shake: 0.12,
    cam: keysCam([[0, [hx + 7, 2.9, hz + 4.9], [hx, 1.5, hz - 1], 52], [2.4, [hx + 5.2, 2.8, hz + 4.8], [hx - 1, 1.5, hz - 1], 48], [4.96, [hx + 3.4, 2.7, hz + 4.9], [hx - 2.4, 1.5, hz - 0.4], 42]]),
    setup: (w, lt, t, show, c) => { c.cx = hx; c.cz = hz; c.hall = 1; for (let i = 0; i < 6; i++) { const x = hx - 4 + i * 1.6, z = i % 2 ? hz - 1.7 : hz + 2.3; show(OFF + i, { x, z, y: 0, face: { ...(i % 2 ? shock : worry), sweat: i % 3 === 0 }, pose: { sway: Math.sin(t * 9 + i) * 2.5, armL: { sh: 2.4, el: -0.6 + Math.sin(t * 7 + i) * 0.3 }, armR: { sh: 2.2, el: -0.5 + Math.cos(t * 7 + i) * 0.3 }, bob: Math.round(Math.sin(t * 12 + i) * 6) } }); }
      if (lt > 2.7) for (let i = 0; i < 4; i++) { const k = smooth((lt - 2.7 - i * 0.2) / 1.2); show(DOC + i, { x: lerp(hx + 7.4, hx + 1.0 + i * 1.5, k), z: hz + 3.4 - (i % 2) * 0.6, y: 0, face: smug, pose: { armL: { sh: 0.5, el: -0.3 }, armR: { sh: 2.0 + Math.sin(t * 5 + i) * 0.4, el: -0.9 } } }); } } },
  // 8b. 54.9-58.88: doctors urge them to dance even more
  { t0: 54.9, t1: 58.88, mood: M("noon"), sprite: DAY, shake: 0.15,
    cam: keysCam([[0, [5, 1.7, 16], [1, 1.9, 4], 54], [2.0, [3.5, 1.6, 14.2], [0, 1.8, 3], 48], [3.98, [2.0, 1.5, 13], [-2, 1.8, 2], 42]]),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 4; w.crowd.set(crowdList(260, 3, 21, t, 91, 0, -1, (x, z) => z > 11 && Math.abs(x) < 8)); for (let i = 0; i < 4; i++) show(DOC + i, { x: 2 + i * 1.5, z: 13.4 - (i % 2) * 0.7, face: lt > 3.0 ? happy : smug, pose: { armL: { sh: 0.6, el: -0.2 }, armR: { sh: 2.3 + Math.sin(t * 4 + i) * 0.5, el: -0.6 + Math.sin(t * 8) * 0.3 } } });
      for (let i = 1; i <= 16; i++) { const [x, z] = spot(i, 0, 3, 7, t, 0.15); show(i, { x, z, face: { ...(i % 2 ? tired : trance), blink: 0 }, pose: dance(t, i) }); } } },
  // 9a. 58.88-63.6: a stage is built, musicians hired
  { t0: 58.88, t1: 63.6, mood: M("noon", "dusk", 0.3), sprite: DAY, shake: 0.1,
    cam: keysCam([[0, [29, 3.2, 21.5], [18, 2.2, 8], 50], [1.8, [26, 2.2, 19], [18, 3.0, 8], 46], [3.7, [15, 2.0, 17], [18, 3.0, 8], 38], [4.72, [18, 2.6, 16], [18, 2.4, 8], 34]]),
    setup: (w, lt, t, show, c) => { c.cx = 18; c.cz = 8; w.crowd.set(crowdList(180, 3, 20, t, 33, 6, 8, (x, z) => x > 11 && z > 3 && z < 13)); if (lt > 3.3) { const mus: [number, number][] = [[14.4, 8.6], [17.2, 8.4], [19.6, 8.5], [22.0, 8.6]]; mus.forEach(([x, z], k) => show(30 + k, { x, z, y: 1.15, face: happy, pose: { armL: { sh: 0.8 + Math.sin(t * 9 + k) * 0.5, el: -1.2 }, armR: { sh: 0.9 - Math.sin(t * 9 + k) * 0.5, el: -1.1 }, bob: Math.round(Math.sin(t * 8 + k) * 8) } })); }
      for (let i = 1; i <= 8; i++) { const [x, z] = spot(i, 8, 14, 5, t, 0.2); show(i, { x, z, face: { ...trance }, pose: dance(t, i) }); } } },
  // 9b. 63.6-67.16: the town is more and more frightened
  { t0: 63.6, t1: 67.16, mood: M("dusk"), sprite: DUSK, shake: 0.2,
    cam: keysCam([[0, [9, 1.0, 22], [5.5, 1.3, 17], 42], [3.56, [5.2, 1.1, 19.2], [3, 1.5, 12.5], 30]]),
    setup: (w, lt, t, show, c) => { c.cx = 3; c.cz = 12; c.night = 1; w.crowd.set(crowdList(120, 4, 18, t, 12, 4, -2)); const fam: [number, number, number][] = [[1.0, 12.6, 1], [2.6, 11.6, 0.62], [4.2, 12.4, 1], [1.8, 10.4, 0.6], [3.8, 10.6, 1], [5.8, 11.4, 0.85]]; fam.forEach(([x, z, s], k) => show(40 + k, { x, z, scale: s, face: { ...shock, sweat: k % 2 === 0 }, pose: { sway: Math.sin(t * 7 + k) * 1.4, armL: { sh: 2.5, el: -2.2 }, armR: { sh: 0.5, el: -2.0 } } })); } },
  // 10a. 67.16-71.34: dancing banned
  { t0: 67.16, t1: 71.34, mood: M("morning", "gloom", 0.5), sprite: DAY, shake: 0.12,
    cam: keysCam([[0, [-2, 2.0, 14], [-6, 2.4, 4], 46], [1.5, [-4.5, 2.2, 10.5], [-8, 2.2, 4], 40], [4.18, [-7.2, 2.1, 8.2], [-8, 2.2, 4], 34]]),
    setup: (w, lt, t, show, c) => { c.cx = -8; c.cz = 6; w.boards["ban"].visible = lt > 0.4; const sc = w.boards["ban"].scale; sc.setScalar(lt < 0.7 ? 0.4 + 0.6 * smooth((lt - 0.4) / 0.3) : 1);
      for (let i = 0; i < 3; i++) show(GRD + i, { x: -11 + i * 2.6, z: 7.5 + (i % 2) * 0.6, face: stern, pose: { armL: { sh: 0.4, el: -0.4 }, armR: { sh: i === 1 ? 2.6 : 0.4, el: i === 1 ? -0.4 : -0.4 } } });
      for (let i = 1; i <= 8; i++) { const k = i * 0.55; const x = lerp(-12 + i * 1.2, 20, smooth((lt - k * 0.2) / 4.0)); show(i, { x, z: 12 + (i % 3) * 1.4, walk: t * 1.6 + i, face: { ...tired }, pose: { ...walkPose(t * 1.6 + i, 0.35), lean: 0.1 } }); } } },
  // 10b. 71.34-76.28: procession to the shrine of St. Vitus
  { t0: 71.34, t1: 76.28, mood: M("gloom", "dawn", 0.5), sprite: GLOOM, shake: 0.14,
    cam: hillCam([[0, [10, 2.6, 150], [22, 2.4, 160], 46], [2.0, [24, 3.0, 160], [34, 2.8, 172], 44], [3.0, [54, 2.6, 182], [43, 3.0, 197], 40], [4.94, [48, 2.2, 216], [43.5, 2.8, 198], 34]]),
    setup: (w, lt, t, show, c) => { c.cx = 38; c.cz = 188; const pos = (u: number) => roadPos(Math.min(u, 130)); show(PRIEST, { x: pos(100 + lt * 3)[0], z: pos(100 + lt * 3)[1], y: G(...pos(100 + lt * 3)), face: calm, pose: walkPose(t * 1.4) });
      for (let i = 0; i < 10; i++) { const u = 98 + lt * 3 - i * 2.2 + (i % 2) * 0.6; const [x, z] = pos(u); const dx = (i % 2 ? 0.8 : -0.8); const kneel = lt > 3.0 && i > 3; const fin = kneel ? [41.4 + (i % 4) * 1.3, 199.2 + Math.floor(i / 4) * 1.2] : [x + dx, z]; show(i === 0 ? FRAU : i, { x: fin[0], z: fin[1], y: G(fin[0], fin[1]), sit: kneel ? true : undefined, face: kneel ? { eyes: "closed", brows: "worried", mouth: "line" } : tired, pose: kneel ? { armL: { sh: 2.6, el: -2.4 }, armR: { sh: 2.6, el: -2.4 } } : { ...walkPose(t * 1.5 + i, 0.3), lean: 0.08 } }); }
      for (let i = 0; i < 3; i++) { const [x, z] = pos(104 + lt * 3 - i * 5); show(GRD + i, { x: x + 1.6, z, y: G(x + 1.6, z), walk: t * 1.5, face: stern, pose: walkPose(t * 1.5 + i) }); } } },
  // 11a. 76.28-80.06: September, leaves, the epidemic ends
  { t0: 76.28, t1: 80.06, mood: M("autumn"), sprite: DAY, leaves: true, shake: 0.08,
    cam: keysCam([[0, [9, 1.8, 13], [-2, 1.4, 2], 44], [2.0, [7, 2.8, 12], [-1, 1.4, 1], 40], [3.78, [3, 5.0, 11], [0, 1.2, 0], 36]]),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 0; show(FRAU, { x: 0, z: 0, sit: lt > 1.4, face: lt > 1.4 ? { eyes: "closed", brows: "flat", mouth: "smile" } : { ...tired }, pose: lt > 1.4 ? { armL: { sh: 0.3, el: -0.2 }, armR: { sh: 0.3, el: -0.2 } } : dance(t, 0, Math.max(0.2, 1 - lt / 1.4)) });
      for (let i = 1; i <= 10; i++) { const dir = i % 2 ? 1 : -1; const x = ((i * 6.1 + t * 1.0 * dir) % 46 + 46) % 46 - 23; const z = -12 + ((i * 3.3) % 24); show(i, { x, z, walk: t * 1.7 + i * 0.3, face: { ...calm, blink: blinkAt(t, i) }, pose: walkPose(t * 1.7 + i * 0.3) }); } } },
  // 11b. 80.06-82.46: the big question stays open — rise over the city
  { t0: 80.06, t1: 82.46, mood: M("autumn", "dusk", 0.3), sprite: DAY, leaves: true,
    cam: keysCam([[0, [3, 5.0, 11], [0, 1.2, 0], 36], [1.2, [-6, 22, 32], [0, 6, -10], 52], [2.4, [-14, 60, 66], [-6, 30, -60], 62]]),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 0; show(FRAU, { x: 0, z: 0, sit: true, face: { eyes: "closed", brows: "flat", mouth: "smile" } }); } },
  // 12. 82.46-87.76: puppets on strings — against their own will
  { t0: 82.46, t1: 87.76, mood: (lt) => ["dusk", "night", smooth(lt / 5.3)], sprite: NIGHT, shake: 0.12, ink: "#1a1426",
    cam: (lt) => { const a = 0.8 + lt * 0.55; const r = 6.2 - lt * 0.3; return { p: [Math.cos(a) * r, 0.75, Math.sin(a) * r], q: [0, 2.9, 0], fov: 62 - lt * 2 }; },
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 0; c.night = 1; const lines: number[][] = []; for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28, r = 3.0 + (i % 2) * 0.8; const x = Math.cos(a) * r, z = Math.sin(a) * r; const pose = dance(t * 1.1, i, 1.0); show(i === 0 ? FRAU : i, { x, z, face: { ...trance }, pose }); const up = 30 + (i % 3) * 2; const hy = 2.0 + (Math.sin(t * 2.1 * Math.PI + i) * 0.1); lines.push([x, 1.95, z, x * 0.2, up, z * 0.2], [x - 0.9, 1.9, z, x * 0.2, up, z * 0.2], [x + 0.9, 1.9, z, x * 0.2, up, z * 0.2]); void hy; } c.strings = lines; } },
  // 13. 87.76-94.3: stress and hunger
  { t0: 87.76, t1: 94.3, mood: M("gloom"), sprite: GLOOM, ink: "#2a2230", vig: 0.45, shake: 0.12,
    cam: keysCam([[0, [A.x + 4, 1.7, A.z - 6], [A.x - 5, 1.8, A.z + 8], 46], [2.4, [A.x + 1, 1.6, A.z - 1.5], [A.x - 4, 1.6, A.z + 8], 40], [3.6, [A.x + 3.6, 2.3, A.z + 2.2], [A.x + 3.8, 1.1, A.z + 6.1], 30], [4.4, [A.x + 3.9, 2.1, A.z + 3.4], [A.x + 4, 1.15, A.z + 6.1], 24], [5.0, [A.x - 2.5, 1.9, A.z + 3.5], [A.x - 6, 2.1, A.z + 9.9], 30], [6.54, [A.x - 4, 2.2, A.z + 4.5], [A.x - 6, 2.4, A.z + 9.8], 28]]),
    setup: (w, lt, t, show, c) => { c.cx = A.x; c.cz = A.z + 6; for (let i = 0; i < 6; i++) show(THIN + i, { x: A.x - 9.5 + i * 1.5, z: A.z + 8.0 + (i % 2) * 0.5, y: 0.25, face: { eyes: "half", brows: "worried", mouth: "frown" }, pose: { sway: Math.sin(t * 1.2 + i) * 1.2, lean: 0.04 * (i % 2 ? 1 : -1), armL: { sh: 0.15, el: -0.1 }, armR: { sh: 0.15, el: -0.1 } } });
      show(THIN + 3, { x: A.x + 1.8, z: A.z + 7.2, y: 0.25, face: { eyes: "ring", brows: "worried", mouth: "frown", sweat: true }, pose: { armL: { sh: 2.2, el: -2.2 }, armR: { sh: 0.5, el: -1.0 } } }); } },
  // 14. 94.3-98: nobody has ever established the cause — empty square, callback to the opening
  { t0: 94.3, t1: 98.0, mood: M("dawn", "gloom", 0.4), sprite: GLOOM, leaves: true, shake: 0.06,
    cam: keysCam([[0, [3, 1.2, 10], [0, 1.1, 0], 40], [1.5, [0, 4, 14], [0, 1.6, -4], 44], [3.7, [4, 44, 36], [-6, 26, -80], 60]]),
    setup: (w, lt, t, show, c) => { c.cx = 0; c.cz = 0; show(FRAU, { x: 1.2, z: 0, sit: true, face: { eyes: "closed", brows: "flat", mouth: "line" } }); } },
];
const shotAt = (t: number) => SHOTS.find((s) => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

export const FilmWorld: React.FC = () => {
  setToonStyle({ ...FILM_TOON, ink: "#3b2a16" });
  return <Stage build={(W, H) => {
    const w = buildWorld(W, H);
    (w as any).ready = fontsPromise().then(() => { w.redrawText(); w.crowd.set([]); });
    const drawn: Record<number, number> = {}; const stringPos = w.strings.geometry.attributes.position as THREE.BufferAttribute;
    const lvN = (w.leaves.geometry.attributes.position as THREE.BufferAttribute).count; const leafBase = Array.from({ length: lvN }, (_, i) => [Math.sin(i * 12.9898) * 43758 % 1, Math.sin(i * 78.233) * 12345 % 1, Math.sin(i * 39.3467) * 999 % 1]);
    return { ...w, update: (t: number, f: number, post: PostParams) => {
      const s = shotAt(t); const lt = t - s.t0; setClock(t);
      const ms = s.mood(lt); const m = w.setMood(ms[0], ms[1], ms[2] ?? 0);
      const qf = Math.floor(f / 2); const qt = qf * 2 / FPS;
      w.pool.forEach((p) => { p.mesh.visible = false; }); w.crowd.set([]);
      const ctx: Ctx = { cx: 0, cz: 0 };
      const cam0 = s.cam(lt);
      // camera (+ shake, roll)
      const hallShot = !!s.hall;
      const amp = s.shake ?? 0.1; const k = amp * 0.09; const c = cam0;
      const p = new THREE.Vector3(c.p[0] + shk(t, 1) * k, c.p[1] + shk(t, 5) * k, c.p[2] + shk(t, 9) * k);
      const q = new THREE.Vector3(c.q[0] + shk(t, 3) * k * 0.7, c.q[1] + shk(t, 7) * k * 0.7, c.q[2] + shk(t, 11) * k * 0.7);
      if (!hallShot) { const gy = G(p.x, p.z) + 0.3; if (p.y < gy) p.y = gy; } else if (p.y < 0.4) p.y = 0.4;
      w.camera.position.copy(p); w.camera.fov = c.fov; w.camera.updateProjectionMatrix();
      const roll = s.roll ? s.roll(lt) : 0; w.camera.up.set(Math.sin(roll), Math.cos(roll), 0); w.camera.lookAt(q);
      const d = p.distanceTo(q);
      w.camera.updateMatrixWorld(true);
      const lights = s.sprite || DAY;
      const show = (i: number, o: Show) => {
        const h = w.pool[i]; if (!h) return; const y = o.y ?? G(o.x, o.z); h.mesh.visible = true; h.mesh.position.set(o.x, y, o.z); h.mesh.scale.setScalar(o.scale ?? 1);
        const pose: PersonPose = { face: { ...(o.face || calm) }, walk: o.walk !== undefined ? ((o.walk % 1) + 1) % 1 : undefined, sit: o.sit, ...(o.pose || {}) };
        if (o.lie) { h.mesh.rotation.order = "YXZ"; h.mesh.rotation.set(-1.52, o.yaw ?? 0, 0); h.mesh.position.y = y + 0.12; } else { h.mesh.rotation.order = "XYZ"; h.face(w.camera); }
        if (drawn[i] !== qf || o.lie !== undefined) { setClock(qt); pose.face.blink = pose.face.blink ?? blinkAt(qt, i); h.draw(pose); drawn[i] = qf; }
        h.setLight(lights[0], lights[1]);
      };
      s.setup?.(w, lt, t, show, ctx);
      w.crowd.setLight(new THREE.Color(lights[0]).lerp(new THREE.Color(lights[1]), 0.35));
      // lamps and hall light
      const nightK = ctx.night ? Math.max(0.0, m.night) : m.night * 0.5;
      w.lampLights.forEach((l, i) => { l.position.set(ctx.cx + (i - 1) * 4.5, 2.6, ctx.cz + (i === 1 ? 3 : -3)); l.intensity = ctx.hall ? 0 : nightK * (i === 0 ? 26 : 16); });
      w.hallLights.forEach((l) => { l.intensity = ctx.hall ? 26 : 0; });
      w.beam.visible = !!ctx.hall;
      // puppet strings
      const base = ctx.strings || []; const ln = Math.min(255, base.length * 3); for (let i = 0; i < ln; i++) { const a = base[Math.floor(i / 3)]; const o = ((i % 3) - 1) * 0.02; stringPos.setXYZ(i * 2, a[0] + o, a[1], a[2] + o); stringPos.setXYZ(i * 2 + 1, a[3] + o, a[4], a[5] + o); } stringPos.needsUpdate = true; w.strings.geometry.setDrawRange(0, ln * 2); w.strings.visible = ln > 0;
      // leaves
      w.leaves.visible = !!s.leaves; if (s.leaves) { const pos = w.leaves.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < lvN; i++) { const [a, b, c] = leafBase[i]; const fx = a - Math.floor(a), fy = b - Math.floor(b), fz = c - Math.floor(c); const y = (((fy * 18 - t * (1.2 + fz)) % 18) + 18) % 18; pos.setXYZ(i, cam0.p[0] + (fx - 0.5) * 36 + Math.sin(t * 1.3 + i) * 0.7, y, cam0.p[2] + (fz - 0.5) * 36 - 6 + Math.cos(t * 0.9 + i) * 0.7 + t * 0.6 % 1); } pos.needsUpdate = true; }
      // sun follows the action (shadows)
      const tgt = new THREE.Vector3(hallShot ? hx : cam0.p[0] * 0.5, 0, hallShot ? hz : cam0.p[2] * 0.5);
      const sd = m.sunDir; w.sunL.target.position.copy(tgt); w.sunL.position.set(tgt.x + sd[0], sd[1], tgt.z + sd[2]);
      post.edgeThin = 0; post.gamma = 0.9; post.saturation = 1.14; post.contrast = 1.0; post.tint.setRGB(1.08, 1.08, 1.1); post.inkColor.set(s.ink || "#3b2a16"); post.inkAfter = 1; post.softClip = 0.9; post.edgeWidth = 2.2; post.grain = 0.004; post.animGrain = 0; post.shadowTint.setRGB(0, -0.006, 0.015);
      post.edgeStrength = 0.95; post.edgeFadeFar = 160; post.ao = 0.3; post.aoRadius = Math.max(0.12, d * 0.08);
      post.focus = d; post.focusRange = Math.max(2, d * 0.9) * (s.dof ?? 1); post.maxBlur = 2.5; post.nearBlur = 1.5;
      post.bloom = 0.5; post.bloomThreshold = 0.985; post.vignette = s.vig ?? 0.26; post.lift.setRGB(0.02, 0.012, 0.03);
    } };
  }} />;
};

// ---------- HUD overlays + transitions (DOM) ----------
const pop = (t: number, t0: number, dur = 2.4) => { const a = t - t0; if (a < 0 || a > dur) return null; const sc = a < 0.22 ? 0.4 + 0.75 * Math.sin((a / 0.22) * Math.PI * 0.5) : a < 0.34 ? 1.15 - 0.15 * ((a - 0.22) / 0.12) : 1; const o = a > dur - 0.3 ? (dur - a) / 0.3 : 1; return { sc, o }; };
const Tag: React.FC<{ t: number; t0: number; dur?: number; text: string; color?: string; top: number; size?: number; rot?: number }> = ({ t, t0, dur, text, color = "#fff", top, size = 150, rot = -3 }) => {
  const p = pop(t, t0, dur); if (!p) return null;
  return <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: size, color, WebkitTextStroke: `${size * 0.09}px #1a1010`, paintOrder: "stroke fill", textShadow: "0 10px 0 #1a1010", transform: `scale(${p.sc}) rotate(${rot}deg)`, opacity: p.o, whiteSpace: "nowrap" }}>{text}</div>;
};
const COUNT: [number, string][] = [[9.5, "1"], [28.8, "7"], [33.2, "30"], [41.0, "400"]];
const Hud: React.FC<{ t: number }> = ({ t }) => {
  let n = ""; let t0 = 0; for (const [tt, v] of COUNT) if (t >= tt && t < 52) { n = v; t0 = tt; }
  if (!n) return null; const a = t - t0; const sc = a < 0.3 ? 1 + 0.35 * Math.sin((a / 0.3) * Math.PI) : 1;
  return <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center" }}><div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 54, color: "#fff", background: "rgba(26,16,16,0.72)", border: "5px solid #fff", borderRadius: 60, padding: "6px 36px", transform: `scale(${sc})`, letterSpacing: 1 }}>ТАНЦУЮТ: <span style={{ color: "#ffd24a" }}>{n}</span></div></div>;
};
const CUTS = SHOTS.slice(1).map((s) => s.t0);

export const Film: React.FC = () => {
  const frame = useCurrentFrame(); const t = frame / FPS;
  const nearest = CUTS.reduce((b, c) => (Math.abs(c - t) < Math.abs(b - t) ? c : b), 1e9);
  const dtc = (t - nearest) * FPS;
  const dark = (() => { const s = shotAt(t); const m = s.mood(t - s.t0)[0]; return m === "night" || (m === "dusk" && (s.mood(t - s.t0)[1] === "night")); })();
  const flash = interpolate(dtc, [-2, 0, 4], [0, 0.4, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(t, [DUR - 1.0, DUR - 0.03], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeIn = interpolate(frame, [0, 4], [0.7, 0], { extrapolateRight: "clamp" });
  // doorway frame during the "you step out of the house" shot
  const door = t >= 38.0 && t < 41.0 ? interpolate(t, [38.0, 39.6, 40.8], [1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const doorShift = interpolate(t, [39.6, 40.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FilmWorld />
      {door > 0 ? <AbsoluteFill style={{ opacity: door }}>
        <div style={{ position: "absolute", left: -40 - doorShift * 300, top: 0, width: 190, height: 1920, background: "linear-gradient(90deg,#1c1008,#3a2412 80%,#241608)", boxShadow: "12px 0 30px rgba(0,0,0,0.6)" }} />
        <div style={{ position: "absolute", right: -40 - doorShift * 300, top: 0, width: 190, height: 1920, background: "linear-gradient(270deg,#1c1008,#3a2412 80%,#241608)", boxShadow: "-12px 0 30px rgba(0,0,0,0.6)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: -60 - doorShift * 300, height: 330, background: "linear-gradient(180deg,#1c1008,#3a2412 85%,#241608)", boxShadow: "0 12px 30px rgba(0,0,0,0.6)" }} />
      </AbsoluteFill> : null}
      <Tag t={t} t0={0.44} dur={2.6} text="1518" color="#ffd24a" top={190} size={170} rot={-3} />
      <Tag t={t} t0={3.06} dur={2.8} text="СТРАСБУРГ" color="#ffffff" top={230} size={110} rot={2} />
      <Tag t={t} t0={22.7} dur={1.6} text="!" color="#ff5a4a" top={190} size={300} rot={-4} />
      <Tag t={t} t0={24.3} dur={2.4} text="24 ч" color="#9fe0ff" top={200} size={150} rot={3} />
      <Tag t={t} t0={27.9} dur={2.2} text="ЧЕРЕЗ 3 ДНЯ" color="#ffd24a" top={230} size={100} rot={-2} />
      <Tag t={t} t0={51.74} dur={2.4} text="ПАНИКА!" color="#ff5a4a" top={190} size={150} rot={-3} />
      <Tag t={t} t0={62.52} dur={2.2} text="♪ ♫" color="#ffd24a" top={210} size={170} rot={4} />
      <Tag t={t} t0={72.16} dur={2.6} text="СВ. ВИТ" color="#ffffff" top={230} size={120} rot={-2} />
      <Tag t={t} t0={76.4} dur={2.8} text="СЕНТЯБРЬ" color="#ffb04a" top={230} size={120} rot={2} />
      <Tag t={t} t0={82.5} dur={3.4} text="?" color="#ffffff" top={150} size={380} rot={5} />
      <Tag t={t} t0={92.82} dur={1.5} text="СТРЕСС" color="#ff7a5a" top={210} size={130} rot={-3} />
      <Tag t={t} t0={93.58} dur={2.2} text="ГОЛОД" color="#ffd24a" top={390} size={130} rot={3} />
      <Hud t={t} />
      <Captions cards={CARDS} />
      <AbsoluteFill style={{ background: dark ? "#0a0d1c" : "#fff", opacity: flash, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: Math.max(fadeOut, fadeIn), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
