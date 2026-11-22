// A small second renderer: item icons and summon portraits rendered from the 3D models (same look on every device,
// unlike emoji), plus the live paperdoll view used by the equipment panel.
import * as THREE from 'three';
import { WEAPONS, itemBase, TYPES, makeGun, isGunner } from './data.js';
import { makeUnitMesh, propGeo, propMat, play } from './assets.js';
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
  for (const m of models) { const pg = propGeo(m); if (!pg) continue;
    const g = new THREE.Group(), mesh = new THREE.Mesh(pg.geo, propMat(pg.map)), c = pg.box.getCenter(new THREE.Vector3()), sz = pg.box.getSize(new THREE.Vector3());
    mesh.position.copy(c).negate(); g.add(mesh); const shield = sz.y < sz.x * 1.4 && sz.z < sz.x; g.rotation.set(shield ? 0.25 : 0.2, shield ? 0.5 : 0.9, shield ? 0 : -0.78);
    const span = Math.max(sz.x, sz.y, sz.z) * (shield ? 1.05 : 0.95); iconCam.position.set(0, 0, span / (2 * Math.tan(13 * Math.PI / 180))); iconCam.lookAt(0, 0, 0);
    ICON[m] = shot(g, 112); }
  // summon portraits: head and shoulders, turned a little toward the light
  for (const k of [...Object.keys(TYPES), 'gunner']) { const g = k === 'gunner', m = makeUnitMesh(g ? 'imp' : k, g ? { gear: { w: makeGun(0) } } : {});
    play(m, k === 'shaman' ? 'Idle' : 'Idle_Combat', {}); m.mixer.update(0.3); m.root.rotation.y = 0.45; m.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m.root), h = box.max.y - box.min.y, top = box.max.y, fy = top - h * 0.29;
    iconCam.position.set(0, fy + h * 0.06, h * 1.38); iconCam.lookAt(0, fy, 0); POR[k] = shot(m.root, 128); }
}
export const itemIconURL = it => ICON[itemBase(it).model] || '';
export const portraitURL = type => POR[type] || '';
// pass a crypt entry instead of a type to get the gunner's own portrait when it holds the gatling
export const portrait = (type, cls = '') => { if (type && typeof type === 'object') type = isGunner(type) ? 'gunner' : type.type; return POR[type] ? `<img class="por ${cls}" src="${POR[type]}" draggable="false">` : TYPES[type].icon; };
