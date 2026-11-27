// 魂契: the Bone Sentinel's own skills, one at each crest tier (5 / 10 / 15 / 20 战魂 stacks, lost with them when it falls). It uses them by itself (PH.skillAI is
// asked first in its melee thinking); each runs as the 'pskill' state (PH.skillTick), on the style's own Mixamo clips.
import * as THREE from 'three';
import { G } from './state.js';
import { tr } from './i18n.js';
import { C, PH, say, damage, hostilesOf, plated, shoot } from './units.js';
import { A, play, heroPart, HOLY_C } from './assets.js';
import { ZY_ROOT } from './zyroot.js';
import { ring, glowSprite } from './gfx.js';
import { burst, shake, trail, slamMark } from './fx.js';
import { S } from './audio.js';
import { bladeFire, roarBurst, qiWaves, QI, fireCone, fireArc, qiBolt, qiFan, swipeUp, HOLY_FIRE } from './pactfx.js';
import { hitBoxes } from './loot.js';
import { blessedHammers, holyBurst, judgement, HAMMERS, thrownHammer, hammerHit, leapBurst, auraOn, auraHeal, shieldRebound } from './holy.js';

export const SKILLS = [
  { id: 'charge', at: 5, cd: 8, icon: '⚡', name: tr('冲锋', 'Charge'),
    desc: tr('目标在 3.5–8 米外时突进：剑盾压低身形举盾冲撞，撞开路上的敌人，冲到面前一记盾击把目标击倒；大剑跃起跳劈，落地裂地范围伤害', 'Closes on a target 3.5–8 m away: sword & shield drives in low behind the shield, barging aside what is in the way, and ends with a shield bash that knocks the target down; the greatsword leaps and splits the ground where it lands'),
    pal: { name: tr('掷锤飞跃', 'Hammer Leap'), icon: '🔨', desc: tr('目标在 3.5–9 米外时，先把锤子掷过去：砸中眩晕 1.6 秒，锤子弹起悬在它头顶打转。随即纵身飞跃过去，半空中召回锤子高高举起，落地砸下爆出一圈圣光，2.6 米内的敌人都被震开、短暂眩晕',
      'At a target 3.5–9 m away it first hurls its mace: the blow stuns for 1.6 s and the mace bounces up to hang over it, turning. Then it leaps after it, calls the mace back into its raised hand at the top of the leap, and comes down in a burst of light that throws back and briefly stuns everything within 2.6 m') },
    spr: { name: tr('长坂冲阵', 'Changban Charge'), icon: '🐉', desc: tr('目标在 3.5–9 米外时三连突刺：第一段一路刺穿目标冲过去，第二、三段稍短，每段先转向能一口气穿过最多敌人的方向（没有更好的就折回再穿一次目标）。路上的敌人都被刺中、掀开并短暂眩晕，每段末尾再一记直刺',
      'At a target 3.5–9 m away: three dashing thrusts. The first runs straight through the target and on; the second and third are shorter, each turned first toward the line through the most of them (back through the target if nothing better). Everything in the way is run through, thrown aside and briefly stunned, and each dash ends in a thrust') } },
  { id: 'guard', at: 10, passive: true, icon: '🛡️', name: tr('格挡 / 招架', 'Block / Parry'),
    desc: tr('被动：剑盾（要装着盾牌）挨打时（任何方向）30% 几率格挡（伤害 −80%，箭和火球整个挡下），大剑正面挨打时 25% 几率招架（伤害 −60%）；战魂超过 10 层后每层再 +1% 几率（最多 +20%）。随即在普攻之间插入一次反击——剑盾举盾后直劈，剑气直线飞出约 10 米，挡下的若是飞矢就直取放箭的人；大剑架住后 180° 横扫，剑气扇面扩散约 4.5 米',
      'Passive: sword & shield (with a shield on its arm) blocks 30% of blows from any side (−80% damage, arrows and fireballs stopped whole), the greatsword parries 25% of blows from the front (−60%); +1% chance per Fury stack past 10 (at most +20%); then it slips a counter in between its swings — sword & shield cuts down from behind the shield and the sword qi flies ~10 m straight (at the shooter, if it stopped a missile); the greatsword sweeps 180° and its qi fans out ~4.5 m'),
    pal: { name: tr('圣盾反弹', 'Holy Rebound'), desc: tr('被动：装着盾牌时，任何方向挨打 30% 几率格挡（伤害 −80%，箭和火球整个挡下）；战魂超过 10 层后每层再 +1% 几率（最多 +20%）。随即在普攻之间插入一次反击：不挥锤，圣盾一亮，圣光从身上弹出——贴身的敌人被震开，一道圣光直线飞出约 10 米（挡下的若是飞矢就直取放箭的人）',
      'Passive: with a shield on its arm it blocks 30% of blows from any side (−80% damage, arrows and fireballs stopped whole); +1% chance per Fury stack past 10 (at most +20%); then it slips a counter in between its swings — no swing: its shield flares and the light rebounds out of its body, throwing back whatever stands close, and a bolt of light flies ~10 m straight (at the shooter, if it stopped a missile)') },
    spr: { name: tr('招架', 'Parry'), desc: tr('被动：正面挨打时 30% 几率用枪杆招架（伤害 −60%）；战魂超过 10 层后每层再 +1% 几率（最多 +20%）。随即摘弓回射一箭，龙光箭沿直线飞出，射穿路上所有敌人', 'Passive: 30% of blows from the front are parried on the shaft (−60% damage); +1% chance per Fury stack past 10 (at most +20%). Then he takes up his bow and looses one arrow back, a dragon-lit shaft that runs straight on through everything in the line') } },
  { id: 'whirl', at: 15, cd: 10, icon: '🌀', name: tr('旋风斩', 'Whirlwind'),
    desc: tr('身边 2.5 米内有 3 个以上敌人时转身横扫，打两段，每段向四周甩出剑气（远处的敌人也会被剑气划伤）', 'With 3+ enemies within 2.5 m, spins and cuts everything around it, twice, flinging sword qi out in every direction (it cuts what it meets further out too)'),
    pal: { name: tr('祝福之锤', 'Blessed Hammers'), icon: '🔨', cd: 11, desc: tr('身边 3 米内有 2 个以上敌人时举锤祈祷，召出 3 把圣光之锤绕着自己飞转 6 秒，忽近忽远地扫过身边一大圈，碰到的敌人都会被砸（每把锤对同一个敌人半秒砸一次）。召出后卫士照常战斗',
      'With 2+ enemies within 3 m, it raises the mace in prayer and calls 3 hammers of light that wheel round it for 6 s, swinging in close and out wide; each strikes whatever it passes through (once every half second). It fights on while they fly') },
    spr: { name: tr('枪花', 'Spear Flower'), icon: '🌀', desc: tr('身边 2.5 米内有 3 个以上敌人时舞起枪花：边转边进两圈，每圈向四周甩出枪气；随即冲向下一群敌人一记直刺，最后再转向剩下的敌人横扫一枪——每一段都朝着不同的敌群',
      'With 3+ enemies within 2.5 m it whirls into them: two turns as it goes, each flinging its qi all round; then a dash at the next crowd and a thrust, and a last sweep at whatever is left — each part aimed at a different crowd') } },
  { id: 'sunder', at: 20, cd: 15, icon: '💥', name: tr('破军一击', 'Sundering Strike'),
    desc: tr('蓄力后挥出燃火的一击：剑盾怒吼爆气、直劈，火浪沿前方扇形扫出；大剑为剑注火横扫，三道火浪一圈比一圈远地向四周扩散；非精英敌人血量低于 25% 直接斩杀', 'Gathers itself, then a burning blow: sword & shield roars and cuts down, sending a wave of fire down a cone; the greatsword fills its blade with fire and sweeps, three rings of fire rolling out all round, each farther than the last; non-elite enemies left under 25% life are cut down'),
    pal: { name: tr('审判', 'Judgement'), icon: '✨', desc: tr('聚起圣光，锤子注满光芒后砸下：一道光柱从天而降，三圈圣光向外扩散。3.5 米内重击并眩晕 1.2 秒，外两圈（到约 7 米）也会被砸到、短暂眩晕；非精英敌人血量低于 25% 当场处决',
      'Gathers the light until the mace is full of it, then brings it down: a pillar of light crashes onto the spot and three rings of it race outward. Within 3.5 m a heavy blow and a 1.2 s stun; the outer rings (to ~7 m) strike and stun briefly too; non-elite enemies left under 25% life are put down') },
    spr: { name: tr('百鸟朝凤', 'Hundred Birds'), icon: '🐦', desc: tr('4.5 米内有成群的敌人或强敌时，旋身飞踢：转身间枪尖聚起龙魂之光，每半圈都向四周斩出一记；随即突进一刺，五道龙光呈扇形向前直射约 9 米，刺穿路上所有敌人并击退；非精英敌人血量低于 25% 直接斩杀',
      'At a crowd or a hard foe within 4.5 m: a whirling tornado kick, dragon light gathering on the point as it turns, a cut all round each half turn; then a dashing thrust and five bolts of the light fanned out ahead about 9 m, running through and throwing back all in their way; non-elite enemies left under 25% life are cut down') } },
  { id: 'leech', at: 25, passive: true, icon: '🩸', name: tr('饮血', 'Life Steal'),
    desc: tr('被动：卫士造成的伤害有 10% 化为自身生命（普攻和技能都算；装备上的吸血另算，不用等到 25 层）', 'Passive: 10% of the damage the Sentinel deals heals it (swings and skills alike; life steal on gear adds to it, at any Fury)'),
    pal: { name: tr('圣光光环', 'Aura of Light'), icon: '🌟', desc: tr('被动：卫士身边 7 米是圣光光环（地上一圈金光）。卫士造成伤害的 10% 治疗光环里的每一个友军（召唤师和卫士自己都算）；光环里的友军披着一层圣光护盾，最多抵挡自身生命 20% 的伤害，2.5 秒没挨打就重新充起来，治疗溢出的部分也会充进护盾。装备上的吸血另算（只治疗卫士自己，不用等到 25 层）',
      'Passive: within 7 m of the Sentinel lies its Aura of Light (a ring of gold on the ground). 10% of the damage it deals heals every one of its side in the aura (the summoner and itself); each of them wears a shield of light that takes up to 20% of their own life in damage, fills again after 2.5 s untouched, and soaks up healing past full. Life steal on gear adds to it (healing the Sentinel only, at any Fury)') },
    spr: { name: tr('奔袭救主', 'To the Rescue'), icon: '🏇', desc: tr('被动：造成伤害的 10% 化为自身生命（同饮血）。召唤师生命一旦低于 40%，立刻锁住他的血量 3 秒；赵云闪身冲到召唤师身前挡住最近的敌人（离得远就化作龙光瞬移过去），举枪护主：这期间打向他的攻击全部挡下，随即一枪横扫，大角度扇形放出九道龙光。救主期间他造成伤害的 10% 同时治疗召唤师（最多回复召唤师 60% 生命）。冷却 40 秒',
      'Passive: 10% of the damage he deals heals him (as Life Steal). The moment the summoner falls under 40% life, his life is held for 3 s; Zhao Yun dashes to stand before him, facing the nearest foe (from far off he comes at once, in a flash of dragon light), spear raised: every blow on himself is turned aside, then a great sweep sends nine bolts of dragon light out in a wide fan. While it lasts, 10% of the damage he deals heals the summoner too (up to 60% of the summoner\'s life). 40 s cooldown') } },
];
// a skill as the given style shows it (the paladin names and tells its own)
export const skillView = (s, st) => (st === 'PAL' && s.pal ? { ...s, ...s.pal } : st === 'SPR' && s.spr ? { ...s, ...s.spr } : s);
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
// 赵云 (the spear): the two-handed clips. charge: 长坂冲阵, a lunge spear-first straight through the line (the slide attack, carried by
// hand from go to stop along a path through the target and past it — the sword-and-shield lunge: the spear point drives forward; each one near the path run through and thrown aside); guard: the
// parry and a thrust back, its qi flying down the line; whirl: 枪花, the spin; sunder: 百鸟朝凤, dragon light gathered on the point, then
// five bolts of it fanned ahead. bow: his bow, at enemies still far off (not a Fury skill: the spear's own way), three arrows and back
export const DRAGON = [0xe8f8ff, 0x9fe4ff, 0x5fb8ff, 0xffffff];
// Since Nov 26 (second version) his blows and skills are the Unreal pack's (ZY_SP_*, moved onto him by tools/bl_zy_ue.py), carried by their
// own root motion (src/zyroot.js; spMove below). Times are the clip's own seconds (at speed 1); hits: ring (all round), arc (radius,
// half-angle about where he faces), line (a thrust: length ahead of his body, half-width); from his body (the hips) where it is then
MOVES.SPR = {
  // his swings, in turn: the single thrust (a twirl overhead, then a lunge two metres in, the point four and a half out); Attack 2 Times A
  // (an overhead sweep, then a dash and a thrust); Attack 2 Times B (a dash and a thrust, then a great sweep left to right)
  atk: [{ clip: 'ZY_SP_Thrust', end: 2.45, hits: [{ at: 0.42, arc: 2.8, half: 1.75, mult: 0.98, knock: 1.6 }, { at: 1.22, line: 3.6, w: 0.75, mult: 1.89, knock: 2.6, stun: 0.25 }] },
    { clip: 'ZY_SP_Atk2A', end: 2.25, go: [[0, 1.4]], hits: [{ at: 0.27, arc: 2.8, half: 1.75, mult: 0.98, knock: 1.6 }, { at: 0.87, line: 3.4, w: 0.75, mult: 1.89, knock: 2.6, stun: 0.25 }] },
    { clip: 'ZY_SP_Atk2B', end: 2.55, go: [[0, 1.0]], hits: [{ at: 0.33, line: 3.2, w: 0.75, mult: 1.75, knock: 2.6, stun: 0.25 }, { at: 1.37, arc: 3.0, half: 1.9, mult: 1.26, knock: 2 }] }],
  atkSp: 1, // (Nov 27: at the pack's own pace — sped up, the travel and the swings fell out of step with each other to the eye)
  // all of these (attacks and skills) played PACE times as fast as the pack has them: once the spear followed Unreal's own track and the
  // travel kept to the clips' own time the person found them right, and then a little slow ("now it can be sped up some"). Everything
  // in a move — its blows, travel, turns, end — goes by the clip's own time, so a pace keeps it all in step (the arena can change it)
  pace: 1.3,
  // 长坂冲阵: Triple Thrust — three dashes, each ending in a thrust; the first runs through the target and on (as far as the old lunge),
  // the second and third shorter, each turned first toward the most it can run through (back through the target if nothing better)
  charge: { tri: true, clip: 'ZY_SP_Triple', sp: 1, end: 3.9, max: 9, past: 1.6,
    segs: [{ t0: 0, t1: 1.4, run: 4.4, dash: [0.5, 0.75] }, { t0: 1.4, t1: 2.6, run: 3.2, dash: [1.42, 1.64], turn: [1.1, 1.4], share: 0.72 }, { t0: 2.6, t1: 4.7, run: 3.3, dash: [2.64, 2.84], turn: [2.3, 2.6], share: 0.56 }],
    hits: [{ at: 0.72, line: 2.6, w: 0.7, mult: 1.2, knock: 2.6 }, { at: 1.62, line: 2.6, w: 0.7, mult: 1.2, knock: 2.6 }, { at: 2.82, line: 2.6, w: 0.7, mult: 1.5, knock: 3 }],
    mult: 1.6, side: 0.95, stun: 0.6 }, // (Nov 27: harder — the person found it weak beside his normal attacks: run-through 1.3 -> 1.6, thrusts 1.0/1.0/1.2 -> 1.2/1.2/1.5)
  guard: { chance: 0.3, keep: 0.4, word: tr('招架', 'Parry'), pose: 'ZY_SP_Parry', poseAt: 0.17, poseT: 0.12, bow: true, aimT: 0.08, sp: 1.8, mult: 1.8, pierce: 6, speed: 26, col: 0x9fe4ff }, // (the answer: an arrow, not a thrust — parry, draw and loose in half a second)
  // 枪花: Horizontal Spin Attack — two turns about himself as he goes, a dash and a thrust, a step and a sweep; each part aimed anew:
  // the spins at the crowd before him, the dash at the next crowd (the extra turn hidden in the spin), the sweep at whatever is left
  whirl: { spin: true, clip: 'ZY_SP_Spin', sp: 1, end: 3.5, aims: [[0.45, 1.2], [2.2, 2.65]], go: [[0, 1.2, 0.7], [1.2, 1.95, 'B'], [1.95, 3.7, 1]],
    hits: [{ at: 0.8, ring: 3.0, mult: 0.8, knock: 1.8 }, { at: 1.2, ring: 3.0, mult: 0.8, knock: 1.8 }, { at: 1.92, line: 3.4, w: 0.75, mult: 1.2, knock: 2.6 }, { at: 2.95, arc: 3.0, half: 1.6, mult: 0.9, knock: 2.2 }] },
  // 百鸟朝凤: Tornado Kick and Thrust — the spear gathers dragon light as he whirls and kicks (a cut all round each half turn), then a
  // dash and the thrust: five bolts of it fan out ahead (as before, harder)
  sunder: { tornado: true, clip: 'ZY_SP_Tornado', sp: 1, end: 3.9, go: [[0, 1.4, 0.6], [1.4, 2.6, 'T']], full: 2.4, strike: 2.55, max: 9, kick: 4.6,
    hits: [0.65, 0.85, 1.25, 1.45, 1.65, 1.85].map(at => ({ at, ring: 2.8, mult: 0.55, knock: 1.2 })).concat([{ at: 2.55, line: 3.6, w: 0.8, mult: 1.6, knock: 3, stun: 0.4 }]),
    dragon: true, pal: DRAGON, col: 0x9fe4ff, mult: 3.0 },
  bow: { aim: 'ZY_Archery_Shot_2', clip: 'ZY_Archery_Shot_3', rel: 0.22, sp: 1.15, stop: 0.75, min: 6, max: 13, cd: 5, n: 3, draw: 0.45, gap: 0.3, mult: 1.2, pierce: 5, speed: 20 } }; // (Nov 27: 0.55 -> 1.2 and through: they killed nothing)
