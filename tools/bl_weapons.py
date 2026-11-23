# Split the Meshy "Runebound Armory" sheet (six weapons side by side) into six objects, each with its origin at the
# grip point and the blade/haft pointing up (+Y in glTF), and export them as one glb (shared texture).
# usage: python3 bl_weapons.py -- <in.glb> <out.glb> <ratio>
import bpy, bmesh, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, ratio = argv[0], argv[1], float(argv[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o = [o for o in bpy.data.objects if o.type == 'MESH'][0]
# x cut points between the weapons, then each one's grip point (x, z) on the sheet
CUTS = [-0.73, -0.31, 0.05, 0.43, 0.66]
WEAP = [('sword', -0.882, -0.300), ('shield', -0.520, -0.060), ('greatsword', -0.140, -0.300),
        ('axe', 0.183, -0.300), ('spear', 0.533, -0.120), ('mace', 0.838, -0.320)]
def which(x):
    for i, c in enumerate(CUTS):
        if x < c: return i
    return len(CUTS)
parts = []
for i, (name, gx, gz) in enumerate(WEAP):
    c = o.copy(); c.data = o.data.copy(); c.name = name; c.data.name = name
    bpy.context.collection.objects.link(c)
    bm = bmesh.new(); bm.from_mesh(c.data)
    kill = [f for f in bm.faces if which(f.calc_center_median().x) != i]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # the shield's grip is on its back, a little behind the centre of the board
    ys = [v.co.y for v in bm.verts]
    gy = max(ys) if name == 'shield' else (min(ys) + max(ys)) / 2
    for v in bm.verts: v.co -= Vector((gx, gy, gz))
    bm.to_mesh(c.data); bm.free()
    if ratio < 1:
        m = c.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio
        bpy.context.view_layer.objects.active = c
        bpy.ops.object.modifier_apply(modifier='dec')
    zs = [v.co.z for v in c.data.vertices]
    print('W', name, len(c.data.polygons), 'faces, from', round(min(zs), 3), 'to', round(max(zs), 3), 'depth', round(max(v.co.y for v in c.data.vertices) - min(v.co.y for v in c.data.vertices), 3))
    parts.append(c)
bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_animations=False, export_yup=True)
