// 魂契 · 圣骑士 (the Bone Sentinel with a mace and shield): the holy light it calls down — Smite (every third blow), Hammer Leap (its
// charge: the mace thrown, then the leap after it), Blessed Hammers (its whirlwind: spectral hammers wheeling round it while it fights
// on), Judgement (its sundering strike: a pillar of light and rings of it), the Aura of Light (25 Fury: heals and shields its side)
import * as THREE from 'three';
import { G } from './state.js';
import { tr } from './i18n.js';
import { C, say, damage, hostilesOf } from './units.js';
import { hwGeo, HOLY_C, HOLY_HOT, HOLY_AURA_R } from './assets.js';
import { glowSprite, ring } from './gfx.js';
import { runeCircle } from './vfx.js';
import { burst, shake, slamMark, shieldDome, domeEnd } from './fx.js';
import { S } from './audio.js';

const TAU = Math.PI * 2, dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const motes = () => (Math.random() < 0.4 ? HOLY_HOT : HOLY_C);
export const stunHit = (h, t) => { if (h.dead || h.noStun) return; h.stun = Math.max(h.stun || 0, t); if (h.state === 'windup' || h.state === 'cast') h.state = 'idle'; };
// a ring of light racing out to radius r
function wave(x, z, col, r, t, w = 0.35, op = 0.85) { const rg = ring(Math.max(0.05, 1 - w / r), 1, col, op); rg.position.set(x, 0.07, z); C.scene.add(rg);
  G.fx.push({ clean: true, t, tick: k => { const e = 1 - (1 - k) * (1 - k); rg.scale.setScalar(0.15 + e * (r - 0.15)); rg.material.opacity = op * (1 - k); }, fn: () => C.scene.remove(rg) }); }
// a column of light coming down out of the dark onto (x, z): a soft wide glow and a narrow white-hot core, quick in, slow out
export function pillar(x, z, w = 1, life = 0.55, h = 7) {
  const soft = glowSprite(HOLY_C, 1, 0), core = glowSprite(HOLY_HOT, 1, 0); C.scene.add(soft, core);
  G.fx.push({ clean: true, t: life, tick: k => { const inn = Math.min(1, k / 0.12), f = k < 0.12 ? inn : 1 - (k - 0.12) / 0.88, y = h / 2 + (1 - inn) * h * 0.6;
      soft.position.set(x, y, z); core.position.set(x, y, z); soft.scale.set(1.5 * w * (1 + 0.3 * k), h, 1); core.scale.set(0.42 * w * (1 - 0.5 * k), h, 1);
      soft.material.opacity = 0.5 * f; core.material.opacity = 0.9 * f * f; }, fn: () => C.scene.remove(soft, core) });
}
// consecrated ground: a rune circle of light that turns slowly and fades
function consecrate(x, z, r, life = 1.8, op = 0.55) { const m = runeCircle(r, HOLY_C, 0); m.position.set(x, 0.06, z); C.scene.add(m);
  G.fx.push({ clean: true, t: life, tick: k => { m.rotation.y = k * 1.2; m.material.opacity = op * Math.min(1, k * 8) * (1 - k * k); }, fn: () => { C.scene.remove(m); m.material.dispose(); } }); }

// ---------- Smite: every third blow the light comes down on the target, catching those beside it ----------
export const SMITE = { r: 1.7, mult: 0.6, stun: 0.5 };
export function smite(u, t) {
  const x = t.x, z = t.z; pillar(x, z, 0.8, 0.5, 6); burst(x, 1, z, HOLY_HOT, 1.3); wave(x, z, HOLY_C, SMITE.r + 0.3, 0.35, 0.3); slamMark(x, z, 0.7, HOLY_C, 1.6);
  C.parts.emit(x, 0.3, z, 16, { col: HOLY_HOT, spd: 1.6, up: 3.2, grav: -1, life: 0.6, size: 0.18 }); S.holy(0.5);
  for (const h of hostilesOf(u)) { if (h.dead || Math.hypot(h.x - x, h.z - z) > SMITE.r + h.r) continue;
    damage(u, h, u.dmg * SMITE.mult * (0.9 + Math.random() * 0.2), { knock: 1.2, fx: x, fz: z, quiet: true }); stunHit(h, SMITE.stun); }
}

