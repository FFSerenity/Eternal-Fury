// Units, combat, monster / minion AI, corpses and capturing
import * as THREE from 'three';
import { G, save } from './state.js';
import { TYPES, MODS, SKILLS, xpNeed, partySize } from './data.js';
import { makeUnitMesh, glowSprite, ring, toonMat, part, merge } from './gfx.js';
import { S } from './audio.js';

export const C = { scene: null, parts: null, floor: null, say: () => {} };
const rand = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2, tmp = { x: 0, z: 0 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
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
      scale: (kind === 'player' ? 1 : 1) * (champ ? 1.25 : 1),
      tint: this.mods.includes('stone') ? 0xb8b4ac : 0xffffff,
      emis: ally ? 0x0e2a2c : 0x000000,
      outline: ally ? 0x2fd6c6 : champ && mod0 ? mod0.col : 0x120a10, outlineW: ally || champ ? 0.06 : 0.045,
    });
    this.mesh.root.position.set(x, 0, z); C.scene.add(this.mesh.root);
    if (ally) { const rg = ring(0.42, 0.55, 0x3fe0d0, 0.5); rg.position.y = 0.03; this.mesh.root.add(rg); this.ringMesh = rg; }
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
    this.taunt = ally && this.kind === 'brute';
  }
  remove() { C.scene.remove(this.mesh.root); }
}

export const hostilesOf = u => u.side === 'enemy' ? G.friends : G.enemies;
export function say(x, z, text, col = '#fff', size = 15, y = 1.7) { G.msgs.push({ x, y, z, text, col, size, t: 0, max: 1.0 }); }

// ---------- damage / death ----------
export function damage(src, dst, amt, o = {}) {
  if (!dst || dst.dead) return 0;
  let d = Math.max(1, amt * (1 - dst.armor / (dst.armor + 60))); if (o.crit) d *= 2;
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
    u.respawnT = 2.5; u.state = 'dead'; C.say('你倒下了……', true);
  }
}
function fadeOut(u) { G.fx.push({ t: 0.8, tick: (k) => { u.mesh.mat.uniforms.uFade.value = 1 - k; u.mesh.out.material.uniforms.uFade.value = 1 - k; u.mesh.pivot.rotation.x = -k * 1.3; }, fn: () => u.remove() }); }
function fireBlast(u) {
  S.boom(); C.parts.emit(u.x, 0.4, u.z, 40, { col: 0xff8a2a, spd: 5, up: 2, life: 0.7, size: 0.35 });
  const rg = ring(0.2, 0.5, 0xff7a20, 0.9); rg.position.set(u.x, 0.05, u.z); C.scene.add(rg);
  G.fx.push({ t: 0.45, tick: k => { rg.scale.setScalar(1 + k * 5); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) });
  for (const h of (u.side === 'enemy' ? G.friends : G.enemies)) if (!h.dead && dist(h, u) < 2.4) damage(u, h, u.dmg * 1.6, { knock: 3, fx: u.x, fz: u.z });
}
function panic(e, from) { if (e.state === 'panic') return; e.state = 'panic'; e.st = 0; e.panicDur = rand(1.3, 2.4); e.panicX = from.x; e.panicZ = from.z; S.squeal(); say(e.x, e.z, '!!', '#ffd34d', 18, 1.5); }

