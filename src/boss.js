// 首领 / Bosses: the four 科技流 skeletons as the crypt's bosses — one waits by the way down on every 5th floor (炮手 → 机枪 → 机甲 →
// 机械师, then round again stronger), and the way down stays shut until it falls. Each fights with the tech unit's own kit (units.js
// bossThink, drones.js), every big blow marked on the ground first, and each asks for a different answer from the Sentinel:
//  炮手骷髅  shells and barrages from far off, backs away from anyone close — get to it (Charge)
//  机枪骷髅  sustained fire, grenades, a marked sweeping fan; digs in when enraged — step out, or take it on a shield
//  机甲骷髅  the drill up close, a marked rocket dash, a shield field to break, a marked EMP — burst it down (Greatsword)
//  机械师骷髅 laser drones, an orbital strike, and a repair drone that heals it — shoot the drone down first (Whirlwind)
// At half life it is enraged (faster, its skills come round sooner). It drops: 魂契 — 4+ pieces of gear (purple / red at the top) and a burst of 魂能; the crypt — its own epic tech
// weapon. A boss bar shows at the top while one is near.
import { G, PACT } from './state.js';
import { tr } from './i18n.js';
import { C, PH, Unit, say, dropLoot } from './units.js';
import { makeTech, TECH, rollHeroItem, rollItem } from './data.js';
import { repairDown, clearDrones } from './drones.js';
import { S } from './audio.js';
import { burst, shake } from './fx.js';
import { soulToJar } from './soulvessel.js';

export const BOSSES = {
  bomber: { uniq: 'mortar', kind: 'archer', hp: 14, dmg: 1.25, scale: 1.55, skills: { shell: 4, mcluster: 2, incend: 2, barrage: 3 } },
  gunner: { uniq: 'mg', kind: 'imp', hp: 16, dmg: 1.35, scale: 1.95, skills: { nade: 4, shred: 2, deploy: 3, cluster: 2 } },
  mech: { uniq: 'drill', kind: 'brute', hp: 5.5, dmg: 1.2, scale: 1.45, skills: { drill: 4, rocket: 3, aegis: 3, overload: 3 } },
  engineer: { uniq: 'rod', kind: 'shaman', hp: 12, dmg: 1.15, scale: 1.65, skills: { drones: 2, repair: 1, orbital: 3, prism: 1 } },
};
export const BOSS_ORDER = ['bomber', 'gunner', 'mech', 'engineer'];
export const bossName = key => TECH[BOSSES[key].uniq].name;

// its numbers on top of the tech unit's (units.js _stats calls this last)
PH.bossStats = u => { const B = BOSSES[u.boss]; u.maxHp *= B.hp; u.dmg *= B.dmg; u.r *= 1.3; u.armor += 10; u.noStun = true; if (u.enraged) { u.cd *= 0.75; u.speed *= 1.15; } };
export function spawnBoss(key, x, z, level) {
  const B = BOSSES[key], en = { id: -100, type: B.kind, level, skills: { ...B.skills }, gear: { w: makeTech(B.uniq, 0, level) }, mods: [], modLv: {} };
  const u = new Unit(B.kind, 'enemy', x, z, { level, entry: en, boss: key, scale: B.scale }); u.hp = u.maxHp; u.face = Math.random() * 6.28; G.units.push(u); return u;
}
// the floor's boss: in the room with the way down, a little off the grate; the grate glows red until it falls
export function placeBoss(F, depth) {
  const n = depth / 5 - 1, key = BOSS_ORDER[n % BOSS_ORDER.length], r = F.end, st = F.stairs; let x = r.cx, z = r.cy;
  for (let i = 0; i < 16; i++) { const a = i * 0.8, d = 2.4 + (i % 3) * 0.6, tx = st.x + Math.cos(a) * d, tz = st.z + Math.sin(a) * d; if (F.fits(tx, tz, 0.9)) { x = tx; z = tz; break; } }
  const u = spawnBoss(key, x, z, depth + 2 + Math.floor(n / BOSS_ORDER.length) * 2); G.bossLock = u; if (F.stairsGlow) F.stairsGlow.material.color.setHex(0xff4a3a);
  return u;
}
export const stairsLocked = () => !!(G.bossLock && !G.bossLock.dead && G.depth > 0);

// the engineer's repair drone gets a body (hidden, bodiless, standing where the drone flies) so the summons can shoot it down; the
// summons go for it first
PH.bossDrone = (u, D) => {
  const ru = new Unit('imp', 'enemy', D.x, D.z, { level: u.level }); ru.mesh.root.visible = false; ru.noBody = true; ru.dummy = true; ru.isDrone = true; ru.prio = 3; ru.noStun = true;
  ru.maxHp = ru.hp = u.maxHp * 0.05; ru.armor = 8; ru.r = 0.35; ru.aggro = true; ru.droneOf = u; G.units.push(ru); u.repU = ru;
};
PH.droneDown = d => { const u = d.droneOf; say(d.x, d.z, tr('修理无人机被击落！', 'Repair drone down!'), '#7dff9a', 15, 2.2); S.zap(); if (C.parts) C.parts.emit(d.x, 1.3, d.z, 16, { col: 0x7dff9a, spd: 2.5, up: 1.5, grav: 6, life: 0.5, size: 0.16 });
  if (u && !u.dead) repairDown(u); };

