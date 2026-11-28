# Builds the ComfyUI workflow (UI format: drop it in user/default/workflows and open it) that paints the ground textures: Qwen Image
# 2.1 turbo (the person's ComfyUI), patched by GT Seamless Roll (comfy_node_gt_seamless_roll.py, in custom_nodes) so each comes out
# tileable, each batch decoded twice (as made, and rolled by half: fixwrap.py takes the borders from that one).
#   python3 -c "import json, workflow; P = json.load(open('prompts.json')); workflow.t2i_seamless([('dirt6', P['dirt3'], 123)], 'out.json')"
import json, uuid, sys

class WF:
    def __init__(s):
        s.nodes=[]; s.links=[]; s.nid=0; s.lid=0
    def node(s, type, ins, outs, wv=None, pos=(0,0), size=(320,120)):
        s.nid+=1
        n={"id":s.nid,"type":type,"pos":list(pos),"size":list(size),"flags":{},"order":s.nid,"mode":0,
           "inputs":[{"name":a,"type":t,"link":None} for a,t in ins],
           "outputs":[{"name":a,"type":t,"links":[]} for a,t in outs],
           "properties":{"Node name for S&R":type}}
        if wv is not None: n["widgets_values"]=wv
        s.nodes.append(n); return n
    def link(s, a, ai, b, bi):
        s.lid+=1
        t=a["outputs"][ai]["type"]
        a["outputs"][ai]["links"].append(s.lid)
        b["inputs"][bi]["link"]=s.lid
        s.links.append([s.lid,a["id"],ai,b["id"],bi,t])
    def dump(s, path):
        w={"id":str(uuid.uuid4()),"revision":0,"last_node_id":s.nid,"last_link_id":s.lid,"nodes":s.nodes,
           "links":s.links,"groups":[],"config":{},"extra":{"ds":{"scale":0.45,"offset":[100,100]}},"version":0.4}
        json.dump(w, open(path,'w'), ensure_ascii=False, indent=1)

SIG="1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0"

def base(w):
    unet=w.node("UNETLoader",[],[("MODEL","MODEL")],["qwen_image_2.1_turbo_int8_convrot.safetensors","default"],(0,0))
    cache=w.node("QwenImage21Cache",[("model","MODEL")],[("MODEL","MODEL")],["auto","default"],(0,150))
    w.link(unet,0,cache,0)
    clip=w.node("CLIPLoader",[],[("CLIP","CLIP")],["qwen3vl_8b_int8_convrot.safetensors","qwen_image","default"],(0,300))
    vae=w.node("VAELoader",[],[("VAE","VAE")],["qwen_image_2.1_vae_bf16.safetensors"],(0,450))
    smp=w.node("KSamplerSelect",[],[("SAMPLER","SAMPLER")],["euler"],(0,600))
    sig=w.node("ManualSigmas",[],[("SIGMAS","SIGMAS")],[SIG],(0,750))
    return cache,clip,vae,smp,sig

def encode(w, clip, prompt, neg, pos):
    te=w.node("TextEncodeQwenImage21",[("clip","CLIP"),("images.image_1","IMAGE"),("vae","VAE")],
              [("positive","CONDITIONING"),("negative","CONDITIONING"),("latent","LATENT")],[prompt,neg,1024],pos,(420,360))
    w.link(clip,0,te,0); return te

def sample(w, cache, te, smp, sig, latent_node, seed, x, y, latent_slot=0):
    g=w.node("CFGGuider",[("model","MODEL"),("positive","CONDITIONING"),("negative","CONDITIONING")],[("GUIDER","GUIDER")],[1],(x+460,y))
    w.link(cache,0,g,0); w.link(te,0,g,1); w.link(te,1,g,2)
    nz=w.node("RandomNoise",[],[("NOISE","NOISE")],[seed,"fixed"],(x+460,y+150))
    sa=w.node("SamplerCustomAdvanced",[("noise","NOISE"),("guider","GUIDER"),("sampler","SAMPLER"),("sigmas","SIGMAS"),("latent_image","LATENT")],
              [("output","LATENT"),("denoised_output","LATENT")],None,(x+820,y))
    w.link(nz,0,sa,0); w.link(g,0,sa,1); w.link(smp,0,sa,2); w.link(sig,0,sa,3); w.link(latent_node,latent_slot,sa,4)
    return sa