// ---------- corpses & capturing ----------
function makeCorpse(u) {
  const m = u.mesh; m.mat.uniforms.uTint.value.multiplyScalar(0.55); m.mat.uniforms.uFlash.value = 0; if (u.ringMesh) m.root.remove(u.ringMesh);
  const c = { kind: u.kind, level: u.level, mods: u.mods.slice(), champ: u.champ, x: u.x, z: u.z, t: 30, mesh: m, packId: u.packId, fall: 0 };
  m.pivot.position.y = 0; G.corpses.push(c);
}
export function captureChance(c) { return Math.max(0.05, Math.min(0.95, TYPES[c.kind].capture * (c.champ ? 0.5 : 1) * (1 + 0.05 * (G.level - 1)) - 0.03 * Math.max(0, c.level - G.level))); }
export function removeCorpse(c) { const i = G.corpses.indexOf(c); if (i >= 0) G.corpses.splice(i, 1); C.scene.remove(c.mesh.root); }
export function finishRaise(c) {
  if (!G.corpses.includes(c)) return;
  const ok = Math.random() < captureChance(c); removeCorpse(c);
  if (ok) {
    const en = { id: G.uid++, type: c.kind, level: c.level, xp: 0, mods: c.mods, champ: c.champ, active: false, reviveT: 0, unit: null };
    G.crypt.push(en); const room = activeCount() < partySize(G.level);
    if (room) { en.active = true; spawnAlly(en, c.x, c.z); }
    S.caught(); C.parts.emit(c.x, 0.5, c.z, 30, { col: 0x6ff7e8, spd: 1.5, up: 3, life: 1.0, size: 0.3, grav: -1 });
    C.say(`收服了 ${(c.champ ? MODS[c.mods[0]].name : '') + TYPES[c.kind].name}！` + (room ? '' : '（已放入墓典）')); save();
  } else { S.fail(); C.parts.emit(c.x, 0.3, c.z, 24, { col: 0x8a8090, spd: 1.2, up: 1.2, life: 0.9, size: 0.3 }); say(c.x, c.z, '唤魂失败', '#b9a8c8', 16); }
}
export const activeCount = () => G.crypt.filter(e => e.active).length;
export function spawnAlly(en, x, z) {
  const P = G.player; if (x == null) { const a = rand(0, TAU); x = P.x + Math.cos(a) * 1.4; z = P.z + Math.sin(a) * 1.4; if (!C.floor.walk(x, z)) { x = P.x; z = P.z; } }
  const u = new Unit(en.type, 'ally', x, z, { level: en.level, mods: en.mods, champ: en.champ, entry: en }); en.unit = u; G.units.push(u);
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
  const dx = tx - src.x, dz = tz - src.z, d = Math.hypot(dx, dz) || 1, sp = kind === 'spear' ? 16 : kind === 'arrow' ? 12 : 8.5;
  const s = { kind, src, side: src.side === 'enemy' ? 'enemy' : 'friend', x: src.x + dx / d * 0.4, z: src.z + dz / d * 0.4, y: kind === 'fire' ? 0.9 : 0.85, vx: dx / d * sp, vz: dz / d * sp,
    dmg: o.dmg ?? src.dmg, life: o.life ?? 1.1, hit: new Set(), root: new THREE.Group() };
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
        damage(s.src, u, s.dmg * rand(0.85, 1.15), { knock: s.kind === 'spear' ? 1.2 : 0 }); if (s.kind === 'spear') C.parts.emit(s.x, s.y, s.z, 5, { col: 0xe8e0d0, spd: 2, life: 0.3, size: 0.15 }); else { dead = true; break; } } }
    if (dead) { if (s.kind === 'fire') { S.boom(); C.parts.emit(s.x, 0.5, s.z, 22, { col: 0xff8a2a, spd: 3, up: 2, life: 0.5, size: 0.3 });
        for (const u of (s.side === 'enemy' ? G.friends : G.enemies)) if (!u.dead && Math.hypot(u.x - s.x, u.z - s.z) < 1.4 + u.r) damage(s.src, u, s.dmg, { knock: 1.5, fx: s.x, fz: s.z }); }
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
function startWindup(u, t) { u.state = 'windup'; u.st = 0; u.wind = u.T.windup * (u.mods.includes('fast') ? 0.7 : 1); u.tgt = t; faceTo(u, t);
  if (u.kind === 'brute') { const rg = ring(0.2, u.range + u.r + 0.3, u.side === 'enemy' ? 0xff3a2a : 0x3fe0d0, 0.0); rg.position.set(u.x, 0.04, u.z); C.scene.add(rg); u.tele = rg; } }
function strike(u) {
  const t = u.tgt; u.state = 'recover'; u.st = 0; u.cdT = u.cd * rand(0.9, 1.15); if (u.tele) { C.scene.remove(u.tele); u.tele = null; }
  if (!t || t.dead) return;
  if (u.kind === 'brute') { S.smash(); C.parts.emit(u.x + Math.sin(u.face) * 0.8, 0.2, u.z + Math.cos(u.face) * 0.8, 16, { col: 0xb8a890, spd: 3, up: 1.5, life: 0.5, size: 0.3 });
    for (const h of hostilesOf(u)) { if (h.dead) continue; const d = dist(u, h); if (d > u.range + u.r + h.r + 0.35) continue;
      const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % TAU) - Math.PI); if (da < 1.1 || d < 0.9) damage(u, h, u.dmg * rand(0.9, 1.1), { knock: 4 }); } }
  else if (u.kind === 'imp') { if (dist(u, t) < (u.range + u.r + t.r) * 1.35) damage(u, t, u.dmg * rand(0.85, 1.15), { crit: u.side === 'ally' && Math.random() < 0.15 }); }
  else if (u.kind === 'archer') { const lead = Math.min(0.5, dist(u, t) / 12); shoot(u, 'arrow', t.x + (t.vx || 0) * lead, t.z + (t.vz || 0) * lead, { life: 0.9 }); }
  else if (u.kind === 'shaman') shoot(u, 'fire', t.x, t.z, { life: 1.1 });
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
      let s = d; if (h.taunt && d < 5) s -= 3.5; if (h.kind === 'player') s -= 0.6; if (h === u.target) s -= 1.2; if (s < bs) { bs = s; best = h; } }
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
function allyThink(u, dt) {
  const P = G.player; if (P.dead) { u.wantX = u.wantZ = 0; return; }
  const dp = dist(u, P);
  if (dp > 20 || (dp > 9 && !C.floor.los(u.x, u.z, P.x, P.z) && u.state === 'idle' && Math.random() < dt * 0.5)) { // catch up
    const a = rand(0, TAU); u.x = P.x + Math.cos(a) * 1.2; u.z = P.z + Math.sin(a) * 1.2; if (!C.floor.walk(u.x, u.z)) { u.x = P.x; u.z = P.z; } u.target = null;
    C.parts.emit(u.x, 0.5, u.z, 10, { col: 0x6ff7e8, spd: 1, up: 2, life: 0.5 }); return; }
  u.scanT -= dt;
  if (u.scanT <= 0) { u.scanT = 0.3; let t = null;
    if (G.focus && !G.focus.dead && dist(G.focus, P) < 13) t = G.focus;
    else { let bd = 1e9; for (const e of G.enemies) { if (e.dead) continue; const de = dist(e, P); if (de > 10) continue; if (!(e.aggro || de < 7)) continue; if (!C.floor.los(P.x, P.z, e.x, e.z) && !C.floor.los(u.x, u.z, e.x, e.z)) continue;
      const s = dist(e, u) + de * 0.5; if (s < bd) { bd = s; t = e; } } }
    u.target = t; }
  if (u.target && (u.target.dead || dist(u.target, P) > 14)) u.target = null;
  if (u.kind === 'shaman') { u.healCD -= dt;
    if (u.healCD <= 0) { let lo = null, lr = 0.75; for (const f of G.friends) { if (f.dead || dist(f, u) > 8) continue; const r = f.hp / f.maxHp; if (r < lr) { lr = r; lo = f; } }
      if (lo) { u.state = 'cast'; u.st = 0; u.castH = lo; u.wantX = u.wantZ = 0; faceTo(u, lo); u.healCD = 3.5; return; } u.healCD = 0.6; } }
  if (!u.target || dp > 13) { // follow in a loose formation behind the summoner
    const allies = G.friends.filter(f => f.side === 'ally'), idx = allies.indexOf(u), n = allies.length;
    const ang = P.face + Math.PI + (idx - (n - 1) / 2) * 0.75, tx = P.x + Math.sin(ang) * 1.9, tz = P.z + Math.cos(ang) * 1.9, d = Math.hypot(tx - u.x, tz - u.z);
    if (d > 0.5) seek(u, tx, tz, u.speed * Math.min(1.25, 0.35 + d / 2.5)); else { u.wantX = u.wantZ = 0; }
    return; }
  const t = u.target;
  if (u.kind === 'brute' || u.kind === 'imp') meleeLogic(u, t);
  else if (u.kind === 'archer') rangedLogic(u, t, dt, 3.5, 6.5);
  else rangedLogic(u, t, dt, 4.5, 7);
}

