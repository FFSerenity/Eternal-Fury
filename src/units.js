// Units, combat, monster / minion AI, corpses and capturing
import * as THREE from 'three';
import { G, save } from './state.js';
import { TYPES, MODS, SKILLS, xpNeed, partySize, TREE, soulPoints, soulXP } from './data.js';
import { glowSprite, ring, toonMat, part, merge } from './gfx.js';
import { makeUnitMesh, play, clipLen, CHARS } from './assets.js';
import { S } from './audio.js';

export const C = { scene: null, parts: null, floor: null, say: () => {} };
const rand = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2, tmp = { x: 0, z: 0 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// rank of a summon skill (enemies have none)
export const rk = (u, id) => (u.entry && u.entry.skills && u.entry.skills[id]) || 0;
let nextId = 1;

export class Unit {
  constructor(kind, side, x, z, o = {}) {
    this.id = nextId++; this.kind = kind; this.side = side; this.x = x; this.z = z; this.vx = this.vz = this.kx = this.kz = 0; this.wantX = this.wantZ = 0;
    this.level = o.level || 1; this.mods = o.mods || []; this.champ = !!o.champ; this.entry = o.entry || null; this.packId = o.packId ?? -1;
    this.T = TYPES[kind] || null; this.state = 'idle'; this.st = 0; this.cdT = rand(0.2, 0.8); this.target = null; this.face = rand(0, TAU);
    this.home = { x, z }; this.aggro = false; this.scanT = rand(0, 0.35); this.flash = 0; this.stun = 0; this.dead = false; this.barT = 0;
    this.flank = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0; this.strafeDir = 0; this.resCD = rand(2, 4); this.healCD = 2; this.walkPh = rand(0, 6); this.lostT = 0;
    this.stats();
    this.hp = this.maxHp * (o.hpFrac ?? 1);
    const ally = side === 'ally', champ = this.champ;
    const mod0 = this.mods[0] && MODS[this.mods[0]];
    this.mesh = makeUnitMesh(kind, {
      scale: champ ? 1.25 : 1,
      tint: this.mods.includes('stone') ? 0xb8b4ac : this.mods.includes('fire') && champ ? 0xffc8a8 : 0xffffff,
      emis: ally ? 0x061718 : champ && mod0 ? new THREE.Color(mod0.col).multiplyScalar(0.12).getHex() : 0x000000,
      outline: ally ? 0x3aa89f : champ && mod0 ? mod0.col : 0x120a10, outlineW: champ ? 0.07 : ally ? 0.04 : 0.05,
    });
    this.mesh.root.position.set(x, 0, z); this.mesh.root.rotation.y = this.face; C.scene.add(this.mesh.root);
    this.spawnT = 0; this.animLock = 0; this.mixAcc = 0; play(this.mesh, ANIM[kind].idle, { at: Math.random() });
    if (ally) { const rg = ring(0.42, 0.52, 0x3fe0d0, 0.35); rg.position.y = 0.03; this.mesh.root.add(rg); this.ringMesh = rg; }
    if (champ && mod0) { const rg = ring(0.5, 0.75, mod0.col, 0.55); rg.position.y = 0.03; this.mesh.root.add(rg); this.ringMesh = rg; }
  }
  get name() { return (this.champ && this.mods[0] ? MODS[this.mods[0]].name : '') + (this.T ? this.T.name : '召唤师'); }
  stats() {
    const L = this.level;
    if (this.kind === 'player') { this.maxHp = 90 + 10 * (L - 1); this.maxMp = 40 + 5 * (L - 1); this.speed = 4.6; this.r = 0.36; this.armor = 8 + 2 * L; this.dmg = 10 + 2.5 * (L - 1); return; }
    const T = this.T, ally = this.side === 'ally', k = ally ? 0.15 : 0.28, kd = ally ? 0.15 : 0.18;
    this.maxHp = T.hp * (1 + k * (L - 1)) * (ally ? 1.35 : 1); this.dmg = T.dmg * (1 + kd * (L - 1)) * (ally ? 1.15 : 1);
    this.armor = T.armor + 2 * (L - 1); this.speed = T.speed * (ally ? 1.08 : 1); this.range = T.range; this.cd = T.cd; this.r = T.r; this.noStun = false;
    if (this.champ) { this.maxHp *= 2.4; this.dmg *= 1.35; this.r *= 1.2; }
    if (this.mods.includes('fast')) { this.speed *= 1.45; this.cd *= 0.7; }
    if (this.mods.includes('stone')) { this.armor += 60; this.maxHp *= 1.3; this.speed *= 0.85; this.noStun = true; }
    this.taunt = ally && this.kind === 'brute'; this.tauntR = 5;
    if (!this.entry) return;
    const r = id => rk(this, id);
    if (this.kind === 'brute') { this.maxHp *= 1 + 0.12 * r('bone'); this.armor += 5 * r('bone'); this.tauntR = 5 + 1.5 * r('taunt'); }
    else if (this.kind === 'imp') { this.cd *= 1 - 0.07 * r('haste'); this.speed *= 1 + 0.04 * r('haste'); }
    else if (this.kind === 'archer') { this.dmg *= 1 + 0.12 * r('eagle'); this.range += 0.4 * r('eagle'); this.cd *= 1 - 0.08 * r('rapid'); }
  }
  remove() { C.scene.remove(this.mesh.root); }
}

export const hostilesOf = u => u.side === 'enemy' ? G.friends : G.enemies;
export function say(x, z, text, col = '#fff', size = 15, y = 1.7) { G.msgs.push({ x, y, z, text, col, size, t: 0, max: 1.0 }); }

// ---------- damage / death ----------
export function damage(src, dst, amt, o = {}) {
  if (!dst || dst.dead) return 0;
  let d = Math.max(1, amt * (1 - dst.armor / (dst.armor + 60)) * (1 - 0.08 * rk(dst, 'taunt'))); if (o.crit) d *= o.critX || 2;
  dst.hp -= d; dst.flash = 1; dst.barT = 3; dst.lastHit = G.t;
  if (o.knock) { const dx = dst.x - (o.fx ?? src.x), dz = dst.z - (o.fz ?? src.z), l = Math.hypot(dx, dz) || 1; dst.kx += dx / l * o.knock; dst.kz += dz / l * o.knock; }
  if (dst.kind !== 'player' && !dst.noStun && (d >= dst.maxHp * (dst.kind === 'brute' ? 0.25 : 0.12) || o.knock)) { dst.stun = Math.max(dst.stun, 0.3); if (dst.state === 'windup' || dst.state === 'cast') dst.state = 'idle'; }
  if (dst.side === 'enemy' && src && !src.dead) { if (!dst.target || Math.random() < 0.4) dst.target = src; if (!dst.aggro) { dst.aggro = true; alertPack(dst, src); } }
  if (dst.kind === 'player') S.hurt(); else S.hit(Math.min(1, d / 20));
  say(dst.x, dst.z, (o.crit ? '暴击 ' : '') + Math.round(d), dst.side === 'enemy' ? (o.crit ? '#ffd34d' : '#ffffff') : '#ff6b6b', o.crit ? 17 : 14, 1.4 + Math.random() * 0.4);
  if (dst.hp <= 0) kill(dst, src);
  return d;
}
export function alertPack(u, t) {
  for (const e of G.enemies) if (!e.aggro && e !== u && (e.packId === u.packId || dist(e, u) < 3.5)) { e.aggro = true; e.target = t; }
  S.rally();
}
function kill(u, src) {
  u.dead = true; u.hp = 0;
  if (u.side === 'enemy') {
    S.die(); C.parts.emit(u.x, 0.6, u.z, 10, { col: 0xd8d0c0, spd: 2, life: 0.6, size: 0.18 });
    const xp = u.T.xp * (1 + 0.25 * (u.level - 1)) * (u.champ ? 3 : 1); addXP(xp);
    for (const a of G.friends) if (a.side === 'ally') allyXP(a, xp * 0.7);
    if (u.mods.includes('fire')) G.fx.push({ t: 0.7, fn: () => fireBlast(u) });
    if (u.kind === 'imp') for (const e of G.enemies) if (e.kind === 'imp' && !e.dead && !e.champ && e !== u && dist(e, u) < 7.5) panic(e, src || u);
    makeCorpse(u);
  } else if (u.side === 'ally') {
    S.die(); const en = u.entry; if (en) { en.unit = null; en.reviveT = en.reviveMax = 10 + 1.5 * en.level; }
    if (u.mods.includes('fire')) G.fx.push({ t: 0.5, fn: () => fireBlast(u) });
    C.say(`${u.name} 倒下了，${Math.round(en ? en.reviveT : 10)} 秒后复原`); fadeOut(u);
  } else { // player
    u.respawnT = 2.8; u.state = 'dead'; C.say('你倒下了……', true); play(u.mesh, ANIM.player.die, { once: true, fade: 0.1 });
  }
}
function fadeOut(u) { const m = u.mesh; play(m, ANIM[u.kind].die, { once: true, speed: 1.3, fade: 0.08 }); if (u.ringMesh) m.root.remove(u.ringMesh); let lk = 0;
  G.fx.push({ t: 1.4, tick: (k) => { m.mixer.update((k - lk) * 1.4); lk = k; m.u.uFade.value = Math.min(1, (1 - k) * 2.2); }, fn: () => u.remove() }); }
function fireBlast(u) {
  S.boom(); C.parts.emit(u.x, 0.4, u.z, 40, { col: 0xff8a2a, spd: 5, up: 2, life: 0.7, size: 0.35 });
  const rg = ring(0.2, 0.5, 0xff7a20, 0.9); rg.position.set(u.x, 0.05, u.z); C.scene.add(rg);
  G.fx.push({ t: 0.45, tick: k => { rg.scale.setScalar(1 + k * 5); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) });
  for (const h of (u.side === 'enemy' ? G.friends : G.enemies)) if (!h.dead && dist(h, u) < 2.4) damage(u, h, u.dmg * 1.6, { knock: 3, fx: u.x, fz: u.z });
}
function panic(e, from) { if (e.state === 'panic') return; e.state = 'panic'; e.st = 0; e.panicDur = rand(1.3, 2.4); e.panicX = from.x; e.panicZ = from.z; S.squeal(); say(e.x, e.z, '!!', '#ffd34d', 18, 1.5); }

// ---------- corpses & capturing ----------
function makeCorpse(u) {
  const m = u.mesh; m.u.uTint.value.multiplyScalar(0.72); m.u.uFlash.value = 0; if (u.ringMesh) m.root.remove(u.ringMesh); if (u.tele) { C.scene.remove(u.tele); u.tele = null; }
  const name = ANIM[u.kind].die, sp = 1.15; play(m, name, { once: true, speed: sp, fade: 0.08 });
  const c = { kind: u.kind, level: u.level, mods: u.mods.slice(), champ: u.champ, x: u.x, z: u.z, t: 30, mesh: m, packId: u.packId, animT: clipLen(name) / sp + 0.1 };
  G.corpses.push(c);
}
export function captureChance(c) { return Math.max(0.05, Math.min(0.95, TYPES[c.kind].capture * (c.champ ? 0.5 : 1) * (1 + 0.05 * (G.level - 1)) - 0.03 * Math.max(0, c.level - G.level))); }
export function removeCorpse(c) { const i = G.corpses.indexOf(c); if (i >= 0) G.corpses.splice(i, 1); C.scene.remove(c.mesh.root); }
export function finishRaise(c) {
  if (!G.corpses.includes(c)) return;
  const ok = Math.random() < captureChance(c); removeCorpse(c);
  if (ok) {
    const en = { id: G.uid++, type: c.kind, level: c.level, xp: 0, mods: c.mods, champ: c.champ, active: false, reviveT: 0, unit: null, sp: 0, skills: {} };
    G.crypt.push(en); const room = activeCount() < partySize(G.level);
    if (room) { en.active = true; spawnAlly(en, c.x, c.z, 'reassemble'); } else soulToSummoner(c);
    S.caught(); C.parts.emit(c.x, 0.5, c.z, 30, { col: 0x6ff7e8, spd: 1.5, up: 3, life: 1.0, size: 0.3, grav: -1 });
    C.say(`收服了 ${(c.champ ? MODS[c.mods[0]].name : '') + TYPES[c.kind].name}！` + (room ? '' : '（灵魂收入墓典）')); save();
  } else { S.fail(); C.parts.emit(c.x, 0.3, c.z, 24, { col: 0x8a8090, spd: 1.2, up: 1.2, life: 0.9, size: 0.3 }); say(c.x, c.z, '唤魂失败', '#b9a8c8', 16); }
}
// party full: the captured monster still stands up, then turns into a soul that flies into the summoner
function soulToSummoner(c) {
  const m = makeUnitMesh(c.kind, { scale: c.champ ? 1.25 : 1, emis: 0x0a2a2a, outline: 0x3aa89f, outlineW: 0.04 });
  m.root.position.set(c.x, 0, c.z); m.root.rotation.y = c.mesh.root.rotation.y; C.scene.add(m.root);
  const name = 'Death_C_Skeletons_Resurrect', sp = 1.6; play(m, name, { once: true, restart: true, speed: sp, fade: 0 }); m.mixer.update(0);
  G.ghosts.push({ m, t: 0, rise: clipLen(name) / sp * 0.9, x: c.x, z: c.z, orb: null });
}
function soulOrb(x, y, z, to, onHit, col = 0x6ff7e8) {
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
            const rg = ring(0.25, 0.45, 0x6ff7e8, 0.9); rg.position.set(P.x, 0.05, P.z); C.scene.add(rg); G.fx.push({ t: 0.45, tick: q => { rg.scale.setScalar(1 + q * 3); rg.material.opacity = 0.9 * (1 - q); }, fn: () => C.scene.remove(rg) }); }); }
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
  if (u && P && !P.dead) soulOrb(P.x, 1.1, P.z, () => u, () => { S.heal(); C.parts.emit(u.x, 0.8, u.z, 24, { col: 0x6ff7e8, spd: 1.4, up: 2.5, life: 0.8, size: 0.26, grav: -1 }); say(u.x, u.z, `+${pts} 魂能`, '#8ff7ea', 15, 1.9); });
  else S.heal();
  save(); return { pts, xp, up: to.level - before };
}
export function learn(en, id) {
  const def = (TREE[en.type] || []).find(d => d.id === id); if (!def) return false; en.skills = en.skills || {}; const r = en.skills[id] || 0;
  if (r >= def.max || (en.sp || 0) < 1) return false; en.skills[id] = r + 1; en.sp--;
  const u = en.unit; if (u && !u.dead) { const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; C.parts.emit(u.x, 0.8, u.z, 16, { col: 0xffe58a, spd: 1, up: 2.5, life: 0.8, size: 0.22, grav: -1 }); }
  S.level(); save(); return true;
}
export const activeCount = () => G.crypt.filter(e => e.active).length;
export function spawnAlly(en, x, z, how = 'ground') {
  const P = G.player; if (x == null) { const a = rand(0, TAU); x = P.x + Math.cos(a) * 1.4; z = P.z + Math.sin(a) * 1.4; if (!C.floor.walk(x, z)) { x = P.x; z = P.z; } }
  const u = new Unit(en.type, 'ally', x, z, { level: en.level, mods: en.mods, champ: en.champ, entry: en }); en.unit = u; G.units.push(u);
  if (how) { u.face = Math.atan2(P.x - x, P.z - z); u.faceT = u.face; rise(u, how === 'reassemble' ? 'Death_C_Skeletons_Resurrect' : 'Spawn_Ground_Skeletons', how === 'reassemble' ? 1.4 : 1.7); }
  C.parts.emit(x, 0.4, z, 18, { col: 0x6ff7e8, spd: 1.6, up: 2, life: 0.7, size: 0.25 }); return u;
}
export function dismissAlly(en) { if (en.unit && !en.unit.dead) { const u = en.unit; u.dead = true; C.parts.emit(u.x, 0.5, u.z, 14, { col: 0x6ff7e8, spd: 1.2, up: 2, life: 0.6 }); u.remove(); } en.unit = null; }
function allyXP(a, xp) { const en = a.entry; if (!en) return; en.xp += xp;
  while (en.xp >= xpNeed(en.level) * 0.8) { en.xp -= xpNeed(en.level) * 0.8; en.level++; const f = a.hp / a.maxHp; a.level = en.level; a.stats(); a.hp = a.maxHp * Math.max(f, 0.5);
    C.parts.emit(a.x, 0.8, a.z, 20, { col: 0xffe58a, spd: 1.2, up: 3, life: 0.9, size: 0.25, grav: -1 }); C.say(`${a.name} 升到 Lv ${en.level}`); save(); } }
