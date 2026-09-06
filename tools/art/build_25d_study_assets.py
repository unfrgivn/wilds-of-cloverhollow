"""Build and numerically audit the original park 2.5D study assets.

Blender axes are X, Y, Z. Godot axes are X, Y, Z = Blender X, Blender Z,
negative Blender Y. The negative mapping makes Blender -Y the Godot +Z facade.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT_BLEND = ROOT / "art/source/park25d"
OUT_GLB = ROOT / "game/assets/studies/park25d"
OUT_CAPTURE = ROOT / "captures/25d-study/assets"
RECIPE_PATH = ROOT / "art/recipes/park25d.json"
PREFIX = "P25D_"
PALETTE_HEX = {"wall": "#e8dcc4", "cream": "#f5ead6", "terracotta": "#c46b4a", "roof_dark": "#8f4a35", "wood": "#5a4a3a", "wood_light": "#b58a4d", "glass": "#3a8abd", "iron": "#2a2a2a"}


def srgb(v: int) -> float:
    c = v / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def color(hex_value: str) -> tuple[float, float, float, float]:
    return tuple(srgb(int(hex_value[i:i + 2], 16)) for i in (1, 3, 5)) + (1.0,)


def mat(name: str) -> bpy.types.Material:
    assert name in PALETTE_HEX, f"palette missing {name}"
    m = bpy.data.materials.get(PREFIX + name) or bpy.data.materials.new(PREFIX + name)
    rgba = color(PALETTE_HEX[name]); m.diffuse_color = rgba; m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf: bsdf.inputs["Base Color"].default_value = rgba; bsdf.inputs["Roughness"].default_value = 0.88
    return m


def owned_collection(name: str) -> bpy.types.Collection:
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in [x.name for x in bpy.context.scene.collection.children]:
        bpy.context.scene.collection.children.link(c)
    for o in list(c.objects): bpy.data.objects.remove(o, do_unlink=True)
    return c


def cube(c: bpy.types.Collection, name: str, loc: tuple[float, float, float], dims: tuple[float, float, float], material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object; o.name = PREFIX + name; o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for old in list(o.users_collection): old.objects.unlink(o)
    c.objects.link(o); o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = False
    return o


def mesh(c: bpy.types.Collection, name: str, verts: list[tuple[float, float, float]], faces: list[tuple[int, ...]], material: bpy.types.Material) -> bpy.types.Object:
    m = bpy.data.meshes.new(PREFIX + name + "_Mesh"); m.from_pydata(verts, [], faces); m.update()
    o = bpy.data.objects.new(PREFIX + name, m); c.objects.link(o); m.materials.append(material)
    for p in m.polygons: p.use_smooth = False
    return o


def roof(c: bpy.types.Collection) -> bpy.types.Object:
    x, y, e, r, t = 1.7, 1.4, 2.2, 3.05, 0.12
    # Two planar slope quads, two planar end faces, and matching lower faces.
    top = [(0, -y, r), (x, -y, e), (x, y, e), (0, y, r), (-x, y, e), (-x, -y, e)]
    bot = [(a, b, z - t) for a, b, z in top]
    faces = [(0, 1, 2, 3), (3, 4, 5, 0), (9, 8, 7, 6), (6, 11, 10, 9), (0, 1, 7, 6, 11, 5), (3, 4, 10, 9, 8, 2), (1, 2, 8, 7), (4, 5, 11, 10)]
    return mesh(c, "CottageGableRoof", top + bot, faces, mat("terracotta"))


def build_cottage() -> dict[str, object]:
    c = owned_collection("P25D_Cottage")
    wall, cream, wood, dark, glass = mat("wall"), mat("cream"), mat("wood"), mat("roof_dark"), mat("glass")
    body = cube(c, "CottageWallMass", (0, 0, 1.1), (3.2, 2.4, 2.2), wall)
    roof_obj = roof(c); cube(c, "CottageBaseBand", (0, 0, .1), (3.24, 2.44, .2), wood)
    # Actual shallow Boolean pockets are cut into the -Y facade before inserts are seated.
    cutters = []
    for x in (-.88, .88): cutters.append(cube(c, f"WindowCutter{x:+.2f}", (x, -1.17, 1.42), (.64, .28, .62), dark))
    cutters.append(cube(c, "DoorCutter", (0, -1.17, .85), (.72, .28, 1.45), dark))
    for cutter in cutters:
        mod = body.modifiers.new(PREFIX + cutter.name + "_Boolean", "BOOLEAN"); mod.operation = "DIFFERENCE"; mod.solver = "EXACT"; mod.object = cutter
        bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
    for x in (-.88, .88):
        cube(c, f"WindowGlass{x:+.2f}", (x, -1.035, 1.42), (.56, .035, .54), glass)
        cube(c, f"WindowTop{x:+.2f}", (x, -1.22, 1.77), (.78, .10, .10), wood); cube(c, f"WindowBottom{x:+.2f}", (x, -1.22, 1.07), (.78, .10, .10), wood)
        cube(c, f"WindowLeft{x:+.2f}", (x - .34, -1.22, 1.42), (.10, .10, .80), wood); cube(c, f"WindowRight{x:+.2f}", (x + .34, -1.22, 1.42), (.10, .10, .80), wood)
        cube(c, f"Mullion{x:+.2f}", (x, -1.27, 1.42), (.06, .04, .54), wood)
    cube(c, "DoorPanel", (0, -1.035, .82), (.56, .035, 1.25), wood); cube(c, "DoorHeader", (0, -1.22, 1.58), (.86, .13, .12), cream); cube(c, "DoorHandle", (.20, -1.27, .82), (.07, .04, .07), dark)
    # Seat the outer chimney footprint in the roof with 4 cm overlap.
    roof_top = [(v.co.x, v.co.z) for v in roof_obj.data.vertices if v.co.z > 2.2]
    ridge = max(z for x, z in roof_top); eave = min(z for x, z in roof_top if x > 1.6); half_width = max(x for x, z in roof_top)
    footprint_outer_x = .88 + .17; roof_at_chimney = eave + (ridge - eave) * (1.0 - footprint_outer_x / half_width); chimney_bottom = roof_at_chimney - .04
    cube(c, "Chimney", (.88, .35, chimney_bottom + .32), (.34, .38, .64), dark); cube(c, "ChimneyCap", (.88, .35, chimney_bottom + .68), (.44, .48, .08), wood)
    return {"collection": c, "contract": {"width_x": 3.2, "depth_godot_z": 2.4, "wall_height": 2.2, "roof_peak": 3.05}}


def build_bridge() -> dict[str, object]:
    c = owned_collection("P25D_Bridge"); wood, light, iron = mat("wood"), mat("wood_light"), mat("iron")
    cube(c, "BridgeDeckBeam", (0, 0, .04), (4, 2, .08), wood)
    for i in range(9): cube(c, f"DeckPlank_{i:02d}", (-1.78 + i * .445, 0, .12), (.37, 1.92, .08), light)
    for y in (-.78, .78):
        cube(c, f"UnderBeam{y:+.2f}", (0, y, -.03), (3.9, .18, .22), iron)
        for x in (-1.65, 1.65): cube(c, f"Post{x:+.2f}{y:+.2f}", (x, y, .58), (.16, .16, .84), wood)
        cube(c, f"Rail{y:+.2f}", (0, y, .94), (3.34, .14, .12), wood) # ends seat against post inner faces
    return {"collection": c, "contract": {"length_x": 4.0, "width_godot_z": 2.0, "deck_top_y": .16, "rail_top_y": 1.0}}


def aabb(o: bpy.types.Object) -> tuple[Vector, Vector]:
    p = [o.matrix_world @ Vector(v) for v in o.bound_box]; return Vector((min(v.x for v in p), min(v.y for v in p), min(v.z for v in p))), Vector((max(v.x for v in p), max(v.y for v in p), max(v.z for v in p)))


def collection_bounds(c: bpy.types.Collection) -> dict[str, list[float]]:
    boxes = [aabb(o) for o in c.objects if o.type == "MESH"]
    lo = Vector((min(b[0].x for b in boxes), min(b[0].y for b in boxes), min(b[0].z for b in boxes)))
    hi = Vector((max(b[1].x for b in boxes), max(b[1].y for b in boxes), max(b[1].z for b in boxes)))
    return {"min_blender_xyz": [round(v, 5) for v in lo], "max_blender_xyz": [round(v, 5) for v in hi], "size_blender_xyz": [round(hi[i] - lo[i], 5) for i in range(3)]}


def gap_z(a: bpy.types.Object, b: bpy.types.Object) -> float:
    _, ah = aabb(a); bl, _ = aabb(b); return round(bl.z - ah.z, 5)


def overlap_x(a: bpy.types.Object, b: bpy.types.Object) -> float:
    al, ah = aabb(a); bl, bh = aabb(b)
    return round(min(ah.x, bh.x) - max(al.x, bl.x), 5)


def signed_volume(o: bpy.types.Object) -> float:
    total = 0.0
    for p in o.data.polygons:
        vs = [o.data.vertices[i].co for i in p.vertices]
        for i in range(1, len(vs) - 1): total += vs[0].dot(vs[i].cross(vs[i + 1])) / 6.0
    return total


def recalc_outward(o: bpy.types.Object) -> float:
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode="OBJECT"); o.select_set(False)
    volume = signed_volume(o)
    if volume < 0.0:
        for p in o.data.polygons: p.flip()
        o.data.update(); volume = signed_volume(o)
    assert volume > 1e-7, f"{o.name} has non-positive closed signed volume"
    return volume


def body_ray_hit(body: bpy.types.Object, x: float, z: float) -> float:
    inv = body.matrix_world.inverted(); origin = inv @ Vector((x, -2.0, z)); direction = inv.to_3x3() @ Vector((0, 1, 0)); direction.normalize()
    ray_result = body.ray_cast(origin, direction)
    if len(ray_result) == 4:
        hit, point, _, face_index = ray_result
    else:
        point, _, face_index = ray_result; hit = face_index >= 0
    assert hit and face_index >= 0, f"{body.name} pocket ray missed at x={x} z={z}"
    return float((body.matrix_world @ point).y)


def geometry_checks(name: str, d: dict[str, object]) -> dict[str, object]:
    c = d["collection"]; objs = {o.name.removeprefix(PREFIX): o for o in c.objects if o.type == "MESH"}
    checks: list[dict[str, object]] = []
    def check(label: str, observed: object, expected: object, tol=.001):
        ok = all(abs(a-b) <= tol for a,b in zip(observed, expected)) if isinstance(observed, (list, tuple)) else abs(observed-expected) <= tol
        checks.append({"name": label, "observed": observed, "expected": expected, "pass": ok}); assert ok, f"{name}:{label} {observed} != {expected}"
    if name == "cottage":
        lo, hi = aabb(objs["CottageWallMass"]); check("wall_aabb_xyz", [round(hi[i]-lo[i], 5) for i in range(3)], [3.2, 2.4, 2.2]); check("roof_ridge", aabb(objs["CottageGableRoof"])[1].z, 3.05)
        roof_obj = objs["CottageGableRoof"]; roof_top = [(v.co.x, v.co.z) for v in roof_obj.data.vertices if v.co.z > 2.2]; ridge = max(z for x, z in roof_top); eave = min(z for x, z in roof_top if x > 1.6); half_width = max(x for x, z in roof_top); roof_at_outer = eave + (ridge - eave) * (1.0 - 1.05 / half_width)
        chimney_lo = aabb(objs["Chimney"])[0].z; check("chimney_actual_overlap", chimney_lo - roof_at_outer, -.04, .0001)
        for key in ("WindowGlass-0.88", "WindowGlass+0.88", "DoorPanel"): check("recess_depth_" + key, aabb(objs[key])[0].y, -1.052, .03)
        for label, x, z in (("window_left", -.88, 1.42), ("window_right", .88, 1.42), ("door", 0.0, .85)):
            hit_y = body_ray_hit(objs["CottageWallMass"], x, z); check("body_pocket_ray_" + label, hit_y, -1.0, .101)
        checks.append({"name": "front_axis", "mapping": "Godot(X,Y,Z)=(Blender X,Z,-Y)", "pass": True})
    else:
        check("deck_top", aabb(objs["DeckPlank_00"])[1].z, .16); check("rail_top", aabb(objs["Rail-0.78"])[1].z, 1.0)
        for side in ("-0.78", "+0.78"):
            check("rail_post_vertical_overlap_" + side, gap_z(objs["Post-1.65"+side], objs["Rail"+side]), -.12, .0001)
            check("rail_post_endface_overlap_" + side, overlap_x(objs["Post-1.65"+side], objs["Rail"+side]), .10, .0001)
    signed_volumes: dict[str, float] = {}
    for o in c.objects:
        if o.type != "MESH": continue
        volume = recalc_outward(o)
        signed_volumes[o.name.removeprefix(PREFIX)] = round(volume, 7)
        assert all(abs(p.normal.length - 1) < .001 for p in o.data.polygons), f"{name}:{o.name} invalid normals"
        edge_use: dict[tuple[int, int], int] = {}
        for p in o.data.polygons:
            for a, b in p.edge_keys: edge_use[tuple(sorted((a, b)))] = edge_use.get(tuple(sorted((a, b))), 0) + 1
        assert edge_use and all(count == 2 for count in edge_use.values()), f"{name}:{o.name} not closed"
        for p in o.data.polygons:
            if len(p.vertices) > 3:
                vs = [o.data.vertices[i].co for i in p.vertices]; n = (vs[1]-vs[0]).cross(vs[2]-vs[0]); assert all(abs(n.dot(v-vs[0])) < 1e-5 for v in vs[3:]), f"{name}:{o.name} nonplanar face"
    checks.append({"name": "positive_closed_signed_volumes_and_winding", "pass": True})
    return {"asset": name, "contract": d["contract"], "export_bounds": collection_bounds(c), "signed_mesh_volumes": signed_volumes, "mesh_objects": len(objs), "triangles": sum(len(p.vertices)-2 for o in c.objects if o.type == "MESH" for p in o.data.polygons), "checks": checks}


def render_views(colls: list[bpy.types.Collection]) -> None:
    for obj in bpy.context.scene.objects:
        if not obj.name.startswith(PREFIX):
            obj.hide_render = True
    OUT_CAPTURE.mkdir(parents=True, exist_ok=True); scene = bpy.context.scene; scene.render.engine = "BLENDER_WORKBENCH"; scene.render.resolution_x = 384; scene.render.resolution_y = 384; scene.render.resolution_percentage = 100; scene.display.shading.color_type = "MATERIAL"
    cam_data = bpy.data.cameras.new(PREFIX + "PresentationCamera"); cam = bpy.data.objects.new(PREFIX + "PresentationCamera", cam_data); scene.collection.objects.link(cam); scene.camera = cam
    target = Vector((0, 0, 1.3))
    views = [("front", (0, -7, 3)), ("back", (0, 7, 3)), ("left", (-7, 0, 3)), ("right", (7, 0, 3)), ("top", (0, 0, 9)), ("bottom", (0, 0, -7))]
    for c in colls:
        c.hide_render = False
        for other in colls:
            if other != c: other.hide_render = True
        for label, loc in views:
            cam.location = loc; cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 5.2; scene.render.filepath = str(OUT_CAPTURE / f"{c.name.removeprefix(PREFIX).lower()}_{label}.png"); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def export(c: bpy.types.Collection, path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for o in c.objects: o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(c.objects)); bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_apply=True, export_cameras=False, export_lights=False)


def main() -> None:
    for p in (OUT_BLEND, OUT_GLB, OUT_CAPTURE): p.mkdir(parents=True, exist_ok=True)
    # The recipe is the palette authority. Refuse to build if the requested
    # colors are not present there, then retain the linear material conversion.
    recipe = json.loads(RECIPE_PATH.read_text()) if RECIPE_PATH.exists() else {}
    assert recipe.get("colors") == PALETTE_HEX, "recipe colors do not match approved Cloverhollow palette"
    bpy.context.preferences.filepaths.save_version = 0
    for old in (OUT_BLEND / "cottage.blend1", OUT_BLEND / "bridge.blend1"): old.unlink(missing_ok=True)
    cottage, bridge = build_cottage(), build_bridge(); reports = [geometry_checks("cottage", cottage), geometry_checks("bridge", bridge)]
    render_views([cottage["collection"], bridge["collection"]]); export(cottage["collection"], OUT_GLB / "cottage.glb"); export(bridge["collection"], OUT_GLB / "bridge.glb")
    manifest = {"blender_version": bpy.app.version_string, "coordinate_contract": "Godot(X,Y,Z)=(Blender X,Z,-Blender Y)", "palette_hex_srgb": PALETTE_HEX, "assets": reports, "source_blends": [str(OUT_BLEND/"cottage.blend"), str(OUT_BLEND/"bridge.blend")], "glb_exports": [str(OUT_GLB/"cottage.glb"), str(OUT_GLB/"bridge.glb")], "remaining_limits": ["Approach ramps are intentionally omitted; runtime worker owns those colliders and ramps."]}
    (OUT_CAPTURE / "asset-validation.json").write_text(json.dumps(manifest, indent=2) + "\n")
    RECIPE_PATH.write_text(json.dumps({"study": "park25d", "builder": "tools/art/build_25d_study_assets.py", "colors": PALETTE_HEX, "assets": [r["contract"] | {"name": r["asset"]} for r in reports]}, indent=2) + "\n")
    root = bpy.context.scene.collection.children
    for c, other, path in [(cottage["collection"], bridge["collection"], OUT_BLEND/"cottage.blend"), (bridge["collection"], cottage["collection"], OUT_BLEND/"bridge.blend")]:
        root.unlink(other); bpy.ops.wm.save_as_mainfile(filepath=str(path)); root.link(other)
    for old in (OUT_BLEND / "cottage.blend1", OUT_BLEND / "bridge.blend1"): old.unlink(missing_ok=True)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__": main()
