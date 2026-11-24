# the Sentinel's blade sounds (assets/sfx/blade_*.mp3): a metal slice and the ring of the blade, from Kenney's CC0 RPG Audio (knifeSlice*)
# and Impact Sounds (impactMetal_*). No wooden knock: Kenney's "chop" was in the first mix and sounded like a stick on wood.
# usage: python3 tools/mix-blades.py <folder with the Kenney .ogg files>   (needs ffmpeg, numpy, scipy)
import numpy as np, subprocess, sys, tempfile, os
from scipy.io import wavfile
from scipy.signal import resample
R = 44100
SRC, OUT, TMP = sys.argv[1], os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx'), tempfile.mkdtemp()
def ld(n):
  w = os.path.join(TMP, n + '.wav'); subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(SRC, n + '.ogg'), '-ac', '1', '-ar', str(R), w], check=True)
  r, d = wavfile.read(w); return d.astype(np.float32) / 32768
def at_rate(x, rate): return resample(x, int(len(x) / rate)) if abs(rate - 1) > 1e-3 else x
def place(buf, x, t, g):
    i = int(t * R); n = min(len(x), len(buf) - i)
    if n > 0: buf[i:i + n] += x[:n] * g
# (slice, its start in the source s, rate, gain), (ring, delay s, rate, gain), length s
REC = {
  'blade_l0': (('knifeSlice2', 0.0, 1.0, 0.85), ('impactMetal_light_000', 0.012, 1.0, 0.5), 0.36),
  'blade_l1': (('knifeSlice', 0.11, 1.0, 0.95), ('impactMetal_light_002', 0.012, 1.02, 0.5), 0.34),
  'blade_l2': (('knifeSlice2', 0.0, 1.08, 0.85), ('impactMetal_light_004', 0.014, 0.96, 0.48), 0.32),
  'blade_h0': (('knifeSlice', 0.10, 0.8, 1.0), ('impactMetal_medium_001', 0.02, 0.78, 0.55), 0.46),
  'blade_h1': (('knifeSlice2', 0.0, 0.82, 0.9), ('impactMetal_medium_002', 0.02, 0.8, 0.55), 0.44),
  'blade_h2': (('knifeSlice', 0.12, 0.76, 1.0), ('impactMetal_medium_004', 0.022, 0.75, 0.52), 0.46),
}
for name, (sl, rg, L) in REC.items():
    buf = np.zeros(int(L * R), np.float32)
    s = ld(sl[0]); s = s[int(sl[1] * R):]; s = at_rate(s, sl[2]); s[:int(0.004 * R)] *= np.linspace(0, 1, int(0.004 * R)); place(buf, s, 0.0, sl[3])
    r = at_rate(ld(rg[0]), rg[2]); place(buf, r, rg[1], rg[3])
    f = int(0.06 * R); buf[-f:] *= np.linspace(1, 0, f) ** 2
    rms = np.sqrt((buf ** 2).mean()); buf *= 10 ** ((-16.3 - 20 * np.log10(rms + 1e-9)) / 20)  # as loud as the old ones (RMS)
    pk = np.abs(buf).max(); buf = np.tanh(buf / 0.92) * 0.92 if pk > 0.92 else buf  # (a soft limit on the odd peak)
    w = os.path.join(TMP, name + '.wav'); wavfile.write(w, R, (buf * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', w, '-ac', '1', '-ar', str(R), '-b:a', '80k', os.path.join(OUT, name + '.mp3')], check=True); print(name)
