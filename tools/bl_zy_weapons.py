# Zhao Yun's weapons from Meshy (Meshy 7.5 from the GPT weapon sheet, one generation each, remeshed in Meshy to ~4-5k triangles):
# the spear, the bow and the quiver as hero weapons — each a top-level node, its axis along +Y (glTF), the grip at the origin — sharing
# one material: the three texture sets packed into one atlas (a quarter each), so he draws them with one material and three textures.
#  - spear: Meshy got the "short spear" (the middle of the shaft cut out of the picture, so the long thin shaft could not bend or lean);
#    its axis found and set upright, then everything below a cut in the shaft moved back down by the length cut out of the picture —
#    the shaft's long faces stretch across the gap, a straight navy shaft. The grip 40% of the way up from the butt.
#  - bow: its string was too thin for the remesh (stubs left): a new one, a thin 6-sided rod from nock to nock. The grip at its middle.
#  - quiver: upright, the arrows up; its origin at its middle.
# Usage: python3 tools/bl_zy_weapons.py -- <spear.glb> <bow.glb> <quiver.glb> <out.glb>   (Blender as a Python module)
import bpy, sys, os, numpy as np, bmesh
from mathutils import Vector, Matrix
from PIL import Image
argv = sys.argv[sys.argv.index('--') + 1:]
SPEAR, BOW, QUIVER, OUT = argv[:4]
TMP = os.path.join(os.path.dirname(os.path.abspath(OUT)), 'zyweap_tex'); os.makedirs(TMP, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def load(path, name):
    objs0 = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in objs0]; me = [o for o in new if o.type == 'MESH'][0]
    me.parent = None; bpy.ops.object.select_all(action='DESELECT'); me.select_set(True); bpy.context.view_layer.objects.active = me
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o is not me: bpy.data.objects.remove(o, do_unlink=True)
    me.name = me.data.name = name
    # its three maps, saved out: base colour, metal / rough, normal (found by what they feed in Meshy's material)
    mat = me.data.materials[0]; nt = mat.node_tree; maps = {}
    for n in nt.nodes:
        if n.type != 'TEX_IMAGE' or not n.image: continue
        to = [l.to_node for l in n.outputs['Color'].links]; kinds = [t.type for t in to]
        k = 'normal' if 'NORMAL_MAP' in kinds else 'base' if any(t.type == 'BSDF_PRINCIPLED' and l.to_socket.name == 'Base Color' for l in n.outputs['Color'].links for t in [l.to_node]) else 'mr'
        p = os.path.join(TMP, f'{name}_{k}.png'); n.image.filepath_raw = p; n.image.file_format = 'PNG'; n.image.save(); maps[k] = p
    print(name, 'maps', sorted(maps), 'tris', len(me.data.polygons)); return me, maps

def shift(me, d):
    me.data.transform(Matrix.Translation(Vector(d)))

def axis_center(me, z0, z1):  # the median x, y of the vertices in a height band: where the axis passes
    P = np.array([v.co[:] for v in me.data.vertices]); m = (P[:, 2] > z0) & (P[:, 2] < z1)
    return float(np.median(P[m, 0])), float(np.median(P[m, 1]))

# ---- spear ----
spear, smaps = load(SPEAR, 'spear')
Z = np.array([v.co.z for v in spear.data.vertices]); zt, zb = Z.max(), Z.min(); L0 = zt - zb
# the axis: the blade's tip and the butt cap line up (measured: the model stands straight); put it on x = y = 0
cx1, cy1 = axis_center(spear, zt - 0.12 * L0, zt); cx0, cy0 = axis_center(spear, zb, zb + 0.12 * L0); cx, cy = (cx0 + cx1) / 2, (cy0 + cy1) / 2
print('spear axis top', round(cx1, 3), round(cy1, 3), 'bottom', round(cx0, 3), round(cy0, 3))
shift(spear, (-cx, -cy, 0))
# the picture: head and the shaft's top 505 px of the sheet's spear, then its butt 212 px; 280 px of shaft were cut out between them
JOIN, CUT_PX, SHORT_PX = 505 / 717, 280, 717
zj = zt - JOIN * L0; ext = CUT_PX / SHORT_PX * L0
for v in spear.data.vertices:
    if v.co.z < zj: v.co.z -= ext
# straighten the shaft between the collars onto the axis (it sits a hair off in places)
total = L0 + ext; zb2 = zb - ext; print('spear length', round(total, 3), 'join at', round(zj, 3), 'shaft added', round(ext, 3))
grip = zb2 + 0.40 * total; shift(spear, (0, 0, -grip))

