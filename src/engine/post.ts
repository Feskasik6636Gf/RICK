import * as THREE from "three";

// Post pipeline: scene color (MSAA) + normal/depth pass -> ink edges, DOF, bloom, grade, vignette, grain.
export type PostParams = {
  focus: number; // focus distance (view-space units)
  focusRange: number; // in-focus half range
  maxBlur: number; // px at output res for far blur
  nearBlur: number; // px for near blur
  edgeStrength: number;
  edgeWidth: number; // px
  edgeDepth: number; // depth sensitivity (relative)
  edgeNormal: number; // normal sensitivity
  inkColor: THREE.Color;
  bloom: number;
  bloomThreshold: number;
  saturation: number;
  contrast: number;
  brightness: number;
  vignette: number;
  grain: number;
  tint: THREE.Color; // multiplicative grade
  lift: THREE.Color; // additive shadow lift
  edgeFadeFar: number; // depth where edges fade out
  gamma: number; // midtone curve (<1 brightens)
  shadowTint: THREE.Color; // added in the shadows (lavender shadows)
  edgeThin: number; // depth where ink is halved (0 = off)
  animGrain: number; // 1 = animated grain, 0 = static dither
  softClip: number; // >0: highlights roll off above this level
  inkAfter: number; // 1 = ink drawn after the grade (keeps the ink colour exact)
  ao: number; // screen-space AO strength (0 = off)
  aoRadius: number; // world-ish radius (scaled by 1/depth)
};

export const defaultPost = (): PostParams => ({
  focus: 10,
  focusRange: 4,
  maxBlur: 6,
  nearBlur: 6,
  edgeStrength: 0.9,
  edgeWidth: 1.6,
  edgeDepth: 0.06,
  edgeNormal: 0.45,
  inkColor: new THREE.Color("#2a2233"),
  bloom: 0.35,
  bloomThreshold: 0.97,
  saturation: 1.08,
  contrast: 1.04,
  brightness: 0.0,
  vignette: 0.22,
  grain: 0.025,
  tint: new THREE.Color(1, 1, 1),
  lift: new THREE.Color(0, 0, 0),
  edgeFadeFar: 400,
  gamma: 1,
  shadowTint: new THREE.Color(0, 0, 0),
  edgeThin: 0,
  animGrain: 1,
  softClip: 0,
  inkAfter: 0,
  ao: 0,
  aoRadius: 0.6,
});

const quadVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;

export const NDMaterial = (opts: { alphaMap?: THREE.Texture; noEdge?: boolean; billboard?: boolean } = {}) =>
  new THREE.ShaderMaterial({
    uniforms: { alphaMap: { value: opts.alphaMap || null }, useAlpha: { value: opts.alphaMap ? 1 : 0 }, noEdge: { value: opts.noEdge ? 1 : 0 } },
    vertexShader: `
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying float vD; varying vec2 vUv2;
      void main(){
        vUv2 = uv;
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        vN = normalize(transformedNormal);
        #include <begin_vertex>
        #include <project_vertex>
        vD = -mvPosition.z;
      }`,
    fragmentShader: `
      uniform sampler2D alphaMap; uniform int useAlpha; uniform int noEdge;
      varying vec3 vN; varying float vD; varying vec2 vUv2;
      void main(){
        if(useAlpha==1){ if(texture2D(alphaMap,vUv2).a<0.5) discard; }
        vec3 n = normalize(vN); if(!gl_FrontFacing) n=-n;
        if(noEdge==1) gl_FragColor=vec4(0.0,0.0,0.0,vD);
        else gl_FragColor=vec4(n*0.5+0.5,vD);
      }`,
    side: THREE.DoubleSide,
  });

const blurFS = `
uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s=vec4(0.0); float w=0.0;
  for(int i=-6;i<=6;i++){ float fi=float(i); float g=exp(-fi*fi/18.0); s+=texture2D(tex,vUv+dir*fi)*g; w+=g; }
  gl_FragColor=s/w;
}`;

const brightFS = `
uniform sampler2D tex; uniform float th; varying vec2 vUv;
void main(){ vec3 c=texture2D(tex,vUv).rgb; float l=max(c.r,max(c.g,c.b)); float k=smoothstep(th,th+0.15,l); gl_FragColor=vec4(c*k,1.0);} `;

