// 魂契 (Soul Pact) mode: the summoner binds one skeleton — the realistic Boneforged Sentinel — that does the fighting and grows
// by its own kills (战魂 stacks: damage, attack speed, move speed), and loses all of that when it falls.
// Summoning is a skill (no cooldown, a cast with a rune circle; it stays at level 1); 唤魂 no longer captures, it turns corpses into
// 魂能 (soul energy) that flies into the soul vessel (soulvessel.js) and is poured from there into the skeleton out on the field as
// 战魂 stacks — so a fallen skeleton can be charged up again from what was saved. Monsters move slowly here, so fights stand still
// and the skeleton is the centre of them while the summoner moves around it.
import * as THREE from 'three';
import { G, save, PACT } from './state.js';
import { tr } from './i18n.js';
import { C, PH, say, damage, hostilesOf, removeCorpse, soulOrb, spawnAlly, plated, soulRise } from './units.js';
import { A, play, PLUME_AT } from './assets.js';
import { ring, glowSprite } from './gfx.js';
import { runeCircle } from './vfx.js';
import { burst, shake } from './fx.js';
import { S, loadSamples, SAMPLES, FOE_SAMPLES, SOUL_SAMPLES } from './audio.js';
import { SKILLS, skillView } from './pactskills.js';
import { rollHeroItem, HERO_GEAR } from './data.js';
import { soulToJar } from './soulvessel.js';
import { smite, auraTick } from './holy.js';
import { hitBoxes } from './loot.js';
loadSamples(FOE_SAMPLES); loadSamples(SOUL_SAMPLES); if (PACT) loadSamples(SAMPLES);

// ---------- tunables ----------
export const SUMMON = { mana: 10, cast: 1.5, riseSp: 1 };
// weapon styles: one class (warrior), three ways to fight
export const SETS = {
  SNS: { name: tr('剑盾', 'Sword & Shield'), style: tr('坚守', 'Bulwark'), icon: '🛡️', mv: 2.07, hp: 1.3, dmg: 1, arm: 14, cd: 1.15, wind: 0.42, range: 1.2, eva: 0.32, arc: 0.55, side: 0.6, knock: 1.4,
    desc: tr('生命和护甲高，闪避高，出手快。被一群怪围住也站得住。', 'More life and armour, high evasion, quick strikes. Holds its ground in a crowd.') },
  GS: { name: tr('双手大剑', 'Greatsword'), style: tr('横扫', 'Cleave'), icon: '⚔️', mv: 2.33, hp: 1.0, dmg: 1.5, arm: 4, cd: 1.6, wind: 0.6, range: 1.6, eva: 0.16, arc: 1.25, side: 0.85, knock: 3, heavy: true,
    desc: tr('伤害高，每一刀都扇形横扫面前的敌人并击退，但闪避低、更容易受伤。', 'Heavy hits: every swing cleaves everything in front and knocks it back, but it dodges less and gets hurt more.') },
  // the mace and shield: slower and sturdier than the sword, and holy (gold light instead of the soul's cyan); blunt: the knights' shields
  // don't stop it, it ignores half of armour and hits the heavily armoured harder; every third swing calls the light down on the target
  PAL: { name: tr('锤盾', 'Mace & Shield'), style: tr('圣骑士', 'Paladin'), icon: '🔨', mv: 1.97, hp: 1.4, dmg: 1.05, arm: 18, cd: 1.3, wind: 0.48, range: 1.15, eva: 0.24, arc: 0.55, side: 0.6, knock: 2, blunt: true, holy: true, smite: 3,
    desc: tr('生命和护甲最高，出手比剑盾慢。钝击：盾牌挡不住锤子，无视目标一半护甲，打重甲（护甲 15 以上）伤害 +25%。每第三下是圣击：圣光砸在目标身上，波及身边的敌人并短暂眩晕。',
      'The most life and armour, a little slower than the sword. Blunt: shields don\'t stop a mace, it ignores half of armour, +25% against heavy armour (15 or more). Every third blow is a Smite: light crashes down on the target, catching those beside it and stunning them briefly.') },
  // the spear (长枪): the skeleton becomes 赵云 — quick on its feet, a long reach, and each thrust runs on through the line behind the
  // target (pierce: how far past its reach); a bow on his back for enemies still far off (bow: range, every cd s, n arrows at mult)
  SPR: { name: tr('长枪', 'Spear'), style: tr('赵云', 'Zhao Yun'), icon: '🐉', mv: 2.4, hp: 1.1, dmg: 1.25, arm: 8, cd: 1.35, wind: 0.5, range: 2.0, eva: 0.26, arc: 0.3, side: 0.8, knock: 1.8,
    pierce: 1.6, bow: { min: 6, max: 13, cd: 5, n: 3, gap: 0.28, mult: 0.55 },
    desc: tr('骸骨卫士化身赵云。移动快，枪长刺得远，每一枪都穿透目标身后一条线上的敌人（再远 1.6 米）。背上一张弓：敌人还在 6–13 米外时停下连射三箭，再提枪冲上去。',
      'The Sentinel becomes Zhao Yun. Quick on his feet, a long reach, and every thrust runs on through the line behind the target (1.6 m further). A bow on his back: at enemies still 6–13 m off he stops and looses three arrows, then goes in with the spear.') },
};
// what s 战魂 stacks give, in %: +6% damage and +4% attack speed a stack up to 25 (every skill awake), then +3% and +1.5% (it grew too
// strong late on, gear multiplying it again); +2.5% life a stack all the way; move speed +2% a stack, at most +30%
export const FURY_AT = 25;
export const furyBonus = s => { const a = Math.min(s, FURY_AT), b = Math.max(0, s - FURY_AT);
  return { dmg: 6 * a + 3 * b, spd: 4 * a + 1.5 * b, hp: 2.5 * s, move: Math.round(Math.min(0.3, 0.02 * s) * 100) }; };
