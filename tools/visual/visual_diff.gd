extends SceneTree

const IMAGE_EXT := ".png"

func _init() -> void:
	var args = OS.get_cmdline_user_args()
	var baseline_root = _get_arg(args, "--baseline_root")
	var actual_root = _get_arg(args, "--actual_root")
	var report_dir = _get_arg(args, "--report_dir")
	if baseline_root.is_empty() or actual_root.is_empty() or report_dir.is_empty():
		push_error("Usage: --baseline_root <dir> --actual_root <dir> --report_dir <dir>")
		quit(2)
		return
	_run_diff(baseline_root, actual_root, report_dir)
	quit(0)

func _run_diff(baseline_root: String, actual_root: String, report_dir: String) -> void:
	var report_abs = _globalize(report_dir)
	DirAccess.make_dir_recursive_absolute(report_abs)

	var scenarios = _list_dirs(actual_root)
	var sections: Array[String] = []
	var summary_rows: Array[String] = []

	for scenario_id in scenarios:
		var baseline_movie = _path_join(baseline_root, scenario_id, "movie")
		var actual_movie = _path_join(actual_root, scenario_id, "movie")
		var scenario_report_dir = _path_join(report_dir, scenario_id)
		var scenario_report_abs = _globalize(scenario_report_dir)
		DirAccess.make_dir_recursive_absolute(scenario_report_abs)
		var diff_dir = _path_join(scenario_report_dir, "diff")
		DirAccess.make_dir_recursive_absolute(_globalize(diff_dir))

		var baseline_exists = DirAccess.dir_exists_absolute(_globalize(baseline_movie))
		var actual_exists = DirAccess.dir_exists_absolute(_globalize(actual_movie))

		if not baseline_exists:
			summary_rows.append("<tr><td>%s</td><td>missing baseline</td><td>--</td></tr>" % scenario_id)
			sections.append("<h2>%s</h2><p>Missing baseline directory.</p>" % scenario_id)
			continue
		if not actual_exists:
			summary_rows.append("<tr><td>%s</td><td>missing capture</td><td>--</td></tr>" % scenario_id)
			sections.append("<h2>%s</h2><p>Missing capture directory.</p>" % scenario_id)
			continue

		var frame_names = _list_files(baseline_movie, IMAGE_EXT)
		var mismatches = 0
		var total_frames = frame_names.size()
		var frame_rows: Array[String] = []

		for frame_name in frame_names:
			var baseline_path = _path_join(baseline_movie, frame_name)
			var actual_path = _path_join(actual_movie, frame_name)
			if not FileAccess.file_exists(_globalize(actual_path)):
				mismatches += 1
				frame_rows.append("<tr><td>%s</td><td>missing</td><td>missing</td><td>missing</td><td>--</td></tr>" % frame_name)
				continue
			var result = _compare_images(baseline_path, actual_path)
			var score = float(result.get("score", 1.0))
			if score > 0.0:
				mismatches += 1
				var diff_image: Image = result.get("diff")
				var baseline_image: Image = result.get("baseline")
				var actual_image: Image = result.get("actual")
				var safe_name = frame_name.replace(IMAGE_EXT, "")
				var baseline_copy = _path_join(scenario_report_dir, "%s_baseline.png" % safe_name)
				var actual_copy = _path_join(scenario_report_dir, "%s_actual.png" % safe_name)
				var diff_copy = _path_join(diff_dir, "%s_diff.png" % safe_name)
				baseline_image.save_png(_globalize(baseline_copy))
				actual_image.save_png(_globalize(actual_copy))
				diff_image.save_png(_globalize(diff_copy))
				frame_rows.append("<tr><td>%s</td><td><img src=\"%s\"/></td><td><img src=\"%s\"/></td><td><img src=\"%s\"/></td><td>%.5f</td></tr>" % [frame_name, _rel_path(baseline_copy, report_dir), _rel_path(actual_copy, report_dir), _rel_path(diff_copy, report_dir), score])

		var status = "pass" if mismatches == 0 else "fail"
		summary_rows.append("<tr><td>%s</td><td>%s</td><td>%d/%d</td></tr>" % [scenario_id, status, mismatches, total_frames])
		sections.append("<h2>%s</h2><p>Status: %s (%d/%d mismatches)</p><table><tr><th>Frame</th><th>Baseline</th><th>Actual</th><th>Diff</th><th>Score</th></tr>%s</table>" % [scenario_id, status, mismatches, total_frames, "".join(frame_rows)])

	var html = "<html><head><style>body{font-family:Arial, sans-serif}table{border-collapse:collapse}td,th{border:1px solid #444;padding:4px}img{width:240px}</style></head><body>"
	html += "<h1>Visual Diff Report</h1>"
	html += "<table><tr><th>Scenario</th><th>Status</th><th>Mismatches</th></tr>%s</table>" % "".join(summary_rows)
	html += "".join(sections)
	html += "</body></html>"

	var report_path = _path_join(report_dir, "index.html")
	var file = FileAccess.open(_globalize(report_path), FileAccess.WRITE)
	file.store_string(html)

