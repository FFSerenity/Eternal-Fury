import * as THREE from 'three';
import { PropBatch } from './assets.js';
import { addBox } from './loot.js';
import { toonMat } from './gfx.js';
import { LEAF, tint } from './forest.js';

// ---------- the wilds: an open, generated stretch of haunted country around the graveyard camp ----------
// genWilds lays it out (the grid, what stands where, where monsters wait); buildWilds turns that into props.
// The camp clearing keeps its old place (cells 8..31); the wilds wrap around it to the east and south (toward the camera),
// reached through two gates in the camp fence. Everything is generated anew each time the camp is entered.

// smooth value noise: random values on a lattice every `cell` units, eased in between (x, z >= 0)
export function valueNoise(R, W, H, cell) {
  const nx = Math.ceil(W / cell) + 3, nz = Math.ceil(H / cell) + 3, v = new Float32Array(nx * nz); for (let i = 0; i < v.length; i++) v[i] = R();
  return (x, z) => { const fx = Math.min(W, Math.max(0, x)) / cell, fz = Math.min(H, Math.max(0, z)) / cell, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    const a = v[iz * nx + ix], b = v[iz * nx + ix + 1], c = v[(iz + 1) * nx + ix], d = v[(iz + 1) * nx + ix + 1]; return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz; };
}

export const WILD = { W: 120, M: 4, camp: 33, cx: 20, cz: 20 }; // map size, border margin, the camp quadrant (x < 33 && z < 33), the camp's middle
export const inCamp = (x, z) => x < 32.5 && z < 32.5;
// what stands on a blocked wild cell
export const K = { GROVE: 1, TREE: 2, ROCK: 3, RUIN: 4, GRAVE: 5, POI: 6, CRAG: 7 };

