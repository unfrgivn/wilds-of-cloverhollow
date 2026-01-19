extends RefCounted
class_name GutTest

var _runner


func _set_runner(runner) -> void:
	_runner = runner


func assert_true(condition: bool, message: String = "") -> void:
	if condition:
		return
	_fail(message if message != "" else "Expected true")


func assert_eq(expected, actual, message: String = "") -> void:
	if expected == actual:
		return
	var failure_message = message
	if failure_message.is_empty():
		failure_message = "Expected %s, got %s" % [expected, actual]
	_fail(failure_message)


func _fail(message: String) -> void:
	if _runner != null and _runner.has_method("record_failure"):
		_runner.record_failure(message)
