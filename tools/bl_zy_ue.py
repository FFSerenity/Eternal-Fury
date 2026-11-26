# Retarget Unreal Engine 5 Mannequin (Manny) clips — exported from UE as FBX — onto Zhao Yun's rig (Meshy's Mixamo skeleton), in world
# space, the way tools/bl_ybot.py does it for Mixamo's Y Bot:
#   1. pose his skeleton into Manny's reference pose: every body bone aimed along the matching Manny bone, the arms twisted so the thumbs
#      point like Manny's -> O_R(b), his bones' world rotations in that pose
#   2. each frame: his(b) = S(b) * S_R(b)^-1 * O_R(b)  (S: the Manny bone's world rotation, S_R: in Manny's reference pose)
#   3. the hips' place: Manny's pelvis (root motion included: UE's root bone comes in as the armature object), scaled by standing hip height
# Spine: Manny has five spine bones and two neck bones; his three spine bones follow spine_02 / spine_04 / spine_05. Fingers stay as the
# game poses them (fists). Out: his armature with the new clips only, named <Name>; tools/zy-fix-rig.mjs merges them in by bone name.
# Usage: python3 tools/bl_zy_ue.py -- <zhao yun meshy.glb> <out.glb> Name=clip.fbx[@first-last] ...   (Blender as a Python module)
import bpy, sys
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
clips = []  # Name=clip.fbx[@first-last]: a frame range cut out (a walk's steady cycle, without its start and stop)
for a in argv[2:]:
    nm, rest = a.split('=', 1); rng = None
    if '@' in rest: rest, r = rest.rsplit('@', 1); rng = tuple(int(x) for x in r.split('-'))
    clips.append((nm, rest, rng))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = 30
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
if arm.animation_data: arm.animation_data.action = None
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
for o in list(bpy.data.objects):
    if o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
M = lambda n: 'mixamorig:' + n
# his bone -> Manny's
MAP = {'Hips': 'pelvis', 'Spine': 'spine_02', 'Spine1': 'spine_04', 'Spine2': 'spine_05', 'Neck': 'neck_01', 'Head': 'head'}
for s, u in (('Left', 'l'), ('Right', 'r')):
    MAP.update({s + 'Shoulder': 'clavicle_' + u, s + 'Arm': 'upperarm_' + u, s + 'ForeArm': 'lowerarm_' + u, s + 'Hand': 'hand_' + u,
                s + 'UpLeg': 'thigh_' + u, s + 'Leg': 'calf_' + u, s + 'Foot': 'foot_' + u, s + 'ToeBase': 'ball_' + u})
BODY = list(MAP)
AIM = {'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head', 'Head': 'HeadTop_End'}
for s in ('Left', 'Right'):
    AIM.update({s + 'Shoulder': s + 'Arm', s + 'Arm': s + 'ForeArm', s + 'ForeArm': s + 'Hand', s + 'Hand': s + '#knuckle',
                s + 'UpLeg': s + 'Leg', s + 'Leg': s + 'Foot', s + 'Foot': s + 'ToeBase', s + 'ToeBase': s + 'Toe_End'})

# ---- Manny's reference pose (the armature's rest in the FBX) ----
def load_fbx(path):
    o0, a0 = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    farm = next(o for o in bpy.data.objects if o not in o0 and o.type == 'ARMATURE')
    fact = next(a for a in bpy.data.actions if a not in a0)
    return farm, fact, [o for o in bpy.data.objects if o not in o0]
farm, fact, new = load_fbx(clips[0][1])  # (Manny's reference pose: the same in every clip)
fmw = farm.matrix_world  # (rest: no animation applied to data.bones)
fmw0 = Matrix.Diagonal((farm.scale.x, farm.scale.y, farm.scale.z, 1.0))  # the object's rest transform: its scale (UE cm -> m)
SR = {n: (fmw0 @ farm.data.bones[MAP[n]].matrix_local).to_quaternion() for n in BODY}
SP = {b.name: (fmw0 @ b.matrix_local).translation.copy() for b in farm.data.bones}
def src_pos(n):  # Manny's point for one of his joint names (or the aim ends Manny has no bone for)
    if n.endswith('#knuckle'): u = 'l' if n.startswith('Left') else 'r'; return (SP['middle_01_' + u] + SP['pinky_01_' + u]) / 2
    if n == 'HeadTop_End': return SP['head'] + (SP['head'] - SP['neck_02']).normalized() * 0.2
    if n.endswith('Toe_End'):
        u = 'l' if n.startswith('Left') else 'r'; d = SP['ball_' + u] - SP['foot_' + u]; d.z = 0
        return SP['ball_' + u] + d.normalized() * 0.07
    return SP[MAP[n]]