// ---------- per-frame unit update ----------
export function updateUnit(u, dt) {
  if (u.dead) return;
  u.flash = Math.max(0, u.flash - dt * 5); u.barT -= dt; u.cdT -= dt;
  if (u.stun > 0) { u.stun -= dt; u.wantX = u.wantZ = 0; if (u.tele) { C.scene.remove(u.tele); u.tele = null; } }
  else if (u.state === 'windup') { u.st += dt; u.wantX = u.wantZ = 0; if (u.tgt && !u.tgt.dead && u.kind !== 'brute') faceTo(u, u.tgt);
    if (u.tele) { const k = u.st / u.wind; u.tele.material.opacity = 0.15 + 0.45 * k; u.tele.position.set(u.x, 0.04, u.z); }
    if (u.st >= u.wind) strike(u); }
  else if (u.state === 'recover') { u.st += dt; u.wantX = u.wantZ = 0; if (u.st > 0.22) u.state = 'idle'; }
  else if (u.state === 'cast') { u.st += dt; u.wantX = u.wantZ = 0;
    if (u.castC) { if (!G.corpses.includes(u.castC)) { u.state = 'idle'; u.castC = null; } else { if (Math.random() < 0.5) C.parts.emit(u.castC.x, 0.3, u.castC.z, 1, { col: 0xc070ff, spd: 0.5, up: 2, life: 0.6, grav: -1 });
      if (u.st > 1.0) { resurrect(u, u.castC); u.castC = null; u.state = 'recover'; u.st = 0; u.resCD = rand(5, 7); } } }
    else if (u.castH) { if (u.st > 0.5) { const f = u.castH; u.castH = null; u.state = 'recover'; u.st = 0;
      if (!f.dead) { const h = f.maxHp * 0.18 + 3 * u.level; f.hp = Math.min(f.maxHp, f.hp + h); say(f.x, f.z, '+' + Math.round(h), '#7dff9a', 15); S.heal();
        C.parts.emit(f.x, 0.6, f.z, 14, { col: 0x7dff9a, spd: 0.8, up: 2.5, life: 0.8, grav: -1 }); } } }
    else u.state = 'idle'; }
  else if (u.side === 'enemy') enemyThink(u, dt);
  else if (u.side === 'ally') allyThink(u, dt);
}
function resurrect(by, c) {
  if (!G.corpses.includes(c)) return; removeCorpse(c);
  const n = new Unit(c.kind, 'enemy', c.x, c.z, { level: c.level, mods: c.mods, champ: c.champ, packId: c.packId, hpFrac: 0.6 }); n.aggro = true; n.target = by.target; n.stun = 0.4; G.units.push(n);
  S.raise(); C.parts.emit(c.x, 0.5, c.z, 24, { col: 0xc070ff, spd: 1.4, up: 2.5, life: 0.8 }); say(c.x, c.z, '复活了！', '#c88cff', 16);
}
// movement, separation, walls, visuals
export function integrate(units, dt) {
  const F = C.floor;
  for (const u of units) { if (u.dead) continue; const a = Math.min(1, dt * 10); u.vx += (u.wantX - u.vx) * a; u.vz += (u.wantZ - u.vz) * a; }
  for (let i = 0; i < units.length; i++) { const a = units[i]; if (a.dead) continue;
    for (let j = i + 1; j < units.length; j++) { const b = units[j]; if (b.dead) continue; const dx = b.x - a.x, dz = b.z - a.z, rr = a.r + b.r; if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      const d = Math.hypot(dx, dz); if (d >= rr || d < 1e-5) continue; const push = (rr - d) * 0.5, nx = dx / d, nz = dz / d;
      const wa = a.kind === 'player' ? 0.3 : a.kind === 'brute' ? 0.6 : 1, wb = b.kind === 'player' ? 0.3 : b.kind === 'brute' ? 0.6 : 1, sw = wa + wb;
      a.x -= nx * push * 2 * wa / sw; a.z -= nz * push * 2 * wa / sw; b.x += nx * push * 2 * wb / sw; b.z += nz * push * 2 * wb / sw; } }
  for (const u of units) { if (u.dead) continue;
    u.x += (u.vx + u.kx) * dt; u.z += (u.vz + u.kz) * dt; const kd = Math.exp(-dt * 7); u.kx *= kd; u.kz *= kd; F.collide(u);
    const sp = Math.hypot(u.vx, u.vz); if (sp > 0.4 && u.state !== 'windup') u.faceT = Math.atan2(u.vx, u.vz);
    if (u.faceT != null) { let d = u.faceT - u.face; d = ((d + Math.PI * 3) % TAU) - Math.PI; u.face += d * Math.min(1, dt * 14); }
    // pose
    const m = u.mesh; m.root.position.set(u.x, 0, u.z); m.root.rotation.y = u.face; u.walkPh += dt * sp * 3.2;
    let lean = 0, hop = Math.abs(Math.sin(u.walkPh)) * Math.min(1, sp / 2) * 0.09, sq = 1, rz = Math.sin(u.walkPh) * Math.min(1, sp / 2) * 0.06;
    if (u.state === 'windup') { const k = Math.min(1, u.st / (u.wind || 0.3)); lean = -0.32 * k; sq = 1 - 0.08 * k; }
    else if (u.state === 'recover') lean = 0.38 * Math.max(0, 1 - u.st / 0.22);
    else if (u.state === 'cast') { hop = 0.05 + Math.sin(G.t * 12) * 0.03; }
    else if (u.state === 'panic') { rz = Math.sin(G.t * 30) * 0.15; }
    else if (u.state === 'channel') { hop = 0.04; }
    if (u.stun > 0) rz = Math.sin(G.t * 40) * 0.12;
    m.pivot.rotation.set(lean, 0, rz); m.pivot.position.y = hop; m.pivot.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    m.mat.uniforms.uFlash.value = u.flash * 0.75; if (u.ringMesh) u.ringMesh.rotation.y += dt;
  }
}
export function updateCorpses(dt) {
  let j = 0;
  for (const c of G.corpses) { c.t -= dt; c.fall = Math.min(1, c.fall + dt * 4); const p = c.mesh.pivot; p.rotation.set(-1.45 * c.fall, 0, 0); p.position.y = 0.15 * c.fall; p.scale.set(1, 1, 1);
    if (c.t < 3) { const k = Math.max(0, c.t / 3); c.mesh.mat.uniforms.uFade.value = k; c.mesh.out.material.uniforms.uFade.value = k; }
    if (c.t <= 0) { C.scene.remove(c.mesh.root); continue; } G.corpses[j++] = c; }
  G.corpses.length = j;
}
