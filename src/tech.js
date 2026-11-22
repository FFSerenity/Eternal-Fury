// 科技流 gear built from primitives (like gun.js): the 裂魂臼炮 mortar and the 炮手骷髅's kit.
// Same tiny-palette trick so it goes through the toon material / outline / icon path of every other weapon.
// Weapons are laid out like the crossbows: grip at the origin, muzzle pointing +Z (held like the gatling).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CUSTOM_PROPS } from './assets.js';

const PAL = [0x3b3742, 0x1f1c25, 0xb46cff, 0xdcd1b6, 0xb07a3a, 0xe0a85a, 0x6a3aa8, 0xff9a3a, 0x5a4636, 0x8a6a48, 0x9d98ab];
const [IRON, DARK, GLOW, BONE, BRONZE, BRASS, DEEP, EMBER, LEATHER, LEATHER2, STEEL] = PAL.map((_, i) => i);
let tex = null;
function palette() {
  if (tex) return tex; const d = new Uint8Array(PAL.length * 4);
  PAL.forEach((c, i) => { d[i * 4] = c >> 16 & 255; d[i * 4 + 1] = c >> 8 & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255; });
  tex = new THREE.DataTexture(d, PAL.length, 1); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true; return tex;
}
function part(g, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  const uv = g.attributes.uv, u = (col + 0.5) / PAL.length; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); return g;
}
const box = (w, h, d, col, x, y, z, rx, ry, rz) => part(new THREE.BoxGeometry(w, h, d), col, x, y, z, rx, ry, rz);
const cylZ = (r0, r1, len, col, x, y, z, seg = 14) => part(new THREE.CylinderGeometry(r1, r0, len, seg), col, x, y, z, Math.PI / 2, 0, 0); // axis along Z, r0 at -Z end, r1 at +Z end
const cylY = (r0, r1, len, col, x, y, z, seg = 12) => part(new THREE.CylinderGeometry(r1, r0, len, seg), col, x, y, z);
const ball = (r, col, x, y, z, sx = 1, sy = 1, sz = 1) => { const g = part(new THREE.SphereGeometry(r, 12, 8), col); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
function strap(a, b, w, t, col) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.BoxGeometry(w, t, d.length());
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), new THREE.Vector3(1, 1, 1)));
  const uv = g.attributes.uv, u = (col + 0.5) / PAL.length; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); return g; }
const entry = geo => { geo.computeBoundingBox(); geo.computeBoundingSphere(); return { geo, map: palette(), box: geo.boundingBox }; };

// ---------- 裂魂臼炮: a squat bronze mortar on a bone stock; purple soul-fire glows through vents in the barrel ----------
export const MORTAR = { muzzle: new THREE.Vector3(0, 0.15, 0.86) };
function mortar() {
  const y = 0.15, P = [];
  P.push(cylZ(0.15, 0.17, 0.62, BRONZE, 0, y, 0.5, 18));                    // barrel, flaring a little toward the mouth
  P.push(cylZ(0.2, 0.21, 0.09, BRASS, 0, y, 0.8, 18), cylZ(0.13, 0.13, 0.1, DARK, 0, y, 0.82, 16)); // muzzle ring + dark bore
  for (const z of [0.3, 0.62]) P.push(cylZ(0.175, 0.175, 0.05, BRASS, 0, y, z, 18)); // reinforcing bands
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; P.push(box(0.035, 0.035, 0.16, GLOW, Math.cos(a) * 0.162, y + Math.sin(a) * 0.162, 0.46)); } // soul vents
  P.push(cylZ(0.18, 0.15, 0.2, IRON, 0, y, 0.12, 16), ball(0.16, IRON, 0, y, 0.02, 1, 1, 0.8)); // breech
  P.push(box(0.11, 0.07, 0.07, BONE, 0, y + 0.19, 0.05), box(0.03, 0.025, 0.02, DARK, 0.025, y + 0.19, 0.088), box(0.03, 0.025, 0.02, DARK, -0.025, y + 0.19, 0.088)); // a little skull on the breech
  P.push(box(0.05, 0.06, 0.16, IRON, 0, y + 0.2, 0.42), box(0.03, 0.04, 0.03, GLOW, 0, y + 0.235, 0.5));                        // sight with a glowing bead
  P.push(box(0.09, 0.2, 0.1, DARK, 0, -0.06, 0.02, -0.25), box(0.03, 0.06, 0.09, STEEL, 0, 0.0, 0.1));                         // grip + trigger
  P.push(box(0.13, 0.17, 0.3, BONE, 0, 0.1, -0.24), box(0.16, 0.24, 0.07, LEATHER, 0, 0.09, -0.41));                           // bone stock + leather butt pad
  P.push(box(0.07, 0.09, 0.22, BRASS, 0, y - 0.19, 0.5), cylZ(0.05, 0.05, 0.04, EMBER, 0, y - 0.2, 0.62, 10));                 // fore-grip with an ember lamp
  return mergeGeometries(P);
}
CUSTOM_PROPS.mortar = () => ({ ...entry(mortar()), muzzle: MORTAR.muzzle.clone() });

