// 魂契 UI: the skeleton's card (top left, with a small paperdoll that opens its equipment), the summon button, and the Pact panel (the
// summoning tome and the soul vessel, the weapon style and the way to its gear, the 战魂 skill badges). The soul vessel: soulvessel.js.
// Uses the crypt overlay's frame.
import { G } from './state.js';
import { tr } from './i18n.js';
import { SETS, SUMMON, heroBase, furyBonus, heroName, heroUnit, stackNeed, summonK, heroEntry, infuseCost, INFUSE } from './pact.js';
import { PACE, QUAL } from './data.js';
import { openGear } from './gearui.js';
import { heroHeadURL } from './icons.js';
import { plumeTier, PLUME_AT, soulTier } from './assets.js';
import { SKILLS as SKILLS0, skillView } from './pactskills.js';

const $ = s => document.querySelector(s), P8 = G.pact;
const pct = v => Math.round(v * 100) + '%';
const per = b => ({ hp: Math.round(b.maxHp), dmg: Math.round(b.dmg), aps: (PACE.act / b.cd).toFixed(2), mv: (b.speed * PACE.move).toFixed(1), eva: pct(b.evade) });
export const openHeroGear = () => openGear(heroEntry());

// ---------- the skeleton's card: its head (crest and face; a tap opens its equipment), name, level, Fury, life and kills to the next stack ----------
let cardSig = '';
export function pactHUD() {
  const party = $('#party'), u = heroUnit(), out = !!u, W = SETS[P8.wset], fig = heroHeadURL(heroEntry(), P8.stacks);
  const sig = JSON.stringify([out, P8.stacks, P8.wset, fig.length]);
  if (sig !== cardSig) { cardSig = sig;
    party.innerHTML = `<div class="pc pact${out ? '' : ' dead'}" title="${tr('打开魂契', 'Open the Pact')}"><span class="ic phd" title="${tr('打开装备', 'Open the equipment')}">${fig ? `<img src="${fig}" draggable="false">` : W.icon}<i>${W.icon}</i></span>`
      + `<div class="pi"><div class="pn"><span class="pnn">${heroName()}</span>${P8.stacks ? `<span class="spb fury">✦${P8.stacks}</span>` : ''}</div>`
      + (out ? `<div class="ph"><i></i></div><div class="pk"><i></i></div>` : `<div class="pz">${tr('未召唤 · 按 E', 'not summoned · E')}</div>`) + `</div></div>`; }
  if (u) { const i = party.querySelector('.ph i'), k = party.querySelector('.pk i'); if (i) i.style.width = (u.hp / u.maxHp * 100) + '%'; if (k) k.style.width = (P8.kills / stackNeed(P8.stacks) * 100) + '%'; }
  const sb = $('#sSummon'); sb.classList.toggle('out', out && G.soul < 1); sb.style.setProperty('--cast', (summonK() * 100) + '%'); // (with the Sentinel out, held, it pours the soul vessel)
  const nm = sb.querySelector('.nm'), lb = out ? tr('灌注', 'Pour') : tr('召唤', 'Summon'); if (nm.textContent !== lb) nm.textContent = lb;
  $('#cryptN').style.display = 'none';
}

// the helmet crest and the soul light show its 战魂 (PLUME_AT / soulTier in assets.js)
const CREST = [[tr('骨黑', 'bone-black'), '#8d8a86'], [tr('幽蓝', 'azure'), '#5f9cff'], [tr('鎏金', 'gold'), '#ffc83a'], [tr('紫焰', 'violet fire'), '#b46cff'], [tr('赤焰', 'crimson fire'), '#ff5030']];
// the 战魂 on the field, in brief (shown in the equipment panel)
export function furyBrief() {
  const u = heroUnit(), s = P8.stacks, c = CREST[plumeTier(s)], need = stackNeed(s), sl = soulTier(s);
  if (!u) return `<div class="gsF"><b class="fury">✦ ${tr('战魂', 'Fury')} 0</b> <span class="dim">${tr('· 未召唤（战魂随卫士倒下清零）', '· not summoned (Fury is lost when it falls)')}</span></div>`;
  return `<div class="gsF"><div class="gfr"><b class="fury">✦ ${tr('战魂', 'Fury')} ${s}</b><span class="dim">${tr(`下一层还差 ${Math.ceil(need - P8.kills - 1e-6)} 次击杀`, `${Math.ceil(need - P8.kills - 1e-6)} kills to the next`)}</span></div>`
    + `<div class="gfb"><i style="width:${P8.kills / need * 100}%"></i></div>`
    + `<div class="gfl">${tr('鬃毛', 'Crest')} <b style="color:${c[1]}">●</b> ${c[0]} · ${tr('魂光', 'Soul light')} ${sl ? tr(`${sl} 档`, `step ${sl}`) : tr('未亮', 'dark')} · ${(f => tr(`伤害 +${f.dmg}% 攻速 +${f.spd}% 移速 +${f.move}% 生命 +${f.hp.toFixed(0)}%`, `+${f.dmg}% dmg, +${f.spd}% speed, +${f.move}% move, +${f.hp.toFixed(0)}% life`))(furyBonus(s))}</div></div>`;
}

