# Stone faces for the procedurally cut path blocks: the inside of the biggest painted stones in the path tile set (their bevels left
# out), 24 of them, each squeezed to 256² in a 6×4 atlas (assets/ground/stonefaces.webp); their width/height as cut in
# assets/ground/stonefaces.json, so a stone can be given a face of about its own shape.
import numpy as np, json
from PIL import Image
from scipy import ndimage as ndi
a=np.array(Image.open('/home/claude/grave-tamer/assets/ground/pathtiles.webp').convert('RGBA')).astype(float)
S=512; cands=[]
for k in range(14):
    y0,x0=(k//4)*S,(k%4)*S; t=a[y0:y0+S,x0:x0+S]; rgb=t[...,:3]; al=t[...,3]
    R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]; lum=0.3*R+0.59*G+0.11*B
    f=ndi.gaussian_filter(B-G,2.5)+0.25*ndi.gaussian_filter(lum-lum.mean(),2.5)
    top=(f>np.percentile(f[al>128],40))&(al>128); top=ndi.binary_opening(top,iterations=3); top=ndi.binary_fill_holes(top)
    lab,n=ndi.label(top)
    for i in range(1,n+1):
        m=ndi.binary_erosion(lab==i, iterations=17 if k < 6 else 10)
        if m.sum()<(1800 if k < 6 else 4000): continue
        ys,xs=np.where(m); by0,by1,bx0,bx1=ys.min(),ys.max()+1,xs.min(),xs.max()+1
        fill=m[by0:by1,bx0:bx1].mean()
        if fill<(0.68 if k < 6 else 0.8): continue
        cands.append((m.sum(), k, (bx0,by0,bx1,by1), rgb[by0:by1,bx0:bx1]))
cands.sort(key=lambda c:-c[0])
# not too many from one block
picked=[]; per={}
for c in cands:
    if per.get(c[1],0)>=(4 if c[1] < 6 else 1): continue
    picked.append(c); per[c[1]]=per.get(c[1],0)+1
    if len(picked)==24: break
for c in cands:   # (short of 24: a second from Qwen's blocks)
    if len(picked)==24: break
    if c in picked or c[1] < 6 or per.get(c[1],0)>=2: continue
    picked.append(c); per[c[1]]=per.get(c[1],0)+1
atlas=Image.new('RGB',(1536,1024)); meta=[]
for j,(ar,k,(bx0,by0,bx1,by1),crop) in enumerate(picked):
    atlas.paste(Image.fromarray(np.clip(crop,0,255).astype(np.uint8)).resize((256,256),Image.LANCZOS),((j%6)*256,(j//6)*256))
    meta.append(round((bx1-bx0)/(by1-by0),3))
atlas.save('/home/claude/grave-tamer/assets/ground/stonefaces.webp',quality=88,method=6)
json.dump(meta,open('/home/claude/grave-tamer/assets/ground/stonefaces.json','w'))
atlas.resize((768,512)).save('faces_v.jpg',quality=88); print(len(picked), meta)
