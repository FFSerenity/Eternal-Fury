// Small synthesized sound set (no audio files)
let ac = null, out = null, noise = null, on = true;
try { on = localStorage.getItem('graveTamerSfx') !== '0'; } catch (e) {}
export function unlock() {
  if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; out = ac.createGain(); out.gain.value = on ? 0.8 : 0; out.connect(comp); comp.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  if (ac.state !== 'running') ac.resume().catch(() => {});
}
export const sfxOn = () => on;
export function setSfx(v) { on = v; if (out) out.gain.setTargetAtTime(v ? 0.8 : 0, ac.currentTime, 0.05); try { localStorage.setItem('graveTamerSfx', v ? '1' : '0'); } catch (e) {} }
const ok = () => ac && on && ac.state === 'running';
function tone(type, f0, f1, dur, v, t = 0) { const t0 = ac.currentTime + t, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02); }
function hiss(f, q, dur, v, t = 0, type = 'bandpass') { const t0 = ac.currentTime + t, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02); }
const lim = {}; const gate = (k, ms) => { const n = performance.now(); if (n - (lim[k] || 0) < ms) return false; lim[k] = n; return true; };
export const S = {
  spear() { if (!ok() || !gate('sp', 60)) return; hiss(2400, 1.2, 0.12, 0.18); tone('triangle', 900, 300, 0.12, 0.08); },
  hit(v = 1) { if (!ok() || !gate('hit', 40)) return; hiss(600, 0.8, 0.09, 0.25 * v); tone('sine', 160, 70, 0.1, 0.18 * v); },
  smash() { if (!ok()) return; tone('sine', 110, 40, 0.3, 0.4); hiss(300, 0.7, 0.25, 0.35); },
  die() { if (!ok() || !gate('die', 50)) return; tone('sawtooth', 300, 80, 0.25, 0.08); hiss(900, 1, 0.2, 0.12); },
  squeal() { if (!ok() || !gate('sq', 200)) return; tone('square', 1400, 2200, 0.08, 0.05); tone('square', 1700, 900, 0.14, 0.05, 0.07); },
  arrow() { if (!ok() || !gate('ar', 50)) return; hiss(3200, 2, 0.08, 0.12); },
  gun() { if (!ok() || !gate('gun', 60)) return; hiss(1500, 1.4, 0.05, 0.2); tone('square', 180, 70, 0.05, 0.06); },
  fire() { if (!ok() || !gate('fi', 60)) return; hiss(500, 0.6, 0.35, 0.2); tone('sawtooth', 120, 60, 0.3, 0.05); },
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
  rally() { if (!ok() || !gate('ra', 300)) return; tone('square', 500, 800, 0.1, 0.04); },
};
