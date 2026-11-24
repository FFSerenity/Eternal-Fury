# usage: python3 tools/cut-orb.py <the orb painting (1312 x 1199 PNG)> <out folder>  -> orb_art / orb_runes / orb_spill .webp (assets/ui)
# the soul orb artwork, cut into layers for the HUD: the art with the glass sphere cut out (the hooded figure, its hands and the claws
# kept in front), its glowing runes taken out into a mask (lit in the rune layers' colours by the game), the liquid's light spilled on
# the figure into another mask (lit as the liquid fills); cropped below the top step with a fade, scaled for the HUD
import numpy as np, json, sys
from PIL import Image
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32); H, W, _ = a.shape
R, G, B = a[..., 0], a[..., 1], a[..., 2]; mx = a.max(-1); mn = a.min(-1); sat = (mx - mn) / (mx + 1); L = a.mean(-1)
yy, xx = np.mgrid[0:H, 0:W]
# background: low, flat grey joined to the border
cand = (mx < 46) & ((mx - mn) < 10); lab, n = ndi.label(cand)
bg = np.isin(lab, list(set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}))
alpha = 1 - ndi.gaussian_filter(bg.astype(np.float32), 1.1); alpha[bg] = np.minimum(alpha[bg], 0.15)
# the sphere: everything inside it goes, but for what stands in front (joined to the outside, solid colours, low down or near the rim)
CX, CY, RR = 655, 355, 306; d = np.hypot(xx - CX, yy - CY); disk = d < RR
solid = (sat < 0.48) | (R >= B - 4)
cand = (solid & ((yy > 470) | ((d > RR - 45) & (yy > 300)))) | ~disk
lab, n = ndi.label(cand); keep = np.isin(lab, list(set(np.unique(lab[~disk])) - {0})) & disk
keep = ndi.binary_opening(keep, iterations=2); keep = ndi.binary_closing(keep, iterations=3); keep = ndi.binary_fill_holes(keep) & disk
hole = disk & ~keep; hs = ndi.gaussian_filter(hole.astype(np.float32), 1.0); alpha = alpha * (1 - hs)
# the glow: bright cyan; runes (the frame's, the eyes, the gem) apart from the liquid's light on the figure and the rim
glow = np.clip((G - R - 25) / 110, 0, 1) * np.clip((mx - 60) / 120, 0, 1)
box = lambda x0, y0, x1, y1: (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
gem = box(604, 742, 708, 866); glow[gem] = np.maximum(glow, np.clip((G - R - 8) / 55, 0, 1) * np.clip((mx - 25) / 70, 0, 1))[gem] # (the gem: its whole teal face)
glow[hole] = 0
near = (d < RR + 42) | keep
runeZone = (~near) | box(612, 588, 700, 630) | box(600, 740, 712, 870)  # (the eyes, the gem)
rune = glow * runeZone; spill = glow * ~runeZone
# the art with the glows put out: a dark carved groove where a rune was, plain stone where the light fell
gray = np.repeat(L[..., None], 3, -1); carved = gray * 0.42 + np.array([14, 14, 20]); stone = gray * 0.78
base = a * (1 - (rune + spill)[..., None]) + carved * rune[..., None] + stone * spill[..., None]
# crop below the top step, fading out at the bottom
x0, y0, x1, y1 = 195, 30, 1115, 985; fade = np.clip((y1 - yy) / 60, 0, 1) ** 1.5; alpha = alpha * fade
def crop(img): return img[y0:y1, x0:x1]
S = 400 / (y1 - y0); size = (round((x1 - x0) * S), 400)
rgba = np.dstack([crop(base), crop(alpha) * 255]).clip(0, 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').resize(size, Image.LANCZOS).save(f'{out}/orb_art.webp', quality=88, method=6)
for name, m in (('orb_runes', rune), ('orb_spill', spill)):
    mm = (crop(m * alpha) * 255).clip(0, 255).astype(np.uint8); w = np.full(mm.shape + (3,), 255, np.uint8)
    Image.fromarray(np.dstack([w, mm]), 'RGBA').resize(size, Image.LANCZOS).save(f'{out}/{name}.webp', quality=85, method=6)
geo = {'w': size[0], 'h': size[1], 'cx': (CX - x0) / (x1 - x0), 'cy': (CY - y0) / (y1 - y0), 'rx': RR / (x1 - x0), 'ry': RR / (y1 - y0)}
json.dump(geo, open(f'{out}/orb_geo.json', 'w')); print(geo)
