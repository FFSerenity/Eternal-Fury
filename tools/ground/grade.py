# Colour-grade the generated ground textures to one palette and save them for the game.
import numpy as np, sys
from PIL import Image
def stats(a): return a.reshape(-1,3).mean(0)
def lum(a): return a@np.array([0.3,0.59,0.11])
def sat(a, k):
    l=lum(a)[...,None]; return l+(a-l)*k
def grade(img, target, k_sat=1.0, contrast=1.0, ref_mask=None):
    a=np.array(img.convert('RGB')).astype(np.float32)
    a=sat(a,k_sat)
    m=a[ref_mask] if ref_mask is not None else a.reshape(-1,3)
    mean=m.mean(0)
    l0=lum(mean[None])[0]
    a=(a-mean)*contrast+mean
    a=a*(np.array(target)/np.maximum(mean,1))
    return Image.fromarray(np.clip(a,0,255).astype(np.uint8))
def bg_mask(img, q=0.6):
    a=np.array(img.convert('RGB')).astype(np.float32); s=a.max(-1)-a.min(-1); l=lum(a)
    return (s<np.quantile(s,q)) & (l<np.quantile(l,q))
if __name__=='__main__':
    for p in sys.argv[1:]:
        a=np.array(Image.open(p).convert('RGB')).astype(np.float32); print(p, stats(a).round(1))
