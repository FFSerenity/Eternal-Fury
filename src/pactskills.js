// 魂契: the Bone Sentinel's own skills, one at each crest tier (5 / 10 / 15 / 20 战魂 stacks, lost with them when it falls). It uses them by itself (PH.skillAI is
// asked first in its melee thinking); each runs as the 'pskill' state (PH.skillTick), on the style's own Mixamo clips.
import * as THREE from 'three';
import { G } from './state.js';
import { tr } from './i18n.js';
import { C, PH, say, damage, hostilesOf, plated } from './units.js';
import { A, play, heroPart, HOLY_C } from './assets.js';
import { ring, glowSprite } from './gfx.js';
import { burst, shake, trail, slamMark } from './fx.js';
import { S } from './audio.js';
import { bladeFire, roarBurst, qiWaves, QI, fireCone, fireArc, qiBolt, qiFan, swipeUp, HOLY_FIRE } from './pactfx.js';
import { blessedHammers, holyBurst, judgement, HAMMERS, thrownHammer, hammerHit, leapBurst, auraOn, auraHeal } from './holy.js';

export const SKILLS = [
  { id: 'charge', at: 5, cd: 8, icon: '⚡', name: tr('冲锋', 'Charge'),
    desc: tr('目标在 3.5–8 米外时突进：剑盾压低身形举盾冲撞，撞开路上的敌人，冲到面前一记盾击把目标击倒；大剑跃起跳劈，落地裂地范围伤害', 'Closes on a target 3.5–8 m away: sword & shield drives in low behind the shield, barging aside what is in the way, and ends with a shield bash that knocks the target down; the greatsword leaps and splits the ground where it lands'),
    pal: { name: tr('掷锤飞跃', 'Hammer Leap'), icon: '🔨', desc: tr('目标在 3.5–9 米外时，先把锤子掷过去：砸中眩晕 1.6 秒，锤子弹起悬在它头顶打转。随即纵身飞跃过去，半空中召回锤子高高举起，落地砸下爆出一圈圣光，2.6 米内的敌人都被震开、短暂眩晕',
      'At a target 3.5–9 m away it first hurls its mace: the blow stuns for 1.6 s and the mace bounces up to hang over it, turning. Then it leaps after it, calls the mace back into its raised hand at the top of the leap, and comes down in a burst of light that throws back and briefly stuns everything within 2.6 m') } },
  { id: 'guard', at: 10, passive: true, icon: '🛡️', name: tr('格挡 / 招架', 'Block / Parry'),
    desc: tr('被动：剑盾（要装着盾牌）挨打时（任何方向）30% 几率格挡（伤害 −80%，箭和火球整个挡下），大剑正面挨打时 25% 几率招架（伤害 −60%）；战魂超过 10 层后每层再 +1% 几率（最多 +20%）。随即在普攻之间插入一次反击——剑盾举盾后直劈，剑气直线飞出约 10 米，挡下的若是飞矢就直取放箭的人；大剑架住后 180° 横扫，剑气扇面扩散约 4.5 米',
      'Passive: sword & shield (with a shield on its arm) blocks 30% of blows from any side (−80% damage, arrows and fireballs stopped whole), the greatsword parries 25% of blows from the front (−60%); +1% chance per Fury stack past 10 (at most +20%); then it slips a counter in between its swings — sword & shield cuts down from behind the shield and the sword qi flies ~10 m straight (at the shooter, if it stopped a missile); the greatsword sweeps 180° and its qi fans out ~4.5 m'),
    pal: { name: tr('格挡', 'Block'), desc: tr('被动：装着盾牌时，任何方向挨打 30% 几率格挡（伤害 −80%，箭和火球整个挡下）；战魂超过 10 层后每层再 +1% 几率（最多 +20%）。随即在普攻之间插入一次反击：一锤砸下，一道圣光直线飞出约 10 米（挡下的若是飞矢就直取放箭的人）',
      'Passive: with a shield on its arm it blocks 30% of blows from any side (−80% damage, arrows and fireballs stopped whole); +1% chance per Fury stack past 10 (at most +20%); then it slips a counter in between its swings — the mace comes down and a bolt of light flies ~10 m straight (at the shooter, if it stopped a missile)') } },
  { id: 'whirl', at: 15, cd: 10, icon: '🌀', name: tr('旋风斩', 'Whirlwind'),
    desc: tr('身边 2.5 米内有 3 个以上敌人时转身横扫，打两段，每段向四周甩出剑气（远处的敌人也会被剑气划伤）', 'With 3+ enemies within 2.5 m, spins and cuts everything around it, twice, flinging sword qi out in every direction (it cuts what it meets further out too)'),
    pal: { name: tr('祝福之锤', 'Blessed Hammers'), icon: '🔨', cd: 11, desc: tr('身边 3 米内有 2 个以上敌人时举锤祈祷，召出 3 把圣光之锤绕着自己飞转 6 秒，忽近忽远地扫过身边一大圈，碰到的敌人都会被砸（每把锤对同一个敌人半秒砸一次）。召出后卫士照常战斗',
      'With 2+ enemies within 3 m, it raises the mace in prayer and calls 3 hammers of light that wheel round it for 6 s, swinging in close and out wide; each strikes whatever it passes through (once every half second). It fights on while they fly') } },
  { id: 'sunder', at: 20, cd: 15, icon: '💥', name: tr('破军一击', 'Sundering Strike'),
    desc: tr('蓄力后挥出燃火的一击：剑盾怒吼爆气、直劈，火浪沿前方扇形扫出；大剑为剑注火横扫，三道火浪一圈比一圈远地向四周扩散；非精英敌人血量低于 25% 直接斩杀', 'Gathers itself, then a burning blow: sword & shield roars and cuts down, sending a wave of fire down a cone; the greatsword fills its blade with fire and sweeps, three rings of fire rolling out all round, each farther than the last; non-elite enemies left under 25% life are cut down'),
    pal: { name: tr('审判', 'Judgement'), icon: '✨', desc: tr('聚起圣光，锤子注满光芒后砸下：一道光柱从天而降，三圈圣光向外扩散。3.5 米内重击并眩晕 1.2 秒，外两圈（到约 7 米）也会被砸到、短暂眩晕；非精英敌人血量低于 25% 当场处决',
      'Gathers the light until the mace is full of it, then brings it down: a pillar of light crashes onto the spot and three rings of it race outward. Within 3.5 m a heavy blow and a 1.2 s stun; the outer rings (to ~7 m) strike and stun briefly too; non-elite enemies left under 25% life are put down') } },
  { id: 'leech', at: 25, passive: true, icon: '🩸', name: tr('饮血', 'Life Steal'),
    desc: tr('被动：卫士造成的伤害有 10% 化为自身生命（普攻和技能都算；装备上的吸血另算，不用等到 25 层）', 'Passive: 10% of the damage the Sentinel deals heals it (swings and skills alike; life steal on gear adds to it, at any Fury)'),
    pal: { name: tr('圣光光环', 'Aura of Light'), icon: '🌟', desc: tr('被动：卫士身边 7 米是圣光光环（地上一圈金光）。卫士造成伤害的 10% 治疗光环里的每一个友军（召唤师和卫士自己都算）；光环里的友军披着一层圣光护盾，最多抵挡自身生命 20% 的伤害，2.5 秒没挨打就重新充起来，治疗溢出的部分也会充进护盾。装备上的吸血另算（只治疗卫士自己，不用等到 25 层）',
      'Passive: within 7 m of the Sentinel lies its Aura of Light (a ring of gold on the ground). 10% of the damage it deals heals every one of its side in the aura (the summoner and itself); each of them wears a shield of light that takes up to 20% of their own life in damage, fills again after 2.5 s untouched, and soaks up healing past full. Life steal on gear adds to it (healing the Sentinel only, at any Fury)') } },
];
// a skill as the given style shows it (the paladin names and tells its own)
export const skillView = (s, st) => (st === 'PAL' && s.pal ? { ...s, ...s.pal } : s);
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const LEECH = 0.1;
export const skillsAt = L => SKILLS.filter(s => L >= s.at);
// per style: clip, play speed, the clip fractions where things happen (measured like the swings: blade closest to a body in front)
const MOVES = {
  // the shield bash: from the low guard the shield is fanned straight up overhead — a blend from the guard pose to SNS_Combo's frame with the
  // shield held high (0.43), the shield sweeping up through the front on the way. The blend weight eases out (a snap, nearly there in
  // a few frames, not an even sweep); a short hold up there, then a quick return
  SNS: { charge: { shield: true, pose: 'SNS_Block', brace: 0.22, dash: 0.9, speed: 12, mult: 1.6, stun: 1.4, up: 'SNS_Combo', upAt: 0.43, upT: 0.13, upHit: 0.04, upHold: 0.16 },
    guard: { chance: 0.3, keep: 0.2, missiles: true, all: true, word: tr('格挡', 'Block'), pose: 'SNS_Block', poseT: 0.22, clip: 'SNS_Atk2', at: 0, hit: 0.41, mult: 1.1 },
    whirl: { clip: 'SNS_Combo', sp: 1.8, hits: [0.21, 0.74], mult: 1 },
    sunder: { pre: 'SNS_Power', preSp: 1.5, preT: 1.15, roarAt: 0.42, ignite: 0.55, full: 0.85, clip: 'SNS_Atk2', at: 0, hit: 0.41, mult: 3 } }, // the roar, then the blade catches fire
  GS: { charge: { clip: 'GS_Leap', sp: 1.1, at: 0.1, up: 0.3, land: 0.53, end: 0.8, mult: 1.5, stun: 0.9, aoe: 2.6 },
    guard: { chance: 0.25, keep: 0.4, word: tr('招架', 'Parry'), pose: 'GS_Block', poseT: 0.2, clip: 'GS_Spin', at: 0.12, hit: 0.3, mult: 1.1, fan: true },
    whirl: { clip: 'GS_Spin', sp: 1.2, hits: [0.35, 0.61], mult: 1.2 },
    sunder: { pre: 'GS_Power', preSp: 2, preT: 1.1, ignite: 0.1, full: 0.95, clip: 'GS_Combo', at: 0.56, hit: 0.72, mult: 3.5, sweep: Math.PI * 2 } }, // fire climbs the blade from the hilt; then the sweep (GS_Combo), its fire spreading out all round (a full circle)
};
// 圣骑士: the sword-and-shield moves with the mace; its whirlwind calls hammers (a prayer: SNS_Cast), its sunder is Judgement — the
// light gathered (the roar), the mace filling with it, then the blow (no fire cone: the light comes down in front, judgement in holy.js)
MOVES.PAL = { holy: true, guard: { ...MOVES.SNS.guard, holy: true },
  // the charge is the Hammer Leap: thrown with the overhead swing (SNS_Atk2, let go at its forward point), then SNS_Leap — a jump in
  // place with the weapon raised overhead at the top (0.37) and a crouching smash where it lands (0.53); the travel is moved by hand
  charge: { toss: true, tclip: 'SNS_Atk2', tsp: 2.2, tat: 0.05, release: 0.38, hsp: 22, gap: 0.12, clip: 'SNS_Leap', sp: 1.3, at: 0.05, up: 0.2, catchAt: 0.36, land: 0.53, end: 0.8,
    mult: 1.2, stun: 1.6, aoe: 2.6, bmult: 1.5, bstun: 0.8, max: 9 },
  whirl: { hammers: true, clip: 'SNS_Cast', sp: 1.1, at: 0.45, end: 0.85, cd: 11 },
  sunder: { ...MOVES.SNS.sunder, holy: true, mult: 3 } };
