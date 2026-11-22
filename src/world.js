// Random crypt floors: rooms joined by wide corridors, plus navigation (walkability, line of sight, cached flow fields)
import * as THREE from 'three';
import { part, merge, toonMat, glowSprite } from './gfx.js';

export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Floor {
  constructor(seed, depth) {
    const R = rng(seed), W = 60, H = 60; this.W = W; this.H = H; this.depth = depth;
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
    this.end = far; this.stairs = { x: Math.floor(far.cx) + 0.5, z: Math.floor(far.cy) + 0.5 };
    this.R = R; this.fields = new Map();
  }
  walk(x, z) { const X = Math.floor(x), Z = Math.floor(z); return X >= 0 && Z >= 0 && X < this.W && Z < this.H && this.g[Z * this.W + X] === 1; }
  // line of sight on the tile grid (also used for projectiles)
  los(ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.3); for (let i = 1; i < n; i++) if (!this.walk(ax + dx * i / n, az + dz * i / n)) return false; return true; }
  bfs(tx, tz) {
    const W = this.W, H = this.H, D = new Float32Array(W * H).fill(1e9), q = new Int32Array(W * H); let h = 0, t = 0; const s = tz * W + tx; if (this.g[s] !== 1) return D;
    D[s] = 0; q[t++] = s; const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (h < t) { const i = q[h++], x = i % W, y = (i / W) | 0;
      for (const [dx, dy, c] of nb) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (this.g[j] !== 1) continue;
        if (dx && dy && (this.g[y * W + X] !== 1 || this.g[Y * W + x] !== 1)) continue; const nd = D[i] + c; if (nd < D[j]) { D[j] = nd; q[t++] = j; } } }
    return D;
  }
  // direction to walk from (x,z) toward (tx,tz): straight if visible, otherwise down a cached flow field
  dirTo(x, z, tx, tz, out) {
    if (this.los(x, z, tx, tz)) { const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz) || 1; out.x = dx / d; out.z = dz / d; return out; }
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
  randomSpot(room, R = this.R) { return { x: room.x + 1 + R() * (room.w - 2), z: room.y + 1 + R() * (room.h - 2) }; }
  // meshes: floor tiles (one draw), walls (one draw, see-through near the player), decorations
  build(scene) {
    const W = this.W, H = this.H, R = this.R, fparts = [], wparts = [], dparts = [], grp = new THREE.Group();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = this.g[y * W + x];
      if (v === 1) { const s = 0.85 + R() * 0.15, chk = (x + y) % 2 ? 0.96 : 1; const c = new THREE.Color(0.38 * s * chk, 0.34 * s * chk, 0.33 * s * chk);
        const p = new THREE.PlaneGeometry(0.985, 0.985); p.rotateX(-Math.PI / 2); fparts.push(part(p, c, [x + 0.5, 0, y + 0.5]));
        if (R() < 0.035) dparts.push(part(new THREE.CapsuleGeometry(0.04, 0.28, 3, 6), 0xd8d0b8, [x + R(), 0.05, y + R()], [Math.PI / 2, 0, R() * 3])); }
      else if (v === 2) { const hgt = 1.5, s = 0.8 + R() * 0.2; const b = new THREE.BoxGeometry(1, hgt, 1); fparts.length; wparts.push(part(b, new THREE.Color(0.42 * s, 0.38 * s, 0.44 * s), [x + 0.5, hgt / 2, y + 0.5])); } }
    const floor = new THREE.Mesh(merge(fparts), toonMat()); const under = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, H * 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a1418 }));
    under.position.set(W / 2, -0.02, H / 2); grp.add(under, floor);
    const walls = new THREE.Mesh(merge(wparts), toonMat({ cut: true })); grp.add(walls);
    if (dparts.length) grp.add(new THREE.Mesh(merge(dparts), toonMat()));
    // candles near room walls
    for (const r of this.rooms) for (let k = 0; k < 2; k++) { const cx = r.x + 0.4 + R() * (r.w - 0.8), cz = R() < 0.5 ? r.y + 0.35 : r.y + r.h - 0.35;
      const c = new THREE.Mesh(merge([part(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6), 0xf0e6c8, [0, 0.15, 0])]), toonMat({ emis: 0x302010 })); c.position.set(cx, 0, cz);
      const gl = glowSprite(0xffb347, 1.1, 0.8); gl.position.set(cx, 0.42, cz); grp.add(c, gl); }
    // stairs down: dark pit with a blue glow
    const st = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050308 })); st.position.set(this.stairs.x, 0.015, this.stairs.z);
    const sg = glowSprite(0x6fb6ff, 2.6, 0.7); sg.position.set(this.stairs.x, 0.4, this.stairs.z); grp.add(st, sg); this.stairsGlow = sg;
    scene.add(grp); this.group = grp; return grp;
  }
  dispose(scene) { scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); }
}
let G_T = 0; export function setNavTime(t) { G_T = t; }
