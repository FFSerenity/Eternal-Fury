// Painted ground (the hand-painted direction, Nov 2026): one continuous mesh over an area instead of KayKit's floor tiles, blending
// tiling ground textures by a splat map — dirt everywhere underneath, then moss, cobble and fallen leaves where the map says. Each
// texture is laid in world space at its own scale; where two meet, the higher-looking one (its brightness taken as height) wins the
// edge, so the stones of a path stand out of the grass instead of fading into it. A slow large-scale wash of brightness and hue keeps
// the repeats from showing. Lit by the same light as the toon world (the summoner's light, the torches, the ambient), but smooth.
import * as THREE from 'three';
import { SH, TORCH_N, AURA_T } from './gfx.js';
// the painted ground trial (hand-painted direction): ?paint=1 lays the camp's clearing as one painted ground instead of KayKit tiles
export const PAINT = typeof location !== 'undefined' && new URLSearchParams(location.search).has('paint');
// ?paint=1&flat=1: the paths painted flat in the ground texture (the first trial) instead of raised stones (stonepath.js)
export const PAINT_FLAT = PAINT && new URLSearchParams(location.search).has('flat');
// ?paint=1&big=1: the clearing's ground as one big painting (bigGround) instead of tiling textures blended by a splat map
export const PAINT_BIG = PAINT && new URLSearchParams(location.search).has('big');

// the ground set: name -> [file, metres one repeat covers]. Hand-painted, seamless, made in ComfyUI (Qwen Image 2.1 turbo with the
// GT Seamless Roll node; tools/ground/ has the prompts and the clean-up) — see DESIGN.md "Painted ground"
export const GROUND = { dirt: ['assets/ground/dirt.jpg', 3.0], moss: ['assets/ground/moss.jpg', 2.8], cobble: ['assets/ground/cobble.jpg', 2.6], leaves: ['assets/ground/leaves.jpg', 4.2] };
const LOADED = {};
function tex(name) {
  if (LOADED[name]) return LOADED[name];
  const t = new THREE.TextureLoader().load(GROUND[name][0]); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace;
  return (LOADED[name] = t);
}

const V = `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const F = `
#define TN ${TORCH_N}
uniform sampler2D uDirt, uMoss, uCobble, uLeaves, uSplat; uniform vec4 uScale; uniform vec4 uArea; uniform float uSharp; uniform vec2 uTone;
uniform vec3 uLight; uniform float uLightR; uniform vec3 uAmb; uniform vec3 uLightC; uniform vec4 uTL[TN]; uniform vec3 uTC;
varying vec3 vW;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
// a texture laid twice — the second turned and shifted — mixed by slow noise, so its repeat does not read as a grid
vec3 tile2(sampler2D t, vec2 p, float m){ vec3 a = texture2D(t, p).rgb; vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p * 0.83 + vec2(0.37, 0.71);
  return mix(a, texture2D(t, q).rgb, smoothstep(0.35, 0.65, m)); }
