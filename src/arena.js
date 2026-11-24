// 试炼场 / Test Arena: one big empty hall to spawn monsters on demand and measure how strong the summons are.
// Nothing done here is saved (G.noSave): leaving reloads the page, back to the save as it was.
import { G, PACT } from './state.js';
import { tr } from './i18n.js';
import { C, PH, Unit, removeCorpse, rise } from './units.js';
import { MODS } from './data.js';
import { heroUnit, setStyle, spawnHero, SETS } from './pact.js';
import { S } from './audio.js';

const KINDS = ['imp', 'brute', 'archer', 'shaman'];
const O = { tab: 'mob', drop: false, type: 'imp', count: 3, lvl: 1, dist: 7, hpMul: 1, elite: false, dummy: false, auto: false, pInv: true, hInv: false };
const ST = { dmg: 0, dmgP: 0, taken: 0, kills: 0, ttk: 0, fight: 0, lastHit: -9, log: [] };
let el = null, refillT = 0, uiT = 0, pid = 900000;
const $ = s => el.querySelector(s);

// ---------- the damage meter (units.js calls PH.dmg for every blow that lands) ----------
PH.dmg = (src, dst, d, o) => {
  if (!G.arena) return;
  if (dst.side === 'enemy') {
    if (src && (src.side === 'ally' || src.pact)) { ST.dmg += d; ST.log.push([G.t, d]); } else if (src && src.kind === 'player') ST.dmgP += d; else return;
    ST.lastHit = G.t; if (dst.h0 == null) dst.h0 = G.t;
    if (dst.hp <= 0 && !dst.counted) { dst.counted = true; ST.kills++; ST.ttk += G.t - dst.h0; }
  } else if (dst.side === 'ally' || dst.pact) ST.taken += d;
};
function resetStats() { Object.assign(ST, { dmg: 0, dmgP: 0, taken: 0, kills: 0, ttk: 0, fight: 0, lastHit: -9, log: [] }); }

