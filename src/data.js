// All tunable content lives here (like Diablo II's data tables): monster types, champion affixes, skills, packs.
export const TYPES = {
  imp: {
    name: '小鬼', role: '快攻', icon: '👺', hp: 20, dmg: 3.5, speed: 4.4, range: 0.85, cd: 0.8, windup: 0.16, armor: 0, r: 0.32, xp: 6, capture: 0.75,
    desc: '速度快，成群结队。看到同伴阵亡会惊慌逃跑，过一会儿再冲回来。', ally: '速度快的近战输出，攻击有几率暴击。',
  },
  brute: {
    name: '墓穴蛮兵', role: '坦克', icon: '👹', hp: 75, dmg: 12, speed: 2.5, range: 1.3, cd: 1.7, windup: 0.62, armor: 20, r: 0.5, xp: 16, capture: 0.5,
    desc: '慢，但蓄力重击会把人打退。被重击打断时会踉跄。', ally: '吸引附近敌人攻击它，替你扛伤害。',
  },
  archer: {
    name: '骷髅弓手', role: '远程', icon: '💀', hp: 26, dmg: 6, speed: 3.3, range: 7, cd: 1.5, windup: 0.38, armor: 5, r: 0.32, xp: 10, capture: 0.6,
    desc: '保持距离射箭，你一靠近它就后退。箭可以躲开。', ally: '在安全距离放箭，被贴身会自己拉开。',
  },
  shaman: {
    name: '腐巫', role: '辅助', icon: '🧙', hp: 30, dmg: 9, speed: 3.0, range: 7, cd: 2.4, windup: 0.5, armor: 5, r: 0.34, xp: 14, capture: 0.45,
    desc: '躲在后排扔火球，还会复活死去的同伴——要抢在它之前收服尸体。', ally: '治疗受伤的队友；只要它在场，其他召唤物复原更快。',
  },
};
export const MODS = {
  fast:  { name: '迅捷', col: 0x7fd6ff },
  fire:  { name: '火焰强化', col: 0xff8a2a },
  stone: { name: '石肤', col: 0xb9b2a4 },
};
export const SKILLS = {
  spear: { name: '骨矛', mana: 2, cd: 0.34 },
  raise: { name: '唤魂', mana: 8, cd: 0.4, range: 6, channel: 0.7 },
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
