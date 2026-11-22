// 装备 panel: Diablo-style paperdoll (live 3D model of the chosen summon with its weapon / shield frames),
// a 40-cell bag (one item per cell, icons rendered from the 3D models) and the furnace (熔炉) as a small grid.
// Items are moved by picking them up and putting them down (click / tap), right-click or double-click is a quick move.
import * as THREE from 'three';
import { G, save, bagPut, bagFree } from './state.js';
import { TYPES, MODS, QUAL, WEAPONS, BAG_MAX, itemName, itemLines, itemIcon, itemScore, itemFits, itemBase, furnaceOdds, furnaceRoll, rollItem } from './data.js';
import { setGear, Unit, ANIM } from './units.js';
import { makeUnitMesh, propGeo, propMat, play, A } from './assets.js';
import { SH } from './gfx.js';
import { S } from './audio.js';
import { message, closeCrypt, touchUI } from './ui.js';

const $ = s => document.querySelector(s), FURN_N = 12;
export let gearOpen = false;
let selEn = null, held = null, built = false, raf = 0, last = 0;

// ---------- a small second renderer: item icons and the paperdoll ----------
let R = null, dollScene, dollCam, doll = null, dollKey = '', iconScene, iconCam, iconsDone = false; const ICON = {};
function initR() {
  if (R) return;
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.outputColorSpace = THREE.LinearSRGBColorSpace; R.setClearColor(0x000000, 0); R.setPixelRatio(1);
  dollScene = new THREE.Scene(); dollCam = new THREE.PerspectiveCamera(28, 0.8, 0.1, 60);
  iconScene = new THREE.Scene(); iconCam = new THREE.PerspectiveCamera(26, 1, 0.01, 60);
}
// our own studio lighting: the shared shader uniforms are swapped in for the render and restored afterwards
function lit(fn) {
  const L = SH.uLight.value.clone(), r = SH.uLightR.value, a = SH.uAmb.value.clone(), tl = SH.uTL.value.map(v => v.w);
  SH.uLight.value.set(0.8, 2.5, 3); SH.uLightR.value = 60; SH.uAmb.value.setRGB(0.5, 0.5, 0.6); SH.uTL.value.forEach(v => { v.w = 0; });
  try { fn(); } finally { SH.uLight.value.copy(L); SH.uLightR.value = r; SH.uAmb.value.copy(a); SH.uTL.value.forEach((v, i) => { v.w = tl[i]; }); }
}
function makeIcons() {
  if (iconsDone) return; initR(); const size = 112; R.setSize(size, size, false); const models = new Set();
  for (const t in WEAPONS) for (const b of WEAPONS[t].bases) models.add(b.model);
  for (const m of ['sk_shield_large', 'shield_round', 'shield_square']) models.add(m);
  for (const m of models) { const pg = propGeo(m); if (!pg) continue;
    const g = new THREE.Group(), mesh = new THREE.Mesh(pg.geo, propMat(pg.map)), c = pg.box.getCenter(new THREE.Vector3()), sz = pg.box.getSize(new THREE.Vector3());
    mesh.position.copy(c).negate(); g.add(mesh); const shield = sz.y < sz.x * 1.4 && sz.z < sz.x; g.rotation.set(shield ? 0.25 : 0.2, shield ? 0.5 : 0.9, shield ? 0 : -0.78);
    iconScene.clear(); iconScene.add(g); const span = Math.max(sz.x, sz.y, sz.z) * (shield ? 1.05 : 0.95); iconCam.position.set(0, 0, span / (2 * Math.tan(13 * Math.PI / 180))); iconCam.lookAt(0, 0, 0);
    lit(() => R.render(iconScene, iconCam)); ICON[m] = R.domElement.toDataURL(); }
  iconScene.clear(); iconsDone = true;
}
const iconOf = it => ICON[itemBase(it).model] || '';
function setDoll() {
  const en = selEn, key = en ? en.id + ':' + (en.gear?.w?.id || 0) + ':' + (en.gear?.a?.id || 0) : ''; if (key === dollKey) return; dollKey = key;
  if (doll) { dollScene.remove(doll.root); doll = null; } if (!en) return;
  doll = makeUnitMesh(en.type, { gear: en.gear, elem: en.champ && en.mods[0] ? en.mods[0] : null, tint: en.mods.includes('stone') ? 0xb8b4ac : 0xffffff });
  dollScene.add(doll.root); play(doll, ANIM[en.type].idle, {}); doll.mixer.update(0);
  const box = new THREE.Box3().setFromObject(doll.root), h = box.max.y - box.min.y || 1.2;
  dollCam.position.set(0, h * 0.62, h * 2.55); dollCam.lookAt(0, h * 0.48, 0); doll.root.rotation.y = 0.5;
}
function loop(t) {
  if (!gearOpen) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
  const box = $('#gDoll'); if (!box || !doll) return; const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  const pr = Math.min(2, devicePixelRatio || 1); if (R.domElement.width !== Math.round(w * pr) || R.domElement.height !== Math.round(h * pr)) { R.setPixelRatio(pr); R.setSize(w, h, false); dollCam.aspect = w / h; dollCam.updateProjectionMatrix(); }
  doll.mixer.update(dt); doll.root.rotation.y += dt * 0.35; lit(() => R.render(dollScene, dollCam));
}

