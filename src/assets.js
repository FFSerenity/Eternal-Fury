// KayKit asset bundles (CC0, Kay Lousberg): characters with a shared rig + shared animation clips, weapons, dungeon, graveyard and forest props.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { toonMat, outlineMat, charUniforms, glowSprite, auraMat, realMat, ring, TEX as GTEX } from './gfx.js';
import { runeCircle } from './vfx.js';
import { ELEM, WEAPONS, ARMORS, QUAL } from './data.js';
import { PACT } from './state.js';

export const A = { chars: {}, clips: {}, props: {}, crits: {}, hero: null, heroClips: {}, heroWeap: {}, zy: null, ready: false };
const ZY_WEAP = new Set();
const CHAR_FILES = ['mage', 'sk_minion', 'sk_warrior', 'sk_rogue', 'sk_mage', 'hu_knight', 'hu_barbarian', 'hu_rogue', 'hu_rogue_hood'], PROP_FILES = ['weapons', 'dungeon', 'graveyard', 'forest', 'gen_props']; // (gen_props: the generated display stands, barrels, crates and urns — tools/pack-props.mjs)
const CRIT_FILES = ['fly_bat', 'fly_ghost', 'fly_wraith']; // the wilds' flying vermin: own rig, own clips (Quaternius)
export async function loadAll(onProgress = () => {}) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const jobs = [...CHAR_FILES.map(f => ['char', f]), ...CRIT_FILES.map(f => ['crit', f]), ['anims', 'anims'], ...PROP_FILES.map(f => ['props', f]),
    ...(PACT ? [['hero', 'hero'], ['heropack', 'hero_sns'], ['heropack', 'hero_gs'], ['heroweap', 'hero_weapons'], ['zy', 'hero_zy'], ['zyweap', 'hero_zyweap'], ...(globalThis.__extraPacks || []).map(n => ['heropack', n])] : [])]; // the realistic skeleton: 魂契 only (tests: more clip packs)
  let done = 0;
  await Promise.all(jobs.map(async ([kind, name]) => {
    const g = await loader.loadAsync(`assets/${name}.glb`);
    // colours are treated as display colours everywhere (no colour management), so textures must not be sRGB-decoded
    g.scene.traverse(o => { if (o.material && o.material.map) o.material.map.colorSpace = THREE.NoColorSpace; });
    if (kind === 'char') A.chars[name] = g.scene;
    else if (kind === 'crit') A.crits[name] = { scene: g.scene, clips: Object.fromEntries(g.animations.map(c => [c.name, c])) };
    else if (kind === 'anims') for (const c of g.animations) A.clips[c.name] = c;
    else if (kind === 'hero') { const fingers = heroFists(g.scene); for (const c of g.animations) { c.tracks = c.tracks.filter(t => !fingers.has(t.name.split('.')[0])); A.heroClips[c.name] = c; }
      if (A.heroClips.Stand) spreadArms(g.scene, A.heroClips.Stand, ...(globalThis.__spread || ARM_SPREAD));
      A.heroPlume = plumeMask(g.scene);
      A.hero = { scene: g.scene, clips: A.heroClips }; }
    else if (kind === 'heropack') for (const c of g.animations) A.heroClips[c.name] = c; // weapon-style clip packs: rig + clips only, same bone names
    else if (kind === 'heroweap') { for (const n of g.scene.children) if (!ZY_WEAP.has(n.name)) A.heroWeap[n.name] = n; }
    else if (kind === 'zyweap') for (const n of g.scene.children) { ZY_WEAP.add(n.name); A.heroWeap[n.name] = n; } // (Zhao Yun's spear, bow and quiver: his spear wins over the weapon sheet's, whichever file comes in first)
    else if (kind === 'zy') { const pl = zyPalms(g.scene); heroFists(g.scene, ZY_PALM); A.zy = { palm: pl, scene: g.scene, own: Object.fromEntries(g.animations.map(c => [c.name, c])) }; } // 赵云: the spear style's own model and motions
    else for (const n of g.scene.children) A.props[n.name] = n;
    onProgress(++done / jobs.length);
  }));
  if (A.hero) bakePosture(A.hero.scene, A.heroClips);
  A.ready = true;
}
// (tests: a model from anywhere, e.g. a newly generated weapon to try in the Sentinel's hand)
export const loadGLB = url => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l.loadAsync(url); };
// ---------- the Sentinel's bearing ----------
// Retargeted from Y Bot by aiming our bones along its bones, the Meshy rig stood with its feet tipped ~21° toe-up (its foot bones lie
// differently in the boot than Y Bot's) and its neck craned forward, the torso leaning back against it. A fixed turn per bone, pitched
// about the body's left-right axis, is baked into every clip at load: a constant turn after the bone's own, so every clip and every blend
// gets it. Degrees, + forward / toe-down (tests: globalThis.__posture)
// The stand (Mixamo's dazed Idle) also leans back from the ankles, hips behind the feet: it is tipped forward about the ankles (the hips'
// turn and place), the feet turned back so they stay flat (LEAN, degrees)
const POSTURE = { LeftFoot: 21, RightFoot: 21, Spine: 6, Spine2: -11, Neck: -15, Head: -3 }, LEAN = { Stand: 4 };
const pitchX = deg => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(deg));
function postMul(clip, D) { const q = new THREE.Quaternion(); // a constant turn after each named bone's own, every key
  for (const t of clip.tracks) { const [bn, prop] = t.name.split('.'), d = D[bn]; if (!d || prop !== 'quaternion') continue;
    const v = t.values; for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i).multiply(d); q.toArray(v, i); } } }
function bakePosture(scene, clips) {
  const P = { ...POSTURE, ...(globalThis.__posture || {}) }, D = {}; scene.updateMatrixWorld(true);
  for (const [n, deg] of Object.entries(P)) { const b = deg && findBone(scene, 'mixamorig:' + n); if (!b) continue;
    const W = b.getWorldQuaternion(new THREE.Quaternion()); D[b.name] = W.clone().invert().multiply(pitchX(deg)).multiply(W); }
  for (const c of Object.values(clips)) postMul(c, D);
  for (const [name, deg] of Object.entries({ ...LEAN, ...(globalThis.__lean || {}) })) if (clips[name] && deg) leanClip(scene, clips[name], deg);
}
function leanClip(scene, clip, deg) {
  const hips = findBone(scene, 'mixamorig:Hips'), feet = ['LeftFoot', 'RightFoot'].map(n => findBone(scene, 'mixamorig:' + n)); if (!hips || feet.some(f => !f)) return;
  const saved = []; scene.traverse(o => { if (o.isBone) saved.push([o, o.position.clone(), o.quaternion.clone()]); });
  const mixer = new THREE.AnimationMixer(scene), act = mixer.clipAction(clip); act.play(); act.time = 0; mixer.update(0); scene.updateMatrixWorld(true);
  const V = THREE.Vector3, Q = THREE.Quaternion, R = pitchX(deg), piv = feet.reduce((s, f) => s.add(f.getWorldPosition(new V())), new V()).multiplyScalar(0.5);
  const PM = hips.parent.matrixWorld.clone(), PMi = PM.clone().invert(), PQ = hips.parent.getWorldQuaternion(new Q()), RL = PQ.clone().invert().multiply(R).multiply(PQ);
  const DF = {}; for (const f of feet) { const W = f.getWorldQuaternion(new Q()); DF[f.name] = W.clone().invert().multiply(R.clone().invert()).multiply(W); } // (the feet: back to how they stood)
  act.stop(); mixer.uncacheRoot(scene); for (const [o, p, q] of saved) { o.position.copy(p); o.quaternion.copy(q); } scene.updateMatrixWorld(true);
  const q = new Q(), p = new V(), pw = new V();
  for (const t of clip.tracks) { const [bn, prop] = t.name.split('.'); if (bn !== hips.name) continue; const v = t.values;
    if (prop === 'quaternion') for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i).premultiply(RL); q.toArray(v, i); }
    if (prop === 'position') for (let i = 0; i < v.length; i += 3) { pw.fromArray(v, i).applyMatrix4(PM).sub(piv).applyQuaternion(R).add(piv).applyMatrix4(PMi); pw.toArray(v, i); } }
  postMul(clip, DF);
}
const findBone = (root, name) => root.getObjectByName(name) || root.getObjectByName(name.replace(/[[\]\.:\/]/g, ''));

