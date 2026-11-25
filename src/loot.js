// 宝箱与木桶 / Chests and barrels: the crypt's barrels, kegs, boxes and crates break when the summoner gets to them (click / tap one),
// the chests and trunks (and the chest in the middle of a ruin in the wilds) open. Barrels: now and then an item, some soul energy (魂契);
// chests: always an item, often a second, better odds, more soul. They stay instanced in the floor's PropBatch: a barrel's instance is
// shrunk away (its cell walkable again), a chest jumps and is left as it is (no more glints: looted).
import * as THREE from 'three';
import { G, PACT } from './state.js';
import { tr } from './i18n.js';
import { C, say, dropLoot } from './units.js';
import { rollHeroItem, rollItem, QUAL } from './data.js';
import { burst, shake } from './fx.js';
import { S } from './audio.js';
import { soulToJar } from './soulvessel.js';

export const BOX_KIND = { barrel_small: 'smash', barrel_large: 'smash', keg: 'smash', box_small: 'smash', box_large: 'smash', crates_stacked: 'smash', chest: 'chest', trunk_large_A: 'chest' };
// loot: the chance of an item and its quality odds (white .. red; red only in 魂契), a second item's chance, 魂能 (chance, amount at item level il)
export const BOX_LOOT = {
  smash: { item: 0.2, q: [0.55, 0.32, 0.11, 0.02, 0], again: 0, soul: 0.35, soulN: il => 1 + Math.round(il * 0.4) },
  chest: { item: 1, q: [0.2, 0.45, 0.26, 0.08, 0.01], again: 0.35, soul: 1, soulN: il => 4 + il },
};
// a box's place in the floor: name, where, its PropBatch item (for the instance), the grid cell it blocks (crypt only: freed when it breaks)
export function addBox(F, name, x, z, it, cell) { (F.boxes || (F.boxes = [])).push({ name, kind: BOX_KIND[name], x, z, it, cell, open: false }); }
// the box under a click (the click can land a little behind a tall one, the camera looking down along -x/-z)
export function pickBox(p, r = 0.75) { const F = G.floor; if (!F || !F.boxes || !p) return null; let best = null, bd = r;
  for (const b of F.boxes) { if (b.open) continue; for (let h = 0; h <= 0.9; h += 0.3) { const k = 0.69 * h, d = Math.hypot(p.x + k - b.x, p.z + k - b.z); if (d < bd) { bd = d; best = b; } } }
  return best; }
const rollQ = q => { let r = Math.random(); for (let i = 0; i < q.length; i++) { if (r < q[i]) return i; r -= q[i]; } return 0; };
const itemOf = (il, q) => PACT ? rollHeroItem(G.uid++, il, q) : rollItem(G.uid++, il, Math.min(q, 3));
const M4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
function setInst(b, k) { const it = b.it; if (!it || !it.im) return; const [x, y, z, r, sx, sy, sz] = it; _q.setFromAxisAngle(_up, r);
  it.im.setMatrixAt(it.ix, M4.compose(_p.set(x, y, z), _q, _s.set(sx * k[0], sy * k[1], sz * k[0]))); it.im.instanceMatrix.needsUpdate = true; }
const _up = new THREE.Vector3(0, 1, 0);
export function openBox(b) {
  if (!b || b.open) return; b.open = true; const L = BOX_LOOT[b.kind], il = Math.max(1, G.depth || G.deep || 1), x = b.x, z = b.z;
  if (b.kind === 'smash') { // it bursts: splinters and dust, gone; its cell can be walked again
    setInst(b, [0, 0]); if (b.cell) C.floor.unblock(b.cell[0], b.cell[1]); S.smash(); S.hit(1); shake(0.05, x, z);
    C.parts.emit(x, 0.45, z, 16, { col: 0x8a5a32, spd: 2.8, up: 2.6, grav: 9, life: 0.6, size: 0.18, spread: 0.3 }); C.parts.emit(x, 0.3, z, 10, { col: 0xc8b49a, spd: 1.2, up: 0.8, grav: 0.5, life: 0.8, size: 0.4, spread: 0.3 }); }
  else { // the chest jumps, a burst of gold light; what is in it comes out a moment later
    S.pick(); S.caught(); burst(x, 0.7, z, 0xffe6a0, 1.6); C.parts.emit(x, 0.6, z, 22, { col: 0xffd27a, spd: 1.4, up: 2.8, grav: 2, life: 0.8, size: 0.16, spread: 0.3 });
    G.fx.push({ clean: true, t: 0.3, tick: k => setInst(b, [1 + 0.12 * Math.sin(Math.PI * k), 1 + 0.25 * Math.sin(Math.PI * k)]), fn: () => setInst(b, [1, 1]) }); }
  const items = []; if (Math.random() < L.item) items.push(itemOf(il, rollQ(L.q))); if (items.length && Math.random() < L.again) items.push(itemOf(il, rollQ(L.q)));
  items.forEach((it, i) => G.fx.push({ t: 0.18 + i * 0.22, fn: () => { const a = Math.random() * 6.28; dropLoot(it, x + Math.cos(a) * 0.7, z + Math.sin(a) * 0.7); } }));
  const soul = PACT && Math.random() < L.soul;
  if (soul) { const v = L.soulN(il); say(x, z, tr(`+${v} 魂能`, `+${v} soul`), '#8ff7ea', 13, 1.6); G.fx.push({ t: 0.25, fn: () => soulToJar(x, 0.8, z, v) }); }
  if (!items.length && !soul) say(x, z, tr('空的', 'Empty'), '#b8aa98', 12, 1.4);
}
// a faint glint now and then from the chests not yet opened, so they are noticed (only near the summoner)
export function boxTick(dt) { const F = G.floor, P = G.player; if (!F || !F.boxes || !P) return;
  for (const b of F.boxes) { if (b.open || b.kind !== 'chest' || Math.random() > dt * 2.2 || Math.hypot(b.x - P.x, b.z - P.z) > 16) continue;
    C.parts.emit(b.x + (Math.random() - 0.5) * 0.7, 0.55 + Math.random() * 0.2, b.z + (Math.random() - 0.5) * 0.7, 1, { col: Math.random() < 0.5 ? 0xffe6a0 : QUAL[2].hex, spd: 0.06, up: 0.5, grav: -0.2, life: 1.2, size: 0.13 }); } }
