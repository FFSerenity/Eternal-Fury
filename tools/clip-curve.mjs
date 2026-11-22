// prints the hips height over time for a clip (to find take-off / landing frames)
import { NodeIO } from '@gltf-transform/core';
const doc = await new NodeIO().read(process.argv[2]);
for (const a of doc.getRoot().listAnimations()) { if (!process.argv.slice(3).includes(a.getName())) continue;
  for (const c of a.listChannels()) { if (c.getTargetNode().getName() !== 'hips' || c.getTargetPath() !== 'translation') continue;
    const s = c.getSampler(), t = s.getInput().getArray(), v = s.getOutput().getArray(); const out = [];
    for (let i = 0; i < t.length; i += Math.max(1, Math.floor(t.length / 30))) out.push(`${t[i].toFixed(2)}:${v[i * 3 + 1].toFixed(2)}/${v[i * 3 + 2].toFixed(2)}`);
    console.log(a.getName(), 'dur', t[t.length - 1].toFixed(2), '\n ', out.join(' ')); } }
