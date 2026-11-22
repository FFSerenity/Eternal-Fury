// Two Diablo-style panels sharing one layout:
//  - 装备 (opened from a summon's card at the top left): live 3D paperdoll of that summon with weapon / shield frames + the bag
//  - 背包 (🎒 button / I): the bag + the furnace (熔炉), with an auto-fill button
// Items are moved by picking them up and putting them down (click / tap); right-click or double-tap is a quick move.
// A fixed info box shows the hovered or held item, so nothing jumps around.
import * as THREE from 'three';
import { G, save, bagPut, bagFree } from './state.js';
import { TYPES, MODS, QUAL, WEAPONS, BAG_MAX, itemName, itemLines, itemScore, itemFits, itemBase, furnaceOdds, furnaceRoll, rollItem } from './data.js';
import { setGear, Unit, ANIM } from './units.js';
import { makeUnitMesh, play } from './assets.js';
import { initR, lit, itemIconURL as iconOf, portrait } from './icons.js';
import { S } from './audio.js';
import { message, closeCrypt, touchUI } from './ui.js';

const $ = s => document.querySelector(s), FURN_N = 12;
export let gearOpen = false;
let mode = 'bag', selEn = null, held = null, built = false, raf = 0, last = 0, infoIt = null;

// ---------- paperdoll ----------
let R = null, dollScene, dollCam, doll = null, dollKey = '';
function setDoll() {
  const en = selEn, key = en && mode === 'doll' ? en.id + ':' + (en.gear?.w?.id || 0) + ':' + (en.gear?.a?.id || 0) : ''; if (key === dollKey) return; dollKey = key;
  if (doll) { dollScene.remove(doll.root); doll = null; } if (!key) return;
  doll = makeUnitMesh(en.type, { gear: en.gear, elem: en.champ && en.mods[0] ? en.mods[0] : null, tint: en.mods.includes('stone') ? 0xb8b4ac : 0xffffff });
  dollScene.add(doll.root); play(doll, ANIM[en.type].idle, {}); doll.mixer.update(0);
  const box = new THREE.Box3().setFromObject(doll.root), h = box.max.y - box.min.y || 1.2;
  dollCam.position.set(0, h * 0.62, h * 2.55); dollCam.lookAt(0, h * 0.48, 0); doll.root.rotation.y = 0.5;
}
function loop(t) {
  if (!gearOpen) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
  const box = $('#gDoll'); if (mode !== 'doll' || !box || !doll) return; const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  if (R.domElement.parentNode !== box) box.appendChild(R.domElement);
  const pr = Math.min(2, devicePixelRatio || 1); if (R.getPixelRatio() !== pr || R.domElement.width !== Math.round(w * pr) || R.domElement.height !== Math.round(h * pr)) { R.setPixelRatio(pr); R.setSize(w, h, false); dollCam.aspect = w / h; dollCam.updateProjectionMatrix(); }
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
function put(c, p, it) { // returns the displaced item (or null)
  if (c === 'bag') { const o = take('bag', p); it.pos = p; G.bag.push(it); return o; }
  if (c === 'furn') { const o = take('furn', p); it.fpos = p; G.furn.push(it); return o; }
  return setGear(selEn, c, it);
}
function returnHeld() {
  if (!held) return; const it = held.it, f = held.from;
  if ((f === 'w' || f === 'a') && selEn && !selEn.gear?.[f] && fitsSlot(it, f)) setGear(selEn, f, it);
  else if (!bagPut(it, f === 'bag' ? held.pos : null)) { const fp = furnFree(); if (fp >= 0) { it.fpos = fp; G.furn.push(it); } }
  held = null;
}
function cantUse(it) { S.fail(); message(it.slot === 'w' ? `${TYPES[selEn.type].name}用不了${WEAPONS[it.type].cat}，这是${TYPES[it.type].name}的武器` : '这里放不下'); }
let lastPick = null;
function clickCell(c, p) {
  if ((c === 'w' || c === 'a') && !selEn) return;
  const now = performance.now();
  if (!held) { const it = take(c, p); if (!it) return; held = { it, from: c, pos: p }; lastPick = { c, p, t: now }; S.pick(); }
  else { // a quick second tap on the same cell = double-click: quick move
    if (lastPick && lastPick.c === c && lastPick.p === p && now - lastPick.t < 380 && held.from === c) { lastPick = null; put(c, p, held.it); held = null; quick(c, p); return; }
    if ((c === 'w' || c === 'a') && !fitsSlot(held.it, c)) { cantUse(held.it); return; }
    const o = put(c, p, held.it); held = o ? { it: o, from: c, pos: p } : null; lastPick = null; S.clank(); }
  infoIt = held ? held.it : at(c, p); save(); render();
}
// quick move: 装备 panel equips / takes off; 背包 panel moves between bag and furnace
function quick(c, p) {
  if (held) return; const it = at(c, p); if (!it) return;
  if (c === 'bag' && mode === 'doll') { const s = it.slot === 'w' ? 'w' : 'a'; if (!fitsSlot(it, s)) { cantUse(it); return; }
    take('bag', p); const o = setGear(selEn, s, it); if (o) { o.pos = p; G.bag.push(o); } S.clank(); }
  else if (c === 'bag') { const fp = furnFree(); if (fp < 0) { message('熔炉放满了'); return; } take('bag', p); it.fpos = fp; G.furn.push(it); S.clank(); }
  else { if (bagFree() < 0) { message('背包满了'); return; } bagPut(take(c, p)); S.clank(); }
  infoIt = null; save(); render();
}
// auto-fill: plain items first, then 精良 ones nobody would wear; never 稀有
function autoFill() {
  const upgrade = it => G.crypt.some(en => (it.slot === 'a' || it.type === en.type) && itemScore(it) > itemScore(en.gear?.[it.slot === 'w' ? 'w' : 'a']) + 0.5);
  const cand = G.bag.filter(it => it.q === 0 || (it.q === 1 && !upgrade(it))).sort((a, b) => a.q - b.q || itemScore(a) - itemScore(b));
  let n = 0; for (const it of cand) { const fp = furnFree(); if (fp < 0) break; G.bag.splice(G.bag.indexOf(it), 1); it.fpos = fp; G.furn.push(it); n++; }
  if (n) S.clank(); else message('背包里没有适合丢进熔炉的（稀有和用得上的精良不会自动放）'); save(); render();
}
function emptyFurn() { for (const it of G.furn.slice()) { if (bagFree() < 0) break; G.furn.splice(G.furn.indexOf(it), 1); bagPut(it); } S.clank(); save(); render(); }

// ---------- DOM ----------
function build() {
  if (built) return; built = true; R = initR(); dollScene = new THREE.Scene(); dollCam = new THREE.PerspectiveCamera(28, 0.8, 0.1, 60);
  const d = document.createElement('div'); d.id = 'gearP';
  d.innerHTML = `<div id="gearBox" class="panel"><button class="btn" id="gearX">✖</button><div class="gTitle"><span id="gT"></span> <span class="sub" id="gSub"></span></div>
    <div class="gMain"><div class="gLeft" id="gLeft"></div><div class="gRight"><div class="gLab">背包</div><div class="gGrid gBag" id="gBag"></div></div><div class="gSide" id="gSide"></div></div>
    <div class="gInfo" id="gInfo"></div><div id="gHeld"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('pointerdown', e => { if (e.target.id === 'gearP' || e.target.id === 'gearX') closeGear(); });
  d.addEventListener('pointermove', e => { const hd = $('#gHeld'); if (held && e.pointerType === 'mouse') { hd.style.left = e.clientX + 'px'; hd.style.top = e.clientY + 'px'; } });
  d.addEventListener('contextmenu', e => { e.preventDefault(); const el = e.target.closest('.cell, .gSlot'); if (el) quick(el.dataset.c, +el.dataset.p || 0); });
  d.addEventListener('click', e => { const el = e.target.closest('.cell, .gSlot'); if (!el) return; e.stopPropagation(); clickCell(el.dataset.c, +el.dataset.p || 0); });
  d.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse' || held) return; const el = e.target.closest('.cell, .gSlot'), it = el ? at(el.dataset.c, +el.dataset.p || 0) : null; if (it !== infoIt) { infoIt = it; renderInfo(); } });
}
const cellHTML = (it, c, p, extra = '') => `<div class="cell${it ? ' q' + it.q : ''}${extra}" data-c="${c}" data-p="${p}">${it ? `<img src="${iconOf(it)}" draggable="false">` : ''}</div>`;
export function render() {
  if (!gearOpen) return; const en = selEn, doll = mode === 'doll' && en;
  $('#gearBox').className = 'panel ' + (doll ? 'mDoll' : 'mBag');
  $('#gT').textContent = doll ? '装备' : '背包'; $('#gSub').textContent = `背包 ${G.bag.length} / ${BAG_MAX}`;
  if (doll) {
    const o = { kind: en.type, side: 'ally', level: en.level, mods: en.mods, champ: en.champ, entry: en, T: TYPES[en.type] }; Unit.prototype.stats.call(o);
    if (!$('#gDoll')) $('#gLeft').innerHTML = `<div class="gDollRow"><div class="gSlot" data-c="w" data-p="0"></div><div id="gDoll"></div><div class="gSlot" data-c="a" data-p="0"></div></div><div class="gStats" id="gStats"></div>`;
    for (const el of document.querySelectorAll('.gSlot')) { const c = el.dataset.c, it = en.gear ? en.gear[c] : null, ok = held && fitsSlot(held.it, c);
      el.className = 'gSlot' + (it ? ' q' + it.q : '') + (held ? ok ? ' can' : ' no' : '');
      el.innerHTML = it ? `<img src="${iconOf(it)}" draggable="false">` : `<span>${c === 'w' ? WEAPONS[en.type].cat : '盾'}</span>`; }
    $('#gStats').innerHTML = `<div class="gsN">${portrait(en.type, 'sm')}${en.champ && en.mods[0] ? `<span style="color:#ffb347">${MODS[en.mods[0]].name}</span>` : ''}${TYPES[en.type].name} <small>Lv ${en.level}${en.active ? ' · 出战中' : ''}</small></div>
      <div class="gsL"><span>生命 <b>${Math.round(o.maxHp)}</b></span><span>伤害 <b>${o.dmg.toFixed(1)}</b></span><span>护甲 <b>${Math.round(o.armor)}</b></span><span>攻击间隔 <b>${o.cd.toFixed(2)}s</b></span></div>`;
    $('#gSide').innerHTML = '';
  } else {
    $('#gLeft').innerHTML = '';
    if (!$('#gF')) $('#gSide').innerHTML = `<div class="gFurn"><div class="gfT">🔥 熔炉</div><div class="gfD">丢进 2 件以上，熔出 1 件随机装备。丢得越多、品质越好，出好东西的几率越大。</div>
      <div class="gGrid gF" id="gF"></div><div class="gfOdds" id="gfOdds"></div><div class="gfB"><button class="btn gAuto" id="gAuto">自动放入</button><button class="btn" id="gEmpty">全部取出</button></div><button class="btn gGo" id="gGo">熔炼</button></div>`;
    $('#gAuto').onclick = e => { e.stopPropagation(); autoFill(); }; $('#gEmpty').onclick = e => { e.stopPropagation(); emptyFurn(); }; $('#gGo').onclick = e => { e.stopPropagation(); smelt(); };
    let h = ''; for (let p = 0; p < FURN_N; p++) h += cellHTML(at('furn', p), 'furn', p); $('#gF').innerHTML = h;
    const od = furnaceOdds(G.furn), pc = v => Math.round(v * 100) + '%';
    $('#gfOdds').innerHTML = G.furn.length ? `<span style="color:${QUAL[2].col}">稀有 ${pc(od.gold)}</span><span style="color:${QUAL[1].col}">精良 ${pc(od.blue)}</span><span style="color:${QUAL[0].col}">普通 ${pc(od.white)}</span>` : '<span class="dim">放进装备后显示几率</span>';
    $('#gGo').disabled = G.furn.length < 2; $('#gEmpty').disabled = !G.furn.length;
  }
  setDoll();
  let h = ''; for (let p = 0; p < BAG_MAX; p++) { const it = at('bag', p), fit = !it || !doll || fitsSlot(it, it.slot === 'w' ? 'w' : 'a'); h += cellHTML(it, 'bag', p, fit ? '' : ' nofit'); } $('#gBag').innerHTML = h;
  const hd = $('#gHeld'); hd.style.display = held && !touchUI ? 'block' : 'none'; if (held) hd.innerHTML = `<img src="${iconOf(held.it)}">`;
  renderInfo();
}
// the fixed info box: held item, else hovered item, else a hint
function renderInfo() {
  const it = held ? held.it : infoIt, box = $('#gInfo'); if (!box) return;
  const hint = mode === 'doll' ? (touchUI ? '点装备拿起，再点武器框 / 盾框或格子放下　·　双击：一键穿上' : '点装备拿起，再点武器框 / 盾框或格子放下　·　右键或双击：一键穿上 / 卸下')
    : (touchUI ? '点装备拿起，再点格子或熔炉放下　·　双击：放进熔炉 / 拿回背包' : '点装备拿起，再点格子或熔炉放下　·　右键或双击：放进熔炉 / 拿回背包');
  box.innerHTML = it ? `<div class="gi"><div class="giIc q${it.q}"><img src="${iconOf(it)}"></div>${tipHTML(it)}${held ? '<div class="giH">拿在手上</div>' : ''}</div>` : `<div class="gi empty"><div class="hint">${hint}</div></div>`;
}
// Diablo-style item text
function tipHTML(it) {
  const B = itemBase(it), en = mode === 'doll' ? selEn : null, fit = !en || (it.slot === 'w' ? itemFits(it, en.type) : true), cur = en && en.gear ? en.gear[it.slot === 'w' ? 'w' : 'a'] : null;
  const isCur = cur === it, sc = itemScore(it), cs = itemScore(cur);
  const cmp = !en || isCur || !fit ? '' : !cur ? `<span class="tC up">${TYPES[en.type].name}现在没穿</span>` : sc > cs + 0.5 ? `<span class="tC up">▲ 比现在的强</span>` : sc < cs - 0.5 ? `<span class="tC dn">▼ 不如现在的</span>` : `<span class="tC">与现在的差不多</span>`;
  return `<div class="tip"><div class="tN" style="color:${QUAL[it.q].col}">${itemName(it)} <span class="tI">物品等级 ${it.il}</span></div>
    <div class="tB">${it.slot === 'w' ? `${WEAPONS[it.type].cat} · ${B.name}` : `护甲 · ${B.name}`}　${it.slot === 'w' ? `<span class="tR${fit ? '' : ' bad'}">${TYPES[it.type].name}专用</span>` : '<span class="tR">所有召唤物</span>'}　${isCur ? '<span class="tC">正在穿着</span>' : cmp}</div>
    <div class="tLs">${itemLines(it).map(l => `<span class="tL">${l}</span>`).join('')}</div></div>`;
}

// ---------- furnace ----------
function smelt() {
  if (G.furn.length < 2 || held) return; const odds = furnaceOdds(G.furn), res = furnaceRoll(G.furn, G.uid++); G.furn = [res]; res.fpos = 0; save(); S.fire();
  const box = document.createElement('div'); box.className = 'gReel'; box.innerHTML = '<div class="lt">炉火翻滚……</div><div class="reel"></div><button class="btn ok" style="visibility:hidden">收下</button>';
  $('.gFurn').appendChild(box); const reel = box.querySelector('.reel'); let dly = 45;
  const show = it => { reel.innerHTML = `<div class="ri q${it.q}"><img src="${iconOf(it)}"><div class="tN" style="color:${QUAL[it.q].col}">${itemName(it)}</div></div>`; };
  const tick = () => { if (!gearOpen || !box.isConnected) return; if (dly > 300) { show(res); reel.classList.add('done', 'q' + res.q); box.querySelector('.lt').textContent = res.q === 2 ? '✨ 熔出了稀有装备！' : res.q === 1 ? '熔出了精良装备' : '熔出了一件普通装备';
      box.querySelector('.ok').style.visibility = 'visible'; infoIt = res; renderInfo(); if (res.q === 2) S.level(); else if (res.q === 1) S.caught(); else S.pick(); return; }
    const r = Math.random(); show(rollItem(0, res.il, r < odds.gold ? 2 : r < odds.gold + odds.blue ? 1 : 0)); S.pick(); dly *= 1.13; setTimeout(tick, dly); };
  tick(); box.querySelector('.ok').addEventListener('click', e => { e.stopPropagation(); box.remove(); render(); });
  render();
}

// ---------- open / close ----------
function open(m, en) {
  closeCrypt(); build(); if (gearOpen) returnHeld(); gearOpen = true; mode = m; selEn = en || null; infoIt = null; $('#gearP').classList.add('open');
  $('#gLeft').innerHTML = ''; $('#gSide').innerHTML = ''; dollKey = ''; render(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
export function openGear(en) { if (!en) return; open('doll', en); }
export function openBag() { open('bag', null); }
export function closeGear() { if (!gearOpen) return; returnHeld(); save(); gearOpen = false; const p = $('#gearP'); if (p) p.classList.remove('open'); cancelAnimationFrame(raf); for (const r of document.querySelectorAll('.gReel')) r.remove(); }
export function toggleBag() { gearOpen && mode === 'bag' ? closeGear() : openBag(); }
export const toggleGear = toggleBag;
