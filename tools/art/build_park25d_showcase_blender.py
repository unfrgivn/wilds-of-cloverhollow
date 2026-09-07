"""Textured hero variants, isolated from M229 outputs.

blender --background --factory-startup --python tools/art/build_park25d_showcase_blender.py
Reuses M229 construction/audit functions, never its main() or output writer.
Blender -Y is the Godot +Z facade. All coordinates below are Blender coordinates.
"""
from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "game/assets/studies/park25d/showcase"
SOURCE = ROOT / "art/source/park25d_showcase"
EVIDENCE = ROOT / "captures/m230/assets"
PREFIX = "CB230_"
RECIPE = json.loads((ROOT / "art/recipes/park25d_showcase.json").read_text())
spec = importlib.util.spec_from_file_location("study_geometry", ROOT / "tools/art/build_25d_study_assets.py")
assert spec and spec.loader
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
geometry.PREFIX = PREFIX
geometry.OUT_CAPTURE = EVIDENCE / "solid"


def material(name: str) -> bpy.types.Material:
    """Embedded original images, UV repeat, nearest texels, palette sRGB values."""
    found = bpy.data.materials.get(PREFIX + name)
    if found:
        return found
    tones = {"wall":"cream", "cream":"cream_light", "wood":"wood_mid",
             "wood_light":"wood_light", "roof_dark":"stone", "terracotta":"roof",
             "glass":"water", "iron":"iron", "leaves":"leaf_mid", "leaves_light":"leaf_light",
             "flower":"pink", "flower_gold":"yellow"}
    textures = {"wall":"plaster", "wood":"wood", "wood_light":"wood", "roof_dark":"stone", "terracotta":"roof"}
    m = bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    rgba = geometry.color(RECIPE["colors"][tones[name]])
    m.diffuse_color = rgba
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    assert bsdf
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if name in textures:
        texture_path = OUT / f"{textures[name]}.png"
        if not texture_path.is_file():
            raise FileNotFoundError(
                f"required showcase texture is missing: {texture_path}; "
                "run the PNG art pass before exporting the GLB"
            )
        texture = m.node_tree.nodes.new("ShaderNodeTexImage")
        image = bpy.data.images.load(str(texture_path), check_existing=True)
        image.pack()
        texture.image = image
        texture.interpolation = "Closest"
        texture.extension = "REPEAT"
        m.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    return m


geometry.mat = material


def block(collection: bpy.types.Collection, name: str, center: tuple[float, float, float],
          size: tuple[float, float, float], tone: str) -> bpy.types.Object:
    return geometry.cube(collection, name, center, size, material(tone))


def beam(collection: bpy.types.Collection, name: str, start: Vector, end: Vector,
         thickness: float, tone: str) -> bpy.types.Object:
    obj = block(collection, name, tuple((start + end) / 2), (thickness, thickness, (end-start).length), tone)
    obj.rotation_euler = (end-start).to_track_quat("Z", "Y").to_euler()
    return obj


def gable(collection: bpy.types.Collection) -> bpy.types.Object:
    # Underside equation: z=2.93-0.5*abs(x). Bottom seats on body z=2.2.
    half = (3.05 - .12 - 2.2) / .5
    vertices = [(-half,-1.2,2.2),(half,-1.2,2.2),(0,-1.2,2.93),
                (-half,1.2,2.2),(half,1.2,2.2),(0,1.2,2.93)]
    return geometry.mesh(collection, "GableInfill", vertices,
                         [(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)], material("wall"))


