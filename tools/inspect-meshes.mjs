import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) { const par = n.getParentNode(); console.log(f.split('/').pop(), n.getName(), '<-', par ? par.getName() : 'scene', n.getSkin() ? 'SKIN' : '', n.getMesh().listPrimitives()[0].getAttribute('POSITION').getCount()); }
}