// the skeleton at summon level L with s 战魂 stacks (before the global pace: speed ×0.75, attack interval ÷0.8)
export function heroBase(L, s, set) {
  const W = SETS[set] || SETS.SNS, f = furyBonus(s);
  return { maxHp: (230 + 40 * (L - 1)) * W.hp * (1 + f.hp / 100), dmg: (16 + 4.5 * (L - 1)) * W.dmg * (1 + f.dmg / 100), armor: 18 + 3 * (L - 1) + W.arm,
    speed: W.mv * (1 + f.move / 100), cd: W.cd / (1 + f.spd / 100), evade: W.eva + Math.min(0.12, 0.004 * s) }; // speed: a slow, heavy walk (1.55 / 1.75 m/s at first, at most +30%)
}
// kills needed for the next stack (champions count 4, warriors 2): quick to 25 (every Fury skill awake: 245 kills in all), then a long
// climb — 25→50 about 1 000, 50→75 about 3 100, 75→100 about 6 700 (poured 魂能 pays the same price, so it slows down too)
export const stackNeed = s => s < 25 ? 3 + Math.floor(s * 0.6) : 18 + Math.floor(1.2 * (s - 25) + 0.045 * (s - 25) ** 2);
const killWorth = v => v.boss ? 12 : v.champ ? 4 : v.kind === 'brute' ? 2 : 1; // (a boss: 12)
// 魂能 from a corpse; lvlCost: what a summon level used to cost (only to pay old saves back, pactMigrate)
export const soulOf = c => Math.max(1, Math.round(({ imp: 1, archer: 2, shaman: 2, brute: 3 }[c.kind] || 1) * (1 + 0.25 * (c.level - 1)) * (c.boss ? 12 : c.champ ? 3 : 1)));
export const lvlCost = L => Math.round(10 * Math.pow(L, 1.45));
export const heroName = () => (G.pact && G.pact.wset === 'SPR' ? tr('赵云', 'Zhao Yun') : tr('骸骨卫士', 'Bone Sentinel')); // (the spear: the skeleton has become Zhao Yun)