void main(){
  vec2 p = vW.xz, sp = (p - uArea.xy) / uArea.zw; vec4 s = texture2D(uSplat, sp);
  float m = vn(p * 0.13), m2 = vn(p * 0.045 + 11.0);
  vec3 cD = tile2(uDirt, p / uScale.x, m), cG = tile2(uMoss, p / uScale.y, 1.0 - m), cC = texture2D(uCobble, p / uScale.z).rgb, cS = tile2(uLeaves, p / uScale.w, m);
  // weights: dirt is what is left; each layer's brightness lifts it at the edges (height blend)
  vec4 w = vec4(max(0.0, 1.0 - s.r - s.g - s.b), s.r, s.g, s.b);
  vec4 h = w * 1.6 + vec4(lum(cD) * 0.35, lum(cG) * 0.55, lum(cC) * 0.9, lum(cS) * 1.1) * step(0.001, w); // (leaves: their bright shapes win first, so a light weight scatters a few)
  float hm = max(max(h.x, h.y), max(h.z, h.w)); vec4 k = max(h - hm + uSharp, 0.0); k /= (k.x + k.y + k.z + k.w + 1e-4);
  vec3 base = cD * k.x + cG * k.y + cC * k.z + cS * k.w;
  base *= 0.9 + 0.2 * m2; base = mix(base, base * vec3(1.06, 1.0, 0.9), smoothstep(0.4, 0.8, m)); // (a slow wash: some ground warmer, some cooler)
  base = mix(vec3(lum(base)), base, uTone.y) * uTone.x; // (the set's brightness and colour strength for the place: night is dim and grey)
  float dl = length(vW.xz - uLight.xz), fall = 1.0 - smoothstep(uLightR * 0.15, uLightR, dl); fall *= fall;
  vec3 lit = uAmb * 1.02 + uLightC * fall * 0.78;
  for (int i = 0; i < TN; i++) { vec4 t = uTL[i]; if (t.w <= 0.0) continue; float f = max(0.0, 1.0 - length(vW - t.xyz) / t.w); f *= f; lit += uTC * f * 0.95; } // (lanterns pool a little stronger on the painted ground than on the props)
  gl_FragColor = vec4(base * (0.42 + 0.58 * s.a) * min(lit, vec3(1.12)), 1.0); // (s.a: 1 − shade)
}`;

// the ground over [x0, x1] x [z0, z1]; weight(x, z) -> [moss, cobble, leaves, shade] (0..1 each; dirt gets what is left; shade
// darkens it — under raised stones, so the gaps between them read as deep), sampled at
// res texels a metre into the splat map (smoothed by the texture's own filtering)
export function paintGround(x0, z0, x1, z1, weight, res = 4) {
  const W = Math.round((x1 - x0) * res), H = Math.round((z1 - z0) * res), data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const [g, c, s, sh = 0] = weight(x0 + (i + 0.5) / res, z0 + (j + 0.5) / res), o = (j * W + i) * 4;
    data[o] = Math.round(255 * Math.min(1, g)); data[o + 1] = Math.round(255 * Math.min(1, c)); data[o + 2] = Math.round(255 * Math.min(1, s)); data[o + 3] = Math.round(255 * (1 - Math.min(1, sh))); }
  const splat = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); splat.magFilter = splat.minFilter = THREE.LinearFilter; splat.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: F, uniforms: { ...SH,
    uDirt: { value: tex('dirt') }, uMoss: { value: tex('moss') }, uCobble: { value: tex('cobble') }, uLeaves: { value: tex('leaves') }, uSplat: { value: splat },
    uScale: { value: new THREE.Vector4(GROUND.dirt[1], GROUND.moss[1], GROUND.cobble[1], GROUND.leaves[1]) }, uArea: { value: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) },
    uSharp: { value: 0.22 }, uTone: { value: new THREE.Vector2(globalThis.__gTone ?? 0.66, globalThis.__gSat ?? 0.78) } } });
  mat.userData.tone = mat.uniforms.uTone;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat);
  mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); mesh.renderOrder = -1; return mesh;
}

// The whole camp clearing as one painting (?paint=1&big=1, the "one big picture" trial): a top-down shot of the painted ground above
// (paths included) repainted by Qwen Image as a single picture, so nothing in it repeats (tools/ground: workflow.img2img; the guide
// is tests' topdown.py). 2048² over 26 m is about the screen's own density, so a little of the dirt texture's fine detail is laid
// over it (its brightness only, at its own scale) to keep it crisp up close. Lit like the painted ground.
const BIG_F = `
#define TN ${TORCH_N}
uniform sampler2D uBig, uDet, uMossT, uUnder; uniform vec4 uArea; uniform float uDetK; uniform vec2 uTone;
uniform vec3 uLight; uniform float uLightR; uniform vec3 uAmb; uniform vec3 uLightC; uniform vec4 uTL[TN]; uniform vec3 uTC;
varying vec3 vW;
float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
void main(){
  vec2 uv = (vW.xz - uArea.xy) / uArea.zw; vec3 base = texture2D(uBig, vec2(uv.x, 1.0 - uv.y)).rgb;
  float d = lum(texture2D(uDet, vW.xz / 3.0).rgb) / 0.34; base *= mix(1.0, d, uDetK);
  // under the path's stones: earth with moss (the painting has its own path painted there)
  float un = texture2D(uUnder, uv).r; vec3 gap = mix(texture2D(uDet, vW.xz / 3.0).rgb, texture2D(uMossT, vW.xz / 2.8).rgb, 0.35); // (not darkened: it read as a shadow)
  base = mix(base, gap, un);
  base = mix(vec3(lum(base)), base, uTone.y) * uTone.x;
  float dl = length(vW.xz - uLight.xz), fall = 1.0 - smoothstep(uLightR * 0.15, uLightR, dl); fall *= fall;
  vec3 lit = uAmb * 1.02 + uLightC * fall * 0.78;
  for (int i = 0; i < TN; i++) { vec4 t = uTL[i]; if (t.w <= 0.0) continue; float f = max(0.0, 1.0 - length(vW - t.xyz) / t.w); f *= f; lit += uTC * f * 0.95; }
  gl_FragColor = vec4(base * min(lit, vec3(1.12)), 1.0);
}`;
// (detK: the dirt texture's brightness laid over it — it was 0.35, but its clods tile every 3 m and showed as rows of round dots,
// 'regular round stones' the painting itself hasn't got (the person, Nov 28); off, the painting alone)
export function bigGround(x0, z0, x1, z1, file = 'assets/ground/camp_big.jpg', detK = 0, under = null) {
  const R = 4, Wd = Math.round((x1 - x0) * R), Hd = Math.round((z1 - z0) * R), ud = new Uint8Array(Wd * Hd * 4);
  if (under) for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) ud[((Hd - 1 - j) * Wd + i) * 4] = Math.round(255 * under(x0 + (i + 0.5) / R, z0 + (j + 0.5) / R));
  const ut = new THREE.DataTexture(ud, Wd, Hd, THREE.RGBAFormat); ut.magFilter = ut.minFilter = THREE.LinearFilter; ut.needsUpdate = true;
  const big = new THREE.TextureLoader().load(file); big.colorSpace = THREE.NoColorSpace; big.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: BIG_F, uniforms: { ...SH, uBig: { value: big }, uDet: { value: tex('dirt') }, uMossT: { value: tex('moss') }, uUnder: { value: ut },
    uArea: { value: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) }, uDetK: { value: detK }, uTone: { value: new THREE.Vector2(globalThis.__gTone ?? 0.66, globalThis.__gSat ?? 0.78) } } });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat);
  mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); mesh.renderOrder = -1; return mesh;
}

// Ground skirts (Nov 28, the person: the join between a thing and the ground can be part of the thing): a flat painted patch with a
// soft see-through edge laid under each prop — moss and a little soil at a headstone's foot, trodden earth round a lantern post —
// so it sits in the ground instead of on it; it goes where the prop goes, the painting under it knows nothing of it. All in one
// mesh, cells of one atlas; lit like the painted ground. items: [x, z, turn, width, depth, cell]
const SKIRT_F = `
#define TN ${TORCH_N}
uniform sampler2D uAtlas; uniform vec2 uTone;
uniform vec3 uLight; uniform float uLightR; uniform vec3 uAmb; uniform vec3 uLightC; uniform vec4 uTL[TN]; uniform vec3 uTC;
varying vec3 vW; varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
void main(){
  vec4 c = texture2D(uAtlas, vUv); if (c.a < 0.01) discard; vec3 base = c.rgb;
  base = mix(vec3(lum(base)), base, uTone.y) * uTone.x;
  float dl = length(vW.xz - uLight.xz), fall = 1.0 - smoothstep(uLightR * 0.15, uLightR, dl); fall *= fall;
  vec3 lit = uAmb * 1.02 + uLightC * fall * 0.78;
  for (int i = 0; i < TN; i++) { vec4 t = uTL[i]; if (t.w <= 0.0) continue; float f = max(0.0, 1.0 - length(vW - t.xyz) / t.w); f *= f; lit += uTC * f * 0.95; }
  gl_FragColor = vec4(base * min(lit, vec3(1.12)), c.a);
}`;
const SKIRT_V = `
varying vec3 vW; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export function groundSkirts(items, file = 'assets/ground/skirts_tmp.png', cols = 2, rows = 2) {
  const P = [], U = [], I = [];
  items.forEach(([x, z, r, w, d, cell], n) => {
    const cu = (cell % cols) / cols, cv = 1 - (Math.floor(cell / cols) + 1) / rows, c = Math.cos(r), s = Math.sin(r), y = 0.012 + (n % 7) * 0.0006; // (a hair apart, so two that overlap don't flicker)
    for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) { const lx = u * w, lz = v * d; P.push(x + lx * c + lz * s, y, z - lx * s + lz * c); U.push(cu + (u + 0.5) / cols, cv + (0.5 - v) / rows); }
    const b = n * 4; I.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
  const t = new THREE.TextureLoader().load(file); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({ vertexShader: SKIRT_V, fragmentShader: SKIRT_F, transparent: true, depthWrite: false,
    uniforms: { ...SH, uAtlas: { value: t }, uTone: { value: new THREE.Vector2(globalThis.__gTone ?? 0.66, globalThis.__gSat ?? 0.78) } } });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 0; return m;
}

// ground mist outside a clearing (the concept's blue-violet fog beyond the fence): one big see-through sheet a little above the
// ground, clear inside the rect [x0, z0, x1, z1], thickening over the first few metres past it, drifting slowly
const FOG_F = `
uniform float uT; uniform vec4 uIn; uniform vec3 uCol; uniform float uA; varying vec3 vW;
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 p = vW.xz, o = max(max(uIn.xy - p, p - uIn.zw), 0.0); float d = length(o);
  float n = vn(p * 0.16 + vec2(uT * 0.05, uT * 0.03)) * 0.6 + vn(p * 0.41 - vec2(uT * 0.08, -uT * 0.04)) * 0.4;
  float a = smoothstep(0.2, 5.0, d + (n - 0.5) * 2.5) * smoothstep(0.25, 0.75, n) * uA;
  gl_FragColor = vec4(uCol, a);
}`;
export function groundFog(rect, cx, cz, size = 150, a = 0.42, col = [0.26, 0.28, 0.5]) {
  const mat = new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: FOG_F, transparent: true, depthWrite: false,
    uniforms: { uT: AURA_T, uIn: { value: new THREE.Vector4(...rect) }, uCol: { value: new THREE.Color(...col) }, uA: { value: a } } });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat);
  mesh.position.set(cx, 0.32, cz); mesh.renderOrder = 2; return mesh;
}

// smooth value noise in JS (for laying out the splat map)
const h21 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export function vnoise(x, y) { const i = Math.floor(x), j = Math.floor(y); let fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h21(i, j), b = h21(i + 1, j), c = h21(i, j + 1), d = h21(i + 1, j + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
export const fbm = (x, y) => vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 5.3, y * 2.1 + 1.7) * 0.3 + vnoise(x * 4.3 + 9.1, y * 4.3 + 3.3) * 0.1;
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