// ---------- 赵云 (the spear style): his own model — Meshy 7.5 from a GPT picture, remeshed to 25k triangles, rigged and animated in Meshy
// (tools/zy-fix-rig.mjs, then tools/build-hero.mjs) — with his own motions (ZY_*) where Meshy had them, the Sentinel's clips moved over for the rest ----------
// His own clips stand in for the Sentinel's by name (ZY_ALIAS): the spear stance when he stands, the walk with the spear, the archer's aim.
// Any other clip is moved over the first time it is asked for (zyClips): each body bone's world turn away from the Sentinel's bind pose is
// given to the same bone of Zhao Yun's from his own (both stand in an A-pose; the Sentinel's clips already carry its posture fixes, so he
// gets the poses as they look, not its rig's quirks); the hips travel as the Sentinel's do, scaled by hip height.
export const ZY_ALIAS = { Stand: 'ZY_Combat_Stance', Walk_GS: 'ZY_Spear_Walk', Rise: 'ZY_Axe_Stance' }; // (Rise: his own, kneeling to standing with the spear grounded)
export const ZY_WALK_REF = 1.53; // his walk's stride speed at time scale 1, in his model's metres a second (the planted foot's travel)
let ZYR = null;
function zyRig() {
  if (ZYR) return ZYR; const S = A.hero.scene, Z = A.zy.scene, Q = THREE.Quaternion, V = THREE.Vector3; S.updateMatrixWorld(true); Z.updateMatrixWorld(true);
  const mx = o => o.isBone && o.name.startsWith('mixamorig'); // (the body: the rigs' own helper bones share names but not places)
  const sB = new Map(), zOrder = []; S.traverse(o => { if (mx(o)) sB.set(o.name, o); }); Z.traverse(o => { if (mx(o)) zOrder.push(o); }); // (parents first)
  const sOrder = []; S.traverse(o => { if (mx(o)) sOrder.push(o); });
  const wq = o => o.getWorldQuaternion(new Q()), RS = {}, RZ = {};
  for (const b of zOrder) { RZ[b.name] = wq(b); const s = sB.get(b.name); if (s) RS[b.name] = wq(s); }
  const sH = sB.get('mixamorigHips'), zH = zOrder.find(b => b.name === 'mixamorigHips'), ground = sc => { const b = new THREE.Box3().setFromObject(sc); return b.min.y; };
  const k = (zH.getWorldPosition(new V()).y - ground(Z)) / (sH.getWorldPosition(new V()).y - ground(S));
  return (ZYR = { sOrder, zOrder, RS, RZ, sH, zH, k, sHw: sH.getWorldPosition(new V()), zHw: zH.getWorldPosition(new V()), sPQ: wq(sH.parent), zPQ: wq(zH.parent),
    sPM: sH.parent.matrixWorld.clone(), zPMi: zH.parent.matrixWorld.clone().invert() });
}
function zyClip(c) {
  const R = zyRig(), Q = THREE.Quaternion, V = THREE.Vector3, tr = {}; let T = new Set();
  for (const t of c.tracks) { const [bn, prop] = t.name.split('.'); (tr[bn] = tr[bn] || {})[prop] = t; for (const x of t.times) T.add(x); }
  T = [...T].sort((a, b) => a - b);
  const ip = {}; for (const bn in tr) for (const p in tr[bn]) ip[bn + '.' + p] = tr[bn][p].createInterpolant(new Float32Array(p === 'quaternion' ? 4 : 3));
  const zb = R.zOrder.filter(b => tr[b.name] && tr[b.name].quaternion), outQ = Object.fromEntries(zb.map(b => [b.name, new Float32Array(T.length * 4)])), outP = new Float32Array(T.length * 3);
  const Ws = new Map(), Wz = new Map(), ql = new Q(), qa = new Q(), p = new V();
  T.forEach((t, i) => {
    for (const b of R.sOrder) { const iq = ip[b.name + '.quaternion']; ql.copy(b.quaternion); if (iq) ql.fromArray(iq.evaluate(t));
      Ws.set(b.name, (b.parent && b.parent.isBone && Ws.has(b.parent.name) ? Ws.get(b.parent.name) : R.sPQ).clone().multiply(ql)); }
    for (const b of R.zOrder) { const par = b.parent && b.parent.isBone && Wz.has(b.parent.name) ? Wz.get(b.parent.name) : R.zPQ, s = R.RS[b.name] && Ws.get(b.name);
      const w = s ? s.clone().multiply(qa.copy(R.RS[b.name]).invert()).multiply(R.RZ[b.name]) : par.clone().multiply(b.quaternion); Wz.set(b.name, w);
      if (outQ[b.name]) { const l = par.clone().invert().multiply(w); l.toArray(outQ[b.name], i * 4); } }
    const ipos = ip['mixamorigHips.position'];
    if (ipos) { p.fromArray(ipos.evaluate(t)).applyMatrix4(R.sPM).sub(R.sHw).multiplyScalar(R.k).add(R.zHw).applyMatrix4(R.zPMi); p.toArray(outP, i * 3); }
  });
  const tracks = zb.map(b => new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', T, outQ[b.name]));
  if (ip['mixamorigHips.position']) tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', T, outP));
  return new THREE.AnimationClip(c.name, c.duration, tracks);
}
const ZYC = {};
export const zyClips = new Proxy(ZYC, { get(t, k) { if (typeof k !== 'string') return undefined;
  if (!(k in t)) { const own = A.zy && A.zy.own, c = A.heroClips[k]; t[k] = (own && own[ZY_ALIAS[k] || k]) || (c && A.zy ? zyClip(c) : undefined); } return t[k]; } });
// his palms in the rest (A-)pose, world: the thinnest way across the hand's skinned vertices, toward his body and down (tools/zy-palm.mjs;
// Meshy's A-pose holds them in, down and back). The fingers curl toward them (heroFists), and gripHand turns the palm by them
export const ZY_PALM = { Left: [-0.823, -0.453, -0.342], Right: [0.835, -0.451, -0.316] };
function zyPalms(scene) { scene.updateMatrixWorld(true); const out = {}; // (each in its hand bone's own frame: carried along however the hand turns)
  for (const S of ['Left', 'Right']) { const h = findBone(scene, `mixamorig:${S}Hand`); if (h) out[S[0]] = new THREE.Vector3(...ZY_PALM[S]).normalize().applyQuaternion(h.getWorldQuaternion(new THREE.Quaternion()).invert()); }
  return out; }
// a weapon in his fist: the grip in the middle of the curled fingers (as the Sentinel's). The spear lies along a line fitted on the clips,
// from the right fist toward the left one, in the right hand's frame — two lines, as his hands hold it two ways: on his own motions (the
// spear stance: the left fist leads, the point goes on past it) and on the Sentinel's two-handed clips moved over to him (the left fist
// holds the shaft lower down: the point goes away from it). heroWeaponPose turns it to the one for what is playing (zyOwn)
function fistAt(model, S) { const hand = findBone(model, `mixamorig:${S}Hand`), V = THREE.Vector3; if (!hand) return null;
  const ch = heroChains(hand, null), top = Math.max(...ch.map(c => c[0].getWorldPosition(new V()).y)); // (the thumb by name; else the top chain, as in the A-pose)
  const thumb = ch.find(c => /Thumb/.test(c[0].name)) || ch.find(c => c[0].getWorldPosition(new V()).y >= top - 1e-4), fingers = ch.filter(c => c !== thumb);
  const p = new V(); let n = 0; for (const c of fingers.length ? fingers : ch) for (const b of c) { p.add(b.getWorldPosition(new V())); n++; } return n ? p.divideScalar(n) : hand.getWorldPosition(p); }
const ZY_LINES = {}, ZY_LINE_CLIPS = { own: [['ZY_Combat_Stance'], 1], gs: [['GS_Atk2', 'GS_Atk3', 'GS_Atk4', 'GS_Idle'], -1] };
function zyLine(k) {
  if (ZY_LINES[k]) return ZY_LINES[k]; const m = skClone(A.zy.scene), mixer = new THREE.AnimationMixer(m), V = THREE.Vector3, Q = THREE.Quaternion, acc = new V();
  const R = findBone(m, 'mixamorig:RightHand'), [clips, sign] = ZY_LINE_CLIPS[k];
  for (const n of clips) { const c = zyClips[n]; if (!c) continue; const a = mixer.clipAction(c); a.play();
    for (let i = 0; i < 12; i++) { a.time = c.duration * (i + 0.5) / 12; mixer.update(0); m.updateMatrixWorld(true);
      const d = fistAt(m, 'Left').sub(fistAt(m, 'Right')); if (d.length() < 0.05) continue; acc.add(d.normalize().applyQuaternion(R.getWorldQuaternion(new Q()).invert())); }
    a.stop(); }
  mixer.uncacheRoot(m); return (ZY_LINES[k] = acc.lengthSq() > 0 ? acc.normalize().multiplyScalar(sign) : new V(0, -1, 0));
}
// one of his clips split into legs (hips down) and the rest: walking into a fight he walks on his legs with the spear stance above
export function zyPart(name, part) { const key = name + '@' + part; if (ZYC[key]) return key; const c = zyClips[name]; if (!c) return name;
  ZYC[key] = new THREE.AnimationClip(key, c.duration, c.tracks.filter(t => /Hips|UpLeg|Leg|Foot|Toe/.test(t.name.split('.')[0]) === (part === 'lower'))); return key; }
export const zyOwn = name => !!name && (name.startsWith('ZY_') || !!ZY_ALIAS[name]); // (a clip of his own is playing)
// the bow stands upright in his left fist while he shoots (the archer's aim, his own clip: world up, in the left hand's frame)
export const ZY_BOW_CLIP = ['ZY_Archery_Shot_2', 0.5];
let ZY_BOW = null;
function zyBowAxis() {
  if (ZY_BOW) return ZY_BOW; const m = skClone(A.zy.scene), mixer = new THREE.AnimationMixer(m), L = findBone(m, 'mixamorig:LeftHand'), c = zyClips[ZY_BOW_CLIP[0]], Q = THREE.Quaternion;
  if (c) { const a = mixer.clipAction(c); a.play(); a.time = c.duration * ZY_BOW_CLIP[1]; mixer.update(0); m.updateMatrixWorld(true); }
  ZY_BOW = new THREE.Vector3(0, 1, 0).applyQuaternion(L.getWorldQuaternion(new Q()).invert()); mixer.uncacheRoot(m); return ZY_BOW;
}
function zyGrip(model, side, name, u, outline, it) {
  const src = A.heroWeap[name], S = side === 'r' ? 'Right' : 'Left', hand = findBone(model, `mixamorig:${S}Hand`); if (!src || !hand) return null;
  const V = THREE.Vector3, Q = THREE.Quaternion; model.updateMatrixWorld(true);
  const at = fistAt(model, S), HQ = hand.getWorldQuaternion(new Q());
  const turn = F => { const up0 = Math.abs(F.y) < 0.9 ? new V(0, 1, 0) : new V(0, 0, 1), X = new V().crossVectors(up0, F).normalize(), Zv = new V().crossVectors(X, F).normalize();
    return new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, F, Zv)); };
  // the weapon's axis in world: the spear along a fitted line (his own motions' to start with); the bow upright as he aims
  const g = mountWeapon(hand, src, name, at, turn((name === 'spear' ? zyLine('own') : zyBowAxis()).clone().applyQuaternion(HQ)), u, outline, it);
  if (g && name === 'spear') { const hq = HQ.clone().invert(); g.userData.qOwn = g.userData.q0.clone(); g.userData.qGS = hq.multiply(turn(zyLine('gs').clone().applyQuaternion(HQ))); g.userData.ownW = 1; }
  return g;
}
// the bow on his back when he fights with the spear: across the shoulders, string outward, slung from the upper spine
function zyBack(model, name, u, outline) {
  const src = A.heroWeap[name], sp = findBone(model, 'mixamorig:Spine2'); if (!src || !sp) return null; model.updateMatrixWorld(true);
  const V = THREE.Vector3, Q = THREE.Quaternion, c = sp.getWorldPosition(new V()), s = model.getWorldScale(new V()).x;
  const F = new V(0.55, 1, 0).normalize(), X = new V(0, 0, 1), Zv = new V().crossVectors(X, F).normalize(), W = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V().crossVectors(F, Zv), F, Zv));
  return mountWeapon(sp, src, name, c.add(new V(0, 0, -0.17 * s)), W, u, outline, null);
}

// his quiver on his right hip, hung from the belt: arrows up, leaning back and a little out, its dragon facing outward
function zyHip(model, name, u, outline) {
  const src = A.heroWeap[name], hips = findBone(model, 'mixamorig:Hips'); if (!src || !hips) return null; model.updateMatrixWorld(true);
  const V = THREE.Vector3, Q = THREE.Quaternion, s = model.getWorldScale(new V()).x, c = hips.getWorldPosition(new V());
  const F = new V(-0.2, 1, -0.32).normalize(), Zr = new V(-1, 0, -0.35); Zr.sub(F.clone().multiplyScalar(Zr.dot(F))).normalize();
  const W = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V().crossVectors(F, Zr), F, Zr));
  return mountWeapon(hips, src, name, c.add(new V(-0.2 * s, -0.12 * s, -0.1 * s)), W, u, outline, null);
}
// the bones whose middle is the fist (the fingers, not the thumb): where a hand holds what it holds, every frame
function fistBones(model, S) { const hand = findBone(model, `mixamorig:${S}Hand`); if (!hand) return [];
  const ch = heroChains(hand, null), top = Math.max(...ch.map(c => c[0].getWorldPosition(new THREE.Vector3()).y));
  const thumb = ch.find(c => /Thumb/.test(c[0].name)) || ch.find(c => c[0].getWorldPosition(new THREE.Vector3()).y >= top - 1e-4);
  return ch.filter(c => c !== thumb).flat(); }
const fistW = (bs, out) => { out.set(0, 0, 0); for (const b of bs) out.add(b.getWorldPosition(_fb)); return out.divideScalar(bs.length || 1); };