export function genWilds(F, R) {
  const W = F.W, H = F.H, g = F.g, M = WILD.M, kd = F.kd = new Uint8Array(W * H), pathM = F.pathM = new Uint8Array(W * H);
  const P = F.wprops = [], L = F.wlights = []; // placements { n, x, y, z, r, s, ys } and lights { x, y, z, col, size, op, torch }
  const isWild = (x, z) => x >= M && z >= M && x < W - M && z < H - M && !(x < WILD.camp && z < WILD.camp);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (isWild(x, z)) g[z * W + x] = 1;
  // gates through the camp fence (east and south): 4 cells wide
  F.gates = [{ x: 32, z: 20, rot: Math.PI / 2, cells: [[32, 18], [32, 19], [32, 20], [32, 21]] }, { x: 24, z: 32, rot: 0, cells: [[22, 32], [23, 32], [24, 32], [25, 32]] }];
  for (const gt of F.gates) for (const [x, z] of gt.cells) g[z * W + x] = 1;
  const block = (x, z, k) => { if (x < 0 || z < 0 || x >= W || z >= H) return; const i = z * W + x; if (g[i] === 1) { g[i] = 2; kd[i] = k; } };
  const put = (n, x, z, r = 0, s = 0.5, ys, y = 0) => P.push({ n, x, y, z, r, s, ys });
  const tile = (X, Z) => { const k = R(); put(k < 0.6 ? 'floor_tile_small' : k < 0.75 ? 'floor_tile_small_broken_A' : k < 0.9 ? 'floor_tile_small_broken_B' : 'floor_tile_small_weeds_A', X + 0.5, Z + 0.5, Math.floor(R() * 4) * Math.PI / 2, 0.5, undefined, 0.045); };
  const fromCamp = (x, z) => Math.hypot(x - WILD.cx, z - WILD.cz);

  // ---- places worth finding: ruins, an old graveyard, a shrine, a pumpkin patch (cleared of trees, each guarded by an elite pack)
  const TYPES = ['ruins', 'graves', 'shrine', 'pumpkins', 'ruins', 'graves', 'ruins', 'shrine', 'pumpkins'];
  const pois = F.pois = [];
  for (let t = 0; t < 800 && pois.length < TYPES.length; t++) {
    const x = M + 9 + R() * (W - 2 * M - 18), z = M + 9 + R() * (H - 2 * M - 18);
    if (!isWild(Math.floor(x), Math.floor(z)) || fromCamp(x, z) < 32 || pois.some(p => Math.hypot(p.x - x, p.z - z) < 21)) continue;
    pois.push({ x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5, type: TYPES[pois.length], r: 5.5 });
  }
  // ---- winding dirt paths: the two gates and the places, joined by a spanning tree plus a couple of loops
  const nodes = [{ x: 32.5, z: 20 }, { x: 24, z: 32.5 }, ...pois], edges = [], inT = [0, 1];
  while (inT.length < nodes.length) { let best = null;
    for (const a of inT) for (let b = 0; b < nodes.length; b++) if (!inT.includes(b)) { const d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); if (!best || d < best[2]) best = [a, b, d]; }
    inT.push(best[1]); edges.push(best); }
  for (let k = 0; k < 3 && nodes.length > 3; k++) { const a = 2 + Math.floor(R() * (nodes.length - 2)), b = Math.floor(R() * nodes.length); if (a !== b) edges.push([a, b]); }
  const wob = valueNoise(R, W, H, 9), inPoi = (x, z, pad = 0) => pois.some(p => Math.hypot(p.x - x, p.z - z) < p.r + pad);
  for (const [a, b] of edges) { const A = nodes[a], B = nodes[b], len = Math.hypot(B.x - A.x, B.z - A.z), nx = -(B.z - A.z) / len, nz = (B.x - A.x) / len;
    for (let t = 0; t <= len; t += 0.35) { const k = t / len, bx = A.x + (B.x - A.x) * k, bz = A.z + (B.z - A.z) * k, off = (wob(bx, bz) - 0.5) * 9 * Math.sin(Math.PI * k), px = bx + nx * off, pz = bz + nz * off;
      if (inPoi(px, pz, -1.5)) continue;
      for (const [dx, dz] of [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) { const X = Math.floor(px + dx), Z = Math.floor(pz + dz); if (X >= 0 && Z >= 0 && X < W && Z < H && g[Z * W + X] === 1 && !inCamp(X + 0.5, Z + 0.5)) pathM[Z * W + X] = 1; } } }

  // ---- the places themselves
  for (const p of pois) {
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    if (p.type === 'ruins') { // a roofless hall: crumbling walls with pillars at the corners and at least two ways in, cracked flagstones, a chest in the middle
      const hw = 3 + (R() < 0.5 ? 1 : 0), hh = 3 + (R() < 0.5 ? 1 : 0), open = [0, 1, 2, 3].map(() => R() < 0.35), a = Math.floor(R() * 4); open[a] = true; open[(a + 1 + Math.floor(R() * 3)) % 4] = true;
      for (let x = -hw; x <= hw; x++) for (let z = -hh; z <= hh; z++) { const X = cx + x, Z = cz + z, edge = Math.abs(x) === hw || Math.abs(z) === hh;
        if (!edge) { if (R() < 0.85) tile(X, Z); continue; }
        if (Math.abs(x) === hw && Math.abs(z) === hh) { block(X, Z, K.RUIN); put('pillar', X + 0.5, Z + 0.5, 0, 0.5, 0.22 + R() * 0.3); continue; }
        const side = x === -hw ? 0 : x === hw ? 1 : z === -hh ? 2 : 3, along = side < 2 ? z : x;
        if (open[side] && Math.abs(along) <= 1) { if (R() < 0.5) tile(X, Z); continue; }
        if (R() < 0.1) continue; // fallen away
        block(X, Z, K.RUIN);
        if (R() < 0.15) { const r = R() * 6.28; put('rubble_half', X + 0.5 - Math.cos(r) * 0.6, Z + 0.5 + Math.sin(r) * 0.6, r, 0.3); continue; }
        // wall_half runs 1 m along its +x from its origin: turned -90° it runs along +z
        if (side < 2) put('wall_half', X + 0.5, Z, -Math.PI / 2, 0.5, 0.1 + R() * 0.26); else put('wall_half', X, Z + 0.5, 0, 0.5, 0.1 + R() * 0.26); }
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (R() < 0.5) { put('column', cx + x + 0.5, cz + z + 0.5, 0, 0.5, 0.5 + R() * 0.4); block(cx + x, cz + z, K.RUIN); }
      put('chest', cx + 0.5, cz + 0.5, Math.floor(R() * 4) * Math.PI / 2, 0.5); block(cx, cz, K.RUIN);
      for (let k = 0; k < 3; k++) { const r = R() * 6.28; put('rubble_half', cx + 0.5 + (R() - 0.5) * (hw * 2 + 3), cz + 0.5 + (R() < 0.5 ? -1 : 1) * (hh + 1.5 + R()), r, 0.22); }
      put('candle_triple', cx + 1.2, cz + 0.4, R() * 6.28, 0.5); L.push({ x: cx + 1.2, y: 0.45, z: cz + 0.4, col: 0xffa040, size: 1.1, op: 0.8, torch: 4.5 });
    } else if (p.type === 'graves') { // a fenced plot of old graves, open on at least two sides, lanterns in two corners
      const hs = 4, open = [0, 1, 2, 3].map(() => R() < 0.3), a = Math.floor(R() * 4); open[a] = true; open[(a + 2) % 4] = true;
      for (let t = -hs; t < hs; t += 2) { const mid = t === -2 || t === 0;
        [[cx + t + 1, cz - hs, 0, 0], [cx + t + 1, cz + hs, 0, 1], [cx - hs, cz + t + 1, Math.PI / 2, 2], [cx + hs, cz + t + 1, Math.PI / 2, 3]].forEach(([x, z, r, s]) => {
          if (mid && open[s]) return;
          put(R() < 0.35 ? 'fence_broken' : 'fence', x, z, r, 0.5); const vert = r !== 0;
          for (const k of [-1, 0]) block(vert ? Math.floor(x) - (s === 3 ? 1 : 0) : Math.floor(x + k), vert ? Math.floor(z + k) : Math.floor(z) - (s === 1 ? 1 : 0), K.POI); }); }
      for (const [x, z] of [[cx - hs, cz - hs], [cx + hs, cz - hs], [cx - hs, cz + hs], [cx + hs, cz + hs]]) put('fence_pillar', x, z, 0, 0.5);
      const GR = ['grave_A', 'grave_B', 'gravestone', 'gravemarker_A', 'gravemarker_B', 'grave_A_destroyed'];
      for (let z = -2; z <= 2; z += 2) for (let x = -2; x <= 2; x += 2) { if (R() < 0.2 || (x === 0 && z === 0)) continue; const X = cx + x, Z = cz + z;
        put(GR[Math.floor(R() * GR.length)], X + 0.5, Z + 0.5, (R() - 0.5) * 0.3, 0.5); block(X, Z, K.GRAVE); }
      put('shrine_candles', cx + 0.5, cz + 0.5, R() * 6.28, 0.5); block(cx, cz, K.POI); L.push({ x: cx + 0.5, y: 0.8, z: cz + 0.5, col: 0xffc060, size: 1.3, op: 0.8, torch: 4.5 });
      for (const [x, z] of [[cx - hs + 1, cz - hs + 1], [cx + hs - 1, cz + hs - 1]]) { put('lantern_standing', x, z, 0, 0.6); L.push({ x, y: 0.4, z, col: 0xffb050, size: 1.0, op: 0.85, torch: 0 }); }
    } else if (p.type === 'shrine') { // a candle-lit shrine under a decorated dead tree
      put('shrine', cx + 0.5, cz + 0.5, R() * 6.28, 0.7); block(cx, cz, K.POI);
      put('tree_dead_large_decorated', cx - 2, cz - 1.5, R() * 6.28, 0.6); block(cx - 3, cz - 2, K.POI); block(cx - 2, cz - 2, K.POI);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + R() * 0.3, d = 1.6 + R() * 0.4; put(k % 2 ? 'candle_melted' : 'skull_candle', cx + 0.5 + Math.cos(a) * d, cz + 0.5 + Math.sin(a) * d, R() * 6.28, 0.45); }
      put('plaque_candles', cx + 2.5, cz + 2.5, R() * 6.28, 0.5); block(cx + 2, cz + 2, K.POI);
      L.push({ x: cx + 0.5, y: 1.0, z: cz + 0.5, col: 0xffc060, size: 2.0, op: 0.9, torch: 6 });
    } else { // pumpkins: a patch of them, some carved and glowing, a lantern post at the edge
      for (let k = 0; k < 24; k++) { const a = R() * Math.PI * 2, d = 0.8 + R() * (p.r - 1), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, carved = R() < 0.3;
        put(carved ? (R() < 0.5 ? 'pumpkin_orange_jackolantern' : 'pumpkin_yellow_jackolantern') : 'pumpkin_yellow_small', x, z, R() * 6.28, 0.5);
        if (carved) { block(Math.floor(x), Math.floor(z), K.POI); if (k % 2) L.push({ x, y: 0.35, z, col: 0xff9a30, size: 0.9, op: 0.7, torch: 0 }); } }
      put('post_lantern', p.x, p.z - 3, 0, 0.5); block(Math.floor(p.x), Math.floor(p.z - 3), K.POI); L.push({ x: p.x, y: 1.45, z: p.z - 2.4, col: 0xffb050, size: 1.2, op: 0.9, torch: 5.2 });
    }
  }
  // ---- lantern posts here and there beside the paths
  const lamps = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const i = z * W + x; if (!pathM[i] || R() > 0.05) continue;
    if (lamps.some(l => Math.hypot(l.x - x, l.z - z) < 15) || F.gates.some(gt => Math.hypot(gt.x - x, gt.z - z) < 6) || inPoi(x, z, 2)) continue;
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => { const j = (z + dz) * W + x + dx; return g[j] === 1 && !pathM[j]; }); if (!side) continue;
    const X = x + side[0], Z = z + side[1], r = Math.atan2(-side[0], -side[1]); block(X, Z, K.POI); lamps.push({ x, z });
    put('post_lantern', X + 0.5, Z + 0.5, r, 0.5); L.push({ x: X + 0.5 + Math.sin(r) * 0.6, y: 1.45, z: Z + 0.5 + Math.cos(r) * 0.6, col: 0xffb050, size: 1.2, op: 0.9, torch: 5.2 }); }

  // ---- crags: big rock outcrops standing alone in the open, something to fight around
  const crags = F.crags = [], CR = [['Rock_1_J', 1.6], ['Rock_1_K', 1.6], ['Rock_2_E', 1.5], ['Rock_2_G', 1.5], ['Rock_3_M', 1.6]];
  const nearPath = (x, z, d) => { for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) { const X = x + dx, Z = z + dz; if (X >= 0 && Z >= 0 && X < W && Z < H && pathM[Z * W + X]) return true; } return false; };
  for (let t = 0; t < 400 && crags.length < 12; t++) { const x = M + 4 + Math.floor(R() * (W - 2 * M - 8)), z = M + 4 + Math.floor(R() * (H - 2 * M - 8));
    if (!isWild(x, z) || fromCamp(x, z) < 26 || inPoi(x, z, 4) || nearPath(x, z, 3) || crags.some(c => Math.hypot(c.x - x, c.z - z) < 14)) continue;
    const [n, rr] = CR[Math.floor(R() * CR.length)], s = 0.5 * (0.8 + R() * 0.4), rad = rr * s / 0.5, c = { n, x: x + 0.5, z: z + 0.5, r: R() * 6.28, s }; crags.push(c);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dz) <= rad - 0.35) block(x + dx, z + dz, K.CRAG); }
  // ---- trees: groves where the noise is high (thicker toward the map edge and along the camp fence), lone trees and rocks elsewhere
  const tn = valueNoise(R, W, H, 11), tn2 = valueNoise(R, W, H, 4.5);
  const nearGate = (x, z) => F.gates.some(gt => Math.hypot(gt.x - x, gt.z - z) < 6);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const i = z * W + x; if (g[i] !== 1 || inCamp(x + 0.5, z + 0.5)) continue;
    const cx = x + 0.5, cz = z + 0.5; if (pathM[i] || nearGate(cx, cz) || inPoi(cx, cz, 1.5)) continue;
    const edgeD = Math.min(x - M, z - M, W - M - 1 - x, H - M - 1 - z), band = (x < 36 && z < 33) || (z < 36 && x < 33);
    const t = tn(cx, cz) * 0.72 + tn2(cx, cz) * 0.28 + (edgeD < 3 ? 0.3 - edgeD * 0.1 : 0) + (band ? 0.3 : 0);
    if (t > 0.62) { g[i] = 2; kd[i] = K.GROVE; } else if (t > 0.48 && R() < 0.1) { g[i] = 2; kd[i] = K.TREE; } else if (R() < 0.006) { g[i] = 2; kd[i] = K.ROCK; } }

  // ---- everything walkable must be reachable from the camp: big cut-off pockets get a way cut through the trees, small ones fill in
  const sx = Math.floor(F.start.cx), sz = Math.floor(F.start.cy), cuttable = j => g[j] === 2 && kd[j] >= K.GROVE && kd[j] <= K.ROCK;
  for (let pass = 0; pass < 16; pass++) {
    F.lab = null; F.labelRegions(); const lab = F.lab, main = lab[sz * W + sx], sizes = new Map();
    for (let i = 0; i < W * H; i++) if (lab[i] >= 0 && lab[i] !== main) sizes.set(lab[i], (sizes.get(lab[i]) || 0) + 1);
    if (!sizes.size) break;
    for (const [r, n] of sizes) {
      if (n < 30) { for (let i = 0; i < W * H; i++) if (lab[i] === r) { g[i] = 2; kd[i] = K.GROVE; pathM[i] = 0; } continue; }
      // breadth-first through trees and rocks until the camp's area is reached, then clear that way (2 wide where it can)
      const prev = new Int32Array(W * H).fill(-2), q = []; for (let i = 0; i < W * H; i++) if (lab[i] === r) { prev[i] = -1; q.push(i); }
      let hit = -1; for (let h = 0; h < q.length && hit < 0; h++) { const i = q[h], x = i % W, z = (i / W) | 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X; if (prev[j] !== -2) continue;
          if (!(g[j] === 1 || cuttable(j))) continue; prev[j] = i; if (lab[j] === main) { hit = j; break; } q.push(j); } }
      for (let i = hit; i >= 0; i = prev[i]) { if (g[i] === 2) { g[i] = 1; kd[i] = 0; } const j = i + 1; if (j % W && cuttable(j)) { g[j] = 1; kd[j] = 0; } }
    }
  }
  for (let i = 0; i < W * H; i++) if (g[i] !== 1) pathM[i] = 0;
  F.lab = null; F.fields.clear(); F.nw = null;

  // ---- where the monster packs wait: spread over the wilds, none close to the camp; each of the places gets one too
  const spots = F.packSpots = [];
  for (const p of pois) { const s = F.nearestWalk(p.x, p.z + (p.type === 'ruins' ? 0 : 2.2)); spots.push({ x: s.x, z: s.z, poi: p.type, d: fromCamp(s.x, s.z) }); }
  let walkN = 0; for (let i = 0; i < W * H; i++) if (g[i] === 1 && !inCamp(i % W + 0.5, ((i / W) | 0) + 0.5)) walkN++;
  const want = spots.length + Math.round(walkN / 190);
  for (let t = 0; t < 5000 && spots.length < want; t++) { const x = M + 1 + R() * (W - 2 * M - 2), z = M + 1 + R() * (H - 2 * M - 2);
    if (!F.fits(x, z, 0.45) || fromCamp(x, z) < 30 || spots.some(s => Math.hypot(s.x - x, s.z - z) < 8)) continue;
    spots.push({ x, z, d: fromCamp(x, z) }); }
}

