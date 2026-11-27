// The sounds: synthesized ones, and recorded ones (assets/sfx) where we have them — every recorded one falls back to its synth while it loads
let ac = null, out = null, noise = null, on = true;
try { on = localStorage.getItem('graveTamerSfx') !== '0'; } catch (e) {}
export function unlock() {
  if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; out = ac.createGain(); out.gain.value = on ? 0.8 : 0; out.connect(comp); comp.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  if (ac.state !== 'running') ac.resume().catch(() => {});
  decodeAll();
}
// recorded sounds (assets/sfx): fetched when asked for, decoded once the audio context exists. The blade bites (blade_*) are Kenney's (CC0);
// swing_l3 is artisticdude's (Swishes, CC0: kept beside the new ones so the light swings repeat less); the rest were made with Stable Audio 3 Medium in ComfyUI and picked by ear. PK: where each is loudest (s), to line it up
const RAW = {}, BUF = {};
const PK = { swing_l0: 0.055, swing_l1: 0.055, swing_l2: 0.035, swing_l3: 0.024, swing_h0: 0.045, swing_h1: 0.045, swing_h2: 0.065, swing_h3: 0.065, fire_sw0: 0.245, fire_sw1: 0.325, charge: 0.355 };
export const SAMPLES = ['blade_l0', 'blade_l1', 'blade_l2', 'blade_h0', 'blade_h1', 'blade_h2', 'swing_l0', 'swing_l1', 'swing_l2', 'swing_l3', 'swing_h0', 'swing_h1', 'swing_h2', 'swing_h3',
  'clang0', 'clang1', 'heavy0', 'heavy1', 'mace_m0', 'mace_m1', 'mace_f0', 'block_b', 'block_h', 'fire_sw0', 'fire_sw1', 'fireburst', 'fcharge', 'fireloop.wav', 'slam0', 'burst_f', 'burst_e',
  'hammers', 'poison0', 'poison1', 'thunder0', 'shadow0', 'shadow1', 'charge', 'warcry', 'warcry_pal', 'holy',
  'zy_intro0', 'zy_intro1', 'zy_rescue']; // (赵云's lines — the person's own, made in ComfyUI: two for his rise, one for To the Rescue)
// the monsters' (loaded in every mode): their cries by kind (r_*: a pack noticing you, a bat diving, a boss's entrance), and their shots
export const FOE_SAMPLES = ['r_human0', 'r_brute0', 'r_skel0', 'r_skel1', 'r_skel2', 'r_skel3', 'r_boss0', 'r_boss1', 'r_boss2', 'r_boss3', 'r_bat0', 'r_ghost0',
  'bow0', 'bow1', 'bow2', 'bow3', 'xbow0', 'xbow1', 'xbow2', 'xbow3', 'axe0', 'axe1', 'fball0', 'fball1', 'fball2', 'hfire0', 'hfire1', 'soul0', 'soul1', 'soul2'];
// the summoner's: Raise (two layers), the souls (flight, a drop into the vessel, the Sentinel drinking, the pour), loot, gear and forge
export const SOUL_SAMPLES = ['rz_rip', 'rz_hum', 'soul_fly', 'absorb', 'pour.wav', 'plink0', 'plink1', 'plink2', 'plink3', 'plink4', 'plink5', 'drop_epic', 'drop_legend', 'gear', 'furn_in', 'draw'];
let plinkT = -9, plinkN = 0;
const CRY = { human: ['r_human0'], brute: ['r_brute0'], skel: ['r_skel0', 'r_skel1', 'r_skel2', 'r_skel3'], bat: ['r_bat0'], ghost: ['r_ghost0'] };
const BOSS_CRY = { bomber: 'r_boss0', gunner: 'r_boss1', engineer: 'r_boss2', mech: 'r_boss3' };
const SHOT = { bow: [4, 0.55], xbow: [4, 0.75], axe: [2, 0.6], fball: [3, 0.6], hfire: [2, 0.6], soul: [3, 0.55] };
const any = (pre, n) => pre + Math.floor(Math.random() * n);
export function loadSamples(names) { for (const n of names) if (!RAW[n]) RAW[n] = fetch(`assets/sfx/${n.includes('.') ? n : n + '.mp3'}`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null); if (ac) decodeAll(); }
function decodeAll() { for (const n in RAW) if (!(n in BUF)) { BUF[n] = null; RAW[n].then(ab => ab && ac.decodeAudioData(ab)).then(b => { BUF[n] = b || null; }).catch(() => {}); } }
function sample(n, v = 1, rate = 1, t = 0) { const b = BUF[n]; if (!b) return false; const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = v;
  s.connect(g); g.connect(out); s.start(ac.currentTime + t); return true; }