func _compare_images(baseline_path: String, actual_path: String) -> Dictionary:
	var baseline = Image.new()
	var actual = Image.new()
	if baseline.load(_globalize(baseline_path)) != OK:
		return {}
	if actual.load(_globalize(actual_path)) != OK:
		return {}
	if baseline.get_size() != actual.get_size():
		return {"score": 1.0, "baseline": baseline, "actual": actual, "diff": baseline}

	var width = baseline.get_width()
	var height = baseline.get_height()
	var diff = Image.create(width, height, false, Image.FORMAT_RGBA8)
	var total = 0.0
	for y in range(height):
		for x in range(width):
			var a = baseline.get_pixel(x, y)
			var b = actual.get_pixel(x, y)
			var dr = abs(a.r - b.r)
			var dg = abs(a.g - b.g)
			var db = abs(a.b - b.b)
			var da = abs(a.a - b.a)
			var delta = (dr + dg + db + da) * 0.25
			total += delta
			diff.set_pixel(x, y, Color(dr, dg, db, 1.0))
	var score = total / float(width * height)
	return {"score": score, "baseline": baseline, "actual": actual, "diff": diff}

func _list_dirs(root: String) -> Array[String]:
	var result: Array[String] = []
	var dir = DirAccess.open(_globalize(root))
	if dir == null:
		return result
	for entry in dir.get_directories():
		result.append(entry)
	result.sort()
	return result

func _list_files(root: String, suffix: String) -> Array[String]:
	var result: Array[String] = []
	var dir = DirAccess.open(_globalize(root))
	if dir == null:
		return result
	for entry in dir.get_files():
		if entry.ends_with(suffix):
			result.append(entry)
	result.sort()
	return result

func _get_arg(args: PackedStringArray, key: String) -> String:
	for i in range(args.size()):
		if args[i] == key and i + 1 < args.size():
			return args[i + 1]
		if args[i].begins_with(key + "="):
			return args[i].get_slice("=", 1)
	return ""

func _path_join(part_a: String, part_b: String, part_c: String = "") -> String:
	if part_c.is_empty():
		return part_a.rstrip("/") + "/" + part_b.strip_edges()
	return part_a.rstrip("/") + "/" + part_b.strip_edges() + "/" + part_c.strip_edges()

func _globalize(path: String) -> String:
	if path.begins_with("res://") or path.begins_with("user://"):
		return ProjectSettings.globalize_path(path)
	if path.is_absolute_path():
		return path
	return ProjectSettings.globalize_path("res://" + path)

func _rel_path(path: String, report_root: String) -> String:
	var report_abs = _globalize(report_root)
	var target_abs = _globalize(path)
	if target_abs.begins_with(report_abs):
		return target_abs.substr(report_abs.length() + 1)
	return path
