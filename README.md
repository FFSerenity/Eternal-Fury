# 唤魂墓穴 · Grave Tamer (prototype)

A Diablo-style dungeon crawler where the summoner **captures monsters from their corpses** and fights alongside them.
Runs in the browser on desktop and phones (GitHub Pages, installable as a home-screen app).

## Play
- **Desktop:** left click to move / click a monster to attack · right click (or Shift + left click) casts Bone Spear toward the cursor ·
  **Q** 唤魂 (capture the corpse nearest the cursor) · **W** 愈合 (heal) · **Tab** 墓典 (your collection) · **Enter** on the stairs to go down
- **Phone:** drag on the left half to move · hold 🦴 to fire Bone Spear (auto-aim) · 👻 to capture the nearest corpse · 💚 heal · 📜 墓典

## Summons
- Kill a monster, then cast **唤魂** on its corpse within 30 s. Capture chance depends on the monster (normal > champion) and your level.
  Enemy shamans resurrect corpses too, so grab them first.
- Captured monsters go into the **墓典**. You start with 1 party slot, +1 at levels 3, 6 and 9 (max 4). Edit the party when not in combat.
- Each summon keeps its monster personality: brute = tank (draws enemy attacks), imp = fast melee with crits, archer = keeps distance,
  shaman = heals the party and makes revives faster. Champions keep their affix (Swift / Fire-enchanted / Stoneskin).
- Summons level up from kills. When one dies it keeps its level and comes back after a revive timer.
- When the party is full a capture still stands up, then flies into the summoner as a soul and is stored in the 墓典.
- **Soul energy:** in the 墓典, resting non-champion summons can be converted into soul energy for another summon:
  it gains experience (same type +50%) and 魂能点 (soul points). Points buy ranks in that summon's own skill tree
  (4 skills per monster type, e.g. Warrior: Leap Slam / Hard Bones / Whirlwind / War Cry).

## Equipment
- Only summons wear gear: a weapon of their own type (Warrior axes, Minion blades, Crossbowman crossbows, Mage staves; three bases each,
  from fast-and-light to slow-and-heavy) and a shield as armour (anyone). Quality: 普通 / 精良 / 稀有 (rare items get an extra line).
- Monsters sometimes drop gear, champions always do; rare drops shine with a light beam. Walk over loot to pick it up (bag of 40).
- Equip in the 墓典: tap a summon, then its weapon / armour slot (▲ / ▼ compares with what it wears). The warrior shows its shield.
- **Furnace (熔炉):** throw unwanted gear in (2+ pieces) and get one random item back; more and better input raises the odds.

## Monsters
Skeleton Warrior (telegraphed smash, knock-back), Skeleton Minion packs (panic and flee when a packmate falls apart),
Skeleton Crossbowmen (kite and strafe), Skeleton Mages (fireballs, resurrect fallen allies). Champions get an affix and an aura ring.
Champion affixes (captured champions keep them): Swift, Fire-enchanted (explodes on death), Stoneskin, Cold (chills: slower
movement, attacks and animation; frost nova on death), Poison (damage over time; poison cloud on death) and Lightning-enchanted
(chain lightning on hit; thunder burst on death). Affixes show on the weapon (glow, particles) and on hits and projectiles.
Packs alert each other; hard hits stagger.

## World
You start in a small graveyard camp; the crypt door leads down to the deepest floor you have reached.
Each crypt floor is generated: rooms and corridors, torch-lit far walls, props, and a grate down to the next floor.

## Tech
Three.js (bundled with esbuild into `game.js`). Animated low-poly characters share one rig and one animation set;
props are instanced per map chunk so off-screen parts are culled. Toon shading with the hero's light radius plus the nearest
torches, near walls cut down and a see-through circle around the hero, flow-field pathfinding. Save data lives in the browser (localStorage).
`?rs=1.5` forces a render scale; otherwise quality steps down automatically when frames run late.

Build: `npm install && npm run build`
Assets: `node tools/build-assets.mjs <path to the KayKit packs>` rebuilds `assets/*.glb` (merged skinned meshes, meshopt-compressed).

## Credits
3D models and animations: **KayKit** by Kay Lousberg (www.kaylousberg.com) — Character Pack: Skeletons, Character Pack: Adventurers,
Dungeon Remastered and Halloween Bits. Licensed CC0 1.0; thank you, Kay!
