extends SceneTree

const EXPORT_ROOT: String = "res://art/exports"
const PROP_ROOT: String = "res://content/props"
const BASE_SUFFIX: String = "_base.png"
const OVERHANG_SUFFIX: String = "_overhang.png"
const SHADOW_SUFFIX: String = "_shadow.png"

var _copied: int = 0
var _skipped: int = 0
var _had_errors: bool = false

func _init() -> void:
	var args: PackedStringArray = OS.get_cmdline_args()
	var dry_run: bool = args.has("--dry-run")
	var allow_missing: bool = args.has("--allow-missing")
	var allow_create: bool = args.has("--allow-create")
	var export_root_abs: String = ProjectSettings.globalize_path(EXPORT_ROOT)
	if not DirAccess.dir_exists_absolute(export_root_abs):
		if allow_missing:
			print("[BlenderSync] Export folder missing: %s" % EXPORT_ROOT)
			quit(0)
			return
		_push_error("Export folder missing", EXPORT_ROOT)
		quit(1)
		return

	var files: Array[String] = []
	_scan_exports(export_root_abs, files)
	files.sort()
	for path in files:
		_sync_export(path, dry_run, allow_create)
	var mode: String = "dry-run" if dry_run else "write"
	print("[BlenderSync] Mode: %s" % mode)
	print("[BlenderSync] Copied: %d" % _copied)
	print("[BlenderSync] Skipped: %d" % _skipped)
	if _had_errors:
		quit(1)
	else:
		quit(0)

func _scan_exports(folder_abs: String, results: Array[String]) -> void:
	var dir: DirAccess = DirAccess.open(folder_abs)
	if dir == null:
		return
	dir.list_dir_begin()
	var entry: String = dir.get_next()
	while entry != "":
		if entry.begins_with("."):
			entry = dir.get_next()
			continue
		var entry_abs: String = folder_abs.path_join(entry)
		if dir.current_is_dir():
			_scan_exports(entry_abs, results)
		elif entry.ends_with(".png"):
			results.append(entry_abs)
		entry = dir.get_next()
	dir.list_dir_end()

func _sync_export(path_abs: String, dry_run: bool, allow_create: bool) -> void:
	var file_name: String = path_abs.get_file()
	var mapping: Dictionary = _resolve_mapping(file_name)
	if mapping.is_empty():
		_skipped += 1
		return
	var prop_id: String = str(mapping["prop_id"]).strip_edges()
	if prop_id == "":
		_skipped += 1
		return
	var target_rel: String = str(mapping["target"])
	var prop_dir_rel: String = PROP_ROOT.path_join(prop_id)
	var prop_dir_abs: String = ProjectSettings.globalize_path(prop_dir_rel)
	if not DirAccess.dir_exists_absolute(prop_dir_abs):
		if not allow_create:
			push_warning("[BlenderSync] Missing prop folder: %s" % prop_dir_rel)
			_skipped += 1
			return
		DirAccess.make_dir_recursive_absolute(prop_dir_abs)
	var target_rel_path: String = prop_dir_rel.path_join(target_rel)
	var target_abs: String = ProjectSettings.globalize_path(target_rel_path)
	if dry_run:
		print("[BlenderSync] %s -> %s" % [path_abs, target_rel_path])
		return
	DirAccess.make_dir_recursive_absolute(target_abs.get_base_dir())
	if _copy_file(path_abs, target_abs):
		_copied += 1
	else:
		_had_errors = true

func _resolve_mapping(file_name: String) -> Dictionary:
	if file_name.ends_with(BASE_SUFFIX):
		return _mapping_for(file_name, BASE_SUFFIX, "visuals/base.png")
	if file_name.ends_with(OVERHANG_SUFFIX):
		return _mapping_for(file_name, OVERHANG_SUFFIX, "visuals/overhang.png")
	if file_name.ends_with(SHADOW_SUFFIX):
		return _mapping_for(file_name, SHADOW_SUFFIX, "visuals/shadow.png")
	return {}

func _mapping_for(file_name: String, suffix: String, target: String) -> Dictionary:
	var prop_id: String = file_name.substr(0, file_name.length() - suffix.length())
	return {"prop_id": prop_id, "target": target}

func _copy_file(source_abs: String, target_abs: String) -> bool:
	var source_file: FileAccess = FileAccess.open(source_abs, FileAccess.READ)
	if source_file == null:
		_push_error("Failed to read source", source_abs)
		return false
	var buffer: PackedByteArray = source_file.get_buffer(source_file.get_length())
	source_file.close()
	var target_file: FileAccess = FileAccess.open(target_abs, FileAccess.WRITE)
	if target_file == null:
		_push_error("Failed to write target", target_abs)
		return false
	target_file.store_buffer(buffer)
	target_file.close()
	return true

func _push_error(message: String, detail: String) -> void:
	_had_errors = true
	push_error("[BlenderSync] %s (%s)" % [message, detail])
