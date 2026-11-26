// 野外的敌人 / the wilds' foes (data.js FOES): each fights as one of the four skeleton kinds and adds one trick of its own.
// units.js calls in through PH: foeAct (before its kind's AI), foeTick (a trick under way, state 'fskill'), foeStrike (a blow of its
// own), foeMul (a blow's damage), foeGuard (a shield), foeStats (numbers), foeEnd (cleanup on death), foeVanish (a ghost's end).
//  盗墓贼 Grave Robber  hurt: a smoke bomb, gone, and out again behind its target for a backstab (always a critical hit)
//  掠夺者 Raider        from a few steps away: hurls an axe
//  弩手   Crossbowman   now and then stops to aim — a red lane on the ground — and the bolt goes through everyone in it
//  侍从   Squire        a round shield takes the edge off blows from the front
//  圣殿骑士 Templar     a big shield: most of what comes from the front is blocked, bolts and spells too
//  处刑者 Headsman      against anyone under 40% life its blow is an execution (×1.6)
//  狂战士 Berserker     whirls into the crowd (a roar first); under 40% life goes berserk: faster, fiercer
//  驱魔师 Exorcist      heals the wounded among its own, throws fire from the back
//  蝙蝠   Bat           bites, darts away, dives back in
//  幽灵 / 怨灵 Ghost / Wraith  homing soul-fire that chills (the wraith three at once); drift through bodies, leave no corpse
import { G } from './state.js';
import { tr } from './i18n.js';
import { C, PH, say, damage, shoot, hostilesOf, seek, flee, faceTo, rangedLogic, nearestHostile, AN } from './units.js';
import { play, clipLen } from './assets.js';
import { warnLine, impact, burst, shake, spinFx } from './fx.js';
import { S } from './audio.js';

const rand = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2, dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angDiff = (a, b) => Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);
const los = (u, t) => C.floor.los(u.x, u.z, t.x, t.z);
function begin(u, k, dur, t) { u.state = 'fskill'; u.fk = k; u.st = 0; u.fdur = dur; u.fdone = false; u.tgt = t; u.wantX = u.wantZ = 0; if (t) { faceTo(u, t); u.face = u.faceT; } }
function done(u) { u.state = 'idle'; u.fk = null; }
const puff = (x, z, n = 26) => C.parts.emit(x, 0.5, z, n, { col: 0x8a8490, spd: 1.7, up: 0.9, grav: -0.3, life: 0.95, size: 0.55, spread: 0.45 });

// ---------- numbers ----------
PH.foeStats = u => { if (u.raged) { u.speed *= 1.3; u.cd *= 0.7; u.windup = u.T.windup * 0.75; } };

// ---------- shields: a blow from in front of a knight (within ~65° of where it faces) is mostly blocked, unless it is swinging itself ----------
PH.foeGuard = (src, dst, o) => {
  if (!src || dst.state === 'windup' || dst.state === 'fskill' || dst.stun > 0) return 1;
  const fx = o.fx ?? src.x, fz = o.fz ?? src.z; if (angDiff(Math.atan2(fx - dst.x, fz - dst.z), dst.face) > 1.15) return 1;
  if (src.blunt) { // 魂契's mace: the shield takes it, and is beaten aside — the whole blow through, the knight staggered
    const a = dst.face, x = dst.x + Math.sin(a) * 0.45, z = dst.z + Math.cos(a) * 0.45; impact(x, 0.8, z, 0xffd27a, 0.9); S.block(true);
    C.parts.emit(x, 0.8, z, 9, { col: 0xffe6a0, spd: 3.4, up: 1.6, grav: 8, life: 0.3, size: 0.12 }); dst.stun = Math.max(dst.stun || 0, 0.35);
    if (G.t - (dst.blockSay || -9) > 3) { dst.blockSay = G.t; say(dst.x, dst.z, tr('破盾', 'Shield broken'), '#ffd27a', 14, 2.0); } return 1; }
  o.knock = 0; const a = dst.face, x = dst.x + Math.sin(a) * 0.45, z = dst.z + Math.cos(a) * 0.45;
  impact(x, 0.8, z, 0xfff0c0, 0.75); C.parts.emit(x, 0.8, z, 7, { col: 0xffe6a0, spd: 3, up: 1.5, grav: 8, life: 0.25, size: 0.1 }); S.block(false);
  if (G.t - (dst.blockSay || -9) > 1.4) { dst.blockSay = G.t; say(dst.x, dst.z, tr('格挡', 'Block'), '#d8d0c0', 13, 2.0); }
  if (dst.state !== 'recover') { play(dst.mesh, 'Block_Hit', { once: true, restart: true, speed: 1.6, fade: 0.05 }); dst.animLock = 0.3; }
  return dst.T.guard;
};

