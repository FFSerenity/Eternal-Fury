import { tr, SP } from './i18n.js';
// All tunable content lives here (like Diablo II's data tables): monster types, champion affixes, skills, packs.
export const TYPES = {
  imp: {
    name: tr('骷髅小兵', 'Skeleton Minion'), short: tr('骷髅小兵', 'Minion'), role: tr('快攻', 'Striker'), icon: '🗡️', hp: 20, dmg: 3.5, speed: 4.4, range: 0.85, cd: 0.8, windup: 0.16, armor: 0, r: 0.32, xp: 6, capture: 0.6,
    desc: tr('速度快，成群结队。偶尔有胆小的会被吓跑，过一会儿再冲回来。', 'Fast and comes in packs. The odd one panics and runs, then rushes back.'),
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
export const fullName = (type, mods, champ, en) => affixName(mods, champ) + (en && techOf(en) ? techOf(en).name : TYPES[type].name);
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
// party slots: 1 to start, then more at these levels (gaps of 4, 5 and 6 levels)
export const PARTY_AT = [5, 10, 16];
export const partySize = L => 1 + PARTY_AT.filter(l => L >= l).length;

// ---------- summon skill trees: ranks are bought with 魂能点 (soul points), earned by absorbing other summons ----------
const pct = v => Math.round(v * 100) + '%';
export const TREE = {
  brute: [
    { id: 'leap', name: tr('跳劈', 'Leap Slam'), icon: '🪓', max: 5, desc: r => tr(`跳劈造成 ${pct(0.55 * (1 + 0.12 * r))} 伤害并击晕，冷却 ${(6.5 - 0.6 * r).toFixed(1)} 秒，砸地范围 +${(0.15 * r).toFixed(2)} 米`, `Leap deals ${pct(0.55 * (1 + 0.12 * r))} damage and stuns, cooldown ${(6.5 - 0.6 * r).toFixed(1)}s, slam radius +${(0.15 * r).toFixed(2)} m`) },
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
export const soulXP = (en, to) => Math.round(xpNeed(en.level) * 0.8 * 0.35 * (en.type === to.type ? 1.5 : 1));

// ---------- equipment: summons only. Weapons are per monster type (collect them all), armour (shields) fits everyone ----------
export const QUAL = [
  { name: tr('普通', 'Normal'), col: '#e6dfd2', hex: 0xe6dfd2, k: 1 },
  { name: tr('精良', 'Magic'), col: '#6fa8ff', hex: 0x5f9cff, k: 1.4 },
  { name: tr('稀有', 'Rare'), col: '#ffcf4a', hex: 0xffc83a, k: 1.9 },
  { name: tr('史诗', 'Epic'), col: '#c77dff', hex: 0xb46cff, k: 2.4 },
];
export const WEAPONS = {
  brute:  { cat: tr('斧', 'Axe'), bases: [{ name: tr('骨斧', 'Bone Axe'), model: 'sk_axe', dm: 1, cd: 1 }, { name: tr('战斧', 'Hand Axe'), model: 'axe_1handed', dm: 0.82, cd: 0.82 }, { name: tr('巨斧', 'Great Axe'), model: 'axe_2handed', dm: 1.32, cd: 1.16 },
    { name: tr('魂钢钻头', 'Soulsteel Drill'), cat: tr('钻头', 'Drill'), model: 'drill', dm: 1, cd: 1, epic: true }] }, // [3]: tech line (forge only)
  imp:    { cat: tr('刃', 'Blade'), bases: [{ name: tr('骨刃', 'Bone Blade'), model: 'sk_blade', dm: 1, cd: 1 }, { name: tr('匕首', 'Dagger'), model: 'dagger', dm: 0.8, cd: 0.8 }, { name: tr('长剑', 'Long Sword'), model: 'sword_1handed', dm: 1.25, cd: 1.12 },
    { name: tr('噬魂机枪', 'Soul Reaper Gatling'), cat: tr('机枪', 'Gatling'), model: 'gatling', dm: 1, cd: 1, epic: true }] }, // [3]: the easter egg (never rolled)
  archer: { cat: tr('弩', 'Crossbow'), bases: [{ name: tr('骨弩', 'Bone Crossbow'), model: 'sk_crossbow', dm: 1, cd: 1 }, { name: tr('轻弩', 'Light Crossbow'), model: 'crossbow_1handed', dm: 0.82, cd: 0.82 }, { name: tr('重弩', 'Heavy Crossbow'), model: 'crossbow_2handed', dm: 1.3, cd: 1.15 },
    { name: tr('裂魂臼炮', 'Soulsplitter Mortar'), cat: tr('臼炮', 'Mortar'), model: 'mortar', dm: 1, cd: 1, epic: true }] }, // [3]: tech line (forge only)
  shaman: { cat: tr('杖', 'Staff'), bases: [{ name: tr('骨杖', 'Bone Staff'), model: 'sk_staff', dm: 1, cd: 1 }, { name: tr('魔杖', 'Wand'), model: 'wand', dm: 0.82, cd: 0.82 }, { name: tr('法师长杖', 'Mage Staff'), model: 'mage_staff', dm: 1.3, cd: 1.15 },
    { name: tr('魂钢指挥杖', 'Soulsteel Command Rod'), cat: tr('指挥杖', 'Command Rod'), model: 'cmdrod', dm: 1, cd: 1, epic: true }] }, // [3]: tech line (forge only)
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
export const itemName = it => (it.q && it.q < 3 ? QUAL[it.q].name + ' ' : '') + itemBase(it).name;
// ---------- 科技流: epic weapons that turn a summon into a tech unit (own look, own skill tree; take it off and it's back) ----------
// the gatling is also the coffin easter egg; all of them come out of the forge when rare gear is smelted
export const TECH = {
  mg: { type: 'imp', key: 'gunner', name: tr('机枪骷髅', 'Gunner Skeleton'), short: tr('机枪骷髅', 'Gunner'), role: tr('重火力', 'Heavy gunner'),
    ally: tr('远程持续扫射；会往敌群里扔手雷，破甲弹越打越疼，敌人多时架稳机枪边走边扫射。', 'Sustained fire from range; lobs grenades into packs, armour-piercing rounds that hurt more the longer it fires, and braces the gun to fire on the move when the fight gets big.'),
    lines: [tr('骷髅小兵装备后变成机枪骷髅', 'A Skeleton Minion holding it becomes a Gunner Skeleton'), tr('远程连射：每轮 6 发子弹', 'Ranged bursts: 6 rounds a volley')] },
  mortar: { type: 'archer', key: 'bomber', name: tr('炮手骷髅', 'Bombardier Skeleton'), short: tr('炮手骷髅', 'Bombardier'), role: tr('远程轰炸', 'Artillery'),
    ally: tr('远远地抛射炮弹，落点范围爆炸并击退；敌人贴脸会后撤。能打集束弹、燃烧弹，敌人扎堆时连轰齐射。', 'Lobs shells from far away that blow up whole groups and knock them back; backs off from anyone in its face. Cluster shells, incendiary shells, and a barrage when enemies bunch up.'),
    lines: [tr('骷髅弩手装备后变成炮手骷髅', 'A Skeleton Archer holding it becomes a Bombardier Skeleton'), tr('抛射炮弹：范围爆炸 + 击退，射程 9 米', 'Lobbed shells: area blast + knock-back, 9 m range')] },
  drill: { type: 'brute', key: 'mech', name: tr('机甲骷髅', 'Mech Skeleton'), short: tr('机甲骷髅', 'Mech'), role: tr('重装前排', 'Heavy front line'),
    ally: tr('穿着魂钢机甲的战士：钻头连钻带击退，喷射冲锋撞进人堆，撑起护盾力场吸收伤害并嘲讽敌人，过载时以自身为中心放出电磁冲击波。', 'A warrior in soulsteel armour: the drill grinds in several hits and knocks back, a rocket dash rams it into packs, a shield field soaks damage and draws enemies onto it, and overload sends out an EMP shockwave all around.'),
    lines: [tr('骷髅战士装备后变成机甲骷髅', 'A Skeleton Warrior holding it becomes a Mech Skeleton'), tr('钻击：每次出手连钻 3 下，最后一下击退', 'Drill: each attack grinds 3 times, the last one knocks back')] },
  rod: { type: 'shaman', key: 'engineer', name: tr('机械师骷髅', 'Engineer Skeleton'), short: tr('机械师骷髅', 'Engineer'), role: tr('无人机指挥', 'Drone commander'),
    ally: tr('戴安全帽的骷髅法师，指挥一群骷髅无人机：攻击无人机围着它飞、用激光扫射敌人，修理无人机飞去给受伤最重的队友维修；还能呼叫轨道打击，从天上砸下一道光柱。', 'A skeleton mage in a hard hat commanding a swarm of skull drones: attack drones circle it and sweep enemies with lasers, a repair drone flies off to fix whoever is hurt worst, and it can call down an orbital strike — a column of light from the sky.'),
    lines: [tr('骷髅法师装备后变成机械师骷髅', 'A Skeleton Mage holding it becomes an Engineer Skeleton'), tr('无人机：攻击无人机激光扫射，修理无人机为队友维修', 'Drones: attack drones fire lasers, a repair drone fixes up allies')] },
};
export const techOf = en => { const w = en && en.gear && en.gear.w, T = w && w.uniq && TECH[w.uniq]; return T && T.type === en.type ? T : null; };
export const techName = en => { const T = techOf(en); return T ? T.name : TYPES[en.type].name; };
// the coffin gatling is a fixed early piece; forge epics scale with what went in
export function makeTech(uniq, id, il) { const T = TECH[uniq], it = { id, slot: 'w', type: T.type, b: 3, q: 3, il: il || 5, uniq, v: {} };
  if (!il && uniq === 'mg') it.v = { dmg: 40, spd: 15 }; else { it.v.dmg = Math.round((10 + 4 * it.il) * QUAL[3].k * jit()); it.v.spd = 6 + it.il; } return it; }
export const makeGun = id => makeTech('mg', id);
export const isGunner = en => !!(techOf(en) && techOf(en).key === 'gunner');
export const GUNNER = TECH.mg;
// 机枪骷髅 has its own tree (no attack speed in it): grenade (innate), armour-piercing rounds, brace, cluster grenades
TREE.gunner = [
  { id: 'nade', name: tr('手雷', 'Grenade'), icon: '💣', max: 5, desc: r => tr(`往敌群扔手雷：${pct(1.6 + 0.35 * r)} 伤害，爆炸半径 ${(1.7 + 0.12 * r).toFixed(1)} 米，冷却 ${(9 - 0.8 * r).toFixed(1)} 秒`, `Lobs a grenade into a pack: ${pct(1.6 + 0.35 * r)} damage within ${(1.7 + 0.12 * r).toFixed(1)} m, cooldown ${(9 - 0.8 * r).toFixed(1)}s`) },
  { id: 'shred', name: tr('破甲弹', 'AP Rounds'), icon: '🔩', max: 5, desc: r => tr(`每发子弹给目标叠 1 层破甲，最多 ${8 * r} 层：每层护甲 -1、受到的所有伤害 +0.6%（满层 +${(4.8 * r).toFixed(0)}%）。停火 3 秒后消退`, `Every round adds a stack of shred, up to ${8 * r}: each stack −1 armour and +0.6% damage taken from everyone (+${(4.8 * r).toFixed(0)}% at full stacks). Fades 3 s after the shooting stops`) },
  { id: 'deploy', name: tr('架起', 'Dig In'), icon: '🛡️', max: 3, unlock: true, desc: r => r ? tr(`敌人多（3 个以上）或有精英时架稳机枪 ${(4 + 1.5 * r).toFixed(1)} 秒：边走边扫射（移动速度 -50%），不会被击退，射速 +60%，伤害 +${pct(0.2 * r)}，射程 +2.5 米，受到伤害 -35%；冷却 ${20 - 2 * r} 秒`, `With 3+ enemies close or an elite, braces the gatling for ${(4 + 1.5 * r).toFixed(1)} s: fires on the move at half speed, can't be knocked back, +60% fire rate, +${pct(0.2 * r)} damage, +2.5 m range, −35% damage taken; cooldown ${20 - 2 * r}s`) : tr('解锁：架稳机枪，边走边扫射', 'Unlock: brace the gatling and fire on the move') },
  { id: 'cluster', name: tr('集束手雷', 'Cluster Grenade'), icon: '🎆', max: 3, unlock: true, desc: r => r ? tr(`手雷炸开后再散出 ${r + 1} 颗小炸弹，每颗 ${pct(0.45)} 手雷伤害`, `Grenades burst into ${r + 1} bomblets, each dealing ${pct(0.45)} of the grenade's damage`) : tr('解锁：手雷炸开后散出小炸弹', 'Unlock: grenades scatter bomblets') },
];
// 炮手骷髅: heavier shells (innate), cluster shells, incendiary shells, barrage
TREE.bomber = [
  { id: 'shell', name: tr('重炮', 'Heavy Shells'), icon: '💥', max: 5, desc: r => tr(`炮弹伤害 ${pct(2 + 0.15 * r)}，爆炸半径 ${(1.6 + 0.1 * r).toFixed(1)} 米`, `Shells deal ${pct(2 + 0.15 * r)} damage within ${(1.6 + 0.1 * r).toFixed(1)} m`) },
  { id: 'mcluster', name: tr('集束弹', 'Cluster Shells'), icon: '🎆', max: 3, unlock: true, desc: r => r ? tr(`炮弹落地后再弹出 ${r + 1} 颗子弹，每颗 ${pct(0.4)} 炮弹伤害`, `Shells burst into ${r + 1} bomblets, each dealing ${pct(0.4)} of the shell's damage`) : tr('解锁：炮弹炸开后弹出子弹', 'Unlock: shells scatter bomblets') },
  { id: 'incend', name: tr('燃烧弹', 'Incendiary'), icon: '🔥', max: 3, unlock: true, desc: r => r ? tr(`每 3 发里有 1 发燃烧弹：落点烧起 ${(1.4 + 0.15 * r).toFixed(1)} 米的火圈，持续 ${(2.5 + 0.5 * r).toFixed(1)} 秒，每秒 ${pct(0.45 + 0.15 * r)} 伤害`, `Every 3rd shell is incendiary: a ${(1.4 + 0.15 * r).toFixed(1)} m fire burns for ${(2.5 + 0.5 * r).toFixed(1)} s, ${pct(0.45 + 0.15 * r)} damage a second`) : tr('解锁：燃烧弹留下火圈', 'Unlock: incendiary shells leave fires') },
  { id: 'barrage', name: tr('齐射', 'Barrage'), icon: '🎯', max: 3, unlock: true, desc: r => r ? tr(`敌人扎堆（3 个以上）或有精英时，朝最密集处连轰 ${r + 2} 发；冷却 ${(14 - 1.5 * r).toFixed(1)} 秒`, `When 3+ enemies bunch up or an elite shows up, fires ${r + 2} shells in quick succession at the thickest spot; cooldown ${(14 - 1.5 * r).toFixed(1)}s`) : tr('解锁：敌人扎堆时连轰齐射', 'Unlock: a quick barrage at packs') },
];
// 机甲骷髅: drill (innate), rocket dash (from the start, like the leap), shield field, overload EMP
TREE.mech = [
  { id: 'drill', name: tr('魂钢钻头', 'Soulsteel Drill'), icon: '🔩', max: 5, desc: r => tr(`钻击连钻 3 下，总伤害 ${pct((1.5 + 0.12 * r))}，最后一下击退`, `The drill grinds 3 times for ${pct(1.5 + 0.12 * r)} damage in all; the last one knocks back`) },
  { id: 'rocket', name: tr('喷射冲锋', 'Rocket Dash'), icon: '🚀', max: 3, desc: r => tr(`推进器全开冲向 3–9 米外的敌人，撞开路上的敌人（${pct(0.6 + 0.15 * r)} 伤害），落点冲击眩晕；冷却 ${(7 - 0.7 * r).toFixed(1)} 秒`, `Thrusters at full: rams an enemy 3–9 m away, knocking aside everything in the way (${pct(0.6 + 0.15 * r)} damage), stunning at the end; cooldown ${(7 - 0.7 * r).toFixed(1)}s`) },
  { id: 'aegis', name: tr('护盾力场', 'Shield Field'), icon: '🛡️', max: 3, unlock: true, desc: r => r ? tr(`被围或血量低时撑起护盾 ${4 + r} 秒：吸收 ${pct(0.25 + 0.1 * r)} 最大生命的伤害，并嘲讽 ${6 + r} 米内的敌人；冷却 ${(16 - 1.5 * r).toFixed(1)} 秒`, `When surrounded or hurt, raises a shield for ${4 + r} s: soaks ${pct(0.25 + 0.1 * r)} of max life and draws every enemy within ${6 + r} m onto it; cooldown ${(16 - 1.5 * r).toFixed(1)}s`) : tr('解锁：护盾力场', 'Unlock: shield field') },
  { id: 'overload', name: tr('过载', 'Overload'), icon: '⚡', max: 3, unlock: true, desc: r => r ? tr(`身边敌人多（3 个以上）时蓄能过载，以自身为中心放出 ${(3 + 0.3 * r).toFixed(1)} 米电磁冲击波：${pct(1.1 + 0.3 * r)} 伤害，眩晕 ${(0.8 + 0.3 * r).toFixed(1)} 秒并击退；冷却 ${11 - r} 秒`, `With 3+ enemies close, overloads and sends out a ${(3 + 0.3 * r).toFixed(1)} m EMP shockwave: ${pct(1.1 + 0.3 * r)} damage, ${(0.8 + 0.3 * r).toFixed(1)} s stun and knock-back; cooldown ${11 - r}s`) : tr('解锁：过载电磁冲击波', 'Unlock: overload EMP shockwave') },
];
// 机械师骷髅: attack drones (innate; one more per rank), repair drone (from the start), orbital strike, prism lasers
TREE.engineer = [
  { id: 'drones', name: tr('攻击无人机', 'Attack Drones'), icon: '🛸', max: 4, desc: r => tr(`${1 + r} 架攻击无人机环绕飞行，各自每 1.5 秒射出一道激光，造成 ${pct(0.32)} 伤害`, `${1 + r} attack drone${r ? 's' : ''} circle it, each firing a laser every 1.5 s for ${pct(0.32)} damage`) },
  { id: 'repair', name: tr('修理无人机', 'Repair Drone'), icon: '🔧', max: 3, desc: r => tr(`修理无人机飞到受伤最重的队友（包括你）身边持续维修，每 1.2 秒回复 ${pct(0.06 * (1 + 0.25 * r))} 最大生命（另加随等级成长的固定量）`, `The repair drone flies to whoever is hurt worst (you included) and keeps fixing them: ${pct(0.06 * (1 + 0.25 * r))} of max life every 1.2 s (plus a little that grows with level)`) },
  { id: 'orbital', name: tr('轨道打击', 'Orbital Strike'), icon: '🛰️', max: 3, unlock: true, desc: r => r ? tr(`敌人扎堆（3 个以上）或有精英时标记目标，1 秒后天降光柱：${(2 + 0.2 * r).toFixed(1)} 米内 ${pct(2.4 + 0.5 * r)} 伤害，眩晕 ${(1 + 0.3 * r).toFixed(1)} 秒；冷却 ${15 - 2 * r} 秒`, `When 3+ enemies bunch up or an elite shows up, marks the spot; a second later a column of light hits ${(2 + 0.2 * r).toFixed(1)} m around it for ${pct(2.4 + 0.5 * r)} damage and a ${(1 + 0.3 * r).toFixed(1)} s stun; cooldown ${15 - 2 * r}s`) : tr('解锁：呼叫轨道打击', 'Unlock: call down an orbital strike') },
  { id: 'prism', name: tr('折射激光', 'Prism Lasers'), icon: '🔷', max: 3, unlock: true, desc: r => r ? tr(`无人机的激光命中后折射到附近 ${r} 个敌人，每次 ${pct(0.6)} 伤害`, `Drone lasers bounce on to ${r} more enem${r > 1 ? 'ies' : 'y'} nearby for ${pct(0.6)} damage each`) : tr('解锁：激光折射到附近的敌人', 'Unlock: lasers bounce to nearby enemies') },
];
export const treeKey = en => { const T = techOf(en); return T ? T.key : en.type; };
export const itemIcon = it => it.slot === 'w' ? TYPES[it.type].icon : '🛡️';
export function itemLines(it) {
  const v = it.v, B = itemBase(it), L = [];
  const W = { dmg: tr('伤害', 'Damage'), cd: tr('攻击间隔', 'Attack interval'), spd: tr('攻击速度', 'Attack speed'), hp: tr('生命', 'Life'), arm: tr('护甲', 'Armour'), move: tr('移动速度', 'Move speed') };
  if (it.slot === 'w') { L.push(`${W.dmg} +${v.dmg}%`); if (B.cd !== 1) L.push(`${W.cd} ${B.cd < 1 ? '-' : '+'}${Math.round(Math.abs(1 - B.cd) * 100)}%`); if (v.spd) L.push(`${W.spd} +${v.spd}%`); if (v.hp) L.push(`${W.hp} +${v.hp}%`); }
  else { L.push(`${W.hp} +${v.hp}%`, `${W.arm} +${v.arm}`); if (v.dmg) L.push(`${W.dmg} +${v.dmg}%`); if (v.move) L.push(`${W.move} +${v.move}%`); }
  if (it.uniq && TECH[it.uniq]) L.push(...TECH[it.uniq].lines.map(l => '✦ ' + l));
  return L;
}
// rough power, for the ▲ / ▼ comparison
export function itemScore(it) { if (!it) return 0; const v = it.v, B = itemBase(it);
  return it.slot === 'w' ? (100 + v.dmg) / B.cd * (1 + (v.spd || 0) / 100) * (1 + (v.hp || 0) / 300) : (100 + v.hp) * (1 + v.arm / 60) * (1 + (v.dmg || 0) / 150) * (1 + (v.move || 0) / 200); }
export const itemFits = (it, type) => it.slot === 'a' || it.type === type;
// furnace: everything thrown in turns into one random item; more (and better) input, better odds
export const itemPts = it => [1, 3, 8, 20][it.q] * (1 + it.il / 10);
// 科技流 epics: every rare piece in the forge (weapon or shield) gives +3% (at most 15%); 魂钢能量 (soul steel) builds up by one per rare
// piece smelted without an epic and guarantees one at TECH_PITY. Which one: weighted by the weapon types put in (one crossbow + rare shields
// → the mortar; no weapons at all → any of them)
export const TECH_PITY = 15;
export const rareItems = items => items.filter(it => it.q === 2).length;
export function furnaceOdds(items, pity = 0) { const p = items.reduce((a, it) => a + itemPts(it), 0), nr = rareItems(items), epic = !nr ? 0 : pity + nr >= TECH_PITY ? 1 : Math.min(0.15, 0.03 * nr), k = 1 - epic;
  const gold = Math.min(0.7, 0.01 + p * 0.022), blue = Math.min(1 - gold, 0.15 + p * 0.07); return { epic, gold: gold * k, blue: blue * k, white: Math.max(0, 1 - gold - blue) * k, pts: p, nr }; }
export function furnaceRoll(items, id, pity = 0) { const o = furnaceOdds(items, pity), r = Math.random(), il = Math.max(...items.map(it => it.il));
  if (r < o.epic) { const keys = Object.keys(TECH), w = keys.map(k => items.filter(it => it.slot === 'w' && it.type === TECH[k].type).length), tot = w.reduce((a, b) => a + b, 0);
    let x = Math.random() * (tot || keys.length), i = 0; for (; i < keys.length - 1; i++) { x -= tot ? w[i] : 1; if (x < 0) break; } return makeTech(keys[i], id, il + 1); }
  const q = r < o.epic + o.gold ? 2 : r < o.epic + o.gold + o.blue ? 1 : 0; return rollItem(id, il + (q === 2 ? 1 : 0), q); }
// drops: champions always drop something decent, normal monsters sometimes
export function rollDrop(id, depth, champ) {
  if (!champ && Math.random() > 0.09) return null; const r = Math.random(), q = champ ? (r < 0.3 ? 2 : 1) : (r < 0.05 ? 2 : r < 0.3 ? 1 : 0);
  return rollItem(id, Math.max(1, depth) + (champ ? 1 : 0), q);
}
