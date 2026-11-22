import { tr, SP } from './i18n.js';
// All tunable content lives here (like Diablo II's data tables): monster types, champion affixes, skills, packs.
export const TYPES = {
  imp: {
    name: tr('骷髅小兵', 'Skeleton Minion'), short: tr('骷髅小兵', 'Minion'), role: tr('快攻', 'Striker'), icon: '🗡️', hp: 20, dmg: 3.5, speed: 4.4, range: 0.85, cd: 0.8, windup: 0.16, armor: 0, r: 0.32, xp: 6, capture: 0.75,
    desc: tr('速度快，成群结队。看到同伴散架会惊慌逃跑，过一会儿再冲回来。', 'Fast and comes in packs. Panics when a packmate falls apart, then rushes back.'),
    ally: tr('速度快的近战输出，会突刺冲向敌人（必定暴击），平时攻击也有几率暴击。', 'Fast melee damage. Lunges at enemies (always a critical hit) and often crits.'),
  },
  brute: {
    name: tr('骷髅战士', 'Skeleton Warrior'), short: tr('骷髅战士', 'Warrior'), role: tr('坦克', 'Tank'), icon: '🪓', hp: 75, dmg: 12, speed: 2.5, range: 1.3, cd: 1.7, windup: 0.62, armor: 20, r: 0.5, xp: 16, capture: 0.5,
    desc: tr('慢，但蓄力重击会把人打退。被重击打断时会踉跄。', 'Slow, but its charged smash knocks you back. Staggers when hit hard.'),
    ally: tr('会跳劈砸进敌群，把被砸中的敌人引到自己身上，替你扛伤害。', 'Leaps into packs, pulls the enemies it hits onto itself and tanks for you.'),
  },
  archer: {
    name: tr('骷髅弩手', 'Skeleton Archer'), short: tr('骷髅弩手', 'Archer'), role: tr('远程', 'Ranged'), icon: '🏹', hp: 26, dmg: 6, speed: 3.3, range: 7, cd: 1.5, windup: 0.38, armor: 5, r: 0.32, xp: 10, capture: 0.6,
    desc: tr('保持距离放弩，你一靠近它就后退。弩箭可以躲开。', 'Keeps its distance and backs off when you close in. Bolts can be dodged.'),
    ally: tr('在安全距离放箭，被贴身会自己拉开。', 'Shoots from a safe distance and holds its ground.'),
  },
  shaman: {
    name: tr('骷髅法师', 'Skeleton Mage'), short: tr('骷髅法师', 'Mage'), role: tr('辅助', 'Support'), icon: '🔮', hp: 30, dmg: 9, speed: 3.0, range: 7, cd: 2.4, windup: 0.5, armor: 5, r: 0.34, xp: 14, capture: 0.45,
    desc: tr('躲在后排扔火球，还会复活死去的同伴——要抢在它之前收服尸体。', 'Throws fireballs from the back and raises fallen allies — claim the corpses first.'),
    ally: tr('治疗受伤的队友；只要它在场，其他召唤物复原更快。', 'Heals wounded allies; while it is around, fallen summons come back faster.'),
  },
};
export const MODS = {
  fast:      { name: tr('迅捷', 'Extra Fast'), short: tr('迅', 'Swift'), col: 0xe6eef8, desc: tr('移动和攻击都更快，跑动时留下残影', 'Moves and attacks faster, leaves an afterimage') },
  fire:      { name: tr('火焰强化', 'Fire Enchanted'), short: tr('火', 'Fire'), col: 0xff8a2a, desc: tr('武器带火，倒下时爆炸，灼烧周围的敌人', 'Burning weapon; explodes when it falls, scorching enemies nearby') },
  stone:     { name: tr('石肤', 'Stone Skin'), short: tr('石', 'Stone'), col: 0xb9b2a4, desc: tr('护甲极高、生命更多，不会被打断', 'Very high armour, more life, cannot be staggered') },
  cold:      { name: tr('冰冻', 'Cold Enchanted'), short: tr('冰', 'Cold'), col: 0x7cc8ff, desc: tr('攻击让敌人冻结减速，倒下时放出冰霜新星', 'Hits chill and slow; releases a frost nova when it falls') },
  poison:    { name: tr('剧毒', 'Venomous'), short: tr('毒', 'Venom'), col: 0x7dff5a, desc: tr('攻击让敌人中毒持续掉血，倒下时留下一团毒云', 'Hits poison over time; leaves a poison cloud when it falls') },
  lightning: { name: tr('闪电强化', 'Lightning Enchanted'), short: tr('雷', 'Storm'), col: 0xfff07a, desc: tr('攻击有几率连锁闪电打到旁边的敌人，倒下时放出雷暴', 'Hits may chain lightning to nearby enemies; thunder bursts when it falls') },
};
// affix names: one affix keeps its full name, several are joined by their one-character names (冰火, 冰火雷)
export const ROMAN = ['', 'Ⅱ', 'Ⅲ'];
export const affixName = (mods, champ = true) => !champ || !mods || !mods.length ? '' : (mods.length === 1 ? MODS[mods[0]].name : mods.map(m => MODS[m].short).join(tr('', '-'))) + SP;
// a unit's full name: affixes + type (no gap in Chinese, a space in English)
export const fullName = (type, mods, champ) => affixName(mods, champ) + TYPES[type].name;
export const MAX_AFFIX = 3, MAX_AFFIX_LV = 3;
// elemental look of champion affixes: weapon glow, particles off the weapon, hit sparks, projectile trails
export const ELEM = {
  fire:  { col: 0xff7a20, emis: 0x7a2a00, part: { col: 0xff8a2a, spd: 0.35, up: 1.3, grav: -1.4, life: 0.5, size: 0.24, spread: 0.08 },
           hit: { col: 0xff8a2a, spd: 2.2, up: 1.8, grav: -0.5, life: 0.45, size: 0.3 } },
  fast:  { col: 0xeef4ff, emis: 0x2a3444, part: { col: 0xf2f6ff, spd: 0.7, up: 0.3, grav: 0, life: 0.26, size: 0.15, spread: 0.08 },
           hit: { col: 0xf2f6ff, spd: 3.8, up: 0.8, grav: 0, life: 0.25, size: 0.16 } },
  cold:  { col: 0x7cc8ff, emis: 0x0c3a66, part: { col: 0xcfeeff, spd: 0.25, up: 0.1, grav: 1.6, life: 0.6, size: 0.17, spread: 0.1 },
           hit: { col: 0xbfe8ff, spd: 2.6, up: 1.4, grav: 2.5, life: 0.5, size: 0.22 } },
  poison: { col: 0x7dff5a, emis: 0x1f5a10, part: { col: 0x8aff5a, spd: 0.2, up: 0.8, grav: -0.6, life: 0.7, size: 0.2, spread: 0.08 },
           hit: { col: 0x7dff5a, spd: 1.8, up: 1.6, grav: -0.3, life: 0.6, size: 0.26 } },
  lightning: { col: 0xfff07a, emis: 0x5a4a08, part: { col: 0xfff6b0, spd: 1.6, up: 0.4, grav: 0, life: 0.16, size: 0.15, spread: 0.06 },
           hit: { col: 0xfffbd0, spd: 4.5, up: 1, grav: 0, life: 0.2, size: 0.17 } },
  stone: { col: 0xd8c49a, emis: 0x2e2618, part: { col: 0xb4a284, spd: 0.4, up: 0.2, grav: 5, life: 0.45, size: 0.17, spread: 0.1 },
           hit: { col: 0xa8987a, spd: 2.6, up: 2.4, grav: 7, life: 0.5, size: 0.22 } },
};
// overall pace: everyone moves slower and swings / casts a bit slower than the raw numbers below
export const PACE = { move: 0.75, act: 0.8 };
export const SKILLS = {
  spear: { name: tr('骨矛', 'Bone Spear'), mana: 2, cd: 0.34 },
  raise: { name: tr('唤魂', 'Raise'), mana: 8, extra: 2, cd: 0.4, range: 6, channel: 0.8 },
  mend:  { name: tr('愈合', 'Mend'), mana: 12, cd: 5 },
};
// packs by floor: each entry is a list of [type, count]
export const PACKS = [
  [['imp', 5], ['shaman', 1]],
  [['imp', 4]],
  [['archer', 3], ['brute', 1]],
  [['brute', 2]],
  [['imp', 3], ['archer', 2]],
  [['archer', 2], ['shaman', 1], ['imp', 2]],
];
export const xpNeed = L => Math.round(18 * Math.pow(L, 1.55));
export const partySize = L => Math.min(4, 1 + Math.floor(L / 3));

