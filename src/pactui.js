// 魂契 UI: the skeleton's card (top left), soul energy on the summoner panel, the summon button, and the Pact panel
// (strengthen the summon with 魂能, pick a weapon style, see the skeleton's stacks). Uses the crypt overlay's frame.
import { G } from './state.js';
import { tr } from './i18n.js';
import { SETS, SUMMON, heroBase, heroName, heroUnit, stackNeed, lvlCost, levelUp, setStyle, summonK } from './pact.js';
import { PACE } from './data.js';
import { plumeTier, PLUME_AT } from './assets.js';
import { SKILLS } from './pactskills.js';

const $ = s => document.querySelector(s), P8 = G.pact;
const pct = v => Math.round(v * 100) + '%';
const per = (b, k) => ({ hp: Math.round(b.maxHp), dmg: Math.round(b.dmg), aps: (PACE.act / b.cd).toFixed(2), mv: (b.speed * PACE.move).toFixed(1), eva: pct(b.evade) });

let cardSig = '';
export function pactHUD() {
  const party = $('#party'), u = heroUnit(), out = !!u, W = SETS[P8.wset];
  const sig = JSON.stringify([out, P8.lvl, P8.stacks, P8.wset]);
  if (sig !== cardSig) { cardSig = sig;
    party.innerHTML = `<div class="pc pact${out ? '' : ' dead'}" title="${tr('打开魂契', 'Open the Pact')}"><span class="ic">${W.icon}</span><div class="pi"><div class="pn"><span class="pnn">${heroName()}</span><small>Lv${P8.lvl}</small>${P8.stacks ? `<span class="spb fury">✦${P8.stacks}</span>` : ''}</div>`
      + (out ? `<div class="ph"><i></i></div><div class="pk"><i></i></div>` : `<div class="pz">${tr('未召唤 · 按 E', 'not summoned · E')}</div>`) + `</div></div>`; }
  if (u) { const i = party.querySelector('.ph i'), k = party.querySelector('.pk i'); if (i) i.style.width = (u.hp / u.maxHp * 100) + '%'; if (k) k.style.width = (P8.kills / stackNeed(P8.stacks) * 100) + '%'; }
  $('#soulT').textContent = tr(`魂能 ${G.soul}`, `Soul ${G.soul}`) + (G.soul >= lvlCost(P8.lvl) ? tr(' · 可强化', ' · upgrade ready') : '');
  $('#soulT').classList.toggle('ready', G.soul >= lvlCost(P8.lvl));
  const sb = $('#sSummon'); sb.classList.toggle('out', out); sb.style.setProperty('--cast', (summonK() * 100) + '%');
  $('#cryptN').textContent = P8.lvl;
}

// the helmet crest shows the level (see PLUME_AT in assets.js)
const CREST = [[tr('骨黑', 'bone-black'), '#8d8a86'], [tr('幽蓝', 'azure'), '#5f9cff'], [tr('鎏金', 'gold'), '#ffc83a'], [tr('紫焰', 'violet fire'), '#b46cff'], [tr('赤焰', 'crimson fire'), '#ff5030']];
function crestLine(L) { const t = plumeTier(L), c = CREST[t], n = CREST[t + 1], dot = k => `<b style="color:${k[1]}">●</b>`;
  return `<div class="lv">${tr('头盔鬃毛', 'Helmet crest')} ${dot(c)} ${c[0]}${n ? tr(` · Lv ${PLUME_AT[t]} 化为 `, ` · Lv ${PLUME_AT[t]}: `) + `${dot(n)} ${n[0]}` : ''}</div>`; }
