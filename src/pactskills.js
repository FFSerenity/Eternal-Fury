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

export const SKILLS = [
  { id: 'charge', at: 5, cd: 8, icon: '⚡', name: tr('冲锋', 'Charge'),
    desc: tr('目标在 3.5–8 米外时突进：剑盾举盾冲撞，撞开路上的敌人、击倒目标；大剑跃起跳劈，落地裂地范围伤害', 'Closes on a target 3.5–8 m away: sword & shield charges behind the shield, barging aside what is in the way and knocking the target down; the greatsword leaps and splits the ground where it lands') },
  { id: 'guard', at: 10, cd: 12, icon: '🛡️', name: tr('格挡', 'Guard'),
    desc: tr('血量低于 60% 或被 3 个以上围攻时防御 2.5 秒：剑盾减伤 70%、挡下前方箭矢，大剑减伤 50%；结束时反击', 'Below 60% life or with 3+ around it, guards for 2.5 s: sword & shield takes 70% less and blocks missiles from the front, greatsword 50% less; then strikes back') },
  { id: 'whirl', at: 15, cd: 10, icon: '🌀', name: tr('旋风斩', 'Whirlwind'),
    desc: tr('身边 2.5 米内有 3 个以上敌人时转身横扫，打两段', 'With 3+ enemies within 2.5 m, spins and cuts everything around it, twice') },
  { id: 'sunder', at: 20, cd: 15, icon: '💥', name: tr('破军一击', 'Sundering Strike'),
    desc: tr('蓄力重劈，前方扇形冲击波；非精英敌人血量低于 25% 直接斩杀', 'A charged blow with a shock wave down a cone in front; non-elite enemies left under 25% life are cut down') },
];
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const skillsAt = L => SKILLS.filter(s => L >= s.at);
// per style: clip, play speed, the clip fractions where things happen (measured like the swings: blade closest to a body in front)
const MOVES = {
  SNS: { charge: { run: 'SNS_Run', block: 'SNS_Block', brace: 0.2, dash: 0.9, speed: 12, mult: 1.6, stun: 1.4 }, guard: { clip: 'SNS_Block', counter: 'SNS_Atk3', chit: 0.52, red: 0.7, missiles: true },
    whirl: { clip: 'SNS_Combo', sp: 1.8, hits: [0.21, 0.74], mult: 1 }, sunder: { pre: 'SNS_Power', preSp: 1.5, preT: 0.9, clip: 'SNS_Atk2', hit: 0.41, mult: 3 } },
  GS: { charge: { clip: 'GS_Leap', sp: 1.1, at: 0.1, up: 0.3, land: 0.53, end: 0.8, mult: 1.5, stun: 0.9, aoe: 2.6 }, guard: { clip: 'GS_Block', counter: 'GS_Atk2', chit: 0.51, red: 0.5 },
    whirl: { clip: 'GS_Spin', sp: 1.2, hits: [0.35, 0.61], mult: 1.2 }, sunder: { pre: 'GS_Power', preSp: 2, preT: 0.9, clip: 'GS_Atk3', hit: 0.51, mult: 3.5 } },
};
const GUARD_T = 2.5, CONE = { range: 5.5, half: 0.66 };
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
  if (id === 'charge' && mv.run) { // behind the shield: legs run, arms hold the guard
    const m = u.mesh, up = heroPart(mv.block, 'upper'); play(m, heroPart(mv.run, 'lower'), { restart: true, speed: 1.7, fade: 0.1 });
    const a = m.mixer.clipAction(A.heroClips[up]); a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(0.1); a.play(); m.curU = a; m.curUName = up; u.sk.upA = a; u.sk.hit = new Set(); S.clank(); }
  else if (id === 'charge') { // the leap: a long arc over to the target, the ground splits where it lands
    const L = clipDur(mv.clip), k = Math.max(0, dist(u, t) - (u.r + t.r + 0.3)) / (dist(u, t) || 1); play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.06, at: mv.at });
    Object.assign(u.sk, { tUp: (mv.up - mv.at) * L / mv.sp, tLand: (mv.land - mv.at) * L / mv.sp, tEnd: (mv.end - mv.at) * L / mv.sp, x0: u.x, z0: u.z, x1: u.x + (t.x - u.x) * k, z1: u.z + (t.z - u.z) * k, lh: 0.3 + dist(u, t) * 0.08 });
    trail(u, u.sk.tEnd); S.swoosh(true, u.sk.tLand - 0.03, 0.3); }
  else if (id === 'guard') { play(u.mesh, mv.clip, { restart: true, fade: 0.12 }); u.guardT = G.t + GUARD_T; u.guardK = 1 - mv.red; S.clank(); guardFx(u); }
  else if (id === 'whirl') { play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.08 }); trail(u, clipDur(mv.clip) / mv.sp);
    for (const h of mv.hits) S.swoosh(st === 'GS', h * clipDur(mv.clip) / mv.sp - 0.02); }
  else if (id === 'sunder') { play(u.mesh, mv.pre, { once: true, restart: true, speed: mv.preSp, fade: 0.1 }); chargeFx(u); S.raise(); }
  return true;
}
function end(u) { const sk = u.sk, m = u.mesh; if (sk && sk.upA && m.curU === sk.upA) { sk.upA.fadeOut(0.15); m.curU = null; m.curUName = ''; }
  u.state = 'idle'; u.sk = null; u.guardT = 0; u.y = 0; u.cdT = Math.max(u.cdT, 0.25); }

