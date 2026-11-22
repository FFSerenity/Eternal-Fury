import * as THREE from 'three';
import { G, save, load, wipe } from './state.js';
import { PACKS, SKILLS, xpNeed, partySize, MODS } from './data.js';
import { SH, Shadows, Particles, ring } from './gfx.js';
import { Floor, setNavTime } from './world.js';
import { C, Unit, updateUnit, integrate, updateCorpses, updateShots, shoot, finishRaise, spawnAlly, damage, say, captureChance } from './units.js';
import { IN, initUI, resizeUI, updateHUD, drawOverlay, message, pickCorpse, touchUI, closeCrypt } from './ui.js';
import { S, unlock } from './audio.js';

const $ = s => document.querySelector(s), QS = new URLSearchParams(location.search);
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.setClearColor(0x07060a);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.5, 80);
const shadows = new Shadows(scene), parts = new Particles(scene);
C.scene = scene; C.parts = parts; C.say = (t, big) => message(t, big);

// ---------- quality: pixel ratio steps down if frames keep arriving late ----------
const DPR = Math.min(devicePixelRatio || 1, 2), RS_STEPS = [DPR, Math.max(1, DPR * 0.75), Math.max(1, DPR * 0.6), 1];
let qLvl = 0, RS = QS.has('rs') ? +QS.get('rs') : DPR; const PM = { t: 0, n: 0, slow: 0, cool: 4000, ft: 0, fn: 0, fps: 60 };
let VW = 0, VH = 0;
function resize() { VW = innerWidth; VH = innerHeight; renderer.setPixelRatio(RS); renderer.setSize(VW, VH, false); canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
  camera.aspect = VW / VH; camera.updateProjectionMatrix(); resizeUI(VW, VH); parts.mat.uniforms.uScale.value = VH * RS * 1.37; }
addEventListener('resize', resize); resize();
function perf(ms) { PM.ft += ms; PM.fn++; if (PM.ft > 500) { PM.fps = Math.round(PM.fn * 1000 / PM.ft); PM.ft = PM.fn = 0; }
  if (QS.has('rs') || document.hidden || ms > 500 || !started) return; if (PM.cool > 0) { PM.cool -= ms; return; }
  PM.t += ms; PM.n++; if (ms > 24) PM.slow++; if (PM.t > 2500) { if (PM.n > 20 && PM.slow > PM.n * 0.25 && qLvl < 3) { qLvl++; RS = RS_STEPS[qLvl]; resize(); PM.cool = 3000; } PM.t = PM.n = PM.slow = 0; } }

