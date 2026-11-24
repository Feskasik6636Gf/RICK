// usage: node scripts/stills.mjs outDir scale t1 t2 t3 ... (times in seconds)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
const [out, scale, ...times] = process.argv.slice(2);
const bundled = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "swangle" } });
const comp = await selectComposition({ serveUrl: bundled, id: "Dance", puppeteerInstance: browser });
for (const t of times) {
  const frame = Math.round(parseFloat(t) * 30);
  const t0 = Date.now();
  await renderStill({ composition: comp, serveUrl: bundled, output: path.join(out, `s_${String(t).padStart(5, "0")}.png`), frame, scale: parseFloat(scale), puppeteerInstance: browser, chromiumOptions: { gl: "swangle" } });
  console.log("frame", frame, Date.now() - t0, "ms");
}
await browser.close();
