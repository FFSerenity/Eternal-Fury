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
- Barrels / crates / urns / kegs / trunks (loot.js): click or tap one, the summoner walks to it — or the Sentinel's blows (its swings and
  every skill that lands near one: PH.strike, arcHit, the leap, the whirl, Sunder, the Paladin's leap and Judgement) or a bone spear
  (it stops on the box) break it, hitBoxes(x, z, r, face, half); it bursts — its instance shrunk away, its cell walkable again, the prop
  cut at load into 12 pieces (six wedges round its middle, upper and lower) that fly out, tumble, bounce and shrink away: 20% an item
  (white 55 / blue 32 / yellow 11 / purple 2%), 35% 魂能 1 + 0.4·level (an urn: 15% an item, 60% 魂能 2 + 0.5·level, clay-coloured
  dust; a trunk: 75% an item, better odds). The barrels, crates and urns are generated models (Qwen Image → Pixal3D / TRELLIS.2 in Comfy,
  slimmed to 2-5k triangles with tools/slim-gen3d.mjs PROP=1 and packed into assets/gen_props.glb with tools/pack-props.mjs; base-colour
  texture only), scaled at placement to a height (loot.js PROP_H) ±8%. The generator builds a model in its picture's view, so it comes
  out leaning 14-31° toward where the camera was and turned 30-45°: PROP=1 stands it level (its base — the downward faces at the bottom,
  by area — turned to face straight down; AXIS=1 for the round ones, barrels, urns and the relic stand: on the line through the middles
  of its footprint low and high), squares it up (the turn whose footprint fits the smallest rectangle, the longer side along x, the
  side that faced the camera toward +z; FRONT=1: the rack's hooks toward +z), then sets its base on y 0, centred. Square props stand
  along the walls (a quarter turn, ±4.6° off).
- No chests: display stands (Nov 2026) — one item on each, in plain sight, nothing to gamble on. In the crypt a stand takes the place of
  a border prop now and then (weight 0.85 of 12.2), facing into the room, and a bigger room (5×5+) has one in its middle 25% of the time:
  about 5 a floor (the chests were under 2); every stand is square to the walls (one in a room's middle faces +z). The item is rolled when the floor is made (white 12 / blue 42 / yellow 32 / purple 12 / red
  2%; 15% of stands better: blue 20 / yellow 46 / purple 26 / red 8%) and decides the stand: a weapon on a weapon rack (60%, only along the
  far walls, where its hooks face the camera), purple and red on the relic stand or the crypt altar, the rest on a stone plinth. It
  floats upright over the stand, turning slowly, its glow and its light column standing on the stand's top (a rack: it lies across the
  hooks, still); kept to 0.95 m on its longest side (1.05 on a rack). Click the stand, or walk up to it: picked up within 1.65 m, no drop
  sound. The ruin in the wilds has one in its middle, square to its walls, facing +z. Item level = the floor (the wilds: the deepest floor
  reached). Bosses (魂契): purple-or-red (red 45%), purple-or-yellow, yellow-to-red, blue-or-
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
  lands a burst of light — ×1.5, thrown back, 0.8 s stun within 2.6 m. Holy Rebound (圣盾反弹) = the same shield block, but its counter has no swing: the shield's light flares round its body (a dome of light, a ring
  racing out, Judgement's energy burst for a sound), what stands close all round is thrown back, and a bolt of light flies straight; Blessed Hammers (instead of Whirlwind; 2+ within 3 m, 11 s): a prayer (SNS_Cast), then three spectral maces (the mace model
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
  each clip (3 light and 4 heavy swishes, picked at random so they don't repeat), louder than the cut when a blow lands (one per swing).
  What a blow sounds like depends on what it hits: plate (squires, templars, headsmen, mechs, stone-skinned champions — `plated()` in
  units.js) rings under a sword and clangs under the mace; on anything else the sword's cut is Kenney's slice-and-ring mix
  (tools/mix-blades.py) and the mace a blunt thud. The greatsword has its own heavy hit on everything.
- Sounds made with Stable Audio 3 Medium (ComfyUI, local) and picked by ear on a sound-test page (old vs new, level-matched):
  swishes, hits, blocks (a blade caught: a sharp clang; a mace or a brute's blow: a dull one), the greatsword's fire (the blade catching,
  its burning swing, the fire blast), the leap's landing, Judgement's burst, Blessed Hammers (the cast rings out over the 6 s, and each
  time a hammer comes round it cuts the air), a champion's poison cloud and thunderclap, and the robber's smoke step (a shadow whoosh).
  Round 2 (some takes generated by the user): the charge and the leap rush past with a whoosh of torn air (its loudest moment on arrival;
  the greatsword's leap: just after it springs off, dying away over the flight);
  the sword's sunder opens with a skeleton's war cry and a burst of fire, the paladin's (Judgement) with its own roar alone; holy light
  sounds when the Aura of Light comes on at 25 Fury; the greatsword's blade gathers its fire (a charge, then a flame held as
  a loop while it burns: loops are .wav, since mp3 pads its ends with silence).
  The light swings are the three new swishes plus one of the old ones (artisticdude's), so they repeat less.
  Enemies' melee blows swish too, with the same swings: a small one's (cls imp) quiet and pitched a little up, a big one's (brute, boss)
  at full weight and pitched down; they fade out past ~16 m from the summoner. Bats bite without a swish; summons stay quiet.
- Monsters' sounds (round 3, loaded in every mode): a cry by kind — the living (a soldier's shout; templars, headsmen and berserkers
  bellow), the crypt's skeletons (4 hisses), bats, ghosts and wraiths, and each tech boss its own roar (the mech's the heaviest). The
  first of a pack to notice you cries out (one voice per kind every 2.5 s, so a whole pack is one cry); a bat shrieks as it dives back
  in (at most every 4 s); a berserker bellows as it whirls or goes berserk; a boss roars on its entrance and when it rages. Shots: bow
  (4), crossbow bolt (4), thrown axe (2), fireball (3), the exorcist's holy fire (2), ghosts' soul-fire (3), each cut to start near its
  first strong sound so it lands on the release. Cries and shots, like the enemies' swings, fade out past ~16 m from the summoner.
- The summoner's sounds (round 4, every mode): Raise — the spell's hum once as it is cast, then for each corpse (they go one after another,
  0.16 s apart) a short burst of its soul torn out, pitched apart each time so many corpses stay a quick flurry; the soul's whoosh as it
  leaves. 魂契's harvest shows the soul standing up out of the corpse again (pale, glowing, the crypt's Resurrect clip at ×2 — units.js
  soulRise), and only then do its souls fly into the vessel; a bat's (another rig) goes straight in. Each soul landing in the vessel is one of six
  little drops cut from one take, a run of them climbing a step at a time (like coins). Pouring into the Sentinel: a stream of souls held as
  a loop while it pours (pour.wav), the Sentinel drinking at once and then now and then (at most every 0.65 s; cut to start at its full swell). Party full in the crypt: the soul flies off
  (whoosh) and is drunk by the summoner.
