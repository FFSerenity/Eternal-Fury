// 机械师骷髅 (Engineer Skeleton): skull drones and its skills.
// Attack drones circle it and shoot lasers (one more per rank of 攻击无人机), the repair drone flies to whoever is hurt worst and keeps
// fixing them, 轨道打击 marks a spot and a column of light comes down a second later, 折射激光 makes the lasers bounce.
// The drones live in the scene (world space), not on the mesh, so they can fly about freely; u.dr holds them.
import * as THREE from 'three';
import { G } from './state.js';
import { C, damage, hostilesOf, rk, say, PH } from './units.js';
import { propGeo, propMat, play } from './assets.js';
import { outlineMat, glowSprite, ring } from './gfx.js';
import { burst, impact, shake, slamMark } from './fx.js';
import { S } from './audio.js';
import { tr } from './i18n.js';

const TAU = Math.PI * 2, rand = (a, b) => a + Math.random() * (b - a), dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const WP = new THREE.Vector3();
const LASER = 0x6ff0ff, REPAIR = 0x7dff9a;

// ---------- beams: a thin additive box from A to B that narrows away (lasers, the rod's bolt, the repair link) ----------
const beamGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), BEAMS = [], beamMats = {};
const beamMat = col => beamMats[col] || (beamMats[col] = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
function beam(ax, ay, az, bx, by, bz, col, w, life) {
  const m = new THREE.Mesh(beamGeo, beamMat(col)); m.renderOrder = 3; m.position.set(ax, ay, az); m.scale.set(w, w, Math.hypot(bx - ax, by - ay, bz - az) || 0.01); m.lookAt(bx, by, bz); C.scene.add(m);
  BEAMS.push({ m, w, t: life, max: life }); return m;
}
// a laser: a coloured beam with a white core, a spark where it lands
function laser(ax, ay, az, bx, by, bz, col = LASER, w = 0.05) {
  beam(ax, ay, az, bx, by, bz, col, w, 0.14); beam(ax, ay, az, bx, by, bz, 0xffffff, w * 0.35, 0.1);
  impact(bx, by, bz, col, 0.55); if (C.parts) C.parts.emit(bx, by, bz, 3, { col, spd: 2.2, up: 0.8, grav: 4, life: 0.2, size: 0.1 });
}

// ---------- the drones ----------
function makeDrone(rep, x, y, z) {
  const pg = propGeo(rep ? 'drone_rep' : 'drone'), g = new THREE.Group();
  g.add(new THREE.Mesh(pg.geo, propMat(pg.map)), new THREE.Mesh(pg.geo, outlineMat(0x120a10, 0.012)));
  const gl = glowSprite(rep ? REPAIR : LASER, 0.28, 0.75); gl.position.set(0, 0.01, 0.13); g.add(gl);
  g.position.set(x, y, z); C.scene.add(g);
  return { g, x, y, z, face: 0, cd: 0, ph: Math.random() * TAU };
}
// drones are launched from the dock on its back and fly out to their places
function backOf(u) { return [u.x - Math.sin(u.face) * 0.3, 1.0, u.z - Math.cos(u.face) * 0.3]; }
function ensure(u) {
  const d = u.dr || (u.dr = { list: [], rep: null, all: [], t: 0 }), n = Math.min(5, 1 + rk(u, 'drones'));
  while (d.list.length < n) { const D = makeDrone(false, ...backOf(u)); D.cd = 0.4 + d.list.length * 0.3; d.list.push(D); }
  while (d.list.length > n) dropDrone(d.list.pop(), false);
  // the repair drone (a boss's can be shot down — a body of its own, boss.js — and comes back a while later)
  if (!d.rep && !(u.boss && (u.repT || 0) > 0)) { d.rep = makeDrone(true, ...backOf(u)); d.rep.healT = 0.6; d.rep.link = null; if (u.boss && PH.bossDrone) PH.bossDrone(u, d.rep); }
  d.all = d.rep ? [...d.list, d.rep] : d.list.slice(); return d;
}
// a drone falls out of the air and pops (the engineer fell), or just vanishes (floor change, weapon taken off)
function dropDrone(D, fall) {
  if (D.link) { C.scene.remove(D.link); D.link = null; }
  if (!fall) { C.scene.remove(D.g); return; }
  const y0 = D.g.position.y; G.fx.push({ end: () => C.scene.remove(D.g), t: 0.45, tick: k => { D.g.position.y = Math.max(0.1, y0 * (1 - k * k)); D.g.rotation.z = k * 2.5; },
    fn: () => { C.scene.remove(D.g); if (C.parts) C.parts.emit(D.g.position.x, 0.2, D.g.position.z, 8, { col: 0xffd080, spd: 2.5, up: 1.5, grav: 8, life: 0.35, size: 0.12 }); } });
}
export function clearDrones(u, fall = false) { const d = u.dr; if (!d) return; for (const D of d.list) dropDrone(D, fall); if (d.rep) dropDrone(d.rep, fall); u.dr = null;
  if (u.repU && !u.repU.dead) { u.repU.dead = true; u.repU.remove(); } u.repU = null; }
// a boss's repair drone shot down: it falls, and a new one launches after a while
export function repairDown(u) { const d = u.dr; if (d && d.rep) { dropDrone(d.rep, true); d.rep = null; d.all = d.list.slice(); } u.repU = null; u.repT = 12; }
// glide toward a spot (smooth: they lag a little behind the engineer, tilt into the move)
function glide(D, tx, ty, tz, dt, k = 5) {
  const a = Math.min(1, dt * k), px = D.x, pz = D.z; D.x += (tx - D.x) * a; D.y += (ty - D.y) * a; D.z += (tz - D.z) * a;
  const vx = (D.x - px) / Math.max(dt, 1e-4), vz = (D.z - pz) / Math.max(dt, 1e-4);
  D.g.position.set(D.x, D.y, D.z); D.g.rotation.x = Math.max(-0.5, Math.min(0.5, (vx * Math.sin(D.face) + vz * Math.cos(D.face)) * 0.06));
}
function turn(D, ang, dt) { let d = ang - D.face; d = ((d + Math.PI * 3) % TAU) - Math.PI; D.face += d * Math.min(1, dt * 10); D.g.rotation.y = D.face; }
const vis = (u, h) => C.floor.los(u.x, u.z, h.x, h.z);
// the engineer's current target (or the nearest enemy that's in the fight)
function primary(u) {
  const t = u.target; if (t && !t.dead && dist(u, t) < 8.5 && vis(u, t)) return t;
  let b = null, bd = 8; for (const h of hostilesOf(u)) { if (h.dead || !(h.aggro || dist(u, h) < 6)) continue; const d = dist(u, h); if (d < bd && vis(u, h)) { bd = d; b = h; } } return b;
}
function otherTarget(u, not) { const c = hostilesOf(u).filter(h => !h.dead && h !== not && dist(u, h) < 8.5 && (h.aggro || dist(u, h) < 6) && vis(u, h)); return c.length ? c[Math.floor(Math.random() * c.length)] : not; }
// one laser shot from a drone (bounces with 折射激光)
function droneShot(u, D, h) {
  const dmg = u.dmg * 0.32, hy = 0.55 + Math.random() * 0.4; laser(D.x, D.y, D.z + 0, h.x, hy, h.z); S.laser();
  damage(u, h, dmg * rand(0.9, 1.1), { sum: true, noFx: true });
  let pr = rk(u, 'prism'), from = h; const hit = new Set([h]);
  while (pr-- > 0) { let nx = null, nd = 3; for (const e of hostilesOf(u)) { if (e.dead || hit.has(e)) continue; const de = dist(from, e); if (de < nd) { nd = de; nx = e; } } if (!nx) break;
    hit.add(nx); laser(from.x, hy, from.z, nx.x, 0.7, nx.z, 0xb9f6ff, 0.035); damage(u, nx, dmg * 0.6 * rand(0.9, 1.1), { sum: true, noFx: true }); from = nx; }
}
// per frame, for a living engineer
export function engTick(u, dt) {
  if (u.boss) u.repT = (u.repT || 0) - dt; const d = ensure(u); d.t += dt; d.pT = (d.pT || 0) - dt; if (d.pT <= 0 || (d.p && d.p.dead)) { d.pT = 0.2; d.p = primary(u); } // (line-of-sight checks: a few times a second)
  const t = d.p && !d.p.dead ? d.p : null, n = d.list.length;
  // attack drones: a ring around it (pulled a little toward the fight), bobbing; each fires on its own timer
  const cx = u.x + (t ? (t.x - u.x) / (dist(u, t) || 1) * 0.5 : 0), cz = u.z + (t ? (t.z - u.z) / (dist(u, t) || 1) * 0.5 : 0), R = 0.75 + 0.06 * n, spin = t ? 1.3 : 0.7;
  d.list.forEach((D, i) => {
    const a = d.t * spin + i / n * TAU; glide(D, cx + Math.cos(a) * R, 1.45 + 0.09 * Math.sin(d.t * 3 + D.ph), cz + Math.sin(a) * R, dt);
    D.cd -= dt; const h = D.aim && !D.aim.dead && D.aimT > 0 ? D.aim : null; D.aimT = (D.aimT || 0) - dt;
    if (h) turn(D, Math.atan2(h.x - D.x, h.z - D.z), dt); else turn(D, -a, dt); // nose along the circle
    if (D.cd <= 0 && t && u.stun <= 0) { const tg = i % 2 ? otherTarget(u, t) : t; D.aim = tg; D.aimT = 0.4; D.cd = 1.5 * rand(0.9, 1.1); D.face = Math.atan2(tg.x - D.x, tg.z - D.z); D.g.rotation.y = D.face; droneShot(u, D, tg); }
  });
  if (d.rep) repairTick(u, d.rep, dt);
}
// the repair drone: picks whoever is hurt worst (sticks with them unless someone else is much worse), hovers over them, a green link, a heal every 1.2 s
function repairTick(u, D, dt) {
  D.scan = (D.scan || 0) - dt; const mates = u.side === 'enemy' ? G.enemies : G.friends;
  if (D.scan <= 0) { D.scan = 0.4; let lo = null, lr = 0.93;
    for (const f of mates) { if (f.dead || f.isDrone || dist(f, u) > 10) continue; const r = f.hp / f.maxHp; if (r < lr) { lr = r; lo = f; } }
    const cur = D.tgt && !D.tgt.dead && dist(D.tgt, u) < 11 && D.tgt.hp < D.tgt.maxHp * 0.98 ? D.tgt : null;
    D.tgt = cur && (!lo || cur.hp / cur.maxHp < lr + 0.15) ? cur : lo; }
  const f = D.tgt && !D.tgt.dead ? D.tgt : null;
  if (f) { const a = G.t * 0.9; glide(D, f.x + Math.cos(a) * 0.55, 1.6 + 0.06 * Math.sin(G.t * 4), f.z + Math.sin(a) * 0.55, dt, 3.2); turn(D, Math.atan2(f.x - D.x, f.z - D.z), dt); }
  else { const a = u.face + 2.3; glide(D, u.x + Math.sin(a) * 0.6, 1.75 + 0.06 * Math.sin(G.t * 3), u.z + Math.cos(a) * 0.6, dt, 3.5); turn(D, u.face, dt); }
  if (u.repU) { u.repU.x = D.x; u.repU.z = D.z; u.repU.vx = u.repU.vz = u.repU.kx = u.repU.kz = 0; } // (its body, for the summons to hit)
  const near = f && Math.hypot(D.x - f.x, D.z - f.z) < 1.2;
  if (near) { // the link: a flickering green beam down to them
    const fy = 0.75; if (!D.link) { D.link = new THREE.Mesh(beamGeo, beamMat(REPAIR)); D.link.renderOrder = 3; C.scene.add(D.link); }
    const L = Math.hypot(f.x - D.x, fy - (D.y - 0.15), f.z - D.z), w = 0.035 + 0.015 * Math.sin(G.t * 40); D.link.position.set(D.x, D.y - 0.15, D.z); D.link.scale.set(w, w, L); D.link.lookAt(f.x, fy, f.z);
    if (Math.random() < dt * 12 && C.parts) C.parts.emit(f.x + rand(-0.3, 0.3), 0.4, f.z + rand(-0.3, 0.3), 1, { col: REPAIR, spd: 0.2, up: 1.6, grav: -0.5, life: 0.6, size: 0.14 });
    D.healT -= dt;
    if (D.healT <= 0) { D.healT = 1.2; const h = u.boss ? f.maxHp * 0.014 : (f.maxHp * 0.06 + 1.0 * u.level) * (1 + 0.25 * rk(u, 'repair')), got = Math.min(h, f.maxHp - f.hp); // (a boss: ~1.2% a second)
      if (got > 0.5) { f.hp += got; say(f.x, f.z, '+' + Math.round(got), '#7dff9a', 14); S.fix(); if (C.parts) C.parts.emit(f.x, 0.6, f.z, 8, { col: REPAIR, spd: 0.7, up: 2.2, life: 0.6, grav: -1, size: 0.16 }); } } }
  else { if (D.link) { C.scene.remove(D.link); D.link = null; } D.healT = Math.min(D.healT, 0.4); }
}

// ---------- the engineer's own attack: a bolt from the rod ----------
export function rodBeam(u, t) {
  const r = u.mesh.rod; if (r) r.getWorldPosition(WP); else WP.set(u.x + Math.sin(u.face) * 0.5, 1.2, u.z + Math.cos(u.face) * 0.5);
  const ty = 0.7; beam(WP.x, WP.y, WP.z, t.x, ty, t.z, 0xb46cff, 0.13, 0.2); beam(WP.x, WP.y, WP.z, t.x, ty, t.z, 0xd8fbff, 0.05, 0.16);
  burst(t.x, ty, t.z, 0xc9a0ff, 0.9); impact(WP.x, WP.y, WP.z, 0xd8fbff, 0.5); S.beam();
  damage(u, t, u.dmg * 0.95 * rand(0.9, 1.1), {});
}

// ---------- 轨道打击 ----------
const STRIKES = [];
// the spot that catches the most (an elite counts double); needs 3+ or an elite
export function orbitalSkill(u) {
  const r = rk(u, 'orbital'); if (!r || (u.orbCD || 0) > G.t || u.state !== 'idle' || u.stun > 0) return false;
  const R = 2 + 0.2 * r, near = hostilesOf(u).filter(h => !h.dead && dist(h, u) < 9 && (h.aggro || h === u.target) && vis(u, h)); if (!near.length) return false;
  let best = null, bn = 0; for (const c of near) { let n = 0; for (const h of near) if (Math.hypot(h.x - c.x, h.z - c.z) < R * 0.9) n += h.champ ? 2 : 1; if (n > bn) { bn = n; best = c; } }
  if (!best || (bn < 3 && !near.some(h => h.champ) && !u.boss)) { u.orbCD = G.t + 0.6; return false; }
  u.state = 'call'; u.st = 0; u.called = false; u.callT = best; u.orbCD = G.t + (15 - 2 * r) * (u.boss ? (u.enraged ? 0.45 : 0.6) : 1); u.wantX = u.wantZ = 0; u.faceT = Math.atan2(best.x - u.x, best.z - u.z);
  play(u.mesh, 'Spellcast_Raise', { once: true, restart: true, speed: 1.6, fade: 0.06 }); u.animLock = 0.55; say(u.x, u.z, tr('轨道打击！', 'Orbital Strike!'), '#ff8aa0', 14, 2.0); return true;
}
// the call: the rod sends an uplink beam into the sky, then the mark goes down
export function updateCall(u, dt) {
  u.st += dt; u.wantX = u.wantZ = 0;
  if (!u.called && u.st > 0.28) { u.called = true; const r = u.mesh.rod; if (r) r.getWorldPosition(WP); else WP.set(u.x, 1.3, u.z);
    beam(WP.x, WP.y, WP.z, WP.x, 14, WP.z, 0xff8aa0, 0.09, 0.35); beam(WP.x, WP.y, WP.z, WP.x, 14, WP.z, 0xffffff, 0.035, 0.3); S.lock();
    const t = u.callT; if (t) startStrike(u, t); }
  if (u.st > 0.55) { u.state = 'recover'; u.st = 0; }
}
function startStrike(u, t) {
  const r = rk(u, 'orbital'), R = 2 + 0.2 * r, g = new THREE.Group(), col = 0xff4f6a;
  const outer = ring(R - 0.1, R, col, 0.9), inner = ring(0.32, 0.4, 0xffd0d8, 0.9), dash = new THREE.Group();
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(0.1, R * 0.45).rotateX(-Math.PI / 2), beamMat(col)); const a = i / 4 * TAU; b.position.set(Math.sin(a) * R * 0.62, 0, Math.cos(a) * R * 0.62); b.rotation.y = a; dash.add(b); }
  const fill = new THREE.Mesh(new THREE.CircleGeometry(R, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const guide = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 16, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8aa0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); guide.position.y = 8;
  g.add(fill, outer, inner, dash, guide); for (const o of [fill, outer, inner]) o.renderOrder = 2; g.position.set(t.x, 0.06, t.z); C.scene.add(g);
  STRIKES.push({ src: u, tgt: t, x: t.x, z: t.z, t: 0, delay: u.boss ? 1.5 : 1.0, lock: u.boss ? 0.6 : 0.55, R, r, g, outer, inner, dash, fill, guide }); // (a boss's holds still longer: room to get out)
}
function fireStrike(s) {
  const { x, z, R, r, src } = s; C.scene.remove(s.g); S.orbital(); shake(0.2, x, z); slamMark(x, z); burst(x, 0.6, z, 0xd8fbff, R * 1.5); burst(x, 1.2, z, 0xff8aa0, R);
  // the column of light: a wide soft shell around a white core, both shrinking away
  const col = new THREE.Group(); col.position.set(x, 8, z); C.scene.add(col);
  const mk = (rad, c, op) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 16, 24, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 3; col.add(m); return m; };
  const shell = mk(R * 0.55, 0xff6a88, 0.4), core = mk(R * 0.22, 0xffffff, 0.9);
  G.fx.push({ clean: true, t: 0.55, tick: k => { const e = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85; shell.scale.set(0.4 + 0.8 * e, 1, 0.4 + 0.8 * e); core.scale.set(0.2 + 0.9 * e, 1, 0.2 + 0.9 * e);
    shell.material.opacity = 0.4 * e; core.material.opacity = 0.9 * e; }, fn: () => { C.scene.remove(col); shell.geometry.dispose(); core.geometry.dispose(); } });
  const wv = ring(0.3, 0.6, 0xffc0cc, 0.9); wv.position.set(x, 0.07, z); C.scene.add(wv); G.fx.push({ clean: true, t: 0.45, tick: k => { wv.scale.setScalar(1 + k * R * 2.2); wv.material.opacity = 0.9 * (1 - k); }, fn: () => C.scene.remove(wv) });
  if (C.parts) { C.parts.emit(x, 0.3, z, 30, { col: 0xffd0d8, spd: 5.5, up: 1.4, life: 0.5, size: 0.24 }); C.parts.emit(x, 0.4, z, 18, { col: 0xffffff, spd: 1.2, up: 6, grav: 4, life: 0.7, size: 0.2 });
    C.parts.emit(x, 0.5, z, 14, { col: 0x3a3442, spd: 1.4, up: 1.4, grav: -0.5, life: 1.0, size: 0.45 }); }
  const dmg = src.dmg * (2.4 + 0.5 * r);
  for (const h of hostilesOf(src)) { if (h.dead || Math.hypot(h.x - x, h.z - z) > R + h.r) continue; damage(src, h, dmg * rand(0.9, 1.1), { knock: 1.4, fx: x, fz: z, heavy: true }); if (!h.dead) h.stun = Math.max(h.stun, 1 + 0.3 * r); }
}
// strikes, beams: once a frame (from updateShots)
export function updateTechFx(dt) {
  let j = 0;
  for (const b of BEAMS) { b.t -= dt; if (b.t <= 0) { C.scene.remove(b.m); continue; } const k = b.t / b.max; b.m.scale.x = b.m.scale.y = b.w * (0.35 + 0.65 * k); BEAMS[j++] = b; }
  BEAMS.length = j; j = 0;
  for (const s of STRIKES) { s.t += dt; const k = Math.min(1, s.t / s.delay);
    if (s.t < s.lock && s.tgt && !s.tgt.dead) { s.x += (s.tgt.x - s.x) * Math.min(1, dt * 8); s.z += (s.tgt.z - s.z) * Math.min(1, dt * 8); } // locks on, then holds the spot
    s.g.position.set(s.x, 0.06, s.z); s.dash.rotation.y += dt * (1.5 + 5 * k); s.outer.scale.setScalar(1.35 - 0.35 * Math.min(1, k * 2.5)); s.inner.scale.setScalar(1 + 0.25 * Math.sin(s.t * 18));
    s.fill.material.opacity = 0.05 + 0.22 * k * (0.7 + 0.3 * Math.sin(s.t * 22)); s.guide.material.opacity = 0.15 + 0.5 * k;
    if (s.t >= s.delay) { fireStrike(s); continue; } STRIKES[j++] = s; }
  STRIKES.length = j;
}
export function clearTechFx() { for (const b of BEAMS) C.scene.remove(b.m); BEAMS.length = 0; for (const s of STRIKES) C.scene.remove(s.g); STRIKES.length = 0; }
// blob shadows under the drones
export function droneShadows(add) { for (const L of [G.friends, G.enemies]) for (const u of L) if (u.dr) for (const D of u.dr.all) add(D.x, D.z, 0.11); }