def planter(collection: bpy.types.Collection, name: str, x: float, y: float, z: float) -> None:
    """Open wooden planter with seated soil and broad pointed leaves, no spheres."""
    block(collection, name+"Bottom", (x,y,z), (.78,.27,.07), "wood")
    for side in (-1,1):
        block(collection, name+f"End{side}", (x+side*.365,y,z+.10), (.05,.27,.20), "wood")
        block(collection, name+f"Face{side}", (x,y+side*.11,z+.10), (.70,.05,.20), "wood_light")
    block(collection, name+"Soil", (x,y,z+.08), (.68,.16,.09), "iron")
    # Every blade is a closed pointed four-sided leaf sharing its base plane with soil.
    for i in range(5):
        px = x - .28 + i*.14
        bottom, top = z+.10, z+.30+(i%2)*.08
        for side in (-1,1):
            profile = [(-.025,0),(.025,0),(.065,.6),(0,1),(-.06,.65)]
            verts = [(px+dx,y+side*.17*f,bottom+(top-bottom)*f) for dx,f in profile]
            vertices = verts + [(a,b+.015,c) for a,b,c in verts]
            faces = [(0,1,2,3,4),(9,8,7,6,5)] + [(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)]
            # Triangulate concave planar caps for an unambiguous game export.
            leaf = geometry.mesh(collection, name+f"Leaf{i}_{side}", vertices, faces,
                                 material("leaves" if side==1 else "leaves_light"))
            mod = leaf.modifiers.new("LeafTriangles", "TRIANGULATE")
            bpy.context.view_layer.objects.active = leaf
            bpy.ops.object.modifier_apply(modifier=mod.name)
        block(collection, name+f"Bloom{i}", (px,y-.12,top), (.08,.06,.06), "flower" if i%2 else "flower_gold")


def build_cottage() -> dict[str, object]:
    built = geometry.build_cottage()
    c = built["collection"]
    gable(c)
    print("Cottage body/pockets retained; gable lower face anchored at measured wall top 2.2.")
    for side in (-1,1):
        y = side*1.24
        beam(c, f"GableRafterLeft{side}", Vector((-1.52,y,2.20)), Vector((0,y,2.96)), .075, "wood")
        beam(c, f"GableRafterRight{side}", Vector((0,y,2.96)), Vector((1.52,y,2.20)), .075, "wood")
        block(c, f"GableTie{side}", (0,y,2.20), (3.2,.09,.10), "wood")
        block(c, f"GableKingpost{side}", (0,y,2.53), (.085,.08,.63), "wood")
    for x in (-1.56,1.56):
        for y in (-1.20,1.20):
            block(c, f"CornerTimber{x}_{y}", (x,y,1.20), (.10,.10,1.97), "wood")
    # Roof bands run parallel to the ridge and sit 1 cm above the measured slope.
    for side in (-1,1):
        for i in range(1,6):
            x = side * i*.27
            z = 3.05 - abs(x)*.5
            strip = block(c, f"ShingleCourse{side}_{i}", (x,0,z+.005), (.036,2.76,.025), "terracotta")
            strip.rotation_euler.y = side*math.atan(.5)
        block(c, f"EaveFascia{side}", (side*1.68,0,2.15), (.08,2.80,.13), "wood")
    for x in (-.88,.88):
        block(c, f"CrossMullion{x}", (x,-1.27,1.42), (.56,.04,.045), "cream")
        # The existing vertical mullion plus this horizontal bar divides four panes.
        for dx in (-.47,.47):
            block(c, f"Shutter{x}_{dx}", (x+dx,-1.235,1.42), (.16,.065,.62), "wood_light")
            for zz in (1.19,1.64):
                block(c, f"ShutterStrap{x}_{dx}_{zz}", (x+dx,-1.275,zz), (.15,.025,.028), "iron")
        planter(c, f"Windowbox{x}", x,-1.325,.91)
    # Door frame returns meet the existing cut; threshold remains within eave bounds.
    for x in (-.35,.35):
        block(c, f"DoorJamb{x}", (x,-1.18,.86), (.07,.14,1.43), "wood_light")
    block(c, "StoneThreshold", (0,-1.285,.13), (.86,.34,.10), "roof_dark")
    for z in (.38,1.24):
        block(c, f"DoorStrap{z}", (0,-1.066,z), (.55,.025,.055), "iron")
    # Side service window is a real shallow pocket in the original wall mass.
    body = bpy.data.objects[PREFIX+"CottageWallMass"]
    cutter = block(c, "SideWindowCutter", (1.56,0,1.4), (.3,.74,.70), "iron")
    mod = body.modifiers.new("SideWindowPocket", "BOOLEAN")
    mod.operation, mod.solver, mod.object = "DIFFERENCE", "EXACT", cutter
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    block(c, "SideGlass", (1.425,0,1.4), (.04,.64,.60), "glass")
    for y in (-.37,.37):
        block(c, f"SideJamb{y}", (1.6,y,1.4), (.10,.08,.84), "wood")
    for z in (1.01,1.79):
        block(c, f"SideHeader{z}", (1.6,0,z), (.10,.80,.08), "wood")
    block(c, "SideMullionV", (1.53,0,1.4), (.05,.045,.64), "cream")
    block(c, "SideMullionH", (1.53,0,1.4), (.05,.65,.045), "cream")
    return built