const WAVES = [{ at: 0.16, R: 7.6, life: 0.6, mult: 0.6 }, { at: 0.32, R: 9.8, life: 0.66, mult: 0.4 }]; // the greatsword's sunder: the 2nd and 3rd waves
const CONE = { range: 5.5, half: 0.66 }, BOLT = { range: 10, speed: 16 }, FAN = 4.5;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const faceAt = (u, t, snap) => { if (!t) return; u.faceT = Math.atan2(t.x - u.x, t.z - u.z); if (snap) u.face = u.faceT; };
const clipDur = n => (A.heroClips[n] ? A.heroClips[n].duration : 1);
const styleOf = u => { const w = u.entry && u.entry.wset; return w === 'GS' || w === 'PAL' ? w : 'SNS'; };
const colOf = u => (u.mesh.holy ? HOLY_C : u.mesh.blade ? u.mesh.blade.col : 0xbfe6ff); // (the paladin's skills: always the gold of its light)
const hitSound = (u, cr, pl) => { const st = styleOf(u); if (st === 'PAL') S.bonk(cr, 1, pl); else S.blade(st === 'GS', cr, pl); };
const stunHit = (h, t) => { if (h.dead || h.noStun) return; h.stun = Math.max(h.stun || 0, t); if (h.state === 'windup' || h.state === 'cast') h.state = 'idle'; };
function shock(x, z, col, r, t = 0.5, w = 0.5) { const rg = ring(0.2, w, col, 0.9); rg.position.set(x, 0.05, z); C.scene.add(rg);
  G.fx.push({ clean: true, t, tick: k => { rg.scale.setScalar(1 + k * r * 2); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) }); }
