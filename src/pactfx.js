// 魂契: the Bone Sentinel's skill effects — a blade wreathed in fire, the roar's burst, sword-qi crescents, a wave of fire down a cone
import * as THREE from 'three';
import { G } from './state.js';
import { C } from './units.js';
import { glowSprite, ring } from './gfx.js';
import { burst, shake, slamMark } from './fx.js';

const TAU = Math.PI * 2, FIRE = [0xffe08a, 0xffa040, 0xff6a1a, 0xff3a14];
const fire = () => FIRE[Math.floor(Math.random() * FIRE.length)];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
// a ring racing out to radius r, w thick when it gets there (it stays a band, not a disc)
function wave(x, z, col, r, t, w = 0.3, op = 0.85, y = 0.06) { const rg = ring(Math.max(0.05, 1 - w / r), 1, col, op); rg.position.set(x, y, z); C.scene.add(rg);
  G.fx.push({ clean: true, t, tick: k => { const e = 1 - (1 - k) * (1 - k); rg.scale.setScalar(0.15 + e * (r - 0.15)); rg.material.opacity = op * (1 - k); }, fn: () => C.scene.remove(rg) }); }

// flames along the sword or greatsword, from the hilt up to `reach` (0..1) of the blade; `power` scales them. h.stop() lets them die down
export function bladeFire(u) {
  const g = u.mesh.weap && u.mesh.weap.r, e = g && g.userData.edge; if (!e) return null;
  const tip = e[1].position, ws = g.getWorldScale(_p).x || 1, h = { reach: 0, power: 1, on: true, stop() { this.on = false; } }, sprites = [];
  for (let i = 0; i < 9; i++) { const s = glowSprite(i % 2 ? 0xff6a1a : 0xffa040, 0.6 / ws, 0); s.position.set(tip.x, tip.y * (0.06 + i / 8 * 0.94), tip.z); g.add(s); sprites.push(s); }
  let last = G.t, fade = 1, acc = 0; const fx = { clean: true, t: 20, fn: () => sprites.forEach(s => g.remove(s)) };
  fx.tick = () => { const dt = Math.min(0.1, Math.max(0, G.t - last)); last = G.t; if (!h.on || u.dead) fade -= dt * 3; if (fade <= 0) { fx.t = 0; return; }
    const p = h.power * fade;
    sprites.forEach((s, i) => { const f = 0.06 + i / 8 * 0.94, on = f <= h.reach + 0.02; s.material.opacity = on ? (0.65 + 0.3 * Math.sin(G.t * 27 + i * 1.9)) * Math.min(1, p) : 0;
      s.scale.setScalar((0.55 + 0.25 * Math.sin(G.t * 19 + i * 2.3)) * (0.75 + 0.55 * p) / ws); });
    if (h.reach <= 0.01 || !g.parent) return; g.updateMatrixWorld(true); _a.set(tip.x, tip.y * 0.06, tip.z); g.localToWorld(_a); e[1].getWorldPosition(_b);
    acc += dt * 180 * h.reach * p; while (acc >= 1) { acc -= 1; _p.copy(_a).lerp(_b, Math.random() * h.reach / 1); // licks of flame rising off the blade
      C.parts.emit(_p.x, _p.y, _p.z, 1, { col: fire(), spd: 0.4, up: 1.5, grav: -2.8, life: 0.22 + Math.random() * 0.25, size: 0.2 + 0.12 * Math.min(1.3, p), spread: 0.1 }); } };
  G.fx.push(fx); return h;
}

