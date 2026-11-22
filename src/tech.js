// 科技流 gear built from primitives (like gun.js): the 裂魂臼炮 mortar and the 炮手骷髅's kit.
// Same tiny-palette trick so it goes through the toon material / outline / icon path of every other weapon.
// Weapons are laid out like the crossbows: grip at the origin, muzzle pointing +Z (held like the gatling).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CUSTOM_PROPS } from './assets.js';

const PAL = [0x3b3742, 0x1f1c25, 0xb46cff, 0xdcd1b6, 0xb07a3a, 0xe0a85a, 0x6a3aa8, 0xff9a3a, 0x5a4636, 0x8a6a48, 0x9d98ab, 0x6ff0ff, 0x7dff9a, 0xd9962e];
const [IRON, DARK, GLOW, BONE, BRONZE, BRASS, DEEP, EMBER, LEATHER, LEATHER2, STEEL, CYAN, GREEN, OCHRE] = PAL.map((_, i) => i);
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

// ---------- 魂钢钻头: a drill on a motor housing, built along +Y like the axes (grip at the origin); the bit spins on its own mesh ----------
export const DRILL = { pivot: new THREE.Vector3(0, 0.4, 0) };
function drillBody() {
  const P = [];
  P.push(cylY(0.045, 0.045, 0.22, DARK, 0, 0.02, 0, 10), cylY(0.09, 0.09, 0.04, BRASS, 0, 0.13, 0, 14));          // grip + guard
  P.push(cylY(0.13, 0.12, 0.25, IRON, 0, 0.27, 0, 16), cylY(0.135, 0.135, 0.04, BRASS, 0, 0.385, 0, 16));          // motor housing, collar
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; P.push(box(0.03, 0.14, 0.03, GLOW, Math.cos(a) * 0.125, 0.27, Math.sin(a) * 0.125)); } // soul vents
  P.push(box(0.05, 0.08, 0.06, BONE, 0, 0.27, 0.14), box(0.02, 0.02, 0.015, DARK, 0.012, 0.285, 0.172), box(0.02, 0.02, 0.015, DARK, -0.012, 0.285, 0.172)); // little skull badge
  return mergeGeometries(P);
}
function drillBit() { // around its own axis (Y), from 0 (at the collar) to the tip
  const P = [part(new THREE.CylinderGeometry(0.0, 0.115, 0.62, 16), STEEL, 0, 0.31, 0)];
  for (let i = 0; i < 16; i++) { const k = i / 16, a = k * Math.PI * 5, r = 0.112 * (1 - k) + 0.006, y = 0.03 + k * 0.56; // a spiral flute up the cone
    P.push(box(0.05, 0.035, 0.03, i % 2 ? BRONZE : DARK, Math.cos(a) * r, y, Math.sin(a) * r, 0.5, -a, 0)); }
  P.push(cylY(0.12, 0.12, 0.03, GLOW, 0, 0.02, 0, 16));
  return mergeGeometries(P);
}
CUSTOM_PROPS.drill_body = () => entry(drillBody());
CUSTOM_PROPS.drill_bit = () => ({ ...entry(drillBit()), pivot: DRILL.pivot.clone() });
CUSTOM_PROPS.drill = () => { const b = drillBit(); b.translate(DRILL.pivot.x, DRILL.pivot.y, DRILL.pivot.z); return entry(mergeGeometries([drillBody(), b])); };