// ---------- Blessed Hammers: spectral hammers wheeling round it, each swinging in and out on its own (so they sweep close and far),
// end over end as they fly; anything one passes through is struck (once per hammer every half second). The Sentinel fights on ----------
export const HAMMERS = { n: 3, dur: 6, w: 3.1, r0: 1.85, dr: 0.95, hitR: 0.72, mult: 0.5, again: 0.5, len: 1.0 };
let HMAT = null;
function hammerMesh() { // the mace itself in gold light: a solid gold body (reads on a light floor), a glowing shell round it, light at its head
  const b = hwGeo('mace'), g = new THREE.Group(); if (!b) return g;
  if (!HMAT) HMAT = [new THREE.MeshBasicMaterial({ map: b.map, color: 0xffc860, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: HOLY_C, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })];
  const h = b.box.max.y - b.box.min.y, k = HAMMERS.len / h, oy = -(b.box.min.y + h / 2) * k; // (spun about its middle)
  for (const [mat, sc] of [[HMAT[0], 1], [HMAT[1], 1.18]]) { const m = new THREE.Mesh(b.geo, mat); m.scale.setScalar(k * sc); m.position.y = oy * sc; m.renderOrder = 6; g.add(m); }
  const head = glowSprite(HOLY_C, 0.9, 0.6); head.position.y = HAMMERS.len * 0.3; g.add(head); return g;
}
export function blessedHammers(u) {
  const H = HAMMERS, list = [], a0 = Math.random() * TAU;
  for (let i = 0; i < H.n; i++) { const g = hammerMesh(); g.rotation.order = 'YXZ'; C.scene.add(g); list.push({ g, ph: i / H.n * TAU, hit: new Map() }); }
  u.hammers = { list, t: 0 }; let last = 0, acc = 0;
  const fx = { clean: true, t: H.dur, fn: () => { for (const q of list) C.scene.remove(q.g); if (u.hammers && u.hammers.list === list) u.hammers = null; } };
  fx.tick = () => { const t = fx.k, dt = Math.max(0, t - last); last = t; if (u.dead) { fx.t = 0; return; }
    const grow = Math.min(1, t / 0.35), fade = Math.min(1, (H.dur - t) / 0.4), y0 = u.mesh ? u.mesh.root.position.y : 0; acc += dt * 26;
    for (const q of list) { const a = a0 + q.ph + H.w * t, r = (0.5 + (H.r0 + H.dr * Math.sin(t * 1.35 + q.ph * 1.7) - 0.5) * grow), x = u.x + Math.sin(a) * r, z = u.z + Math.cos(a) * r;
      q.g.position.set(x, y0 + 1.0 + 0.12 * Math.sin(t * 5 + q.ph), z); q.g.rotation.set(0, a, -t * 13); q.g.scale.setScalar(0.4 + 0.6 * Math.min(grow, fade));
      for (const h of hostilesOf(u)) { if (h.dead || Math.hypot(h.x - x, h.z - z) > H.hitR + h.r || (q.hit.get(h) || -9) > G.t - H.again) continue; q.hit.set(h, G.t);
        damage(u, h, u.dmg * H.mult * (0.9 + Math.random() * 0.2), { knock: 1.3, fx: u.x, fz: u.z, quiet: true }); S.bonk(false, 0.55);
        C.parts.emit(h.x, 1.0, h.z, 7, { col: motes(), spd: 2.4, up: 1.2, grav: 5, life: 0.3, size: 0.14 }); burst(x, 1.0, z, HOLY_C, 0.7); } }
    while (acc >= 1) { acc--; const q = list[Math.floor(Math.random() * list.length)], p = q.g.position; // a trail of light behind each
      C.parts.emit(p.x, p.y, p.z, 1, { col: motes(), spd: 0.2, up: 0.2, grav: 0, life: 0.35, size: 0.22 * fade, spread: 0.12 }); } };
  G.fx.push(fx); S.holy(0.7);
}

