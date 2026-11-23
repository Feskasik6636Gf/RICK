import React from "react";
import { useCurrentFrame, useVideoConfig, staticFile, delayRender, continueRender } from "remotion";

// Subtitles: Titan One (Latin/digits) + Rubik Black fallback for Cyrillic (Titan One has no Cyrillic glyphs).
// Colour strictly white. 58 px (was 72) so cards are smaller than before. 1-2 words per card, pop-in on the word frame.
export type Word = [number, number, string];
const SHORT = new Set(["в", "и", "а", "но", "на", "не", "из", "от", "по", "за", "что", "как", "он", "я", "ни", "их", "то", "под", "это", "уже", "ты", "к", "до", "с", "у", "о", "все", "они", "так"]);
export const groupWords = (words: Word[]) => {
  const cards: { t0: number; t1: number; text: string }[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    let text = w[2], end = w[1];
    const clean = text.toLowerCase().replace(/[.,!?:—]/g, "");
    const endsSentence = /[.!?,:]$/.test(text);
    if (!endsSentence && i + 1 < words.length && (SHORT.has(clean) || clean.length <= 2) && words[i + 1][2].length <= 10) { text += " " + words[i + 1][2]; end = words[i + 1][1]; i++; }
    cards.push({ t0: w[0], t1: end, text });
    i++;
  }
  for (let k = 0; k < cards.length - 1; k++) cards[k].t1 = cards[k + 1].t0;
  for (let k = 0; k < cards.length - 1; ) {
    if (cards[k].t1 - cards[k].t0 < 0.13 && (cards[k].text + " " + cards[k + 1].text).length <= 20) { cards[k + 1] = { t0: cards[k].t0, t1: cards[k + 1].t1, text: cards[k].text + " " + cards[k + 1].text }; cards.splice(k, 1); } else k++;
  }
  return cards;
};
let loaded = false;
const ensureFonts = () => {
  if (loaded) return; loaded = true;
  const h = delayRender("fonts");
  const t = new FontFace("TitanOne", `url(${staticFile("fonts/TitanOne.ttf")})`);
  const r = new FontFace("RubikBlack", `url(${staticFile("fonts/Rubik.ttf")})`, { weight: "100 900" });
  Promise.all([t.load(), r.load()]).then(([a, b]) => { (document as any).fonts.add(a); (document as any).fonts.add(b); continueRender(h); }).catch(() => continueRender(h));
};
export const FONT = "TitanOne, RubikBlack, 'Arial Black', sans-serif";
export const Captions: React.FC<{ cards: { t0: number; t1: number; text: string }[] }> = ({ cards }) => {
  ensureFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame + 1) / fps;
  const c = cards.find((k) => t >= k.t0 && t < k.t1);
  if (!c) return null;
  const age = (t - c.t0) * fps; // frames since card start: quick pop
  const s = age < 5 ? 0.86 + 0.14 * Math.sin((age / 5) * Math.PI * 0.5) + (age > 2 ? 0.05 * Math.sin(((age - 2) / 3) * Math.PI) : 0) : 1;
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: 1376 - 64, textAlign: "center", fontFamily: FONT, fontWeight: 900, fontSize: 58, color: "#ffffff", WebkitTextStroke: "9px #000", paintOrder: "stroke fill", textShadow: "0 6px 0 #000, 0 9px 8px rgba(0,0,0,0.45)", letterSpacing: 0.5, lineHeight: "76px", transform: `scale(${s})`, transformOrigin: "50% 60%", textTransform: "none" }}>
      {c.text}
    </div>
  );
};