// ---------- 机甲骷髅's armour (warrior rest pose: chest bone y 0.97, arms out along ±X at y 1.11 — upper arm 0.21–0.45, forearm 0.45–0.71,
// hand 0.79; shins x ±0.17, y 0.15–0.29). One piece per bone so the plates follow the animation; kept close to the body (not much bigger) ----------
function mechChest() {
  const P = [];
  P.push(box(0.72, 0.44, 0.64, STEEL, 0, 1.0, 0), box(0.56, 0.3, 0.06, IRON, 0, 1.02, 0.33), box(0.74, 0.05, 0.66, BRASS, 0, 1.2, 0));                          // shell + front plate
  P.push(cylZ(0.11, 0.11, 0.05, DEEP, 0, 1.03, 0.36, 16), cylZ(0.075, 0.075, 0.06, GLOW, 0, 1.03, 0.37, 14));            // soul reactor in the chest
  for (const x of [-0.2, 0.2]) P.push(box(0.12, 0.04, 0.04, GLOW, x, 1.13, 0.33));                                       // vent slits
  P.push(box(0.46, 0.07, 0.46, DARK, 0, 1.235, 0), box(0.6, 0.09, 0.56, DARK, 0, 0.75, 0), box(0.62, 0.04, 0.58, BRASS, 0, 0.8, 0)); // collar, belt, trim
  P.push(box(0.56, 0.5, 0.22, IRON, 0, 0.98, -0.41), box(0.58, 0.05, 0.24, BRASS, 0, 1.2, -0.41), box(0.46, 0.06, 0.04, GLOW, 0, 1.1, -0.53), box(0.06, 0.3, 0.04, GLOW, 0, 0.95, -0.53));                       // backpack + glow strip
  for (const x of [-0.15, 0.15]) P.push(cylY(0.11, 0.08, 0.24, IRON, x, 0.72, -0.43, 12), cylY(0.075, 0.075, 0.03, EMBER, x, 0.595, -0.43, 12)); // thrusters, glowing nozzles
  return mergeGeometries(P);
}
function mechPad(s) { // pauldron on the upper arm (s: +1 left, −1 right)
  const pad = part(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), STEEL); pad.scale(0.25, 0.18, 0.29); pad.translate(s * 0.31, 1.18, 0);
  return mergeGeometries([pad, box(0.42, 0.04, 0.52, BRASS, s * 0.31, 1.18, 0), box(0.18, 0.035, 0.035, GLOW, s * 0.31, 1.34, 0.13), box(0.18, 0.035, 0.035, GLOW, s * 0.31, 1.34, -0.13)]);
}
function mechArm(s) { // forearm gauntlet with two piston rods
  return mergeGeometries([box(0.25, 0.19, 0.2, STEEL, s * 0.59, 1.107, 0), box(0.04, 0.2, 0.21, BRASS, s * 0.47, 1.107, 0),
    box(0.24, 0.03, 0.03, STEEL, s * 0.59, 1.215, 0.06), box(0.24, 0.03, 0.03, STEEL, s * 0.59, 1.215, -0.06), box(0.08, 0.04, 0.04, GLOW, s * 0.62, 1.107, 0.105)]);
}
function mechLeg(s) { // shin guard, knee cap and a boot plate
  return mergeGeometries([box(0.17, 0.2, 0.07, STEEL, s * 0.171, 0.22, 0.1), box(0.15, 0.08, 0.08, BRASS, s * 0.171, 0.33, 0.1), box(0.19, 0.07, 0.3, DARK, s * 0.171, 0.06, 0.06)]);
}
// the warrior's horned helmet is swapped for this one (skull: x ±0.42, y 1.18–2.17, z ±0.46; eyes around y 1.65): a steel dome down to the brow,
// a brow plate with a glowing visor line, a crest fin, sensor "ears" and a short antenna
function mechHelmet() {
  const P = [], y0 = 1.83;
  const dome = part(new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), STEEL); dome.scale(0.5, 0.42, 0.52); dome.translate(0, y0, -0.02); P.push(dome);
  const rim = part(new THREE.CylinderGeometry(0.515, 0.515, 0.06, 20, 1, true), BRASS, 0, y0 + 0.01, -0.02); rim.scale(1, 1, 1.04); P.push(rim);
  P.push(box(0.56, 0.1, 0.1, IRON, 0, y0 + 0.03, 0.45), box(0.44, 0.03, 0.04, GLOW, 0, y0 - 0.02, 0.5));                  // brow plate + visor line
  P.push(box(0.07, 0.11, 0.56, IRON, 0, y0 + 0.4, -0.04), box(0.075, 0.03, 0.2, GLOW, 0, y0 + 0.45, 0.1));                 // crest fin, glowing seam
  P.push(box(0.66, 0.34, 0.09, STEEL, 0, y0 - 0.12, -0.47));                                                              // back plate over the nape
  for (const s of [1, -1]) P.push(part(new THREE.CylinderGeometry(0.11, 0.12, 0.1, 14), DARK, s * 0.52, y0 - 0.06, -0.02, 0, 0, Math.PI / 2),
    part(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 12), GLOW, s * 0.58, y0 - 0.06, -0.02, 0, 0, Math.PI / 2));     // sensor ears
  P.push(cylY(0.018, 0.012, 0.32, STEEL, 0.4, y0 + 0.36, -0.2, 6), ball(0.04, GLOW, 0.4, y0 + 0.53, -0.2));                   // antenna
  return mergeGeometries(P);
}
CUSTOM_PROPS.mech_helmet = () => entry(mechHelmet());
CUSTOM_PROPS.mech_chest = () => entry(mechChest());
CUSTOM_PROPS.mech_pad_l = () => entry(mechPad(1)); CUSTOM_PROPS.mech_pad_r = () => entry(mechPad(-1));
CUSTOM_PROPS.mech_arm_l = () => entry(mechArm(1)); CUSTOM_PROPS.mech_arm_r = () => entry(mechArm(-1));
CUSTOM_PROPS.mech_leg_l = () => entry(mechLeg(1)); CUSTOM_PROPS.mech_leg_r = () => entry(mechLeg(-1));

