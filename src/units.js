// Units, combat, monster / minion AI, corpses and capturing
import * as THREE from 'three';
import { G, save, bagPut, PACT } from './state.js';
import { TYPES, MODS, SKILLS, xpNeed, partySize, TREE, soulPoints, soulXP, ELEM, PACE, affixName, MAX_AFFIX, MAX_AFFIX_LV, QUAL, BAG_MAX, rollDrop, itemName, itemBase, makeGun, treeKey, techOf, TECH } from './data.js';
import { auraMat, glowSprite, ring, toonMat, part, merge } from './gfx.js';
import { tr } from './i18n.js';
import { makeUnitMesh, play, playUpper, partClip, clipLen, CHARS, propMesh, propGeo, heroWeaponPose } from './assets.js';
import { slash, impact, burst, shake, trail, spinFx, slamMark, debris, shieldDome, domeHit, domeEnd, empWave } from './fx.js';
import { S } from './audio.js';
import { runeCircle } from './vfx.js';
import { engTick, clearDrones, rodBeam, orbitalSkill, updateCall, updateTechFx } from './drones.js';

export const C = { scene: null, parts: null, floor: null, say: () => {} };
// 魂契 hooks (filled in by pact.js, which imports this module): stats, name, strike, evade, kill, death of the pact skeleton
export const PH = {};
const rand = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2, tmp = { x: 0, z: 0 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// rank of a summon skill (enemies have none)
export const rk = (u, id) => (u.entry && u.entry.skills && u.entry.skills[id]) || 0;
// affix strength (1..3; raised by fusion)
export const mlv = (u, m) => (u.modLv && u.modLv[m]) || 1;
let nextId = 1;

export class Unit {
  constructor(kind, side, x, z, o = {}) {
    this.id = nextId++; this.kind = kind; this.side = side; this.x = x; this.z = z; this.vx = this.vz = this.kx = this.kz = 0; this.wantX = this.wantZ = 0;
    this.level = o.level || 1; this.mods = o.mods || []; this.modLv = o.modLv || {}; this.champ = !!o.champ; this.entry = o.entry || null; this.packId = o.packId ?? -1;
    this.T = TYPES[kind] || null; this.state = 'idle'; this.st = 0; this.cdT = rand(0.2, 0.8); this.target = null; this.face = rand(0, TAU);
    this.home = { x, z }; this.aggro = false; this.scanT = rand(0, 0.35); this.flash = 0; this.stun = 0; this.dead = false; this.barT = 0;
    this.flank = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0; this.strafeDir = 0; this.resCD = rand(2, 4); this.healCD = 2; this.walkPh = rand(0, 6); this.lostT = 0;
    this.stats();
    this.hp = this.maxHp * (o.hpFrac ?? 1);
    const ally = side === 'ally', champ = this.champ;
    const mod0 = this.mods[0] && MODS[this.mods[0]];
    this.meshOpts = {
      scale: champ ? (ally ? 1.1 : 1.25) : 1,
      tint: this.mods.includes('stone') ? 0xb8b4ac : this.mods.includes('fire') && champ ? 0xffc8a8 : 0xffffff,
      emis: 0x000000, rim: 0x000000, elems: champ && mod0 ? this.mods.slice() : null, soul: ally,
      outline: 0x120a10, outlineW: champ ? 0.06 : 0.05,
    };
    this.mesh = makeUnitMesh(kind, { ...this.meshOpts, gear: this.entry && this.entry.gear, hero: this.entry && this.entry.hero, wset: this.entry && this.entry.wset });
    this.mesh.root.position.set(x, 0, z); this.mesh.root.rotation.y = this.face; C.scene.add(this.mesh.root);
    this.spawnT = 0; this.animLock = 0; this.mixAcc = 0; play(this.mesh, ANIM[kind].idle, { at: Math.random() });
    if (ally) { const rg = ring(0.45, 0.5, 0x3fe0d0, 0.35); rg.position.y = 0.03; this.mesh.root.add(rg); this.ringMesh = rg; }
    if (champ && mod0) { const rg = ring(0.56, 0.685, mod0.col, 0.55); rg.position.y = 0.03; this.mesh.root.add(rg); this.ringMesh = rg; }
  }
  get name() { if (this.pact && PH.name) return PH.name(this); return affixName(this.mods, this.champ) + (this.tech ? this.tech.name : this.T ? this.T.name : tr('召唤师', 'Summoner')); }
  stats() { Unit.prototype._stats.call(this); this.speed *= PACE.move; if (this.cd) this.cd /= PACE.act; if (this.gun) this.rof = this.cd / 6; }
  _stats() {
    const L = this.level;
    if (this.kind === 'player') { this.maxHp = 90 + 10 * (L - 1); this.maxMp = 40 + 5 * (L - 1); this.speed = 4.6; this.r = 0.36; this.armor = 8 + 2 * L; this.dmg = 10 + 2.5 * (L - 1); if (PACT) this.dmg *= 0.5; return; } // 魂契: the summoner supports, the skeleton kills
    if (this.entry && this.entry.pact && PH.stats) { PH.stats(this); return; }
    const T = this.T, ally = this.side === 'ally', k = ally ? 0.15 : 0.28, kd = ally ? 0.15 : 0.18;
    this.maxHp = T.hp * (1 + k * (L - 1)) * (ally ? 1.35 : 1); this.dmg = T.dmg * (1 + kd * (L - 1)) * (ally ? 1.15 : 1);
    this.armor = T.armor + 2 * (L - 1); this.speed = T.speed * (ally ? 1.08 : 1); this.range = T.range; this.cd = T.cd; this.r = T.r; this.noStun = false;
    if (ally && this.kind === 'brute') this.speed = TYPES.imp.speed * 1.08 * 0.92;
    // 魂契: monsters are slow, fights stand still around the skeleton; the slow kinds (warrior, archer, mage) close up to just under a minion
    if (PACT && !ally) this.speed = Math.max(this.speed, TYPES.imp.speed * 0.9) * 0.6;
    if (this.champ) { this.maxHp *= 2.4; this.dmg *= 1.35; this.r *= ally ? 1.08 : 1.2; }
    if (this.mods.includes('fast')) { const l = mlv(this, 'fast'); this.speed *= 1.35 + 0.1 * l; this.cd *= 0.75 - 0.05 * l; }
    if (this.mods.includes('stone')) { const l = mlv(this, 'stone'); this.armor += 35 + 25 * l; this.maxHp *= 1.2 + 0.1 * l; this.speed *= 0.85; this.noStun = true; }
    this.taunt = ally && this.kind === 'brute'; this.tauntR = 5;
    if (!this.entry) return;
    const r = id => rk(this, id), tech = this.tech = techOf(this.entry), gunHeld = !!tech && tech.key === 'gunner', mortar = !!tech && tech.key === 'bomber', mech = !!tech && tech.key === 'mech', eng = !!tech && tech.key === 'engineer';
    if (this.kind === 'brute' && !mech) { this.maxHp *= 1 + 0.12 * r('bone'); this.armor += 5 * r('bone'); this.tauntR = 5 + 1.5 * r('taunt'); }
    else if (this.kind === 'imp' && !gunHeld) { this.cd *= 1 - 0.07 * r('haste'); this.speed *= 1 + 0.04 * r('haste'); } // the gunner's tree has no attack speed
    else if (this.kind === 'archer' && !mortar) { this.dmg *= 1 + 0.12 * r('eagle'); this.range += 0.4 * r('eagle'); this.cd *= 1 - 0.08 * r('rapid'); }
    const g = this.entry.gear || {};
    if (g.w && g.w.type === this.kind) { const v = g.w.v; this.dmg *= 1 + v.dmg / 100; this.cd *= itemBase(g.w).cd / (1 + (v.spd || 0) / 100); this.maxHp *= 1 + (v.hp || 0) / 100; }
    if (g.a) { const v = g.a.v; this.maxHp *= 1 + v.hp / 100; this.armor += v.arm; this.dmg *= 1 + (v.dmg || 0) / 100; this.speed *= 1 + (v.move || 0) / 100; }
    // 机枪骷髅: a minion holding the easter-egg gatling fights at range with sustained fire (each round ~21% of a stab, ~8 rounds a second)
    this.gun = gunHeld; if (this.gun) { this.cd = 0.72 * this.cd / this.T.cd; this.range = 6.5; this.maxHp *= 1.4; this.armor += 8; } // cd = one 6-round belt; a sturdier late-game unit
    // 炮手骷髅: slow, heavy, long-range shells (the damage multiplier lives on the shell)
    this.mortar = mortar; if (mortar) { this.cd *= 1.4; this.range = 9; this.maxHp *= 1.3; this.armor += 5; }
    // 机甲骷髅: soulsteel armour — tougher, a touch slower; the drill grinds (drillTick)
    this.mech = mech; if (mech) { this.maxHp *= 1.45; this.armor += 15; this.speed *= 0.95; this.r *= 1.04; this.tauntR = 6; }
    // 机械师骷髅: the drones do most of the work (drones.js); a bit sturdier, a touch more reach
    this.eng = eng; if (eng) { this.maxHp *= 1.25; this.armor += 6; this.range = 7.5; }
  }
  remove() { C.scene.remove(this.mesh.root); if (this.dr) clearDrones(this); }
  // new weapon / shield in hand after an equipment change
  rebuildMesh() {
    const old = this.mesh; this.mesh = makeUnitMesh(this.kind, { ...this.meshOpts, gear: this.entry && this.entry.gear, hero: this.entry && this.entry.hero, wset: this.entry && this.entry.wset });
    this.mesh.root.position.copy(old.root.position); this.mesh.root.rotation.y = this.face; if (this.ringMesh) { old.root.remove(this.ringMesh); this.mesh.root.add(this.ringMesh); }
    C.scene.remove(old.root); C.scene.add(this.mesh.root); play(this.mesh, ANIM[this.kind].idle, {}); this.mesh.mixer.update(0);
  }
}

export const hostilesOf = u => u.side === 'enemy' ? G.friends : G.enemies;
// floating text; num: 1 a damage number (pops in, drifts aside), 2 a crit (bigger pop, a shiver)
export function say(x, z, text, col = '#fff', size = 15, y = 1.7, num = 0) { G.msgs.push({ x, y, z, text, col, size, t: 0, max: num ? 0.9 : 1.0, num, dx: num ? (Math.random() - 0.5) * 2 : 0 }); }

// ---------- damage / death ----------
export function damage(src, dst, amt, o = {}) {
  if (!dst || dst.dead) return 0;
  if (dst.evade && !o.dot && Math.random() < dst.evade && PH.evade) { PH.evade(src, dst); return 0; } // 魂契 skeleton: evasion
  if (dst.guardT > G.t && PH.guard && !o.dot) { const k = PH.guard(src, dst, o); if (k <= 0) return 0; amt *= k; } // 魂契 skeleton: its Guard skill
  const sh = dst.shred || 0, arm = Math.max(0, dst.armor - sh); // AP rounds: each stack −1 armour, +0.6% damage taken
  let d = Math.max(1, amt * (1 - arm / (arm + 60)) * (1 - 0.08 * rk(dst, 'taunt')) * (1 + 0.006 * sh) * (dst.deployT > 0 ? 0.65 : 1)); if (o.crit) d *= o.critX || 2;
  let soaked = false; if (dst.shieldHP > 0) { const ab = Math.min(d, dst.shieldHP); dst.shieldHP -= ab; d -= ab; soaked = true; domeHit(dst.dome); if (dst.shieldHP <= 0) endShield(dst); }
  dst.hp -= d; dst.flash = Math.max(dst.flash || 0, o.heavy || o.crit ? 1 : o.sum ? 0.5 : 0.75); dst.barT = 3; dst.lastHit = G.t;
  if (o.knock && !(dst.deployT > 0) && !dst.pact) { const dx = dst.x - (o.fx ?? src.x), dz = dst.z - (o.fz ?? src.z), l = Math.hypot(dx, dz) || 1; dst.kx += dx / l * o.knock; dst.kz += dz / l * o.knock; }
  if (dst.kind !== 'player' && !dst.noStun && !(dst.deployT > 0) && !o.dot && (d >= dst.maxHp * (dst.kind === 'brute' ? 0.25 : 0.12) || o.knock)) { dst.stun = Math.max(dst.stun, 0.3); if (dst.state === 'windup' || dst.state === 'cast') dst.state = 'idle'; }
  if (dst.side === 'enemy' && src && !src.dead) { if (!dst.target || Math.random() < 0.4) dst.target = src; if (!dst.aggro) { dst.aggro = true; alertPack(dst, src); } }
  if (dst.kind === 'player') { S.hurt(); if (d > dst.maxHp * 0.08) shake(0.06); } else if (!o.dot && !o.sum && !o.quiet) S.hit(Math.min(1, d / 20));
  // feel of the blow: a blade leaves a slash and a flash; heavy blows and crits freeze both bodies for a few frames; the one hit jolts
  if (!o.dot) { const heavy = o.heavy || o.crit; dst.jolt = Math.max(dst.jolt || 0, heavy ? 1 : o.sum ? 0.35 : 0.65);
    if (o.melee && src) { slash(src, dst, src.mesh && src.mesh.blade ? src.mesh.blade.col : 0xfff0e0, { crit: o.crit, heavy: o.heavy });
      if (heavy) { src.hitStop = Math.max(src.hitStop || 0, 0.075); dst.hitStop = Math.max(dst.hitStop || 0, 0.095); if (o.heavy) shake(o.crit ? 0.1 : 0.06, dst.x, dst.z); } else dst.hitStop = Math.max(dst.hitStop || 0, 0.045); }
    else if (o.crit) dst.hitStop = Math.max(dst.hitStop || 0, 0.05); }
  if (src && src.champ && !o.noFx) for (const mod of src.mods) { const el = ELEM[mod]; if (!el) continue; C.parts.emit(dst.x, 0.7, dst.z, src.mods.length > 1 ? 6 : 11, el.hit); elemHit(mod, src, dst, d, o); }
  let shown = d; // machine-gun rounds: one number for every 3 (or at once on a crit / the killing round)
  if (o.sum) { dst.sumD = (dst.sumD || 0) + d; dst.sumN = (dst.sumN || 0) + 1; if (dst.sumN < 3 && !o.crit && !o.flush && dst.hp > 0) return d; shown = dst.sumD; dst.sumD = dst.sumN = 0; }
  if ((!o.dot || d >= 3) && !(soaked && d < 0.5)) say(dst.x, dst.z, (o.crit ? tr('暴击 ', 'CRIT ') : '') + Math.round(shown), o.dot ? (o.dot === 'poison' ? '#8aff5a' : o.dot === 'fire' ? '#ffb060' : '#bfe8ff') : dst.side === 'enemy' ? (o.crit ? '#ffd34d' : '#ffffff') : soaked ? '#8fe8ff' : '#ff6b6b', o.crit ? 18 : o.dot ? 12 : 14, 1.4 + Math.random() * 0.4, o.dot ? 0 : o.crit ? 2 : 1);
  if (dst.hp <= 0) { const ox = o.fx ?? (src ? src.x : dst.x), oz = o.fz ?? (src ? src.z : dst.z); dst.dieDx = dst.x - ox; dst.dieDz = dst.z - oz;
    dst.dieHard = !!(o.heavy || o.crit || (o.knock || 0) >= 2 || d > dst.maxHp * 0.45 || -dst.hp > dst.maxHp * 0.3); kill(dst, src); }
  return d;
}
export function alertPack(u, t) {
  for (const e of G.enemies) if (!e.aggro && e !== u && (e.packId === u.packId || dist(e, u) < 3.5)) { e.aggro = true; e.target = t; }
  S.rally();
}
function kill(u, src) {
  u.dead = true; u.hp = 0; u.poison = null; u.chillT = 0; u.mesh.u.uStat.value.w = 0;
  if (u.side === 'enemy') {
    S.die(); C.parts.emit(u.x, 0.6, u.z, 10, { col: 0xd8d0c0, spd: 2, life: 0.6, size: 0.18 }); C.parts.emit(u.x, 0.5, u.z, 8, { col: 0xd8ccb8, spd: 2.6, up: 2.4, grav: 8, life: 0.6, size: 0.16 }); if (u.champ) { shake(0.08, u.x, u.z); burst(u.x, 0.8, u.z, 0xffd8a0, 1.6); const P = G.player; if (P && Math.hypot(P.x - u.x, P.z - u.z) < 12 && !(G.slowCD > G.t)) { G.slowT = 0.22; G.slowCD = G.t + 1.5; } }
    const xp = u.T.xp * (1 + 0.25 * (u.level - 1)) * (u.champ ? 3 : 1); addXP(PACT ? xp * 0.6 : xp); if (src && src.pact && PH.kill) PH.kill(src, u);
    for (const a of G.friends) if (a.side === 'ally') allyXP(a, xp * 0.7);
    deathBlast(u, 0.7); const it = rollDrop(G.uid, G.depth || u.level, u.champ); /* the wilds: by the monster's level */ if (it) { G.uid++; dropLoot(it, u.x, u.z); }
    if (u.kind === 'imp') for (const e of G.enemies) if (e.kind === 'imp' && !e.dead && !e.champ && e !== u && dist(e, u) < 7.5 && Math.random() < 0.1) panic(e, src || u); /* only the odd one loses its nerve */
    makeCorpse(u);
  } else if (u.side === 'ally') {
    S.die(); if (u.dr) clearDrones(u, true); const en = u.entry;
    if (en && en.pact) { if (u.dieHard && u.mesh.root.visible) debris(u.x, 0.7, u.z, u.dieDx || 1, u.dieDz || 0, 3, 3.5); PH.death && PH.death(u); fadeOut(u); return; } // no revive timer: summon it again
    if (en) { en.unit = null; en.reviveT = en.reviveMax = 10 + 1.5 * en.level; } if (u.dieHard && u.mesh.root.visible) debris(u.x, 0.7, u.z, u.dieDx || 1, u.dieDz || 0, 3, 3.5);
    deathBlast(u, 0.5);
    C.say(tr(`${u.name} 倒下了，${Math.round(en ? en.reviveT : 10)} 秒后复原`, `${u.name} fell — back in ${Math.round(en ? en.reviveT : 10)}s`)); fadeOut(u);
  } else { // player
    u.respawnT = 2.8; u.state = 'dead'; C.say(tr('你倒下了……', 'You have fallen…'), true); play(u.mesh, ANIM.player.die, { once: true, fade: 0.1 });
  }
}
function fadeOut(u) { const m = u.mesh; play(m, ANIM[u.kind].die, { once: true, speed: 1.3, fade: 0.08 }); if (u.ringMesh) m.root.remove(u.ringMesh); let lk = 0;
  G.fx.push({ clean: true, t: 1.4, tick: (k) => { m.mixer.update((k - lk) * 1.4); lk = k; m.u.uFade.value = Math.min(1, (1 - k) * 2.2); for (const gs of m.glows) gs.material.opacity = 0.85 * Math.min(1, (1 - k) * 2.2); }, fn: () => u.remove() }); }
function fireBlast(u) {
  S.boom(); C.parts.emit(u.x, 0.4, u.z, 40, { col: 0xff8a2a, spd: 5, up: 2, life: 0.7, size: 0.35 }); burst(u.x, 0.6, u.z, 0xff9a40, 3.2); shake(0.2, u.x, u.z);
  const rg = ring(0.2, 0.5, 0xff7a20, 0.9); rg.position.set(u.x, 0.05, u.z); C.scene.add(rg);
  G.fx.push({ clean: true, t: 0.45, tick: k => { rg.scale.setScalar(1 + k * 5); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) });
  const lv = mlv(u, 'fire'); for (const h of (u.side === 'enemy' ? G.friends : G.enemies)) if (!h.dead && dist(h, u) < 2.4 + 0.3 * (lv - 1)) damage(u, h, u.dmg * 1.6 * (1 + 0.4 * (lv - 1)), { knock: 3, fx: u.x, fz: u.z, noFx: true });
}
// ---------- loot on the ground: glows in its quality colour (rare items get a light beam), walk over it to pick it up ----------
export function dropLoot(it, x, z) {
  const root = new THREE.Group(), model = itemBase(it).model, m = propMesh(model); m.scale.setScalar(0.5); m.rotation.set(Math.PI / 2, 0, Math.random() * 6.28); root.add(m);
  if (it.q >= 2) { const pg = propGeo(model), b = pg.box, zl = b.max.z - b.min.z > b.max.y - b.min.y; // rare and up: the same flowing energy as in a hand
    m.add(new THREE.Mesh(pg.geo, auraMat(QUAL[it.q].hex, zl ? b.max.z - b.min.z : b.max.y, null, 0.05, it.q === 3 ? 1.7 : 1.45, zl ? new THREE.Vector3(0, 0, 1) : undefined))); }
  const Q = QUAL[it.q], gl = glowSprite(Q.hex, it.q ? 1.4 : 0.9, it.q ? 0.75 : 0.45); gl.position.y = 0.1; root.add(gl);
  if (it.q >= 2) { const beam = glowSprite(Q.hex, 1, it.q === 3 ? 0.75 : 0.55); beam.scale.set(it.q === 3 ? 0.6 : 0.45, it.q === 3 ? 7 : 5, 1); beam.position.y = it.q === 3 ? 3.2 : 2.2; root.add(beam); }
  const a = Math.random() * 6.28, r = 0.5 + Math.random() * 0.7; root.position.set(x, 1, z); C.scene.add(root);
  G.loot.push({ it, root, m, x0: x, z0: z, x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, t: 0, ph: Math.random() * 6 });
  if (it.q >= 2) S.level(); else if (it.q === 1) S.heal();
}
// the camp coffin's secret: opens once per save and spits out the gatling
export function openCoffin() {
  const F = C.floor, c = F && F.coffin, P = G.player; if (!c || G.egg) return; G.egg = 1;
  C.parts.emit(c.x, 0.4, c.z, 46, { col: 0xb46cff, spd: 2.6, up: 3.2, life: 1.1, size: 0.34 }); C.parts.emit(c.x, 0.5, c.z, 24, { col: 0xffe6a0, spd: 1.8, up: 2.4, life: 0.8, size: 0.2 });
  const rg = ring(0.2, 1.6, 0xb46cff, 0.8); rg.position.set(c.x, 0.05, c.z); C.scene.add(rg); G.fx.push({ clean: true, t: 0.8, tick: k => { rg.scale.setScalar(0.4 + k * 1.6); rg.material.opacity = 0.8 * (1 - k); }, fn: () => C.scene.remove(rg) });
  S.raise(); C.say(tr('棺材里藏着什么……', 'Something was hidden in the coffin…'), true);
  const s = F.snapToward(c.x + (P.x - c.x) * 0.4, c.z + (P.z - c.z) * 0.4, P.x, P.z) || { x: P.x, z: P.z };
  const gun = makeGun(G.uid++); G.fx.push({ t: 0.45, fn: () => dropLoot(gun, s.x, s.z) }); save();
}
export function updateLoot(dt) {
  const P = G.player; let j = 0;
  for (const L of G.loot) { L.t += dt; const k = Math.min(1, L.t / 0.45), x = L.x0 + (L.x - L.x0) * k, z = L.z0 + (L.z - L.z0) * k, y = k < 1 ? 1 * (1 - k) + Math.sin(Math.PI * k) * 0.8 : 0.12 + Math.sin(G.t * 2.5 + L.ph) * 0.04;
    L.root.position.set(x, y, z); L.m.rotation.z += dt * 0.8;
    if (k >= 1 && P && !P.dead && Math.hypot(P.x - L.x, P.z - L.z) < 1.5) {
      if (G.bag.length >= BAG_MAX) { if (!L.full) { L.full = true; C.say(tr('背包满了，打开背包（I）把多余的丢进熔炉吧', 'Bag is full — open the bag (I) and feed the spares to the forge')); } }
      else { bagPut(L.it); C.scene.remove(L.root); S.pick(); C.say(tr(`拾取：${itemName(L.it)}`, `Picked up: ${itemName(L.it)}`)); say(L.x, L.z, itemName(L.it), QUAL[L.it.q].col, 14, 1.0);
        if (L.it.uniq && TECH[L.it.uniq]) { const tn = TYPES[TECH[L.it.uniq].type].name; C.say(tr(`史诗武器！点左上角的${tn}卡片，把它装上试试`, `An epic weapon! Tap a ${tn} card (top left) and equip it`), true, 6000); } save(); continue; } }
    G.loot[j++] = L; }
  G.loot.length = j;
}
// equipment changes from the 墓典
// put an item in a summon's slot (or clear it); returns what was there
export function setGear(en, slot, it) { en.gear = en.gear || {}; const old = en.gear[slot] || null; if (it) en.gear[slot] = it; else delete en.gear[slot]; gearChanged(en); return old; }
function gearChanged(en) { const u = en.unit; if (u && !u.dead) { const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; u.rebuildMesh(); } save(); }

// ---------- elemental affixes: what champion hits do, and what champions leave behind when they fall ----------
const CHILL = 2.2;
function elemHit(mod, src, dst, d, o) {
  const lv = mlv(src, mod);
  if (mod === 'cold') { if (!dst.dead) { if (!(dst.chillT > 0)) say(dst.x, dst.z, tr('冻结', 'Chilled'), '#bfe8ff', 13, 2.0); dst.chillT = Math.max(dst.chillT || 0, CHILL * (1 + 0.3 * (lv - 1))); } }
  else if (mod === 'poison' && !o.dot) { if (!dst.dead) { const tot = d * 0.6 * (1 + 0.4 * (lv - 1)), p = dst.poison; if (!p || p.left * p.dps < tot) dst.poison = { dps: tot / 3, left: 3, tick: 0.5, src }; } }
  else if (mod === 'lightning' && !o.noChain && Math.random() < (src.kind === 'archer' || src.kind === 'shaman' ? 0.5 : 0.35) + 0.1 * (lv - 1)) {
    let from = dst, n = 0; const hit = new Set([dst]);
    while (n < 2) { let nx = null, nd = 3.8; for (const h of (dst.side === 'enemy' ? G.enemies : G.friends)) { if (h.dead || hit.has(h)) continue; const dd = dist(h, from); if (dd < nd) { nd = dd; nx = h; } }
      if (!nx) break; bolt(from, nx); hit.add(nx); damage(src, nx, d * (0.45 + 0.1 * lv), { noChain: true, noFx: true }); C.parts.emit(nx.x, 0.8, nx.z, 8, ELEM.lightning.hit); from = nx; n++; }
    if (n) S.zap(); }
}
export function bolt(a, b, life = 0.22) { G.bolts.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, until: G.t + life, seed: Math.random() * 100 }); }
function deathBlast(u, delay) {
  if (!u.champ) return; u.mods.forEach((m, i) => { const d = delay * 0.6 + i * 0.35;
    if (m === 'fire') G.fx.push({ t: delay + i * 0.35, fn: () => fireBlast(u) });
    else if (m === 'cold') G.fx.push({ t: d, fn: () => frostNova(u) });
    else if (m === 'poison') G.fx.push({ t: d, fn: () => poisonCloud(u) });
    else if (m === 'lightning') G.fx.push({ t: d, fn: () => thunder(u) }); });
}
function shock(u, col, r) { const rg = ring(0.2, 0.5, col, 0.9); rg.position.set(u.x, 0.05, u.z); C.scene.add(rg); G.fx.push({ clean: true, t: 0.45, tick: k => { rg.scale.setScalar(1 + k * r * 2); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) }); }
function frostNova(u) {
  S.frost(); C.parts.emit(u.x, 0.4, u.z, 36, { col: 0xcfeeff, spd: 5, up: 1.5, grav: 3, life: 0.6, size: 0.28 }); shock(u, 0x7cc8ff, 3);
  const lv = mlv(u, 'cold'); for (const h of hostilesOf(u)) if (!h.dead && dist(h, u) < 3.2 + 0.4 * (lv - 1)) { damage(u, h, u.dmg * 0.9 * (1 + 0.4 * (lv - 1)), { noFx: true }); h.chillT = Math.max(h.chillT || 0, 3.5 + lv - 1); }
}
function poisonCloud(u) {
  S.fire(); const disc = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3fbf2a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.position.set(u.x, 0.04, u.z); disc.renderOrder = 2; C.scene.add(disc);
  const lv = mlv(u, 'poison'); G.clouds.push({ x: u.x, z: u.z, r: 2.3, t: 0, max: 4.5 + (lv - 1), tick: 0, dps: u.dmg * 0.55 * (1 + 0.4 * (lv - 1)), side: u.side, src: u, disc });
}
function thunder(u) {
  S.zap(); S.boom(); C.parts.emit(u.x, 1.0, u.z, 30, { col: 0xfffbd0, spd: 5, up: 2, grav: 0, life: 0.3, size: 0.22 }); shock(u, 0xfff07a, 2.5);
  const lv = mlv(u, 'lightning'), list = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 4.8).sort((a, b) => dist(a, u) - dist(b, u)).slice(0, 3 + lv);
  for (const h of list) { bolt(u, h, 0.3); damage(u, h, u.dmg * 1.1 * (1 + 0.3 * (lv - 1)), { noChain: true, noFx: true }); C.parts.emit(h.x, 0.8, h.z, 8, ELEM.lightning.hit); }
}
// chill / poison ticking, poison clouds; chilled units move, attack and animate slower
export const slowK = u => u.chillT > 0 ? 0.55 : 1;
export function updateStatus(u, dt) {
  if (u.chillT > 0) { u.chillT -= dt; if (Math.random() < dt * 6) C.parts.emit(u.x, 1.1, u.z, 1, { col: 0xdff4ff, spd: 0.3, up: 0, grav: 1.2, life: 0.6, size: 0.16, spread: 0.6 }); }
  const p = u.poison; if (p) { p.left -= dt; p.tick -= dt; if (Math.random() < dt * 5) C.parts.emit(u.x, 0.9, u.z, 1, { col: 0x8aff5a, spd: 0.2, up: 0.8, grav: -0.5, life: 0.6, size: 0.18, spread: 0.5 });
    if (p.tick <= 0) { p.tick = 0.5; damage(p.src, u, p.dps * 0.5, { dot: 'poison', noFx: true }); } if (p.left <= 0) u.poison = null; }
  const st = u.mesh.u.uStat.value; if (u.chillT > 0) st.set(0.55, 0.82, 1.0, 0.5); else if (u.poison) st.set(0.5, 1.0, 0.35, 0.38); else st.w = 0;
}
export function updateHazards(dt) {
  let j = 0;
  for (const c of G.clouds) { c.t += dt; c.tick -= dt; const k = c.t / c.max, fire = c.kind === 'fire'; c.disc.material.opacity = (fire ? 0.26 + 0.08 * Math.sin(c.t * 17) : 0.32) * Math.min(1, c.t * 3) * Math.min(1, (1 - k) * 3);
    if (Math.random() < dt * (fire ? 34 : 22)) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * c.r; C.parts.emit(c.x + Math.cos(a) * r, 0.2, c.z + Math.sin(a) * r, 1, fire ? { col: Math.random() < 0.5 ? 0xff8a2a : 0xffd060, spd: 0.15, up: 1.6, grav: -1.2, life: 0.55, size: 0.34, spread: 0 } : { col: 0x6fe04a, spd: 0.1, up: 0.7, grav: -0.3, life: 0.9, size: 0.4, spread: 0 }); }
    if (c.tick <= 0) { c.tick = 0.5; for (const h of (c.side === 'enemy' ? G.friends : G.enemies)) if (!h.dead && Math.hypot(h.x - c.x, h.z - c.z) < c.r + h.r * 0.5) damage(c.src, h, c.dps * 0.5, { dot: fire ? 'fire' : 'poison', noFx: true }); }
    if (c.t >= c.max) { C.scene.remove(c.disc); c.disc.geometry.dispose(); continue; } G.clouds[j++] = c; }
  G.clouds.length = j;
  let b = 0; for (const x of G.bolts) if (x.until > G.t) G.bolts[b++] = x; G.bolts.length = b;
}
function panic(e, from) { if (e.state === 'panic') return; if (PACT) { if (e.panicDone) return; e.panicDone = true; } e.state = 'panic'; e.st = 0; e.panicDur = PACT ? rand(3, 5) : rand(1.3, 2.4); e.panicX = from.x; e.panicZ = from.z; S.squeal(); say(e.x, e.z, '!!', '#ffd34d', 18, 1.5); }