// Zhao Yun made ready while the game loads: one of him built (his spear's and bow's lines fitted, the clips they need moved over), his
// shaders compiled and his textures sent to the GPU — the first time he appeared it took the best part of a second (a new shader, seven
// textures to decode and upload), the game stood still
export function prewarmHero(renderer, scene, camera) {
  if (!A.zy || !A.hero) return; const m = makeHeroMesh({ hero: true, wset: 'SPR' }); if (m.weap.bowL) m.weap.bowL.visible = true;
  m.root.position.set(0, -50, 0); scene.add(m.root); m.root.updateMatrixWorld(true);
  try { renderer.compile(scene, camera); const seen = new Set();
    m.root.traverse(o => { if (!o.material) return; for (const v of Object.values(o.material.uniforms || {})) if (v && v.value && v.value.isTexture && !seen.has(v.value)) { seen.add(v.value); renderer.initTexture(v.value); } });
  } finally { scene.remove(m.root); m.mixer.uncacheRoot(m.model); }
}

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
// the 魂契 skeleton's weapons as props (loot on the ground, bag icons): baked from the hero weapon pack, sized so that at the props' usual
// 0.5 scale they lie at their real length; HW_GEO keeps the unscaled bake for the quality aura in its hand
const HW_GEO = {}, HW_LEN = { greatsword: 3.4, sword: 2.2, mace: 2.0, shield: 1.7, spear: 4.4, bow: 2.6 };
export const hwGeo = name => HW_GEO[name] || (A.heroWeap[name] ? (HW_GEO[name] = bakeProp(A.heroWeap[name])) : null);
for (const n of Object.keys(HW_LEN)) CUSTOM_PROPS['hw_' + n] = () => { const b = hwGeo(n); if (!b) return null; const h = b.box.max.y - b.box.min.y, geo = b.geo.clone().scale(HW_LEN[n] / h, HW_LEN[n] / h, HW_LEN[n] / h);
  geo.computeBoundingBox(); geo.computeBoundingSphere(); return { geo, map: b.map, box: geo.boundingBox }; };