// ---------- summon skill trees: ranks are bought with 魂能点 (soul points), earned by absorbing other summons ----------
const pct = v => Math.round(v * 100) + '%';
export const TREE = {
  brute: [
    { id: 'leap', name: tr('跳劈', 'Leap Slam'), icon: '🪓', max: 5, desc: r => tr(`跳劈伤害 +${pct(0.2 * r)}，冷却 ${(6.5 - 0.6 * r).toFixed(1)} 秒，砸地范围 +${(0.15 * r).toFixed(2)} 米`, `Leap damage +${pct(0.2 * r)}, cooldown ${(6.5 - 0.6 * r).toFixed(1)}s, slam radius +${(0.15 * r).toFixed(2)} m`) },
    { id: 'bone', name: tr('坚骨', 'Hard Bones'), icon: '🦴', max: 5, desc: r => tr(`生命 +${pct(0.12 * r)}，护甲 +${5 * r}`, `Life +${pct(0.12 * r)}, armour +${5 * r}`) },
    { id: 'spin', name: tr('旋风斩', 'Whirlwind'), icon: '🌀', max: 3, unlock: true, desc: r => r ? tr(`身边有 2 个以上敌人时旋转劈砍两次，每次 ${pct(0.6 + 0.2 * r)} 伤害，冷却 ${7 - r} 秒`, `With 2+ enemies close, spins and hits all around twice for ${pct(0.6 + 0.2 * r)} damage each, cooldown ${7 - r}s`) : tr('解锁：被围住时旋转劈砍周围所有敌人', 'Unlock: when surrounded, spins and hits everything around') },
    { id: 'taunt', name: tr('战吼', 'War Cry'), icon: '📢', max: 3, unlock: true, desc: r => r ? tr(`受到伤害 -${pct(0.08 * r)}，${(5 + 1.5 * r).toFixed(1)} 米内的敌人更想打它`, `Damage taken -${pct(0.08 * r)}; enemies within ${(5 + 1.5 * r).toFixed(1)} m prefer to attack it`) : tr('解锁：减伤，并把更远的敌人引向自己', 'Unlock: takes less damage and draws enemies from farther away') },
  ],
  imp: [
    { id: 'lunge', name: tr('突刺', 'Lunge'), icon: '🗡️', max: 5, desc: r => tr(`突刺伤害 +${pct(0.2 * r)}，冷却 ${(4 - 0.4 * r).toFixed(1)} 秒`, `Lunge damage +${pct(0.2 * r)}, cooldown ${(4 - 0.4 * r).toFixed(1)}s`) },
    { id: 'crit', name: tr('致命', 'Deadly'), icon: '💢', max: 5, desc: r => tr(`暴击率 +${pct(0.06 * r)}，暴击伤害 ${pct(2 + 0.1 * r)}`, `Crit chance +${pct(0.06 * r)}, crit damage ${pct(2 + 0.1 * r)}`) },
    { id: 'haste', name: tr('迅捷', 'Haste'), icon: '💨', max: 5, desc: r => tr(`攻击间隔 -${pct(0.07 * r)}，移动速度 +${pct(0.04 * r)}`, `Attack interval -${pct(0.07 * r)}, move speed +${pct(0.04 * r)}`) },
    { id: 'chain', name: tr('连环突刺', 'Chain Lunge'), icon: '⚡', max: 3, unlock: true, desc: r => r ? tr(`突刺命中后立刻再突刺附近另一个敌人，最多连 ${r} 次`, `After a lunge hits, lunges at another enemy nearby, up to ${r} times`) : tr('解锁：突刺命中后接着扑向下一个敌人', 'Unlock: a lunge that hits jumps on to the next enemy') },
  ],
  archer: [
    { id: 'multi', name: tr('多重射击', 'Multishot'), icon: '🏹', max: 3, unlock: true, desc: r => r ? tr(`一次射出 ${1 + r} 支弩箭（额外的箭 75% 伤害）`, `Shoots ${1 + r} bolts at once (extra bolts deal 75%)`) : tr('解锁：一次射出多支弩箭', 'Unlock: shoots several bolts at once') },
    { id: 'pierce', name: tr('穿透', 'Pierce'), icon: '🎯', max: 3, unlock: true, desc: r => r ? tr(`弩箭可以穿过 ${r} 个敌人`, `Bolts pass through ${r} enemies`) : tr('解锁：弩箭穿透敌人', 'Unlock: bolts pierce enemies') },
    { id: 'eagle', name: tr('鹰眼', 'Eagle Eye'), icon: '👁️', max: 5, desc: r => tr(`伤害 +${pct(0.12 * r)}，射程 +${(0.4 * r).toFixed(1)} 米`, `Damage +${pct(0.12 * r)}, range +${(0.4 * r).toFixed(1)} m`) },
    { id: 'rapid', name: tr('快速装填', 'Quick Reload'), icon: '⏱️', max: 5, desc: r => tr(`射击间隔 -${pct(0.08 * r)}`, `Shot interval -${pct(0.08 * r)}`) },
  ],
  shaman: [
    { id: 'heal', name: tr('治愈', 'Heal'), icon: '💚', max: 5, desc: r => tr(`治疗量 +${pct(0.2 * r)}，治疗冷却 ${(3.5 - 0.3 * r).toFixed(1)} 秒`, `Healing +${pct(0.2 * r)}, heal cooldown ${(3.5 - 0.3 * r).toFixed(1)}s`) },
    { id: 'fire', name: tr('火球', 'Fireball'), icon: '🔥', max: 5, desc: r => tr(`火球伤害 +${pct(0.15 * r)}，爆炸范围 +${(0.15 * r).toFixed(2)} 米`, `Fireball damage +${pct(0.15 * r)}, blast radius +${(0.15 * r).toFixed(2)} m`) },
    { id: 'mass', name: tr('群体治疗', 'Mass Heal'), icon: '✨', max: 3, unlock: true, desc: r => r ? tr(`治疗时附近 ${(2.5 + 0.5 * r).toFixed(1)} 米内的队友也回复 ${pct(0.35 + 0.15 * r)}`, `Heals also restore ${pct(0.35 + 0.15 * r)} to allies within ${(2.5 + 0.5 * r).toFixed(1)} m`) : tr('解锁：治疗溅射到附近队友', 'Unlock: heals splash onto nearby allies') },
    { id: 'soul', name: tr('引魂', 'Soul Call'), icon: '👻', max: 3, unlock: true, desc: r => r ? tr(`队伍复原速度再 +${pct(0.2 * r)}`, `Party revives a further +${pct(0.2 * r)} faster`) : tr('解锁：让倒下的队友更快复原', 'Unlock: fallen summons come back faster') },
  ],
};
// what a summon is worth when absorbed: experience for the absorber (same type +50%) and soul points
export const soulPoints = en => 1 + Math.floor((en.level - 1) / 3);
export const soulXP = (en, to) => Math.round(xpNeed(en.level) * 0.8 * 0.6 * (en.type === to.type ? 1.5 : 1));

