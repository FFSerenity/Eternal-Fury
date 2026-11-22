// KayKit asset bundles (CC0, Kay Lousberg): characters with a shared rig + shared animation clips, weapons, dungeon and graveyard props.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMat, outlineMat, charUniforms, glowSprite } from './gfx.js';
import { ELEM } from './data.js';

export const A = { chars: {}, clips: {}, props: {}, ready: false };
const CHAR_FILES = ['mage', 'sk_minion', 'sk_warrior', 'sk_rogue', 'sk_mage'], PROP_FILES = ['weapons', 'dungeon', 'graveyard'];
export async function loadAll(onProgress = () => {}) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const jobs = [...CHAR_FILES.map(f => ['char', f]), ['anims', 'anims'], ...PROP_FILES.map(f => ['props', f])];
  let done = 0;
  await Promise.all(jobs.map(async ([kind, name]) => {
    const g = await loader.loadAsync(`assets/${name}.glb`);
    // colours are treated as display colours everywhere (no colour management), so textures must not be sRGB-decoded
    g.scene.traverse(o => { if (o.material && o.material.map) o.material.map.colorSpace = THREE.NoColorSpace; });
    if (kind === 'char') A.chars[name] = g.scene;
    else if (kind === 'anims') for (const c of g.animations) A.clips[c.name] = c;
    else for (const n of g.scene.children) A.props[n.name] = n;
    onProgress(++done / jobs.length);
  }));
  A.ready = true;
}
const findBone = (root, name) => root.getObjectByName(name) || root.getObjectByName(name.replace(/[[\]\.:\/]/g, ''));

// ---------- props: a model's meshes baked into one float geometry (for instancing / static placement) ----------
const PROP_CACHE = {};
export function propGeo(name) {
  if (PROP_CACHE[name]) return PROP_CACHE[name];
  const root = A.props[name]; if (!root) { console.warn('missing prop', name); return null; }
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), N = new THREE.Matrix3(), v = new THREE.Vector3();
  const pos = [], nor = [], uv = [], idx = []; let base = 0, map = null;
  root.traverse(o => { if (!o.isMesh) return; const g = o.geometry, p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv; map = map || o.material.map;
    M.multiplyMatrices(inv, o.matrixWorld); N.getNormalMatrix(M);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); pos.push(v.x, v.y, v.z);
      if (n) { v.fromBufferAttribute(n, i).applyMatrix3(N).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0); uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base); base += p.count; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return (PROP_CACHE[name] = { geo, map, box: geo.boundingBox });
}
const MAT_CACHE = {};
export function propMat(map, o = {}) { const k = (map ? map.uuid : 'none') + JSON.stringify(o); return MAT_CACHE[k] || (MAT_CACHE[k] = toonMat({ ...o, map, vc: false })); }
// collects placements and builds one InstancedMesh per prop type
export class PropBatch {
  constructor(o = {}) { this.items = {}; this.o = o; }
  add(name, x, y, z, rotY = 0, s = 0.5, sy = null, sx = null) { (this.items[name] = this.items[name] || []).push([x, y, z, rotY, sx ?? s, sy ?? s, s]); }
  // instances are split into square chunks so that off-screen parts of the map are frustum-culled
  build(group, chunk = 8) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), out = [];
    for (const name in this.items) { const pg = propGeo(name); if (!pg) continue; const mo = this.o[name] || this.o.all || {}, mat = propMat(pg.map, mo), parts = new Map();
      for (const it of this.items[name]) { const k = Math.floor(it[0] / chunk) * 1000 + Math.floor(it[2] / chunk); let a = parts.get(k); if (!a) parts.set(k, a = []); a.push(it); }
      for (const list of parts.values()) { const im = new THREE.InstancedMesh(pg.geo, mat, list.length);
        list.forEach(([x, y, z, r, sx, sy, sz], i) => { e.set(0, r, 0); q.setFromEuler(e); m.compose(p.set(x, y, z), q, sc.set(sx, sy, sz)); im.setMatrixAt(i, m); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); group.add(im); out.push(im); } }
    return out;
  }
}
export function propMesh(name, o = {}) { const pg = propGeo(name); return new THREE.Mesh(pg.geo, propMat(pg.map, o)); }