def build_bridge() -> dict[str, object]:
    built = geometry.build_bridge()
    c = built["collection"]
    # Denser actual boards, each seated on the original supporting deck beam.
    for obj in list(c.objects):
        if "DeckPlank_" in obj.name:
            bpy.data.objects.remove(obj, do_unlink=True)
    for i in range(16):
        x = -1.875 + i*.25
        block(c, f"DeckPlank_{i:02}", (x,0,.12), (.235,1.92,.08), "wood_light")
        for y in (-.72,.72):
            block(c, f"Peg{i}_{y}", (x,y,.161), (.04,.045,.006), "iron")
    for y in (-.78,.78):
        block(c, f"LowerRail{y}", (0,y,.48), (3.34,.09,.07), "wood")
        for x in (-1.65,1.65):
            block(c, f"PostCollar{x}_{y}", (x,y,.84), (.18,.18,.05), "wood_light")
            block(c, f"PostPin{x}_{y}", (x,y-.095,.85), (.04,.02,.04), "iron")
    for x in (-1.90,1.90):
        block(c, f"StoneAbutment{x}", (x,0,-.16), (.20,2,.32), "roof_dark")
    return built


def apply_uv(obj: bpy.types.Object) -> None:
    """Planar faces get metric UVs at 20 texels/m; grain follows beam length."""
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name="MetricPixels")
    density = RECIPE["texels_per_meter"] / 32
    for face in obj.data.polygons:
        normal = face.normal
        dominant = max(range(3), key=lambda axis: abs(normal[axis]))
        axes = [axis for axis in range(3) if axis != dominant]
        if obj.data.materials and obj.data.materials[0].name in (PREFIX+"wood", PREFIX+"wood_light"):
            longest = max(axes, key=lambda axis: obj.dimensions[axis])
            axes = [axis for axis in axes if axis != longest] + [longest]
        for loop_index in face.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            if "GableRoof" in obj.name and abs(normal.z) > .5:
                coords = (vertex.y, vertex.x * math.sqrt(1.25))
            else:
                coords = (vertex[axes[0]],vertex[axes[1]])
            uv.data[loop_index].uv = (coords[0]*density,coords[1]*density)


def extra_checks(c: bpy.types.Collection, name: str) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    def measure(label: str, actual: float, expected: float) -> None:
        passed = abs(actual-expected) < .001
        result.append({"name":label,"actual":round(actual,6),"expected":expected,"pass":passed})
        assert passed, f"{label}: {actual} != {expected}"
    def overlap_z(a: bpy.types.Object, b: bpy.types.Object) -> float:
        al, ah = geometry.aabb(a)
        bl, bh = geometry.aabb(b)
        return min(ah.z, bh.z) - max(al.z, bl.z)
    objects = {o.name.removeprefix(PREFIX):o for o in c.objects}
    if name == "cottage":
        body, infill = objects["CottageWallMass"], objects["GableInfill"]
        measure("gable_seats_on_body", geometry.gap_z(body,infill), 0)
        roof = objects["CottageGableRoof"]
        top = max(v.co.z for v in roof.data.vertices)
        thickness = max(v.co.z for v in roof.data.vertices) - sorted(set(round(v.co.z,5) for v in roof.data.vertices))[-2]
        measure("gable_ridge_to_roof_underside", geometry.aabb(infill)[1].z-(top-thickness), 0)
        measure("side_window_recess", 1.6-geometry.aabb(objects["SideGlass"])[1].x, .155)
        roof = objects["CottageGableRoof"]
        roof_at_chimney = 2.2 + (3.05 - 2.2) * (1.0 - 1.05 / 1.7)
        measure("chimney_roof_overlap", roof_at_chimney-geometry.aabb(objects["Chimney"])[0].z, .04)
        for x in (-.88,.88):
            measure(f"windowbox_back_overlaps_facade_{x}", geometry.aabb(objects[f"Windowbox{x}Face1"])[1].y+1.2, .01)
    else:
        measure("abutment_deck_contact", geometry.aabb(objects["BridgeDeckBeam"])[0].z-geometry.aabb(objects["StoneAbutment1.9"])[1].z, 0)
        for i in range(16):
            measure(f"board_beam_contact_{i}", geometry.gap_z(objects["BridgeDeckBeam"],objects[f"DeckPlank_{i:02}"]), 0)
        for y in (-.78,.78):
            post = objects[f"Post-1.65{y:+.2f}"]
            for rail_name, expected_overlap in ((f"Rail{y:+.2f}", .10), (f"LowerRail{y}", .10)):
                rail = objects[rail_name]
                measure(f"{rail_name}_post_vertical_contact", overlap_z(post, rail), .12 if rail_name.startswith("Rail") else .07)
                measure(f"{rail_name}_post_endface_contact", geometry.overlap_x(post, rail), expected_overlap)
        # No coincident railing geometry: distinct centers and bounds are required.
        rails = [o for o in c.objects if "Rail" in o.name]
        signatures = [tuple(round(v,5) for corner in geometry.aabb(o) for v in corner) for o in rails]
        assert len(signatures) == len(set(signatures)) == 4
    return result