ankle_src = min(SP['foot_l'].z, SP['foot_r'].z); hipz_src = (SP['thigh_l'].z + SP['thigh_r'].z) / 2 - ankle_src
for o in new: bpy.data.objects.remove(o, do_unlink=True)
bpy.data.actions.remove(fact)

# ---- his skeleton posed into Manny's reference pose ----
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update(); mw = arm.matrix_world
def head(n): return mw @ arm.pose.bones[n].head
def our_pos(n):
    if n.endswith('#knuckle'): s = n.split('#')[0]; return (head(M(s + 'HandMiddle1')) + head(M(s + 'HandPinky1'))) / 2
    return head(M(n))
def turn(n, q):  # rotate pose bone n about its head by world rotation q
    pb = arm.pose.bones[n]; Mx = pb.matrix.copy(); loc = Mx.translation.copy()
    pb.matrix = Matrix.Translation(loc) @ q.to_matrix().to_4x4() @ Matrix.Translation(-loc) @ Mx; bpy.context.view_layer.update()
our_dir = lambda n: (our_pos(AIM[n]) - our_pos(n)).normalized()
src_dir = lambda n: (src_pos(AIM[n]) - src_pos(n)).normalized()
def frame(lat, up):  # a rotation from two directions (x: lateral, z: up, made square to it)
    x = lat.normalized(); z = (up - x * up.dot(x)).normalized(); y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_quaternion()
# the hips by their frame (left-right across the thighs, up to the mid spine): his hips bone stands well in front of and above his
# thighs (Meshy's placement), so aiming it like Manny's would swing his legs' roots about
our_mid = lambda: (head(M('LeftUpLeg')) + head(M('RightUpLeg'))) / 2
src_mid = (SP['thigh_l'] + SP['thigh_r']) / 2
F_src = frame(SP['thigh_l'] - SP['thigh_r'], SP['spine_04'] - src_mid)
turn(M('Hips'), F_src @ frame(head(M('LeftUpLeg')) - head(M('RightUpLeg')), head(M('Spine1')) - our_mid()).inverted())
for n in BODY[1:]: turn(M(n), our_dir(n).rotation_difference(src_dir(n)))
for s, u in (('Left', 'l'), ('Right', 'r')):  # thumbs: half the twist in the upper arm, the rest in the forearm
    st = SP['thumb_01_' + u] - src_pos(s + '#knuckle'); sa = src_dir(s + 'Hand'); st = (st - sa * st.dot(sa)).normalized()
    for n, f in ((s + 'Arm', 0.5), (s + 'ForeArm', 1.0)):
        a2 = our_dir(s + 'Hand'); cur = head(M(s + 'HandThumb1')) - our_pos(s + '#knuckle'); cur = (cur - a2 * cur.dot(a2)).normalized()
        rem = cur.angle(st) * (1 if a2.dot(cur.cross(st)) > 0 else -1)
        turn(M(n), Quaternion(our_dir(n), rem * f))
OR = {n: (mw @ arm.pose.bones[M(n)].matrix).to_quaternion() for n in BODY}
feet = min(head(M('LeftFoot')).z, head(M('RightFoot')).z); hipz_our = our_mid().z - feet
OFF = our_mid() - head(M('Hips'))  # his hips bone -> his thighs' midpoint, in this pose
rest_ankle = min(arm.data.bones[M('LeftFoot')].head_local.z, arm.data.bones[M('RightFoot')].head_local.z)
SCALE = hipz_our / hipz_src
print('hip height ours', round(hipz_our, 3), 'Manny', round(hipz_src, 3), 'scale', round(SCALE, 3))
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()
D = {n: SR[n].inverted() @ OR[n] for n in BODY}

# ---- the clips ----
order = []
def walk(b):
    order.append(b)
    for c in b.children: walk(c)
for b in arm.data.bones:
    if not b.parent: walk(b)
