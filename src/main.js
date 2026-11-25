import * as THREE from 'three';
import { G, save, load, wipe, bagPut, PACT, MODE, setMode } from './state.js';
import { pactPlayer, pactFloor, pactTick, harvest, heroEntry, pactMigrate } from './pact.js';
import { initJar, jarTick, jarDraw, jarReset } from './soulvessel.js';
import { openBox, boxTick } from './loot.js';
import { PACKS, WILD_PACKS, SKILLS, xpNeed, partySize, MODS, TYPES, rollItem, rollHeroItem, PACE, affixName, TECH, makeTech } from './data.js';
import { SH, Shadows, Particles, ring, TORCH_N, AURA_T, auraMat } from './gfx.js';
import { A, loadAll, propGeo, PropBatch, heroWeaponPose, heroPart } from './assets.js';
import * as PFX from './pactfx.js';
import './gun.js';
import './tech.js';
import './forest.js';
import './foes.js';
import { makeIcons } from './icons.js';
import { tr, ZH } from './i18n.js';
import { SoulChannel } from './vfx.js';
import { initFx, updateFx, shakeOffset, clearFx } from './fx.js';
import { clearTechFx, droneShadows } from './drones.js';
import * as FXM from './fx.js';
import { Floor, setNavTime } from './world.js';
import { openCoffin, setGear, addXP } from './units.js';
import { C, Unit, mkEnemy, updateUnit, integrate, updateCorpses, updateShots, shoot, finishRaise, spawnAlly, damage, say, captureChance, playerAnim, updateGhosts, rk, updateHazards, slowK, updateLoot, dropLoot, fuse, fusionOdds } from './units.js';
import { IN, initUI, resizeUI, updateHUD, drawOverlay, message, pickCorpse, touchUI, closeCrypt, goFull } from './ui.js';
import { initMap, updateMap } from './minimap.js';
import { initArena, arenaTick } from './arena.js';
import { placeBoss, bossTick, stairsLocked, clearBossBar } from './boss.js';
import { S, unlock } from './audio.js';

const $ = s => document.querySelector(s), QS = new URLSearchParams(location.search);
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.setClearColor(0x07060a);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.5, 80);
const shadows = new Shadows(scene), parts = new Particles(scene);
C.scene = scene; C.parts = parts; C.say = (t, big, ms) => message(t, big, ms); initFx(scene, parts);

// ---------- quality: pixel ratio steps down if frames keep arriving late ----------
const DPR = Math.min(devicePixelRatio || 1, 2), RS_STEPS = [DPR, Math.max(1, DPR * 0.75), Math.max(1, DPR * 0.6), 1];
let qLvl = 0, RS = QS.has('rs') ? +QS.get('rs') : DPR; const PM = { t: 0, n: 0, slow: 0, cool: 4000, ft: 0, fn: 0, fps: 60 };
let VW = 0, VH = 0;
function resize() { VW = innerWidth; VH = innerHeight; renderer.setPixelRatio(RS); renderer.setSize(VW, VH, false); canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
  camera.aspect = VW / VH; camera.updateProjectionMatrix(); resizeUI(VW, VH); parts.mat.uniforms.uScale.value = VH * RS * 1.37; }
// phones report the new size late (and in steps) after a rotation or when the browser bars move: re-check a few times
const fitSoon = () => { resize(); for (const d of [120, 400, 900]) setTimeout(() => { if (innerWidth !== VW || innerHeight !== VH) resize(); if (scrollY || scrollX) scrollTo(0, 0); }, d); };
addEventListener('resize', fitSoon); addEventListener('orientationchange', fitSoon); if (window.visualViewport) visualViewport.addEventListener('resize', fitSoon);
document.addEventListener('fullscreenchange', fitSoon); document.addEventListener('webkitfullscreenchange', fitSoon); resize();
setInterval(() => { if (innerWidth !== VW || innerHeight !== VH) resize(); }, 600); // safety net for missed resize events
function perf(ms) { PM.ft += ms; PM.fn++; if (PM.ft > 500) { PM.fps = Math.round(PM.fn * 1000 / PM.ft); PM.ft = PM.fn = 0; }
  if (QS.has('rs') || document.hidden || ms > 500 || !started) return; if (PM.cool > 0) { PM.cool -= ms; return; }
  PM.t += ms; PM.n++; if (ms > 24) PM.slow++; if (PM.t > 2500) { if (PM.n > 20 && PM.slow > PM.n * 0.25 && qLvl < 3) { qLvl++; RS = RS_STEPS[qLvl]; resize(); PM.cool = 3000; } PM.t = PM.n = PM.slow = 0; } }