def render_textured(collections: list[bpy.types.Collection]) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.resolution_x = 384
    scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    scene.world.color = (.25,.25,.25)
    camera_data = bpy.data.cameras.new(PREFIX+"ReviewCamera")
    camera = bpy.data.objects.new(PREFIX+"ReviewCamera",camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type, camera_data.ortho_scale = "ORTHO", 5.0
    light_data = bpy.data.lights.new(PREFIX+"ReviewSun","SUN")
    light_data.energy = 2.0
    light = bpy.data.objects.new(PREFIX+"ReviewSun",light_data)
    scene.collection.objects.link(light)
    light.rotation_euler = (.5,-.4,-.5)
    scene.render.film_transparent = True
    for collection in collections:
        for other in collections:
            other.hide_render = other != collection
        target = Vector((0,0,1.4 if "Cottage" in collection.name else .35))
        views = {
            "front": (0,-7,3),
            "side": (7,0,3),
            "top": (0,0,9),
        }
        for label, location in views.items():
            camera.location = location
            camera.rotation_euler = (target-camera.location).to_track_quat("-Z","Y").to_euler()
            scene.render.filepath = str(EVIDENCE / f"{collection.name.removeprefix(PREFIX).lower()}_textured_{label}.png")
            bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera,do_unlink=True)
    bpy.data.objects.remove(light,do_unlink=True)


def main() -> None:
    for directory in (OUT,SOURCE,EVIDENCE):
        directory.mkdir(parents=True,exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    cottage, bridge = build_cottage(), build_bridge()
    bpy.context.view_layer.update()
    reports = []
    for name, built in (("cottage",cottage),("bridge",bridge)):
        collection = built["collection"]
        for obj in collection.objects:
            if obj.type == "MESH":
                apply_uv(obj)
                assert obj.data.uv_layers.active and len(obj.data.uv_layers.active.data) == len(obj.data.loops), f"{obj.name} missing complete UVs"
        report = geometry.geometry_checks(name,built)
        report["checks"].extend(extra_checks(collection,name))
        reports.append(report)
    collections = [cottage["collection"],bridge["collection"]]
    # Six orthographic solid views are anatomy evidence, not in-game acceptance.
    geometry.render_views(collections)
    render_textured(collections)
    for name,built in (("cottage",cottage),("bridge",bridge)):
        collection = built["collection"]
        collection.hide_render = False
        # One named root, transforms preserve world coordinates.
        root = bpy.data.objects.new(PREFIX+name.title(),None)
        collection.objects.link(root)
        for obj in collection.objects:
            if obj != root:
                obj.parent = root
        geometry.export(collection,OUT/f"{name}.glb")
    root_collections = bpy.context.scene.collection.children
    for name,built,other in (("cottage",cottage,bridge),("bridge",bridge,cottage)):
        root_collections.unlink(other["collection"])
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/f"{name}.blend"))
        root_collections.link(other["collection"])
    (EVIDENCE/"model-validation.json").write_text(json.dumps({"blender":bpy.app.version_string,"texels_per_meter":20,"assets":reports},indent=2)+"\n")
    print("SHOWCASE_EXPORTED", json.dumps([r["export_bounds"] for r in reports]))


if __name__ == "__main__":
    main()
