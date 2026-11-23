import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import * as THREE from "three";
import { Stage } from "../engine/Stage";
import { PostParams } from "../engine/post";
import { setToonStyle, FILM_TOON } from "../engine/toon2d";
import { setClock, PersonPose } from "../film/person";
import { buildWorld, DWorld, terrainH as G, smooth, lerp } from "./world";
import { Captions, groupWords, FONT } from "./Captions";
import { WORDS } from "./words";

export const FPS = 30;
export const DUR = 95.07;
const CARDS = groupWords(WORDS as any);

// ---- camera ----
export type CamKey = [number, [number, number, number], [number, number, number], number];
const mono = (ts: number[], ys: number[], t: number) => {
  const n = ts.length; if (t <= ts[0]) return ys[0]; if (t >= ts[n - 1]) return ys[n - 1];
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  m.push(d[0]); for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2); m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b; if (h > 9) { const tau = 3 / Math.sqrt(h); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; } }
  let i = 0; while (i < n - 2 && t > ts[i + 1]) i++;
  const hh = ts[i + 1] - ts[i], u = (t - ts[i]) / hh;
  return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * hh * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * hh * m[i + 1];
};
type Cam = { p: [number, number, number]; q: [number, number, number]; fov: number };
const keysCam = (keys: CamKey[]) => (t: number): Cam => {
  const ts = keys.map((k) => k[0]); const c = (i: 1 | 2, a: number) => mono(ts, keys.map((k) => k[i][a]), t);
  return { p: [c(1, 0), c(1, 1), c(1, 2)], q: [c(2, 0), c(2, 1), c(2, 2)], fov: mono(ts, keys.map((k) => k[3]), t) };
};
const shk = (t: number, k: number) => Math.sin(t * 31 + k) * 0.5 + Math.sin(t * 57 + k * 2.3) * 0.35 + Math.sin(t * 91 + k * 4.1) * 0.15;

// ---- people helpers ----
type Show = { x: number; z: number; y?: number; walk?: number; face?: PersonPose["face"]; pose?: Partial<PersonPose>; lie?: number; yaw?: number; scale?: number; sit?: boolean };
const fcalm = { eyes: "half", brows: "flat", mouth: "line" } as const;
const fpanic = { eyes: "ring", brows: "worried", mouth: "o", sweat: true } as const;
const fcold = { eyes: "squint", brows: "worried", mouth: "frown" } as const;
const swing = (ph: number, k = 0.55) => ({ armL: { sh: 0.3 + k * Math.sin(ph * Math.PI * 2), el: -0.25 }, armR: { sh: 0.3 - k * Math.sin(ph * Math.PI * 2), el: -0.25 } });
const blinkAt = (t: number, i: number) => (Math.abs(((t + i * 0.83) % 2.6) - 1.3) < 0.07 ? 1 : 0);

type Shot = {
  t0: number; t1: number;
  mood: [string, string?, ((lt: number) => number)?];
  cam: (lt: number) => Cam;
  shake?: (lt: number) => number;
  roll?: (lt: number) => number;
  snow?: number; // intensity 0..1
  setup?: (w: DWorld, lt: number, t: number, show: (i: number, s: Show) => void, ctx: Ctx) => void;
  ink?: string; vig?: number; bright?: number; dof?: number;
};
type Ctx = { lantern: number; fire: number; glow: number; slit: number; powder: number; inside?: boolean };

