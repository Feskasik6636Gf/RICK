import * as THREE from "three";
import { NDMaterial } from "./post";

// Lambert material whose base colour comes from a GLSL function of world position.
// colorFn: GLSL code defining `vec3 surf(vec3 wp, vec3 wn, vec2 uv)` returning sRGB colour.
export const proceduralLambert = (colorFn: string, extraUniforms: Record<string, THREE.IUniform> = {}, params: THREE.MeshLambertMaterialParameters = {}, selfLit = 0) => {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, ...params });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, extraUniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec2 vUV0;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvUV0 = uv;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n{ vec4 wpp = vec4(transformed,1.0);\n#ifdef USE_INSTANCING\n wpp = instanceMatrix*wpp;\n#endif\n wpp = modelMatrix*wpp; vWP = wpp.xyz; vWN = normalize(mat3(modelMatrix)*objectNormal); }");
    const uniDecl = Object.keys(extraUniforms)
      .map((k) => {
        const v: any = extraUniforms[k].value;
        const type = typeof v === "number" ? "float" : v?.isVector2 ? "vec2" : v?.isVector3 ? "vec3" : v?.isColor ? "vec3" : v?.isTexture ? "sampler2D" : "float";
        return `uniform ${type} ${k};`;
      })
      .join("\n");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vWP; varying vec3 vWN; varying vec2 vUV0;\n${uniDecl}\n${GLSL_LIB}\n${colorFn}`)
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( pow(surf(vWP, normalize(vWN), vUV0), vec3(2.2)), opacity );")
      .replace("vec3 totalEmissiveRadiance = emissive;", `vec3 totalEmissiveRadiance = emissive + diffuseColor.rgb*${selfLit.toFixed(3)};`);
  };
  m.customProgramCacheKey = () => selfLit + ":" + colorFn.length + ":" + colorFn.slice(0, 80) + colorFn.slice(-80);
  return m;
};

export const GLSL_LIB = `
float h11(float n){ return fract(sin(n)*43758.5453123); }
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=h21(i), b=h21(i+vec2(1,0)), c=h21(i+vec2(0,1)), d=h21(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }
vec3 hexc(float r,float g,float b){ return vec3(r,g,b)/255.0; }
`;

export const lambert = (color: string | THREE.Texture, opts: THREE.MeshLambertMaterialParameters = {}) => {
  if (typeof color === "string") return new THREE.MeshLambertMaterial({ color, ...opts });
  return new THREE.MeshLambertMaterial({ map: color, ...opts });
};

export const shadowed = <T extends THREE.Object3D>(o: T, cast = true, recv = true) => {
  o.traverse((c: any) => {
    if (c.isMesh) { c.castShadow = cast; c.receiveShadow = recv; }
  });
  return o;
};

export const spriteND = (tex: THREE.Texture) => NDMaterial({ alphaMap: tex, noEdge: true });