// ---------- containers ----------
const at = (c, p) => c === 'bag' ? G.bag.find(i => i.pos === p) : c === 'furn' ? G.furn.find(i => i.fpos === p) : selEn && selEn.gear ? selEn.gear[c] : null;
function take(c, p) {
  const it = at(c, p); if (!it) return null;
  if (c === 'bag') G.bag.splice(G.bag.indexOf(it), 1); else if (c === 'furn') G.furn.splice(G.furn.indexOf(it), 1); else setGear(selEn, c, null);
  return it;
}
const furnFree = () => { const u = new Set(G.furn.map(i => i.fpos)); for (let p = 0; p < FURN_N; p++) if (!u.has(p)) return p; return -1; };
const fitsSlot = (it, c) => (c === 'w' ? it.slot === 'w' && itemFits(it, selEn.type) : it.slot === 'a');
function put(c, p, it) { // returns the item that was displaced (or null)
  if (c === 'bag') { const o = take('bag', p); it.pos = p; G.bag.push(it); return o; }
  if (c === 'furn') { const o = take('furn', p); it.fpos = p; G.furn.push(it); return o; }
  return setGear(selEn, c, it);
}
function returnHeld() {
  if (!held) return; const it = held.it, f = held.from;
  if ((f === 'w' || f === 'a') && selEn && !selEn.gear?.[f] && fitsSlot(it, f)) setGear(selEn, f, it);
  else if (!bagPut(it, f === 'bag' ? held.pos : null)) { const fp = furnFree(); if (fp >= 0) { it.fpos = fp; G.furn.push(it); } else if (selEn) setGear(selEn, it.slot, it); }
  held = null;
}
function cantUse(it) { S.fail(); message(it.slot === 'w' ? `${TYPES[selEn.type].name}用不了${WEAPONS[it.type].cat}，这是${TYPES[it.type].name}的武器` : '这里放不下'); }
let lastPick = null;
function clickCell(c, p) {
  if (c === 'w' || c === 'a') { if (!selEn) return; }
  const now = performance.now();
  if (!held) { const it = take(c, p); if (!it) return; held = { it, from: c, pos: p }; lastPick = { c, p, t: now }; S.pick(); }
  else { // a quick second tap on the same cell = double-click: quick move
    if (lastPick && lastPick.c === c && lastPick.p === p && now - lastPick.t < 380 && held.from === c) { lastPick = null; put(c, p, held.it); held = null; quick(c, p); return; }
    if ((c === 'w' || c === 'a') && !fitsSlot(held.it, c)) { cantUse(held.it); return; }
    const o = put(c, p, held.it); held = o ? { it: o, from: c, pos: p } : null; lastPick = null; S.clank(); }
  save(); render();
}
// right-click / double-click: equip it, put it in the furnace, or take it back to the bag
function quick(c, p) {
  if (held) return; const it = at(c, p); if (!it) return;
  if (c === 'bag') { const s = it.slot === 'w' ? 'w' : 'a';
    if (selEn && fitsSlot(it, s)) { take('bag', p); const o = setGear(selEn, s, it); if (o) { o.pos = p; G.bag.push(o); } S.clank(); }
    else { const fp = furnFree(); if (fp < 0) { message('熔炉放满了'); return; } take('bag', p); it.fpos = fp; G.furn.push(it); S.clank(); } }
  else if (c === 'furn' || c === 'w' || c === 'a') { if (bagFree() < 0) { message('背包满了'); return; } const t = take(c, p); bagPut(t); S.clank(); }
  hideTip(); save(); render();
}

