# 唤魂墓穴 · Grave Tamer (prototype)

A Diablo-style dungeon crawler where the summoner **captures monsters from their corpses** and fights alongside them.
Runs in the browser on desktop and phones (GitHub Pages, installable as a home-screen app).

## Play
- **Desktop:** left click to move / click a monster to attack · right click (or Shift + left click) casts Bone Spear toward the cursor ·
  **Q** 唤魂 (capture the corpse nearest the cursor) · **W** 愈合 (heal) · **Tab** 墓典 (your collection) · **Enter** on the stairs to go down
- **Phone:** drag on the left half to move · hold 🦴 to fire Bone Spear (auto-aim) · 👻 to capture the nearest corpse · 💚 heal · 📜 墓典
- **Minimap:** top right, drawn at the camera's angle; it fills in as you explore (a room maps fully when you walk in) and shows the way down, loot, allies and nearby monsters.
  Tap / click it for a big see-through map (clicks pass through it; the 🗺 chip shrinks it back); **M** cycles small → big → off; ⚙ → Minimap turns it on or off.
- **Phones:** Android browsers go fullscreen when you enter the crypt (⚙ → Screen toggles it). iPhone Safari can't go fullscreen from a web page:
  Share → "Add to Home Screen" and open the game from that icon to play without browser bars. The game re-fits itself after you rotate the phone.
  The top of the screen: on an iPhone the panels keep clear of the notch / Dynamic Island and the status bar; on Android full screen
  the panels at the sides go right up to the top (the camera hole is in the middle — only the boss bar keeps clear of it). Upright,
  the boss bar sits just above the skill buttons.
- **Language:** English by default. ⚙ (top right) → Language → 中文 switches to Chinese (and back); the game saves and reloads.
  The same menu holds the sound toggle and the testing resets (dungeon reset / wipe everything).