// ---------- camera: fixed diagonal view that follows the summoner ----------
const YAW = Math.PI / 4, PITCH = QS.has('pitch') ? +QS.get('pitch') : 0.8, CAM_D = QS.has('cam') ? +QS.get('cam') : 14.5; const camT = new THREE.Vector3(), camB = new THREE.Vector3();
function placeCamera(snap) {
  const P = G.player; const D = CAM_D * (VW < VH ? 1.35 : 1); camT.set(P.x, 0, P.z);
  const target = new THREE.Vector3(P.x + Math.sin(YAW) * Math.cos(PITCH) * D, Math.sin(PITCH) * D, P.z + Math.cos(YAW) * Math.cos(PITCH) * D);
  if (snap) camB.copy(target); else camB.lerp(target, 0.12); camera.position.copy(camB); camera.lookAt(camB.x - Math.sin(YAW) * Math.cos(PITCH) * D, 0.6, camB.z - Math.cos(YAW) * Math.cos(PITCH) * D);
  camera.position.add(shakeOffset()); // camera shake moves the view without turning it
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
function groundAt(cx, cy) { ndc.set(cx / VW * 2 - 1, -(cy / VH) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null; }
initUI({ camera, groundAt, canvas, reset: what => what === 'all' ? resetAll() : what === 'tech' ? grantTech() : resetDungeon() }); initMap();

// ---------- floors ----------
let packId = 1;
function makeFloor(depth, arena = false) {
  if (G.player && G.player.chanFx) endChannel(G.player);
  for (const u of G.units) if (u.side !== 'player') u.remove(); for (const c of G.corpses) scene.remove(c.mesh.root); for (const s of G.shots) scene.remove(s.root);
  for (const g of G.ghosts) scene.remove(g.m ? g.m.root : g.orb); G.ghosts = []; for (const c of G.clouds) scene.remove(c.disc); G.clouds = []; G.bolts = []; for (const L of G.loot) scene.remove(L.root); G.loot = [];
  // timed effects still running: take their scene objects away (an effect's fn may also do gameplay — a blast, a drop — so only those
  // marked clean, whose fn just removes things, or with their own end(), are run; the rest are dropped)
  for (const f of G.fx) { if (f.end) f.end(); else if (f.clean && f.fn) f.fn(); }
  G.units = G.player ? [G.player] : []; G.corpses = []; G.shots = []; G.fx = []; G.focus = null; G.bossLock = null; clearBossBar(); if (PACT) jarReset();
  if (G.floor) G.floor.dispose(scene); clearFx(); clearTechFx();
  const F = new Floor((Date.now() ^ (depth * 7919)) >>> 0, depth, arena); F.build(scene); C.floor = F; G.floor = F; G.depth = depth; G.arena = arena; if (depth > 0) G.deep = depth;
  SH.uAmb.value.setRGB(...F.amb); SH.uLightR.value = F.lightR; renderer.setClearColor(depth === 0 ? 0x0b0d12 : 0x07060a);
  const R = F.R, st = F.start;
  if (!G.player) { G.player = new Unit('player', 'player', st.cx, st.cy, { level: G.level }); G.units.push(G.player); }
  const P = G.player; P.x = st.cx; P.z = st.cy; P.vx = P.vz = 0; P.dead = false; P.state = 'idle'; P.level = G.level; P.stats(); P.hp = P.maxHp; P.mp = P.maxMp; P.face = Math.PI * 1.25;
  for (const en of G.crypt) { en.unit = null; if (en.active && en.reviveT <= 0) spawnAlly(en); }
  if (PACT) pactFloor(P); // 魂契: the skeleton comes along
  // monster packs in every other room; some packs get a champion with an affix
  const byDist = F.rooms.slice(1).sort((a, b) => Math.hypot(a.cx - st.cx, a.cy - st.cy) - Math.hypot(b.cx - st.cx, b.cy - st.cy));
  if (depth > 0 && !arena) for (const r of byDist) { const near = byDist.indexOf(r), n = r.w * r.h > 90 ? 2 : 1;
    for (let k = 0; k < n; k++) { const easy = depth === 1 && near < 2, tpl = easy ? (near === 0 ? [['imp', 2]] : [['imp', 2], ['archer', 1]]) : PACKS[Math.floor(R() * PACKS.length)], c0 = F.randomSpot(r), pid = packId++; const units = [];
      if (easy && k > 0) break;
      for (const [type, cnt] of tpl) { const extra = type === 'imp' ? Math.floor(depth / 3) : 0; for (let j = 0; j < cnt + extra; j++) {
        let x = c0.x + (R() - 0.5) * 3, z = c0.z + (R() - 0.5) * 3; if (!F.walk(x, z)) { x = c0.x; z = c0.z; }
        units.push(new Unit(type, 'enemy', x, z, { level: depth + (R() < 0.25 ? 1 : 0), depth, packId: pid })); } }
      if (!easy && R() < 0.1 + 0.05 * depth) { const cand = units.filter(u => u.kind !== 'imp'), u0 = cand.length ? cand[Math.floor(R() * cand.length)] : units[0], keys = Object.keys(MODS);
        u0.remove(); const ch = new Unit(u0.kind, 'enemy', u0.x, u0.z, { level: depth + 1, depth, packId: pid, champ: true, mods: [keys[Math.floor(R() * keys.length)]] }); units[units.indexOf(u0)] = ch; }
      G.units.push(...units); } }
  // every 5th floor: a boss by the way down, which stays shut until it falls (boss.js)
  if (!arena && depth > 0 && depth % 5 === 0) placeBoss(F, depth);
  // the wilds around the camp: packs wait at spots all over the map and are only made when the summoner comes within sight range
  G.pend = depth === 0 && F.packSpots ? F.packSpots.slice() : []; G.wild = false;
  placeCamera(true); message(arena ? tr('试炼场', 'Test Arena') : depth === 0 ? tr('墓园营地', 'Graveyard Camp') : tr(`墓穴 · 第 ${depth} 层`, `Crypt · Floor ${depth}`), true);
  if (arena) message(tr('右侧面板：刷怪、调战魂、看伤害统计。这里的一切都不会存档', 'The panel on the right: spawn monsters, set Fury, read the damage meter. Nothing here is saved')); if (depth === 0 && G.deep > 1) message(tr(`穿过墓穴大门可回到第 ${G.deep} 层`, `The crypt door leads back to floor ${G.deep}`)); save();
}

// a pack in the wilds: no skeletons out here — the living who come to rob the graves, in gangs, and the flying vermin, in swarms (data.js
// FOES / WILD_PACKS). Tougher and more often led by a champion the farther it waits from the camp; the places always hold a champion
function spawnWildPack(sp) {
  const R = Math.random, zone = sp.d < 50 ? 0 : sp.d < 78 ? 1 : 2, base = Math.max(1, G.deep - 1 + zone), pid = packId++, units = [], pick = () => WILD_PACKS[Math.floor(R() * WILD_PACKS.length)];
  const tpl = pick().map(([t, n]) => [t, n]); if (R() < 0.2 + 0.15 * zone) tpl.push([['robber', 2], ['squire', 2], ['bat', 3], ['xbow', 1]][Math.floor(R() * 4)]);
  if (zone > 0 && R() < 0.3) tpl.push(['wraith', 1]);
  if (sp.poi) tpl.push(...pick());
  for (const [type, cnt] of tpl) for (let j = 0; j < cnt; j++) { let x = sp.x + (R() - 0.5) * 4, z = sp.z + (R() - 0.5) * 4; if (!G.floor.fits(x, z, 0.3)) { x = sp.x + (R() - 0.5) * 0.6; z = sp.z + (R() - 0.5) * 0.6; }
    units.push(mkEnemy(type, x, z, { level: base + (R() < 0.25 ? 1 : 0), depth: base, packId: pid })); }
  if (sp.poi || R() < 0.15 + 0.1 * zone) { const cand = units.filter(u => u.kind !== 'imp' || u.foe === 'raider'), u0 = cand.length ? cand[Math.floor(R() * cand.length)] : units[0], keys = Object.keys(MODS), mods = [keys[Math.floor(R() * keys.length)]];
    if (sp.poi && zone > 0) { const m2 = keys[Math.floor(R() * keys.length)]; if (m2 !== mods[0]) mods.push(m2); }
    u0.remove(); const ch = new Unit(u0.kind, 'enemy', u0.x, u0.z, { level: base + 1, depth: base, packId: pid, champ: true, mods, foe: u0.foe }); units[units.indexOf(u0)] = ch; }
  G.units.push(...units);
}
function updateWilds(P) {
  if (G.depth !== 0) return;
  for (let i = G.pend.length - 1; i >= 0; i--) { const sp = G.pend[i]; if (Math.hypot(sp.x - P.x, sp.z - P.z) < 30) { G.pend.splice(i, 1); spawnWildPack(sp); } }
  const wild = P.x > 32.5 || P.z > 32.5; if (wild !== G.wild) { G.wild = wild; message(wild ? tr('墓园荒野', 'The Wilds') : tr('墓园营地', 'Graveyard Camp'), true); }
}

// test helper: back to the camp with everyone revived; the crypt floor is generated anew (fresh monsters) on the next entry
function resetDungeon() {
  const P = G.player; closeCrypt(); IN.moveTo = IN.attack = IN.castAt = IN.raise = null; IN.stairs = false;
  if (P.dead) { P.dead = false; P.state = 'idle'; P.mesh.u.uFade.value = 1; } playerAnim(P, 'revive');
  for (const en of G.crypt) en.reviveT = 0;
  S.stairs(); makeFloor(0); message(tr('副本已重置', 'Dungeon reset'));
}

// test helper: one of every 科技流 epic weapon into the bag (item level by the deepest floor reached)
function grantTech() { let n = 0; for (const u of Object.keys(TECH)) { const it = makeTech(u, G.uid++, Math.max(5, G.deep + 1)); if (bagPut(it)) n++; } save();
  message(n ? tr(`${n} 把科技武器已放进背包`, `${n} tech weapons put in the bag`) : tr('背包满了', 'The bag is full'), true); }

// test helper: wipe the save and start over from scratch
function resetAll() { wipe(); location.reload(); }

function endChannel(P) { for (const c of P.chanList || []) c.claim = null; P.chanList = []; if (P.chanFx) { P.chanFx.dispose(); P.chanFx = null; } P.state = 'idle'; }

// ---------- the summoner ----------
function castSpear(P, tx, tz) { if (P.spearCD > 0 || P.mp < SKILLS.spear.mana) return false; P.mp -= SKILLS.spear.mana; P.spearCD = SKILLS.spear.cd / PACE.act; P.faceT = Math.atan2(tx - P.x, tz - P.z); P.atkT = 0.2;
  shoot(P, 'spear', tx, tz, { dmg: P.dmg, life: 0.75 }); playerAnim(P, 'shoot'); return true; }
function nearestEnemy(P, maxD) { let b = null, bd = maxD; if (G.focus && !G.focus.dead && Math.hypot(G.focus.x - P.x, G.focus.z - P.z) < maxD && G.floor.los(P.x, P.z, G.focus.x, G.focus.z)) return G.focus;
  for (const e of G.enemies) { const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd && G.floor.los(P.x, P.z, e.x, e.z)) { bd = d; b = e; } } return b; }
const tmp = { x: 0, z: 0 };
function updatePlayer(dt) {
  const P = G.player, F = G.floor; P.flash = Math.max(0, P.flash - dt * 5);
  if (P.dead) { if (P.chanFx) { for (const c of P.chanList) c.claim = null; P.chanList = []; P.chanFx.dispose(); P.chanFx = null; } P.wantX = P.wantZ = 0; P.respawnT -= dt; P.mesh.mixer.update(dt); P.mesh.u.uFade.value = Math.min(1, Math.max(0, (P.respawnT - 0.3) / 0.8));
    if (P.respawnT <= 0) { P.dead = false; P.chillT = 0; P.poison = null; P.state = 'idle'; P.hp = P.maxHp; P.mp = P.maxMp; P.x = F.start.cx; P.z = F.start.cy; P.mesh.u.uFade.value = 1; playerAnim(P, 'revive');
      for (const en of G.crypt) if (en.unit && !en.unit.dead) { en.unit.x = P.x + 1; en.unit.z = P.z; } message(tr('你在入口处重新站了起来', 'You rise again at the entrance')); } return; }
  const fighting = G.enemies.some(e => e.aggro && Math.hypot(e.x - P.x, e.z - P.z) < 12);
  P.mp = Math.min(P.maxMp, P.mp + (fighting ? 4 : 8) * dt); P.hp = Math.min(P.maxHp, P.hp + P.maxHp * (fighting ? 0.004 : 0.03) * dt);
  P.spearCD = (P.spearCD || 0) - dt * slowK(P); P.mendCD = (P.mendCD || 0) - dt; P.atkT = (P.atkT || 0) - dt;
  const moving = IN.joy || (IN.hold && IN.moveTo);
  if (PACT && pactPlayer(P, dt, IN)) return; // 魂契: the summon cast / the E key
  // channelling 唤魂 on every corpse in the circle at once
  if (P.state === 'channel') { P.wantX = P.wantZ = 0; P.st += dt; const T = SKILLS.raise.channel / PACE.act;
    for (const c of P.chanList.slice()) if (!G.corpses.includes(c)) { P.chanList.splice(P.chanList.indexOf(c), 1); P.chanFx.drop(c); }
    if (!P.chanList.length || moving) endChannel(P);
    else { P.chanFx.update(dt, P, Math.min(1, P.st / T), parts);
      if (P.st >= T) { const list = P.chanList.slice(); endChannel(P); list.forEach((c, i) => G.fx.push({ t: 0.05 + i * 0.16, fn: () => PACT ? harvest(c) : finishRaise(c) })); } }
    return; }
  // 唤魂 request: walk toward a clicked corpse if it is out of reach, then raise everything around
  if (IN.raiseKey) { IN.raiseKey = false; IN.raise = 'area'; }
  if (IN.raise) { const tgt = IN.raise !== 'area' ? IN.raise : null, R = SKILLS.raise.range;
    if (tgt && (!G.corpses.includes(tgt) || tgt.claim)) IN.raise = null;
    else if (tgt && Math.hypot(tgt.x - P.x, tgt.z - P.z) > R) { F.dirTo(P.x, P.z, tgt.x, tgt.z, tmp); P.wantX = tmp.x * P.speed; P.wantZ = tmp.z * P.speed; if (moving) IN.raise = null; else return; }
    else { IN.raise = null; let list = G.corpses.filter(c => !c.claim && Math.hypot(c.x - P.x, c.z - P.z) <= R).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z));
      if (!list.length) message(tr('附近没有可以唤魂的尸体', 'No corpses nearby to raise'));
      else if (P.mp < SKILLS.raise.mana) message(tr('法力不足', 'Not enough mana'));
      else { const n = Math.min(list.length, 1 + Math.floor((P.mp - SKILLS.raise.mana) / SKILLS.raise.extra)); if (n < list.length) message(tr(`法力只够唤 ${n} 具`, `Mana for only ${n}`)); list = list.slice(0, n);
        P.mp -= SKILLS.raise.mana + SKILLS.raise.extra * (n - 1); P.state = 'channel'; P.st = 0; P.chanList = list; for (const c of list) c.claim = P;
        const cx = list.reduce((a, c) => a + c.x, 0) / n, cz = list.reduce((a, c) => a + c.z, 0) / n; P.faceT = Math.atan2(cx - P.x, cz - P.z);
        P.chanFx = new SoulChannel(scene, P, list, R); S.raise(); return; } } }
  // 愈合
  if (IN.mend) { IN.mend = false; if (P.mendCD > 0) message(tr('愈合冷却中', 'Mend is cooling down')); else if (P.mp < SKILLS.mend.mana) message(tr('法力不足', 'Not enough mana')); else { P.mp -= SKILLS.mend.mana; P.mendCD = SKILLS.mend.cd; S.heal(); playerAnim(P, 'mend');
    const rg = ring(0.3, 0.6, 0x7dff9a, 0.9); rg.position.set(P.x, 0.05, P.z); scene.add(rg); G.fx.push({ clean: true, t: 0.5, tick: k => { rg.scale.setScalar(1 + k * 14); rg.material.opacity = 0.9 * (1 - k); }, fn: () => scene.remove(rg) });
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
  if (IN.coffin) { const c = F.coffin; if (!c || G.egg) IN.coffin = false; else if (Math.hypot(P.x - c.x, P.z - c.z) < 2) { IN.coffin = false; IN.moveTo = null; openCoffin(); } else if (!IN.moveTo) IN.coffin = false; }
  if (IN.box) { const b = IN.box; if (b.open || !F.boxes || !F.boxes.includes(b)) IN.box = null; else if (Math.hypot(P.x - b.x, P.z - b.z) < 1.5) { IN.box = null; IN.moveTo = null; openBox(b); } else if (!IN.moveTo) IN.box = null; } // a barrel / chest clicked (loot.js)
  // going down needs the button (or Enter) — except the camp's portal, which you simply walk into
  const intoPortal = G.depth === 0 && Math.hypot(P.x - F.stairs.x, P.z - F.stairs.z) < 0.3;
  if (IN.stairs && ns && stairsLocked()) { IN.stairs = false; message(tr('首领守着下楼的路：先击败它', 'A boss guards the way down: defeat it first')); }
  if ((IN.stairs && ns) || intoPortal) { IN.stairs = false; IN.moveTo = null; IN.hold = false; S.stairs(); closeCrypt(); makeFloor(G.depth === 0 ? G.deep : G.depth + 1); } else if (IN.stairs) IN.stairs = false;
}

// ---------- start screen ----------
let started = false;
const hasSave = load(); if (PACT) { pactMigrate(); heroEntry(); initJar(); } // (its gear: a plain sword and shield on a new pact; an old save's summon levels paid back into the soul vessel)
document.body.classList.toggle('pact', PACT);
$('#startMsg').textContent = PACT ? (hasSave ? tr(`继续：Lv ${G.level} · 魂能 ${Math.floor(G.soul)} · 第 ${G.deep} 层`, `Continue: Lv ${G.level} · ${Math.floor(G.soul)} soul · floor ${G.deep}`) : tr('缔结第一份魂契', 'A new pact'))
  : hasSave ? tr(`继续：Lv ${G.level} · 墓典 ${G.crypt.length} 只 · 第 ${G.deep} 层`, `Continue: Lv ${G.level} · ${G.crypt.length} in the Crypt · floor ${G.deep}`) : tr('第一次进入墓穴', 'A new descent');
// two modes, each with its own save: switching reloads the page in the other one
$('#modeDesc').textContent = PACT ? tr('只召唤一具骸骨卫士：它亲手杀敌积攒战魂越战越强，战死就清零重来。唤魂化尸为魂能存进魂瓶，随时灌注给卫士充战魂。', 'Bind a single Bone Sentinel: it grows stronger with every kill of its own, and loses it all when it falls. Raise turns corpses into soul energy kept in a vessel, to pour into the Sentinel as Fury whenever you like.')
  : tr('收服倒下的怪物，组一支骷髅军团。', 'Capture fallen monsters and build a skeleton army.');
for (const b of document.querySelectorAll('#modeRow .md')) { b.classList.toggle('cur', b.dataset.m === MODE);
  b.addEventListener('click', () => { if (b.dataset.m === MODE) return; setMode(b.dataset.m); location.href = location.pathname; }); }
$('#help').innerHTML = PACT ? (touchUI ? tr('左半屏拖动：移动　·　「召唤」施法召出骸骨卫士　·　「唤魂」把尸体化成魂能<br>「愈合」给骸骨卫士回血　·　「魂契」面板里强化召唤、切换武器流派', 'Drag on the left half to move · Summon calls the Bone Sentinel · Raise turns corpses into soul energy<br>Mend heals the Sentinel · the Pact panel: strengthen the summon, switch weapon style')
  : tr('左键：移动 / 点怪攻击　·　右键：骨矛　·　E：召唤骸骨卫士（施法 1.5 秒）<br>Q：唤魂（尸体化成魂能）　·　W：愈合　·　Tab：魂契面板（强化召唤、切换武器流派）　·　I：背包', 'Left click: move / attack · Right click: Bone Spear · E: summon the Bone Sentinel (1.5 s cast)<br>Q: Raise (corpses become soul energy) · W: Mend · Tab: the Pact (strengthen the summon, weapon style) · I: Bag')) : touchUI ? tr('左半屏拖动：移动　·　右下「骨矛」按住连发（自动瞄准）<br>打倒怪物后按「唤魂」收服身边所有尸体　·　「墓典」编辑出战', 'Drag on the left half to move · hold Bone Spear to fire (auto-aim)<br>After a fight, tap Raise to capture every corpse around you · Crypt: pick your party') :
  tr('左键：移动 / 点怪攻击　·　右键：朝鼠标方向放骨矛（Shift+左键同效）<br>Q：唤魂（收服身边一圈内的所有尸体）　·　W：愈合　·　Tab：墓典　·　I：背包　·　走到楼梯点击或按 Enter 下楼', 'Left click: move / attack · Right click: Bone Spear toward the cursor (or Shift + left)<br>Q: Raise (capture every corpse around you) · W: Mend · Tab: Crypt · I: Bag · Enter on the stairs to go down');
$('#bStart').addEventListener('click', () => { if (!A.ready) return; unlock(); if (touchUI) goFull(); $('#start').classList.add('hide'); started = true; });
// 试炼场: a sandbox hall on top of the current save (nothing is written back; leaving reloads)
function enterArena() { G.noSave = true; if (PACT) G.pact.alive = true; makeFloor(Math.max(1, G.deep), true); initArena(touchUI); }
$('#bArena').addEventListener('click', () => { if (!A.ready) return; unlock(); if (touchUI) goFull(); if (!G.arena) enterArena(); $('#start').classList.add('hide'); started = true; });
$('#bNew').addEventListener('click', () => { if (!confirm(tr('清除存档重新开始？', 'Delete the save and start over?'))) return; wipe(); location.reload(); });
const bS = $('#bStart'), label = bS.textContent; bS.disabled = true; $('#bArena').disabled = true;
loadAll(k => { bS.textContent = tr(`载入中 ${Math.round(k * 100)}%`, `Loading ${Math.round(k * 100)}%`); }).then(() => { makeIcons(); bS.disabled = false; $('#bArena').disabled = false; bS.textContent = label; makeFloor(QS.has('floor') ? +QS.get('floor') : 0); if (QS.has('arena')) enterArena(); requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); }); })
  .catch(e => { console.error(e); bS.textContent = tr('资源载入失败，请刷新', 'Loading failed — please refresh'); });