// ---------- when to use what ----------
PH.skillAI = (u, t) => {
  if (u.state !== 'idle' || !u.entry) return false;
  const L = u.fury || 0, cd = u.skCD || {}, has = id => L >= SK[id].at && !(cd[id] > G.t); // unlocked by its 战魂 stacks
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 2.6 + h.r), hurt = u.hp < u.maxHp * 0.6;
  if (hurt && near.length && has('guard')) return start(u, 'guard', near[0]);
  if (near.length >= 3 && has('whirl')) return start(u, 'whirl', t || near[0]);
  if (near.length >= 3 && has('guard')) return start(u, 'guard', t || near[0]);
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
  if (sk.id === 'charge' && mv.run) { // shield charge: brace, then run in, barging aside whatever is in the way
    if (!sk.hits) { if (t) faceAt(u, t);
      if (sk.t >= mv.brace) { const stop = t ? u.r + t.r + 0.3 : 0, d = t ? dist(u, t) : 0;
        if (!t || d <= stop + 0.05 || sk.t > mv.brace + mv.dash) { sk.hits = 1; sk.tb = sk.t; if (t) shieldBash(u, t, mv); }
        else { const dx = (t.x - u.x) / d, dz = (t.z - u.z) / d, v = Math.min(mv.speed, (d - stop) / Math.max(dt, 0.016)); u.wantX = dx * v; u.wantZ = dz * v; u.vx = u.wantX; u.vz = u.wantZ;
          for (const h of hostilesOf(u)) { if (h === t || h.dead || sk.hit.has(h) || dist(h, u) > u.r + h.r + 0.45 || !inArc(u, h, 1.2)) continue; sk.hit.add(h); // barged aside
            damage(u, h, u.dmg * 0.5, { knock: 3, fx: u.x, fz: u.z, quiet: true }); stunHit(h, 0.5); S.clank(); }
          if (Math.random() < dt * 35) C.parts.emit(u.x - dx * 0.3, 0.12, u.z - dz * 0.3, 1, { col: 0xb8a890, spd: 0.7, up: 0.7, grav: 4, life: 0.45, size: 0.26 }); } } }
    else { u.vx *= 0.6; u.vz *= 0.6; if (sk.t - sk.tb > 0.35) end(u); }
  } else if (sk.id === 'charge') { // leap
    if (sk.t < sk.tUp && t) { faceAt(u, t); const d = dist(u, t), k = Math.max(0, d - (u.r + t.r + 0.3)) / (d || 1); sk.x1 = u.x + (t.x - u.x) * k; sk.z1 = u.z + (t.z - u.z) * k; sk.x0 = u.x; sk.z0 = u.z; sk.lh = 0.3 + d * 0.08; }
    if (sk.t >= sk.tUp && sk.t < sk.tLand) { const k = (sk.t - sk.tUp) / (sk.tLand - sk.tUp), e = k * k * (3 - 2 * k);
      u.x = sk.x0 + (sk.x1 - sk.x0) * e; u.z = sk.z0 + (sk.z1 - sk.z0) * e; u.y = Math.sin(Math.PI * k) * sk.lh; u.vx = u.vz = u.kx = u.kz = 0; }
    if (!sk.hits && sk.t >= sk.tLand) { sk.hits = 1; u.y = 0; if (C.floor.walk(sk.x1, sk.z1)) { u.x = sk.x1; u.z = sk.z1; } leapLand(u, mv); }
    if (sk.t >= sk.tEnd) end(u);
  } else if (sk.id === 'guard') {
    if (!sk.counter) { const n = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 4).sort((a, b) => dist(a, u) - dist(b, u))[0]; if (n) faceAt(u, n);
      if (sk.t >= GUARD_T || G.t > u.guardT) { u.guardT = 0; sk.counter = true; sk.ct = 0; sk.cHit = 0.38; const L = clipDur(mv.counter);
        play(u.mesh, mv.counter, { once: true, restart: true, speed: Math.max(0.8, Math.min(2.6, L * mv.chit / sk.cHit)), fade: 0.08 }); trail(u, 0.8); S.swoosh(sk.st === 'GS', sk.cHit - 0.02); sk.cLen = L / Math.max(0.8, Math.min(2.6, L * mv.chit / sk.cHit)); } }
    else { sk.ct += dt; if (!sk.hits && sk.ct >= sk.cHit) { sk.hits = 1; arcHit(u, u.range + u.r + 0.6, 1.0, 1.5, { knock: 2.6, stun: 0.6 }); } if (sk.ct >= Math.min(sk.cLen * 0.8, sk.cHit + 0.45)) end(u); }
  } else if (sk.id === 'whirl') {
    const L = clipDur(mv.clip), len = L / mv.sp;
    while (sk.hits < mv.hits.length && sk.t >= mv.hits[sk.hits] * L / mv.sp) { whirlHit(u, mv); sk.hits++; }
    if (sk.t >= len * 0.88) end(u);
  } else if (sk.id === 'sunder') {
    if (!sk.strike) { if (t) faceAt(u, t);
      if (sk.t >= mv.preT) { sk.strike = true; sk.st0 = sk.t; const L = clipDur(mv.clip), sp = Math.max(0.6, Math.min(2.5, L * mv.hit / 0.42)); sk.tHit = L * mv.hit / sp; sk.len = L / sp;
        play(u.mesh, mv.clip, { once: true, restart: true, speed: sp, fade: 0.06 }); trail(u, sk.len); S.swoosh(sk.st === 'GS', sk.tHit - 0.02); } }
    else { const s = sk.t - sk.st0; if (!sk.hits && s >= sk.tHit) { sk.hits = 1; sunderHit(u, mv); } if (s >= Math.min(sk.len * 0.8, sk.tHit + 0.6)) end(u); }
  }
};

