// Meshy's auto-rig of Zhao Yun (Meshy 7.5 model, remeshed to 25k triangles, rigged + animated in Meshy, exported with the Mixamo
// skeleton) leaves skin weights on helper bones that never move with the body:
//  - an arm chain on each side hung under the head (Bone_033/032/031 left, Bone_028/027/026 right: shoulder, upper arm, forearm,
//    at exactly the arm joints' places) — half the shoulder, sleeve and pauldron weight sits on them, so those parts stay behind as
//    flat shards when the arms move;
//  - three bones under the forearm / hand chains whose heads lie on the floor (Bone_018 left, Bone_013/Bone_012 right) carry a trace of
//    weight on the boots — the boots' tips stretch up to the hands in long spikes;
//  - the helmet's bones (crest, plume) under the head: rigid with it anyway.
// Their weights go to the bones they stand for; the helper bones stay in the skin, unused.
// Also the clips (Meshy's preset motions, retargeted to him there): renamed ZY_<name>; the hips' travel taken out — the loops run in
// place (the game moves him), the attacks end where they began (the lunge forward stays, the drift is spread over the clip); one
// duplicate dropped. The archery clips aim off to his left (an archer's side-on stance, the bow arm ~77 deg from where his hips face):
// turned so the bow arm points where he faces. Then: node tools/build-hero.mjs (textures, resampling, compression).
// Each clip stood on his spot: the hips moved by where the feet stand (feet.json, from tools/bl_zy_feet.py on this tool's own output:
// the loops by their mean over the cycle, the rest by the first frame) — his spear stance stood ~0.4 m to his left.
// Last, the mesh simplified to 70% (24.8k -> 17.4k triangles, as many as the Sentinel's): side by side up close nothing is lost, and he is
// drawn twice (the outline) — the frame cost went down with it.
// Usage: node tools/zy-fix-rig.mjs <in.glb> <out.glb> [feet.json]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [src, dst, feetFile] = process.argv.slice(2);
const FEET = feetFile ? JSON.parse((await import('node:fs')).readFileSync(feetFile, 'utf8')) : {};
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot(), skin = root.listSkins()[0], J = skin.listJoints().map(j => j.getName()), ix = n => J.indexOf(n);
const MAP = { Bone_033: 'LeftShoulder', Bone_032: 'LeftArm', Bone_031: 'LeftForeArm', Bone_028: 'RightShoulder', Bone_027: 'RightArm', Bone_026: 'RightForeArm',
  Bone_018: 'LeftFoot', Bone_013: 'RightFoot', Bone_012: 'RightToeBase',
  Bone_023: 'Head', Bone_022: 'Head', Bone_035: 'Head', Bone_034: 'Head', Bone_037: 'Head', Bone_036: 'Head', Bone_039: 'Head', Bone_038: 'Head' };
const to = new Map(); for (const [s, d] of Object.entries(MAP)) { const a = ix(s), b = ix('mixamorig:' + d); if (a >= 0 && b >= 0) to.set(a, b); else console.warn('missing', s, d); }
let moved = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
  const jj = p.getAttribute('JOINTS_0'), ww = p.getAttribute('WEIGHTS_0'), a = [], w = [];
  for (let i = 0; i < jj.getCount(); i++) { jj.getElement(i, a); ww.getElement(i, w); let ch = false;
    for (let k = 0; k < 4; k++) if (w[k] > 0 && to.has(a[k])) { a[k] = to.get(a[k]); ch = true; }
    if (!ch) continue; moved++;
    for (let k = 0; k < 4; k++) for (let l = k + 1; l < 4; l++) if (w[l] > 0 && a[l] === a[k]) { w[k] += w[l]; w[l] = 0; a[l] = 0; } // (one joint twice: one slot)
    const s = w.reduce((x, y) => x + y, 0); for (let k = 0; k < 4; k++) w[k] /= s;
    jj.setElement(i, a); ww.setElement(i, w); }
}
// ---- the clips ----
const LOOP = new Set(['Running', 'Walking', 'Spear_Walk', 'Standard_Forward_Charge']), DROP = new Set(['Draw_and_Shoot_from_Back_1']);
const hips = root.listNodes().find(n => n.getName() === 'mixamorig:Hips');
for (const a of root.listAnimations()) {
  const name = a.getName(); if (DROP.has(name)) { for (const c of a.listChannels()) { const sm = c.getSampler(); c.dispose(); sm.dispose(); } a.dispose(); continue; }
  a.setName('ZY_' + name);
  const ch = a.listChannels().find(c => c.getTargetNode() === hips && c.getTargetPath() === 'translation'); if (!ch) continue;
  const t = ch.getSampler().getInput().getArray(), o = ch.getSampler().getOutput().getArray().slice(), n = t.length, T = t[n - 1] - t[0] || 1;
  // the drift over the clip (x and z: the ground plane), taken out in proportion to time: a loop then joins up in place, an attack returns
  const dx = o[(n - 1) * 3] - o[0], dz = o[(n - 1) * 3 + 2] - o[2];
  for (let i = 0; i < n; i++) { const f = (t[i] - t[0]) / T; o[i * 3] -= dx * f; o[i * 3 + 2] -= dz * f; }
  ch.getSampler().getOutput().setArray(o);
  if (/^Archery/.test(name)) { // the whole clip turned about the vertical: the hips' turn and place (the hips hang straight off the armature root)
    const th = -77 * Math.PI / 180, qy = [0, Math.sin(th / 2), 0, Math.cos(th / 2)], c = Math.cos(th), s = Math.sin(th);
    for (let i = 0; i < n; i++) { const x = o[i * 3], z = o[i * 3 + 2]; o[i * 3] = x * c + z * s; o[i * 3 + 2] = -x * s + z * c; }
    ch.getSampler().getOutput().setArray(o);
    const rc = a.listChannels().find(c => c.getTargetNode() === hips && c.getTargetPath() === 'rotation'), r = rc.getSampler().getOutput().getArray().slice();
    for (let i = 0; i < r.length; i += 4) { const [x, y, z, w] = r.slice(i, i + 4), [ax, ay, az, aw] = qy; // qy * q
      r[i] = aw * x + ax * w + ay * z - az * y; r[i + 1] = aw * y - ax * z + ay * w + az * x; r[i + 2] = aw * z + ax * y - ay * x + az * w; r[i + 3] = aw * w - ax * x - ay * y - az * z; }
    rc.getSampler().getOutput().setArray(r); }
  const ft = FEET['ZY_' + name]; if (ft) { const [fx, fz] = LOOP.has(name) ? ft.mean : ft.first; for (let i = 0; i < n; i++) { o[i * 3] -= fx; o[i * 3 + 2] -= fz; } } // (measured on the turned clips)
  ch.getSampler().getOutput().setArray(o);
  console.log(name.padEnd(28), LOOP.has(name) ? 'loop ' : 'clip ', 'drift', dx.toFixed(2), dz.toFixed(2));
}
await MeshoptSimplifier.ready;
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.7, error: 0.002, lockBorder: false }));
await io.write(dst, doc);
console.log(dst, 'vertices moved', moved);
