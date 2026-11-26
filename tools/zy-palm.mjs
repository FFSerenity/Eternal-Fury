// Zhao Yun's palms in the rest pose: the thinnest way across each hand's skinned vertices (weight > 0.6 on the hand and finger bones), with
// the knuckles and thumb for reference. The sign is chosen by eye (toward the body and down, as the A-pose holds them): assets.js ZY_PALM.
// Usage: node tools/zy-palm.mjs <zy_fixed.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]);
const r = doc.getRoot(), sk = r.listSkins()[0], J = sk.listJoints(), names = J.map(j => j.getName());
const wpos = n => { const m = J[names.indexOf(n)].getWorldMatrix(); return [m[12], m[13], m[14]]; };
for (const S of ['Left', 'Right']) {
  const want = new Set(names.map((n, i) => [n, i]).filter(([n]) => n === `mixamorig:${S}Hand` || n.startsWith(`mixamorig:${S}Hand`)).map(([, i]) => i));
  const P = [];
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { const pos = p.getAttribute('POSITION'), jj = p.getAttribute('JOINTS_0'), ww = p.getAttribute('WEIGHTS_0'), a = [], w = [], v = [];
    for (let i = 0; i < pos.getCount(); i++) { jj.getElement(i, a); ww.getElement(i, w); let s = 0; for (let k = 0; k < 4; k++) if (want.has(a[k])) s += w[k]; if (s > 0.6) { pos.getElement(i, v); P.push(v.slice()); } } }
  const c = [0, 0, 0]; for (const p of P) for (let k = 0; k < 3; k++) c[k] += p[k] / P.length;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (const p of P) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - c[i]) * (p[j] - c[j]) / P.length;
  // smallest eigenvector by inverse power iteration on C (shifted)
  const inv = m => { const [a, b, cc] = m, det = a[0] * (b[1] * cc[2] - b[2] * cc[1]) - a[1] * (b[0] * cc[2] - b[2] * cc[0]) + a[2] * (b[0] * cc[1] - b[1] * cc[0]);
    return [[(b[1] * cc[2] - b[2] * cc[1]) / det, (a[2] * cc[1] - a[1] * cc[2]) / det, (a[1] * b[2] - a[2] * b[1]) / det], [(b[2] * cc[0] - b[0] * cc[2]) / det, (a[0] * cc[2] - a[2] * cc[0]) / det, (a[2] * b[0] - a[0] * b[2]) / det], [(b[0] * cc[1] - b[1] * cc[0]) / det, (a[1] * cc[0] - a[0] * cc[1]) / det, (a[0] * b[1] - a[1] * b[0]) / det]]; };
  const I = inv(C); let x = [1, 1, 1]; for (let it = 0; it < 50; it++) { const y = [0, 1, 2].map(i => I[i][0] * x[0] + I[i][1] * x[1] + I[i][2] * x[2]); const l = Math.hypot(...y); x = y.map(v => v / l); }
  const hp = wpos(`mixamorig:${S}Hand`), t1 = wpos(`mixamorig:${S}HandThumb1`), m1 = wpos(`mixamorig:${S}HandMiddle1`), p1 = wpos(`mixamorig:${S}HandPinky1`);
  const toT = [0, 1, 2].map(i => t1[i] - c[i]);
  console.log(S, 'verts', P.length, 'centroid', c.map(v => v.toFixed(3)), 'thin axis', x.map(v => v.toFixed(3)), 'thumb1-centroid . axis', (toT[0] * x[0] + toT[1] * x[1] + toT[2] * x[2]).toFixed(4),
    '| wrist', hp.map(v => v.toFixed(3)), 'mid1', m1.map(v => v.toFixed(3)), 'pinky1', p1.map(v => v.toFixed(3)), 'thumb1', t1.map(v => v.toFixed(3)));
}