const finalFS = `
uniform sampler2D tColor; uniform sampler2D tND; uniform sampler2D tBlur1; uniform sampler2D tBlur2; uniform sampler2D tBloom;
uniform vec2 res; uniform float focus, focusRange, maxBlur, nearBlur;
uniform float edgeStrength, edgeWidth, edgeDepth, edgeNormal, edgeFadeFar;
uniform vec3 inkColor; uniform float bloom, saturation, contrast, brightness, vignette, grain, time;
uniform vec3 tint; uniform vec3 lift; uniform float gamma, edgeThin, animGrain, softClip, inkAfter, ao, aoRadius; uniform vec3 shadowTint;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
float edgeAt(vec2 uv, vec4 c0){
  vec2 px = edgeWidth/res;
  float e=0.0;
  vec2 offs[8];
  offs[0]=vec2(1,0);offs[1]=vec2(-1,0);offs[2]=vec2(0,1);offs[3]=vec2(0,-1);
  offs[4]=vec2(0.7,0.7);offs[5]=vec2(-0.7,0.7);offs[6]=vec2(0.7,-0.7);offs[7]=vec2(-0.7,-0.7);
  float d0 = c0.a<=0.0 ? 1e5 : c0.a;
  bool c0n = dot(c0.rgb,c0.rgb)<0.001 && c0.a>0.0;
  if(c0n) return 0.0;
  for(int i=0;i<8;i++){
    vec4 s=texture2D(tND, uv+offs[i]*px);
    float ds = s.a<=0.0 ? 1e5 : s.a;
    bool sn = dot(s.rgb,s.rgb)<0.001 && s.a>0.0;
    if(sn) continue;
    float dd = (d0 - ds)/max(min(d0,ds),0.001);
    float de = smoothstep(edgeDepth, edgeDepth*2.5, abs(dd));
    float nn = 0.0;
    if(c0.a>0.0 && s.a>0.0) nn = smoothstep(edgeNormal, edgeNormal+0.3, length(c0.rgb-s.rgb));
    e=max(e,max(de,nn));
  }
  return e;
}
void main(){
  vec4 nd = texture2D(tND,vUv);
  float d = nd.a; if(d<=0.0) d=1e5;
  vec3 col = texture2D(tColor,vUv).rgb;
  float occ = 0.0;
  if(ao > 0.0 && nd.a > 0.0){
    float rp = clamp(aoRadius * res.y * 0.9 / d, 3.0, 60.0);
    vec3 n0 = nd.rgb*2.0-1.0;
    for(int i=0;i<12;i++){
      float a = float(i)*2.39996;
      float r = rp * (0.25 + 0.75*fract(float(i)*0.618));
      vec2 o = vec2(cos(a), sin(a))*r/res;
      vec4 s = texture2D(tND, vUv+o);
      if(s.a <= 0.0) continue;
      float dd = d - s.a;
      float range = smoothstep(aoRadius*3.0, 0.0, abs(dd));
      occ += step(aoRadius*0.06, dd) * range;
    }
    occ = clamp(occ/12.0*1.6, 0.0, 1.0);
  }
  // DOF
  float coc = 0.0;
  if(d>focus+focusRange) coc = clamp((d-focus-focusRange)/(focus*1.5+1.0),0.0,1.0)*maxBlur;
  else if(d<focus-focusRange) coc = clamp((focus-focusRange-d)/max(focus-focusRange,0.01),0.0,1.0)*nearBlur;
  vec3 b1=texture2D(tBlur1,vUv).rgb; vec3 b2=texture2D(tBlur2,vUv).rgb;
  float k1 = clamp(coc/3.0,0.0,1.0); float k2=clamp((coc-3.0)/5.0,0.0,1.0);
  vec3 dc = mix(mix(col,b1,k1),b2,k2);
  // edges (fade with blur and distance)
  float e = edgeAt(vUv, nd)*edgeStrength;
  e *= (1.0-clamp(coc/4.0,0.0,0.85));
  e *= 1.0-smoothstep(edgeFadeFar/15.0, edgeFadeFar*0.5, d);
  if(edgeThin>0.0) e *= mix(1.0, 0.5, smoothstep(edgeThin*0.3, edgeThin, d));
  // bloom (linear), then to sRGB
  dc += texture2D(tBloom,vUv).rgb*bloom;
  dc = pow(max(dc,0.0), vec3(1.0/2.2));
  vec3 ink = mix(pow(inkColor,vec3(1.0/2.2)), pow(max(col,0.0),vec3(1.0/2.2))*0.3, 0.35);
  if(inkAfter<0.5) dc = mix(dc, ink, clamp(e,0.0,1.0));
  dc *= 1.0 - ao*occ;
  // grade
  dc = dc*tint + lift;
  dc = pow(max(dc,0.0), vec3(gamma));
  { float l0 = dot(dc,vec3(0.299,0.587,0.114)); dc += shadowTint*(1.0-smoothstep(0.15,0.75,l0)); }
  float l = dot(dc,vec3(0.299,0.587,0.114));
  dc = mix(vec3(l),dc,saturation);
  dc = (dc-0.5)*contrast+0.5+brightness;
  vec2 q=vUv-0.5; q.x*=res.x/res.y;
  if(inkAfter>0.5) dc = mix(dc, ink, clamp(e,0.0,1.0));
  dc *= 1.0 - vignette*smoothstep(0.25,0.95,length(q)*1.25);
  dc += (hash(vUv*res+time*animGrain)-0.5)*grain;
  if(softClip>0.0){ vec3 over = max(dc-softClip, 0.0); dc = min(dc, vec3(softClip)) + (0.97-softClip)*(1.0-exp(-over/max(0.97-softClip,0.001))); }
  gl_FragColor=vec4(clamp(dc,0.0,1.0),1.0);
}`;