// ---------- Judgement: light gathered (the roar's moment) — a burst of it ----------
export function holyBurst(u) {
  const x = u.x, z = u.z; wave(x, z, HOLY_HOT, 4.5, 0.45, 0.5, 0.9); for (let i = 1; i < 4; i++) G.fx.push({ clean: true, t: 0.07 * i, fn: () => wave(x, z, HOLY_C, 4.5 + i * 1.4, 0.55, 0.35, 0.75) });
  pillar(x, z, 1.4, 0.75, 6); burst(x, 1.4, z, HOLY_HOT, 1.7); shake(0.16, x, z); consecrate(x, z, 2.2, 1.2, 0.5);
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; C.parts.emit(x + Math.cos(a) * 0.7, 0.2, z + Math.sin(a) * 0.7, 1, { col: motes(), spd: 1, up: 4.2, grav: -1.5, life: 0.6, size: 0.26, spread: 0.1 }); }
}
// ... and the blow: a pillar of light crashes down in front of it, the ground consecrated, three rings of light racing out — the first
// strikes hard and stuns long (and puts down the weak), the later ones catch what stood farther out
export const JUDGE = { r: [3.5, 5.2, 6.8], mult: [1, 0.6, 0.4], stun: [1.2, 0.6, 0.4], at: [0, 0.14, 0.28] };
export function judgement(u, mv) {
  const x = u.x + Math.sin(u.face) * 1.3, z = u.z + Math.cos(u.face) * 1.3, o = { x, z };
  pillar(x, z, 2.4, 0.9, 9); burst(x, 0.8, z, HOLY_HOT, 2.6); slamMark(x, z, 1.5, HOLY_C, 3); consecrate(x, z, JUDGE.r[0], 2.2, 0.6); shake(0.26, x, z); S.boom(); S.holy(1);
  C.parts.emit(x, 0.2, z, 24, { col: 0x4e443c, spd: 4, up: 3, grav: 11, life: 0.7, size: 0.28, spread: 0.6 });
  for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, r = Math.random() * 2; C.parts.emit(x + Math.sin(a) * r, 0.2, z + Math.cos(a) * r, 1, { col: motes(), spd: 0.4, up: 3 + Math.random() * 3, grav: -0.8, life: 0.8, size: 0.24 }); }
  const hit = (h, k) => { damage(u, h, u.dmg * mv.mult * JUDGE.mult[k] * (0.95 + Math.random() * 0.1), { knock: 2.5, fx: x, fz: z, heavy: !k, crit: !k, critX: 1, quiet: true }); stunHit(h, JUDGE.stun[k]);
    if (!k && !h.dead && !h.champ && h.hp < h.maxHp * 0.25) { say(h.x, h.z, tr('审判', 'Judged'), '#ffe08a', 17, 2); damage(u, h, h.hp + 1, { quiet: true, noFx: true }); } };
  JUDGE.r.forEach((R, k) => G.fx.push({ clean: true, t: Math.max(0.01, JUDGE.at[k]), fn: () => { if (u.dead) return; wave(x, z, k ? HOLY_C : HOLY_HOT, R + 0.3, 0.5, 0.45, 0.9 - 0.15 * k); if (k) { shake(0.1, x, z); S.boom(); }
    const r0 = k ? JUDGE.r[k - 1] : -1;
    for (const h of hostilesOf(u)) { const d = dist(h, o); if (h.dead || d <= r0 + h.r || d > R + h.r) continue;
      if (!k) hit(h, 0); else G.fx.push({ t: Math.max(0.01, (d - r0) / 14), fn: () => { if (!h.dead) hit(h, k); } }); } } }));
}