// ---------- corpses & capturing ----------
function makeCorpse(u) {
  const m = u.mesh; m.u.uTint.value.multiplyScalar(0.72); m.u.uFlash.value = 0; if (u.ringMesh) m.root.remove(u.ringMesh); if (u.tele) { C.scene.remove(u.tele); u.tele = null; }
  m.root.scale.set(1, 1, 1); const hard = u.dieHard, name = ANIM[u.kind].die, sp = hard ? 1.55 : 1.2; play(m, name, { once: true, speed: sp, fade: 0.05 });
  const l = Math.hypot(u.dieDx || 0, u.dieDz || 0) || 1, dx = (u.dieDx || Math.sin(u.face + Math.PI)) / l, dz = (u.dieDz || Math.cos(u.face + Math.PI)) / l, v = hard ? 4.6 : 1.8;
  const c = { kind: u.kind, level: u.level, mods: u.mods.slice(), champ: u.champ, x: u.x, z: u.z, rx: u.x, rz: u.z, t: 30, mesh: m, packId: u.packId, animT: clipLen(name) / sp + 0.1,
    vx: dx * v, vz: dz * v, hop: hard ? 0.3 : 0, hopT: 0, flash: 1 };
  G.corpses.push(c);
  if (m.root.visible) { const big = u.kind === 'brute' || u.champ; debris(u.x, 0.7, u.z, dx, dz, (hard ? 5 : 2) + (big ? 2 : 0) + Math.floor(Math.random() * 2), hard ? 4.2 : 2.2); }
}
export function captureChance(c) { return Math.max(0.05, Math.min(0.95, TYPES[c.kind].capture * (c.champ ? 0.5 : 1) * (1 + 0.05 * (G.level - 1)) - 0.03 * Math.max(0, c.level - G.level))); }
export function removeCorpse(c) { const i = G.corpses.indexOf(c); if (i >= 0) G.corpses.splice(i, 1); C.scene.remove(c.mesh.root); }
export function finishRaise(c) {
  if (!G.corpses.includes(c)) return;
  const ok = Math.random() < captureChance(c); removeCorpse(c);
  if (ok) {
    const en = { id: G.uid++, type: c.kind, level: c.level, xp: 0, mods: c.mods, modLv: {}, champ: c.champ, active: false, reviveT: 0, unit: null, sp: 0, skills: {} };
    G.crypt.push(en); const room = activeCount() < partySize(G.level);
    if (room) { en.active = true; spawnAlly(en, c.rx ?? c.x, c.rz ?? c.z, 'reassemble'); } else soulToSummoner(c);
    S.caught(); C.parts.emit(c.x, 0.5, c.z, 30, { col: 0x6ff7e8, spd: 1.5, up: 3, life: 1.0, size: 0.3, grav: -1 });
    C.say(tr(`收服了 ${affixName(c.mods, c.champ) + TYPES[c.kind].name}！`, `Captured ${affixName(c.mods, c.champ) + TYPES[c.kind].name}!`) + (room ? '' : tr('（灵魂收入墓典）', ' (soul stored in the Crypt)'))); save();
  } else { S.fail(); C.parts.emit(c.x, 0.3, c.z, 24, { col: 0x8a8090, spd: 1.2, up: 1.2, life: 0.9, size: 0.3 }); say(c.x, c.z, tr('唤魂失败', 'Raise failed'), '#b9a8c8', 16); }
}
// party full: the captured monster still stands up, then turns into a soul that flies into the summoner
function soulToSummoner(c) {
  const m = makeUnitMesh(c.kind, { scale: c.champ ? 1.1 : 1, emis: 0x0a2a2a, rim: 0x2fbfb2, soul: true });
  m.root.position.set(c.rx ?? c.x, 0, c.rz ?? c.z); m.root.rotation.y = c.mesh.root.rotation.y; C.scene.add(m.root);
  const name = 'Death_C_Skeletons_Resurrect', sp = 1.6; play(m, name, { once: true, restart: true, speed: sp, fade: 0 }); m.mixer.update(0);
  G.ghosts.push({ m, t: 0, rise: clipLen(name) / sp * 0.9, x: c.x, z: c.z, orb: null });
}
export function soulOrb(x, y, z, to, onHit, col = 0x6ff7e8) {
  const orb = new THREE.Group(); orb.add(glowSprite(col, 1.1, 0.95), glowSprite(0xffffff, 0.4, 0.9)); orb.position.set(x, y, z); C.scene.add(orb);
  G.ghosts.push({ orb, t: 0, fly: 0.65, x0: x, y0: y, z0: z, to, onHit, col });
}
export function updateGhosts(dt) {
  let j = 0;
  for (const g of G.ghosts) { g.t += dt;
    if (g.m) { const m = g.m; m.mixer.update(dt);
      if (g.t > g.rise) { const k = Math.min(1, (g.t - g.rise) / 0.45); m.u.uFade.value = 1 - k; m.u.uEmis.value.setRGB(0.04 + 0.5 * k, 0.16 + 0.75 * k, 0.16 + 0.7 * k); m.root.position.y = k * 0.5;
        if (!g.sent) { g.sent = true; S.raise(); C.parts.emit(g.x, 0.7, g.z, 22, { col: 0x6ff7e8, spd: 1.2, up: 2.5, life: 0.7, size: 0.28, grav: -1.5 });
          soulOrb(g.x, 1.0, g.z, () => G.player, () => { const P = G.player; S.caught(); P.flash = 0.5;
            C.parts.emit(P.x, 0.9, P.z, 30, { col: 0x6ff7e8, spd: 2.2, up: 1.5, life: 0.6, size: 0.25, grav: 0 });
            const rg = ring(0.25, 0.45, 0x6ff7e8, 0.9); rg.position.set(P.x, 0.05, P.z); C.scene.add(rg); G.fx.push({ clean: true, t: 0.45, tick: q => { rg.scale.setScalar(1 + q * 3); rg.material.opacity = 0.9 * (1 - q); }, fn: () => C.scene.remove(rg) }); }); }
        if (k >= 1) { C.scene.remove(m.root); continue; } } }
    else if (g.orb) { const to = g.to(), k = Math.min(1, g.t / g.fly), e = k * k * (3 - 2 * k);
      if (!to || to.dead) { C.scene.remove(g.orb); continue; }
      const x = g.x0 + (to.x - g.x0) * e, z = g.z0 + (to.z - g.z0) * e, y = g.y0 + (1.0 - g.y0) * e + Math.sin(Math.PI * k) * 1.6; g.orb.position.set(x, y, z);
      if (Math.random() < 0.8) C.parts.emit(x, y, z, 1, { col: g.col, spd: 0.3, up: 0.2, life: 0.45, size: 0.3, grav: 0 });
      if (k >= 1) { C.scene.remove(g.orb); g.onHit && g.onHit(); continue; } }
    G.ghosts[j++] = g; }
  G.ghosts.length = j;
}
// absorb a resting, non-champion summon into another one: experience + soul points
export function canFeed(f, to) { return f !== to && !f.champ && !f.active; }
export function absorb(to, f) {
  if (!canFeed(f, to)) return false; const i = G.crypt.indexOf(f); if (i < 0) return false;
  G.crypt.splice(i, 1); const pts = soulPoints(f), xp = soulXP(f, to); to.sp = (to.sp || 0) + pts; to.skills = to.skills || {};
  const u = to.unit && !to.unit.dead ? to.unit : null, before = to.level;
  if (u) allyXP(u, xp); else { to.xp += xp; while (to.xp >= xpNeed(to.level) * 0.8) { to.xp -= xpNeed(to.level) * 0.8; to.level++; } }
  const P = G.player;
  if (u && P && !P.dead) soulOrb(P.x, 1.1, P.z, () => u, () => { S.heal(); C.parts.emit(u.x, 0.8, u.z, 24, { col: 0x6ff7e8, spd: 1.4, up: 2.5, life: 0.8, size: 0.26, grav: -1 }); say(u.x, u.z, tr(`+${pts} 魂能`, `+${pts} soul`), '#8ff7ea', 15, 1.9); });
  else S.heal();
  save(); return { pts, xp, up: to.level - before };
}
// ---------- fusion: two summons of the same kind become one (the one you are looking at stays) ----------
// normal + normal: small chance to turn elite · normal + elite: chance to inherit one of its affixes
// elite + elite: each partner affix may be added (2nd 35%, 3rd 20%) or, if already owned, strengthened (40%, up to Ⅲ)
export const canFuse = (f, to) => f !== to && f.type === to.type && !f.active;
const ALL_MODS = ['fast', 'fire', 'stone', 'cold', 'poison', 'lightning'];
export function fusionOdds(to, f) {
  const o = { elite: 0, add: [], up: [], xp: Math.round(soulXP(f, to) * 0.5) }, lv = m => (to.modLv && to.modLv[m]) || 1;
  if (!to.champ && !f.champ) o.elite = 0.12;
  else if (!to.champ && f.champ) o.add = f.mods.map(m => ({ m, p: 0.45 / f.mods.length }));
  else if (to.champ && !f.champ) { const own = to.mods.filter(m => lv(m) < MAX_AFFIX_LV); if (own.length) o.up = own.map(m => ({ m, p: 0.15 / own.length })); }
  else { let n = to.mods.length; for (const m of f.mods) { if (to.mods.includes(m)) { if (lv(m) < MAX_AFFIX_LV) o.up.push({ m, p: 0.4 }); } else if (n < MAX_AFFIX) { o.add.push({ m, p: n === 1 ? 0.35 : 0.2 }); n++; } } }
  return o;
}
export function fuse(to, f) {
  if (!canFuse(f, to)) return null; const odds = fusionOdds(to, f), r = { elite: false, added: [], upped: [], xp: odds.xp, before: to.level };
  // the partner's gear goes back to the bag first
  for (const s of ['w', 'a']) { const it = f.gear && f.gear[s]; if (it && !bagPut(it)) { C.say(tr('背包放不下它的装备，先清一下背包', 'No room in the bag for its gear — clear some space first')); return null; } if (it) delete f.gear[s]; }
  G.crypt.splice(G.crypt.indexOf(f), 1); to.modLv = to.modLv || {};
  if (odds.elite && Math.random() < odds.elite) { r.elite = true; const m = ALL_MODS[Math.floor(Math.random() * ALL_MODS.length)]; to.champ = true; to.mods = [m]; to.modLv = { [m]: 1 }; r.added.push(m); }
  if (!to.champ && odds.add.length) { const roll = Math.random(); let acc = 0; for (const a of odds.add) { acc += a.p; if (roll < acc) { to.champ = true; to.mods = [a.m]; to.modLv = { [a.m]: 1 }; r.elite = true; r.added.push(a.m); break; } } }
  else { for (const a of odds.add) if (to.mods.length < MAX_AFFIX && Math.random() < a.p) { to.mods = [...to.mods, a.m]; to.modLv[a.m] = 1; r.added.push(a.m); }
    if (odds.up.length) { const pool = odds.up.filter(u => !r.added.includes(u.m)); if (to.champ && !f.champ) { const roll = Math.random(); let acc = 0; for (const u of pool) { acc += u.p; if (roll < acc) { to.modLv[u.m] = ((to.modLv[u.m]) || 1) + 1; r.upped.push(u.m); break; } } }
      else for (const u of pool) if (Math.random() < u.p) { to.modLv[u.m] = ((to.modLv[u.m]) || 1) + 1; r.upped.push(u.m); } } }
  to.xp += odds.xp; while (to.xp >= xpNeed(to.level) * 0.8) { to.xp -= xpNeed(to.level) * 0.8; to.level++; }
  // a summon that is out in the world is reborn with its new look
  const u = to.unit; if (u && !u.dead) { const x = u.x, z = u.z; dismissAlly(to); spawnAlly(to, x, z, 'reassemble'); C.parts.emit(x, 0.8, z, 40, { col: 0x6ff7e8, spd: 2.5, up: 3, life: 0.9, size: 0.3, grav: -1 }); }
  save(); return r;
}
export function learn(en, id) {
  const def = (TREE[treeKey(en)] || []).find(d => d.id === id); if (!def) return false; en.skills = en.skills || {}; const r = en.skills[id] || 0;
  if (r >= def.max || (en.sp || 0) < 1) return false; en.skills[id] = r + 1; en.sp--;
  const u = en.unit; if (u && !u.dead) { const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; C.parts.emit(u.x, 0.8, u.z, 16, { col: 0xffe58a, spd: 1, up: 2.5, life: 0.8, size: 0.22, grav: -1 }); }
  S.level(); save(); return true;
}
export const activeCount = () => G.crypt.filter(e => e.active).length;
export function spawnAlly(en, x, z, how = 'ground') {
  const P = G.player; if (x == null) { const a = rand(0, TAU); x = P.x + Math.cos(a) * 1.4; z = P.z + Math.sin(a) * 1.4; if (!C.floor.walk(x, z)) { x = P.x; z = P.z; } }
  const u = new Unit(en.type, 'ally', x, z, { level: en.level, mods: en.mods, modLv: en.modLv, champ: en.champ, entry: en }); en.unit = u; G.units.push(u);
  if (how) { u.face = Math.atan2(P.x - x, P.z - z); u.faceT = u.face; rise(u, how === 'reassemble' ? 'Death_C_Skeletons_Resurrect' : 'Spawn_Ground_Skeletons', how === 'reassemble' ? 1.4 : 1.7); }
  C.parts.emit(x, 0.4, z, 18, { col: 0x6ff7e8, spd: 1.6, up: 2, life: 0.7, size: 0.25 }); return u;
}
export function dismissAlly(en) { if (en.unit && !en.unit.dead) { const u = en.unit; u.dead = true; C.parts.emit(u.x, 0.5, u.z, 14, { col: 0x6ff7e8, spd: 1.2, up: 2, life: 0.6 }); u.remove(); } en.unit = null; }
function allyXP(a, xp) { const en = a.entry; if (!en || en.pact) return; en.xp += xp;
  while (en.xp >= xpNeed(en.level) * 0.8) { en.xp -= xpNeed(en.level) * 0.8; en.level++; const f = a.hp / a.maxHp; a.level = en.level; a.stats(); a.hp = a.maxHp * Math.max(f, 0.5);
    C.parts.emit(a.x, 0.8, a.z, 20, { col: 0xffe58a, spd: 1.2, up: 3, life: 0.9, size: 0.25, grav: -1 }); C.say(tr(`${a.name} 升到 Lv ${en.level}`, `${a.name} reached Lv ${en.level}`)); save(); } }