rest = {b.name: b.matrix_local.copy() for b in order}
rel = {b.name: (rest[b.parent.name].inverted() @ rest[b.name]) if b.parent else rest[b.name] for b in order}
KEEP = [M(n) for n in BODY]
ROOT = {}  # clip -> its root motion per frame (30 fps): forward, his left (his model's metres), turn to his left (radians), from its start
for name, path, rng in clips:
    farm, fact, new = load_fbx(path)
    f0, f1 = rng or (int(round(fact.frame_range[0])), int(round(fact.frame_range[1]))); frames = list(range(f0, f1 + 1))
    rots, hips, root = [], [], []
    for fr in frames:
        sc.frame_set(fr); fm = fmw0  # (UE's root motion — the armature object's own move and turn — kept out of the pose: see ROOT)
        root.append((-farm.location.y * SCALE, farm.location.x * SCALE, farm.rotation_euler.z))  # (forward, his left, turn to his left)
        rots.append({M(n): (fm @ farm.pose.bones[MAP[n]].matrix).to_quaternion() @ D[n] for n in BODY})
        # his thighs' midpoint on Manny's (scaled; the ankles on his ankle height), his hips bone placed from it
        p = (fm @ farm.pose.bones['thigh_l'].head + fm @ farm.pose.bones['thigh_r'].head) / 2
        dq = (fm @ farm.pose.bones['pelvis'].matrix).to_quaternion() @ SR['Hips'].inverted()
        hips.append(Vector((p.x * SCALE, p.y * SCALE, (p.z - ankle_src) * SCALE + rest_ankle)) - dq @ OFF)
    act = bpy.data.actions.new(name); act.use_fake_user = True
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = act
    curves = {bn: [act.fcurve_ensure_for_datablock(arm, f'pose.bones["{bn}"].rotation_quaternion', index=i) for i in range(4)] for bn in KEEP}
    hloc = [act.fcurve_ensure_for_datablock(arm, 'pose.bones["mixamorig:Hips"].location', index=i) for i in range(3)]
    data = {bn: [[], [], [], []] for bn in KEEP}; hdata = [[], [], []]; prevq = {}
    for i, fr in enumerate(frames):
        P = {}
        for b in order:
            par = P[b.parent.name] if b.parent else Matrix.Identity(4)
            base = par @ rel[b.name]
            if b.name in rots[i]:
                q = rots[i][b.name]
                loc = hips[i] if b.name == M('Hips') else base.translation
                basis = base.inverted() @ (Matrix.Translation(loc) @ q.to_matrix().to_4x4())
                bq = basis.to_quaternion().normalized()
                if b.name in prevq and prevq[b.name].dot(bq) < 0: bq = -bq
                prevq[b.name] = bq
                for k in range(4): data[b.name][k] += [float(fr - f0), bq[k]]
                if b.name == M('Hips'):
                    for k in range(3): hdata[k] += [float(fr - f0), basis.translation[k]]
                P[b.name] = base @ (Matrix.Translation(basis.translation) @ bq.to_matrix().to_4x4())
            else: P[b.name] = base
    n = len(frames)
    for bn in KEEP:
        for k in range(4):
            fc = curves[bn][k]; fc.keyframe_points.add(n); fc.keyframe_points.foreach_set('co', data[bn][k])
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    for k in range(3):
        fc = hloc[k]; fc.keyframe_points.add(n); fc.keyframe_points.foreach_set('co', hdata[k])
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    if max(abs(v) for r in root for v in r) > 0.01: ROOT[name] = root
    print('CLIP', name, n, 'frames; root travel', tuple(round(v, 2) for v in root[-1]), '; hips moved in the pose', tuple(round(v, 2) for v in (hips[-1] - hips[0])))
    arm.animation_data.action = None
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.actions.remove(fact)
# the root motion, for the game to move him by (src/zyroot.js): each clip's frames as one flat list of forward, left, turn
import os
if os.environ.get('ROOT_JS'):
    with open(os.environ['ROOT_JS'], 'w') as f:
        f.write('// generated by tools/bl_zy_ue.py: the Unreal clips\' root motion (UE moves a character by its root bone), per frame at 30 fps,\n')
        f.write('// from the clip\'s start: forward and to his left (his model\'s metres), and his turn to the left (radians). The poses leave it out.\n')
        f.write('export const ZY_ROOT = {\n')
        for k, r in ROOT.items(): f.write(f"  ZY_{k}: [{', '.join(f'{v:.3f}' for row in r for v in row)}],\n")
        f.write('};\n')
    print('WROTE', os.environ['ROOT_JS'], list(ROOT))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_frame_step=1, export_apply=False, export_yup=True, export_skins=True)
print('WROTE', out)
