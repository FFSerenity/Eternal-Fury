// Stone paths for the painted ground (Nov 2026), after the concept picture (the person pointed it out: its path is made of square
// blocks, each 4–6 flat, angular, uneven slabs with slanting joints): each 1 m path cell is such a block, laid by code — every slab
// its own raised little mesh, so no two blocks are alike. A straight cell: two courses across its run, split by a slanting line,
// each cut by slanting joints into slabs 0.3–0.5 m across; a corner or a crossing cell: 2×2 by two slanting lines. The block's
// outline falls on the cell grid, so blocks join up along a run. Each slab: its quad less half the joint, edges broken into chips
// and a corner knocked off here and there, barely rounded; a flat top on steep sides with a narrow bevel, slightly tilted. At the
// path's sides the slabs run 0.12–0.26 m past the cells, ragged, lower and now and then missing; a few small sunken ones stray past.
// A hand-painted stone surface is laid on top, turned and shifted per stone, tinted a little warmer or cooler per stone, darker down
// the sides. Lit like the painted ground but with the stone's own slope: a painter's light from the upper left of the screen, the
// summoner's light and the lanterns from where they are.
import * as THREE from 'three';
import { SH, TORCH_N } from './gfx.js';

const hash = (i, j, k = 0) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

const V = `
attribute vec3 color; varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv;
void main(){ vW = position; vN = normal; vC = color; vUv = uv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const F = `
#define TN ${TORCH_N}
uniform sampler2D uStone; uniform vec2 uTone; uniform float uCut;
uniform vec3 uLight; uniform float uLightR; uniform vec3 uAmb; uniform vec3 uLightC; uniform vec4 uTL[TN]; uniform vec3 uTC;
varying vec3 vW; varying vec3 vN; varying vec3 vC; varying vec2 vUv;
float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }
void main(){
  vec4 tx = texture2D(uStone, vUv); if (tx.a < uCut) discard; // (the tile set's rounded corners)
  vec3 N = normalize(vN), base = tx.rgb * vC;
  base = mix(vec3(lum(base)), base, uTone.y) * uTone.x;
  vec3 K = normalize(vec3(-0.5, 1.0, -0.45)); // (the painter's light: from the upper left of the screen)
  vec3 lit = uAmb * (0.5 + 0.68 * max(dot(N, K), 0.0) + 0.1 * N.y);
  float dl = length(vW.xz - uLight.xz), fall = 1.0 - smoothstep(uLightR * 0.15, uLightR, dl); fall *= fall;
  lit += uLightC * fall * 0.78 * (0.45 + 0.65 * max(dot(N, normalize(uLight - vW)), 0.0));
  for (int i = 0; i < TN; i++) { vec4 t = uTL[i]; if (t.w <= 0.0) continue; vec3 d = t.xyz - vW; float f = max(0.0, 1.0 - length(d) / t.w); f *= f;
    lit += uTC * f * 0.95 * (0.3 + 0.85 * max(dot(N, normalize(d)), 0.0)); }
  gl_FragColor = vec4(base * min(lit, vec3(1.15)), 1.0);
}`;

const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
// a convex-ish polygon moved in by d along each side (the joint)
function shrink(p, d) {
  const n = p.length, L = [];
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l; // (inward for a positive-area winding)
    L.push([a[0] + nx * d, a[1] + nz * d, dx, dz]); }
  const out = [];
  for (let i = 0; i < n; i++) { const A = L[(i + n - 1) % n], B = L[i], den = A[2] * B[3] - A[3] * B[2];
    if (Math.abs(den) < 1e-9) { out.push([B[0], B[1]]); continue; }
    const t = ((B[0] - A[0]) * B[3] - (B[1] - A[1]) * B[2]) / den; out.push([A[0] + A[2] * t, A[1] + A[3] * t]); }
  return out;
}
// the slab maker: slab(quad, id, low) adds one raised slab; mesh() returns them all as one mesh (or null)
function slabMaker({ tex = 'assets/ground/stone.jpg', texM = 1.3, tint0 = [1, 1, 1] } = {}) {
  const P = [], N = [], C = [], U = [], I = [];
  // one slab on the quad q ([[x, z] × 4]); id: its own random numbers; low: height factor
  const slab = (q, id, low = 1) => {
    const r = k => hash(id, k, 77);
    if (area(q) < 0) q = q.slice().reverse();
    let p = shrink(q, 0.011 + r(1) * 0.011); if (area(p) < 0.006) return;
    // break the edges into chips (two points along each side pushed in a little), and knock a corner off now and then
    const e = [];
    for (let k = 0; k < p.length; k++) { const a = p[k], b = p[(k + 1) % p.length], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (r(10 + k) < 0.45) { const c = 0.03 + r(14 + k) * 0.04; e.push([a[0] + dx / l * c - nx * 0.0, a[1] + dz / l * c]); } // (corner off: start a bit along)
      else e.push(a);
      for (const t of [0.3 + r(18 + k) * 0.1, 0.62 + r(22 + k) * 0.1]) { const dd = r(26 + k * 2 + (t > 0.5 ? 1 : 0)) * 0.022; e.push([a[0] + dx * t + nx * dd, a[1] + dz * t + nz * dd]); }
      if (r(10 + k) < 0.45) { const c = 0.03 + r(30 + k) * 0.04; e.push([b[0] - dx / l * c, b[1] - dz / l * c]); } }
    // barely rounded (a soft Chaikin, a fifth in from each corner)
    p = []; for (let k = 0; k < e.length; k++) { const a = e[k], b = e[(k + 1) % e.length]; p.push([a[0] * 0.82 + b[0] * 0.18, a[1] * 0.82 + b[1] * 0.18], [a[0] * 0.18 + b[0] * 0.82, a[1] * 0.18 + b[1] * 0.82]); }
    let cx = 0, cz = 0; for (const v of p) { cx += v[0]; cz += v[1]; } cx /= p.length; cz /= p.length;
    let rmin = 9; for (const v of p) rmin = Math.min(rmin, Math.hypot(v[0] - cx, v[1] - cz));
    if (rmin < 0.03) return;
    const h = (0.045 + r(40) * 0.03) * low, tx = (r(41) - 0.5) * 0.08, tz = (r(42) - 0.5) * 0.08, tilt = (x, z) => tx * (x - cx) + tz * (z - cz);
    const inset = b => p.map(([x, z]) => { const dx = cx - x, dz = cz - z, d = Math.hypot(dx, dz) || 1, s = Math.min(b, d * 0.4); return [x + dx / d * s, z + dz / d * s]; });
    const r1 = inset(Math.min(0.01, rmin * 0.1)), r2 = inset(Math.min(0.03, rmin * 0.28));
    const v = 1.02 + r(43) * 0.3, w = r(44), moss = r(45) < 0.07;
    const tint = [v * (0.94 + w * 0.12) * tint0[0], v * (0.97 + (moss ? 0.06 : 0.01)) * tint0[1], v * (1.05 - w * 0.14 - (moss ? 0.12 : 0)) * tint0[2]];
    const ang = r(46) * 6.283, ca = Math.cos(ang), sa = Math.sin(ang), ou = r(47) * 7, ov = r(48) * 7;
    const b0 = P.length / 3, ring = (pts, y, dark) => { for (const [x, z] of pts) { P.push(x, y + (y > 0 ? tilt(x, z) : 0), z);
      C.push(tint[0] * dark, tint[1] * dark, tint[2] * dark); U.push((ca * x - sa * z) / texM + ou, (sa * x + ca * z) / texM + ov); N.push(0, 1, 0); } };
    const n = p.length;
    ring(p, -0.012, 0.3); ring(r1, h * 0.84, 0.72); ring(r2, h, 1.0); ring([[cx, cz]], h + 0.004, 1.03);
    for (let k = 0; k < 2; k++) for (let a = 0; a < n; a++) { const b = (a + 1) % n, A = b0 + k * n + a, B = b0 + k * n + b; I.push(A, B + n, B, A, A + n, B + n); }
    const ctr = b0 + 3 * n; for (let a = 0; a < n; a++) I.push(b0 + 2 * n + a, ctr, b0 + 2 * n + (a + 1) % n);
  };
  const mesh = () => {
    if (!I.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.setIndex(I); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, litMat(tex)); m.userData.tris = I.length / 3; return m;
  };
  return { slab, mesh };
}
const TEX = {};
function litMat(tex) {
  if (!TEX[tex]) { const t = TEX[tex] = new THREE.TextureLoader().load(tex); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.NoColorSpace; }
  return new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: F, uniforms: { ...SH, uStone: { value: TEX[tex] }, uCut: { value: 0 },
    uTone: { value: new THREE.Vector2(globalThis.__gTone ?? 0.66, globalThis.__gSat ?? 0.78) } } });
}

// cells: [[x, z], ...] path cells (1 m squares on the floor grid); returns one merged mesh of all the slabs (or null)
export function stonePath(cells, W, opts = {}) {
  const set = new Set(cells.map(([x, z]) => z * W + x)), has = (x, z) => set.has(z * W + x);
  const { slab, mesh } = slabMaker(opts);
  const id = (a, b, c = 0) => Math.floor(hash(a * 131 + 7, b * 17 + 3, c) * 2147483647);
  const jit = (x, z, k, m) => (hash(x, z, k) - 0.5) * 2 * m;
  for (const [x, z] of cells) {
    const L = has(x - 1, z), R = has(x + 1, z), D = has(x, z - 1), T = has(x, z + 1), alongX = (L || R) && !(D || T), alongZ = (D || T) && !(L || R);
    const over = k => 0.12 + hash(x, z, 50 + k) * 0.14; // (how far the slabs run past an open side)
    // (u, s) -> (x, z): u along the run, s across it
    const XZ = alongZ ? (u, s) => [x + s, z + u] : (u, s) => [x + u, z + s];
    if (alongX || alongZ) {
      // two courses, split by a slanting line; each course cut by slanting joints into slabs
      const e1 = jit(x, z, 60, 0.09), e2 = jit(x, z, 61, 0.09), s0 = -over(0), s1 = 1 + over(1);
      const split = s => 0.5 + e1 + (e2 - e1) * (s - s0) / (s1 - s0);
      for (let c = 0; c < 2; c++) {
        const lo = c ? split : () => 0, hi = c ? () => 1 : split;
        const a0 = s0 + jit(x, z, 62 + c, 0.06), a1 = s1 + jit(x, z, 64 + c, 0.06);
        const cuts = [[a0, a0 + jit(x, z, 66 + c, 0.04)]]; let s = a0, k = 0;
        while (s < a1 - 0.01) { let len = 0.3 + hash(x * 7 + c, z, 70 + k) * 0.2; if (a1 - (s + len) < 0.22) len = a1 - s; s += len;
          const end = s >= a1 - 0.01; cuts.push(end ? [a1, a1 + jit(x, z, 68 + c, 0.04)] : [s + jit(x, z, 80 + c * 9 + k, 0.07), s + jit(x, z, 100 + c * 9 + k, 0.07)]); k++; }
        for (let m = 0; m < cuts.length - 1; m++) {
          const edge = m === 0 || m === cuts.length - 2; if (edge && hash(x, z, 120 + c * 9 + m) < 0.1) continue; // (now and then an edge slab is missing)
          const [p0, p1] = cuts[m], [q0, q1] = cuts[m + 1];
          slab([XZ(lo(p0), p0), XZ(hi(p1), p1), XZ(hi(q1), q1), XZ(lo(q0), q0)], id(x * 2 + c, z * 2, m), edge ? 0.8 : 1);
        }
      }
    } else {
      // a corner, a crossing, a lone cell: 2×2 by two slanting lines, reaching past the open sides
      const xa = L ? 0 : -over(0), xb = R ? 1 : 1 + over(1), za = D ? 0 : -over(2), zb = T ? 1 : 1 + over(3);
      const ux0 = 0.5 + jit(x, z, 60, 0.08), ux1 = 0.5 + jit(x, z, 61, 0.08), uz0 = 0.5 + jit(x, z, 62, 0.08), uz1 = 0.5 + jit(x, z, 63, 0.08);
      // the split lines: x = ux0 at z = za … ux1 at z = zb; z = uz0 at x = xa … uz1 at x = xb; their crossing found by a few steps
      let px = 0.5, pz = 0.5; for (let it = 0; it < 6; it++) { px = ux0 + (ux1 - ux0) * (pz - za) / (zb - za); pz = uz0 + (uz1 - uz0) * (px - xa) / (xb - xa); }
      const G = [[[xa, za], [ux0, za], [xb, za]], [[xa, uz0], [px, pz], [xb, uz1]], [[xa, zb], [ux1, zb], [xb, zb]]];
      for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
        const q = [G[b][a], G[b][a + 1], G[b + 1][a + 1], G[b + 1][a]].map(([u, v]) => [x + u, z + v]);
        const edge = (a === 0 && !L) || (a === 1 && !R) || (b === 0 && !D) || (b === 1 && !T);
        slab(q, id(x * 3 + a, z * 3 + b, 7), edge ? 0.85 : 1);
      }
    }
    // a few small sunken slabs strayed past the open sides
    for (let k = 0; k < 4; k++) { if (hash(x, z, 200 + k) > 0.2 || ![!L, !R, !D, !T][k]) continue;
      const t = 0.15 + hash(x, z, 210 + k) * 0.7, d = 0.32 + hash(x, z, 220 + k) * 0.25, sz = 0.11 + hash(x, z, 230 + k) * 0.08;
      const px = k === 0 ? x - d : k === 1 ? x + 1 + d : x + t, pz = k === 2 ? z - d : k === 3 ? z + 1 + d : z + t;
      if (set.has(Math.floor(pz) * W + Math.floor(px))) continue;
      const a = hash(x, z, 240 + k) * 1.5, ca = Math.cos(a) * sz / 2, sa = Math.sin(a) * sz / 2;
      slab([[px - ca + sa, pz - sa - ca], [px + ca + sa, pz + sa - ca], [px + ca - sa, pz + sa + ca], [px - ca - sa, pz - sa + ca]], id(x, z, 250 + k), 0.45); }
  }
  return mesh();
}

// The person's tile set (a painted sheet of six square cobble blocks, "Graveyard Cobblestone Tile Set"; cut out whole — each block's
// own bevelled outer stones and rounded corners kept, the sheet's background made see-through — a little less purple, packed 3×2 in
// assets/ground/pathtiles.webp): each path cell shows one block, picked and turned by the cell's own random numbers (never the same
// block as the cell before it along x or z), flat just above the ground — the painting carries the relief. Blocks meet at their own
// bevelled edges (the concept's path reads as such blocks), and the outer stones of the blocks make the path's sides.
export function tilePath(cells, W, { tex = 'assets/ground/pathtiles.webp' } = {}) {
  const P = [], C = [], U = [], N = [], I = [], pick = new Map();
  for (const [x, z] of cells) {
    let k = Math.floor(hash(x, z, 300) * 6); const r = Math.floor(hash(x, z, 301) * 4);
    for (const [nx, nz] of [[x - 1, z], [x, z - 1]]) { const o = pick.get(nz * W + nx); if (o === k) k = (k + 1 + Math.floor(hash(x, z, 302) * 4)) % 6; }
    pick.set(z * W + x, k);
    const u0 = (k % 3) / 3, v0 = 1 - (Math.floor(k / 3) + 1) / 2, uv = [[u0, v0 + 0.5], [u0 + 1 / 3, v0 + 0.5], [u0 + 1 / 3, v0], [u0, v0]]; // (corners −x−z, +x−z, +x+z, −x+z; the sheet's top row is +v)
    const b = P.length / 3, corners = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]];
    for (let c = 0; c < 4; c++) { P.push(corners[c][0], 0.006, corners[c][1]); C.push(1, 1, 1); N.push(0, 1, 0); const t = uv[(c + r) % 4]; U.push(t[0], t[1]); }
    I.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
  const mat = litMat(tex), t = mat.uniforms.uStone.value; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; mat.uniforms.uCut.value = 0.5;
  return new THREE.Mesh(geo, mat);
}