// (bow: the aim held, then Archery Shot 3 once per arrow — it opens at full draw and lets go at rel of its length, the string hand
// snapping back; the last one plays on to stop, before its arms fall)
const relT = (mv, sp) => mv.rel * clipDur(MOVES.SPR.bow.clip) / (sp || MOVES.SPR.bow.sp), bowOut = (m, on) => { if (!m.weap) return; if (m.weap.r) m.weap.r.visible = !on; if (m.weap.back) m.weap.back.visible = !on; if (m.weap.bowL) m.weap.bowL.visible = on; };
const WAVES = [{ at: 0.16, R: 7.6, life: 0.6, mult: 0.6 }, { at: 0.32, R: 9.8, life: 0.66, mult: 0.4 }]; // the greatsword's sunder: the 2nd and 3rd waves
const CONE = { range: 5.5, half: 0.66 }, BOLT = { range: 10, speed: 16 }, FAN = 4.5;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const faceAt = (u, t, snap) => { if (!t) return; u.faceT = Math.atan2(t.x - u.x, t.z - u.z); if (snap) u.face = u.faceT; };
const clipDur = n => (A.heroClips[n] ? A.heroClips[n].duration : A.zy && A.zy.own[n] ? A.zy.own[n].duration : 1); // (Zhao Yun's own clips too)
const styleOf = u => { const w = u.entry && u.entry.wset; return w === 'GS' || w === 'PAL' || w === 'SPR' ? w : 'SNS'; };
const colOf = u => (u.mesh.holy ? HOLY_C : u.mesh.blade ? u.mesh.blade.col : 0xbfe6ff); // (the paladin's skills: always the gold of its light)
const hitSound = (u, cr, pl) => { const st = styleOf(u); if (st === 'PAL') S.bonk(cr, 1, pl); else S.blade(st === 'GS' || st === 'SPR', cr, pl); };
const stunHit = (h, t) => { if (h.dead || h.noStun) return; h.stun = Math.max(h.stun || 0, t); if (h.state === 'windup' || h.state === 'cast') h.state = 'idle'; };
function shock(x, z, col, r, t = 0.5, w = 0.5) { const rg = ring(0.2, w, col, 0.9); rg.position.set(x, 0.05, z); C.scene.add(rg);
  G.fx.push({ clean: true, t, tick: k => { rg.scale.setScalar(1 + k * r * 2); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) }); }