// the graveyard arch with its two gate leaves swung wide open (toward the arch's +z side): the way out of the camp into the wilds
CUSTOM_PROPS.arch_gate_open = () => {
  const root = A.props.arch_gate, b = new THREE.Box3(), c = new THREE.Vector3(), H = new THREE.Matrix4();
  return bakeProp(root, (o, M) => { if (!/gate_(left|right)/.test(o.name)) return;
    o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(M); b.getCenter(c); const hx = c.x < 0 ? b.min.x : b.max.x, a = c.x < 0 ? -1.85 : 1.85;
    M.premultiply(H.makeTranslation(-hx, 0, -c.z)).premultiply(H.makeRotationY(a)).premultiply(H.makeTranslation(hx, 0, c.z)); });
};
// a chest in two parts (loot.js opens it): the box, and its lid in a bake of its own with the hinge — the lid's back bottom edge — at the
// origin, so it can swing open; lid.hinge: where that is in the whole chest
for (const k of ['chest', 'chest_gold']) {
  CUSTOM_PROPS[k + '_body'] = () => bakeProp(A.props[k], o => (/_lid/.test(o.name) || /_lid/.test(o.parent && o.parent.name) ? false : undefined));
  CUSTOM_PROPS[k + '_lid'] = () => { const b = bakeProp(A.props[k], o => (/_lid/.test(o.name) || /_lid/.test(o.parent && o.parent.name) ? undefined : false)), h = new THREE.Vector3(0, b.box.min.y, b.box.min.z);
    b.geo.translate(0, -h.y, -h.z); b.geo.computeBoundingBox(); b.geo.computeBoundingSphere(); return { ...b, box: b.geo.boundingBox, hinge: h }; };
}
const MAT_CACHE = {};
export function propMat(map, o = {}) { const k = (map ? map.uuid : 'none') + JSON.stringify(o); return MAT_CACHE[k] || (MAT_CACHE[k] = toonMat({ ...o, map, vc: !!o.vc })); }
// textures made in code, picked by name in a PropBatch option ({ tex: 'forest' })
export const TEX = {};
// collects placements and builds one InstancedMesh per prop type
export class PropBatch {
  constructor(o = {}) { this.items = {}; this.o = o; }
  add(name, x, y, z, rotY = 0, s = 0.5, sy = null, sx = null, col = null) { const it = [x, y, z, rotY, sx ?? s, sy ?? s, s, col]; (this.items[name] = this.items[name] || []).push(it); return it; } // (after build: it.im, it.ix — its instance)
  // instances are split into square chunks so that off-screen parts of the map are frustum-culled
  build(group, chunk = 8) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), out = [];
    for (const name in this.items) { const pg = propGeo(name); if (!pg) continue; const mo = this.o[name] || this.o.all || {}, mat = propMat(mo.tex ? TEX[mo.tex] : pg.map, mo), parts = new Map();
      for (const it of this.items[name]) { const k = Math.floor(it[0] / chunk) * 1000 + Math.floor(it[2] / chunk); let a = parts.get(k); if (!a) parts.set(k, a = []); a.push(it); }
      for (const list of parts.values()) { const im = new THREE.InstancedMesh(pg.geo, mat, list.length), tint = list.some(it => it[7]);
        list.forEach((it, i) => { const [x, y, z, r, sx, sy, sz, col] = it; it.im = im; it.ix = i; e.set(0, r, 0); q.setFromEuler(e); m.compose(p.set(x, y, z), q, sc.set(sx, sy, sz)); im.setMatrixAt(i, m);
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
// the wilds' foes (data.js FOES): the Adventurers with the weapons each carries shown (show: the hand-slot meshes kept; hide: a hat or
// helmet taken off — the same model bare-headed is another foe), or a flying creature with its own clips (crit) hovering at hover
export const FOE_LOOK = {
  robber:    { file: 'hu_rogue_hood', scale: 0.46, show: ['Knife', 'Knife_Offhand'] },
  raider:    { file: 'hu_barbarian', scale: 0.5, show: ['1H_Axe', '1H_Axe_Offhand'], hide: ['Barbarian_Hat'] },
  xbow:      { file: 'hu_rogue', scale: 0.48, show: ['2H_Crossbow'] },
  squire:    { file: 'hu_knight', scale: 0.48, show: ['1H_Sword', 'Round_Shield'], hide: ['Knight_Helmet', 'Knight_Cape'] },
  templar:   { file: 'hu_knight', scale: 0.56, show: ['1H_Sword', 'Badge_Shield'] },
  headsman:  { file: 'hu_knight', scale: 0.58, show: ['2H_Sword'], tint: 0x8c8492 },
  berserker: { file: 'hu_barbarian', scale: 0.6, show: ['2H_Axe'] },
  exorcist:  { file: 'mage', scale: 0.5, show: ['1H_Wand', 'Spellbook_open'] },
  bat:       { crit: 'fly_bat', scale: 0.3, hover: 0.75 },
  ghost:     { crit: 'fly_ghost', scale: 0.24, hover: 0.3, ghost: 0x9a6cff },
  wraith:    { crit: 'fly_wraith', scale: 0.29, hover: 0.35, ghost: 0x6cf0ff },
};
// the hand-slot item a mesh belongs to (its own name, or its parent's when the loader split it into primitives)
const slotItem = obj => { let o = obj; while (o.parent && !/^handslot/.test(o.parent.name)) { o = o.parent; if (!o.parent) return null; } return o.parent ? o.name : null; };
// height of the soul flame above the head bone (KayKit units; hats and helmets are taller)
const SOUL_Y = { imp: 1.2, brute: 1.45, archer: 1.3, shaman: 1.6 };
const SPHERE = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 2.4);
// a unit's visual: root (position / facing, unscaled: rings live here) -> model (scaled KayKit character)
export function makeUnitMesh(kind, o = {}) {
  if (o.hero && A.hero) return makeHeroMesh(o);
  const fl = o.foe && FOE_LOOK[o.foe]; if (fl && fl.crit) return makeCritMesh(fl, o);
  const def = fl || CHARS[kind], model = skClone(A.chars[def.file]), u = charUniforms(o), mats = new Map();
  const olW = o.outlineW ?? 0.05, olSk = outlineMat(o.outline ?? 0x120a10, olW, u.uFade), adds = [];
  const matFor = map => { if (!mats.has(map)) mats.set(map, toonMat({ u, map, vc: false })); return mats.get(map); };
  const tl = o.gear && o.gear.w && o.gear.w.uniq && TECH_LOOK[o.gear.w.uniq], hideX = tl && tl.kind === kind && tl.hide || null; // a tech look can swap out part of the model (the mech's helmet)
  let blade0 = null; // a foe's own blade (for the swing trail)
  model.traverse(obj => {
    if (!obj.isMesh) return;
    if ((def.hide && def.hide.includes(obj.name)) || (hideX && hideX.includes(obj.name))) { obj.visible = false; return; }
    if (def.show) { const it = slotItem(obj); if (it && !def.show.includes(it)) { obj.visible = false; return; } if (it && !blade0 && /Sword|Axe|Knife/.test(it) && !/Offhand/.test(it) && (kind === 'imp' || kind === 'brute')) blade0 = obj; }
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
  if (blade0 && !blade) { blade0.geometry.computeBoundingBox(); const bb = blade0.geometry.boundingBox, zm = (bb.max.z + bb.min.z) / 2, a = new THREE.Object3D(), b2 = new THREE.Object3D();
    a.position.set(0, bb.max.y * 0.32, zm); b2.position.set(0, bb.max.y * 1.02, zm); blade0.add(a, b2); blade = { a, b: b2, col: el ? el.col : 0xffe2c8 }; }
  if (fl && fl.tint) u.uTint.value.multiply(new THREE.Color(fl.tint));
  model.scale.setScalar(def.scale * (o.scale ?? 1) * (gunner ? look.scale : 1));
  const root = new THREE.Group(); root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  return { root, model, pivot: model, mixer, actions: {}, cur: null, curName: '', mat: { uniforms: u }, out: { material: { uniforms: { uFade: u.uFade } } }, u, tips, glows, soul, gun, muz, drill, rod, blade, aura, elem: el ? elems[0] : null, elems, sc: def.scale };
}
// a flying creature (Quaternius, its own rig and clips): hovers at def.hover, bobbing (units.js animate); a ghost glows from inside
const CRIT_TIPS = ['Head', 'Torso', 'LowerArm.L', 'LowerArm.R', 'Body2'];
function makeCritMesh(def, o) {
  const C0 = A.crits[def.crit], model = skClone(C0.scene), u = charUniforms(o), olW = (o.outlineW ?? 0.05) * 1.2, olSk = outlineMat(o.outline ?? 0x120a10, olW, u.uFade), adds = [], mats = new Map();
  const matFor = map => { if (!mats.has(map)) mats.set(map, toonMat({ u, map, vc: false })); return mats.get(map); };
  model.traverse(obj => { if (!obj.isMesh) return; obj.material = matFor(obj.material.map); obj.castShadow = obj.receiveShadow = false; obj.frustumCulled = false;
    if (obj.isSkinnedMesh) { const ol = new THREE.SkinnedMesh(obj.geometry, olSk); ol.bind(obj.skeleton, obj.bindMatrix); ol.frustumCulled = false; adds.push([obj.parent, ol]); } });
  for (const [p, ol] of adds) p.add(ol);
  const elems = (o.elems || []).filter(m => ELEM[m]), el = elems.length ? ELEM[elems[0]] : null, tips = [], glows = [];
  if (el) { u.uRim.value.set(el.col).multiplyScalar(0.95); u.uEmis.value.set(el.emis).multiplyScalar(0.3); for (const n of CRIT_TIPS) { const b = model.getObjectByName(n); if (b) tips.push(b); } }
  let core = null; if (def.ghost) { if (!el) { u.uRim.value.setHex(def.ghost).multiplyScalar(0.9); u.uEmis.value.setHex(def.ghost).multiplyScalar(0.22); }
    const t = model.getObjectByName('Torso') || model; core = new THREE.Group(); t.add(core); const a = glowSprite(def.ghost, 2.6, 0.5), c = glowSprite(0xffffff, 0.8, 0.45); core.add(a, c); glows.push(a, c); }
  model.scale.setScalar(def.scale * (o.scale ?? 1)); model.position.y = def.hover;
  const root = new THREE.Group(); root.add(model);
  return { root, model, pivot: model, mixer: new THREE.AnimationMixer(model), clips: C0.clips, actions: {}, cur: null, curName: '', mat: { uniforms: u }, out: { material: { uniforms: { uFade: u.uFade } } }, u, tips, glows,
    soul: null, gun: null, muz: null, drill: null, rod: null, blade: null, aura: null, elem: el ? elems[0] : null, elems, sc: def.scale, fly: def.hover, ghost: def.ghost || 0, core };
}
// ---------- the realistic hero skeleton (魂契 mode; modelled with Meshy, Mixamo rig, CC BY 4.0) ----------
// its own model and clips; the game asks for KayKit clip names, heroClip() maps them onto the few the hero has
const HERO_H = 2.25; // world height (realistic proportions are slim: it has to stand a head taller than the chunky KayKit warriors to read as the hero)
// weapon sets: a prefix on the pack's clip names (SNS_Idle, GS_Atk1 ...) and the weapons held in each hand
export const HERO_SETS = {
  // (not SNS_Atk1, a pommel strike, nor GS_Atk1, which swings high over the heads of anything its size)
  SNS: { r: 'sword', l: 'shield', atk: ['SNS_Atk2', 'SNS_Atk3'] },
  GS: { r: 'greatsword', atk: ['GS_Atk2', 'GS_Atk3', 'GS_Atk4'] },
  // the mace and shield (圣骑士): fights on the sword-and-shield clips (clips: whose clips), but holy — gold armour, the soul light gold
  PAL: { r: 'mace', l: 'shield', atk: ['SNS_Atk2', 'SNS_Atk3'], clips: 'SNS', walk: 'Walk_GS', holy: true }, // (walk: the calm, upright one — the mace hangs at its side)
  // the spear (长枪): the skeleton becomes 赵云 — his own model (model: 'zy') on the two-handed clips, the calm walk with the spear carried
  // upright; his bow slung across his back (back)
  SPR: { r: 'spear', atk: ['SNS_Lunge', 'GS_Atk2', 'SNS_Lunge', 'GS_Atk3'], clips: 'GS', walk: 'Walk_GS', model: 'zy', back: 'bow', hip: 'quiver' }, // (a thrust every other blow)
};
// the holy light (圣骑士): its colour, the white-hot of it, and the gold of a swing's trail
export const HOLY_C = 0xffcf66, HOLY_HOT = 0xfff4d6, HOLY_TRAIL = 0xffe08a, HOLY_AURA_R = 7; // (the reach of its Aura of Light at 25 Fury: holy.js)
export function heroClip(n, set) {
  if (n.startsWith('ZY_')) return n; // (Zhao Yun's own, asked for by name)
  const C = A.heroClips, p = set ? set + '_' : '#', pick = (...ks) => ks.find(k => C[k]) || null;
  if (C[p + n]) return p + n; if (C[n]) return n;
  if (/Death|Die/.test(n)) return pick(p + 'Death', 'Dead');
  if (/Attack|Chop|Slice|Stab|Spin|Melee/.test(n)) return pick(p + 'Atk2', 'Attack');
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
function heroChains(hand, palm) { // (finger chains only: Meshy's rigs also hang stray bones under the hands, some with their heads on the floor)
  const chains = [], V = THREE.Vector3; if (!hand) return chains; hand.updateMatrixWorld(true);
  const hp = hand.getWorldPosition(new V()), near = 0.6 * hp.distanceTo(hand.parent.getWorldPosition(new V())); // (well within a forearm's length of the wrist)
  for (const p of [hand, palm]) if (p && (p === hand || p.parent === hand)) for (const c of p.children) if (c.isBone && c !== palm && c.getWorldPosition(new V()).distanceTo(hp) < near) {
    const ch = []; let b = c; while (b) { ch.push(b); b = b.children.find(k => k.isBone); } chains.push(ch); }
  return chains;
}
function heroFists(scene, palms) { // (palms: each hand's palm in the rest pose, world; the Sentinel's face forward)
  const names = new Set(), V = THREE.Vector3, Q = THREE.Quaternion; scene.updateMatrixWorld(true);
  const wp = b => b.getWorldPosition(new V()); let n = new V(0, 0, 1);
  const turn = (b, axW, ang) => { b.quaternion.multiply(new Q().setFromAxisAngle(axW.clone().applyQuaternion(b.getWorldQuaternion(new Q()).invert()), ang)); b.updateMatrixWorld(true); };
  for (const [hand, palm] of [['mixamorig:LeftHand', 'Bone_024'], ['mixamorig:RightHand', 'Bone_019']]) {
    if (palms) n = new V(...palms[hand.slice(10, -4)]).normalize();
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
  const set = HERO_SETS[o.wset], holy = !!(set && set.holy), zy = !!(set && set.model === 'zy' && A.zy), plume = !zy && !!A.heroPlume;
  const model = skClone(zy ? A.zy.scene : A.hero.scene), u = charUniforms(o), adds = []; let mat = null;
  u.uPl = { value: new THREE.Vector4(0, 0, 0, 0) }; u.uPlFx = { value: new THREE.Vector4(0, 0, 0, globalThis.__plumeDbg ? 1 : 0) };
  u.uLook = { value: zy ? new THREE.Vector3(0.9, 0, 1) : new THREE.Vector3(1.3, 1, 0) }; // (Zhao Yun: his own albedo as Meshy made it, no eye glow in his blue cloth, polished silver)
  u.uSoul = { value: new THREE.Vector4(0, 0, 0, 0) }; u.uSoulC = { value: new THREE.Color(holy ? HOLY_C : SOUL_C) }; u.uHoly = { value: holy ? 1 : 0 };
  model.traverse(obj => { if (!obj.isMesh) return; const sm = obj.material;
    mat = mat || realMat({ u, map: sm.map, nmap: sm.normalMap, mr: sm.roughnessMap || sm.metalnessMap, plume });
    obj.material = mat; obj.frustumCulled = false;
    if (obj.isSkinnedMesh) { const ol = new THREE.SkinnedMesh(obj.geometry, outlineMat(o.outline ?? 0x0c080c, 0.012, u.uFade)); ol.bind(obj.skeleton, obj.bindMatrix); ol.frustumCulled = false; adds.push([obj.parent, ol]); } });
  for (const [p, ol] of adds) p.add(ol);
  const box = new THREE.Box3().setFromObject(model), h = Math.max(0.1, box.max.y - box.min.y);
  model.scale.setScalar(HERO_H / h * (o.scale ?? 1));
  // the soul fire in its eye sockets, as a glow that carries across the room (hung on the head bone so it follows the animation)
  const glows = [], head = findBone(model, 'mixamorig:Head');
  if (head && !zy) { model.updateMatrixWorld(true); const hp = head.getWorldPosition(new THREE.Vector3()), ws = head.getWorldScale(new THREE.Vector3()).x || 1; // (not Zhao Yun: a man's eyes)
    const g = glowSprite(holy ? HOLY_C : SOUL_C, 0.42 / ws, 0.75); g.position.copy(head.worldToLocal(hp.add(new THREE.Vector3(0, 0.09 * HERO_H / 1.85, 0.1 * HERO_H / 1.85)))); head.add(g); glows.push(g); }
  const weap = {};
  const gear = o.gear; // (its own gear: no shield in the slot, none on the arm; the weapon glows in its quality colour)
  if (set) for (const side of ['r', 'l']) if (set[side] && !(side === 'l' && gear && !gear.a)) weap[side] = (zy ? zyGrip : heroGrip)(model, side, set[side], u, o.outline, gear && gear[side === 'r' ? 'w' : 'a']);
  if (zy && set.back) { weap.back = zyBack(model, set.back, u, o.outline); weap.bowL = zyGrip(model, 'l', set.back, u, o.outline, null); if (weap.bowL) weap.bowL.visible = false; } // (the bow: on his back, in his left hand only to shoot)
  if (zy && set.hip) weap.hip = zyHip(model, set.hip, u, o.outline); // (his quiver on his right hip)
  const fists = zy ? { R: fistBones(model, 'Right'), L: fistBones(model, 'Left') } : null;
  const grip = zy ? Object.fromEntries(['Right', 'Left'].map(S => [S[0], { hand: findBone(model, `mixamorig:${S}Hand`), fore: findBone(model, `mixamorig:${S}ForeArm`), mid: findBone(model, `mixamorig:${S}HandMiddle1`), pky: findBone(model, `mixamorig:${S}HandPinky1`), bones: fists[S[0]], palm: A.zy.palm[S[0]] }])) : null;
  // sparks rise from points along the crest's rim (hung on the head bone)
  const plumePts = []; let plumeGlow = null;
  if (head && plume) { for (const p of A.heroPlume.pts) { const d = new THREE.Object3D(); d.position.copy(p); head.add(d); plumePts.push(d); }
    // a halo over the crest for the fiery tiers (reads from the game camera, where the crest itself is small)
    const ws = head.getWorldScale(new THREE.Vector3()).x || 1; plumeGlow = glowSprite(0xffffff, 0.9 / ws, 0); plumeGlow.position.copy(A.heroPlume.c); plumeGlow.visible = false; head.add(plumeGlow); }
  const blade = weap.r && weap.r.userData.edge ? { a: weap.r.userData.edge[0], b: weap.r.userData.edge[1], col: holy ? HOLY_TRAIL : PLUME_TIERS[0].trail } : null;
  const root = new THREE.Group(); root.add(model);
  const sg = soulGlow(model, root, head, holy ? HOLY_C : SOUL_C), hl = holy ? holyLight(model, root, head) : null;
  return { root, model, pivot: model, mixer: new THREE.AnimationMixer(model), actions: {}, cur: null, curName: '', mat: { uniforms: u }, out: { material: { uniforms: { uFade: u.uFade } } }, u,
    tips: [], glows, plumeGlow, soul: null, gun: null, muz: null, drill: null, rod: null, blade, aura: null, elem: null, elems: [], hero: true, zy, fists, grip, clips: zy ? zyClips : A.heroClips, wset: set ? set.clips || o.wset : null, style: set ? o.wset : null, walk: set ? set.walk || 'Walk_' + (set.clips || o.wset) : 'Walk_SNS', holy, atk: set ? set.atk : ['Attack'], atkI: 0, weap, plumePts, sg, hl };
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
const WEAP_FIT = { sword: { len: 1.15, back: 0 }, greatsword: { len: 1.75, back: 0 }, shield: { len: 0.95, back: 0.12, at: 0.55 }, axe: { len: 1.05, back: 0 }, spear: { len: 2.6, back: 0 }, mace: { len: 1.0, back: 0 }, bow: { len: 1.35, back: 0 }, quiver: { len: 0.8, back: 0 } };
const MAT_W = new Map();
const GRIP_F = [0.565, 0.82, -0.092]; // blade direction in the grip frame (fingers, thumb side, palm); fitted on the two-handed clips (tests: globalThis.__gripF)
function heroGrip(model, side, name, u, outline, it) {
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
  return mountWeapon(bone, src, name, at, new THREE.Quaternion().setFromRotationMatrix(W), u, outline, it);
}
// a weapon model under a bone: at a world point, turned to a world rotation W (its +y the blade / shaft), sized to WEAP_FIT, outlined,
// with its quality aura; the blade's edge points kept for swing trails
function mountWeapon(bone, src, name, at, W, u, outline, it) {
  const V = THREE.Vector3, fit = WEAP_FIT[name] || { len: 1, back: 0 };
  const g = new THREE.Group();
  let sm = null; src.traverse(o => { if (o.isMesh && !sm) sm = o.material; }); // (one material per unit and texture: Zhao Yun's spear and bow differ)
  let mm = MAT_W.get(u); if (!mm) MAT_W.set(u, mm = new Map()); let mat = mm.get(sm.map);
  if (!mat) { mat = realMat({ u, map: sm.map, nmap: sm.normalMap, mr: sm.roughnessMap || sm.metalnessMap }); mm.set(sm.map, mat); }
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
  if (name !== 'shield') { const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, a = new THREE.Object3D(), b = new THREE.Object3D(); // the edge, for swing trails
    a.position.set(cx, box.max.y * 0.3, cz); b.position.set(cx, box.max.y, cz); g.add(a, b); g.userData.edge = [a, b]; }
  if (it && it.q >= 2) { const b = hwGeo(name); if (b) { const h = b.box.max.y - b.box.min.y, au = new THREE.Mesh(b.geo, auraMat(QUAL[it.q].hex, b.box.max.y, u.uFade, 0.022 * h, it.q >= 4 ? 2 : it.q === 3 ? 1.7 : 1.45));
    au.renderOrder = 3; w.add(au); } }
  if (it && it.q) { g.userData.q = it.q; g.userData.box = box; }
  bone.add(g); return g;
}
// after the skeleton is posed each frame: a blade never sinks into the floor, and out of a swing the greatsword is dragged along the
// ground behind it (tip on the floor, a little to its right; sparks while it walks) instead of hanging straight down through it
const HANG = [1, 0.2, 0.18]; // the carried mace's direction: forward, up, out to its right — held out nearly level, head a little up (tests: globalThis.__hang)
const _V = THREE.Vector3, _fb = new _V(), _fr = new _V(), _fl = new _V(), _zd = new _V(), _hg = new _V(), _p = new _V(), _ax = new _V(), _d = new _V(), _qh = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _up = new _V(0, 1, 0);
// ---------- the helmet crest (鬃毛): its colour and fire show the skeleton's level ----------
// Found once on load: head-weighted vertices near the head's middle plane that stand outside the helmet itself (worked in the head
// bone's bind frame, axes from the world, sizes relative to the helmet's half width). aPlume = (membership, 0 at the helmet .. 1 at
// the fin's outer rim, 0 front .. 1 back along the arc); pts: points on the rim in the head bone's frame, for sparks
function plumeMask(scene) {
  let sk = null; scene.traverse(o => { if (o.isSkinnedMesh && (!sk || o.geometry.attributes.position.count > sk.geometry.attributes.position.count)) sk = o; });
  if (!sk) return null; const bones = sk.skeleton.bones, hi = bones.findIndex(b => /Head$/.test(b.name)), ti = bones.findIndex(b => /HeadTop_End$/.test(b.name)); if (hi < 0) return null;
  const g = sk.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, N = P.count, V = THREE.Vector3;
  const Bi = sk.skeleton.boneInverses[hi], Mi = new THREE.Matrix4().multiplyMatrices(Bi, sk.bindMatrix), R = new THREE.Matrix3().setFromMatrix4(Bi);
  const L = new V(1, 0, 0).applyMatrix3(R).normalize(), U = new V(0, 1, 0).applyMatrix3(R).normalize(), F = new V(0, 0, 1).applyMatrix3(R).normalize();
  const pts = [], p = new V();
  for (let i = 0; i < N; i++) { let bi = -1, bw = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; bi = SI.getComponent(i, k); } }
    if (bi !== hi && bi !== ti) continue; p.fromBufferAttribute(P, i).applyMatrix4(Mi); pts.push({ i, p: p.clone(), l: p.dot(L), u: p.dot(U), f: p.dot(F) }); }
  if (pts.length < 50) return null;
  const hw = Math.max(...pts.map(q => Math.abs(q.l))), wide = pts.filter(q => Math.abs(q.l) > 0.64 * hw);
  const cu = wide.reduce((s, q) => s + q.u, 0) / wide.length, cf = wide.reduce((s, q) => s + q.f, 0) / wide.length;
  const NB = 48, bin = q => Math.floor((Math.atan2(q.u - cu, q.f - cf) / (2 * Math.PI) + 1) % 1 * NB) % NB, rad = q => Math.hypot(q.u - cu, q.f - cf);
  const near = (a, b) => a.map((_, k) => Math.max(a[(k + NB - 1) % NB], a[k], a[(k + 1) % NB])), hull = new Array(NB).fill(0);
  for (const q of wide) { const b = bin(q); hull[b] = Math.max(hull[b], rad(q)); }
  // the fin is thin all over: seen from the side, no part of the helmet's width lies close behind it (the helmet's own middle ridge,
  // over the brow, does have the helmet beside it)
  const D = 0.36 * hw, cell = new Map(), ck = (a, b) => a * 4096 + b;
  for (const q of pts) if (Math.abs(q.l) > 0.55 * hw) { const k = ck(Math.floor(q.u / D), Math.floor(q.f / D)); (cell.get(k) || cell.set(k, []).get(k)).push(q); }
  const besideHelmet = q => { const a = Math.floor(q.u / D), b = Math.floor(q.f / D);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const w of cell.get(ck(a + i, b + j)) || []) if (Math.hypot(w.u - q.u, w.f - q.f) < D) return true; return false; };
  const H = near(hull), m = 0.3 * hw, fin = [];
  for (const q of pts) { const r = rad(q), du = (q.u - cu) / (r || 1), df = (q.f - cf) / (r || 1);
    if (Math.abs(q.l) < 0.5 * hw && r > H[bin(q)] + m && !(df > 0.2 && du < 0.5) && du > -0.62 && !besideHelmet(q)) { q.r = r; q.th = Math.atan2(-df, du); fin.push(q); } } // (not the face and nose guard: forward and low; not the neck below the back of the helmet)
  if (fin.length < 30) return null;
  const rimR = new Array(NB).fill(0); for (const q of fin) { const b = bin(q); rimR[b] = Math.max(rimR[b], q.r); } const RR = near(rimR);
  const t0 = Math.min(...fin.map(q => q.th)), t1 = Math.max(...fin.map(q => q.th)), arr = new Float32Array(N * 3);
  for (const q of fin) { const b = bin(q), lo = H[b] + m; q.rim = Math.min(1, Math.max(0, (q.r - lo) / Math.max(1e-4, RR[b] - lo))); q.arc = (q.th - t0) / Math.max(1e-4, t1 - t0);
    arr[q.i * 3] = 1; arr[q.i * 3 + 1] = q.rim; arr[q.i * 3 + 2] = q.arc; }
  g.setAttribute('aPlume', new THREE.BufferAttribute(arr, 3));
  const rim = fin.filter(q => q.rim > 0.85).sort((a, b) => a.arc - b.arc), out = [];
  for (let k = 0; k < 12 && rim.length; k++) out.push(rim[Math.floor((k + 0.5) / 12 * rim.length)].p);
  const c = new THREE.Vector3(); for (const q of fin) c.add(q.p); c.divideScalar(fin.length);
  return { pts: out, n: fin.length, c };
}
// ---------- the soul light (by 战魂): the cyan of its eyes shining out of it from inside, one step every 10 stacks, at its brightest at 100 ----------
// 1+ the bones glow from inside (shader), lights in the ribcage / skull / pelvis seen through the gaps, the eyes burn brighter; 3+ a cyan edge;
// 4+ wisps rise off it; 5+ the light moves up through it in bands; 6+ a glow on the ground, trails from the eyes; 7+ the seams of the armour
// light up; 8+ soul fire licks off the shoulders and the skull; 9+ an aura around the whole body; 10 white-hot at the core, two streams of
// light spiral round it and a ring of soul force pulses out every few seconds
const SOUL_C = 0x5ff2ff;
export const soulTier = L => Math.min(10, Math.max(0, Math.floor(L / 10)));
const SOUL_BONES = ['Spine2', 'Spine1', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'];
function soulGlow(model, root, head, col = SOUL_C) {
  const B = n => findBone(model, 'mixamorig:' + n), sp = B('Spine2'), hips = B('Hips'); if (!sp || !head) return null;
  model.updateMatrixWorld(true); const ws = o => o.getWorldScale(new THREE.Vector3()).x || 1, add = (bone, size, depth, dy = 0) => {
    const g = glowSprite(col, size / ws(bone), 0); g.material.depthTest = depth; g.position.y = dy / ws(bone); g.visible = false; bone.add(g); g.userData.s0 = g.scale.x; return g; };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: GTEX.glow, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  ground.position.y = 0.04; ground.renderOrder = 1; ground.visible = false; root.add(ground);
  return { t: 0, core: add(sp, 0.9, true), skull: add(head, 0.55, true, 0.1), hips: hips ? add(hips, 0.6, true) : null, aura: add(B('Spine1') || sp, 2.6, false),
    ground, bones: SOUL_BONES.map(B).filter(Boolean), sh: [B('LeftShoulder') || B('LeftArm'), B('RightShoulder') || B('RightArm'), head].filter(Boolean), pulses: [], pulseT: 1, acc: [0, 0, 0, 0],
    col, hot: col === SOUL_C ? 0xc8ffff : HOLY_HOT, hot2: col === SOUL_C ? 0xd8ffff : HOLY_HOT, holy: col !== SOUL_C };
}
// the paladin's own light (圣骑士, always on): a halo floating over the helmet's crest, hung on the head bone and kept level as the head
// moves; a slow rune circle of consecrated ground under its feet; motes of light drifting up off it
function holyLight(model, root, head) {
  if (!head) return null; model.updateMatrixWorld(true); let body = null; model.traverse(o => { if (o.isSkinnedMesh && !body) body = o; }); // (the body alone: the weapons stand higher in the rest pose)
  const box = new THREE.Box3().setFromObject(body || model), hp = head.getWorldPosition(new THREE.Vector3()), ws = head.getWorldScale(new THREE.Vector3()).x || 1;
  const halo = new THREE.Group(), band = ring(0.15, 0.19, HOLY_C, 0.9), soft = ring(0.11, 0.26, HOLY_C, 0.25), glow = glowSprite(HOLY_C, 0.55, 0.35);
  halo.add(soft, band, glow); halo.scale.setScalar(1 / ws); halo.position.copy(head.worldToLocal(new THREE.Vector3(hp.x, box.max.y + 0.08, hp.z - 0.04)));
  halo.userData.q0 = head.getWorldQuaternion(new THREE.Quaternion()).invert(); halo.quaternion.copy(halo.userData.q0); head.add(halo);
  const ground = runeCircle(1.15, HOLY_C, 0); ground.position.y = 0.05; root.add(ground);
  // the Aura of Light's reach (25 Fury): a thin ring of light on the ground with a soft band inside it
  const aura = new THREE.Group(), edge = ring(1 - 0.06 / HOLY_AURA_R, 1, HOLY_C, 0), fill = ring(1 - 0.7 / HOLY_AURA_R, 1, HOLY_C, 0); aura.add(fill, edge); aura.scale.setScalar(HOLY_AURA_R); aura.visible = false; root.add(aura);
  return { halo, band, soft, glow, ground, aura, aEdge: edge, aBand: fill, acc: 0, t: Math.random() * 9 };
}
const _hq = new THREE.Quaternion(), _hq2 = new THREE.Quaternion(), _hq3 = new THREE.Quaternion(), _hx = new THREE.Vector3(1, 0, 0);
function holyTick(u, dt, emit) {
  const m = u.mesh, H = m.hl; if (!H) return; const t = (H.t += dt), fade = m.u.uFade.value, on = m.root.visible && !u.dead, f = 0.85 + 0.15 * Math.sin(t * 2.1);
  // the halo stays level whatever the head does (undo the head's world turn, keep the body's facing), tipped back a little
  H.halo.parent.getWorldQuaternion(_hq).invert(); m.root.getWorldQuaternion(_hq3); H.halo.quaternion.copy(_hq).multiply(_hq3).multiply(_hq2.setFromAxisAngle(_hx, -0.18));
  H.halo.visible = on; H.band.material.opacity = 0.85 * f * fade; H.soft.material.opacity = 0.22 * f * fade; H.glow.material.opacity = 0.3 * f * fade;
  H.ground.visible = on; H.ground.position.y = 0.05 - m.root.position.y; H.ground.rotation.y = t * 0.25; H.ground.material.opacity = (0.16 + 0.05 * Math.sin(t * 1.6)) * fade;
  const au = on && (u.fury || 0) >= 25; H.aura.visible = au; if (au) { H.aura.position.y = 0.045 - m.root.position.y; H.aEdge.material.opacity = (0.5 + 0.15 * Math.sin(t * 1.9)) * fade; H.aBand.material.opacity = 0.09 * fade; }
  if (!on || !emit) return; H.acc += dt * 7;
  while (H.acc >= 1) { H.acc--; const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.6;
    emit(u.x + Math.sin(a) * r, m.root.position.y + 0.1 + Math.random() * 1.4, u.z + Math.cos(a) * r, { col: Math.random() < 0.35 ? HOLY_HOT : HOLY_C, spd: 0.05, up: 0.6, grav: -0.4, life: 0.9, size: 0.09, spread: 0.02 }); }
}
const _sp = new THREE.Vector3(), SOUL_FX = { col: SOUL_C, spd: 0.25, up: 0.9, grav: -0.9, life: 0.8, size: 0.2, spread: 0.12 };
function soulTick(u, dt, emit) {
  const m = u.mesh, S = m.sg; if (!S) return; const k = soulTier(globalThis.__soulL ?? u.fury ?? 0), b = u.soulBoost || 0, t = (S.t += dt); // b: 魂能 being poured in (soulvessel.js)
  const s = Math.min(1, Math.max(S.holy ? 0.16 : 0, k / 10 + 0.45 * b)); // the paladin is never without a little of its light
  m.u.uSoul.value.set(s, t, m.root.position.y, +(globalThis.__soulDbg || 0));
  const on = (k > 0 || b > 0.02 || S.holy) && m.root.visible && !u.dead, fade = m.u.uFade.value, pulse = 0.86 + 0.14 * Math.sin(t * 2.6), flick = 0.92 + 0.08 * Math.sin(t * 13.7) * Math.sin(t * 5.3);
  const lamp = (g, op, sc) => { if (!g) return; g.visible = on && op > 0; if (!g.visible) return; g.material.opacity = op * fade * pulse * flick; g.scale.setScalar(g.userData.s0 * sc * (0.94 + 0.06 * pulse)); };
  const hl = S.holy ? 0.55 : 1; // (softer on the paladin's bright silver)
  lamp(S.core, (0.25 + 0.6 * s) * hl, 0.6 + 0.9 * s); lamp(S.skull, (0.2 + 0.55 * s) * hl, 0.6 + 0.7 * s); lamp(S.hips, k >= 2 ? (0.15 + 0.4 * s) * hl : 0, 0.6 + 0.6 * s);
  lamp(S.aura, Math.max(k >= 9 ? (k === 10 ? 0.32 : 0.18) : 0, 0.3 * b) * hl, k === 10 ? 1.15 : 0.95);
  S.core.material.color.setHex(S.core.visible && k === 10 ? S.hot : S.col); // white-hot at the very top
  const eye = m.glows[0]; if (eye) { eye.userData.s0 ??= eye.scale.x; eye.scale.setScalar(eye.userData.s0 * (1 + 0.7 * s)); eye.material.opacity = Math.min(1, 0.75 + 0.25 * s) * fade; }
  const gd = S.ground; gd.visible = on && k >= 6; if (gd.visible) { gd.position.y = 0.04 - m.root.position.y; gd.scale.setScalar(1.6 + 0.25 * (k - 6) + 0.12 * pulse); gd.material.opacity = (0.16 + 0.07 * (k - 6)) * pulse * fade; }
  // the pulse of soul force at the top tier
  if (on && k === 10 && (S.pulseT -= dt) <= 0) { S.pulseT = 2.4; const r = ring(0.86, 1, S.col, 0.8); r.position.y = 0.06 - m.root.position.y; m.root.add(r); S.pulses.push({ r, a: 0 }); }
  for (let i = S.pulses.length - 1; i >= 0; i--) { const p = S.pulses[i]; p.a += dt / 0.9; const e = 1 - (1 - p.a) * (1 - p.a); p.r.scale.setScalar(0.5 + 3 * e); p.r.material.opacity = 0.8 * (1 - p.a);
    if (p.a >= 1) { m.root.remove(p.r); p.r.geometry.dispose(); p.r.material.dispose(); S.pulses.splice(i, 1); } }
  if (!on || !emit) return;
  const A = S.acc, FX = S.holy ? { ...SOUL_FX, col: S.col } : SOUL_FX, at = (b, o) => { b.getWorldPosition(_sp); emit(_sp.x + (Math.random() - 0.5) * 0.2, _sp.y + (Math.random() - 0.5) * 0.2, _sp.z + (Math.random() - 0.5) * 0.2, o); };
  if (b > 0.05) { S.bAcc = (S.bAcc || 0) + dt * b * 26; while (S.bAcc >= 1) { S.bAcc--; at(S.bones[Math.floor(Math.random() * S.bones.length)], { ...FX, size: 0.16, life: 0.55, up: 1.4 }); } } // soul seeping out while it drinks
  if (k >= 4) { A[0] += dt * (k - 3) * 5; while (A[0] >= 1) { A[0]--; at(S.bones[Math.floor(Math.random() * S.bones.length)], { ...FX, size: 0.14 + 0.02 * k, life: 0.6 + 0.04 * k }); } } // wisps
  if (k >= 8) { A[1] += dt * (k - 7) * 9; while (A[1] >= 1) { A[1]--; at(S.sh[Math.floor(Math.random() * S.sh.length)], { col: Math.random() < 0.3 ? S.hot2 : S.col, spd: 0.2, up: 2.2, grav: -1.6, life: 0.42, size: 0.34, spread: 0.08 }); } } // soul fire
  if (k >= 6 && eye) { A[2] += dt * (k - 5) * 6; while (A[2] >= 1) { A[2]--; eye.getWorldPosition(_sp); emit(_sp.x, _sp.y, _sp.z, { col: S.col, spd: 0.15, up: 0.5, grav: -0.6, life: 0.35, size: 0.1, spread: 0.04 }); } } // eye trails
  if (k === 10) { A[3] += dt * 70; const y0 = m.root.position.y; while (A[3] >= 1) { A[3]--; const q = Math.random(), j = Math.random() < 0.5 ? 0 : Math.PI, a = t * 3.2 + j + q * 2.5, h = (t * 0.9 + q) % 1;
    emit(u.x + Math.sin(a) * 0.62, y0 + 0.1 + h * 2.2, u.z + Math.cos(a) * 0.62, { col: h > 0.6 ? S.hot2 : S.col, spd: 0.02, up: 0.1, grav: 0, life: 0.5, size: 0.12, spread: 0.01 }); } } // the spiral streams
}
// tiers by 战魂 (the stacks the skeleton earns with its own kills, all lost when it falls): the crest as it is, then the gear colours
// blue, gold, purple and red, each brighter, the later ones on fire
const PLUME_TIERS = [ // dye colour, dye amount, glow, flame, sparks a second, swing trail colour, halo size and strength
  { c: 0x000000, a: 0, glow: 0, flame: 0, sp: 0, trail: 0xbfe6ff, halo: 0 },
  { c: 0x3f86ff, a: 0.9, glow: 0.35, flame: 0, sp: 0, trail: 0x5f9cff, halo: 0 },
  { c: 0xffb22e, a: 0.95, glow: 0.55, flame: 0.3, sp: 4, trail: 0xffc83a, halo: 0.35 },
  { c: 0x8a3cff, a: 1, glow: 0.5, flame: 0.5, sp: 10, trail: 0xb46cff, halo: 0.55 },
  { c: 0xff3418, a: 1, glow: 1.1, flame: 1, sp: 24, trail: 0xff5030, halo: 0.8 },
];
const HOLY_PLUME = { c: 0xfff6e6, a: 0.92, glow: 0.18, flame: 0, sp: 0, trail: HOLY_TRAIL, halo: 0 }; // the paladin's crest before its first tier: white
export const PLUME_AT = [5, 10, 15, 20];
export const plumeTier = L => PLUME_AT.filter(l => L >= l).length;
const _pc = new THREE.Color();
function plumeTick(u, dt, emit) {
  const m = u.mesh, uf = m.u && m.u.uPlFx; if (!uf) return; uf.value.x += dt;
  const tier = Math.min(PLUME_TIERS.length - 1, plumeTier(globalThis.__plumeL ?? u.fury ?? 0)), T = m.holy && !tier ? HOLY_PLUME : PLUME_TIERS[tier]; // u.fury: its 战魂 stacks (pact.js)
  if (m.plumeT !== tier) { const up = m.plumeT != null && tier > m.plumeT; m.plumeT = tier; _pc.setHex(T.c); m.u.uPl.value.set(_pc.r, _pc.g, _pc.b, T.a); uf.value.y = T.glow; uf.value.z = T.flame;
    if (m.blade) m.blade.col = m.holy && !tier ? HOLY_TRAIL : T.trail; if (m.plumeGlow) { m.plumeGlow.visible = T.halo > 0; m.plumeGlow.material.color.setHex(T.c); }
    if (up && emit) for (const d of m.plumePts) { d.getWorldPosition(_p); for (let k = 0; k < 4; k++) emit(_p.x, _p.y, _p.z, { col: T.c, spd: 1.2, up: 1.6, grav: -0.5, life: 0.9, size: 0.2, spread: 0.1 }); } }
  if (m.plumeGlow && T.halo) { const t = uf.value.x, f = 0.82 + 0.1 * Math.sin(t * 3.1) + (tier >= 4 ? 0.08 * Math.sin(t * 17.3) * Math.sin(t * 7.7) : 0); // breathing, the fire flickers
    m.plumeGlow.material.opacity = T.halo * f * m.u.uFade.value; m.plumeGlow.scale.setScalar(m.plumeGlow.userData.s0 ??= m.plumeGlow.scale.x); m.plumeGlow.scale.multiplyScalar((0.7 + 0.5 * T.halo) * f); }
  if (!T.sp || !emit || !m.plumePts.length || !m.root.visible || u.dead) return;
  m.spAcc = (m.spAcc || 0) + dt * T.sp;
  while (m.spAcc >= 1) { m.spAcc -= 1; const d = m.plumePts[Math.floor(Math.random() * m.plumePts.length)]; d.getWorldPosition(_p);
    if (tier >= 4 && Math.random() < 0.45) emit(_p.x, _p.y, _p.z, { col: 0xff3010, spd: 0.25, up: 0.9, grav: -1.2, life: 0.45, size: 0.3, spread: 0.06 }); // flame licks
    else emit(_p.x, _p.y, _p.z, { col: tier >= 4 ? 0xffb050 : T.trail, spd: 0.35, up: 0.7, grav: -0.8, life: tier >= 3 ? 0.9 : 0.6, size: tier >= 4 ? 0.16 : tier >= 3 ? 0.13 : 0.1, spread: 0.05 }); }
}
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
// sparks drifting off gear of rare quality and up, in its colour (more for purple, red smoulders)
const _ga = new THREE.Vector3(), _gb = new THREE.Vector3();
function gearTick(u, dt, emit) {
  const m = u.mesh; if (!emit || !m.weap || !m.root.visible || u.dead) return;
  for (const g of [m.weap.r, m.weap.l]) { const q = g && g.visible && g.userData.q; if (!q || q < 2) continue; // (not while the mace is thrown)
    g.userData.acc = (g.userData.acc || 0) + dt * [0, 0, 4, 9, 16][q]; const col = QUAL[q].hex;
    while (g.userData.acc >= 1) { g.userData.acc--; const e = g.userData.edge;
      if (e) { e[0].getWorldPosition(_ga); e[1].getWorldPosition(_gb); _ga.lerp(_gb, Math.random()); } else { g.getWorldPosition(_ga); _ga.x += (Math.random() - 0.5) * 0.4; _ga.y += (Math.random() - 0.3) * 0.5; _ga.z += (Math.random() - 0.5) * 0.4; }
      emit(_ga.x, _ga.y, _ga.z, q >= 4 && Math.random() < 0.5 ? { col: 0xff3010, spd: 0.2, up: 1.1, grav: -1.2, life: 0.45, size: 0.22, spread: 0.04 } : { col, spd: 0.25, up: 0.6, grav: -0.5, life: 0.6, size: 0.1 + 0.02 * q, spread: 0.04 }); } }
}
export function heroWeaponPose(u, dt, emit) {
  plumeTick(u, dt, emit); soulTick(u, dt, emit); holyTick(u, dt, emit); gearTick(u, dt, emit);
  const m = u.mesh, sh = m.weap && m.weap.l; if (sh && sh.userData.q0) shieldHang(sh, dt);
  if (m.zy && m.weap && m.weap.bowL && m.weap.bowL.visible && !globalThis.__noBowFit) zyBow(m);
  const g = m.weap && m.weap.r; if (!g || !g.userData.q0) return;
  // the greatsword drags only while it stands or walks (any other clip — swings, skills, dodges, death, the rise — carries it)
  const loco = /^(Stand|Walk_|Run_)/.test(m.curName || '') || !(m.cur && m.cur.isRunning()), drag = m.style === 'GS' && loco && !(u.spawnT > 0) ? 1 : 0;
  m.dragW = (m.dragW ?? drag) + (drag - (m.dragW ?? drag)) * Math.min(1, dt * 8);
  const hang = m.holy && loco && !(u.spawnT > 0) ? 1 : 0; m.hangW = (m.hangW ?? hang) + (hang - (m.hangW ?? hang)) * Math.min(1, dt * 8); // the mace carried head up (the calm walk would hold it out straight ahead)
  if (g.userData.qOwn) { const w = zyOwn(m.curName) ? 1 : 0; g.userData.ownW += (w - g.userData.ownW) * Math.min(1, dt * 10); g.userData.q0.slerpQuaternions(g.userData.qGS, g.userData.qOwn, g.userData.ownW); } // (Zhao Yun's spear: his own way of holding it, or the moved-over clips')
  g.quaternion.copy(g.userData.q0); g.updateMatrixWorld(true); g.getWorldPosition(_p); g.parent.getWorldQuaternion(_qh); _qw.copy(_qh).multiply(g.userData.q0);
  _ax.copy(_up).applyQuaternion(_qw); _d.copy(_ax);
  const L = g.userData.tip, floor = m.root.position.y + 0.04;
  if (m.zy && g.userData.qOwn) { if (g.visible) { if (m.curU && /@upper$/.test(m.curUName || '')) zyChest(u, m); zySpear(u, m, g, dt, floor); } return; } // (the spear set aside for the bow: his hands are the bow's)
  if (m.dragW > 0.002) { const f = u.face, h = Math.max(0.05, _p.y - floor), hor = Math.sqrt(Math.max(0.0025, L * L - h * h)), bx = -Math.sin(f) * 0.85 - Math.cos(f) * 0.45, bz = -Math.cos(f) * 0.85 + Math.sin(f) * 0.45, bl = Math.hypot(bx, bz);
    const tx = bx / bl * hor, tz = bz / bl * hor, ty = L > h ? -h : -L * 0.97, tl = Math.hypot(tx, ty, tz);
    _d.lerp(new _V(tx / tl, ty / tl, tz / tl), m.dragW).normalize(); }
  // (the equipment panel's doll has no facing of its own: its root's turn)
  if (m.hangW > 0.002) { const f = u.face ?? m.root.rotation.y, H = globalThis.__hang || HANG; _d.lerp(_hg.set(Math.sin(f) * H[0] - Math.cos(f) * H[2], H[1], Math.cos(f) * H[0] + Math.sin(f) * H[2]).normalize(), m.hangW).normalize(); }
  const tipY = _p.y + _d.y * L; // the floor stops the blade
  if (tipY < floor) { const y = Math.max(-1, (floor - _p.y) / L), hl = Math.hypot(_d.x, _d.z) || 1, k = Math.sqrt(1 - y * y) / hl; _d.set(_d.x * k, y, _d.z * k); }
  if (_d.distanceToSquared(_ax) > 1e-6) { _qr.setFromUnitVectors(_ax, _d); g.quaternion.copy(_qh.invert().multiply(_qr.multiply(_qw))); }
  if (emit && m.dragW > 0.7 && Math.hypot(u.vx, u.vz) > 0.6 && Math.random() < dt * 14) { const x = _p.x + _d.x * L, z = _p.z + _d.z * L;
    emit(x, floor + 0.02, z, Math.random() < 0.6 ? { col: 0xffb35a, spd: 1.4, up: 1.2, grav: 6, life: 0.3, size: 0.09 } : { col: 0x9a8f86, spd: 0.4, up: 0.4, grav: 0, life: 0.6, size: 0.22 }); }
}
// Zhao Yun's spear, by what he is doing (each a way it points and where along the shaft his right fist is; eased between over ~0.1 s):
//  - ground (his calm stand ZY_IDLE, and his rise): upright, the butt on the floor beside his foot, his right fist round it
//  - carry (walking): held forehand at the balance point, the point forward and up (CARRY_UP), the butt clear of the floor
//  - two (his own fighting clips: the stance, the parry): along the line from his right fist through his left — both hands on the
//    shaft whatever the clip does — the right fist near the butt (TWO_AT of the way up); the fitted line if the hands part
//  - the Sentinel's clips moved over to him: the line fitted on them (heroWeaponPose's slerp), the fist at the grip
// a hand turned about its wrist so a shaft along R runs through its fist the right way: in at the little finger, out past the thumb (the
// point beyond the thumb, as a spear is held — Meshy's clips held the fist as if to throw it), the palm toward Nw (or kept as near as it
// was). Half of any turn about the forearm's own length is given to the forearm (no wrist wrung round on its own). w: how much of it
const _gUp = new _V(), _gk = new _V(), _gw = new _V(), _gn = new _V(), _gc = new _V(), _gt = new _V(), _gN = new _V(), _gA = new _V(), _gM1 = new THREE.Matrix4(), _gM2 = new THREE.Matrix4(),
  _gQ = new THREE.Quaternion(), _gT = new THREE.Quaternion(), _gP = new THREE.Quaternion(), _gH = new THREE.Quaternion(), _gI = new THREE.Quaternion();
function gripHand(G, R, Nw, w) {
  if (!G.hand || !G.mid || !G.pky || w < 0.01) return 0;
  const hp = G.hand.getWorldPosition(_gc), mid = G.mid.getWorldPosition(_gt), k = _gk.copy(mid).sub(G.pky.getWorldPosition(_gw)).normalize();
  const n = _gn.copy(G.palm).applyQuaternion(G.hand.getWorldQuaternion(_gH)); n.addScaledVector(k, -n.dot(k)).normalize(); // (the palm, square to the knuckles)
  _gN.copy(Nw || n); _gN.addScaledVector(R, -_gN.dot(R)); if (_gN.lengthSq() < 1e-4) _gN.copy(n).addScaledVector(R, -n.dot(R)); _gN.normalize();
  _gM1.makeBasis(k, n, _gA.crossVectors(k, n)); _gM2.makeBasis(R, _gN, _gt.crossVectors(R, _gN));
  _gQ.setFromRotationMatrix(_gM2.multiply(_gM1.transpose())); if (w < 1) _gQ.slerp(_gI.identity(), 1 - w);
  const ang = 2 * Math.acos(Math.min(1, Math.abs(_gQ.w)));
  if (G.fore) { // the twist about the forearm (elbow to wrist), half to the forearm
    const a = _gA.copy(hp).sub(G.fore.getWorldPosition(_gw)).normalize(), d = _gQ.x * a.x + _gQ.y * a.y + _gQ.z * a.z;
    _gT.set(a.x * d, a.y * d, a.z * d, _gQ.w).normalize(); if (globalThis.__gripDbg) { const tw = 2 * Math.acos(Math.min(1, Math.abs(_gT.w))); globalThis.__gripDbg.push([ang, tw]); }
    _gT.slerp(_gI.identity(), 1 - (globalThis.__foreK ?? 0.5));
    G.fore.parent.getWorldQuaternion(_gP); G.fore.getWorldQuaternion(_gH); G.fore.quaternion.copy(_gP.invert().multiply(_gT.clone().multiply(_gH))); G.fore.updateMatrixWorld(true);
    _gQ.multiply(_gT.invert()); }
  G.hand.parent.getWorldQuaternion(_gP); G.hand.getWorldQuaternion(_gH); G.hand.quaternion.copy(_gP.invert().multiply(_gQ.multiply(_gH))); G.hand.updateMatrixWorld(true);
  return ang;
}
// his bow while he shoots, every frame: upright across the line he shoots along (from the string hand through the bow hand), the string
// toward his drawing hand, the grip in his left fist — the left hand turned round it, thumb up, palm toward the string. (Fitted once on
// one frame of one clip it stood askew in the others.) The bow's own frame: limbs along +y, the string out on +x
const _bA = new _V(), _bU = new _V(), _bX = new _V(), _bZ = new _V(), _bM = new THREE.Matrix4(), _bQ = new THREE.Quaternion(), _bP = new THREE.Quaternion();
function zyBow(m) {
  const g = m.weap.bowL; fistW(m.fists.L, _fl); fistW(m.fists.R, _fr); _bA.subVectors(_fl, _fr); if (_bA.lengthSq() < 0.01) return; _bA.normalize(); // (the arrow's way)
  _bU.set(0, 1, 0).addScaledVector(_bA, -_bA.y); if (_bU.lengthSq() < 1e-4) return; _bU.normalize();
  gripHand(m.grip.L, _bU, _bZ.crossVectors(_bA, _bU).normalize(), 1); fistW(m.fists.L, _fl); // (thumb up the bow, the palm toward the string)
  _bX.copy(_bA).negate(); _bZ.crossVectors(_bX, _bU); _bM.makeBasis(_bX, _bU, _bZ); _bQ.setFromRotationMatrix(_bM);
  g.quaternion.copy(g.parent.getWorldQuaternion(_bP).invert().multiply(_bQ)); g.position.copy(g.parent.worldToLocal(_hg.copy(_fl)));
}
// walking into a fight, his chest turned back square: the spear stance's upper body sits on hips that, in the stance, stood turned
// side-on — on the walk's hips it would hold the spear out to his left. The spine turned about the vertical (Spine 40%, Spine1 and Spine2
// 30% each) till the line from his right fist to his left points where it does in the stance (CHEST_AIM: forward, a little left), the neck
// turned back as much (his eyes stay on the way he walks). Aimed at a target, not added: a pose the clip did not rewrite is not turned twice
const CHEST_AIM = 0.235, _cq = new THREE.Quaternion(), _cw = new THREE.Quaternion(), _cp = new THREE.Quaternion(), _cY = new _V(0, 1, 0);
function zyChest(u, m) {
  const f = u.face ?? m.root.rotation.y; fistW(m.fists.R, _fr); fistW(m.fists.L, _fl);
  const cur = Math.atan2(_fl.x - _fr.x, _fl.z - _fr.z), want = f + CHEST_AIM; let dlt = want - cur; dlt = Math.atan2(Math.sin(dlt), Math.cos(dlt)); if (Math.abs(dlt) < 0.01) return;
  const B = m.chestBones || (m.chestBones = ['Spine', 'Spine1', 'Spine2', 'Neck'].map(nm => findBone(m.model, 'mixamorig:' + nm)));
  [0.4, 0.3, 0.3, -1].forEach((k, i) => { const b = B[i]; if (!b) return; _cq.setFromAxisAngle(_cY, dlt * k); b.parent.getWorldQuaternion(_cp); b.getWorldQuaternion(_cw);
    b.quaternion.copy(_cp.invert().multiply(_cq.multiply(_cw))); b.updateMatrixWorld(true); });
}
export const ZY_IDLE = 'ZY_Stand_Ease', ZY_GROUND = new Set([ZY_IDLE, 'ZY_Axe_Stance']), CARRY_UP = 0.62, TWO_AT = 0.18, GRIP_AT = 0.4, TWO_AT_CLIP = { ZY_Two_Handed_Parry: 0.4 }; // (the parry holds it across, by its middle) // (CARRY_UP: radians above level; TWO_AT, GRIP_AT: of the length from the butt)
function zySpear(u, m, g, dt, floor) {
  const n0 = m.curU && m.curUName ? m.curUName.replace(/@upper$/, '') : (m.curName || '').replace(/@lower$/, ''), n = ZY_ALIAS[n0] || n0, fit = WEAP_FIT.spear, Lw = fit.len, tip = g.userData.tip, butt = Lw - tip, f = u.face ?? m.root.rotation.y; // (n: his own clip's name, for the Sentinel's names it stands in for) // (walking into a fight: the stance above is what holds it)
  fistW(m.fists.R, _fr); fistW(m.fists.L, _fl);
  const ground = ZY_GROUND.has(n), walk = /^Walk_/.test(n0) || n === 'ZY_Spear_Walk', own = zyOwn(n), fwdX = Math.sin(f), fwdZ = Math.cos(f); _d.copy(_ax); // (_ax: where the hand's own grip points it)
  if (ground) _d.set(fwdX * 0.04, 1, fwdZ * 0.04).normalize();
  else if (walk) { const c = Math.cos(globalThis.__carryUp ?? CARRY_UP), sn = Math.sin(globalThis.__carryUp ?? CARRY_UP); _d.set(fwdX * c, sn, fwdZ * c).normalize(); }
  else if (own) { _zd.subVectors(_fl, _fr); const h = _zd.length(); if (h > 0.18 && h < 1.2) _d.copy(_zd.divideScalar(h)); }
  const k = Math.min(1, dt * 12); m.zyD = m.zyD ? m.zyD.lerp(_d, k).normalize() : _d.clone(); _d.copy(m.zyD);
  // his hands round the shaft, the thumbs toward the point: one hand (at ease, rising, walking) with the palm in toward his body, the back
  // of the hand out; both (his own fighting clips) the rear hand's palm in and up, the front hand cradling it palm up (the parry: as they
  // were). Not on the Sentinel's clips moved over (their own line, fitted on the hands)
  const one = ground || walk, gw = one || own ? 1 : 0; m.zyGW = (m.zyGW ?? gw) + (gw - (m.zyGW ?? gw)) * k;
  if (m.zyGW > 0.01 && !globalThis.__noGrip) { _hg.set(Math.cos(f), 0, -Math.sin(f)); // (his left: in, for the right hand)
    const parry = n === 'ZY_Two_Handed_Parry'; if (!one && !parry) _hg.add(_gUp.set(0, 0.6, 0)).normalize(); // (both hands: the rear one in and up, the front one cradling, palm up)
    for (let it = 0; it < (one ? 1 : 2); it++) { // (both hands: turned, then the shaft laid again through the fists where they now are, and once more)
      if (it) { fistW(m.fists.R, _fr); fistW(m.fists.L, _fl); _zd.subVectors(_fl, _fr); const h = _zd.length(); if (h > 0.18 && h < 1.2) _d.copy(_zd.divideScalar(h)); }
      m.zyGA = gripHand(m.grip.R, _d, parry ? null : _hg, m.zyGW); if (!one) gripHand(m.grip.L, _d, parry ? null : _gUp.set(0, 1, 0), m.zyGW); }
    fistW(m.fists.R, _fr); g.parent.getWorldQuaternion(_qh); _qw.copy(_qh).multiply(g.quaternion); _ax.copy(_up).applyQuaternion(_qw); }
  // where along the shaft his fist is (s: from the grip point), from where the fist now is: grounded, the butt on the floor; walking, the
  // butt a hand's breadth off it; both hands, the rear fist TWO_AT of the way up
  let s = 0;
  if (ground) s = floor + butt / Math.max(0.5, _d.y) * _d.y - _fr.y;
  else if (walk) { const low = _fr.y - butt * _d.y - (floor + 0.12); if (low < 0) s = -low / Math.max(0.2, _d.y); }
  else if (own) s = (GRIP_AT - (TWO_AT_CLIP[n] ?? TWO_AT)) * Lw;
  m.zyS = (m.zyS ?? s) + (s - (m.zyS ?? s)) * k; s = ground ? (Math.abs(m.zyS - s) < 0.25 ? s : m.zyS) : m.zyS; // (grounded: the butt stays on the floor, no lag)
  // the floor stops the point and the butt (not the grounded butt: it stands on it)
  const tipY = _fr.y + _d.y * (s + tip); if (tipY < floor) { const y = Math.max(-1, (floor - _fr.y) / (s + tip)), hl = Math.hypot(_d.x, _d.z) || 1, kk = Math.sqrt(Math.max(0, 1 - y * y)) / hl; _d.set(_d.x * kk, y, _d.z * kk); }
  if (_d.distanceToSquared(_ax) > 1e-6) { _qr.setFromUnitVectors(_ax, _d); g.quaternion.copy(_qh.invert().multiply(_qr.multiply(_qw))); }
  g.position.copy(g.parent.worldToLocal(_hg.copy(_fr).addScaledVector(_d, s)));
}
export function clipLen(name, m) { const c = (m && m.clips && m.clips[name]) || A.clips[name]; return c ? c.duration : 1; }
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
// the 魂契 skeleton's clips split into legs (hips down) and the rest, to run with one and hold another with the other
export function heroPart(name, part) {
  const key = name + '@' + part, C = A.heroClips; if (C[key]) return key; const c = C[name]; if (!c) return name;
  C[key] = new THREE.AnimationClip(key, c.duration, c.tracks.filter(t => /Hips|UpLeg|Leg|Foot|Toe/.test(t.name.split('.')[0]) === (part === 'lower'))); return key;
}
// layered animation (the 机枪骷髅 walks with its legs while its arms keep the gun up): a clip split into the upper body
// (spine, chest, head, arms) and the rest; play(m, partClip(walk, 'lower')) for the legs, playUpper(m, partClip(aim, 'upper')) for the arms
const UPPER = new Set(['spine', 'chest', 'head', 'upperarml', 'lowerarml', 'wristl', 'handl', 'handslotl', 'upperarmr', 'lowerarmr', 'wristr', 'handr', 'handslotr']);
export function partClip(name, part) {
  const key = name + '@' + part; if (A.clips[key]) return key; const c = A.clips[name]; if (!c) return name;
  A.clips[key] = new THREE.AnimationClip(key, c.duration, c.tracks.filter(t => UPPER.has(t.name.split('.')[0].replace(/[[\]\.:\/]/g, '')) === (part === 'upper'))); return key;
}
export function playUpper(m, name, o = {}) {
  const clip = (m.clips && m.clips[name]) || A.clips[name]; if (!clip) return null; // (a hero's own: Zhao Yun's stance over his walk)
  let a = m.actions[name]; if (!a) { a = m.mixer.clipAction(clip); m.actions[name] = a; }
  if (m.curU === a && !o.restart) { if (o.speed != null) a.timeScale = o.speed; return a; }
  const prev = m.curU; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = o.speed ?? 1; a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
  a.play(); if (prev && prev !== a) prev.crossFadeTo(a, o.fade ?? 0.12, false); else if (!prev) a.fadeIn(o.fade ?? 0.12);
  m.curU = a; m.curUName = name; return a;
}