// ---------- 机械师骷髅: the 魂钢指挥杖 command rod, a hard hat with goggles and a headset, a drone dock on the back; and its skull drones ----------
// the rod is built along +Y like the staffs (held in the middle); a glowing core floats in a three-pronged head
export const ROD = { tip: new THREE.Vector3(0, 1.13, 0) };
function cmdRod() {
  const P = [];
  P.push(cylY(0.035, 0.035, 1.62, DARK, 0, 0.12, 0, 8), part(new THREE.ConeGeometry(0.06, 0.12, 8).rotateX(Math.PI), BRASS, 0, -0.74, 0));  // shaft + foot
  for (const y of [-0.06, 0.06]) P.push(cylY(0.05, 0.05, 0.07, LEATHER2, 0, y, 0, 8));                                                     // grip wraps
  P.push(box(0.12, 0.2, 0.1, IRON, 0, 0.3, 0.02), box(0.08, 0.1, 0.02, CYAN, 0, 0.33, 0.075), box(0.025, 0.025, 0.02, EMBER, -0.03, 0.235, 0.075), box(0.025, 0.025, 0.02, GREEN, 0.03, 0.235, 0.075)); // control box: screen + buttons
  P.push(cylY(0.07, 0.06, 0.08, BRASS, 0, 0.93, 0, 12));                                                                                   // collar
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; P.push(box(0.035, 0.24, 0.035, STEEL, Math.cos(a) * 0.075, 1.07, Math.sin(a) * 0.075, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35)); } // prongs
  P.push(ball(0.075, CYAN, 0, 1.13, 0));                                                                                                    // the core
  const rg = part(new THREE.TorusGeometry(0.12, 0.014, 6, 18), BRASS, 0, 1.13, 0, 0.5, 0, 0.3); P.push(rg);                                // a ring around it
  return mergeGeometries(P);
}
CUSTOM_PROPS.cmdrod = () => ({ ...entry(cmdRod()), tip: ROD.tip.clone() });
// sk_mage rest pose: same skull as the warrior (x ±0.44, y 1.19–2.17, z ±0.46), chest bone y 0.97, shoulders y 1.05–1.42, belly y 0.55–1.03;
// the wizard hat is swapped for an ochre hard hat with a brim, goggles strapped around it, a headset on one side and an antenna on the other
function engHat() {
  const P = [], y0 = 1.84;
  const dome = part(new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), OCHRE); dome.scale(0.5, 0.4, 0.52); dome.translate(0, y0, 0); P.push(dome);
  P.push(box(0.07, 0.05, 0.62, BRASS, 0, y0 + 0.39, -0.02), box(0.76, 0.035, 0.26, OCHRE, 0, y0 + 0.01, 0.46), box(1.02, 0.035, 0.035, BRASS, 0, y0 + 0.01, 0.0)); // ridge, brim, rim line
  const band = part(new THREE.CylinderGeometry(0.47, 0.47, 0.07, 22, 1, true), LEATHER, 0, y0 + 0.16, 0); band.scale(1, 1, 1.04); P.push(band);
  for (const x of [-0.15, 0.15]) P.push(cylZ(0.105, 0.105, 0.07, BRASS, x, y0 + 0.17, 0.46, 14), cylZ(0.078, 0.078, 0.08, CYAN, x, y0 + 0.17, 0.465, 12)); // goggles
  P.push(box(0.06, 0.04, 0.05, DARK, 0, y0 + 0.17, 0.48));
  P.push(part(new THREE.CylinderGeometry(0.12, 0.12, 0.09, 14), DARK, 0.47, y0 - 0.12, 0, 0, 0, Math.PI / 2), strap([0.5, y0 - 0.16, 0.06], [0.28, y0 - 0.3, 0.44], 0.03, 0.03, STEEL), ball(0.045, DARK, 0.27, y0 - 0.31, 0.45)); // headset + mic
  P.push(cylY(0.02, 0.012, 0.36, STEEL, -0.42, y0 + 0.28, -0.12, 6), ball(0.04, CYAN, -0.42, y0 + 0.47, -0.12));                          // antenna
  return mergeGeometries(P);
}
// a drone dock on the back (a dish antenna, status lights, two canisters), chest straps, a tool belt with a wrench
function engPack() {
  const P = [], z = -0.42;
  P.push(box(0.5, 0.44, 0.16, IRON, 0, 1.15, z), box(0.54, 0.05, 0.2, BRASS, 0, 1.38, z), box(0.4, 0.04, 0.04, CYAN, 0, 1.24, z - 0.09));   // dock + top rail + light strip
  for (const x of [-0.29, 0.29]) P.push(cylY(0.07, 0.07, 0.34, STEEL, x, 1.08, z + 0.02, 10), cylY(0.075, 0.075, 0.03, GREEN, x, 1.2, z + 0.02, 10)); // canisters
  P.push(cylY(0.02, 0.02, 0.2, DARK, 0.12, 1.48, z, 6), part(new THREE.ConeGeometry(0.15, 0.08, 14, 1, true).rotateX(Math.PI), STEEL, 0.12, 1.6, z, -0.5, 0, 0), ball(0.03, CYAN, 0.12, 1.6, z + 0.05)); // dish
  P.push(strap([0.2, 1.4, -0.3], [0.17, 1.1, 0.33], 0.07, 0.03, LEATHER2), strap([-0.2, 1.4, -0.3], [-0.17, 1.1, 0.33], 0.07, 0.03, LEATHER2)); // shoulder straps
  P.push(box(0.8, 0.08, 0.78, LEATHER, 0, 0.66, 0.03), box(0.12, 0.1, 0.06, BRASS, 0, 0.66, 0.43));                                       // belt + buckle
  P.push(box(0.12, 0.14, 0.1, LEATHER2, 0.34, 0.58, 0.2), box(0.03, 0.3, 0.03, STEEL, -0.42, 0.52, 0.12), box(0.1, 0.06, 0.03, STEEL, -0.42, 0.68, 0.12)); // pouch, wrench
  return mergeGeometries(P);
}
function engPad() { // wrist control pad on the left forearm (arm along +X at y 1.11)
  return mergeGeometries([box(0.22, 0.09, 0.18, STEEL, 0.6, 1.16, 0), box(0.15, 0.02, 0.12, CYAN, 0.6, 1.21, 0), box(0.05, 0.11, 0.2, BRASS, 0.49, 1.15, 0)]);
}
CUSTOM_PROPS.eng_hat = () => entry(engHat());
CUSTOM_PROPS.eng_pack = () => entry(engPack());
CUSTOM_PROPS.eng_pad = () => entry(engPad());
// skull drones (world size, ~0.4 wide): a little bone skull with one big lens, rotor arms on both sides; the repair drone is green with a wrench arm
function drone(rep) {
  const P = [], L = rep ? GREEN : CYAN;
  P.push(ball(0.11, BONE, 0, 0, 0, 1, 0.92, 1.05), box(0.13, 0.06, 0.08, BONE, 0, -0.08, 0.05));                                          // skull + jaw
  P.push(cylZ(0.065, 0.065, 0.05, DARK, 0, 0.01, 0.1, 12), cylZ(0.05, 0.05, 0.05, L, 0, 0.01, 0.115, 12), box(0.1, 0.02, 0.03, L, 0, 0.1, 0.06)); // the lens, a light strip on the crown
  for (const s of [1, -1]) P.push(box(0.14, 0.025, 0.04, STEEL, s * 0.16, 0.03, -0.01), cylY(0.025, 0.025, 0.05, DARK, s * 0.23, 0.06, -0.01, 8),
    part(new THREE.TorusGeometry(0.075, 0.01, 4, 14).rotateX(Math.PI / 2), STEEL, s * 0.23, 0.09, -0.01), box(0.14, 0.008, 0.022, BONE, s * 0.23, 0.088, -0.01, 0, 0.5, 0), box(0.14, 0.008, 0.022, BONE, s * 0.23, 0.088, -0.01, 0, 2.07, 0)); // rotors
  P.push(cylY(0.008, 0.008, 0.1, STEEL, 0.04, 0.14, -0.04, 4), ball(0.018, L, 0.04, 0.19, -0.04));                                        // antenna
  if (rep) P.push(box(0.025, 0.12, 0.025, STEEL, 0, -0.15, 0.02), box(0.08, 0.03, 0.03, STEEL, 0, -0.21, 0.02), box(0.06, 0.02, 0.02, GREEN, 0, 0.02, -0.11), box(0.02, 0.06, 0.02, GREEN, 0, 0.02, -0.11)); // wrench arm, cross on the back
  return mergeGeometries(P);
}
CUSTOM_PROPS.drone = () => entry(drone(false));
CUSTOM_PROPS.drone_rep = () => entry(drone(true));
