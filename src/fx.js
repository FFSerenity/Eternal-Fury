// Combat feel: weapon swing trails, slash arcs and impact flashes where blows land, camera shake on big impacts.
// (Hit-stop and the hit jolt live on the units themselves: see damage() / integrate() in units.js.)
import * as THREE from 'three';
import { G } from './state.js';
import { propGeo, propMat } from './assets.js';
import { ring } from './gfx.js';

const S = { scene: null, parts: null, shakeA: 0, shakeT: 0, ph: [0, 0, 0] };
let shakeOn = true; try { shakeOn = localStorage.getItem('graveTamerShake') !== '0'; } catch (e) {}
export const shakeEnabled = () => shakeOn;
export function setShake(on) { shakeOn = on; try { localStorage.setItem('graveTamerShake', on ? '1' : '0'); } catch (e) {} }
export function initFx(scene, parts) { S.scene = scene; S.parts = parts; scene.add(TR.mesh); }

// ---------- textures ----------
function canvasTex(draw, n = 128) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; }
// a crescent: the bright leading edge of a blade's sweep, thinning to both ends
const CRESCENT = canvasTex((g, n) => {
  const m = n / 2, id = g.createImageData(n, n), d = id.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = (x - m) / m, dy = (y - m) / m, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    // band between r 0.62..0.98, brightest at the outer edge, over the upper ~200° of the circle, fading at the tips
    const band = Math.max(0, 1 - Math.abs(r - 0.86) / 0.16) * Math.min(1, Math.max(0, (r - 0.62) / 0.3)), span = Math.max(0, Math.sin(Math.max(0, Math.min(Math.PI, -a + 0.2)) ));
    const v = Math.pow(band, 1.4) * Math.pow(span, 0.8); const i = (y * n + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(255 * Math.min(1, v * 1.25)); }
  g.putImageData(id, 0, 0); }, 128);
// a four-pointed star for crits and heavy blows
const STAR = canvasTex((g, n) => { const m = n / 2; g.translate(m, m);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, m); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -m); g.quadraticCurveTo(m * 0.09, 0, 0, m); g.quadraticCurveTo(-m * 0.09, 0, 0, -m); g.fill(); }
  g.beginPath(); g.arc(0, 0, m * 0.28, 0, Math.PI * 2); g.fill(); }, 128);
const GLOW = canvasTex((g, n) => { const m = n / 2, gr = g.createRadialGradient(m, m, 0, m, m, m); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, 64);

// ---------- short-lived sprites (pooled) ----------
const POOL = [], LIVE = [];
function sprite(tex) { const s = POOL.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true }));
  s.material.map = tex; s.material.needsUpdate = true; s.renderOrder = 4; S.scene.add(s); return s; }
function flash(tex, x, y, z, col, size, life, o = {}) {
  const s = sprite(tex); s.material.color.setHex(col); s.material.opacity = o.op ?? 1; s.material.rotation = o.rot ?? 0; s.position.set(x, y, z); s.scale.setScalar(size * (o.s0 ?? 0.7));
  LIVE.push({ s, t: 0, life, size, s0: o.s0 ?? 0.7, s1: o.s1 ?? 1.15, op: o.op ?? 1, spin: o.spin || 0 });
}
// the camera looks down from +x+z: turn a ground direction into an angle on screen (for sprites that point along a swing)
const PITCH_K = 0.72;
export const screenAng = (dx, dz) => Math.atan2(-(dx + dz) * PITCH_K, dx - dz);

