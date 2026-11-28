# The game's ground set from chosen ComfyUI generations: join each pick's two decodes (fixwrap), grade it to the set's palette (grade),
# save it as assets/ground/<name>.jpg.
#   python3 make_set.py '{"dirt": "dirt6_00002_", ...}' <folder with the generations> <out folder>
# A pick is the file name without .png; its partners from the same run are <kind>_r_<n>_ and <kind>_q_<n>_ (rolled by a half, a quarter).
import os, sys, json, numpy as np
from PIL import Image
import grade, fixwrap
DIRT = (98, 78, 62)
SPEC = {  # name: (mean colour to reach, saturation, contrast, measure the mean on the bare soil only)
    'dirt': (DIRT, 0.85, 0.8, False), 'moss': ((92, 98, 52), 1.0, 1.15, False),
    'cobble': ((128, 124, 116), 0.55, 1.05, False), 'leaves': (DIRT, 1.0, 1.0, True)}
def partner(pick, t):
    k, i = pick.split('_', 1); return k + '_' + t + '_' + i
def build(picks, src, out):
    for name, pick in picks.items():
        q = f'{src}/{partner(pick, "q")}.png'
        im = fixwrap.join(f'{src}/{pick}.png', f'{src}/{partner(pick, "r")}.png', q if os.path.exists(q) else None)
        t, ks, c, bg = SPEC[name]
        g = grade.grade(im, t, ks, c, grade.bg_mask(im) if bg else None)
        g.save(f'{out}/{name}.jpg', quality=86)
        print(name, pick, 'wrap', [round(float(v), 1) for v in fixwrap.wrap_err(g)], 'mean', grade.stats(np.array(g).astype(np.float32)).round(1))
if __name__ == '__main__':
    build(json.loads(sys.argv[1]), sys.argv[2], sys.argv[3])