export function addXP(xp) {
  G.xp += xp; let up = false; while (G.xp >= xpNeed(G.level)) { G.xp -= xpNeed(G.level); G.level++; up = true; }
  if (!up) return; const P = G.player, before = P.level; P.level = G.level; P.stats(); P.hp = P.maxHp; P.mp = P.maxMp; S.level();
  C.parts.emit(P.x, 1, P.z, 40, { col: 0xffe58a, spd: 2, up: 4, life: 1.1, size: 0.3, grav: -1 });
  C.say(tr(`升级！Lv ${G.level}`, `Level up! Lv ${G.level}`), true);
  // 魂契 has one skeleton: no party slots
  if (!PACT && partySize(G.level) > partySize(before)) { C.say(tr(`可出战召唤物 +1（${partySize(G.level)} 只）`, `Party size +1 (${partySize(G.level)})`), true);
    const rest = G.crypt.filter(e => !e.active).sort((a, b) => b.level - a.level)[0]; if (rest && P && !P.dead) { rest.active = true; if (rest.reviveT <= 0) spawnAlly(rest); } }
  save();
}

// ---------- projectiles ----------
const SPEAR_G = merge([part(new THREE.ConeGeometry(0.07, 0.7, 6), 0xf6f0e0, [0, 0, 0], [Math.PI / 2, 0, 0])]);
const ARROW_G = merge([part(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 5), 0x8a6a40, [0, 0, 0], [Math.PI / 2, 0, 0]), part(new THREE.ConeGeometry(0.04, 0.1, 5), 0xdddddd, [0, 0, 0.33], [Math.PI / 2, 0, 0])]);
export function shoot(src, kind, tx, tz, o = {}) {
  let dx = tx - src.x, dz = tz - src.z; if (o.ang) { const c = Math.cos(o.ang), sn = Math.sin(o.ang); [dx, dz] = [dx * c - dz * sn, dx * sn + dz * c]; }
  const d = Math.hypot(dx, dz) || 1, sp = (kind === 'spear' ? 16 : kind === 'arrow' ? 12 : 8.5) * PACE.act;
  const s = { kind, src, side: src.side === 'enemy' ? 'enemy' : 'friend', x: src.x + dx / d * 0.4, z: src.z + dz / d * 0.4, y: kind === 'fire' ? 0.9 : 0.85, vx: dx / d * sp, vz: dz / d * sp,
    dmg: o.dmg ?? src.dmg, life: (o.life ?? 1.1) / PACE.act, hit: new Set(), root: new THREE.Group(), pierce: o.pierce || 0, splash: o.splash || 1.4 };
  if (kind === 'spear') { const m = new THREE.Mesh(SPEAR_G, toonMat({ emis: 0x2a3a3a })); s.root.add(m, glowSprite(0x9ff7ff, 0.9, 0.6)); }
  else if (kind === 'arrow') s.root.add(new THREE.Mesh(ARROW_G, toonMat()));
  else s.root.add(glowSprite(0xff8a2a, 1.3), glowSprite(0xffe080, 0.5));
  const el = src.champ && src.mods.length && ELEM[src.mods[Math.floor(Math.random() * src.mods.length)]]; if (el) { s.el = el; s.root.add(glowSprite(el.col, kind === 'fire' ? 2.0 : 0.8, 0.85)); }
  s.root.position.set(s.x, s.y, s.z); s.root.rotation.y = Math.atan2(dx, dz); C.scene.add(s.root); G.shots.push(s);
  if (kind === 'spear') S.spear(); else if (kind === 'arrow') S.arrow(); else S.fire();
  return s;
}
export function updateShots(dt) {
  updateTracers(dt); updateNades(dt); updateTechFx(dt);
  const F = C.floor; let j = 0;
  for (const s of G.shots) {
    s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt; s.root.position.set(s.x, s.y, s.z); let dead = s.life <= 0 || !F.walk(s.x, s.z);
    if (s.kind === 'fire' && Math.random() < 0.6) C.parts.emit(s.x, s.y, s.z, 1, { col: 0xff8a2a, spd: 0.4, up: 0.5, life: 0.35, size: 0.3, grav: 0 });
    if (s.el && Math.random() < 0.8) C.parts.emit(s.x, s.y, s.z, 1, s.el.part);
    if (!dead) for (const u of (s.side === 'enemy' ? G.friends : G.enemies)) { if (u.dead || s.hit.has(u)) continue;
      if (Math.hypot(u.x - s.x, u.z - s.z) < u.r + 0.22) { s.hit.add(u);
        if (s.kind === 'fire') { dead = true; break; }
        damage(s.src, u, s.dmg * rand(0.85, 1.15), { knock: s.kind === 'spear' ? 1.2 : 0, shot: s.kind, fx: s.x - s.vx, fz: s.z - s.vz }); impact(s.x, s.y, s.z, s.kind === 'spear' ? 0xbff8ff : s.el ? s.el.col : 0xffe6c0, s.kind === 'spear' ? 0.9 : 0.7); if (s.kind === 'spear') C.parts.emit(s.x, s.y, s.z, 5, { col: 0xe8e0d0, spd: 2, life: 0.3, size: 0.15 }); else if (s.pierce > 0) s.pierce--; else { dead = true; break; } } }
    if (dead) { if (s.kind === 'fire') { S.boom(); C.parts.emit(s.x, 0.5, s.z, 22, { col: 0xff8a2a, spd: 3, up: 2, life: 0.5, size: 0.3 }); burst(s.x, 0.6, s.z, 0xff9a3a, 1.8); shake(0.035, s.x, s.z);
        for (const u of (s.side === 'enemy' ? G.friends : G.enemies)) if (!u.dead && Math.hypot(u.x - s.x, u.z - s.z) < s.splash + u.r) damage(s.src, u, s.dmg, { knock: 1.5, fx: s.x, fz: s.z }); }
      C.scene.remove(s.root); continue; }
    G.shots[j++] = s;
  }
  G.shots.length = j;
}