def t2i_seamless(jobs, path, batch=4, roll_seed=7, sharp=6.0):
    w=WF(); cache,clip,vae,smp,sig=base(w)
    roll=w.node("GTSeamlessRoll",[("model","MODEL")],[("MODEL","MODEL")],[roll_seed,"fixed",2,3,sharp],(0,900))
    w.link(cache,0,roll,0)
    for i,(name,prompt,seed) in enumerate(jobs):
        y=i*560; x=400
        te=encode(w,clip,prompt,"",(x,y))
        lat=w.node("EmptyLatentImage",[],[("LATENT","LATENT")],[1024,1024,batch],(x+460,y+300))
        sa=sample(w,roll,te,smp,sig,lat,seed,x,y)
        dec=w.node("VAEDecode",[("samples","LATENT"),("vae","VAE")],[("IMAGE","IMAGE")],None,(x+1200,y))
        w.link(sa,0,dec,0); w.link(vae,0,dec,1)
        sv=w.node("SaveImage",[("images","IMAGE")],[],["props/ground/"+name],(x+1450,y),(300,300))
        w.link(dec,0,sv,0)
        lr=w.node("GTLatentRoll",[("samples","LATENT")],[("LATENT","LATENT")],[0.5,0.5],(x+1200,y+330))
        w.link(sa,0,lr,0)
        dec2=w.node("VAEDecode",[("samples","LATENT"),("vae","VAE")],[("IMAGE","IMAGE")],None,(x+1200,y+450))
        w.link(lr,0,dec2,0); w.link(vae,0,dec2,1)
        sv2=w.node("SaveImage",[("images","IMAGE")],[],["props/ground/"+name+"_r"],(x+1780,y),(300,300))
        w.link(dec2,0,sv2,0)
        lq=w.node("GTLatentRoll",[("samples","LATENT")],[("LATENT","LATENT")],[0.25,0.25],(x+1200,y+560))
        w.link(sa,0,lq,0)
        dec3=w.node("VAEDecode",[("samples","LATENT"),("vae","VAE")],[("IMAGE","IMAGE")],None,(x+1200,y+660))
        w.link(lq,0,dec3,0); w.link(vae,0,dec3,1)
        sv3=w.node("SaveImage",[("images","IMAGE")],[],["props/ground/"+name+"_q"],(x+2110,y),(300,300))
        w.link(dec3,0,sv3,0)
    w.dump(path)

def img2img(jobs, path, image, w=2048, h=2048):
    # jobs: (name, prompt, seed, sigmas)  — repaint a guide image, keeping its layout (how much: where the sigmas start)
    W_=WF(); cache,clip,vae,smp,sig=base(W_)
    li=W_.node("LoadImage",[],[("IMAGE","IMAGE"),("MASK","MASK")],[image,"image"],(0,950),(300,320))
    enc=W_.node("VAEEncode",[("pixels","IMAGE"),("vae","VAE")],[("LATENT","LATENT")],None,(350,950))
    W_.link(li,0,enc,0); W_.link(vae,0,enc,1)
    for i,(name,prompt,seed,sg) in enumerate(jobs):
        y=i*560; x=400
        te=encode(W_,clip,prompt,"",(x,y))
        s2=W_.node("ManualSigmas",[],[("SIGMAS","SIGMAS")],[sg],(x+460,y+420))
        sa=sample(W_,cache,te,smp,s2,enc,seed,x,y)
        dec=W_.node("VAEDecode",[("samples","LATENT"),("vae","VAE")],[("IMAGE","IMAGE")],None,(x+1200,y))
        W_.link(sa,0,dec,0); W_.link(vae,0,dec,1)
        sv=W_.node("SaveImage",[("images","IMAGE")],[],["props/ground/"+name],(x+1450,y),(400,400))
        W_.link(dec,0,sv,0)
    W_.dump(path)

def ref_t2i(jobs, path, ref_image, batch=4, w=1024, h=1024):
    # jobs: (name, prompt, seed) — new pictures with a reference image shown to the text encoder (style / content reference)
    W_=WF(); cache,clip,vae,smp,sig=base(W_)
    li=W_.node("LoadImage",[],[("IMAGE","IMAGE"),("MASK","MASK")],[ref_image,"image"],(0,950),(300,320))
    for i,(name,prompt,seed) in enumerate(jobs):
        y=i*560; x=400
        te=encode(W_,clip,prompt,"",(x,y)); W_.link(li,0,te,1); W_.link(vae,0,te,2)
        lat=W_.node("EmptyLatentImage",[],[("LATENT","LATENT")],[w,h,batch],(x+460,y+300))
        sa=sample(W_,cache,te,smp,sig,lat,seed,x,y)
        dec=W_.node("VAEDecode",[("samples","LATENT"),("vae","VAE")],[("IMAGE","IMAGE")],None,(x+1200,y))
        W_.link(sa,0,dec,0); W_.link(vae,0,dec,1)
        sv=W_.node("SaveImage",[("images","IMAGE")],[],["props/ground/"+name],(x+1450,y),(400,400))
        W_.link(dec,0,sv,0)
    W_.dump(path)