// a blade connecting: a crescent sweeping across the target, a hot flash, sparks (crits: a bigger, golden one with a star)
export function slash(src, dst, col, o = {}) {
  if (!S.scene || !dst.mesh || !dst.mesh.root.visible) return;
  const dx = dst.x - src.x, dz = dst.z - src.z, l = Math.hypot(dx, dz) || 1, x = dst.x - dx / l * 0.15, z = dst.z - dz / l * 0.15, y = 0.75 + (dst.kind === 'brute' ? 0.15 : 0);
  const big = o.crit || o.heavy, c = o.crit ? 0xffc83a : col, flip = Math.random() < 0.5 ? 1 : -1;
  flash(CRESCENT, x, y, z, c, big ? 1.45 : 1.05, big ? 0.2 : 0.15, { rot: screenAng(dx, dz) + Math.PI / 2 + flip * (0.5 + Math.random() * 0.5), s0: 0.75, s1: 1.2, spin: flip * 3, op: 0.85 });
  flash(GLOW, x, y, z, o.crit ? 0xffd080 : 0xffeedd, big ? 0.9 : 0.55, 0.09, { s0: 1, s1: 1.4, op: 0.75 });
  if (big) flash(STAR, x, y, z, o.crit ? 0xffe090 : col, o.crit ? 1.3 : 1.0, 0.16, { rot: Math.random() * 3, s0: 0.5, s1: 1.25, spin: 4, op: 0.85 });
  if (S.parts) { S.parts.emit(x, y, z, big ? 9 : 5, { col: o.crit ? 0xffd25a : 0xfff0d8, spd: big ? 4.2 : 3, up: 1.6, grav: 9, life: 0.28, size: 0.1, spread: 0.1 });
    S.parts.emit(x, y - 0.1, z, big ? 4 : 2, { col: 0xd8ccb8, spd: 1.8, up: 1.8, grav: 7, life: 0.45, size: 0.14 }); } // bone chips
}
// a bolt, arrow or spear landing: a smaller flash and a puff of sparks
export function impact(x, y, z, col, size = 0.8) { if (!S.scene) return; flash(GLOW, x, y, z, col, size, 0.1, { s0: 0.8, s1: 1.4, op: 0.95 }); if (S.parts) S.parts.emit(x, y, z, 4, { col, spd: 2.6, up: 1.2, grav: 8, life: 0.22, size: 0.1 }); }
// a big blast: a bright flash plus a star burst
export function burst(x, y, z, col, size) { if (!S.scene) return; flash(GLOW, x, y, z, col, size, 0.16, { s0: 0.6, s1: 1.5, op: 0.6 }); flash(STAR, x, y, z, col, size * 0.75, 0.14, { rot: Math.random() * 3, s0: 0.4, s1: 1.3, spin: 3, op: 0.55 }); }

// ---------- skill marks ----------
// 旋风斩: a whirl of blade light around the warrior while it spins
const SWIRL = canvasTex((g, n) => { const m = n / 2; g.translate(m, m); g.lineCap = 'round';
  for (let k = 0; k < 4; k++) { const a0 = k * Math.PI / 2; for (let i = 0; i < 48; i++) { const f = i / 48, a = a0 + f * 1.9, r = m * (0.66 + 0.26 * f);
    g.strokeStyle = `rgba(255,255,255,${(f * f * f * 0.95).toFixed(3)})`; g.lineWidth = 1.5 + f * m * 0.055; g.beginPath(); g.arc(0, 0, r, a, a + 0.06); g.stroke(); } }
  const gr = g.createRadialGradient(0, 0, m * 0.5, 0, 0, m); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, m, 0, Math.PI * 2); g.fill(); }, 256);
// 跳劈: the ground cracks where the warrior lands
const CRACK = canvasTex((g, n) => { const m = n / 2; g.translate(m, m); g.lineCap = 'round'; g.lineJoin = 'round';
  const branch = (x, y, a, len, w) => { if (len < 6 || w < 0.6) return; const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x1, y1); g.stroke(); branch(x1, y1, a + (Math.random() - 0.5) * 0.9, len * 0.72, w * 0.72); if (Math.random() < 0.45) branch(x1, y1, a + (Math.random() < 0.5 ? 0.7 : -0.7), len * 0.55, w * 0.6); };
  g.strokeStyle = 'rgba(20,14,12,0.9)'; for (let k = 0; k < 9; k++) branch(0, 0, k / 9 * Math.PI * 2 + Math.random() * 0.4, m * 0.24, 7);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.35); gr.addColorStop(0, 'rgba(30,22,18,0.75)'); gr.addColorStop(1, 'rgba(30,22,18,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, m * 0.35, 0, Math.PI * 2); g.fill(); }, 256);
const MARKS = [];
export function spinFx(u, col = 0x5fe8dc) { if (!S.scene) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 4.1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: SWIRL, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.y = 0.55; m.renderOrder = 4; u.mesh.root.add(m); MARKS.push({ m, t: 0, life: 1.1, kind: 'spin', parent: u.mesh.root }); }
export function slamMark(x, z) { if (!S.scene) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: CRACK, transparent: true, opacity: 0.85, depthWrite: false })); m.rotation.y = Math.random() * 6.28; m.position.set(x, 0.07, z); m.renderOrder = 1; S.scene.add(m);
  MARKS.push({ m, t: 0, life: 2.2, kind: 'crack', parent: S.scene }); }