// ---------- monsters ----------
function spawnPack(n = O.count) {
  // at the chosen range from the skeleton (from the summoner if it is not out), on the side nearest the summoner so the pack is on screen
  const P = G.player, F = C.floor, h = heroUnit() || P; let cx = null, cz = null, best = 1e9;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, x = h.x + Math.sin(a) * O.dist, z = h.z + Math.cos(a) * O.dist, d = Math.hypot(x - P.x, z - P.z) + (h === P ? Math.abs(((a - P.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI) : 0);
    if (d < best && F.fits(x, z, 1.4)) { best = d; cx = x; cz = z; } }
  if (cx == null) { cx = F.start.cx; cz = F.start.cy; }
  const keys = Object.keys(MODS), pk = pid++;
  for (let k = 0; k < n; k++) {
    const type = O.type === 'mix' ? KINDS[Math.floor(Math.random() * KINDS.length)] : O.type, a = k * 2.4, r = k ? 0.85 * Math.sqrt(k) : 0;
    let x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r; if (!F.fits(x, z, 0.35)) { x = cx; z = cz; }
    const e = new Unit(type, 'enemy', x, z, { level: O.lvl, packId: pk, champ: O.elite, mods: O.elite ? [keys[Math.floor(Math.random() * keys.length)]] : [] });
    e.maxHp *= O.hpMul; e.hp = e.maxHp; e.dummy = O.dummy; e.arena = true; e.face = Math.atan2(h.x - x, h.z - z);
    if (!O.dummy) { e.aggro = true; e.target = h; }
    G.units.push(e); rise(e, 'Spawn_Ground_Skeletons', 2.2);
    C.parts.emit(x, 0.3, z, 12, { col: 0x9a7cff, spd: 1.4, up: 1.8, life: 0.6, size: 0.24 });
  }
  S.rally();
}
function clearField() {
  for (const u of G.units) if (u.side === 'enemy') { u.dead = true; u.remove(); }
  G.units = G.units.filter(u => u.side !== 'enemy'); for (const c of G.corpses.slice()) removeCorpse(c);
}

// ---------- the skeleton (魂契) ----------
function heroRefresh() { const u = heroUnit(), P8 = G.pact; if (!u) return; u.entry.level = u.level = P8.lvl; const f = u.hp / u.maxHp; u.stats(); u.hp = u.maxHp * f; }
function setFury(n) { const P8 = G.pact; P8.stacks = Math.max(0, Math.min(40, n)); P8.kills = 0; heroRefresh(); }
function summonNow() { const P = G.player; if (heroUnit()) return; spawnHero(P.x + Math.sin(P.face) * 1.4, P.z + Math.cos(P.face) * 1.4, true); }
function fullHeal() { const P = G.player; P.hp = P.maxHp; P.mp = P.maxMp; for (const u of G.friends) if (!u.dead) u.hp = u.maxHp; }
function setLevel(n) { const P = G.player; G.level = Math.max(1, Math.min(60, n)); G.xp = 0; P.level = G.level; P.stats(); P.hp = P.maxHp; P.mp = P.maxMp; }

// ---------- the panel ----------
const chips = (k, list) => `<span class="aC" data-k="${k}">${list.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</span>`;
const step = (k, label) => `<span class="aL">${label}</span><button data-step="${k}:-1">−</button><b class="v" id="a_${k}"></b><button data-step="${k}:1">+</button>`;
const tog = (k, label) => `<button class="tg" data-tg="${k}">${label}</button>`;
function html() {
  const kinds = [['imp', tr('小兵', 'Minion')], ['brute', tr('战士', 'Warrior')], ['archer', tr('弩手', 'Archer')], ['shaman', tr('法师', 'Mage')], ['mix', tr('混合', 'Mixed')]];
  return `<div class="aH"><b>⚔ ${tr('试炼场', 'Test Arena')}</b><span><button data-act="leave">${tr('离开', 'Leave')}</button><i id="aMin"></i></span></div><div class="aB">
  <div class="aSt" id="aStat"></div>${PACT ? '<div class="aSm" id="aHero"></div>' : ''}
  <div class="aTabs"><button data-tab="mob">${tr('刷怪', 'Monsters')}</button><button data-tab="me">${PACT ? tr('卫士 · 召唤师', 'Sentinel · you') : tr('召唤师', 'Summoner')}</button><button data-act="reset">${tr('重置统计', 'Reset meter')}</button></div>
  <div class="aP" data-p="mob">
  <div class="aR">${chips('type', kinds)}</div>
  <div class="aR"><span class="aL">${tr('数量', 'Count')}</span>${chips('count', [[1, 1], [3, 3], [5, 5], [10, 10], [20, 20]])}</div>
  <div class="aR">${step('lvl', tr('等级', 'Level'))}<span class="aL sp">${tr('距离', 'Range')}</span>${chips('dist', [[3, 3], [7, 7], [11, 11]])}</div>
  <div class="aR"><span class="aL">${tr('血量', 'Life')}</span>${chips('hpMul', [[1, '×1'], [3, '×3'], [10, '×10'], [50, '×50']])}</div>
  <div class="aR">${tog('elite', tr('精英', 'Champion'))}${tog('dummy', tr('木桩', 'Dummy'))}${tog('auto', tr('自动补怪', 'Auto refill'))}${tog('drop', tr('掉落', 'Loot'))}</div>
  <div class="aR"><button class="go" data-act="spawn">${tr('刷怪', 'Spawn')}</button><button data-act="clear">${tr('清场', 'Clear')}</button></div></div>
  <div class="aP" data-p="me">${PACT ? `
  <div class="aR">${step('fury', tr('战魂', 'Fury'))}${chips('furyQ', [[0, 0], [5, 5], [10, 10], [15, 15], [20, 20]])}</div>
  <div class="aR">${step('slvl', tr('召唤等级', 'Summon Lv'))}</div>
  <div class="aR"><span class="aL">${tr('流派', 'Style')}</span>${chips('wset', Object.keys(SETS).map(k => [k, SETS[k].name]))}</div>
  <div class="aR">${tog('hInv', tr('卫士不死', 'Unkillable'))}<button data-act="summon">${tr('召唤', 'Summon')}</button><button data-act="heal">${tr('回满', 'Full heal')}</button></div>` : `<div class="aR"><button data-act="heal">${tr('回满', 'Full heal')}</button></div>`}
  <div class="aR">${step('plvl', tr('召唤师等级', 'Summoner Lv'))}</div><div class="aR">${tog('pInv', tr('召唤师无敌 · 法力无限', 'Summoner invulnerable · endless mana'))}</div></div></div>`;
}
function sync() { // buttons that show a choice or a toggle
  for (const c of el.querySelectorAll('.aC')) { const k = c.dataset.k, v = k === 'wset' ? G.pact.wset : k === 'furyQ' ? G.pact.stacks : O[k];
    for (const b of c.children) b.classList.toggle('on', String(v) === b.dataset.v); }
  for (const b of el.querySelectorAll('[data-tg]')) b.classList.toggle('on', !!O[b.dataset.tg]);
  for (const b of el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === O.tab); for (const p of el.querySelectorAll('.aP')) p.style.display = p.dataset.p === O.tab ? '' : 'none';
  $('#a_lvl').textContent = O.lvl; $('#a_plvl').textContent = G.level; if (PACT) { $('#a_fury').textContent = G.pact.stacks; $('#a_slvl').textContent = G.pact.lvl; }
}
function onClick(e) {
  const b = e.target.closest('button'); if (!b) { if (e.target.closest('.aH')) { el.classList.toggle('min'); minLabel(); } return; } // (the header folds it)
  const c = b.closest('.aC');
  if (c) { const k = c.dataset.k, v = b.dataset.v; if (k === 'wset') setStyle(v); else if (k === 'furyQ') setFury(+v); else if (k === 'type') O.type = v; else O[k] = +v; }
  else if (b.dataset.tg) O[b.dataset.tg] = !O[b.dataset.tg];
  else if (b.dataset.tab) O.tab = b.dataset.tab;
  else if (b.dataset.step) { const [k, d] = b.dataset.step.split(':'), n = +d;
    if (k === 'lvl') O.lvl = Math.max(1, Math.min(60, O.lvl + n)); else if (k === 'plvl') setLevel(G.level + n);
    else if (k === 'fury') setFury(G.pact.stacks + n); else if (k === 'slvl') { G.pact.lvl = Math.max(1, Math.min(60, G.pact.lvl + n)); heroRefresh(); } }
  else { const a = b.dataset.act;
    if (a === 'spawn') spawnPack(); else if (a === 'clear') clearField(); else if (a === 'reset') resetStats(); else if (a === 'summon') summonNow(); else if (a === 'heal') fullHeal();
    else if (a === 'leave') { const q = new URLSearchParams(location.search); q.delete('arena'); location.href = location.pathname + (q.toString() ? '?' + q : ''); } }
  sync(); draw(true);
}
const minLabel = () => { $('#aMin').textContent = el.classList.contains('min') ? tr('展开 ▾', 'open ▾') : tr('收起 ▴', 'hide ▴'); };

// ---------- entering, and every frame ----------
export function initArena(touch) {
  O.lvl = Math.max(1, G.deep); document.body.classList.add('arena');
  el = document.createElement('div'); el.id = 'arena'; el.className = 'panel' + (touch ? ' min' : ''); el.innerHTML = html();
  el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('click', onClick);
  document.getElementById('hud').appendChild(el); minLabel(); sync(); resetStats();
}
const f1 = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v) + '';
function draw(now) {
  if (!el || (!now && uiT > 0)) return; uiT = 0.25;
  const win = Math.min(5, Math.max(0.5, G.t - (ST.log.length ? ST.log[0][0] : G.t))), recent = ST.log.reduce((a, l) => a + l[1], 0);
  const row = (k, v) => `<span>${k}</span><span>${v}</span>`, live = G.units.filter(u => u.side === 'enemy' && !u.dead).length;
  $('#aStat').innerHTML = row(tr('近 5 秒 DPS', 'DPS (5 s)'), f1(G.t - ST.lastHit < 2 ? recent / win : 0)) + row(tr('平均 DPS', 'DPS (avg)'), f1(ST.fight > 0 ? ST.dmg / ST.fight : 0))
    + row(PACT ? tr('卫士总伤害', 'Sentinel damage') : tr('召唤物总伤害', 'Summon damage'), f1(ST.dmg)) + row(tr('召唤师伤害', 'Summoner damage'), f1(ST.dmgP))
    + row(tr('击杀 / 平均用时', 'Kills / avg time'), `${ST.kills} / ${ST.kills ? (ST.ttk / ST.kills).toFixed(1) + 's' : '–'}`)
    + row(tr('承受伤害 / 秒', 'Taken / s'), f1(ST.fight > 0 ? ST.taken / ST.fight : 0)) + row(tr('战斗时长 · 场上怪物', 'Fight time · alive'), `${ST.fight.toFixed(1)}s · ${live}`);
  if (PACT) { const u = heroUnit(); $('#aHero').innerHTML = u ? tr(`攻击 ${Math.round(u.dmg)} · 出手间隔 ${u.cd.toFixed(2)}s · 生命 ${Math.round(u.hp)}/${Math.round(u.maxHp)} · 护甲 ${Math.round(u.armor)} · 闪避 ${Math.round(u.evade * 100)}%`,
    `Damage ${Math.round(u.dmg)} · swing every ${u.cd.toFixed(2)}s · life ${Math.round(u.hp)}/${Math.round(u.maxHp)} · armour ${Math.round(u.armor)} · evasion ${Math.round(u.evade * 100)}%`) : tr('卫士未在场（召唤 或 E）', 'The Sentinel is not out (Summon or E)');
    const f = $('#a_fury'); if (f.textContent !== String(G.pact.stacks)) sync(); }
}
export function arenaTick(dt) {
  if (!el) return; const P = G.player; G.noDrop = !O.drop;
  if (O.pInv) { P.immortal = true; P.hp = P.maxHp; P.mp = P.maxMp; } else P.immortal = false;
  for (const u of G.friends) if (u !== P) u.immortal = O.hInv;
  if (G.t - ST.lastHit < 2) ST.fight += dt; while (ST.log.length && ST.log[0][0] < G.t - 5) ST.log.shift();
  const live = G.units.filter(u => u.side === 'enemy' && !u.dead).length;
  if (O.auto && live < O.count) { refillT -= dt; if (refillT <= 0) { spawnPack(O.count - live); refillT = 1.5; } } else refillT = 1.2;
  uiT -= dt; draw();
}
