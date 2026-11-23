// 魂契: the Bone Sentinel's own skills, one at each crest tier (5 / 10 / 15 / 20 战魂 stacks, lost with them when it falls). It uses them by itself (PH.skillAI is
// asked first in its melee thinking); each runs as the 'pskill' state (PH.skillTick), on the style's own Mixamo clips.
import * as THREE from 'three';
import { G } from './state.js';
import { tr } from './i18n.js';
import { C, PH, say, damage, hostilesOf } from './units.js';
import { A, play, heroPart } from './assets.js';
import { ring, glowSprite } from './gfx.js';
import { burst, shake, trail, slamMark } from './fx.js';
import { S } from './audio.js';
import { bladeFire, roarBurst, qiWaves, QI, fireCone, fireArc, qiBolt, qiFan, swipeUp } from './pactfx.js';

export const SKILLS = [
  { id: 'charge', at: 5, cd: 8, icon: '⚡', name: tr('冲锋', 'Charge'),
    desc: tr('目标在 3.5–8 米外时突进：剑盾压低身形举盾冲撞，撞开路上的敌人，冲到面前一记盾击把目标击倒；大剑跃起跳劈，落地裂地范围伤害', 'Closes on a target 3.5–8 m away: sword & shield drives in low behind the shield, barging aside what is in the way, and ends with a shield bash that knocks the target down; the greatsword leaps and splits the ground where it lands') },
  { id: 'guard', at: 10, passive: true, icon: '🛡️', name: tr('格挡 / 招架', 'Block / Parry'),
    desc: tr('被动：正面挨打时，剑盾 30% 几率格挡（伤害 −80%，箭和火球整个挡下），大剑 25% 几率招架（伤害 −60%），随即在普攻之间插入一次反击——剑盾举盾后直劈，剑气直线飞出约 10 米，挡下的若是飞矢就直取放箭的人；大剑架住后 180° 横扫，剑气扇面扩散约 4.5 米',
      'Passive: hit from the front, sword & shield blocks 30% of the time (−80% damage, arrows and fireballs stopped whole), the greatsword parries 25% (−60%); then it slips a counter in between its swings — sword & shield cuts down from behind the shield and the sword qi flies ~10 m straight (at the shooter, if it stopped a missile); the greatsword sweeps 180° and its qi fans out ~4.5 m') },
  { id: 'whirl', at: 15, cd: 10, icon: '🌀', name: tr('旋风斩', 'Whirlwind'),
    desc: tr('身边 2.5 米内有 3 个以上敌人时转身横扫，打两段，每段向四周甩出剑气（远处的敌人也会被剑气划伤）', 'With 3+ enemies within 2.5 m, spins and cuts everything around it, twice, flinging sword qi out in every direction (it cuts what it meets further out too)') },
  { id: 'sunder', at: 20, cd: 15, icon: '💥', name: tr('破军一击', 'Sundering Strike'),
    desc: tr('蓄力后挥出燃火的一击：剑盾怒吼爆气、直劈，火浪沿前方扇形扫出；大剑为剑注火、270° 横扫，火浪向四周扩散；非精英敌人血量低于 25% 直接斩杀', 'Gathers itself, then a burning blow: sword & shield roars and cuts down, sending a wave of fire down a cone; the greatsword fills its blade with fire and sweeps 270°, fire rolling out all round; non-elite enemies left under 25% life are cut down') },
];
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const skillsAt = L => SKILLS.filter(s => L >= s.at);
// per style: clip, play speed, the clip fractions where things happen (measured like the swings: blade closest to a body in front)
const MOVES = {
  // the shield bash: from the low guard the shield is fanned straight up overhead — a blend from the guard pose to SNS_Combo's frame with the
  // shield held high (0.43), the shield sweeping up through the front on the way
  SNS: { charge: { shield: true, pose: 'SNS_Block', brace: 0.22, dash: 0.9, speed: 12, mult: 1.6, stun: 1.4, up: 'SNS_Combo', upAt: 0.43, upT: 0.2, upHit: 0.12, upHold: 0.32 },
    guard: { chance: 0.3, keep: 0.2, missiles: true, word: tr('格挡', 'Block'), pose: 'SNS_Block', poseT: 0.22, clip: 'SNS_Atk2', at: 0, hit: 0.41, mult: 1.1 },
    whirl: { clip: 'SNS_Combo', sp: 1.8, hits: [0.21, 0.74], mult: 1 },
    sunder: { pre: 'SNS_Power', preSp: 1.5, preT: 1.15, roarAt: 0.42, ignite: 0.55, full: 0.85, clip: 'SNS_Atk2', at: 0, hit: 0.41, mult: 3 } }, // the roar, then the blade catches fire
  GS: { charge: { clip: 'GS_Leap', sp: 1.1, at: 0.1, up: 0.3, land: 0.53, end: 0.8, mult: 1.5, stun: 0.9, aoe: 2.6 },
    guard: { chance: 0.25, keep: 0.4, word: tr('招架', 'Parry'), pose: 'GS_Block', poseT: 0.2, clip: 'GS_Spin', at: 0.12, hit: 0.3, mult: 1.1, fan: true },
    whirl: { clip: 'GS_Spin', sp: 1.2, hits: [0.35, 0.61], mult: 1.2 },
    sunder: { pre: 'GS_Power', preSp: 2, preT: 1.1, ignite: 0.1, full: 0.95, clip: 'GS_Combo', at: 0.56, hit: 0.72, mult: 3.5, sweep: 2.36 } }, // fire climbs the blade from the hilt; then the 270° sweep (GS_Combo)
};
const CONE = { range: 5.5, half: 0.66 }, BOLT = { range: 10, speed: 16 }, FAN = 4.5;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const faceAt = (u, t, snap) => { if (!t) return; u.faceT = Math.atan2(t.x - u.x, t.z - u.z); if (snap) u.face = u.faceT; };
const clipDur = n => (A.heroClips[n] ? A.heroClips[n].duration : 1);
const styleOf = u => (u.entry && u.entry.wset === 'GS' ? 'GS' : 'SNS');
const colOf = u => (u.mesh.blade ? u.mesh.blade.col : 0xbfe6ff);
const stunHit = (h, t) => { if (h.dead || h.noStun) return; h.stun = Math.max(h.stun || 0, t); if (h.state === 'windup' || h.state === 'cast') h.state = 'idle'; };
function shock(x, z, col, r, t = 0.5, w = 0.5) { const rg = ring(0.2, w, col, 0.9); rg.position.set(x, 0.05, z); C.scene.add(rg);
  G.fx.push({ clean: true, t, tick: k => { rg.scale.setScalar(1 + k * r * 2); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) }); }