// ---------- the Pact panel ----------
// the summoning skill drawn as a tome: dark leather, a page block, brass corners and clasp, a soul-lit skull on the cover
const BOOK = `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><defs>
<linearGradient id="bkC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6e4796"/><stop offset=".55" stop-color="#3e2163"/><stop offset="1" stop-color="#21103a"/></linearGradient>
<radialGradient id="bkG"><stop offset="0" stop-color="#eafffc"/><stop offset=".35" stop-color="#5ff2ff" stop-opacity=".8"/><stop offset="1" stop-color="#3fe0d0" stop-opacity="0"/></radialGradient></defs>
<path d="M13 8h23.5a2.5 2.5 0 0 1 2.5 2.5v28a2.5 2.5 0 0 1-2.5 2.5H13z" fill="#ebdfc0"/>
<path d="M36.6 10.5v28M38 11v27" stroke="#b9a479" stroke-width=".7" fill="none"/><path d="M14 39.4h22M14 40.4h21" stroke="#b9a479" stroke-width=".55"/>
<rect x="8" y="5" width="27" height="34" rx="2.5" fill="url(#bkC)" stroke="#140a22" stroke-width="1.2"/>
<rect x="8" y="5" width="5.2" height="34" rx="2" fill="#1d0e30"/><path d="M13.2 6v32" stroke="#9a78c6" stroke-width=".6" opacity=".55"/>
<path d="M9 11h4M9 33h4" stroke="#c9b27a" stroke-width="1.1"/>
<rect x="15.6" y="8.6" width="16.6" height="26.8" rx="1.5" fill="none" stroke="#b08cdc" stroke-width=".8" opacity=".55"/>
<path d="M35 5h-5.5l5.5 5.5zM35 39h-5.5l5.5-5.5z" fill="#d2b97e" stroke="#7a6232" stroke-width=".5"/>
<circle cx="23.9" cy="21.4" r="10.5" fill="url(#bkG)" opacity=".8"/>
<path d="M23.9 14.6c-3.7 0-6.3 2.7-6.3 6 0 2.1 1 3.6 2.4 4.5v2.5h7.8v-2.5c1.4-.9 2.4-2.4 2.4-4.5 0-3.3-2.6-6-6.3-6z" fill="#e2fdff"/>
<circle cx="21.5" cy="20.9" r="1.7" fill="#2a1546"/><circle cx="26.3" cy="20.9" r="1.7" fill="#2a1546"/><path d="M23.9 23l-1 1.7h2z" fill="#2a1546"/>
<path d="M21.4 26.4v1.6M23.1 26.4v1.6M24.7 26.4v1.6M26.4 26.4v1.6" stroke="#2a1546" stroke-width=".65"/>
<rect x="31.5" y="19" width="6.5" height="5.4" rx="1.1" fill="#d2b97e" stroke="#6a5530" stroke-width=".6"/><circle cx="34.8" cy="21.7" r=".9" fill="#6a5530"/></svg>`;
// each skill badge in the colour of the crest tier it wakes with (25: past the crest, a deep crimson)
const BADGE = { 5: '#5f9cff', 10: '#ffc83a', 15: '#b46cff', 20: '#ff5030', 25: '#ff2f6a' };
let panelSig = '', selSkill = null;
export function renderPact(force) {
  const u = heroUnit(), s = P8.stacks, soul = Math.floor(G.soul), sig = JSON.stringify([soul, P8.wset, s, Math.floor(P8.kills), !!u, selSkill]);
  if (!force && sig === panelSig) return; panelSig = sig;
  const W = SETS[P8.wset], now = per(heroBase(1, 0, P8.wset)), cost = infuseCost();
  $('#cryptHead').innerHTML = tr(`魂契 <span class="sub">魂能 ${soul}</span>`, `The Pact <span class="sub">Soul energy ${soul}</span>`);
  // the 战魂 skills as a row of badges on one track, filled up to its Fury; the picked one is described in a fixed box below
  const SKILLS = SKILLS0.map(k => skillView(k, P8.wset)); // (named and told as its style has them)
  if (!selSkill) selSkill = (SKILLS.filter(k => s >= k.at).pop() || SKILLS[0]).id;
  const n = SKILLS.length, xs = SKILLS.map((k, i) => (i + 0.5) / n), at = SKILLS.map(k => k.at);
  let fill = 0; if (s >= at[n - 1]) fill = 1; else { let a0 = 0, x0 = 0; for (let i = 0; i < n; i++) { if (s < at[i]) { fill = x0 + (xs[i] - x0) * (s - a0) / (at[i] - a0); break; } a0 = at[i]; x0 = xs[i]; } }
  const sk = SKILLS.find(k => k.id === selSkill) || SKILLS[0], on = s >= sk.at, col = BADGE[sk.at] || '#ffd27a';
  const tree = `<div class="ptree"><div class="ptk"><i style="width:${fill * 100}%"></i></div>`
    + SKILLS.map((k, i) => { const o = s >= k.at; return `<button class="pbg${o ? ' on' : ''}${k.id === selSkill ? ' sel' : ''}" data-skill="${k.id}" style="left:${xs[i] * 100}%;--bc:${BADGE[k.at] || '#ffd27a'}">`
      + `<span class="pbi">${k.icon}</span>${o ? '' : '<span class="pbl">🔒</span>'}<span class="pbn">${k.name}</span><span class="pba">✦${k.at}</span></button>`; }).join('') + `</div>`
    + `<div class="pskD" style="--bc:${col}"><span class="pdi">${sk.icon}</span><div class="info"><div class="nm">${sk.name} <span class="pst2${on ? ' on' : ''}">${on ? (sk.passive ? tr('已觉醒 · 被动', 'awake · passive') : tr(`已觉醒 · 冷却 ${sk.cd} 秒`, `awake · ${sk.cd} s cooldown`)) : tr(`战魂 ${sk.at} 层觉醒 · 还差 ${sk.at - s} 层`, `wakes at ${sk.at} Fury · ${sk.at - s} to go`)}</span></div>`
    + `<div class="ds">${sk.desc}</div></div></div>`;
  $('#cryptList').innerHTML = `<div class="card ptop"><span class="ic book">${BOOK}</span><div class="info"><div class="nm">${tr(`召唤${heroName()}`, `Summon ${heroName()}`)}</div>`
    + `<div class="ds">${tr('生命', 'Life')} ${now.hp} · ${tr('伤害', 'Damage')} ${now.dmg} · ${tr('它的强大来自战魂和装备', 'its strength comes from Fury and gear')}</div>`
    + `<div class="ds pjar">${tr(`<b>魂瓶</b>（左下角）现有 <b>${soul}</b> 魂能。按住魂瓶（或按住 E）把魂能灌注给场上的卫士，直接加战魂${u ? `：下一层需 <b>${cost}</b>` : '（先召唤）'}。`, `<b>Soul vessel</b> (bottom left): <b>${soul}</b> soul. Hold it (or hold E) to pour soul into the Sentinel on the field — straight into Fury${u ? `: <b>${cost}</b> to the next stack` : ' (summon it first)'}.`)}</div></div></div>`
    + `<div class="card pstyle"><span class="ic">${W.icon}</span><div class="info"><div class="nm">${tr('流派', 'Style')} · ${W.name} <span class="sub">${W.style}</span></div><div class="ds">${W.desc}</div>`
    + `<div class="ds dim">${tr('流派由武器决定：双手大剑 → 大剑流派；单手剑 → 剑盾流派；单手锤 → 锤盾圣骑士（剑盾和锤盾要格挡就得装盾）', 'The weapon decides: a greatsword fights Greatsword, a sword Sword & Shield, a mace Paladin (blocking needs a shield)')}</div></div>`
    + `<button class="btn pgearBig" data-act="gear">⚔ ${tr('装备卫士', 'Equip')}</button></div>`
    + `<div class="psec">${tr(`战魂技能 <span class="sub">卫士亲手击杀积攒战魂，到层数觉醒，倒下清零；自动释放</span>`, `Fury skills <span class="sub">kills by its own hand build Fury; each wakes at its stack, all lost when it falls; used on its own</span>`)}</div>`
    + `<div class="ptreeW">${tree}</div>`
    + `<div class="cEmpty prules">${tr(`骸骨卫士亲手击杀敌人会积攒战魂（精英算 4 次、骷髅战士算 2 次），每层提升伤害、攻速、移速和生命。它倒下时战魂全部清零。<br>唤魂把尸体化成魂能，飞进魂瓶存起来；按住魂瓶把魂能灌注给卫士，直接加战魂（一次击杀的进度 = ${INFUSE.soulPerKill} 魂能）——它倒下后，靠攒下的魂能能很快充回来。`, `Kills by the Sentinel's own hand build Fury (elites count 4, warriors 2): each stack adds damage, attack speed, move speed and life. When it falls, all Fury is lost.<br>Raise turns corpses into soul energy that flies into the soul vessel; hold the vessel to pour it into the Sentinel as Fury (one kill's worth = ${INFUSE.soulPerKill} soul) — after a fall, what you saved charges it back up quickly.`)}</div>`;
}
export function bindPact() {
  $('#cryptList').addEventListener('click', e => { const gr = e.target.closest('[data-act="gear"]'), bg = e.target.closest('[data-skill]');
    if (gr) openHeroGear(); else if (bg) { selSkill = bg.dataset.skill; renderPact(true); } });
  const lb = $('#bCrypt .lb'); if (lb) lb.textContent = tr(' 魂契', ' Pact'); $('#bCrypt').firstChild.textContent = '💀';
}
