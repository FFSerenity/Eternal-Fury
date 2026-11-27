// Painted ground (the hand-painted direction, Nov 2026): one continuous mesh over an area instead of KayKit's floor tiles, blending
// tiling ground textures by a splat map — dirt everywhere underneath, then grass, cobble and grave soil where the map says. Each
// texture is laid in world space at its own scale; where two meet, the higher-looking one (its brightness taken as height) wins the
// edge, so the stones of a path stand out of the grass instead of fading into it. A slow large-scale wash of brightness and hue keeps
// the repeats from showing. Lit by the same light as the toon world (the summoner's light, the torches, the ambient), but smooth.
import * as THREE from 'three';
import { SH, TORCH_N } from './gfx.js';
// the painted ground trial (hand-painted direction): ?paint=1 lays the camp's clearing as one painted ground instead of KayKit tiles
export const PAINT = typeof location !== 'undefined' && new URLSearchParams(location.search).has('paint');

// the ground set: name -> [file, metres one repeat covers]. The textures are placeholders until the person's ComfyUI ones come
export const GROUND = { dirt: ['assets/ground/dirt.jpg', 3.2], grass: ['assets/ground/grass.jpg', 2.6], cobble: ['assets/ground/cobble.jpg', 2.4], soil: ['assets/ground/soil.jpg', 3.0] };
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
uniform sampler2D uDirt, uGrass, uCobble, uSoil, uSplat; uniform vec4 uScale; uniform vec4 uArea; uniform float uSharp; uniform vec2 uTone;
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
  vec3 cD = tile2(uDirt, p / uScale.x, m), cG = tile2(uGrass, p / uScale.y, 1.0 - m), cC = texture2D(uCobble, p / uScale.z).rgb, cS = tile2(uSoil, p / uScale.w, m);
  // weights: dirt is what is left; each layer's brightness lifts it at the edges (height blend)
  vec4 w = vec4(max(0.0, 1.0 - s.r - s.g - s.b), s.r, s.g, s.b);
  vec4 h = w * 1.6 + vec4(lum(cD) * 0.35, lum(cG) * 0.45, lum(cC) * 0.9, lum(cS) * 0.3) * step(0.001, w);
  float hm = max(max(h.x, h.y), max(h.z, h.w)); vec4 k = max(h - hm + uSharp, 0.0); k /= (k.x + k.y + k.z + k.w + 1e-4);
  vec3 base = cD * k.x + cG * k.y + cC * k.z + cS * k.w;
  base *= 0.9 + 0.2 * m2; base = mix(base, base * vec3(1.06, 1.0, 0.9), smoothstep(0.4, 0.8, m)); // (a slow wash: some ground warmer, some cooler)
  base = mix(vec3(lum(base)), base, uTone.y) * uTone.x; // (the set's brightness and colour strength for the place: night is dim and grey)
  float dl = length(vW.xz - uLight.xz), fall = 1.0 - smoothstep(uLightR * 0.15, uLightR, dl); fall *= fall;
  vec3 lit = uAmb * 1.02 + uLightC * fall * 0.78;
  for (int i = 0; i < TN; i++) { vec4 t = uTL[i]; if (t.w <= 0.0) continue; float f = max(0.0, 1.0 - length(vW - t.xyz) / t.w); f *= f; lit += uTC * f * 0.72; }
  gl_FragColor = vec4(base * min(lit, vec3(1.12)), 1.0);
}`;

// the ground over [x0, x1] x [z0, z1]; weight(x, z) -> [grass, cobble, soil] (0..1 each; dirt gets what is left), sampled at
// res texels a metre into the splat map (smoothed by the texture's own filtering)
export function paintGround(x0, z0, x1, z1, weight, res = 4) {
  const W = Math.round((x1 - x0) * res), H = Math.round((z1 - z0) * res), data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const [g, c, s] = weight(x0 + (i + 0.5) / res, z0 + (j + 0.5) / res), o = (j * W + i) * 4;
    data[o] = Math.round(255 * Math.min(1, g)); data[o + 1] = Math.round(255 * Math.min(1, c)); data[o + 2] = Math.round(255 * Math.min(1, s)); data[o + 3] = 255; }
  const splat = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); splat.magFilter = splat.minFilter = THREE.LinearFilter; splat.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: F, uniforms: { ...SH,
    uDirt: { value: tex('dirt') }, uGrass: { value: tex('grass') }, uCobble: { value: tex('cobble') }, uSoil: { value: tex('soil') }, uSplat: { value: splat },
    uScale: { value: new THREE.Vector4(GROUND.dirt[1], GROUND.grass[1], GROUND.cobble[1], GROUND.soil[1]) }, uArea: { value: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) },
    uSharp: { value: 0.22 }, uTone: { value: new THREE.Vector2(globalThis.__gTone ?? 0.66, globalThis.__gSat ?? 0.78) } } });
  mat.userData.tone = mat.uniforms.uTone;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), mat);
  mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); mesh.renderOrder = -1; return mesh;
}

// smooth value noise in JS (for laying out the splat map)
const h21 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export function vnoise(x, y) { const i = Math.floor(x), j = Math.floor(y); let fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h21(i, j), b = h21(i + 1, j), c = h21(i, j + 1), d = h21(i + 1, j + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
export const fbm = (x, y) => vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 5.3, y * 2.1 + 1.7) * 0.3 + vnoise(x * 4.3 + 9.1, y * 4.3 + 3.3) * 0.1;
export const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
