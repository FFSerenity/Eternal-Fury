// 魂瓶 / the soul orb (魂契 only): the 魂能 the summoner draws out of corpses, kept in a glass globe resting in a rune-carved cradle at
// the bottom left of the screen. A harvested corpse breaks into souls that fly across the screen into the top of the globe; the liquid
// rises as they land. Full at CAP; past that the liquid burns brighter and veins of runes crawl up over the glass, a layer at a time
// in the crest's colours — azure, gold, violet, crimson (each layer bigger than the last). Held down — the globe itself, E, or the
// summon button while the Sentinel is out — it pours: souls stream out of its top into the Sentinel's chest, the runes sink back and
// the liquid falls, the Sentinel glows brighter the longer it drinks and gains 战魂 stacks (pact.js infuseTick). G.soul is what
// counts (saved at once); the globe shows it as the souls arrive.
import { G, save } from './state.js';
import { tr } from './i18n.js';
import { C } from './units.js';
import { S } from './audio.js';
import { heroUnit, infuseTick, infuseCost } from './pact.js';
import { toScreen, IN, message } from './ui.js';

const CAP = 100, LAYERS = [100, 200, 300, 400], RUNE_COL = ['#5f9cff', '#ffc83a', '#b46cff', '#ff5030'];
const J = { el: null, svg: null, liq: null, halo: null, glow: null, core: null, num: null, hint: null, bub: null, vn: [], cg: [], cr: [], last: {}, shown: 0, inflight: 0, motes: [], pour: false, boost: 0, outAcc: 0, said: 0 };
const rand = (a, b) => a + Math.random() * (b - a);
// how much shows: the liquid (0–1 up to CAP), then the rune layers past it — done: layers complete, prog: the one crawling up
export function orbState(v) {
  if (v <= CAP) return { fill: Math.max(0, v / CAP), done: 0, prog: 0, lum: 0 };
  let r = v - CAP, k = 0; while (k < LAYERS.length && r >= LAYERS[k]) { r -= LAYERS[k]; k++; }
  return { fill: 1, done: k, prog: k < LAYERS.length ? r / LAYERS[k] : 0, lum: Math.min(1, (v - CAP) / LAYERS.reduce((a, b) => a + b, 0)) };
}
// ---- the globe, drawn once (viewBox 80 × 96): the glass sphere (centre (40, 42), radius 30), the liquid inside it, rune veins over the
// glass, the cradle under its lower half (an iron band with bronze rims, two claws gripping the sides, runes cut along it, a foot)
const CX = 40, CY = 42, R0 = 30, P = (r, a) => [CX + r * Math.cos(a * Math.PI / 180), CY + r * Math.sin(a * Math.PI / 180)], f1 = v => v.toFixed(1), pt = q => `${f1(q[0])} ${f1(q[1])}`;
function seeded(n) { let s = n >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// a layer of veins: meridians running up the sphere's front face (bent a little, step by step, like cut lines), rungs between them,
// small rune diamonds on the way; each layer turned a little against the last so they don't sit on top of one another
function veinPath(t) {
  const rnd = seeded(97 * t + 13), R = 28.3, n = 7, f0 = (0.23 + 0.37 * t) % (Math.PI / n), lines = [], ph = []; let d = '';
  for (let i = 0; i < n; i++) { let phi = -Math.PI / 2 + f0 + (i + 0.5) * Math.PI / n; const row = [];
    for (let k = 0; k <= 12; k++) { const lat = -1.32 + k * 2.64 / 12; if (k % 2) phi += (rnd() - 0.5) * 0.2; row.push([phi, lat]); }
    ph.push(row); const xy = row.map(([p, l]) => [CX + R * Math.sin(p) * Math.cos(l), CY - R * Math.sin(l)]); lines.push(xy);
    d += 'M' + xy.map(pt).join('L');
    for (const k of [2, 5, 8, 11]) if (rnd() < 0.55) { const [x, y] = xy[k]; d += `M${f1(x)} ${f1(y - 1.7)}L${f1(x + 1.2)} ${f1(y)}L${f1(x)} ${f1(y + 1.7)}L${f1(x - 1.2)} ${f1(y)}Z`; } }
  for (let i = 0; i < n - 1; i++) for (const k of [1, 4, 7, 10]) if (rnd() < 0.42) { const l = ph[i][k][1], y = CY - R * Math.sin(l), a = CX + R * Math.sin(ph[i][k][0]) * Math.cos(l), b = CX + R * Math.sin(ph[i + 1][k][0]) * Math.cos(l);
    d += `M${f1(a)} ${f1(y)}H${f1(b)}`; }
  return d;
}
// runes cut into the cradle: tiny angular glyphs, set along the band's middle and turned to follow it
const GLYPH = ['M0 -2.2V2.2M0 -2.2L1.6 -0.6M0 -0.6L1.6 1', 'M-1 -2.2V2.2M-1 -2.2L1.2 -0.4L-1 1.2', 'M0 -2.2V2.2M-1.6 -1.2L1.6 1.2M1.6 -1.2L-1.6 1.2', 'M-1.6 2.2L0 -2.2L1.6 2.2M-0.8 0.4H0.8',
  'M0 -2.2L1.6 0L0 2.2L-1.6 0Z', 'M-1.4 -2.2V2.2M1.4 -2.2V2.2M-1.4 -0.6L1.4 0.6', 'M0 -2.2V2.2M-1.6 -2.2L0 -0.4L1.6 -2.2'];
function orbSVG() {
  const a1 = 6, a2 = 174, Ro = 35, Ri = 30.6, Rm = 32.8, L = a2 - a1 > 180 ? 1 : 0; // (the band holds the lower half; the claws grip the sides)
  const band = `M${pt(P(Ro, a1))}A${Ro} ${Ro} 0 ${L} 1 ${pt(P(Ro, a2))}L${pt(P(Ri, a2))}A${Ri} ${Ri} 0 ${L} 0 ${pt(P(Ri, a1))}Z`;
  const claw = s => { const a = s < 0 ? a1 : a2, d = s < 0 ? -1 : 1; return `M${pt(P(Ro, a))}Q${pt(P(Ro + 0.6, a + d * 13))} ${pt(P(Rm - 0.4, a + d * 27))}Q${pt(P(Ri - 0.4, a + d * 12))} ${pt(P(Ri, a))}Z`; };
  let runes = ''; for (let i = 0; i < 7; i++) { const a = a1 + 14 + i * (a2 - a1 - 28) / 6, [x, y] = P(Rm, a); runes += `<path d="${GLYPH[i % GLYPH.length]}" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(a - 90)})"/>`; }
  const veins = LAYERS.map((_, t) => { const d = veinPath(t + 1), c = RUNE_COL[t];
    return `<g class="vn" style="display:none"><path d="${d}" fill="none" stroke="${c}" stroke-opacity=".38" stroke-width="3.2" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="1" stroke-linejoin="round"/>`
      + `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".35" stroke-linejoin="round"/></g>`; }).join('');
  return `<svg viewBox="0 0 80 96" aria-hidden="true"><defs>
<radialGradient id="jHa"><stop offset="0" stop-color="#5ff2ff" stop-opacity=".55"/><stop offset=".5" stop-color="#3fd8e0" stop-opacity=".18"/><stop offset="1" stop-color="#3fd8e0" stop-opacity="0"/></radialGradient>
<linearGradient id="jLq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8fffb"/><stop offset=".1" stop-color="#6ff2ea"/><stop offset=".55" stop-color="#2aa9b4"/><stop offset="1" stop-color="#145a6e"/></linearGradient>
<radialGradient id="jIn" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#eafffd" stop-opacity=".8"/><stop offset="1" stop-color="#eafffd" stop-opacity="0"/></radialGradient>
<radialGradient id="jCo"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#dffffb" stop-opacity=".75"/><stop offset="1" stop-color="#8ff7ea" stop-opacity="0"/></radialGradient>
<linearGradient id="jIr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3d5c"/><stop offset=".55" stop-color="#2a2236"/><stop offset="1" stop-color="#140f1c"/></linearGradient>
<linearGradient id="jBr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d79a"/><stop offset=".5" stop-color="#b8904a"/><stop offset="1" stop-color="#6e5228"/></linearGradient>
<linearGradient id="jCg" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="72"><stop class="cg0" offset="1" stop-color="#fff" stop-opacity="0"/><stop class="cg1" offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>
<mask id="jCrw" maskUnits="userSpaceOnUse" x="0" y="0" width="80" height="96"><rect x="0" y="0" width="80" height="96" fill="url(#jCg)"/></mask>
<clipPath id="jCl"><circle cx="${CX}" cy="${CY}" r="28.6"/></clipPath><clipPath id="jCg2"><circle cx="${CX}" cy="${CY}" r="${R0}"/></clipPath></defs>
<circle class="jHalo" cx="${CX}" cy="${CY}" r="46" fill="url(#jHa)"/>
<path d="M30.5 76.5H49.5L53.5 88.5H26.5Z" fill="url(#jIr)" stroke="url(#jBr)" stroke-width=".9"/><rect x="24" y="87.5" width="32" height="4" rx="2" fill="url(#jBr)" stroke="#4a3618" stroke-width=".6"/>
<circle cx="${CX}" cy="${CY}" r="${R0}" fill="rgba(18,26,40,.82)"/><circle cx="${CX}" cy="${CY}" r="${R0}" fill="rgba(140,230,240,.07)"/>
<g clip-path="url(#jCl)"><g class="jLiq">
  <g class="wv2"><path d="M-40 1Q-30 -2 -20 1T0 1T20 1T40 1T60 1T80 1T100 1T120 1V110H-40Z" fill="#3fd0d8" opacity=".55"/></g>
  <g class="wv1"><path d="M-40 2Q-30 -1.5 -20 2T0 2T20 2T40 2T60 2T80 2T100 2T120 2V110H-40Z" fill="url(#jLq)"/></g>
  <rect class="jGlow" x="5" y="2" width="70" height="108" fill="url(#jIn)" opacity=".35"/>
</g><circle class="jCore" cx="${CX}" cy="${CY + 6}" r="17" fill="url(#jCo)" opacity="0"/>
<g class="jBub"><circle class="bub b1" cx="31" cy="66" r="1.6"/><circle class="bub b2" cx="44" cy="68" r="1.1"/><circle class="bub b3" cx="50" cy="65" r="1.9"/><circle class="bub b4" cx="37" cy="67" r="1"/></g></g>
<g clip-path="url(#jCg2)">${veins}</g>
<circle cx="${CX}" cy="${CY}" r="${R0}" fill="none" stroke="rgba(225,252,255,.8)" stroke-width="1.7"/>
<path d="M${pt(P(25, 200))}A25 25 0 0 1 ${pt(P(25, 248))}" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="2.8" stroke-linecap="round"/><ellipse cx="51" cy="22" rx="2.6" ry="1.6" fill="#fff" opacity=".5" transform="rotate(35 51 22)"/>
<path d="${band}" fill="url(#jIr)" stroke="url(#jBr)" stroke-width="1"/><path d="M${pt(P(Ri + 0.7, a1 + 4))}A${Ri + 0.7} ${Ri + 0.7} 0 0 1 ${pt(P(Ri + 0.7, a2 - 4))}" fill="none" stroke="#f1d79a" stroke-opacity=".35" stroke-width=".5"/>
<path d="${claw(-1)}" fill="url(#jIr)" stroke="url(#jBr)" stroke-width=".9"/><path d="${claw(1)}" fill="url(#jIr)" stroke="url(#jBr)" stroke-width=".9"/>
<g class="jRun" fill="none" stroke="#8ff7ea" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round">${runes}</g></svg>`;
}

export function initJar() {
  const el = document.querySelector('#jar'); if (!el) return; J.el = el; el.innerHTML = orbSVG() + '<b class="jN">0</b><span class="jH"></span>';
  const q = c => el.querySelector(c); J.svg = q('svg'); J.liq = q('.jLiq'); J.halo = q('.jHalo'); J.glow = q('.jGlow'); J.core = q('.jCore'); J.run = q('.jRun'); J.num = q('.jN'); J.hint = q('.jH'); J.bub = q('.jBub');
  J.vn = [...el.querySelectorAll('.vn')]; J.cg = [q('.cg0'), q('.cg1')];
  el.title = tr('魂瓶：按住（或按住 E）把魂能灌注给骸骨卫士', 'Soul vessel: hold it (or hold E) to pour soul into the Bone Sentinel');
  const stop = () => { IN.infuse = false; };
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); IN.infuse = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} });
  el.addEventListener('pointerup', stop); el.addEventListener('pointercancel', stop); el.addEventListener('lostpointercapture', stop);
  J.shown = G.soul;
}
// where the souls go in and come out: the vessel's neck, on screen
function neck() { const r = J.svg.getBoundingClientRect(); return [r.left + r.width * 0.5, r.top + r.height * 0.15]; } // (the top of the globe)

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
  orbLook(J.shown, pour);
  J.num.textContent = Math.floor(J.shown + 1e-6);
  const hint = !u ? tr('召唤卫士后可灌注', 'summon to pour') : G.soul < 1 ? tr('唤魂收集', 'harvest corpses') : pour ? tr('灌注中…', 'pouring…') : tr(`按住灌注 · 下层 ${infuseCost()}`, `hold · next ✦ ${infuseCost()}`);
  if (J.hint.textContent !== hint) J.hint.textContent = hint;
}

