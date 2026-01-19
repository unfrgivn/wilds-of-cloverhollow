@tool
extends SceneTree

func _init():
	var args = OS.get_cmdline_user_args()
	var recipe_path = ""
	
	# Parse args manually since we are in --script mode
	for i in range(args.size()):
		if args[i] == "--recipe" and i + 1 < args.size():
			recipe_path = args[i+1]
			
	if recipe_path == "":
		print("Error: --recipe argument required")
		quit(1)
		return

	generate_prop(recipe_path)
	quit(0)

func generate_prop(recipe_path):
	var file = FileAccess.open(recipe_path, FileAccess.READ)
	if not file:
		print("Error: Could not open recipe file: " + recipe_path)
		quit(1)
		return
		
	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	if error != OK:
		print("Error: JSON Parse Error: ", json.get_error_message(), " in ", recipe_path, " at line ", json.get_error_line())
		quit(1)
		return
		
	var data = json.data
	var prop_id = data.get("id", "unknown")
	
	# Load palette (hardcoded for now as per task context, or could be arg)
	var palette = load_palette("res://art/palettes/cloverhollow.palette.json")
	
	var root = Node3D.new()
	root.name = prop_id
	
	if data.has("parts"):
		for part in data["parts"]:
			var node = create_part(part, palette)
			if node:
				root.add_child(node)
				node.owner = root
				
				# Set position
				if part.has("pos"):
					var p = part["pos"]
					node.position = Vector3(p[0], p[1], p[2])
				
				# Set rotation (degrees)
				if part.has("rot"):
					var r = part["rot"]
					node.rotation_degrees = Vector3(r[0], r[1], r[2])
					
				# Set scale (if not handled by specific shape params)
				if part.has("scale"):
					var s = part["scale"]
					node.scale = Vector3(s[0], s[1], s[2])

	# Ensure output directories exist
	var export_dir = "res://art/exports/models/props/" + prop_id
	var runtime_dir = "res://game/assets/props"
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(export_dir))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(runtime_dir))
		
	var scene = PackedScene.new()
	var result = scene.pack(root)
	if result == OK:
		var export_path = export_dir + "/" + prop_id + ".tscn"
		var runtime_path = runtime_dir + "/" + prop_id + ".tscn"
		
		ResourceSaver.save(scene, export_path)
		print("Saved export: " + export_path)
		
		ResourceSaver.save(scene, runtime_path)
		print("Saved runtime: " + runtime_path)
	else:
		print("Error: Failed to pack scene")
		quit(1)

func create_part(part_data, palette):
	var type = part_data.get("type", "box")
	var mesh_instance := MeshInstance3D.new()
	var mesh: Mesh = null
	
	if type == "box":
		var box := BoxMesh.new()
		if part_data.has("size"):
			var s = part_data["size"]
			box.size = Vector3(s[0], s[1], s[2])
		mesh = box
	elif type == "cylinder":
		var cylinder := CylinderMesh.new()
		if part_data.has("height"):
			cylinder.height = part_data["height"]
		if part_data.has("radius"):
			cylinder.radius = part_data["radius"]
		mesh = cylinder
	elif type == "sphere":
		var sphere := SphereMesh.new()
		if part_data.has("radius"):
			sphere.radius = part_data["radius"]
		mesh = sphere
	else:
		print("Warning: Unknown part type: " + type)
		return null
		
	mesh_instance.mesh = mesh
	
	# Apply material
	if part_data.has("color"):
		var color_name = part_data["color"]
		if palette.has(color_name):
			var hex = palette[color_name]
			var mat = StandardMaterial3D.new()
			mat.albedo_color = Color(hex)
			mat.roughness = 1.0
			mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
			mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
			mesh_instance.set_surface_override_material(0, mat)
		else:
			print("Warning: Color not found in palette: " + color_name)
			
	return mesh_instance

func load_palette(path):
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
	
	var json = JSON.new()
	json.parse(file.get_as_text())
	var data = json.data
	return data.get("colors", {})
