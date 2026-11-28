# Cut each path block into at most 8 big stones (the person: no small bits, ≤ 8 a block, gaps as now, edge stones need not line up):
# the stones found as before (seg_tiles.py), only the biggest ≤ 8 kept (none under a medium size), each grown out over the space
# the dropped ones left (up to ~9 cm), a gap of the same width kept where two meet. Each stone's top shows its own painting stretched
# to its new outline (s: how far in toward the stone's middle to read the painting, per outline point).
# Out: assets/ground/pathtiles.json — per block, its stones as [u, v, s, u, v, s, …] (u, v in the block's 0..1 square).
import numpy as np, json, cv2
from PIL import Image
from scipy import ndimage as ndi
a=np.array(Image.open('/home/claude/grave-tamer/assets/ground/pathtiles.webp').convert('RGBA')).astype(float)
S=512; res=[]; vis=[]; MAXN=8; MINA=0.014*S*S; GROW=95; GAP=3
for k in range(14):
    y0,x0=(k//4)*S,(k%4)*S; t=a[y0:y0+S,x0:x0+S]; rgb=t[...,:3]; al=t[...,3]
    R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]; lum=0.3*R+0.59*G+0.11*B
    f=ndi.gaussian_filter(B-G,2.5)+0.25*ndi.gaussian_filter(lum-lum.mean(),2.5)
    top=(f>np.percentile(f[al>128],40))&(al>128)
    top=ndi.binary_opening(top,iterations=3); top=ndi.binary_fill_holes(top)
    lab,n=ndi.label(top)
    # each top grown over its own bevel first (as before), to get the stones as painted
    d,(iy,ix)=ndi.distance_transform_edt(lab==0, return_indices=True); near=lab[iy,ix]
    st=np.where(d<=9, near, 0)
    areas=ndi.sum(st>0, st, range(1,n+1))
    order=[i+1 for i in np.argsort(-areas) if areas[i]>=MINA][:MAXN]
    keep=np.zeros_like(st); 
    for j,i in enumerate(order): keep[st==i]=j+1
    orig=keep.copy()
    # grow the kept ones into the room the dropped ones left, a gap kept between
    d2,(iy,ix)=ndi.distance_transform_edt(keep==0, return_indices=True); near2=keep[iy,ix]
    grown=np.where((d2<=GROW)&(al>100), near2, 0)
    edge=np.zeros_like(grown,bool)
    for dy in range(-GAP,GAP+1):
        for dx in range(-GAP,GAP+1):
            if dy*dy+dx*dx>GAP*GAP or (dx==0 and dy==0): continue
            sh=np.roll(np.roll(grown,dy,0),dx,1); edge|=(sh!=grown)&(sh>0)&(grown>0)
    grown[edge]=0
    # the grown area beyond the old joints: not past the block's own edge either
    grown[:4]=0; grown[-4:]=0; grown[:,:4]=0; grown[:,-4:]=0
    stones=[]
    for j in range(1,len(order)+1):
        m=(grown==j).astype(np.uint8); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
        if m.sum()<300: continue
        cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE); c=max(cs,key=cv2.contourArea); c=cv2.approxPolyDP(c,2.0,True)[:,0,:].astype(float)
        if len(c)<4: continue
        om=(orig==j).astype(np.uint8); cs2,_=cv2.findContours(om,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE); oc=max(cs2,key=cv2.contourArea)[:,0,:].astype(float)
        cx,cy=c.mean(0)
        # per outline point: the old outline's reach in that direction over the new one's (≤ 1)
        ang=np.arctan2(oc[:,1]-cy, oc[:,0]-cx); rad=np.hypot(oc[:,0]-cx, oc[:,1]-cy)
        flat=[]
        for (px,py) in c:
            th=np.arctan2(py-cy,px-cx); r=np.hypot(px-cx,py-cy)
            dd=np.abs((ang-th+np.pi)%(2*np.pi)-np.pi); ro=rad[dd<0.12].max() if (dd<0.12).any() else rad[np.argmin(dd)]
            s=float(min(1.0, (ro*0.96)/max(r,1e-3)))
            flat+= [round((px+0.5)/S,4), round((py+0.5)/S,4), round(s,3)]
        stones.append(flat)
    res.append(stones)
    v=rgb.copy(); v[grown==0]*=0.15; vis.append(Image.fromarray(np.clip(v,0,255).astype(np.uint8)).resize((256,256)))
    print(k,len(stones))
json.dump(res,open('/home/claude/grave-tamer/assets/ground/pathtiles.json','w'),separators=(',',':'))
sh=Image.new('RGB',(256*7,512))
for i,v in enumerate(vis): sh.paste(v,((i%7)*256,(i//7)*256))
sh.save('seg_vis2.jpg',quality=88)