const inArc = (u, h, half) => { const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI); return da <= half; };
const coneOf = u => hostilesOf(u).filter(h => !h.dead && dist(h, u) < CONE.range + h.r && inArc(u, h, CONE.half));

function start(u, id, t) {
  const st = styleOf(u), mv = MOVES[st][id]; u.skCD = u.skCD || {}; u.skCD[id] = G.t + (mv.cd || SK[id].cd);
  u.state = 'pskill'; u.st = 0; u.wantX = u.wantZ = 0; u.sk = { id, mv, st, t: 0, tgt: t, hits: 0 }; faceAt(u, t, true);
  if (SK[id]) say(u.x, u.z, skillView(SK[id], st).name, '#' + colOf(u).toString(16).padStart(6, '0'), 16, 2.2);
  if (mv.clip && /^ZY_SP_/.test(mv.clip)) { spStart(u, u.sk); return true; } // (赵云: the Unreal moves, spTick)
  if (id === 'charge' && mv.toss) { // the throw: the overhead swing, let go of at its forward point
    const L = clipDur(mv.tclip); play(u.mesh, mv.tclip, { once: true, restart: true, speed: mv.tsp, fade: 0.06, at: mv.tat }); u.sk.tRel = (mv.release - mv.tat) * L / mv.tsp; S.swoosh(true, u.sk.tRel - 0.02, 0.15); }
  else if (id === 'charge' && mv.lunge) { // 长坂冲阵: the slide attack, its travel by hand (lunge path set as it goes)
    const L = clipDur(mv.clip), T = f => (f - mv.at) * L / mv.sp; play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.06, at: mv.at });
    Object.assign(u.sk, { tGo: T(mv.go), tStop: T(mv.stop), tEnd: T(mv.end), hit: new Set() }); trail(u, u.sk.tEnd); S.swoosh(true, u.sk.tGo, 0.2); }
  else if (id === 'bow') { const m = u.mesh; play(m, mv.aim, { restart: true, fade: 0.12 }); u.sk.n = 0; u.sk.k = 0; // the spear set aside, the bow off his back into his left hand, drawn
    bowOut(m, true); S.swoosh(false, 0.05, 0.1); }
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
  if (sk && sk.fl) { sk.fl.stop(0.2); sk.fl = null; }
  if (sk && (sk.id === 'bow' || sk.bowOut)) bowOut(m, false); // (the spear back in his hands)
  if (sk && sk.fire) { sk.fire.stop(); if (m.blade && sk.col0 != null) m.blade.col = sk.col0; }
  if (sk && sk.dashFx) sk.dashFx = null;
  u.state = 'idle'; u.sk = null; u.y = 0; u.cdT = Math.max(u.cdT, sk && sk.id === 'atk' ? 0.05 : 0.25); }

// ---------- when to use what ----------
PH.skillAI = (u, t) => {
  if (u.state !== 'idle' || !u.entry) return false;
  const L = u.fury || 0, cd = u.skCD || {}, has = id => L >= SK[id].at && !(cd[id] > G.t); // unlocked by its 战魂 stacks
  if (u.ctrQ && PH.counterAI(u)) return true; // a block or parry earned a counter: it goes in first
  const near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 2.6 + h.r);
  if (styleOf(u) === 'SPR' && t && !t.dead && !(cd.bow > G.t) && !near.length) { const B = MOVES.SPR.bow, d = dist(u, t); // (his bow: not a Fury skill)
    if (d >= B.min && d <= B.max && C.floor.los(u.x, u.z, t.x, t.z)) { start(u, 'bow', t); return true; } }
  if (styleOf(u) === 'PAL') { if (has('whirl') && !u.hammers) { const n3 = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 3 + h.r); if (n3.length >= 2) return start(u, 'whirl', t || n3[0]); } } // (the hammers: while they fly, not again)
  else if (near.length >= 3 && has('whirl')) return start(u, 'whirl', t || near[0]);
  if (!t || t.dead) return false;
  const d = dist(u, t);
  if (has('sunder') && styleOf(u) === 'SPR') { // (百鸟朝凤: at a crowd or a hard one close by — its kicks cut all round him 1.5-2.5 m out
    // from where he starts (Nov 27: from as far as 9 m off they whirled at nothing, only the last thrust reaching): the target within
    // KICK m, and two or more within 3 m of the kicks' middle (1.8 m toward it)
    const K = MOVES.SPR.sunder, a = Math.atan2(t.x - u.x, t.z - u.z), mx = u.x + Math.sin(a) * Math.min(d, 1.8), mz = u.z + Math.cos(a) * Math.min(d, 1.8);
    const n = hostilesOf(u).filter(h => !h.dead && Math.hypot(h.x - mx, h.z - mz) < 3 + h.r).length;
    if (d < K.kick + t.r && (n >= 2 || t.champ || t.maxHp > u.dmg * 3) && C.floor.clear(u.x, u.z, t.x, t.z, u.r)) return start(u, 'sunder', t); }
  else if (has('sunder') && d < u.range + u.r + t.r + 1.2) { faceAt(u, t, true); const n = coneOf(u).length; if (n >= 2 || t.champ || t.maxHp > u.dmg * 3) return start(u, 'sunder', t); }
  if (has('charge') && d > 3.5 && d < (MOVES[styleOf(u)].charge.max || 8) && C.floor.clear(u.x, u.z, t.x, t.z, u.r + 0.1)) return start(u, 'charge', t);
  return false;
};

