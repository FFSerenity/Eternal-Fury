// All tunable content lives here (like Diablo II's data tables): monster types, champion affixes, skills, packs.
export const TYPES = {
  imp: {
    name: '骷髅小兵', role: '快攻', icon: '🗡️', hp: 20, dmg: 3.5, speed: 4.4, range: 0.85, cd: 0.8, windup: 0.16, armor: 0, r: 0.32, xp: 6, capture: 0.75,
    desc: '速度快，成群结队。看到同伴散架会惊慌逃跑，过一会儿再冲回来。', ally: '速度快的近战输出，会突刺冲向敌人（必定暴击），平时攻击也有几率暴击。',
  },
  brute: {
    name: '骷髅战士', role: '坦克', icon: '🪓', hp: 75, dmg: 12, speed: 2.5, range: 1.3, cd: 1.7, windup: 0.62, armor: 20, r: 0.5, xp: 16, capture: 0.5,
    desc: '慢，但蓄力重击会把人打退。被重击打断时会踉跄。', ally: '会跳劈砸进敌群，把被砸中的敌人引到自己身上，替你扛伤害。',
  },
  archer: {
    name: '骷髅弩手', role: '远程', icon: '🏹', hp: 26, dmg: 6, speed: 3.3, range: 7, cd: 1.5, windup: 0.38, armor: 5, r: 0.32, xp: 10, capture: 0.6,
    desc: '保持距离放弩，你一靠近它就后退。弩箭可以躲开。', ally: '在安全距离放箭，被贴身会自己拉开。',
  },
  shaman: {
    name: '骷髅法师', role: '辅助', icon: '🔮', hp: 30, dmg: 9, speed: 3.0, range: 7, cd: 2.4, windup: 0.5, armor: 5, r: 0.34, xp: 14, capture: 0.45,
    desc: '躲在后排扔火球，还会复活死去的同伴——要抢在它之前收服尸体。', ally: '治疗受伤的队友；只要它在场，其他召唤物复原更快。',
  },
};
export const MODS = {
  fast:      { name: '迅捷', col: 0xe6eef8, desc: '移动和攻击都更快，跑动时留下残影' },
  fire:      { name: '火焰强化', col: 0xff8a2a, desc: '武器带火，倒下时爆炸，灼烧周围的敌人' },
  stone:     { name: '石肤', col: 0xb9b2a4, desc: '护甲极高、生命更多，不会被打断' },
  cold:      { name: '冰冻', col: 0x7cc8ff, desc: '攻击让敌人冻结减速，倒下时放出冰霜新星' },
  poison:    { name: '剧毒', col: 0x7dff5a, desc: '攻击让敌人中毒持续掉血，倒下时留下一团毒云' },
  lightning: { name: '闪电强化', col: 0xfff07a, desc: '攻击有几率连锁闪电打到旁边的敌人，倒下时放出雷暴' },
};
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
  spear: { name: '骨矛', mana: 2, cd: 0.34 },
  raise: { name: '唤魂', mana: 8, extra: 2, cd: 0.4, range: 6, channel: 0.8 },
  mend:  { name: '愈合', mana: 12, cd: 5 },
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
    { id: 'leap', name: '跳劈', icon: '🪓', max: 5, desc: r => `跳劈伤害 +${pct(0.2 * r)}，冷却 ${(6.5 - 0.6 * r).toFixed(1)} 秒，砸地范围 +${(0.15 * r).toFixed(2)} 米` },
    { id: 'bone', name: '坚骨', icon: '🦴', max: 5, desc: r => `生命 +${pct(0.12 * r)}，护甲 +${5 * r}` },
    { id: 'spin', name: '旋风斩', icon: '🌀', max: 3, desc: r => r ? `身边有 2 个以上敌人时旋转劈砍两次，每次 ${pct(0.6 + 0.2 * r)} 伤害，冷却 ${7 - r} 秒` : '解锁：被围住时旋转劈砍周围所有敌人' },
    { id: 'taunt', name: '战吼', icon: '📢', max: 3, desc: r => r ? `受到伤害 -${pct(0.08 * r)}，${(5 + 1.5 * r).toFixed(1)} 米内的敌人更想打它` : '解锁：减伤，并把更远的敌人引向自己' },
  ],
  imp: [
    { id: 'lunge', name: '突刺', icon: '🗡️', max: 5, desc: r => `突刺伤害 +${pct(0.2 * r)}，冷却 ${(4 - 0.4 * r).toFixed(1)} 秒` },
    { id: 'crit', name: '致命', icon: '💢', max: 5, desc: r => `暴击率 +${pct(0.06 * r)}，暴击伤害 ${pct(2 + 0.1 * r)}` },
    { id: 'haste', name: '迅捷', icon: '💨', max: 5, desc: r => `攻击间隔 -${pct(0.07 * r)}，移动速度 +${pct(0.04 * r)}` },
    { id: 'chain', name: '连环突刺', icon: '⚡', max: 3, desc: r => r ? `突刺命中后立刻再突刺附近另一个敌人，最多连 ${r} 次` : '解锁：突刺命中后接着扑向下一个敌人' },
  ],
  archer: [
    { id: 'multi', name: '多重射击', icon: '🏹', max: 3, desc: r => r ? `一次射出 ${1 + r} 支弩箭（额外的箭 75% 伤害）` : '解锁：一次射出多支弩箭' },
    { id: 'pierce', name: '穿透', icon: '🎯', max: 3, desc: r => r ? `弩箭可以穿过 ${r} 个敌人` : '解锁：弩箭穿透敌人' },
    { id: 'eagle', name: '鹰眼', icon: '👁️', max: 5, desc: r => `伤害 +${pct(0.12 * r)}，射程 +${(0.4 * r).toFixed(1)} 米` },
    { id: 'rapid', name: '快速装填', icon: '⏱️', max: 5, desc: r => `射击间隔 -${pct(0.08 * r)}` },
  ],
  shaman: [
    { id: 'heal', name: '治愈', icon: '💚', max: 5, desc: r => `治疗量 +${pct(0.2 * r)}，治疗冷却 ${(3.5 - 0.3 * r).toFixed(1)} 秒` },
    { id: 'fire', name: '火球', icon: '🔥', max: 5, desc: r => `火球伤害 +${pct(0.15 * r)}，爆炸范围 +${(0.15 * r).toFixed(2)} 米` },
    { id: 'mass', name: '群体治疗', icon: '✨', max: 3, desc: r => r ? `治疗时附近 ${(2.5 + 0.5 * r).toFixed(1)} 米内的队友也回复 ${pct(0.35 + 0.15 * r)}` : '解锁：治疗溅射到附近队友' },
    { id: 'soul', name: '引魂', icon: '👻', max: 3, desc: r => r ? `队伍复原速度再 +${pct(0.2 * r)}` : '解锁：让倒下的队友更快复原' },
  ],
};
// what a summon is worth when absorbed: experience for the absorber (same type +50%) and soul points
export const soulPoints = en => 1 + Math.floor((en.level - 1) / 3);
export const soulXP = (en, to) => Math.round(xpNeed(en.level) * 0.8 * 0.6 * (en.type === to.type ? 1.5 : 1));

