# Usage: python3 tools/bl_zy_aim.py -- <zy_fixed.glb> <clip> ...   (Blender as a Python module): the arrow line per archery clip, for ARCH_TURN in zy-fix-rig.mjs
# the arrow's line (right fist -> left fist) per archery clip: its yaw off his facing (+ = to his left) and its pitch, and the bow hand's height
import bpy, sys, math, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=argv[0])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); P = arm.pose.bones; sc = bpy.context.scene
def fist(s):
    pts = [arm.matrix_world @ P[f'mixamorig:{s}Hand{f}{i}'].head for f in ['Middle', 'Pinky'] for i in (1, 2, 3)]
    return sum(pts, mathutils.Vector()) / len(pts)
for name in argv[1:]:
    act = bpy.data.actions[name]; arm.animation_data.action = act
    try: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    f0, f1 = act.frame_range
    for fr in [0.0, 0.1, 0.2, 0.3, 0.5]:
        sc.frame_set(int(round(f0 + (f1 - f0) * fr))); r, l = fist('Right'), fist('Left'); d = l - r
        # Blender: forward -y, his left +x, up +z
        yaw = math.degrees(math.atan2(d.x, -d.y)); pitch = math.degrees(math.atan2(d.z, math.hypot(d.x, d.y)))
        print(f'{name} {fr:.1f} arrow yaw {yaw:+.1f} pitch {pitch:+.1f} | bow hand h {l.z:.2f} fwd {-l.y:+.2f} left {l.x:+.2f} | string hand h {r.z:.2f}')