// ---------- running one ----------
PH.skillTick = (u, dt) => {
  const sk = u.sk; if (!sk) { end(u); return; }
  sk.t += dt; u.wantX = u.wantZ = 0; const mv = sk.mv, t = sk.tgt && !sk.tgt.dead ? sk.tgt : null;
  if (sk.id === 'rescue') { rescueTick(u, dt); return; }
  if (mv && mv.clip && /^ZY_SP_/.test(mv.clip)) { spTick(u, dt); return; }
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
  } else if (sk.id === 'charge' && mv.lunge) { // 长坂冲阵: aim while it gathers, then the run through
    if (sk.t < sk.tGo || !sk.x1) { if (t) faceAt(u, t); const a = t ? Math.atan2(t.x - u.x, t.z - u.z) : u.face, dx = Math.sin(a), dz = Math.cos(a), d = t ? dist(u, t) : 3;
      let L = d + mv.past; while (L > 0.5 && !C.floor.clear(u.x, u.z, u.x + dx * L, u.z + dz * L, u.r)) L -= 0.4; // (stopped short by a wall)
      Object.assign(sk, { x0: u.x, z0: u.z, x1: u.x + dx * Math.max(0.5, L), z1: u.z + dz * Math.max(0.5, L) }); }
    if (sk.t >= sk.tGo && sk.t < sk.tStop) { const q = (sk.t - sk.tGo) / (sk.tStop - sk.tGo), e = 1 - (1 - q) * (1 - q), px = u.x, pz = u.z;
      u.x = sk.x0 + (sk.x1 - sk.x0) * e; u.z = sk.z0 + (sk.z1 - sk.z0) * e; u.vx = u.vz = u.kx = u.kz = 0;
      if (!sk.rush) { sk.rush = true; S.rush(sk.tStop - sk.tGo); }
      const fx = Math.sin(u.face), fz = Math.cos(u.face);
      for (const h of hostilesOf(u)) { if (h.dead || sk.hit.has(h) || dist(h, u) > u.r + h.r + mv.side) continue; sk.hit.add(h); // run through, thrown aside (to whichever side it stood)
        const sd = Math.sign((h.x - u.x) * fz - (h.z - u.z) * fx) || 1; damage(u, h, u.dmg * mv.mult * (h === t ? 1.25 : 1) * (0.9 + Math.random() * 0.2), { knock: 0, melee: true, heavy: true, quiet: true });
        h.kx += fz * sd * 3.2 + fx * 1.2; h.kz += -fx * sd * 3.2 + fz * 1.2; stunHit(h, mv.stun); hitSound(u, false, plated(h)); C.parts.emit(h.x, 1.0, h.z, 8, { col: colOf(u), spd: 2.4, up: 1, grav: 5, life: 0.3, size: 0.15 }); }
      if (Math.random() < dt * 40) C.parts.emit(px, 0.1, pz, 1, { col: 0xb8a890, spd: 0.8, up: 0.6, grav: 4, life: 0.5, size: 0.28 }); hitBoxes(u.x, u.z, 0.9); }
    if (!sk.hits && sk.t >= sk.tStop) { sk.hits = 1; shake(0.1, u.x, u.z); burst(u.x + Math.sin(u.face) * 1.6, 1.0, u.z + Math.cos(u.face) * 1.6, colOf(u), 1.2); }
    if (sk.t >= sk.tEnd) end(u);
  } else if (sk.id === 'bow') { // his bow: drawn, then the arrows one after another at the target (or whatever is nearest in reach once it falls)
    let a = t; if (!a) { let bd = mv.max + 1; for (const h of hostilesOf(u)) { const d = dist(h, u); if (!h.dead && d < bd) { bd = d; a = h; } } }
    if (a) faceAt(u, a);
    while (a && sk.k < mv.n && sk.t >= mv.draw + sk.k * mv.gap - relT(mv)) { sk.k++; play(u.mesh, mv.clip, { once: true, restart: true, speed: mv.sp, fade: 0.05 }); } // (each arrow: the release, from full draw)
    while (a && sk.n < mv.n && sk.t >= mv.draw + sk.n * mv.gap) { sk.n++; const g = u.mesh.weap && u.mesh.weap.bowL, P = new THREE.Vector3(u.x, 1.4, u.z); if (g) g.getWorldPosition(P);
      const lead = dist(u, a) / mv.speed; shoot(u, 'arrow', a.x + (a.vx || 0) * lead, a.z + (a.vz || 0) * lead, { dmg: u.dmg * mv.mult * zyK(u), pierce: mv.pierce, sp: mv.speed, life: (mv.max + 2) / mv.speed, glow: 0xcfeeff, from: P, yTo: 0.9, dTo: dist(u, a) }); // (from the bow, down to the chest by the target)
      S.shot('bow', 0.8); C.parts.emit(P.x, P.y, P.z, 4, { col: 0xcfeeff, spd: 1, up: 0.4, grav: 0, life: 0.2, size: 0.12 }); }
    if (sk.t >= mv.draw + (mv.n - 1) * mv.gap + (mv.stop - mv.rel) * clipDur(mv.clip) / mv.sp || (!a && sk.n)) end(u);
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
    if (!sk.whoosh && sk.t >= sk.tUp - 0.3) { sk.whoosh = true; S.leap(Math.max(0, sk.tUp - sk.t)); } // the air it tears through, from the spring off
    if (sk.t < sk.tUp && t) { faceAt(u, t); const d = dist(u, t), k = Math.max(0, d - (u.r + t.r + 0.3)) / (d || 1); sk.x1 = u.x + (t.x - u.x) * k; sk.z1 = u.z + (t.z - u.z) * k; sk.x0 = u.x; sk.z0 = u.z; sk.lh = 0.3 + d * 0.08; }
    if (sk.t >= sk.tUp && sk.t < sk.tLand) { const k = (sk.t - sk.tUp) / (sk.tLand - sk.tUp), e = k * k * (3 - 2 * k);
      u.x = sk.x0 + (sk.x1 - sk.x0) * e; u.z = sk.z0 + (sk.z1 - sk.z0) * e; u.y = Math.sin(Math.PI * k) * sk.lh; u.vx = u.vz = u.kx = u.kz = 0; }
    if (!sk.hits && sk.t >= sk.tLand) { sk.hits = 1; u.y = 0; if (C.floor.walk(sk.x1, sk.z1)) { u.x = sk.x1; u.z = sk.z1; } leapLand(u, mv); }
    if (sk.t >= sk.tEnd) end(u);
  } else if (sk.id === 'counter' && mv.bow) { // Zhao Yun: the spear's parry, then the bow — drawn, and one arrow loosed back down the line, through all it meets
    const B = MOVES.SPR.bow, aim = sk.src && !sk.src.dead && dist(sk.src, u) < 16 ? sk.src : t; if (aim) faceAt(u, aim);
    if (!sk.bowOut && sk.t >= mv.poseT) { sk.bowOut = true; bowOut(u.mesh, true); play(u.mesh, B.aim, { restart: true, fade: 0.08 }); S.swoosh(false, 0.02, 0.1); }
    if (sk.bowOut && !sk.loose && sk.t >= mv.poseT + mv.aimT) { sk.loose = sk.t; play(u.mesh, B.clip, { once: true, restart: true, speed: mv.sp, fade: 0.04 }); }
    if (sk.loose && !sk.hits && sk.t >= sk.loose + relT(B, mv.sp)) { sk.hits = 1; const ang = aim ? Math.atan2(aim.x - u.x, aim.z - u.z) : u.face, g = u.mesh.weap && u.mesh.weap.bowL, P = new THREE.Vector3(u.x, 1.4, u.z); if (g) g.getWorldPosition(P);
      shoot(u, 'arrow', P.x + Math.sin(ang) * 10, P.z + Math.cos(ang) * 10, { dmg: u.dmg * mv.mult, sp: mv.speed, life: 16 / mv.speed, glow: mv.col, pierce: mv.pierce, from: P, yTo: 0.9, dTo: aim ? Math.max(1, dist(aim, u)) : 4 });
      S.shot('bow', 1); S.qi(0); C.parts.emit(P.x, P.y, P.z, 10, { col: mv.col, spd: 1.6, up: 0.4, grav: 0, life: 0.3, size: 0.16 }); burst(P.x, P.y, P.z, mv.col, 0.8); }
    if (sk.loose && sk.t >= sk.loose + B.stop * clipDur(B.clip) / mv.sp) end(u);
  } else if (sk.id === 'counter') { // the guard pose for a beat, then the counter and its sword qi (the paladin: no swing — it stays behind its shield and the light rebounds)
    if (!sk.swung) { if (t) faceAt(u, t);
      if (sk.t >= mv.poseT && mv.holy) { sk.swung = true; sk.s0 = sk.t; sk.tHit = 0.06; }
      else if (sk.t >= mv.poseT) { sk.swung = true; sk.s0 = sk.t; const L = clipDur(mv.clip), sp = Math.max(0.7, Math.min(2.6, L * (mv.hit - mv.at) / 0.3)); sk.tHit = L * (mv.hit - mv.at) / sp;
        play(u.mesh, mv.clip, { once: true, restart: true, speed: sp, fade: 0.06, at: mv.at }); trail(u, sk.tHit + 0.35); if (sk.st === 'GS') S.swoosh(true, sk.tHit - 0.02, 0.15); else S.qi(sk.tHit - 0.02); } }
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
    if (mv.roarAt && !sk.roared && sk.t >= mv.roarAt) { sk.roared = true; if (mv.holy) { holyBurst(u); S.warcry(true); } else { roarBurst(u); S.warcry(false); } // the burst throws back whatever stands close
      for (const h of hostilesOf(u)) { const d = dist(h, u); if (h.dead || d > 3.6 + h.r) continue; const l = d || 1; h.kx += (h.x - u.x) / l * 3; h.kz += (h.z - u.z) / l * 3; stunHit(h, 0.45); } }
    if (!sk.fire && sk.t >= mv.ignite) { sk.fire = bladeFire(u, mv.pal || (mv.holy ? HOLY_FIRE : undefined)); if (!mv.holy) { if (sk.st === 'GS' || sk.st === 'SPR') S.ignite(); sk.fl = S.fireLoop(); } if (u.mesh.blade) u.mesh.blade.col = mv.col || (mv.holy ? 0xfff0b0 : 0xff6a1a); }
    if (sk.fire && !sk.strike) { const r = Math.min(1, Math.max(0, (sk.t - mv.ignite) / (mv.full - mv.ignite))); sk.fire.reach = 0.08 + 0.92 * r; sk.fire.power = 0.6 + 0.6 * r;
      if (r >= 1 && !sk.flared) { sk.flared = true; const e = u.mesh.weap.r.userData.edge; if (e) { const P = e[1].getWorldPosition(new THREE.Vector3()); burst(P.x, P.y, P.z, mv.col || (mv.holy ? 0xfff0b0 : 0xffb050), 1.4); } } }
    if (!sk.strike) { if (t) faceAt(u, t);
      if (sk.t >= mv.preT) { sk.strike = true; sk.st0 = sk.t; const L = clipDur(mv.clip), sp = Math.max(0.6, Math.min(2.5, L * (mv.hit - mv.at) / 0.42)); sk.tHit = L * (mv.hit - mv.at) / sp; sk.len = L * (1 - mv.at) / sp;
        play(u.mesh, mv.clip, { once: true, restart: true, speed: sp, fade: 0.06, at: mv.at }); trail(u, sk.len); S.swoosh(sk.st === 'GS' || sk.st === 'SPR', sk.tHit - 0.02); if (sk.fire) { sk.fire.reach = 1; sk.fire.power = 1.4; if (!mv.holy) S.fireSwing(sk.tHit - 0.02); } } }
    else { const s = sk.t - sk.st0; if (!sk.hits && s >= sk.tHit) { sk.hits = 1; if (mv.holy) judgement(u, mv); else if (mv.dragon) dragonHit(u, mv); else sunderHit(u, mv); } if (sk.fire && s >= sk.tHit + 0.3) { sk.fire.power = Math.max(0, sk.fire.power - dt * 3); if (sk.fl) { sk.fl.stop(0.45); sk.fl = null; } }
      if (s >= Math.min(sk.len * 0.8, sk.tHit + 0.6)) end(u); }
  }
};


