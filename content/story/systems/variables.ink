VAR plan = "none"
VAR ate_breakfast = false
VAR read_notice = false
VAR hall_pass = false
VAR raccoon_waiting = false
VAR knows_password = false
VAR club_open = false
VAR sue_joined = false
VAR visited_bay = false
VAR visited_pass = false
VAR bluebird_calmed = false
VAR rode_bus = false
VAR jordan_joined = false
VAR has_lantern = false
VAR found_old_trail = false
VAR clubhouse_claimed = false
VAR story_time = false
// Milestone 55's calm-down clears the forest's painted chaos overlays.
VAR forest_fizzy = true
VAR maple_in_hall = true
VAR hood_waiting = false
VAR saw_hood = false
VAR pe_time = false
VAR gym_quest = false
VAR saw_clipboard = false
VAR has_lasso = false
VAR found_clipboard = false
VAR coach_thanked = false
VAR dreaming = true
VAR awake = false
EXTERNAL calmed(id)
EXTERNAL coins()
EXTERNAL snacks()
EXTERNAL won(id)
EXTERNAL plushesLeft()
EXTERNAL tickets()
EXTERNAL withParty(id)
EXTERNAL lanternOn()
EXTERNAL areaCalm()
EXTERNAL level()
EXTERNAL stickers()
EXTERNAL treats()
EXTERNAL bossesCalmed()
EXTERNAL fishCount()
VAR lifeguard_back = false

VAR art_teacher_out = false
VAR art_open = false
VAR principal_out = false

// The music room (Milestone 38).
VAR music_time = false
VAR music_quest = false
VAR song_start = false
VAR heard_bird = false
VAR has_flute = false
VAR xylophone_notes = 0
VAR xylophone_right = true
VAR xylophone_tune = ""

// The playing field (Milestone 39).
VAR recess = false
VAR swung = false
VAR stash_found = false
VAR bridge_down = false
VAR found_mist_way = false
VAR visited_hills = false

VAR lookout_cache_found = false

VAR rope_bridge = false
VAR seal_open = false
VAR mist_notes = 0
VAR mist_right = true
VAR mist_tune = ""
VAR heard_wish = false
VAR milo_revealed = false

// The clubhouse fix-up (Milestone 43).
VAR fridge_fixed = false
VAR fridge_baskets = 0
VAR garden_planted = false
VAR garden_calms = 0
VAR garden_sprouted = false
VAR garden_ripe = false
VAR sunberry_harvests = 0

// Flute friends (Milestone 47).
VAR pup_petted = false
VAR pup_fed = false
VAR pup_friend = false
VAR pup_with_me = false
VAR pond_seen = false
VAR pond_tin = false

// Lasso spots (Milestone 49): something stuck out of reach in three places
// Fae knows, there once she has Coach Ash's lasso.
VAR kite_seen = false
VAR kite_down = false
VAR kite_returned = false
VAR bottle_seen = false
VAR has_map = false
VAR treasure_found = false
VAR scarf_seen = false
VAR scarf_down = false
VAR scarf_returned = false

// The clubhouse kitchen (Milestone 52): Mom's old microwave on the fridge, her
// freezer's boxes to cook in it, and her old toy chest for Fae's treasures.
VAR has_microwave = false
VAR has_chest = false
VAR has_nuggets = false
VAR has_mac = false
VAR meals_cooked = 0

// The lodge keeper (Milestone 57): home from looking for her runaway hamster,
// fizzy from the hooded kid's soda, until Fae calms her.
VAR keeper_back = false
VAR lodge_open = false

// Inside the lodge (Milestone 57).
VAR lodge_cocoa_had = false

// A second flute friend (Milestone 60): the Acorn Squirrel climbs.
VAR squirrel_petted = false
VAR squirrel_fed = false
VAR squirrel_friend = false
VAR squirrel_with_me = false
VAR knothole_seen = false
VAR acorn_found = false

// Crystal Cavern: a glowing cave off Pinecone Pass's north mountain gap,
// unlocked with the blacklight lantern, showcasing all three tools and two
// cozy cave critters.
VAR cavern_visited = false
VAR cavern_bridge_lit = false
VAR cavern_chime_seen = false
VAR cavern_chime_rung = false
VAR cavern_spring_seen = false
VAR cavern_spring_found = false