# ---- bow ----
bow, bmaps = load(BOW, 'bow')
P = np.array([v.co[:] for v in bow.data.vertices]); zc = (P[:, 2].max() + P[:, 2].min()) / 2
# the string: its stubs stand furthest out on +x, beside the grip's height band
S = P[(P[:, 0] > P[:, 0].max() - 0.03) & (np.abs(P[:, 2] - zc) < 0.6)]
sx, sy = float(np.median(S[:, 0])), float(np.median(S[:, 1]))
# the nocks: where the limbs come back out to the string's line, high and low
ends = P[np.abs(P[:, 0] - sx) < 0.012]; ztop, zbot = float(ends[:, 2].max()), float(ends[:, 2].min())
# it ends where the limb tips are; pull them in to the last few cm the limbs reach toward the string
print('bow string x', round(sx, 3), 'from', round(zbot, 3), 'to', round(ztop, 3))
bm = bmesh.new(); bm.from_mesh(bow.data); uvl = bm.loops.layers.uv.active
# the string's colour: the UV of the stub vertex nearest the string's middle
best = None
for f in bm.faces:
    for l in f.loops:
        d = abs(l.vert.co.x - sx) + abs(l.vert.co.z - zc) * 0.2
        if best is None or d < best[0]: best = (d, l[uvl].uv.copy())
suv = best[1]; R, N = 0.0035, 6
top = [bm.verts.new((sx + R * np.cos(a), sy + R * np.sin(a), ztop - 0.02)) for a in np.linspace(0, 2 * np.pi, N, endpoint=False)]
bot = [bm.verts.new((sx + R * np.cos(a), sy + R * np.sin(a), zbot + 0.02)) for a in np.linspace(0, 2 * np.pi, N, endpoint=False)]
for i in range(N):
    f = bm.faces.new((bot[i], bot[(i + 1) % N], top[(i + 1) % N], top[i]))
    for l in f.loops: l[uvl].uv = suv
bm.to_mesh(bow.data); bm.free()
shift(bow, (0, 0, -zc))

# ---- quiver ----
quiver, qmaps = load(QUIVER, 'quiver')
P = np.array([v.co[:] for v in quiver.data.vertices]); shift(quiver, (-(P[:, 0].max() + P[:, 0].min()) / 2, -(P[:, 1].max() + P[:, 1].min()) / 2, -(P[:, 2].max() + P[:, 2].min()) / 2))

# ---- one atlas: spear top-left, bow top-right, quiver bottom-left (UV space: v up) ----
SLOT = {'spear': (0.0, 0.5), 'bow': (0.5, 0.5), 'quiver': (0.0, 0.0)}
A = 2048; H = A // 2
for kind in ['base', 'mr', 'normal']:
    bg = (128, 128, 255) if kind == 'normal' else (0, 0, 0)
    at = Image.new('RGB', (A, A), bg)
    for name, maps in [('spear', smaps), ('bow', bmaps), ('quiver', qmaps)]:
        im = Image.open(maps[kind]).convert('RGB').resize((H, H), Image.LANCZOS); ox, oy = SLOT[name]
        at.paste(im, (int(ox * A), int((1 - oy - 0.5) * A)))
    at.save(os.path.join(TMP, f'atlas_{kind}.png'))
for me in [spear, bow, quiver]:
    ox, oy = SLOT[me.name]; uv = me.data.uv_layers.active.data
    for d in uv: d.uv = (d.uv[0] * 0.5 + ox, d.uv[1] * 0.5 + oy)

mat = bpy.data.materials.new('zy_weapons'); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
def tex(kind, cs):
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(os.path.join(TMP, f'atlas_{kind}.png')); n.image.colorspace_settings.name = cs; return n
b = tex('base', 'sRGB'); nt.links.new(b.outputs['Color'], bsdf.inputs['Base Color'])
m = tex('mr', 'Non-Color'); sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(m.outputs['Color'], sep.inputs['Color'])
nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
n = tex('normal', 'Non-Color'); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
for me in [spear, bow, quiver]:
    me.data.materials.clear(); me.data.materials.append(mat); me.location = (0, 0, 0)
for o in list(bpy.data.objects):
    if o.type != 'MESH' or o.name not in ('spear', 'bow', 'quiver'): bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.data.objects: print(o.name, 'tris', len(o.data.polygons), 'z', round(min(v.co.z for v in o.data.vertices), 3), round(max(v.co.z for v in o.data.vertices), 3))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_yup=True)
print('WROTE', OUT)