export class Post {
  renderer: THREE.WebGLRenderer;
  W: number;
  H: number;
  rtColor: THREE.WebGLRenderTarget;
  rtND: THREE.WebGLRenderTarget;
  rtA: THREE.WebGLRenderTarget;
  rtB: THREE.WebGLRenderTarget;
  rtC: THREE.WebGLRenderTarget;
  rtD: THREE.WebGLRenderTarget;
  rtBl1: THREE.WebGLRenderTarget;
  rtBl2: THREE.WebGLRenderTarget;
  quad: THREE.Mesh;
  qscene: THREE.Scene;
  qcam: THREE.OrthographicCamera;
  blurMat: THREE.ShaderMaterial;
  brightMat: THREE.ShaderMaterial;
  copyMat: THREE.ShaderMaterial;
  finalMat: THREE.ShaderMaterial;
  ndDefault: THREE.ShaderMaterial;
  params: PostParams;
  constructor(renderer: THREE.WebGLRenderer, W: number, H: number) {
    this.renderer = renderer;
    this.W = W;
    this.H = H;
    this.rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
    this.rtND = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const h = (w: number, hh: number) => new THREE.WebGLRenderTarget(w, hh, { type: THREE.HalfFloatType });
    this.rtA = h(W / 2, H / 2);
    this.rtB = h(W / 2, H / 2);
    this.rtC = h(W / 4, H / 4);
    this.rtD = h(W / 4, H / 4);
    this.rtBl1 = h(W / 8, H / 8);
    this.rtBl2 = h(W / 8, H / 8);
    this.qscene = new THREE.Scene();
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qscene.add(this.quad);
    this.blurMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: quadVS, fragmentShader: blurFS });
    this.brightMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null }, th: { value: 0.8 } }, vertexShader: quadVS, fragmentShader: brightFS });
    this.copyMat = new THREE.ShaderMaterial({ uniforms: { tex: { value: null } }, vertexShader: quadVS, fragmentShader: `uniform sampler2D tex; varying vec2 vUv; void main(){gl_FragColor=texture2D(tex,vUv);}` });
    this.params = defaultPost();
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tND: { value: null }, tBlur1: { value: null }, tBlur2: { value: null }, tBloom: { value: null },
        res: { value: new THREE.Vector2(W, H) }, time: { value: 0 },
        focus: { value: 10 }, focusRange: { value: 4 }, maxBlur: { value: 6 }, nearBlur: { value: 6 },
        edgeStrength: { value: 1 }, edgeWidth: { value: 1.5 }, edgeDepth: { value: 0.05 }, edgeNormal: { value: 0.4 }, edgeFadeFar: { value: 400 },
        inkColor: { value: new THREE.Color() }, bloom: { value: 0.3 }, saturation: { value: 1 }, contrast: { value: 1 }, brightness: { value: 0 },
        vignette: { value: 0.2 }, grain: { value: 0.02 }, tint: { value: new THREE.Color(1, 1, 1) }, lift: { value: new THREE.Color(0, 0, 0) }, gamma: { value: 1 }, shadowTint: { value: new THREE.Color(0, 0, 0) }, edgeThin: { value: 0 }, animGrain: { value: 1 }, softClip: { value: 0 }, inkAfter: { value: 0 }, ao: { value: 0 }, aoRadius: { value: 0.6 },
      },
      vertexShader: quadVS,
      fragmentShader: finalFS,
    });
    this.ndDefault = NDMaterial();
  }
  pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qscene, this.qcam);
  }
  blur(src: THREE.Texture, tmp: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget, scale: number) {
    this.blurMat.uniforms.tex.value = src;
    this.blurMat.uniforms.dir.value.set(scale / tmp.width, 0);
    this.pass(this.blurMat, tmp);
    this.blurMat.uniforms.tex.value = tmp.texture;
    this.blurMat.uniforms.dir.value.set(0, scale / tmp.height);
    this.pass(this.blurMat, dst);
  }
  renderND(scene: THREE.Scene, camera: THREE.Camera) {
    const r = this.renderer;
    const saved: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    const bg = scene.background;
    scene.background = null;
    scene.traverse((o: any) => {
      if (o.isMesh || o.isPoints || o.isLine) {
        saved.push([o, o.material]);
        if (o.userData.ndHide) o.material = HIDE;
        else o.material = o.userData.nd || this.ndDefault;
      }
    });
    r.render(scene, camera);
    for (const [o, m] of saved) o.material = m;
    scene.background = bg;
  }
  render(scene: THREE.Scene, camera: THREE.Camera, time: number, far?: { scene: THREE.Scene; camera: THREE.Camera }) {
    const r = this.renderer;
    const p = this.params;
    // 1. colour (far layer first, then the main scene over it)
    r.setRenderTarget(this.rtColor);
    r.setClearColor(scene.background instanceof THREE.Color ? scene.background : new THREE.Color(0x88bbee), 1);
    r.clear();
    if (far) {
      r.render(far.scene, far.camera);
      r.clearDepth();
      const bg = scene.background; scene.background = null;
      r.autoClear = false;
      r.render(scene, camera);
      r.autoClear = true;
      scene.background = bg;
    } else r.render(scene, camera);
    // 2. normal-depth
    r.setRenderTarget(this.rtND);
    r.setClearColor(new THREE.Color(0, 0, 0), 0);
    r.clear();
    r.autoClear = false;
    if (far) { this.renderND(far.scene, far.camera); r.clearDepth(); }
    this.renderND(scene, camera);
    r.autoClear = true;
    // 3. blurs
    this.copyMat.uniforms.tex.value = this.rtColor.texture;
    this.pass(this.copyMat, this.rtA);
    this.blur(this.rtA.texture, this.rtB, this.rtA, 1.0);
    this.copyMat.uniforms.tex.value = this.rtA.texture;
    this.pass(this.copyMat, this.rtC);
    this.blur(this.rtC.texture, this.rtD, this.rtC, 1.4);
    // bloom
    this.brightMat.uniforms.tex.value = this.rtC.texture;
    this.brightMat.uniforms.th.value = p.bloomThreshold;
    this.pass(this.brightMat, this.rtBl1);
    this.blur(this.rtBl1.texture, this.rtBl2, this.rtBl1, 1.5);
    this.blur(this.rtBl1.texture, this.rtBl2, this.rtBl1, 2.5);
    // 4. final
    const u = this.finalMat.uniforms;
    u.tColor.value = this.rtColor.texture;
    u.tND.value = this.rtND.texture;
    u.tBlur1.value = this.rtA.texture;
    u.tBlur2.value = this.rtC.texture;
    u.tBloom.value = this.rtBl1.texture;
    u.time.value = time;
    for (const k of Object.keys(p) as (keyof PostParams)[]) {
      if (u[k]) {
        const v: any = p[k];
        if (v instanceof THREE.Color) u[k].value.copy(v);
        else u[k].value = v;
      }
    }
    this.pass(this.finalMat, null);
  }
}

const HIDE = new THREE.MeshBasicMaterial({ visible: false });
