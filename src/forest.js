// The Forest Nature Pack's palette, repainted for a haunted night: the models' UVs pick a row (foliage, bark, stone)
// and a height in that row's light→dark gradient. Foliage is painted grey here and coloured per instance (LEAFTINT),
// so one tree model can be summer-green, teal, autumn-orange or blood-red without separate textures or meshes.
import * as THREE from 'three';
import { TEX } from './assets.js';

const ROWS = [
  [[1.0, 1.0, 1.0], [0.36, 0.36, 0.36]],     // foliage: grey (the instance colour paints it)
  [[0.70, 0.57, 0.47], [0.33, 0.26, 0.23]],  // bark: weathered brown-grey
  [[0.66, 0.70, 0.74], [0.33, 0.36, 0.40]],  // stone: cool grey
  [[0.5, 0.5, 0.5], [0.2, 0.2, 0.2]],        // (unused)
];
const H = 128, D = new Uint8Array(2 * H * 4);
for (let y = 0; y < H; y++) { const [a, b] = ROWS[Math.floor(y / (H / 4))], t = (y % (H / 4)) / (H / 4 - 1);
  for (let x = 0; x < 2; x++) for (let k = 0; k < 3; k++) D[(y * 2 + x) * 4 + k] = Math.round((a[k] + (b[k] - a[k]) * t) * 255); D[(y * 2) * 4 + 3] = D[(y * 2 + 1) * 4 + 3] = 255; }
const tex = new THREE.DataTexture(D, 2, H, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
TEX.forest = tex;

// foliage colours (multiplied with the grey gradient): a few families, each tree jittered a little
export const LEAF = {
  green: [0.40, 0.62, 0.36], teal: [0.30, 0.58, 0.52], moss: [0.50, 0.60, 0.30],
  orange: [1.0, 0.56, 0.22], red: [0.90, 0.30, 0.20], gold: [1.0, 0.80, 0.32], grass: [0.52, 0.64, 0.34], dry: [0.78, 0.72, 0.40],
};
export const tint = (c, R, j = 0.08) => { const k = 1 + (R() - 0.5) * j * 2; return [c[0] * k * (1 + (R() - 0.5) * j), c[1] * k * (1 + (R() - 0.5) * j), c[2] * k * (1 + (R() - 0.5) * j)]; };