// ---------- AI ----------
// walk toward (tx, tz): straight when the way is clear for this unit's width, else down the flow field. A unit that has barely moved
// for half a second (pressed against a corner) follows the flow field only for a while
function seek(u, tx, tz, spd) { const t = G.t;
  if (u.skT == null || t - u.skT >= 0.5) { if (u.skT != null && t - u.skT < 0.8 && Math.hypot(u.x - u.skX, u.z - u.skZ) < spd * (t - u.skT) * 0.25) u.flowT = t + 1.5;
    u.skT = t; u.skX = u.x; u.skZ = u.z; }
  C.floor.dirTo(u.x, u.z, tx, tz, tmp, Math.max(0.36, u.r + 0.06), t < (u.flowT || 0)); u.wantX = tmp.x * spd; u.wantZ = tmp.z * spd; }
function flee(u, fx, fz, spd) {
  let ax = u.x - fx, az = u.z - fz; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  for (const ang of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5]) { const c = Math.cos(ang), s = Math.sin(ang), dx = ax * c - az * s, dz = ax * s + az * c;
    if (C.floor.walk(u.x + dx * 0.9, u.z + dz * 0.9) && C.floor.walk(u.x + dx * 1.6, u.z + dz * 1.6)) { u.wantX = dx * spd; u.wantZ = dz * spd; return true; } }
  u.wantX = u.wantZ = 0; return false;
}
const faceTo = (u, t) => { u.faceT = Math.atan2(t.x - u.x, t.z - u.z); };
function startWindup(u, t) {
  if (u.mortar) { u.state = 'windup'; u.st = 0; u.wind = 0.5 / PACE.act; u.tgt = t; faceTo(u, t); return; } // takes aim (the arms: twoHandAnim)
  if (u.gun) { // still firing: no new windup, the next belt follows straight on (sustained fire); the arms are animated in gunnerAnim
    if (u.lastShot && G.t - u.lastShot < 0.45) { u.tgt = t; faceTo(u, t); u.burst = 6; u.cdT = u.cd * (u.deployT > 0 ? 0.62 : 1); return; }
    u.state = 'windup'; u.st = 0; u.wind = 0.3 / PACE.act; u.tgt = t; faceTo(u, t); return; }
  u.state = 'windup'; u.st = 0; u.wind = (u.windup ?? u.T.windup) * (u.mods.includes('fast') ? 0.75 - 0.05 * mlv(u, 'fast') : 1) / PACE.act; u.tgt = t; faceTo(u, t); attackAnim(u, u.wind); if (MELEE(u.kind)) trail(u, u.wind + (u.pact ? 0.55 : 0.3));
  if (u.pact) S.swoosh(u.wset === 'GS' || (u.entry && u.entry.wset === 'GS'), Math.max(0, u.wind - (u.entry && u.entry.wset === 'GS' ? 0.24 : 0.16))); // the whoosh peaks just before the blade lands
  if (u.kind === 'brute') { const R = u.range + u.r + 0.3, en = u.side === 'enemy', col = en ? 0xff3a2a : 0x3fe0d0, rg = ring(en ? 0.2 : R - 0.1, R, col, 0.0);
    if (en) { const edge = ring(R - 0.09, R, 0xff8a6a, 0); edge.position.y = 0.002; rg.add(edge); rg.userData.edge = edge; } rg.userData.en = en; rg.position.set(u.x, 0.04, u.z); C.scene.add(rg); u.tele = rg; } }
function strike(u) {
  const t = u.tgt; u.state = 'recover'; u.st = 0; u.cdT = u.cd * rand(0.9, 1.15); if (u.tele) { C.scene.remove(u.tele); u.tele = null; }
  if (!t || t.dead) return;
  if (u.gun) { u.burst = 6; u.burstT = 0; u.burstN = 0; u.cdT = u.cd * (u.deployT > 0 ? 0.62 : 1); return; }
  if (u.mortar) { fireShell(u, shellTarget(u, t)); return; }
  if (MELEE(u.kind)) { u.kx += Math.sin(u.face) * 1.3; u.kz += Math.cos(u.face) * 1.3; } // step into the blow
  if (u.pact && PH.strike) { PH.strike(u, t); return; }
  if (u.mech) { u.grind = 3; u.grindT = 0; return; } // the drill bites: three grinding hits (drillTick)
  if (u.kind === 'brute') { S.smash(); C.parts.emit(u.x + Math.sin(u.face) * 0.8, 0.2, u.z + Math.cos(u.face) * 0.8, 16, { col: 0xb8a890, spd: 3, up: 1.5, life: 0.5, size: 0.3 });
    for (const h of hostilesOf(u)) { if (h.dead) continue; const d = dist(u, h); if (d > u.range + u.r + h.r + 0.35) continue;
      const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % TAU) - Math.PI); if (da < 1.1 || d < 0.9) damage(u, h, u.dmg * rand(0.9, 1.1), { knock: 4, melee: true, heavy: true }); } }
  else if (u.kind === 'imp') { const lg = u.lungeHit; u.lungeHit = false; if (dist(u, t) < (u.range + u.r + t.r) * (lg ? 1.6 : 1.35)) { damage(u, t, u.dmg * rand(0.85, 1.15) * (lg ? 1.25 * (1 + 0.2 * rk(u, 'lunge')) : 1), { crit: u.side === 'ally' && (lg || Math.random() < 0.15 + 0.06 * rk(u, 'crit')), critX: 2 + 0.1 * rk(u, 'crit'), melee: true });
      if (lg && u.chainLeft > 0) { let nx = null, nd = 5; for (const e of hostilesOf(u)) { if (e.dead || e === t) continue; const de = dist(u, e); if (de < nd && de > 0.8 && C.floor.los(u.x, u.z, e.x, e.z)) { nd = de; nx = e; } }
        if (nx) { u.chainLeft--; u.chainNext = nx; } } } }
  else if (u.kind === 'archer') { const lead = Math.min(0.5, dist(u, t) / 12), n = 1 + rk(u, 'multi'), tx = t.x + (t.vx || 0) * lead, tz = t.z + (t.vz || 0) * lead;
    for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.17; shoot(u, 'arrow', tx, tz, { life: 0.9 + 0.04 * rk(u, 'eagle'), ang: a, pierce: rk(u, 'pierce'), dmg: u.dmg * (a ? 0.75 : 1) }); } }
  else if (u.eng) rodBeam(u, t);
  else if (u.kind === 'shaman') shoot(u, 'fire', t.x, t.z, { life: 1.1, dmg: u.dmg * (1 + 0.15 * rk(u, 'fire')), splash: 1.4 + 0.15 * rk(u, 'fire') });
}
// sustained fire: one round every rof seconds at the target (or the nearest enemy in range), tracer + muzzle flash + sparks; every 6th round carries the affix effects
const _mz = new THREE.Vector3();
function gunTick(u, dt) {
  const gn = u.mesh.gun; if (gn) gn.spin = 32; u.burstT -= dt; if (u.burstT > 0) return; u.burstT += (u.rof || 0.12) * (u.deployT > 0 ? 0.62 : 1); u.burst--; u.lastShot = G.t; u.animLock = Math.max(u.animLock || 0, 0.3);
  const R = u.range + (u.deployT > 0 ? 2.5 : 0); let t = u.tgt; if (!t || t.dead || dist(u, t) > R + 1.5) t = nearestHostile(u, R + 1); if (!t) { u.burst = 0; return; }
  faceTo(u, t); u.face = u.faceT;
  if (gn) gn.muzzle.getWorldPosition(_mz); else _mz.set(u.x + Math.sin(u.face) * 0.5, 0.7, u.z + Math.cos(u.face) * 0.5);
  const tx = t.x + rand(-0.18, 0.18), ty = 0.45 + rand(0, 0.45), tz = t.z + rand(-0.18, 0.18);
  tracer(_mz.x, _mz.y, _mz.z, tx, ty, tz); S.gun();
  C.parts.emit(_mz.x, _mz.y, _mz.z, 3, { col: 0xffe6a0, spd: 1.2, up: 0.2, life: 0.1, size: 0.3 });
  C.parts.emit(tx, ty, tz, 4, { col: Math.random() < 0.5 ? 0xd9a8ff : 0xffe6a0, spd: 2.4, up: 1, life: 0.22, size: 0.12 });
  const sr = rk(u, 'shred'); if (sr) { t.shred = Math.min(8 * sr, (t.shred || 0) + 1); t.shredT = G.t; }
  damage(u, t, u.dmg * 0.21 * rand(0.85, 1.15) * (u.deployT > 0 ? 1 + 0.2 * rk(u, 'deploy') : 1), { crit: u.side === 'ally' && Math.random() < 0.15 + 0.06 * rk(u, 'crit'), critX: 2 + 0.1 * rk(u, 'crit'), noFx: u.burstN++ % 6 !== 0, sum: true });
}
// ---------- 机枪骷髅 skills: grenade (+ cluster bomblets), dig in as a turret; AP rounds stack in gunTick ----------
function gunSkills(u) {
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 8 && C.floor.los(u.x, u.z, h.x, h.z));
  if (rk(u, 'deploy') && u.depCD <= 0 && (near.length >= 3 || near.some(h => h.champ))) { deploy(u); return false; }
  if (u.nadeCD <= 0 && near.length) { // the spot that catches the most enemies in the blast; a lone normal enemy isn't worth one
    const R = 1.7 + 0.12 * rk(u, 'nade'); let best = null, bn = 0;
    for (const c of near) { if (dist(c, u) > 7.5 || dist(c, u) < 1.5) continue; let n = 0; for (const h of near) if (Math.hypot(h.x - c.x, h.z - c.z) < R) n += h.champ ? 2 : 1; if (n > bn) { bn = n; best = c; } }
    if (best && bn >= 2) { u.state = 'throw'; u.st = 0; u.wind = 0.32; u.thrown = false; u.nadeAt = { x: best.x, z: best.z }; faceTo(u, best); u.face = u.faceT; u.wantX = u.wantZ = 0;
      playUpper(u.mesh, partClip('Throw', 'upper'), { once: true, restart: true, speed: 1.5, fade: 0.08 }); u.nadeCD = 9 - 0.8 * rk(u, 'nade'); return true; }
    u.nadeCD = 0.5; }
  return false;
}
const NADES = [], nadeGeo = new THREE.SphereGeometry(1, 10, 8), nadeMat = new THREE.MeshBasicMaterial({ color: 0x2a2433 });
// grenades, bomblets and mortar shells (o.shell: a bigger round on a high lob)
function launchNade(u, at, o = {}) {
  const r = rk(u, 'nade'), x0 = o.x ?? u.x + Math.sin(u.face) * 0.3, z0 = o.z ?? u.z + Math.cos(u.face) * 0.3, d = Math.hypot(at.x - x0, at.z - z0);
  const m = new THREE.Mesh(nadeGeo, nadeMat); m.scale.setScalar(o.mini ? 0.07 : o.shell ? 0.15 : 0.11); const gl = glowSprite(o.fire ? 0xff8a2a : 0xb46cff, o.mini ? 0.5 : o.shell ? 1.1 : 0.8, 0.9); m.add(gl); gl.scale.multiplyScalar(1 / m.scale.x); C.scene.add(m);
  NADES.push({ m, src: u, x0, z0, y0: o.y ?? 1.0, x1: at.x, z1: at.z, t: 0, dur: o.mini ? 0.35 : o.shell ? 0.62 + d * 0.045 : 0.5 + d * 0.03, h: o.mini ? 0.7 : o.shell ? 1.8 + d * 0.2 : 1.2 + d * 0.12,
    dmg: o.dmg ?? u.dmg * (1.6 + 0.35 * r), R: o.R ?? (o.mini ? 1.1 : 1.7 + 0.12 * r), mini: !!o.mini, shell: !!o.shell, fire: o.fire || 0, cl: o.cl ?? (o.mini ? 0 : rk(u, 'cluster')) });
  if (!o.mini && !o.shell) S.arrow();
}
// ---------- 炮手骷髅: the shell lands where it catches the most (preferring its target), never on top of itself ----------
function shellTarget(u, t) { const R = 1.6 + 0.1 * rk(u, 'shell'), near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < u.range + 0.5 && dist(h, u) > 2);
  let best = t, bn = -1; for (const c of near) { let n = c === t ? 0.5 : 0; for (const h of near) if (Math.hypot(h.x - c.x, h.z - c.z) < R) n += h.champ ? 2 : 1; if (n > bn) { bn = n; best = c; } }
  const lead = 0.45; return { x: best.x + (best.vx || 0) * lead, z: best.z + (best.vz || 0) * lead }; }
