// 底座与木桶 / Stands and barrels: the crypt's barrels, crates, urns, kegs and trunks break when the summoner gets to them (click / tap
// one) or when the bone spear or the Sentinel's blows land on them (hitBoxes); now and then an item, some soul energy (魂契). No more
// chests to gamble on: a display stand (a stone plinth, a relic stand, a weapon rack, a crypt altar — generated models, assets/gen_props)
// holds one item in plain sight, picked up by walking to it; one in the middle of a ruin in the wilds too. Boxes stay instanced in the
// floor's PropBatch: a breaking one's instance is shrunk away (its cell walkable again) and pieces of it fly apart.
import * as THREE from 'three';
import { G, PACT } from './state.js';
import { tr } from './i18n.js';
import { C, PH, say, dropLoot } from './units.js';
import { rollHeroItem, rollItem, QUAL } from './data.js';
import { propGeo, propMat } from './assets.js';
import { glowSprite } from './gfx.js';
import { burst, shake } from './fx.js';
import { S } from './audio.js';
import { soulToJar } from './soulvessel.js';

export const BOX_KIND = { barrel_small: 'smash', barrel_large: 'smash', keg: 'smash', box_small: 'smash', box_large: 'smash', crates_stacked: 'smash', trunk_large_A: 'trunk', chest: 'chest', chest_gold: 'gold',
  brk_barrel1: 'smash', brk_barrel3: 'smash', brk_barrel4: 'smash', brk_crate1: 'smash', brk_crate2: 'smash', brk_urn1: 'urn', brk_urn4: 'urn',
  stand_stone: 'stand', stand_relic: 'stand', stand_rack: 'stand', stand_altar: 'stand' };
// the generated props' heights in the game (their files are about a unit tall; scaled to this at placement)
export const PROP_H = { brk_barrel1: 0.66, brk_barrel3: 0.66, brk_barrel4: 0.66, brk_crate1: 0.55, brk_crate2: 0.55, brk_urn1: 0.6, brk_urn4: 0.6,
  stand_stone: 0.72, stand_relic: 0.8, stand_rack: 0.85, stand_altar: 0.45 };
