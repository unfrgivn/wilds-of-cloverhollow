extends SceneTree

const DEFAULT_TEST_DIR = "res://game/tests"

var test_dir := DEFAULT_TEST_DIR
var include_subdirs := false
var exit_on_finish := true
var failures := 0
var current_test := ""


func _init() -> void:
	_parse_args()
	_run_tests()
	if exit_on_finish:
		quit(0 if failures == 0 else 1)


func _parse_args() -> void:
	var args = OS.get_cmdline_user_args()
	var i = 0
	while i < args.size():
		var arg = args[i]
		if arg == "-gdir" and i + 1 < args.size():
			test_dir = args[i + 1]
			i += 1
		elif arg == "-ginclude_subdirs":
			include_subdirs = true
		elif arg == "-gexit":
			exit_on_finish = true
		i += 1


func _run_tests() -> void:
	var scripts = _find_test_scripts(test_dir)
	if scripts.is_empty():
		print("No tests found in %s" % test_dir)
		return

	for path in scripts:
		_run_test_script(path)

	print("Test run complete. Failures: %d" % failures)


func _find_test_scripts(dir_path: String) -> Array:
	var results: Array = []
	var directory = DirAccess.open(dir_path)
	if directory == null:
		return results

	directory.list_dir_begin()
	var name = directory.get_next()
	while name != "":
		if name.begins_with("."):
			name = directory.get_next()
			continue

		var path = dir_path.path_join(name)
		if directory.current_is_dir():
			if include_subdirs:
				results.append_array(_find_test_scripts(path))
		elif name.begins_with("test_") and name.ends_with(".gd"):
			results.append(path)

		name = directory.get_next()
	directory.list_dir_end()
	return results


func _run_test_script(path: String) -> void:
	var script = load(path)
	if script == null:
		record_failure("Unable to load test script: %s" % path)
		return

	var instance = script.new()
	if instance == null:
		record_failure("Unable to instantiate test script: %s" % path)
		return

	if instance.has_method("_set_runner"):
		instance._set_runner(self)

	var methods = instance.get_method_list()
	for method_info in methods:
		var name = String(method_info.get("name", ""))
		if name.begins_with("test_"):
			current_test = "%s::%s" % [path, name]
			instance.call(name)


func record_failure(message: String) -> void:
	failures += 1
	print("FAIL: %s - %s" % [current_test, message])