// ---------- Hammer Leap (its charge): the mace thrown end over end at the target — it stuns it and hangs over it, turning, while the
// Sentinel leaps after it; at the top of the leap the mace flies back into its raised hand, and it comes down in a burst of light ----------
export function thrownHammer(u, from, t, o) {
  const g = hammerMesh(), h = { g, x: from.x, y: from.y, z: from.z, ph: 'fly', tx: t.x, tz: t.z, done: false, back: null }; g.rotation.order = 'YXZ'; g.position.copy(from); C.scene.add(g);
  let last = 0, acc = 0, hy = 0; const fx = { clean: true, t: 6, fn: () => { C.scene.remove(g); h.done = true; } };
  fx.tick = () => { const dt = Math.max(0, fx.k - last); last = fx.k; if (u.dead && h.ph !== 'fly') { fx.t = 0; return; } acc += dt * 30;
    if (h.ph === 'fly') { if (!t.dead) { h.tx = t.x; h.tz = t.z; } const ty = 1.0, dx = h.tx - h.x, dy = ty - h.y, dz = h.tz - h.z, d = Math.hypot(dx, dy, dz), st = o.speed * dt;
      if (d <= st + 0.35 + (t.r || 0.3) * 0.5) { h.x = h.tx; h.y = ty; h.z = h.tz; h.ph = 'hover'; hy = 0; o.onHit && o.onHit(h); }
      else { h.x += dx / d * st; h.y += dy / d * st; h.z += dz / d * st; }
      g.rotation.set(0, Math.atan2(dx, dz), 0); g.rotateX(fx.k * 22); }
    else if (h.ph === 'hover') { hy = Math.min(1, hy + dt / 0.3); const e = 1 - (1 - hy) ** 3; h.x = h.tx; h.z = h.tz; h.y = 1.0 + 1.3 * e; // bounced up off it, hanging there turning
      g.rotation.set(0, fx.k * 6, 0.35 * Math.sin(fx.k * 5)); }
    else if (h.ph === 'back' && h.back) { h.back.getWorldPosition(_hb); const dx = _hb.x - h.x, dy = _hb.y - h.y, dz = _hb.z - h.z, d = Math.hypot(dx, dy, dz), st = 26 * dt;
      if (d <= st + 0.15) { h.ph = 'caught'; fx.t = 0; burst(_hb.x, _hb.y, _hb.z, HOLY_HOT, 1.2); C.parts.emit(_hb.x, _hb.y, _hb.z, 14, { col: motes(), spd: 2.2, up: 1.4, grav: 2, life: 0.4, size: 0.16 }); o.onCaught && o.onCaught(); }
      else { h.x += dx / d * st; h.y += dy / d * st; h.z += dz / d * st; } g.rotateX(dt * 20); }
    g.position.set(h.x, h.y, h.z);
    while (acc >= 1) { acc--; C.parts.emit(h.x, h.y, h.z, 1, { col: motes(), spd: 0.2, up: 0.2, grav: 0, life: 0.35, size: 0.22, spread: 0.12 }); } };
  h.recall = bone => { h.back = bone; h.ph = 'back'; }; h.drop = () => { fx.t = 0; };
  G.fx.push(fx); return h;
}
const _hb = new THREE.Vector3();
export function hammerHit(u, t, mv) { // the thrown mace lands: a blow, a long stun, a flash of light on it
  if (!t.dead) { damage(u, t, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 1, heavy: true, quiet: true }); stunHit(t, mv.stun);
    if (!t.dead && !t.noStun) say(t.x, t.z, tr('眩晕', 'Stunned'), '#ffe08a', 15, 2.1); }
  burst(t.x, 1.0, t.z, HOLY_HOT, 1.5); S.bonk(true); S.holy(0.5); shake(0.1, t.x, t.z); C.parts.emit(t.x, 1.0, t.z, 16, { col: motes(), spd: 2.8, up: 1.6, grav: 4, life: 0.45, size: 0.16 });
}
export function leapBurst(u, mv) { // down with the mace raised: a burst of light where it lands, everything close thrown back
  const x = u.x + Math.sin(u.face) * 0.5, z = u.z + Math.cos(u.face) * 0.5; let n = 0;
  for (const h of hostilesOf(u)) { if (h.dead || Math.hypot(h.x - x, h.z - z) > mv.aoe + h.r) continue;
    damage(u, h, u.dmg * mv.bmult * (0.9 + Math.random() * 0.2), { knock: 3.2, fx: x, fz: z, melee: true, heavy: true, quiet: true }); stunHit(h, mv.bstun); n++; }
  if (n) S.bonk(true); S.boom(); S.holy(0.8); shake(0.22, x, z); u.hitStop = 0.1;
  pillar(x, z, 1.2, 0.5, 6); burst(x, 0.6, z, HOLY_HOT, 2.2); slamMark(x, z, 1.3, HOLY_C, 2.4); consecrate(x, z, mv.aoe, 1.2, 0.5);
  wave(x, z, HOLY_HOT, mv.aoe + 0.3, 0.4, 0.45, 0.95); G.fx.push({ clean: true, t: 0.08, fn: () => wave(x, z, HOLY_C, mv.aoe + 1.6, 0.5, 0.35, 0.7) });
  C.parts.emit(x, 0.2, z, 20, { col: 0x4e443c, spd: 4, up: 3, grav: 11, life: 0.7, size: 0.28, spread: 0.5 });
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; C.parts.emit(x + Math.cos(a) * 0.6, 0.2, z + Math.sin(a) * 0.6, 1, { col: motes(), spd: 3.5, up: 2.2, grav: 1, life: 0.5, size: 0.22, spread: 0.1 }); }
}

