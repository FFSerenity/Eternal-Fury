// 噬魂机枪 — the easter-egg gatling: built from primitives (no model in the KayKit packs), coloured from a tiny palette texture
// so it goes through the same toon material / outline / icon path as the other weapons.
// Laid out like the crossbows: grip at the origin, barrels pointing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CUSTOM_PROPS } from './assets.js';

const PAL = [0x4c4858, 0x25222d, 0xb46cff, 0xdcd1b6, 0x9d98ab, 0x6a3aa8, 0xe6c35a, 0x8ff5ff];
const [METAL, DARK, GLOW, BONE, STEEL, DEEP, GOLD] = PAL.map((_, i) => i);
let tex = null;
function palette() {
  if (tex) return tex; const d = new Uint8Array(PAL.length * 4);
  PAL.forEach((c, i) => { d[i * 4] = c >> 16 & 255; d[i * 4 + 1] = c >> 8 & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255; });
  tex = new THREE.DataTexture(d, PAL.length, 1); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true; return tex;
}
// a primitive, moved into place and painted one palette colour
function part(g, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m); const uv = g.attributes.uv, u = (col + 0.5) / PAL.length; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); return g;
}
const box = (w, h, d, col, x, y, z, rx, ry, rz) => part(new THREE.BoxGeometry(w, h, d), col, x, y, z, rx, ry, rz);
const cylZ = (r, len, col, x, y, z, seg = 10) => part(new THREE.CylinderGeometry(r, r, len, seg), col, x, y, z, Math.PI / 2, 0, 0); // axis along Z
const cylX = (r, len, col, x, y, z, seg = 14) => part(new THREE.CylinderGeometry(r, r, len, seg), col, x, y, z, 0, 0, Math.PI / 2); // axis along X

export const GUN = { pivot: new THREE.Vector3(0, 0.13, 0.5), muzzle: 0.66 }; // barrel spin axis (along Z) starts here; muzzle this far ahead
function body() {
  return mergeGeometries([
    box(0.22, 0.24, 0.62, METAL, 0, 0.13, 0.2),            // receiver
    box(0.235, 0.05, 0.5, DARK, 0, 0.02, 0.2),              // lower rail
    box(0.012, 0.045, 0.46, GLOW, 0.116, 0.16, 0.2), box(0.012, 0.045, 0.46, GLOW, -0.116, 0.16, 0.2), // glowing side strips
    box(0.06, 0.06, 0.34, DARK, 0, 0.33, 0.2), box(0.05, 0.08, 0.05, DARK, 0, 0.27, 0.07), box(0.05, 0.08, 0.05, DARK, 0, 0.27, 0.33), // carry handle
    box(0.15, 0.2, 0.32, BONE, 0, 0.08, -0.25), box(0.17, 0.24, 0.06, BONE, 0, 0.07, -0.43),    // bone stock
    box(0.09, 0.22, 0.1, DARK, 0, -0.08, 0.02, -0.25), box(0.03, 0.06, 0.09, STEEL, 0, -0.02, 0.1), // grip + trigger
    cylX(0.15, 0.1, DEEP, -0.17, 0.02, 0.28, 16), cylX(0.1, 0.11, GLOW, -0.17, 0.02, 0.28, 12),   // ammo drum, glowing core
    box(0.07, 0.04, 0.2, GOLD, -0.12, -0.05, 0.28),          // belt feed
    cylZ(0.12, 0.06, DARK, 0, 0.13, 0.48, 16),              // front collar the barrels spin in
  ]);
}
function barrel() {
  const parts = [], n = 6, r = 0.07, L = GUN.muzzle;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; parts.push(cylZ(0.024, L, STEEL, Math.cos(a) * r, Math.sin(a) * r, L / 2, 8)); }
  parts.push(cylZ(0.03, L * 0.95, DARK, 0, 0, L * 0.48, 8), cylZ(0.11, 0.035, DARK, 0, 0, 0.22, 14), cylZ(0.11, 0.035, DARK, 0, 0, L - 0.05, 14), cylZ(0.105, 0.02, GLOW, 0, 0, L - 0.015, 14));
  return mergeGeometries(parts);
}
const entry = geo => { geo.computeBoundingBox(); geo.computeBoundingSphere(); return { geo, map: palette(), box: geo.boundingBox }; };
CUSTOM_PROPS.gatling_body = () => entry(body());
CUSTOM_PROPS.gatling_barrel = () => ({ ...entry(barrel()), pivot: GUN.pivot.clone(), muzzle: GUN.muzzle });
CUSTOM_PROPS.gatling = () => { const b = barrel(); b.translate(GUN.pivot.x, GUN.pivot.y, GUN.pivot.z); return entry(mergeGeometries([body(), b])); };