// the roar: power bursting out — shock rings racing outward, a pillar of light, flames thrown up around it, dust swept off the floor
export function roarBurst(u, col = 0xff7a2a) {
  const x = u.x, z = u.z;
  wave(x, z, 0xffe0a0, 4.5, 0.45, 0.5, 0.9); for (let i = 1; i < 4; i++) G.fx.push({ clean: true, t: 0.07 * i, fn: () => wave(x, z, i % 2 ? col : 0xffc070, 4.5 + i * 1.4, 0.55, 0.35, 0.8) });
  wave(x, z, 0xd8ccb8, 7, 0.8, 0.9, 0.45, 0.03); // the dust ring along the floor
  const pil = glowSprite(0xff9a40, 1, 0.55); pil.scale.set(1.6, 5.5, 1); pil.position.set(x, 2.2, z); C.scene.add(pil); // a column of power, not a white-out
  G.fx.push({ clean: true, t: 0.7, tick: k => { pil.material.opacity = 0.55 * (1 - k) * (1 - k); pil.scale.set(1.6 + 1.6 * k, 5.5 + 2 * k, 1); }, fn: () => C.scene.remove(pil) });
  burst(x, 1.4, z, 0xffb050, 1.7); shake(0.2, x, z);
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; C.parts.emit(x + Math.cos(a) * 0.7, 0.2, z + Math.sin(a) * 0.7, 1, { col: fire(), spd: 1.2, up: 4.5, grav: -1.5, life: 0.6, size: 0.32, spread: 0.1 }); }
  for (let i = 0; i < 30; i++) { const a = i / 30 * TAU; C.parts.emit(x + Math.cos(a) * 1.2, 0.12, z + Math.sin(a) * 1.2, 1, { col: 0xc8bca8, spd: 4.5, up: 0.4, grav: 2, life: 0.55, size: 0.42, spread: 0.2 }); }
}

// sword qi: crescents flung out in every direction — a body in the skill colour (normal blending, so it reads on a light floor) and a
// white-hot leading edge (additive)
const CRES = {};
function crescent(core) { if (CRES[core]) return CRES[core]; const N = 28, R = 1.2, A = 0.6, pos = [], col = [], idx = [];
  for (let i = 0; i <= N; i++) { const t = i / N, th = -A + 2 * A * t, w = 0.4 * Math.sin(Math.PI * t), cx = Math.cos(th), cy = Math.sin(th), bx = R * cx - R, by = R * cy, f = Math.pow(Math.sin(Math.PI * t), 0.6);
    pos.push(bx - cx * w * 0.3, 0, -(by - cy * w * 0.3), bx + cx * w * 0.7, 0, -(by + cy * w * 0.7)); col.push(1, 1, 1, core ? 0 : 0.35 * f, 1, 1, 1, f); }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return (CRES[core] = g); }