// ---------- 赵云: the Unreal pack's moves (ZY_SP_*), carried by their own root motion ----------
// The clips leave out UE's root motion (tools/bl_zy_ue.py); src/zyroot.js has it per frame. Each frame the root's step since the last,
// taken in the root's own frame, is walked where he now faces (times k: a part's travel stretched or cut to where it should take him; a
// wall stops it), and the root's turn turns him — so a turn of ours between a move's parts turns the rest of its path with him.
const _r0 = [0, 0, 0], _r1 = [0, 0, 0], _hp = new THREE.Vector3();
function rootAt(name, t, o) { const a = ZY_ROOT[name]; if (!a) { o[0] = o[1] = o[2] = 0; return o; } const n = a.length / 3, f = Math.max(0, Math.min(n - 1, t * 30)), i = Math.max(0, Math.min(n - 2, Math.floor(f))), k = f - i, j1 = Math.min(n - 1, i + 1);
  for (let j = 0; j < 3; j++) o[j] = a[i * 3 + j] + (a[j1 * 3 + j] - a[i * 3 + j]) * k; return o; }
const fwdAt = (name, t) => rootAt(name, t, [0, 0, 0])[0];
const wrapA = a => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI, angTo = (u, t) => Math.atan2(t.x - u.x, t.z - u.z);
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const bodyAt = u => { const m = u.mesh, h = m.hipsB || (m.hipsB = m.model.getObjectByName('mixamorigHips')); if (!h) return { x: u.x, z: u.z }; h.getWorldPosition(_hp); return { x: _hp.x, z: _hp.z }; };
function spCarry(u, sk, c0, c1, k) {
  rootAt(sk.mv.clip, c0, _r0); rootAt(sk.mv.clip, c1, _r1);
  const y0 = _r0[2], df = _r1[0] - _r0[0], dl = _r1[1] - _r0[1], lf = df * Math.cos(y0) + dl * Math.sin(y0), ll = -df * Math.sin(y0) + dl * Math.cos(y0);
  const S = u.mesh.model.scale.x * k, f = u.face, dx = (Math.sin(f) * lf + Math.cos(f) * ll) * S, dz = (Math.cos(f) * lf - Math.sin(f) * ll) * S;
  if (Math.abs(dx) + Math.abs(dz) > 1e-5 && !sk.blocked) { if (C.floor.clear(u.x, u.z, u.x + dx, u.z + dz, u.r)) { u.x += dx; u.z += dz; } else sk.blocked = true; } // (a wall: he goes no further this move)
  u.face += _r1[2] - y0; u.faceT = u.face; u.vx = u.vz = u.kx = u.kz = 0;
}
// a blow of one of these moves (from his body where it is now): ring, arc or line, each foe once; its qi flies on out past the point
function spHit(u, sk, h) {
  const b = bodyAt(u), f = u.face + (h.off || 0), fx = Math.sin(f), fz = Math.cos(f), col = colOf(u), R = h.ring || h.arc || h.line; let n = 0, cr = false, pl = false;
  for (const e of hostilesOf(u)) { if (e.dead) continue; const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz); let ok;
    if (h.line) { const al = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx); ok = al > -0.5 - e.r && al < h.line + e.r && lat < (h.w || 0.7) + e.r; }
    else ok = d < R + e.r && (!!h.ring || d < 0.9 + e.r || Math.abs(wrapA(Math.atan2(dx, dz) - f)) <= h.half);
    if (!ok) continue; const crit = Math.random() < (u.crit ?? 0.1); cr = cr || crit; pl = pl || plated(e);
    damage(u, e, u.dmg * h.mult * (sk.dmgK || 1) * (0.9 + Math.random() * 0.2) * (e === sk.tgt ? 1.15 : 1), { knock: h.knock ?? 2, fx: b.x, fz: b.z, melee: true, heavy: true, crit, critX: 1.8, quiet: true });
    if (h.stun) stunHit(e, h.stun); n++; }
  if (n) hitSound(u, cr, pl); hitBoxes(b.x, b.z, R, h.ring ? null : f, h.ring ? Math.PI : h.line ? 0.45 : h.half);
  if (h.line) qiBolt(b.x, b.z, f, col, h.line, 30, null); else if (h.ring) { qiWaves(b.x, b.z, col, 8, Math.random() * 6.3); shock(b.x, b.z, col, R, 0.35, 0.35); } else qiFan(b.x, b.z, f, col, R);
  return n;
}
// where the most of them stand together within reach (each one counted with those within 2.5 m of it), not too close to `avoid` (a
// direction already taken: soft — if that is the only crowd, it goes there again): its direction, distance and the foe at its heart
function crowd(u, reach, avoid) { let best = null, bs = -1e9; const H = hostilesOf(u).filter(h => !h.dead && dist(h, u) < reach);
  for (const h of H) { const n = H.filter(o => Math.hypot(o.x - h.x, o.z - h.z) < 2.5).length, a = angTo(u, h); let sc = n - dist(h, u) * 0.08;
    if (avoid != null && Math.abs(wrapA(a - avoid)) < 0.8) sc -= 1.5; if (sc > bs) { bs = sc; best = { a, d: dist(h, u), e: h }; } }
  return best; }
// the line through the most of them, from here, length D (the next dash): toward one of them; null if none in reach
function lineThrough(u, D, prefer) { let best = null, bs = -1e9; const H = hostilesOf(u).filter(h => !h.dead && dist(h, u) < D + 2);
  for (const h of H) { const a = angTo(u, h), fx = Math.sin(a), fz = Math.cos(a); let n = 0;
    for (const o of H) { const dx = o.x - u.x, dz = o.z - u.z, al = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx); if (al > 0 && al < D + 1 && lat < 1.1 + o.r) n++; }
    const sc = n + (h === prefer ? 0.6 : 0) - dist(h, u) * 0.03; if (sc > bs) { bs = sc; best = a; } }
  return best; }
// 赵云's moves play at a fixed pace (the clips' own, × pace), so his attack speed goes into the force of every blow instead — his normal
// attacks had it; his skills and his bow now too (they had fallen far behind his attacks)
const zyK = u => (u.cd0 && u.cd ? u.cd0 / u.cd : 1);
// the clip's own time (the action's, as the mixer has it: the pose on screen; a chill or a skipped far-off frame slows both alike)
const clipT = (u, sk) => sk.act && u.mesh.cur === sk.act ? Math.max(sk.ct || 0, sk.act.time) : sk.t * sk.sp;
function spStart(u, sk) {
  const mv = sk.mv, m = u.mesh, t = sk.tgt; sk.sp = (sk.sp || mv.sp || 1) * (globalThis.__zyPace ?? MOVES.SPR.pace); sk.dmgK = sk.dmgK || zyK(u); sk.ct = 0; sk.hitI = 0; sk.f0 = u.face; sk.turn = []; sk.runHit = new Set();
  sk.act = play(m, mv.clip, { once: true, restart: true, speed: sk.sp, fade: 0.08 }); trail(u, mv.end / sk.sp);
  for (const h of mv.hits) S.swoosh(true, Math.max(0, h.at / sk.sp - 0.03), 0.14);
  if (mv.go && t) { const g = mv.go[0], run = fwdAt(mv.clip, g[1]) - fwdAt(mv.clip, g[0]); if (g[2] == null && run > 0.2) sk.kGo = Math.max(0.2, Math.min(1.15, (dist(u, t) - (u.r + t.r + 0.9)) / (run * m.model.scale.x))); }
  if (mv.tri) { const D = Math.max(3, Math.min(mv.max, (t ? dist(u, t) : 4) + mv.past)); sk.D1 = D; sk.kSeg = [D / (mv.segs[0].run * m.model.scale.x)]; S.rush(0.3); }
  if (mv.tornado) { sk.col0 = m.blade && m.blade.col; sk.fire = bladeFire(u, mv.pal); if (m.blade) m.blade.col = mv.col; sk.fire.reach = 0.1; sk.fire.power = 0.5; S.ignite(); }
}
// the travel stretch for the part of the move clip time c is in
// the part of the move clip time c is in: its travel stretch k, its span [t0, t1], and its thrust (the first line blow in it: when the
// point goes all the way out — most of these thrust fully only at the very end of their dash)
function spPart(u, sk, c) { const mv = sk.mv; let k = 1, t0 = 0, t1 = mv.end;
  if (mv.tri) { let i = mv.segs.findIndex(g => c < g.t1); if (i < 0) i = mv.segs.length - 1; k = sk.kSeg[i] ?? 1; t0 = mv.segs[i].t0; t1 = mv.segs[i].t1; }
  else if (mv.go) { const g = mv.go.find(g => c < g[1]) || mv.go[mv.go.length - 1]; t0 = g[0]; t1 = g[1];
    k = typeof g[2] === 'number' ? g[2] : g[2] === 'B' ? (sk.kB ?? 1) : g[2] === 'T' ? (sk.kT ?? 1) : (sk.kGo ?? 1); }
  const th = mv.hits.find(h => h.line && h.at >= t0 - 0.05 && h.at <= t1 + 0.15); return { k, t0, t1, peak: th ? th.at : t1 }; }
// a part's travel: cut short, the clip's own steps shrunk evenly; stretched, the clip's own steps as they are and the extra run in
// around its thrust (from a quarter second before the point goes out to just after), so the point leads him on (the person: "the
// spear's point out ahead of him as he goes")
function spGo(u, sk, c0, c1) { const P = spPart(u, sk, c1);
  if (P.k <= 1) { spCarry(u, sk, c0, c1, P.k); return; }
  spCarry(u, sk, c0, c1, 1);
  const run = fwdAt(sk.mv.clip, P.t1) - fwdAt(sk.mv.clip, P.t0), a = P.peak - 0.25, b = P.peak + 0.06, w = smooth(a, b, c1) - smooth(a, b, c0);
  if (w <= 0 || run <= 0.05 || sk.blocked) return; const d = (P.k - 1) * run * u.mesh.model.scale.x * w, dx = Math.sin(u.face) * d, dz = Math.cos(u.face) * d;
  if (C.floor.clear(u.x, u.z, u.x + dx, u.z + dz, u.r)) { u.x += dx; u.z += dz; } else sk.blocked = true; }
