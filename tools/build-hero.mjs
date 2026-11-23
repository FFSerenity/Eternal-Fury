// Optimise the realistic hero skeleton (made with Meshy, decimated in Blender) for the web:
// textures resized and re-encoded as WebP, animations resampled, geometry quantized + meshopt-compressed.
// Also used for the animation packs (rig + clips, no mesh). Clips keep only what the game plays: body-bone rotations and
// the hips' translation (fingers are posed as fists in code, other bones never move); rotations stored as normalized int16.
// Usage: node tools/build-hero.mjs <in.glb> <out.glb>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize, meshopt, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';

const [src, dst] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
// texture slots: base colour 1024, normal 1024, metal/rough 512
const slot = {};
for (const m of root.listMaterials()) { const b = m.getBaseColorTexture(), n = m.getNormalTexture(), r = m.getMetallicRoughnessTexture();
  if (b) slot[b.getName() || b.getURI()] = 1024; if (n) slot[n.getName() || n.getURI()] = 1024; if (r) slot[r.getName() || r.getURI()] = 512; }
const body = n => n.startsWith('mixamorig:') && !/Hand./.test(n) && !n.endsWith('_End');
for (const a of root.listAnimations()) for (const c of a.listChannels()) {
  const n = c.getTargetNode().getName(), p = c.getTargetPath();
  if (!body(n) || !(p === 'rotation' || (p === 'translation' && n === 'mixamorig:Hips'))) { const s = c.getSampler(); c.dispose(); s.dispose(); }
}
await doc.transform(
  weld(), dedup(), resample(), prune(),
  (d) => { const done = new Set(); for (const a of d.getRoot().listAnimations()) for (const c of a.listChannels()) {
    if (c.getTargetPath() !== 'rotation') continue; const o = c.getSampler().getOutput(); if (done.has(o) || o.getNormalized()) continue; done.add(o);
    const f = o.getArray(), q = new Int16Array(f.length); for (let i = 0; i < f.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
    o.setArray(q).setNormalized(true); } },
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 88 }),
  quantize({ quantizeNormal: 10, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
// metal/rough down to 512 (smaller than the others)
for (const m of root.listMaterials()) { const r = m.getMetallicRoughnessTexture(); if (!r) continue;
  r.setImage(await sharp(r.getImage()).resize(512, 512).webp({ quality: 85 }).toBuffer()); }
await io.write(dst, doc);
const tris = root.listMeshes().reduce((s, me) => s + me.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
console.log(dst, (fs.statSync(dst).size / 1024 / 1024).toFixed(2), 'MB,', tris, 'tris,', root.listAnimations().map(a => a.getName()).join(' '), '| joints', root.listSkins()[0]?.listJoints().length,
  '| textures', root.listTextures().map(t => t.getMimeType() + ' ' + (t.getSize() || []).join('x')).join(', '));