const inArc = (u, h, half) => { const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return da <= half; };
const coneOf = u => hostilesOf(u).filter(h => !h.dead && dist(h, u) < CONE.range + h.r && inArc(u, h, CONE.half));

function start(u, id, t) {
  const st = styleOf(u), mv = MOVES[st][id]; u.skCD = u.skCD || {}; u.skCD[id] = G.t + SK[id].cd;
  u.state = 'pskill'; u.st = 0; u.wantX = u.wantZ = 0; u.sk = { id, mv, st, t: 0, tgt: t, hits: 0 }; faceAt(u, t, true);
  say(u.x, u.z, SK[id].name, '#' + colOf(u).toString(16).padStart(6, '0'), 16, 2.2);
  if (id === 'charge' && mv.shield) { // dropped low behind the shield (the guard stance) and driven straight in
    play(u.mesh, mv.pose, { restart: true, fade: 0.12 }); u.sk.hit = new Set(); S.clank(); }
  else if (id === 'charge') { // the leap: a long arc over to the target, the ground splits where it lands
    const L = clipDur(mv.clip), k = Math.max(0, dist(u, t) - (u.r + t.r + 0.3)) / (dist(u, t) || 1); play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.06, at: mv.at });
    Object.assign(u.sk, { tUp: (mv.up - mv.at) * L / mv.sp, tLand: (mv.land - mv.at) * L / mv.sp, tEnd: (mv.end - mv.at) * L / mv.sp, x0: u.x, z0: u.z, x1: u.x + (t.x - u.x) * k, z1: u.z + (t.z - u.z) * k, lh: 0.3 + dist(u, t) * 0.08 });
    trail(u, u.sk.tEnd); S.swoosh(true, u.sk.tLand - 0.03, 0.3); }
  else if (id === 'whirl') { play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.08 }); trail(u, clipDur(mv.clip) / mv.sp);
    for (const h of mv.hits) S.swoosh(st === 'GS', h * clipDur(mv.clip) / mv.sp - 0.02); }
  else if (id === 'sunder') { play(u.mesh, mv.pre, { once: true, restart: true, speed: mv.preSp, fade: 0.1 }); u.sk.col0 = u.mesh.blade && u.mesh.blade.col; }
  return true;
}
function end(u) { const sk = u.sk, m = u.mesh; if (sk && sk.upA && m.curU === sk.upA) { sk.upA.fadeOut(0.15); m.curU = null; m.curUName = ''; }
  if (sk && sk.fire) { sk.fire.stop(); if (m.blade && sk.col0 != null) m.blade.col = sk.col0; }
  u.state = 'idle'; u.sk = null; u.y = 0; u.cdT = Math.max(u.cdT, 0.25); }