function spTick(u, dt) {
  const sk = u.sk, mv = sk.mv, m = u.mesh, c0 = sk.ct, c1 = (sk.ct = clipT(u, sk)), t = sk.tgt && !sk.tgt.dead ? sk.tgt : null, S1 = m.model.scale.x;
  // turned toward the target while it gathers (the swings: up to just before each blow; the tornado: till its dash)
  const nh = mv.hits[sk.hitI], track = mv.tornado ? c1 < 1.4 : !mv.tri && !mv.spin && nh && c1 < nh.at - 0.1;
  if (track && t) u.face += wrapA(angTo(u, t) - u.face) * Math.min(1, dt * 10);
  // the triple thrust: before the 2nd and 3rd dashes, turned to the line through the most of them (back through the target at worst)
  if (mv.tri) mv.segs.forEach((g, i) => { if (!g.turn || c0 >= g.turn[0] || c1 < g.turn[0]) return; const D = Math.max(2.5, sk.D1 * g.share);
    const a = lineThrough(u, D, sk.tgt && !sk.tgt.dead ? sk.tgt : null) ?? wrapA(u.face + Math.PI); sk.kSeg[i] = D / (g.run * S1); sk.turn.push([g.turn[0], g.turn[1], wrapA(a - u.face)]); });
  // the spin: the dash aimed at the next crowd (its extra turn spread through the spin), the closing sweep at whatever is left
  if (mv.spin) { const A0 = mv.aims[0], A1 = mv.aims[1];
    if (c0 < A0[0] && c1 >= A0[0]) { const B = crowd(u, 9, sk.f0), aB = B ? B.a : sk.f0; sk.aB = aB; sk.turn.push([A0[0], A0[1], wrapA(aB - sk.f0)]);
      const run = fwdAt(mv.clip, 1.95) - fwdAt(mv.clip, 1.2); sk.kB = B ? Math.max(0.15, Math.min(1.1, (B.d - 1.5) / (run * S1))) : 0.4; }
    if (c0 < A1[0] && c1 >= A1[0]) { const C3 = crowd(u, 6, sk.aB); if (C3) sk.turn.push([A1[0], A1[1], wrapA(C3.a - u.face)]); } }
  // the tornado's dash: stretched or cut so the thrust lands just short of the target
  if (mv.tornado && c0 < 1.4 && c1 >= 1.4) { const run = fwdAt(mv.clip, 2.6) - fwdAt(mv.clip, 1.4); sk.kT = t ? Math.max(0.03, Math.min(1.05, (dist(u, t) - 2.4) / (run * S1))) : 0.3; }
  for (const [a, b, d] of sk.turn) u.face += (smooth(a, b, c1) - smooth(a, b, c0)) * d;
  spGo(u, sk, c0, c1);
  // the triple thrust's dashes run through what is in the way: struck once a dash, thrown aside, stunned a moment
  if (mv.tri) { const i = mv.segs.findIndex(g => c1 >= g.dash[0] && c1 < g.dash[1]);
    if (i >= 0) { if (sk.seg !== i) { sk.seg = i; sk.runHit = new Set(); S.rush(0.25); } const b = bodyAt(u), fx = Math.sin(u.face), fz = Math.cos(u.face);
      for (const h of hostilesOf(u)) { if (h.dead || sk.runHit.has(h) || Math.hypot(h.x - b.x, h.z - b.z) > u.r + h.r + mv.side) continue; sk.runHit.add(h);
        const sd = Math.sign((h.x - b.x) * fz - (h.z - b.z) * fx) || 1; damage(u, h, u.dmg * mv.mult * (sk.dmgK || 1) * (h === t ? 1.25 : 1) * (0.9 + Math.random() * 0.2), { knock: 0, melee: true, heavy: true, quiet: true });
        h.kx += fz * sd * 3.2 + fx * 1.2; h.kz += -fx * sd * 3.2 + fz * 1.2; stunHit(h, mv.stun); hitSound(u, false, plated(h)); C.parts.emit(h.x, 1.0, h.z, 8, { col: colOf(u), spd: 2.4, up: 1, grav: 5, life: 0.3, size: 0.15 }); }
      if (Math.random() < dt * 40) C.parts.emit(u.x, 0.1, u.z, 1, { col: 0xb8a890, spd: 0.8, up: 0.6, grav: 4, life: 0.5, size: 0.28 }); } }
  // the tornado: dragon light gathering on the spear as he whirls, then the thrust and the five bolts
  if (mv.tornado && sk.fire && !sk.struck) { const r = Math.min(1, c1 / mv.full); sk.fire.reach = 0.1 + 0.9 * r; sk.fire.power = 0.5 + 0.8 * r;
    if (c1 >= mv.strike) { sk.struck = true; dragonHit(u, mv, sk.dmgK || 1); sk.fire.power = 1.4; if (sk.fl) { sk.fl.stop(0.3); sk.fl = null; } } }
  if (mv.tornado && sk.struck && sk.fire) sk.fire.power = Math.max(0, sk.fire.power - dt * 2.5);
  while (sk.hitI < mv.hits.length && c1 >= mv.hits[sk.hitI].at) spHit(u, sk, mv.hits[sk.hitI++]);
  if (c1 >= mv.end) end(u);
}
// his swings (in place of the windup and strike of the others): a move of its own each, in turn; the next as soon as one is done
PH.heroAtk = (u, t) => {
  if (styleOf(u) !== 'SPR' || !A.zy || !A.zy.own.ZY_SP_Thrust || !t || t.dead) return false;
  const L = MOVES.SPR.atk, mv = L[(u.atkI = (u.atkI || 0) + 1) % L.length], W = u.entry && u.entry.wset;
  u.state = 'pskill'; u.st = 0; u.wantX = u.wantZ = 0; u.lastAtk = G.t; faceAt(u, t, true);
  // attack speed (Fury, gear) goes into the blows, not the pace: the moves keep the pack's own timing
  const f = u.cd0 && u.cd ? u.cd0 / u.cd : 1;
  u.sk = { id: 'atk', mv: { ...mv, zy: true }, st: 'SPR', t: 0, tgt: t, hits: 0, sp: MOVES.SPR.atkSp, dmgK: f };
  spStart(u, u.sk); return true;
};


// ---------- 奔袭救主 (赵云 at 25 Fury; his Life Steal stays and comes with it) ----------
// The moment the summoner's life falls under 40% it is held there (RESCUE.lock s: no blow takes any more), and he comes for him — a
// sidelong dash (the pack's dodges, stretched to the distance) when within RESCUE.near, else at once in a flash of dragon light — to
// stand between the summoner and the nearest threat, spear up: every blow on himself turned aside meanwhile, then a great sweep, a wide
// fan of dragon light (RESCUE.n bolts over RESCUE.span); the damage he deals while it lasts heals the summoner too (RESCUE.heal of it, as his
// own life steal; at most RESCUE.healMax of the summoner's life in one rescue — his blows are big beside the summoner's life). Nov 27 (the
// person: "the summoner can't get his life back at all"): RESCUE.now of it at once as he arrives, the share of his blows 0.1 -> 0.4, the
// cap 0.6 -> 0.7 (the first heal included), and his sweep and fan of light take his attack-speed factor like his other moves
const RESCUE = { at: 0.4, cd: 40, lock: 3.2, near: 6.5, guard: 2.3, heal: 0.4, now: 0.2, healMax: 0.7, n: 9, span: 2.6, range: 9.5, mult: 1.6, dodgeSp: 2.2, dodgeEnd: 1.05, sweep: [1.15, 1.37, 1.6] };
function rescueFlash(x, z) { burst(x, 1.0, z, 0x9fe4ff, 2.4); shock(x, z, 0x9fe4ff, 1.8, 0.45, 0.4); S.qi(0);
  C.parts.emit(x, 1.0, z, 26, { col: 0xcfeeff, spd: 3, up: 1.6, grav: 0.5, life: 0.5, size: 0.22, spread: 0.5 }); C.parts.emit(x, 0.2, z, 14, { col: 0x5fb8ff, spd: 1.6, up: 2.6, grav: -1, life: 0.7, size: 0.3 }); }