// ---------- the skeleton's entry (one, rebuilt on every summon) ----------
const P8 = G.pact;
export const heroUnit = () => { const en = P8.en, u = en && en.unit; return u && !u.dead ? u : null; };
// one entry for good: the equipment panel works on it whether or not the skeleton is out; its gear is the pact's (saved)
export function heroEntry() {
  initGear(); const en = P8.en || (P8.en = { id: -1, type: 'brute', xp: 0, mods: [], modLv: {}, champ: false, active: true, reviveT: 0, unit: null, sp: 0, skills: {}, hero: true, pact: true });
  en.level = P8.lvl; en.gear = P8.gear; en.wset = P8.wset = gearStyle(P8.gear); return en;
}
function makeEntry() { const en = heroEntry(); en.unit = null; return en; }
// ---------- its gear: the weapon decides the style (greatsword → 大剑, mace → 圣骑士, sword or bare → 剑盾) ----------
export const gearStyle = g => (g && g.w && g.w.hero && HERO_GEAR[g.w.hero].style) || 'SNS';
// a new pact starts with a plain sword and shield; a save from before gear gets plain gear of the style it had
export function initGear() {
  if (P8.gear) return; const L = 1;
  P8.gear = P8.wset === 'GS' ? { w: rollHeroItem(G.uid++, L, 0, 'gs') } : { w: rollHeroItem(G.uid++, L, 0, 'sword'), a: rollHeroItem(G.uid++, L, 0, 'shield') };
}
// a whole set at a quality (the test arena): the style's weapon, and a shield with the sword or the mace
export function equipSet(style, q, il) { P8.gear = style === 'GS' || style === 'SPR' ? { w: rollHeroItem(G.uid++, il, q, style === 'SPR' ? 'spear' : 'gs') } : { w: rollHeroItem(G.uid++, il, q, style === 'PAL' ? 'mace' : 'sword'), a: rollHeroItem(G.uid++, il, q, 'shield') }; PH.gear(heroEntry()); }