// the shader takes a handful of torch lights: upload the ones nearest the summoner
const tSort = [];
function pickTorches(P) {
  const T = G.floor.torches || [], L = SH.uTL.value; tSort.length = 0;
  for (const t of T) { const d = Math.abs(t.x - P.x) + Math.abs(t.z - P.z); if (d < 22) tSort.push([d, t]); }
  tSort.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < TORCH_N; i++) { const e = tSort[i]; if (!e) { L[i].w = 0; continue; } const t = e[1], fl = 1 + Math.sin(G.t * 9 + t.ph) * 0.04 + Math.sin(G.t * 23 + t.ph * 2) * 0.03; L[i].set(t.x, t.y, t.z, t.r * fl); }
}

// ---------- main loop ----------
let last = performance.now();
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); last = performance.now(); PM.cool = 2000; });
function loop(now) {
  requestAnimationFrame(loop);
  const ms = now - last; last = now; perf(ms); let dt = Math.min(0.05, ms / 1000); if (dt <= 0) return;
  if (G.slowT > 0) { G.slowT -= dt; dt *= 0.4; } // a champion falling: a moment of slow motion
  AURA_T.value += dt;
  if (started) { G.t += dt; setNavTime(G.t);
    const P = G.player;
    G.enemies = []; G.friends = []; for (const u of G.units) { if (u.dead) continue; if (u.side === 'enemy') G.enemies.push(u); else G.friends.push(u); }
    updatePlayer(dt); updateWilds(P); if (PACT) { pactTick(dt); jarTick(dt); } if (G.arena) arenaTick(dt); bossTick(dt);
    const active = [];
    for (const u of G.units) { if (u.dead || u === P) continue; if (u.side === 'enemy' && !u.aggro && Math.hypot(u.x - P.x, u.z - P.z) > 26) { u.mesh.root.visible = false; continue; } u.mesh.root.visible = true; updateUnit(u, dt); active.push(u); }
    if (!P.dead) active.push(P); integrate(active, dt);
    updateShots(dt); updateCorpses(dt); updateGhosts(dt); updateHazards(dt); updateLoot(dt); updateFx(dt, active);
    let j = 0; for (const f of G.fx) { f.t -= dt; f.k = (f.k || 0) + dt; if (f.tick) f.tick(Math.min(1, f.k / (f.k + Math.max(0, f.t)))); if (f.t <= 0) { f.fn && f.fn(); continue; } G.fx[j++] = f; } G.fx.length = j;
    G.units = G.units.filter(u => !u.dead || u === P);
    // revive timers (a shaman in the party speeds them up)
    let rvs = 1; for (const f of G.friends) if (f.side === 'ally' && f.kind === 'shaman') rvs = Math.max(rvs, 1.4 * (1 + 0.2 * rk(f, 'soul')));
    for (const en of G.crypt) if (en.active && en.reviveT > 0) { en.reviveT -= dt * rvs; if (en.reviveT <= 0) { en.reviveT = 0; if (!P.dead) { spawnAlly(en); S.revive(); message(tr(`${affixName(en.mods, en.champ)}${TYPES[en.type].name} 复原了`, `${affixName(en.mods, en.champ)}${TYPES[en.type].name} is back`)); } } }
    G.floor.stairsGlow.material.opacity = 0.55 + 0.25 * Math.sin(G.t * 2.5);
    boxTick(dt); const cf = G.floor.coffin; if (cf && !G.egg && Math.random() < dt * 1.3) parts.emit(cf.x + (Math.random() - 0.5) * 0.8, 0.3, cf.z + (Math.random() - 0.5) * 0.8, 1, { col: 0xb46cff, spd: 0.08, up: 0.55, grav: -0.25, life: 1.7, size: 0.15 }); // a faint hint
    const pt = G.floor.portal; if (pt) { pt.material.uniforms.uT.value = G.t;   // motes drifting up the portal and out over the plinth
      if (Math.random() < dt * 16) parts.emit(pt.position.x + (Math.random() - 0.5) * 0.9, 0.35 + Math.random() * 1.4, pt.position.z + 0.08, 1, { col: Math.random() < 0.5 ? 0x8fe8ff : 0x5fa8ff, spd: 0.12, up: 0.5, grav: -0.35, life: 1.3, size: 0.13, spread: 0.05 }); }
  }
  const P = G.player;
  placeCamera(false);
  SH.uLight.value.set(P.x, 1.6, P.z); pickTorches(P);
  camera.updateMatrixWorld(); const v = new THREE.Vector3(P.x, 0.8, P.z), vz = v.clone().applyMatrix4(camera.matrixWorldInverse).z; v.project(camera);
  const bw = VW * RS, bh = VH * RS; SH.uCutC.value.set((v.x + 1) / 2 * bw, (v.y + 1) / 2 * bh); SH.uCutR.value = Math.min(bw, bh) * 0.17; SH.uCutZ.value = vz;
  shadows.begin(); for (const u of G.units) if (!u.dead && u.mesh.root.visible && !(u === P && P.dead)) shadows.add(u.x, u.z, u.r * (u.champ ? (u.side === 'ally' ? 1.1 : 1.25) : 1)); droneShadows((x, z, r) => shadows.add(x, z, r)); shadows.end();
  parts.update(dt);
  P.mesh.mat.uniforms.uFlash.value = P.flash * 0.6;
  renderer.render(scene, camera);
  drawOverlay(); if (PACT) jarDraw(); updateHUD(dt, PM.fps); updateMap(dt);
}
window.__gt = { spawnWildPack, mkEnemy, PropBatch, fx: FXM, parts, auraMat, propMat: null, dbg: { dropLoot, rollItem, rollHeroItem, openBox, heroEntry, fuse, fusionOdds, message, setGear, openCoffin, heroWeaponPose, heroPart, addXP, pfx: PFX }, A, propGeo, THREE, scene, renderer, G, IN, makeFloor, get RS() { return RS; }, camera, groundAt, Unit, spawnAlly, damage };
