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
The bluebells glow in a little line toward the lavender mist. # speaker: Fae
They are showing stepping stones! I can hop across, one stone at a time. # speaker: Fae
~ found_mist_way = true
Fae hops across the mist, stone by stone. # speaker: Fae # travel: mist.stones
-> DONE
= again
The bluebells still glow along the safe path through the mist. # speaker: Fae
-> DONE

=== mist_band ===
{found_mist_way: The stepping stones are glowing in the mist. I can follow them now!|The lavender mist is too thick to see through. Maybe something can show me the way.} # speaker: Fae
-> DONE

=== gully_bridge ===
{rope_bridge: The old rope bridge is pulled across the gully now. # speaker: Fae}
{rope_bridge: -> DONE}
The gully is deep and misty, with two little posts on this side. # speaker: Fae
{not has_lasso: The far posts have a rolled-up bridge. If only I had a rope! # speaker: Fae}
{not has_lasso: -> DONE}
Fae loops her lasso over the far post and pulls. # speaker: Fae
~ rope_bridge = true
The old rope bridge rolls across the gully with a soft creak. Now there is a way through! # speaker: Fae
-> DONE

=== mist_seal ===
{seal_open: The forest glows warmly beyond the bell-flower arch. # speaker: Fae}
{seal_open: -> DONE}
{not has_flute: Three bell flowers hum softly: red, yellow-green, and blue. Some notes are missing... what song are they waiting for? # speaker: Fae}
{not has_flute: -> DONE}
~ mist_notes = 0
~ mist_right = true
~ mist_tune = ""
The bell flowers are waiting for a tune. The class song colours might help! # speaker: Fae
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
  That's it! Red, yellow, blue, red! The bell flowers ring together. # speaker: Fae
  The mist wall parts, and a warm forest glow shines through the arch. # speaker: Fae
  ~ seal_open = true
- else:
  The bells give a gentle wobble. They only ring for a song I already know... # speaker: Fae
}
-> DONE

=== mystic_pond ===
The Mystic Pond is fizzing purple, just like the clubhouse soda. # speaker: Fae
{heard_wish: This is where wishes come true. The fairies said someone drank from it after making a wish. # speaker: Fae}
-> DONE

=== ancient_tree ===
Purple scribbles are all over the Ancient Tree's bark. # speaker: Fae
It looks tired. # speaker: Fae
{heard_wish: If it's dreaming the whole land, it can't dream properly with all this fizz. # speaker: Fae}
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
You don't even know who I am! # speaker: Hooded Kid
* [You beat the Star Racer high score, then scribbled out your initials.]
    ...You figured THAT out? # speaker: Hooded Kid # grade: great
    -> DONE
* [You left a Star Racer token in your stash.]
    Maybe. Lots of kids play Star Racer. # speaker: Hooded Kid # grade: good
    -> DONE
* [You're the boss of the whole forest!]
    Ha! I WISH. ...Wait. That's kind of what I wished for. # speaker: Hooded Kid # grade: miss
    -> DONE
-> DONE

=== kid_talk_2 ===
Nobody ever notices me anyway... # speaker: Hooded Kid
* [I notice you! The paper planes, the star doodles...]
    You... you saw those? # speaker: Hooded Kid # grade: great
    -> DONE
* [Everybody noticed the scribbles.]
    That's not the same thing. # speaker: Hooded Kid # grade: good
    -> DONE
* [Maybe nobody likes purple?]
    Hey! Purple is the BEST color. # speaker: Hooded Kid # grade: miss
    -> DONE
-> DONE

=== kid_talk_3 ===
So go on, Fae. Who am I? # speaker: Hooded Kid
* [Milo?]
    ...Yeah. It's me. # speaker: Hooded Kid # grade: great
    -> DONE
* [Someone from my class.]
    Warmer... but who? # speaker: Hooded Kid # grade: good
    -> DONE
* [Rosie?]
    Nope! Rosie's way better at kites than me. # speaker: Hooded Kid # grade: miss
    -> DONE
-> DONE

=== milo_calm ===
{ milo_revealed: -> again }
~ milo_revealed = true
Fae... it's me. I'm really sorry about all the scribbles. # speaker: Milo
My paper plane flew into the mist, so I followed it. I found this forest and wished at the Mystic Pond to be the best at everything, even Star Racer. # speaker: Milo
I drank from the pond, and the fizz got out of hand. Fizz-fast, I could zip from our classroom to the hall and back before anyone noticed. That's how I peeked in, then sat back down. # speaker: Milo
I only wanted to be noticed. # speaker: Milo
I always notice you, Milo. You're my friend. # speaker: Fae
{sue_joined: Sue gives Milo a small wave. "We noticed you too." # speaker: Sue}
{jordan_joined: Jordan smiles. "You don't have to be the best at everything." # speaker: Jordan}
-> DONE
= again
The Ancient Tree is glowing again. It's so pretty now. # speaker: Fae
// Sticky: the dream save is taken as the ending starts, so Continue comes back
// here with the ending ready to watch again.
+ [Watch the tree glow]
    It's like it's... waking up? # speaker: Milo
    -> tree_ending
+ [Not yet]
    Not yet. We can stay here a little longer. # speaker: Fae
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