// ---------- equipment: summons only. Weapons are per monster type (collect them all), armour (shields) fits everyone ----------
export const QUAL = [
  { name: '普通', col: '#e6dfd2', hex: 0xe6dfd2, k: 1 },
  { name: '精良', col: '#6fa8ff', hex: 0x5f9cff, k: 1.4 },
  { name: '稀有', col: '#ffcf4a', hex: 0xffc83a, k: 1.9 },
];
export const WEAPONS = {
  brute:  { cat: '斧', bases: [{ name: '骨斧', model: 'sk_axe', dm: 1, cd: 1 }, { name: '战斧', model: 'axe_1handed', dm: 0.82, cd: 0.82 }, { name: '巨斧', model: 'axe_2handed', dm: 1.32, cd: 1.16 }] },
  imp:    { cat: '刃', bases: [{ name: '骨刃', model: 'sk_blade', dm: 1, cd: 1 }, { name: '匕首', model: 'dagger', dm: 0.8, cd: 0.8 }, { name: '长剑', model: 'sword_1handed', dm: 1.25, cd: 1.12 }] },
  archer: { cat: '弩', bases: [{ name: '骨弩', model: 'sk_crossbow', dm: 1, cd: 1 }, { name: '轻弩', model: 'crossbow_1handed', dm: 0.82, cd: 0.82 }, { name: '重弩', model: 'crossbow_2handed', dm: 1.3, cd: 1.15 }] },
  shaman: { cat: '杖', bases: [{ name: '骨杖', model: 'sk_staff', dm: 1, cd: 1 }, { name: '魔杖', model: 'wand', dm: 0.82, cd: 0.82 }, { name: '法师长杖', model: 'mage_staff', dm: 1.3, cd: 1.15 }] },
};
export const ARMORS = [{ name: '骨盾', model: 'sk_shield_large', hm: 1.3, am: 0.7 }, { name: '圆盾', model: 'shield_round', hm: 1, am: 1 }, { name: '方盾', model: 'shield_square', hm: 0.7, am: 1.4 }];
// rare items get one extra line
const EXTRA = { w: [['spd', '攻击速度', il => 6 + il], ['hp', '生命', il => 6 + 2 * il]], a: [['dmg', '伤害', il => 5 + 2 * il], ['move', '移动速度', il => 5 + il]] };
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
  if (it.slot === 'w') { L.push(`伤害 +${v.dmg}%`); if (B.cd !== 1) L.push(`攻击间隔 ${B.cd < 1 ? '-' : '+'}${Math.round(Math.abs(1 - B.cd) * 100)}%`); if (v.spd) L.push(`攻击速度 +${v.spd}%`); if (v.hp) L.push(`生命 +${v.hp}%`); }
  else { L.push(`生命 +${v.hp}%`, `护甲 +${v.arm}`); if (v.dmg) L.push(`伤害 +${v.dmg}%`); if (v.move) L.push(`移动速度 +${v.move}%`); }
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