- Loot: only epic (a crisp gem's ding) and legendary (a softer, warmer chime) make a sound, as they land; nothing below.
- Gear panel: picking up, putting down, equipping, taking off — one handling clink; into the forge — a clank and a breath of embers; the
  forge's roll — fire and tumbling metal over the ~2 s of the reel (its old ticks are gone), then the reveal as before.
  Every recorded sound falls back to its old synth while it loads. Still synth: whirlwind (kept by choice), ice, the summon circle, Mend.
  Swings: sword & shield Atk2 / Atk3, greatsword Atk2 / Atk3 / Atk4 (not the pommel strike, nor the high sweep that passes over small heads); each
  lands when the blade passes closest to a body 1.5 m in front.
- Skills, one per crest tier and one past it: they wake at 5 / 10 / 15 / 20 / 25 战魂 and are lost with them; used on its own (pactskills.js, effects pactfx.js).
  Charge (3.5–8 m, 8 s): sword & shield drops into its low guard stance and drives straight in behind the shield with a long rush of air,
  barging aside what is in the way, and ends by fanning the shield up overhead (a blend from the guard pose to SNS_Combo's shield-high frame) that knocks the target down and pops it off its feet (the blend eases out: the shield is up in a few frames, held a moment, then a quick return); the greatsword leaps in a
  long arc like the crypt's warriors and splits the ground where it lands.
  Block / Parry (passive; the shield takes blows from any side, the parry only from the front; +1% per Fury stack past 10, at most +20%):
  sword & shield blocks 30% (−80%, missiles stopped whole), the greatsword parries 25%
  (−60%); each earns a counter slipped in between its swings — the guard pose for a beat, then sword & shield cuts down and a crescent of
  qi flies ~10 m straight (at the shooter, if it stopped a missile) with a burning whoosh, the greatsword sweeps 180° (GS_Spin) and a half-moon
  of qi fans out ~4.5 m.
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
  the greatsword icon shows the broad face of the blade leaning one way, the sword turned and leaning the other way, smaller, and the spear (Zhao Yun's) as a close-up of its ornate head
  and blue tassel, point up and right, the shaft running out of the corner; crypt-mode items in an old bag can only be
  smelted. The equipment panel also shows its 战魂 in brief (stack, kills to the next, crest, soul light step, the bonus).
  On touch screens a tap highlights an item (it stays put) and a tap on an empty cell, a frame or the forge moves it; the info box has
  the one-tap move (穿上 / 卸下 / 放进熔炉 / 拿回背包) and 取消. The mouse still picks items up and puts them down.
- The Pact panel: the summoning skill as a tome (its level, the upgrade), the style card (what the style does, that the weapon decides
  it) with a big ⚔ 装备卫士 button, and the 战魂 skills as a row of badges on a track filled up to its Fury (each in its crest tier's
  colour, locked ones grey); the picked badge is described in one fixed box underneath.

## 长枪 · 赵云 / The spear: Zhao Yun (Nov 2026)
- A fourth style, set by a new hero weapon, the spear (data.js HERO_GEAR.spear: two-handed, its extra lines from the greatsword's pool,
  damage ×1.2; 骨枪 / 银龙枪 / 龙胆亮银枪 by item level). Holding it, the skeleton becomes 赵云: his own model (makeHeroMesh model 'zy'),
  no crest, no eye glow; heroName() says 赵云 / Zhao Yun, and the HUD portrait is his.
- His model (second version, Nov 26): the GPT picture (A-pose, the hems above the knee, the dragon pauldron from the design sheet) →
  Meshy 7.5 (Flagship, Ultra 2K geometry, Meshy 7 PBR texture at 2K, A-pose, image enhancement off: 45 credits) → Meshy's free remesh to
  24,832 triangles (the texture baked across) → Meshy's humanoid auto-rig (markers as placed, height 1.85 m) and preset motions →
  downloaded as one GLB, Mixamo skeleton, all motions (the button needs at most 20 added, the rig's own Running and Walking count) →
  tools/zy-fix-rig.mjs → build-hero.mjs (1.6 MB). The first version (Pixal3D / TRELLIS.2 in Comfy, Mixamo's mitten rig) is gone.
- The rig fix (zy-fix-rig.mjs): Meshy's rig leaves weight on helper bones that never move with the body — an arm chain on each side hung
  under the head, at the arm joints' places, carrying half the shoulder, sleeve and pauldron (they stayed behind as flat shards when the
  arms moved: Meshy's own viewer shows them too), and three bones under the forearm and hands with their heads on the floor carrying a
  trace of the boots (the boot tips stretched up to the hands in long spikes). Their weights go to the bones they stand for.
- His own motions (ZY_*; Meshy's presets retargeted to him): the drift of the hips over each clip taken out (the loops run in place, the
  attacks end where they began), every clip stood on his spot by where its feet stand (tools/bl_zy_feet.py → tools/zy-feet.json; his
  spear stance stood 0.4 m to his left), the archery clips turned 77° so the bow arm points where he faces. Of the 20 taken, in use:
  Combat_Stance (both hands on the shaft, the point forward: his stand), Spear_Walk (the walk, 1.53 m/s stride), Two_Handed_Parry (the
  spear raised across: the Parry's pose), Archery_Shot_2 (the archer's held aim: the bow volley). They stand in for the Sentinel's by name
  (assets.js ZY_ALIAS: Stand, Walk_GS) or are asked for by name (the skills). The rest (Thrust_Slash, Weapon_Combo 0–2, Reaping_Swing,
  Charged_Upward_Slash, Attack, Skill_01, the other archery clips, Running, the charge's sprint) are there to try: Meshy's weapon clips
  swing one-handed (the free hand wanders 0.2–1.4 m from the other), so the blows stay on the Sentinel's clips.
- Every other clip is the Sentinel's, moved onto his rig the first time it is asked for (assets.js zyClips, a proxy): every body bone's
  world turn away from the Sentinel's bind pose is given to the same bone of his from his own bind pose (both stand in an A-pose; the
  Sentinel's clips already carry its posture fixes, so he gets the poses as they look); the hips travel the same, scaled by hip height.
- His fists: Meshy's rig has real fingers (thumb, middle, pinky chains), curled as the Sentinel's (heroFists; finger chains are only those
  that start within reach of the wrist — the floor bones are left out). The spear in his right fist, the grip amid the curled fingers:
  two lines, fitted on how each set of clips holds it (from the right fist toward the left, in the right hand's frame) — his own (the
  spear stance: the left fist leads, the point goes on past it) and the Sentinel's two-handed clips (the left fist lower down the shaft,
  the point away from it); heroWeaponPose turns it to the one for what is playing (zyOwn), over 0.1 s. 2.6 m, the grip 40% of the way
  up. While he walks it is carried upright (CARRY); standing, both his hands are on it. The bow hangs across his back (Spine2) and comes
  into his left fist, upright in the archer's aim, only while he shoots.
- His weapons (Nov 26, second version): the GPT weapon sheet (spear, bow, quiver) → Meshy 7.5, one generation each (35 credits each:
  given the whole sheet it made only the bow) → Meshy's free remesh to ~4–5k triangles each → tools/bl_zy_weapons.py → build-hero.mjs
  (hero_zyweap.glb, 13k triangles, 0.9 MB). The spear was made from a "short spear" picture (the middle of the shaft cut out, so the
  long thin shaft could not bend or lean); the script stands it on its axis and moves everything below a cut in the shaft back down by
  the length cut out of the picture — a straight navy shaft. The bow's string was too thin for the remesh: a new one, a thin rod from
  nock to nock. The three share one material: their textures packed into one atlas (a quarter each). The quiver rides across the small of
  his back just above the seat (on the Hips, centred off the lower spine; nearly level, its mouth on his right tipped up ~24°, the
  feathers out past his right hip, its dragon facing back; snug against the back: 0.25 m behind the spine left a gap you could see from the side) — on his right hip, arrows up, the armoured skirt and the arm went through it. His spear wins over the weapon sheet's "spear" whichever file loads first (assets.js ZY_WEAP).
- How he holds the spear (assets.js zySpear, eased between over ~0.1 s): at ease (ZY_IDLE, his calm stand while no fight is near —
  units.js zyFighting: a roused foe within 12 m, or a blow struck or taken in the last 4 s) upright, its butt on the floor by his foot,
  his right fist round it; walking, held forehand at the balance point, the point forward and up (CARRY_UP, 0.62 rad), the butt a hand's
  breadth off the floor; on his own fighting clips, along the line from his right fist through his left (both hands always on the
  shaft), the right fist 18% of the way up from the butt (TWO_AT; the parry holds it by the middle); on the Sentinel's clips, the line
  fitted on them.
- His rise and calm stand (Nov 26): Meshy's "Axe Stance" preset — kneeling, he rises, sweeps the arm and stands with it raised at his
  side — stands in for the Sentinel's Rise (ZY_ALIAS.Rise, 6.1 s, at its own pace). The spear goes with his right hand as in Meshy's
  preview of the motion: lying flat on the floor beside him while he kneels, lifted high as he rises, swung upright and planted butt-down
  (zyAxe: its line in the hand measured at the clip's end, where it stands straight up; the fist's height there sets the grip, so the butt
  lands on the floor). From the plant (0.74 of the clip) it stands on its butt beside him, his right fist round it. (First version: it
  stood upright on the floor through the whole rise.) It is downloaded on its own (Meshy's "Current" animation: past the 20 the "All Added" download allows) and
  merged in by bone name (tools/zy-fix-rig.mjs extra.glb), keeps its travel (he steps forward as he rises) and is stood on his spot by
  its last frame. Its last 1.2 s, played there and back, is his calm stand (ZY_Stand_Ease, ZY_IDLE): while no fight is near he stands at
  ease with the spear grounded; near one, the spear guard (ZY_SP_Idle, below). (Fixed on the way: a rise's animation lock only
  began to run out after the rise, so every risen unit stood frozen in its last frame as long again.)
- In a fight (zyFighting) — Nov 26, second version: the Unreal pack's spear guard and spear walk (Thunder Cloud Studio's "Sword &
  Spear Animation", 23 spear clips on UE5's Manny; the person exported them from UE 5.4 as FBX). tools/bl_zy_ue.py moves them onto his
  rig in world space as bl_ybot.py does Y Bot's: his skeleton posed into Manny's reference pose (each bone aimed along Manny's; the
  hips by their frame — left-right across the thighs, up to the mid spine — since his hips bone stands well in front of and above his
  thighs; the thumbs matched), then his(b) = S(b)·S_R(b)⁻¹·O_R(b) per frame; his spine follows spine_02 / spine_04 / spine_05, and his
  thighs' midpoint follows Manny's, scaled by thigh-to-ankle height (0.925). Out come SP_Idle (the guard, 2 s) and SP_Walk (one 32-frame
  cycle of the pack's walk, which starts and stops: its frames 68–100 repeat exactly), merged in by zy-fix-rig.mjs (SP_* keep their
  travel). ZY_ALIAS.Stand is now ZY_SP_Idle; walking in a fight he plays ZY_SP_Walk whole (stride 1.31 m/s; the old split walk with
  the stance above and zyChest is no longer used). Out of one, still the calm spear walk; his calm stand plays at 0.45×.
- The Unreal clips hold the spear fixed in the right hand (a weapon bone, at the shaft's middle), so for them it is not laid through
  the fists: its line in the hand is taken where the pack's thrusts reach their full stretch (right arm out alone, spear straight ahead
  — the same line in the hand in all four thrust clips to a few degrees: ZY_UE_AXIS), the fist at the middle (UE_AT), the hands left as
  the clip has them. Along it the guard holds the point low by his right foot and the butt up across his left shoulder, the left hand
  free — as the pack's pictures show. (The first try, the line through both fists, held it across his belly: in the guard the left hand
  is off the shaft.) The rest of the pack — thrusts, triple thrust, spin, tornado kick, parry, dodges, jumps — is there to use for his
  blows and skills; the dashing ones travel 2–10 m (UE root motion), for the game to follow.
- His bow (zyBow, every frame while it is out): upright across the line he shoots along (string hand through bow hand), the string
  toward the drawing hand, the grip in his left fist, the left hand turned round it thumb-up. (Fitted once on one frame it stood askew.)
  The volley: the aim held (Archery_Shot_2), then Meshy's Archery Shot 3 once per arrow — it opens at full draw and lets go at 0.22 of
  its length; the last plays on to 0.75, before its arms fall. The Parry's answer is the bow too: after the parry, the bow drawn and one
  dragon-lit arrow loosed back down the line at the attacker, through everything in it (1.8×, pierces 6) — the whole answer in ~0.45 s
  (parry 0.12, aim 0.08, the release clip at 1.8×). His arrows leave from the bow (shoot's from: bow height, ~1.7 m) and drop to chest
  height (0.9) by the target's distance, tilted as they drop. The two shooting clips are turned 95° (not the bow arm's 77°) so the
  arrow's own line — string hand through bow hand — points where the arrows fly: it ran 18° to his left (tools/bl_zy_aim.py).
- His hands on the shaft (assets.js gripHand): Meshy's clips hold the fist the wrong way round for a spear — walking, the thumb toward
  the butt (as if to throw it). Each frame, after the clip is posed, the hand is turned about its wrist so the shaft runs in at the little
  finger and out past the thumb toward the point, the palm toward his body (one hand: at ease, walking) or in-and-up / cradling palm up
  (both hands, his own fighting clips; the shaft laid again through both fists after the turn); half of any twist about the forearm
  goes to the forearm. Walking needs ~115°. His fingers curl toward his real palms (ZY_PALM, measured on the mesh by
  tools/zy-palm.mjs: in, down and back in the A-pose) — they had curled forward, the Sentinel's way.
- His frame cost: he appeared with a stall of most of a second (a new shader, seven textures to decode and upload, the spear's lines
  fitted): now done while the game loads (prewarmHero: one of him built, compiled, his textures uploaded). His body simplified to 70%
  (17.4k triangles, as the Sentinel's; drawn twice with the outline) and his three weapons on one atlas.
- His look (shader uLook): his own albedo ×0.9 (Meshy's texture is lit already), no eye glow (the eye test would light his blue cloth),
  and polished metal: the map's metal mirrors a floor below, a dark band and a bright sky, the lights caught sharp, its own colour kept.
- The style (pact.js SETS.SPR): quick (move 2.4), life ×1.1, damage ×1.25, armour +8, a long reach (2.0) and a thin arc — and pierce:
  every blow also runs through what stands in a line 0.45 m either side of its facing, out to 1.6 m past its reach (PH.strike). Blows
  alternate a thrust (SNS_Lunge: the spear point drives forward) with the greatsword's swings.
- His bow (not a Fury skill: the spear's own way): at a target 6–13 m off, in sight, with nothing close, every 5 s — the spear set
  aside, the bow off his back, three arrows 0.28 s apart (0.55× damage each, a silver gleam, led onto a moving target), then back
  to the spear. He draws side-on, the bow arm out at the target (his own ZY_Archery_Shot_2).
- His blows and skills (Nov 26, third version): the Unreal pack's, each a move of its own (pactskills.js MOVES.SPR, spMove: spStart /
  spTick), carried by the clip's own root motion. tools/bl_zy_ue.py now leaves UE's root motion (the root bone, which comes into Blender
  as the armature object: its move and its turn) out of the poses and writes it to src/zyroot.js (per frame at 30 fps: forward, his left,
  his turn). Each frame the root's step since the last, in the root's own frame, is walked where he now faces, times k (a part's travel
  stretched or cut to where it should take him; a wall stops it), and its turn turns him — so turning him between a move's parts turns
  the rest of its path with him. Blows land at set clip times, from his body (the hips) where it is then: a ring (all round), an arc
  (radius, half-angle) or a line (a thrust: length, half-width), each foe once, its qi flying on past the point (qiWaves, qiFan, qiBolt).
  The times come from the clips (tools: the spear tip's reach, its angle about him, the root's travel and turn — the root jumps 3.5 m in
  0.15 s in each of the triple thrust's dashes, turns twice about itself in the spin).
- His swings (in place of the windup-and-strike: units.js startWindup asks PH.heroAtk), in turn: 1 Time Thrust (a twirl overhead — an
  arc, 2.8 m, ±100° — then a lunge two metres in, the point four and a half out: a line 3.6 m, 1.35×; no root motion, the lunge is in the
  pose), Attack 2 Times A (an overhead sweep, then a dash of 2.5 m and a thrust) and B (a dash and a thrust, then a great sweep left to
  right, 3 m, ±110°). The dashes are cut to stop short of the target. 1.45× speed; attack speed (Fury, gear) plays them faster by up to
  1.6× and the rest goes into the blows (the damage per second keeps all of it). The next starts as soon as one is done.
- 长坂冲阵 Changban Charge: Triple Thrust — three dashes, each ending in a thrust. The first runs through the target and 1.6 m on (3–9 m,
  as the old lunge), the second and third 72% and 56% of it (at least 2.5 m); before each of those he turns (over 0.3 s of the clip) to
  the line through the most of them from where he stands, preferring the target (back through it at worst). What a dash passes is run
  through (1.3×, the target more), thrown aside to its side and stunned 0.6 s.
- 枪花 Spear Flower: Horizontal Spin Attack — two turns about himself as he goes (the clip's root turns 720°): a ring of qi each (0.8×),
  then a dash and a thrust (1.2×), a step and a sweep (0.9×). Each part aimed anew: the spins at the crowd before him; the dash at the
  next crowd (crowd(): the foe with the most others within 2.5 m, away from the way already taken where it can) — its extra turn spread
  through the spin, where it does not show; the dash stretched to it; the last sweep at whatever crowd is left.
- 百鸟朝凤 Hundred Birds: Tornado Kick and Thrust — from as far as 9 m, at a crowd (2+ within 3 m of the target) or a hard foe: dragon
  light gathers on the spear as he whirls and kicks, a ring of cuts each half turn (six, 0.55× each), then a dash (cut to end 2.4 m short
  of the target) and the thrust: a line (1.6×) and the five bolts fanned ahead about 9 m (now 3×; non-elites under 25% cut down).
- 招架 Parry: the pose is the pack's Spear Parry (0.17 into it, the spear raised high); the answer is still the bow.
- Nov 27 (the person: "the spear does not keep up with the hand; the travel and the swing out of step; sped up, the rhythm is not
  theirs"): all of them at the pack's own pace now (speed 1; attack speed goes into the blows instead), the clip's time read off the
  action itself (the pose on screen: a chill or a skipped far-off frame slows both alike), and the spear, where it is fixed in the hand
  (the Unreal clips, the rise), follows the hand exactly — it had been eased toward its line at dt×12, trailing far behind a fast swing
  (eased now only for 0.15 s after the way of holding it changes); held fast, it may touch the floor (lifted only 0.3 m deep). The
  test arena has his moves on buttons (at the nearest foe, no cooldown, any Fury), slow motion (1×, ½×, ¼×, ⅒×: main.js scales the
  frame's time by globalThis.__ts) and a toggle that freezes the foes where they stand.
- Nov 27, after watching at half speed (the person: "most of them only thrust all the way out at the very end; added travel should go in
  around that thrust, so the point is out ahead of him as he goes; it need not be exact"): a part of a move stretched past the clip's
  own run (k > 1) keeps the clip's own steps as they are and puts the extra in from 0.25 s before its thrust (the part's first line blow)
  to just after (spGo/spPart); cut short (k < 1), its steps still shrink evenly. The pace of these is meant to be slower than the other
  weapons' — big, open moves.
- Nov 27, the spear as Unreal holds it (looked up in the pack's Overview_Spear map: SM_Spear, 273 cm, pivot at its middle, point on +Z,
  hung on the socket ik_hand_r at Y −27.5 cm, roll −90° — so ik_hand_r is the grip, 0.4 of the shaft from the butt). ik_hand_r is keyed
  on its own, not tied to hand_r: in the Horizontal Spin, frames 61–89, it sits in the LEFT hand (the spear trailed behind him, then
  stood on its point on the floor at 85–87) and goes back to the right at 91 — why no fixed in-hand line ever fit the spin.
  tools/bl_zy_ue.py now bakes, for every frame of every ZY_SP_* clip, the spear's grip point and the way its point goes into
  src/zyroot.js (ZY_SPEAR), kept in a frame of his right hand made of three points (wrist, middle and little-finger knuckles — the
  game makes the same frame from the same bones, whatever way each bone's axes lie). Near a hand it keeps Manny's offset from that hand
  (scaled); more than 0.2–0.45 m off both, Manny's place on his scale. zySpear reads the track at the clip's time (the grip point
  where the shaft's grip is); ZY_UE_AXIS stays only for a clip without one.
- Nov 27, pace: with the spear right the person found the moves right but slow — all his Unreal moves (attacks and skills) now play
  1.3× as fast (MOVES.SPR.pace; everything in a move goes by the clip's own time, so it stays in step). The test arena has a row to
  try 1× / 1.15× / 1.3× / 1.5× (globalThis.__zyPace). His normal attacks come round 30% sooner, so they deal ~30% more over time.
- Nov 27, his numbers (measured in the arena: normal attacks only, a brute at ×50 life, Fury 25): spear 116 a second against one
  (GS 29, mace 43, sword 28) and 279 into five — the spear's attack figure on the panel is below the greatsword's (set 1.25 × weapon
  1.2 vs 1.5 × 1.3) but each of his attacks is two blows at ~2.9× together, and since his clips keep their pace his attack speed goes
  into the blows (cd0/cd, ~1.6 at Fury 25). His skills and bow had none of that and fell far behind his attacks: now every move of
  his and his bow take the same factor (zyK). 长坂冲阵 harder besides (run-through 1.3 → 1.6, thrusts 1.0/1.0/1.2 → 1.2/1.2/1.5).
  The bow: 0.55 → 1.2 an arrow, and each goes on through up to 5 (they had killed nothing).
- 百鸟朝凤 cast from as far as 9 m whirled its kicks at nothing (they cut all round him 1.5–2.5 m out from where he starts; only the
  last thrust reached): now only with the target within 4.6 m (kick) and two or more within 3 m of the kicks' middle (1.8 m toward
  it) — or a champion / a hard one.
- His voice (the person's lines, made in ComfyUI, trimmed and levelled to the war cry): 「末将赵云，字子龙，常山真定人也。」/「吾乃常山
  赵子龙也！」 (zy_intro0/1, one at random) when he is summoned (the cast) or first comes up in a session (entering the game: 0.8 s into
  the rise), and whenever the skeleton takes up the spear (PH.gear / setStyle, against the style it was last armed as) — not as he rises
  again on each new floor; and 「休伤我主！」
  as To the Rescue begins (zy_rescue). S.voice waits (up to 2 s) for the sound to wake and the line to decode; asked for before the
  sound exists at all (entering the game: the camp and the Sentinel come up behind the start screen, before any click) it is kept and
  spoken 0.6 s after the start click wakes the sound (unlock).
- The equipment panel's doll of 赵云 stands in his calm stand (ZY_IDLE, the spear upright beside him): 'Stand' became his Unreal
  fighting guard — crouched, head down — which looked wrong face-on in the panel.
- The graveyard camp keeps a spear for him (so friends trying 赵云 need not find one first): an epic one on a relic stand at (21.5, 22.5),
  just up the path from where the summoner starts, at the deepest floor's item level (loot.js placeGift). There each time the game is
  loaded until it is picked up (G.gifts, not saved: not again that session). (First it was left out whenever a spear was owned anywhere —
  so the person, who had one, never saw it.)
- 奔袭救主's heal for the summoner (the person: "the summoner can't get his life back at all"): a fifth of the summoner's life at once
  as he stands before it (on arrival — not as the rescue starts: the blow that calls him has yet to land), then 40% of the damage he
  deals while it lasts (was 10%), at most 70% of the summoner's life in all (was 60%); his fan of light takes his attack-speed factor.
  The fan loosed, he goes straight back to fighting (he had stood still in front of the summoner till 2.3 s, only taking blows); his
  guard (every blow parried) and the summoner's held life and heal from his blows run on to the end of the rescue as he fights.
- 奔袭救主 To the Rescue (25 Fury; his Life Steal stays, 10% to himself): the moment the summoner falls under 40% life (damage() asks
  PH.rescue before a blow on him lands), his life is held for 3.2 s (blows take nothing; "锁血"), and Zhao Yun comes: within 6.5 m a
  sidelong dash (Spear Dodge Left or Right — whichever leaves him facing nearer the threat — its 4.5–5 m stretched to the distance), else
  at once in a flash of dragon light, to stand 1.3 m before the summoner facing the nearest foe, spear raised (Spear Parry). Meanwhile
  every blow on himself is turned aside. Then a great sweep (Attack 2 Times B's) and nine bolts of dragon light in a fan of 150° (1.6×,
  9.5 m). While it lasts, 10% of the damage he deals heals the summoner too (at most 60% of the summoner's life a rescue — his blows are
  big beside it). 40 s cooldown.

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

## 场景美术 / Scene art: the hand-painted trial (Nov 2026)
The person chose the hand-painted direction (WoW / Hordes.io: low polygon, the look carried by painted textures) over flat toon colour.
The Sentinel and 赵云 are the anchors for how much detail anything may carry — nothing made after them is to be more complex than
赵云. It is tried on a small area first, the graveyard camp, behind `?paint=1` (without it the camp is the KayKit tiles as before);
the target is the person's concept picture ("Gothic Graveyard Beneath the Purple Beam"): mostly bare dark earth, cobble paths, moss at
the fence and the foot of the graves, scattered autumn leaves, a blue-violet mist beyond the fence, warm lantern pools against a cool night.
- One ground mesh over the clearing instead of floor tiles (terrain.js paintGround): four tiling hand-painted textures — dirt, moss,
  cobble, leaves (assets/ground, 1024² jpg; metres one repeat covers in GROUND) — blended by a splat map laid out in code
  (world.js campGround) with height blending: the brighter layer wins the edges, so the stones stand out of the moss, and a light
  leaf weight shows only a few leaves. Each texture is laid twice (the second turned and scaled) and mixed by slow noise, with a slow
  brightness / warmth wash over all, so the repeats don't read.
- The layout: dirt underneath; cobble along the path cells (ragged edges, a few stones missing); moss thick along the fence, in rings
  at the foot of the graves and the trees, a few stray patches and in the gaps beside the paths, never where the summoner starts or before
  the crypt door; leaves in broad drifts and under the trees (the leaf texture is earth with a few leaves, so even full weight is sparse).
- The paths, now: the person's tile set ("Graveyard Cobblestone Tile Set", a painted sheet of six square cobble blocks; kept in
  tools/ground/tileset_source.png): each path cell shows one whole block (stonepath.js tilePath; assets/ground/pathtiles.webp, the
  sheet's background made see-through), picked and turned per cell, never the same block as the cell before it. Each block keeps
  its own outer stones — they stop short of its edge (the person: "the stones mustn't run to the edge, so the joint between two
  blocks looks like the joints inside one") — so the blocks meet at a joint like any other, and the outer stones make the path's
  sides. The painted camp's paths are drawn two cells wide (the extra cell to +x along a run in z, to +z along one in x; drawn
  only — the walkable grid and the graves keep to the one-cell paths); one cell wide they were a thin dark line beside the concept's.
  Eight more blocks in the same style were painted by Qwen with the sheet as its reference (no leaves, no grass; smoother than the
  person's): those are used by default (`&tiles=own` the person's six, `&tiles=mix` both — mixed, the person's darker, mossier blocks
  stood out as patches). tools/ground/make_tiles.py builds the atlas (4×4 slots of 512).
- The blocks now stand as separate stones, the KayKit way (the person, looking at KayKit's stone paths: the stones stand apart, a
  square is one group, the gaps are the ground's — the flat pictures looked too clean): tools/ground/seg_tiles.py finds each block's
  stones (bluer and lighter than the mossy joints), grows each back over its bevel leaving a gap where two meet, and traces their
  outlines (assets/ground/pathtiles.json); stonepath.js tilePath3d raises every stone 3–5 cm, slightly tilted, its top the block's
  painting (so the picture's own bevels and cracks stay), its sides darker — and the ground under the path (dark earth, moss, a few
  leaves) shows in the gaps. `&path=flat` shows the flat pictures. ~1,700 stones over the camp's two-cell-wide paths, one mesh.
- Then worn (the person: too new — smooth, every edge sharp; worn, with gaps wide enough, no line of joints reads as straight, so the
  blocks' own edges can go irregular too): stonepath.js wornStone resamples each outline every ~4 cm, softens its corners, eats into
  it a little (slow noise along it, more at corners, a chip now and then, more again along the block's own edge), and raises it in
  rings — foot, a soft shoulder, the top's worn rim, an inner ring, the crown — each a little uneven; a stone grain (stone.jpg, 40%)
  over the smooth paintings. First tried twice as worn: they turned into river pebbles. ~166k triangles for the camp's paths.
- `?paint=1&big=1`: the whole clearing's ground as ONE painting (terrain.js bigGround, assets/ground/camp_big.jpg, 2048² over 26 m —
  nothing in it repeats). Made from a top-down shot of the painted ground above, lit flat and without props (tools/ground/topdown.py),
  repainted by Qwen keeping its layout (workflow.img2img, sampling from sigma 0.93 — 0.85 kept too much of the tiling; prompt in
  tools/ground/camp_prompt.txt), brought to the shot's mean colour. 2048 over 26 m is about the screen's own density, so the dirt
  texture's brightness is laid over it at 35% (at its own 3 m scale) to keep it crisp up close. The path's stones stand on it as
  before; under them the painting is turned to dark earth and moss (its own painted path would show in the gaps).
- Before that (`&path=slab`): raised stones, not painted (`?paint=1&flat=1` shows the painted cobble of the first try). The person,
  pointing at the concept: its path is square blocks, each 4–6 flat angular slabs with slanting joints — so each 1 m path cell is
  such a block, laid by code (no two alike, nothing repeats): a straight cell is two courses across its run split by a slanting line,
  each cut by slanting joints into slabs 0.3–0.5 m across; a corner or crossing cell is 2×2 by two slanting lines. Each slab is its
  own little mesh: its quad less half the joint, edges chipped, a corner knocked off now and then, a flat top 4.5–7.5 cm up on steep
  sides with a narrow bevel, slightly tilted, tinted warmer or cooler, darker down the sides. At the path's sides they reach
  0.12–0.26 m past the cells, ragged, lower, now and then missing; a few small sunken ones stray. Lit with their own slope (a painter's
  light from the screen's upper left, the summoner's light and the lanterns from where they are). Under them the ground is darkened
  with moss in the joints (the splat map's alpha). ~500 slabs, ~60k triangles, one mesh. (First tried as Voronoi cobbles — round,
  cushiony, wrong for the concept.) Their surface (assets/ground/stone.jpg) is a stand-in made in numpy until a painted one is made.
- The lanterns light the painted ground a little more than the props (0.95 against 0.72), for the concept's warm pools.
- terrain.js groundFog: one see-through sheet 0.32 m up over the wilds around the camp — clear inside the fence, thickening over the
  first ~5 m past it, in slowly drifting patches (blue-violet).
- The textures come from the person's ComfyUI (Qwen Image 2.1 turbo; prompts in tools/ground/prompts.json: "stylized hand-painted game
  texture … classic fantasy MMORPG ground textures", top-down, even light, even density, medium brightness — asked dark, it painted
  near black; without the style words it painted photographs). Tileable: a transformer model can't be made seamless by circular padding,
  so a small node of ours (tools/ground/comfy_node_gt_seamless_roll.py, installed in ComfyUI's custom_nodes as gt_seamless_roll.py) rolls
  the latent round before every model call — three rolls a third apart each step, each pixel taken mostly from the roll it is farthest
  from a seam in (sharp 6: a plain average blurred the detail; one random roll a step left faint lines where the last steps' seams fell;
  inpainting a rolled image's seams instead left bands and broken stones). Each batch is decoded three times — as made, rolled by a half,
  by a quarter — and tools/ground/fixwrap.py takes each pixel from a decode far from its own edges (the VAE spoils ~30 px at the edges).
  grade.py brings each to the set's palette (dirt mean ≈ (98, 78, 62); the leaves graded on their bare soil, so it matches the dirt);
  make_set.py does the lot; workflow.py writes the ComfyUI workflow. About 75 s a batch of four on the person's PC. The set in use:
  dirt7 #1 (contrast eased to 0.8: full strength the clods read as polka dots), moss6 #1, cobble7 #2, leaves7 #2 (the generations are
  kept in the person's ComfyUI output, props/ground).
- Not yet: the wilds beyond the fence (still the flat vertex-coloured sheet: the change shows at the gates), the props (KayKit toon),
  the crypt floors.