// ---------- camera: fixed diagonal view that follows the summoner ----------
const YAW = Math.PI / 4, PITCH = 0.97; const camT = new THREE.Vector3();
function placeCamera(snap) {
  const P = G.player; const D = 21 * (VW < VH ? 1.3 : 1); camT.set(P.x, 0, P.z);
  const target = new THREE.Vector3(P.x + Math.sin(YAW) * Math.cos(PITCH) * D, Math.sin(PITCH) * D, P.z + Math.cos(YAW) * Math.cos(PITCH) * D);
  if (snap) camera.position.copy(target); else camera.position.lerp(target, 0.12); camera.lookAt(camera.position.x - Math.sin(YAW) * Math.cos(PITCH) * D, 0.6, camera.position.z - Math.cos(YAW) * Math.cos(PITCH) * D);
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
function groundAt(cx, cy) { ndc.set(cx / VW * 2 - 1, -(cy / VH) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null; }
initUI({ camera, groundAt, canvas });

// ---------- floors ----------
let packId = 1;
function makeFloor(depth) {
  for (const u of G.units) if (u.side !== 'player') u.remove(); for (const c of G.corpses) scene.remove(c.mesh.root); for (const s of G.shots) scene.remove(s.root);
  G.units = G.player ? [G.player] : []; G.corpses = []; G.shots = []; G.fx = []; G.focus = null;
  if (G.floor) G.floor.dispose(scene);
  const F = new Floor((Date.now() ^ (depth * 7919)) >>> 0, depth); F.build(scene); C.floor = F; G.floor = F; G.depth = depth;
  const R = F.R, st = F.start;
  if (!G.player) { G.player = new Unit('player', 'player', st.cx, st.cy, { level: G.level }); G.units.push(G.player); }
  const P = G.player; P.x = st.cx; P.z = st.cy; P.vx = P.vz = 0; P.dead = false; P.state = 'idle'; P.level = G.level; P.stats(); P.hp = P.maxHp; P.mp = P.maxMp; P.face = Math.PI * 1.25;
  for (const en of G.crypt) { en.unit = null; if (en.active && en.reviveT <= 0) spawnAlly(en); }
  // monster packs in every other room; some packs get a champion with an affix
  const byDist = F.rooms.slice(1).sort((a, b) => Math.hypot(a.cx - st.cx, a.cy - st.cy) - Math.hypot(b.cx - st.cx, b.cy - st.cy));
  for (const r of byDist) { const near = byDist.indexOf(r), n = r.w * r.h > 90 ? 2 : 1;
    for (let k = 0; k < n; k++) { const easy = depth === 1 && near < 2, tpl = easy ? (near === 0 ? [['imp', 2]] : [['imp', 2], ['archer', 1]]) : PACKS[Math.floor(R() * PACKS.length)], c0 = F.randomSpot(r), pid = packId++; const units = [];
      if (easy && k > 0) break;
      for (const [type, cnt] of tpl) { const extra = type === 'imp' ? Math.floor(depth / 3) : 0; for (let j = 0; j < cnt + extra; j++) {
        let x = c0.x + (R() - 0.5) * 3, z = c0.z + (R() - 0.5) * 3; if (!F.walk(x, z)) { x = c0.x; z = c0.z; }
        units.push(new Unit(type, 'enemy', x, z, { level: depth + (R() < 0.25 ? 1 : 0), packId: pid })); } }
      if (!easy && R() < 0.1 + 0.05 * depth) { const cand = units.filter(u => u.kind !== 'imp'), u0 = cand.length ? cand[Math.floor(R() * cand.length)] : units[0], keys = Object.keys(MODS);
        u0.remove(); const ch = new Unit(u0.kind, 'enemy', u0.x, u0.z, { level: depth + 1, packId: pid, champ: true, mods: [keys[Math.floor(R() * keys.length)]] }); units[units.indexOf(u0)] = ch; }
      G.units.push(...units); } }
  placeCamera(true); message(`墓穴 · 第 ${depth} 层`, true); save();
}

// ---------- the summoner ----------
function castSpear(P, tx, tz) { if (P.spearCD > 0 || P.mp < SKILLS.spear.mana) return false; P.mp -= SKILLS.spear.mana; P.spearCD = SKILLS.spear.cd; P.faceT = Math.atan2(tx - P.x, tz - P.z); P.atkT = 0.2;
  shoot(P, 'spear', tx, tz, { dmg: P.dmg, life: 0.75 }); return true; }
function nearestEnemy(P, maxD) { let b = null, bd = maxD; if (G.focus && !G.focus.dead && Math.hypot(G.focus.x - P.x, G.focus.z - P.z) < maxD && G.floor.los(P.x, P.z, G.focus.x, G.focus.z)) return G.focus;
  for (const e of G.enemies) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd && G.floor.los(P.x, P.z, e.x, e.z)) { bd = d; b = e; } } return b; }
