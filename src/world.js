// Random crypt floors: rooms joined by wide corridors, plus navigation (walkability, line of sight, cached flow fields)
import * as THREE from 'three';
import { glowSprite } from './gfx.js';
import { PropBatch } from './assets.js';
import { portalMesh } from './vfx.js';
import { genWilds, buildWilds, WILD } from './wilds.js';

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Floor {
  constructor(seed, depth, arena = false) {
    this.depth = depth; this.torches = []; this.fields = new Map();
    if (arena) { this.hall(rng(seed)); return; }
    if (depth === 0) { this.camp(rng(seed)); return; }
    this.amb = [0.30, 0.31, 0.44]; this.lightR = 8.5;
    const R = rng(seed), W = 60, H = 60; this.W = W; this.H = H;
    const g = this.g = new Uint8Array(W * H); // 0 void, 1 floor, 2 wall
    const rooms = this.rooms = [], ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    for (let tries = 0; tries < 300 && rooms.length < 13; tries++) {
      const w = ri(6, 12), h = ri(6, 11), x = ri(2, W - w - 3), y = ri(2, H - h - 3);
      if (rooms.some(r => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
      rooms.push({ x, y, w, h, cx: x + w / 2, cy: y + h / 2 });
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y * W + x] = 1;
    // connect rooms: minimum spanning tree + a couple of loops, 2-wide L corridors
    const inT = [0], edges = [];
    while (inT.length < rooms.length) { let best = null;
      for (const a of inT) for (let b = 0; b < rooms.length; b++) if (!inT.includes(b)) { const d = Math.hypot(rooms[a].cx - rooms[b].cx, rooms[a].cy - rooms[b].cy); if (!best || d < best[2]) best = [a, b, d]; }
      inT.push(best[1]); edges.push(best); }
    for (let k = 0; k < 2; k++) { const a = ri(0, rooms.length - 1), b = ri(0, rooms.length - 1); if (a !== b) edges.push([a, b, 0]); }
    const carve = (x, y) => { for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const X = x + dx, Y = y + dy; if (X > 0 && Y > 0 && X < W - 1 && Y < H - 1) g[Y * W + X] = 1; } };
    for (const [a, b] of edges) { const A = rooms[a], B = rooms[b]; let x = Math.floor(A.cx), y = Math.floor(A.cy); const tx = Math.floor(B.cx), ty = Math.floor(B.cy);
      const hFirst = R() < 0.5; if (hFirst) { while (x !== tx) { carve(x, y); x += Math.sign(tx - x); } while (y !== ty) { carve(x, y); y += Math.sign(ty - y); } }
      else { while (y !== ty) { carve(x, y); y += Math.sign(ty - y); } while (x !== tx) { carve(x, y); x += Math.sign(tx - x); } } carve(x, y); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g[y * W + x]) { let n = false;
      for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && g[Y * W + X] === 1) { n = true; break; } }
      if (n) g[y * W + x] = 2; }
    // start = first room, stairs = the room farthest by walking distance
    this.start = rooms[0]; const d0 = this.bfs(Math.floor(this.start.cx), Math.floor(this.start.cy)); let far = rooms[0], fd = -1;
    for (const r of rooms) { const d = d0[Math.floor(r.cy) * W + Math.floor(r.cx)]; if (d > fd && d < 1e8) { fd = d; far = r; } }
    this.end = far; this.stairs = { x: Math.floor(far.cx), z: Math.floor(far.cy) }; // a grid vertex: the grate covers the 4 cells around it
    this.R = R;
  }
  // ---------- the test arena (试炼场): one big walled hall, nothing in it; no way down (it is left from its panel) ----------
  hall(R) {
    const W = 44, H = 44, r = { x: 8, y: 8, w: 28, h: 28, cx: 22, cy: 22 }; this.W = W; this.H = H; this.R = R; this.amb = [0.40, 0.40, 0.54]; this.lightR = 10; this.arena = true;
    const g = this.g = new Uint8Array(W * H);
    for (let z = r.y - 1; z <= r.y + r.h; z++) for (let x = r.x - 1; x <= r.x + r.w; x++) g[z * W + x] = x < r.x || z < r.y || x >= r.x + r.w || z >= r.y + r.h ? 2 : 1;
    this.rooms = [r]; this.start = r; this.end = r; this.stairs = { x: -40, z: -40 }; // (off the map: the grate and its glow are built out of sight)
  }
  // ---------- the graveyard camp (start area): an open clearing with a crypt that leads down, inside a big generated stretch of wilds ----------
  camp(R) {
    const W = WILD.W, H = WILD.W; this.W = W; this.H = H; this.R = R; this.amb = [0.40, 0.44, 0.64]; this.lightR = 9.5;
    const g = this.g = new Uint8Array(W * H);
    for (let z = 8; z < 32; z++) for (let x = 8; x < 32; x++) g[z * W + x] = 1;
    // the crypt sits with its door centred on cell column 14, so the doorway on its plinth is one walkable cell
    const crypt = { x: 14.5, z: 12.4, s: 0.65 }; this.crypt = crypt;
    for (let z = 9; z <= 14; z++) for (let x = 12; x <= 16; x++) g[z * W + x] = 2;
    g[14 * W + 14] = 1;
    this.start = { x: 21, y: 22, w: 5, h: 5, cx: 23.5, cy: 24.5 }; this.rooms = [this.start]; this.end = this.start;
    this.stairs = { x: 14.5, z: 14.4 }; // the portal in the doorway
    genWilds(this, R);
  }
  // standing height: the crypt's plinth (0.26 high, front edge at z 15) under the doorway; 0 everywhere else
  lift(x, z) { const c = this.crypt; if (!c || Math.abs(x - c.x) > 0.7 || z < c.z) return 0; return 0.26 * Math.min(1, Math.max(0, (15.08 - z) / 0.3)); }
  walk(x, z) { const X = Math.floor(x), Z = Math.floor(z); return X >= 0 && Z >= 0 && X < this.W && Z < this.H && this.g[Z * this.W + X] === 1; }
  block(x, z) { const i = z * this.W + x; if (this.g[i] === 1) { this.g[i] = 3; this.fields.clear(); this.nw = null; this.lab = null; return true; } return false; }
  // connected walkable areas (8-way, same corner rule as the flow fields): a point in another area can never be walked to
  region(x, z) { if (!this.lab) this.labelRegions(); const X = Math.floor(x), Z = Math.floor(z); return X < 0 || Z < 0 || X >= this.W || Z >= this.H ? -1 : this.lab[Z * this.W + X]; }
  labelRegions() {
    const W = this.W, H = this.H, g = this.g, lab = this.lab = new Int32Array(W * H).fill(-1); let n = 0;
    for (let i = 0; i < W * H; i++) { if (g[i] !== 1 || lab[i] >= 0) continue; const q = [i]; lab[i] = n;
      while (q.length) { const j = q.pop(), x = j % W, z = (j / W) | 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Z = z + dz; if ((!dx && !dz) || X < 0 || Z < 0 || X >= W || Z >= H) continue; const k = Z * W + X;
          if (g[k] !== 1 || lab[k] >= 0 || (dx && dz && (g[z * W + X] !== 1 || g[Z * W + x] !== 1))) continue; lab[k] = n; q.push(k); } }
      n++; }
  }
  // a body of radius r can stand here (not squeezed against a wall it would never get past)
  fits(x, z, r = 0.3) { return this.walk(x, z) && this.walk(x + r, z) && this.walk(x - r, z) && this.walk(x, z + r) && this.walk(x, z - r); }
  // walking distance from (x,z) to every cell (cached for the cell we stand in)
  distFrom(x, z) { const X = Math.floor(x), Z = Math.floor(z), key = Z * this.W + X; if (!this.df || this.df.key !== key || this.df.lab !== this.lab) this.df = { key, lab: this.lab, D: this.bfs(X, Z) }; return this.df.D; }
  // hold-to-move: where to head for when pointing at (x,z) from (fx,fz).
  // - the point itself (or the first good point on the line back toward us) if a body fits there, it is in our area and the walk
  //   there isn't a long detour — pointing over a wall top or the void beside a corridor lands "behind" the wall on the ground,
  //   and walking the long way round to get there felt like the summoner stalling;
  // - otherwise keep heading toward the pointer: the longest free straight run from us in its direction (turned up to ±60° so we
  //   slide along walls); null when even that goes nowhere (keep going where we were going)
  moveTarget(x, z, fx, fz, detour = true) {
    if (!this.lab) this.labelRegions();
    const reg = this.region(fx, fz), ok = (px, pz) => this.fits(px, pz) && this.region(px, pz) === reg, D = this.distFrom(fx, fz);
    const near = (px, pz) => { const s = Math.hypot(px - fx, pz - fz), w = D[Math.floor(pz) * this.W + Math.floor(px)]; return !detour || w <= s * 1.5 + 2.5; };
    let cand = null;
    if (ok(x, z)) cand = { x, z };
    else { const dx = fx - x, dz = fz - z, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.15);
      for (let i = 1; i <= n; i++) { const px = x + dx * i / n, pz = z + dz * i / n; if (ok(px, pz)) { if (Math.hypot(px - fx, pz - fz) > 0.6) cand = { x: px, z: pz }; break; } } }
    if (cand && near(cand.x, cand.z)) return cand;
    // a free straight run from us toward the pointer
    const a0 = Math.atan2(x - fx, z - fz), want = Math.min(Math.hypot(x - fx, z - fz), 8); let best = null, bl = 0.6;
    for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) { const a = a0 + da, sx = Math.sin(a), sz = Math.cos(a); let L = 0;
      for (let t = 0.15; t <= want; t += 0.15) { if (!ok(fx + sx * t, fz + sz * t)) break; L = t; }
      const score = L * Math.cos(da); if (L > 0.6 && score > bl) { bl = score; best = { x: fx + sx * L, z: fz + sz * L }; } }
    if (best) return best;
    // boxed in that way: the nearest good spot around the pointer that brings us closer to it without a long detour (slides us along the wall)
    const X = Math.floor(x), Z = Math.floor(z), here = Math.hypot(x - fx, z - fz); let bd = 1e9;
    for (let r = 0; r <= 6 && !best; r++) for (let cz = Z - r; cz <= Z + r; cz++) for (let cx = X - r; cx <= X + r; cx++) { if (Math.max(Math.abs(cx - X), Math.abs(cz - Z)) !== r) continue;
      const px = cx + 0.5, pz = cz + 0.5, dd = Math.hypot(px - x, pz - z); if (!ok(px, pz) || !near(px, pz) || dd > here - 0.5) continue; if (dd < bd) { bd = dd; best = { x: px, z: pz }; } }
    return best;
  }
  // line of sight on the tile grid (also used for projectiles)
  los(ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.3); for (let i = 1; i < n; i++) if (!this.walk(ax + dx * i / n, az + dz * i / n)) return false; return true; }
  // nearest walkable point to (x, z) (spiral over cells, cached per cell)
  nearestWalk(x, z) {
    if (this.walk(x, z)) return { x, z }; const X = Math.floor(x), Z = Math.floor(z), key = Z * this.W + X; this.nw = this.nw || new Map(); const c = this.nw.get(key); if (c) return c;
    let best = null, bd = 1e9;
    for (let r = 1; r <= 12 && !best; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const cx = X + dx, cz = Z + dz; if (!this.walk(cx + 0.5, cz + 0.5)) continue; const px = Math.min(cx + 0.8, Math.max(cx + 0.2, x)), pz = Math.min(cz + 0.8, Math.max(cz + 0.2, z)), d = Math.hypot(px - x, pz - z);
      if (d < bd) { bd = d; best = { x: px, z: pz }; } }
    best = best || { x: this.start.cx, z: this.start.cy }; this.nw.set(key, best); return best;
  }
  // where a click on an unreachable spot should send the summoner: back along the line toward him to the first walkable point
  snapToward(x, z, fx, fz) {
    if (this.walk(x, z)) return { x, z }; const dx = fx - x, dz = fz - z, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.2);
    for (let i = 1; i <= n; i++) { const px = x + dx * i / n, pz = z + dz * i / n; if (this.walk(px, pz)) { const k = Math.min(1, (i * d / n + 0.35) / d); return { x: x + dx * k, z: z + dz * k }; } }
    return this.nearestWalk(x, z);
  }
  // a straight walk is only taken when a body of radius r fits along the whole line (stops units hugging corners)
  clear(ax, az, bx, bz, r = 0.36) { const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz) || 1, px = -dz / d * r, pz = dx / d * r;
    return this.los(ax, az, bx, bz) && this.los(ax + px, az + pz, bx + px, bz + pz) && this.los(ax - px, az - pz, bx - px, bz - pz); }
  bfs(tx, tz) {
    const W = this.W, H = this.H, D = new Float32Array(W * H).fill(1e9), q = new Int32Array(W * H); let h = 0, t = 0; const s = tz * W + tx; if (this.g[s] !== 1) return D;
    D[s] = 0; q[t++] = s; const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (h < t) { const i = q[h++], x = i % W, y = (i / W) | 0;
      for (const [dx, dy, c] of nb) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (this.g[j] !== 1) continue;
        if (dx && dy && (this.g[y * W + X] !== 1 || this.g[Y * W + x] !== 1)) continue; const nd = D[i] + c; if (nd < D[j]) { D[j] = nd; q[t++] = j; } } }
    return D;
  }
  // direction to walk from (x,z) toward (tx,tz): straight if visible, otherwise down a cached flow field
  // r: the walker's half width for the straight-line shortcut; flow: skip the shortcut (except within the target's own cell)
  dirTo(x, z, tx, tz, out, r = 0.36, flow = false) {
    if (!this.walk(tx, tz)) { const n = this.nearestWalk(tx, tz); tx = n.x; tz = n.z; }
    if (flow ? Math.floor(x) === Math.floor(tx) && Math.floor(z) === Math.floor(tz) : this.clear(x, z, tx, tz, r)) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz) || 1; out.x = dx / d; out.z = dz / d; return out; }
    const TX = Math.floor(tx), TZ = Math.floor(tz), key = TZ * this.W + TX; let f = this.fields.get(key);
    if (!f || G_T - f.t > 2) { f = { d: this.bfs(TX, TZ), t: G_T }; this.fields.set(key, f); if (this.fields.size > 40) this.fields.delete(this.fields.keys().next().value); }
    const D = f.d, X = Math.floor(x), Z = Math.floor(z), W = this.W; let best = D[Z * W + X], bx = 0, bz = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const j = (Z + dz) * W + X + dx; if (D[j] < best) {
      if (dx && dz && (this.g[Z * W + X + dx] !== 1 || this.g[(Z + dz) * W + X] !== 1)) continue; best = D[j]; bx = dx; bz = dz; } }
    if (!bx && !bz) { out.x = 0; out.z = 0; return out; }
    const cx = X + bx + 0.5 - x, cz = Z + bz + 0.5 - z, d = Math.hypot(cx, cz) || 1; out.x = cx / d; out.z = cz / d; return out;
  }
  // push a circle out of walls
  collide(u) {
    const r = u.r; for (let pass = 0; pass < 2; pass++) { const X = Math.floor(u.x), Z = Math.floor(u.z);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const tx = X + dx, tz = Z + dz; if (this.walk(tx + 0.5, tz + 0.5)) continue;
        const nx = Math.max(tx, Math.min(u.x, tx + 1)), nz = Math.max(tz, Math.min(u.z, tz + 1)), ddx = u.x - nx, ddz = u.z - nz, d = Math.hypot(ddx, ddz);
        if (d < r) { if (d > 1e-5) { u.x = nx + ddx / d * r; u.z = nz + ddz / d * r; } else { u.x = tx + 0.5 + (u.x < tx + 0.5 ? -1 : 1) * (0.5 + r); } } } }
  }
  randomSpot(room, R = this.R) { let p; for (let i = 0; i < 12; i++) { p = { x: room.x + 1 + R() * (room.w - 2), z: room.y + 1 + R() * (room.h - 2) }; if (this.walk(p.x, p.z)) break; } return p; }
  // ---------- meshes ----------
  build(scene) {
    const grp = new THREE.Group(); this.group = grp; this.glows = [];
    const under = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 4, this.H * 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: this.depth === 0 ? 0x0b0d12 : 0x07060a }));
    under.position.set(this.W / 2, -0.06, this.H / 2); grp.add(under);
    if (this.depth === 0) this.buildCamp(grp); else this.buildCrypt(grp);
    scene.add(grp); return grp;
  }
  glow(x, y, z, col, size, op) { const s = glowSprite(col, size, op); s.position.set(x, y, z); this.group.add(s); this.glows.push(s); return s; }
  torch(x, y, z, r = 4.5) { this.torches.push({ x, y, z, r, ph: Math.random() * 6.28 }); }
  buildCrypt(grp) {
    const W = this.W, H = this.H, g = this.g, R = this.R, isF = (x, z) => x >= 0 && z >= 0 && x < W && z < H && (g[z * W + x] === 1 || g[z * W + x] === 3);
    const CUT = { cut: true }, B = new PropBatch({ wall_half: CUT, pillar: CUT, torch_mounted: CUT, banner_red: CUT, banner_patternA_blue: CUT, rubble_half: CUT });
    const st = this.stairs, isStair = (x, z) => (x === st.x || x === st.x - 1) && (z === st.z || z === st.z - 1);
    const hsh = (x, z, k = 0) => { let h = (x * 374761393 + z * 668265263 + k * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    // props along room borders (they block movement) — never near doorways or the start / stairs
    const PROPS = [['barrel_small', 3], ['barrel_large', 2], ['box_small', 2], ['box_large', 2], ['crates_stacked', 1], ['chest', 0.6], ['keg', 1], ['trunk_large_A', 1], ['table_medium_broken', 0.7]];
    const pw = PROPS.reduce((a, p) => a + p[1], 0), pick = r => { let t = r * pw; for (const p of PROPS) { t -= p[1]; if (t <= 0) return p[0]; } return PROPS[0][0]; };
    for (const r of this.rooms) {
      const near = (x, z) => { for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Z = z + dz; if (isF(X, Z) && (X < r.x || X >= r.x + r.w || Z < r.y || Z >= r.y + r.h)) return true; } return false; };
      for (let z = r.y; z < r.y + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) {
        const edge = x === r.x || z === r.y || x === r.x + r.w - 1 || z === r.y + r.h - 1; if (!edge || R() > 0.16) continue;
        if (r === this.start || Math.hypot(x + 0.5 - st.x, z + 0.5 - st.z) < 3 || near(x, z)) continue;
        if (!this.block(x, z)) continue; const name = pick(R()), round = name.startsWith('barrel') || name === 'keg';
        B.add(name, x + 0.5 + (R() - 0.5) * 0.1, 0, z + 0.5 + (R() - 0.5) * 0.1, round ? R() * 6.28 : Math.floor(R() * 4) * Math.PI / 2 + (R() - 0.5) * 0.3, 0.5);
        if (R() < 0.25 && isF(x, z)) {} } }
    // floor tiles
    const FT = ['floor_tile_small', 'floor_tile_small', 'floor_tile_small', 'floor_tile_small', 'floor_tile_small', 'floor_tile_small_broken_A', 'floor_tile_small_broken_B', 'floor_tile_small_weeds_A', 'floor_dirt_small_A'];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { if (!isF(x, z) || isStair(x, z)) continue;
      const h = hsh(x, z), name = h < 0.78 ? 'floor_tile_small' : FT[5 + Math.floor((h - 0.78) / 0.22 * 4)]; B.add(name, x + 0.5, 0, z + 0.5, Math.floor(hsh(x, z, 1) * 4) * Math.PI / 2, 0.5);
      if (hsh(x, z, 2) < 0.025) B.add(['bone_A', 'bone_B', 'ribcage'][Math.floor(hsh(x, z, 3) * 3)], x + hsh(x, z, 4), 0.04, z + hsh(x, z, 5), hsh(x, z, 6) * 6.28, 0.5); }
    // walls on the edges between floor and wall cells: far walls (−x / −z of a floor cell) full height, near walls cut down so they never hide the action
    const V = new Map(), vk = (x, z) => x * 1000 + z, SH_Y = 0.05, TALL = 0.5;
    const edge = (vx, vz, dir, c, tall) => { for (const [x, z, d] of dir === 'x' ? [[vx, vz, 'E'], [vx + 1, vz, 'W']] : [[vx, vz, 'S'], [vx, vz + 1, 'N']]) {
      const k = vk(x, z); let e = V.get(k); if (!e) V.set(k, e = { x, z, d: new Set(), cx: null, cz: null, tall: false }); e.d.add(d); if (dir === 'x') e.cz = c; else e.cx = c; e.tall = e.tall || tall; } };
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { if (g[z * W + x] !== 2) continue;
      if (isF(x + 1, z)) { const X = x + 0.75; B.add('wall_half', X, 0, z, -Math.PI / 2, 0.5); edge(x + 1, z, 'z', X, true); this.wallDeco(B, x + 1, z + 0.5, Math.PI / 2, hsh(x, z, 7)); }
      if (isF(x - 1, z)) { const X = x + 0.25; B.add('wall_half', X, 0, z, -Math.PI / 2, 0.5, SH_Y); edge(x, z, 'z', X, false); }
      if (isF(x, z + 1)) { const Z = z + 0.75; B.add('wall_half', x, 0, Z, 0, 0.5); edge(x, z + 1, 'x', Z, true); this.wallDeco(B, x + 0.5, z + 1, 0, hsh(x, z, 8)); }
      if (isF(x, z - 1)) { const Z = z + 0.25; B.add('wall_half', x, 0, Z, 0, 0.5, SH_Y); edge(x, z, 'x', Z, false); } }
    for (const e of V.values()) { const d = e.d, straight = d.size === 2 && ((d.has('E') && d.has('W')) || (d.has('N') && d.has('S')));
      if (straight && hsh(e.x, e.z, 9) > 0.2) continue; B.add('pillar', e.cx ?? e.x, 0, e.cz ?? e.z, 0, 0.5, e.tall ? TALL * 1.04 : SH_Y * 1.3); }
    // stairs down: an open grate glowing from below
    B.add('floor_tile_big_grate_open', st.x, 0, st.z, 0, 0.5);
    this.stairsGlow = this.glow(st.x, 0.25, st.z, 0x6fb6ff, 3.2, 0.7); this.glow(st.x, -0.2, st.z, 0x3f7fff, 1.8, 0.9);
    this.torches.push({ x: st.x, y: 0.3, z: st.z, r: 2.6, ph: 0 });
    B.build(grp);
  }
  // torch or banner on a far wall face at (fx, fz); rot: 0 faces +z, PI/2 faces +x
  wallDeco(B, fx, fz, rot, h) {
    const ox = Math.sin(rot), oz = Math.cos(rot);
    if (h < 0.3 && !this.torches.some(t => Math.abs(t.x - fx) + Math.abs(t.z - fz) < 3.2)) { B.add('torch_mounted', fx, 1.0, fz, rot, 0.5); this.glow(fx + ox * 0.22, 1.42, fz + oz * 0.22, 0xffa040, 1.0, 0.95); this.torch(fx + ox * 0.6, 1.3, fz + oz * 0.6, 4.6); }
    else if (h > 0.9) B.add(h > 0.95 ? 'banner_red' : 'banner_patternA_blue', fx, 0, fz, rot, 0.5);
  }
  buildCamp(grp) {
    const W = this.W, H = this.H, g = this.g, R = this.R;
    const CUT = { cut: true }, B = new PropBatch({ crypt: CUT, fence: CUT, fence_broken: CUT, fence_pillar: CUT, arch_gate: CUT, arch_gate_open: CUT, post_lantern: CUT, post_skull: CUT,
      tree_dead_large: CUT, tree_dead_medium: CUT, tree_dead_small: CUT, tree_pine_orange_large: CUT, tree_pine_orange_medium: CUT, tree_pine_yellow_medium: CUT,
      tree_pine_yellow_large: CUT, tree_pine_orange_small: CUT, tree_pine_yellow_small: CUT, tree_dead_large_decorated: CUT, wall_half: CUT, pillar: CUT, column: CUT, shrine: CUT, rubble_half: CUT });
    const inC = (x, z) => x >= 8 && x < 32 && z >= 8 && z < 32;
    // ground
    for (let z = 7; z < 33; z += 2) for (let x = 7; x < 33; x += 2) B.add(R() < 0.3 ? 'floor_dirt_large_rocky' : 'floor_dirt_large', x + 1, 0, z + 1, Math.floor(R() * 4) * Math.PI / 2, 0.5); // the camp; the wilds have their own ground
    // paths
    const pathCells = new Set(), path = (ax, az, bx, bz) => { let x = ax, z = az; const put = () => { const k = z * W + x; if (pathCells.has(k)) return; pathCells.add(k);
      B.add('path_' + 'ABCD'[Math.floor(R() * 4)], x + 0.5, 0.005, z + 0.5, Math.floor(R() * 4) * Math.PI / 2, 0.5); };
      while (z !== bz) { put(); z += Math.sign(bz - z); } while (x !== bx) { put(); x += Math.sign(bx - x); } put(); };
    path(23, 25, 14, 16); path(23, 20, 26, 8); path(24, 21, 31, 20); path(23, 26, 24, 31); // to the crypt, the north gate, the east and south gates path(14, 16, 13, 16); path(14, 16, 15, 17); path(14, 16, 14, 15);
    const C = this.crypt; B.add('crypt', C.x, 0, C.z, 0, C.s);
    // the crypt door is a portal: swirling light fills the doorway (door face 1.4 m in front of the centre, 1.04 m wide, top at ~2.05)
    this.portal = portalMesh(1.04, 1.8); this.portal.position.set(C.x, 0.26, C.z + 1.42); this.group.add(this.portal);
    this.stairsGlow = this.glow(C.x, 0.45, 14.7, 0x6fb6ff, 2.6, 0.5); this.glow(C.x, 1.2, C.z + 1.55, 0x5fd0ff, 2.6, 0.45);
    this.torches.push({ x: C.x, y: 0.6, z: 15.6, r: 2.8, ph: 0 });
    // lantern posts along the paths
    for (const [x, z, r] of [[21.6, 21.2, 0], [17.2, 16.4, 0], [24.6, 15.0, Math.PI], [22.0, 26.4, 0]]) { const cx = Math.floor(x), cz = Math.floor(z); this.block(cx, cz);
      B.add('post_lantern', cx + 0.5, 0, cz + 0.5, r, 0.5); const lx = cx + 0.5 + Math.sin(r) * 0.6, lz = cz + 0.5 + Math.cos(r) * 0.6; this.glow(lx, 1.45, lz, 0xffb050, 1.2, 0.9); this.torch(lx, 1.5, lz, 5.2); }
    // the shrine by the spawn point
    B.add('shrine_candles', 26.5, 0, 26.5, -Math.PI * 0.75, 0.6); this.block(26, 26); this.glow(26.5, 0.8, 26.5, 0xffc060, 1.6, 0.8); this.torch(26.2, 1.0, 26.2, 5.0);
    B.add('bench', 21.0, 0, 28.3, 0, 0.5); this.block(20, 28); this.block(21, 28);
    // graveyard plot
    const GR = ['grave_A', 'grave_B', 'gravestone', 'gravestone', 'gravemarker_A', 'gravemarker_B'];
    for (let z = 19; z <= 29; z += 3) for (let x = 9; x <= 17; x += 2) { if (R() < 0.15) continue; const cx = x, cz = z; if (pathCells.has(cz * W + cx) || pathCells.has((cz + 1) * W + cx)) continue;
      const name = GR[Math.floor(R() * GR.length)]; B.add(name, cx + 0.5 + (R() - 0.5) * 0.2, 0, cz + 0.5 + (R() - 0.5) * 0.2, (R() - 0.5) * 0.25, 0.5); this.block(cx, cz);
      if (name.startsWith('grave_')) this.block(cx, cz + 1); }
    for (let i = 0; i < 14; i++) { const x = 9 + R() * 21, z = 9 + R() * 21; if (g[Math.floor(z) * W + Math.floor(x)] === 1) B.add(['bone_A', 'bone_B', 'ribcage', 'pumpkin_yellow_small'][Math.floor(R() * 4)], x, 0.03, z, R() * 6.28, 0.5); }
    for (const [x, z] of [[27.5, 13.5], [29.5, 23.5], [19.5, 10.5]]) { B.add('pumpkin_orange_jackolantern', x, 0, z, R() * 6.28, 0.5); this.block(Math.floor(x), Math.floor(z)); this.glow(x, 0.35, z, 0xff9a30, 0.9, 0.7); }
    B.add('coffin', 17.4, 0, 11.8, Math.PI / 2, 0.5); this.block(17, 11); this.block(17, 12); this.coffin = { x: 17.4, z: 11.8 }; // hides the easter-egg gatling (see openCoffin)
    B.add('post_skull', 11.2, 0, 17.6, 0, 0.5); this.block(11, 17); B.add('skull_candle', 17.4, 0, 14.5, 0, 0.5); this.block(17, 14);
    // trees inside the clearing
    for (const [x, z, t] of [[29.5, 10.5, 'tree_dead_large'], [10.5, 30.5, 'tree_dead_medium'], [30.5, 29.5, 'tree_dead_small'], [28.5, 17.5, 'tree_dead_medium'], [19.5, 30.5, 'tree_dead_small']]) {
      B.add(t, x, 0, z, R() * 6.28, 0.5); this.block(Math.floor(x), Math.floor(z)); }
    // fence around the clearing, with an arch gate on the far side (it only looks out on the woods) and the two gates out into the wilds (east and south)
    for (let t = 8; t < 32; t += 2) { const brk = () => R() < 0.2 ? 'fence_broken' : 'fence';
      if (!(t >= 24 && t <= 26)) B.add(brk(), t + 1, 0, 8.05, 0, 0.5);
      B.add(brk(), 8.05, 0, t + 1, Math.PI / 2, 0.5); if (t !== 22 && t !== 24) B.add(brk(), t + 1, 0, 31.95, 0, 0.5); if (t !== 18 && t !== 20) B.add(brk(), 31.95, 0, t + 1, Math.PI / 2, 0.5); }
    for (const [x, z] of [[8.05, 8.05], [31.95, 8.05], [8.05, 31.95], [31.95, 31.95]]) B.add('fence_pillar', x, 0, z, 0, 0.5);
    B.add('arch_gate', 26, 0, 8.05, 0, 0.6);
    // the wilds outside (and the forest all around)
    buildWilds(this, B, grp);
    B.build(grp);
  }
  dispose(scene) { scene.remove(this.group); this.group.traverse(o => { if (o.isSprite && o.material) o.material.dispose(); if (o.isInstancedMesh) o.dispose(); }); }
}
let G_T = 0; export function setNavTime(t) { G_T = t; }