function fireShell(u, at) {
  const n = u.shellN = (u.shellN || 0) + 1, inc = rk(u, 'incend'), mz = u.mesh.muz; if (mz) mz.getWorldPosition(_mz); else _mz.set(u.x + Math.sin(u.face) * 0.6, 0.9, u.z + Math.cos(u.face) * 0.6);
  launchNade(u, at, { shell: true, x: _mz.x, z: _mz.z, y: _mz.y, dmg: u.dmg * (2 + 0.15 * rk(u, 'shell')), R: 1.6 + 0.1 * rk(u, 'shell'), cl: rk(u, 'mcluster'), fire: inc && n % 3 === 0 ? inc : 0 });
  S.mortar(); burst(_mz.x, _mz.y, _mz.z, 0xffb060, 0.9); shake(0.03, u.x, u.z);
  C.parts.emit(_mz.x, _mz.y, _mz.z, 8, { col: 0x9a9098, spd: 1.2, up: 1.4, grav: -0.5, life: 0.8, size: 0.32 }); C.parts.emit(_mz.x, _mz.y, _mz.z, 6, { col: 0xffc070, spd: 2.5, up: 1, life: 0.2, size: 0.16 });
  playUpper(u.mesh, partClip('2H_Ranged_Shoot', 'upper'), { once: true, restart: true, speed: 1.3, fade: 0.05 }); u.recoilT = 0.5; u.kx -= Math.sin(u.face) * 1.2; u.kz -= Math.cos(u.face) * 1.2;
}
// 齐射: several shells in quick succession at the thickest spot
function barrageSkill(u) {
  const r = rk(u, 'barrage'); if (!r || (u.barCD || 0) > G.t || u.state !== 'idle' || u.stun > 0) return false;
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < u.range && dist(h, u) > 2 && C.floor.los(u.x, u.z, h.x, h.z)); if (near.length < 3 && !near.some(h => h.champ)) return false;
  const t = near.find(h => h.champ) || near[0], at = shellTarget(u, t); u.state = 'barrage'; u.st = 0; u.shots = r + 2; u.shotT = 0.15; u.barAt = at; u.barCD = G.t + 14 - 1.5 * r;
  u.faceT = Math.atan2(at.x - u.x, at.z - u.z); u.wantX = u.wantZ = 0; say(u.x, u.z, tr('齐射！', 'Barrage!'), '#ffc070', 14, 1.9); return true;
}
function updateBarrage(u, dt) { u.st += dt; u.wantX = u.wantZ = 0; u.shotT -= dt;
  if (u.shotT <= 0 && u.shots > 0) { u.shots--; u.shotT = 0.26; const a = rand(0, TAU), d = rand(0, 1.4); fireShell(u, { x: u.barAt.x + Math.cos(a) * d, z: u.barAt.z + Math.sin(a) * d }); }
  if (u.shots <= 0 && u.shotT <= 0) { u.state = 'idle'; u.cdT = Math.max(u.cdT, 0.7); } }
function mortarLogic(u, t, dt) {
  if (barrageSkill(u)) return;
  const close = nearestHostile(u, 2.6, false); if (close && u.state === 'idle' && flee(u, close.x, close.z, u.speed)) return; // shells need room: back off
  const d = dist(u, t); if (!C.floor.los(u.x, u.z, t.x, t.z) || d > u.range + 0.3) { seek(u, t.x, t.z, u.speed); return; }
  u.wantX = u.wantZ = 0; faceTo(u, t); if (u.cdT <= 0) startWindup(u, t);
}
// 燃烧弹: a ring of fire on the ground (shares the hazard list with poison clouds)
function fireField(src, x, z, f) {
  const r = 1.4 + 0.15 * f, disc = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  disc.position.set(x, 0.045, z); disc.renderOrder = 2; C.scene.add(disc); S.fire();
  G.clouds.push({ kind: 'fire', x, z, r, t: 0, max: 2.5 + 0.5 * f, tick: 0, dps: src.dmg * (0.45 + 0.15 * f), side: src.side === 'enemy' ? 'enemy' : 'friend', src, disc });
}
function updateNades(dt) { let j = 0;
  for (const n of NADES) { n.t += dt; const k = Math.min(1, n.t / n.dur), x = n.x0 + (n.x1 - n.x0) * k, z = n.z0 + (n.z1 - n.z0) * k, y = n.y0 * (1 - k) + 0.12 + 4 * n.h * k * (1 - k);
    n.m.position.set(x, y, z); n.m.rotation.x += dt * 12; if (Math.random() < 0.7) C.parts.emit(x, y, z, 1, { col: 0xffc35a, spd: 0.2, up: 0.3, life: 0.25, size: 0.12, grav: 0 });
    if (k >= 1) { C.scene.remove(n.m); explodeNade(n); continue; } NADES[j++] = n; }
  NADES.length = j; }
function explodeNade(n) {
  const { x1: x, z1: z, src, R } = n; S.boom(); if (!n.mini) S.smash(); shake(n.mini ? 0.04 : n.shell ? 0.09 : 0.16, x, z); if (!n.mini) burst(x, 0.5, z, 0xffa850, R * 0.9);
  if (n.fire) fireField(src, x, z, n.fire);
  C.parts.emit(x, 0.4, z, n.mini ? 14 : 34, { col: 0xff9a3a, spd: n.mini ? 3 : 5.5, up: 2.2, life: 0.55, size: n.mini ? 0.26 : 0.38 });
  C.parts.emit(x, 0.5, z, n.mini ? 6 : 16, { col: 0xb46cff, spd: n.mini ? 2.5 : 4, up: 2.5, life: 0.7, size: 0.26 });
  C.parts.emit(x, 0.6, z, n.mini ? 4 : 12, { col: 0x3a3442, spd: 1.2, up: 1.6, grav: -0.6, life: 1.1, size: 0.45 });
  const fl = glowSprite(0xffb050, R * 2.2, 0.9); fl.position.set(x, 0.6, z); C.scene.add(fl); G.fx.push({ clean: true, t: 0.28, tick: k => { fl.material.opacity = 0.9 * (1 - k); fl.scale.setScalar(R * 2.2 * (0.7 + 0.6 * k)); }, fn: () => C.scene.remove(fl) });
  const rg = ring(0.2, 0.5, n.mini ? 0xffa040 : 0xc77dff, 0.9); rg.position.set(x, 0.05, z); C.scene.add(rg); G.fx.push({ clean: true, t: 0.4, tick: k => { rg.scale.setScalar(1 + k * R * 1.8); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) });
  for (const h of hostilesOf(src)) if (!h.dead && Math.hypot(h.x - x, h.z - z) < R + h.r) damage(src, h, n.dmg * rand(0.9, 1.1), { knock: n.mini ? 0.8 : 2.2, fx: x, fz: z, noFx: true });
  for (let i = 0; i <= n.cl && n.cl; i++) { const a = rand(0, TAU), d = rand(1.2, 2.3); let tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d; if (!C.floor.walk(tx, tz)) { tx = x + Math.cos(a) * 0.6; tz = z + Math.sin(a) * 0.6; }
    launchNade(src, { x: tx, z: tz }, { mini: true, x, z, y: 0.4, dmg: n.dmg * (n.shell ? 0.4 : 0.45) }); }
}
// dig in: sandbags and a tripod appear around it (children of its mesh, so they go wherever the mesh goes), a rune ring on the ground
function deploy(u) {
  const r = rk(u, 'deploy'); u.deployT = 4 + 1.5 * r; u.depCD = 20 - 2 * r + u.deployT; u.kx = u.kz = 0; undeployVis(u);
  // 架起: braced to fire on the move — slower, never knocked back, a rune circle under the feet while it lasts
  const rc = runeCircle(1.15, 0xb46cff, 0.55); rc.position.y = 0.04; rc.scale.setScalar(0.3); u.mesh.root.add(rc);
  u.dep = { rc }; G.fx.push({ t: 0.3, tick: k => rc.scale.setScalar(0.3 + 0.7 * k) });
  S.clank(); C.parts.emit(u.x, 0.3, u.z, 20, { col: 0xc9b38a, spd: 2, up: 1.2, life: 0.5, size: 0.25 }); say(u.x, u.z, tr('架起！', 'Dig in!'), '#d9a8ff', 14, 1.0);
}
function undeployVis(u) { const d = u.dep; if (!d) return; u.dep = null; const root = u.mesh.root;
  G.fx.push({ clean: true, t: 0.3, tick: k => { d.rc.material.opacity = 0.55 * (1 - k); }, fn: () => { root.remove(d.rc); } }); }
