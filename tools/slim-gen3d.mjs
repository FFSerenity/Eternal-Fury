// An AI-generated model (ComfyUI Pixal3D / TRELLIS.2: ~700k triangles, three 2K+ PNG maps) slimmed for the game:
// welded and simplified to a target triangle count, the maps shrunk and turned to WebP, everything quantized.
// node tools/slim-gen3d.mjs in.glb out.glb [triangles=4000] [texture size=1024]
// WEAPON=1: stood up as the hero weapons are — its handle found (the turn in the picture's plane that makes its lower part thinnest)
// and turned to +y, the head up, the blade or wider side toward +x, the origin on the handle at GRIP (0.22) of the way up
// PROP=1: a floor prop — its base set on y = 0 and centred on x / z
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
if (process.env.PROP === '1') { const b0 = getBounds(root.listScenes()[0]), c = [-(b0.min[0] + b0.max[0]) / 2, -b0.min[1], -(b0.min[2] + b0.max[2]) / 2];
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
