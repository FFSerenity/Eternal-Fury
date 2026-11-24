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
// all icons are made once, right after the models are loaded
export function makeIcons() {
  initR(); const models = new Set();
  for (const t in WEAPONS) for (const b of WEAPONS[t].bases) models.add(b.model);
  for (const m of ['sk_shield_large', 'shield_round', 'shield_square']) models.add(m);
  if (A.heroWeap.sword) for (const m of ['hw_greatsword', 'hw_sword', 'hw_shield']) models.add(m); // 魂契: the Sentinel's gear
  for (const m of models) { const pg = propGeo(m); if (!pg) continue;
    const g = new THREE.Group(), mesh = new THREE.Mesh(pg.geo, propMat(pg.map)), c = pg.box.getCenter(new THREE.Vector3()), sz = pg.box.getSize(new THREE.Vector3());
    mesh.position.copy(c).negate(); g.add(mesh); const shield = sz.y < sz.x * 1.4 && sz.z < sz.x; g.rotation.set(shield ? 0.25 : 0.2, shield ? 0.5 : 0.9, shield ? 0 : -0.78);
    const span = Math.max(sz.x, sz.y, sz.z) * (shield ? 1.05 : 0.95); iconCam.position.set(0, 0, span / (2 * Math.tan(13 * Math.PI / 180))); iconCam.lookAt(0, 0, 0);
    ICON[m] = shot(g, 112); }
  // summon portraits: head and shoulders, turned a little toward the light
  const techs = Object.keys(TECH).map(u => [TECH[u].key, TECH[u].type, u]);
  for (const k of [...Object.keys(TYPES), ...techs.map(t => t[0])]) { const tk = techs.find(t => t[0] === k), m = makeUnitMesh(tk ? tk[1] : k, tk ? { gear: { w: makeTech(tk[2], 0) } } : {});
    play(m, m.gun || m.muz ? '2H_Ranged_Aiming' : k === 'shaman' || k === 'engineer' ? 'Idle' : 'Idle_Combat', {}); m.mixer.update(0.3); m.root.rotation.y = 0.45; m.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m.root), h = box.max.y - box.min.y, top = box.max.y, fy = top - h * 0.29;
    iconCam.position.set(0, fy + h * 0.06, h * 1.38); iconCam.lookAt(0, fy, 0); POR[k] = shot(m.root, 128); }
}
export const itemIconURL = it => ICON[itemBase(it).model] || '';
// 魂契: a full-body snapshot of the Bone Sentinel in its gear, crest and soul light (the paperdoll on its HUD card); remade only when
// one of those changes
const HPV = { k: '', url: '' };
export function heroPreviewURL(en, fury = 0) {
  const g = en.gear || {}, key = [en.wset, g.w && g.w.id, g.a && g.a.id, plumeTier(fury), soulTier(fury)].join(':'); if (HPV.k === key) return HPV.url;
  if (!A.hero) return ''; initR(); const m = makeUnitMesh('brute', { hero: true, wset: en.wset, gear: g });
  play(m, 'Stand', {}); m.mixer.update(0.4); m.root.rotation.y = 0.5; m.root.updateMatrixWorld(true);
  heroWeaponPose({ mesh: m, fury, dead: false, spawnT: 0, x: 0, z: 0 }, 0.016, null); m.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m.model), h = box.max.y - box.min.y, cy = (box.max.y + box.min.y) / 2;
  iconCam.position.set(0, cy + h * 0.02, h * 2.02); iconCam.lookAt(0, cy, 0); HPV.url = shot(m.root, 128); HPV.k = key;
  m.root.traverse(o => { if (o.material) for (const mm of [].concat(o.material)) mm.dispose(); }); return HPV.url;
}
export const portraitURL = type => POR[type] || '';
// pass a crypt entry instead of a type to get the gunner's own portrait when it holds the gatling
export const portrait = (type, cls = '') => { if (type && typeof type === 'object') type = techOf(type) ? techOf(type).key : type.type; return POR[type] ? `<img class="por ${cls}" src="${POR[type]}" draggable="false">` : TYPES[type].icon; };