function undeploy(u) { u.deployT = 0; undeployVis(u); }
const TR = [], trGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), trMat = new THREE.MeshBasicMaterial({ color: 0xffc35a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
function tracer(x0, y0, z0, x1, y1, z1) { const m = new THREE.Mesh(trGeo, trMat); m.renderOrder = 3; C.scene.add(m); const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0) || 0.01;
  TR.push({ m, a: [x0, y0, z0], b: [x1, y1, z1], L, t: 0, dur: Math.max(0.05, L / 48) }); }
function updateTracers(dt) { let j = 0; // a short bright streak flying from the muzzle to the target
  for (const r of TR) { r.t += dt; const k = Math.min(1, r.t / r.dur), k0 = Math.max(0, k - 1.6 / r.L), A = r.a, B = r.b, m = r.m;
    if (r.t > r.dur + 0.03) { C.scene.remove(m); continue; }
    const hx = A[0] + (B[0] - A[0]) * k, hy = A[1] + (B[1] - A[1]) * k, hz = A[2] + (B[2] - A[2]) * k, sx = A[0] + (B[0] - A[0]) * k0, sy = A[1] + (B[1] - A[1]) * k0, sz = A[2] + (B[2] - A[2]) * k0;
    m.position.set(sx, sy, sz); m.scale.set(0.045, 0.045, Math.max(0.05, Math.hypot(hx - sx, hy - sy, hz - sz))); m.lookAt(hx, hy, hz); TR[j++] = r; }
  TR.length = j; }
function meleeLogic(u, t) {
  const d = dist(u, t), reach = u.range + u.r + t.r;
  if (d > reach * 0.95) { let tx = t.x, tz = t.z;
    if (d < 3.2) { const ang = Math.atan2(u.z - t.z, u.x - t.x) + u.flank * 0.45; tx = t.x + Math.cos(ang) * reach * 0.85; tz = t.z + Math.sin(ang) * reach * 0.85;
      // a flank spot this unit cannot stand on (against a wall, round a corner), or stuck getting there: go for the target itself
      const F = C.floor, m = u.r + 0.05; if (!(F.walk(tx + m, tz) && F.walk(tx - m, tz) && F.walk(tx, tz + m) && F.walk(tx, tz - m)) || G.t < (u.flowT || 0)) { tx = t.x; tz = t.z; } }
    seek(u, tx, tz, u.speed); }
  else { u.wantX = u.wantZ = 0; faceTo(u, t); if (u.cdT <= 0) startWindup(u, t); }
}
function rangedLogic(u, t, dt, near, far) {
  const d = dist(u, t), vis = C.floor.los(u.x, u.z, t.x, t.z); u.kiteCD = (u.kiteCD || 0) - dt;
  if (!vis || d > far + 0.5) { seek(u, t.x, t.z, u.speed); return; }
  // summons hold their ground and keep shooting (running away from chasers only got them stuck on corners)
  if (u.side === 'ally') { u.wantX = u.wantZ = 0; faceTo(u, t); if (u.cdT <= 0) startWindup(u, t); return; }
  if (d < near) {
    // 魂契: a short retreat (about a second), then it plants its feet and shoots again for a few seconds before it may back off again
    if (PACT) { if (u.kiteT > 0) { u.kiteT -= dt; if (flee(u, t.x, t.z, u.speed)) return; } else if (u.kiteCD <= 0) { u.kiteT = rand(0.8, 1.3); u.kiteCD = rand(3, 4.5); if (flee(u, t.x, t.z, u.speed)) return; }
      u.wantX = u.wantZ = 0; faceTo(u, t); if (u.cdT <= 0) startWindup(u, t); return; }
    if (!flee(u, t.x, t.z, u.speed)) { faceTo(u, t); if (u.cdT <= 0) startWindup(u, t); } return; }
  u.strafeT -= dt; if (u.strafeT <= 0) { u.strafeT = rand(0.7, 1.5); u.strafeDir = Math.random() < 0.35 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
  const px = -(t.z - u.z) / d, pz = (t.x - u.x) / d;
  if (u.strafeDir && C.floor.walk(u.x + px * u.strafeDir * 0.8, u.z + pz * u.strafeDir * 0.8)) { u.wantX = px * u.strafeDir * u.speed * 0.45; u.wantZ = pz * u.strafeDir * u.speed * 0.45; } else u.wantX = u.wantZ = 0;
  faceTo(u, t); if (u.cdT <= 0) startWindup(u, t);
}
function nearestHostile(u, maxD, needLos = true) { let b = null, bd = maxD; for (const h of hostilesOf(u)) { if (h.dead) continue; const d = dist(u, h); if (d < bd && (!needLos || C.floor.los(u.x, u.z, h.x, h.z))) { bd = d; b = h; } } return b; }

function enemyThink(u, dt) {
  const F = C.floor;
  u.scanT -= dt;
  if (u.scanT <= 0) { u.scanT = 0.35;
    if (u.target && (u.target.dead || dist(u, u.target) > 16)) u.target = null;
    let best = null, bs = 1e9;
    for (const h of G.friends) { if (h.dead) continue; const d = dist(u, h); if (d > (u.aggro ? 14 : 8.5) || !F.los(u.x, u.z, h.x, h.z)) continue;
      let s = d; if (h.taunt && d < h.tauntR) s -= 3.5 + rk(h, 'taunt') + (h.shieldT > 0 ? 6 : 0); if (h.kind === 'player') s -= 0.6; if (h === u.target) s -= 1.2; if (s < bs) { bs = s; best = h; } }
    if (best) { if (!u.aggro) { u.aggro = true; alertPack(u, best); } u.target = best; u.lostT = 0; }
    else if (u.aggro) { u.lostT += 0.35; if (u.lostT > 5) { u.aggro = false; u.target = null; } }
  }
  if (u.state === 'panic') { u.st += dt; flee(u, u.panicX, u.panicZ, u.speed * 1.15); if (u.st > u.panicDur) { u.state = 'idle'; S.rally(); } return; }
  const t = u.target && !u.target.dead ? u.target : null;
  if (!t) { // idle / go home
    const dh = Math.hypot(u.home.x - u.x, u.home.z - u.z);
    if (dh > 2.5) seek(u, u.home.x, u.home.z, u.speed * 0.6); else { u.wantX *= 0.9; u.wantZ *= 0.9; if (Math.random() < dt * 0.4) { const a = rand(0, TAU); u.wantX = Math.cos(a) * 0.8; u.wantZ = Math.sin(a) * 0.8; } }
    return; }
  if (u.kind === 'imp' && !u.champ && !u.panicked && u.hp < u.maxHp * 0.3) { u.panicked = true; if (Math.random() < 0.1) { panic(u, t); return; } }
  if (u.kind === 'brute' || u.kind === 'imp') meleeLogic(u, t);
  else if (u.kind === 'archer') rangedLogic(u, t, dt, 4, 7.5);
  else if (u.kind === 'shaman') {
    u.resCD -= dt;
    if (u.resCD <= 0) { let best = null, bd = 9; for (const c of G.corpses) if ((c.kind === 'imp' || c.kind === 'archer') && !c.claim && Math.hypot(c.x - u.x, c.z - u.z) < bd) { bd = Math.hypot(c.x - u.x, c.z - u.z); best = c; }
      if (best) { if (bd > 3.2) { seek(u, best.x, best.z, u.speed); return; } u.state = 'cast'; u.st = 0; u.castC = best; best.claim = u; u.wantX = u.wantZ = 0; faceTo(u, best);
        C.say && say(u.x, u.z, tr('复活术…', 'Raising…'), '#c88cff', 14, 2.1); return; } }
    const close = nearestHostile(u, 2.6, false); if (close && (!PACT || (u.kiteCD = (u.kiteCD || 0) - dt) <= 0 || u.kiteT > 0)) { // (魂契: a short retreat, then it fights)
      if (PACT) { if (!(u.kiteT > 0)) { u.kiteT = rand(0.8, 1.3); u.kiteCD = rand(3, 4.5); } u.kiteT -= dt; } flee(u, close.x, close.z, u.speed); return; }
    rangedLogic(u, t, dt, 4.5, 7.5);
  }
}
// summons fight up front: they pick fights near the summoner on their own, peel enemies off the summoner,
// and the melee ones close the gap with a move skill (warrior: leap slam, minion: lunge)
const MELEE = k => k === 'brute' || k === 'imp';
const isMelee = u => MELEE(u.kind) && !u.gun;
function allyScore(u, e, P) { const de = dist(e, P); return dist(e, u) + de * 0.35 - (e.target === P ? 3 : 0) - (e === G.focus ? 2.5 : 0) - (e.champ ? 0.5 : 0); }
function allyThink(u, dt) {
  const P = G.player; if (P.dead) { u.wantX = u.wantZ = 0; return; }
  const dp = dist(u, P);
  if (u.dep) u.dep.rc.rotation.y += dt * 0.6;
  // catch up (the 魂契 skeleton walks slowly: half the distance, unless it is fighting out there)
  if (u.pact ? dp > (u.target ? 15 : 10) || (dp > 4.5 && !u.target && !C.floor.los(u.x, u.z, P.x, P.z) && u.state === 'idle' && Math.random() < dt * 0.5)
    : dp > 20 || (dp > 9 && !C.floor.los(u.x, u.z, P.x, P.z) && u.state === 'idle' && Math.random() < dt * 0.5)) {
    const a = rand(0, TAU); u.x = P.x + Math.cos(a) * 1.2; u.z = P.z + Math.sin(a) * 1.2; if (!C.floor.walk(u.x, u.z)) { u.x = P.x; u.z = P.z; } u.target = null;
    C.parts.emit(u.x, 0.5, u.z, 10, { col: 0x6ff7e8, spd: 1, up: 2, life: 0.5 }); return; }
  u.scanT -= dt; u.moveCD = (u.moveCD || 0) - dt;
  if (u.scanT <= 0) { u.scanT = 0.25; let best = null, bs = 1e9;
    for (const e of G.enemies) { if (e.dead) continue; const de = dist(e, P); if (de > 12) continue; if (!(e.aggro || de < 11)) continue;
      if (!C.floor.los(P.x, P.z, e.x, e.z) && !C.floor.los(u.x, u.z, e.x, e.z)) continue; const sc = allyScore(u, e, P); if (sc < bs) { bs = sc; best = e; } }
    const cur = u.target && !u.target.dead && dist(u.target, P) < 15 ? u.target : null;
    u.target = cur && best && allyScore(u, cur, P) < bs + 1.5 ? cur : best || cur; }
  if (u.target && (u.target.dead || dist(u.target, P) > 15)) u.target = null;
  if (u.kind === 'shaman' && !u.eng) { u.healCD -= dt; // (the 机械师骷髅 leaves healing to its repair drone)
    if (u.healCD <= 0) { let lo = null, lr = 0.75; for (const f of G.friends) { if (f.dead || dist(f, u) > 8) continue; const r = f.hp / f.maxHp; if (r < lr) { lr = r; lo = f; } }
      if (lo) { u.state = 'cast'; u.st = 0; u.castH = lo; u.wantX = u.wantZ = 0; faceTo(u, lo); u.healCD = 3.5 - 0.3 * rk(u, 'heal'); return; } u.healCD = 0.6; } }
  if (!u.target || dp > 15) { // formation: melee summons walk ahead of the summoner, ranged ones beside / behind
    const allies = G.friends.filter(f => f.side === 'ally'), mine = allies.filter(f => isMelee(f) === isMelee(u)), idx = mine.indexOf(u), n = mine.length;
    const ang = isMelee(u) ? P.face + (idx - (n - 1) / 2) * 0.8 : P.face + Math.PI + (idx - (n - 1) / 2) * 0.9, r = isMelee(u) ? 1.7 : 1.6;
    let tx = P.x + Math.sin(ang) * r, tz = P.z + Math.cos(ang) * r; if (!C.floor.walk(tx, tz)) { tx = P.x; tz = P.z; } const d = Math.hypot(tx - u.x, tz - u.z);
    if (d > 0.5) seek(u, tx, tz, u.speed * Math.min(u.pact ? 1 : 1.3, 0.35 + d / 2.5)); else { u.wantX = u.wantZ = 0; } // (the 魂契 skeleton never hurries)
    if (u.gun && u.deployT > 0 && !(u.burst > 0) && u.cdT <= 0) { const h = nearestHostile(u, u.range + 2.5); if (h) { u.tgt = h; u.burst = 6; u.burstT = 0; u.burstN = 0; u.cdT = u.cd * 0.62; } } // fire on the move
    return; }
  const t = u.target;
  if (u.gun) { if (!gunSkills(u)) { rangedLogic(u, t, dt, 3, 6.5 + (u.deployT > 0 ? 2.5 : 0));
    if (u.deployT > 0 && dp > 3.5 && u.state !== 'windup') seek(u, P.x, P.z, u.speed); } } // braced: keeps up with the summoner, firing as it walks
  else if (isMelee(u)) { if (u.pact && PH.skillAI && PH.skillAI(u, t)) return; if (u.mech) { aegisSkill(u); if (overloadSkill(u)) return; } if (spinSkill(u)) return; if (moveSkill(u, t)) return; meleeLogic(u, t); const d = dist(u, t); if (d > u.range + u.r + t.r + 1 && !u.pact) { u.wantX *= 1.2; u.wantZ *= 1.2; } }
  else if (u.mortar) mortarLogic(u, t, dt);
  else if (u.eng) { if (orbitalSkill(u)) return; rangedLogic(u, t, dt, 4.5, 7.5); }
  else if (u.kind === 'archer') rangedLogic(u, t, dt, 3.5, 6.5 + 0.4 * rk(u, 'eagle'));
  else rangedLogic(u, t, dt, 4.5, 7);
}
function moveSkill(u, t) {
  if (u.moveCD > 0 || u.stun > 0 || u.pact) return false; const d = dist(u, t); if (!C.floor.los(u.x, u.z, t.x, t.z)) return false;
  if (u.mech) { if (d > 3 && d < 9) { startRocket(u, t); return true; } return false; }
  if (u.kind === 'brute' && d > 2.6 && d < 8) { startLeap(u, t); return true; }
  if (u.kind === 'imp' && d > 2.2 && d < 6.5) { startLunge(u, t); return true; }
  return false;
}
// 跳劈: jump onto the target, slam on landing (area damage, knock-back, stagger) and pull the enemies hit onto the warrior
const LEAP = { clip: '1H_Melee_Attack_Jump_Chop', sp: 1.0, up: 0.13, land: 0.72 };
function startLeap(u, t) {
  const d = dist(u, t), k = Math.max(0, d - (u.r + t.r + 0.25)) / (d || 1);
  u.state = 'leap'; u.st = 0; u.lx0 = u.x; u.lz0 = u.z; u.lx1 = u.x + (t.x - u.x) * k; u.lz1 = u.z + (t.z - u.z) * k; u.lh = 0.35 + d * 0.07; u.tgt = t;
  u.t0 = LEAP.up / LEAP.sp; u.t1 = LEAP.land / LEAP.sp; u.wantX = u.wantZ = u.vx = u.vz = u.kx = u.kz = 0; faceTo(u, t); u.face = u.faceT;
  play(u.mesh, LEAP.clip, { once: true, restart: true, speed: LEAP.sp, fade: 0.06 }); u.animLock = clipLen(LEAP.clip) / LEAP.sp * 0.8; trail(u, u.t1 + 0.25);
  u.moveCD = 6.5 - 0.6 * rk(u, 'leap'); say(u.x, u.z, tr('跳劈！', 'Leap Slam!'), '#8ff5ea', 14, 1.9);
}
function updateLeap(u, dt) {
  u.st += dt; u.wantX = u.wantZ = 0; u.vx = u.vz = u.kx = u.kz = 0;
  const k = Math.min(1, Math.max(0, (u.st - u.t0) / (u.t1 - u.t0))), e = k * k * (3 - 2 * k);
  u.x = u.lx0 + (u.lx1 - u.lx0) * e; u.z = u.lz0 + (u.lz1 - u.lz0) * e; u.y = Math.sin(Math.PI * k) * u.lh;
  if (u.st >= u.t1 && !u.landed) { u.landed = true; u.y = 0; S.smash(); shake(0.15, u.x, u.z); burst(u.x, 0.35, u.z, 0x9ff8ee, 2.4); u.hitStop = 0.08; slamMark(u.x, u.z);
    C.parts.emit(u.x, 0.15, u.z, 26, { col: 0xc8bca8, spd: 4, up: 1.2, life: 0.55, size: 0.32 }); C.parts.emit(u.x, 0.3, u.z, 12, { col: 0x6ff7e8, spd: 3, up: 1.5, life: 0.5, size: 0.25 });
    const rg = ring(0.3, 0.55, 0x6ff7e8, 0.9); rg.position.set(u.x, 0.05, u.z); C.scene.add(rg);
    G.fx.push({ clean: true, t: 0.4, tick: q => { rg.scale.setScalar(1 + q * 3.6); rg.material.opacity = 0.9 * (1 - q); }, fn: () => C.scene.remove(rg) });
    const lr = rk(u, 'leap'); for (const h of hostilesOf(u)) { if (h.dead || Math.hypot(h.x - u.x, h.z - u.z) > 1.9 + 0.15 * lr + h.r) continue;
      damage(u, h, u.dmg * 0.55 * (1 + 0.12 * lr) * rand(0.9, 1.1), { knock: 3.2, fx: u.x, fz: u.z, heavy: true }); /* a gap closer, not a nuke */ h.stun = Math.max(h.stun, 0.6); if (!h.dead) { h.target = u; h.aggro = true; } } }
  if (u.st >= u.t1 + 0.35) { u.state = 'recover'; u.st = 0.0; u.landed = false; u.y = 0; u.cdT = Math.max(u.cdT, 0.5); }
}
// ---------- 机甲骷髅 ----------
function drillTick(u, dt) {
  const dr = u.mesh.drill; if (dr) dr.spin = 45; u.grindT -= dt; if (u.grindT > 0) return; u.grindT = 0.11; u.grind--; const last = u.grind <= 0, reach = u.range + u.r + 0.45;
  const bl = u.mesh.blade; if (bl) bl.b.getWorldPosition(_mz); else _mz.set(u.x + Math.sin(u.face) * 1.1, 0.8, u.z + Math.cos(u.face) * 1.1);
  let any = false;
  for (const h of hostilesOf(u)) { if (h.dead) continue; const d = dist(u, h); if (d > reach + h.r) continue; const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % TAU) - Math.PI); if (da > 0.8 && d > 0.9) continue;
    any = true; damage(u, h, u.dmg * (0.5 + 0.04 * rk(u, 'drill')) * rand(0.9, 1.1), { melee: last, heavy: last, knock: last ? 3.2 : 0.4, sum: true, flush: last }); }
  if (any) { S.drill(); C.parts.emit(_mz.x, _mz.y, _mz.z, last ? 14 : 7, { col: Math.random() < 0.5 ? 0xffd080 : 0xffffff, spd: 4.5, up: 1.5, grav: 9, life: 0.3, size: 0.1 }); impact(_mz.x, _mz.y, _mz.z, 0xffc070, last ? 0.9 : 0.6); }
}
// 喷射冲锋: crouch, then the thrusters fire and it rams in a straight line, shoving everything in the way aside
function startRocket(u, t) { u.state = 'rocket'; u.st = 0; u.tgt = t; u.hitSet = new Set(); faceTo(u, t); u.face = u.faceT; u.wantX = u.wantZ = u.vx = u.vz = u.kx = u.kz = 0;
  u.moveCD = 7 - 0.7 * rk(u, 'rocket'); play(u.mesh, 'Dodge_Forward', { once: true, restart: true, speed: 0.75, fade: 0.06 }); trail(u, 1.1); say(u.x, u.z, tr('喷射冲锋！', 'Rocket Dash!'), '#9fe8ff', 14, 1.9); S.fire(); }