## Soul Pact mode (魂契, new)
Picked on the start screen (its own save). One summoned skeleton — the realistic **Bone Sentinel** — does the fighting:
- **E** (or 💀) summons it: a 1.5 s cast, no cooldown; it climbs out of a rune circle. The summon skill doesn't level: its strength is Fury and gear.
- It builds **Fury** (战魂) from kills by its own hand: each stack adds damage, attack speed, move speed and life. When it falls, all Fury is lost — summon it again.
- **Q** 唤魂 turns corpses into **soul energy**: the souls fly across the screen into the **soul orb** (a glass globe held up by a hooded skeleton in a gothic cradle — bottom centre
  on a wide screen, above the skill buttons on an upright phone). Full at 100; past that the liquid burns brighter and, a layer at a
  time (each bigger than the last), the cradle's runes, the skull's eyes and the gem turn azure, gold, violet, crimson.
  **Hold the vessel** (or hold **E** / the summon button — it reads "Pour" — while the Sentinel is out) to pour it into the Sentinel:
  souls stream from the flask into its chest, it glows brighter the longer it drinks, and it gains Fury (one kill's worth = 2.5 soul).
  After a fall, what you saved charges it back up. (Old saves get back all the soul they spent on summon levels.)
- Weapon styles: **Sword & Shield** (tanky, high evasion, quick strikes), **Greatsword** (heavy cleaves that knock back, less evasion) or
  **Mace & Shield — Paladin** — set by the weapon it holds. The Paladin turns holy: polished silver plate with gold trim, an ivory tabard
  with a gold cross, a white crest, a halo, gold light instead of cyan. Its mace is blunt (shields don't stop it, it ignores half of armour,
  +25% against heavy armour), every third blow is a Smite, and its skills become Hammer Leap (it hurls the mace to stun the target,
  leaps after it, catches it overhead and lands in a burst of light), Blessed Hammers (three hammers of light wheeling round it for 6 s),
  Judgement (a pillar of light and three rings of it) and the Aura of Light (7 m: its damage heals everyone of its side inside, and each
  wears a shield of light worth 20% of their life).
- Gear drops for the Sentinel: greatswords (two-handed, no shield), swords, maces and shields, in white / blue / yellow / purple / red; equip from the Pact panel or the bag.
- As Fury grows its soul light (cyan, like its eyes; gold for the Paladin) shines out of it from inside, a step every 10 stacks up to 100.
- Monsters move at 60% speed in this mode, so fights stand still around the Sentinel while the summoner moves, heals and harvests.
  From floor 5 down (and in the wilds' level-5+ zones) monsters, champions and bosses have 2.5× life, +4% more per floor after that.
- **Barrels, kegs, boxes, crates and trunks** burst into pieces when you click / tap them (sometimes an item, some soul energy);
  **chests** swing their lids open (always an item, often two, better odds, more soul) — now and then a **gold chest** full of coins with
  better loot still; unopened chests glint now and then; the chest in a ruin in the wilds too.
- Fury's damage and attack speed per stack slow down past 25 (+3% / +1.5% a stack instead of +6% / +4%).

**Bosses**: every 5th crypt floor, one of the four tech skeletons guards the way down (bombardier, gunner, mech, engineer — their big
attacks are marked on the ground first; at half life they enrage). They drop four or more pieces of gear for the Sentinel (purple / red at the top, more for each round of the four already behind) and a burst of soul energy, or their own epic tech
weapon in Crypt mode.

**⚔ Test Arena** (start screen, or `?arena`): an empty hall on top of your save, with a panel to spawn monsters (dummies too), set Fury,
level and weapon style, and a damage meter (DPS, kills, time to kill, damage taken). Nothing there is saved.

## Summons
- Kill monsters, then cast **唤魂**: it channels on every corpse within 6 m at once (corpses stay 30 s; each extra corpse costs a little more mana). Capture chance depends on the monster (normal > champion) and your level.
  Enemy shamans resurrect corpses too, so grab them first.
- Captured monsters go into the **墓典**. You start with 1 party slot, +1 at levels 5, 10 and 16 (max 4). Edit the party when not in combat.
- Each summon keeps its monster personality: brute = tank (draws enemy attacks), imp = fast melee with crits, archer = keeps distance,
  shaman = heals the party and makes revives faster. Champions keep their affix (Swift / Fire-enchanted / Stoneskin).
- **Fusion (融合):** in the 墓典, fuse a resting summon of the same kind into another: normal + normal may turn elite (12%),
  normal + elite may inherit an affix, elite + elite may add the partner's affixes (up to three, e.g. 冰火 / 冰火雷) or
  strengthen one it already has (up to Ⅲ). The partner disappears; the kept summon always gets some experience.
  **One-click fusion** fuses the plain (no-affix) partners in one at a time and stops as soon as something changes, keeping the rest.
- Summons level up from kills. When one dies it keeps its level and comes back after a revive timer.
- When the party is full a capture still stands up, then flies into the summoner as a soul and is stored in the 墓典.
- **Soul energy:** in the 墓典, resting non-champion summons can be converted into soul energy for another summon:
  it gains experience (same type +50%) and 魂能点 (soul points). Points buy ranks in that summon's own skill tree
  (4 skills per monster type, e.g. Warrior: Leap Slam / Hard Bones / Whirlwind / War Cry).

## Equipment
- Only summons wear gear: a weapon of their own type (Warrior axes, Minion blades, Crossbowman crossbows, Mage staves; three bases each,
  from fast-and-light to slow-and-heavy) and a shield as armour (anyone). Quality: 普通 / 精良 / 稀有 (rare items get an extra line).
- Monsters sometimes drop gear, champions always do; rare drops send up a thin column of light (rising straight from the item once it lands, brighter and taller for epic and legendary, with a pool of light at its foot). Walk over loot to pick it up (bag of 40).
- **装备 panel** (tap a summon's card at the top left): paperdoll with its live 3D model, weapon / shield frames and the bag.
- **背包 panel** (🎒 button or **I**): the 40-cell bag (one item per cell, icons rendered from the 3D models) and the furnace with auto-fill. Click an item to pick it up, click where it should go;
  right-click or double-click = quick equip (or into the furnace). Diablo-style tooltips; items a summon can't use are tinted red.
- **Furnace (熔炉):** put 2+ pieces into its 12 cells and smelt them into one random item; more and better input raises the odds. The result goes straight into the bag (it glows there until you close the panel).
  Auto-fill puts in the qualities ticked under it (normal and magic unless you change it; remembered in this browser), lowest first,
  and of the same quality those that would be an upgrade go in last; tech weapons never.
- **科技流 (tech line)**: epic weapons that turn a summon into an advanced tech unit with its own look, stance and skill tree (take the
  weapon off and it is its old self again; both skill sets are kept). They come out of the forge: every rare piece smelted (weapon or
  shield) gives +3% (at most 15%), and **魂钢能量 / soul steel** builds up by one per rare piece smelted without an epic — at 15 the next
  smelt with a rare piece is a guaranteed epic. Which one is decided by the weapons put in (one crossbow + a few rare shields → the
  mortar; more crossbows → likelier the mortar; no weapon at all → any of them). Duplicates allowed.
  Settings → Testing → "Get all tech weapons" puts one of each in the bag.
  - **噬魂机枪 → 机枪骷髅** (Minion): sustained fire, grenades, armour-piercing rounds, brace to fire on the move. Also the camp coffin's easter egg.
  - **裂魂臼炮 → 炮手骷髅** (Archer): lobs shells 9 m that blow up groups and knock them back; backs off from anyone in its face;
    skills: Heavy Shells, Cluster Shells, Incendiary (fire on the ground), Barrage (a quick volley at a pack). Goggles, a shell rack, a bronze pauldron.
  - **魂钢钻头 → 机甲骷髅** (Warrior): +45% life, +15 armour, a little bigger (not much — crypt corridors are narrow). Each attack is a
    3-hit drill grind (the last hit knocks back); skills: Soulsteel Drill, Rocket Dash (thrusters charge 3–9 m, shoving enemies aside,
    a stunning impact), Shield Field (when swarmed or hurt: a dome soaks a share of its life and taunts everyone around), Overload
    (charges up, then an EMP shockwave from itself that damages, stuns and knocks back). Dome helmet with an antenna, steel plates,
    a glowing reactor and a thruster backpack.
  - **魂钢指挥杖 → 机械师骷髅** (Mage): a hard hat with goggles, a headset and a drone dock on its back; shoots a bolt from the rod and
    commands little skull drones: Attack Drones (1 at first, one more per rank up to 5; they circle it and fire lasers), Repair Drone
    (from the start: flies to whoever is hurt worst, the summoner included, and keeps fixing them — it takes over the mage's healing),
    Orbital Strike (marks a pack or an elite, a column of light comes down a second later: big damage and a stun), Prism Lasers
    (lasers bounce to nearby enemies). The drones fly free in the world (`drones.js`) and fall out of the air when it dies.

## Monsters
Skeleton Warrior (telegraphed smash, knock-back), Skeleton Minion packs (panic and flee when a packmate falls apart),
Skeleton Crossbowmen (kite and strafe), Skeleton Mages (fireballs, resurrect fallen allies). Champions get an affix and an aura ring.
Champion affixes (captured champions keep them): Swift, Fire-enchanted (explodes on death), Stoneskin, Cold (chills: slower
movement, attacks and animation; frost nova on death), Poison (damage over time; poison cloud on death) and Lightning-enchanted
(chain lightning on hit; thunder burst on death). Affixes show on the weapon (glow, particles) and on hits and projectiles.
Packs alert each other; hard hits stagger.
**Combat feel**: blades leave a swing trail (in the weapon's quality colour, the affix colour on champions); blows land on the
frame the swing connects, with a slash arc, a flash and bone chips; heavy blows and crits freeze both bodies for a few frames
(hit-stop), whoever is hit jolts and squashes, and big impacts (Leap Slam, grenades, champion deaths) shake the camera
(Settings → Screen shake). Warriors and Minions vary their swings; Leap Slam cracks the ground, Whirlwind spins a ring of blade
light; enemy warriors telegraph their chop with a red ring. Damage numbers pop in (crits bigger, with a shiver) and drift aside.
The 机枪骷髅 holds the gatling up with both hands while it walks, aims and fires (its legs and arms animate separately).
**Deaths**: the killing blow throws the body back (a hop on a hard hit), the skeleton flashes and collapses faster, and bones
fly off and clatter across the floor (more from hard hits, warriors and champions); a champion falling near the summoner
slows time for a moment. **Weapon glow**: Magic weapons keep a soft glow at the tip; Rare and Epic weapons are wrapped in
energy flowing from the grip to the tip (gold / purple) and shed sparks — in a hand and lying on the ground.

## World
You start in a small graveyard camp; the crypt's door is a glowing portal — walk up its steps into it (or click anywhere on the building) to go down to the deepest floor you have reached.
**The Wilds**: two open gates in the camp fence (east and south) lead out into a big open map (120 × 120 m) that is generated anew
every time you come back to the camp: groves of dead trees and autumn pines, winding paths with lantern posts, and places worth
finding — roofless ruins with a chest, fenced old graveyards, candle-lit shrines, pumpkin patches. Monster packs wait all over it,
denser than in the crypt, none close to the camp; they get tougher (and more often champion-led) the farther they wait from the
camp, and every one of the places is guarded by a champion pack (two affixes once you are some way out). Monster level follows
the deepest crypt floor you have reached, loot follows the monster's level. Packs are only created when you come near them.
The ground is grass (with dry patches and darker forest floor under the trees); bare dirt and pebbles only along the trails, around
the places and at the gates. The woods come in three moods by region — dead (bare trunks), autumn (orange, red and gold) and dark
green — with bushes along their edges, grass tufts in the open and big rock crags to fight around (KayKit Forest Nature Pack; its
palette is repainted at load time so every tree's leaves get their own shade).
Trees standing between the camera and open ground are bare ones, so they hide less of the fight. The minimap maps the wilds as you walk them
(trees dark green, paths brown).
**Who lives out there**: no skeletons in the wilds — the living who come to rob the graves, in gangs, and the flying vermin of the night,
in swarms (data.js FOES, foes.js). Each fights as one of the four skeleton kinds and has one trick of its own:
- 盗墓贼 Grave Robber (hooded rogue, two daggers): hurt, it drops a smoke bomb and comes out behind you for a backstab (always a crit).
- 掠夺者 Raider (bald barbarian, two axes): hurls an axe from a few steps away.
- 弩手 Crossbowman (rogue, heavy crossbow): now and then aims — a red lane on the ground — and that bolt goes through everyone in it.
- 侍从 Squire (bare-headed knight, sword and round shield): its shield takes the edge off blows from the front.
- 圣殿骑士 Templar (helmeted knight, sword and badge shield): most of what hits it from the front is blocked, bolts and spells too —
  hit it from the side or the back.
- 处刑者 Headsman (dark knight, two-handed sword): slow, heavy blows; against anyone under 40% life an execution (×1.6).
- 狂战士 Berserker (barbarian in a bear hat, two-handed axe): a roar, then a whirlwind into the crowd; under 40% life it goes berserk.
- 驱魔师 Exorcist (mage in a pointed hat, wand and spellbook — the summoner is the bare-headed one): heals its wounded, throws fire.
- 蝙蝠 Bat: bites, darts away, dives back in. 幽灵 Ghost / 怨灵 Wraith (farther out): drift through bodies and spit slow, homing
  soul-fire that chills (the wraith three at once); they leave no corpse.
The living keep their own corpses, which rise only as skeletons: a robber's bones as a 骷髅小兵, a templar's as a 骷髅战士, a
crossbowman's as a 骷髅弩手, an exorcist's as a 骷髅法师 (bats as minions, at half the usual chance). The crypt below keeps its skeletons.
The test arena spawns any of them (the 野外 row).
Inside the crypt, standing on the glowing grate only shows the **⬇ Descend** button: you go down only when you press it (or Enter), so you never drop a floor by accident with loot still lying around.
Each crypt floor is generated: rooms and corridors, torch-lit far walls, props, and a grate down to the next floor.

## Tech
Three.js (bundled with esbuild into `game.js`). Animated low-poly characters share one rig and one animation set;
props are instanced per map chunk so off-screen parts are culled. Toon shading with the hero's light radius plus the nearest
torches, near walls cut down and a see-through circle around the hero, flow-field pathfinding. Save data lives in the browser (localStorage).
`?rs=1.5` forces a render scale; otherwise quality steps down automatically when frames run late.

Build: `npm install && npm run build`
Assets: `node tools/build-assets.mjs <path to the KayKit packs>` rebuilds `assets/*.glb` (merged skinned meshes, meshopt-compressed).
Soul Pact skeleton: `tools/bl_retarget.py` (Blender as a Python module) copies Mixamo clips made for the standard Y Bot onto the Meshy rig in
world space, through both T-poses (`tools/bl_ybot.py`; Mixamo's own retarget bent our knees sideways), and strips root travel into `tools/hero-meta/*.json`; `tools/bl_weapons.py` splits the weapon sheet; `node tools/build-hero.mjs` compresses each glb
(`hero.glb` model + rise/dodges, `hero_sns.glb` / `hero_gs.glb` clip packs, `hero_weapons.glb`). They load only in Soul Pact mode.

## Credits
3D models and animations: **KayKit** by Kay Lousberg (www.kaylousberg.com) — Character Pack: Skeletons, Character Pack: Adventurers,
Dungeon Remastered, Halloween Bits and Forest Nature Pack. Licensed CC0 1.0; thank you, Kay!
The wilds' bats and ghosts are from **Quaternius**' Ultimate Monsters pack (quaternius.com, CC0 1.0).
The Soul Pact skeleton ("Boneforged Sentinel") and its weapons ("Runebound Armory") were generated with **Meshy** (meshy.ai), licensed
CC BY 4.0. Its animations are from **Mixamo** (Adobe): Pro Sword and Shield Pack, Great Sword Pack, Zombie Stand Up, Dodging.
Its blade sounds — a metal slice and the ring of the blade, no wooden knock — are mixed from **Kenney**'s Impact Sounds and RPG Audio (www.kenney.nl, CC0; tools/mix-blades.py); one light swish is from **artisticdude**'s Swishes Sound Pack (OpenGameArt, CC0).
Its swishes, armour hits, blocks, fire, slams, war cries, charges, holy light, Judgement and Blessed Hammers, the champions' poison and thunder, and the monsters' cries and shots, were generated with
**Stable Audio 3 Medium** (Stability AI) in ComfyUI and picked by ear.