// ---------- the headsman's execution ----------
PH.foeMul = (u, h) => {
  if (u.foe !== 'headsman' || h.hp >= h.maxHp * 0.4) return 1;
  say(h.x, h.z, tr('斩首！', 'Execute!'), '#ff5a48', 17, 2.3); shake(0.08, h.x, h.z); burst(h.x, 0.9, h.z, 0xff4a30, 1.4); return 1.6;
};

// ---------- blows of their own ----------
PH.foeStrike = (u, t) => {
  if (u.foe === 'bat') { u.swoopT = rand(0.5, 0.8); return false; } // the bite lands as usual, then it darts off (foeAct)
  if (u.foe === 'ghost' || u.foe === 'wraith') { const n = u.foe === 'wraith' ? 3 : 1;
    for (let i = 0; i < n; i++) shoot(u, 'wisp', t.x, t.z, { ang: (i - (n - 1) / 2) * 0.34, dmg: u.dmg * (n > 1 ? 0.7 : 1), life: 2.8, sp: 4.4, home: t, chill: 1.4 }); return true; }
  return false;
};

// ---------- what each does before its kind's own fighting (true: it is busy with its trick this frame) ----------
PH.foeAct = (u, t, dt) => {
  const d = dist(u, t);
  switch (u.foe) {
    case 'robber': if (!u.smoked && u.hp < u.maxHp * 0.7 && d < 5) { smoke(u, t); return true; } return false;
    case 'raider': u.axeCD = (u.axeCD ?? rand(0.2, 1.2)) - dt; if (u.axeCD <= 0 && d > 2.4 && d < 7 && los(u, t)) { u.axeCD = rand(5, 7); throwAxe(u, t); return true; } return false;
    case 'xbow': u.aimCD = (u.aimCD ?? rand(2.5, 5)) - dt; if (u.aimCD <= 0 && d > 2 && d < 9.5 && los(u, t)) { u.aimCD = rand(7, 9.5); aim(u, t); return true; } return false;
    case 'berserker':
      if (!u.raged && u.hp < u.maxHp * 0.4) rage(u);
      if (u.raged && Math.random() < dt * 9) C.parts.emit(u.x, 1.0, u.z, 1, { col: 0xff5a2a, spd: 0.4, up: 1.2, grav: -1, life: 0.5, size: 0.2, spread: 0.35 });
      u.whirlCD = (u.whirlCD ?? rand(2, 4)) - dt; if (u.whirlCD <= 0 && d < 3.4) { u.whirlCD = rand(7, 9) * (u.raged ? 0.7 : 1); whirl(u, t); return true; } return false;
    case 'exorcist': return exorcist(u, t, dt);
    case 'bat': if (u.swoopT > 0) { u.swoopT -= dt; if (!flee(u, t.x, t.z, u.speed * 1.15)) u.swoopT = 0; return true; } return false;
  }
  return false;
};

// ---------- tricks under way ----------
PH.foeTick = (u, dt) => {
  u.st += dt; const t = u.tgt && !u.tgt.dead ? u.tgt : null;
  switch (u.fk) {
    case 'smoke': // gone in the smoke; out again behind its target, ready to stab
      if (u.st >= 0.45) { if (u.to) { u.x = u.to.x; u.z = u.to.z; } u.mesh.model.visible = true; puff(u.x, u.z, 16); if (t) { faceTo(u, t); u.face = u.faceT; }
        u.backstab = true; u.cdT = 0; done(u); } return;
    case 'axe':
      if (t) faceTo(u, t);
      if (u.st >= 0.4 && !u.fdone) { u.fdone = true; if (t) { const lead = Math.min(0.4, dist(u, t) / 14); shoot(u, 'axe', t.x + (t.vx || 0) * lead, t.z + (t.vz || 0) * lead, { dmg: u.dmg * 1.5, life: 0.9, sp: 11 }); } }
      if (u.st >= u.fdur) done(u); return;
    case 'aim': // the lane is fixed when it starts aiming: step out of it
      u.faceT = u.aimA;
      if (u.st >= 1.1 && !u.fdone) { u.fdone = true; const a = u.aimA; shoot(u, 'bolt', u.x + Math.sin(a) * 10, u.z + Math.cos(a) * 10, { dmg: u.dmg * 2.4, pierce: 99, sp: 24, life: 0.52 });
        play(u.mesh, '2H_Ranged_Shoot', { once: true, restart: true, speed: 1.4, fade: 0.05 }); u.animLock = 0.3; shake(0.05, u.x, u.z); }
      if (u.st >= u.fdur) done(u); return;
    case 'whirl': {
      if (u.st < 0.4) { u.wantX = u.wantZ = 0; return; } // the roar
      if (!u.fdone) { u.fdone = true; u.fx2 = false; play(u.mesh, '2H_Melee_Attack_Spinning', { speed: 1.3, fade: 0.08 }); spinFx(u, 0xff6a4a); }
      if (!u.fx2 && u.st > 1.4) { u.fx2 = true; spinFx(u, 0xff6a4a); }
      const g = t || nearestHostile(u, 6, false); if (g) seek(u, g.x, g.z, u.speed * 0.7); else u.wantX = u.wantZ = 0;
      u.hitT -= dt; if (u.hitT <= 0) { u.hitT = 0.38; S.swoosh(true);
        for (const h of hostilesOf(u)) if (!h.dead && dist(u, h) < u.r + h.r + 1.3) damage(u, h, u.dmg * 0.45, { knock: 1.6, melee: true }); }
      if (u.st >= u.fdur) { done(u); u.cdT = 0.6; play(u.mesh, AN(u).idle, { fade: 0.15 }); } return; }
  }
  done(u);
};
// killed mid-trick: back into sight (the corpse keeps the mesh)
PH.foeEnd = u => { if (u.mesh) u.mesh.model.visible = true; };
// a ghost's end: it comes apart into wisps
PH.foeVanish = u => { const c = u.mesh.ghost || 0xb070ff; C.parts.emit(u.x, 0.9, u.z, 26, { col: c, spd: 1.3, up: 2.2, grav: -1.4, life: 0.9, size: 0.32 }); burst(u.x, 0.9, u.z, c, 1.4); };

