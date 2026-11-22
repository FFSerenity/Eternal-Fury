// Shared game state and the save file
export const G = {
  units: [], corpses: [], shots: [], fx: [], enemies: [], friends: [], depth: 0, deep: 1, floor: null, player: null, t: 0,
  crypt: [], bag: [], loot: [], ghosts: [], bolts: [], clouds: [], level: 1, xp: 0, uid: 1, msgs: [],
};
const KEY = 'graveTamerSave';
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, level: G.level, xp: G.xp, depth: G.deep, uid: G.uid,
      crypt: G.crypt.map(c => ({ id: c.id, type: c.type, level: c.level, xp: c.xp, mods: c.mods, champ: c.champ, active: c.active, sp: c.sp || 0, skills: c.skills || {}, gear: c.gear || {} })), bag: G.bag }));
  } catch (e) {}
}
export function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!d) return false;
    G.level = d.level || 1; G.xp = d.xp || 0; G.deep = d.depth || 1; G.depth = 0; G.uid = d.uid || 1;
    G.crypt = (d.crypt || []).map(c => Object.assign({ reviveT: 0, unit: null, sp: 0, skills: {}, gear: {} }, c)); G.bag = d.bag || []; return true; } catch (e) { return false; }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }
