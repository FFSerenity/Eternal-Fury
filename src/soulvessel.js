// 魂瓶 / the soul vessel (魂契 only): the 魂能 the summoner draws out of corpses, kept in a glass flask at the bottom left of the screen.
// A harvested corpse breaks into souls that fly across the screen into its neck; the liquid rises as they land. Held down — the flask
// itself, E, or the summon button while the Sentinel is out — it pours: souls stream from its neck into the Sentinel's chest, the
// liquid sinks, the Sentinel glows brighter the longer it drinks and gains 战魂 stacks (pact.js infuseTick). How full it looks:
// 60 魂能 is half, and it never quite fills. G.soul is what counts (saved at once); the flask shows it as the souls arrive.
import { G, save } from './state.js';
import { tr } from './i18n.js';
import { C } from './units.js';
import { S } from './audio.js';
import { heroUnit, infuseTick, infuseCost } from './pact.js';
import { toScreen, IN, message } from './ui.js';

const HALF = 60, J = { el: null, svg: null, liq: null, halo: null, num: null, hint: null, bub: null, shown: 0, inflight: 0, motes: [], pour: false, boost: 0, outAcc: 0, said: 0 };
const rand = (a, b) => a + Math.random() * (b - a);
// the flask: a round-bottomed bottle with a brass collar and a cork, glowing liquid with two waves on its surface, bubbles, a faint
// etched skull, a highlight on the glass (viewBox 80 × 100; the bulb's centre (40, 58.6), the liquid from y 86.5 up to the neck at 14)
const SVG = `<svg viewBox="0 0 80 100" aria-hidden="true"><defs>
<radialGradient id="jHa"><stop offset="0" stop-color="#5ff2ff" stop-opacity=".55"/><stop offset=".5" stop-color="#3fd8e0" stop-opacity=".18"/><stop offset="1" stop-color="#3fd8e0" stop-opacity="0"/></radialGradient>
<linearGradient id="jLq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8fffb"/><stop offset=".12" stop-color="#6ff2ea"/><stop offset=".6" stop-color="#2aa9b4"/><stop offset="1" stop-color="#145a6e"/></linearGradient>
<radialGradient id="jIn" cx=".5" cy=".62" r=".55"><stop offset="0" stop-color="#eafffd" stop-opacity=".75"/><stop offset="1" stop-color="#eafffd" stop-opacity="0"/></radialGradient>
<linearGradient id="jBr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d79a"/><stop offset=".5" stop-color="#b8904a"/><stop offset="1" stop-color="#6e5228"/></linearGradient>
<clipPath id="jCl"><path d="M35 11H45V31A28 28 0 1 1 35 31Z"/></clipPath></defs>
<circle class="jHalo" cx="40" cy="58" r="44" fill="url(#jHa)"/>
<path d="M33 9H47V29.5A30 30 0 1 1 33 29.5Z" fill="rgba(20,30,44,.78)"/><path d="M33 9H47V29.5A30 30 0 1 1 33 29.5Z" fill="rgba(140,230,240,.07)"/>
<g clip-path="url(#jCl)"><g class="jLiq">
  <g class="wv2"><path d="M-40 1Q-30 -2 -20 1T0 1T20 1T40 1T60 1T80 1T100 1T120 1V110H-40Z" fill="#3fd0d8" opacity=".55"/></g>
  <g class="wv1"><path d="M-40 2Q-30 -1.5 -20 2T0 2T20 2T40 2T60 2T80 2T100 2T120 2V110H-40Z" fill="url(#jLq)"/></g>
  <rect x="5" y="2" width="70" height="108" fill="url(#jIn)"/>
</g><g class="jBub"><circle class="bub b1" cx="31" cy="84" r="1.6"/><circle class="bub b2" cx="44" cy="86" r="1.1"/><circle class="bub b3" cx="50" cy="84" r="1.9"/><circle class="bub b4" cx="37" cy="85" r="1"/></g></g>
<g opacity=".2" fill="none" stroke="#eafffd" stroke-width=".9"><path d="M40 50c-3.6 0-6.1 2.6-6.1 5.8 0 2 1 3.5 2.3 4.3v2.4h7.6v-2.4c1.3-.8 2.3-2.3 2.3-4.3 0-3.2-2.5-5.8-6.1-5.8z"/><circle cx="37.7" cy="56.1" r="1.4"/><circle cx="42.3" cy="56.1" r="1.4"/></g>
<path d="M33 9H47V29.5A30 30 0 1 1 33 29.5Z" fill="none" stroke="rgba(225,252,255,.8)" stroke-width="1.8"/>
<path d="M19.5 50Q17 65 25.5 77" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.6" stroke-linecap="round"/><path d="M36 14V27" stroke="#fff" stroke-opacity=".3" stroke-width="1.4" stroke-linecap="round"/>
<rect x="31" y="6.5" width="18" height="6" rx="2" fill="url(#jBr)" stroke="#4a3618" stroke-width=".7"/><rect x="33.6" y="1.5" width="12.8" height="5.6" rx="1.6" fill="#7a5232" stroke="#3a2412" stroke-width=".6"/></svg>`;

