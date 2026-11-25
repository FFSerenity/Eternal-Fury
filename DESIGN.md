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
- Own skill tree (shown instead of the minion's while it holds the gun; points stay where they were spent; no attack
  speed in it — the minion's Haste doesn't apply to the gun): Grenade (innate; lobbed at the spot that catches the most
  enemies, an elite counts double, a lone normal enemy isn't worth one), AP Rounds (each round stacks −1 armour and +0.6%
  damage taken from everyone, up to 8/rank, fades 3 s after the firing stops), Dig In (unlock: with 3+ enemies or an elite
  close, becomes a turret — sandbags, tripod, rune ring — immobile, unstoppable, faster fire, more damage and range, less
  damage taken), Cluster Grenade (unlock: bomblets). Base: life +40%, armour +8 over a minion of the same level.

## 魂契 / Soul Pact mode (first playable, Nov 2026)
A separate mode with its own save (start screen). The fun to find: one summon you raise by hand and that is the centre of every fight.
- Barrels / kegs / boxes / crates / trunks and chests (loot.js): click or tap one, the summoner walks to it; a barrel bursts — its
  instance shrunk away, its cell walkable again, the prop cut at load into 12 pieces (six wedges round its middle, upper and lower) that
  fly out, tumble, bounce and shrink away: 20% an item (white 55 / blue 32 / yellow 11 / purple 2%), 35% 魂能 1 + 0.4·level (a trunk:
  75% an item, better odds); a chest (the pack's chest has its lid apart: baked as chest_body + chest_lid, the lid's origin on its hinge,
  each an instance) swings its lid open and stays open: an item always (white 20 / blue 45 / yellow 26 / purple 8 / red 1%), a second 35%,
  魂能 4 + level; 12% of chests are gold (heaped with coins): blue+ only, a second item 80%, 魂能 10 + 2·level. Item
  level = the floor (the wilds: the deepest floor reached). Bosses (魂契): purple-or-red (red 45%), purple-or-yellow, yellow-to-red, blue-or-
  yellow, +1 (yellow / purple) for each round of the four already done (at most 3), and 40 + 8·(level+1) 魂能 into the vessel.
- From the 5th floor down monsters take a step up in life (data.js DEEP_HP: ×2.5 at floor 5, +4% of that per floor after; by the floor or
  wilds zone they were made for, else their level; champions and bosses on top of their own multipliers): by then the Sentinel has 25-30+
  Fury and real gear, and they died to one blow. At floor 5 with ~30 Fury and blue/yellow gear: a minion 1-2 blows, a warrior 5-10, a
  champion warrior 15-28 (greatsword and mace fewest, the sword most).
- Monsters move at 60% speed, and the slow kinds (warrior, archer, mage) are brought up to 90% of a minion (minion ~2.6 m/s, the rest ~2.4);
  the summoner (3.45 m/s) outruns everything; the skeleton walks slow and heavy (sword & shield 1.55 m/s, greatsword 1.75; never hurries,
  no run yet) and blinks back beside the summoner at 10 m (15 m while it has a target), half the usual distance.
- 召唤 (E): no cooldown, 10 mana, 1.5 s cast (rune circle), then the skeleton rises (Mixamo Zombie Stand Up at its own pace, ~3 s). The skill stays at
  level 1 (Nov 2026: no more levels; old saves get the 魂能 they spent back, pactMigrate).
- 战魂 (Fury): kills by the skeleton's own hand (elite 4, warrior 2, others 1); stack n needs 3 + ⌊0.6n⌋ kills up to 25 (245 in all: every Fury
  skill quickly), then 18 + ⌊1.2(n−25) + 0.045(n−25)²⌋ (25→50 ≈ 1 000, 50→75 ≈ 3 100, 75→100 ≈ 6 700; poured 魂能 pays the same, Nov 2026). Per stack: +6% damage
  and +4% attack speed up to 25, then +3% and +1.5% (pact.js furyBonus: at 40 Fury about a quarter less damage per second than the old
  straight line, at 50 over a third less — gear multiplies it again), +2% move speed (cap +30%), +2.5% life, +0.4% evasion (cap +12%).
  Death: all stacks gone, summon again.
