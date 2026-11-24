import React from "react";
import { Composition } from "remotion";
import { Film, FPS, DUR } from "./dyatlov/Film";
import { Film as Dance, FPS as DFPS, DUR as DDUR } from "./dance/Film";
export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={Math.round(DUR * FPS)} fps={FPS} width={1080} height={1920} />
    <Composition id="Dance" component={Dance} durationInFrames={Math.round(DDUR * DFPS)} fps={DFPS} width={1080} height={1920} />
  </>
);