// ---------- the blows ----------
function arcHit(u, reach, half, mult, o = {}) { let n = 0, cr = false;
  for (const h of hostilesOf(u)) { if (h.dead || dist(h, u) > reach + h.r || !inArc(u, h, half)) continue; const crit = Math.random() < 0.15; cr = cr || crit;
    damage(u, h, u.dmg * mult * (0.9 + Math.random() * 0.2), { knock: o.knock || 0, melee: true, heavy: true, crit, critX: 1.8, quiet: true }); if (o.stun) stunHit(h, o.stun); n++; }
  if (n) S.blade(styleOf(u) === 'GS', cr); return n; }
function shieldBash(u, t, mv) { // the shield hits: the target and whoever stands right beside it go down
  const fx = u.x + Math.sin(u.face) * 0.75, fz = u.z + Math.cos(u.face) * 0.75;
  for (const h of hostilesOf(u)) { if (h.dead || (h !== t && (dist(h, u) > u.r + h.r + 0.9 || !inArc(u, h, 0.7)))) continue;
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 4.5, heavy: true, quiet: true }); stunHit(h, mv.stun); h.hitStop = Math.max(h.hitStop || 0, 0.1); }
  say(t.x, t.z, tr('击倒', 'Knocked down'), '#ffe6b0', 15, 2.1); u.hitStop = 0.08;
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
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; C.parts.emit(u.x + Math.cos(a) * 2, 0.7, u.z + Math.sin(a) * 2, 1, { col: colOf(u), spd: 0.8, up: 0.4, grav: 0, life: 0.35, size: 0.2, spread: 0.1 }); }
}
function sunderHit(u, mv) {
  const col = colOf(u), fx = Math.sin(u.face), fz = Math.cos(u.face); let n = 0;
  for (const h of coneOf(u)) { damage(u, h, u.dmg * mv.mult * (0.95 + Math.random() * 0.1), { knock: 3.5, melee: true, heavy: true, crit: true, critX: 1, quiet: true }); n++;
    if (!h.dead && !h.champ && h.hp < h.maxHp * 0.25) { say(h.x, h.z, tr('斩杀', 'Cut down'), '#ff6a4a', 17, 2); damage(u, h, h.hp + 1, { quiet: true, noFx: true }); } }
  S.blade(true, true); S.boom(); shake(0.2, u.x + fx * 2, u.z + fz * 2); burst(u.x + fx * 1.4, 0.6, u.z + fz * 1.4, col, 2.4);
  for (let k = 1; k <= 5; k++) { const d = k * 1.05, x = u.x + fx * d, z = u.z + fz * d; // the shock wave runs out down the cone
    G.fx.push({ clean: true, t: 0.06 * k, tick: () => {}, fn: () => { shock(x, z, col, 0.5 + k * 0.28, 0.4, 0.4); C.parts.emit(x, 0.2, z, 6 + k, { col: k % 2 ? col : 0xb8a890, spd: 2.2, up: 1.8, life: 0.5, size: 0.28, grav: 5, spread: 0.3 + k * 0.15 }); } }); }
}
// ---------- the look of the long ones ----------
function guardFx(u) { // a shell of light while it guards
  const g = glowSprite(colOf(u), 2.6, 0); g.position.set(0, 1.1, 0); u.mesh.root.add(g); const sk = u.sk;
  G.fx.push({ clean: true, t: GUARD_T + 0.3, tick: k => { const on = u.sk === sk && u.guardT > G.t && !u.dead; g.material.opacity = on ? 0.22 + 0.06 * Math.sin(G.t * 9) : Math.max(0, g.material.opacity - 0.05); }, fn: () => u.mesh.root.remove(g) });
}
function chargeFx(u) { // light gathers on the blade, motes are drawn in
  const e = u.mesh.weap && u.mesh.weap.r && u.mesh.weap.r.userData.edge; if (!e) return; const g = glowSprite(colOf(u), 1, 0), sk = u.sk, P = new THREE.Vector3();
  const ws = e[1].getWorldScale(P).x || 1; g.scale.setScalar(0.2 / ws); e[1].add(g);
  G.fx.push({ clean: true, t: 1.6, tick: k => { const on = u.sk === sk && !u.dead, c = Math.min(1, (u.sk ? u.sk.t : 0) / 0.9); g.material.opacity = on ? 0.4 + 0.5 * c : Math.max(0, g.material.opacity - 0.08);
      g.scale.setScalar((0.3 + 1.3 * c + 0.15 * Math.sin(G.t * 30)) / ws);
      if (on && !u.sk.strike && Math.random() < 0.6) { e[1].getWorldPosition(P); const a = Math.random() * Math.PI * 2, r = 1.2; C.parts.emit(P.x + Math.cos(a) * r, P.y + 0.3, P.z + Math.sin(a) * r, 1, { col: colOf(u), spd: 0.2, up: -0.2, grav: 0, life: 0.35, size: 0.16 }); } },
    fn: () => e[1].remove(g) });
}
// ---------- the Guard: how much of a blow gets through ----------
PH.guard = (src, u, o) => {
  const sk = u.sk, mv = sk && sk.id === 'guard' ? sk.mv : null; if (!mv) return 1;
  const sx = o.fx ?? (src ? src.x : u.x), sz = o.fz ?? (src ? src.z : u.z), front = Math.abs(((Math.atan2(sx - u.x, sz - u.z) - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.35;
  const x = u.x + Math.sin(u.face) * 0.5, z = u.z + Math.cos(u.face) * 0.5;
  C.parts.emit(x, 1.0, z, 5, { col: 0xffe6b0, spd: 2.4, up: 1.2, grav: 7, life: 0.25, size: 0.1 }); S.clank();
  if (o.shot && mv.missiles && front) { say(u.x, u.z, tr('格挡', 'Blocked'), '#ffe6b0', 14, 2); return 0; }
  return u.guardK;
};
