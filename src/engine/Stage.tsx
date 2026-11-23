import React, { useLayoutEffect, useRef, useState } from "react";
import { useCurrentFrame, useVideoConfig, delayRender, continueRender } from "remotion";
import * as THREE from "three";
import { Post, PostParams } from "./post";

export type World = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update: (t: number, frame: number, post: PostParams) => void;
  ready?: Promise<void>;
  far?: { scene: THREE.Scene; camera: THREE.Camera };
  overlay?: THREE.Scene;
  overlayCamera?: THREE.Camera;
};

// One WebGL renderer per tab; world built once; every frame: update(t) then post.render.
export const Stage: React.FC<{ build: (W: number, H: number) => World; scale?: number }> = ({ build, scale = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const W = Math.round(width * scale), H = Math.round(height * scale);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [st] = useState(() => ({ r: null as null | THREE.WebGLRenderer, post: null as null | Post, world: null as null | World, ready: false, handle: 0 }));
  const [handle] = useState(() => delayRender("stage-init"));
  useLayoutEffect(() => {
    if (!st.r) {
      const r = new THREE.WebGLRenderer({ canvas: canvasRef.current!, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      r.setPixelRatio(1);
      r.setSize(W, H, false);
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.NoToneMapping;
      st.r = r;
      st.post = new Post(r, W, H);
      st.world = build(W, H);
      const p = st.world.ready || Promise.resolve();
      p.then(() => { st.ready = true; draw(); continueRender(handle); });
      return;
    }
    if (st.ready) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);
  function draw() {
    const t = frame / fps;
    st.world!.update(t, frame, st.post!.params);
    st.post!.render(st.world!.scene, st.world!.camera, t, st.world!.far);
    if (st.world!.overlay) { const r = st.r!; r.autoClear = false; r.setRenderTarget(null); r.clearDepth(); r.render(st.world!.overlay, st.world!.overlayCamera || st.world!.camera); r.autoClear = true; }
  }
  return <canvas ref={canvasRef} width={W} height={H} style={{ width, height, position: "absolute", left: 0, top: 0 }} />;
};