PH.rescue = (P, d) => { // damage() asks before a blow on the summoner lands: 1 — held (it takes nothing), 2 — the rescue starts now (it cannot kill)
  if (P.hpLock > G.t) { if (!(P.lockSay > G.t)) { P.lockSay = G.t + 0.7; say(P.x, P.z, tr('锁血', 'Held'), '#9fe4ff', 14, 1.6); } return 1; }
  if (P.hp - d > P.maxHp * RESCUE.at) return 0;
  const u = G.units.find(x => x.pact && !x.dead); if (!u || styleOf(u) !== 'SPR' || (u.fury || 0) < SK.leech.at || u.spawnT > 0 || u.rescueCD > G.t) return 0;
  startRescue(u, P); return 2;
};
function startRescue(u, P) {
  if (u.state === 'pskill' && u.sk) end(u); // (whatever he was about: dropped)
  S.voice('zy_rescue'); // ("休伤我主!")
  P.hpLock = G.t + RESCUE.lock; P.lockSay = G.t + 0.7; u.rescueCD = G.t + RESCUE.cd; u.rescueT = G.t + RESCUE.lock; u.rescueHeal = P.maxHp * RESCUE.healMax;
  let th = null, bd = 1e9; for (const h of hostilesOf(u)) { const dd = Math.hypot(h.x - P.x, h.z - P.z); if (!h.dead && dd < bd) { bd = dd; th = h; } }
  const a = th ? Math.atan2(th.x - P.x, th.z - P.z) : P.face || 0; let sx = P.x + Math.sin(a) * 1.3, sz = P.z + Math.cos(a) * 1.3; if (!C.floor.walk(sx, sz)) { sx = P.x; sz = P.z; }
  u.state = 'pskill'; u.st = 0; u.wantX = u.wantZ = 0;
  const sk = u.sk = { id: 'rescue', st: 'SPR', mv: { clip: '', end: 0, hits: [] }, t: 0, tgt: th, P, a, sx, sz, hits: 0, turn: [] };
  say(u.x, u.z, skillView(SK.leech, 'SPR').name, '#9fe4ff', 17, 2.4); say(P.x, P.z, tr('锁血', 'Held'), '#9fe4ff', 15, 2);
  const d = Math.hypot(sx - u.x, sz - u.z), ad = Math.atan2(sx - u.x, sz - u.z);
  if (d > RESCUE.near || !C.floor.clear(u.x, u.z, sx, sz, u.r)) { rescueFlash(u.x, u.z); u.x = sx; u.z = sz; rescueFlash(sx, sz); rescueGuard(u, sk); } // too far, or a wall between: at once
  else if (d > 0.7) { // the dodge that carries him toward the spot (whichever leaves him facing nearer the threat), stretched to the distance
    const left = Math.abs(wrapA(ad - Math.PI / 2 - a)) <= Math.abs(wrapA(ad + Math.PI / 2 - a)), clip = left ? 'ZY_SP_DodgeL' : 'ZY_SP_DodgeR';
    u.face = u.faceT = left ? ad - Math.PI / 2 : ad + Math.PI / 2; sk.mv = { clip, end: RESCUE.dodgeEnd, hits: [] }; sk.sp = RESCUE.dodgeSp; sk.ct = 0;
    sk.kD = d / (Math.abs(rootAt(clip, 9, [0, 0, 0])[1]) * u.mesh.model.scale.x); sk.act = play(u.mesh, clip, { once: true, restart: true, speed: sk.sp, fade: 0.06 }); S.rush(0.35); sk.phase = 'dash'; }
  else rescueGuard(u, sk);
}
function rescueGuard(u, sk) { // spear up before the summoner, facing the threat
  sk.phase = 'guard'; sk.g0 = sk.t;
  const P = sk.P, h0 = P && !P.dead ? Math.min(P.maxHp * RESCUE.now, P.maxHp - P.hp, u.rescueHeal) : 0; // (as he stands before the summoner: a fifth of its life at once —
  if (h0 > 0) { P.hp += h0; u.rescueHeal -= h0; say(P.x, P.z, '+' + Math.round(h0), '#7dff9a', 15, 2.2); // not as the rescue starts: the blow that calls him has yet to land)
    C.parts.emit(P.x, 1.0, P.z, 14, { col: 0x9fe4ff, spd: 0.8, up: 1.6, grav: -0.6, life: 0.7, size: 0.24, spread: 0.4 }); }
  const th = sk.tgt && !sk.tgt.dead ? sk.tgt : null; u.face = u.faceT = th ? angTo(u, th) : sk.a; u.vx = u.vz = u.kx = u.kz = 0;
  play(u.mesh, 'ZY_SP_Parry', { restart: true, fade: 0.06, at: 0.17, speed: 0.4 }); burst(u.x, 1.6, u.z, 0x9fe4ff, 1.2); S.block(false);
}
function rescueFan(u, sk) { // the great sweep: a wide fan of dragon light out at the threat, each foe struck once
  const x = u.x, z = u.z, f0 = u.face, col = 0x9fe4ff, hit = new Set(); S.blade(true, true); S.burst(false); shake(0.2, x, z); hitBoxes(x, z, 3, f0, RESCUE.span / 2);
  burst(x + Math.sin(f0) * 1.4, 1.0, z + Math.cos(f0) * 1.4, col, 2.4); arcHit(u, u.range + u.r + 1, RESCUE.span / 2, RESCUE.mult * 0.6 * zyK(u), { knock: 2.6, silent: true }); qiFan(x, z, f0, col, 4);
  for (let i = 0; i < RESCUE.n; i++) { const da = -RESCUE.span / 2 + RESCUE.span * i / (RESCUE.n - 1);
    G.fx.push({ t: 0.01 + 0.025 * Math.abs(i - (RESCUE.n - 1) / 2), fn: () => { if (u.dead) return;
      qiBolt(x, z, f0 + da, col, RESCUE.range, 20, (px, pz) => { for (const h of hostilesOf(u)) { if (h.dead || hit.has(h) || Math.hypot(h.x - px, h.z - pz) > 0.75 + h.r) continue; hit.add(h);
        damage(u, h, u.dmg * RESCUE.mult * zyK(u) * (0.95 + Math.random() * 0.1), { knock: 2.8, fx: x, fz: z, heavy: true, quiet: true }); C.parts.emit(h.x, 1.0, h.z, 8, { col, spd: 2.4, up: 1, grav: 5, life: 0.3, size: 0.15 }); S.blade(false, false); } }); } }); }
}
function rescueTick(u, dt) {
  const sk = u.sk;
  if (sk.phase === 'dash') { const c0 = sk.ct, c1 = (sk.ct = clipT(u, sk)); spCarry(u, sk, c0, c1, sk.kD); if (Math.random() < dt * 30) C.parts.emit(u.x, 0.6, u.z, 1, { col: 0x9fe4ff, spd: 0.4, up: 0.3, grav: 0, life: 0.35, size: 0.3, spread: 0.3 });
    if (c1 >= sk.mv.end) rescueGuard(u, sk); return; }
  const g = sk.t - sk.g0, th = sk.tgt && !sk.tgt.dead ? sk.tgt : null, W = RESCUE.sweep; if (th && !sk.swept) u.faceT = angTo(u, th); u.vx = u.vz = 0;
  if (!sk.sweeping && g >= 0.3) { sk.sweeping = true; play(u.mesh, 'ZY_SP_Atk2B', { once: true, restart: true, speed: W[2], fade: 0.06, at: W[0] / clipDur('ZY_SP_Atk2B') }); S.swoosh(true, (W[1] - W[0]) / W[2] - 0.03, 0.12); }
  if (sk.sweeping && !sk.swept && g >= 0.3 + (W[1] - W[0]) / W[2]) { sk.swept = true; rescueFan(u, sk); }
  if (sk.swept && !sk.settled && g >= 0.3 + (W[1] - W[0]) / W[2] + 0.35) { sk.settled = true; play(u.mesh, 'Stand', { fade: 0.2 }); }
  if (g >= RESCUE.guard) end(u);
}

// ---------- the blows ----------
function arcHit(u, reach, half, mult, o = {}) { let n = 0, cr = false, pl = false;
  for (const h of hostilesOf(u)) { if (h.dead || dist(h, u) > reach + h.r || !inArc(u, h, half)) continue; const crit = Math.random() < 0.15; cr = cr || crit;
    damage(u, h, u.dmg * mult * (0.9 + Math.random() * 0.2), { knock: o.knock || 0, melee: true, heavy: true, crit, critX: 1.8, quiet: true }); if (o.stun) stunHit(h, o.stun); n++; pl = pl || plated(h); }
  if (n && !o.silent) hitSound(u, cr, pl); hitBoxes(u.x, u.z, reach, u.face, half); return n; }
// the shield fan's blend, set by hand: the guard pose gives way to the shield-high pose on an ease-out curve
function fanW(sk, k) { if (!sk.upTo) return; k = Math.min(1, Math.max(0, k)); const w = 1 - (1 - k) ** 3;
  sk.upTo.setEffectiveWeight(w); if (sk.upFrom) sk.upFrom.setEffectiveWeight(1 - w); if (k >= 1) { if (sk.upFrom) sk.upFrom.stop(); sk.upTo = sk.upFrom = null; } }