function updateRocket(u, dt) {
  u.st += dt; u.wantX = u.wantZ = u.vx = u.vz = u.kx = u.kz = 0; const t = u.tgt, fx = Math.sin(u.face), fz = Math.cos(u.face);
  const jet = (n, sp) => C.parts.emit(u.x - fx * 0.42, 0.72, u.z - fz * 0.42, n, { col: Math.random() < 0.6 ? 0xff9a3a : 0xc77dff, spd: sp, up: 0.2, grav: 0, life: 0.28, size: 0.28, spread: 0.15 });
  if (u.st < 0.18) { jet(2, 0.6); return; } // thrusters lighting
  if (t && !t.dead) { faceTo(u, t); u.face = u.faceT; }
  const step = 13 * dt, nx = u.x + fx * step, nz = u.z + fz * step, reach = t && !t.dead ? u.r + t.r + 0.35 : 0, dt2 = t && !t.dead ? dist(u, t) : 0;
  const blocked = !C.floor.walk(nx + fx * u.r, nz + fz * u.r); if (!blocked) { u.x = nx; u.z = nz; }
  jet(3, 2.2); C.parts.emit(u.x, 0.1, u.z, 1, { col: 0xb8a890, spd: 1, up: 0.5, life: 0.4, size: 0.3 });
  for (const h of hostilesOf(u)) { if (h.dead || u.hitSet.has(h) || h === t || dist(u, h) > 0.95 + h.r) continue; u.hitSet.add(h); // shoved aside
    const sx = -fz, sz = fx, side = (h.x - u.x) * sx + (h.z - u.z) * sz >= 0 ? 1 : -1; h.kx += sx * side * 5; h.kz += sz * side * 5;
    damage(u, h, u.dmg * (0.6 + 0.15 * rk(u, 'rocket')) * rand(0.9, 1.1), { melee: true, heavy: true }); }
  if (blocked || !t || t.dead || dt2 <= reach || u.st > 1.0) { // impact
    S.smash(); shake(0.1, u.x, u.z); burst(u.x + fx * 0.6, 0.6, u.z + fz * 0.6, 0xffb060, 2); C.parts.emit(u.x, 0.2, u.z, 18, { col: 0xc8bca8, spd: 3.5, up: 1.2, life: 0.5, size: 0.3 });
    for (const h of hostilesOf(u)) if (!h.dead && dist(u, h) < 1.7 + h.r) { damage(u, h, u.dmg * 0.5 * rand(0.9, 1.1), { knock: 2.6, fx: u.x, fz: u.z, heavy: true }); h.stun = Math.max(h.stun, 0.5); if (!h.dead) { h.target = u; h.aggro = true; } }
    u.state = 'recover'; u.st = 0; u.cdT = Math.max(u.cdT, 0.3); }
}
// 护盾力场: soaks damage for a while and draws the enemies around onto the mech
function aegisSkill(u) {
  const r = rk(u, 'aegis'); if (!r || u.shieldT > 0 || (u.aegisCD || 0) > G.t) return false;
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 4); if (!(near.length >= 3 || (u.hp < u.maxHp * 0.55 && near.length))) return false;
  u.shieldHP = u.maxHp * (0.25 + 0.1 * r); u.shieldT = 4 + r; u.tauntR = 6 + r; u.aegisCD = G.t + 16 - 1.5 * r; u.dome = shieldDome(u); u.tauntT = 0; S.raise(); say(u.x, u.z, tr('护盾力场！', 'Shield Field!'), '#8fe8ff', 14, 1.9); return true;
}
function endShield(u) { u.shieldHP = 0; u.shieldT = 0; if (u.mech) u.tauntR = 6; if (u.dome) { domeEnd(u.dome); u.dome = null; C.parts.emit(u.x, 0.9, u.z, 16, { col: 0x8fe8ff, spd: 2.5, up: 1, grav: 2, life: 0.4, size: 0.18 }); } }
function shieldTick(u, dt) { u.shieldT -= dt; if (u.shieldT <= 0) { endShield(u); return; } u.tauntT -= dt;
  if (u.tauntT <= 0) { u.tauntT = 1; const R = 6 + rk(u, 'aegis'); for (const e of hostilesOf(u)) if (!e.dead && dist(e, u) < R) { e.target = u; e.aggro = true; } } }
// 过载: charge up, then an EMP shockwave rolls out from the mech
function overloadSkill(u) {
  const r = rk(u, 'overload'); if (!r || (u.ovCD || 0) > G.t || u.state !== 'idle' || u.stun > 0) return false;
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 3); if (near.length < 3 && !near.some(h => h.champ && dist(h, u) < 2.5)) return false;
  u.state = 'overload'; u.st = 0; u.ovCD = G.t + 11 - r; u.wantX = u.wantZ = 0; play(u.mesh, 'Spellcast_Raise', { once: true, restart: true, speed: 1.5, fade: 0.06 }); u.animLock = 0.6;
  say(u.x, u.z, tr('过载！', 'Overload!'), '#d8b0ff', 14, 1.9); S.zap(); return true;
}
function updateOverload(u, dt) {
  u.st += dt; u.wantX = u.wantZ = 0; const k = Math.min(1, u.st / 0.45), E = u.mesh.u.uEmis.value;
  if (!u.ovE) u.ovE = E.clone(); E.setRGB(0.25 * k, 0.15 * k, 0.4 * k).add(u.ovE);
  if (Math.random() < 0.8) { const a = Math.random() * TAU; C.parts.emit(u.x + Math.cos(a) * 0.5, 0.4 + Math.random() * 1.0, u.z + Math.sin(a) * 0.5, 1, { col: Math.random() < 0.5 ? 0x9fe8ff : 0xd8b0ff, spd: 1.5, up: 0.5, grav: 0, life: 0.15, size: 0.15 }); }
  if (u.st < 0.45) return;
  const r = rk(u, 'overload'), R = 3 + 0.3 * r; E.copy(u.ovE); u.ovE = null; empWave(u.x, u.z, R); S.zap(); S.boom();
  const hit = hostilesOf(u).filter(h => !h.dead && dist(h, u) < R + h.r).sort((a, b) => dist(a, u) - dist(b, u));
  hit.forEach((h, i) => { if (i < 7) bolt(u, h, 0.3); damage(u, h, u.dmg * (1.1 + 0.3 * r) * rand(0.9, 1.1), { knock: 2.6, fx: u.x, fz: u.z, heavy: true, noChain: true }); if (!h.dead) h.stun = Math.max(h.stun, 0.8 + 0.3 * r); });
  u.state = 'recover'; u.st = 0; u.cdT = Math.max(u.cdT, 0.4);
}
// 旋风斩: when surrounded, spin and hit everything around twice
function spinSkill(u) {
  const r = rk(u, 'spin'); if (u.kind !== 'brute' || u.mech || !r || (u.spinCD || 0) > G.t || u.stun > 0) return false;
  let n = 0; for (const h of hostilesOf(u)) if (!h.dead && dist(u, h) < 1.9 + h.r) n++; if (n < 2) return false;
  u.state = 'spin'; u.st = 0; u.hits = 0; u.spinCD = G.t + 7 - r; u.wantX = u.wantZ = 0;
  play(u.mesh, '2H_Melee_Attack_Spin', { once: true, restart: true, speed: 2.1, fade: 0.06 }); u.animLock = clipLen('2H_Melee_Attack_Spin') / 2.1 * 0.9; trail(u, 1.15); spinFx(u); say(u.x, u.z, tr('旋风斩！', 'Whirlwind!'), '#8ff5ea', 14, 1.9); return true;
}
function updateSpin(u, dt) {
  u.st += dt; u.wantX = u.wantZ = 0; const r = rk(u, 'spin');
  if ((u.hits === 0 && u.st > 0.35) || (u.hits === 1 && u.st > 0.75)) { u.hits++; S.smash(); C.parts.emit(u.x, 0.5, u.z, 14, { col: 0x8ff5ea, spd: 3.5, up: 0.6, life: 0.35, size: 0.22, grav: 0 });
    for (const h of hostilesOf(u)) if (!h.dead && dist(u, h) < 2.0 + h.r) damage(u, h, u.dmg * (0.6 + 0.2 * r) * rand(0.9, 1.1), { knock: 1.6, melee: true }); }
  if (u.st > 1.1) { u.state = 'recover'; u.st = 0; }
}
// 突刺: a fast lunge into a stab that always crits
function startLunge(u, t, chained) {
  u.state = 'lunge'; u.st = 0; u.tgt = t; faceTo(u, t); u.face = u.faceT; u.wantX = u.wantZ = 0;
  if (!chained) { u.moveCD = 4 - 0.4 * rk(u, 'lunge'); u.chainLeft = rk(u, 'chain'); } else say(u.x, u.z, tr('连刺！', 'Chain!'), '#8ff5ea', 13, 1.6);
  play(u.mesh, 'Dodge_Forward', { once: true, restart: true, speed: 0.9, fade: 0.05 }); u.animLock = 0.3; trail(u, 0.7);
}
function updateLunge(u, dt) {
  const t = u.tgt; u.st += dt; if (!t || t.dead) { u.state = 'idle'; return; }
  const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz) || 1, reach = u.range + u.r + t.r;
  u.wantX = dx / d * 8.5; u.wantZ = dz / d * 8.5; u.vx = u.wantX; u.vz = u.wantZ; faceTo(u, t);
  if (Math.random() < 0.7) C.parts.emit(u.x, 0.5, u.z, 1, { col: 0x6ff7e8, spd: 0.3, up: 0.3, life: 0.35, size: 0.3, grav: 0 });
  if (d < reach || u.st > 0.6) { u.vx *= 0.2; u.vz *= 0.2; u.wantX = u.wantZ = 0; u.lungeHit = true; startWindup(u, t); u.wind = 0.1; attackAnim(u, 0.1); }
}
// ---------- per-frame unit update ----------
export function updateUnit(u, dt) {
  if (u.dead) return;
  u.flash = Math.max(0, u.flash - dt * 6.5); u.barT -= dt; u.cdT -= dt * slowK(u); dt *= slowK(u) < 1 ? 0.75 : 1;
  if (u.spawnT > 0) { u.spawnT -= dt; u.wantX = u.wantZ = 0; return; }
  if (u.eng) engTick(u, dt); else if (u.dr) clearDrones(u);
  if (u.burst > 0) gunTick(u, dt); if (u.recoilT > 0) u.recoilT -= dt; if (u.grind > 0) drillTick(u, dt); if (u.shieldT > 0) shieldTick(u, dt);
  if (u.mech && u.state === 'windup' && u.mesh.drill) u.mesh.drill.spin = Math.max(u.mesh.drill.spin, 12 + 30 * Math.min(1, u.st / Math.max(0.05, u.wind))); // spinning up
  if (u.shred && G.t - u.shredT > 3) u.shred = Math.max(0, u.shred - dt * 10);
  if (u.gun) { u.nadeCD = (u.nadeCD ?? 2.5) - dt; u.depCD = (u.depCD ?? 3) - dt; if (u.deployT > 0) { u.deployT -= dt; if (u.deployT <= 0) undeploy(u); } }
  if (u.stun > 0 && u.state !== 'leap') { u.stun -= dt; u.wantX = u.wantZ = 0; if (u.tele) { C.scene.remove(u.tele); u.tele = null; } }
  else if (u.state === 'windup') { u.st += dt; u.wantX = u.wantZ = 0; if (u.tgt && !u.tgt.dead && u.kind !== 'brute') faceTo(u, u.tgt);
    if (u.tele) { const k = Math.min(1, u.st / u.wind), T = u.tele; if (T.userData.en) { T.material.opacity = 0.1 + 0.25 * k; T.userData.edge.material.opacity = 0.35 + 0.6 * k; } else T.material.opacity = 0.12 + 0.28 * k; T.position.set(u.x, 0.04, u.z); }
    if (u.st >= u.wind) strike(u); }
  else if (u.state === 'recover') { u.st += dt; u.wantX = u.wantZ = 0; if (u.chainNext && u.st > 0.1) { const n = u.chainNext; u.chainNext = null; if (!n.dead) { startLunge(u, n, true); return; } } if (u.st > 0.22 / PACE.act) u.state = 'idle'; }
  else if (u.state === 'spin') updateSpin(u, dt);
  else if (u.state === 'barrage') updateBarrage(u, dt);
  else if (u.state === 'rocket') updateRocket(u, dt);
  else if (u.state === 'overload') updateOverload(u, dt);
  else if (u.state === 'call') updateCall(u, dt);
  else if (u.state === 'leap') updateLeap(u, dt);
  else if (u.state === 'lunge') updateLunge(u, dt);
  else if (u.state === 'pskill') { if (PH.skillTick) PH.skillTick(u, dt); else u.state = 'idle'; } // 魂契 skeleton's skills (pactskills.js)
  else if (u.state === 'throw') { u.st += dt; u.wantX = u.wantZ = 0; if (!u.thrown && u.st >= u.wind) { u.thrown = true; launchNade(u, u.nadeAt); } if (u.st >= u.wind + 0.3) { u.state = 'idle'; u.thrown = false; } }
  else if (u.state === 'cast') { u.st += dt; u.wantX = u.wantZ = 0;
    if (u.castC) { if (!G.corpses.includes(u.castC)) { u.state = 'idle'; u.castC = null; } else { if (Math.random() < 0.5) C.parts.emit(u.castC.x, 0.3, u.castC.z, 1, { col: 0xc070ff, spd: 0.5, up: 2, life: 0.6, grav: -1 });
      if (u.st > 1.0 / PACE.act) { resurrect(u, u.castC); u.castC = null; u.state = 'recover'; u.st = 0; u.resCD = rand(5, 7); } } }
    else if (u.castH) { if (u.st > 0.5 / PACE.act) { const f = u.castH; u.castH = null; u.state = 'recover'; u.st = 0;
      if (!f.dead) { const h = (f.maxHp * 0.18 + 3 * u.level) * (1 + 0.2 * rk(u, 'heal')); f.hp = Math.min(f.maxHp, f.hp + h); say(f.x, f.z, '+' + Math.round(h), '#7dff9a', 15); S.heal();
        C.parts.emit(f.x, 0.6, f.z, 14, { col: 0x7dff9a, spd: 0.8, up: 2.5, life: 0.8, grav: -1 });
        const mr = rk(u, 'mass'); if (mr) for (const o of G.friends) { if (o === f || o.dead || o.hp >= o.maxHp || dist(o, f) > 2.5 + 0.5 * mr) continue; const h2 = h * (0.35 + 0.15 * mr);
          o.hp = Math.min(o.maxHp, o.hp + h2); say(o.x, o.z, '+' + Math.round(h2), '#7dff9a', 13); C.parts.emit(o.x, 0.6, o.z, 8, { col: 0x7dff9a, spd: 0.6, up: 2, life: 0.7, grav: -1 }); } } } }
    else u.state = 'idle'; }
  else if (u.side === 'enemy') enemyThink(u, dt);
  else if (u.side === 'ally') allyThink(u, dt);
}
function resurrect(by, c) {
  if (!G.corpses.includes(c)) return; removeCorpse(c);
  const n = new Unit(c.kind, 'enemy', c.rx ?? c.x, c.rz ?? c.z, { level: c.level, mods: c.mods, champ: c.champ, packId: c.packId, hpFrac: 0.6 }); n.aggro = true; n.target = by.target; G.units.push(n);
  n.face = c.mesh.root.rotation.y; rise(n, 'Death_C_Skeletons_Resurrect', 1.4);
  S.raise(); C.parts.emit(c.x, 0.5, c.z, 24, { col: 0xc070ff, spd: 1.4, up: 2.5, life: 0.8 }); say(c.x, c.z, tr('复活了！', 'Risen!'), '#c88cff', 16);
}
// movement, separation, walls, visuals
let frame = 0, camX = 0, camZ = 0; const WP = new THREE.Vector3(), TMPC = new THREE.Color();
export function integrate(units, dt) {
  const F = C.floor; frame++; if (G.player) { camX = G.player.x; camZ = G.player.z; }
  for (const u of units) { if (u.dead) continue; updateStatus(u, dt); if (u.dead) continue; const a = Math.min(1, dt * 10), sk = slowK(u) * (u.deployT > 0 ? 0.5 : 1); u.vx += (u.wantX * sk - u.vx) * a; u.vz += (u.wantZ * sk - u.vz) * a; }
  for (let i = 0; i < units.length; i++) { const a = units[i]; if (a.dead || a.state === 'leap' || a.state === 'rocket') continue;
    for (let j = i + 1; j < units.length; j++) { const b = units[j]; if (b.dead || b.state === 'leap' || b.state === 'rocket') continue; const dx = b.x - a.x, dz = b.z - a.z, rr = (a.r + b.r) * (a.side !== 'enemy' && b.side !== 'enemy' ? 0.45 : 1); if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      const d = Math.hypot(dx, dz); if (d >= rr || d < 1e-5) continue; const push = (rr - d) * 0.5, nx = dx / d, nz = dz / d;
      const pa = a.kind === 'player' && b.side === 'ally', pb = b.kind === 'player' && a.side === 'ally';
      let wa = pa ? 0 : pb ? 1 : a.kind === 'player' ? 0.3 : a.kind === 'brute' ? 0.6 : 1, wb = pb ? 0 : pa ? 1 : b.kind === 'player' ? 0.3 : b.kind === 'brute' ? 0.6 : 1;
      if (a.pact) { wa = 0; wb = 1; } else if (b.pact) { wb = 0; wa = 1; } // the 魂契 skeleton is never shoved (not even by the summoner)
      const sw = wa + wb;
      a.x -= nx * push * 2 * wa / sw; a.z -= nz * push * 2 * wa / sw; b.x += nx * push * 2 * wb / sw; b.z += nz * push * 2 * wb / sw; } }
  for (const u of units) { if (u.dead) continue;
    u.x += (u.vx + u.kx) * dt; u.z += (u.vz + u.kz) * dt; const kd = Math.exp(-dt * 7); u.kx *= kd; u.kz *= kd; F.collide(u);
    const sp = Math.hypot(u.vx, u.vz), aiming = (u.gun && (u.burst > 0 || G.t - (u.lastShot || -9) < 0.35)) || (u.mortar && (u.state === 'windup' || u.state === 'barrage' || u.recoilT > 0)); if (sp > 0.4 && u.state !== 'windup' && u.state !== 'leap' && !aiming) u.faceT = Math.atan2(u.vx, u.vz);
    if (u.faceT != null) { let d = u.faceT - u.face; d = ((d + Math.PI * 3) % TAU) - Math.PI; u.face += d * Math.min(1, dt * 14); }
    const m = u.mesh; m.root.position.set(u.x, (u.y || 0) + (F.lift ? F.lift(u.x, u.z) : 0), u.z); m.root.rotation.y = u.face;
    if (u.jolt > 0.03) { const j = u.jolt; m.root.position.x += (Math.random() - 0.5) * 0.09 * j; m.root.position.z += (Math.random() - 0.5) * 0.09 * j; m.root.scale.set(1 + 0.09 * j, 1 - 0.12 * j, 1 + 0.09 * j); u.jolt *= Math.exp(-dt * 13); u.jolted = true; }
    else if (u.jolted) { u.jolted = false; u.jolt = 0; m.root.scale.set(1, 1, 1); }
    animate(u, dt, sp); m.u.uFlash.value = u.flash * 0.7; if (u.ringMesh) u.ringMesh.rotation.y += dt;
    if (m.soul) { const f = 1 + Math.sin(G.t * 9 + u.id) * 0.08 + Math.sin(G.t * 23 + u.id * 3) * 0.05; m.soul.scale.setScalar(f); m.soul.position.x = Math.sin(G.t * 2 + u.id) * 0.06;
      if (Math.random() < dt * 2.5) { m.soul.getWorldPosition(WP); C.parts.emit(WP.x, WP.y, WP.z, 1, { col: 0x5ff6e6, spd: 0.1, up: 0.5, grav: -0.4, life: 0.6, size: 0.12, spread: 0.08 }); } }
    if (m.elems && m.elems.length > 1) { const n = m.elems.length, f = (G.t * 0.6 + u.id * 0.37) % n, i = Math.floor(f), k = f - i, a = ELEM[m.elems[i]].col, b = ELEM[m.elems[(i + 1) % n]].col;
      m.u.uRim.value.setHex(a).lerp(TMPC.setHex(b), k * k * (3 - 2 * k)).multiplyScalar(0.95); }
    if (m.aura && m.root.visible && Math.random() < dt * 7) { m.aura.tip.getWorldPosition(WP); C.parts.emit(WP.x, WP.y, WP.z, 1, { col: m.aura.col, spd: 0.12, up: 0.55, grav: -0.4, life: 0.65, size: 0.13, spread: 0.3 }); }
    if (m.elem && m.root.visible && (u.elemT = (u.elemT || 0) - dt) <= 0) { const el = ELEM[m.elems[Math.floor(Math.random() * m.elems.length)]]; u.elemT = 0.045;
      const t = m.tips[Math.floor(Math.random() * m.tips.length)]; if (t) { t.getWorldPosition(WP); C.parts.emit(WP.x, WP.y, WP.z, 1, el.part); }
      if (m.elem === 'fast' && sp > 1.5) C.parts.emit(u.x, 0.6, u.z, 1, { col: 0x8fe0ff, spd: 0.05, up: 0, grav: 0, life: 0.22, size: 0.42, spread: 0.3 }); }
    // animation level of detail: far units update their skeleton every other frame
    if (u.hitStop > 0) { u.hitStop -= dt; continue; } // hit-stop: the pose holds for a few frames
    u.mixAcc += dt * (u.chillT > 0 ? 0.6 : 1); if (Math.hypot(u.x - camX, u.z - camZ) > 13 && (frame + u.id) % 2) continue; m.mixer.update(u.mixAcc); u.mixAcc = 0;
    if (m.hero) heroWeaponPose(u, dt, (x, y, z, o) => C.parts.emit(x, y, z, 1, o));
  }
}
export function updateCorpses(dt) {
  let j = 0;
  for (const c of G.corpses) { c.t -= dt;
    if (c.vx || c.vz) { const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt; if (C.floor.walk(nx, nz)) { c.x = c.rx = nx; c.z = c.rz = nz; } else c.vx = c.vz = 0; // sliding back from the blow
      const k = Math.exp(-dt * 6); c.vx *= k; c.vz *= k; if (Math.abs(c.vx) + Math.abs(c.vz) < 0.05) c.vx = c.vz = 0; c.mesh.root.position.x = c.x; c.mesh.root.position.z = c.z; }
    if (c.hop) { c.hopT += dt; const k = Math.min(1, c.hopT / 0.32); c.mesh.root.position.y = Math.sin(Math.PI * k) * c.hop; if (k >= 1) c.hop = 0; }
    if (c.flash > 0) { c.flash = Math.max(0, c.flash - dt * 7); c.mesh.u.uFlash.value = c.flash * 0.8; }
    if (c.animT > 0) { c.animT -= dt; c.mesh.mixer.update(dt);
      if (c.animT <= 0) { const h = c.mesh.model.getObjectByName('hips'); if (h) { h.getWorldPosition(WP); if (C.floor.walk(WP.x, WP.z)) { c.x = WP.x; c.z = WP.z; } } } }
    if (c.t < 3) { c.mesh.u.uFade.value = Math.max(0, c.t / 3); for (const gs of c.mesh.glows) gs.material.opacity = 0.85 * Math.max(0, c.t / 3); }
    if (c.t <= 0) { C.scene.remove(c.mesh.root); continue; } G.corpses[j++] = c; }
  G.corpses.length = j;
}