function smoke(u, t) {
  u.smoked = true; puff(u.x, u.z); S.shadow();
  // out again just behind its target (away from where the target looks), else on its far side, else where it can
  const R = t.r + u.r + 0.35; let to = null;
  for (const a of [t.face + Math.PI, Math.atan2(t.x - u.x, t.z - u.z), t.face + Math.PI * 0.6, t.face - Math.PI * 0.6]) { const x = t.x + Math.sin(a) * R, z = t.z + Math.cos(a) * R; if (C.floor.fits(x, z, u.r)) { to = { x, z }; break; } }
  begin(u, 'smoke', 0.5, t); u.to = to; u.mesh.model.visible = false;
}
function throwAxe(u, t) { begin(u, 'axe', 0.75, t); const len = clipLen('Throw'); play(u.mesh, 'Throw', { once: true, restart: true, speed: Math.max(0.8, len * 0.5 / 0.4), fade: 0.06 }); }
function aim(u, t) { begin(u, 'aim', 1.45, t); u.aimA = u.face; warnLine(u.x, u.z, u.aimA, 12, 0.8, 1.1); play(u.mesh, '2H_Ranged_Aiming', { fade: 0.1 }); S.lock(); }
function whirl(u, t) { begin(u, 'whirl', 2.1, t); u.hitT = 0; S.roar(); say(u.x, u.z, tr('旋风！', 'Whirlwind!'), '#ff8a5a', 15, 2.2); play(u.mesh, '2H_Melee_Idle', { fade: 0.1 }); }
function rage(u) {
  u.raged = true; const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; u.mesh.u.uRim.value.setHex(0xff3020).multiplyScalar(0.85);
  S.roar(); say(u.x, u.z, tr('狂暴！', 'Berserk!'), '#ff5a3a', 17, 2.3); burst(u.x, 1, u.z, 0xff5030, 1.6); C.parts.emit(u.x, 1, u.z, 20, { col: 0xff5a2a, spd: 2, up: 2, life: 0.6, size: 0.25 });
}
// the exorcist: mends the most hurt of its own nearby (the same cast as a summoned mage's heal), else fights from the back
function exorcist(u, t, dt) {
  u.healCD = (u.healCD ?? rand(1, 2)) - dt;
  if (u.healCD <= 0) { let best = null, bw = 0.65;
    for (const e of G.enemies) { if (e.dead || e === u || e.isDrone || dist(e, u) > 7.5) continue; const w = e.hp / e.maxHp; if (w < bw) { bw = w; best = e; } }
    if (best) { u.healCD = rand(4, 5.5); u.state = 'cast'; u.st = 0; u.castH = best; u.wantX = u.wantZ = 0; faceTo(u, best); say(u.x, u.z, tr('治疗术…', 'Mending…'), '#fff0a0', 13, 2.1);
      C.parts.emit(best.x, 0.3, best.z, 10, { col: 0xfff0a0, spd: 0.6, up: 2, life: 0.7, grav: -1 }); return true; }
    u.healCD = 0.8; }
  rangedLogic(u, t, dt, 4.5, 7.5); return true;
}