// Bon Appetit Cafe, Dad, townspeople, and Chef Bea's Star Cinnamon errand (Milestone 79).
VAR met_dad = false
VAR spice_quest = false
VAR spice_found = false
VAR spice_returned = false
VAR barnaby_gift = false

// A third flute friend & collectible Star Gems across Cloverhollow (Milestone 80).
VAR bunny_petted = false
VAR bunny_fed = false
VAR bunny_friend = false
VAR bunny_with_me = false
VAR gem_park = false
VAR gem_bay = false
VAR gem_trail = false
VAR gem_pass = false
VAR gem_cavern = false
VAR gem_woods = false
VAR gem_hills = false
VAR gem_reward_3 = false
VAR gem_reward_all = false

// Peekaboo mini-boss Starey Owl & Taco Truck Talk mini-boss Chef Mateo (Milestone 81).
VAR moon_owl_out = false
VAR taco_chef_out = false
VAR mateo_snacks_given = false

// The Wildlife Sanctuary: living calm-animal meadow east of Clover Hills.
VAR sanctuary_visited = false
VAR sanctuary_reward_3 = false
VAR sanctuary_reward_8 = false
VAR sanctuary_reward_14 = false
VAR sanctuary_picnic_basket = false

// Other Kids' Houses: Sue's Beach Cottage & Jordan's Mountain Cabin.
VAR sue_cottage_visited = false
VAR sue_compass = false
VAR sue_basket_taken = false
VAR sue_note_read = false
VAR jordan_cabin_visited = false
VAR jordan_clover = false
VAR jordan_note_read = false

// Buster the Bus Driver, Star-Line Stamp Card errand & regional souvenir treat stands (Milestone 97).
VAR buster_quest = false
VAR stamp_bay = false
VAR stamp_pass = false
VAR buster_reward = false

// Living World Landmarks: Bubblegum Bay Boat Rental & Pinecone Pass Wildlife Sanctuary (Milestone 94).
VAR bay_boat_charm = false
VAR sanctuary_gift = false

// Cloverhollow's Final Two Plaza Shops: Cloverhollow Grocery Market & Sweet Scoop Ice Cream Parlor.
VAR market_visited = false
VAR market_note_read = false
VAR parlor_visited = false
VAR parlor_note_read = false

// Milo's Sketch Loft & Rosie's Flower Cottage (Meadow Park neighborhood homes).
VAR milo_loft_visited = false
VAR milo_desk_checked = false
VAR milo_loft_glow_read = false
VAR rosie_cottage_visited = false
VAR rosie_clover_gift = false
VAR rosie_cottage_glow_read = false

// Alpine Summit Overlook (reached by riding the Pinecone Pass ski lift).
VAR summit_visited = false
VAR summit_telescope_used = false
VAR summit_cocoa_taken = false
VAR summit_aurora_read = false

// Starlight Island (reached by rowing across Bubblegum Bay from bay_boats).
VAR island_visited = false
VAR island_shells_solved = false
VAR island_lighthouse_checked = false
VAR island_bottle_found = false
VAR island_glow_read = false

// Post-Finale Sunny Cloverhollow Epilogue & Sanctuary Celebration Festival.
VAR festival_milo_talked = false
VAR festival_rosie_gift = false
VAR festival_dad_talked = false
VAR festival_chef_talked = false
VAR festival_toast_done = false

// Elevation Track E11: Party Heart-to-Hearts (6 optional character scenes).
VAR h2h_fae_maddie_done = false
VAR h2h_fae_sue_done = false
VAR h2h_fae_jordan_done = false
VAR h2h_sue_jordan_done = false
VAR h2h_clubhouse_trio_done = false
VAR h2h_sanctuary_encore_done = false

// Elevation Track E11: Interactive Multi-Step Living NPC Quests.
VAR star_chart_quest = false
VAR star_chart_plaza = false
VAR star_chart_bay = false
VAR star_chart_pass = false
VAR star_chart_done = false

VAR kite_chain_quest = false
VAR kite_tail_park = false
VAR kite_tail_lane = false
VAR kite_tail_crossing = false
VAR kite_tail_boardwalk = false
VAR kite_chain_done = false

VAR lullaby_quest = false
VAR lullaby_note_plaza = false
VAR lullaby_note_park = false
VAR lullaby_note_woods = false
VAR lullaby_done = false

VAR valley_spice_quest = false
VAR valley_spice_salt = false
VAR valley_spice_pine = false
VAR valley_spice_mint = false
VAR valley_spice_done = false