// ---------- animation ----------
export const ANIM = {
  player: { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', atk: ['Spellcast_Shoot'], cast: 'Spellcasting', hit: 'Hit_A', die: 'Death_A', runAt: 2.0 },
  imp:    { idle: 'Idle_Combat', walk: 'Walking_D_Skeletons', run: 'Running_A', atk: ['1H_Melee_Attack_Stab', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'], hit: 'Hit_B', die: 'Death_C_Skeletons', runAt: 2.4 },
  brute:  { idle: 'Idle_Combat', walk: 'Walking_A', run: 'Running_B', atk: ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice'], hit: 'Hit_A', die: 'Death_C_Skeletons', runAt: 2.2 },
  archer: { idle: 'Idle_Combat', walk: 'Walking_A', run: 'Running_A', atk: ['1H_Ranged_Shoot'], hit: 'Hit_B', die: 'Death_C_Skeletons', runAt: 2.4 },
  shaman: { idle: 'Idle', walk: 'Walking_D_Skeletons', run: 'Running_A', atk: ['Spellcast_Shoot'], cast: 'Spellcast_Summon', hit: 'Hit_A', die: 'Death_C_Skeletons', runAt: 2.6 },
};
// fraction of each attack clip at which the blow lands (used to line the swing up with the windup; measured from where the blade moves fastest / reaches furthest)
const HIT_AT = { '1H_Melee_Attack_Stab': 0.4, '1H_Melee_Attack_Chop': 0.56, '1H_Melee_Attack_Slice_Diagonal': 0.42, '1H_Melee_Attack_Slice_Horizontal': 0.26, '2H_Melee_Attack_Chop': 0.52, '2H_Melee_Attack_Slice': 0.36,
  '1H_Ranged_Shoot': 0.35, Spellcast_Shoot: 0.4,
  // the 魂契 skeleton's Mixamo swings: when the blade passes closest to a body 1.5 m in front (measured on the retargeted clips)
  SNS_Atk2: 0.41, SNS_Atk3: 0.52, GS_Atk2: 0.51, GS_Atk3: 0.51, GS_Atk4: 0.44 };
// stride references (world units per second at model scale 0.5)
const REF = { Walking_A: 1.35, Walking_D_Skeletons: 1.2, Running_A: 3.6, Running_B: 3.4, Walking_Backwards: 1.2, Running_Strafe_Left: 2.6, Running_Strafe_Right: 2.6 };
export function attackAnim(u, wind) {
  if (u.mesh.hero) { const m = u.mesh, name = m.atk[m.atkI++ % m.atk.length], len = m.clips[name].duration, sp = Math.max(0.7, Math.min(3.2, len * (HIT_AT[name] ?? 0.42) / Math.max(0.05, wind))); play(m, name, { once: true, restart: true, speed: sp, fade: 0.08 }); u.animLock = len / sp * 0.85; return; }
  const list = u.mech ? ['1H_Melee_Attack_Stab'] : ANIM[u.kind].atk, name = list[Math.floor(Math.random() * list.length)], len = clipLen(name), sp = Math.max(0.7, Math.min(3.2, len * (HIT_AT[name] ?? 0.4) / Math.max(0.05, wind)));
  play(u.mesh, name, { once: true, restart: true, speed: sp, fade: 0.08 }); u.animLock = len / sp * 0.85;
}
export function playerAnim(u, kind) {
  if (kind === 'shoot') { play(u.mesh, 'Spellcast_Shoot', { once: true, restart: true, speed: 2.1, fade: 0.06 }); u.animLock = 0.4; }
  else if (kind === 'mend') { play(u.mesh, 'Spellcast_Raise', { once: true, restart: true, speed: 1.6, fade: 0.08 }); u.animLock = clipLen('Spellcast_Raise') / 1.6 * 0.8; }
  else if (kind === 'revive') { play(u.mesh, 'Idle', { restart: true, fade: 0 }); u.animLock = 0; }
}
function rise(u, name, sp) { play(u.mesh, name, { once: true, restart: true, speed: sp, fade: 0 }); u.spawnT = clipLen(name) / sp * 0.92; u.animLock = u.spawnT; u.mesh.mixer.update(0); }
// 机枪骷髅: legs walk / run / stand, arms always hold the gatling up with both hands (aiming, firing with recoil, or throwing a grenade)
function gunnerAnim(u, sp) { // (and the 炮手骷髅: same two-handed stance)
  const m = u.mesh, a = ANIM.imp;
  if (u.stun > 0) { if (!u.stunAnim) { u.stunAnim = true; play(m, a.hit, { once: true, restart: true, speed: 1.5, fade: 0.05 }); } return; }
  u.stunAnim = false; const k = CHARS[u.kind].scale * 1.1 / 0.5;
  if (sp > 0.35) { // legs follow the way it moves, not the way it aims: walk, back-pedal or side-step while the gun stays on the target
    let rel = Math.atan2(u.vx, u.vz) - u.face; rel = ((rel + Math.PI * 3) % TAU) - Math.PI; const ar = Math.abs(rel);
    const name = ar > 2.3 ? 'Walking_Backwards' : ar > 0.8 ? (rel > 0 ? 'Running_Strafe_Left' : 'Running_Strafe_Right') : sp > a.runAt ? 'Running_A' : 'Walking_A';
    play(m, partClip(name, 'lower'), { speed: Math.max(0.55, Math.min(1.8, sp / ((REF[name] || 1.3) * k))), fade: 0.18 }); }
  else play(m, partClip('2H_Ranged_Aiming', 'lower'), { fade: 0.2 });
  if (u.state === 'throw' && m.curUName === 'Throw@upper') return;
  if (u.mortar) { if (u.recoilT > 0 && m.curUName === '2H_Ranged_Shoot@upper') return; playUpper(m, partClip('2H_Ranged_Aiming', 'upper'), { fade: 0.25 }); return; }
  const firing = u.state === 'windup' || u.burst > 0 || (u.lastShot && G.t - u.lastShot < 0.2);
  playUpper(m, partClip(firing ? '2H_Ranged_Shooting' : '2H_Ranged_Aiming', 'upper'), { fade: firing ? 0.06 : 0.2, speed: firing ? 1.4 : 1 });
}
function animate(u, dt, sp) {
  const m = u.mesh, a = ANIM[u.kind];
  if (m.gun) { m.gun.barrel.rotation.z += m.gun.spin * dt; m.gun.spin = Math.max(0, m.gun.spin - dt * 22); }
  if (m.drill) { m.drill.bit.rotation.y += m.drill.spin * dt; m.drill.spin = Math.max(0, m.drill.spin - dt * 30); }
  if (u.spawnT > 0) return;
  if ((m.gun || u.mortar) && u.state !== 'leap') { gunnerAnim(u, sp); return; }
  if (u.animLock > 0) { u.animLock -= dt; if (sp < 0.6 || u.state === 'windup' || u.state === 'recover' || u.state === 'leap' || u.state === 'lunge' || u.state === 'rocket') return; }
  if (u.state === 'leap' || u.state === 'rocket' || u.state === 'overload' || u.state === 'call' || u.state === 'pskill') return;
  if (u.stun > 0) { if (!u.stunAnim) { u.stunAnim = true; play(m, a.hit, { once: true, restart: true, speed: 1.5, fade: 0.05 }); } return; }
  u.stunAnim = false;
  if (u.state === 'cast' || u.state === 'channel' || u.state === 'summon') { play(m, a.cast || 'Spellcasting', { speed: 1.2 }); return; }
  if (m.hero) { const ref = m.wset === 'GS' ? 2.02 : 1.56; // walk only (no run yet); strides from the clips' root travel, world m/s
    if (sp > 0.3) play(m, 'Walk_' + (m.wset || 'SNS'), { speed: Math.max(0.6, Math.min(1.6, sp / ref)), fade: 0.22 }); else play(m, 'Stand', { fade: 0.3 }); return; } // by name: the styles' own guarded Idle must not win
  const k = CHARS[u.kind].scale * (u.champ ? (u.side === 'ally' ? 1.1 : 1.25) : 1) / 0.5;
  if (sp > 0.35) { const run = sp > a.runAt || u.state === 'panic', name = run ? a.run : a.walk; play(m, name, { speed: Math.max(0.55, Math.min(1.8, sp / (REF[name] * k))), fade: 0.18 }); }
  else play(m, a.idle, { fade: 0.22 });
}