// ---------- when to use what ----------
PH.skillAI = (u, t) => {
  if (u.state !== 'idle' || !u.entry) return false;
  const L = u.fury || 0, cd = u.skCD || {}, has = id => L >= SK[id].at && !(cd[id] > G.t); // unlocked by its 战魂 stacks
  if (u.ctrQ && PH.counterAI(u)) return true; // a block or parry earned a counter: it goes in first
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 2.6 + h.r);
  if (near.length >= 3 && has('whirl')) return start(u, 'whirl', t || near[0]);
  if (!t || t.dead) return false;
  const d = dist(u, t);
  if (has('sunder') && d < u.range + u.r + t.r + 1.2) { faceAt(u, t, true); const n = coneOf(u).length; if (n >= 2 || t.champ || t.maxHp > u.dmg * 3) return start(u, 'sunder', t); }
  if (has('charge') && d > 3.5 && d < 8 && C.floor.clear(u.x, u.z, t.x, t.z, u.r + 0.1)) return start(u, 'charge', t);
  return false;
};

// ---------- running one ----------
PH.skillTick = (u, dt) => {
  const sk = u.sk; if (!sk) { end(u); return; }
  sk.t += dt; u.wantX = u.wantZ = 0; const mv = sk.mv, t = sk.tgt && !sk.tgt.dead ? sk.tgt : null;
  if (sk.id === 'charge' && mv.shield) { // shield charge: brace, then drive in, barging aside whatever is in the way
    if (!sk.hits) { if (t) faceAt(u, t);
      if (sk.t >= mv.brace) { const stop = t ? u.r + t.r + 0.3 : 0, d = t ? dist(u, t) : 0;
        if (!sk.rush) { sk.rush = true; S.rush(Math.min(mv.dash, Math.max(0.2, (d - stop) / mv.speed)) + 0.15); }
        if (!t || d <= stop + 0.05 || sk.t > mv.brace + mv.dash) { sk.hits = 1; sk.tb = sk.t; // up against it: the shield fanned up
          play(u.mesh, mv.up, { restart: true, speed: 0, fade: mv.upT, at: mv.upAt }); sk.tbHit = sk.t + mv.upHit; sk.tbEnd = sk.t + mv.upT + mv.upHold; S.swoosh(true, mv.upHit, 0.1); }
        else { const dx = (t.x - u.x) / d, dz = (t.z - u.z) / d, v = Math.min(mv.speed, (d - stop) / Math.max(dt, 0.016)); u.wantX = dx * v; u.wantZ = dz * v; u.vx = u.wantX; u.vz = u.wantZ;
          for (const h of hostilesOf(u)) { if (h === t || h.dead || sk.hit.has(h) || dist(h, u) > u.r + h.r + 0.45 || !inArc(u, h, 1.2)) continue; sk.hit.add(h); // barged aside
            damage(u, h, u.dmg * 0.5, { knock: 3, fx: u.x, fz: u.z, quiet: true }); stunHit(h, 0.5); S.clank(); }
          if (Math.random() < dt * 40) for (const sd of [-1, 1]) C.parts.emit(u.x - dx * 0.3 + dz * 0.35 * sd, 0.1, u.z - dz * 0.3 - dx * 0.35 * sd, 1, { col: 0xb8a890, spd: 0.8, up: 0.6, grav: 4, life: 0.5, size: 0.28 }); } } } // dust off both feet
    else { u.vx *= 0.6; u.vz *= 0.6; if (t && sk.t < sk.tbHit) faceAt(u, t);
      if (sk.hits === 1 && sk.t >= sk.tbHit) { sk.hits = 2; shieldBash(u, t || sk.tgt, mv); } if (sk.t >= sk.tbEnd) end(u); }
  } else if (sk.id === 'charge') { // leap
    if (sk.t < sk.tUp && t) { faceAt(u, t); const d = dist(u, t), k = Math.max(0, d - (u.r + t.r + 0.3)) / (d || 1); sk.x1 = u.x + (t.x - u.x) * k; sk.z1 = u.z + (t.z - u.z) * k; sk.x0 = u.x; sk.z0 = u.z; sk.lh = 0.3 + d * 0.08; }
    if (sk.t >= sk.tUp && sk.t < sk.tLand) { const k = (sk.t - sk.tUp) / (sk.tLand - sk.tUp), e = k * k * (3 - 2 * k);
      u.x = sk.x0 + (sk.x1 - sk.x0) * e; u.z = sk.z0 + (sk.z1 - sk.z0) * e; u.y = Math.sin(Math.PI * k) * sk.lh; u.vx = u.vz = u.kx = u.kz = 0; }
    if (!sk.hits && sk.t >= sk.tLand) { sk.hits = 1; u.y = 0; if (C.floor.walk(sk.x1, sk.z1)) { u.x = sk.x1; u.z = sk.z1; } leapLand(u, mv); }
    if (sk.t >= sk.tEnd) end(u);
  } else if (sk.id === 'counter') { // the guard pose for a beat, then the counter and its sword qi
    if (!sk.swung) { if (t) faceAt(u, t);
      if (sk.t >= mv.poseT) { sk.swung = true; sk.s0 = sk.t; const L = clipDur(mv.clip), sp = Math.max(0.7, Math.min(2.6, L * (mv.hit - mv.at) / 0.3)); sk.tHit = L * (mv.hit - mv.at) / sp;
        play(u.mesh, mv.clip, { once: true, restart: true, speed: sp, fade: 0.06, at: mv.at }); trail(u, sk.tHit + 0.35); S.swoosh(sk.st === 'GS', sk.tHit - 0.02, 0.15); } }
    else { const s = sk.t - sk.s0; if (!sk.hits && s >= sk.tHit) { sk.hits = 1; counterHit(u, sk); } if (s >= sk.tHit + 0.32) end(u); }
  } else if (sk.id === 'whirl') {
    const L = clipDur(mv.clip), len = L / mv.sp;
    while (sk.hits < mv.hits.length && sk.t >= mv.hits[sk.hits] * L / mv.sp) { whirlHit(u, mv); sk.hits++; }
    if (sk.t >= len * 0.88) end(u);
  } else if (sk.id === 'sunder') {
    if (mv.roarAt && !sk.roared && sk.t >= mv.roarAt) { sk.roared = true; roarBurst(u); S.roar(); // the burst throws back whatever stands close
      for (const h of hostilesOf(u)) { const d = dist(h, u); if (h.dead || d > 3.6 + h.r) continue; const l = d || 1; h.kx += (h.x - u.x) / l * 3; h.kz += (h.z - u.z) / l * 3; stunHit(h, 0.45); } }
    if (!sk.fire && sk.t >= mv.ignite) { sk.fire = bladeFire(u); S.fire(); if (u.mesh.blade) u.mesh.blade.col = 0xff6a1a; }
    if (sk.fire && !sk.strike) { const r = Math.min(1, Math.max(0, (sk.t - mv.ignite) / (mv.full - mv.ignite))); sk.fire.reach = 0.08 + 0.92 * r; sk.fire.power = 0.6 + 0.6 * r;
      if (r >= 1 && !sk.flared) { sk.flared = true; const e = u.mesh.weap.r.userData.edge; if (e) { const P = e[1].getWorldPosition(new THREE.Vector3()); burst(P.x, P.y, P.z, 0xffb050, 1.4); } } }
    if (!sk.strike) { if (t) faceAt(u, t);
      if (sk.t >= mv.preT) { sk.strike = true; sk.st0 = sk.t; const L = clipDur(mv.clip), sp = Math.max(0.6, Math.min(2.5, L * (mv.hit - mv.at) / 0.42)); sk.tHit = L * (mv.hit - mv.at) / sp; sk.len = L * (1 - mv.at) / sp;
        play(u.mesh, mv.clip, { once: true, restart: true, speed: sp, fade: 0.06, at: mv.at }); trail(u, sk.len); S.swoosh(sk.st === 'GS', sk.tHit - 0.02); if (sk.fire) { sk.fire.reach = 1; sk.fire.power = 1.4; } } }
    else { const s = sk.t - sk.st0; if (!sk.hits && s >= sk.tHit) { sk.hits = 1; sunderHit(u, mv); } if (sk.fire && s >= sk.tHit + 0.3) sk.fire.power = Math.max(0, sk.fire.power - dt * 3);
      if (s >= Math.min(sk.len * 0.8, sk.tHit + 0.6)) end(u); }
  }
};