// ---------- characters ----------
export const CHARS = {
  player: { file: 'mage', scale: 0.5, hide: ['Spellbook', 'Spellbook_open', '1H_Wand', 'Mage_Hat'] },
  imp:    { file: 'sk_minion', scale: 0.44, weapons: [['sk_blade', 'handslot.r']] },
  brute:  { file: 'sk_warrior', scale: 0.6, weapons: [['sk_axe', 'handslot.r'], ['sk_shield', 'handslot.l']] },
  archer: { file: 'sk_rogue', scale: 0.48, weapons: [['sk_crossbow', 'handslot.r']] },
  shaman: { file: 'sk_mage', scale: 0.5, weapons: [['sk_staff', 'handslot.r']] },
};
const SPHERE = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 2.4);
// a unit's visual: root (position / facing, unscaled: rings live here) -> model (scaled KayKit character)
export function makeUnitMesh(kind, o = {}) {
  const def = CHARS[kind], model = skClone(A.chars[def.file]), u = charUniforms(o), mats = new Map();
  const olW = o.outlineW ?? 0.05, olSk = outlineMat(o.outline ?? 0x120a10, olW, u.uFade), adds = [];
  const matFor = map => { if (!mats.has(map)) mats.set(map, toonMat({ u, map, vc: false })); return mats.get(map); };
  model.traverse(obj => {
    if (!obj.isMesh) return;
    if (def.hide && def.hide.includes(obj.name)) { obj.visible = false; return; }
    obj.material = matFor(obj.material.map); obj.castShadow = obj.receiveShadow = false;
    if (obj.isSkinnedMesh) { obj.boundingSphere = SPHERE.clone(); const ol = new THREE.SkinnedMesh(obj.geometry, olSk); ol.bind(obj.skeleton, obj.bindMatrix); ol.boundingSphere = SPHERE.clone(); adds.push([obj.parent, ol]); }
    else { const s = obj.scale.x || 1; adds.push([obj, new THREE.Mesh(obj.geometry, outlineMat(o.outline ?? 0x120a10, olW / s, u.uFade))]); }
  });
  // champion affix: the weapons glow in the element's colour and get a glowing tip that sheds particles
  const el = o.elem && ELEM[o.elem], tips = [], glows = [];
  const wMat = el ? new Map() : null, matW = map => { if (!el) return matFor(map); if (!wMat.has(map)) wMat.set(map, toonMat({ u: { ...u, uEmis: { value: new THREE.Color(el.emis) } }, map, vc: false })); return wMat.get(map); };
  for (const [w, bone] of def.weapons || []) { const pg = propGeo(w), b = findBone(model, bone); if (!pg || !b) continue;
    const wm = new THREE.Mesh(pg.geo, matW(pg.map)); b.add(wm); adds.push([wm, new THREE.Mesh(pg.geo, outlineMat(o.outline ?? 0x120a10, olW, u.uFade))]);
    if (el && w !== 'sk_shield') { const tip = new THREE.Object3D(); tip.position.set(0, pg.box.max.y * 0.8, (pg.box.max.z + pg.box.min.z) / 2); wm.add(tip);
      const gs = glowSprite(el.col, 1.3, 0.85); tip.add(gs); glows.push(gs); tips.push(tip); } }

  for (const [parent, ol] of adds) parent.add(ol);
  model.scale.setScalar(def.scale * (o.scale ?? 1));
  const root = new THREE.Group(); root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  return { root, model, pivot: model, mixer, actions: {}, cur: null, curName: '', mat: { uniforms: u }, out: { material: { uniforms: { uFade: u.uFade } } }, u, tips, glows, elem: el ? o.elem : null };
}
export function clipLen(name) { const c = A.clips[name]; return c ? c.duration : 1; }
// play a clip (cross-fade). o.once: play one time; o.hold: keep the last frame; o.speed: time scale; o.restart: replay even if current
export function play(m, name, o = {}) {
  const clip = A.clips[name]; if (!clip) return null;
  let a = m.actions[name]; if (!a) { a = m.mixer.clipAction(clip); m.actions[name] = a; }
  if (m.cur === a && !o.restart) { if (o.speed != null) a.timeScale = o.speed; return a; }
  const prev = m.cur;
  a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = o.speed ?? 1; a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!(o.once && o.hold !== false);
  if (o.at) a.time = o.at * clip.duration;
  a.play(); if (prev && prev !== a) { if (o.fade === 0) prev.stop(); else prev.crossFadeTo(a, o.fade ?? 0.15, false); }
  m.cur = a; m.curName = name; return a;
}
