import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const mul = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
for (const f of process.argv.slice(2)) { const d = await io.read(f), P = [];
  for (const n of d.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; const W = n.getWorldMatrix(); for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) P.push(mul(W, a.getElement(i, []))); } }
  const H = Math.max(...P.map(p => p[1])); const band = (lo, hi) => { const B = P.filter(p => p[1] >= lo * H && p[1] <= hi * H); const bx = B.map(p => p[0]), bz = B.map(p => p[2]); return [(Math.min(...bx) + Math.max(...bx)) / 2, (Math.min(...bz) + Math.max(...bz)) / 2]; };
  const lo = band(0.03, 0.12), hi = band(0.85, 0.95), dx = hi[0] - lo[0], dz = hi[1] - lo[1];
  console.log(f.split('/').pop().padEnd(12), 'lean x', (Math.atan2(dx, 0.82 * H) * 57.3).toFixed(1), 'z', (Math.atan2(dz, 0.82 * H) * 57.3).toFixed(1)); }
