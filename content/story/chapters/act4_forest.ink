=== old_trail_closed ===
The pines are quiet and snowy. The old trail only appears under the lantern's glow. # speaker: Fae
-> DONE

=== clubhouse ===
{clubhouse_claimed: -> clubhouse_again}
Somebody's secret clubhouse! It smells like purple fizzy soda. # speaker: Fae
Comic books are scattered beside a half-eaten fizzy cracker. # speaker: Fae
With the lantern on, invisible ink glows across the wall: "Meet the boss at the Ancient Tree in the Enchanted Forest." # speaker: Fae
The Enchanted Forest is sealed. Whoever the boss is, the note does not say. # speaker: Fae
{calmed("owl"):
    ~ clubhouse_claimed = true
    Sue will fix up a fridge for the clubhouse. # speaker: Sue
    Jordan will start a little garden outside. # speaker: Jordan
    This is our club now! # speaker: Fae
    Hey, there's a note under the comics: "NEXT STOP: THE ARCADE. FIZZ THE HIGH SCORES!" # speaker: Jordan
    The arcade back in Cloverhollow? We'd better hurry! # speaker: Fae
}
-> DONE

= clubhouse_again
{not (fridge_fixed and garden_planted): The clubhouse is ours now. Sue is planning a fridge, and Jordan is planning a garden. Up the ladder! # speaker: Fae}
{fridge_fixed and garden_planted: Our clubhouse! The fridge hums, and strawberries grow on the deck. # speaker: Fae}
-> DONE

=== owl_calm ===
{owl_calm > 1: -> again}
The owl whispers, "The trees remember every secret." # speaker: Whispering Owl
A kid in a purple hood left purple fizz, comic books, and a cracker in the clubhouse. # speaker: Whispering Owl
The owl hoots wisely. "The boss waits by the Ancient Tree in the sealed forest." # speaker: Whispering Owl
-> DONE
= again
The wise owl whispers through the leaves. # speaker: Whispering Owl
-> DONE

// The knothole high up the Whispering Woods' big west oak.
=== oak_knothole ===
{acorn_found: -> after}
~ knothole_seen = true
High up the big oak, there's a dark knothole. Something rattles inside it when the wind blows. # speaker: Fae
{not squirrel_with_me: It's much too high to climb, and too small for my hand. # speaker: Fae}
{not squirrel_with_me and has_lasso: My lasso can't get inside a hole, either. # speaker: Fae}
{not squirrel_with_me: -> DONE}
+ [Up you go!]
    Chitter! The Acorn Squirrel zips up the trunk and pops into the knothole. # speaker: Fae
    ~ acorn_found = true
    He scampers back down with a golden acorn, and a whole pile of hazelnuts! # speaker: Fae # gift: snack 3
    A golden acorn! It shines like a little sun. # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE
= after
The knothole high up the big oak is empty now. # speaker: Fae
-> DONE

=== club_fridge ===
{has_nuggets or has_mac: -> cook}
- (club_door)
{has_microwave and not (has_nuggets or has_mac) and meals_cooked == 0: Mom's microwave is up on top. With a box from her freezer, I can cook! # speaker: Fae}
{fridge_fixed: -> stocked}
An old fridge with its door hanging open. Inside, it's as warm as toast. # speaker: Fae
Leave it to me! I keep the cooler on my dad's boat running. # speaker: Sue
Sue wiggles the plug, gives the door a bump with her hip, and... # speaker: Fae
~ fridge_fixed = true
Hummmm! The door clicks shut, the old fridge shivers, and a cool glow comes on. # speaker: Fae
Ta-da! Cold and humming. Now the club needs something to keep in it. # speaker: Sue
{not garden_planted: Jordan, didn't you bring seeds? # speaker: Sue}
-> DONE
= stocked
{fridge_baskets == 0 and not garden_planted: The fridge hums away, nice and cold. It's empty. # speaker: Fae}
{fridge_baskets == 0 and garden_planted: The fridge hums away, nice and cold. Strawberries from the deck will keep in here. # speaker: Fae}
{fridge_baskets == 0: -> DONE}
The fridge is full of cold strawberries from the deck! # speaker: Fae
+ [Take them]
    -> take
+ [Leave them]
    They'll keep. # speaker: Fae
    -> DONE
= cook
Mom's microwave is up on top of the fridge, ready to go! # speaker: Fae
+ {has_nuggets} [Cook the dino nuggets]
    ~ has_nuggets = false
    ~ meals_cooked += 1
    In go the dino nuggets! # speaker: Fae # play: cook-nuggets 0
    -> DONE
+ {has_mac} [Cook the mac n cheese]
    ~ has_mac = false
    ~ meals_cooked += 1
    In goes the mac n cheese! # speaker: Fae # play: cook-mac 0
    -> DONE
+ [Open the fridge]
    -> club_fridge.club_door
= take
~ fridge_baskets -= 1
Fae packs three strawberry snacks into her backpack. # speaker: Fae # gift: snack 3
{fridge_baskets > 0: -> take}
Snacks for the road! Critters love strawberries. # speaker: Jordan
-> DONE

=== club_ladder ===
A ladder up to somebody's secret clubhouse. It smells like purple fizzy soda up there. # speaker: Fae
It isn't ours to climb into... yet. # speaker: Fae
-> DONE

=== club_comics ===
A stack of comics about a superhero cat. Somebody read them over and over: the corners are all soft. # speaker: Fae
-> DONE

=== club_bottles ===
Empty bottles of fizzy purple soda, left behind by the kid in the purple hood. # speaker: Fae
{not (fridge_fixed and garden_planted): Let's keep our clubhouse soda-free! # speaker: Sue}
-> DONE

=== club_garden ===
{garden_ripe: -> ripe}
{garden_sprouted: -> growing}
{garden_planted: -> planted}
Long wooden planter boxes, full of soil, with nothing growing. # speaker: Fae
Perfect! I saved strawberry seeds all the way from the pass. # speaker: Jordan
Jordan pokes the seeds into the soil, one by one, and marks each row with a stick. # speaker: Fae
~ garden_planted = true
My grandma says a garden grows best when everything around it is calm. # speaker: Jordan
Then let's calm some critters! Every one we calm, the garden will grow a little. # speaker: Fae
-> DONE
= planted
The seeds are tucked in. Calm a critter, and they'll sprout! # speaker: Jordan
-> DONE
= growing
Little green leaves, and tiny white flowers! # speaker: Fae
{garden_calms <= 1: Two more calm critters, and there'll be strawberries. # speaker: Jordan}
{garden_calms == 2: One more calm critter, and there'll be strawberries! # speaker: Jordan}
-> DONE
= ripe
Ripe strawberries, red and juicy! # speaker: Fae
{not fridge_fixed: The fridge isn't working yet. Let's ask Sue to fix it, so they stay fresh! # speaker: Jordan}
{not fridge_fixed: -> DONE}
{fridge_baskets > 0 or sunberry_harvests > 0: -> sunberry_choice}
Fae and Jordan fill a whole basket, and tuck it into the fridge. # speaker: Fae
~ fridge_baskets += 1
~ garden_ripe = false
~ garden_calms = 1
The plants are still growing. Two more calm critters, and there'll be more! # speaker: Jordan
-> DONE
= sunberry_choice
Wait, look! A glowing Golden Sunberry bloomed right beside the strawberries! # speaker: Jordan
+ [Pick a strawberry basket]
    Fae and Jordan fill a whole basket, and tuck it into the fridge. # speaker: Fae
    ~ fridge_baskets += 1
    ~ garden_ripe = false
    ~ garden_calms = 1
    The plants are still growing. Two more calm critters, and there'll be more! # speaker: Jordan
    -> DONE
+ [Pluck a magical Golden Sunberry]
    Fae gently plucks the glowing Golden Sunberry! Warm meadow sparkles tickle her palm! # speaker: Fae # gift: treat sunberry-nectar 1 # sound: chime-yellow
    ~ sunberry_harvests += 1
    ~ garden_ripe = false
    ~ garden_calms = 1
    Whoa, my grandma wasn't kidding! That Golden Sunberry is packed with cozy energy for battles! # speaker: Jordan
    -> DONE

// What Fae keeps, oldest first, each from when the story says she found it.
=== club_chest ===
{not has_chest: -> drawings}
Fae lifts the lid of the old toy chest. Everything she's found on her adventures is in here! # speaker: Fae
{pup_calm: The purple thread from the Pond Pup's tennis ball. It came from a purple hood! # speaker: Fae}
The note from under the comics: "NEXT STOP: THE ARCADE. FIZZ THE HIGH SCORES!" # speaker: Fae
{saw_hood: The purple marker the hooded kid dropped at school. # speaker: Fae}
{stash_found: The Star Racer token from the hooded kid's stash. I'll give it back when I find them! # speaker: Fae}
{pond_tin: The old tin the Pond Pup fetched out of the park pond. # speaker: Fae}
{has_map: The treasure map from the bottle by Sue's dock. X marked the spot! # speaker: Fae}
{kite_returned: A bow from the tail of Rosie's kite. She gave it to me for getting it down! # speaker: Fae}
{acorn_found: The golden acorn from the knothole in the big oak. The Acorn Squirrel found it! # speaker: Fae}
{cavern_chime_rung: The shimmering star crystal from Crystal Cavern. It still hums when I hold it! # speaker: Fae}
{spice_returned: Chef Bea's golden Bon Appetit Star Pin! It still smells faintly like warm cinnamon. # speaker: Fae}
{gem_reward_all: Grandpa Barnaby's Rainbow Star Geode! All seven Star Gems sparkle inside like a tiny galaxy. # speaker: Fae}
{calmed("moon-owl"): Starry Owl's iridescent Moon Feather! It shimmers softly even with the lid half closed. # speaker: Fae}
{calmed("taco-chef"): Chef Mateo's shiny Golden Taco Badge! Best taste-tester in Cloverhollow Hills. # speaker: Fae}
{sanctuary_reward_14: Ranger Fern's woven Sanctuary Clover Wreath! Dried wildflower petals still smell like alpine sunshine. # speaker: Fae}
{sue_compass: Sue's Sea-Glass Compass from her beach cottage. Its needle always points toward the bay! # speaker: Fae}
{jordan_clover: Jordan's Pressed Alpine Clover from his grandma's botany book. # speaker: Fae}
{buster_reward: Buster's Golden Star-Line Whistle! It shines like a tiny bus-stop star. # speaker: Fae}
{milo_loft_visited and rosie_cottage_visited: A rocket doodle from Milo's Sketch Loft and a pressed clover from Rosie's Flower Cottage! # speaker: Fae}
{summit_aurora_read: My sketchbook rubbings of the lavender-and-gold Alpine Summit Overlook aurora legend! # speaker: Fae}
{island_shells_solved: A shimmering pastel shell shard from Starlight Island's four-note Seashell Chime! # speaker: Fae}
{festival_toast_done: A sunny golden keepsake ribbon from our Cloverhollow Wildlife Sanctuary Celebration Festival! # speaker: Fae}
Fae closes the lid gently. # speaker: Fae
-> DONE
= drawings
Drawings pinned to the wall: a kid with a big smile, and hearts and flowers. # speaker: Fae
-> DONE

=== club_decor ===
Our clubhouse decorating sketchbook and paint-swatch board! We can pick rugs, pennants, warm lights, and cozy bedroom shelf pedestals right here. # speaker: Fae
+ [Open Clubhouse Decor Picker]
    Ooh, let's check our clubhouse swatches and cozy upgrades! # speaker: Fae # open-decor: clubhouse
    -> DONE
+ [Not now]
    The clubhouse already feels super cozy! # speaker: Fae
    -> DONE

=== moon_perch ===
{not clubhouse_claimed:
    A smooth crescent of mossy bark tucked in the quiet southeast clearing. A few silver-blue owl feathers rest along the branch, waiting for a calmer evening. # speaker: Fae
    -> DONE
}
{not moon_owl_out:
    A crescent of mossy bark dusted with silver-blue feathers! A soft starry chime drifts down from the branches above... # speaker: Fae # sound: chime-blue
    ~ moon_owl_out = true
    WHOO-WHOO! A huge owl with shimmering starry eyes glides down into the clearing and stares right over its shoulder! # speaker: Fae
    -> DONE
}
{calmed("moon-owl"):
    The mossy moon perch glows softly with fallen stardust. Starry Owl hoots a peaceful hello from nearby! # speaker: Fae
- else:
    Silver-blue feathers flutter around the mossy moon perch while Starey Owl watches the clearing. # speaker: Fae
}
-> DONE

=== moon_owl_calm ===
{moon_owl_calm > 1: -> again}
Hoo-hoo... what a gentle tiptoe, little explorer. # speaker: Starry Owl
A wild purple breeze rattled my treetop nest after a kid in a purple hood raced through the pines, and everything turned blurry and bright. # speaker: Starry Owl
Standing still under the stars together calmed my ruffled feathers right down. # speaker: Starry Owl
Please take this shimmering Moon Feather for your woodland clubhouse chest! # speaker: Starry Owl # sound: chime-blue
Whoa, it sparkles like tiny constellations! Thank you, Starry Owl! # speaker: Fae
If you listen closely at twilight, the breeze carries warm cinnamon and crispy taco spices drifting up from Clover Hills to the south! # speaker: Starry Owl
-> DONE
= again
Hoo-hoo! Walk softly under the pines, Fae. Your tiptoe steps are the quietest in all the woods! # speaker: Starry Owl
-> DONE

=== mist_closed ===
A little dirt path winds off between the misty trees. Something purple is tucked beside the old stump. # speaker: Fae
-> DONE

=== mist_flowers ===
{found_mist_way: -> again}
Under the lantern's violet beam, tiny silver runes wake up inside the bluebells! # speaker: Fae # expr: surprised # sound: chime-blue # zoom: 1.09
They are showing hidden stepping stones right through the lavender mist! # speaker: Fae # expr: determined
{jordan_joined: Jordan grins. "Grandma's lantern found the secret rune path! One stone at a time!" # speaker: Jordan # expr: happy}
Mrrrow! Maddie's whiskers glow soft lavender as she hops onto the first stone. # speaker: Maddie # expr: happy
~ found_mist_way = true
Fae follows the glowing bluebell runes across the mist, stone by shimmering stone! # speaker: Fae # expr: happy # travel: mist.stones
-> DONE
= again
The bluebell runes still shimmer along the safe stepping stones through the mist. # speaker: Fae # expr: happy
-> DONE

=== mist_band ===
{found_mist_way: The bluebell stepping stones are glowing through the mist. I can hop right across now!|The lavender mist is too thick to see through. Maybe my blacklight lantern can show hidden runes.} # speaker: Fae
-> DONE

=== gully_bridge ===
{rope_bridge: The old rope bridge stretches safely across the misty gully now. # speaker: Fae # expr: happy}
{rope_bridge: -> DONE}
The gully is deep and misty, with two mossy posts on this side. # speaker: Fae # expr: worried
{not has_lasso: A thorny mist-veil coils round a rolled-up bridge on the far posts. If only I had a rope! # speaker: Fae # expr: worried}
{not has_lasso: -> DONE}
A thorny mist-veil coils around the far posts, holding the old rope bridge shut! # speaker: Fae # expr: determined
{sue_joined: Coach Ash's rainbow lasso can reach across! Give it a real smooth twirl, Fae! # speaker: Sue # expr: determined}
Fae whips her rainbow lasso across the gully, hooks the far post, and pulls! # speaker: Fae # expr: determined # sound: chime-yellow # shake: 0.35
~ rope_bridge = true
The thorny veil parts in pastel sparks as the old rope bridge rolls across with a creak! # speaker: Fae # expr: happy # sound: chime-green
-> DONE

=== mist_seal ===
{seal_open: The forest glows warmly beyond the bell-flower arch. # speaker: Fae # expr: happy}
{seal_open: -> DONE}
{not has_flute: Three bell flowers hum softly beside carved runes: red, yellow-green, and blue. What song are they waiting for? # speaker: Fae # expr: surprised}
{not has_flute: -> DONE}
~ mist_notes = 0
~ mist_right = true
~ mist_tune = ""
The bell flowers shimmer with the lantern's runes. The class song colours will wake them! # speaker: Fae # expr: determined # zoom: 1.08
-> mist_bells
= mist_bells
+ [Red] -> mist_red
+ [Yellow] -> mist_yellow
+ [Green] -> mist_green
+ [Blue] -> mist_blue
+ [Stop] -> DONE
= mist_red
~ mist_notes += 1
{mist_notes != 1 and mist_notes != 4:
    ~ mist_right = false
}
A red bell flower rings{mist_notes == 4:!|...} # speaker: Fae # sound: flute-red
-> mist_next
= mist_yellow
~ mist_notes += 1
{mist_notes != 2:
    ~ mist_right = false
}
A yellow-green bell flower rings{mist_notes == 4:!|...} # speaker: Fae # sound: flute-yellow
-> mist_next
= mist_green
~ mist_notes += 1
~ mist_right = false
Fae plays a green note. No bell answers. # speaker: Fae # sound: flute-green
-> mist_next
= mist_blue
~ mist_notes += 1
{mist_notes != 3:
    ~ mist_right = false
}
A blue bell flower rings{mist_notes == 4:!|...} # speaker: Fae # sound: flute-blue
-> mist_next
= mist_next
{mist_notes < 4: -> mist_bells}
{mist_right:
  That's it! \{color:berry\}Red\{/color\}, \{color:gold\}yellow\{/color\}, \{color:teal\}blue\{/color\}, \{color:berry\}red\{/color\}! All three bell flowers sing in harmony! # speaker: Fae # expr: happy # sound: chime-yellow # zoom: 1.12
  Lantern runes, rainbow lasso sparks, and flute music weave together in the air! # speaker: Fae # expr: surprised # sound: chime-blue # shake: 0.25
  Glowing fairies swirl awake beyond the arch, lighting an ancient mossy path! # speaker: Fae # expr: happy # sound: chime-green
  The mist wall parts, and a warm forest glow shines through the arch. # speaker: Fae # expr: happy
  ~ seal_open = true
  {sue_joined: Whoa... look at those glowing fairies! Ready whenever you are, Fae! # speaker: Sue # expr: surprised}
  {jordan_joined: We made it all the way to the Enchanted Forest. Together! # speaker: Jordan # expr: happy}
- else:
  The bells give a gentle wobble. They only ring for a song I already know... # speaker: Fae # expr: worried
}
-> DONE

=== mystic_pond ===
{milo_revealed:
    The Mystic Pond shimmers clear and golden again, reflecting drifting fairy petals. # speaker: Fae # expr: happy
    -> DONE
}
The Mystic Pond is fizzing bright purple, smelling just like the clubhouse soda. # speaker: Fae # expr: worried
{heard_wish: This is where wishes come true. The fairies said someone drank from it after making a wish. # speaker: Fae # expr: worried}
{heard_wish: Deep beneath the fizz, golden ripples are still trying to shine through. # speaker: Fae # expr: determined}
-> DONE

=== ancient_tree ===
{milo_revealed:
    Golden-pastel light pours softly through the Ancient Tree's leaves. The whole forest breathes easy. # speaker: Fae # expr: happy
    -> DONE
}
Tangled purple scribbles twist all the way up the Ancient Tree's warm bark. # speaker: Fae # expr: worried
It looks tired, like a painting someone tried too hard to scribble over. # speaker: Fae # expr: worried
{heard_wish: If it's dreaming the whole land, it can't dream properly with all this fizz. # speaker: Fae # expr: determined}
-> DONE

=== fairy_lavender ===
~ heard_wish = true
{
- milo_revealed:
    The Ancient Tree is dreaming golden dreams again, Fae! Thank you for bringing back its peace. # speaker: Lavender Fairy
    {
    - sanctuary_reward_14:
        Even your Sanctuary Clover Wreath shimmers like the meadow's gentlest fairy light! # speaker: Lavender Fairy
    - sunberry_harvests > 0:
        And Golden Sunberries from your garden? The forest remembers kindness grown with care! # speaker: Lavender Fairy
    }
- else:
    This is the Enchanted Forest. The Ancient Tree dreams the whole land. # speaker: Lavender Fairy
    The Mystic Pond grants wishes. A kid in a purple hood made a wish and drank from it. # speaker: Lavender Fairy
    Then everything went fizzy and purple, with scribbles everywhere. The Ancient Tree can't dream properly with all that fizz! # speaker: Lavender Fairy
}
-> DONE

=== fairy_mint ===
{
- milo_revealed and sanctuary_reward_14:
    The butterflies loop softly again, and they adore your Sanctuary Clover Wreath! "Again!" # speaker: Mint Fairy
- milo_revealed:
    The butterflies are looping softly through the glade again! No more purple fizz! "Again!" # speaker: Mint Fairy
- else:
    The butterflies keep tickling my wings. I keep telling them, "Again!" # speaker: Mint Fairy
}
-> DONE

=== fairy_sky ===
{
- milo_revealed and gem_reward_all:
    Your calm kindness healed the Ancient Tree, and all seven Star Gems sing with its light! # speaker: Sky Fairy
- milo_revealed:
    Even the Ancient Tree remembers a kindness as calm and steady as yours, Fae. # speaker: Sky Fairy
- else:
    The Ancient Tree is older than every tree, even the trees that think they are very old. # speaker: Sky Fairy
}
-> DONE

=== fairy_peach ===
{
- milo_revealed:
    Hee hee! The pond bubbles are gentle stardust again instead of squeaky purple fizz! # speaker: Peach Fairy
- else:
    Hee hee! The pond bubbles made my shoes go squeak. # speaker: Peach Fairy
}
-> DONE

=== kid_talk_1 ===
You don't even know who I am! Just leave the \{color:lavender\}BOSS\{/color\} alone! # speaker: Hooded Kid
* [You beat Star Racer, then scribbled your initials in purple marker!]
    {calmed("art-teacher"): ...You matched Ms. Rowan's missing purple markers to Star Racer?!|{saw_hood: ...You matched the purple marker I dropped in the hall to Star Racer?!|...You figured THAT out?!}} # speaker: Hooded Kid # grade: great
    -> DONE
* [You left a Star Racer token and purple markers in your stump stash.]
    Maybe. Lots of kids play Star Racer. # speaker: Hooded Kid # grade: good
    -> DONE
* [You're the boss of the whole Enchanted Forest!]
    Ha! I WISH. ...Wait. That's kind of what I wished for. # speaker: Hooded Kid # grade: miss
    -> DONE
-> DONE

=== kid_talk_2 ===
\{whisper\}Nobody ever notices me anyway... not really.\{/whisper\} # speaker: Hooded Kid
* [I notice you! Your paper planes, rocket doodles, and star sketches!]
    {milo_loft_glow_read: ...You even saw my rocket sketches? You didn't laugh at them?|{club_open: ...You saw the school name tag and my star doodles, and still came to find me?|...You actually saw my paper planes and star doodles?}} # speaker: Hooded Kid # grade: great
    -> DONE
* [Everybody across Cloverhollow noticed all the purple scribbles.]
    Making a mess isn't the same as somebody wanting to hang out... # speaker: Hooded Kid # grade: good
    -> DONE
* [Maybe nobody likes purple hoodies?]
    Hey! Purple is the BEST color, okay?! # speaker: Hooded Kid # grade: miss
    -> DONE
-> DONE

=== kid_talk_3 ===
\{whisper\}If you really know me, Fae... then say it. Who am I?\{/whisper\} # speaker: Hooded Kid
* [Milo? You don't have to hide under that hood.]
    \{pause:8\}...Yeah. \{whisper\}It's me, Fae.\{/whisper\} # speaker: Hooded Kid # grade: great
    -> DONE
* [My classmate from Ms. Maple's room, the Star Racer fan!]
    Warmer... you're right there. Say my name. # speaker: Hooded Kid # grade: good
    -> DONE
* [Rosie?]
    Nope! Rosie's way better at flying kites than me. # speaker: Hooded Kid # grade: miss
    -> DONE
-> DONE

=== milo_calm ===
{ milo_revealed: -> again }
~ milo_revealed = true
Milo slowly pulls back the purple hood and wipes his eyes on his sleeve. # speaker: Milo # expr: worried # zoom: 1.12
Fae... it's me. I'm really sorry about all the scribbles and all the fizz. # speaker: Milo # expr: worried
My paper plane drifted into the mist, so I chased it here and found the Mystic Pond. # speaker: Milo # expr: worried
\{whisper\}Everyone in class always seemed so good at something, and I felt like I was getting left behind.\{/whisper\} # speaker: Milo # expr: worried
So I wished to be the best at everything, even Star Racer, and drank from the pond. # speaker: Milo # expr: worried
Fizz-fast, I zipped from class to the hall and back before anyone blinked... but I just made everyone stressed. # speaker: Milo # expr: worried
\{whisper\}I only wanted someone to notice me.\{/whisper\} # speaker: Milo # expr: worried
I always notice you, Milo. You're my friend, not because of high scores, just because you're you. # speaker: Fae # expr: happy # sound: chime-yellow
{milo_loft_glow_read: Your rocket sketches are amazing too. You never have to worry about being left behind. # speaker: Fae # expr: happy}
Mrrrow-purrrr! Maddie trots right over and rubs her soft cheek against Milo's sneaker! # speaker: Maddie # expr: happy
{sue_joined: Sue smiles warmly and waves. "We noticed you too, Milo. Come fish at the bay with us sometime!" # speaker: Sue # expr: happy}
{jordan_joined: Jordan grins. "You don't have to be the best at everything. Our clubhouse always has room for one more." # speaker: Jordan # expr: happy}
\{pause:8\}Milo blinks through a wobbly smile. "Wait... really? Even after all the purple soda?" # speaker: Milo # expr: surprised
Really. Look up! # speaker: Fae # expr: happy # sound: chime-green # zoom: 1.04
High above them, the Ancient Tree bursts into \{color:gold\}\{wave\}golden-pastel watercolor light\{/wave\}\{/color\}! # speaker: Fae # expr: happy # sound: chime-blue
-> DONE
= again
The Ancient Tree is blooming in warm golden light. The whole forest feels like a gentle hug. # speaker: Fae # expr: happy
// Sticky: the dream save is taken as the ending starts, so Continue comes back
// here with the ending ready to watch again.
+ [Watch the tree glow]
    Milo looks up as petals drift like morning sunbeams. "Wait... do you hear that?" # speaker: Milo # expr: surprised
    -> tree_ending
+ [Not yet]
    Not yet. We can stay here a little longer. # speaker: Fae # expr: happy
-> DONE
= epilogue_tree_ending
The Ancient Tree glows brighter and warmer, bathing Cloverhollow in \{color:gold\}\{wave\}golden-pastel light\{/wave\}\{/color\}. # speaker: Fae # expr: surprised # sound: chime-yellow # zoom: 1.1
Milo, Sue, Jordan, and Maddie smile through drifting clover petals... # speaker: Fae # expr: happy
\{whisper\}...Fae? Sweetie? Time to wake up...\{/whisper\} # speaker: Mom # expr: happy # sound: chime-blue
The golden light wraps around everything, soft and bright as morning sunshine. # speaker: Fae # expr: happy # ending
-> DONE
= morning_mom
{morning_mom > 1: -> morning_mom_again}
Fae! Wake up, sleepyhead! Sunlight's all over your quilt, and you'll be late for school! # speaker: Mom # expr: happy
...Mom? Wait, the Ancient Tree, the lantern, and Milo... it was all a dream? # speaker: Fae # expr: surprised
Must've been a big one! You were smiling in your sleep while Maddie purred by your pillow. # speaker: Mom # expr: happy
Blueberry pancakes are warm downstairs, and Oliver's already clapping at the kitchen drawings! # speaker: Mom # expr: happy
Oh, and your classmate Milo just stopped by! He's waiting downstairs by the front door! # speaker: Mom # expr: happy
Grab your backpack whenever you're ready, sweetie. Take a peek around your room if you like! # speaker: Mom # expr: happy
-> DONE
= morning_mom_again
Milo's waiting by the front door, sweetie. Have fun at school! # speaker: Mom # expr: happy
-> DONE
= morning_desk
My sketchbook lies open on the desk, the watercolour paint still softly curled on the page! # speaker: Fae # expr: surprised
There's a cozy frog by a fountain, a bay dock, snowy pines, and a glowing golden tree with fairies! # speaker: Fae # expr: happy # sound: chime-yellow
{sue_joined or jordan_joined: Even Sue and Jordan are doodled in the margin, laughing right beside Maddie! # speaker: Fae # expr: happy}
Maybe the best dreams come straight out of our own sketchbook. # speaker: Fae # expr: happy
-> DONE
= morning_journal
My brown leather journal sits tucked under my pillow, warm from the morning sun. # speaker: Fae # expr: happy
Every page is full of clover doodles, star maps, and little notes about my friends. # speaker: Fae # expr: happy
-> DONE
= morning_cat_bed
Maddie's round bed is empty. She's already padding at my heels, purring loud enough to shake the floorboards! # speaker: Fae # expr: happy
Mrrrow-purrrr! Maddie blinks slowly up at Fae with her tail curled like a happy question mark. # speaker: Maddie # expr: happy
-> DONE
= morning_breakfast
Warm blueberry pancakes, sunny maple syrup, and Oliver's tiny silver spoon. Morning smells wonderful! # speaker: Fae # expr: happy
-> DONE
= morning_fridge
My watercolor paintings cover the fridge: a sparkling fountain, snowy pines, and a sunlit four-leaf clover! # speaker: Fae # expr: happy
-> DONE
= morning_oliver
Oliver giggles, waves his chubby hands at Maddie, and points right at the fridge drawings! # speaker: Oliver
A glowing golden tree, tiny fairies, and one silly purple scribble... he remembers too! # speaker: Fae # expr: happy
-> DONE
= front_door_notice
Milo's right here by the front door in his purple hoodie. I should say hi first! # speaker: Fae # expr: happy
-> DONE
= epilogue_front_door
Milo stands in the sunny doorway in his real purple hoodie, hugging a rocket sketchbook to his chest. # speaker: Fae # expr: surprised # zoom: 1.08
Morning, Fae! Your mom let me in, and Maddie already gave my shoe a five-star headbutt! # speaker: Milo # expr: happy
Milo grins shyly and lifts his sketchbook. "Want to walk to school together? I had the \{pop\}WEIRDEST\{/pop\} dream..." # speaker: Milo # expr: happy
Let me guess: a glowing forest, a rocket doodle, and a purple hood? # speaker: Fae # expr: happy
\{pop\}Wait, how did you know?!\{/pop\} I literally just sketched that golden tree before breakfast! # speaker: Milo # expr: surprised # sound: chime-yellow
Mrrrow! Maddie trots toward the open front door, ready to lead the way down the clover lane! # speaker: Maddie # expr: happy
Maybe some dreams are even brighter when you share them with friends. Let's go, Milo! # speaker: Fae # expr: happy # sound: chime-green # credits
-> DONE

=== festival_milo ===
{festival_milo_talked: -> again}
~ festival_milo_talked = true
Hey Fae! Look—I brought my open watercolor sketchbook right up to the checkered picnic blanket! # speaker: Milo # sound: chime-yellow
I'm drawing Pond Pup, Ribbon Bunny, and your whole crew hanging out in the sunny clover! # speaker: Milo
{milo_loft_visited: Thanks for dropping by my Sketch Loft too! Seeing my rocket comics on the corkboard felt awesome. # speaker: Milo}
{sue_joined or jordan_joined: Next time we play Star Racer at the arcade, I'm playing fair and square! # speaker: Milo}
-> DONE
= again
My watercolors look way brighter in alpine sunshine than purple fizz ever did! # speaker: Milo
{milo_loft_visited: Thanks for dropping by my Sketch Loft too! Any time you want to trade comics, come on over! # speaker: Milo}
{sue_joined or jordan_joined: Next time we play Star Racer at the arcade, I'm playing fair and square! # speaker: Milo}
-> DONE

=== festival_rosie ===
{festival_rosie_gift: -> again}
~ festival_rosie_gift = true
Hi Fae! I'm weaving sunlit pressed-clover festival garlands for every critter in the meadow! # speaker: Rosie
Here—take a cold glass of Clover Festival Lemonade I mixed with fresh meadow mint! # speaker: Rosie # gift: snack 1 # sound: chime-green
{rosie_cottage_visited: I brought extra pressed blooms from my Flower Cottage so every critter gets a sunny crown! # speaker: Rosie}
-> DONE
= again
Look how happy all the critters look wearing tiny clover garlands in the sunshine! # speaker: Rosie
{rosie_cottage_visited: Visiting my Flower Cottage gave me the idea for our festival ribbons—thank you, Fae! # speaker: Rosie}
-> DONE

=== festival_dad ===
~ temp count = sanctuary_count()
~ festival_dad_talked = true
Whoa, look at this sunlit valley view, kiddo! Your courage and kindness brought all of Cloverhollow together! # speaker: Dad
{count > 0: Look at all {count} calm critters napping in the clover! Not a single fizzy bubble in sight! # speaker: Dad|What a peaceful alpine meadow—not a single fizzy bubble anywhere in sight! # speaker: Dad}
Chef Mateo even sent up a warm basket of Clover Hills fiesta tacos for the picnic! # speaker: Dad
-> DONE

=== festival_chef ===
~ festival_chef_talked = true
Welcome to the picnic spread, Fae! I baked warm honey-clover tarts fresh beside the basket! # speaker: Chef Bea
You, Dad, Grandpa Barnaby, and Ranger Fern make the finest valley team I've ever seen! # speaker: Chef Bea
+ [Sample a warm honey-clover festival tart!]
    Ooh, crisp golden pastry and wildflower honey! Best festival treat in Cloverhollow! # speaker: Fae # sound: chime-yellow
    Mrrrow-purrrr! Maddie nibbles a tiny golden crust crumb and bumps Fae's knee happily! # speaker: Maddie
    Haha, a five-star purr from Maddie! Help yourself to another whenever you like! # speaker: Chef Bea
    -> DONE
+ [Chat about the festival]
    Every table at Bon Appetit Cafe is buzzing with stories of your Sunny Cloverhollow adventure! # speaker: Chef Bea
    Go raise a toast with Ranger Fern whenever you're ready, star explorer! # speaker: Chef Bea
    -> DONE

=== club_visit_sue ===
Hey Fae! I climbed up the ladder with a thermos of cold bay lemonade and my favorite tide-pool stories! # speaker: Sue
{sue_compass: Seeing my Sea-Glass Compass gleaming up here makes the whole clubhouse feel breezy like Bubblegum Bay! # speaker: Sue}
{bay_boat_charm: Next sunny afternoon, let's row our pastel boat back out to Starlight Island for a picnic! # speaker: Sue}
{milo_revealed: Having the whole valley calm again means we finally have time to just hang out and read comics! # speaker: Sue|This clubhouse is already the coolest secret headquarters in Whispering Woods! # speaker: Sue}
-> DONE

=== club_visit_jordan ===
Hey Fae! I popped up to check on our deck planter boxes and sketch the clouds through the treehouse railing. # speaker: Jordan
{garden_ripe: Whoa, the strawberries on the deck are bright red and ready to pick! # speaker: Jordan|{garden_planted: Our strawberry sprouts are soaking up all this calm woodland sunshine! # speaker: Jordan}}
{jordan_clover: Seeing my grandma's Pressed Alpine Clover hanging on our clubhouse wall makes me grin every time! # speaker: Jordan}
{milo_revealed: Now that Milo's part of our crew too, we're going to need an even bigger comic stack! # speaker: Jordan|Nothing beats a treehouse breeze after hiking down from Pinecone Pass! # speaker: Jordan}
-> DONE

=== club_visit_milo ===
Hey Fae! Thanks for letting me hang out in the clubhouse again... it feels way cozier without any purple fizz! # speaker: Milo
I brought my fresh watercolor sketchbook and a stack of superhero cat comics for the crate. # speaker: Milo
{milo_loft_visited: Thanks for checking out my Sketch Loft back in town, too—we should trade comic ideas right here on the beanbag! # speaker: Milo}
{festival_toast_done: That Sanctuary Celebration Festival was the best day I've ever had in Cloverhollow. You're the best friend ever, Fae! # speaker: Milo|Next time you decorate the clubhouse walls, save a tiny corner for a starry rocket doodle, okay? # speaker: Milo}
-> DONE

=== club_visit_rosie ===
Hi Fae! I climbed up with a basket of pressed meadow clover for our clubhouse scrapbook! # speaker: Rosie
{kite_returned: My kite's ribbon bow looks SO cute tucked inside your treasure chest—thank you again for lassoing it down! # speaker: Rosie}
{rosie_cottage_visited: Visiting my Flower Cottage gave me tons of cozy decorating ideas for your treehouse walls! # speaker: Rosie}
{garden_planted: Your strawberry planters out on the deck smell just like summer sunshine! # speaker: Rosie}
{milo_revealed: Everyone in Cloverhollow feels lighter and happier now. I'm so glad we're clubhouse neighbors! # speaker: Rosie|Can I come help water the deck flowers whenever you're out exploring? # speaker: Rosie}
-> DONE

=== club_visit_barnaby ===
Ah, hello there, young Fae! These old knees still manage a clubhouse ladder just fine when there's chamomile tea waiting! # speaker: Grandpa Barnaby
What a splendid little sanctuary you and your friends have built among the Whispering Woods pines. # speaker: Grandpa Barnaby
{gem_reward_all: My word, seeing that Rainbow Star Geode sparkling with all seven Star Gems warms an old storyteller's heart! # speaker: Grandpa Barnaby|{gem_count() > 0: Keep shining that lantern across the valley, Fae—every Star Gem carries a piece of Cloverhollow's magic! # speaker: Grandpa Barnaby}}
{milo_revealed: You brought peace all the way to the Ancient Tree itself. Future explorers will tell stories about your kindness! # speaker: Grandpa Barnaby|Mind you keep plenty of cozy treats stocked for the road, my young adventurer! # speaker: Grandpa Barnaby}
-> DONE

=== club_visit_fern ===
Howdy, Fae! I swung over from the Wildlife Sanctuary to trade critter field notes in your treehouse! # speaker: Ranger Fern
{sanctuary_reward_14: That woven Sanctuary Clover Wreath looks right at home on your clubhouse wall—the whole room smells like alpine meadows! # speaker: Ranger Fern}
{stickers() >= 10: Flipping through your sticker journal is like reading a love letter to every critter in Cloverhollow! # speaker: Ranger Fern}
{festival_toast_done: Our Sunny Cloverhollow Jubilee was one for the record books—every critter in the meadow is still snoozing happily! # speaker: Ranger Fern|Drop by the Wildlife Sanctuary anytime your friends want to visit calm critters in the clover! # speaker: Ranger Fern}
-> DONE
