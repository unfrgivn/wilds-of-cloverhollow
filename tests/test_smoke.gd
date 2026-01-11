extends GutTest

func test_true_is_true():
    assert_true(true, "True should be true")

func test_project_settings_loaded():
    var app_name = ProjectSettings.get_setting("application/config/name")
    assert_eq(app_name, "Wilds of Cloverhollow", "Project name should match")
