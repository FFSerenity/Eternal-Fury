// KayKit asset bundles (CC0, Kay Lousberg): characters with a shared rig + shared animation clips, weapons, dungeon, graveyard and forest props.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMat, outlineMat, charUniforms, glowSprite, auraMat } from './gfx.js';
import { ELEM, WEAPONS, ARMORS, QUAL } from './data.js';

export const A = { chars: {}, clips: {}, props: {}, ready: false };
const CHAR_FILES = ['mage', 'sk_minion', 'sk_warrior', 'sk_rogue', 'sk_mage'], PROP_FILES = ['weapons', 'dungeon', 'graveyard', 'forest'];
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
// props built in code instead of loaded (the easter-egg gatling, see gun.js)
export const CUSTOM_PROPS = {};
export function propGeo(name) {
  if (PROP_CACHE[name]) return PROP_CACHE[name];
  if (CUSTOM_PROPS[name]) return (PROP_CACHE[name] = CUSTOM_PROPS[name]());
  const root = A.props[name]; if (!root) { console.warn('missing prop', name); return null; }
  return (PROP_CACHE[name] = bakeProp(root));
}
// hook(mesh, M): may change M (the mesh's matrix in the prop's space) or return false to leave the mesh out
export function bakeProp(root, hook) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), N = new THREE.Matrix3(), v = new THREE.Vector3();
  const pos = [], nor = [], uv = [], idx = []; let base = 0, map = null;
  root.traverse(o => { if (!o.isMesh) return; const g = o.geometry, p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    M.multiplyMatrices(inv, o.matrixWorld); if (hook && hook(o, M) === false) return; map = map || o.material.map; N.getNormalMatrix(M);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(M); pos.push(v.x, v.y, v.z);
      if (n) { v.fromBufferAttribute(n, i).applyMatrix3(N).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0); uv.push(t ? t.getX(i) : 0, t ? t.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base); base += p.count; });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return { geo, map, box: geo.boundingBox };
}
// the graveyard arch with its two gate leaves swung wide open (toward the arch's +z side): the way out of the camp into the wilds
CUSTOM_PROPS.arch_gate_open = () => {
  const root = A.props.arch_gate, b = new THREE.Box3(), c = new THREE.Vector3(), H = new THREE.Matrix4();
  return bakeProp(root, (o, M) => { if (!/gate_(left|right)/.test(o.name)) return;
    o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(M); b.getCenter(c); const hx = c.x < 0 ? b.min.x : b.max.x, a = c.x < 0 ? -1.85 : 1.85;
    M.premultiply(H.makeTranslation(-hx, 0, -c.z)).premultiply(H.makeRotationY(a)).premultiply(H.makeTranslation(hx, 0, c.z)); });
};
const MAT_CACHE = {};
export function propMat(map, o = {}) { const k = (map ? map.uuid : 'none') + JSON.stringify(o); return MAT_CACHE[k] || (MAT_CACHE[k] = toonMat({ ...o, map, vc: !!o.vc })); }
// textures made in code, picked by name in a PropBatch option ({ tex: 'forest' })
export const TEX = {};
// collects placements and builds one InstancedMesh per prop type
export class PropBatch {
  constructor(o = {}) { this.items = {}; this.o = o; }
  add(name, x, y, z, rotY = 0, s = 0.5, sy = null, sx = null, col = null) { (this.items[name] = this.items[name] || []).push([x, y, z, rotY, sx ?? s, sy ?? s, s, col]); }
  // instances are split into square chunks so that off-screen parts of the map are frustum-culled
  build(group, chunk = 8) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), out = [];
    for (const name in this.items) { const pg = propGeo(name); if (!pg) continue; const mo = this.o[name] || this.o.all || {}, mat = propMat(mo.tex ? TEX[mo.tex] : pg.map, mo), parts = new Map();
      for (const it of this.items[name]) { const k = Math.floor(it[0] / chunk) * 1000 + Math.floor(it[2] / chunk); let a = parts.get(k); if (!a) parts.set(k, a = []); a.push(it); }
      for (const list of parts.values()) { const im = new THREE.InstancedMesh(pg.geo, mat, list.length), tint = list.some(it => it[7]);
        list.forEach(([x, y, z, r, sx, sy, sz, col], i) => { e.set(0, r, 0); q.setFromEuler(e); m.compose(p.set(x, y, z), q, sc.set(sx, sy, sz)); im.setMatrixAt(i, m);
          if (tint) im.setColorAt(i, col ? c.setRGB(col[0], col[1], col[2]) : c.setRGB(1, 1, 1)); });
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
// height of the soul flame above the head bone (KayKit units; hats and helmets are taller)
const SOUL_Y = { imp: 1.2, brute: 1.45, archer: 1.3, shaman: 1.6 };
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
  // champion affix glows on the body (rim light, faint emissive, particles from chest / head / hands); weapons only show gear quality
  const elems = (o.elems || (o.elem ? [o.elem] : [])).filter(m => ELEM[m]), el = elems.length ? ELEM[elems[0]] : null, tips = [], glows = [], matW = matFor;
  if (el) { u.uRim.value.set(el.col).multiplyScalar(0.95); u.uEmis.value.set(el.emis).multiplyScalar(0.3);
    for (const n of ['chest', 'head', 'hand.l', 'hand.r', 'lowerleg.l', 'lowerleg.r']) { const b = findBone(model, n); if (b) tips.push(b); } }
  // summons: a small soul flame floating over the head marks them as yours (keeps the body free for affix colours)
  let soul = null; if (o.soul) { const h = findBone(model, 'head'); if (h) { soul = new THREE.Group(); soul.position.set(0, SOUL_Y[kind] ?? 1.25, 0); h.add(soul);
    const a = glowSprite(0x46e8d8, 0.95, 0.85), c = glowSprite(0xe8fffc, 0.34, 1); soul.add(a, c); glows.push(a, c); } }
  // equipped gear replaces the default weapon (right hand) and, for the warrior, the shield (left hand)
  const gear = o.gear || {}, wl = (def.weapons || []).map(([w, bone]) => [bone === 'handslot.r' && gear.w ? WEAPONS[gear.w.type].bases[gear.w.b].model : bone === 'handslot.l' && gear.a ? ARMORS[gear.a.b].model : w, bone,
    bone === 'handslot.r' ? gear.w : bone === 'handslot.l' ? gear.a : null]);
  let gun = null, blade = null, aura = null;
  for (const [w, bone, it] of wl) { const gat = w === 'gatling', pg = propGeo(gat ? 'gatling_body' : w), b = findBone(model, bone); if (!pg || !b) continue; const shield = bone === 'handslot.l';
    const wm = new THREE.Mesh(pg.geo, matW(pg.map)); b.add(wm); adds.push([wm, new THREE.Mesh(pg.geo, outlineMat(o.outline ?? 0x120a10, olW, u.uFade))]);
    if (gat) { // the barrel cluster is its own mesh so it can spin while firing; the muzzle marks where tracers start
      wm.rotation.set(0, 1.55, 0); wm.scale.setScalar(1.2); // the shooting poses hold the right-hand slot turned ~90°: this lines the barrels up with the aim
      const bp = propGeo('gatling_barrel'), bm = new THREE.Mesh(bp.geo, matW(bp.map)); bm.position.copy(bp.pivot); wm.add(bm); adds.push([bm, new THREE.Mesh(bp.geo, outlineMat(o.outline ?? 0x120a10, olW, u.uFade))]);
      const mz = new THREE.Object3D(); mz.position.set(bp.pivot.x, bp.pivot.y, bp.pivot.z + bp.muzzle + 0.04); wm.add(mz); gun = { barrel: bm, muzzle: mz, spin: 0 }; }
    // the blade's edge, for swing trails: from a third of the way up to the tip (melee weapons only), coloured by gear quality / affix / side
    if (!gat && !shield && (kind === 'imp' || kind === 'brute')) { const zm = (pg.box.max.z + pg.box.min.z) / 2, a = new THREE.Object3D(), b2 = new THREE.Object3D();
      a.position.set(0, pg.box.max.y * 0.32, zm); b2.position.set(0, pg.box.max.y * 1.02, zm); wm.add(a, b2);
      blade = { a, b: b2, col: it && it.q ? QUAL[it.q].hex : el ? el.col : o.soul ? 0x9ff8ee : 0xffe2c8 }; }
    if (it && it.q && !shield) { const t = new THREE.Object3D(); t.position.set(0, gat ? 0.13 : pg.box.max.y * 0.8, gat ? 0.2 : (pg.box.max.z + pg.box.min.z) / 2); wm.add(t);
      if (it.q >= 2) { // rare and up: energy flowing over the weapon (the gatling: over the body and the spinning barrels), sparks drifting off it
        const len = gat ? pg.box.max.z - pg.box.min.z : pg.box.max.y, sh = new THREE.Mesh(pg.geo, auraMat(QUAL[it.q].hex, len, u.uFade, gat ? 0.025 : 0.05, it.q === 3 ? 1.7 : 1.45, gat ? new THREE.Vector3(0, 0, 1) : undefined)); sh.scale.setScalar(1.04); sh.renderOrder = 3; wm.add(sh);
        if (gat && gun) { const bp = propGeo('gatling_barrel'), bs = new THREE.Mesh(bp.geo, auraMat(QUAL[it.q].hex, len, u.uFade, 0.025, 1.7, new THREE.Vector3(0, 0, 1))); bs.renderOrder = 3; gun.barrel.add(bs); }
        aura = { tip: t, col: QUAL[it.q].hex }; }
      else { const gs = glowSprite(QUAL[it.q].hex, 0.8, 0.6); t.add(gs); glows.push(gs); } }
  }

  // 机枪骷髅: a minion holding the gatling gets its own look — a gunmetal helmet with purple goggles, a bandolier and an ammo pack
  // (built in gun.js in the rig's rest-pose space, then hung on the head / chest bones so they follow the animation); it stands a little taller
  const gunner = kind === 'imp' && gear.w && gear.w.uniq === 'mg';
  if (gunner) { model.updateMatrixWorld(true);
    for (const [name, bone] of [['gunner_helmet', 'head'], ['gunner_kit', 'chest']]) { const kp = propGeo(name), b = findBone(model, bone); if (!kp || !b) continue;
      const m = new THREE.Mesh(kp.geo, matW(kp.map)); new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(model.matrixWorld).decompose(m.position, m.quaternion, m.scale); b.add(m);
      adds.push([m, new THREE.Mesh(kp.geo, outlineMat(o.outline ?? 0x120a10, olW / (m.scale.x || 1), u.uFade))]); } }
  for (const [parent, ol] of adds) parent.add(ol);
  model.scale.setScalar(def.scale * (o.scale ?? 1) * (gunner ? 1.12 : 1));
  const root = new THREE.Group(); root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  return { root, model, pivot: model, mixer, actions: {}, cur: null, curName: '', mat: { uniforms: u }, out: { material: { uniforms: { uFade: u.uFade } } }, u, tips, glows, soul, gun, blade, aura, elem: el ? elems[0] : null, elems };
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
  m.cur = a; m.curName = name;
  if (m.curU && !name.endsWith('@lower')) { if (o.fade === 0) m.curU.stop(); else m.curU.fadeOut(o.fade ?? 0.15); m.curU = null; m.curUName = ''; } // a whole-body clip takes the arms back
  return a;
}
// layered animation (the 机枪骷髅 walks with its legs while its arms keep the gun up): a clip split into the upper body
// (spine, chest, head, arms) and the rest; play(m, partClip(walk, 'lower')) for the legs, playUpper(m, partClip(aim, 'upper')) for the arms
const UPPER = new Set(['spine', 'chest', 'head', 'upperarml', 'lowerarml', 'wristl', 'handl', 'handslotl', 'upperarmr', 'lowerarmr', 'wristr', 'handr', 'handslotr']);
export function partClip(name, part) {
  const key = name + '@' + part; if (A.clips[key]) return key; const c = A.clips[name]; if (!c) return name;
  A.clips[key] = new THREE.AnimationClip(key, c.duration, c.tracks.filter(t => UPPER.has(t.name.split('.')[0].replace(/[[\]\.:\/]/g, '')) === (part === 'upper'))); return key;
}
export function playUpper(m, name, o = {}) {
  const clip = A.clips[name]; if (!clip) return null;
  let a = m.actions[name]; if (!a) { a = m.mixer.clipAction(clip); m.actions[name] = a; }
  if (m.curU === a && !o.restart) { if (o.speed != null) a.timeScale = o.speed; return a; }
  const prev = m.curU; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = o.speed ?? 1; a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
  a.play(); if (prev && prev !== a) prev.crossFadeTo(a, o.fade ?? 0.12, false); else if (!prev) a.fadeIn(o.fade ?? 0.12);
  m.curU = a; m.curUName = name; return a;
}
