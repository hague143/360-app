"""Convert only the reviewed user-supplied model, with Blender autoexec disabled.

blender --background --factory-startup --disable-autoexec \
  --python scripts/prepare-agera.py -- source.blend output.glb
"""
import hashlib
import pathlib
import sys

import bmesh
import bpy
from mathutils import Vector

arguments = sys.argv[sys.argv.index('--') + 1:]
assert len(arguments) == 2, 'Pass input .blend and output .glb after --'
source, target = map(pathlib.Path, arguments)
expected = 'dd062fe51aa78a08fb4498413965488c03b6f603cbe268a49b975ce0aea8da02'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected, (
    'This reviewed conversion applies only to the supplied Koenigsegg asset.'
)
target.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
assert {obj.name for obj in meshes} == {'Body', 'FR', 'FL', 'RL', 'RR'}

# Three isolated, tiny triangles lie far outside the actual car. Their nine
# vertices inflate framing from 18.7 to 35.4 source units. No car surfaces move.
for obj in meshes:
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    stray = [face for face in mesh.faces
             if all((obj.matrix_world @ vertex.co).x > 12 for vertex in face.verts)
             and face.calc_area() < .01]
    assert len(stray) == (3 if obj.name == 'Body' else 0)
    if stray:
        bmesh.ops.delete(mesh, geom=stray, context='FACES')
    loose = [vertex for vertex in mesh.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(mesh, geom=loose, context='VERTS')
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()

# Legacy node shaders do not export uniformly; use explicit portable PBR.
# There are no texture image files in the upload. Body finish is pearl white.
materials = {
    'Car Texture': ((.78, .79, .82, 1), .48, .24),
    'Carbon': ((.018, .020, .025, 1), .35, .35),
    'Carbon.001': ((.018, .020, .024, 1), .25, .39),
    'Carbon.002': ((.025, .028, .034, 1), .45, .32),
    'Carbon.003': ((.018, .020, .026, 1), .35, .40),
    'Window Glass': ((.038, .071, .096, 1), .55, .13),
    'Rear Lights': ((.42, .005, .02, 1), .15, .25),
}
for material in bpy.data.materials:
    if material.name not in materials:
        continue
    colour, metalness, roughness = materials[material.name]
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value = colour
    shader.inputs['Metallic'].default_value = metalness
    shader.inputs['Roughness'].default_value = roughness
    if material.name == 'Car Texture':
        shader.inputs['Coat Weight'].default_value = .7
    if material.name == 'Rear Lights':
        shader.inputs['Emission Color'].default_value = colour
        shader.inputs['Emission Strength'].default_value = .35
    material.node_tree.links.new(shader.outputs['BSDF'], output.inputs['Surface'])

bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.export_scene.gltf(
    filepath=str(target), export_format='GLB', use_selection=True,
    export_apply=True, export_animations=False, export_cameras=False,
    export_lights=False, export_extras=False, export_yup=True,
    export_materials='EXPORT',
)
print('Converted GLB:', target.stat().st_size, 'bytes')
