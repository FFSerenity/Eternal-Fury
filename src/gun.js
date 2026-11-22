// 噬魂机枪 — the easter-egg gatling: built from primitives (no model in the KayKit packs), coloured from a tiny palette texture
// so it goes through the same toon material / outline / icon path as the other weapons.
// Laid out like the crossbows: grip at the origin, barrels pointing +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CUSTOM_PROPS } from './assets.js';

const PAL = [0x4c4858, 0x25222d, 0xb46cff, 0xdcd1b6, 0x9d98ab, 0x6a3aa8, 0xe6c35a, 0x8ff5ff, 0x66704a, 0xb59c70, 0x8a7550];
const [METAL, DARK, GLOW, BONE, STEEL, DEEP, GOLD, , OLIVE, SAND, SAND2] = PAL.map((_, i) => i);
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

// ---------- 机枪骷髅's kit, in the skeleton's own model space (rest pose; faces +Z, its left is +X; chest bone at y 0.97) ----------
// a bandolier from the left shoulder to the right hip and a squat ammo pack on the back with a glowing drum
function strap(a, b, w, t, col) { // a thin box from point a to point b
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.BoxGeometry(w, t, d.length());
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize()), m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m); const uv = g.attributes.uv, u = (col + 0.5) / PAL.length; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); return g;
}
function kit() {
  const parts = [], A = [0.21, 1.13, 0.19], B = [-0.2, 0.58, 0.21];
  parts.push(strap(A, B, 0.1, 0.035, DARK));
  for (let i = 1; i < 8; i++) { const k = i / 8, p = A.map((v, j) => v + (B[j] - v) * k); parts.push(box(0.035, 0.1, 0.035, GOLD, p[0], p[1], p[2] + 0.03, 0, 0, -0.6)); } // rounds in the belt
  parts.push(box(0.5, 0.42, 0.26, OLIVE, 0, 0.86, -0.34), box(0.52, 0.06, 0.28, DARK, 0, 1.08, -0.34), box(0.52, 0.06, 0.28, DARK, 0, 0.66, -0.34)); // ammo pack
  parts.push(cylZ(0.12, 0.06, DEEP, 0, 0.86, -0.49, 16), cylZ(0.075, 0.07, GLOW, 0, 0.86, -0.5, 12));            // glowing drum on its back
  parts.push(strap([0.17, 1.12, -0.22], [0.17, 1.14, 0.12], 0.06, 0.03, DARK), strap([-0.17, 1.12, -0.22], [-0.17, 1.14, 0.12], 0.06, 0.03, DARK)); // shoulder straps
  return mergeGeometries(parts);
}
CUSTOM_PROPS.gunner_kit = () => entry(kit());
// a gunmetal helmet with a flared brim and purple goggles (the skull spans y 1.3–2.17, x ±0.44, z ±0.45 in rest pose)
function helmet() {
  const dome = part(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), OLIVE); dome.scale(0.53, 0.5, 0.56); dome.translate(0, 1.79, -0.02);
  const brim = part(new THREE.CylinderGeometry(0.57, 0.64, 0.07, 22), OLIVE, 0, 1.78, -0.02); brim.scale(1, 1, 1.04);
  const band = part(new THREE.CylinderGeometry(0.545, 0.55, 0.07, 22), DEEP, 0, 1.87, -0.02);
  const parts = [dome, brim, band];
  for (const sx of [-1, 1]) parts.push(cylZ(0.115, 0.06, DARK, sx * 0.15, 1.9, 0.53, 14), cylZ(0.085, 0.07, GLOW, sx * 0.15, 1.9, 0.55, 14)); // goggles
  parts.push(box(0.08, 0.05, 0.05, DARK, 0, 1.9, 0.54));                                                                   // goggle bridge
  return mergeGeometries(parts);
}
CUSTOM_PROPS.gunner_helmet = () => entry(helmet());

// ---------- 架起 / Dig In: a ring of sandbags in front and a tripod under the gun, in world units around the unit (faces +Z) ----------
function turretBase() {
  const parts = [], bag = (x, y, z, ry, col) => { const g = part(new THREE.SphereGeometry(1, 10, 6), col); g.scale(0.24, 0.12, 0.15); g.rotateY(ry); g.translate(x, y, z); return g; };
  for (let i = 0; i < 7; i++) { const a = -1.75 + i * (3.5 / 6), r = 0.62; parts.push(bag(Math.sin(a) * r, 0.11, Math.cos(a) * r, a + Math.PI / 2, i % 2 ? SAND : SAND2)); }
  for (let i = 0; i < 5; i++) { const a = -1.3 + i * (2.6 / 4), r = 0.6; parts.push(bag(Math.sin(a) * r, 0.3, Math.cos(a) * r, a + Math.PI / 2, i % 2 ? SAND2 : SAND)); }
  for (const a of [0, 2.2, -2.2]) parts.push(strap([0, 0.5, 0.3], [Math.sin(a) * 0.38, 0, 0.3 + Math.cos(a) * 0.38], 0.04, 0.04, DARK)); // tripod
  parts.push(cylZ(0.06, 0.12, METAL, 0, 0.5, 0.3, 10));
  return mergeGeometries(parts);
}
CUSTOM_PROPS.turret_base = () => entry(turretBase());