export const QI = { speed: 9.5, life: 0.55, r0: 0.8 };
export function qiWaves(x, z, col, n = 8, rot = 0, spread = TAU) {
  for (let i = 0; i < n; i++) { const al = rot + (spread >= TAU ? i / n : (i + 0.5) / n) * spread, dx = Math.sin(al), dz = Math.cos(al), tilt = (Math.random() - 0.5) * 0.45, grp = new THREE.Group();
    const body = new THREE.Mesh(crescent(0), new THREE.MeshBasicMaterial({ color: col, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const edge = new THREE.Mesh(crescent(1), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    edge.position.y = 0.01; grp.add(body, edge); grp.rotation.set(0, Math.atan2(-dz, dx), 0); grp.rotateX(tilt); grp.position.set(x + dx * QI.r0, 0.85, z + dz * QI.r0); body.renderOrder = edge.renderOrder = 5; C.scene.add(grp);
    G.fx.push({ clean: true, t: QI.life, tick: k => { const r = QI.r0 + QI.speed * QI.life * k, o = (1 - k * k) * (k < 0.06 ? k / 0.06 : 1); grp.position.set(x + dx * r, 0.85 + 0.12 * k, z + dz * r);
        grp.scale.set(1 + 0.45 * k, 1, 1 + 0.45 * k); body.material.opacity = 0.9 * o; edge.material.opacity = 0.9 * o; },
      fn: () => { C.scene.remove(grp); body.material.dispose(); edge.material.dispose(); } }); }
}

// a single big crescent flying straight, a little tilted (flat enough to read from the camera above whichever way it flies); the sword
// & shield's counter. onStep(x, z) each frame, to cut what it passes
export function qiBolt(x, z, ang, col, range, speed, onStep) {
  const dx = Math.sin(ang), dz = Math.cos(ang), grp = new THREE.Group(), life = range / speed;
  const body = new THREE.Mesh(crescent(0), new THREE.MeshBasicMaterial({ color: col, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const edge = new THREE.Mesh(crescent(1), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const inner = new THREE.Group(); inner.add(body, edge); inner.rotation.x = (Math.random() < 0.5 ? -1 : 1) * 0.45; inner.scale.set(1.3, 1, 1.5); grp.add(inner); body.renderOrder = edge.renderOrder = 5;
  grp.rotation.y = Math.atan2(-dz, dx); grp.position.set(x + dx * 0.9, 1.05, z + dz * 0.9); C.scene.add(grp);
  G.fx.push({ clean: true, t: life, tick: k => { const r = 0.9 + range * k, px = x + dx * r, pz = z + dz * r; grp.position.set(px, 1.05, pz); const o = k < 0.8 ? 1 : (1 - k) / 0.2;
      body.material.opacity = 0.9 * o; edge.material.opacity = 0.95 * o; if (Math.random() < 0.7) C.parts.emit(px - dx * 0.3, 1.05, pz - dz * 0.3, 1, { col, spd: 0.3, up: 0.2, grav: 0, life: 0.25, size: 0.3, spread: 0.5 });
      if (onStep) onStep(px, pz); }, fn: () => { C.scene.remove(grp); body.material.dispose(); edge.material.dispose(); } });
}
// the shield fanned upward: a crescent of light standing up in front, sweeping from low to high
export function swipeUp(x, z, face, col) {
  const dx = Math.sin(face), dz = Math.cos(face), grp = new THREE.Group(), inner = new THREE.Group();
  const body = new THREE.Mesh(crescent(0), new THREE.MeshBasicMaterial({ color: col, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const edge = new THREE.Mesh(crescent(1), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  inner.add(body, edge); inner.rotation.x = -Math.PI / 2; grp.add(inner); body.renderOrder = edge.renderOrder = 5; // stood up: the arc spans low to high, bulging forward
  grp.rotation.y = Math.atan2(-dz, dx); grp.position.set(x + dx * 0.5, 1.2, z + dz * 0.5); C.scene.add(grp);
  G.fx.push({ clean: true, t: 0.3, tick: k => { inner.rotation.z = -0.9 + 1.4 * k; grp.scale.setScalar(0.9 + 0.5 * k); const o = 1 - k * k; body.material.opacity = 0.85 * o; edge.material.opacity = 0.95 * o; },
    fn: () => { C.scene.remove(grp); body.material.dispose(); edge.material.dispose(); } });
}
// a wide half-moon of qi spreading out in front (the greatsword's counter), and a few crescents in it
const ARC = {};
function arcGeo(A, w, core) { const key = A + '/' + w + '/' + core; if (ARC[key]) return ARC[key]; const N = 48, pos = [], col = [], idx = [];
  for (let i = 0; i <= N; i++) { const t = i / N, th = -A + 2 * A * t, f = Math.pow(Math.sin(Math.PI * t), 0.5), c = Math.cos(th), s = Math.sin(th), ww = w * (0.4 + 0.6 * f);
    pos.push(c * (1 - ww), 0, -s * (1 - ww), c, 0, -s); col.push(1, 1, 1, core ? 0 : 0.3 * f, 1, 1, 1, f); }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return (ARC[key] = g); }
export function qiFan(x, z, face, col, R) {
  const grp = new THREE.Group(), body = new THREE.Mesh(arcGeo(Math.PI / 2, 0.22, 0), new THREE.MeshBasicMaterial({ color: col, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const edge = new THREE.Mesh(arcGeo(Math.PI / 2, 0.22, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  edge.position.y = 0.01; grp.add(body, edge); body.renderOrder = edge.renderOrder = 5; grp.rotation.y = Math.atan2(-Math.cos(face), Math.sin(face)); grp.position.set(x, 0.85, z); C.scene.add(grp);
  G.fx.push({ clean: true, t: 0.42, tick: k => { const e = 1 - (1 - k) * (1 - k); grp.scale.setScalar(0.9 + (R - 0.9) * e); const o = 1 - k * k; body.material.opacity = 0.85 * o; edge.material.opacity = 0.95 * o; },
    fn: () => { C.scene.remove(grp); body.material.dispose(); edge.material.dispose(); } });
  qiWaves(x, z, col, 3, face - 0.75, 1.5); // three crescents riding in it
}
// the greatsword's Sundering Strike: fire rolling out over a 270° arc around it, scorching the ground as it goes
export function fireArc(x, z, face, R, span, life = 0.55, op = 1) { const first = op >= 1;
  const th0 = Math.atan2(-Math.cos(face), Math.sin(face)) - span / 2, geo = new THREE.RingGeometry(0.8, 1, 64, 1, th0, span).rotateX(-Math.PI / 2), band = new THREE.Group();
  const under = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff4a10, transparent: true, opacity: 0.6 * op, depthWrite: false, side: THREE.DoubleSide })); // reads on a light floor
  const glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.y = 0.005; band.add(under, glow); band.position.set(x, 0.07, z); under.renderOrder = glow.renderOrder = 4; C.scene.add(band); let last = 0;
  G.fx.push({ clean: true, t: life, tick: k => { const e = 1 - (1 - k) * (1 - k), r = 0.6 + (R - 0.6) * e; band.scale.setScalar(r); under.material.opacity = 0.6 * op * (1 - k); glow.material.opacity = 0.9 * op * (1 - k);
      const n = Math.floor((k - last) * 70); last += n / 70; // flames thrown up along the front of the wave
      for (let i = 0; i < n * (first ? 3 : 2); i++) { const a = face - span / 2 + Math.random() * span, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
        C.parts.emit(px, 0.15, pz, 1, { col: fire(), spd: 0.5, up: 2.6 + Math.random() * 1.6, grav: -1.2, life: 0.45 + Math.random() * 0.3, size: 0.42, spread: 0.25 }); } },
    fn: () => { C.scene.remove(band); geo.dispose(); under.material.dispose(); glow.material.dispose(); } });
  if (!first) { wave(x, z, 0xff8a30, R + 0.3, life, 0.35, 0.55 * op); return; } // the later waves: the band and its flames, no new cracks
  for (let i = 0; i < 5; i++) { const a = face - span / 2 + (i + 0.5) / 5 * span, d = R * (0.45 + 0.15 * (i % 2)), px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
    G.fx.push({ clean: true, t: 0.08 + 0.05 * i, fn: () => { slamMark(px, pz, 0.85, 0xff5a1a, 2.6); C.parts.emit(px, 0.2, pz, 7, { col: 0x4e443c, spd: 2.4, up: 2, grav: 9, life: 0.5, size: 0.26, spread: 0.4 }); } }); }
  wave(x, z, 0xffb050, R + 0.5, 0.6, 0.45, 0.8);
}

// the blow of the Sundering Strike, on fire: a wave of flame runs out down the cone, scorching cracks behind it
export function fireCone(x, z, face, range) {
  const fx = Math.sin(face), fz = Math.cos(face);
  for (let k = 1; k <= 5; k++) { const d = k / 5 * range, px = x + fx * d, pz = z + fz * d, w = 0.5 + k * 0.32;
    G.fx.push({ clean: true, t: 0.055 * k, fn: () => {
      wave(px, pz, k % 2 ? 0xff6a1a : 0xffb050, 1 + k * 0.5, 0.4, 0.35, 0.85);
      for (let i = 0; i < 6 + k * 2; i++) { const s = (Math.random() - 0.5) * 2 * w, qx = px + fz * s, qz = pz - fx * s;
        C.parts.emit(qx, 0.15, qz, 1, { col: fire(), spd: 0.6, up: 2.8 + Math.random() * 1.5, grav: -1.2, life: 0.4 + Math.random() * 0.3, size: 0.32, spread: 0.15 }); }
      C.parts.emit(px, 0.2, pz, 5 + k, { col: 0x4e443c, spd: 2.6, up: 2.2, grav: 9, life: 0.55, size: 0.26, spread: 0.4 });
      if (k === 2 || k === 4) slamMark(px, pz, 0.8 + k * 0.15, 0xff5a1a, 2.6);
      const gl = glowSprite(0xff6a1a, 0.9 + k * 0.15, 0.55); gl.position.set(px, 0.45, pz); C.scene.add(gl); // a moment of burning ground
      G.fx.push({ clean: true, t: 0.6, tick: q => { gl.material.opacity = 0.55 * (1 - q) * (0.8 + 0.2 * Math.sin(q * 40)); }, fn: () => C.scene.remove(gl) }); } }); }
}
