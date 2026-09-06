extends Node2D
## Native 16px park terrain, assembled once from the prepared tile set.

const TILE_SIZE := 16
const GRASS := preload("res://game/assets/sprites/tiles/park/grass.png")
const PATH := preload("res://game/assets/sprites/tiles/park/path_center.png")
const PATH_N := preload("res://game/assets/sprites/tiles/park/path_edge_n.png")
const PATH_S := preload("res://game/assets/sprites/tiles/park/path_edge_s.png")
const WATER := preload("res://game/assets/sprites/tiles/park/pond_water.png")
const SHORE_N := preload("res://game/assets/sprites/tiles/park/pond_shore_n.png")
const HEDGE := preload("res://game/assets/sprites/tiles/park/park_hedge.png")

func _draw() -> void:
	for y in range(0, 288, TILE_SIZE):
		for x in range(0, 512, TILE_SIZE):
			draw_texture_rect(GRASS, Rect2(x, y, TILE_SIZE, TILE_SIZE), false)

	for x in range(0, 512, TILE_SIZE):
		draw_texture_rect(PATH_N, Rect2(x, 112, TILE_SIZE, TILE_SIZE), false)
		draw_texture_rect(PATH, Rect2(x, 128, TILE_SIZE, TILE_SIZE), false)
		draw_texture_rect(PATH, Rect2(x, 144, TILE_SIZE, TILE_SIZE), false)
		draw_texture_rect(PATH_S, Rect2(x, 160, TILE_SIZE, TILE_SIZE), false)

	for x in range(256, 352, TILE_SIZE):
		draw_texture_rect(SHORE_N, Rect2(x, 176, TILE_SIZE, TILE_SIZE), false)
		for y in range(192, 256, TILE_SIZE):
			draw_texture_rect(WATER, Rect2(x, y, TILE_SIZE, TILE_SIZE), false)

	for x in range(0, 512, TILE_SIZE):
		draw_texture_rect(HEDGE, Rect2(x, 0, TILE_SIZE, TILE_SIZE), false)
		draw_texture_rect(HEDGE, Rect2(x, 272, TILE_SIZE, TILE_SIZE), false)
	for y in range(16, 272, TILE_SIZE):
		if y < 128 or y >= 160:
			draw_texture_rect(HEDGE, Rect2(0, y, TILE_SIZE, TILE_SIZE), false)
		if y < 128 or y >= 160:
			draw_texture_rect(HEDGE, Rect2(496, y, TILE_SIZE, TILE_SIZE), false)

	# The bridge is the only walkable crossing of the pond. Keep its palette
	# deliberately aligned with the prepared park art.
	for x in range(288, 320, 8):
		for y in range(176, 256, 16):
			draw_rect(Rect2(x, y, 8, 16), Color("8a6b3f"))
			draw_line(Vector2(x, y + 3), Vector2(x + 7, y + 3), Color("c9a870"), 1.0)
			draw_line(Vector2(x, y + 13), Vector2(x + 7, y + 13), Color("5a4a3a"), 1.0)
