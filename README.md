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
- **Language:** English by default. ⚙ (top right) → Language → 中文 switches to Chinese (and back); the game saves and reloads.
  The same menu holds the sound toggle and the testing resets (dungeon reset / wipe everything).

## Soul Pact mode (魂契, new)
Picked on the start screen (its own save). One summoned skeleton — the realistic **Bone Sentinel** — does the fighting:
- **E** (or 💀) summons it: a 1.5 s cast, no cooldown; it climbs out of a rune circle at the summon skill's level.
- It builds **Fury** (战魂) from kills by its own hand: each stack adds damage, attack speed, move speed and life. When it falls, all Fury is lost — summon it again.
- **Q** 唤魂 turns corpses into **soul energy**; spend it in the Pact panel (**Tab** / 💀 Pact) to strengthen the summon.
- Weapon styles: **Sword & Shield** (tanky, high evasion, quick strikes) or **Greatsword** (heavy cleaves that knock back, less evasion).
- Monsters move at 60% speed in this mode, so fights stand still around the Sentinel while the summoner moves, heals and harvests.

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
- Monsters sometimes drop gear, champions always do; rare drops shine with a light beam. Walk over loot to pick it up (bag of 40).
- **装备 panel** (tap a summon's card at the top left): paperdoll with its live 3D model, weapon / shield frames and the bag.
- **背包 panel** (🎒 button or **I**): the 40-cell bag (one item per cell, icons rendered from the 3D models) and the furnace with auto-fill. Click an item to pick it up, click where it should go;
  right-click or double-click = quick equip (or into the furnace). Diablo-style tooltips; items a summon can't use are tinted red.
- **Furnace (熔炉):** put 2+ pieces into its 12 cells and smelt them into one random item; more and better input raises the odds. The result goes straight into the bag (it glows there until you close the panel).
  Auto-fill puts normal items in first, then magic ones (those that would be an upgrade for a summon last); rares are never added automatically.
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
The Soul Pact skeleton ("Boneforged Sentinel") and its weapons ("Runebound Armory") were generated with **Meshy** (meshy.ai), licensed
CC BY 4.0. Its animations are from **Mixamo** (Adobe): Pro Sword and Shield Pack, Great Sword Pack, Zombie Stand Up, Dodging.
