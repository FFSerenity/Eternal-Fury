// Several slimmed props (tools/slim-gen3d.mjs, PROP=1) packed into one GLB the game loads as a prop file (assets.js PROP_FILES):
// each becomes one top-level node under the scene, named for the game (propGeo(name)), with its own base-colour texture only
// (the props are lit like the rest of the crypt's: the normal and metal/rough maps are dropped).
// node tools/pack-props.mjs out.glb name=in.glb [name=in.glb ...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, prune, dedup, unpartition } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [, , out, ...pairs] = process.argv;
const doc = await io.read(pairs[0].split('=')[1]), root = doc.getRoot(), scene = root.listScenes()[0];
const wrap = (name, nodes) => { const n = doc.createNode(name); for (const c of nodes) { for (const s of root.listScenes()) s.removeChild(c); n.addChild(c); } scene.addChild(n); };
wrap(pairs[0].split('=')[0], scene.listChildren());
for (const p of pairs.slice(1)) {
  const [name, file] = p.split('='), src = await io.read(file), map = mergeDocuments(doc, src), tops = [];
  for (const s of src.getRoot().listScenes()) for (const c of s.listChildren()) tops.push(map.get(c));
  wrap(name, tops);
}
for (const s of root.listScenes()) if (s !== scene) s.dispose();
root.setDefaultScene(scene);
for (const m of root.listMaterials()) { m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); m.setEmissiveTexture(null); }
await doc.transform(dedup(), prune(), unpartition()); // (one buffer: a GLB holds only one)
await io.write(out, doc);
console.log(out, scene.listChildren().map(n => n.getName()).join(', '), root.listTextures().length, 'textures');