// ---------- the Pact panel ----------
let panelSig = '';
export function renderPact(force) {
  const u = heroUnit(), sig = JSON.stringify([G.soul, P8.lvl, P8.wset, P8.stacks, P8.kills, !!u, u ? Math.round(u.hp) : 0]);
  if (!force && sig === panelSig) return; panelSig = sig;
  const L = P8.lvl, W = SETS[P8.wset], cost = lvlCost(L), now = per(heroBase(L, 0, P8.wset)), nx = per(heroBase(L + 1, 0, P8.wset));
  $('#cryptHead').innerHTML = tr(`魂契 <span class="sub">魂能 ${G.soul}</span>`, `The Pact <span class="sub">Soul energy ${G.soul}</span>`);
  const style = k => { const S = SETS[k], b = per(heroBase(L, 0, k)); return `<div class="card pst${k === P8.wset ? ' on' : ''}" data-set="${k}"><span class="ic">${S.icon}</span><div class="info"><div class="nm">${S.name} · ${S.style}</div>`
    + `<div class="lv">${tr('生命', 'Life')} <b>${b.hp}</b> · ${tr('伤害', 'Damage')} <b>${b.dmg}</b> · ${tr('闪避', 'Evasion')} <b>${b.eva}</b></div><div class="ds">${S.desc}</div></div></div>`; };
  let cur;
  if (u) { const b = per({ maxHp: u.maxHp, dmg: u.dmg, cd: u.cd * PACE.act, speed: u.speed / PACE.move, evade: u.evade }), s = P8.stacks;
    cur = `<div class="nm">${tr('在场', 'On the field')} · ${tr('战魂', 'Fury')} <b class="fury">✦${s}</b></div>`
      + `<div class="lv">${tr(`下一层还差 ${stackNeed(s) - P8.kills} 次击杀`, `${stackNeed(s) - P8.kills} more kills to the next stack`)}</div><div class="xp"><i style="width:${P8.kills / stackNeed(s) * 100}%"></i></div>`
      + `<div class="ds">${tr('生命', 'Life')} ${Math.ceil(u.hp)} / ${b.hp} · ${tr('伤害', 'Damage')} ${b.dmg} · ${tr('每秒攻击', 'Attacks/s')} ${b.aps} · ${tr('移速', 'Speed')} ${b.mv} · ${tr('闪避', 'Evasion')} ${b.eva}<br>`
      + `${tr(`战魂加成：伤害 +${s * 6}%，攻速 +${s * 4}%，移速 +${Math.round(Math.min(0.3, 0.02 * s) * 100)}%，生命 +${(s * 2.5).toFixed(0)}%`, `Fury bonus: +${s * 6}% damage, +${s * 4}% attack speed, +${Math.round(Math.min(0.3, 0.02 * s) * 100)}% speed, +${(s * 2.5).toFixed(0)}% life`)}</div>`; }
  else cur = `<div class="nm">${tr('未召唤', 'Not summoned')}</div><div class="ds">${tr(`按 E（或「召唤」按钮）施法 ${SUMMON.cast} 秒，消耗 ${SUMMON.mana} 法力。`, `Press E (or the Summon button): a ${SUMMON.cast} s cast, ${SUMMON.mana} mana.`)}</div>`;
  $('#cryptList').innerHTML = `<div class="card ptop"><span class="ic">💀</span><div class="info"><div class="nm">${tr(`召唤${heroName()}`, `Summon ${heroName()}`)} · Lv ${L}</div>`
    + `<div class="lv">${tr('召唤出的骸骨卫士等级 = 技能等级', 'The Sentinel comes out at the skill\'s level')}</div>` + crestLine(L)
    + `<div class="ds">${tr('生命', 'Life')} ${now.hp} → <b>${nx.hp}</b> · ${tr('伤害', 'Damage')} ${now.dmg} → <b>${nx.dmg}</b></div>`
    + `<button class="btn pup"${G.soul < cost ? ' disabled' : ''} data-act="up">${tr(`强化到 Lv ${L + 1}（${cost} 魂能）`, `Strengthen to Lv ${L + 1} (${cost} soul)`)}</button></div></div>`
    + `<div class="card pcur"><span class="ic">${W.icon}</span><div class="info">${cur}</div></div>`
    + `<div class="psec">${tr('技能（自动释放）', 'Skills (used on its own)')}</div>` + SKILLS.map(s => `<div class="card pskl${L >= s.at ? ' on' : ''}"><span class="ic">${s.icon}</span><div class="info">`
      + `<div class="nm">${s.name} <span class="sub">${L >= s.at ? tr(`冷却 ${s.cd} 秒`, `${s.cd} s cooldown`) : tr(`Lv ${s.at} 解锁`, `unlocks at Lv ${s.at}`)}</span></div><div class="ds">${s.desc}</div></div></div>`).join('')
    + `<div class="psec">${tr('武器流派', 'Weapon style')}</div>` + style('SNS') + style('GS')
    + `<div class="cEmpty prules">${tr('骸骨卫士亲手击杀敌人会积攒战魂（精英算 4 次、骷髅战士算 2 次），每层提升伤害、攻速、移速和生命。它倒下时战魂全部清零。<br>唤魂把尸体化成魂能，魂能用来强化召唤。', 'Kills by the Sentinel\'s own hand build Fury (elites count 4, warriors 2): each stack adds damage, attack speed, move speed and life. When it falls, all Fury is lost.<br>Raise turns corpses into soul energy, which strengthens the summon.')}</div>`;
}
export function bindPact() {
  $('#cryptList').addEventListener('click', e => { const up = e.target.closest('[data-act="up"]'), st = e.target.closest('[data-set]');
    if (up) { levelUp(); renderPact(true); } else if (st) { setStyle(st.dataset.set); renderPact(true); } });
  const lb = $('#bCrypt .lb'); if (lb) lb.textContent = tr(' 魂契', ' Pact'); $('#bCrypt').firstChild.textContent = '💀';
}