function shieldBash(u, t, mv) { // the shield sweeps up into them: the target and whoever stands right beside it are thrown up and back
  const fx = u.x + Math.sin(u.face) * 0.75, fz = u.z + Math.cos(u.face) * 0.75;
  for (const h of hostilesOf(u)) { if (h.dead || (h !== t && (dist(h, u) > u.r + h.r + 0.9 || !inArc(u, h, 0.7)))) continue;
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 4.5, heavy: true, quiet: true }); stunHit(h, mv.stun); h.hitStop = Math.max(h.hitStop || 0, 0.1);
    if (!h.dead && !h.champ && !h.noStun) { const lift = 0.55 + Math.random() * 0.2; G.fx.push({ t: 0.5, tick: k => { if (!h.dead) h.y = Math.sin(Math.PI * k) * lift; }, fn: () => { h.y = 0; } }); } } // a hop in the air
  say(t.x, t.z, tr('击倒', 'Knocked down'), '#ffe6b0', 15, 2.1); u.hitStop = 0.08; swipeUp(u.x, u.z, u.face, colOf(u)); hitBoxes(fx, fz, 0.9);
  S.clank(); S.smash(); shake(0.12, fx, fz); burst(fx, 1.0, fz, colOf(u), 1.5); shock(fx, fz, colOf(u), 1.6, 0.35, 0.4);
  C.parts.emit(fx, 1.0, fz, 12, { col: 0xffe6b0, spd: 3, up: 1.2, grav: 7, life: 0.3, size: 0.12 }); C.parts.emit(fx, 0.2, fz, 14, { col: 0xb8a890, spd: 2.4, up: 1, life: 0.5, size: 0.3, grav: 5 });
}
function leapLand(u, mv) { // the greatsword comes down: the ground splits, everything near is thrown off its feet
  const x = u.x + Math.sin(u.face) * 0.6, z = u.z + Math.cos(u.face) * 0.6, col = colOf(u); let n = 0;
  for (const h of hostilesOf(u)) { if (h.dead || Math.hypot(h.x - x, h.z - z) > mv.aoe + h.r) continue;
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 3.2, fx: x, fz: z, melee: true, heavy: true, quiet: true }); stunHit(h, mv.stun); n++; }
  if (n) S.blade(true, false); S.slam(); shake(0.22, x, z); u.hitStop = 0.1; hitBoxes(x, z, mv.aoe);
  slamMark(x, z, 1.6, col, 3); burst(x, 0.4, z, col, 2.4); shock(x, z, col, mv.aoe, 0.45); shock(x, z, 0xc8bca8, mv.aoe * 1.5, 0.7, 0.3);
  C.parts.emit(x, 0.2, z, 24, { col: 0x4e443c, spd: 4.5, up: 3.2, grav: 11, life: 0.75, size: 0.3, spread: 0.6 }); // chunks of floor
  C.parts.emit(x, 0.15, z, 22, { col: 0xc8bca8, spd: 3.4, up: 0.9, grav: 1, life: 0.8, size: 0.5, spread: 0.8 }); // dust
  C.parts.emit(x, 0.3, z, 16, { col, spd: 3, up: 2, grav: 3, life: 0.5, size: 0.2 });
}
function whirlHit(u, mv) {
  let n = 0, cr = false, pl = false; for (const h of hostilesOf(u)) { if (h.dead || dist(h, u) > 2.7 + h.r) continue; const crit = Math.random() < 0.12; cr = cr || crit; pl = pl || plated(h);
    damage(u, h, u.dmg * mv.mult * (0.9 + Math.random() * 0.2), { knock: 2, melee: true, heavy: true, crit, critX: 1.8, quiet: true }); n++; }
  if (n) hitSound(u, cr, pl); shock(u.x, u.z, colOf(u), 2.7, 0.35, 0.35); hitBoxes(u.x, u.z, 2.7);
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
  S.blade(true, true); S.burst(true); hitBoxes(x, z, mv.sweep ? CONE.range : 2.2, u.face, mv.sweep ? mv.sweep / 2 + 0.1 : 0.9);
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
// 百鸟朝凤: five bolts of dragon light fanned ahead, each running through what it meets (once each); non-elites under 25% cut down
function dragonHit(u, mv, k = 1) {
  const x = u.x, z = u.z, col = mv.col, hit = new Set(), f0 = u.face; S.blade(true, true); S.burst(false); shake(0.24, x, z); hitBoxes(x, z, 3, f0, 0.5);
  burst(x + Math.sin(f0) * 1.5, 1.0, z + Math.cos(f0) * 1.5, col, 2.2); arcHit(u, u.range + u.r + 0.4, 0.4, mv.mult * 0.5 * k, { knock: 2, silent: true });
  [0, -0.2, 0.2, -0.4, 0.4].forEach((da, i) => G.fx.push({ t: 0.01 + 0.07 * i, fn: () => { if (u.dead) return; S.swoosh(false, 0, 0.05);
    qiBolt(x, z, f0 + da, col, 9, 18, (px, pz) => { for (const h of hostilesOf(u)) { if (h.dead || hit.has(h) || Math.hypot(h.x - px, h.z - pz) > 0.75 + h.r) continue; hit.add(h);
      damage(u, h, u.dmg * mv.mult * k * (0.95 + Math.random() * 0.1), { knock: 2.5, fx: x, fz: z, heavy: true, crit: true, critX: 1, quiet: true });
      if (!h.dead && !h.champ && h.hp < h.maxHp * 0.25) { say(h.x, h.z, tr('斩杀', 'Cut down'), '#9fe4ff', 17, 2); damage(u, h, h.hp + 1, { quiet: true, noFx: true }); }
      C.parts.emit(h.x, 1.0, h.z, 8, { col, spd: 2.4, up: 1, grav: 5, life: 0.3, size: 0.15 }); S.blade(false, false); } }); } }));
}
// a block or parry: the counter's blow, and its sword qi
function counterHit(u, sk) {
  const mv = sk.mv, col = colOf(u), x = u.x, z = u.z;
  if (mv.fan) { // the greatsword: a 180° sweep, its qi fanning out wide but not far
    arcHit(u, u.range + u.r + 0.6, Math.PI / 2, mv.mult, { knock: 2.6, stun: 0.4 }); qiFan(x, z, u.face, col, FAN);
    for (const h of hostilesOf(u)) { const d = dist(h, u); if (h.dead || d <= u.range + u.r + 0.6 + h.r || d > FAN + h.r || !inArc(u, h, Math.PI / 2)) continue;
      G.fx.push({ t: Math.max(0.01, d / 12), fn: () => { if (h.dead) return; damage(u, h, u.dmg * 0.8, { knock: 1.6, fx: x, fz: z, quiet: true }); C.parts.emit(h.x, 0.9, h.z, 6, { col, spd: 2, up: 1, grav: 5, life: 0.3, size: 0.14 }); } }); }
  } else { // sword & shield: a cut down from behind the shield, its qi flying straight — at the shooter, when it stopped a missile. The paladin (圣盾反弹): no cut —
    // the light rebounds out of its body all round (holy.js shieldRebound), and its bolt flies the same way
    if (mv.holy) { shieldRebound(u); arcHit(u, u.range + u.r + 0.8, Math.PI, mv.mult, { knock: 2.6, stun: 0.3, silent: true }); }
    else arcHit(u, u.range + u.r + 0.6, 0.6, mv.mult, { knock: 2.2, stun: 0.3 });
    const aim = sk.shot && sk.src && !sk.src.dead && dist(sk.src, u) < BOLT.range + 1 ? sk.src : null, ang = aim ? Math.atan2(aim.x - x, aim.z - z) : u.face, hit = new Set();
    qiBolt(x, z, ang, col, BOLT.range, BOLT.speed, (px, pz) => { for (const h of hostilesOf(u)) { if (h.dead || hit.has(h) || Math.hypot(h.x - px, h.z - pz) > 0.8 + h.r) continue; hit.add(h);
      damage(u, h, u.dmg * 0.9, { knock: 2, fx: x, fz: z, quiet: true }); C.parts.emit(h.x, 1.0, h.z, 8, { col, spd: 2.4, up: 1, grav: 5, life: 0.3, size: 0.15 }); if (mv.holy) S.holy(0.4); else S.blade(false, false); } });
  }
}
// ---------- Block / Parry (passive, from 10 战魂): how much of a blow gets through, and the counter it earns ----------
PH.guard = (src, u, o) => {
  if (u.rescueT > G.t) { const ang = src ? Math.atan2(src.x - u.x, src.z - u.z) : u.face, x = u.x + Math.sin(ang) * 0.55, z = u.z + Math.cos(ang) * 0.55; // (奔袭救主: every blow turned aside)
    C.parts.emit(x, 1.1, z, 10, { col: 0xcfeeff, spd: 3, up: 1.4, grav: 8, life: 0.25, size: 0.1 }); burst(x, 1.1, z, 0x9fe4ff, 0.8); S.block(false);
    if (!(u.blkSay > G.t)) { u.blkSay = G.t + 0.5; say(u.x, u.z, tr('格挡', 'Block'), '#cfeeff', 14, 1.8); } return 0; }
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
  const P = G.player; if (u.rescueT > G.t && P && !P.dead && u.rescueHeal > 0) { const hv = Math.min(u.rescueHeal, d * RESCUE.heal, P.maxHp - P.hp); u.rescueHeal -= hv; P.hp += hv; // (奔袭救主: his blows heal the summoner too)
    if (!P.rescAcc) G.fx.push({ t: 0.45, fn: () => { const v = P.rescAcc; P.rescAcc = 0; if (P.dead || v < 1) return; say(P.x, P.z, '+' + Math.round(v), '#7dff9a', 14, 2.2);
      C.parts.emit(P.x, 1.0, P.z, 10, { col: 0x9fe4ff, spd: 0.7, up: 1.4, grav: -0.6, life: 0.6, size: 0.22, spread: 0.35 }); } });
    P.rescAcc = (P.rescAcc || 0) + hv; }
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
  play(u.mesh, mv.pose, { restart: true, fade: 0.05, at: mv.poseAt || 0 }); return true;
};
// the arena's buttons (arena.js): one of his moves at once at the nearest foe — no cooldown, any Fury (to watch it, slowed down)
PH.zyMove = id => {
  const u = G.units.find(x => x.pact && !x.dead); if (!u || styleOf(u) !== 'SPR' || u.spawnT > 0) return false;
  let t = null, bd = 1e9; for (const h of hostilesOf(u)) { const d = dist(h, u); if (!h.dead && d < bd) { bd = d; t = h; } }
  if (u.state === 'pskill' && u.sk) end(u); u.state = 'idle';
  if (id === 'rescue') { startRescue(u, G.player); return true; }
  if (!t) { say(u.x, u.z, tr('先刷怪', 'Spawn some foes first'), '#ffd27a', 14, 2); return false; }
  if (id.startsWith('atk')) { u.atkI = +id.slice(3) - 2; return PH.heroAtk(u, t); }
  if (id === 'counter') { u.ctrQ = { src: t, shot: false, t: G.t }; return PH.counterAI(u); }
  return start(u, id, t);
};
globalThis.__start = (u, id, t) => start(u, id, t); globalThis.__PH = PH; // (tests: a skill started by hand)