export function addXP(xp) {
  G.xp += xp; let up = false; while (G.xp >= xpNeed(G.level)) { G.xp -= xpNeed(G.level); G.level++; up = true; }
  if (!up) return; const P = G.player, before = P.level; P.level = G.level; P.stats(); P.hp = P.maxHp; P.mp = P.maxMp; S.level();
  C.parts.emit(P.x, 1, P.z, 40, { col: 0xffe58a, spd: 2, up: 4, life: 1.1, size: 0.3, grav: -1 });
  C.say(`升级！Lv ${G.level}`, true);
  if (partySize(G.level) > partySize(before)) { C.say(`可出战召唤物 +1（${partySize(G.level)} 只）`, true);
    const rest = G.crypt.filter(e => !e.active).sort((a, b) => b.level - a.level)[0]; if (rest && P && !P.dead) { rest.active = true; if (rest.reviveT <= 0) spawnAlly(rest); } }
  save();
}

// ---------- projectiles ----------
const SPEAR_G = merge([part(new THREE.ConeGeometry(0.07, 0.7, 6), 0xf6f0e0, [0, 0, 0], [Math.PI / 2, 0, 0])]);
const ARROW_G = merge([part(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 5), 0x8a6a40, [0, 0, 0], [Math.PI / 2, 0, 0]), part(new THREE.ConeGeometry(0.04, 0.1, 5), 0xdddddd, [0, 0, 0.33], [Math.PI / 2, 0, 0])]);
export function shoot(src, kind, tx, tz, o = {}) {
  let dx = tx - src.x, dz = tz - src.z; if (o.ang) { const c = Math.cos(o.ang), sn = Math.sin(o.ang); [dx, dz] = [dx * c - dz * sn, dx * sn + dz * c]; }
  const d = Math.hypot(dx, dz) || 1, sp = kind === 'spear' ? 16 : kind === 'arrow' ? 12 : 8.5;
  const s = { kind, src, side: src.side === 'enemy' ? 'enemy' : 'friend', x: src.x + dx / d * 0.4, z: src.z + dz / d * 0.4, y: kind === 'fire' ? 0.9 : 0.85, vx: dx / d * sp, vz: dz / d * sp,
    dmg: o.dmg ?? src.dmg, life: o.life ?? 1.1, hit: new Set(), root: new THREE.Group(), pierce: o.pierce || 0, splash: o.splash || 1.4 };
  if (kind === 'spear') { const m = new THREE.Mesh(SPEAR_G, toonMat({ emis: 0x2a3a3a })); s.root.add(m, glowSprite(0x9ff7ff, 0.9, 0.6)); }
  else if (kind === 'arrow') s.root.add(new THREE.Mesh(ARROW_G, toonMat()));
  else s.root.add(glowSprite(0xff8a2a, 1.3), glowSprite(0xffe080, 0.5));
  s.root.position.set(s.x, s.y, s.z); s.root.rotation.y = Math.atan2(dx, dz); C.scene.add(s.root); G.shots.push(s);
  if (kind === 'spear') S.spear(); else if (kind === 'arrow') S.arrow(); else S.fire();
  return s;
}
export function updateShots(dt) {
  const F = C.floor; let j = 0;
  for (const s of G.shots) {
    s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt; s.root.position.set(s.x, s.y, s.z); let dead = s.life <= 0 || !F.walk(s.x, s.z);
    if (s.kind === 'fire' && Math.random() < 0.6) C.parts.emit(s.x, s.y, s.z, 1, { col: 0xff8a2a, spd: 0.4, up: 0.5, life: 0.35, size: 0.3, grav: 0 });
    if (!dead) for (const u of (s.side === 'enemy' ? G.friends : G.enemies)) { if (u.dead || s.hit.has(u)) continue;
      if (Math.hypot(u.x - s.x, u.z - s.z) < u.r + 0.22) { s.hit.add(u);
        if (s.kind === 'fire') { dead = true; break; }
        damage(s.src, u, s.dmg * rand(0.85, 1.15), { knock: s.kind === 'spear' ? 1.2 : 0 }); if (s.kind === 'spear') C.parts.emit(s.x, s.y, s.z, 5, { col: 0xe8e0d0, spd: 2, life: 0.3, size: 0.15 }); else if (s.pierce > 0) s.pierce--; else { dead = true; break; } } }
    if (dead) { if (s.kind === 'fire') { S.boom(); C.parts.emit(s.x, 0.5, s.z, 22, { col: 0xff8a2a, spd: 3, up: 2, life: 0.5, size: 0.3 });
        for (const u of (s.side === 'enemy' ? G.friends : G.enemies)) if (!u.dead && Math.hypot(u.x - s.x, u.z - s.z) < s.splash + u.r) damage(s.src, u, s.dmg, { knock: 1.5, fx: s.x, fz: s.z }); }
      C.scene.remove(s.root); continue; }
    G.shots[j++] = s;
  }
  G.shots.length = j;
}