// ---- the cut ----
const SHOTS: Shot[] = [
  // 1. HOOK 0-6.9: nine hikers in a day march, pull-out reveal
  { t0: 0, t1: 6.9, mood: ["day"], snow: 0.15,
    cam: (lt) => { const cx = -23 + 1.5 * lt; const y = G(cx, -30); const f = keysCam([[0, [3.5, 1.7, -23.5], [-1.5, 1.5, -30], 40], [1.4, [5.5, 2.4, -22], [-1, 1.6, -30], 40], [3.2, [9, 7.5, -17], [0, 1.2, -31], 52], [5.0, [15, 20, -2], [0, 0, -33], 68], [6.9, [26, 40, 24], [-3, -2, -34], 86]])(lt); return { p: [cx + f.p[0], y + f.p[1], f.p[2]], q: [cx + f.q[0], y + f.q[1], f.q[2]], fov: f.fov }; },
    shake: (t) => 0.15 + (t > 4.8 ? 0.2 : 0),
    setup: (w, lt, t, show) => { for (let i = 0; i < 9; i++) { const x = -16 + 1.5 * t - i * 1.8; const zz = -30 + Math.sin(i * 1.3) * 0.9; show(i, { x, z: zz, walk: t * 1.7 + i * 0.13, face: { ...fcalm, look: [0.7, 0], blink: blinkAt(t, i) }, pose: swing(t * 1.7 + i * 0.13) }); } } },
  // 2. 6.9-9.7: experienced — whip across three faces
  { t0: 6.9, t1: 9.7, mood: ["day", "dusk", (lt) => smooth(lt / 2.8) * 0.6],
    cam: (lt) => { const t = 6.9 + lt; const who = lt < 0.9 ? 2 : lt < 1.85 ? 5 : 7; const x = -16 + 1.5 * t - who * 1.8; const zz = -30 + Math.sin(who * 1.3) * 0.9; const y = G(x, zz); const dolly = (lt % 0.95) * 0.35; return { p: [x + 1.2 - dolly, y + 1.55, zz + 3.0 - dolly], q: [x, y + 1.4, zz], fov: 32 - 3 * (lt % 0.95) }; },
    shake: () => 0.35, roll: (lt) => 0.05 * Math.sin(lt * 6) * (lt < 2.8 ? 1 : 0),
    setup: (w, lt, t, show) => { for (let i = 0; i < 9; i++) show(i, { x: -16 + 1.5 * t - i * 1.8, z: -30 + Math.sin(i * 1.3) * 0.9, walk: t * 1.7 + i * 0.13, face: { eyes: "open", brows: i % 2 ? "smug" : "flat", mouth: "smirk", look: [0.6, 0] }, pose: swing(t * 1.7 + i * 0.13) }); } },
  // 3. 9.7-15.8: one night — time-lapse dusk to night, flight away from the glowing tent
  { t0: 9.7, t1: 15.8, mood: ["dusk", "night", (lt) => smooth(lt / 4.2)], snow: 0.3,
    cam: keysCam([[0, [-7, 1.3, 19], [0, 1.6, 4], 40], [1.8, [-10, 3.5, 17], [0, 2, 4], 46], [4.0, [-17, 14, 34], [0, 2, 0], 56], [6.1, [-24, 34, 52], [0, 0, -10], 70]]),
    shake: () => 0.12,
    setup: (w, lt, t, show, c) => { c.lantern = smooth(lt / 3); c.glow = smooth(lt / 3); } },
  // 4. 15.8-29.5: inside the tent
  { t0: 15.8, t1: 29.5, mood: ["night"], snow: 0.0, ink: "#07091a", vig: 0.5, dof: 1.4,
    cam: keysCam([[0, [0.0, 1.0, 6.05], [0, 1.0, 2.0], 62], [3.8, [0.15, 1.0, 5.0], [0.1, 1.05, 2.0], 52], [6.7, [0.0, 0.9, 4.4], [0.3, 1.1, 2.4], 44], [10.2, [0.0, 1.0, 4.2], [0.2, 1.3, 2.6], 38], [10.8, [0.3, 1.28, 3.5], [0.35, 1.3, 2.3], 26], [13.7, [0.3, 1.28, 3.2], [0.35, 1.3, 2.3], 22]]),
    shake: (lt) => 0.08 + 0.5 * smooth((lt - 4.0) / 3.5) + (lt > 10.8 ? 0.5 : 0),
    roll: (lt) => 0.03 * Math.sin(lt * 3.1) * smooth((lt - 4.5) / 4) + (lt > 10.8 ? 0.07 : 0),
    setup: (w, lt, t, show, c) => {
      c.lantern = 1.4 * (lt < 4.2 ? 1 : 1 + 0.25 * Math.sin(t * 19)); c.glow = 1; c.inside = true;
      const awake = lt > 3.8;
      show(0, { x: 0.25, z: 3.1, scale: 0.92, sit: true, face: awake ? (lt > 10.8 ? fpanic : { eyes: "open", brows: "worried", mouth: "line", look: [0, 0.3] }) : { eyes: "closed", brows: "flat", mouth: "line" }, pose: { bob: 0, sway: Math.sin(t * 4) * (lt > 4 ? 1.5 : 0.4) } });
    } },
  // 5. 29.5-33.8: the tent is cut from inside, hikers burst out
  { t0: 29.5, t1: 33.8, mood: ["night"], snow: 0.9, ink: "#07091a", vig: 0.45,
    cam: keysCam([[0, [-4.6, 1.7, 7.2], [-1, 1.2, 4.3], 52], [0.7, [-3.0, 1.45, 6.0], [-1.0, 1.2, 4.3], 30], [1.2, [-2.6, 1.4, 5.5], [-1.0, 1.2, 4.4], 26], [1.7, [-3.5, 1.8, 10], [-1.5, 1.2, 6.5], 50], [3.0, [-4.5, 2.6, 15], [-1.5, 1.0, 11.5], 56], [4.3, [-5, 3.2, 19], [-1.5, 1.0, 16], 60]]),
    shake: (lt) => 0.4 + (lt < 1.4 ? 0.8 : 0.35), roll: (lt) => -0.06 * Math.sin(lt * 9),
    setup: (w, lt, t, show, c) => {
      c.lantern = 1.0; c.glow = 1; c.slit = smooth((lt - 0.05) / 0.55);
      for (let i = 0; i < 9; i++) { const dt = lt - (1.0 + i * 0.16); if (dt < 0) continue; show(i, { x: -1.15 - dt * 0.9 - (i % 3) * 0.5, z: 4.6 + dt * 4.0, walk: dt * 2.4 + i * 0.3, face: fpanic, pose: { ...swing(dt * 2.4 + i * 0.3, 0.9), lean: 0.1 } }); }
    } },
  // 6. 33.8-39: they leave shoes, warm clothes, food
  { t0: 33.8, t1: 39, mood: ["night"], snow: 0.9, ink: "#07091a", vig: 0.45,
    cam: keysCam([[0, [-3.6, 0.32, 10.5], [0, 0.4, 5], 52], [1.8, [-1.2, 0.4, 8.6], [0.6, 0.5, 5.5], 60], [3.4, [2.5, 0.8, 9], [0, 0.4, 4.6], 64], [5.2, [4, 1.6, 17], [0, 1.0, 30], 46]]),
    shake: () => 0.3, roll: (lt) => 0.05 * Math.sin(lt * 2.3),
    setup: (w, lt, t, show, c) => { c.lantern = 0.7; c.glow = 0.8; c.slit = 1; for (let i = 0; i < 9; i++) { const dt = 5.2 + lt + i * 0.16; show(i, { x: -1.15 - dt * 0.9 - (i % 3) * 0.5 + Math.sin(dt) * 0.4, z: 4.6 + dt * 4.0 > 44 ? 44 + (i % 4) * 2 + lt * 2.2 : 4.6 + dt * 4.0, walk: dt * 2.4 + i * 0.3, face: fpanic, pose: swing(dt * 2.4, 0.8) }); } } },
  // 7. 39-46.4: -25, barefoot among snowy mountains — crane to the vast white
  { t0: 39, t1: 46.4, mood: ["night", "deep", (lt) => smooth(lt / 3)], snow: 1, ink: "#07091a",
    cam: keysCam([[0, [0.4, 0.28, 29.6], [0.3, 0.05, 31.5], 58], [1.1, [0.2, 0.5, 29.2], [0.2, 0.2, 31.5], 58], [1.9, [-2, 2.4, 27], [0, 1.2, 40], 52], [4.2, [-14, 15, 22], [0, 0, 48], 72], [7.4, [-38, 48, 6], [0, -4, 56], 84]]),
    shake: (lt) => 0.7 * (1 - smooth(lt / 7)) + 0.12, roll: (lt) => 0.05 * Math.sin(lt * 7),
    setup: (w, lt, t, show) => { for (let i = 0; i < 9; i++) { const sh = lt > 0.2 ? 1.5 * Math.sin(t * 17 + i) : 0; show(i, { x: -6 + (i % 5) * 3 - Math.floor(i / 5) * 1.4, z: 38 + Math.floor(i / 5) * 4 + (i % 3), face: fcold, pose: { armL: { sh: 0.2, el: -2.4 }, armR: { sh: 0.2, el: -2.4 }, sway: sh * 0.6, bob: 0 } }); } } },
  // 8. 46.4-53: forest is a kilometre away; going back is scarier — dolly zoom, whip-turn to the tent
  { t0: 46.4, t1: 53, mood: ["deep"], snow: 0.9, ink: "#07091a",
    cam: keysCam([[0, [0, 1.8, 24], [0, 5, 110], 50], [2.2, [0, 1.9, 40], [0, 3, 120], 34], [3.0, [0, 1.9, 41], [0, 3, 120], 30], [3.35, [-1, 1.9, 41], [-30, 3, 60], 52], [3.75, [0, 2.0, 41], [0, 3, -40], 62], [5.6, [0, 2.4, 47], [0, 3, -40], 36], [6.6, [0, 2.4, 49], [0, 3, -40], 30]]),
    shake: (lt) => 0.25 + (lt > 3 && lt < 3.9 ? 0.9 : 0), roll: (lt) => (lt > 3 && lt < 3.9 ? 0.18 : 0),
    setup: (w, lt, t, show) => { for (let i = 0; i < 9; i++) show(i, { x: -4 + i * 1.0 + Math.sin(i) * 0.5, z: 36 + (i % 3) * 1.3, face: lt < 3.3 ? { ...fcold, look: [0, 0] } : fpanic, pose: { sway: Math.sin(t * 20 + i) * 1.5, armL: { sh: 0.4, el: -2.2 }, armR: { sh: 0.4, el: -2.2 } }, yaw: 0 }); } },
  // 9. 53-61: fire under the cedar, others walk back and never arrive
  { t0: 53, t1: 61, mood: ["deep"], snow: 1, ink: "#07091a", vig: 0.4,
    cam: (lt) => { if (lt < 3.7) { const a = 0.5 + lt * 0.55; const cx = 4.2, cz = 92.3, r = 8.5 - lt * 0.9; const y = G(cx, cz); return { p: [cx + Math.sin(a) * r, y + 1.6 + lt * 0.15, cz + Math.cos(a) * r], q: [cx, y + 1.4, cz], fov: 46 - lt * 2 }; } return keysCam([[3.7, [-7, 2.4, 52], [0, 1.0, 62], 44], [5.8, [-9, 2.4, 40], [0, 1.0, 46], 40], [8, [-10, 3.0, 28], [0, 0.4, 34], 52]])(lt); },
    shake: (lt) => 0.2 + (lt > 3.6 && lt < 4.2 ? 0.9 : 0.25), roll: (lt) => (lt > 3.6 && lt < 4.2 ? 0.2 : 0.02 * Math.sin(lt * 3)),
    setup: (w, lt, t, show, c) => {
      if (lt < 3.9) { c.fire = 1; show(1, { x: 2.8, z: 93.6, sit: true, face: { eyes: "half", brows: "worried", mouth: "frown" }, pose: { armL: { sh: 0.7, el: 0.2 }, armR: { sh: 0.7, el: 0.2 } } }); show(5, { x: 5.8, z: 93.7, sit: true, face: { eyes: "half", brows: "worried", mouth: "frown", turn: -0.4 } as any }); show(6, { x: 4.2, z: 90.8, sit: true, face: fcold }); }
      else { c.fire = 0.5; const dt = lt - 3.9; for (const [k, i] of [[0, 0], [1, 2], [2, 7]] as [number, number][]) { const z = 62 - dt * 3.2 + k * 3; const lie = dt > 3.0 + k * 0.35; show(i, { x: -1 + k * 2.4, z: Math.max(z, 40 - k * 3), walk: dt * 2.0, lie: lie ? 1 : 0, face: fcold, pose: swing(dt * 2.0, 0.5), yaw: 0.4 }); } }
    } },
  // 10. 61-68.4: dawn, rescuers' view: bodies on the slope
  { t0: 61, t1: 68.4, mood: ["dawn"], snow: 0.25,
    cam: keysCam([[0, [14, 13, -4], [0, 0, 22], 62], [3.4, [7, 6, 14], [-1, 0, 28], 48], [7.4, [2.4, 2.4, 30.5], [0.5, 0.2, 35], 34]]),
    shake: () => 0.15,
    setup: (w, lt, t, show, c) => { c.glow = 0; c.slit = 1; const pts: [number, number, number][] = [[0.6, 33, 0.4], [-1.2, 29.5, -0.6], [-2.5, 24, 1.2], [1.8, 16, 0.2], [-0.2, 10.5, -1.0]]; pts.forEach(([x, z, y], k) => show(k, { x, z, lie: 1, yaw: y, face: { eyes: "closed", brows: "flat", mouth: "line" } })); } },
  // 11a. 68.4-73.8: why did nine experienced hikers leave? line-up
  { t0: 68.4, t1: 73.8, mood: ["night"], snow: 0.5, ink: "#07091a",
    cam: keysCam([[0, [0, 1.7, 28], [0, 1.5, 14], 44], [1.3, [-6.4, 1.4, 20.5], [-6, 1.5, 14], 32], [2.6, [0.2, 1.3, 20], [0, 1.5, 14], 30], [4.0, [6.4, 1.4, 20.5], [6, 1.5, 14], 31], [5.4, [0, 2.4, 22], [0, 1.4, 14], 52]]),
    shake: () => 0.18, roll: (lt) => 0.07 * Math.sin(lt * 1.6),
    setup: (w, lt, t, show, c) => { c.lantern = 0.6; c.glow = 0.6; c.slit = 1; for (let i = 0; i < 9; i++) show(i, { x: -6 + i * 1.5, z: 14, face: { eyes: "ring", brows: "up", mouth: "o", sweat: i % 2 === 0, blink: 0 }, pose: { sway: Math.sin(t * 4 + i) * 0.6, armL: { sh: 0.4, el: 0 }, armR: { sh: 0.4, el: 0 } } }); } },
  // 11b. 73.8-77.8: fly through the slit into the dark tent
  { t0: 73.8, t1: 77.8, mood: ["night"], snow: 0.7, ink: "#07091a", vig: 0.55,
    cam: keysCam([[0, [-7, 2.2, 17], [-1, 1.2, 4.4], 52], [1.9, [-2.6, 1.35, 6.4], [-0.95, 1.2, 4.5], 34], [2.7, [-1.2, 1.2, 5.0], [0.2, 1.1, 3], 50], [4.0, [0, 1.1, 3.6], [0.3, 1.1, 1.0], 78]]),
    shake: (lt) => 0.3 + 0.5 * smooth((lt - 1.5) / 1.2), roll: (lt) => 0.1 * smooth((lt - 1.4) / 2),
    setup: (w, lt, t, show, c) => { c.slit = 1; c.glow = lt < 2.2 ? 0.7 : 0.15; c.lantern = lt < 2.2 ? 0.7 : 0.15; c.inside = lt > 2.4; } },
  // 12a. 77.8-83.8: 2020 — avalanche from the mountain
  { t0: 77.8, t1: 83.8, mood: ["dawn"], snow: 0.2,
    cam: keysCam([[0, [-34, 20, -14], [0, 14, -70], 62], [2.0, [-30, 12, -24], [0, 8, -50], 50], [3.6, [-20, 7, 14], [0, 2, -10], 64], [6.0, [-46, 22, 30], [0, 0, -6], 78]]),
    shake: (lt) => 0.2 + 0.7 * smooth((lt - 1.0) / 2), roll: (lt) => 0.05 * Math.sin(lt * 5),
    setup: (w, lt, t, show, c) => { c.glow = 0; c.slit = 1; c.powder = lt; } },
  // 12b. 83.8-88.3: still disputes — fast orbit around the tent
  { t0: 83.8, t1: 88.3, mood: ["dawn", "day", (lt) => smooth(lt / 4.5)], snow: 0.1,
    cam: (lt) => { const a = -0.6 + lt * 0.75; const r = 17 - lt * 1.1; return { p: [Math.sin(a) * r, 5.2 - lt * 0.5, 4 + Math.cos(a) * r], q: [0, 1.0, 4], fov: 46 + 6 * Math.sin(lt * 1.2) }; },
    shake: () => 0.14, roll: (lt) => 0.04 * Math.sin(lt * 2),
    setup: (w, lt, t, show, c) => { c.slit = 1; c.glow = 0; } },
  // 13. 88.3-95: nobody left an explanation — slow pull back, dark
  { t0: 88.3, t1: 95.07, mood: ["deep"], snow: 0.75, ink: "#07091a", vig: 0.55,
    cam: keysCam([[0, [-2.6, 1.3, 6.4], [-1.0, 1.2, 4.4], 34], [2.5, [-5, 1.9, 11], [-0.5, 1.4, 4.4], 38], [5.0, [-11, 5, 24], [0, 1.4, 4], 44], [6.77, [-16, 9, 36], [0, 1.4, 4], 48]]),
    shake: () => 0.1,
    setup: (w, lt, t, show, c) => { c.slit = 1; const f = lt > 5 ? Math.max(0, 1 - (lt - 5) / 1.6) : 1; c.lantern = 0.5 * f * (1 + 0.3 * Math.sin(t * 13)); c.glow = 0.4 * f; } },
];