const inArc = (u, h, half) => { const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return da <= half; };
const coneOf = u => hostilesOf(u).filter(h => !h.dead && dist(h, u) < CONE.range + h.r && inArc(u, h, CONE.half));

function start(u, id, t) {
  const st = styleOf(u), mv = MOVES[st][id]; u.skCD = u.skCD || {}; u.skCD[id] = G.t + (mv.cd || SK[id].cd);
  u.state = 'pskill'; u.st = 0; u.wantX = u.wantZ = 0; u.sk = { id, mv, st, t: 0, tgt: t, hits: 0 }; faceAt(u, t, true);
  say(u.x, u.z, skillView(SK[id], st).name, '#' + colOf(u).toString(16).padStart(6, '0'), 16, 2.2);
  if (id === 'charge' && mv.toss) { // the throw: the overhead swing, let go of at its forward point
    const L = clipDur(mv.tclip); play(u.mesh, mv.tclip, { once: true, restart: true, speed: mv.tsp, fade: 0.06, at: mv.tat }); u.sk.tRel = (mv.release - mv.tat) * L / mv.tsp; S.swoosh(true, u.sk.tRel - 0.02, 0.15); }
  else if (id === 'charge' && mv.shield) { // dropped low behind the shield (the guard stance) and driven straight in
    play(u.mesh, mv.pose, { restart: true, fade: 0.12 }); u.sk.hit = new Set(); S.clank(); }
  else if (id === 'charge') { // the leap: a long arc over to the target, the ground splits where it lands
    const L = clipDur(mv.clip), k = Math.max(0, dist(u, t) - (u.r + t.r + 0.3)) / (dist(u, t) || 1); play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.06, at: mv.at });
    Object.assign(u.sk, { tUp: (mv.up - mv.at) * L / mv.sp, tLand: (mv.land - mv.at) * L / mv.sp, tEnd: (mv.end - mv.at) * L / mv.sp, x0: u.x, z0: u.z, x1: u.x + (t.x - u.x) * k, z1: u.z + (t.z - u.z) * k, lh: 0.3 + dist(u, t) * 0.08 });
    trail(u, u.sk.tEnd); S.swoosh(true, u.sk.tLand - 0.03, 0.3); }
  else if (id === 'whirl' && mv.hammers) { play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.1 }); // the prayer: the hammers come at its height
    C.parts.emit(u.x, 1.4, u.z, 14, { col: HOLY_C, spd: 0.6, up: 1.6, grav: -0.8, life: 0.6, size: 0.2, spread: 0.4 }); }
  else if (id === 'whirl') { play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.08 }); trail(u, clipDur(mv.clip) / mv.sp);
    for (const h of mv.hits) S.swoosh(st === 'GS', h * clipDur(mv.clip) / mv.sp - 0.02); }
  else if (id === 'sunder') { play(u.mesh, mv.pre, { once: true, restart: true, speed: mv.preSp, fade: 0.1 }); u.sk.col0 = u.mesh.blade && u.mesh.blade.col; }
  return true;
}
function end(u) { const sk = u.sk, m = u.mesh; if (sk && sk.upA && m.curU === sk.upA) { sk.upA.fadeOut(0.15); m.curU = null; m.curUName = ''; }
  if (sk && sk.ham) { if (!sk.caught) sk.ham.drop(); if (m.weap && m.weap.r) m.weap.r.visible = true; } // (the mace is back in its hand, whatever happened)
  if (sk && sk.fire) { sk.fire.stop(); if (m.blade && sk.col0 != null) m.blade.col = sk.col0; }
  u.state = 'idle'; u.sk = null; u.y = 0; u.cdT = Math.max(u.cdT, 0.25); }

