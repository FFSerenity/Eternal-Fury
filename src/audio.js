// Small synthesized sound set (no audio files)
let ac = null, out = null, noise = null, on = true;
try { on = localStorage.getItem('graveTamerSfx') !== '0'; } catch (e) {}
export function unlock() {
  if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; out = ac.createGain(); out.gain.value = on ? 0.8 : 0; out.connect(comp); comp.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  if (ac.state !== 'running') ac.resume().catch(() => {});
  decodeAll();
}
// recorded sounds (assets/sfx, from Kenney's CC0 packs): fetched when asked for, decoded once the audio context exists
const RAW = {}, BUF = {};
export function loadSamples(names) { for (const n of names) if (!RAW[n]) RAW[n] = fetch(`assets/sfx/${n}.mp3`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null); if (ac) decodeAll(); }
function decodeAll() { for (const n in RAW) if (!(n in BUF)) { BUF[n] = null; RAW[n].then(ab => ab && ac.decodeAudioData(ab)).then(b => { BUF[n] = b || null; }).catch(() => {}); } }
function sample(n, v = 1, rate = 1, t = 0) { const b = BUF[n]; if (!b) return false; const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = v;
  s.connect(g); g.connect(out); s.start(ac.currentTime + t); return true; }
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
export const S = {
  // the 魂契 skeleton's blade: a whoosh as it swings (t: seconds from now), a slash with a metal ring when it bites
  swoosh(heavy, t = 0) { if (!ok() || !gate('sw', 80)) return; if (heavy) sweep(260, 1300, 1.1, 0.34, 0.2, t); else sweep(520, 2500, 1.3, 0.24, 0.16, t); },
  blade(heavy, crit) { if (!ok() || !gate('bl', 50)) return; const n = (heavy ? 'blade_h' : 'blade_l') + Math.floor(Math.random() * 3);
    if (!sample(n, crit ? 1 : 0.85, (heavy ? 0.96 : 0.97) + Math.random() * 0.08)) { hiss(heavy ? 900 : 1600, 0.9, 0.12, 0.25); tone('triangle', heavy ? 700 : 1100, 300, 0.12, 0.06); } },
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
  clank() { if (!ok() || !gate('cl', 60)) return; hiss(1800, 3, 0.09, 0.22); tone('square', 380, 240, 0.08, 0.05); tone('triangle', 1250, 1180, 0.16, 0.05, 0.01); },
  laser() { if (!ok() || !gate('la', 70)) return; tone('sawtooth', 2400, 900, 0.09, 0.03); tone('sine', 1800, 1200, 0.1, 0.05); },
  beam() { if (!ok() || !gate('bm', 90)) return; tone('sawtooth', 1200, 300, 0.2, 0.05); hiss(3800, 1.2, 0.15, 0.12); tone('sine', 660, 990, 0.16, 0.06); },
  lock() { if (!ok() || !gate('lk', 200)) return; [1568, 1568, 2093].forEach((f, i) => tone('square', f, f, 0.06, 0.035, i * 0.11)); },
  orbital() { if (!ok()) return; tone('sawtooth', 1600, 120, 0.7, 0.1); tone('sine', 70, 30, 0.8, 0.5); hiss(900, 0.5, 0.8, 0.45, 0.02, 'lowpass'); hiss(5200, 1, 0.3, 0.2); },
  fix() { if (!ok() || !gate('fx', 300)) return; tone('triangle', 1320, 1500, 0.08, 0.04); tone('triangle', 1980, 1980, 0.1, 0.03, 0.07); },
  rally() { if (!ok() || !gate('ra', 300)) return; tone('square', 500, 800, 0.1, 0.04); },
};
