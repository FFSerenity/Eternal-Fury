// Rendering helpers: toon materials with a torch-light radius, see-through walls, outlined characters made of simple shapes,
// additive glow sprites and a small particle system. Colours are used as display colours (no colour management).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

THREE.ColorManagement.enabled = false;

// uniforms shared by every lit material
export const SH = {
  uLight: { value: new THREE.Vector3() }, uLightR: { value: 8.5 }, uAmb: { value: new THREE.Color(0.30, 0.31, 0.44) },
  uCutC: { value: new THREE.Vector2(-9999, -9999) }, uCutR: { value: 120 }, uCutZ: { value: -1e9 },
};

// shared torch lights (nearest few to the summoner are uploaded each frame): xyz + radius
export const TORCH_N = 6;
SH.uTL = { value: Array.from({ length: TORCH_N }, () => new THREE.Vector4(0, 0, 0, 0)) };
SH.uTC = { value: new THREE.Color(1.0, 0.62, 0.3) };
SH.uLightC = { value: new THREE.Color(1.0, 0.85, 0.64) };

const TOON_V = `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vN; varying vec3 vW; varying vec3 vC; varying float vVZ; varying vec2 vUv;
void main(){
  vec3 objectNormal = vec3(normal); vec3 transformed = vec3(position);
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 p = vec4(transformed, 1.0); vec3 n = objectNormal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  #endif
  vec4 w = modelMatrix * p; vW = w.xyz; vN = normalize(mat3(modelMatrix) * n); vUv = uv;
  #ifdef USE_COLOR
  vC = color;
  #else
  vC = vec3(1.0);
  #endif
  #ifdef USE_INSTANCING_COLOR
  vC *= instanceColor;
  #endif
  vec4 mv = viewMatrix * w; vVZ = mv.z; gl_Position = projectionMatrix * mv;
}`;
const TOON_F = `
#define TN ${TORCH_N}
uniform vec3 uTint; uniform float uFlash; uniform vec3 uEmis; uniform float uFade;
uniform vec3 uLight; uniform float uLightR; uniform vec3 uAmb; uniform vec3 uLightC;
uniform vec4 uTL[TN]; uniform vec3 uTC;
uniform float uCut; uniform vec2 uCutC; uniform float uCutR; uniform float uCutZ;
#ifdef HAS_MAP
uniform sampler2D uMap;
#endif
varying vec3 vN; varying vec3 vW; varying vec3 vC; varying float vVZ; varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float band(vec3 N, vec3 L){ float k = dot(N, normalize(L)); return k > 0.3 ? 1.0 : (k > -0.15 ? 0.68 : 0.42); }
void main(){
  if (uCut > 0.5) { vec2 d = gl_FragCoord.xy - uCutC; float k = length(d) / uCutR;
    if (vVZ > uCutZ + 0.8 && k < 1.0 && (k < 0.8 || h21(gl_FragCoord.xy) > (k - 0.8) / 0.2)) discard; }
  if (uFade < 0.999 && h21(gl_FragCoord.xy) > uFade) discard;
  vec3 N = normalize(vN);
  float nk = dot(N, normalize(vec3(-0.45, 1.0, 0.3)));
  float tk = nk > 0.55 ? 1.0 : (nk > 0.1 ? 0.74 : 0.52);
  float dl = length(vW.xz - uLight.xz);
  float fall = 1.0 - smoothstep(uLightR * 0.15, uLightR, dl); fall *= fall;
  vec3 lit = uAmb * tk + uLightC * fall * band(N, uLight - vW) * 0.78;
  for (int i = 0; i < TN; i++) { vec4 t = uTL[i]; if (t.w <= 0.0) continue;
    float f = max(0.0, 1.0 - length(vW - t.xyz) / t.w); f *= f;
    lit += uTC * f * band(N, t.xyz - vW) * 0.75; }
  lit = min(lit, vec3(1.12));
  vec3 base = vC * uTint;
  #ifdef HAS_MAP
  base *= texture2D(uMap, vUv).rgb;
  #endif
  vec3 col = base * lit + uEmis;
  col = mix(col, vec3(1.0, 0.96, 0.9), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;
// o.u: per-character uniforms shared by all of its materials (tint/flash/emissive/fade)
export function charUniforms(o = {}) { return { uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uFlash: { value: 0 }, uEmis: { value: new THREE.Color(o.emis ?? 0x000000) }, uFade: { value: 1 } }; }
export function toonMat(o = {}) {
  const u = o.u || charUniforms(o);
  const m = new THREE.ShaderMaterial({
    vertexShader: TOON_V, fragmentShader: TOON_F, vertexColors: o.vc !== false && !o.map,
    uniforms: { ...SH, ...u, uCut: { value: o.cut ? 1 : 0 }, uMap: { value: o.map || null } },
  });
  if (o.map) m.defines = { HAS_MAP: '' };
  return m;
}
const OUT_V = `
#include <common>
#include <skinning_pars_vertex>
uniform float uW;
void main(){
  vec3 objectNormal = vec3(normal); vec3 transformed = vec3(position);
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 p = vec4(transformed + normalize(objectNormal) * uW, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
}`;
const OUT_F = `uniform vec3 uCol; uniform float uFade; float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){ if (uFade < 0.999 && h21(gl_FragCoord.xy) > uFade) discard; gl_FragColor = vec4(uCol, 1.0); }`;
export function outlineMat(col, w = 0.045, fade = null) {
  return new THREE.ShaderMaterial({ vertexShader: OUT_V, fragmentShader: OUT_F, side: THREE.BackSide,
    uniforms: { uW: { value: w }, uCol: { value: new THREE.Color(col) }, uFade: fade || { value: 1 } } });
}

// ---------- geometry building ----------
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
export function part(geo, col, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const g = geo.index ? geo : geo; E.set(rot[0], rot[1], rot[2]); Q.setFromEuler(E); M4.compose(V.set(...pos), Q, S.set(...scl)); g.applyMatrix4(M4);
  const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
export const merge = parts => mergeGeometries(parts.map(p => p.index ? p : p), false);
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cap = (r, l, s = 6, rs = 12) => new THREE.CapsuleGeometry(r, l, s, rs);
const cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
const cyl = (r1, r2, h, s = 10) => new THREE.CylinderGeometry(r1, r2, h, s);

// ---------- glow sprites ----------
function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) gr.addColorStop(o, col); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}
export const TEX = {
  glow: radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]),
  blob: radialTex([[0, 'rgba(0,0,0,0.55)'], [0.6, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]),
};
export function glowSprite(col, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity }));
  s.scale.setScalar(size); return s;
}

// ---------- blob shadows (one instanced draw) ----------
export class Shadows {
  constructor(scene, cap = 256) {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: TEX.blob, transparent: true, depthWrite: false }), cap);
    this.mesh.renderOrder = 1; this.mesh.frustumCulled = false; scene.add(this.mesh); this.n = 0; this.m = new THREE.Matrix4(); this.cap = cap;
  }
  begin() { this.n = 0; }
  add(x, z, r) { if (this.n >= this.cap) return; this.m.makeScale(r * 2.4, 1, r * 1.9); this.m.setPosition(x, 0.02, z); this.mesh.setMatrixAt(this.n++, this.m); }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; }
}

// ---------- particles (one draw call, additive) ----------
const PV = `attribute float aSize; attribute vec3 aCol; attribute float aA; varying vec3 vC; varying float vA; uniform float uScale;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; vC = aCol; vA = aA; }`;
const PF = `uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC * t.a * vA, t.a * vA); }`;
export class Particles {
  constructor(scene, cap = 1500) {
    this.cap = cap; this.n = 0; this.P = [];
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.a = new Float32Array(cap);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aA', new THREE.BufferAttribute(this.a, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PV, fragmentShader: PF, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTex: { value: TEX.glow }, uScale: { value: 400 } } });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.g = g;
  }
  emit(x, y, z, n, o = {}) {
    const c = new THREE.Color(o.col ?? 0xffffff);
    for (let i = 0; i < n && this.P.length < this.cap; i++) { const a = Math.random() * Math.PI * 2, sp = (o.spd ?? 2) * (0.4 + Math.random() * 0.8);
      this.P.push({ x: x + (Math.random() - 0.5) * (o.spread ?? 0.2), y: y + (Math.random() - 0.5) * (o.spread ?? 0.2) * 0.5, z: z + (Math.random() - 0.5) * (o.spread ?? 0.2),
        vx: Math.cos(a) * sp, vy: (o.up ?? 1.5) * (0.5 + Math.random()), vz: Math.sin(a) * sp, g: o.grav ?? 3, life: 0, max: (o.life ?? 0.6) * (0.6 + Math.random() * 0.8),
        s: (o.size ?? 0.25) * (0.6 + Math.random() * 0.8), r: c.r, gg: c.g, b: c.b }); }
  }
  update(dt) {
    let j = 0; const P = this.P;
    for (let i = 0; i < P.length; i++) { const p = P[i]; p.life += dt; if (p.life >= p.max) continue; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.97; p.vz *= 0.97; if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; } P[j++] = p; }
    P.length = j;
    for (let i = 0; i < j; i++) { const p = P[i], k = p.life / p.max; this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r; this.col[i * 3 + 1] = p.gg; this.col[i * 3 + 2] = p.b; this.size[i] = p.s; this.a[i] = 1 - k * k; }
    this.g.setDrawRange(0, j); for (const k of ['position', 'aCol', 'aSize', 'aA']) this.g.attributes[k].needsUpdate = true;
  }
}

export function ring(r1, r2, col, opacity = 0.8) {
  const g = new THREE.RingGeometry(r1, r2, 40); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.renderOrder = 2; return m;
}
