# the spear (generated spearhead + its navy socket stretched into a shaft) and the bow, as hero weapons: each a top-level node, its axis
# along +Y (glTF), the grip at the origin. Spear: 2.2 m, grip 0.45 of the way up from the butt. Bow: 1.3 m, grip at its middle.
import bpy, sys, numpy as np
from mathutils import Vector, Matrix
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(path, name, tris):
    objs0 = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    ms = [o for o in bpy.data.objects if o not in objs0 and o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    if len(ms) > 1: bpy.ops.object.join()
    me = bpy.context.view_layer.objects.active; me.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in bpy.data.objects if o not in objs0 and o is not me]: bpy.data.objects.remove(o, do_unlink=True)
    m = me.modifiers.new('dec', 'DECIMATE'); m.ratio = tris / len(me.data.polygons); m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec'); me.name = name; me.data.name = name; return me
def axis_up(me, tip_far=True):
    P = np.array([v.co[:] for v in me.data.vertices]); c = P.mean(0); u, s, vt = np.linalg.svd(P - c, full_matrices=False); a = vt[0]
    t = (P - c) @ a
    # the tip: the end farther from the centroid (the spearhead's mass sits low, in the dragon guard and socket)
    if tip_far and abs(t.max()) < abs(t.min()): a = -a
    R = Vector(a).rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4(); me.data.transform(R @ Matrix.Translation(Vector(-c)))
    return me
spear = axis_up(load('spearhead_raw.glb', 'spear', 7000))
Z = np.array([v.co.z for v in spear.data.vertices]); z0, z1 = Z.min(), Z.max(); L0 = z1 - z0
s = 0.82 / L0; spear.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation((0, 0, -z0)))   # head 0.82 m, its bottom at 0
# the shaft: the socket's lowest ring and cap pulled down 1.38 m (the navy lacquer stretches along it)
EXT = 1.38
for v in spear.data.vertices:
    if v.co.z < 0.012: v.co.z -= EXT
# centre the shaft line on the axis (x / y) at its bottom
B = [v.co for v in spear.data.vertices if v.co.z < -EXT + 0.01]; cx = sum(b.x for b in B) / len(B); cy = sum(b.y for b in B) / len(B)
for v in spear.data.vertices:
    if v.co.z < 0.012: v.co.x -= cx; v.co.y -= cy
total = 0.82 + EXT; grip = -EXT + 0.40 * total
spear.data.transform(Matrix.Translation((0, 0, -grip)))
print('spear length', round(total, 3), 'grip at', round(0.40 * total, 3), 'from the butt; tris', len(spear.data.polygons))
bow = axis_up(load('bow_raw.glb', 'bow', 6000), tip_far=False)
Z = np.array([v.co.z for v in bow.data.vertices]); bow.data.transform(Matrix.Scale(1.3 / (Z.max() - Z.min()), 4) @ Matrix.Translation((0, 0, -(Z.max() + Z.min()) / 2)))
# the arrow nocked across the grip (the picture had one): everything in a thin band at the grip's height that stands off the grip, short of the string
import bmesh
P = np.array([v.co[:] for v in bow.data.vertices]); band = np.abs(P[:, 2]) < 0.04
mid = P[np.abs(P[:, 2]) < 0.12]; gx = float(np.median(mid[:, 0])); gy = float(np.median(mid[:, 1]))
sx = float(np.percentile(P[np.abs(P[:, 2]) > 0.3][:, 0], 98)) if gx < 0 else float(np.percentile(P[np.abs(P[:, 2]) > 0.3][:, 0], 2))
bm = bmesh.new(); bm.from_mesh(bow.data); kill = [v for v in bm.verts if abs(v.co.z) < 0.045 and abs(v.co.x - gx) > 0.04 and abs(v.co.x - sx) > 0.012]
print('bow grip x', round(gx, 3), 'string x', round(sx, 3), 'arrow verts', len(kill)); bmesh.ops.delete(bm, geom=kill, context='VERTS'); bm.to_mesh(bow.data); bm.free()
# the bow's string side: the string lies on one side of the limbs; turn it so the string is toward -X (Blender), the belly toward +X
P = np.array([v.co[:] for v in bow.data.vertices]); mid = P[np.abs(P[:, 2]) < 0.4]
print('bow x', P[:, 0].min(), P[:, 0].max(), 'y', P[:, 1].min(), P[:, 1].max())
for o in bpy.data.objects:
    if o.type != 'MESH': bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
print('WROTE', out)
