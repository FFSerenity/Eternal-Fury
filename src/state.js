// Shared game state and the save file
import { BAG_MAX } from './data.js';
export const G = {
  units: [], corpses: [], shots: [], fx: [], enemies: [], friends: [], depth: 0, deep: 1, floor: null, player: null, t: 0,
  crypt: [], bag: [], furn: [], loot: [], ghosts: [], bolts: [], clouds: [], level: 1, xp: 0, uid: 1, msgs: [],
};
const KEY = 'graveTamerSave';
export function save() {
  if (G.noSave) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, level: G.level, xp: G.xp, depth: G.deep, uid: G.uid,
      crypt: G.crypt.map(c => ({ id: c.id, type: c.type, level: c.level, xp: c.xp, mods: c.mods, modLv: c.modLv || {}, champ: c.champ, active: c.active, sp: c.sp || 0, skills: c.skills || {}, gear: c.gear || {} })), bag: G.bag, furn: G.furn }));
  } catch (e) {}
}
export function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!d) return false;
    G.level = d.level || 1; G.xp = d.xp || 0; G.deep = d.depth || 1; G.depth = 0; G.uid = d.uid || 1;
    G.crypt = (d.crypt || []).map(c => Object.assign({ reviveT: 0, unit: null, sp: 0, skills: {}, gear: {} }, c)); G.bag = []; for (const it of d.bag || []) bagPut(it, it.pos); G.furn = d.furn || []; return true; } catch (e) { return false; }
}
export function wipe() { G.noSave = true; try { localStorage.removeItem(KEY); } catch (e) {} }
// bag = 40 cells, one item per cell (it.pos); bagPut finds a free cell (or uses the wanted one if free)
export function bagFree() { const used = new Set(G.bag.map(i => i.pos)); for (let p = 0; p < BAG_MAX; p++) if (!used.has(p)) return p; return -1; }
export function bagPut(it, want) { const used = new Set(G.bag.map(i => i.pos)); const p = want != null && want >= 0 && want < BAG_MAX && !used.has(want) ? want : bagFree(); if (p < 0) return false; it.pos = p; G.bag.push(it); return true; }
