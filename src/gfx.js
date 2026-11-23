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
uniform vec3 uTint; uniform float uFlash; uniform vec3 uEmis; uniform float uFade; uniform vec3 uRim; uniform vec4 uStat;
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
  #ifdef LEAFTINT
  vec3 base = uTint * (vUv.y < 0.25 ? vC : vec3(1.0)); // per-instance colour paints only the foliage rows of the palette
  #else
  vec3 base = vC * uTint;
  #endif
  #ifdef HAS_MAP
  base *= texture2D(uMap, vUv).rgb;
  #endif
  vec3 col = base * lit + uEmis;
  // rim light blends the silhouette edge toward the rim colour (so blue on a red hood stays blue, not pink)
  float rim = 1.0 - max(dot(N, normalize(cameraPosition - vW)), 0.0), rs = max(uRim.r, max(uRim.g, uRim.b));
  if (rs > 0.0) col = mix(col, uRim / rs * 1.05, smoothstep(0.42, 0.9, rim) * rs * 0.85);
  col = mix(col, uStat.rgb * (dot(col, vec3(0.3, 0.59, 0.11)) * 1.3 + 0.12), uStat.a);
  col = mix(col, vec3(1.0, 0.96, 0.9), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;
// o.u: per-character uniforms shared by all of its materials (tint/flash/emissive/fade)
export function charUniforms(o = {}) { return { uTint: { value: new THREE.Color(o.tint ?? 0xffffff) }, uFlash: { value: 0 }, uEmis: { value: new THREE.Color(o.emis ?? 0x000000) }, uFade: { value: 1 }, uRim: { value: new THREE.Color(o.rim ?? 0x000000) }, uStat: { value: new THREE.Vector4(0, 0, 0, 0) } }; }
export function toonMat(o = {}) {
  const u = o.u || charUniforms(o);
  const m = new THREE.ShaderMaterial({
    vertexShader: TOON_V, fragmentShader: TOON_F, vertexColors: o.vc !== false && !o.map, side: o.ds ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: { ...SH, ...u, uCut: { value: o.cut ? 1 : 0 }, uMap: { value: o.map || null } },
  });
  m.defines = {}; if (o.map) m.defines.HAS_MAP = ''; if (o.leaf) m.defines.LEAFTINT = '';
  return m;
}
// ---------- the realistic hero (魂契 mode): smooth PBR-ish shading under the same lights as the toon world ----------
// same uniforms as the toon material (tint / flash / fade / rim / status / see-through cut), plus a normal map and metal-rough map;
// the sky key and ambient are the toon's bands made smooth, the summoner's light and the torches give wrapped diffuse + a highlight,
// and the cyan soul fire painted in the eye sockets glows on its own
const REAL_F = `
#define TN ${TORCH_N}
uniform vec3 uTint; uniform float uFlash; uniform vec3 uEmis; uniform float uFade; uniform vec3 uRim; uniform vec4 uStat;
uniform vec3 uLight; uniform float uLightR; uniform vec3 uAmb; uniform vec3 uLightC;
uniform vec4 uTL[TN]; uniform vec3 uTC;
uniform float uCut; uniform vec2 uCutC; uniform float uCutR; uniform float uCutZ;
uniform sampler2D uMap; uniform sampler2D uNMap; uniform sampler2D uMR;
varying vec3 vN; varying vec3 vW; varying vec3 vC; varying float vVZ; varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 perturb(vec3 N, vec3 p, vec2 uv, vec3 tn){
  vec3 dp1 = dFdx(p), dp2 = dFdy(p); vec2 du1 = dFdx(uv), du2 = dFdy(uv);
  vec3 a = cross(dp2, N), b = cross(N, dp1), T = a * du1.x + b * du2.x, B = a * du1.y + b * du2.y;
  float im = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12)); return normalize(mat3(T * im, B * im, N) * tn); }
void light(vec3 N, vec3 V, vec3 L, vec3 c, float f, float rough, inout vec3 dif, inout vec3 spe){
  L = normalize(L); float w = max(dot(N, L) * 0.6 + 0.4, 0.0); dif += c * f * w;
  vec3 H = normalize(L + V); spe += c * f * pow(max(dot(N, H), 0.0), mix(70.0, 8.0, rough)) * (1.0 - rough); }
void main(){
  if (uCut > 0.5) { vec2 d = gl_FragCoord.xy - uCutC; float k = length(d) / uCutR;
    if (vVZ > uCutZ + 0.8 && k < 1.0 && (k < 0.8 || h21(gl_FragCoord.xy) > (k - 0.8) / 0.2)) discard; }
  if (uFade < 0.999 && h21(gl_FragCoord.xy) > uFade) discard;
  vec3 base = texture2D(uMap, vUv).rgb * uTint * 1.3; // the scan's albedo is dark next to KayKit's bright palette
  vec3 tn = texture2D(uNMap, vUv).xyz * 2.0 - 1.0; tn.xy *= 0.85;
  vec3 N = perturb(normalize(vN), vW, vUv, tn), V = normalize(cameraPosition - vW);
  vec4 mr = texture2D(uMR, vUv); float rough = clamp(mr.g, 0.18, 1.0), metal = mr.b;
  float nk = dot(N, normalize(vec3(-0.45, 1.0, 0.3)));
  vec3 dif = uAmb * (0.75 + 0.55 * smoothstep(-0.2, 0.7, nk)), spe = vec3(0.0);
  float dl = length(vW.xz - uLight.xz), fall = 1.0 - smoothstep(uLightR * 0.15, uLightR, dl); fall *= fall;
  light(N, V, uLight - vW, uLightC, fall * 0.85, rough, dif, spe);
  for (int i = 0; i < TN; i++) { vec4 t = uTL[i]; if (t.w <= 0.0) continue;
    float f = max(0.0, 1.0 - length(vW - t.xyz) / t.w); f *= f; light(N, V, t.xyz - vW, uTC, f * 0.8, rough, dif, spe); }
  dif = min(dif, vec3(1.15));
  vec3 F0 = mix(vec3(0.05), base, metal);
  vec3 col = base * (1.0 - metal * 0.55) * dif + spe * F0 * 3.0 + uEmis;
  float eye = smoothstep(0.18, 0.4, min(base.g, base.b) - base.r) * smoothstep(0.45, 0.7, base.b); col += base * eye * 1.8;
  float fr = 1.0 - max(dot(N, V), 0.0);
  col += vec3(0.5, 0.62, 0.85) * pow(fr, 2.5) * 0.34;               // a cool edge so the silhouette reads on dark floors
  float rs = max(uRim.r, max(uRim.g, uRim.b));
  if (rs > 0.0) col = mix(col, uRim / rs * 1.05, smoothstep(0.42, 0.9, fr) * rs * 0.85);
  col = mix(col, uStat.rgb * (dot(col, vec3(0.3, 0.59, 0.11)) * 1.3 + 0.12), uStat.a);
  col = mix(col, vec3(1.0, 0.96, 0.9), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`;
export function realMat(o = {}) {
  const u = o.u || charUniforms(o);
  return new THREE.ShaderMaterial({ vertexShader: TOON_V, fragmentShader: REAL_F,
    uniforms: { ...SH, ...u, uCut: { value: o.cut ? 1 : 0 }, uMap: { value: o.map }, uNMap: { value: o.nmap }, uMR: { value: o.mr } } });
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

// ---------- energy flowing over rare and epic weapons: a slightly inflated, additive copy of the weapon with bands of light
// running from the grip to the tip (one small extra draw per such weapon; the time is shared) ----------
export const AURA_T = { value: 0 };
const AURA_V = `uniform float uInf; varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){ vL = position; vec4 w = modelMatrix * vec4(position + normal * uInf, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const AURA_F = `uniform vec3 uCol; uniform float uT; uniform float uLen; uniform float uFade; uniform float uI; uniform vec3 uAx; varying vec3 vN; varying vec3 vW; varying vec3 vL;
void main(){
  float ly = dot(vL, uAx), y = ly / uLen, s = y * 6.2832;
  float f1 = sin(s * 1.6 - uT * 5.5 + sin(vL.x * 9.0 + vL.z * 7.0 + uT * 2.3) * 1.4);
  float f2 = sin(s * 2.7 + vL.z * 11.0 - uT * 8.0 + 1.7);
  float band = smoothstep(0.3, 0.95, f1 * 0.6 + f2 * 0.45), wisp = smoothstep(0.75, 1.0, sin(s * 4.3 - uT * 11.0 + vL.x * 13.0));
  vec3 V = normalize(cameraPosition - vW); float fr = 1.0 - abs(dot(normalize(vN), V)); fr *= fr;
  float a = (0.07 + 0.93 * band + 0.5 * wisp) * (0.5 + 0.9 * fr) * smoothstep(-0.1, 0.3, y) * uFade * uI;
  gl_FragColor = vec4(uCol * a + vec3(1.0) * a * a * 0.12, 1.0); // the brightest crests run toward white
}`;
export function auraMat(col, len, fade, inf = 0.035, i = 1, ax = new THREE.Vector3(0, 1, 0)) {
  return new THREE.ShaderMaterial({ vertexShader: AURA_V, fragmentShader: AURA_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(col) }, uT: AURA_T, uLen: { value: Math.max(0.3, len) }, uFade: fade || { value: 1 }, uInf: { value: inf }, uI: { value: i }, uAx: { value: ax } } });
}
export function ring(r1, r2, col, opacity = 0.8) {
  const g = new THREE.RingGeometry(r1, r2, 40); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.renderOrder = 2; return m;
}