// ---------- AI ----------
function seek(u, tx, tz, spd) { C.floor.dirTo(u.x, u.z, tx, tz, tmp); u.wantX = tmp.x * spd; u.wantZ = tmp.z * spd; }
function flee(u, fx, fz, spd) {
  let ax = u.x - fx, az = u.z - fz; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
  for (const ang of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5]) { const c = Math.cos(ang), s = Math.sin(ang), dx = ax * c - az * s, dz = ax * s + az * c;
    if (C.floor.walk(u.x + dx * 0.9, u.z + dz * 0.9) && C.floor.walk(u.x + dx * 1.6, u.z + dz * 1.6)) { u.wantX = dx * spd; u.wantZ = dz * spd; return true; } }
  u.wantX = u.wantZ = 0; return false;
}
const faceTo = (u, t) => { u.faceT = Math.atan2(t.x - u.x, t.z - u.z); };
function startWindup(u, t) { u.state = 'windup'; u.st = 0; u.wind = u.T.windup * (u.mods.includes('fast') ? 0.7 : 1); u.tgt = t; faceTo(u, t); attackAnim(u, u.wind);
  if (u.kind === 'brute') { const rg = ring(0.2, u.range + u.r + 0.3, u.side === 'enemy' ? 0xff3a2a : 0x3fe0d0, 0.0); rg.position.set(u.x, 0.04, u.z); C.scene.add(rg); u.tele = rg; } }
