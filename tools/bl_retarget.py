# Retarget Mixamo "without skin" FBX clips onto the hero rig (dec.glb) and export a glb.
# usage: YBOT="<Y Bot.fbx>" python3 bl_retarget.py -- <out.glb> <full|anim> <meta.json> Name=path.fbx ...
# (clips downloaded from Mixamo with Y Bot as the character, 'without skin', 30 fps; without YBOT they are taken as made for our rig)
# full: mesh + rig + the clips already in dec.glb + the new clips; anim: rig + new clips only (an animation pack).
# The Mixamo files have their own rest pose, so the copy is done on world-space bone rotations, not local curves.
# Horizontal root travel is taken off the hips (smoothed curve) and written to meta.json, so the game can move the unit itself.
import bpy, sys, json
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
out, mode, meta_path = argv[0], argv[1], argv[2]
clips = [a.split('=', 1) for a in argv[3:]]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath='/home/claude/hero/dec.glb')
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o, do_unlink=True)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
if arm.animation_data: arm.animation_data.action = None
sys.path.insert(0, '/home/claude/hero'); from bl_fixhands import fix_hands
fix_hands(arm, [o for o in bpy.data.objects if o.type == 'MESH'][0])
if mode == 'anim':
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for o in list(bpy.data.objects):
        if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
else:
    import os  # DROP=Idle,Walking: leave those of the model's own clips out
    for a in list(bpy.data.actions):
        if a.name in [x for x in os.environ.get('DROP', '').split(',') if x]: bpy.data.actions.remove(a)
        else: a.use_fake_user = True

# bones that get animated: the mixamo body chain; fingers stay in the game's fixed fist pose
def keep(b):
    n = b.name
    if not n.startswith('mixamorig:'): return False
    if 'Hand' in n and not n.endswith('Hand'): return False
    if n.endswith('_End'): return False
    return True
bones = [b for b in arm.data.bones]  # data.bones is parent-first ordered
order = []
def walk(b):
    order.append(b)
    for c in b.children: walk(c)
for b in bones:
    if not b.parent: walk(b)
KEEP = [b.name for b in order if keep(b)]
rest = {b.name: b.matrix_local.copy() for b in order}
rel = {b.name: (rest[b.parent.name].inverted() @ rest[b.name]) if b.parent else rest[b.name] for b in order}

sc = bpy.context.scene
meta = {}
import os
# YBOT=<Y Bot.fbx>: the clips are Mixamo's for the standard Y Bot; map them through both T-poses (see bl_ybot.py)
YB = None
if os.environ.get('YBOT'):
    from bl_ybot import ybot_tpose, ours_tpose
    YR, YP = ybot_tpose(os.environ['YBOT']); OT, HO = ours_tpose(arm, YP); SCALE = HO / YP['mixamorig:Hips'].z
    YB = {n: YR[n].inverted() @ OT[n] for n in KEEP}
    print('YBOT standing hip height ours', round(HO, 3), 'ybot', round(YP['mixamorig:Hips'].z, 3), 'scale', round(SCALE, 3))
SMOOTH = 5  # half window (frames) for the root travel curve

for name, path in clips:
    objs0, acts0 = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    farm = [o for o in bpy.data.objects if o not in objs0 and o.type == 'ARMATURE'][0]
    fact = [a for a in bpy.data.actions if a not in acts0][0]
    f0, f1 = int(round(fact.frame_range[0])), int(round(fact.frame_range[1]))
    frames = list(range(f0, f1 + 1))
    rots, hips = [], []
    for fr in frames:
        sc.frame_set(fr)
        mw = farm.matrix_world
        if YB:
            rots.append({n: (mw @ farm.pose.bones[n].matrix).to_quaternion() @ YB[n] for n in KEEP})
            hips.append((mw @ farm.pose.bones['mixamorig:Hips'].matrix).translation * SCALE)
        else:
            rots.append({n: (mw @ farm.pose.bones[n].matrix).to_quaternion() for n in KEEP})
            hips.append((mw @ farm.pose.bones['mixamorig:Hips'].matrix).translation.copy())
    # root travel: moving average of the hips' ground position, relative to the first frame
    n = len(frames)
    root = []
    for i in range(n):
        lo, hi = max(0, i - SMOOTH), min(n - 1, i + SMOOTH)
        s = Vector((0, 0, 0))
        for j in range(lo, hi + 1): s += hips[j]
        s /= (hi - lo + 1)
        root.append(Vector((s.x, s.y, 0)))
    # pin the curve's ends to the real start/end so the stripped clip starts and ends over the origin
    d0 = Vector((hips[0].x, hips[0].y, 0)) - root[0]; d1 = Vector((hips[-1].x, hips[-1].y, 0)) - root[-1]
    for i in range(n):
        t = i / max(1, n - 1)
        root[i] = root[i] + d0.lerp(d1, t) - Vector((hips[0].x, hips[0].y, 0))
    act = bpy.data.actions.new(name); act.use_fake_user = True
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = act
    curves = {}
    for bn in KEEP:
        curves[bn] = [act.fcurve_ensure_for_datablock(arm, f'pose.bones["{bn}"].rotation_quaternion', index=i) for i in range(4)]
    hloc = [act.fcurve_ensure_for_datablock(arm, 'pose.bones["mixamorig:Hips"].location', index=i) for i in range(3)]
    data = {bn: [[], [], [], []] for bn in KEEP}; hdata = [[], [], []]
    prevq = {}
    for i, fr in enumerate(frames):
        P = {}
        for b in order:
            par = P[b.parent.name] if b.parent else Matrix.Identity(4)
            base = par @ rel[b.name]
            if b.name in rots[i]:
                q = rots[i][b.name]
                if b.name == 'mixamorig:Hips':
                    loc = hips[i] - root[i]
                else:
                    loc = base.translation
                want = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
                basis = base.inverted() @ want
                bq = basis.to_quaternion().normalized()
                if b.name in prevq and prevq[b.name].dot(bq) < 0: bq = -bq
                prevq[b.name] = bq
                for k in range(4): data[b.name][k] += [float(fr - f0), bq[k]]
                if b.name == 'mixamorig:Hips':
                    bl = basis.translation
                    for k in range(3): hdata[k] += [float(fr - f0), bl[k]]
                P[b.name] = base @ (Matrix.Translation(basis.translation) @ bq.to_matrix().to_4x4())
            else:
                P[b.name] = base
    for bn in KEEP:
        for k in range(4):
            fc = curves[bn][k]; fc.keyframe_points.add(n); fc.keyframe_points.foreach_set('co', data[bn][k])
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    for k in range(3):
        fc = hloc[k]; fc.keyframe_points.add(n); fc.keyframe_points.foreach_set('co', hdata[k])
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    # root curve in game axes (three.js: x right, z forward = blender -y), sampled every 3 frames, model units
    rs = [[round(root[i].x, 3), round(-root[i].y, 3)] for i in range(0, n, 3)]
    if (n - 1) % 3: rs.append([round(root[-1].x, 3), round(-root[-1].y, 3)])
    meta[name] = {'frames': n, 'dur': round((n - 1) / 30, 3), 'root': rs}
    print('CLIP', name, n, 'travel', rs[-1])
    arm.animation_data.action = None
    for o in [o for o in bpy.data.objects if o not in objs0]: bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.actions.remove(fact)

sc.render.fps = 30
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_frame_step=1, export_apply=False, export_yup=True)
json.dump(meta, open(meta_path, 'w'), indent=0)
print('WROTE', out)