// ---------- when to use what ----------
PH.skillAI = (u, t) => {
  if (u.state !== 'idle' || !u.entry) return false;
  const L = u.fury || 0, cd = u.skCD || {}, has = id => L >= SK[id].at && !(cd[id] > G.t); // unlocked by its 战魂 stacks
  if (u.ctrQ && PH.counterAI(u)) return true; // a block or parry earned a counter: it goes in first
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 2.6 + h.r);
  if (styleOf(u) === 'PAL') { if (has('whirl') && !u.hammers) { const n3 = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 3 + h.r); if (n3.length >= 2) return start(u, 'whirl', t || n3[0]); } } // (the hammers: while they fly, not again)
  else if (near.length >= 3 && has('whirl')) return start(u, 'whirl', t || near[0]);
  if (!t || t.dead) return false;
  const d = dist(u, t);
  if (has('sunder') && d < u.range + u.r + t.r + 1.2) { faceAt(u, t, true); const n = coneOf(u).length; if (n >= 2 || t.champ || t.maxHp > u.dmg * 3) return start(u, 'sunder', t); }
  if (has('charge') && d > 3.5 && d < (MOVES[styleOf(u)].charge.max || 8) && C.floor.clear(u.x, u.z, t.x, t.z, u.r + 0.1)) return start(u, 'charge', t);
  return false;
};

