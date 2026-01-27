# Game Content Catalog

Auto-generated catalog of game content from data files.

**Generated:** 2026-01-26 21:35:21

---

## Enemies

| ID | Name | HP | MP | ATK | DEF | SPD |
|---|---|---|---|---|---|---|
| `slime` | Slime | 15 | 0 | 4 | 1 | 3 |
| `grumpy_squirrel` | Grumpy Squirrel | 12 | 5 | 5 | 2 | 6 |
| `angry_bee` | Angry Bee | 8 | 0 | 6 | 0 | 8 |
| `dusty_bunny` | Dusty Bunny | 14 | 3 | 4 | 3 | 7 |
| `mischief_mouse` | Mischief Mouse | 8 | 2 | 3 | 1 | 12 |
| `cranky_crow` | Cranky Crow | 10 | 4 | 5 | 2 | 9 |
| `muddy_frog` | Muddy Frog | 15 | 8 | 4 | 4 | 5 |
| `forest_guardian` | Forest Guardian | 100 | 20 | 8 | 5 | 4 |
| `angry_acorn` | Angry Acorn | 10 | 0 | 5 | 3 | 4 |
| `sneaky_snake` | Sneaky Snake | 12 | 8 | 4 | 2 | 6 |
| `grumpy_stump` | Grumpy Stump | 20 | 0 | 3 | 8 | 1 |
| `chaos_minion` | Chaos Minion | 60 | 30 | 10 | 4 | 7 |

## Items

| ID | Name | Type | Effect | Power | Price |
|---|---|---|---|---|---|
| `potion` | Potion | consumable | heal_hp | 20 | 50 |
| `ether` | Ether | consumable | heal_mp | 10 | 100 |
| `antidote` | Antidote | consumable | cure_poison | 0 | 30 |
| `acorn` | Acorn | consumable | damage | 5 | 10 |
| `honey_drop` | Honey Drop | consumable | heal_hp | 5 | 15 |
| `pet_treat` | Pet Treat | consumable | pet_buff | 10 | 25 |
| `fancy_collar` | Fancy Collar | accessory | pet_defense | 2 | 75 |
| `squeaky_toy` | Squeaky Toy | accessory | pet_happiness | 5 | 40 |
| `hi_potion` | Hi-Potion | consumable | heal_hp | 50 | 150 |
| `mega_potion` | Mega Potion | consumable | heal_hp | 30 | 300 |
| `hi_ether` | Hi-Ether | consumable | heal_mp | 30 | 250 |
| `elixir` | Elixir | consumable | full_restore | 999 | 1000 |
| `eye_drops` | Eye Drops | consumable | cure_blind | 0 | 30 |
| `alarm_clock` | Alarm Clock | consumable | cure_sleep | 0 | 25 |
| `smelling_salts` | Smelling Salts | consumable | cure_stun | 0 | 35 |
| `remedy` | Remedy | consumable | cure_all | 0 | 200 |
| `bomb` | Bomb | consumable | damage | 25 | 100 |
| `smoke_bomb` | Smoke Bomb | consumable | escape | 0 | 50 |
| `flash_powder` | Flash Powder | consumable | inflict_blind | 0 | 60 |
| `stink_bomb` | Stink Bomb | consumable | inflict_poison | 0 | 75 |
| `pastry` | Fresh Pastry | consumable | heal_hp | 15 | 20 |
| `berry` | Berry | consumable | heal_hp | 5 | 5 |
| `lantern` | Lantern | tool | illuminate | 0 | 0 |
| `journal` | Journal | tool | record | 0 | 0 |
| `lasso` | Lasso | tool | catch | 0 | 0 |
| `flute` | Flute | tool | music | 0 | 0 |
| `fishing_rod` | Fishing Rod | tool | fish | 0 | 0 |
| `common_carp` | Common Carp | fish | sell | 10 | 10 |
| `spotted_trout` | Spotted Trout | fish | sell | 15 | 15 |
| `silver_minnow` | Silver Minnow | fish | bait | 5 | 5 |
| `rainbow_bass` | Rainbow Bass | fish | sell | 30 | 30 |
| `golden_koi` | Golden Koi | fish | sell | 75 | 75 |
| `bubble_fish` | Bubble Fish | fish | sell | 50 | 50 |
| `forest_catfish` | Forest Catfish | fish | sell | 25 | 25 |
| `crystal_perch` | Crystal Perch | fish | sell | 200 | 200 |
| `bug_net` | Bug Net | tool | catch_bug | 0 | 0 |
| `common_butterfly` | Common Butterfly | bug | sell | 5 | 5 |
| `ladybug` | Ladybug | bug | sell | 8 | 8 |
| `grasshopper` | Grasshopper | bug | sell | 10 | 10 |
| `firefly` | Firefly | bug | sell | 25 | 25 |
| `dragonfly` | Dragonfly | bug | sell | 30 | 30 |
| `stag_beetle` | Stag Beetle | bug | sell | 50 | 50 |
| `rainbow_moth` | Rainbow Moth | bug | sell | 75 | 75 |
| `crystal_beetle` | Crystal Beetle | bug | sell | 200 | 200 |

## Skills

| ID | Name | Type | MP Cost | Power | Target | Element |
|---|---|---|---|---|---|---|
| `acorn_toss` | Acorn Toss | attack | 2 | 6 | single_enemy | none |
| `heal_light` | Heal Light | heal | 3 | 10 | single_ally | none |
| `spark` | Spark | attack | 4 | 8 | single_enemy | magic |
| `encourage` | Encourage | buff | 5 | 0 | single_ally | none |
| `mud_splash` | Mud Splash | attack | 4 | 5 | single_enemy | earth |
| `quick_attack` | Quick Attack | attack | 2 | 4 | single_enemy | none |
| `power_strike` | Power Strike | attack | 4 | 12 | single_enemy | none |
| `group_heal` | Group Heal | heal | 8 | 8 | all_allies | none |
| `revive` | Revive | heal | 10 | 15 | single_ally | none |
| `poison_sting` | Poison Sting | attack | 3 | 3 | single_enemy | none |
| `lullaby` | Lullaby | status | 5 | 0 | single_enemy | none |
| `stun_shock` | Stun Shock | attack | 4 | 5 | single_enemy | magic |
| `pounce` | Pounce | attack | 2 | 6 | single_enemy | none |
| `purr_heal` | Purr Heal | heal | 4 | 5 | all_allies | none |
| `distract` | Distract | status | 3 | 0 | all_enemies | none |
| `root_slam` | Root Slam | attack | 6 | 10 | all_enemies | earth |
| `roll_attack` | Roll Attack | attack | 0 | 7 | single_enemy | none |
| `poison_bite` | Poison Bite | attack | 3 | 5 | single_enemy | poison |
| `root_smash` | Root Smash | attack | 0 | 4 | single_enemy | earth |
| `chaos_bolt` | Chaos Bolt | attack | 5 | 12 | single_enemy | chaos |
| `shadow_strike` | Shadow Strike | attack | 8 | 15 | single_enemy | dark |
| `dark_shield` | Dark Shield | buff | 6 | 0 | self | dark |
| `quick_shot` | Quick Shot | attack | 2 | 5 | single_enemy | none |
| `track` | Track | buff | 4 | 0 | all_allies | none |
| `arcane_blast` | Arcane Blast | attack | 6 | 14 | single_enemy | magic |
| `study` | Study | status | 3 | 0 | single_enemy | none |
| `scratch` | Scratch | attack | 0 | 4 | single_enemy | none |
| `pounce` | Pounce | attack | 2 | 6 | single_enemy | none |
| `bark` | Bark | status | 1 | 0 | single_enemy | none |
| `fetch` | Fetch | special | 3 | 0 | self | none |
| `squeak` | Squeak | status | 1 | 0 | single_enemy | none |
| `nibble` | Nibble | attack | 0 | 2 | single_enemy | none |

## Equipment

| ID | Name | Slot | ATK+ | DEF+ | SPD+ | Price |
|---|---|---|---|---|---|---|
| `wooden_sword` | Wooden Sword | weapon | 2 | 0 | 0 | 50 |
| `iron_sword` | Iron Sword | weapon | 5 | 0 | 0 | 150 |
| `leather_armor` | Leather Armor | armor | 0 | 2 | 0 | 80 |
| `iron_armor` | Iron Armor | armor | 0 | 5 | -1 | 200 |
| `lucky_charm` | Lucky Charm | accessory | 0 | 0 | 2 | 100 |
| `power_ring` | Power Ring | accessory | 3 | 0 | 0 | 120 |

## Party Members

| ID | Name | Role | HP | MP | ATK | DEF | SPD |
|---|---|---|---|---|---|---|---|
| `fae` | Fae | hero | 25 | 15 | 6 | 3 | 7 |
| `sue` | Sue | party | 20 | 20 | 5 | 2 | 5 |
| `jordan` | Jordan | party | 22 | 10 | 7 | 4 | 4 |
| `maddie` | Maddie | pet | 15 | 5 | 4 | 2 | 8 |
| `scout` | Scout | optional | 18 | 12 | 5 | 3 | 9 |
| `bookworm` | Bookworm | optional | 16 | 25 | 3 | 2 | 4 |

## Quests

| ID | Name | Type | Reward (Gold) |
|---|---|---|---|
| `investigate_disturbance` | Investigate Disturbance | investigation | 75 |
| `find_mayors_cat` | Find the Mayor's Cat | fetch | 50 |
| `gather_berries` | Berry Picking | collect | 25 |
| `pest_control` | Pest Control | combat | 40 |
| `library_research` | Library Research | investigation | 60 |
| `fix_fountain` | Fix the Fountain | repair | 35 |
| `forest_mushrooms` | Rare Forest Mushrooms | collect | 30 |
| `mine_investigation` | Strange Sounds in the Mine | investigation | 100 |
| `chaos_investigation` | The Chaos Begins | investigation | 50 |
| `chaos_gather_evidence` | Gathering Evidence | collect | 60 |
| `chaos_unlock_forest` | The Path Forward | story | 75 |
| `find_clubhouse` | The Secret Clubhouse | exploration | 40 |
| `forest_patrol` | Forest Patrol | combat | 100 |
| `recruit_scout` | The Swift Tracker | recruitment | 0 |
| `recruit_bookworm` | The Studious Mage | recruitment | 0 |

---

## Summary

| Category | Count |
|---|---|
| Enemies | 12 |
| Items | 44 |
| Skills | 32 |
| Equipment | 6 |
| Party Members | 6 |
| Quests | 15 |
