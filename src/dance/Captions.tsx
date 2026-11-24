import React from "react";
import { useCurrentFrame, useVideoConfig, staticFile, delayRender, continueRender } from "remotion";

export type Word = [number, number, string];
const SHORT = new Set(["в", "и", "а", "но", "на", "не", "из", "от", "по", "за", "что", "как", "он", "я", "ни", "их", "то", "под", "это", "уже", "ты", "к", "до", "с", "у", "о", "все", "они", "так", "ей", "ее", "её", "для", "ещё", "над", "из"]);
// 1-2 words per card (Ricks Clips style), a card appears exactly on its word frame
export const groupWords = (words: Word[]) => {
  const cards: { t0: number; t1: number; text: string }[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i]; let text = w[2], end = w[1];
    const clean = text.toLowerCase().replace(/[.,!?:—]/g, "");
    const endsSentence = /[.!?,:]$/.test(text);
    if (!endsSentence && i + 1 < words.length && (SHORT.has(clean) || clean.length <= 2) && words[i + 1][2].length <= 11) { text += " " + words[i + 1][2]; end = words[i + 1][1]; i++; }
    cards.push({ t0: w[0], t1: end, text }); i++;
  }
  for (let k = 0; k < cards.length - 1; k++) cards[k].t1 = cards[k + 1].t0;
  for (let k = 0; k < cards.length - 1;) {
    if (cards[k].t1 - cards[k].t0 < 0.13 && (cards[k].text + " " + cards[k + 1].text).length <= 20) { cards[k + 1] = { t0: cards[k].t0, t1: cards[k + 1].t1, text: cards[k].text + " " + cards[k + 1].text }; cards.splice(k, 1); } else k++;
  }
  return cards;
};
let loaded = false;
export const fontsPromise = (): Promise<void> => {
  const m = new FontFace("Montserrat", `url(${staticFile("fonts/Montserrat.ttf")})`, { weight: "100 900" });
  const n = new FontFace("NunitoBlack", `url(${staticFile("fonts/Nunito.ttf")})`, { weight: "100 900" });
  const t = new FontFace("TitanOne", `url(${staticFile("fonts/TitanOne.ttf")})`);
  return Promise.all([m.load(), n.load(), t.load()]).then(([a, b, c]) => { (document as any).fonts.add(a); (document as any).fonts.add(b); (document as any).fonts.add(c); }).catch(() => {});
};
const ensureFonts = () => { if (loaded) return; loaded = true; const h = delayRender("fonts"); fontsPromise().then(() => continueRender(h)); };
export const FONT = "Montserrat, NunitoBlack, 'Arial Black', sans-serif";
export const Captions: React.FC<{ cards: { t0: number; t1: number; text: string }[] }> = ({ cards }) => {
  ensureFonts();
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const t = frame / fps + 0.0001; // card appears exactly on the frame of its word (no +1/fps shift)
  const c = cards.find((k) => t >= k.t0 && t < k.t1);
  if (!c) return null;
  return (
    <div style={{ position: "absolute", left: 30, right: 30, top: 1376 - 72, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 72, color: "#fdfdfd", WebkitTextStroke: "10px #000", paintOrder: "stroke fill", textShadow: "5px 6px 0 #000, 7px 9px 6px rgba(0,0,0,.4)", lineHeight: "90px", whiteSpace: "nowrap" }}>
      {c.text}
    </div>
  );
};