// a sound held as long as something lasts (a blade burning): fades in; stop(f) fades it out. A loop is a .wav — an mp3 pads its ends with silence
// (max: it dies away by itself after that long, should nothing stop it)
function loopSample(n, v = 1, fin = 0.25, max = 4) { const b = BUF[n]; if (!b) return null; const s = ac.createBufferSource(), g = ac.createGain(), t0 = ac.currentTime; s.buffer = b; s.loop = true;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + fin); g.gain.setValueAtTime(v, t0 + max - 0.4); g.gain.linearRampToValueAtTime(0, t0 + max);
  s.connect(g); g.connect(out); s.start(t0); s.stop(t0 + max + 0.05); let on = true;
  return { stop(f = 0.3) { if (!on) return; on = false; const t = ac.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + f); s.stop(t + f + 0.05); } }; }
// band-passed noise swept from f0 to f1, swelling then dying away (a blade through the air)
function sweep(f0, f1, q, dur, v, t = 0) { const t0 = ac.currentTime + t, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; fl.type = 'bandpass'; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, t0); fl.frequency.exponentialRampToValueAtTime(f1, t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02); }
export const sfxOn = () => on;
export function setSfx(v) { on = v; if (out) out.gain.setTargetAtTime(v ? 0.8 : 0, ac.currentTime, 0.05); try { localStorage.setItem('graveTamerSfx', v ? '1' : '0'); } catch (e) {} }
const ok = () => ac && on && ac.state === 'running';
function tone(type, f0, f1, dur, v, t = 0) { const t0 = ac.currentTime + t, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02); }
function hiss(f, q, dur, v, t = 0, type = 'bandpass') { const t0 = ac.currentTime + t, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02); }
const lim = {}; const gate = (k, ms) => { const n = performance.now(); if (n - (lim[k] || 0) < ms) return false; lim[k] = n; return true; };
const clank = () => { hiss(1800, 3, 0.09, 0.22); tone('square', 380, 240, 0.08, 0.05); tone('triangle', 1250, 1180, 0.16, 0.05, 0.01); };
export const S = {
  // the 魂契 skeleton's blade: a whoosh as it swings (t: seconds from now), a slash with a metal ring when it bites
  // tPeak: seconds from now to the blade's fastest moment, where the swish (artisticdude's CC0 Swishes pack, stretched; the greatsword's pitched
  // down) is loudest; lead: how long the blade gathers speed before it — the air swells over that, so long swings get a long sound
  // (v, rate: a monster's swing — a small one's quieter and a little higher, a big one's lower)
  swoosh(heavy, tPeak = 0.05, lead = heavy ? 0.24 : 0.14, v = 1, rate = 1) { if (!ok() || v < 0.05) return; const n = heavy ? any('swing_h', 4) : any('swing_l', 4), r = rate * (0.96 + Math.random() * 0.08);
    const pre = Math.min(Math.max(0, tPeak), lead); if (pre > 0.05) sweep(heavy ? 170 : 340, heavy ? 950 : 1800, 0.9, pre + 0.06, (heavy ? 0.17 : 0.13) * v, tPeak - pre);
    if (!sample(n, (heavy ? 1 : 0.95) * v, r, Math.max(0, tPeak - (PK[n] ?? 0.03) / r))) { if (heavy) sweep(260, 1300, 1.1, 0.34, 0.2 * v, Math.max(0, tPeak - 0.2)); else sweep(520, 2500, 1.3, 0.24, 0.16 * v, Math.max(0, tPeak - 0.14)); } },
  // the shield charge: a long rush of air that swells as it closes, ending in a heavy swish
  // a leap: the air torn as it springs off (the charge's whoosh, loudest just after take-off, at tUp from now) and dying away over the flight
  leap(tUp = 0.24) { if (!ok()) return; if (!sample('charge', 0.9, 0.95 + Math.random() * 0.1, Math.max(0, tUp + 0.11 - PK.charge))) this.rush(0.4); },
  rush(dur = 0.5) { if (!ok()) return; if (sample('charge', 0.95, 1, Math.max(0, dur - 0.1 - PK.charge))) return; sweep(110, 520, 0.7, dur + 0.25, 0.34); sweep(500, 1900, 1.0, dur + 0.15, 0.2, 0.05); tone('sawtooth', 70, 48, dur + 0.2, 0.07);
    sample(any('swing_h', 4), 1, 0.78, Math.max(0, dur - 0.1)); },
  // a spoken line (赵云's): as recorded, t seconds from now; nothing in its place while it loads
  voice(n, v = 1, t = 0) { if (!ok()) return; sample(n, v, 1, t); },
  // the Sentinel's war cry, and the burst of power that throws back what stands close (fire); the paladin's: its own roar alone
  warcry(pal) { if (!ok()) return; if (pal) { if (!sample('warcry_pal', 1)) this.holy(0.8); }
    else { if (!sample('warcry', 0.95)) this.roar(); sample('fireburst', 0.75, 1, 0.04); } },
  // the Aura of Light lighting up (25 Fury)
  holyOn() { if (!ok()) return; if (!sample('holy', 0.75)) this.holy(1); },
  // a monster's cry (v: how near it is); one of a kind at a time, so a whole pack noticing you is one voice. A single take is pitched a little each time
  cry(kind, v = 1, boss) { if (!ok() || v < 0.05 || !gate('cry_' + kind, boss ? 400 : 2500)) return; const L = CRY[kind], n = boss ? BOSS_CRY[boss] : L && L[Math.floor(Math.random() * L.length)];
    if (!n || !sample(n, 0.85 * v, 0.93 + Math.random() * 0.14)) { if (kind === 'human' || kind === 'brute' || boss) this.roar(); } },
  // a monster's shot leaving: bow, crossbow bolt, thrown axe, fireball, the exorcist's holy fire, a ghost's soul-fire
  shot(kind, v = 1) { if (!ok() || v < 0.05 || !gate('sh_' + kind, 70)) return; const sh = SHOT[kind]; if (sh && sample(any(kind, sh[0]), sh[1] * v, 0.95 + Math.random() * 0.1)) return;
    if (kind === 'soul') this.zap(); else if (kind === 'fball' || kind === 'hfire') this.fire(); else this.arrow(); },
  // Raise: the spell's hum as it is cast (once), then for each corpse a short burst of its soul torn out — quiet and pitched apart, so a
  // dozen in a row stay a quick flurry — and the soul flying off
  raiseCast() { if (!ok()) return; if (!sample('rz_hum', 1, 0.95 + Math.random() * 0.1)) this.raise(); },
  harvest(v = 1) { if (!ok() || !gate('hv', 50)) return; if (!sample('rz_rip', 0.6 * v, 0.88 + Math.random() * 0.28, Math.random() * 0.04)) this.caught(); },
  soulFly(v = 0.5, t = 0) { if (!ok() || !gate('sf', 120)) return; sample('soul_fly', v, 0.9 + Math.random() * 0.25, t); },
  // a soul landing in the vessel: one of the little drops, each one of a run a step higher than the last
  plink() { if (!ok() || !gate('gp', 45)) return; const now = ac.currentTime; plinkN = now - plinkT < 0.45 ? Math.min(plinkN + 1, 10) : 0; plinkT = now;
    if (!sample(any('plink', 6), 0.5, (0.94 + 0.045 * plinkN) * (0.97 + Math.random() * 0.06))) this.gulp(); },
  // the pour into the Sentinel: a stream held while it lasts (stop it with .stop), the Sentinel drinking now and then
  pour() { return ok() ? loopSample('pour.wav', 0.6, 0.3, 600) : null; },
  absorb() { if (!ok() || !gate('ab', 650)) return; if (!sample('absorb', 0.35, 0.92 + Math.random() * 0.16)) this.infuse(); },
  // loot landing: only the best — an epic rings like a dropped gem, a legendary with a softer, warmer chime
  drop(q) { if (!ok() || q < 3 || !gate('dr', 120)) return; if (!sample(q >= 4 ? 'drop_legend' : 'drop_epic', q >= 4 ? 0.7 : 0.75, 0.97 + Math.random() * 0.06)) this.level(); },
  // the gear panel: an item picked up or put down; into the forge; the forge rolling
  gear() { if (!ok() || !gate('ge', 60)) return; if (!sample('gear', 0.7, 0.94 + Math.random() * 0.12)) this.pick(); },
  furnIn() { if (!ok() || !gate('fu', 80)) return; if (!sample('furn_in', 0.7, 0.96 + Math.random() * 0.08)) this.clank(); },
  draw() { if (!ok()) return; if (!sample('draw', 0.8)) this.fire(); },
  roar() { if (!ok()) return; tone('sawtooth', 120, 62, 0.75, 0.16); tone('sawtooth', 181, 90, 0.7, 0.07, 0.02); hiss(380, 0.7, 0.7, 0.3, 0, 'lowpass'); hiss(1400, 0.8, 0.45, 0.12, 0.05); },
  // plate: the target is in armour (a knight, a stone-skinned champion) — the blade rings on it, the mace clangs; on cloth and flesh the old bite and a blunt thud
  blade(heavy, crit, plate) { if (!ok() || !gate('bl', 50)) return; const r = 0.96 + Math.random() * 0.08;
    if (heavy && sample(any('heavy', 2), crit ? 0.95 : 0.8, r)) return;
    if (!heavy && plate && sample(any('clang', 2), crit ? 0.8 : 0.65, r)) return;
    if (!sample((heavy ? 'blade_h' : 'blade_l') + Math.floor(Math.random() * 3), crit ? 0.75 : 0.6, r)) { hiss(heavy ? 900 : 1600, 0.9, 0.12, 0.25); tone('triangle', heavy ? 700 : 1100, 300, 0.12, 0.06); } },
  // the mace (crit: a bright ring over it); the holy light: a bright swell of a chord
  bonk(crit, v = 1, plate) { if (!ok() || !gate('bk', 60)) return; const r = 0.93 + Math.random() * 0.12;
    if (!sample(plate ? any('mace_m', 2) : 'mace_f0', (plate ? 0.85 : 0.95) * v, r)) { tone('sine', 150, 55, 0.2, 0.32 * v); hiss(650, 0.8, 0.13, 0.32 * v, 0, 'lowpass'); tone('triangle', 560, 520, 0.28, 0.05 * v, 0.01);
      sample('blade_h' + Math.floor(Math.random() * 3), 0.28 * v, 0.62); }
    if (crit) tone('triangle', 1120, 1080, 0.3, 0.04 * v, 0.02); },
  // a blow caught on a shield or a blade: heavy — a mace, a club, a brute's swing (a dull clang); else a blade on steel
  block(heavy) { if (!ok() || !gate('bk2', 60)) return; if (!sample(heavy ? 'block_h' : 'block_b', 0.85, 0.96 + Math.random() * 0.08)) clank(); },
  // the greatsword's fire: the blade catching light, its burning swing (tPeak as in swoosh), the blast where it lands
  ignite() { if (!ok()) return; if (!sample('fcharge', 0.85)) { hiss(500, 0.6, 0.35, 0.2); tone('sawtooth', 120, 60, 0.3, 0.05); } },
  // the sword & shield's counter: its sword qi flies off with a burning whoosh (loudest at tPeak, the cut)
  qi(tPeak = 0) { if (!ok()) return; if (!sample('fire_sw0', 0.8, 1, Math.max(0, tPeak - PK.fire_sw0))) this.swoosh(false, tPeak, 0.15); },
  fireLoop(v = 0.55) { return ok() ? loopSample('fireloop.wav', v) : null; },
  fireSwing(tPeak = 0) { if (!ok()) return; const n = any('fire_sw', 2); sample(n, 0.75, 1, Math.max(0, tPeak - PK[n])); },
  burst(fire) { if (!ok()) return; if (!sample(fire ? 'burst_f' : 'burst_e', 0.9)) { tone('sine', 90, 30, 0.5, 0.5); hiss(200, 0.5, 0.5, 0.5, 0, 'lowpass'); } },
  // a body landing hard from a leap: the ground takes it
  slam() { if (!ok()) return; if (!sample('slam0', 0.95, 0.95 + Math.random() * 0.1)) { tone('sine', 110, 40, 0.3, 0.4); hiss(300, 0.7, 0.25, 0.35); tone('sine', 90, 30, 0.5, 0.5); } },
  // Blessed Hammers: the cast (its ringing dies away over the hammers' flight) and, each time one comes round, the air it cuts
  hammers() { if (!ok()) return; if (!sample('hammers', 0.8)) this.holy(0.7); },
  spin(v = 1) { if (!ok() || !gate('spin', 120)) return; if (!sample(any('swing_h', 4), 0.4 * v, 0.74 + Math.random() * 0.1)) sweep(200, 900, 1, 0.3, 0.12 * v); },
  // champions' elements: a poison cloud let loose on the ground, a thunderclap, a robber gone into the shadows
  poison() { if (!ok()) return; if (!sample(any('poison', 2), 0.6)) { hiss(500, 0.6, 0.35, 0.2); tone('sawtooth', 120, 60, 0.3, 0.05); } },
  thunder() { if (!ok()) return; if (!sample('thunder0', 0.85)) { hiss(4200, 0.8, 0.12, 0.22); tone('square', 1800, 200, 0.12, 0.05); tone('sine', 90, 30, 0.5, 0.5); } },
  shadow() { if (!ok() || !gate('sh', 150)) return; if (!sample(any('shadow', 2), 0.7)) sweep(110, 520, 0.7, 0.55, 0.3); },
  holy(v = 1) { if (!ok() || !gate('ho', 120)) return; [523, 784, 1046, 1568].forEach((f, i) => tone('sine', f, f * 1.005, 0.7 + 0.2 * v, 0.05 * v, i * 0.03)); hiss(6000, 1.2, 0.5, 0.06 * v); },
  spear() { if (!ok() || !gate('sp', 60)) return; hiss(2400, 1.2, 0.12, 0.18); tone('triangle', 900, 300, 0.12, 0.08); },
  hit(v = 1) { if (!ok() || !gate('hit', 40)) return; hiss(600, 0.8, 0.09, 0.25 * v); tone('sine', 160, 70, 0.1, 0.18 * v); },
  smash() { if (!ok()) return; tone('sine', 110, 40, 0.3, 0.4); hiss(300, 0.7, 0.25, 0.35); },
  die() { if (!ok() || !gate('die', 50)) return; tone('sawtooth', 300, 80, 0.25, 0.08); hiss(900, 1, 0.2, 0.12); },
  squeal() { if (!ok() || !gate('sq', 200)) return; tone('square', 1400, 2200, 0.08, 0.05); tone('square', 1700, 900, 0.14, 0.05, 0.07); },
  arrow() { if (!ok() || !gate('ar', 50)) return; hiss(3200, 2, 0.08, 0.12); },
  gun() { if (!ok() || !gate('gun', 60)) return; hiss(1500, 1.4, 0.05, 0.2); tone('square', 180, 70, 0.05, 0.06); },
  fire() { if (!ok() || !gate('fi', 60)) return; hiss(500, 0.6, 0.35, 0.2); tone('sawtooth', 120, 60, 0.3, 0.05); },
  drill() { if (!ok() || !gate('dr', 90)) return; tone('sawtooth', 95, 80, 0.12, 0.07); hiss(2600, 2.5, 0.1, 0.16); tone('square', 1900, 1500, 0.06, 0.025); },
  mortar() { if (!ok() || !gate('mo', 90)) return; tone('sine', 120, 45, 0.28, 0.32); hiss(700, 0.7, 0.18, 0.28, 0, 'lowpass'); },
  boom() { if (!ok()) return; tone('sine', 90, 30, 0.5, 0.5); hiss(200, 0.5, 0.5, 0.5, 0, 'lowpass'); },
  raise() { if (!ok()) return; tone('sine', 220, 440, 0.7, 0.1); tone('sine', 331, 662, 0.7, 0.06); },
  caught() { if (!ok()) return; [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.35, 0.12, i * 0.08)); },
  fail() { if (!ok()) return; hiss(800, 0.6, 0.5, 0.25); tone('sine', 300, 90, 0.4, 0.1); },
  heal() { if (!ok()) return; [784, 988, 1175].forEach((f, i) => tone('sine', f, f * 1.01, 0.4, 0.08, i * 0.06)); },
  level() { if (!ok()) return; [523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f, 0.5, 0.13, i * 0.09)); },
  revive() { if (!ok()) return; tone('sine', 300, 900, 0.4, 0.1); },
  stairs() { if (!ok()) return; tone('sine', 400, 120, 0.9, 0.2); hiss(400, 0.5, 0.8, 0.15); },
  hurt() { if (!ok() || !gate('hu', 120)) return; tone('square', 220, 140, 0.12, 0.08); },
  zap() { if (!ok() || !gate('zap', 70)) return; hiss(4200, 0.8, 0.12, 0.22); tone('square', 1800, 200, 0.12, 0.05); tone('sawtooth', 90, 60, 0.15, 0.08); },
  frost() { if (!ok()) return; hiss(5200, 1.5, 0.5, 0.25); [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f * 0.98, 0.35, 0.05, i * 0.04)); },
  pick() { if (!ok() || !gate('pk', 80)) return; tone('triangle', 1320, 1320, 0.12, 0.08); tone('triangle', 1760, 1760, 0.18, 0.06, 0.06); },
  clank() { if (!ok() || !gate('cl', 60)) return; clank(); },
  laser() { if (!ok() || !gate('la', 70)) return; tone('sawtooth', 2400, 900, 0.09, 0.03); tone('sine', 1800, 1200, 0.1, 0.05); },
  beam() { if (!ok() || !gate('bm', 90)) return; tone('sawtooth', 1200, 300, 0.2, 0.05); hiss(3800, 1.2, 0.15, 0.12); tone('sine', 660, 990, 0.16, 0.06); },
  lock() { if (!ok() || !gate('lk', 200)) return; [1568, 1568, 2093].forEach((f, i) => tone('square', f, f, 0.06, 0.035, i * 0.11)); },
  orbital() { if (!ok()) return; tone('sawtooth', 1600, 120, 0.7, 0.1); tone('sine', 70, 30, 0.8, 0.5); hiss(900, 0.5, 0.8, 0.45, 0.02, 'lowpass'); hiss(5200, 1, 0.3, 0.2); },
  fix() { if (!ok() || !gate('fx', 300)) return; tone('triangle', 1320, 1500, 0.08, 0.04); tone('triangle', 1980, 1980, 0.1, 0.03, 0.07); },
  // the soul vessel: a soul landing in it (a soft glassy drop), and each soul poured into the Sentinel (a small bright chime)
  gulp() { if (!ok() || !gate('gp', 70)) return; const f = 900 + Math.random() * 300; tone('sine', f, f * 1.9, 0.09, 0.07); tone('triangle', f * 2.5, f * 2.4, 0.12, 0.025, 0.02); },
  infuse() { if (!ok() || !gate('if', 85)) return; const f = 1400 + Math.random() * 700; tone('sine', f, f * 1.25, 0.14, 0.04); hiss(5200, 2, 0.06, 0.04); },
  rally() { if (!ok() || !gate('ra', 300)) return; tone('square', 500, 800, 0.1, 0.04); },
};