export function initJar() {
  const el = document.querySelector('#jar'); if (!el) return; J.el = el; el.innerHTML = SVG + '<b class="jN">0</b><span class="jH"></span>';
  J.svg = el.querySelector('svg'); J.liq = el.querySelector('.jLiq'); J.halo = el.querySelector('.jHalo'); J.num = el.querySelector('.jN'); J.hint = el.querySelector('.jH'); J.bub = el.querySelector('.jBub');
  el.title = tr('魂瓶：按住（或按住 E）把魂能灌注给骸骨卫士', 'Soul vessel: hold it (or hold E) to pour soul into the Bone Sentinel');
  const stop = () => { IN.infuse = false; };
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); IN.infuse = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} });
  el.addEventListener('pointerup', stop); el.addEventListener('pointercancel', stop); el.addEventListener('lostpointercapture', stop);
  J.shown = G.soul;
}
// where the souls go in and come out: the vessel's neck, on screen
function neck() { const r = J.svg.getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.13]; }

// a corpse's 魂能 (v), from world (x, y, z): a few souls fly into the vessel; it counts at once, the flask shows it as they land
export function soulToJar(x, y, z, v) {
  G.soul += v; save(); if (!J.el) return; J.inflight += v;
  const [sx, sy] = toScreen(x, y, z), n = Math.max(1, Math.min(12, Math.round(1.4 * Math.sqrt(v))));
  for (let i = 0; i < n; i++) J.motes.push({ k: 'in', x0: sx + rand(-14, 14), y0: sy + rand(-10, 10), t: -i * 0.06 - rand(0, 0.08), dur: rand(0.62, 0.86), v: v / n, bend: rand(-1, 1), tr: [] });
}

