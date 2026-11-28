// An AI-generated model (ComfyUI Pixal3D / TRELLIS.2: ~700k triangles, three 2K+ PNG maps) slimmed for the game:
// welded and simplified to a target triangle count, the maps shrunk and turned to WebP, everything quantized.
// node tools/slim-gen3d.mjs in.glb out.glb [triangles=4000] [texture size=1024]
// WEAPON=1: stood up as the hero weapons are — its handle found (the turn in the picture's plane that makes its lower part thinnest)
// and turned to +y, the head up, the blade or wider side toward +x, the origin on the handle at GRIP (0.22) of the way up
// PROP=1: a floor prop — stood level, squared up, its base set on y = 0 and centred on x / z. The generator builds the model in the
// picture's own view (the camera a little above it, at three quarters): it comes out leaning toward +z by the camera's height (14-31°)
// and turned 30-45°. Level: the base found (the faces at the bottom that point down, by area) and turned to face straight down. Squared
// up: the turn of its footprint that fits in the smallest rectangle, its longer side along x, the side that faced the camera toward +z.
// AXIS=1: stood on its axis of turning instead (barrels, urns, round stands). FRONT=1: the side whose upper part reaches out farther (a weapon rack's hooks) toward +z
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, textureCompress, quantize, getBounds, transformMesh } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , src, out, triArg, texArg] = process.argv;
const TRIS = +(triArg || 4000), TEX = +(texArg || 1024);
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src), root = doc.getRoot();
const tris = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const t0 = tris();
// (tangents are rebuilt by three.js when needed; dropping them lets the simplifier merge more)
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const t = p.getAttribute('TANGENT'); if (t) { p.setAttribute('TANGENT', null); t.dispose(); } }
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TRIS / t0), error: +(process.env.ERR || 0.004), lockBorder: process.env.LOCK === '1' }));
if (process.env.WEAPON === '1') standUp(+(process.env.GRIP || 0.22));
if (process.env.CLEAN === '1') dropBits();
if (process.env.PROP === '1') { level(); if (process.env.FLOOR === '1') dropFloor(); const b0 = getBounds(root.listScenes()[0]), c = [-(b0.min[0] + b0.max[0]) / 2, -b0.min[1], -(b0.min[2] + b0.max[2]) / 2];
  for (const m of root.listMeshes()) transformMesh(m, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, c[0], c[1], c[2], 1]); } // PROP=1: a prop standing on the floor — its base at y = 0, centred on x / z
await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 88 }), quantize());
await io.write(out, doc);
const b = getBounds(root.listScenes()[0]);
console.log(`${src} → ${out}: ${t0} → ${Math.round(tris())} triangles, bounds`, b.min.map(v => +v.toFixed(3)), b.max.map(v => +v.toFixed(3)));

function standUp(grip) {
  const prims = root.listMeshes().flatMap(m => m.listPrimitives()), P = [];
  for (const p of prims) { const a = p.getAttribute('POSITION'), v = [0, 0, 0]; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); P.push([...v]); } }
  const turn = (t, q) => [q[0] * Math.cos(t) - q[1] * Math.sin(t), q[0] * Math.sin(t) + q[1] * Math.cos(t), q[2]], pct = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
  let best = null;
  for (let d = -80; d <= 80; d += 0.5) { const t = d * Math.PI / 180, R = P.map(q => turn(t, q)), ys = R.map(q => q[1]).sort((a, b) => a - b), y0 = ys[0], y1 = ys[ys.length - 1];
    const lo = R.filter(q => q[1] > y0 + (y1 - y0) * 0.08 && q[1] < y0 + (y1 - y0) * 0.32).map(q => q[0]).sort((a, b) => a - b); if (lo.length < 20) continue; // (above the pommel, below the head)
    const w = pct(lo, 0.95) - pct(lo, 0.05); if (!best || w < best.w) best = { t, w, y0, y1 }; }
  let R = P.map(q => turn(best.t, q)); const ys = R.map(q => q[1]).sort((a, b) => a - b), y0 = ys[0], y1 = ys[ys.length - 1], gy = y0 + (y1 - y0) * grip;
  const band = R.filter(q => Math.abs(q[1] - gy) < (y1 - y0) * 0.04), gx = band.reduce((s, q) => s + q[0], 0) / band.length, gz = band.reduce((s, q) => s + q[2], 0) / band.length;
  const top = R.filter(q => q[1] > y0 + (y1 - y0) * 0.6).map(q => q[0] - gx).sort((a, b) => a - b), flip = -pct(top, 0.01) > pct(top, 0.99); // (the side reaching farthest — the blade's — toward +x)
  const c = Math.cos(best.t), s = Math.sin(best.t), f = flip ? -1 : 1;
  // M = (flip: turn 180° about y) · translate(−grip) · rotZ(t), column-major
  const M = [f * c, s, 0, 0, -f * s, c, 0, 0, 0, 0, f, 0, -f * gx, -gy, -f * gz, 1];
  for (const m of root.listMeshes()) transformMesh(m, M);
  console.log(`stood up: turned ${(best.t * 180 / Math.PI).toFixed(1)}°, ${flip ? 'flipped, ' : ''}grip at ${grip} of ${(y1 - y0).toFixed(3)}`);
}

