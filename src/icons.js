// A small second renderer: item icons and summon portraits rendered from the 3D models (same look on every device,
// unlike emoji), plus the live paperdoll view used by the equipment panel.
import * as THREE from 'three';
import { WEAPONS, itemBase, TYPES, TECH, makeTech, techOf } from './data.js';
import { makeUnitMesh, propGeo, propMat, play, A, heroWeaponPose, plumeTier, soulTier } from './assets.js';
import { SH } from './gfx.js';

export let R = null;
let iconScene, iconCam;
const ICON = {}, POR = {};
export function initR() {
  if (R) return R;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.outputColorSpace = THREE.LinearSRGBColorSpace; R.setClearColor(0x000000, 0); R.setPixelRatio(1);
  iconScene = new THREE.Scene(); iconCam = new THREE.PerspectiveCamera(26, 1, 0.01, 60);
  return R;
}
// studio lighting: the shared shader uniforms are swapped in for the render and restored afterwards
export function lit(fn) {
  const L = SH.uLight.value.clone(), r = SH.uLightR.value, a = SH.uAmb.value.clone(), tl = SH.uTL.value.map(v => v.w);
  SH.uLight.value.set(0.8, 2.5, 3); SH.uLightR.value = 60; SH.uAmb.value.setRGB(0.5, 0.5, 0.6); SH.uTL.value.forEach(v => { v.w = 0; });
  try { fn(); } finally { SH.uLight.value.copy(L); SH.uLightR.value = r; SH.uAmb.value.copy(a); SH.uTL.value.forEach((v, i) => { v.w = tl[i]; }); }
}
function shot(obj, size) { initR(); R.setPixelRatio(1); R.setSize(size, size, false); iconScene.clear(); iconScene.add(obj); lit(() => R.render(iconScene, iconCam)); const url = R.domElement.toDataURL(); iconScene.clear(); return url; }
// the Sentinel's two blades would read alike: the greatsword shown flat (its broad face to the camera) leaning one way, the sword turned
// and leaning the other way, a little smaller. [rot x, y, z, frame size ÷ length]
const ICON_ROT = { hw_greatsword: [0.15, 0, -0.78, 0.92], hw_sword: [0.15, 0.9, 0.78, 1.18] };
// all icons are made once, right after the models are loaded
export function makeIcons() {
  initR(); const models = new Set();
  for (const t in WEAPONS) for (const b of WEAPONS[t].bases) models.add(b.model);
  for (const m of ['sk_shield_large', 'shield_round', 'shield_square']) models.add(m);
  if (A.heroWeap.sword) for (const m of ['hw_greatsword', 'hw_sword', 'hw_shield']) models.add(m); // 魂契: the Sentinel's gear
  for (const m of models) { const pg = propGeo(m); if (!pg) continue;
    const g = new THREE.Group(), mesh = new THREE.Mesh(pg.geo, propMat(pg.map)), c = pg.box.getCenter(new THREE.Vector3()), sz = pg.box.getSize(new THREE.Vector3());
    mesh.position.copy(c).negate(); g.add(mesh); const shield = sz.y < sz.x * 1.4 && sz.z < sz.x, R = (globalThis.__iconRot || {})[m] || ICON_ROT[m];
    if (R) g.rotation.set(R[0], R[1], R[2]); else g.rotation.set(shield ? 0.25 : 0.2, shield ? 0.5 : 0.9, shield ? 0 : -0.78);
    const span = Math.max(sz.x, sz.y, sz.z) * (R ? R[3] : shield ? 1.05 : 0.95); iconCam.position.set(0, 0, span / (2 * Math.tan(13 * Math.PI / 180))); iconCam.lookAt(0, 0, 0);
    ICON[m] = shot(g, 112); }
  // summon portraits: head and shoulders, turned a little toward the light
  const techs = Object.keys(TECH).map(u => [TECH[u].key, TECH[u].type, u]);
  for (const k of [...Object.keys(TYPES), ...techs.map(t => t[0])]) { const tk = techs.find(t => t[0] === k), m = makeUnitMesh(tk ? tk[1] : k, tk ? { gear: { w: makeTech(tk[2], 0) } } : {});
    play(m, m.gun || m.muz ? '2H_Ranged_Aiming' : k === 'shaman' || k === 'engineer' ? 'Idle' : 'Idle_Combat', {}); m.mixer.update(0.3); m.root.rotation.y = 0.45; m.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m.root), h = box.max.y - box.min.y, top = box.max.y, fy = top - h * 0.29;
    iconCam.position.set(0, fy + h * 0.06, h * 1.38); iconCam.lookAt(0, fy, 0); POR[k] = shot(m.root, 128); }
}
export const itemIconURL = it => ICON[itemBase(it).model] || '';
// 魂契: a close-up of the Bone Sentinel's head (the portrait on its HUD card): the helmet with its crest in the 战魂 colour and the whole
// skull face, eyes lit; remade only when the crest or the soul light changes
const HPV = { k: '', url: '' }, HEAD_CAM = [0.12, 0.06, 1.12, 0.42]; // look-at above the head bone, camera above that, distance, its turn
export function heroHeadURL(en, fury = 0) {
  const g = en.gear || {}, key = [plumeTier(fury), soulTier(fury), String(globalThis.__headCam || '')].join(':'); if (HPV.k === key) return HPV.url;
  if (!A.hero) return ''; initR(); const m = makeUnitMesh('brute', { hero: true, wset: en.wset, gear: g });
  const C = globalThis.__headCam || HEAD_CAM; play(m, 'Stand', {}); m.mixer.update(0.4); m.root.rotation.y = C[3]; m.root.updateMatrixWorld(true);
  heroWeaponPose({ mesh: m, fury, dead: false, spawnT: 0, x: 0, z: 0 }, 0.016, null);
  for (const gl of m.glows) { gl.scale.multiplyScalar(0.32); gl.material.opacity *= 0.7; } // the eye glow is sized to carry across a room: up close it would hide the face
  m.root.updateMatrixWorld(true);
  const hd = m.model.getObjectByName('mixamorigHead') || m.model.getObjectByName('mixamorig:Head'), t = hd.getWorldPosition(new THREE.Vector3());
  t.y += C[0]; iconCam.position.set(t.x, t.y + C[1], t.z + C[2]); iconCam.lookAt(t); HPV.url = shot(m.root, 128); HPV.k = key;
  m.root.traverse(o => { if (o.material) for (const mm of [].concat(o.material)) mm.dispose(); }); return HPV.url;
}
export const portraitURL = type => POR[type] || '';
// pass a crypt entry instead of a type to get the gunner's own portrait when it holds the gatling
export const portrait = (type, cls = '') => { if (type && typeof type === 'object') type = techOf(type) ? techOf(type).key : type.type; return POR[type] ? `<img class="por ${cls}" src="${POR[type]}" draggable="false">` : TYPES[type].icon; };