// ---------- hooks the unit code calls (see PH in units.js) ----------
PH.stats = u => {
  const en = u.entry, W = SETS[en.wset] || SETS.SNS, b = heroBase(en.level, P8.stacks, en.wset), g = en.gear || {}, V = k => ((g.w && g.w.v[k]) || 0) + ((g.a && g.a.v[k]) || 0);
  // what its gear gives: % damage / life / attack speed / move speed, flat armour, chances
  b.dmg *= 1 + V('dmg') / 100; b.maxHp *= 1 + V('hp') / 100; b.armor += V('arm'); b.cd /= 1 + V('spd') / 100; b.speed *= 1 + V('move') / 100; b.evade = Math.min(0.6, b.evade + V('eva') / 100);
  u.crit = 0.1 + V('crit') / 100; u.leechB = V('leech') / 100; u.blockB = V('blk') / 100; u.shield = !!g.a; u.blunt = !!W.blunt; // (blunt: damage() in units.js, foeGuard in foes.js)
  Object.assign(u, b); u.range = W.range; u.r = 0.42; u.windup = W.wind; u.noStun = true; u.taunt = true; u.tauntR = 6; u.pact = true; u.fury = P8.stacks; // (crest and skills go by it)
};
PH.name = () => heroName();
// a swing: the target and whatever else stands in the arc in front (narrow for the sword, wide for the greatsword)
PH.strike = (u, t) => {
  const W = SETS[u.entry.wset] || SETS.SNS, reach = u.range + u.r + 0.35; let hits = 0, crits = false, plate = false;
  if (W.heavy) { S.smash(); C.parts.emit(u.x + Math.sin(u.face) * 1.1, 0.2, u.z + Math.cos(u.face) * 1.1, 14, { col: 0xb8a890, spd: 3, up: 1.4, life: 0.5, size: 0.3 }); }
  const fx = Math.sin(u.face), fz = Math.cos(u.face);
  for (const h of hostilesOf(u)) { if (h.dead) continue; const d = Math.hypot(h.x - u.x, h.z - u.z);
    if (W.pierce && h !== t) { const al = (h.x - u.x) * fx + (h.z - u.z) * fz, lat = Math.abs((h.x - u.x) * fz - (h.z - u.z) * fx); // (the spear: a thin line straight ahead, past the target)
      if (al < 0 || al > reach + W.pierce + h.r || lat > 0.45 + h.r) continue; }
    else { if (d > reach + h.r + (h === t ? 0.4 : 0)) continue;
      const a = Math.atan2(h.x - u.x, h.z - u.z), da = Math.abs(((a - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (h !== t && da > W.arc && d > 0.8) continue; }
    const crit = Math.random() < (u.crit ?? 0.1); damage(u, h, u.dmg * (0.9 + Math.random() * 0.2) * (h === t ? 1 : W.side), { knock: W.knock, melee: true, heavy: !!W.heavy, crit, critX: 1.8, quiet: true }); hits++; crits = crits || crit; plate = plate || plated(h); }
  if (hits) { if (W.blunt) S.bonk(crits, 1, plate); else S.blade(!!W.heavy, crits, plate); } // one blade sound per swing, however many it cuts
  hitBoxes(u.x, u.z, reach + (W.pierce || 0) * 0.5, u.face, Math.max(0.7, W.arc)); // (and a barrel, a crate or an urn in front of it breaks)
  if (W.smite && t && (u.smiteN = (u.smiteN || 0) + 1) % W.smite === 0) smite(u, t); // every third blow: the light comes down where it stood
};
// evasion: a number-less "dodge" and, when it is free to move, a quick dodge step (the Mixamo dodges, sped up)
PH.evade = (src, u) => {
  say(u.x, u.z, tr('闪避', 'Dodge'), '#8ff7ea', 14, 1.9);
  if (!(u.dodgeT > G.t) && (u.state === 'idle' || u.state === 'recover') && u.mesh.hero) { u.dodgeT = G.t + 1.4;
    const ax = src ? src.x - u.x : 0, az = src ? src.z - u.z : 1, rel = ((Math.atan2(ax, az) - u.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const name = Math.abs(rel) < 0.7 && Math.random() < 0.4 ? 'DodgeB' : rel > 0 ? 'DodgeR' : 'DodgeL', clip = A.heroClips[name];
    if (clip) { play(u.mesh, name, { once: true, restart: true, speed: 2.4, fade: 0.05 }); u.animLock = clip.duration / 2.4 * 0.55; }
    // the step: straight back from the attacker, or to the side (its right = (-cos f, sin f))
    const l = Math.hypot(ax, az) || 1, f = u.face, side = name === 'DodgeR' ? 1 : -1;
    const sx = name === 'DodgeB' ? -ax / l : -Math.cos(f) * side, sz = name === 'DodgeB' ? -az / l : Math.sin(f) * side;
    u.kx += sx * 2.2; u.kz += sz * 2.2; C.parts.emit(u.x, 0.9, u.z, 6, { col: 0x8ff7ea, spd: 0.4, up: 0.4, grav: 0, life: 0.35, size: 0.35, spread: 0.3 }); }
};
// a kill by the skeleton: progress toward the next 战魂 stack
PH.kill = (u, v) => gainKills(u, killWorth(v));
// progress toward the next stacks (a kill, or 魂能 poured in), and everything a new stack brings
function gainKills(u, n) {
  P8.kills += n; let up = 0;
  while (P8.kills >= stackNeed(P8.stacks)) { P8.kills -= stackNeed(P8.stacks); P8.stacks++; up++; }
  if (!up) return;
  const f = u.hp / u.maxHp; u.stats(); u.hp = Math.min(u.maxHp, u.maxHp * f + u.maxHp * 0.08);
  S.level(); C.parts.emit(u.x, 1.0, u.z, 26, { col: 0xffd27a, spd: 1.8, up: 3, life: 0.9, size: 0.28, grav: -1.2 }); C.parts.emit(u.x, 0.6, u.z, 16, { col: 0x8ff7ea, spd: 1.2, up: 2, life: 0.7, size: 0.24, grav: -1 });
  say(u.x, u.z, tr(`战魂 ${P8.stacks}`, `Fury ${P8.stacks}`), '#ffd27a', 17, 2.3);
  // every 5 stacks up to 20: the crest changes colour and a skill wakes (both gone again when it falls)
  for (let s = P8.stacks - up + 1; s <= P8.stacks; s++) { const k = PLUME_AT.indexOf(s), s0 = SKILLS.find(q => q.at === s), sk = s0 && skillView(s0, P8.wset);
    if (k >= 0) { shock(u.x, u.z, 0xffd27a, 2.8); C.say(tr(['骸骨卫士的鬃毛染上了幽蓝', '骸骨卫士的鬃毛化为鎏金', '骸骨卫士的鬃毛燃起紫焰', '骸骨卫士的鬃毛燃起赤焰'][k],
      ['The Sentinel\'s crest turns azure', 'The Sentinel\'s crest turns to gold', 'The Sentinel\'s crest kindles violet fire', 'The Sentinel\'s crest bursts into crimson fire'][k]) + (sk ? tr(` · 觉醒技能 ${sk.icon} ${sk.name}`, ` · it wakes ${sk.icon} ${sk.name}`) : ''), true); }
    else if (sk) { shock(u.x, u.z, 0xff5a6a, 2.6); C.say(tr(`骸骨卫士 战魂 ${s} 层 · 觉醒技能 ${sk.icon} ${sk.name}`, `Bone Sentinel at ${s} Fury · it wakes ${sk.icon} ${sk.name}`), true); }
    else if (s % 5 === 0) { const f = furyBonus(s); shock(u.x, u.z, 0xffd27a, 2.4); C.say(tr(`骸骨卫士 战魂 ${s} 层：伤害 +${f.dmg}%，攻速 +${f.spd}%`, `Bone Sentinel at ${s} Fury: +${f.dmg}% damage, +${f.spd}% attack speed`)); } }
  save();
}
// ---------- pouring 魂能 into the skeleton (from the soul vessel) ----------
// 魂能 buys kill progress: soulPerKill for each kill's worth, so a stack costs its kills × soulPerKill (harvesting every corpse gives
// roughly half as many stacks again as the kills themselves); a stack fills in stackSec however big it is
export const INFUSE = { soulPerKill: 2.5, stackSec: 0.7 };
export const infuseCost = () => Math.max(1, Math.ceil((stackNeed(P8.stacks) - P8.kills) * INFUSE.soulPerKill - 1e-6)); // to the next stack
export function infuseTick(u, dt) {
  let k = stackNeed(P8.stacks) / INFUSE.stackSec * dt, soul = k * INFUSE.soulPerKill;
  if (soul > G.soul) { soul = G.soul; k = soul / INFUSE.soulPerKill; }
  G.soul = Math.max(0, G.soul - soul); if (G.soul < 1e-4) G.soul = 0; gainKills(u, k); return soul;
}
// the summon skill no longer levels: an old save gets back every bit of 魂能 it spent on it (into the vessel)
export function pactMigrate() {
  if (!(P8.lvl > 1)) return 0; let r = 0; for (let L = 1; L < P8.lvl; L++) r += lvlCost(L);
  G.soul += r; P8.lvl = 1; G.soulRefund = r; return r;
}
// it falls: every stack is gone; summon it again
PH.death = u => {
  const lost = P8.stacks; P8.stacks = 0; P8.kills = 0; P8.alive = false; if (P8.en) P8.en.unit = null;
  C.say(tr(`骸骨卫士倒下了${lost ? `，${lost} 层战魂散尽` : ''}。按 E 重新召唤`, `The Bone Sentinel has fallen${lost ? ` — ${lost} Fury lost` : ''}. Press E to summon it again`), true); save();
};

function shock(x, z, col, r) { const rg = ring(0.2, 0.5, col, 0.9); rg.position.set(x, 0.05, z); C.scene.add(rg);
  G.fx.push({ clean: true, t: 0.5, tick: k => { rg.scale.setScalar(1 + k * r * 2); rg.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(rg) }); }

// ---------- the summon: cast (rune circle, souls drawn in), then the skeleton climbs out of it ----------
const COL = 0x5ff6e6;
class SummonFx {
  constructor(x, z) {
    this.x = x; this.z = z; this.g = new THREE.Group(); this.g.position.set(x, 0.04, z); C.scene.add(this.g);
    this.outer = runeCircle(1.5, COL, 0); this.inner = runeCircle(0.85, 0xffffff, 0); this.inner.position.y = 0.01; this.glow = glowSprite(COL, 2.2, 0); this.glow.position.y = 0.5;
    this.g.add(this.outer, this.inner, this.glow);
  }
  update(k, dt, P) {
    const e = k * k * (3 - 2 * k); this.outer.material.opacity = 0.85 * e; this.inner.material.opacity = 0.55 * e; this.outer.rotation.y += dt * (0.6 + 2 * k); this.inner.rotation.y -= dt * (1 + 3 * k);
    this.glow.material.opacity = 0.5 * e; this.glow.scale.setScalar(1.6 + 1.2 * e);
    const n = Math.random() < dt * (20 + 50 * k) ? 1 : 0; // motes spiralling in from the rim, rising faster as it builds
    for (let i = 0; i < n + (Math.random() < dt * 30 * k ? 1 : 0); i++) { const a = Math.random() * Math.PI * 2, r = 1.4; C.parts.emit(this.x + Math.cos(a) * r, 0.1, this.z + Math.sin(a) * r, 1, { col: Math.random() < 0.7 ? COL : 0xffffff, spd: 0.25, up: 1.2 + 2 * k, grav: -0.8, life: 0.8, size: 0.16 + 0.1 * k, spread: 0.05 }); }
    if (P && Math.random() < dt * 14) { const hx = P.x + Math.sin(P.face) * 0.3, hz = P.z + Math.cos(P.face) * 0.3; C.parts.emit(hx, 1.2, hz, 1, { col: COL, spd: 0.3, up: 0.6, grav: 0, life: 0.5, size: 0.2, spread: 0.15 }); }
  }
  // the burst as it opens, then a slow fade while the skeleton rises
  finish() { const g = this.g, o = this.outer, i = this.inner, gl = this.glow;
    burst(this.x, 1.0, this.z, 0xbffcf5, 2); shake(0.07, this.x, this.z); shock(this.x, this.z, COL, 2.2); S.raise();
    C.parts.emit(this.x, 0.3, this.z, 40, { col: COL, spd: 2.2, up: 3.5, life: 1.0, size: 0.3, grav: -0.5 }); C.parts.emit(this.x, 0.2, this.z, 18, { col: 0x2a2433, spd: 2.5, up: 2, life: 0.8, size: 0.28, grav: 6 });
    G.fx.push({ clean: true, t: 1.6, tick: k => { const f = 1 - k; o.material.opacity = 0.85 * f; i.material.opacity = 0.55 * f; gl.material.opacity = 0.6 * f * f; o.rotation.y += 0.02; },
      fn: () => C.scene.remove(g) }); }
  cancel() { C.scene.remove(this.g); }
}
let fx = null;
function spot(P) { const F = C.floor; for (const d of [1.8, 1.2, 0.6]) { const x = P.x + Math.sin(P.face) * d, z = P.z + Math.cos(P.face) * d; if (F.fits ? F.fits(x, z, 0.45) : F.walk(x, z)) return { x, z }; } return { x: P.x, z: P.z }; }
// put the skeleton on the field; quick: on a new floor (no circle, a fast rise)
export function spawnHero(x, z, quick) {
  const en = makeEntry(), u = spawnAlly(en, x, z, null), P = G.player; u.face = u.faceT = P ? P.face : 0;
  const clip = A.heroClips.Rise, sp = SUMMON.riseSp; // the Mixamo stand-up at its own pace (also on a new floor)
  if (clip) { play(u.mesh, 'Rise', { once: true, restart: true, speed: sp, fade: 0 }); u.spawnT = clip.duration / sp * 0.9; u.animLock = u.spawnT; u.mesh.mixer.update(0); }
  P8.alive = true; save(); return u;
}
// called first thing in updatePlayer: the summon cast (returns true while casting) and the E key / button
export function pactPlayer(P, dt, IN) {
  if (P.state === 'summon') {
    if (IN.joy || (IN.hold && IN.moveTo)) { if (fx) fx.cancel(); fx = null; P.state = 'idle'; P.mp = Math.min(P.maxMp, P.mp + SUMMON.mana); C.say(tr('召唤被打断', 'Summon interrupted')); return false; }
    P.wantX = P.wantZ = 0; P.st += dt; const k = Math.min(1, P.st / SUMMON.cast); if (fx) fx.update(k, dt, P);
    if (k >= 1) { const at = P.sumAt; if (fx) fx.finish(); fx = null; P.state = 'idle'; spawnHero(at.x, at.z); C.say(tr(`${heroName()}应召而来`, `The ${heroName()} answers the call`)); }
    return true;
  }
  if (!IN.summon) return false; IN.summon = false;
  if (heroUnit()) { IN.infuse = true; return false; } // out already: E / the summon button held pours the vessel into it (until let go)
  if (P.mp < SUMMON.mana) { C.say(tr('法力不足', 'Not enough mana')); return false; }
  P.mp -= SUMMON.mana; P.state = 'summon'; P.st = 0; P.sumAt = spot(P); P.faceT = Math.atan2(P.sumAt.x - P.x, P.sumAt.z - P.z); IN.moveTo = null; IN.attack = null;
  fx = new SummonFx(P.sumAt.x, P.sumAt.z); S.raise(); return true;
}
export const summonK = () => { const P = G.player; return P && P.state === 'summon' ? Math.min(1, P.st / SUMMON.cast) : 0; };
// a new floor: the skeleton comes along if it was out (with its stacks)
export function pactFloor(P) { if (fx) { fx.cancel(); fx = null; } if (P8.alive) spawnHero(P.x + Math.sin(P.face) * 1.4, P.z + Math.cos(P.face) * 1.4, true); }
// 唤魂 in this mode: the corpse's soul stands up out of it, pale and glowing (as in the crypt), then breaks into souls that fly across the
// screen into the soul vessel as 魂能 (a bat's goes straight in)
export function harvest(c) {
  if (!G.corpses.includes(c)) return; const v = soulOf(c), x = c.x, z = c.z, go = () => soulToJar(x, 0.9, z, v);
  C.parts.emit(x, 0.5, z, 22, { col: 0x6ff7e8, spd: 1.4, up: 2.5, life: 0.8, size: 0.26, grav: -1.2 }); S.harvest();
  say(x, z, tr(`+${v} 魂能`, `+${v} soul`), '#8ff7ea', 14, 2.0); if (!soulRise(c, go, 2)) go(); removeCorpse(c);
}
// per frame: the skeleton heals up between fights
export function pactTick(dt) {
  if (G.soulRefund) { C.say(tr(`召唤技能不再升级：之前花在上面的 ${G.soulRefund} 魂能已退回魂瓶（左下角），按住魂瓶可以灌注给卫士`, `The summon skill no longer levels: the ${G.soulRefund} soul spent on it is back in the soul vessel (bottom left) — hold it to pour into the Sentinel`), true, 7000); G.soulRefund = 0; save(); }
  if (fx && G.player && G.player.state !== 'summon') { fx.cancel(); fx = null; } // the summoner died mid-cast
  const u = heroUnit(); auraTick(u, dt); if (!u || u.spawnT > 0) return; // (the paladin's Aura of Light: its shields fade with no Sentinel too)
  const busy = G.enemies.some(e => e.aggro && Math.hypot(e.x - u.x, e.z - u.z) < 10);
  u.hp = Math.min(u.maxHp, u.hp + u.maxHp * (busy ? 0.004 : 0.05) * dt);
}
// its gear changed (the equipment panel, the test arena): the style follows the weapon; the skeleton out on the field re-arms on the spot
PH.gear = en => {
  const k = gearStyle(P8.gear); en.gear = P8.gear; en.wset = P8.wset = k; const u = heroUnit();
  if (u) { u.entry.gear = P8.gear; u.entry.wset = k; const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; u.rebuildMesh(); C.parts.emit(u.x, 1, u.z, 18, { col: 0x8ff7ea, spd: 1.2, up: 2.2, life: 0.6, size: 0.24, grav: -1 }); }
  save();
};
// switch weapon style (old saves / tests): the skeleton out on the field re-arms on the spot
export function setStyle(k) {
  if (!SETS[k] || P8.wset === k) return; P8.wset = k; const u = heroUnit();
  if (u) { u.entry.wset = k; const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; u.rebuildMesh(); C.parts.emit(u.x, 1, u.z, 24, { col: 0x8ff7ea, spd: 1.4, up: 2.5, life: 0.7, size: 0.26, grav: -1 }); }
  save();
}
export { PACT };