// where a stand's item sits: [its top (a share of its height), forward of its middle (the rack's hooks)]
const STAND_AT = { stand_stone: [0.98, 0], stand_relic: [1, 0], stand_altar: [0.77, 0], stand_rack: [0.78, 0.1] };
export const propScale = name => { const pg = propGeo(name); return pg && PROP_H[name] ? PROP_H[name] / Math.max(0.05, pg.box.max.y) : 0.5; };
// loot: the chance of an item and its quality odds (white .. red; red only in 魂契), a second item's chance, 魂能 (chance, amount at item level il)
export const BOX_LOOT = {
  smash: { item: 0.2, q: [0.55, 0.32, 0.11, 0.02, 0], again: 0, soul: 0.35, soulN: il => 1 + Math.round(il * 0.4) },
  urn: { item: 0.15, q: [0.5, 0.34, 0.13, 0.03, 0], again: 0, soul: 0.6, soulN: il => 2 + Math.round(il * 0.5) }, // (a burial urn: more soul in it)
  stand: { item: 1, q: [0.12, 0.42, 0.32, 0.12, 0.02] }, standGold: { item: 1, q: [0, 0.2, 0.46, 0.26, 0.08] }, // (one item, in plain sight)
  trunk: { item: 0.75, q: [0.3, 0.45, 0.2, 0.05, 0], again: 0.15, soul: 0.6, soulN: il => 2 + Math.round(il * 0.6) },
  chest: { item: 1, q: [0.2, 0.45, 0.26, 0.08, 0.01], again: 0.35, soul: 1, soulN: il => 4 + il },
  gold: { item: 1, q: [0, 0.25, 0.45, 0.24, 0.06], again: 0.8, soul: 1, soulN: il => 10 + 2 * il },
};
export const GOLD_CHEST = 0.12, GOLD_STAND = 0.15; // the share of chests / stands that hold something better
const _up = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(1, 0, 0);
// a box's place in the floor: name, where, its PropBatch item (for the instance), the grid cell it blocks (crypt only: freed when it breaks)
export function addBox(F, name, x, z, it, cell, lid = null) { const b = { name, kind: BOX_KIND[name], x, z, it, cell, lid, open: false }; (F.boxes || (F.boxes = [])).push(b); return b; }
// a chest into a PropBatch: its box, and its lid standing on the hinge (turned and scaled with it)
export function placeChest(F, B, name, x, z, r, s = 0.5, cell = null) {
  const lg = propGeo(name + '_lid'), h = lg ? lg.hinge : new THREE.Vector3(), w = new THREE.Vector3(h.x, h.y, h.z).multiplyScalar(s).applyAxisAngle(_up, r);
  const it = B.add(name + '_body', x, 0, z, r, s), lid = B.add(name + '_lid', x + w.x, w.y, z + w.z, r, s); return addBox(F, name, x, z, it, cell, lid);
}
// a display stand with its one item, rolled now (shown on it once the floor is up — boxTick): a weapon now and then on a rack, an epic or
// legendary on the relic stand or the crypt altar, the rest on a stone plinth
// (rack: a rack may stand here — its hooks face r, toward the camera)
export function placeStand(F, B, x, z, r, rack = true, cell = null) {
  const il = Math.max(1, G.depth || G.deep || 1), item = itemOf(il, rollQ((Math.random() < GOLD_STAND ? BOX_LOOT.standGold : BOX_LOOT.stand).q));
  const name = rack && item.slot === 'w' && Math.random() < 0.6 ? 'stand_rack' : item.q >= 3 ? (Math.random() < 0.5 ? 'stand_relic' : 'stand_altar') : 'stand_stone', s = propScale(name);
  const it = B.add(name, x, 0, z, r, s), b = addBox(F, name, x, z, it, cell), [top, fwd] = STAND_AT[name];
  b.item = item; b.r = r; b.top = PROP_H[name] * top; b.dz = PROP_H[name] * fwd; return b;
}
// a given item on a stand of the given kind (the camp's spear for 赵云: the person — friends trying him out should not have to find one
// first): a hero weapon of kind at quality q, at the item level of the deepest floor reached. There every time the game is entered, until
// it is picked up (then not again till the game is next loaded: walking back into the camp does not hand out another). It had been left
// out whenever a spear was owned anywhere — so whoever already had one (the person, testing) never saw it
export function placeGift(F, B, x, z, r, kind, q, name = 'stand_relic', cell = null) {
  if (!PACT || !G.pact || (G.gifts && G.gifts[kind])) return null;
  const item = rollHeroItem(G.uid++, Math.max(1, G.deep || 1), q, kind), s = propScale(name);
  const it = B.add(name, x, 0, z, r, s), b = addBox(F, name, x, z, it, cell), [top, fwd] = STAND_AT[name];
  b.item = item; b.r = r; b.top = PROP_H[name] * top; b.dz = PROP_H[name] * fwd; b.gift = kind; return b;
}
// what the Sentinel's blows and the bone spear break: the barrels, crates, urns, kegs and trunks within r of (x, z) — and, given a facing
// (face, half: its half-width in radians), only those in front
export function hitBoxes(x, z, r, face = null, half = Math.PI) { const F = G.floor; if (!F || !F.boxes) return 0; let n = 0;
  for (const b of F.boxes) { if (b.open || b.kind === 'stand' || b.kind === 'chest' || b.kind === 'gold') continue; const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz); if (d > r + 0.35) continue;
    if (face != null && d > 0.4 && Math.abs(((Math.atan2(dx, dz) - face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > half) continue; openBox(b); n++; }
  return n; }
PH.shotBox = s => s.kind === 'spear' && s.side === 'friend' && hitBoxes(s.x, s.z, 0.25) > 0; // (the bone spear: it breaks on what it hits)
// the box under a click (the click can land a little behind a tall one, the camera looking down along -x/-z)
export function pickBox(p, r = 0.75) { const F = G.floor; if (!F || !F.boxes || !p) return null; let best = null, bd = r;
  for (const b of F.boxes) { if (b.open) continue; for (let h = 0; h <= 0.9; h += 0.3) { const k = 0.69 * h, d = Math.hypot(p.x + k - b.x, p.z + k - b.z); if (d < bd) { bd = d; best = b; } } }
  return best; }
const rollQ = q => { let r = Math.random(); for (let i = 0; i < q.length; i++) { if (r < q[i]) return i; r -= q[i]; } return 0; };
const itemOf = (il, q) => PACT ? rollHeroItem(G.uid++, il, q) : rollItem(G.uid++, il, Math.min(q, 3));
const M4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3();
// an instance put back with a scale (k: [wide, tall]) and, for a lid, swung open by a (radians, about its hinge)
function setInst(it, k, a = 0) { if (!it || !it.im) return; const [x, y, z, r, sx, sy, sz] = it; _q.setFromAxisAngle(_up, r); if (a) _q.multiply(_q2.setFromAxisAngle(_x, -a));
  it.im.setMatrixAt(it.ix, M4.compose(_p.set(x, y, z), _q, _s.set(sx * k[0], sy * k[1], sz * k[0]))); it.im.instanceMatrix.needsUpdate = true; }

// ---------- breaking: the prop cut into pieces — six wedges round its middle, upper and lower — each centred on itself, so it can tumble
const SHARDS = {};
function shards(name) {
  if (SHARDS[name]) return SHARDS[name]; const pg = propGeo(name); if (!pg) return null;
  const g = pg.geo, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, I = g.index, bx = pg.box, cx = (bx.min.x + bx.max.x) / 2, cz = (bx.min.z + bx.max.z) / 2, my = bx.min.y + (bx.max.y - bx.min.y) * 0.5;
  const parts = new Map(), n = I ? I.count : P.count, at = t => (I ? I.getX(t) : t);
  for (let t = 0; t < n; t += 3) { let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { const v = at(t + k); x += P.getX(v); y += P.getY(v); z += P.getZ(v); }
    x /= 3; y /= 3; z /= 3; const key = (y > my ? 6 : 0) + Math.floor((Math.atan2(z - cz, x - cx) + Math.PI) / (Math.PI * 2) * 6) % 6;
    let q = parts.get(key); if (!q) parts.set(key, q = { p: [], n: [], u: [] }); for (let k = 0; k < 3; k++) { const v = at(t + k); q.p.push(P.getX(v), P.getY(v), P.getZ(v)); q.n.push(N.getX(v), N.getY(v), N.getZ(v)); q.u.push(U.getX(v), U.getY(v)); } }
  const list = []; for (const q of parts.values()) { const c = new THREE.Vector3(); for (let i = 0; i < q.p.length; i += 3) c.add(_p.set(q.p[i], q.p[i + 1], q.p[i + 2])); c.multiplyScalar(3 / q.p.length);
    for (let i = 0; i < q.p.length; i += 3) { q.p[i] -= c.x; q.p[i + 1] -= c.y; q.p[i + 2] -= c.z; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(q.p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(q.n, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(q.u, 2)); geo.computeBoundingSphere();
    list.push({ geo, c, r: geo.boundingSphere.radius, out: new THREE.Vector3(c.x - cx, 0, c.z - cz) }); }
  return (SHARDS[name] = { mat: propMat(pg.map, { ds: true }), list, mid: new THREE.Vector3(cx, my, cz) }); // (both sides: a piece shows its inside)
}
// the pieces fly out and up from where it stood, tumble, bounce on the floor, lie a moment and shrink away
function shatter(b) {
  const sh = shards(b.name); if (!sh) return; const [x, y, z, r, s] = b.it, grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = r; grp.scale.setScalar(s); C.scene.add(grp);
  const G0 = 14 / s, ps = sh.list.map(q => { const m = new THREE.Mesh(q.geo, sh.mat); m.position.copy(q.c); grp.add(m); const o = q.out.lengthSq() > 1e-6 ? q.out.clone().normalize() : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    const sp = (1.2 + Math.random() * 1.5) / s; return { m, r: q.r * 0.6, v: new THREE.Vector3(o.x * sp, (1.8 + Math.random() * 1.8 + (q.c.y > sh.mid.y ? 0.8 : 0)) / s, o.z * sp), w: new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 16) }; });
  let last = 0; const fx = { clean: true, t: 1.7, fn: () => C.scene.remove(grp) };
  fx.tick = () => { const t = fx.k, dt = Math.min(0.05, Math.max(0, t - last)); last = t; const k = t < 1.1 ? 1 : Math.max(0.01, 1 - (t - 1.1) / 0.6);
    for (const p of ps) { p.v.y -= G0 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.w.x * dt; p.m.rotation.y += p.w.y * dt; p.m.rotation.z += p.w.z * dt;
      if (p.m.position.y < p.r && p.v.y < 0) { p.m.position.y = p.r; p.v.y *= -0.32; p.v.x *= 0.55; p.v.z *= 0.55; p.w.multiplyScalar(0.55); } p.m.scale.setScalar(k); } };
  G.fx.push(fx);
}
// a chest's lid swinging up (eased, a little past and back) and the light inside it
function lidOpen(b) {
  const L = 1.95, glow = glowSprite(0xffd27a, 1.6, 0); glow.position.set(b.x, 0.55, b.z); C.scene.add(glow);
  G.fx.push({ clean: true, t: 0.45, tick: k => { const e = 1 - (1 - k) ** 3, o = Math.sin(Math.PI * k) * 0.12; setInst(b.lid, [1, 1], L * e + o); setInst(b.it, [1 + 0.06 * Math.sin(Math.PI * k), 1 - 0.05 * Math.sin(Math.PI * k)]); }, fn: () => { setInst(b.lid, [1, 1], L); setInst(b.it, [1, 1]); } });
  G.fx.push({ clean: true, t: 1.2, tick: k => { glow.material.opacity = 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (1 - k * 0.5); glow.position.y = 0.55 + k * 0.4; }, fn: () => C.scene.remove(glow) });
}
export function openBox(b) {
  if (!b || b.open || b.kind === 'stand') return; b.open = true; // (a stand: walking up to it picks up its item — units.js updateLoot)
  const L = BOX_LOOT[b.kind], il = Math.max(1, G.depth || G.deep || 1), x = b.x, z = b.z;
  if (b.kind === 'smash' || b.kind === 'trunk' || b.kind === 'urn') { // it bursts: pieces, splinters (an urn: shards of clay) and dust; its cell can be walked again
    const clay = b.kind === 'urn'; setInst(b.it, [0, 0]); shatter(b); if (b.cell) C.floor.unblock(b.cell[0], b.cell[1]); S.smash(); S.hit(1); shake(0.06, x, z);
    C.parts.emit(x, 0.45, z, 14, { col: clay ? 0xa87a52 : 0x8a5a32, spd: 2.8, up: 2.6, grav: 9, life: 0.6, size: 0.16, spread: 0.3 }); C.parts.emit(x, 0.3, z, 10, { col: clay ? 0xb8a890 : 0xc8b49a, spd: 1.2, up: 0.8, grav: 0.5, life: 0.8, size: 0.4, spread: 0.3 }); }
  else { // the lid swings up on a burst of gold light; what is in it comes out a moment later
    S.pick(); S.caught(); lidOpen(b); burst(x, 0.7, z, 0xffe6a0, b.kind === 'gold' ? 2.2 : 1.6);
    C.parts.emit(x, 0.6, z, b.kind === 'gold' ? 34 : 22, { col: 0xffd27a, spd: 1.2, up: 3, grav: 2, life: 0.9, size: 0.16, spread: 0.25 }); }
  const items = []; if (Math.random() < L.item) items.push(itemOf(il, rollQ(L.q))); if (items.length && Math.random() < L.again) items.push(itemOf(il, rollQ(L.q)));
  items.forEach((it, i) => G.fx.push({ t: 0.3 + i * 0.22, fn: () => { const a = Math.random() * 6.28; dropLoot(it, x + Math.cos(a) * 0.75, z + Math.sin(a) * 0.75); } }));
  const soul = PACT && Math.random() < L.soul;
  if (soul) { const v = L.soulN(il); say(x, z, tr(`+${v} 魂能`, `+${v} soul`), '#8ff7ea', 13, 1.6); G.fx.push({ t: 0.3, fn: () => soulToJar(x, 0.8, z, v) }); }
  if (!items.length && !soul) say(x, z, tr('空的', 'Empty'), '#b8aa98', 12, 1.4);
}
// a faint glint now and then from the chests not yet opened, so they are noticed (only near the summoner; the gold ones more)
export function boxTick(dt) { const F = G.floor, P = G.player; if (!F || !F.boxes || !P) return;
  for (const b of F.boxes) if (b.kind === 'stand' && !b.shown && !b.open) { b.shown = true; dropLoot(b.item, b.x, b.z, { stand: b.top, box: b, rack: b.name === 'stand_rack' ? b.r : null, dz: b.dz }); } // (its item, on it)
  for (const b of F.boxes) { if (b.open || !b.lid || Math.random() > dt * (b.kind === 'gold' ? 4 : 2.2) || Math.hypot(b.x - P.x, b.z - P.z) > 16) continue;
    C.parts.emit(b.x + (Math.random() - 0.5) * 0.7, 0.55 + Math.random() * 0.2, b.z + (Math.random() - 0.5) * 0.7, 1, { col: Math.random() < 0.5 ? 0xffe6a0 : QUAL[2].hex, spd: 0.06, up: 0.5, grav: -0.2, life: 1.2, size: 0.13 }); } }