// ---------- the blows ----------
function arcHit(u, reach, half, mult, o = {}) { let n = 0, cr = false;
  for (const h of hostilesOf(u)) { if (h.dead || dist(h, u) > reach + h.r || !inArc(u, h, half)) continue; const crit = Math.random() < 0.15; cr = cr || crit;
    damage(u, h, u.dmg * mult * (0.9 + Math.random() * 0.2), { knock: o.knock || 0, melee: true, heavy: true, crit, critX: 1.8, quiet: true }); if (o.stun) stunHit(h, o.stun); n++; }
  if (n) S.blade(styleOf(u) === 'GS', cr); return n; }
function shieldBash(u, t, mv) { // the shield sweeps up into them: the target and whoever stands right beside it are thrown up and back
  const fx = u.x + Math.sin(u.face) * 0.75, fz = u.z + Math.cos(u.face) * 0.75;
  for (const h of hostilesOf(u)) { if (h.dead || (h !== t && (dist(h, u) > u.r + h.r + 0.9 || !inArc(u, h, 0.7)))) continue;
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 4.5, heavy: true, quiet: true }); stunHit(h, mv.stun); h.hitStop = Math.max(h.hitStop || 0, 0.1);
    if (!h.dead && !h.champ && !h.noStun) { const lift = 0.55 + Math.random() * 0.2; G.fx.push({ t: 0.5, tick: k => { if (!h.dead) h.y = Math.sin(Math.PI * k) * lift; }, fn: () => { h.y = 0; } }); } } // a hop in the air
  say(t.x, t.z, tr('击倒', 'Knocked down'), '#ffe6b0', 15, 2.1); u.hitStop = 0.08; swipeUp(u.x, u.z, u.face, colOf(u));
  S.clank(); S.smash(); shake(0.12, fx, fz); burst(fx, 1.0, fz, colOf(u), 1.5); shock(fx, fz, colOf(u), 1.6, 0.35, 0.4);
  C.parts.emit(fx, 1.0, fz, 12, { col: 0xffe6b0, spd: 3, up: 1.2, grav: 7, life: 0.3, size: 0.12 }); C.parts.emit(fx, 0.2, fz, 14, { col: 0xb8a890, spd: 2.4, up: 1, life: 0.5, size: 0.3, grav: 5 });
}
function leapLand(u, mv) { // the greatsword comes down: the ground splits, everything near is thrown off its feet
  const x = u.x + Math.sin(u.face) * 0.6, z = u.z + Math.cos(u.face) * 0.6, col = colOf(u); let n = 0;
  for (const h of hostilesOf(u)) { if (h.dead || Math.hypot(h.x - x, h.z - z) > mv.aoe + h.r) continue;
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 3.2, fx: x, fz: z, melee: true, heavy: true, quiet: true }); stunHit(h, mv.stun); n++; }
  if (n) S.blade(true, false); S.smash(); S.boom(); shake(0.22, x, z); u.hitStop = 0.1;
  slamMark(x, z, 1.6, col, 3); burst(x, 0.4, z, col, 2.4); shock(x, z, col, mv.aoe, 0.45); shock(x, z, 0xc8bca8, mv.aoe * 1.5, 0.7, 0.3);
  C.parts.emit(x, 0.2, z, 24, { col: 0x4e443c, spd: 4.5, up: 3.2, grav: 11, life: 0.75, size: 0.3, spread: 0.6 }); // chunks of floor
  C.parts.emit(x, 0.15, z, 22, { col: 0xc8bca8, spd: 3.4, up: 0.9, grav: 1, life: 0.8, size: 0.5, spread: 0.8 }); // dust
  C.parts.emit(x, 0.3, z, 16, { col, spd: 3, up: 2, grav: 3, life: 0.5, size: 0.2 });
}
function whirlHit(u, mv) {
  let n = 0, cr = false; for (const h of hostilesOf(u)) { if (h.dead || dist(h, u) > 2.7 + h.r) continue; const crit = Math.random() < 0.12; cr = cr || crit;
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 2, melee: true, heavy: true, crit, critX: 1.8, quiet: true }); n++; }
  if (n) S.blade(styleOf(u) === 'GS', cr); shock(u.x, u.z, colOf(u), 2.7, 0.35, 0.35);
  // sword qi flung out all round: it cuts what it meets out to ~5.5 m, as it gets there
  const x = u.x, z = u.z, reach = QI.r0 + QI.speed * QI.life; qiWaves(x, z, colOf(u), 8, (u.sk ? u.sk.hits : 0) * 0.39 + Math.random() * 0.3);
  for (const h of hostilesOf(u)) { const d = Math.hypot(h.x - x, h.z - z); if (h.dead || d <= 2.7 + h.r || d > reach + h.r) continue;
    G.fx.push({ t: Math.max(0.01, (d - QI.r0) / QI.speed), fn: () => { if (h.dead || !u) return; damage(u, h, u.dmg * mv.mult * 0.5, { knock: 1.4, fx: x, fz: z, quiet: true });
      C.parts.emit(h.x, 0.9, h.z, 6, { col: colOf(u), spd: 2, up: 1, grav: 5, life: 0.3, size: 0.14 }); } }); }
}
function sunderHit(u, mv) {
  const fx = Math.sin(u.face), fz = Math.cos(u.face), x = u.x, z = u.z;
  const hit = h => { damage(u, h, u.dmg * mv.mult * (0.95 + Math.random() * 0.1), { knock: 3.5, fx: x, fz: z, melee: true, heavy: true, crit: true, critX: 1, quiet: true });
    if (!h.dead && !h.champ && h.hp < h.maxHp * 0.25) { say(h.x, h.z, tr('斩杀', 'Cut down'), '#ff6a4a', 17, 2); damage(u, h, h.hp + 1, { quiet: true, noFx: true }); } };
  S.blade(true, true); S.boom(); S.fire();
  if (mv.sweep) { // the greatsword: 270° round, the fire rolls out from it and catches each one as it gets there
    for (const h of hostilesOf(u)) { const d = dist(h, u); if (h.dead || d > CONE.range + h.r || !inArc(u, h, mv.sweep / 2 + 0.1)) continue;
      if (d < u.range + u.r + 1) hit(h); else G.fx.push({ t: Math.max(0.01, (d - 1) / 9), fn: () => { if (!h.dead) hit(h); } }); }
    shake(0.26, x, z); burst(x, 0.8, z, 0xffb050, 2.4); fireArc(x, z, u.face, CONE.range, mv.sweep);
  } else { for (const h of coneOf(u)) hit(h);
    shake(0.24, x + fx * 2, z + fz * 2); burst(x + fx * 1.4, 0.6, z + fz * 1.4, 0xffb050, 2.6); fireCone(x, z, u.face, CONE.range); } // the wave of fire runs out down the cone
}
// a block or parry: the counter's blow, and its sword qi
function counterHit(u, sk) {
  const mv = sk.mv, col = colOf(u), x = u.x, z = u.z;
  if (mv.fan) { // the greatsword: a 180° sweep, its qi fanning out wide but not far
    arcHit(u, u.range + u.r + 0.6, Math.PI / 2, mv.mult, { knock: 2.6, stun: 0.4 }); qiFan(x, z, u.face, col, FAN);
    for (const h of hostilesOf(u)) { const d = dist(h, u); if (h.dead || d <= u.range + u.r + 0.6 + h.r || d > FAN + h.r || !inArc(u, h, Math.PI / 2)) continue;
      G.fx.push({ t: Math.max(0.01, d / 12), fn: () => { if (h.dead) return; damage(u, h, u.dmg * 0.8, { knock: 1.6, fx: x, fz: z, quiet: true }); C.parts.emit(h.x, 0.9, h.z, 6, { col, spd: 2, up: 1, grav: 5, life: 0.3, size: 0.14 }); } }); }
  } else { // sword & shield: a cut down from behind the shield, its qi flying straight — at the shooter, when it stopped a missile
    arcHit(u, u.range + u.r + 0.6, 0.6, mv.mult, { knock: 2.2, stun: 0.3 });
    const aim = sk.shot && sk.src && !sk.src.dead && dist(sk.src, u) < BOLT.range + 1 ? sk.src : null, ang = aim ? Math.atan2(aim.x - x, aim.z - z) : u.face, hit = new Set();
    qiBolt(x, z, ang, col, BOLT.range, BOLT.speed, (px, pz) => { for (const h of hostilesOf(u)) { if (h.dead || hit.has(h) || Math.hypot(h.x - px, h.z - pz) > 0.8 + h.r) continue; hit.add(h);
      damage(u, h, u.dmg * 0.9, { knock: 2, fx: x, fz: z, quiet: true }); C.parts.emit(h.x, 1.0, h.z, 8, { col, spd: 2.4, up: 1, grav: 5, life: 0.3, size: 0.15 }); S.blade(false, false); } });
  }
}
// ---------- Block / Parry (passive, from 10 战魂): how much of a blow gets through, and the counter it earns ----------
PH.guard = (src, u, o) => {
  if (!((u.fury || 0) >= SK.guard.at) || u.spawnT > 0 || !u.entry) return 1;
  const mv = MOVES[styleOf(u)].guard, sx = o.fx ?? (src ? src.x : u.x), sz = o.fz ?? (src ? src.z : u.z);
  if (Math.abs(((Math.atan2(sx - u.x, sz - u.z) - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 1.75 || Math.random() >= mv.chance) return 1; // only what comes from the front
  const e = mv.fan && u.mesh.weap && u.mesh.weap.r && u.mesh.weap.r.userData.edge, P = new THREE.Vector3();
  if (e) e[0].getWorldPosition(P); else P.set(u.x + Math.sin(u.face) * 0.55, 1.1, u.z + Math.cos(u.face) * 0.55);
  C.parts.emit(P.x, P.y, P.z, 10, { col: 0xffe6b0, spd: 3, up: 1.4, grav: 8, life: 0.25, size: 0.1 }); burst(P.x, P.y, P.z, 0xfff0c0, 0.8);
  say(u.x, u.z, mv.word, '#ffe6b0', 15, 2.1); S.clank(); if (mv.fan) S.blade(true, false);
  if (!(u.ctrCD > G.t)) { u.ctrQ = { src, shot: !!o.shot, t: G.t }; u.ctrCD = G.t + 1.6; } // one counter at a time
  return o.shot && mv.missiles ? 0 : mv.keep;
};
// the counter goes in as soon as it is free (between its own swings): the guard pose, then the blow
PH.counterAI = u => {
  const q = u.ctrQ; u.ctrQ = null; if (!q || G.t - q.t > 1.6 || u.state !== 'idle') return false;
  const st = styleOf(u), mv = MOVES[st].guard, t = q.src && !q.src.dead && dist(q.src, u) < 12 ? q.src : u.target && !u.target.dead ? u.target : null;
  u.state = 'pskill'; u.st = 0; u.wantX = u.wantZ = 0; u.sk = { id: 'counter', mv, st, t: 0, tgt: t, hits: 0, src: q.src, shot: q.shot }; faceAt(u, t, true);
  play(u.mesh, mv.pose, { restart: true, fade: 0.05 }); return true;
};
