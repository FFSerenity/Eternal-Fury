# Hand fixes for the Meshy auto-rig, applied right after importing the hero (used by bl_retarget.py):
# 1. the finger roots (Bone_019 / Bone_024 "palm" bones) hang off the forearms, so fingers ignore wrist rotation:
#    reparent them under the hand bones (rest pose unchanged).
# 2. two right-hand fingers were skinned rigidly to the hand bone: give their vertices to the finger chains that run
#    through them (nearest segment), blended in over the knuckle.
import bpy
from mathutils import Vector

def chains_of(arm, hand, palm):
    out = []
    for p in (arm.data.bones.get(hand), arm.data.bones.get(palm)):
        if not p: continue
        for c in p.children:
            if c.name == palm: continue
            ch = []; b = c
            while b: ch.append(b); b = b.children[0] if b.children else None
            out.append(ch)
    return out

def fix_hands(arm, mesh):
    # --- weights (rest pose; vertex coordinates are in the same space as the armature's rest, both at identity)
    gi = {g.index: g.name for g in mesh.vertex_groups}
    for hand, palm in (('mixamorig:RightHand', 'Bone_019'), ('mixamorig:LeftHand', 'Bone_024')):
        chains = chains_of(arm, hand, palm)
        if not chains: continue
        thumb = max(chains, key=lambda ch: ch[0].head_local.z)
        fingers = [ch for ch in chains if ch is not thumb]
        hp = arm.data.bones[hand].head_local
        kn = sum((ch[0].head_local for ch in fingers), Vector()) / len(fingers)
        d = (kn - hp).normalized()
        segs = []
        for ch in fingers:
            ka = (ch[0].head_local - hp).dot(d)
            for b in ch: segs.append((b, b.head_local, b.tail_local, ka))
        for b, *_ in segs:
            if b.name not in mesh.vertex_groups: mesh.vertex_groups.new(name=b.name)
        hg = mesh.vertex_groups[hand]
        moved = 0
        for v in mesh.data.vertices:
            if not v.groups: continue
            g = max(v.groups, key=lambda g: g.weight)
            if gi.get(g.group) != hand: continue
            best = None
            for b, h, t, ka in segs:
                ab = t - h; L2 = ab.length_squared or 1e-9
                u = max(0.0, min(1.0, (v.co - h).dot(ab) / L2)); dist = (v.co - (h + ab * u)).length
                if best is None or dist < best[0]: best = (dist, b, ka)
            dist, b, ka = best
            along = (v.co - hp).dot(d)
            if dist > 0.02 or along < ka - 0.004: continue
            w = max(0.0, min(1.0, (along - (ka - 0.004)) / 0.012))
            for gg in list(v.groups):
                mesh.vertex_groups[gi[gg.group]].remove([v.index])
            mesh.vertex_groups[b.name].add([v.index], w, 'REPLACE')
            if w < 1: hg.add([v.index], 1 - w, 'REPLACE')
            moved += 1
        print('FIXHANDS', hand, 'moved', moved, 'verts onto', len(fingers), 'finger chains')
    # --- hierarchy
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    for hand, palm in (('mixamorig:RightHand', 'Bone_019'), ('mixamorig:LeftHand', 'Bone_024')):
        if palm in eb and hand in eb: eb[palm].use_connect = False; eb[palm].parent = eb[hand]
    bpy.ops.object.mode_set(mode='OBJECT')