// ---------- running one ----------
PH.skillTick = (u, dt) => {
  const sk = u.sk; if (!sk) { end(u); return; }
  sk.t += dt; u.wantX = u.wantZ = 0; const mv = sk.mv, t = sk.tgt && !sk.tgt.dead ? sk.tgt : null;
  if (sk.id === 'charge' && mv.toss) { // Hammer Leap: throw, leap after it, catch it at the top, come down in a burst of light
    const m = u.mesh;
    if (!sk.ham) { if (t) faceAt(u, t);
      if (sk.t >= sk.tRel) { const g = m.weap && m.weap.r, P = new THREE.Vector3(); if (g) { g.getWorldPosition(P); g.visible = false; } else P.set(u.x, 1.4, u.z);
        const aim = t || sk.tgt; sk.ham = thrownHammer(u, P, aim, { speed: mv.hsp, onHit: () => { sk.hit = true; if (!u.dead) hammerHit(u, aim, mv); } }); sk.tx = aim.x; sk.tz = aim.z; S.swoosh(true, 0, 0.1); } }
    else if (!sk.leap) { if (t) { sk.tx = t.x; sk.tz = t.z; faceAt(u, t); }
      if (sk.t >= sk.tRel + mv.gap) { const L = clipDur(mv.clip), T = f => (f - mv.at) * L / mv.sp; sk.leap = true; sk.l0 = sk.t;
        play(m, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.08, at: mv.at }); Object.assign(sk, { tUp: T(mv.up), tCatch: T(mv.catchAt), tLand: T(mv.land), tEnd: T(mv.end), x0: u.x, z0: u.z }); } }
    else { const s = sk.t - sk.l0;
      if (s < sk.tUp) { if (t) { sk.tx = t.x; sk.tz = t.z; faceAt(u, t); } sk.x0 = u.x; sk.z0 = u.z; } // (crouching: the landing spot follows the target)
      const d = Math.hypot(sk.tx - sk.x0, sk.tz - sk.z0), k = d > 0.01 ? Math.max(0, d - (u.r + (sk.tgt ? sk.tgt.r : 0.4) + 0.35)) / d : 0, x1 = sk.x0 + (sk.tx - sk.x0) * k, z1 = sk.z0 + (sk.tz - sk.z0) * k;
      if (s >= sk.tUp && s < sk.tLand) { const q = (s - sk.tUp) / (sk.tLand - sk.tUp), e = q * q * (3 - 2 * q); u.x = sk.x0 + (x1 - sk.x0) * e; u.z = sk.z0 + (z1 - sk.z0) * e; u.vx = u.vz = u.kx = u.kz = 0;
        if (!sk.trailed) { sk.trailed = true; C.parts.emit(u.x, 0.2, u.z, 12, { col: 0xc8bca8, spd: 2, up: 1, grav: 4, life: 0.5, size: 0.3 }); S.rush(sk.tLand - sk.tUp); } }
      if (!sk.recalled && s >= sk.tCatch - 0.14 && sk.ham) { sk.recalled = true; const hand = m.weap && m.weap.r ? m.weap.r.parent : null;
        if (hand) sk.ham.recall(hand); }
      if (!sk.caught && sk.ham && (sk.ham.ph === 'caught' || sk.ham.done || s >= sk.tCatch + 0.25)) { sk.caught = true; sk.ham.drop(); if (m.weap && m.weap.r) m.weap.r.visible = true; trail(u, sk.tLand - s + 0.2); }
      if (!sk.hits && s >= sk.tLand) { sk.hits = 1; if (C.floor.walk(x1, z1)) { u.x = x1; u.z = z1; } leapBurst(u, mv); }
      if (s >= sk.tEnd) end(u); }
  } else if (sk.id === 'charge' && mv.shield) { // shield charge: brace, then drive in, barging aside whatever is in the way
    if (!sk.hits) { if (t) faceAt(u, t);
      if (sk.t >= mv.brace) { const stop = t ? u.r + t.r + 0.3 : 0, d = t ? dist(u, t) : 0;
        if (!sk.rush) { sk.rush = true; S.rush(Math.min(mv.dash, Math.max(0.2, (d - stop) / mv.speed)) + 0.15); }
        if (!t || d <= stop + 0.05 || sk.t > mv.brace + mv.dash) { sk.hits = 1; sk.tb = sk.t; // up against it: the shield fanned up
          const from = u.mesh.cur; sk.upTo = play(u.mesh, mv.up, { restart: true, speed: 0, fade: mv.upT, at: mv.upAt }); sk.upFrom = from !== sk.upTo ? from : null; fanW(sk, 0);
          sk.tbHit = sk.t + mv.upHit; sk.tbEnd = sk.t + mv.upT + mv.upHold; S.swoosh(true, mv.upHit, 0.08); }
        else { const dx = (t.x - u.x) / d, dz = (t.z - u.z) / d, v = Math.min(mv.speed, (d - stop) / Math.max(dt, 0.016)); u.wantX = dx * v; u.wantZ = dz * v; u.vx = u.wantX; u.vz = u.wantZ;
          for (const h of hostilesOf(u)) { if (h === t || h.dead || sk.hit.has(h) || dist(h, u) > u.r + h.r + 0.45 || !inArc(u, h, 1.2)) continue; sk.hit.add(h); // barged aside
            damage(u, h, u.dmg * 0.5, { knock: 3, fx: u.x, fz: u.z, quiet: true }); stunHit(h, 0.5); S.clank(); }
          if (Math.random() < dt * 40) for (const sd of [-1, 1]) C.parts.emit(u.x - dx * 0.3 + dz * 0.35 * sd, 0.1, u.z - dz * 0.3 - dx * 0.35 * sd, 1, { col: 0xb8a890, spd: 0.8, up: 0.6, grav: 4, life: 0.5, size: 0.28 }); } } } // dust off both feet
    else { u.vx *= 0.6; u.vz *= 0.6; if (t && sk.t < sk.tbHit) faceAt(u, t); fanW(sk, (sk.t - sk.tb) / mv.upT);
      if (sk.hits === 1 && sk.t >= sk.tbHit) { sk.hits = 2; shieldBash(u, t || sk.tgt, mv); } if (sk.t >= sk.tbEnd) { play(u.mesh, 'Stand', { fade: 0.14 }); end(u); } }
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
  } else if (sk.id === 'whirl' && mv.hammers) {
    const len = clipDur(mv.clip) / mv.sp;
    if (!sk.hits && sk.t >= mv.at * len) { sk.hits = 1; blessedHammers(u); burst(u.x, 1.8, u.z, HOLY_C, 1.4); shock(u.x, u.z, HOLY_C, 2.4, 0.4, 0.35); }
    if (sk.t >= mv.end * len) end(u);
  } else if (sk.id === 'whirl') {
    const L = clipDur(mv.clip), len = L / mv.sp;
    while (sk.hits < mv.hits.length && sk.t >= mv.hits[sk.hits] * L / mv.sp) { whirlHit(u, mv); sk.hits++; }
    if (sk.t >= len * 0.88) end(u);
  } else if (sk.id === 'sunder') {
    if (mv.roarAt && !sk.roared && sk.t >= mv.roarAt) { sk.roared = true; if (mv.holy) { holyBurst(u); S.holy(0.8); } else { roarBurst(u); S.roar(); } // the burst throws back whatever stands close
      for (const h of hostilesOf(u)) { const d = dist(h, u); if (h.dead || d > 3.6 + h.r) continue; const l = d || 1; h.kx += (h.x - u.x) / l * 3; h.kz += (h.z - u.z) / l * 3; stunHit(h, 0.45); } }
    if (!sk.fire && sk.t >= mv.ignite) { sk.fire = bladeFire(u, mv.holy ? HOLY_FIRE : undefined); if (!mv.holy) S.ignite(); if (u.mesh.blade) u.mesh.blade.col = mv.holy ? 0xfff0b0 : 0xff6a1a; }
    if (sk.fire && !sk.strike) { const r = Math.min(1, Math.max(0, (sk.t - mv.ignite) / (mv.full - mv.ignite))); sk.fire.reach = 0.08 + 0.92 * r; sk.fire.power = 0.6 + 0.6 * r;
      if (r >= 1 && !sk.flared) { sk.flared = true; const e = u.mesh.weap.r.userData.edge; if (e) { const P = e[1].getWorldPosition(new THREE.Vector3()); burst(P.x, P.y, P.z, mv.holy ? 0xfff0b0 : 0xffb050, 1.4); } } }
    if (!sk.strike) { if (t) faceAt(u, t);
      if (sk.t >= mv.preT) { sk.strike = true; sk.st0 = sk.t; const L = clipDur(mv.clip), sp = Math.max(0.6, Math.min(2.5, L * (mv.hit - mv.at) / 0.42)); sk.tHit = L * (mv.hit - mv.at) / sp; sk.len = L * (1 - mv.at) / sp;
        play(u.mesh, mv.clip, { once: true, restart: true, speed: sp, fade: 0.06, at: mv.at }); trail(u, sk.len); S.swoosh(sk.st === 'GS', sk.tHit - 0.02); if (sk.fire) { sk.fire.reach = 1; sk.fire.power = 1.4; if (!mv.holy) S.fireSwing(sk.tHit - 0.02); } } }
    else { const s = sk.t - sk.st0; if (!sk.hits && s >= sk.tHit) { sk.hits = 1; if (mv.holy) judgement(u, mv); else sunderHit(u, mv); } if (sk.fire && s >= sk.tHit + 0.3) sk.fire.power = Math.max(0, sk.fire.power - dt * 3);
      if (s >= Math.min(sk.len * 0.8, sk.tHit + 0.6)) end(u); }
  }
};

