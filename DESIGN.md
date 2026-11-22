# 唤魂墓穴 · Design notes

Living notes for features that are agreed or still being discussed. Implemented features are described in README.md.

## Rule: the summoner only raises skeletons
The summoner can only raise skeleton-type summons. When other monster species are added later, their corpses rise as the
skeleton of the corresponding class and grade, never as the monster itself.

Plan:
- Every monster maps to a **skeleton class** by its combat role:
  heavy melee → 骷髅战士 · nimble melee → 骷髅小兵 · ranged → 骷髅弩手 · caster → 骷髅法师.
- Every monster has a **tier (品级)** by its strength: 一阶 · 二阶 · 三阶 · 四阶. Raising it gives a skeleton of that tier;
  the tier raises base stats. Example: goblin archer → 一阶骷髅弩手, ogre → 三阶骷髅战士.
- Elite affixes stay a separate layer (e.g. 三阶冰火骷髅战士).
- Why: the collection stays focused on skeletons, new monster types only add enemy variety (no new summon art),
  and deeper areas give stronger versions of the same skeletons. Tier is a second axis for fusion.

## Proposal (under discussion): cross-class fusion → advanced classes
KayKit Skeletons and Adventurers share one rig, so Adventurers helmets, hats, hoods and dual weapons can be attached to
skeleton bodies: new classes get a distinct look without new art.

| Recipe | New class | Role | Look |
|---|---|---|---|
| 战士 + 小兵 | 骷髅狂战士 | dual axes, fast heavy melee, built-in whirlwind | barbarian headgear + two axes (dual-wield anims exist) |
| 战士 + 法师 | 死亡骑士 | tank with an aura (party damage reduction or life steal) | knight helmet + two-handed sword |
| 战士 + 弩手 | 骷髅守卫 | big shield blocks incoming arrows / fireballs, taunts at range | square shield + crossbow |
| 小兵 + 弩手 | 骷髅刺客 | throwing knives + stealth lunge | rogue hood + two daggers |
| 小兵 + 法师 | 骷髅巫刃 | melee hits carry elements | sword + wand |
| 弩手 + 法师 | 秘法射手 | elemental volleys, area damage | mage hat + heavy crossbow |

Later: two advanced classes fuse into a top tier such as 巫妖 (lich).

Open questions:
1. Guaranteed or chance? (suggested: guaranteed, both parents ≥ Lv10, as a ritual milestone; affixes still follow the
   elite fusion rules)
2. Level / skill points / gear of the result? (suggested: average level, all skill points refunded into the new tree,
   gear back to the bag)
3. Recipes public or discovered? (suggested: a 图鉴 with ??? entries and a hint like「沉重与迅捷的结合……」)
4. Own weapon types per advanced class (dual axes, daggers, two-handed swords…)? More to collect, but a wider loot pool.

## Implemented: same-class fusion (for reference)
normal + normal → 12% elite · normal + elite → 45% inherit an affix · elite + normal → 15% strengthen an owned affix ·
elite + elite → each partner affix: add (2nd 35%, 3rd 20%, max 3) or strengthen if owned (40%, max Ⅲ).

## 机枪骷髅 / Gunner Skeleton (easter egg for now)
- Planned as a later cross-class fusion unit. For now: the coffin to the right of the camp's crypt hides the epic weapon
  噬魂机枪 / Soul Reaper Gatling (once per save; faint purple motes hint at it). Click the coffin → the summoner walks over,
  it bursts open and the gun drops.
- Only a Skeleton Minion can equip it; while equipped the minion becomes a Gunner Skeleton: ranged (6.5 m), holds its
  ground like the other ranged summons, sustained fire (~8 rounds/s, each ~21% of a stab; one damage number per 3 rounds;
  crit from the minion tree; affix effects on every 6th round). Lunge / chain don't apply while it holds the gun.
- Its own look (a new unit, not just a weapon swap): olive helmet with purple goggles, bandolier, ammo pack with a glowing
  drum, 12% taller; own portrait. The KayKit accessory parts (warrior helmet, rogue hood / cape) made it read as the
  existing warrior / archer, so these pieces are built in code (gun.js) in the same style and hung on the shared rig.
- New quality tier 史诗 / Epic (purple). Epic items can't be smelted.