// ---------- 炮手骷髅's kit (skeleton model space, rest pose: faces +Z, its left is +X, chest bone at y 0.97) ----------
// a rack of three shells on the back, a bandolier of small shells, a bronze pauldron on the left shoulder
function bomberPack() {
  const P = [], z = -0.36;
  P.push(box(0.56, 0.5, 0.12, LEATHER, 0, 0.86, z + 0.05), box(0.58, 0.05, 0.16, DARK, 0, 1.12, z + 0.05), box(0.58, 0.05, 0.16, DARK, 0, 0.6, z + 0.05)); // rack frame
  for (const x of [-0.18, 0, 0.18]) { P.push(cylY(0.085, 0.085, 0.42, BRONZE, x, 0.88, z - 0.06, 12), ball(0.085, BRASS, x, 1.09, z - 0.06, 1, 1.5, 1), cylY(0.09, 0.09, 0.04, GLOW, x, 0.98, z - 0.06, 12)); } // three shells, glowing bands
  P.push(strap([0.2, 1.13, 0.17], [-0.2, 0.6, 0.2], 0.1, 0.035, LEATHER2));                                          // bandolier
  for (let i = 1; i < 7; i++) { const k = i / 7, p = [0.2 - 0.4 * k, 1.13 - 0.53 * k, 0.17 + 0.03 * k]; P.push(cylY(0.03, 0.03, 0.09, BRASS, p[0], p[1], p[2] + 0.035, 8)); } // little shells in it
  P.push(strap([0.17, 1.12, -0.25], [0.17, 1.14, 0.12], 0.06, 0.03, DARK), strap([-0.17, 1.12, -0.25], [-0.17, 1.14, 0.12], 0.06, 0.03, DARK)); // shoulder straps
  const pad = part(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), BRONZE); pad.scale(0.2, 0.13, 0.22); pad.translate(0.36, 1.12, 0); // pauldron
  P.push(pad, box(0.05, 0.04, 0.3, BRASS, 0.36, 1.2, 0));
  return mergeGeometries(P);
}
CUSTOM_PROPS.bomber_pack = () => entry(bomberPack());
// brass goggles strapped across the forehead over the hood (one big orange targeting lens), a leather band around
function bomberGoggles() {
  const P = [], y = 1.93, z = 0.5;
  const band = part(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 24, 1, true), LEATHER2, 0, y, 0); band.scale(1, 1, 1.02); P.push(band);
  P.push(cylZ(0.12, 0.12, 0.08, BRASS, 0.16, y, z, 14), cylZ(0.09, 0.09, 0.09, EMBER, 0.16, y, z + 0.01, 14)); // big targeting lens (its left eye)
  P.push(cylZ(0.09, 0.09, 0.07, BRASS, -0.15, y, z - 0.01, 12), cylZ(0.065, 0.065, 0.08, GLOW, -0.15, y, z, 12)); // small soul lens
  P.push(box(0.08, 0.04, 0.05, DARK, 0, y, z + 0.01), box(0.03, 0.12, 0.03, BRASS, 0.3, y + 0.04, z - 0.06, 0, 0, -0.5));    // bridge + a range-finder arm
  return mergeGeometries(P);
}
CUSTOM_PROPS.bomber_goggles = () => entry(bomberGoggles());
