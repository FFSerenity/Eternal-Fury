# Where his feet stand in each of Meshy's clips (the four foot and toe joints' mean on the ground: glTF x, z), first frame and over the clip:
# tools/zy-fix-rig.mjs takes the result to stand each clip on his spot. Run on zy-fix-rig's output without the file, then again with it.
# Usage: python3 tools/bl_zy_feet.py -- <in.glb> <out.json>   (Blender as a Python module)
import bpy, sys, json
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); P = arm.pose.bones; sc = bpy.context.scene
W = lambda n: arm.matrix_world @ P['mixamorig:' + n].head
res = {}
for act in bpy.data.actions:
    arm.animation_data.action = act
    try: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    f0, f1 = act.frame_range; cs = []
    for k in range(12):
        sc.frame_set(int(f0 + (f1 - f0) * k / 11))
        c = (W('LeftFoot') + W('RightFoot') + W('LeftToeBase') + W('RightToeBase')) / 4
        cs.append((c.x, -c.y))  # glTF x, glTF z
    mean = (sum(c[0] for c in cs) / len(cs), sum(c[1] for c in cs) / len(cs))
    res[act.name] = {'first': [round(v, 3) for v in cs[0]], 'mean': [round(v, 3) for v in mean]}
    print(act.name.ljust(30), 'feet centre first', res[act.name]['first'], 'mean', res[act.name]['mean'])
json.dump(res, open(argv[1], 'w'))
