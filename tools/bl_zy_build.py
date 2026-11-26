import bpy, sys
fbx, prep, out = sys.argv[-3], sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx, automatic_bone_orientation=False)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
print('arm rot', tuple(arm.rotation_euler), 'scale', tuple(arm.scale), 'mesh rot', tuple(me.rotation_euler), 'scale', tuple(me.scale))
for o in (arm, me):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
print('after: arm', tuple(arm.scale), 'mesh', tuple(me.scale), 'dims', tuple(round(v, 3) for v in me.dimensions))
uv_rig = [tuple(round(c, 4) for c in d.uv) for d in me.data.uv_layers[0].data[:50]]
objs0 = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=prep)
pm = [o for o in bpy.data.objects if o not in objs0 and o.type == 'MESH'][0]
uv_p = [tuple(round(c, 4) for c in d.uv) for d in pm.data.uv_layers[0].data[:50]]
print('uv match first 50 loops', sum(a == b for a, b in zip(uv_rig, uv_p)), 'loops', len(me.data.loops), len(pm.data.loops))
mat = pm.data.materials[0]; mat.name = 'ZhaoYun'
me.data.materials.clear(); me.data.materials.append(mat)
for o in [o for o in bpy.data.objects if o not in objs0 or o.type == 'EMPTY']:
    if o in objs0 and o.type != 'EMPTY': continue
    bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.data.objects: print('keep', o.type, o.name)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_apply=False, export_yup=True, export_skins=True)
print('WROTE', out)
