extends SceneTree

const PROJECT_ROOT: String = "res://"

const STEPS: Array[Dictionary] = [
	{"name": "export_layouts", "script": "res://tools/export_layouts.gd"},
	{"name": "qa_props", "script": "res://tools/qa_props.gd"},
	{"name": "bake_walkmasks", "script": "res://tools/bake_walkmasks.gd"},
	{"name": "bake_navpolys", "script": "res://tools/bake_navpolys.gd"},
	{"name": "validate_scenes", "script": "res://tools/validate_scenes.gd"}
]

func _init() -> void:
	var project_path: String = ProjectSettings.globalize_path(PROJECT_ROOT)
	var executable: String = OS.get_executable_path()
	for step in STEPS:
		var name: String = step["name"]
		var script_path: String = step["script"]
		print("[BuildContent] Running %s" % name)
		var args: Array[String] = ["--headless", "--quit", "--path", project_path, "--script", script_path]
		var output: Array[String] = []
		var code: int = OS.execute(executable, args, output, true)
		for line in output:
			print(line)
		if code != 0:
			push_error("[BuildContent] Step failed: %s (code %d)" % [name, code])
			quit(code)
			return
	print("[BuildContent] OK")
	quit(0)