// ---------- props for the wilds (KayKit Forest Nature Pack + Halloween Bits), and the ground they stand on ----------
const GRASS = ['Grass_1_B_Singlesided', 'Grass_1_C_Singlesided', 'Grass_2_B_Singlesided', 'Grass_2_C_Singlesided'], TUFTS = ['Grass_1_B_Singlesided', 'Grass_2_B_Singlesided', 'Grass_1_B_Singlesided', 'Grass_2_B_Singlesided', 'Grass_1_C_Singlesided'];
const pick = (R, a) => a[Math.floor(R() * a.length)];
export function buildWilds(F, B, grp) {
  const W = F.W, H = F.H, g = F.g, kd = F.kd, R = F.R, M = WILD.M, pathM = F.pathM;
  const fo = { tex: 'forest', leaf: true, cut: true }, FO = { all: fo }; for (const n of GRASS) FO[n] = { tex: 'forest', leaf: true, ds: true };
  const FB = new PropBatch(FO);
  // distance (cells, 8-way) from ground anyone can walk on: trees beyond the edge only where they can be seen
  const dw = new Uint8Array(W * H).fill(255), q = []; for (let i = 0; i < W * H; i++) if (g[i] === 1) { dw[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, z = (i / W) | 0; if (dw[i] >= 9) continue;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X; if (dw[j] > dw[i] + 1) { dw[j] = dw[i] + 1; q.push(j); } } }
  const dwAt = (x, z) => { const X = Math.min(W - 1, Math.max(0, Math.floor(x))), Z = Math.min(H - 1, Math.max(0, Math.floor(z))); return dw[Z * W + X] + Math.max(0, -x, -z, x - W + 1, z - H + 1); };
  // bare ground: the paths, around the places and the gates, the camp (distance in cells from those, for the ground colour and what grows)
  const dd = new Float32Array(W * H).fill(9), dq = [];
  const src = (x, z) => { if (x < 0 || z < 0 || x >= W || z >= H) return; const i = z * W + x; if (dd[i]) { dd[i] = 0; dq.push(i); } };
  for (let i = 0; i < W * H; i++) if (pathM[i]) src(i % W, (i / W) | 0);
  for (const p of F.pois) { const r = p.type === 'shrine' ? 3.5 : p.r + (p.type === 'pumpkins' ? 0 : 0.5); for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) if (Math.hypot(dx, dz) <= r) src(Math.floor(p.x) + dx, Math.floor(p.z) + dz); }
  for (const gt of F.gates) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) src(gt.x + dx, gt.z + dz);
  for (let z = 6; z < 34; z++) for (let x = 6; x < 34; x++) src(x, z);
  for (let h = 0; h < dq.length; h++) { const i = dq[h], x = i % W, z = (i / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= W || Z >= H) continue; const j = Z * W + X, nd = dd[i] + (dx && dz ? 1.41 : 1); if (nd < dd[j] && nd < 6) { dd[j] = nd; dq.push(j); } } }
  const n1 = valueNoise(R, W + 20, H + 20, 7), n2 = valueNoise(R, W + 20, H + 20, 13), n3 = valueNoise(R, W + 20, H + 20, 3);
  const ddAt = (x, z) => { const X = Math.min(W - 1, Math.max(0, Math.floor(x))), Z = Math.min(H - 1, Math.max(0, Math.floor(z))); return dd[Z * W + X]; };
  const bare = (x, z) => 1 - Math.min(1, Math.max(0, (ddAt(x, z) + (n3(x + 10, z + 10) - 0.5) * 1.6 - 0.4) / 1.8)); // 1 on bare dirt, 0 on grass
  const dryAt = (x, z) => Math.min(1, Math.max(0, (n2(x + 10, z + 10) - 0.55) * 3));
  // the ground: one vertex-coloured sheet (grass, darker under the trees, dry patches, dirt where people walk) — no more gravel everywhere
  { const G1 = [0.40, 0.52, 0.31], G2 = [0.33, 0.47, 0.34], DRY = [0.56, 0.54, 0.33], FLOOR = [0.29, 0.37, 0.27], DIRT = [0.47, 0.39, 0.31];
    const x0 = -8, n = W + 17, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), idx = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = x0 + i, z = x0 + j, v = j * n + i, a = n1(x + 10, z + 10), d = dryAt(x, z), b = bare(x, z);
      let c = G1.map((c1, k) => c1 + (G2[k] - c1) * a); c = c.map((c1, k) => c1 + (DRY[k] - c1) * d * 0.8);
      const X = Math.floor(x), Z = Math.floor(z), tr = X >= 0 && Z >= 0 && X < W && Z < H ? (g[Z * W + X] !== 1 && (kd[Z * W + X] === K.GROVE || !g[Z * W + X]) ? 1 : 0) : 1; c = c.map((c1, k) => c1 + (FLOOR[k] - c1) * tr * 0.55);
      c = c.map((c1, k) => c1 + (DIRT[k] - c1) * b); const jt = 1 + (R() - 0.5) * 0.09;
      pos.set([x, 0.035, z], v * 3); nor.set([0, 1, 0], v * 3); col.set([c[0] * jt, c[1] * jt, c[2] * jt], v * 3);
      if (i < n - 1 && j < n - 1) idx.push(v, v + n, v + 1, v + 1, v + n, v + n + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, toonMat({ vc: true })); m.frustumCulled = false; grp.add(m); }
  // what grows where: three kinds of woods by a slow noise (dead / autumn / dark green), each tree's leaves tinted a little differently
  const bn = valueNoise(R, W, H, 17), biome = (x, z) => { const b = bn(x, z) + (R() - 0.5) * 0.12; return b < 0.34 ? 0 : b < 0.58 ? 1 : 2; };
  const LEAVES = [[LEAF.moss, LEAF.dry], [LEAF.orange, LEAF.red, LEAF.gold, LEAF.orange], [LEAF.green, LEAF.teal, LEAF.green, LEAF.moss]];
  const TREES = [['Tree_Bare_2_B', 'Tree_Bare_2_C', 'Tree_Bare_1_B', 'tree_dead_large', 'tree_dead_medium', 'Tree_Bare_2_A'], ['Tree_2_B', 'Tree_2_C', 'Tree_1_B', 'tree_pine_orange_large', 'tree_pine_yellow_medium', 'Tree_2_B'],
    ['Tree_4_A', 'Tree_4_B', 'Tree_1_A', 'Tree_4_B', 'Tree_2_B']];
  const BARE = ['Tree_Bare_1_B', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'Tree_Bare_2_B', 'tree_dead_large', 'tree_dead_medium', 'tree_dead_small'], BUSH = ['Bush_1_C', 'Bush_2_D', 'Bush_3_B', 'Bush_4_B'];
  const isF = n => /^(Tree|Bush|Grass|Rock)_/.test(n);
  const plant = (n, x, z, s, leaves) => { if (!isF(n)) return B.add(n, x, 0, z, R() * 6.28, s); FB.add(n, x, 0, z, R() * 6.28, s * (n.startsWith('Tree_') && !n.startsWith('Tree_Bare') ? 1.3 : n.startsWith('Tree_Bare') ? 1.15 : 1), null, null, leaves ? tint(leaves, R) : null); };
  const tree = (x, z, s, front) => { const b = biome(x, z), lv = pick(R, LEAVES[b]); plant(front ? pick(R, BARE) : pick(R, TREES[b]), x, z, s, lv); return b; };
  const nearCampFront = (x, z) => (x < 38 && z < 38) && !(x < 31 && z < 31); // just outside the camp fence (in front of the camera when inside)
  // a tree that stands between the camera and open ground (the camera looks from +x+z) gets a bare one, so it hides less of the fight behind it
  const hides = (x, z) => { for (let k = 1; k <= 3; k++) for (const [a, b] of [[k, k], [k, k - 1], [k - 1, k]]) { const X = x - a, Z = z - b; if (X >= 0 && Z >= 0 && g[Z * W + X] === 1) return true; } return false; };
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const i = z * W + x, k = kd[i]; if (g[i] !== 2 || !k || k > 3) continue;
    const cx = x + 0.5, cz = z + 0.5, front = hides(x, z) || nearCampFront(cx, cz);
    if (k === 1) { // grove: thick on the rim, thinner inside; bushes along the rim
      if (R() < (front ? 0.6 : dw[i] <= 1 ? 0.78 : 0.5)) tree(cx + (R() - 0.5) * 0.5, cz + (R() - 0.5) * 0.5, 0.5 * (0.78 + R() * 0.45), front);
      if (dw[i] <= 1 && R() < 0.45) { const b = biome(cx, cz); FB.add(pick(R, BUSH), cx + (R() - 0.5) * 0.6, 0, cz + (R() - 0.5) * 0.6, R() * 6.28, 0.5 * (1.1 + R() * 0.6), null, null, tint(pick(R, LEAVES[b]).map(v => v * 0.78), R)); } }
    else if (k === 2) { if (R() < 0.04 && !front) B.add('tree_dead_large_decorated', cx, 0, cz, R() * 6.28, 0.55); else tree(cx, cz, 0.5 * (0.85 + R() * 0.35), front); }
    else FB.add(pick(R, ['Rock_1_D', 'Rock_1_F', 'Rock_3_G', 'Rock_3_I']), cx, 0, cz, R() * 6.28, 0.5 * (0.8 + R() * 0.4)); }
  for (const c of F.crags) FB.add(c.n, c.x, 0, c.z, c.r, c.s);
  // the woods beyond the edges (the camp's back side keeps its pines; the front edges get sparse bare trees so they never wall off the view)
  for (let z = -3; z < H + 3; z += 2.3) for (let x = -3; x < W + 3; x += 2.3) { const jx = x + (R() - 0.5) * 1.6, jz = z + (R() - 0.5) * 1.6, X = Math.floor(jx), Z = Math.floor(jz);
    if (X >= 0 && Z >= 0 && X < W && Z < H && g[Z * W + X]) continue; const d = dwAt(jx, jz); if (d < (jx < 33 && jz < 33 ? 2 : 1) || d > 8) continue;
    if ((jx > 30.5 && jx < 34.5 && jz < 34.5) || (jz > 30.5 && jz < 34.5 && jx < 34.5)) continue; // the strip the camp fence stands on
    if (Math.abs(jx - 26) < 2.5 && jz < 8 && jz > 2) continue; // the camp's north gate looks out on a way into the woods
    const front = jz > H - M - 0.5 || jx > W - M - 0.5; if (R() < (front ? 0.5 : 0.15)) continue;
    if (jx < 33 && jz < 33) B.add(R() < 0.6 ? pick(R, ['tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_medium']) : pick(R, ['tree_dead_large', 'tree_dead_medium']), jx, 0, jz, R() * 6.28, 0.5 * (0.85 + R() * 0.35));
    else tree(jx, jz, 0.5 * (0.85 + R() * 0.35), front); }
  // dirt trails: worn stones here and there; pebbles along the trails and around the places
  for (let i = 0; i < W * H; i++) if (pathM[i] && R() < 0.55) B.add('path_' + 'ABCD'[Math.floor(R() * 4)], i % W + 0.5, 0.005, ((i / W) | 0) + 0.5, Math.floor(R() * 4) * Math.PI / 2, 0.5);
  // grass tufts on the grass, a few small bushes in the open, odds and ends lying about
  const BITS = ['bone_A', 'bone_B', 'bone_C', 'skull', 'pumpkin_yellow_small', 'candle_melted'];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const i = z * W + x, cx = x + 0.5, cz = z + 0.5; if (inCamp(cx, cz) && !(x > 31 || z > 31)) continue;
    const open = g[i] === 1, grove = g[i] === 2 && kd[i] === K.GROVE; if (!open && !grove) continue; const b = bare(cx, cz), dry = dryAt(cx, cz);
    if (b > 0.55) { if (open && R() < 0.1 * b) FB.add(pick(R, ['Rock_3_A', 'Rock_3_E', 'Rock_1_A', 'Rock_1_C']), x + R(), 0, z + R(), R() * 6.28, 0.18 + R() * 0.14); }
    else { const p = (grove ? 0.35 : dw[i] === 0 && x > 0 && (g[i - 1] === 2 || g[i + 1] === 2 || g[i - W] === 2 || g[i + W] === 2) ? 0.5 : 0.22) * (1 - b);
      for (let k = 0; k < 2; k++) if (R() < p) FB.add(pick(R, TUFTS), x + 0.15 + R() * 0.7, 0, z + 0.15 + R() * 0.7, R() * 6.28, 0.5 * (0.9 + R() * 0.6), null, null, tint(dry > 0.4 ? LEAF.dry : LEAF.grass, R, 0.1)); }
    if (open && b < 0.3 && R() < 0.008) FB.add(pick(R, ['Bush_1_C', 'Bush_4_B']), cx, 0, cz, R() * 6.28, 0.5 * (0.8 + R() * 0.4), null, null, tint(pick(R, LEAVES[biome(cx, cz)]).map(v => v * 0.78), R));
    if (open && !pathM[i] && R() < 0.01) { const n = pick(R, BITS); B.add(n, x + 0.2 + R() * 0.6, 0.03, z + 0.2 + R() * 0.6, R() * 6.28, n === 'skull' ? 0.35 : 0.5); } }
  // the places
  for (const p of F.wprops) { const it = B.add(p.n, p.x, p.y, p.z, p.r, p.s, p.ys); if (p.n === 'chest') addBox(F, p.n, p.x, p.z, it, null); } // (a ruin's chest opens: loot.js)
  for (const l of F.wlights) { F.glow(l.x, l.y, l.z, l.col, l.size, l.op); if (l.torch) F.torch(l.x, l.y + 0.2, l.z, l.torch); }
  // the gates in the camp fence
  for (const gt of F.gates) B.add('arch_gate_open', gt.rot ? 31.95 : gt.x, 0, gt.rot ? gt.z : 31.95, gt.rot, 0.9);
  FB.build(grp, 12);
}