// ---------- DOM ----------
function build() {
  if (built) return; built = true;
  const d = document.createElement('div'); d.id = 'gearP';
  d.innerHTML = `<div id="gearBox" class="panel"><button class="btn" id="gearX">✖</button>
    <div class="gTitle">装备 <span class="sub" id="gSub"></span></div><div class="gWho" id="gWho"></div>
    <div class="gMain"><div class="gLeft"><div class="gDollRow"><div class="gSlot" data-c="w"></div><div id="gDoll"></div><div class="gSlot" data-c="a"></div></div><div class="gStats" id="gStats"></div></div>
      <div class="gRight"><div class="gLab">背包</div><div class="gGrid gBag" id="gBag"></div>
        <div class="gFurn"><div class="gfT">🔥 熔炉 <small>丢进 2 件以上，熔出 1 件随机装备；丢得越多越好，出好东西的几率越大</small></div>
          <div class="gfRow"><div class="gGrid gF" id="gF"></div><div class="gfSide"><div class="gfOdds" id="gfOdds"></div><button class="btn gGo" id="gGo">熔炼</button></div></div></div></div></div>
    <div class="gInfo" id="gInfo"></div><div id="gTip"></div><div id="gHeld"></div></div>`;
  document.body.appendChild(d); initR(); $('#gDoll').appendChild(R.domElement);
  d.addEventListener('pointerdown', e => { if (e.target.id === 'gearP' || e.target.id === 'gearX') closeGear(); });
  d.addEventListener('pointermove', e => { const hd = $('#gHeld'); if (held && e.pointerType === 'mouse') { hd.style.left = e.clientX + 'px'; hd.style.top = e.clientY + 'px'; } });
  d.addEventListener('contextmenu', e => { e.preventDefault(); const el = e.target.closest('.cell, .gSlot'); if (el) quick(el.dataset.c, +el.dataset.p || 0); });
  // one set of listeners for every cell (cells are re-rendered all the time)
  d.addEventListener('click', e => { const el = e.target.closest('.cell, .gSlot'); if (!el) return; e.stopPropagation(); hideTip(); clickCell(el.dataset.c, +el.dataset.p || 0); });
  let tipEl = null;
  d.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const el = e.target.closest('.cell, .gSlot'); if (el === tipEl) return; tipEl = el; hideTip();
    if (el && !held) { const it = at(el.dataset.c, +el.dataset.p || 0); if (it) showTip(it, el); } });
  $('#gGo').addEventListener('click', e => { e.stopPropagation(); smelt(); });
}
const cellHTML = (it, c, p, extra = '') => `<div class="cell${it ? ' q' + it.q : ''}${extra}" data-c="${c}" data-p="${p}">${it ? `<img src="${iconOf(it)}" draggable="false">` : ''}</div>`;
export function render() {
  if (!gearOpen) return; const en = selEn;
  $('#gSub').textContent = `背包 ${G.bag.length} / ${BAG_MAX}`;
  // who: every summon, party first
  const list = G.crypt.slice().sort((a, b) => (b.active - a.active) || (b.champ - a.champ) || (b.level - a.level));
  $('#gWho').innerHTML = list.length ? list.map(e => `<button class="btn pt${e === en ? ' cur' : ''}${e.active ? ' on' : ''}" data-id="${e.id}" title="${TYPES[e.type].name}" style="${e.champ && e.mods[0] ? `border-color:#${MODS[e.mods[0]].col.toString(16).padStart(6, '0')}` : ''}">${TYPES[e.type].icon}<small>${e.level}</small></button>`).join('')
    : '<div class="gNone">还没有召唤物。装备只能给召唤物穿。</div>';
  $('#gWho').querySelectorAll('.pt').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); selEn = G.crypt.find(x => x.id === +b.dataset.id); render(); }));
  // paperdoll frames
  for (const el of document.querySelectorAll('.gSlot')) { const c = el.dataset.c, it = en && en.gear ? en.gear[c] : null, ok = held && en && fitsSlot(held.it, c);
    el.className = 'gSlot' + (it ? ' q' + it.q : '') + (held ? ok ? ' can' : ' no' : ''); el.dataset.p = 0;
    el.innerHTML = it ? `<img src="${iconOf(it)}" draggable="false">` : `<span>${c === 'w' ? (en ? WEAPONS[en.type].cat : '武器') : '盾'}</span>`; }
  setDoll();
  // stats
  if (en) { const o = { kind: en.type, side: 'ally', level: en.level, mods: en.mods, champ: en.champ, entry: en, T: TYPES[en.type] }; Unit.prototype.stats.call(o);
    $('#gStats').innerHTML = `<div class="gsN">${en.champ && en.mods[0] ? `<span style="color:#ffb347">${MODS[en.mods[0]].name}</span>` : ''}${TYPES[en.type].name} <small>Lv ${en.level}${en.active ? ' · 出战中' : ''}</small></div>
      <div class="gsL"><span>生命 <b>${Math.round(o.maxHp)}</b></span><span>伤害 <b>${o.dmg.toFixed(1)}</b></span><span>护甲 <b>${Math.round(o.armor)}</b></span><span>攻击间隔 <b>${o.cd.toFixed(2)}s</b></span></div>`; }
  else $('#gStats').innerHTML = '';
  // bag + furnace
  let h = ''; for (let p = 0; p < BAG_MAX; p++) { const it = at('bag', p), fit = it && en && fitsSlot(it, it.slot === 'w' ? 'w' : 'a'); h += cellHTML(it, 'bag', p, it && en && !fit ? ' nofit' : ''); } $('#gBag').innerHTML = h;
  h = ''; for (let p = 0; p < FURN_N; p++) h += cellHTML(at('furn', p), 'furn', p); $('#gF').innerHTML = h;
  const o = furnaceOdds(G.furn), pc = v => Math.round(v * 100) + '%';
  $('#gfOdds').innerHTML = G.furn.length ? `<span style="color:${QUAL[2].col}">稀有 ${pc(o.gold)}</span><span style="color:${QUAL[1].col}">精良 ${pc(o.blue)}</span><span style="color:${QUAL[0].col}">普通 ${pc(o.white)}</span>` : '<span class="dim">空</span>';
  $('#gGo').disabled = G.furn.length < 2;
  // held item
  const hd = $('#gHeld'); hd.style.display = held && !touchUI ? 'block' : 'none'; if (held) hd.innerHTML = `<img src="${iconOf(held.it)}">`;
  $('#gInfo').innerHTML = held ? `<div class="hold"><img src="${iconOf(held.it)}">${tipHTML(held.it)}</div><div class="hint">${touchUI ? '点武器框/盾框装备，点格子放下，点熔炉格放进熔炉' : '点武器框/盾框装备，点格子放下，点熔炉格放进熔炉　·　右键：一键装备 / 放进熔炉'}</div>`
    : `<div class="hint">${touchUI ? '点一件装备拿起来，再点要放的位置；双击：一键装备（用不了的放进熔炉）' : '点装备拿起，再点要放的位置　·　右键或双击：一键装备（用不了的放进熔炉）　·　熔炉里的右键拿回背包'}</div>`;
}
// Diablo-style item text
function tipHTML(it) {
  const B = itemBase(it), fit = !selEn || (it.slot === 'w' ? itemFits(it, selEn.type) : true), cur = selEn && selEn.gear ? selEn.gear[it.slot === 'w' ? 'w' : 'a'] : null;
  const isCur = cur === it, sc = itemScore(it), cs = itemScore(cur);
  const cmp = !selEn || isCur || !fit ? '' : !cur ? `<div class="tC up">${TYPES[selEn.type].name}现在没穿</div>` : sc > cs + 0.5 ? `<div class="tC up">▲ 比现在的强</div>` : sc < cs - 0.5 ? `<div class="tC dn">▼ 不如现在的</div>` : `<div class="tC">与现在的差不多</div>`;
  return `<div class="tip"><div class="tN" style="color:${QUAL[it.q].col}">${itemName(it)}</div><div class="tB">${it.slot === 'w' ? `${WEAPONS[it.type].cat} · ${B.name}` : `护甲 · ${B.name}`}</div>
    <div class="tI">物品等级 ${it.il}</div>${itemLines(it).map(l => `<div class="tL">${l}</div>`).join('')}
    ${it.slot === 'w' ? `<div class="tR${fit ? '' : ' bad'}">${TYPES[it.type].name}专用</div>` : '<div class="tR">所有召唤物</div>'}${isCur ? '<div class="tC">正在穿着</div>' : cmp}</div>`;
}
function showTip(it, el) { const t = $('#gTip'), r = el.getBoundingClientRect(); t.innerHTML = tipHTML(it); t.style.display = 'block';
  const tw = t.offsetWidth, th = t.offsetHeight; let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8; if (y < 8) y = r.bottom + 8; x = Math.max(8, Math.min(innerWidth - tw - 8, x)); t.style.left = x + 'px'; t.style.top = y + 'px'; }