// it falls: the loot, the way down opens
PH.bossDie = (u, src) => {
  if (u.dr) clearDrones(u, true); G.slowT = Math.max(G.slowT || 0, 0.9); shake(0.3, u.x, u.z); burst(u.x, 1.2, u.z, 0xffd8a0, 3.2); S.level();
  C.say(tr(`击败首领：${u.name}！`, `Boss defeated: ${u.name}!`), true, 4000);
  if (G.bossLock === u) { G.bossLock = null; const F = C.floor; if (F && F.stairsGlow) F.stairsGlow.material.color.setHex(0x6fb6ff); if (G.depth > 0) C.say(tr('下楼的路打开了', 'The way down is open')); }
  if (G.noDrop) return; const il = u.level + 1, B = BOSSES[u.boss], R = Math.random, cyc = Math.floor(Math.max(0, G.depth / 5 - 1) / BOSS_ORDER.length); // (cyc: how many times round the four)
  // 魂契: a purple or red (red 45%), a purple (or yellow), one more yellow to red, a blue or yellow — and one more for every round of the
  // four bosses already behind (up to three), and a burst of 魂能 into the vessel; the crypt: its tech weapon and two or three rares
  const items = PACT ? [R() < 0.45 ? 4 : 3, R() < 0.75 ? 3 : 2, R() < 0.12 ? 4 : R() < 0.45 ? 3 : 2, R() < 0.5 ? 2 : 1, ...Array.from({ length: Math.min(3, cyc) }, () => R() < 0.3 ? 3 : 2)].map(q => rollHeroItem(0, il, q))
    : [makeTech(B.uniq, 0, il), rollItem(0, il, 2), rollItem(0, il, R() < 0.25 ? 3 : 2), ...(R() < 0.5 ? [rollItem(0, il, 2)] : [])];
  items.forEach((it, i) => { it.id = G.uid++; const a = i / items.length * 6.28 + R() * 0.4, d = 0.9 + 0.35 * (i % 2); G.fx.push({ t: 0.35 + i * 0.22, fn: () => dropLoot(it, u.x + Math.cos(a) * d, u.z + Math.sin(a) * d) }); });
  if (PACT) { const v = 40 + 8 * il; G.fx.push({ t: 0.5, fn: () => { say(u.x, u.z, tr(`+${v} 魂能`, `+${v} soul`), '#8ff7ea', 18, 2.6); soulToJar(u.x, 1.2, u.z, v); } }); }
};

// ---------- per frame: who is near, the enrage at half life, the bar at the top ----------
let bar = null;
function ensureBar() {
  if (bar) return bar; bar = document.createElement('div'); bar.id = 'bossBar';
  bar.innerHTML = '<div class="bbN"></div><div class="bbB"><i class="bbH"></i><i class="bbS"></i><span class="bbT"></span></div>'; document.getElementById('hud').appendChild(bar); return bar;
}
export function bossTick(dt) {
  const P = G.player; let show = null, bd = 1e9;
  for (const u of G.enemies) { if (!u.boss || u.dead) continue; const d = Math.hypot(u.x - P.x, u.z - P.z);
    if (!u.intro && (d < 12 || u.aggro)) { u.intro = true; C.say(tr(`首领：${u.name}`, `Boss: ${u.name}`), true, 3500); S.cry('boss', 1, u.boss); shake(0.12, u.x, u.z); }
    if (!u.enraged && u.hp < u.maxHp * 0.5) { u.enraged = true; const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; u.mesh.u.uRim.value.setHex(0xff2a10);
      say(u.x, u.z, tr('狂暴！', 'Enraged!'), '#ff5a3a', 20, 2.6); S.cry('boss', 1, u.boss); shake(0.15, u.x, u.z); burst(u.x, 1.0, u.z, 0xff5a3a, 2.4); }
    if (u.enraged && C.parts && Math.random() < dt * 14) C.parts.emit(u.x + (Math.random() - 0.5) * u.r * 2, 0.3 + Math.random() * 1.4, u.z + (Math.random() - 0.5) * u.r * 2, 1, { col: 0xff4a2a, spd: 0.3, up: 1.4, grav: -0.8, life: 0.5, size: 0.22 });
    if ((u.intro || u.aggro) && d < 22 && d < bd) { bd = d; show = u; } }
  if (!show) { if (bar) bar.classList.remove('on'); return; }
  const b = ensureBar(); b.classList.add('on'); b.classList.toggle('rage', !!show.enraged);
  b.querySelector('.bbN').textContent = tr(`首领 · ${show.name} · Lv ${show.level}`, `Boss · ${show.name} · Lv ${show.level}`);
  b.querySelector('.bbH').style.width = (Math.max(0, show.hp) / show.maxHp * 100) + '%'; b.querySelector('.bbS').style.width = (Math.min(1, (show.shieldHP || 0) / show.maxHp) * 100) + '%';
  b.querySelector('.bbT').textContent = `${Math.ceil(Math.max(0, show.hp))} / ${Math.round(show.maxHp)}` + (show.shieldHP > 0 ? tr(` · 护盾 ${Math.ceil(show.shieldHP)}`, ` · shield ${Math.ceil(show.shieldHP)}`) : '');
}
export function clearBossBar() { if (bar) bar.classList.remove('on'); }