- 唤魂 → 魂能: minion 1, archer / mage 2, warrior 3, ×(1 + 0.25 per level above 1), elite ×3, boss ×12. The souls fly across the screen
  into the 魂瓶 (soul orb; soulvessel.js — bottom centre and smaller on a wide screen, above the skill buttons on the right on an upright
  phone, where the boss bar keeps to the left of it; the way-down button moves above it; a phone lying down puts the number on the
  cradle's foot and lets the orb sink into the strip an iPhone keeps for its home bar): a glass globe held up by a hooded skeleton in a
  gothic cradle — painted art (made by the owner with an image generator) cut by tools/cut-orb.py into the art with the sphere cut out (the
  figure's head and hands, the claws stay in front), its runes / eyes / gem as a mask, and the liquid's light on the figure as another mask
  that comes up as it fills; the glass and liquid (waves, swirls, bubbles, a ghost skull drifting in the empty part) are drawn under it.
  The liquid is full at 100; past that it burns brighter (a white core, a bigger halo) and the runes / eyes / gem change colour as each
  layer fills — 100 / 200 / 300 / 400 more: azure, gold, violet, crimson, the crest's colours (cyan before); pouring takes them back.
  Held (the globe, E, or the summon button —
  "灌注 / Pour" while the skeleton is out), it pours into the skeleton: souls stream from its top into its chest, it brightens (soul light
  +0.45 at full, after 1.6 s of pouring, wisps seeping out) and gains kill progress at 2.5 魂能 a kill (INFUSE in pact.js) — a stack
  fills in 0.7 s whatever its size. Harvesting every corpse gives about half as many stacks again as the kills themselves.
- Skeleton at level L: life (230 + 40(L−1)) × style, damage (16 + 4.5(L−1)) × style, armour 18 + 3(L−1) + style; taunts within 6 m; never staggered.
  Sword & Shield: life ×1.3, armour +14, evasion 32%, attack every ~1.4 s, narrow arc. Greatsword: damage ×1.5, evasion 16%, ~2 s, wide arc, knock-back.
  Mace & Shield (圣骑士 Paladin, SETS.PAL): life ×1.4, armour +18, damage ×1.05, evasion 24%, ~1.6 s, knock-back 2; fights on the sword &
  shield clips. Blunt (units.js damage, foes.js foeGuard): a knight's shield doesn't stop it (the blow goes through whole and the knight
  staggers 0.35 s, "破盾"), only half of the target's armour counts, +25% against armour 15+. Smite: every third swing a pillar of light
  comes down where the target stood — 60% damage to all within 1.7 m and a 0.5 s stun (holy.js).
  Its look (the reference board "Skeleton Paladin · Holy Radiance"): in the shader (gfx.js uHoly) the black plate turns polished silver — a
  floor / dark horizon / bright sky mirrored in it — and its raised filigree gold; the cloth (grey and not metal in the metalness map: the
  hanging front skirt) worn ivory linen with a gold cross drawn in the rest pose's own space (vB), so it moves with the cloth; bone and
  leather (warm in the texture) stay as they are; the mace and shield silver with gold where they are bright. The crest is white before its
  first tier, the eyes and soul light gold (uSoulC, softer than the cyan: it would burn the silver out to white), a halo floats level over the
  crest, a slow rune circle of light lies under its feet, motes drift up off it. Swing trail gold.
  Skills as the Paladin (skillView: own names and texts): Hammer Leap (instead of Charge; 3.5–9 m, 8 s): the overhead swing (SNS_Atk2) lets
  the mace go at its forward point — it flies end over end at 22 m/s (the hand empty), strikes ×1.2 and stuns 1.6 s, bounces up to hang
  over the target turning; then SNS_Leap (a jump in place, the weapon overhead at the top, a crouching smash on landing; the travel is
  moved by hand, the landing spot following the target until take-off): at the top the mace flies back into the raised hand, and where it
  lands a burst of light — ×1.5, thrown back, 0.8 s stun within 2.6 m. Block = the shield block, its counter a bolt of light; Blessed Hammers (instead of Whirlwind; 2+ within 3 m, 11 s): a prayer (SNS_Cast), then three spectral maces (the mace model
  in gold, a glowing shell) wheel round it for 6 s — 3.1 rad/s, each swinging in and out between ~0.9 and 2.8 m, tumbling end over end —
  each striking what it passes for 50% (once per hammer per enemy every 0.5 s) while it fights on; Judgement (instead of Sundering
  Strike): the roar becomes a burst of light, the mace fills with holy flame, and the blow brings a pillar of light down 1.3 m in front —
  ×3 and a 1.2 s stun within 3.5 m, then two more rings (to 5.2 / 6.8 m: 60% / 40%, short stuns), consecrated ground; non-elites under
  25% are put down; Aura of Light (instead of Life Steal, passive, 25 Fury; holy.js auraTick / auraHeal): a ring of gold 7 m round it on the
  ground; 10% of the damage it deals heals every one of its side inside (the summoner and itself, each the full amount), and each wears a
  shield of light (u.barrier, spent in damage() after the mech's shield; gold numbers when it soaks) — at most 20% of its own life, filling
  over 4 s once 2.5 s untouched, healing past full poured into it, fading out of the aura; shown as a faint dome (an upright egg on the
  Sentinel) that flares where it is struck. Gear life steal still heals only the Sentinel.
- Bearing: a dazed stand (Mixamo Idle, elbows eased out and forearms leaning slightly in), a brutal walk with sword & shield, the briefcase walk with the greatsword
  and with the mace (the Paladin's calm, upright walk; its mace held out nearly level, the head a little up, while it stands or walks) — no guard stance (that waits
  for a defence skill) and no run yet, straight from the walk into its swings;
  it stands upright like Mixamo's own mannequin (clips retargeted from Y Bot); the retarget left the Meshy rig with its feet tipped ~21° toe-up
  and its neck craned forward (the torso leaning back against it), so a fixed per-bone turn is baked into every clip at load (assets.js
  POSTURE: feet toe-down 21°, Spine +6°, Spine2 −11°, Neck −15°, Head −3°) and the stand is tipped 4° forward about the ankles (LEAN: the
  hips' turn and place, the feet turned back flat) — upright, hips over the feet, soles flat;
  the shield hangs point-down along the leg when the arm is lowered;
  the greatsword drags along the floor behind it (sparks), and no blade sinks into the ground. It cannot be shoved or knocked back by anyone.
- Its swings leave a trail and sound like blades: the air swells while the blade gathers speed and a swish peaks at its fastest moment in
  each clip (artisticdude's CC0 Swishes pack, stretched, pitched down for the greatsword), louder than the cut with a metal ring when a blow
  lands (Kenney samples mixed in assets/sfx by tools/mix-blades.py, one per swing: a knife slice and a metal ring only — the wooden
  "chop" of the first mix is gone).
  Swings: sword & shield Atk2 / Atk3, greatsword Atk2 / Atk3 / Atk4 (not the pommel strike, nor the high sweep that passes over small heads); each
  lands when the blade passes closest to a body 1.5 m in front.
- Skills, one per crest tier and one past it: they wake at 5 / 10 / 15 / 20 / 25 战魂 and are lost with them; used on its own (pactskills.js, effects pactfx.js).
  Charge (3.5–8 m, 8 s): sword & shield drops into its low guard stance and drives straight in behind the shield with a long rush of air,
  barging aside what is in the way, and ends by fanning the shield up overhead (a blend from the guard pose to SNS_Combo's shield-high frame) that knocks the target down and pops it off its feet (the blend eases out: the shield is up in a few frames, held a moment, then a quick return); the greatsword leaps in a
  long arc like the crypt's warriors and splits the ground where it lands.
  Block / Parry (passive; the shield takes blows from any side, the parry only from the front; +1% per Fury stack past 10, at most +20%):
  sword & shield blocks 30% (−80%, missiles stopped whole), the greatsword parries 25%
  (−60%); each earns a counter slipped in between its swings — the guard pose for a beat, then sword & shield cuts down and a crescent of
  qi flies ~10 m straight (at the shooter, if it stopped a missile), the greatsword sweeps 180° (GS_Spin) and a half-moon of qi fans out ~4.5 m.
  Whirlwind (3+ within 2.5 m, 10 s): two cuts all around, each flinging eight crescents of qi outward that cut what they meet out to
  ~5.5 m at half damage.
  Life Steal (passive, 25 Fury): 10% of the damage it deals heals it, shown as one green number every half second.
  Sundering Strike (15 s): sword & shield roars — rings of force race out, a column of light, the nearest are thrown back — then its
  sword catches fire and the burning blow sends a wave of fire with scorched cracks down a 5.5 m cone; the greatsword fills its blade with
  fire from the hilt up and sweeps (GS_Combo), fire rolling out all round in three full rings, each farther than the last (5.5 / 7.6 /
  9.8 m; the 2nd and 3rd hit what stands beyond the one before for 60% / 40%). Non-elites left under 25% are cut down.
- Its helmet crest shows its 战魂 (Fury from its own kills, lost when it falls): as modelled below 5, then dyed in the gear colours —
  5 blue, 10 gold (glowing, sparks), 15 violet fire, 20 crimson fire (flames running out along the fin, a halo, embers); the swing trail
  takes the same colour. The summon skill doesn't level (its strength is 战魂 and gear); 魂能 is poured in as 战魂 instead.
- The summoner's Bone Spear does half damage here and the summoner levels at 60% speed: support, heal (Mend), harvest.
- Not yet: more weapon styles (axe and spear are modelled; a two-handed mace / axe, dual wield, mixed), skills you choose or aim,
  a second skeleton, using the extracted root motion (lunges / leaps that travel).

- Its soul light (魂光) also shows its 战魂, one step every 10 stacks up to 100: the cyan of its eyes shining out of it from inside.
  10+ the bones glow from within (tinted toward the light, not burnt white), lights in the ribcage / skull / pelvis show through the gaps,
  the eyes burn brighter; 30+ a cyan edge; 40+ wisps rise off it; 50+ the light moves up through it in bands; 60+ a glow on the ground and
  trails from the eyes; 70+ the seams of the black armour light up; 80+ soul fire licks off the shoulders and skull; 90+ an aura around
  it; 100: white-hot at the core, two streams of light spiralling round it, a ring of soul force pulsing out every 2.4 s (assets.js soulTick,
  the shader's uSoul). (Damage and attack speed per stack slow down past 25: see furyBonus.)
- Gear (魂契 only): drops and the forge give the Sentinel's own gear — a greatsword (two hands: the shield slot is locked while it is
  held; putting one in sends the shield back to the bag), a sword, a mace, and a shield; two slots as before. The weapon sets the style
  (greatsword → 大剑, mace → 圣骑士, sword or none → 剑盾); with no shield there is no blocking. Qualities: white, blue (1 extra line), yellow (2),
  purple (3), red 传说 (4): weapon damage %, shield life % and armour, extra lines from attack speed / crit / life steal / life (+ armour
  on the greatsword) or block / evasion / damage / move speed on the shield. Normal monsters drop 9% (red 0.5%), champions always
  (blue or better, red 4%). Rare and up glow in their colour in its hands (an aura, sparks; red smoulders) and on the ground (a beam,
  red's the tallest). A new pact starts with a plain sword and shield; an older save gets plain gear of the style it had.
  The equipment panel opens from the Pact panel, from the portrait on the Sentinel's HUD card (a close-up of its head: the crest in its
  战魂 colour and the skull face, remade when the crest or soul light changes) or from the bag (⚔ 装备卫士 / 🔥 熔炉 switch); in the bag
  the greatsword icon shows the broad face of the blade leaning one way, the sword turned and leaning the other way, smaller; crypt-mode items in an old bag can only be
  smelted. The equipment panel also shows its 战魂 in brief (stack, kills to the next, crest, soul light step, the bonus).
  On touch screens a tap highlights an item (it stays put) and a tap on an empty cell, a frame or the forge moves it; the info box has
  the one-tap move (穿上 / 卸下 / 放进熔炉 / 拿回背包) and 取消. The mouse still picks items up and puts them down.
- The Pact panel: the summoning skill as a tome (its level, the upgrade), the style card (what the style does, that the weapon decides
  it) with a big ⚔ 装备卫士 button, and the 战魂 skills as a row of badges on a track filled up to its Fury (each in its crest tier's
  colour, locked ones grey); the picked badge is described in one fixed box underneath.

## 野外的敌人 / The wilds' foes (Nov 2026)
The wilds hold no skeletons: the living (KayKit Adventurers — Knight, Barbarian, Rogue, Rogue Hooded, and the Mage *with* its hat;
the summoner is the bare-headed Mage) and flying vermin (Quaternius Ultimate Monsters — Goleling as the bat, Ghost, Ghost Skull).
A hat or helmet taken off makes another foe from the same model (bear-hat berserker / bald raider, helmeted templar / bare-headed squire).
Each is a skeleton kind underneath (FOES.cls: its AI, its blows, the skeleton its corpse rises as — the rule above) with its own numbers
and look (assets.js FOE_LOOK: which of the model's own weapons it carries) and one trick (foes.js):

| foe | kind | trick |
|---|---|---|
| 盗墓贼 Grave Robber | 小兵 | under 70% life: smoke bomb, gone 0.45 s, out behind its target; the next stab always crits |
| 掠夺者 Raider | 小兵 | 2.4–7 m away: a thrown axe (×1.5), every 5–7 s |
| 侍从 Squire | 小兵 | blows from the front ×0.65 (not while it swings) |
| 弩手 Crossbowman | 弩手 | every 7–9.5 s: aims 1.1 s down a marked lane, then a piercing bolt ×2.4 |
| 圣殿骑士 Templar | 战士 | blows from the front ×0.45, bolts and spells too (not while it swings) |
| 处刑者 Headsman | 战士 | ×1.6 against anyone under 40% life |
| 狂战士 Berserker | 战士 | target within 3.4 m, every 7–9 s: a roar (0.4 s) then 1.7 s of whirlwind (×0.45 every 0.38 s); under 40%: +30% speed, −30% cooldown |
| 驱魔师 Exorcist | 法师 | heals the most hurt of its own (under 65%) within 7.5 m every 4–5.5 s; never raises the dead |
| 蝙蝠 Bat | 小兵 | after each bite darts off 0.5–0.8 s; half the usual capture chance |
| 幽灵 Ghost / 怨灵 Wraith | 弩手 | slow homing soul-fire that chills (the wraith: three); no body, no corpse |

Not yet: tiers (品级) — every foe rises as a plain skeleton of its kind for now.

## 首领 / Bosses (both modes, Nov 2026)
The four 科技流 skeletons are the crypt's bosses: one waits by the way down on every 5th floor (5 炮手 → 10 机枪 → 15 机甲 → 20 机械师,
then round again two levels higher; level = floor + 2), and the grate glows red and stays shut until it falls. Each fights with the tech
unit's own kit (units.js bossThink; drones.js) at boss size and strength (boss.js: life ×5.5–16 by kind, damage ×1.15–1.35, armour +10,
never staggered), and every big blow is marked on the ground first (fx.js warnCircle / warnLine / warnCone):
- 炮手骷髅: shells and barrages from range, each shell's landing spot marked; backs away from anyone close.
- 机枪骷髅: sustained fire and grenades (marked); 扫射 — a marked fan, then the fire sweeps across it, each round hitting the first body
  in its line (walls stop it); digs in when enraged.
- 机甲骷髅: the drill up close; a marked rocket dash that runs its lane straight (no steering); a shield field to break; a marked EMP.
- 机械师骷髅: laser drones and a rod beam; an orbital strike that locks on for 0.6 s and lands at 1.5 s; a repair drone that heals it
  (~1.2%/s) and has a body of its own — the summons go for it first; shot down, a new one launches 12 s later.
At half life a boss is enraged (faster attacks and moves, skills back sooner, red glow, embers). A boss bar shows at the top while one
is near. It drops (besides 12× XP): 魂契 — two pieces of the Sentinel's gear (one purple or red 30%, one yellow or purple); the crypt —
its own epic tech weapon and a rare. In 魂契 it is worth 12 kills of Fury and 12× soul; in the crypt its bones can't be raised.
The test arena can spawn any of them.

## 试炼场 / Test Arena (a tool for tuning)
On the start screen (⚔ 试炼场) or `?arena`: the current save is loaded into one big empty hall, and nothing done there is saved (leaving
reloads the page). The panel on the right spawns monsters (kind or mixed, count, level, range from the Sentinel, life ×1–50, champions,
training dummies that neither move nor fight, auto refill to keep the count, loot drops on or off — off by default), sets the Sentinel's Fury, summon level, a whole gear set by style and quality, the
summoner's level, and can make the Sentinel unkillable or the summoner invulnerable with endless mana. The meter at the top reads the
damage the summons do (last 5 s and averaged over fight time, i.e. time with a blow landed in the last 2 s), the summoner's own damage,
kills with the average time from first hit to death, and damage taken per second.