const tmp = { x: 0, z: 0 };
function updatePlayer(dt) {
  const P = G.player, F = G.floor; P.flash = Math.max(0, P.flash - dt * 5);
  if (P.dead) { P.wantX = P.wantZ = 0; P.respawnT -= dt; if (P.respawnT <= 0) { P.dead = false; P.state = 'idle'; P.hp = P.maxHp; P.mp = P.maxMp; P.x = F.start.cx; P.z = F.start.cy; P.mesh.root.visible = true;
      for (const en of G.crypt) if (en.unit && !en.unit.dead) { en.unit.x = P.x + 1; en.unit.z = P.z; } message('你在入口处重新站了起来'); } else P.mesh.root.visible = P.respawnT > 2.2; return; }
  const fighting = G.enemies.some(e => e.aggro && Math.hypot(e.x - P.x, e.z - P.z) < 12);
  P.mp = Math.min(P.maxMp, P.mp + (fighting ? 4 : 8) * dt); P.hp = Math.min(P.maxHp, P.hp + P.maxHp * (fighting ? 0.004 : 0.03) * dt);
  P.spearCD = (P.spearCD || 0) - dt; P.mendCD = (P.mendCD || 0) - dt; P.atkT = (P.atkT || 0) - dt;
  const moving = IN.joy || (IN.hold && IN.moveTo);
  // channelling 唤魂 on a corpse
  if (P.state === 'channel') { P.wantX = P.wantZ = 0; P.st += dt;
    if (!G.corpses.includes(P.chanC) || moving) { if (P.chanC) P.chanC.claim = null; P.state = 'idle'; P.chanC = null; }
    else if (P.st >= SKILLS.raise.channel) { const c = P.chanC; c.claim = null; P.state = 'idle'; P.chanC = null; finishRaise(c); }
    return; }
  // 唤魂 request
  if (IN.raiseKey) { IN.raiseKey = false; const from = !touchUI && IN.cursor ? IN.cursor : P; let c = pickCorpse(from, touchUI ? SKILLS.raise.range : 2.5) || pickCorpse(P, SKILLS.raise.range);
    if (c) IN.raise = c; else message('附近没有可以唤魂的尸体'); }
  if (IN.raise) { const c = IN.raise; if (!G.corpses.includes(c) || c.claim) IN.raise = null;
    else { const d = Math.hypot(c.x - P.x, c.z - P.z);
      if (d > SKILLS.raise.range) { F.dirTo(P.x, P.z, c.x, c.z, tmp); P.wantX = tmp.x * P.speed; P.wantZ = tmp.z * P.speed; if (moving) IN.raise = null; else return; }
      else if (P.mp < SKILLS.raise.mana) { message('法力不足'); IN.raise = null; }
      else { P.mp -= SKILLS.raise.mana; P.state = 'channel'; P.st = 0; P.chanC = c; c.claim = P; IN.raise = null; P.faceT = Math.atan2(c.x - P.x, c.z - P.z); S.raise(); return; } } }
  // 愈合
  if (IN.mend) { IN.mend = false; if (P.mendCD > 0) message('愈合冷却中'); else if (P.mp < SKILLS.mend.mana) message('法力不足'); else { P.mp -= SKILLS.mend.mana; P.mendCD = SKILLS.mend.cd; S.heal();
    const rg = ring(0.3, 0.6, 0x7dff9a, 0.9); rg.position.set(P.x, 0.05, P.z); scene.add(rg); G.fx.push({ t: 0.5, tick: k => { rg.scale.setScalar(1 + k * 14); rg.material.opacity = 0.9 * (1 - k); }, fn: () => scene.remove(rg) });
    for (const f of G.friends) { if (Math.hypot(f.x - P.x, f.z - P.z) > 9) continue; const h = f.maxHp * (f === P ? 0.12 : 0.3); f.hp = Math.min(f.maxHp, f.hp + h); say(f.x, f.z, '+' + Math.round(h), '#7dff9a', 15);
      parts.emit(f.x, 0.6, f.z, 10, { col: 0x7dff9a, spd: 0.8, up: 2.5, life: 0.8, grav: -1 }); } } }
  // attacks
  let shooting = false;
  if (IN.castAt) { if (castSpear(P, IN.castAt.x, IN.castAt.z) && !IN.castHold) IN.castAt = null; shooting = true; if (!IN.castHold && P.spearCD > 0) IN.castAt = null; }
  if (IN.autoAtk) { const e = nearestEnemy(P, 10.5); if (e) { G.focus = e; castSpear(P, e.x, e.z); shooting = true; } else if (P.spearCD <= 0) castSpear(P, P.x + Math.sin(P.face) * 5, P.z + Math.cos(P.face) * 5); }
  if (IN.attack && !moving) { const e = IN.attack; if (e.dead) IN.attack = null;
    else { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < 10 && F.los(P.x, P.z, e.x, e.z)) { if (castSpear(P, e.x, e.z)) IN.attack = null; shooting = true; }
      else { F.dirTo(P.x, P.z, e.x, e.z, tmp); P.wantX = tmp.x * P.speed; P.wantZ = tmp.z * P.speed; return; } } }
  // movement
  if (IN.joy) { IN.moveTo = null; IN.attack = null; P.wantX = IN.joy.x * P.speed; P.wantZ = IN.joy.z * P.speed; }
  else if (IN.moveTo && !shooting) { const d = Math.hypot(IN.moveTo.x - P.x, IN.moveTo.z - P.z);
    if (d < 0.2) { P.wantX = P.wantZ = 0; if (!IN.hold) IN.moveTo = null; } else { F.dirTo(P.x, P.z, IN.moveTo.x, IN.moveTo.z, tmp); const s = P.speed * Math.min(1, d / 0.6 + 0.2); P.wantX = tmp.x * s; P.wantZ = tmp.z * s; } }
  else { P.wantX = P.wantZ = 0; }
  if (shooting && !IN.joy) { P.wantX = P.wantZ = 0; }
  // stairs
  const ns = Math.hypot(P.x - F.stairs.x, P.z - F.stairs.z) < 1.3;
  if (IN.stairs && ns) { IN.stairs = false; IN.moveTo = null; S.stairs(); closeCrypt(); makeFloor(G.depth + 1); } else if (IN.stairs && !IN.moveTo) IN.stairs = false;
}

