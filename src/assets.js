// KayKit asset bundles (CC0, Kay Lousberg): characters with a shared rig + shared animation clips, weapons, dungeon, graveyard and forest props.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMat, outlineMat, charUniforms, glowSprite, auraMat, realMat } from './gfx.js';
import { ELEM, WEAPONS, ARMORS, QUAL } from './data.js';
import { PACT } from './state.js';

export const A = { chars: {}, clips: {}, props: {}, hero: null, heroClips: {}, heroWeap: {}, ready: false };
const CHAR_FILES = ['mage', 'sk_minion', 'sk_warrior', 'sk_rogue', 'sk_mage'], PROP_FILES = ['weapons', 'dungeon', 'graveyard', 'forest'];
export async function loadAll(onProgress = () => {}) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const jobs = [...CHAR_FILES.map(f => ['char', f]), ['anims', 'anims'], ...PROP_FILES.map(f => ['props', f]),
    ...(PACT ? [['hero', 'hero'], ['heropack', 'hero_sns'], ['heropack', 'hero_gs'], ['heroweap', 'hero_weapons']] : [])]; // the realistic skeleton: 魂契 only
  let done = 0;
  await Promise.all(jobs.map(async ([kind, name]) => {
    const g = await loader.loadAsync(`assets/${name}.glb`);
    // colours are treated as display colours everywhere (no colour management), so textures must not be sRGB-decoded
    g.scene.traverse(o => { if (o.material && o.material.map) o.material.map.colorSpace = THREE.NoColorSpace; });
    if (kind === 'char') A.chars[name] = g.scene;
    else if (kind === 'anims') for (const c of g.animations) A.clips[c.name] = c;
    else if (kind === 'hero') { const fingers = heroFists(g.scene); for (const c of g.animations) { c.tracks = c.tracks.filter(t => !fingers.has(t.name.split('.')[0])); A.heroClips[c.name] = c; }
      if (A.heroClips.Stand) spreadArms(g.scene, A.heroClips.Stand, ...(globalThis.__spread || ARM_SPREAD));
      A.hero = { scene: g.scene, clips: A.heroClips }; }
    else if (kind === 'heropack') for (const c of g.animations) A.heroClips[c.name] = c; // weapon-style clip packs: rig + clips only, same bone names
    else if (kind === 'heroweap') for (const n of g.scene.children) A.heroWeap[n.name] = n;
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
// two-handed tech weapons: how the right-hand slot holds them (turned to line up with the 2H aiming pose) and how big
const HOLD = { gatling: { ry: 1.55, s: 1.2 }, mortar: { ry: 1.55, s: 1.1 } };
const TECH_LOOK = { mg: { kind: 'imp', scale: 1.12, kit: [['gunner_helmet', 'head'], ['gunner_kit', 'chest']] },
  mortar: { kind: 'archer', scale: 1.08, kit: [['bomber_goggles', 'head'], ['bomber_pack', 'chest']] },
  drill: { kind: 'brute', scale: 1.06, hide: ['Skeleton_Warrior_Helmet'], kit: [['mech_helmet', 'head'], ['mech_chest', 'chest'], ['mech_pad_l', 'upperarm.l'], ['mech_pad_r', 'upperarm.r'], ['mech_arm_l', 'lowerarm.l'], ['mech_arm_r', 'lowerarm.r'], ['mech_leg_l', 'lowerleg.l'], ['mech_leg_r', 'lowerleg.r']] },
  rod: { kind: 'shaman', scale: 1.06, hide: ['Skeleton_Mage_Hat'], soulY: 1.42, kit: [['eng_hat', 'head'], ['eng_pack', 'chest'], ['eng_pad', 'lowerarm.l']] } };
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
  if (o.hero && A.hero) return makeHeroMesh(o);
  const def = CHARS[kind], model = skClone(A.chars[def.file]), u = charUniforms(o), mats = new Map();
  const olW = o.outlineW ?? 0.05, olSk = outlineMat(o.outline ?? 0x120a10, olW, u.uFade), adds = [];
  const matFor = map => { if (!mats.has(map)) mats.set(map, toonMat({ u, map, vc: false })); return mats.get(map); };
  const tl = o.gear && o.gear.w && o.gear.w.uniq && TECH_LOOK[o.gear.w.uniq], hideX = tl && tl.kind === kind && tl.hide || null; // a tech look can swap out part of the model (the mech's helmet)
  model.traverse(obj => {
    if (!obj.isMesh) return;
    if ((def.hide && def.hide.includes(obj.name)) || (hideX && hideX.includes(obj.name))) { obj.visible = false; return; }
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
  let soul = null; if (o.soul) { const h = findBone(model, 'head'); if (h) { soul = new THREE.Group(); soul.position.set(0, (hideX && tl.soulY) || (SOUL_Y[kind] ?? 1.25), 0); h.add(soul);
    const a = glowSprite(0x46e8d8, 0.95, 0.85), c = glowSprite(0xe8fffc, 0.34, 1); soul.add(a, c); glows.push(a, c); } }
  // equipped gear replaces the default weapon (right hand) and, for the warrior, the shield (left hand)
  const gear = o.gear || {}, wl = (def.weapons || []).map(([w, bone]) => [bone === 'handslot.r' && gear.w ? WEAPONS[gear.w.type].bases[gear.w.b].model : bone === 'handslot.l' && gear.a ? ARMORS[gear.a.b].model : w, bone,
    bone === 'handslot.r' ? gear.w : bone === 'handslot.l' ? gear.a : null]);
  let gun = null, blade = null, aura = null;
  let muz = null;
  let drill = null, rod = null;
  for (const [w, bone, it] of wl) { const gat = w === 'gatling', hold = HOLD[w], pg = propGeo(gat ? 'gatling_body' : w === 'drill' ? 'drill_body' : w), b = findBone(model, bone); if (!pg || !b) continue; const shield = bone === 'handslot.l';
    const wm = new THREE.Mesh(pg.geo, matW(pg.map)); b.add(wm); adds.push([wm, new THREE.Mesh(pg.geo, outlineMat(o.outline ?? 0x120a10, olW, u.uFade))]);
    if (gat) { // the barrel cluster is its own mesh so it can spin while firing; the muzzle marks where tracers start
      wm.rotation.set(0, hold.ry, 0); wm.scale.setScalar(hold.s); // the shooting poses hold the right-hand slot turned ~90°: this lines the barrels up with the aim
      const bp = propGeo('gatling_barrel'), bm = new THREE.Mesh(bp.geo, matW(bp.map)); bm.position.copy(bp.pivot); wm.add(bm); adds.push([bm, new THREE.Mesh(bp.geo, outlineMat(o.outline ?? 0x120a10, olW, u.uFade))]);
      const mz = new THREE.Object3D(); mz.position.set(bp.pivot.x, bp.pivot.y, bp.pivot.z + bp.muzzle + 0.04); wm.add(mz); gun = { barrel: bm, muzzle: mz, spin: 0 }; }
    // the blade's edge, for swing trails: from a third of the way up to the tip (melee weapons only), coloured by gear quality / affix / side
    if (!gat && !shield && (kind === 'imp' || kind === 'brute')) { const zm = (pg.box.max.z + pg.box.min.z) / 2, a = new THREE.Object3D(), b2 = new THREE.Object3D();
      a.position.set(0, pg.box.max.y * 0.32, zm); b2.position.set(0, pg.box.max.y * 1.02, zm); wm.add(a, b2);
      blade = { a, b: b2, col: it && it.q ? QUAL[it.q].hex : el ? el.col : o.soul ? 0x9ff8ee : 0xffe2c8 }; }
    if (w === 'drill') { const bp = propGeo('drill_bit'), bm = new THREE.Mesh(bp.geo, matW(bp.map)); bm.position.copy(bp.pivot); wm.add(bm); adds.push([bm, new THREE.Mesh(bp.geo, outlineMat(o.outline ?? 0x120a10, olW, u.uFade))]); drill = { bit: bm, spin: 0 };
      if (it && it.q >= 2) { const s2 = new THREE.Mesh(bp.geo, auraMat(QUAL[it.q].hex, 1.0, u.uFade, 0.03, 1.7)); s2.renderOrder = 3; bm.add(s2); } }
    if (w === 'cmdrod') { rod = new THREE.Object3D(); rod.position.copy(pg.tip); wm.add(rod); } // where the 机械师骷髅's beam comes out
    if (hold && !gat) { wm.rotation.set(0, hold.ry, 0); wm.scale.setScalar(hold.s); if (pg.muzzle) { muz = new THREE.Object3D(); muz.position.copy(pg.muzzle); wm.add(muz); } } // the mortar: held like the gatling
    if (it && it.q && !shield) { const t = new THREE.Object3D(); t.position.set(0, hold ? 0.15 : pg.box.max.y * 0.8, hold ? (gat ? 0.2 : 0.45) : (pg.box.max.z + pg.box.min.z) / 2); wm.add(t);
      if (it.q >= 2) { // rare and up: energy flowing over the weapon (the gatling: over the body and the spinning barrels), sparks drifting off it
        const len = hold ? pg.box.max.z - pg.box.min.z : pg.box.max.y, sh = new THREE.Mesh(pg.geo, auraMat(QUAL[it.q].hex, len, u.uFade, hold ? 0.025 : 0.05, it.q === 3 ? 1.7 : 1.45, hold ? new THREE.Vector3(0, 0, 1) : undefined)); sh.scale.setScalar(1.04); sh.renderOrder = 3; wm.add(sh);
        if (gat && gun) { const bp = propGeo('gatling_barrel'), bs = new THREE.Mesh(bp.geo, auraMat(QUAL[it.q].hex, len, u.uFade, 0.025, 1.7, new THREE.Vector3(0, 0, 1))); bs.renderOrder = 3; gun.barrel.add(bs); }
        aura = { tip: t, col: QUAL[it.q].hex }; }
      else { const gs = glowSprite(QUAL[it.q].hex, 0.8, 0.6); t.add(gs); glows.push(gs); } }
  }

  // 科技流 units get their own look — the gunner a gunmetal helmet, bandolier and ammo pack; the bombardier goggles, a shell rack and a pauldron
  // (built in gun.js / tech.js in the rig's rest-pose space, then hung on the head / chest bones so they follow the animation); they stand a little taller
  const look = gear.w && gear.w.uniq && TECH_LOOK[gear.w.uniq], gunner = !!look && look.kind === kind;
  if (gunner) { model.updateMatrixWorld(true);
    for (const [name, bone] of look.kit) { const kp = propGeo(name), b = findBone(model, bone); if (!kp || !b) continue;
      const m = new THREE.Mesh(kp.geo, matW(kp.map)); new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(model.matrixWorld).decompose(m.position, m.quaternion, m.scale); b.add(m);
      adds.push([m, new THREE.Mesh(kp.geo, outlineMat(o.outline ?? 0x120a10, olW / (m.scale.x || 1), u.uFade))]); } }
  for (const [parent, ol] of adds) parent.add(ol);
  model.scale.setScalar(def.scale * (o.scale ?? 1) * (gunner ? look.scale : 1));
  const root = new THREE.Group(); root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  return { root, model, pivot: model, mixer, actions: {}, cur: null, curName: '', mat: { uniforms: u }, out: { material: { uniforms: { uFade: u.uFade } } }, u, tips, glows, soul, gun, muz, drill, rod, blade, aura, elem: el ? elems[0] : null, elems };
}
// ---------- the realistic hero skeleton (魂契 mode; modelled with Meshy, Mixamo rig, CC BY 4.0) ----------
// its own model and clips; the game asks for KayKit clip names, heroClip() maps them onto the few the hero has
const HERO_H = 2.25; // world height (realistic proportions are slim: it has to stand a head taller than the chunky KayKit warriors to read as the hero)
// weapon sets: a prefix on the pack's clip names (SNS_Idle, GS_Atk1 ...) and the weapons held in each hand
export const HERO_SETS = {
  SNS: { r: 'sword', l: 'shield', atk: ['SNS_Atk1', 'SNS_Atk2', 'SNS_Atk3'] },
  GS: { r: 'greatsword', atk: ['GS_Atk1', 'GS_Atk2', 'GS_Atk3'] },
};
export function heroClip(n, set) {
  const C = A.heroClips, p = set ? set + '_' : '#', pick = (...ks) => ks.find(k => C[k]) || null;
  if (C[p + n]) return p + n; if (C[n]) return n;
  if (/Death|Die/.test(n)) return pick(p + 'Death', 'Dead');
  if (/Attack|Chop|Slice|Stab|Spin|Melee/.test(n)) return pick(p + 'Atk1', 'Attack');
  // moving and standing: a dazed stand and a plain walk — no guard stance (the styles' guarded idle / walk wait for a defence skill), and
  // no run yet. Sword & shield: Mixamo's brutal walk; greatsword: the briefcase walk (the right arm hangs, the blade drags behind)
  if (/Walk|Run/.test(n)) return pick('Walk_' + (set || 'SNS'), 'Walk_SNS', 'Walking');
  if (/Hit/.test(n)) return null; // no flinch: keep what's playing (it shrugs hits off)
  return pick('Stand', 'Idle');
}
// the model came with open, spread hands: curl the fingers into a fist (in the rest pose, so every clone has it) and keep the clips
// off the finger bones. The auto-rig hung some fingers on a palm bone (Bone_024 / Bone_019, reparented under the hands at build time),
// so chains are collected from both. Palms face forward (+z) in the A-pose and each finger bends about cross(finger direction, palm
// normal). The thumb (the chain that starts nearest the wrist) bends toward the index and middle fingers' middle joints, so it ends
// across the front of the fist instead of sticking out.
function heroChains(hand, palm) {
  const chains = [];
  for (const p of [hand, palm]) if (p) for (const c of p.children) if (c.isBone && c !== palm) { const ch = []; let b = c; while (b) { ch.push(b); b = b.children.find(k => k.isBone); } chains.push(ch); }
  return chains;
}
function heroFists(scene) {
  const names = new Set(), V = THREE.Vector3, Q = THREE.Quaternion; scene.updateMatrixWorld(true);
  const wp = b => b.getWorldPosition(new V()), n = new V(0, 0, 1);
  const turn = (b, axW, ang) => { b.quaternion.multiply(new Q().setFromAxisAngle(axW.clone().applyQuaternion(b.getWorldQuaternion(new Q()).invert()), ang)); b.updateMatrixWorld(true); };
  for (const [hand, palm] of [['mixamorig:LeftHand', 'Bone_024'], ['mixamorig:RightHand', 'Bone_019']]) {
    const chains = heroChains(findBone(scene, hand), findBone(scene, palm)); if (!chains.length) continue;
    const top = Math.max(...chains.map(ch => wp(ch[0]).y)), thumb = chains.find(ch => wp(ch[0]).y >= top - 1e-4), fingers = chains.filter(ch => ch !== thumb);
    for (const ch of fingers) { const d = wp(ch[ch.length - 1]).sub(wp(ch[0])).normalize(), ax = new V().crossVectors(d, n).normalize();
      ch.forEach((b, i) => { names.add(b.name); turn(b, ax, [1.4, 1.55, 1.1, 0.5][i] ?? 0.4); }); }
    if (!thumb) continue;
    const t0 = wp(thumb[0]), near = fingers.slice().sort((a, b) => wp(a[0]).distanceTo(t0) - wp(b[0]).distanceTo(t0)).slice(0, 2);
    const aim = near.reduce((s, ch) => s.add(wp(ch[Math.min(1, ch.length - 1)])), new V()).divideScalar(near.length).add(n.clone().multiplyScalar(0.012));
    thumb.forEach((b, i) => { names.add(b.name); const nx = thumb[i + 1]; if (!nx) return;
      const h = wp(b), dir = wp(nx).sub(h).normalize(), to = aim.clone().sub(h).normalize(), ang = dir.angleTo(to) * ([0.5, 0.65, 0.8][i] ?? 0.6);
      if (ang > 1e-3) turn(b, new V().crossVectors(dir, to).normalize(), ang); });
  }
  return names;
}
function makeHeroMesh(o) {
  const model = skClone(A.hero.scene), u = charUniforms(o), adds = []; let mat = null;
  model.traverse(obj => { if (!obj.isMesh) return; const sm = obj.material;
    mat = mat || realMat({ u, map: sm.map, nmap: sm.normalMap, mr: sm.roughnessMap || sm.metalnessMap });
    obj.material = mat; obj.frustumCulled = false;
    if (obj.isSkinnedMesh) { const ol = new THREE.SkinnedMesh(obj.geometry, outlineMat(o.outline ?? 0x0c080c, 0.012, u.uFade)); ol.bind(obj.skeleton, obj.bindMatrix); ol.frustumCulled = false; adds.push([obj.parent, ol]); } });
  for (const [p, ol] of adds) p.add(ol);
  const box = new THREE.Box3().setFromObject(model), h = Math.max(0.1, box.max.y - box.min.y);
  model.scale.setScalar(HERO_H / h * (o.scale ?? 1));
  // the soul fire in its eye sockets, as a glow that carries across the room (hung on the head bone so it follows the animation)
  const glows = [], head = findBone(model, 'mixamorig:Head');
  if (head) { model.updateMatrixWorld(true); const hp = head.getWorldPosition(new THREE.Vector3()), ws = head.getWorldScale(new THREE.Vector3()).x || 1;
    const g = glowSprite(0x5ff2ff, 0.42 / ws, 0.75); g.position.copy(head.worldToLocal(hp.add(new THREE.Vector3(0, 0.09 * HERO_H / 1.85, 0.1 * HERO_H / 1.85)))); head.add(g); glows.push(g); }
  const set = HERO_SETS[o.wset], weap = {};
  if (set) for (const side of ['r', 'l']) if (set[side]) weap[side] = heroGrip(model, side, set[side], u, o.outline);
  const root = new THREE.Group(); root.add(model);
  return { root, model, pivot: model, mixer: new THREE.AnimationMixer(model), actions: {}, cur: null, curName: '', mat: { uniforms: u }, out: { material: { uniforms: { uFade: u.uFade } } }, u,
    tips: [], glows, soul: null, gun: null, muz: null, drill: null, rod: null, blade: null, aura: null, elem: null, elems: [], hero: true, clips: A.heroClips, wset: set ? o.wset : null, atk: set ? set.atk : ['Attack'], atkI: 0, weap };
}
// the dazed stand (Mixamo Idle) holds the arms close against the body: a sturdier stance, elbows out and forearms leaning slightly back
// in (upper arm ~26 deg off vertical, forearm leaning a few degrees out). Turns about the facing axis, in world space so every key gets the same
// turn; the forearm turn is on top of the upper arm's. Baked into the clip once.
const ARM_SPREAD = [18, -19]; // degrees: upper arm, forearm (tests: globalThis.__spread)
function spreadArms(scene, clip, armDeg, foreDeg) {
  const bones = []; scene.traverse(o => { if (o.isBone) bones.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  const mixer = new THREE.AnimationMixer(scene), act = mixer.clipAction(clip); act.play();
  const Q = THREE.Quaternion, fwd = new THREE.Vector3(0, 0, 1), jobs = [];
  for (const side of ['Left', 'Right']) {
    const arm = findBone(scene, `mixamorig:${side}Arm`), fore = findBone(scene, `mixamorig:${side}ForeArm`); if (!arm || !fore) continue;
    scene.updateMatrixWorld(true); const out = Math.sign(arm.getWorldPosition(new THREE.Vector3()).x) || (side === 'Left' ? 1 : -1);
    const R = new Q().setFromAxisAngle(fwd, out * THREE.MathUtils.degToRad(armDeg)), R2 = new Q().setFromAxisAngle(fwd, out * THREE.MathUtils.degToRad(foreDeg));
    for (const [b, rot, parentOf] of [[arm, R, () => arm.parent.getWorldQuaternion(new Q())], [fore, R2, () => R.clone().multiply(arm.getWorldQuaternion(new Q()))]]) {
      const tr = clip.tracks.find(t => t.name === b.name + '.quaternion'); if (!tr) continue;
      const P = []; for (const t of tr.times) { act.time = Math.min(t, clip.duration - 1e-4); mixer.update(0); scene.updateMatrixWorld(true); P.push(parentOf()); }
      jobs.push([tr, rot, P]); }
  }
  for (const [tr, rot, P] of jobs) { const v = tr.values, q = new Q();
    P.forEach((p, i) => { q.fromArray(v, i * 4); q.premultiply(p.clone().invert().multiply(rot).multiply(p)); q.toArray(v, i * 4); }); }
  act.stop(); mixer.uncacheRoot(scene); for (const [o, p, q, s] of bones) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
}
// put a weapon in a fist. Worked out on the rest pose (A-pose, palms forward, fingers already curled): the grip runs across the
// knuckles through the middle of the curled fingers, the blade comes out on the thumb side, its edges line up with the fingers.
// The shield is strapped to the forearm instead (see below). Lengths are world sizes.
const WEAP_FIT = { sword: { len: 1.15, back: 0 }, greatsword: { len: 1.75, back: 0 }, shield: { len: 0.95, back: 0.12, at: 0.55 }, axe: { len: 1.05, back: 0 }, spear: { len: 2.2, back: 0 }, mace: { len: 1.0, back: 0 } };
const MAT_W = new Map();
const GRIP_F = [0.565, 0.82, -0.092]; // blade direction in the grip frame (fingers, thumb side, palm); fitted on the two-handed clips (tests: globalThis.__gripF)
function heroGrip(model, side, name, u, outline) {
  const src = A.heroWeap[name], hand = findBone(model, side === 'r' ? 'mixamorig:RightHand' : 'mixamorig:LeftHand'), palm = findBone(model, side === 'r' ? 'Bone_019' : 'Bone_024');
  if (!src || !hand) return null;
  const V = THREE.Vector3; model.updateMatrixWorld(true);
  const hp = hand.getWorldPosition(new V()), chains = heroChains(hand, palm);
  const top = Math.max(...chains.map(ch => ch[0].getWorldPosition(new V()).y)), thumb = chains.find(ch => ch[0].getWorldPosition(new V()).y >= top - 1e-4);
  const fingers = chains.filter(ch => ch !== thumb), knuck = new V(), ring = new V(); let nr = 0;
  for (const ch of fingers) { knuck.add(ch[0].getWorldPosition(new V())); for (const b of ch) { ring.add(b.getWorldPosition(new V())); nr++; } }
  knuck.divideScalar(fingers.length); ring.divideScalar(Math.max(1, nr));
  const n = new V(0, 0, 1), d = knuck.clone().sub(hp).normalize(), Y = new V().crossVectors(n, d).normalize();
  if (thumb && Y.dot(thumb[0].getWorldPosition(new V()).sub(ring)) < 0) Y.negate();
  const fit = WEAP_FIT[name] || { len: 1, back: 0 };
  let X, Z, W, at, bone = hand;
  if (name === 'shield') {
    // strapped to the outside of the forearm (not the fist: wrist turns made it cut into the arm). Board parallel to the forearm, facing
    // out of its back, top toward the thumb side (upright when the forearm is raised across the chest), standing clear of the bracer
    const fa = findBone(model, side === 'r' ? 'mixamorig:RightForeArm' : 'mixamorig:LeftForeArm'), el = fa.getWorldPosition(new V()), A = hp.clone().sub(el).normalize();
    Z = n.clone().negate(); Z.sub(A.clone().multiplyScalar(Z.dot(A))).normalize();
    const U = Y.clone().sub(A.clone().multiplyScalar(Y.dot(A))); U.sub(Z.clone().multiplyScalar(U.dot(Z))).normalize();
    X = new V().crossVectors(U, Z).normalize(); W = new THREE.Matrix4().makeBasis(X, U, Z);
    at = el.clone().lerp(hp, fit.at).add(Z.clone().multiplyScalar(fit.back)); bone = fa;
  } else { X = d.clone().sub(Y.clone().multiplyScalar(d.dot(Y))).normalize(); Z = new V().crossVectors(X, Y).normalize();
    // the handle lies diagonally across the palm, so the blade leans from the thumb side toward the knuckles. Measured on the
    // two-handed great sword clips (where the left hand holds the same handle lower down): ~52 deg toward the fingers
    const gf = globalThis.__gripF || GRIP_F, F = X.clone().multiplyScalar(gf[0]).add(Y.clone().multiplyScalar(gf[1])).add(Z.clone().multiplyScalar(side === 'r' ? gf[2] : -gf[2])).normalize();
    const Zw = Z.clone().sub(F.clone().multiplyScalar(Z.dot(F))).normalize(); W = new THREE.Matrix4().makeBasis(new V().crossVectors(F, Zw), F, Zw); at = ring.clone(); }
  W = new THREE.Quaternion().setFromRotationMatrix(W);
  const g = new THREE.Group();
  let mat = MAT_W.get(u); if (!mat) { let sm = null; src.traverse(o => { if (o.isMesh && !sm) sm = o.material; });
    mat = realMat({ u, map: sm.map, nmap: sm.normalMap, mr: sm.roughnessMap || sm.metalnessMap }); MAT_W.set(u, mat); }
  // a clone keeps the node transforms (the quantized meshes carry their de-quantization offset/scale there)
  const w = src.clone(true); w.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(w), meshes = [];
  w.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) { o.material = mat; o.frustumCulled = false; const ol = new THREE.Mesh(o.geometry, outlineMat(outline ?? 0x0c080c, 0.006, u.uFade)); ol.frustumCulled = false; o.add(ol); }
  g.add(w);
  // the model is already scaled to HERO_H here, so world sizes are game sizes; the group sits under the hand bone
  g.scale.setScalar(fit.len / (box.max.y - box.min.y) / bone.getWorldScale(new V()).x);
  g.position.copy(bone.worldToLocal(at.clone()));
  g.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(W));
  g.userData.q0 = g.quaternion.clone(); g.userData.tip = fit.len * box.max.y / (box.max.y - box.min.y); // world length from the grip to the point
  bone.add(g); return g;
}
// after the skeleton is posed each frame: a blade never sinks into the floor, and out of a swing the greatsword is dragged along the
// ground behind it (tip on the floor, a little to its right; sparks while it walks) instead of hanging straight down through it
const _V = THREE.Vector3, _p = new _V(), _ax = new _V(), _d = new _V(), _qh = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _up = new _V(0, 1, 0);
const _n = new _V(), _c = new _V(), _zA = new _V(0, 0, 1), _qz = new THREE.Quaternion();
// the shield turns in its own plane (so the forearm stays behind the board) to keep its point down: a lowered arm carries it upright
// along the leg instead of sticking out like a wing, and a raised guard (thumb up) needs almost no turn. Slightly short of full and
// eased, so it sways a little with the arm
function shieldHang(g, dt) {
  g.quaternion.copy(g.userData.q0); g.parent.getWorldQuaternion(_qh); _qw.copy(_qh).multiply(g.userData.q0);
  _n.copy(_zA).applyQuaternion(_qw); _ax.copy(_up).applyQuaternion(_qw); _d.copy(_up).addScaledVector(_n, -_n.y);
  let a = g.userData.hang ?? 0;
  if (_d.lengthSq() > 0.06) { _d.normalize(); const t = Math.atan2(_c.crossVectors(_ax, _d).dot(_n), _ax.dot(_d)) * 0.85;
    const dd = Math.atan2(Math.sin(t - a), Math.cos(t - a)); a += dd * Math.min(1, dt * 10); a = Math.atan2(Math.sin(a), Math.cos(a)); g.userData.hang = a; }
  g.quaternion.multiply(_qz.setFromAxisAngle(_zA, a));
}
export function heroWeaponPose(u, dt, emit) {
  const m = u.mesh, sh = m.weap && m.weap.l; if (sh && sh.userData.q0) shieldHang(sh, dt);
  const g = m.weap && m.weap.r; if (!g || !g.userData.q0) return;
  const swing = /Atk|Death|Dead|Rise|Dodge/.test(m.curName || '') && m.cur && m.cur.isRunning(), drag = m.wset === 'GS' && !swing && !(u.spawnT > 0) ? 1 : 0;
  m.dragW = (m.dragW ?? drag) + (drag - (m.dragW ?? drag)) * Math.min(1, dt * 8);
  g.quaternion.copy(g.userData.q0); g.updateMatrixWorld(true); g.getWorldPosition(_p); g.parent.getWorldQuaternion(_qh); _qw.copy(_qh).multiply(g.userData.q0);
  _ax.copy(_up).applyQuaternion(_qw); _d.copy(_ax);
  const L = g.userData.tip, floor = m.root.position.y + 0.04;
  if (m.dragW > 0.002) { const f = u.face, h = Math.max(0.05, _p.y - floor), hor = Math.sqrt(Math.max(0.0025, L * L - h * h)), bx = -Math.sin(f) * 0.85 - Math.cos(f) * 0.45, bz = -Math.cos(f) * 0.85 + Math.sin(f) * 0.45, bl = Math.hypot(bx, bz);
    const tx = bx / bl * hor, tz = bz / bl * hor, ty = L > h ? -h : -L * 0.97, tl = Math.hypot(tx, ty, tz);
    _d.lerp(new _V(tx / tl, ty / tl, tz / tl), m.dragW).normalize(); }
  const tipY = _p.y + _d.y * L; // the floor stops the blade
  if (tipY < floor) { const y = Math.max(-1, (floor - _p.y) / L), hl = Math.hypot(_d.x, _d.z) || 1, k = Math.sqrt(1 - y * y) / hl; _d.set(_d.x * k, y, _d.z * k); }
  if (_d.distanceToSquared(_ax) > 1e-6) { _qr.setFromUnitVectors(_ax, _d); g.quaternion.copy(_qh.invert().multiply(_qr.multiply(_qw))); }
  if (emit && m.dragW > 0.7 && Math.hypot(u.vx, u.vz) > 0.6 && Math.random() < dt * 14) { const x = _p.x + _d.x * L, z = _p.z + _d.z * L;
    emit(x, floor + 0.02, z, Math.random() < 0.6 ? { col: 0xffb35a, spd: 1.4, up: 1.2, grav: 6, life: 0.3, size: 0.09 } : { col: 0x9a8f86, spd: 0.4, up: 0.4, grav: 0, life: 0.6, size: 0.22 }); }
}
export function clipLen(name) { const c = A.clips[name]; return c ? c.duration : 1; }
// play a clip (cross-fade). o.once: play one time; o.hold: keep the last frame; o.speed: time scale; o.restart: replay even if current
export function play(m, name, o = {}) {
  if (m.hero) { name = heroClip(name, m.wset); if (!name) return null; }
  const clip = (m.clips || A.clips)[name]; if (!clip) return null;
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