// per frame: the pour, the souls in flight, the flask
export function jarTick(dt) {
  if (!J.el) return; const P = G.player, u = heroUnit();
  if (IN.infuse) { // asked to pour: only into a Sentinel out on the field, only while there is something in the vessel
    if (!u || u.spawnT > 0 || !P || P.dead) { if (!u && G.t - J.said > 1.5) { J.said = G.t; message(tr('先召唤骸骨卫士（E），才能把魂能灌给它', 'Summon the Bone Sentinel first (E) to pour soul into it')); } if (!u) IN.infuse = false; }
    else if (G.soul <= 0) { if (G.t - J.said > 1.5) { J.said = G.t; message(tr('魂瓶空了：对尸体唤魂（Q）收集魂能', 'The vessel is empty: harvest corpses (Q) for soul')); } IN.infuse = false; } }
  const pour = !!(IN.infuse && u && u.spawnT <= 0 && G.soul > 0 && P && !P.dead);
  if (pour !== J.pour) { J.pour = pour; J.el.classList.toggle('pour', pour); if (!pour) save(); }
  if (pour) { infuseTick(u, dt); J.outAcc += dt * 16; while (J.outAcc >= 1) { J.outAcc--; J.motes.push({ k: 'out', t: 0, dur: rand(0.42, 0.58), bend: rand(-1, 1), tr: [] }); } }
  J.boost = pour ? Math.min(1, J.boost + dt / 1.6) : Math.max(0, J.boost - dt / 0.9); if (u) u.soulBoost = J.boost; // it glows brighter the longer it drinks
  // souls in flight
  let j = 0; const [nx, ny] = neck(), hx = u ? toScreen(u.x, 1.25 + (u.mesh.root.position.y || 0), u.z) : null;
  for (const m of J.motes) { m.t += dt / m.dur; if (m.t < 0) { J.motes[j++] = m; continue; }
    let x0, y0, x1, y1; if (m.k === 'in') { x0 = m.x0; y0 = m.y0; x1 = nx; y1 = ny; } else { if (!hx) continue; x0 = nx; y0 = ny; x1 = hx[0]; y1 = hx[1]; }
    const e = m.k === 'in' ? Math.pow(Math.min(1, m.t), 1.7) : 1 - Math.pow(1 - Math.min(1, m.t), 2), d = Math.hypot(x1 - x0, y1 - y0) || 1;
    const cx = (x0 + x1) / 2 - (y1 - y0) / d * m.bend * d * 0.3, cy = (y0 + y1) / 2 + (x1 - x0) / d * m.bend * d * 0.3 - d * 0.22; // an arc, bowed up and to one side
    const q = 1 - e; m.x = q * q * x0 + 2 * q * e * cx + e * e * x1; m.y = q * q * y0 + 2 * q * e * cy + e * e * y1; m.tr.push(m.x, m.y); if (m.tr.length > 16) m.tr.splice(0, 2);
    if (m.t >= 1) { if (m.k === 'in') { J.inflight = Math.max(0, J.inflight - m.v); S.gulp(); if (J.svg.animate) J.svg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 220 }); }
      else if (u) { S.infuse(); C.parts.emit(u.x, 1.25, u.z, 3, { col: Math.random() < 0.3 ? 0xffffff : 0x8ff7ea, spd: 1.5, up: 1, grav: 0, life: 0.4, size: 0.2, spread: 0.15 }); }
      continue; }
    J.motes[j++] = m; }
  J.motes.length = j;
  // the flask: liquid level, glow, the number and a word on what to do with it
  const tgt = Math.max(0, G.soul - J.inflight); J.shown += (tgt - J.shown) * Math.min(1, dt * (pour ? 16 : 8)); if (Math.abs(tgt - J.shown) < 0.02) J.shown = tgt;
  const f = J.shown / (J.shown + HALF); J.liq.setAttribute('transform', `translate(0 ${(86.5 - f * 72.5).toFixed(2)})`); J.bub.style.opacity = f > 0.2 ? 1 : 0;
  J.halo.style.opacity = (0.25 + 0.6 * f + (pour ? 0.5 : 0) + 0.15 * Math.sin(G.t * 2.4)).toFixed(3);
  J.num.textContent = Math.floor(J.shown + 1e-6);
  const hint = !u ? tr('召唤卫士后可灌注', 'summon to pour') : G.soul < 1 ? tr('唤魂收集', 'harvest corpses') : pour ? tr('灌注中…', 'pouring…') : tr(`按住灌注 · 下层 ${infuseCost()}`, `hold · next ✦ ${infuseCost()}`);
  if (J.hint.textContent !== hint) J.hint.textContent = hint;
}

// the souls in flight, drawn on the overlay canvas after the bars and names (a fading tail, a cyan glow, a white core)
export function jarDraw() {
  if (!J.el || !J.motes.length) return; const c = document.querySelector('#ov'), g = c.getContext('2d'), k = c.width / (c.clientWidth || innerWidth);
  g.save(); g.setTransform(k, 0, 0, k, 0, 0); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (const m of J.motes) { if (m.t < 0 || m.x == null) continue; const T = m.tr, n = T.length / 2;
    for (let i = 1; i < n; i++) { const a = i / n; g.strokeStyle = `rgba(111,247,234,${(0.55 * a).toFixed(3)})`; g.lineWidth = 1.5 + 5 * a; g.beginPath(); g.moveTo(T[i * 2 - 2], T[i * 2 - 1]); g.lineTo(T[i * 2], T[i * 2 + 1]); g.stroke(); }
    const r = m.k === 'in' ? 14 : 11, gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(200,255,250,0.95)'); gr.addColorStop(0.45, 'rgba(111,247,234,0.55)'); gr.addColorStop(1, 'rgba(95,242,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(m.x, m.y, r, 0, Math.PI * 2); g.fill(); }
  g.restore();
}
// a new floor: nothing in flight carries over (G.soul already has it all)
export function jarReset() { J.motes.length = 0; J.inflight = 0; J.shown = G.soul; IN.infuse = false; }
