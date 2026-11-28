# the path tile atlas: the person's six painted blocks (see-through corners) + Qwen's eight in the same style, 4×4 slots of 512
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
def grade(c):
    l=(c@[0.3,0.59,0.11])[...,None]; c=l+(c-l)*0.75; return c*np.array([1.03,1.0,0.94])*1.5
tiles=[]
im=np.array(Image.open('tileset.png').convert('RGB')).astype(float); bg=np.array([38,36,41.3])
for (x0,y0,x1,y1) in [(69,62,476,447),(564,62,964,447),(1053,62,1456,447),(69,533,476,926),(564,533,964,926),(1053,533,1456,926)]:
    pad=4; c=im[y0-pad:y1+pad, x0-pad:x1+pad]; d=np.abs(c-bg).sum(-1); a=np.clip((d-14)/26,0,1)
    m=ndi.binary_fill_holes(a>0.5); m=ndi.binary_opening(m, iterations=2); inner=ndi.binary_erosion(m, iterations=6)
    al=np.maximum(a*m, inner.astype(float)); al=np.array(Image.fromarray((al*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(float)/255
    tiles.append(Image.fromarray(np.dstack([np.clip(grade(c),0,255), al*255]).astype(np.uint8),'RGBA').resize((512,512),Image.LANCZOS))
ref=np.mean([np.array(t)[...,:3].reshape(-1,3)[np.array(t)[...,3].reshape(-1)>128].mean(0) for t in tiles],0)
U='/mnt/user-data/uploads/props/ground/'
for n in ['tile_a','tile_b']:
    for i in range(1,5):
        c=np.array(Image.open(f'{U}{n}_{i:05d}_.png').convert('RGB')).astype(float); H,W=c.shape[:2]
        corner=np.median(np.concatenate([c[:6,:6].reshape(-1,3),c[:6,-6:].reshape(-1,3),c[-6:,:6].reshape(-1,3),c[-6:,-6:].reshape(-1,3)]),0)
        d=np.abs(c-corner).sum(-1)>40; rows=np.where(d.mean(1)>0.5)[0]; cols=np.where(d.mean(0)>0.5)[0]
        y0,y1,x0,x1=rows.min(),rows.max()+1,cols.min(),cols.max()+1
        if (y1-y0)<0.97*H or (x1-x0)<0.97*W: c=c[y0:y1, x0:x1]
        h,w=c.shape[:2]; e=int(min(h,w)*0.016); c=c[e:h-e, e:w-e]   # (off the picture's own edge line)
        g=grade(c); t=Image.fromarray(np.dstack([np.clip(g,0,255), np.full(g.shape[:2],255.)]).astype(np.uint8),'RGBA').resize((512,512),Image.LANCZOS)
        a=np.array(t).astype(float); k=(ref@[0.3,0.59,0.11])/(a[...,:3].reshape(-1,3).mean(0)@[0.3,0.59,0.11]); a[...,:3]=np.clip(a[...,:3]*k,0,255)
        tiles.append(Image.fromarray(a.astype(np.uint8),'RGBA'))
atlas=Image.new('RGBA',(2048,2048),(0,0,0,0))
for k,t in enumerate(tiles): atlas.paste(t,((k%4)*512,(k//4)*512))
atlas.save('/home/claude/grave-tamer/assets/ground/pathtiles.webp',quality=88,method=6)
print(len(tiles))