// ---------- equipment: summons only. Weapons are per monster type (collect them all), armour (shields) fits everyone ----------
export const QUAL = [
  { name: tr('普通', 'Normal'), col: '#e6dfd2', hex: 0xe6dfd2, k: 1 },
  { name: tr('精良', 'Magic'), col: '#6fa8ff', hex: 0x5f9cff, k: 1.4 },
  { name: tr('稀有', 'Rare'), col: '#ffcf4a', hex: 0xffc83a, k: 1.9 },
];
export const WEAPONS = {
  brute:  { cat: tr('斧', 'Axe'), bases: [{ name: tr('骨斧', 'Bone Axe'), model: 'sk_axe', dm: 1, cd: 1 }, { name: tr('战斧', 'Hand Axe'), model: 'axe_1handed', dm: 0.82, cd: 0.82 }, { name: tr('巨斧', 'Great Axe'), model: 'axe_2handed', dm: 1.32, cd: 1.16 }] },
  imp:    { cat: tr('刃', 'Blade'), bases: [{ name: tr('骨刃', 'Bone Blade'), model: 'sk_blade', dm: 1, cd: 1 }, { name: tr('匕首', 'Dagger'), model: 'dagger', dm: 0.8, cd: 0.8 }, { name: tr('长剑', 'Long Sword'), model: 'sword_1handed', dm: 1.25, cd: 1.12 }] },
  archer: { cat: tr('弩', 'Crossbow'), bases: [{ name: tr('骨弩', 'Bone Crossbow'), model: 'sk_crossbow', dm: 1, cd: 1 }, { name: tr('轻弩', 'Light Crossbow'), model: 'crossbow_1handed', dm: 0.82, cd: 0.82 }, { name: tr('重弩', 'Heavy Crossbow'), model: 'crossbow_2handed', dm: 1.3, cd: 1.15 }] },
  shaman: { cat: tr('杖', 'Staff'), bases: [{ name: tr('骨杖', 'Bone Staff'), model: 'sk_staff', dm: 1, cd: 1 }, { name: tr('魔杖', 'Wand'), model: 'wand', dm: 0.82, cd: 0.82 }, { name: tr('法师长杖', 'Mage Staff'), model: 'mage_staff', dm: 1.3, cd: 1.15 }] },
};
export const ARMORS = [{ name: tr('骨盾', 'Bone Shield'), model: 'sk_shield_large', hm: 1.3, am: 0.7 }, { name: tr('圆盾', 'Round Shield'), model: 'shield_round', hm: 1, am: 1 }, { name: tr('方盾', 'Tower Shield'), model: 'shield_square', hm: 0.7, am: 1.4 }];
// rare items get one extra line
const EXTRA = { w: [['spd', '', il => 6 + il], ['hp', '', il => 6 + 2 * il]], a: [['dmg', '', il => 5 + 2 * il], ['move', '', il => 5 + il]] };
export const BAG_MAX = 40;
const pickI = n => Math.floor(Math.random() * n), jit = () => 0.88 + Math.random() * 0.24;
export function rollItem(id, il, q, slot = Math.random() < 0.62 ? 'w' : 'a', type = Object.keys(WEAPONS)[pickI(4)]) {
  const qm = QUAL[q].k, it = { id, slot, q, il, v: {} };
  if (slot === 'w') { it.type = type; it.b = pickI(3); const B = WEAPONS[type].bases[it.b]; it.v.dmg = Math.round((10 + 4 * il) * qm * B.dm * jit()); }
  else { it.b = pickI(ARMORS.length); const B = ARMORS[it.b]; it.v.hp = Math.round((8 + 3 * il) * qm * B.hm * jit()); it.v.arm = Math.round((4 + 2 * il) * qm * B.am * jit()); }
  if (q === 2) { const [k, , f] = EXTRA[slot][pickI(2)]; it.v[k] = Math.round(f(il) * jit()); }
  return it;
}
export const itemBase = it => it.slot === 'w' ? WEAPONS[it.type].bases[it.b] : ARMORS[it.b];
export const itemName = it => (it.q ? QUAL[it.q].name + ' ' : '') + itemBase(it).name;
export const itemIcon = it => it.slot === 'w' ? TYPES[it.type].icon : '🛡️';
export function itemLines(it) {
  const v = it.v, B = itemBase(it), L = [];
  const W = { dmg: tr('伤害', 'Damage'), cd: tr('攻击间隔', 'Attack interval'), spd: tr('攻击速度', 'Attack speed'), hp: tr('生命', 'Life'), arm: tr('护甲', 'Armour'), move: tr('移动速度', 'Move speed') };
  if (it.slot === 'w') { L.push(`${W.dmg} +${v.dmg}%`); if (B.cd !== 1) L.push(`${W.cd} ${B.cd < 1 ? '-' : '+'}${Math.round(Math.abs(1 - B.cd) * 100)}%`); if (v.spd) L.push(`${W.spd} +${v.spd}%`); if (v.hp) L.push(`${W.hp} +${v.hp}%`); }
  else { L.push(`${W.hp} +${v.hp}%`, `${W.arm} +${v.arm}`); if (v.dmg) L.push(`${W.dmg} +${v.dmg}%`); if (v.move) L.push(`${W.move} +${v.move}%`); }
  return L;
}
// rough power, for the ▲ / ▼ comparison
export function itemScore(it) { if (!it) return 0; const v = it.v, B = itemBase(it);
  return it.slot === 'w' ? (100 + v.dmg) / B.cd * (1 + (v.spd || 0) / 100) * (1 + (v.hp || 0) / 300) : (100 + v.hp) * (1 + v.arm / 60) * (1 + (v.dmg || 0) / 150) * (1 + (v.move || 0) / 200); }
export const itemFits = (it, type) => it.slot === 'a' || it.type === type;
// furnace: everything thrown in turns into one random item; more (and better) input, better odds
export const itemPts = it => [1, 3, 8][it.q] * (1 + it.il / 10);
export function furnaceOdds(items) { const p = items.reduce((a, it) => a + itemPts(it), 0), gold = Math.min(0.7, 0.01 + p * 0.022), blue = Math.min(1 - gold, 0.15 + p * 0.07); return { gold, blue, white: Math.max(0, 1 - gold - blue), pts: p }; }
export function furnaceRoll(items, id) { const o = furnaceOdds(items), r = Math.random(), q = r < o.gold ? 2 : r < o.gold + o.blue ? 1 : 0, il = Math.max(...items.map(it => it.il)) + (q === 2 ? 1 : 0); return rollItem(id, il, q); }
// drops: champions always drop something decent, normal monsters sometimes
export function rollDrop(id, depth, champ) {
  if (!champ && Math.random() > 0.09) return null; const r = Math.random(), q = champ ? (r < 0.3 ? 2 : 1) : (r < 0.05 ? 2 : r < 0.3 ? 1 : 0);
  return rollItem(id, Math.max(1, depth) + (champ ? 1 : 0), q);
}