const shotAt = (t: number) => SHOTS.find((s) => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

export const FilmWorld: React.FC = () => {
  setToonStyle({ ...FILM_TOON, ink: "#3b2a16" });
  return <Stage build={(W, H) => {
    const w = buildWorld(W, H);
    // abandoned things by the tent: boots, packs, jackets
    const sc = w.scene; const bm = new THREE.MeshLambertMaterial({ color: "#6a3b22" });
    const left: [number, number, string][] = [[-2.4, 8.2, "#6a3b22"], [-2.0, 8.6, "#6a3b22"], [-3.2, 7.4, "#3a2a22"], [-2.8, 7.1, "#3a2a22"], [1.6, 9.0, "#6a3b22"], [2.0, 8.5, "#6a3b22"], [-1.0, 10, "#e0a82c"], [1.4, 7.4, "#c63b5a"], [2.6, 7.8, "#4a8a4a"]];
    left.forEach(([x, z, c], i) => { const big = i >= 6; const m = new THREE.Mesh(big ? new THREE.BoxGeometry(0.7, 0.9, 0.4) : new THREE.BoxGeometry(0.26, 0.2, 0.45), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, G(x, z) + (big ? 0.35 : 0.1), z); m.rotation.y = i * 0.9; m.castShadow = true; sc.add(m); void bm; });
    // avalanche powder
    const PN = 700; const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
    const dot = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(235,242,255,0.8)"); gr.addColorStop(1, "rgba(235,242,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const powder = new THREE.Points(pg, new THREE.PointsMaterial({ map: dot, size: 9, transparent: true, opacity: 0.8, depthWrite: false, sizeAttenuation: true, fog: false })); powder.frustumCulled = false; powder.userData.ndHide = true; powder.visible = false; sc.add(powder);
    const seeds = Array.from({ length: PN }, (_, i) => [Math.sin(i * 12.9898) * 43758 % 1, Math.sin(i * 78.233) * 12345 % 1, Math.sin(i * 39.3467) * 999 % 1]);
    const tentMat = (w.tent.children[0] as THREE.Mesh).material as THREE.MeshLambertMaterial;
    const slit = w.tent.userData.slit as THREE.Mesh;
    const drawn: Record<number, number> = {};
    const snowBase = new Float32Array((w.snowPts.geometry.attributes.position as THREE.BufferAttribute).array);
    const base = new THREE.Vector3();
    return { ...w, update: (t: number, f: number, post: PostParams) => {
      w.update(t, f, post);
      const s = shotAt(t); const lt = t - s.t0; setClock(t);
      // mood
      s.mood[1] ? w.setMood(s.mood[0], s.mood[1], s.mood[2]!(lt)) : w.setMood(s.mood[0]);
      // people
      const qf = Math.floor(f / 2); const qt = qf * 2 / FPS;
      w.hikers.forEach((h) => { h.mesh.visible = false; });
      const ctx: Ctx = { lantern: 0, fire: 0, glow: 0, slit: 0, powder: -1 };
      const cam0 = s.cam(lt); w.camera.position.set(...cam0.p);
      const show = (i: number, o: Show) => {
        const h = w.hikers[i]; const y = o.y ?? G(o.x, o.z); h.mesh.visible = true; h.mesh.position.set(o.x, y, o.z); h.mesh.scale.setScalar(o.scale ?? 1.35);
        const pose: PersonPose = { face: { ...(o.face || fcalm) }, walk: o.walk !== undefined ? ((o.walk % 1) + 1) % 1 : undefined, sit: o.sit, ...(o.pose || {}) };
        if (o.lie) { h.mesh.rotation.order = "YXZ"; h.mesh.rotation.set(-1.52, o.yaw ?? 0, 0); h.mesh.position.y = y + 0.12; h.mesh.scale.setScalar(1.3); } else { h.mesh.rotation.order = "XYZ"; h.face(w.camera); }
        if (drawn[i] !== qf || o.lie !== undefined) { setClock(qt); pose.face.blink = pose.face.blink ?? blinkAt(qt, i); h.draw(pose); drawn[i] = qf; }
        const night = ["night", "deep"].includes(s.mood[0]);
        h.setLight(night ? "#8fa6e8" : "#fff4e4", night ? "#5a6ca8" : "#d8d6ee");
        if (o.sit && ctx.fire) h.setLight("#ffb46a", "#c2785a"); else if (ctx.inside) h.setLight("#ffcf8a", "#c08a60");
      };
      s.setup?.(w, lt, t, show, ctx);
      // tent / lights
      w.lantern.intensity = ctx.lantern * 6; tentMat.emissive.setRGB(0.95 * ctx.glow, 0.45 * ctx.glow, 0.12 * ctx.glow); tentMat.emissiveIntensity = ctx.inside ? 0.22 : 0.5;
      slit.scale.set(1, Math.max(0.001, ctx.slit), 1); slit.visible = ctx.slit > 0.01;
      w.fire.intensity = ctx.fire * 26 * (w.fire.userData.flick ?? 1);
      // snow
      w.snowPts.visible = (s.snow ?? 0) > 0.02;
      if (w.snowPts.visible) { const pos = w.snowPts.geometry.attributes.position as THREE.BufferAttribute; const spd = 3 + 6 * (s.snow ?? 0); (w.snowPts.material as THREE.PointsMaterial).opacity = 0.35 + 0.6 * (s.snow ?? 0);
        for (let i = 0; i < pos.count; i++) { let y = snowBase[i * 3 + 1] - t * spd; y = ((y % 40) + 40) % 40; const xo = Math.sin(t * 0.7 + i) * 0.6 + t * (2 + 6 * (s.snow ?? 0)); let x = ((snowBase[i * 3] + xo + 40) % 80 + 80) % 80 - 40; pos.setXYZ(i, w.camera.position.x + x, w.camera.position.y - 14 + y, w.camera.position.z + snowBase[i * 3 + 2]); } pos.needsUpdate = true; }
      // powder avalanche
      powder.visible = ctx.powder >= 0;
      if (powder.visible) { const pp = pg.attributes.position as THREE.BufferAttribute; const T = ctx.powder; const op = Math.min(1, T / 1.2) * (1 - smooth((T - 4.9) / 1.0)); (powder.material as THREE.PointsMaterial).opacity = 0.85 * op;
        for (let i = 0; i < PN; i++) { const [a, b, c] = seeds[i]; const sx = (a - Math.floor(a)) * 80 - 40, sz = -78 + (b - Math.floor(b)) * 14; const adv = Math.max(0, T - 0.3); const dz = sz + 6 * adv + 4.5 * adv * adv * (0.7 + (c - Math.floor(c)) * 0.6); const x = sx * (0.8 + 0.08 * adv) + Math.sin(T * 3 + i) * 1.2; const z = Math.min(dz, 14 + (b - Math.floor(b)) * 20); pp.setXYZ(i, x, G(x, z) + 1.5 + Math.abs((c - Math.floor(c))) * (2 + adv * 2.2), z); } pp.needsUpdate = true; }
      // camera (+ shake, roll)
      const c = s.cam(lt); const amp = s.shake ? s.shake(lt) : 0.1; const tt = qt * 1 + 0; const k = amp * 0.09;
      const p = new THREE.Vector3(c.p[0] + shk(t, 1) * k, c.p[1] + shk(t, 5) * k, c.p[2] + shk(t, 9) * k);
      const q = new THREE.Vector3(c.q[0] + shk(t, 3) * k * 0.7, c.q[1] + shk(t, 7) * k * 0.7, c.q[2] + shk(t, 11) * k * 0.7);
      // never below the snow
      const gy = G(p.x, p.z) + 0.22; if (p.y < gy && !ctx.inside) p.y = gy; void tt; void base;
      w.camera.position.copy(p); w.camera.fov = c.fov; w.camera.updateProjectionMatrix();
      const roll = s.roll ? s.roll(lt) : 0; w.camera.up.set(Math.sin(roll), Math.cos(roll), 0); w.camera.lookAt(q);
      // sun follows camera for shadows
      const sunL = w.scene.children.find((o) => (o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
      sunL.target.position.set(p.x * 0.4, 0, p.z * 0.4 + 6); sunL.position.set(p.x * 0.4 - 60, 80, p.z * 0.4 + 46);
      // grade
      const d = p.distanceTo(q);
      post.edgeThin = 0; post.gamma = 0.9; post.saturation = 1.14; post.contrast = 1.0; post.tint.setRGB(1.08, 1.08, 1.1); post.inkColor.set(s.ink || "#3b2a16"); post.softClip = 0.9; post.edgeWidth = 2.2; post.grain = 0.004; post.animGrain = 0; post.shadowTint.setRGB(0, -0.006, 0.015); post.inkAfter = 1;
      post.edgeStrength = 0.95; post.edgeFadeFar = 160; post.ao = 0.35; post.aoRadius = Math.max(0.12, d * 0.08);
      post.focus = d; post.focusRange = Math.max(2, d * 0.9) * (s.dof ?? 1); post.maxBlur = 2.5; post.nearBlur = 1.5;
      post.bloom = 0.5; post.bloomThreshold = 0.985; post.vignette = s.vig ?? 0.28; post.lift.setRGB(0.02, 0.012, 0.03);
    } };
  }} />;
};

// ---------- HUD overlays + transitions (DOM) ----------
const pop = (t: number, t0: number, dur = 2.4) => { const a = t - t0; if (a < 0 || a > dur) return null; const s = a < 0.22 ? 0.4 + 0.75 * Math.sin((a / 0.22) * Math.PI * 0.5) : a < 0.34 ? 1.15 - 0.15 * ((a - 0.22) / 0.12) : 1; const o = a > dur - 0.3 ? (dur - a) / 0.3 : 1; return { s, o }; };
const Tag: React.FC<{ t: number; t0: number; dur?: number; text: string; color?: string; top: number; size?: number; rot?: number; sub?: string }> = ({ t, t0, dur, text, color = "#fff", top, size = 150, rot = -3, sub }) => {
  const p = pop(t, t0, dur); if (!p) return null;
  return <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: size, color, WebkitTextStroke: `${size * 0.09}px #0a0d1c`, paintOrder: "stroke fill", textShadow: "0 10px 0 #0a0d1c", transform: `rotate(${rot}deg) scale(${p.s})`, opacity: p.o, lineHeight: 1 }}>{text}{sub && <div style={{ fontSize: size * 0.3, marginTop: 14, WebkitTextStroke: "6px #0a0d1c", color: "#fff" }}>{sub}</div>}</div>;
};
const CUTS = SHOTS.slice(1).map((s) => s.t0);
const HARD = new Set([29.5, 61, 77.8]);

export const Film: React.FC = () => {
  const frame = useCurrentFrame(); const t = frame / FPS;
  const nearest = CUTS.reduce((b, c) => (Math.abs(c - t) < Math.abs(b - t) ? c : b), 1e9);
  const dtc = (t - nearest) * FPS; // frames relative to cut
  const flash = HARD.has(nearest) ? interpolate(dtc, [-1, 0, 5], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : interpolate(dtc, [-2, 0, 4], [0, 0.35, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const isHard = HARD.has(nearest); const night = t > 9.7 && !(t > 61 && t < 68.4) && !(t > 77.8 && t < 88.3);
  const fadeOut = interpolate(t, [DUR - 1.0, DUR - 0.05], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeIn = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FilmWorld />
      <Tag t={t} t0={1.55} dur={2.6} text="1959" color="#ffd24a" top={190} />
      <Tag t={t} t0={39.0} dur={3.2} text="-25°C" color="#9fe0ff" top={210} size={170} rot={2} />
      <Tag t={t} t0={46.5} dur={3.0} text="1 км+" color="#ffffff" top={230} size={140} rot={-2} />
      <Tag t={t} t0={68.4} dur={3.2} text="9" color="#ff6a4a" top={170} size={300} rot={-4} />
      <Tag t={t} t0={77.8} dur={3.0} text="2020" color="#ffd24a" top={200} size={180} rot={2} />
      <Tag t={t} t0={73.8} dur={2.6} text="?" color="#ffffff" top={250} size={330} rot={5} />
      <Tag t={t} t0={85.6} dur={2.6} text="?!" color="#ffd24a" top={260} size={300} rot={-5} />
      <Captions cards={CARDS} />
      <AbsoluteFill style={{ background: isHard ? "#fff" : (night ? "#0a0d1c" : "#fff"), opacity: flash, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: Math.max(fadeOut, fadeIn), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
