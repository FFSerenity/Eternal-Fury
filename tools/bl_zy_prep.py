# Pixal3D Zhao Yun -> level, 1.8 m tall, feet on 0, decimated, FBX (embedded textures) for Mixamo + a glb copy with the same mesh
import bpy, sys, math
from mathutils import Vector, Matrix
src, out_fbx, out_glb, target = sys.argv[-4], sys.argv[-3], sys.argv[-2], int(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.data.objects if o.type == 'MESH']
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
if len(ms) > 1: bpy.ops.object.join()
me = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# clear parents (the importer may parent under an empty)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
V = [me.matrix_world @ v.co for v in me.data.vertices]
ys = sorted(v.z for v in V); z0, z1 = ys[0], ys[-1]; H = z1 - z0   # (Blender: z up)
def band(a, b, xw=None):
    P = [v for v in V if z0 + a * H <= v.z <= z0 + b * H and (xw is None or abs(v.x) < xw * H)]
    xs = [p.x for p in P]; yy = [p.y for p in P]
    return Vector(((min(xs) + max(xs)) / 2, (min(yy) + max(yy)) / 2, z0 + (a + b) / 2 * H)), len(P)
feet, n1 = band(0.0, 0.06)
hips, n2 = band(0.40, 0.50, 0.12)
chest, n3 = band(0.62, 0.70, 0.1)
print('feet', feet, 'hips', hips, 'chest', chest, n1, n2, n3)
up = (chest - feet).normalized()
ang = up.angle(Vector((0, 0, 1)))
print('lean deg', math.degrees(ang), 'dir', up)
R = up.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
me.data.transform(R)
V = [v.co.copy() for v in me.data.vertices]
xs = [v.x for v in V]; yy = [v.y for v in V]; zs = [v.z for v in V]
s = 1.8 / (max(zs) - min(zs))
T = Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(yy) + max(yy)) / 2, -min(zs)))
me.data.transform(Matrix.Scale(s, 4) @ T)
n0 = len(me.data.polygons)
m = me.modifiers.new('dec', 'DECIMATE'); m.ratio = target / n0; m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
print('faces', n0, '->', len(me.data.polygons), 'size', me.dimensions)
me.name = 'ZhaoYun'
for img in bpy.data.images:
    if img.packed_file is None and img.source == 'FILE': continue
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_yup=True)
for img in bpy.data.images:
    img.filepath_raw = '/home/claude/zy/tex_' + bpy.path.clean_name(img.name) + '.png'; img.file_format = 'PNG'
    try: img.save()
    except Exception as e: print('img', img.name, e)
bpy.ops.export_scene.fbx(filepath=out_fbx, object_types={'MESH'}, path_mode='COPY', embed_textures=True, use_selection=False, apply_scale_options='FBX_SCALE_ALL')
print('done')
