// Monotone cubic (Fritsch-Carlson) camera splines
export type CamKey = [number, [number, number, number], [number, number, number], number];
export type Cam = { p: [number, number, number]; q: [number, number, number]; fov: number };
export const mono = (ts: number[], ys: number[], t: number) => {
  const n = ts.length; if (t <= ts[0]) return ys[0]; if (t >= ts[n - 1]) return ys[n - 1];
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  m.push(d[0]); for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2); m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b; if (h > 9) { const tau = 3 / Math.sqrt(h); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; } }
  let i = 0; while (i < n - 2 && t > ts[i + 1]) i++;
  const hh = ts[i + 1] - ts[i], u = (t - ts[i]) / hh;
  return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * hh * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * hh * m[i + 1];
};
export const keysCam = (keys: CamKey[]) => (t: number): Cam => {
  const ts = keys.map((k) => k[0]); const c = (i: 1 | 2, a: number) => mono(ts, keys.map((k) => k[i][a]), t);
  return { p: [c(1, 0), c(1, 1), c(1, 2)], q: [c(2, 0), c(2, 1), c(2, 2)], fov: mono(ts, keys.map((k) => k[3]), t) };
};
export const shk = (t: number, k: number) => Math.sin(t * 31 + k) * 0.5 + Math.sin(t * 57 + k * 2.3) * 0.35 + Math.sin(t * 91 + k * 4.1) * 0.15;
