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

## Monsters
Brute (telegraphed smash, knock-back), Imp packs (panic and flee when a packmate dies), Skeleton archers (kite and strafe),
Shamans (fireballs, resurrect fallen allies). Champions get an affix and an aura ring. Packs alert each other; hard hits stagger.

## Tech
Three.js (bundled with esbuild into `game.js`), low-poly toon shading with a torch light radius, walls that turn see-through
in front of the hero, flow-field pathfinding, random rooms-and-corridors floors. Save data lives in the browser (localStorage).
`?rs=1.5` forces a render scale; otherwise quality steps down automatically when frames run late.

Build: `npm install && npm run build`