function hideTip() { const t = $('#gTip'); if (t) t.style.display = 'none'; }

// ---------- furnace ----------
function smelt() {
  if (G.furn.length < 2 || held) return; const odds = furnaceOdds(G.furn), res = furnaceRoll(G.furn, G.uid++); G.furn = [res]; res.fpos = 0; save(); S.fire();
  const box = document.createElement('div'); box.className = 'gReel'; box.innerHTML = '<div class="lt">炉火翻滚……</div><div class="reel"></div><button class="btn ok" style="visibility:hidden">收下</button>';
  $('.gFurn').appendChild(box); const reel = box.querySelector('.reel'); let dly = 45;
  const show = it => { reel.innerHTML = `<div class="ri q${it.q}"><img src="${iconOf(it)}"><div class="tN" style="color:${QUAL[it.q].col}">${itemName(it)}</div></div>`; };
  const tick = () => { if (!gearOpen) return; if (dly > 300) { show(res); reel.classList.add('done', 'q' + res.q); box.querySelector('.lt').textContent = res.q === 2 ? '✨ 熔出了稀有装备！' : res.q === 1 ? '熔出了精良装备' : '熔出了一件普通装备';
      box.querySelector('.ok').style.visibility = 'visible'; if (res.q === 2) S.level(); else if (res.q === 1) S.caught(); else S.pick(); return; }
    const r = Math.random(); show(rollItem(0, res.il, r < odds.gold ? 2 : r < odds.gold + odds.blue ? 1 : 0)); S.pick(); dly *= 1.13; setTimeout(tick, dly); };
  tick(); box.querySelector('.ok').addEventListener('click', e => { e.stopPropagation(); box.remove(); render(); });
  render();
}

// ---------- open / close ----------
export function openGear(en) {
  closeCrypt(); build(); makeIcons(); gearOpen = true; $('#gearP').classList.add('open');
  selEn = en || G.crypt.find(e => e.active) || G.crypt[0] || null; dollKey = ''; render(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
export function closeGear() { if (!gearOpen) return; returnHeld(); save(); gearOpen = false; hideTip(); const p = $('#gearP'); if (p) p.classList.remove('open'); cancelAnimationFrame(raf); for (const r of document.querySelectorAll('.gReel')) r.remove(); }
export function toggleGear() { gearOpen ? closeGear() : openGear(); }
