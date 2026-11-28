# Cut each path block into its separate stones (the KayKit way: the gaps are left to the ground): the stone tops found by colour
# (the stones are bluer and lighter than the mossy joints), each grown back out over its own bevel, a gap kept where two meet;
# each stone's outline traced and simplified. Out: assets/ground/pathtiles.json — per block, its stones as [u, v, u, v, …] in 0..1.
import numpy as np, json, cv2
from PIL import Image
from scipy import ndimage as ndi
a=np.array(Image.open('/home/claude/grave-tamer/assets/ground/pathtiles.webp').convert('RGBA')).astype(float)
S=512; res=[]; vis=[]
for k in range(14):
    y0,x0=(k//4)*S,(k%4)*S; t=a[y0:y0+S,x0:x0+S]; rgb=t[...,:3]; al=t[...,3]
    R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]; lum=0.3*R+0.59*G+0.11*B
    f=ndi.gaussian_filter(B-G,2.5)+0.25*ndi.gaussian_filter(lum-lum.mean(),2.5)
    top=(f>np.percentile(f[al>128],40))&(al>128)
    top=ndi.binary_opening(top,iterations=3); top=ndi.binary_fill_holes(top)
    lab,n=ndi.label(top)
    sizes=ndi.sum(top,lab,range(1,n+1)); keep=np.zeros(n+1,bool); keep[1:]=sizes>350
    lab[~keep[lab]]=0
    # grow each top over its bevel (up to g px), never into another's reach: a pixel goes to its nearest top, and pixels whose
    # neighbours belong to another stone are left as the gap
    d,(iy,ix)=ndi.distance_transform_edt(lab==0, return_indices=True)
    near=lab[iy,ix]; g=9
    grown=np.where(d<=g, near, 0)
    edge=np.zeros_like(grown,bool)
    for dy,dx in [(-1,0),(1,0),(0,-1),(0,1),(-2,0),(2,0),(0,-2),(0,2),(-3,0),(3,0),(0,-3),(0,3)]:
        sh=np.roll(np.roll(grown,dy,0),dx,1); edge|=(sh!=grown)&(sh>0)&(grown>0)
    grown[edge]=0; grown[al<100]=0
    stones=[]
    for i in range(1,grown.max()+1):
        m=(grown==i).astype(np.uint8)
        if m.sum()<300: continue
        cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
        c=max(cs,key=cv2.contourArea); c=cv2.approxPolyDP(c,1.8,True)[:,0,:]
        if len(c)<4: continue
        stones.append([round(float(v)/S,4) for p in c for v in (p[0]+0.5,p[1]+0.5)])
    res.append(stones)
    v=rgb.copy(); v[grown==0]*=0.15; vis.append(Image.fromarray(np.clip(v,0,255).astype(np.uint8)).resize((256,256)))
    print(k,len(stones),sum(len(s)//2 for s in stones))
json.dump(res,open('/home/claude/grave-tamer/assets/ground/pathtiles.json','w'),separators=(',',':'))
sh=Image.new('RGB',(256*7,512))
for i,v in enumerate(vis): sh.paste(v,((i%7)*256,(i//7)*256))
sh.save('seg_vis.jpg',quality=88)
import os; print(os.path.getsize('/home/claude/grave-tamer/assets/ground/pathtiles.json'))