function strike(u) {
  const t = u.tgt; u.state = 'recover'; u.st = 0; u.cdT = u.cd * rand(0.9, 1.15); if (u.tele) { C.scene.remove(u.tele); u.tele = null; }
  if (!t || t.dead) return;
  if (u.kind === 'brute') { S.smash(); C.parts.emit(u.x + Math.sin(u.face) * 0.8, 0.2, u.z + Math.cos(u.face) * 0.8, 16, { col: 0xb8a890, spd: 3, up: 1.5, life: 0.5, size: 0.3 });
    for (const h of hostilesOf(u)) { if (h.dead) continue; const d = dist(u, h); if (d > u.range + u.r + h.r + 0.35) continue;
      const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % TAU) - Math.PI); if (da < 1.1 || d < 0.9) damage(u, h, u.dmg * rand(0.9, 1.1), { knock: 4 }); } }
  else if (u.kind === 'imp') { const lg = u.lungeHit; u.lungeHit = false; if (dist(u, t) < (u.range + u.r + t.r) * (lg ? 1.6 : 1.35)) { damage(u, t, u.dmg * rand(0.85, 1.15) * (lg ? 1.25 * (1 + 0.2 * rk(u, 'lunge')) : 1), { crit: u.side === 'ally' && (lg || Math.random() < 0.15 + 0.06 * rk(u, 'crit')), critX: 2 + 0.1 * rk(u, 'crit') });
      if (lg && u.chainLeft > 0) { let nx = null, nd = 5; for (const e of hostilesOf(u)) { if (e.dead || e === t) continue; const de = dist(u, e); if (de < nd && de > 0.8 && C.floor.los(u.x, u.z, e.x, e.z)) { nd = de; nx = e; } }
        if (nx) { u.chainLeft--; u.chainNext = nx; } } } }
  else if (u.kind === 'archer') { const lead = Math.min(0.5, dist(u, t) / 12), n = 1 + rk(u, 'multi'), tx = t.x + (t.vx || 0) * lead, tz = t.z + (t.vz || 0) * lead;
    for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.17; shoot(u, 'arrow', tx, tz, { life: 0.9 + 0.04 * rk(u, 'eagle'), ang: a, pierce: rk(u, 'pierce'), dmg: u.dmg * (a ? 0.75 : 1) }); } }
  else if (u.kind === 'shaman') shoot(u, 'fire', t.x, t.z, { life: 1.1, dmg: u.dmg * (1 + 0.15 * rk(u, 'fire')), splash: 1.4 + 0.15 * rk(u, 'fire') });
}
function meleeLogic(u, t) {
  const d = dist(u, t), reach = u.range + u.r + t.r;
  if (d > reach * 0.95) { let tx = t.x, tz = t.z;
    if (d < 3.2) { const ang = Math.atan2(u.z - t.z, u.x - t.x) + u.flank * 0.45; tx = t.x + Math.cos(ang) * reach * 0.85; tz = t.z + Math.sin(ang) * reach * 0.85; }
    seek(u, tx, tz, u.speed); }
  else { u.wantX = u.wantZ = 0; faceTo(u, t); if (u.cdT <= 0) startWindup(u, t); }
}
function rangedLogic(u, t, dt, near, far) {
  const d = dist(u, t), vis = C.floor.los(u.x, u.z, t.x, t.z);
  if (!vis || d > far + 0.5) { seek(u, t.x, t.z, u.speed); return; }
  if (d < near) { if (!flee(u, t.x, t.z, u.speed)) { faceTo(u, t); if (u.cdT <= 0) startWindup(u, t); } return; }
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
      let s = d; if (h.taunt && d < h.tauntR) s -= 3.5 + rk(h, 'taunt'); if (h.kind === 'player') s -= 0.6; if (h === u.target) s -= 1.2; if (s < bs) { bs = s; best = h; } }
    if (best) { if (!u.aggro) { u.aggro = true; alertPack(u, best); } u.target = best; u.lostT = 0; }
    else if (u.aggro) { u.lostT += 0.35; if (u.lostT > 5) { u.aggro = false; u.target = null; } }
  }
  if (u.state === 'panic') { u.st += dt; flee(u, u.panicX, u.panicZ, u.speed * 1.15); if (u.st > u.panicDur) { u.state = 'idle'; S.rally(); } return; }
  const t = u.target && !u.target.dead ? u.target : null;
  if (!t) { // idle / go home
    const dh = Math.hypot(u.home.x - u.x, u.home.z - u.z);
    if (dh > 2.5) seek(u, u.home.x, u.home.z, u.speed * 0.6); else { u.wantX *= 0.9; u.wantZ *= 0.9; if (Math.random() < dt * 0.4) { const a = rand(0, TAU); u.wantX = Math.cos(a) * 0.8; u.wantZ = Math.sin(a) * 0.8; } }
    return; }
  if (u.kind === 'imp' && !u.champ && !u.panicked && u.hp < u.maxHp * 0.3) { u.panicked = true; panic(u, t); return; }
  if (u.kind === 'brute' || u.kind === 'imp') meleeLogic(u, t);
  else if (u.kind === 'archer') rangedLogic(u, t, dt, 4, 7.5);
  else if (u.kind === 'shaman') {
    u.resCD -= dt;
    if (u.resCD <= 0) { let best = null, bd = 9; for (const c of G.corpses) if ((c.kind === 'imp' || c.kind === 'archer') && !c.claim && Math.hypot(c.x - u.x, c.z - u.z) < bd) { bd = Math.hypot(c.x - u.x, c.z - u.z); best = c; }
      if (best) { if (bd > 3.2) { seek(u, best.x, best.z, u.speed); return; } u.state = 'cast'; u.st = 0; u.castC = best; best.claim = u; u.wantX = u.wantZ = 0; faceTo(u, best);
        C.say && say(u.x, u.z, '复活术…', '#c88cff', 14, 2.1); return; } }
    const close = nearestHostile(u, 2.6, false); if (close) { flee(u, close.x, close.z, u.speed); return; }
    rangedLogic(u, t, dt, 4.5, 7.5);
  }
}
// summons fight up front: they pick fights near the summoner on their own, peel enemies off the summoner,
// and the melee ones close the gap with a move skill (warrior: leap slam, minion: lunge)
const MELEE = k => k === 'brute' || k === 'imp';
function allyScore(u, e, P) { const de = dist(e, P); return dist(e, u) + de * 0.35 - (e.target === P ? 3 : 0) - (e === G.focus ? 2.5 : 0) - (e.champ ? 0.5 : 0); }
function allyThink(u, dt) {
  const P = G.player; if (P.dead) { u.wantX = u.wantZ = 0; return; }
  const dp = dist(u, P);
  if (dp > 20 || (dp > 9 && !C.floor.los(u.x, u.z, P.x, P.z) && u.state === 'idle' && Math.random() < dt * 0.5)) { // catch up
    const a = rand(0, TAU); u.x = P.x + Math.cos(a) * 1.2; u.z = P.z + Math.sin(a) * 1.2; if (!C.floor.walk(u.x, u.z)) { u.x = P.x; u.z = P.z; } u.target = null;
    C.parts.emit(u.x, 0.5, u.z, 10, { col: 0x6ff7e8, spd: 1, up: 2, life: 0.5 }); return; }
  u.scanT -= dt; u.moveCD = (u.moveCD || 0) - dt;
  if (u.scanT <= 0) { u.scanT = 0.25; let best = null, bs = 1e9;
    for (const e of G.enemies) { if (e.dead) continue; const de = dist(e, P); if (de > 12) continue; if (!(e.aggro || de < 11)) continue;
      if (!C.floor.los(P.x, P.z, e.x, e.z) && !C.floor.los(u.x, u.z, e.x, e.z)) continue; const sc = allyScore(u, e, P); if (sc < bs) { bs = sc; best = e; } }
    const cur = u.target && !u.target.dead && dist(u.target, P) < 15 ? u.target : null;
    u.target = cur && best && allyScore(u, cur, P) < bs + 1.5 ? cur : best || cur; }
  if (u.target && (u.target.dead || dist(u.target, P) > 15)) u.target = null;
  if (u.kind === 'shaman') { u.healCD -= dt;
    if (u.healCD <= 0) { let lo = null, lr = 0.75; for (const f of G.friends) { if (f.dead || dist(f, u) > 8) continue; const r = f.hp / f.maxHp; if (r < lr) { lr = r; lo = f; } }
      if (lo) { u.state = 'cast'; u.st = 0; u.castH = lo; u.wantX = u.wantZ = 0; faceTo(u, lo); u.healCD = 3.5 - 0.3 * rk(u, 'heal'); return; } u.healCD = 0.6; } }
  if (!u.target || dp > 15) { // formation: melee summons walk ahead of the summoner, ranged ones beside / behind
    const allies = G.friends.filter(f => f.side === 'ally'), mine = allies.filter(f => MELEE(f.kind) === MELEE(u.kind)), idx = mine.indexOf(u), n = mine.length;
    const ang = MELEE(u.kind) ? P.face + (idx - (n - 1) / 2) * 0.8 : P.face + Math.PI + (idx - (n - 1) / 2) * 0.9, r = MELEE(u.kind) ? 1.7 : 1.6;
    let tx = P.x + Math.sin(ang) * r, tz = P.z + Math.cos(ang) * r; if (!C.floor.walk(tx, tz)) { tx = P.x; tz = P.z; } const d = Math.hypot(tx - u.x, tz - u.z);
    if (d > 0.5) seek(u, tx, tz, u.speed * Math.min(1.3, 0.35 + d / 2.5)); else { u.wantX = u.wantZ = 0; }
    return; }
  const t = u.target;
  if (MELEE(u.kind)) { if (spinSkill(u)) return; if (moveSkill(u, t)) return; meleeLogic(u, t); const d = dist(u, t); if (d > u.range + u.r + t.r + 1) { u.wantX *= 1.2; u.wantZ *= 1.2; } }
  else if (u.kind === 'archer') rangedLogic(u, t, dt, 3.5, 6.5 + 0.4 * rk(u, 'eagle'));
  else rangedLogic(u, t, dt, 4.5, 7);
}
function moveSkill(u, t) {
  if (u.moveCD > 0 || u.stun > 0) return false; const d = dist(u, t); if (!C.floor.los(u.x, u.z, t.x, t.z)) return false;
  if (u.kind === 'brute' && d > 2.6 && d < 8) { startLeap(u, t); return true; }
  if (u.kind === 'imp' && d > 2.2 && d < 6.5) { startLunge(u, t); return true; }
  return false;
}
// 跳劈: jump onto the target, slam on landing (area damage, knock-back, stagger) and pull the enemies hit onto the warrior
const LEAP = { clip: '1H_Melee_Attack_Jump_Chop', sp: 1.15, up: 0.13, land: 0.72 };
function startLeap(u, t) {
  const d = dist(u, t), k = Math.max(0, d - (u.r + t.r + 0.25)) / (d || 1);
  u.state = 'leap'; u.st = 0; u.lx0 = u.x; u.lz0 = u.z; u.lx1 = u.x + (t.x - u.x) * k; u.lz1 = u.z + (t.z - u.z) * k; u.lh = 0.35 + d * 0.07; u.tgt = t;
  u.t0 = LEAP.up / LEAP.sp; u.t1 = LEAP.land / LEAP.sp; u.wantX = u.wantZ = u.vx = u.vz = u.kx = u.kz = 0; faceTo(u, t); u.face = u.faceT;
  play(u.mesh, LEAP.clip, { once: true, restart: true, speed: LEAP.sp, fade: 0.06 }); u.animLock = clipLen(LEAP.clip) / LEAP.sp * 0.8;
  u.moveCD = 6.5 - 0.6 * rk(u, 'leap'); say(u.x, u.z, '跳劈！', '#8ff5ea', 14, 1.9);
}
function updateLeap(u, dt) {
  u.st += dt; u.wantX = u.wantZ = 0; u.vx = u.vz = u.kx = u.kz = 0;
  const k = Math.min(1, Math.max(0, (u.st - u.t0) / (u.t1 - u.t0))), e = k * k * (3 - 2 * k);
  u.x = u.lx0 + (u.lx1 - u.lx0) * e; u.z = u.lz0 + (u.lz1 - u.lz0) * e; u.y = Math.sin(Math.PI * k) * u.lh;
  if (u.st >= u.t1 && !u.landed) { u.landed = true; u.y = 0; S.smash();
    C.parts.emit(u.x, 0.15, u.z, 26, { col: 0xc8bca8, spd: 4, up: 1.2, life: 0.55, size: 0.32 }); C.parts.emit(u.x, 0.3, u.z, 12, { col: 0x6ff7e8, spd: 3, up: 1.5, life: 0.5, size: 0.25 });
    const rg = ring(0.3, 0.55, 0x6ff7e8, 0.9); rg.position.set(u.x, 0.05, u.z); C.scene.add(rg);
    G.fx.push({ t: 0.4, tick: q => { rg.scale.setScalar(1 + q * 3.6); rg.material.opacity = 0.9 * (1 - q); }, fn: () => C.scene.remove(rg) });
    const lr = rk(u, 'leap'); for (const h of hostilesOf(u)) { if (h.dead || Math.hypot(h.x - u.x, h.z - u.z) > 1.9 + 0.15 * lr + h.r) continue;
      damage(u, h, u.dmg * 1.3 * (1 + 0.2 * lr) * rand(0.9, 1.1), { knock: 3.2, fx: u.x, fz: u.z }); h.stun = Math.max(h.stun, 0.6); if (!h.dead) { h.target = u; h.aggro = true; } } }
  if (u.st >= u.t1 + 0.35) { u.state = 'recover'; u.st = 0.0; u.landed = false; u.y = 0; u.cdT = Math.max(u.cdT, 0.5); }
}
// 旋风斩: when surrounded, spin and hit everything around twice
function spinSkill(u) {
  const r = rk(u, 'spin'); if (u.kind !== 'brute' || !r || (u.spinCD || 0) > G.t || u.stun > 0) return false;
  let n = 0; for (const h of hostilesOf(u)) if (!h.dead && dist(u, h) < 1.9 + h.r) n++; if (n < 2) return false;
  u.state = 'spin'; u.st = 0; u.hits = 0; u.spinCD = G.t + 7 - r; u.wantX = u.wantZ = 0;
  play(u.mesh, '2H_Melee_Attack_Spin', { once: true, restart: true, speed: 2.1, fade: 0.06 }); u.animLock = clipLen('2H_Melee_Attack_Spin') / 2.1 * 0.9; say(u.x, u.z, '旋风斩！', '#8ff5ea', 14, 1.9); return true;
}
function updateSpin(u, dt) {
  u.st += dt; u.wantX = u.wantZ = 0; const r = rk(u, 'spin');
  if ((u.hits === 0 && u.st > 0.35) || (u.hits === 1 && u.st > 0.75)) { u.hits++; S.smash(); C.parts.emit(u.x, 0.5, u.z, 14, { col: 0x8ff5ea, spd: 3.5, up: 0.6, life: 0.35, size: 0.22, grav: 0 });
    for (const h of hostilesOf(u)) if (!h.dead && dist(u, h) < 2.0 + h.r) damage(u, h, u.dmg * (0.6 + 0.2 * r) * rand(0.9, 1.1), { knock: 1.6 }); }
  if (u.st > 1.1) { u.state = 'recover'; u.st = 0; }
}
// 突刺: a fast lunge into a stab that always crits
function startLunge(u, t, chained) {
  u.state = 'lunge'; u.st = 0; u.tgt = t; faceTo(u, t); u.face = u.faceT; u.wantX = u.wantZ = 0;
  if (!chained) { u.moveCD = 4 - 0.4 * rk(u, 'lunge'); u.chainLeft = rk(u, 'chain'); } else say(u.x, u.z, '连刺！', '#8ff5ea', 13, 1.6);
  play(u.mesh, 'Dodge_Forward', { once: true, restart: true, speed: 0.9, fade: 0.05 }); u.animLock = 0.3;
}
function updateLunge(u, dt) {
  const t = u.tgt; u.st += dt; if (!t || t.dead) { u.state = 'idle'; return; }
  const dx = t.x - u.x, dz = t.z - u.z, d = Math.hypot(dx, dz) || 1, reach = u.range + u.r + t.r;
  u.wantX = dx / d * 11; u.wantZ = dz / d * 11; u.vx = u.wantX; u.vz = u.wantZ; faceTo(u, t);
  if (Math.random() < 0.7) C.parts.emit(u.x, 0.5, u.z, 1, { col: 0x6ff7e8, spd: 0.3, up: 0.3, life: 0.35, size: 0.3, grav: 0 });
  if (d < reach || u.st > 0.45) { u.vx *= 0.2; u.vz *= 0.2; u.wantX = u.wantZ = 0; u.lungeHit = true; startWindup(u, t); u.wind = 0.1; attackAnim(u, 0.1); }
}
// ---------- per-frame unit update ----------
export function updateUnit(u, dt) {
  if (u.dead) return;
  u.flash = Math.max(0, u.flash - dt * 5); u.barT -= dt; u.cdT -= dt;
  if (u.spawnT > 0) { u.spawnT -= dt; u.wantX = u.wantZ = 0; return; }
  if (u.stun > 0 && u.state !== 'leap') { u.stun -= dt; u.wantX = u.wantZ = 0; if (u.tele) { C.scene.remove(u.tele); u.tele = null; } }
  else if (u.state === 'windup') { u.st += dt; u.wantX = u.wantZ = 0; if (u.tgt && !u.tgt.dead && u.kind !== 'brute') faceTo(u, u.tgt);
    if (u.tele) { const k = u.st / u.wind; u.tele.material.opacity = 0.15 + 0.45 * k; u.tele.position.set(u.x, 0.04, u.z); }
    if (u.st >= u.wind) strike(u); }
  else if (u.state === 'recover') { u.st += dt; u.wantX = u.wantZ = 0; if (u.chainNext && u.st > 0.1) { const n = u.chainNext; u.chainNext = null; if (!n.dead) { startLunge(u, n, true); return; } } if (u.st > 0.22) u.state = 'idle'; }
  else if (u.state === 'spin') updateSpin(u, dt);
  else if (u.state === 'leap') updateLeap(u, dt);
  else if (u.state === 'lunge') updateLunge(u, dt);
  else if (u.state === 'cast') { u.st += dt; u.wantX = u.wantZ = 0;
    if (u.castC) { if (!G.corpses.includes(u.castC)) { u.state = 'idle'; u.castC = null; } else { if (Math.random() < 0.5) C.parts.emit(u.castC.x, 0.3, u.castC.z, 1, { col: 0xc070ff, spd: 0.5, up: 2, life: 0.6, grav: -1 });
      if (u.st > 1.0) { resurrect(u, u.castC); u.castC = null; u.state = 'recover'; u.st = 0; u.resCD = rand(5, 7); } } }
    else if (u.castH) { if (u.st > 0.5) { const f = u.castH; u.castH = null; u.state = 'recover'; u.st = 0;
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
  const n = new Unit(c.kind, 'enemy', c.x, c.z, { level: c.level, mods: c.mods, champ: c.champ, packId: c.packId, hpFrac: 0.6 }); n.aggro = true; n.target = by.target; G.units.push(n);
  n.face = c.mesh.root.rotation.y; rise(n, 'Death_C_Skeletons_Resurrect', 1.4);
  S.raise(); C.parts.emit(c.x, 0.5, c.z, 24, { col: 0xc070ff, spd: 1.4, up: 2.5, life: 0.8 }); say(c.x, c.z, '复活了！', '#c88cff', 16);
}
// movement, separation, walls, visuals
let frame = 0, camX = 0, camZ = 0;
export function integrate(units, dt) {
  const F = C.floor; frame++; if (G.player) { camX = G.player.x; camZ = G.player.z; }
  for (const u of units) { if (u.dead) continue; const a = Math.min(1, dt * 10); u.vx += (u.wantX - u.vx) * a; u.vz += (u.wantZ - u.vz) * a; }
  for (let i = 0; i < units.length; i++) { const a = units[i]; if (a.dead || a.state === 'leap') continue;
    for (let j = i + 1; j < units.length; j++) { const b = units[j]; if (b.dead || b.state === 'leap') continue; const dx = b.x - a.x, dz = b.z - a.z, rr = (a.r + b.r) * (a.side !== 'enemy' && b.side !== 'enemy' ? 0.45 : 1); if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      const d = Math.hypot(dx, dz); if (d >= rr || d < 1e-5) continue; const push = (rr - d) * 0.5, nx = dx / d, nz = dz / d;
      const wa = a.kind === 'player' ? 0.3 : a.kind === 'brute' ? 0.6 : 1, wb = b.kind === 'player' ? 0.3 : b.kind === 'brute' ? 0.6 : 1, sw = wa + wb;
      a.x -= nx * push * 2 * wa / sw; a.z -= nz * push * 2 * wa / sw; b.x += nx * push * 2 * wb / sw; b.z += nz * push * 2 * wb / sw; } }
  for (const u of units) { if (u.dead) continue;
    u.x += (u.vx + u.kx) * dt; u.z += (u.vz + u.kz) * dt; const kd = Math.exp(-dt * 7); u.kx *= kd; u.kz *= kd; F.collide(u);
    const sp = Math.hypot(u.vx, u.vz); if (sp > 0.4 && u.state !== 'windup' && u.state !== 'leap') u.faceT = Math.atan2(u.vx, u.vz);
    if (u.faceT != null) { let d = u.faceT - u.face; d = ((d + Math.PI * 3) % TAU) - Math.PI; u.face += d * Math.min(1, dt * 14); }
    const m = u.mesh; m.root.position.set(u.x, u.y || 0, u.z); m.root.rotation.y = u.face;
    animate(u, dt, sp); m.u.uFlash.value = u.flash * 0.7; if (u.ringMesh) u.ringMesh.rotation.y += dt;
    // animation level of detail: far units update their skeleton every other frame
    u.mixAcc += dt; if (Math.hypot(u.x - camX, u.z - camZ) > 13 && (frame + u.id) % 2) continue; m.mixer.update(u.mixAcc); u.mixAcc = 0;
  }
}
export function updateCorpses(dt) {
  let j = 0;
  for (const c of G.corpses) { c.t -= dt; if (c.animT > 0) { c.animT -= dt; c.mesh.mixer.update(dt); }
    if (c.t < 3) c.mesh.u.uFade.value = Math.max(0, c.t / 3);
    if (c.t <= 0) { C.scene.remove(c.mesh.root); continue; } G.corpses[j++] = c; }
  G.corpses.length = j;
}

// ---------- animation ----------
export const ANIM = {
  player: { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', atk: ['Spellcast_Shoot'], cast: 'Spellcasting', hit: 'Hit_A', die: 'Death_A', runAt: 2.2 },
  imp:    { idle: 'Idle_Combat', walk: 'Walking_D_Skeletons', run: 'Running_A', atk: ['1H_Melee_Attack_Stab', '1H_Melee_Attack_Chop'], hit: 'Hit_B', die: 'Death_C_Skeletons', runAt: 2.4 },
  brute:  { idle: 'Idle_Combat', walk: 'Walking_A', run: 'Running_B', atk: ['2H_Melee_Attack_Chop'], hit: 'Hit_A', die: 'Death_C_Skeletons', runAt: 3.2 },
  archer: { idle: 'Idle_Combat', walk: 'Walking_A', run: 'Running_A', atk: ['1H_Ranged_Shoot'], hit: 'Hit_B', die: 'Death_C_Skeletons', runAt: 2.0 },
  shaman: { idle: 'Idle', walk: 'Walking_D_Skeletons', run: 'Running_A', atk: ['Spellcast_Shoot'], cast: 'Spellcast_Summon', hit: 'Hit_A', die: 'Death_C_Skeletons', runAt: 2.6 },
};
// fraction of each attack clip at which the blow lands (used to line the swing up with the windup)
const HIT_AT = { '1H_Melee_Attack_Stab': 0.38, '1H_Melee_Attack_Chop': 0.42, '2H_Melee_Attack_Chop': 0.45, '1H_Ranged_Shoot': 0.35, Spellcast_Shoot: 0.4 };
// stride references (world units per second at model scale 0.5)
const REF = { Walking_A: 1.35, Walking_D_Skeletons: 1.2, Running_A: 3.6, Running_B: 3.4 };
export function attackAnim(u, wind) {
  const list = ANIM[u.kind].atk, name = list[Math.floor(Math.random() * list.length)], len = clipLen(name), sp = Math.max(0.7, Math.min(3.2, len * (HIT_AT[name] ?? 0.4) / Math.max(0.05, wind)));
  play(u.mesh, name, { once: true, restart: true, speed: sp, fade: 0.08 }); u.animLock = len / sp * 0.85;
}
export function playerAnim(u, kind) {
  if (kind === 'shoot') { play(u.mesh, 'Spellcast_Shoot', { once: true, restart: true, speed: 2.6, fade: 0.06 }); u.animLock = 0.32; }
  else if (kind === 'mend') { play(u.mesh, 'Spellcast_Raise', { once: true, restart: true, speed: 1.6, fade: 0.08 }); u.animLock = clipLen('Spellcast_Raise') / 1.6 * 0.8; }
  else if (kind === 'revive') { play(u.mesh, 'Idle', { restart: true, fade: 0 }); u.animLock = 0; }
}
function rise(u, name, sp) { play(u.mesh, name, { once: true, restart: true, speed: sp, fade: 0 }); u.spawnT = clipLen(name) / sp * 0.92; u.animLock = u.spawnT; u.mesh.mixer.update(0); }
function animate(u, dt, sp) {
  const m = u.mesh, a = ANIM[u.kind];
  if (u.spawnT > 0) return;
  if (u.animLock > 0) { u.animLock -= dt; if (sp < 0.6 || u.state === 'windup' || u.state === 'recover' || u.state === 'leap' || u.state === 'lunge') return; }
  if (u.state === 'leap') return;
  if (u.stun > 0) { if (!u.stunAnim) { u.stunAnim = true; play(m, a.hit, { once: true, restart: true, speed: 1.5, fade: 0.05 }); } return; }
  u.stunAnim = false;
  if (u.state === 'cast' || u.state === 'channel') { play(m, a.cast || 'Spellcasting', { speed: 1.2 }); return; }
  const k = CHARS[u.kind].scale * (u.champ ? 1.25 : 1) / 0.5;
  if (sp > 0.35) { const run = sp > a.runAt || u.state === 'panic', name = run ? a.run : a.walk; play(m, name, { speed: Math.max(0.55, Math.min(1.8, sp / (REF[name] * k))), fade: 0.18 }); }
  else play(m, a.idle, { fade: 0.22 });
}