// FLOOR=1: the generator sometimes builds the picture's ground under the thing as a thin sheet (white, round a statue's plinth):
// once levelled, the faces lying within 1.5% of its height of the very bottom, facing up or down, are dropped
// CLEAN=1: stray bits the generator leaves floating off the thing (a pebble above a lantern post) — pieces under 3% of its faces
function dropBits() {
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const I = p.getIndices(), A = p.getAttribute('POSITION'), n = A.getCount(), par = new Int32Array(n).map((_, i) => i);
    const f0 = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    // (by place, not by index: the maps' seams split a vertex into several)
    const key = new Map(); for (let i = 0; i < n; i++) { const v = A.getElement(i, []), k = v.map(x => Math.round(x * 2000)).join(','); if (key.has(k)) par[f0(i)] = f0(key.get(k)); else key.set(k, i); }
    const f = f0;
    for (let i = 0; i < I.getCount(); i += 3) { const a = f(I.getScalar(i)), b = f(I.getScalar(i + 1)), c = f(I.getScalar(i + 2)); par[b] = a; par[f(c)] = a; }
    const cnt = new Map(); for (let i = 0; i < I.getCount(); i += 3) { const r = f(I.getScalar(i)); cnt.set(r, (cnt.get(r) || 0) + 1); }
    const tot = I.getCount() / 3, keep = []; let d = 0;
    for (let i = 0; i < I.getCount(); i += 3) { if (cnt.get(f(I.getScalar(i))) < 0.03 * tot) { d++; continue; } keep.push(I.getScalar(i), I.getScalar(i + 1), I.getScalar(i + 2)); }
    I.setArray(new (I.getArray().constructor)(keep)); console.log('bits: dropped', d, 'faces in', [...cnt.values()].filter(v => v < 0.03 * tot).length, 'pieces'); }
}
function dropFloor() {
  let y0 = 1e9, y1 = -1e9; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { const y = a.getElement(i, [])[1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  const lim = y0 + 0.015 * (y1 - y0); let n = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), I = p.getIndices(), keep = [];
    for (let i = 0; i < I.getCount(); i += 3) { const t = [0, 1, 2].map(k => I.getScalar(i + k)); if (t.every(v => a.getElement(v, [])[1] < lim)) { n++; continue; } keep.push(...t); }
    I.setArray(new (I.getArray().constructor)(keep)); }
  console.log('floor: dropped', n, 'faces');
}
function level() {
  const mul = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const T = []; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'), I = p.getIndices(), V = [];
    for (let i = 0; i < a.getCount(); i++) V.push(a.getElement(i, [])); for (let i = 0; i < I.getCount(); i += 3) T.push([V[I.getScalar(i)], V[I.getScalar(i + 1)], V[I.getScalar(i + 2)]]); }
  const P = T.flat(), H = Math.max(...P.map(v => v[1])) - Math.min(...P.map(v => v[1]));
  // the base: the downward faces within 3% of its height of the bottom, by area, a few times over as it comes level
  let up = [0, 1, 0];
  for (let it = 0; it < 5; it++) { const mn = Math.min(...P.map(v => dot(v, up))); let acc = [0, 0, 0];
    for (const t of T) { const c = cross(sub(t[1], t[0]), sub(t[2], t[0])), A = Math.hypot(...c); if (!A) continue;
      if ((dot(t[0], up) + dot(t[1], up) + dot(t[2], up)) / 3 < mn + 0.03 * H && dot(c, up) / A < -0.75) acc = acc.map((v, k) => v - c[k]); }
    if (!Math.hypot(...acc)) break; const nu = unit(acc);
    // MAXLEAN=deg: the generator's lean is 14-31°; a base found further over than this is some other face (a shrine's steps) — keep the last
    if (process.env.MAXLEAN && Math.acos(Math.min(1, nu[1])) * 180 / Math.PI > +process.env.MAXLEAN) break; up = nu; }
  // Rodrigues: the turn that takes up to +y
  const toY = up => { const ax = cross(up, [0, 1, 0]), sn = Math.hypot(...ax), cs = up[1], k = sn ? ax.map(v => v / sn) : [1, 0, 0], C = 1 - cs;
    return [cs + k[0] * k[0] * C, k[1] * k[0] * C + k[2] * sn, k[2] * k[0] * C - k[1] * sn, 0, k[0] * k[1] * C - k[2] * sn, cs + k[1] * k[1] * C, k[2] * k[1] * C + k[0] * sn, 0,
      k[0] * k[2] * C + k[1] * sn, k[1] * k[2] * C - k[0] * sn, cs + k[2] * k[2] * C, 0, 0, 0, 0, 1]; };
  const mm = (A, B) => { const M = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let r = 0; r < 4; r++) M[j * 4 + i] += A[r * 4 + i] * B[j * 4 + r]; return M; };
  let L = toY(up), Q = P.map(v => mul(L, v));
  // AXIS=1 (a barrel, an urn, a round stand): a round thing's base is rarely flat enough, so it is stood on its axis instead — the line
  // through the middles of its footprint low down and high up (above any rubble at its foot, below its lid)
  const AX = process.env.AXIS && process.env.AXIS !== '1' ? process.env.AXIS.split(',').map(Number) : [0.15, 0.3, 0.7, 0.85]; // (AXIS=lo0,lo1,hi0,hi1: other bands)
  if (process.env.AXIS) for (let it = 0; it < 6; it++) { const y0 = Math.min(...Q.map(q => q[1])), h = Math.max(...Q.map(q => q[1])) - y0;
    const mid = (a, b) => { const B = Q.filter(q => q[1] >= y0 + a * h && q[1] <= y0 + b * h), x = B.map(q => q[0]), z = B.map(q => q[2]);
      return [(Math.min(...x) + Math.max(...x)) / 2, y0 + (a + b) / 2 * h, (Math.min(...z) + Math.max(...z)) / 2]; };
    const L2 = toY(unit(sub(mid(AX[2], AX[3]), mid(AX[0], AX[1])))); L = mm(L2, L); Q = P.map(v => mul(L, v)); if (it === 5) up = [L[1], L[5], L[9]]; }
  // squared up: the smallest rectangle round the footprint; then the quarter turn that keeps the side that faced the camera (+z) toward
  // +z, unless that puts the longer side along z
  const box = t => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const c = Math.cos(t), s = Math.sin(t);
    for (const q of Q) { const x = q[0] * c + q[2] * s, z = -q[0] * s + q[2] * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x1 - x0, z1 - z0]; };
  let th = 0, best = 1e9; for (let d = -45; d < 45; d += 0.25) { const t = d * Math.PI / 180, [w, l] = box(t); if (w * l < best) { best = w * l; th = t; } }
  const [w, l] = box(th); if (l > w * 1.06) th += th > 0 ? -Math.PI / 2 : Math.PI / 2;
  const yaw = (t, q) => [q[0] * Math.cos(t) + q[2] * Math.sin(t), q[1], -q[0] * Math.sin(t) + q[2] * Math.cos(t)];
  if (process.env.FRONT === '1') { const R = Q.map(q => yaw(th, q)), y0 = Math.min(...R.map(q => q[1])), mid = R.reduce((s, q) => s + q[2], 0) / R.length;
    const hi = R.filter(q => q[1] > y0 + H * 0.65), hz = hi.reduce((s, q) => s + q[2], 0) / hi.length; if (hz < mid) th += Math.PI; }
  const c = Math.cos(th), s = Math.sin(th), Y = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; // (column-major: x' = x c + z s, z' = −x s + z c)
  const M = mm(Y, L);
  for (const m of root.listMeshes()) transformMesh(m, M);
  console.log(`levelled: leaned ${(Math.acos(Math.min(1, up[1])) * 180 / Math.PI).toFixed(1)}°, turned ${(th * 180 / Math.PI).toFixed(1)}°`);
}