// ---------- start screen ----------
let started = false;
const hasSave = load();
$('#startMsg').textContent = hasSave ? `继续：Lv ${G.level} · 墓典 ${G.crypt.length} 只 · 第 ${G.depth} 层` : '第一次进入墓穴';
$('#help').innerHTML = touchUI ? '左半屏拖动：移动　·　右下「骨矛」按住连发（自动瞄准）<br>打倒怪物后按「唤魂」收服尸体　·　「墓典」编辑出战' :
  '左键：移动 / 点怪攻击　·　右键：朝鼠标方向放骨矛（Shift+左键同效）<br>Q：唤魂（收服鼠标附近的尸体）　·　W：愈合　·　Tab：墓典　·　走到楼梯点击或按 Enter 下楼';
$('#bStart').addEventListener('click', () => { unlock(); $('#start').classList.add('hide'); started = true; });
$('#bNew').addEventListener('click', () => { if (!confirm('清除存档重新开始？')) return; wipe(); location.reload(); });
makeFloor(G.depth);

// ---------- main loop ----------
let last = performance.now();
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); last = performance.now(); PM.cool = 2000; });
function loop(now) {
  requestAnimationFrame(loop);
  const ms = now - last; last = now; perf(ms); const dt = Math.min(0.05, ms / 1000); if (dt <= 0) return;
  if (started) { G.t += dt; setNavTime(G.t);
    const P = G.player;
    G.enemies = []; G.friends = []; for (const u of G.units) { if (u.dead) continue; if (u.side === 'enemy') G.enemies.push(u); else G.friends.push(u); }
    updatePlayer(dt);
    const active = [];
    for (const u of G.units) { if (u.dead || u === P) continue; if (u.side === 'enemy' && !u.aggro && Math.hypot(u.x - P.x, u.z - P.z) > 26) { u.mesh.root.visible = false; continue; } u.mesh.root.visible = true; updateUnit(u, dt); active.push(u); }
    if (!P.dead) active.push(P); integrate(active, dt);
    updateShots(dt); updateCorpses(dt);
    let j = 0; for (const f of G.fx) { f.t -= dt; f.k = (f.k || 0) + dt; if (f.tick) f.tick(Math.min(1, f.k / (f.k + Math.max(0, f.t)))); if (f.t <= 0) { f.fn && f.fn(); continue; } G.fx[j++] = f; } G.fx.length = j;
    G.units = G.units.filter(u => !u.dead || u === P);
    // revive timers (a shaman in the party speeds them up)
    const shaman = G.friends.some(f => f.side === 'ally' && f.kind === 'shaman');
    for (const en of G.crypt) if (en.active && en.reviveT > 0) { en.reviveT -= dt * (shaman ? 1.4 : 1); if (en.reviveT <= 0) { en.reviveT = 0; if (!P.dead) { spawnAlly(en); S.revive(); message(`${en.champ && en.mods[0] ? MODS[en.mods[0]].name : ''}${({ imp: '小鬼', brute: '墓穴蛮兵', archer: '骷髅弓手', shaman: '腐巫' })[en.type]} 复原了`); } } }
    G.floor.stairsGlow.material.opacity = 0.55 + 0.25 * Math.sin(G.t * 2.5);
  }
  const P = G.player;
  placeCamera(false);
  SH.uLight.value.set(P.x, 1.6, P.z);
  camera.updateMatrixWorld(); const v = new THREE.Vector3(P.x, 0.8, P.z), vz = v.clone().applyMatrix4(camera.matrixWorldInverse).z; v.project(camera);
  const bw = VW * RS, bh = VH * RS; SH.uCutC.value.set((v.x + 1) / 2 * bw, (v.y + 1) / 2 * bh); SH.uCutR.value = Math.min(bw, bh) * 0.17; SH.uCutZ.value = vz;
  shadows.begin(); for (const u of G.units) if (!u.dead && u.mesh.root.visible && !(u === P && P.dead)) shadows.add(u.x, u.z, u.r * (u.champ ? 1.25 : 1)); shadows.end();
  parts.update(dt);
  P.mesh.mat.uniforms.uFlash.value = P.flash * 0.6;
  renderer.render(scene, camera);
  drawOverlay(); updateHUD(dt, PM.fps);
}
requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });
window.__gt = { G, IN, makeFloor, get RS() { return RS; }, camera, groundAt, Unit, spawnAlly, damage };