function updateMarks(dt) { let j = 0;
  for (const k of MARKS) { k.t += dt; const f = k.t / k.life; if (f >= 1) { k.parent.remove(k.m); k.m.geometry.dispose(); k.m.material.dispose(); continue; }
    if (k.kind === 'spin') { k.m.rotation.y -= dt * 17; k.m.material.opacity = Math.min(1, f * 8) * (f > 0.75 ? (1 - f) / 0.25 : 1) * 0.75; k.m.scale.setScalar(0.85 + 0.2 * Math.min(1, f * 4)); }
    else if (k.kind === 'wave') { const q = Math.max(0, f); k.m.scale.setScalar(Math.max(0.01, (k.R / 0.95) * (1 - (1 - q) * (1 - q)))); k.m.material.opacity = 0.95 * (1 - q); }
    else k.m.material.opacity = 0.85 * Math.min(1, (1 - f) * 2.5);
    MARKS[j++] = k; } MARKS.length = j; }

// ---------- bones flying off a skeleton that falls (instanced: one draw per bone shape however many are in the air) ----------
const DEB = { types: ['bone_A', 'bone_B', 'bone_C'], ms: null, list: [], cap: 90 }, DM = new THREE.Matrix4(), DQ = new THREE.Quaternion(), DE = new THREE.Euler(), DP = new THREE.Vector3(), DS = new THREE.Vector3();
function debMeshes() { if (DEB.ms) return DEB.ms;
  DEB.ms = DEB.types.map(n => { const pg = propGeo(n), im = new THREE.InstancedMesh(pg.geo, propMat(pg.map), DEB.cap); im.count = 0; im.frustumCulled = false; S.scene.add(im); return im; }); return DEB.ms; }
// n pieces from (x, y, z), thrown mostly along (dx, dz) with the given force
export function debris(x, y, z, dx, dz, n, force) { if (!S.scene) return; debMeshes(); const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  for (let i = 0; i < n; i++) { const t = Math.floor(Math.random() * DEB.types.length); if (DEB.list.filter(p => p.t === t).length >= DEB.cap) continue;
    const a = (Math.random() - 0.5) * 2.2, c = Math.cos(a), s2 = Math.sin(a), f = force * (0.45 + Math.random() * 0.7), r = () => (Math.random() - 0.5) * 2;
    DEB.list.push({ t, x: x + r() * 0.15, y: y + Math.random() * 0.3, z: z + r() * 0.15, vx: (dx * c - dz * s2) * f + r() * 0.6, vy: 2.2 + Math.random() * 2.6 + force * 0.25, vz: (dx * s2 + dz * c) * f + r() * 0.6,
      rx: r() * 3, ry: r() * 3, rz: r() * 3, wx: r() * 14, wy: r() * 10, wz: r() * 14, s: 0.38 + Math.random() * 0.17, age: 0, life: 2.6 + Math.random() * 1.2 }); } }
function updateDebris(dt) { if (!DEB.ms) return; const F = G.floor; let j = 0;
  for (const p of DEB.list) { p.age += dt; if (p.age >= p.life) continue; DEB.list[j++] = p;
    if (p.vy !== 0 || p.vx || p.vz) { p.vy -= 16 * dt; const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt; if (F && !F.walk(nx, nz)) { p.vx *= -0.35; p.vz *= -0.35; } else { p.x = nx; p.z = nz; } p.y += p.vy * dt;
      p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
      if (p.y < 0.05) { p.y = 0.05; if (p.vy < -1.6) { p.vy *= -0.32; p.vx *= 0.55; p.vz *= 0.55; p.wx *= 0.5; p.wy *= 0.5; p.wz *= 0.5; } // bounce and clatter
        else { p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; p.wx = p.wz = 0; p.rx = Math.round(p.rx / Math.PI) * Math.PI; p.rz = Math.round(p.rz / Math.PI) * Math.PI; if (Math.abs(p.vx) + Math.abs(p.vz) < 0.05) p.vx = p.vz = 0; } } } }
  DEB.list.length = j; const cnt = DEB.ms.map(() => 0);
  for (const p of DEB.list) { const im = DEB.ms[p.t], k = Math.min(1, (p.life - p.age) / 0.4), sc = p.s * k; DE.set(p.rx, p.ry, p.rz); DQ.setFromEuler(DE); DM.compose(DP.set(p.x, p.y, p.z), DQ, DS.set(sc, sc, sc)); im.setMatrixAt(cnt[p.t]++, DM); }
  DEB.ms.forEach((im, i) => { im.count = cnt[i]; im.instanceMatrix.needsUpdate = true; }); }