// the globe's look for v 魂能 (attributes only touched when they change)
const setA = (el, k, v) => { const id = k; if (el['_' + id] !== v) { el['_' + id] = v; el.setAttribute(k, v); } };
const setS = (el, k, v) => { if (el.style[k] !== v) el.style[k] = v; };
function orbLook(v, pour) {
  const o = orbState(v), pulse = 0.5 + 0.5 * Math.sin(G.t * 2.4);
  setA(J.liq, 'transform', `translate(0 ${(70.6 - o.fill * 57.2).toFixed(1)})`); setS(J.bub, 'opacity', o.fill > 0.2 ? '1' : '0');
  // past full it burns brighter: the glow in the liquid, a white core, the halo around the globe
  setA(J.glow, 'opacity', (0.32 + 0.55 * o.lum + (pour ? 0.15 : 0)).toFixed(2)); setA(J.core, 'opacity', (o.fill >= 1 ? 0.25 + 0.65 * o.lum + 0.1 * pulse : 0).toFixed(2));
  setS(J.halo, 'opacity', (0.2 + 0.45 * o.fill + 0.5 * o.lum + (pour ? 0.4 : 0) + 0.12 * pulse).toFixed(2)); setA(J.halo, 'r', (40 + 10 * o.lum).toFixed(1));
  // the rune layers: done ones shown (the older ones fainter), the next one crawling up from the cradle
  J.vn.forEach((g, i) => { const t = i + 1;
    if (t <= o.done) { setS(g, 'display', ''); setS(g, 'opacity', t === o.done ? (0.78 + 0.22 * pulse).toFixed(2) : '0.32'); if (g._crawl) { g.removeAttribute('mask'); g._crawl = false; } }
    else if (t === o.done + 1 && o.prog > 0.001) { setS(g, 'display', ''); setS(g, 'opacity', '1'); if (!g._crawl) { g.setAttribute('mask', 'url(#jCrw)'); g._crawl = true; }
      const f = 1 - o.prog; setA(J.cg[0], 'offset', Math.max(0, f - 0.07).toFixed(3)); setA(J.cg[1], 'offset', Math.min(1, f + 0.015).toFixed(3)); }
    else { setS(g, 'display', 'none'); if (g._crawl) { g.removeAttribute('mask'); g._crawl = false; } } });
  // the cradle's runes take the colour of the top layer, and blaze while it pours
  setA(J.run, 'stroke', o.done ? RUNE_COL[o.done - 1] : '#8ff7ea'); setS(J.run, 'opacity', (pour ? 1 : 0.45 + 0.35 * pulse + 0.2 * o.lum).toFixed(2));
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
