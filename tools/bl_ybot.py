# Retarget Mixamo clips made for the standard Y Bot onto the hero rig, in world space (bone roll / bind pose independent).
# Mixamo retargeting straight onto the Meshy rig bent knees sideways (its bones roll differently from Mixamo's), so instead:
#   1. pose our skeleton into Y Bot's T-pose: every body bone aimed along the matching Y Bot bone, arms twisted so the palms
#      face like Y Bot's (thumb side matched) -> O_T(b), our bones' world rotations in that T-pose
#   2. each frame: ours(b) = S(b) * S_T(b)^-1 * O_T(b)  (S: Y Bot bone world rotation, S_T: in Y Bot's T-pose)
#   3. hips position scaled by standing hip height (ours / Y Bot)
import bpy
from mathutils import Vector, Quaternion, Matrix
from bl_fixhands import chains_of

BODY = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
        'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
AIMC = {'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head', 'Head': 'HeadTop_End',
        'LeftShoulder': 'LeftArm', 'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'RightShoulder': 'RightArm', 'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand',
        'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'LeftFoot': 'LeftToeBase', 'LeftToeBase': 'LeftToe_End',
        'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase', 'RightToeBase': 'RightToe_End'}
M = lambda n: 'mixamorig:' + n

def ybot_tpose(path):
    """Y Bot's T-pose from its skinned FBX: world rotation per bone, joint positions, and the armature."""
    objs, acts = set(bpy.data.objects), set(bpy.data.actions); bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in objs]; arm = [o for o in new if o.type == 'ARMATURE'][0]
    mw = arm.matrix_world; rot, pos = {}, {}
    for b in arm.data.bones:
        rot[b.name] = (mw @ b.matrix_local).to_quaternion(); pos[b.name] = (mw @ b.matrix_local).translation.copy()
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    for a in [a for a in bpy.data.actions if a not in acts]: bpy.data.actions.remove(a)
    return rot, pos

def ours_tpose(arm, ypos):
    """Pose our armature into Y Bot's T-pose; return world rotations O_T and our standing hip height in it."""
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update(); mw = arm.matrix_world
    def head(n): return mw @ arm.pose.bones[n].head
    def turn(n, q):  # rotate pose bone n about its head by world rotation q
        pb = arm.pose.bones[n]; Mx = pb.matrix.copy(); loc = Mx.translation.copy()
        pb.matrix = Matrix.Translation(loc) @ q.to_matrix().to_4x4() @ Matrix.Translation(-loc) @ Mx; bpy.context.view_layer.update()
    knuck = {}
    for side, palm in (('Left', 'Bone_024'), ('Right', 'Bone_019')):
        chains = chains_of(arm, M(side + 'Hand'), palm); thumb = max(chains, key=lambda ch: ch[0].head_local.z)
        knuck[side] = ([ch[0].name for ch in chains if ch is not thumb], thumb[0].name)
    def our_dir(n):
        if n.endswith('Hand'): side = n[:-4]; ks = knuck[side][0]; k = sum((head(x) for x in ks), Vector()) / len(ks); return (k - head(M(n))).normalized()
        return (head(M(AIMC[n])) - head(M(n))).normalized()
    def yb_dir(n):
        c = ypos.get(M(n[:-4] + 'HandMiddle1')) if n.endswith('Hand') else ypos.get(M(AIMC[n]))
        return (c - ypos[M(n)]).normalized()
    for n in BODY:
        q = our_dir(n).rotation_difference(yb_dir(n)); turn(M(n), q)
    # twist the arms so the thumbs point where Y Bot's do (half in the upper arm, half in the forearm)
    for side in ('Left', 'Right'):
        ax = our_dir(side + 'Hand'); ks, th = knuck[side]; k = sum((head(x) for x in ks), Vector()) / len(ks)
        ot = head(th) - k; ot = (ot - ax * ot.dot(ax)).normalized()
        yt = ypos[M(side + 'HandThumb1')] - ypos[M(side + 'HandMiddle1')]; ya = yb_dir(side + 'Hand'); yt = (yt - ya * yt.dot(ya)).normalized()
        ang = ot.angle(yt); sgn = 1 if ax.dot(ot.cross(yt)) > 0 else -1
        for n, f in ((side + 'Arm', 0.5), (side + 'ForeArm', 1.0)):  # the forearm turn is applied after the arm's, so it finishes the rest
            cur = head(th) - (sum((head(x) for x in ks), Vector()) / len(ks)); a2 = our_dir(side + 'Hand'); cur = (cur - a2 * cur.dot(a2)).normalized()
            rem = cur.angle(yt) * (1 if a2.dot(cur.cross(yt)) > 0 else -1)
            turn(M(n), Quaternion(our_dir(n), rem * f))
        print('  arm twist', side, round(ang * 57.3, 1) * sgn)
    OT = {b.name: (mw @ arm.pose.bones[b.name].matrix).to_quaternion() for b in arm.data.bones}
    feet = min(head(M('LeftFoot')).z, head(M('RightFoot')).z); hipz = head(M('Hips')).z
    rest_ankle = min(arm.data.bones[M('LeftFoot')].head_local.z, arm.data.bones[M('RightFoot')].head_local.z)
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    return OT, hipz - feet + rest_ankle