// leaving a floor: drop what is still lying around or in the air
export function clearFx() { DEB.list.length = 0; if (DEB.ms) for (const im of DEB.ms) im.count = 0;
  for (const L of LIVE) { S.scene.remove(L.s); POOL.push(L.s); } LIVE.length = 0; for (const k of MARKS) k.parent.remove(k.m); MARKS.length = 0; TR.list.clear(); }

// ---------- 机甲骷髅: the shield field (a bubble of soul energy with a hex lattice that flares where it is hit) and the EMP shockwave ----------
const DOME_V = `varying vec3 vN; varying vec3 vW; varying vec3 vP; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const DOME_F = `uniform vec3 uCol; uniform float uT; uniform float uHit; uniform float uOp; varying vec3 vN; varying vec3 vW; varying vec3 vP;
float hexLine(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; vec2 f = abs(fract(p) - 0.5); return smoothstep(0.38, 0.47, max(f.x * 1.5 + f.y, f.y * 2.0)); }
void main(){
  vec3 V = normalize(cameraPosition - vW); float fr = 1.0 - abs(dot(normalize(vN), V)); fr = pow(fr, 2.2);
  vec3 n = normalize(vP); vec2 uv = vec2(atan(n.z, n.x) * 2.6, n.y * 4.2 - uT * 0.35);
  float hx = hexLine(uv), sweep = smoothstep(0.92, 1.0, sin(n.y * 6.0 - uT * 3.0));
  float a = (0.015 + 0.42 * fr + 0.14 * hx * (0.25 + fr) + 0.1 * sweep * (0.3 + fr) + uHit * (0.06 + 0.22 * hx + 0.2 * fr)) * uOp;
  gl_FragColor = vec4(uCol * a, 1.0);
}`;
const DOMES = [], DOME_G = new THREE.SphereGeometry(1, 28, 16);
export function shieldDome(u, col = 0x56c8ff) { if (!S.scene) return null;
  const m = new THREE.Mesh(DOME_G, new THREE.ShaderMaterial({ vertexShader: DOME_V, fragmentShader: DOME_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(col) }, uT: { value: 0 }, uHit: { value: 0 }, uOp: { value: 0 } } }));
  m.position.y = 0.7; m.scale.set(1.25, 1.1, 1.25); m.renderOrder = 4; u.mesh.root.add(m); const d = { u, m, t: 0, end: false }; DOMES.push(d); return d; }
export function domeHit(d) { if (d) d.m.material.uniforms.uHit.value = 1; }
export function domeEnd(d) { if (d) d.end = true; }
function updateDomes(dt) { let j = 0;
  for (const d of DOMES) { const U = d.m.material.uniforms; d.t += dt; U.uT.value += dt; U.uHit.value = Math.max(0, U.uHit.value - dt * 5);
    U.uOp.value = d.end ? Math.max(0, U.uOp.value - dt * 4) : Math.min(1, d.t * 5); const sc = d.end ? 1 + (1 - U.uOp.value) * 0.25 : 0.6 + 0.4 * Math.min(1, d.t * 5);
    d.m.scale.set(1.25 * sc, 1.1 * sc, 1.25 * sc);
    if ((d.end && U.uOp.value <= 0) || d.u.dead) { d.m.parent && d.m.parent.remove(d.m); d.m.material.dispose(); continue; } DOMES[j++] = d; } DOMES.length = j; }
// an electromagnetic shockwave rolling out from (x, z) to radius R: a bright core, two rings, sparks thrown out along the ground
export function empWave(x, z, R) { if (!S.scene) return;
  burst(x, 0.8, z, 0x9fe8ff, 3.2); flash(STAR, x, 0.9, z, 0xd8b0ff, 3.6, 0.22, { rot: Math.random() * 3, s0: 0.3, s1: 1.4, spin: 2, op: 0.9 });
  for (const [c, w, d] of [[0x8fe8ff, 0.3, 0], [0xe4f8ff, 0.1, 0.06]]) { const rg = ring(0.75, 0.75 + w, c, 0.95); rg.position.set(x, 0.08 + d, z); S.scene.add(rg);
    MARKS.push({ m: rg, t: -d, life: 0.42, kind: 'wave', parent: S.scene, R }); }
  if (S.parts) for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; S.parts.emit(x + Math.cos(a) * 0.6, 0.35, z + Math.sin(a) * 0.6, 1, { col: i % 2 ? 0x9fe8ff : 0xe0c0ff, spd: 7, up: 0.4, grav: 1, life: 0.35, size: 0.2, spread: 0 }); }
  shake(0.13, x, z); }

// ---------- camera shake: amount in metres; fades with distance from the summoner ----------
export function shake(a, x, z) { if (!shakeOn) return; const P = G.player; const k = P && x != null ? Math.max(0, 1 - Math.hypot(x - P.x, z - P.z) / 14) : 1; S.shakeA = Math.min(0.35, Math.max(S.shakeA, a * k)); }
const SH = new THREE.Vector3();
export function shakeOffset() { const a = S.shakeA, t = S.shakeT; if (a < 0.002) return SH.set(0, 0, 0);
  return SH.set(Math.sin(t * 71 + S.ph[0]) * a, Math.sin(t * 89 + S.ph[1]) * a * 0.6, Math.sin(t * 83 + S.ph[2]) * a); }

// ---------- weapon trails: a ribbon behind the blade while it sweeps (bright where it moves fast, gone when it slows) ----------
const CAP = 3600, TLIFE = 0.13;
const TR = (() => { const g = new THREE.BufferGeometry(), pos = new Float32Array(CAP * 3), col = new Float32Array(CAP * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.renderOrder = 4; return { g, pos, col, mesh, list: new Map() }; })();
export function trail(u, dur) { if (u.mesh && u.mesh.blade) u.trailT = Math.max(u.trailT || 0, dur); }
const WA = new THREE.Vector3(), WB = new THREE.Vector3(), TC = new THREE.Color();
function updateTrails(dt, units) {
  for (const u of units) { if (!(u.trailT > 0)) continue; u.trailT -= dt; const bl = u.mesh.blade; if (!bl || u.dead || !u.mesh.root.visible) continue;
    let tr = TR.list.get(u); if (!tr) TR.list.set(u, tr = { pts: [], col: bl.col });
    bl.a.getWorldPosition(WA); bl.b.getWorldPosition(WB); const last = tr.pts[tr.pts.length - 1], sp = last ? WB.distanceTo(last.b) / Math.max(dt, 1e-3) : 0;
    tr.pts.push({ a: WA.clone(), b: WB.clone(), age: 0, w: Math.min(1, Math.max(0, (sp - 2.2) / 5)) }); }
  let n = 0; const P = TR.pos, Cc = TR.col;
  for (const [u, tr] of TR.list) { for (const p of tr.pts) p.age += dt; while (tr.pts.length && tr.pts[0].age > TLIFE) tr.pts.shift();
    if (!tr.pts.length && (!(u.trailT > 0) || u.dead || !u.mesh.root.visible)) { TR.list.delete(u); continue; }
    TC.setHex(tr.col);
    for (let i = 0; i + 1 < tr.pts.length && n + 6 <= CAP; i++) { const p = tr.pts[i], q = tr.pts[i + 1], fp = p.w * (1 - p.age / TLIFE), fq = q.w * (1 - q.age / TLIFE);
      if (fp + fq < 0.02) continue;
      const v = [[p.a, fp * 0.1], [p.b, fp], [q.a, fq * 0.1], [q.b, fq], [q.a, fq * 0.1], [p.b, fp]];
      for (const [w, f] of v) { P[n * 3] = w.x; P[n * 3 + 1] = w.y; P[n * 3 + 2] = w.z; Cc[n * 3] = TC.r * f; Cc[n * 3 + 1] = TC.g * f; Cc[n * 3 + 2] = TC.b * f; n++; } } }
  TR.g.setDrawRange(0, n); TR.g.attributes.position.needsUpdate = true; TR.g.attributes.color.needsUpdate = true; TR.g.boundingSphere = null;
}

export function updateFx(dt, units) {
  let j = 0; for (const L of LIVE) { L.t += dt; const k = L.t / L.life; if (k >= 1) { S.scene.remove(L.s); POOL.push(L.s); continue; }
    const e = 1 - (1 - k) * (1 - k); L.s.scale.setScalar(L.size * (L.s0 + (L.s1 - L.s0) * e)); L.s.material.opacity = L.op * (1 - k * k); L.s.material.rotation += L.spin * dt * (1 - k); LIVE[j++] = L; }
  LIVE.length = j;
  S.shakeT += dt; S.shakeA *= Math.exp(-dt * 11); if (S.shakeA < 0.002) S.shakeA = 0;
  updateTrails(dt, units); updateMarks(dt); updateDebris(dt); updateDomes(dt);
}