// ---------- the Aura of Light (25 Fury): within HOLY_AURA_R of the Sentinel every one of its side (the summoner, the Sentinel itself)
// is healed by a share of the damage it deals, and wears a shield of light — at most 20% of its own life; it fills again after 2.5 s
// untouched, and healing past full goes into it. Out of the aura (or with no aura) it fades. damage() in units.js spends it ----------
export const AURA = { share: 0.1, cap: 0.2, rest: 2.5, fill: 4 };
export const auraOn = u => !!(u && !u.dead && u.mesh && u.mesh.holy && (u.fury || 0) >= 25 && !(u.spawnT > 0));
const inAura = (u, f) => Math.hypot(f.x - u.x, f.z - u.z) <= HOLY_AURA_R;
export function auraTick(u, dt) {
  const on = auraOn(u);
  for (const f of G.friends) { if (f.dead) { f.barrier = 0; f.hdome = null; continue; }
    const cap = f.maxHp * AURA.cap, inside = on && inAura(u, f); f.barrierCap = cap;
    if (inside) { if (G.t - (f.barrierHit || -9) > AURA.rest) f.barrier = Math.min(cap, (f.barrier || 0) + cap / AURA.fill * dt); }
    else if (f.barrier > 0) f.barrier = Math.max(0, f.barrier - cap * 0.5 * dt);
    if (f.hdome && f.hdome.m.parent !== f.mesh.root) { domeEnd(f.hdome); f.hdome = null; } // (its mesh was rebuilt: a new dome)
    if (f.barrier > 0.5 && !f.hdome) f.hdome = shieldDome(f, HOLY_C, f.mesh.hero ? [1.0, 1.75] : 1); // (the tall skeleton: an upright egg of light)
    else if (f.barrier <= 0.5 && f.hdome) { domeEnd(f.hdome); f.hdome = null; }
    if (f.hdome) f.hdome.k = 0.22 + 0.38 * Math.min(1, f.barrier / cap); } // (faint while it holds; it flares where it is struck)
}
// healing the whole side from what it deals: each one in the aura gets it all; past full life it goes into the shield; one number every half second
export function auraHeal(u, h) {
  for (const f of G.friends) { if (f.dead || !inAura(u, f)) continue; const room = f.maxHp - f.hp, add = Math.min(room, h); f.hp += add;
    if (h > add) f.barrier = Math.min(f.barrierCap || f.maxHp * AURA.cap, (f.barrier || 0) + (h - add));
    if (!f.auraAcc) G.fx.push({ t: 0.45, fn: () => { const v = f.auraAcc; f.auraAcc = 0; if (f.dead || v < 1) return; say(f.x, f.z, '+' + Math.round(v), '#ffe08a', 13, 2.2);
      C.parts.emit(f.x, 1.0, f.z, 6, { col: motes(), spd: 0.6, up: 1.4, grav: -0.6, life: 0.55, size: 0.18, spread: 0.3 }); } });
    f.auraAcc = (f.auraAcc || 0) + h; }
}