// ---------- the blows ----------
function arcHit(u, reach, half, mult, o = {}) { let n = 0, cr = false, pl = false;
  for (const h of hostilesOf(u)) { if (h.dead || dist(h, u) > reach + h.r || !inArc(u, h, half)) continue; const crit = Math.random() < 0.15; cr = cr || crit;
    damage(u, h, u.dmg * mult * (0.9 + Math.random() * 0.2), { knock: o.knock || 0, melee: true, heavy: true, crit, critX: 1.8, quiet: true }); if (o.stun) stunHit(h, o.stun); n++; pl = pl || plated(h); }
  if (n) hitSound(u, cr, pl); return n; }
// the shield fan's blend, set by hand: the guard pose gives way to the shield-high pose on an ease-out curve
function fanW(sk, k) { if (!sk.upTo) return; k = Math.min(1, Math.max(0, k)); const w = 1 - (1 - k) ** 3;
  sk.upTo.setEffectiveWeight(w); if (sk.upFrom) sk.upFrom.setEffectiveWeight(1 - w); if (k >= 1) { if (sk.upFrom) sk.upFrom.stop(); sk.upTo = sk.upFrom = null; } }
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
  if (n) S.blade(true, false); S.slam(); shake(0.22, x, z); u.hitStop = 0.1;
  slamMark(x, z, 1.6, col, 3); burst(x, 0.4, z, col, 2.4); shock(x, z, col, mv.aoe, 0.45); shock(x, z, 0xc8bca8, mv.aoe * 1.5, 0.7, 0.3);
  C.parts.emit(x, 0.2, z, 24, { col: 0x4e443c, spd: 4.5, up: 3.2, grav: 11, life: 0.75, size: 0.3, spread: 0.6 }); // chunks of floor
  C.parts.emit(x, 0.15, z, 22, { col: 0xc8bca8, spd: 3.4, up: 0.9, grav: 1, life: 0.8, size: 0.5, spread: 0.8 }); // dust
  C.parts.emit(x, 0.3, z, 16, { col, spd: 3, up: 2, grav: 3, life: 0.5, size: 0.2 });
}
function whirlHit(u, mv) {
  let n = 0, cr = false, pl = false; for (const h of hostilesOf(u)) { if (h.dead || dist(h, u) > 2.7 + h.r) continue; const crit = Math.random() < 0.12; cr = cr || crit; pl = pl || plated(h);
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 2, melee: true, heavy: true, crit, critX: 1.8, quiet: true }); n++; }
  if (n) hitSound(u, cr, pl); shock(u.x, u.z, colOf(u), 2.7, 0.35, 0.35);
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
  S.blade(true, true); S.burst(true);
  if (mv.sweep) { // the greatsword: the fire rolls out all round (sweep = the arc it covers: a full circle) and catches each one as it gets there
    for (const h of hostilesOf(u)) { const d = dist(h, u); if (h.dead || d > CONE.range + h.r || !inArc(u, h, mv.sweep / 2 + 0.1)) continue;
      if (d < u.range + u.r + 1) hit(h); else G.fx.push({ t: Math.max(0.01, (d - 1) / 9), fn: () => { if (!h.dead) hit(h); } }); }
    shake(0.26, x, z); burst(x, 0.8, z, 0xffb050, 2.4); fireArc(x, z, u.face, CONE.range, mv.sweep);
    // then two more waves of fire roll out after it, each farther than the last, catching what stood beyond the one before
    const f0 = u.face, o = { x, z, face: f0 }; // (from where it was struck: it may have turned since)
    WAVES.forEach((w, i) => { G.fx.push({ t: w.at, fn: () => { if (u.dead) return; fireArc(x, z, f0, w.R, mv.sweep, w.life, 0.75 - 0.15 * i); shake(0.12, x, z); S.boom();
      const r0 = i ? WAVES[i - 1].R : CONE.range;
      for (const h of hostilesOf(u)) { const d = dist(h, o); if (h.dead || d <= r0 + h.r || d > w.R + h.r || !inArc(o, h, mv.sweep / 2 + 0.1)) continue;
        const e = Math.min(1, (d - 0.6) / (w.R - 0.6)), dl = (1 - Math.sqrt(1 - e)) * w.life; // when the wave's front gets there
        G.fx.push({ t: Math.max(0.01, dl), fn: () => { if (!h.dead) damage(u, h, u.dmg * mv.mult * w.mult * (0.95 + Math.random() * 0.1), { knock: 2.5, fx: x, fz: z, heavy: true, quiet: true }); } }); } } }); });
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
      damage(u, h, u.dmg * 0.9, { knock: 2, fx: x, fz: z, quiet: true }); C.parts.emit(h.x, 1.0, h.z, 8, { col, spd: 2.4, up: 1, grav: 5, life: 0.3, size: 0.15 }); if (mv.holy) S.holy(0.4); else S.blade(false, false); } });
  }
}
// ---------- Block / Parry (passive, from 10 战魂): how much of a blow gets through, and the counter it earns ----------
PH.guard = (src, u, o) => {
  if (!((u.fury || 0) >= SK.guard.at) || u.spawnT > 0 || !u.entry) return 1;
  const st = styleOf(u), mv = MOVES[st].guard, sx = o.fx ?? (src ? src.x : u.x), sz = o.fz ?? (src ? src.z : u.z);
  if (mv.all && u.shield === false) return 1; // no shield on the arm: nothing to block with
  const ang = Math.atan2(sx - u.x, sz - u.z), chance = mv.chance + Math.min(0.2, 0.01 * Math.max(0, u.fury - SK.guard.at)) + (u.blockB || 0); // each Fury stack past 10: +1%; gear on top
  if ((!mv.all && Math.abs(((ang - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 1.75) || Math.random() >= chance) return 1; // the shield: from any side; the parry: only from the front
  const e = mv.fan && u.mesh.weap && u.mesh.weap.r && u.mesh.weap.r.userData.edge, P = new THREE.Vector3();
  if (e) e[0].getWorldPosition(P); else P.set(u.x + Math.sin(ang) * 0.55, 1.1, u.z + Math.cos(ang) * 0.55); // the spark on the side it came from
  C.parts.emit(P.x, P.y, P.z, 10, { col: 0xffe6b0, spd: 3, up: 1.4, grav: 8, life: 0.25, size: 0.1 }); burst(P.x, P.y, P.z, 0xfff0c0, 0.8);
  say(u.x, u.z, mv.word, '#ffe6b0', 15, 2.1); S.block(!!src && (!!src.boss || (src.T && src.T.cls === 'brute')));
  if (!(u.ctrCD > G.t)) { u.ctrQ = { src, shot: !!o.shot, t: G.t }; u.ctrCD = G.t + 1.6; } // one counter at a time
  return o.shot && mv.missiles ? 0 : mv.keep;
};
// Life Steal (passive, 25 Fury): a share of every blow it lands comes back as life; the heal shows as one number every half second
PH.leech = (u, d) => {
  if (u.dead || !(d > 0)) return;
  if (auraOn(u)) { auraHeal(u, d * LEECH); if (!u.leechB) return; } // 圣骑士 at 25: the Aura of Light heals its whole side (holy.js); gear's life steal still only it
  const r = (!u.mesh.holy && (u.fury || 0) >= SK.leech.at ? LEECH : 0) + (u.leechB || 0); if (!r) return; const h = d * r; u.hp = Math.min(u.maxHp, u.hp + h); // (gear with life steal works at any Fury)
  if (!u.leechAcc) G.fx.push({ t: 0.45, fn: () => { const v = u.leechAcc; u.leechAcc = 0; if (u.dead || v < 1) return; say(u.x, u.z, '+' + Math.round(v), '#7dff9a', 13, 2.2);
    C.parts.emit(u.x, 1.0, u.z, 8, { col: u.mesh.holy ? HOLY_C : 0xff3a4a, spd: 0.7, up: 1.4, grav: -0.6, life: 0.55, size: 0.2, spread: 0.3 }); } });
  u.leechAcc = (u.leechAcc || 0) + h;
};
// the counter goes in as soon as it is free (between its own swings): the guard pose, then the blow
PH.counterAI = u => {
  const q = u.ctrQ; u.ctrQ = null; if (!q || G.t - q.t > 1.6 || u.state !== 'idle') return false;
  const st = styleOf(u), mv = MOVES[st].guard, t = q.src && !q.src.dead && dist(q.src, u) < 12 ? q.src : u.target && !u.target.dead ? u.target : null;
  u.state = 'pskill'; u.st = 0; u.wantX = u.wantZ = 0; u.sk = { id: 'counter', mv, st, t: 0, tgt: t, hits: 0, src: q.src, shot: q.shot }; faceAt(u, t, true);
  play(u.mesh, mv.pose, { restart: true, fade: 0.05 }); return true;
};
