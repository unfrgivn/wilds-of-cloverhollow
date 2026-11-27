VAR plan = "none"
VAR ate_breakfast = false
VAR read_notice = false
VAR hall_pass = false
VAR raccoon_waiting = false
VAR knows_password = false
VAR club_open = false
VAR sue_joined = false
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
VAR lifeguard_back = false

VAR art_teacher_out = false
VAR art_open = false
VAR principal_out = false
=== window ===
{plan != "none": -> again}
Morning sun... and something sparkly over the plaza. # speaker: Fae
The fountain is fizzing pink bubbles. That's not normal. # speaker: Fae
* [Go see right now!]
    ~ plan = "now"
    Adventure first. School can wait five minutes! # speaker: Fae
* [School first, then investigate.]
    ~ plan = "later"
    Backpack, socks, teeth. Then I'll investigate. # speaker: Fae
- -> DONE
= again
The fountain is still fizzing. {plan == "now": I'm going to go look!|I'll check it after school.} # speaker: Fae
-> DONE

=== pillow_journal ===
{awake: -> morning_journal}
My journal, right under my pillow where it belongs. # speaker: Fae
{
- plan == "now": Note to self: fizzing fountain. Go look NOW. # speaker: Fae
- plan == "later": Note to self: fizzing fountain. Check after school. # speaker: Fae
- else: Mom and Dad gave it to me when Oliver was born. # speaker: Fae
}
-> DONE
= morning_journal
My journal is full of drawings from the dream. # speaker: Fae
-> DONE

=== desk ===
{My sketchbook! I drew Maddie as a dragon yesterday.|Paints, pencils, and one very chewed eraser.} # speaker: Fae
-> DONE

=== cat_bed ===
Maddie's bed. Still warm, and full of orange fur. # speaker: Fae
-> DONE

=== notice_board ===
~ read_notice = true
CLOVERHOLLOW NEWS: The fountain is fizzing! # speaker: Notice board
Has anyone seen a kid in a purple hood? They ran off from the fountain, giggling. # speaker: Notice board
{
- plan == "now": A kid in a purple hood? I bet that's who did it. # speaker: Fae
- else: A kid in a purple hood, fizzing up the fountain? Weird. # speaker: Fae
}
-> DONE

=== journal ===
{parlor_visited: I visited Sweet Scoop Ice Cream Parlor! Scooper Penny whipped up a free Cloverhollow Dream Sundae and scoops Berry Swirl Cones and Cozy Cocoa Sundaes. # speaker: Fae}
{market_visited: I stepped inside Cloverhollow Grocery Market! Grocer Pippin shared a crisp orchard apple sample and stocks Orchard Apples and Fish Crackers for our critter friends. # speaker: Fae}
{jordan_cabin_visited: I visited Jordan's timber cabin along the west trail at Pinecone Pass! He shared hot cocoa and his grandma's Pressed Alpine Clover. # speaker: Fae}
{sue_cottage_visited: I visited Sue's mint-green beach cottage up the cove at Bubblegum Bay! She gave me her Sea-Glass Compass and a tip for catching the Golden Starfish Crown. # speaker: Fae}
{sanctuary_reward_14: Ranger Fern wove me a Sanctuary Clover Wreath for welcoming so many calm critters to the Wildlife Sanctuary! # speaker: Fae}
{sanctuary_visited and not sanctuary_reward_14: I found the Wildlife Sanctuary east of Clover Hills! Ranger Fern looks after every calm animal who visits the meadow. # speaker: Fae}
{bay_boat_charm: I took a pastel rowboat out across Bubblegum Bay and found a shimmering Sea-Glass Clover! # speaker: Fae}
{sanctuary_gift: The Pinecone Pass Wildlife Sanctuary rangers left me a cozy thank-you basket for helping calm the valley's mountain and woodland critters! # speaker: Fae}
{buster_reward: I filled Buster's Star-Line Stamp Card at Bubblegum Bay and Pinecone Pass, and earned his Golden Star-Line Whistle! # speaker: Fae}
{buster_quest and not buster_reward: {stamp_bay and stamp_pass: Both stamps are on Buster's Star-Line Stamp Card! Time to show Buster back at the plaza bus stop.|{stamp_bay: I got the Bubblegum Bay wave stamp on Buster's Star-Line Stamp Card! Next: Pinecone Pass's mountain stand.|{stamp_pass: I got the Pinecone Pass pine stamp on Buster's Star-Line Stamp Card! Next: Bubblegum Bay's seaside stand.|Buster gave me a Star-Line Stamp Card! Collect a wave stamp at Bubblegum Bay and a pine stamp at Pinecone Pass.}}} # speaker: Fae}
{calmed("taco-chef"): I calmed Chef Mateo in Clover Hills by talking about Cloverhollow's taco favorites! He sells crispy taco snacks for 4 coins. # speaker: Fae}
{taco_chef_out and not calmed("taco-chef"): Chef Mateo is fizzy in Clover Hills, waving his wooden spoon over a spicy taco cloud! # speaker: Fae}
{calmed("moon-owl"): I calmed the Starry Owl in Whispering Woods with a quiet game of peekaboo! Its Moon Feather sparkles in our chest. # speaker: Fae}
{moon_owl_out and not calmed("moon-owl"): A huge Starey Owl swooped down in the southeast Whispering Woods clearing! Hold still whenever it watches. # speaker: Fae}
{gem_reward_all: Grandpa Barnaby gifted me his Rainbow Star Geode for finding all seven Star Gems across Cloverhollow! # speaker: Fae}
{gem_count() > 0 and not gem_reward_all: I've found {gem_count()} of Cloverhollow's 7 Star Gems! Grandpa Barnaby at Bon Appetit Cafe loves hearing about them. # speaker: Fae}
{bunny_friend: Ribbon Bunny is my friend! When I play my flute, she comes hopping right over. # speaker: Fae}
{spice_returned: I found Chef Bea's Star Cinnamon tin in Meadow Park and earned a golden Bon Appetit Star Pin! # speaker: Fae}
{spice_found and not spice_returned: I found Chef Bea's Star Cinnamon tin in Meadow Park! Time to bring it back to Bon Appetit Cafe. # speaker: Fae}
{spice_quest and not spice_found: Chef Bea at Bon Appetit Cafe lost her Star Cinnamon tin in Meadow Park. A fizzy raccoon dropped it near the picnic blanket! # speaker: Fae}
{met_dad: I bumped into Dad at Bon Appetit Cafe! He gave me a warm cinnamon bun and ten coins for my adventure. # speaker: Fae}
{cavern_spring_found: The Pond Pup dove into Crystal Cavern's glowing spring and fetched a pouch of snacks and coins! # speaker: Fae}
{cavern_spring_seen and not cavern_spring_found: Something glints deep in Crystal Cavern's turquoise spring, too deep to reach. # speaker: Fae}
{cavern_chime_rung: I lassoed the golden star chime in Crystal Cavern and caught a shimmering star crystal! # speaker: Fae}
{cavern_chime_seen and not cavern_chime_rung: A golden star chime hangs high in Crystal Cavern's northeast arch, too high to reach. # speaker: Fae}
{cavern_bridge_lit: Reading the glowing fairy mural in Crystal Cavern lit three crystal stepping stones across the stream! # speaker: Fae}
{heard_wish and not calmed("hooded-kid"): The kid in the purple hood is waiting under the Ancient Tree. Their wish made all this fizz! # speaker: Fae}
{calmed("hooded-kid"): The kid in the purple hood was MILO! He wished to be the best at everything, and the fizz got out of hand. # speaker: Fae}
{heard_wish: The fairies told me the Ancient Tree dreams the whole land, and a wish made the Mystic Pond fizz purple. # speaker: Fae}
{seal_open: The bell-flower seal opened, and a warm forest glow shone beyond the stones. # speaker: Fae}
{rope_bridge: I pulled the old rope bridge across the misty gully with my lasso. # speaker: Fae}
{found_mist_way: Bluebells lit stepping stones through the mist, one hop at a time! # speaker: Fae}
{acorn_found: The Acorn Squirrel climbed the big oak in the woods and found a golden acorn in its knothole! # speaker: Fae}
{knothole_seen and not acorn_found: There's a knothole high up the big oak in the woods. Something rattles inside! # speaker: Fae}
{squirrel_friend: The Acorn Squirrel is my friend! When I play my flute, he comes scampering. # speaker: Fae}
{pond_tin: The Pond Pup swam out into the park pond and fetched an old tin of coins! # speaker: Fae}
{pond_seen and not pond_tin: Something glints at the bottom of the park pond, too far out to reach. # speaker: Fae}
{pup_friend: The Pond Pup is my friend! When I play my flute, he comes running. # speaker: Fae}
{sunberry_harvests > 0: Our clubhouse garden bloomed with magical Golden Sunberries! They restore energy and calm critters with meadow light. # speaker: Fae}
{fridge_baskets > 0: There are cold strawberries in the clubhouse fridge: snacks for the road! # speaker: Fae}
{garden_ripe: The strawberries on the clubhouse deck are ripe! # speaker: Fae}
{calmed("lodge-keeper"): I calmed Mrs. Flurry, the lodge keeper at Pinecone Pass. Her lodge is open, and the fire's lit! # speaker: Fae}
{calmed("principal"): I calmed Mr. Bell, the principal! Morning announcements sound like morning again. # speaker: Fae}
{principal_out and not calmed("principal"): Mr. Bell the principal is fizzy in the hall, blaring announcements at everybody! # speaker: Fae}
{calmed("art-teacher"): I calmed Ms. Rowan, the art teacher. Her room is open, and every purple marker is missing! # speaker: Fae}
{art_teacher_out and not calmed("art-teacher"): Ms. Rowan is fizzy in the east hall, swishing wild purple paint. # speaker: Fae}
{keeper_back and not calmed("lodge-keeper"): The lodge keeper at Pinecone Pass is fizzy, and flinging snowballs from her porch! # speaker: Fae}
{calmed("lifeguard"): I calmed Ms. Coral, the lifeguard at Bubblegum Bay. She shared her watermelon! # speaker: Fae}
{lifeguard_back and not calmed("lifeguard"): The lifeguard at Bubblegum Bay is fizzy, and blowing her whistle at everyone! # speaker: Fae}
{has_nuggets: I've got a box of dino nuggets. To the clubhouse microwave! # speaker: Fae}
{has_mac: I've got a box of mac n cheese. To the clubhouse microwave! # speaker: Fae}
{has_microwave and not (has_nuggets or has_mac): Mom's freezer has dino nuggets and mac n cheese for the clubhouse microwave. # speaker: Fae}
{has_chest: Mom gave our club her old toy chest. My treasures from my adventures are in it! # speaker: Fae}
{kite_returned: I lassoed Rosie's kite down from the park's play tower, and she gave me her arcade coins! # speaker: Fae}
{kite_down and not kite_returned: I got Rosie's kite down from the play tower. I should take it back to her at school. # speaker: Fae}
{kite_seen and not kite_down: A kite is tangled on top of the park's play tower. My lasso could reach it! # speaker: Fae}
{treasure_found: I dug up pirate treasure on the beach! # speaker: Fae}
{has_map and not treasure_found: A bottle by Sue's dock had a treasure map in it. X marks the spot between the two palms by the big log! # speaker: Fae}
{bottle_seen and not has_map: A bottle with a paper inside is bobbing past the end of Sue's dock. # speaker: Fae}
{scarf_returned: I lassoed the cocoa seller's scarf off the ski lift. Free cocoa! # speaker: Fae}
{scarf_down and not scarf_returned: I got a red scarf down from the ski lift. It smells like cocoa... # speaker: Fae}
{scarf_seen and not scarf_down: A red scarf is caught on a ski-lift chair at Pinecone Pass. # speaker: Fae}
{bridge_down: I pulled the old footbridge's lever with the lasso, and the bridge swung down across the creek! # speaker: Fae}
{stash_found: The hooded kid's stash is behind the old stump: purple markers, fizzy soda, and a Star Racer token. # speaker: Fae}
{swung and not bridge_down: I swung across the creek on the lasso! There's a lever up on the old footbridge's post. # speaker: Fae}
{recess and not calmed("oak-squirrel"): A fizzy squirrel is pelting acorns from the old oak by the creek. # speaker: Fae}
{recess and not swung: Recess! The kid in the purple hood ran out to the playing field. The old oak's branch reaches across the creek... # speaker: Fae}
{has_flute: Ms. Willow gave me her very first flute! When I play it, animal friends come running. # speaker: Fae}
{heard_bird and not has_flute: The bluebird sang a note just like the red bar. Maybe that's the song's last note! # speaker: Fae}
{calmed("music-bird") and not has_flute: The bluebird gave back Ms. Willow's chime mallet. # speaker: Fae}
{music_quest and not calmed("music-bird"): A bluebird took Ms. Willow's chime mallet. Maybe a kind word will calm it down. # speaker: Fae}
{song_start and not has_flute: The class song goes red, yellow, blue... and the last note is under the purple scribbles. # speaker: Fae}
{music_quest and not has_flute: The kid in the purple hood climbed in through the music room window and scribbled on the class song. # speaker: Fae}
{music_time and not music_quest: Music class is next! Ms. Willow's music room is down the east hall. # speaker: Fae}
{coach_thanked: Coach Ash gave me his lasso! It can pull down things that are up high, and maybe swing across gaps too. # speaker: Fae}
{gym_quest and not coach_thanked and calmed("gym-pup") and found_clipboard: I found Coach Ash's stopwatch and his clipboard! Back to Coach Ash. # speaker: Fae}
{gym_quest and not calmed("gym-pup"): A fizzy pup is zooming around the gym with Coach Ash's stopwatch. # speaker: Fae}
{gym_quest and not found_clipboard: {has_lasso:Coach Ash lent me his lasso, to get his clipboard down from the hoop.|{saw_clipboard:Coach Ash's clipboard is stuck on the basketball hoop. It's too high to reach!|Coach Ash's clipboard went flying, somewhere up high.}} # speaker: Fae}
{gym_quest: The kid in the purple hood knocked over Coach Ash's cart, then ran out the back door to the playing field. # speaker: Fae}
{pe_time and not gym_quest: Time for PE! The gym is down the east hall. # speaker: Fae}
{saw_hood and gym_hall and not pe_time: The gym doors are locked during story time. Ms. Maple will know when it's over. # speaker: Fae}
{saw_hood: A kid in a purple hood ran off toward the gym! They dropped a purple marker, the same purple as the Star Racer scribbles. # speaker: Fae}
{story_time and not saw_hood: Story time! Rosie and Milo are in my class. Maybe somebody saw the kid in the purple hood. # speaker: Fae}
{calmed("arcade-keeper") and not story_time: Ms. Maple said to be back in time for story time. Back to school! # speaker: Fae}
{calmed("arcade-keeper"): Mr. Pip, the arcade keeper, drank a fizzy soda from the kid in the purple hood. The spell works on people too! # speaker: Fae}
{calmed("arcade-keeper"): The hooded kid scribbled out their initials on the Star Racer high score. Someone from school again... # speaker: Fae}
{clubhouse_claimed and not calmed("arcade-keeper"): A note in the clubhouse said "NEXT STOP: THE ARCADE." The arcade is in the plaza, back home. # speaker: Fae}
{garden_planted and not garden_ripe: Jordan planted strawberries on the clubhouse deck. Every critter I calm helps them grow. # speaker: Fae}
{fridge_fixed: Sue fixed the clubhouse's old fridge. It's cold and humming! # speaker: Fae}
{clubhouse_claimed and not (fridge_fixed and garden_planted): The Whispering Woods clubhouse is ours. Sue will fix a fridge, and Jordan will grow a garden. # speaker: Fae}
{found_old_trail: The hooded kid's glowing trail goes west through the pines, toward the Whispering Woods. # speaker: Fae}
{calmed("gull"): The grumpy gull at the lookout was fizzy too. That hooded kid gets around! # speaker: Fae}
{has_lantern: Jordan gave me his blacklight lantern. The kid in the purple hood took a secret trail you can only see in its light! # speaker: Fae}
{jordan_joined: Jordan is on my team now! He's hiked every trail on the mountain. # speaker: Fae}
{calmed("bunny") and calmed("squirrel"): The Cliffside Trail runs between Pinecone Pass and Bubblegum Bay. I've calmed its fizzy bunnies and squirrels! # speaker: Fae}
{rode_bus: Pinecone Pass is covered in snow, with a lodge and a cocoa stand. The kid in the purple hood must be up here somewhere. # speaker: Fae}
{calmed("bluebird") and not rode_bus: The bus at the plaza's star sign goes up into the mountains, to Pinecone Pass! # speaker: Fae}
{calmed("bluebird"): A calm bluebird says the kid in the purple hood zipped off toward the mountains. # speaker: Fae}
{sue_joined: Sue is on my team now! She knows every good fishing spot. # speaker: Fae}
{club_open: The purple hood in the tree house has a Cloverhollow School name tag. Whose is it? # speaker: Fae}
{club_open and not sue_joined: The east road leads to Bubblegum Bay. The club's fizzy purple soda smelled just like the fountain's bubblegum bubbles. # speaker: Fae}
{knows_password and not club_open: The hooded kid's club password is "Fizzlesticks". A club... like the tree house in the park? # speaker: Fae}
{hall_pass: I have a hall pass! Time to follow the hooded kid's trail. # speaker: Fae}
{calmed("pup"): A calm pup found a purple thread that leads toward the school. # speaker: Fae}
{calmed("fountain-frog") and not calmed("pup"): Purple fizz drips lead out of the plaza to Meadow Park. # speaker: Fae}
{coins() > 0: I have coins! The bakery in the plaza sells snacks for 5 coins. # speaker: Fae}
{calmed("fountain-frog"): The Fountain Frog is calm. Something purple fizzed into his fountain. # speaker: Fae}
{read_notice: A kid in a purple hood was seen in town. # speaker: Fae}
{plan == "now": Go see why the fountain is fizzing! # speaker: Fae}
{plan == "later": Check the fizzing fountain after school. # speaker: Fae}
-> DONE

=== fountain ===
{calmed("fountain-frog"):
    The bubbles are gone. The fountain sparkles like new! # speaker: Fae
- else:
    Pink bubbles... and it smells like bubblegum? # speaker: Fae
}
-> DONE

=== frog_calm ===
{frog_calm > 1: -> again}
Ribbit! Thank you for the song, Fae. My head feels all clear now. # speaker: Fountain Frog
Something purple fizzed into my fountain last night. It tasted like trouble! # speaker: Fountain Frog
-> DONE

= again
Ribbit! The fountain is singing again. # speaker: Fountain Frog
-> DONE

=== breakfast ===
Three plates, three cups, and a tiny spoon for Oliver. Breakfast is almost ready. # speaker: Fae
-> DONE

=== fridge ===
{has_microwave and not (has_nuggets or has_mac): -> freezer}
{has_nuggets or has_mac: I've already got a box for the clubhouse microwave. # speaker: Fae}
The fridge is covered in drawings, shopping lists, and one very proud glittery family photo. # speaker: Fae
-> DONE
= freezer
The freezer's full of dino nuggets and mac n cheese! # speaker: Fae
+ [Take the dino nuggets]
    ~ has_nuggets = true
    A box of dino nuggets. Off to the clubhouse microwave! # speaker: Fae
+ [Take the mac n cheese]
    ~ has_mac = true
    A box of mac n cheese. Off to the clubhouse microwave! # speaker: Fae
+ [Leave them]
- -> DONE

=== island ===
A big bowl of pancake batter and a whole mountain of blueberries. Yum. # speaker: Fae
-> DONE

=== oliver ===
{awake: -> morning_oliver}
Oliver shakes his rattle. "Ba!" # speaker: Oliver
Mom laughs from the kitchen. # speaker: Mom
-> DONE
= morning_oliver
Oliver giggles and points at the fridge drawings. They look like the forest, the fairies, and a purple scribble. # speaker: Fae
-> DONE

=== mom ===
{awake: -> morning}
{clubhouse_claimed and not has_microwave: -> kitchen}
{ate_breakfast: -> again}
Morning, sleepyhead! Blueberry pancakes are almost ready. # speaker: Mom
{plan == "now": Going to look at the fountain? Breakfast first, my little adventurer. # speaker: Mom}
{plan == "later": School first, then the fountain? Very sensible. # speaker: Mom}
* [Eat a pancake]
    ~ ate_breakfast = true
    Mmm. Perfect. Thanks, Mom! # speaker: Fae
* [Give Mom a hug]
    ~ ate_breakfast = true
    Aww. Now eat up, sweetie. # speaker: Mom
- -> DONE
= again
Have a good day, sweetie. Stay curious! # speaker: Mom
-> DONE
= morning
// Mom wakes Fae once; after that, upstairs or down, she sends her to Milo.
{morning > 1: -> morning_again}
Fae! Wake up, sleepyhead! You'll be late for school! # speaker: Mom
...Mom? But the forest... and Milo... it was all a dream? # speaker: Fae
Breakfast is on the table. Pancakes! # speaker: Mom
Oh, and your friend Milo is downstairs! # speaker: Mom
You two will have fun walking to school together! # speaker: Mom
-> DONE
= morning_again
Milo's waiting by the front door, sweetie. Have fun at school! # speaker: Mom
-> DONE

= kitchen
Fae! A little bird told me you and your friends have a clubhouse now. # speaker: Mom
Every clubhouse needs a kitchen. Take my old microwave! # speaker: Mom
~ has_microwave = true
~ has_chest = true
And the old toy chest from the hall, for your treasures. # speaker: Mom
Thanks, Mom! Jordan and Sue can help me carry them up the ladder. # speaker: Fae
There are dino nuggets and mac n cheese in the freezer. Take a box whenever you like! # speaker: Mom
-> DONE

=== morning_start ===
~ dreaming = false
~ awake = true
-> DONE

=== front_door_morning ===
Morning, Fae! Your mom let me in. # speaker: Milo
Hi! Want to walk to school together? I had the WEIRDEST dream... # speaker: Milo
With a purple hood? # speaker: Fae
How did you know?! # speaker: Milo
Maybe some dreams are better when you share them. # speaker: Fae # credits
-> DONE

=== front_door_morning_notice ===
Milo's right here. I should say hi first! # speaker: Fae
-> DONE

=== tree_ending ===
The Ancient Tree glows brighter and brighter. # speaker: Fae
Everything goes soft and white. # speaker: Fae # ending
-> DONE

=== pup_calm ===
{pup_calm > 1: -> again}
Woof! Woof! The pup flops down and wags his whole body. # speaker: Pond Pup
He drops a soggy tennis ball at my feet. It's all purple and fizzy. # speaker: Fae
And there's a purple thread stuck to it... from a purple hood! # speaker: Fae
Woof! # speaker: Pond Pup
He's pointing his nose at the road to school. # speaker: Fae
-> DONE

= again
{pup_friend: -> friend}
Woof! The Pond Pup wants to play fetch. # speaker: Pond Pup
{has_flute: -> bond}
-> DONE
// A pat and a treat make a friend (NOTES.md), in either order.
= bond
+ {not pup_petted} [Pet him]
    ~ pup_petted = true
    Fae scratches behind his floppy ears. His back leg thumps the ground. # speaker: Fae
+ {not pup_fed} [Share a snack]
    {snacks() == 0:
        I'm out of snacks. The bakery sells them, and the clubhouse garden grows strawberries. # speaker: Fae
        -> DONE
    }
    ~ pup_fed = true
    Fae shares a snack. Crunch, crunch, gone! He licks her nose. # speaker: Fae # feed: snack 1
+ [Wave bye]
    Woof! # speaker: Pond Pup
    -> DONE
- {pup_petted and pup_fed: -> befriend}
-> bond
= befriend
~ pup_friend = true
The Pond Pup's tail wags so hard that his whole body wiggles. # speaker: Fae
He's my friend now! When I play my flute, he'll come running. # speaker: Fae
-> DONE
= friend
Woof! This pup wags at me like we're old friends. Word gets around! # speaker: Fae
-> DONE

=== tree_house ===
{club_open: -> again}
{knows_password: -> password}
A tree house with a round door and a little sign: CLUB MEMBERS ONLY. # speaker: Fae
I wonder what the password is. # speaker: Fae
-> DONE

= password
Fae knocks on the round door and whispers, "Fizzlesticks!" # speaker: Fae
The round door creaks open! # speaker: Fae
Inside: comics, a beanbag, a jar of fizzy purple soda... and a purple hood on a hook. # speaker: Fae
~ club_open = true
There's a name tag sewn inside the hood. It's from Cloverhollow School! # speaker: Fae
-> DONE

= again
The club is empty. That purple hood belongs to someone at my school... # speaker: Fae
-> DONE

=== picnic ===
A picnic with sandwiches, lemonade, and a basket of berries. # speaker: Fae
Somebody ate every single berry... and left purple paw prints! # speaker: Fae
-> DONE

=== bay_road_closed ===
The east road goes to Bubblegum Bay! # speaker: Fae
But I want to follow the hooded kid's trail first. # speaker: Fae
-> DONE

=== sue ===
Whoa, hi! Careful, these planks are a little wobbly. # speaker: Sue
I'm Sue. I fish here every day... but today the fish are all fizzy! # speaker: Sue
And that flappy bluebird keeps kicking sand in my bait bucket. # speaker: Sue
Wait. Purple fizz? Was it a kid in a purple hood? # speaker: Sue
* [Yes! I'm following their trail.]
    I knew it! Count me in. # speaker: Sue
* [I think so. Want to help me find out?]
    Are you kidding? Of course! Let me grab my rod. # speaker: Sue
 - ~ sue_joined = true
-> DONE

=== bluebird_calm ===
{bluebird_calm > 1: -> again}
Chirp! Thank you, Fae. My wings feel calm again. # speaker: Bay Bluebird
A kid in a purple hood zipped off toward the mountains! # speaker: Bay Bluebird
-> DONE

= again
Chirp-chirp! The bay is peaceful now. # speaker: Bay Bluebird
-> DONE

=== bus_stop ===
{not calmed("bluebird") and not club_open:
    The bus waits by the star sign, but there's no reason to leave town yet. # speaker: Fae
    Maybe once I find a clue that leads up the mountain. # speaker: Fae
    -> DONE
}
The bus is here! Where to? # speaker: Fae
+ {calmed("bluebird")} [Pinecone Pass!]
    ~ rode_bus = true
    Up we go! # speaker: Fae # travel: pass.bus
    -> DONE
+ {club_open} [Bubblegum Bay!]
    To the beach! # speaker: Fae # travel: bay.bus-stop
    -> DONE
+ [Not yet.]
    Not yet. I'll stay in Cloverhollow a little longer. # speaker: Fae
-> DONE

=== bay_bus_stop ===
The bus stops here on its way between the towns. Where to? # speaker: Fae
+ [Cloverhollow!]
    Home to town! # speaker: Fae # travel: plaza.bus-stop
    -> DONE
+ {calmed("bluebird")} [Pinecone Pass!]
    ~ rode_bus = true
    Up we go! # speaker: Fae # travel: pass.bus
    -> DONE
+ [Not yet.]
    Not yet. I want to stay at the beach a little longer. # speaker: Fae
-> DONE

=== pass_bus_stop ===
The bus is ready to roll. Where to? # speaker: Fae
+ [Cloverhollow!]
    Back to town! # speaker: Fae # travel: plaza.bus-stop
    -> DONE
+ {club_open} [Bubblegum Bay!]
    Down to the beach! # speaker: Fae # travel: bay.bus-stop
    -> DONE
+ [Not yet.]
    Not yet. I want to look around a little more. # speaker: Fae
     -> DONE

=== pass_sign ===
PINECONE PASS. Trails, sledding, and the best cocoa in the mountains! # speaker: Sign
-> DONE

=== bay_cliff_path ===
A sandy path climbs the cliffs, way up toward the mountains. # speaker: Fae
That's a long walk, and I don't know where it goes yet. # speaker: Fae
-> DONE

=== trail_signpost ===
CLIFFSIDE TRAIL. Up: Pinecone Pass. Down: Bubblegum Bay. # speaker: Sign
Over the bridge: the lookout! # speaker: Sign
-> DONE

=== pass_trail_sign ===
CLIFFSIDE TRAIL. Down the mountain to Bubblegum Bay. # speaker: Sign
-> DONE

=== lookout_bench ===
What a view! The sea sparkles all the way to the sky. # speaker: Fae
I can see Sue's dock way down there. It looks tiny! # speaker: Fae
-> DONE

=== bunny_calm ===
{bunny_calm > 1: -> again}
Thank you! I was hopping in circles all morning. # speaker: Ribbon Bunny
A kid in a purple hood zipped by, and everything went all fizzy! # speaker: Ribbon Bunny
That hooded kid again! # speaker: Fae
-> DONE
= again
{bunny_friend: -> friend}
The clover up here is extra sweet. Want some? # speaker: Ribbon Bunny
{has_flute: -> bond}
-> DONE
// Smoothing her ribbon and sharing a snack make a friend (Milestone 80), in either order.
= bond
+ {not bunny_petted} [Smooth her ribbon]
    ~ bunny_petted = true
    Fae gently smooths the silky ribbon between her ears. Her nose gives a happy twitch! # speaker: Fae
+ {not bunny_fed} [Share a snack]
    {snacks() == 0:
        I'm out of snacks. The bakery sells them, and the clubhouse garden grows strawberries. # speaker: Fae
        -> DONE
    }
    ~ bunny_fed = true
    Fae shares a snack. She nibbles it happily with her ears bobbing! # speaker: Fae # feed: snack 1
+ [Wave bye]
    Hop, hop! # speaker: Ribbon Bunny
    -> DONE
- {bunny_petted and bunny_fed: -> befriend}
-> bond
= befriend
~ bunny_friend = true
Ribbon Bunny does a happy twirl around Fae's boots, her ribbon fluttering! # speaker: Fae
She's my friend now! When I play my flute, she'll come hopping right over. # speaker: Fae
-> DONE
= friend
Hop, hop! Ribbon Bunny wiggles her nose at me like we're old friends! # speaker: Fae
-> DONE

=== squirrel_calm ===
{squirrel_calm > 1: -> again}
Phew! Sorry about all the acorns. # speaker: Acorn Squirrel
A kid in a purple hood traded me a shiny bottle cap for my best acorn. # speaker: Acorn Squirrel
Then, fizz! I couldn't stop throwing things. # speaker: Acorn Squirrel
-> DONE
= again
{squirrel_friend: -> friend}
I'm saving my acorns for winter now. Nobody gets bonked! # speaker: Acorn Squirrel
{has_flute: -> bond}
-> DONE
// A chin scratch and a treat make a friend (Milestone 60), in either order.
= bond
+ {not squirrel_petted} [Scratch his chin]
    ~ squirrel_petted = true
    Fae scratches under his chin. His eyes go all squinty and happy. # speaker: Fae
+ {not squirrel_fed} [Share a snack]
    {snacks() == 0:
        I'm out of snacks. The bakery sells them, and the clubhouse garden grows strawberries. # speaker: Fae
        -> DONE
    }
    ~ squirrel_fed = true
    Fae shares a snack. He stuffs it all in his cheeks at once! # speaker: Fae # feed: snack 1
+ [Wave bye]
    Chitter! # speaker: Acorn Squirrel
    -> DONE
- {squirrel_petted and squirrel_fed: -> befriend}
-> bond
= befriend
~ squirrel_friend = true
The Acorn Squirrel hops right up onto Fae's shoe and chitters. # speaker: Fae
He's my friend now! When I play my flute, he'll come scampering. # speaker: Fae
-> DONE
= friend
Chitter! This squirrel flicks his tail at me like we're old friends. Word gets around! # speaker: Fae
-> DONE

=== gull_calm ===
{gull_calm > 1: -> again}
Squawk! Sorry about your snacks. I couldn't help myself! # speaker: Lookout Gull
A kid in a purple hood fed me a fizzy cracker. Then I wanted ALL the snacks! # speaker: Lookout Gull
A fizzy cracker? Everywhere that kid goes, things go fizzy. # speaker: Fae
-> DONE
= again
I'm keeping watch over the sea now. No more snack snatching! # speaker: Lookout Gull
-> DONE

=== jordan ===
Whoa, watch out! That hamster's gone totally fizzy! # speaker: Jordan
It keeps throwing snowballs at everyone. Even at the snowman! # speaker: Jordan
I'm Jordan, by the way. I've hiked every trail up here. # speaker: Jordan
* [Let's calm it down together!]
    You got it! I'll keep it busy. # speaker: Jordan
* [Did a kid in a purple hood come by?]
    Somebody in a purple hood zoomed past on a sled, laughing their head off! Let's go after them. # speaker: Jordan
- ~ jordan_joined = true
-> DONE

=== hamster_calm ===
{hamster_calm > 1: -> again}
Squeak! Thank you. My head feels all cozy again. # speaker: Hiker Hamster
The kid in the purple hood? They ran off down a secret trail. You can only see it at night... # speaker: Hiker Hamster
A trail you can only see at night? # speaker: Fae
Trail markers glow under blacklight! Here, Fae, take my lantern. # speaker: Jordan
~ has_lantern = true
Jordan hands Fae his blacklight lantern: a big round purple lens on a rainbow handle. # speaker: Fae
Switch it on and look around. Fizzy tracks glow! # speaker: Jordan
-> DONE

= again
Squeak! Watch out for snowballs. Hee hee. # speaker: Hiker Hamster
-> DONE

=== lamb_calm ===
{lamb_calm > 1: -> again}
Baa! Thank you. My hooves feel steady again. # speaker: Clover Lamb
A kid in a purple hood bounced past, and everything went fizzy! # speaker: Clover Lamb
That hooded kid again! # speaker: Fae
-> DONE
= again
The clover up here is extra sweet. Want some? # speaker: Clover Lamb
-> DONE

=== hedgehog_calm ===
{hedgehog_calm > 1: -> again}
Thank you. My quills feel cozy again. # speaker: Meadow Hedgehog
A kid in a purple hood left a fizzy crumb by the meadow. # speaker: Meadow Hedgehog
A fizzy crumb? That sounds familiar. # speaker: Fae
-> DONE
= again
My daisy is still tucked safely in my hat. # speaker: Meadow Hedgehog
-> DONE

=== crab_calm ===
{crab_calm > 1: -> again}
Click-click! Thank you, small friend. My claws feel calm as the tide. # speaker: Sandy Crab
A kid in a purple hood handed me a fizzy soda bottle, and I snip-snipped it open! # speaker: Sandy Crab
Then everything went bubbly, and I just HAD to snip everything! # speaker: Sandy Crab
-> DONE
= again
The tide pools by the south rocks have the best bubbles. Click! # speaker: Sandy Crab
-> DONE

=== penguin_calm ===
{penguin_calm > 1: -> again}
Awrk! My flippers feel warm and cozy again. # speaker: Waddle Penguin
A kid in a purple hood polished my favorite ice slide with fizzy soda. It went to my head! # speaker: Waddle Penguin
Awrk-awrk! I slid all the way down the mountain without steering once! # speaker: Waddle Penguin
-> DONE
= again
The best sledding hill is up behind the lodge. Belly down, flippers up! # speaker: Waddle Penguin
-> DONE

=== lift_note ===
Glowing doodles on the lift tower! A masked face, a swirl, and a star. # speaker: Fae
The squiggles look like secret writing. Was the hooded kid leaving a message for someone? # speaker: Fae
-> DONE

=== old_trail_marker ===
{found_old_trail: -> again}
A glowing arrow, painted on a tree! It points west, deep into the pines. # speaker: Fae
{jordan_joined: That's the old pine trail! It goes all the way down to the Whispering Woods. # speaker: Jordan}
An old trail, hidden in the snow. You can only see it with the lantern! # speaker: Fae
~ found_old_trail = true
-> DONE
= again
The glowing arrow still points west, toward the Whispering Woods. # speaker: Fae
-> DONE

=== snowman ===
The snowman has a carrot nose and a very serious pebble smile. # speaker: Fae
-> DONE

=== cocoa_stand ===
{scarf_down and not scarf_returned: -> scarf}
The cocoa stand steams beside the snowy trail. # speaker: Cocoa seller
{has_lasso and not scarf_down: The wind blew my favourite scarf right onto the ski lift! Brrr. # speaker: Cocoa seller}
{coins() < 5:
    A mug of cocoa costs 5 coins. Maybe calm a critter first? # speaker: Cocoa seller
    -> DONE
}
+ [Buy a mug of cocoa for 5 coins]
    Here you go, a warm mug of cocoa! # speaker: Cocoa seller # buy: snack 5
+ [Not now]
    All right! Stay cozy out there. # speaker: Cocoa seller
- -> DONE

= scarf
My scarf! You got it down from the ski lift? # speaker: Cocoa seller
~ scarf_returned = true
Thank you, Fae! A mug of cocoa, on the house. # speaker: Cocoa seller # gift: snack 1
-> DONE

=== lodge_door ===
{lodge_open: -> open}
{keeper_back: -> fizzy}
{calmed("hamster"): -> back}
The lodge is locked. A note says: "Back soon, gone looking for a runaway hamster." # speaker: Fae
-> DONE
// Once a hamster's been calmed (the one who warns of snowballs), the keeper's
// home, and under the spell (Milestone 57).
= back
The lodge is locked. A note says: "Back soon, gone looking for a runaway hamster." # speaker: Fae
A runaway hamster? We calmed a hamster up here! # speaker: Fae
WHOOSH! A snowball whizzes right past Fae's ear. # speaker: Fae
~ keeper_back = true
Hee hee hee! NOBODY gets in MY lodge! # speaker: Lodge keeper
It's the lodge keeper, and she's all fizzy! # speaker: Fae
-> DONE
= fizzy
The lodge is locked tight. The lodge keeper is out on her porch, flinging snowballs! # speaker: Fae
-> DONE
= open
The lodge door is open. Warm air and the smell of cocoa drift out. # speaker: Fae
-> DONE


=== bay_sign ===
BUBBLEGUM BAY. Fishing, splashing, and sandcastles welcome! # speaker: Sign
-> DONE

=== bay_picnic ===
{calmed("lifeguard"): -> shared}
{lifeguard_back: -> fizzy}
{sue_joined: -> back}
A beach picnic: watermelon slices, a sun hat, and a sandy towel. # speaker: Fae
{not calmed("bluebird"): Everything's covered in sand. That bluebird again! # speaker: Fae}
-> DONE
= back
A sharp whistle cuts across the bay. "TWEEEET!" # speaker: Fae
~ lifeguard_back = true
"NOBODY splashes on MY beach!" # speaker: Lifeguard
It's the lifeguard, and she's all fizzy! # speaker: Fae
-> DONE
= fizzy
The lifeguard is out by the dock, blowing her whistle at everyone! # speaker: Fae
-> DONE
= shared
The picnic is peaceful now. Ms. Coral shared her watermelon with everyone! # speaker: Fae
-> DONE

=== shells ===
Pretty shells! They sound like tiny waves when I shake them. # speaker: Fae
-> DONE

=== park_sign ===
MEADOW PARK. Please keep your pets on the path! # speaker: Sign
{not calmed("pup"): Somebody's pet is barking by the pond. # speaker: Fae}
-> DONE


=== teacher ===
{calmed("arcade-keeper"): -> story}
{hall_pass: -> pass}
Good morning, Fae! Class starts when the bell rings. # speaker: Ms. Maple
+ [Can I go outside for a bit?]
    Not without a hall pass, I'm afraid. # speaker: Ms. Maple
    Nurse Holly sometimes needs a helper... # speaker: Ms. Maple
+ [Good morning, Ms. Maple!]
    Such lovely manners! # speaker: Ms. Maple
- -> DONE

= pass
A hall pass? All right. Be back in time for story time! # speaker: Ms. Maple
-> DONE

= story
There you are, Fae! Story time is about to start. # speaker: Ms. Maple
Hang your backpack in your cubby and find a spot on the rug. # speaker: Ms. Maple
~ story_time = true
~ maple_in_hall = false
Story time! Maybe someone in my class saw the kid in the purple hood. # speaker: Fae
-> DONE

=== classroom_closed ===
The classroom door is shut. Story time hasn't started yet. # speaker: Fae
-> DONE

=== classroom_teacher ===
{classroom_teacher > 1 and saw_hood and not pe_time: -> pe}
{classroom_teacher > 1: -> again}
Today's story is about a dragon who sneezes bubbles instead of fire! # speaker: Ms. Maple
Bubbles... like the fountain this morning. # speaker: Fae
Everyone in the village got very sticky. Settle in, everyone! # speaker: Ms. Maple
{saw_hood: -> pe}
-> DONE
= again
Remember, Fae: a kind word can calm almost anything. # speaker: Ms. Maple
-> DONE
= pe
That's the end of our story! Time for PE, everyone. # speaker: Ms. Maple
Coach Ash is waiting for you in the gym, down the east hall. # speaker: Ms. Maple
~ pe_time = true
The gym! That's where the kid in the purple hood was headed. # speaker: Fae
-> DONE

=== milo ===
{milo > 1: -> again}
Fae! Did you hear? Somebody beat the Star Racer high score at the arcade! # speaker: Milo
I've been trying all year. And they scribbled out their initials, so nobody knows who! # speaker: Milo
Whoever it was must be really, REALLY good at Star Racer. # speaker: Milo
-> DONE
= again
Milo folds a paper airplane. "This one's a Star Racer!" # speaker: Milo
-> DONE

=== rosie ===
{rosie > 1: -> again}
Psst, Fae! Somebody in a purple hood just peeked in the door! # speaker: Rosie
Then they ran off down the hall. # speaker: Rosie
~ hood_waiting = true
A purple hood? Here, at school? I have to see! # speaker: Fae
-> DONE
= again
{kite_down and not kite_returned: -> kite}
{saw_hood: Did you catch them? They're SO fast. # speaker: Rosie}
{not saw_hood: Hurry, Fae! They went down the hall! # speaker: Rosie}
-> DONE
= kite
My kite! The wind snatched it right out of my hands at the park. # speaker: Rosie
~ kite_returned = true
You're the best, Fae! Here, take my arcade coins. All six of them! # speaker: Rosie # gift: coins 6
-> DONE

=== hood_glimpse ===
Hey! You in the purple hood! Wait! # speaker: Fae
~ hood_waiting = false
~ saw_hood = true
The kid zips around the corner, toward the gym. So fast! # speaker: Fae
They dropped something... a purple marker. # speaker: Fae
{calmed("arcade-keeper"): The same purple as the scribbled-out Star Racer initials! # speaker: Fae}
-> DONE

=== art_wall ===
The class art wall: rainbows, rockets, and a very wobbly cat. # speaker: Fae
And a drawing of a masked face, a swirl, and a star. # speaker: Fae
{has_lantern: Just like the glowing doodle on the ski lift! # speaker: Fae}
There's no name on it. # speaker: Fae
-> DONE

=== cubbies ===
Everyone's cubby has a coat hook and a name tag. # speaker: Fae
Mine has spare socks and a drawing of Maddie as a dragon. # speaker: Fae
-> DONE

=== reading_corner ===
A cozy reading rug, with beanbags and a shelf of picture books. # speaker: Fae
-> DONE

=== gym_hall ===
The hall to the gym. The doors are locked during story time. # speaker: Fae
{saw_hood: Tiny purple footprints lead right up to them... # speaker: Fae}
-> DONE

=== coach ===
{coach_thanked: -> again}
{gym_quest: -> quest}
TWEET! Oh, hi, Fae! Whew, what a morning. # speaker: Coach Ash
A kid in a purple hood dashed through here and knocked over my equipment cart! # speaker: Coach Ash
Then they ran straight out the back door, to the playing field. Fast kid! # speaker: Coach Ash
{calmed("gym-pup"): -> watch_back}
My clipboard went flying, and a fizzy pup ran off with my stopwatch! # speaker: Coach Ash
* [I'll get them back!]
    That's the spirit! # speaker: Coach Ash
* [Did you see who it was?]
    Nope. Just a purple hood and a cloud of dust! Can you help me find my things? # speaker: Coach Ash
- ~ gym_quest = true
-> DONE
= watch_back
Hey, you've got my stopwatch! The pup had it? Thanks, Fae! # speaker: Coach Ash
Now if only I could find my clipboard. It went flying! # speaker: Coach Ash
~ gym_quest = true
-> DONE
= quest
{calmed("gym-pup") and found_clipboard: -> thanks}
{saw_clipboard and not has_lasso: -> lend}
How's the hunt going? # speaker: Coach Ash
{not calmed("gym-pup"): That fizzy pup still has my stopwatch! Calm it down, and maybe it'll drop it. # speaker: Coach Ash}
{not saw_clipboard: My clipboard went flying. I heard it clatter somewhere up high. # speaker: Coach Ash}
{has_lasso and not found_clipboard: Give that lasso a twirl at the hoop! # speaker: Coach Ash}
-> DONE
= lend
Up on the hoop? I can't reach that either. # speaker: Coach Ash
Here, take my lasso! I used to rope cones with it at summer camp. # speaker: Coach Ash
~ has_lasso = true
Coach Ash hands Fae a lasso of twisted rainbow rope, with a wooden star on its handle. # speaker: Fae
-> DONE
= thanks
My stopwatch AND my clipboard! You're a star, Fae! # speaker: Coach Ash
~ coach_thanked = true
Keep the lasso. It can pull down things that are up high, and swing you across gaps, too! # speaker: Coach Ash
~ music_time = true
Oh, and music's next! Ms. Willow's room is down the east hall. # speaker: Coach Ash
-> DONE
= again
{not music_quest: Music is next, Fae! Ms. Willow's room is down the east hall. # speaker: Coach Ash}
{recess: Recess! I've propped the back door open. Out you go! # speaker: Coach Ash}
Keep that lasso handy, Fae! And watch out for that purple hood. # speaker: Coach Ash
-> DONE

=== hoop ===
{
- found_clipboard:
    The basketball hoop. Nothing stuck up there now! # speaker: Fae
- has_lasso:
    Fae twirls the lasso once, twice... and loops it right over the clipboard! # speaker: Fae
    ~ found_clipboard = true
    Got it! Coach Ash's clipboard. # speaker: Fae
- else:
    ~ saw_clipboard = true
    {gym_quest:There's Coach Ash's clipboard, hooked on the rim!|There's a clipboard hooked on the rim!} It's way too high to reach. # speaker: Fae
}
-> DONE

=== ball_bin ===
A big bin of bouncy balls: red ones, blue ones, and one very flat one. # speaker: Fae
-> DONE

=== climbing_rope ===
A climbing rope, all the way up to the ceiling. There's a little bell at the top! # speaker: Fae
-> DONE

=== back_door ===
The back door to the playing field. It clicked shut behind the kid in the purple hood. # speaker: Fae
It only opens from outside. Purple footprints lead right up to it... # speaker: Fae
-> DONE

=== gym_pup_calm ===
{gym_pup_calm > 1: -> again}
Woof! The pup flops down and wags its whole body. # speaker: Gym Pup
{gym_quest:I've got Coach Ash's stopwatch back. Good pup!|It dropped a shiny stopwatch. Whose could it be?} # speaker: Fae
-> DONE
= again
The pup sniffs a bouncy ball, very seriously. # speaker: Gym Pup
-> DONE

=== nurse ===
{hall_pass: -> thanks}
Hi Fae! Is everything all right? # speaker: Nurse Holly
+ [My tummy hurts...]
    Hmm. Your tummy sounds happy to me. Fibbing isn't very kind, Fae. # speaker: Nurse Holly
+ [I'm fine! Can I help with anything?]
    Oh, you're a star! Could you take this note to the front office? # speaker: Nurse Holly
    ~ hall_pass = true
    ~ raccoon_waiting = true
    Here's a hall pass, so nobody stops you on the way. # speaker: Nurse Holly
- -> DONE

= thanks
{
- milo_revealed or calmed("hooded-kid"):
    You helped Milo find his calm again, Fae! I'm so proud of how kind and steady you were. # speaker: Nurse Holly
- calmed("principal"):
    Haha, thank goodness you calmed Mr. Bell down, Fae! His voice finally got a rest from that megaphone. # speaker: Nurse Holly
- art_open or calmed("art-teacher") or has_flute:
    What a busy day across the school halls, Fae! Remember to take a breather whenever you need one. # speaker: Nurse Holly
- else:
    Thanks again for delivering that note, Fae! My clinic door is always open if you need a breather. # speaker: Nurse Holly
}
{snacks() >= 2:
    Your backpack's already stocked with snacks! Come see me anytime you run low, Fae. # speaker: Nurse Holly
    -> DONE
}
Looks like your backpack is running low on snacks, kiddo! Want a quick clinic refill? # speaker: Nurse Holly
+ [Take a cozy apple juice & cracker pack (free)]
    Here you go, sweetie, two crisp apple-juice snacks and a star-shaped band-aid just in case! # speaker: Nurse Holly # gift: snack 2 # sound: chime-green
+ [I'm feeling great, thanks!]
    That's the spirit! Drink plenty of water out there, Fae! # speaker: Nurse Holly
- -> DONE

=== school_doors ===
The front doors stay shut during class. # speaker: Fae
I need a hall pass to go outside. # speaker: Fae
-> DONE

=== school_board ===
The bulletin board: a spelling bee, a lost mitten, and a bake sale on Friday. # speaker: Fae
-> DONE

=== trophies ===
Trophies for spelling, soccer, and the best pumpkin in Cloverhollow. # speaker: Fae
-> DONE

=== school_raccoon ===
Chitter-chitter! Thanks, Fae. My head feels all clear now. # speaker: Ringtail Raccoon
A kid in a purple hood gave me a fizzy cracker. Then I couldn't stop chattering! # speaker: Ringtail Raccoon
I heard that kid whisper a secret word at the tree house in the park: "Fizzlesticks!" # speaker: Ringtail Raccoon
~ knows_password = true
A secret password for a tree house club? I have to see this! # speaker: Fae
~ raccoon_waiting = false
The raccoon waves its striped tail and scampers off. # speaker: Fae
-> DONE

=== raccoon_calm ===
{raccoon_calm > 1: -> again}
Chitter! Sorry, Fae. The fizz made me grab every shiny thing in sight. # speaker: Ringtail Raccoon
A kid in a purple hood keeps leaving fizzy crackers around. They're SO tasty. # speaker: Ringtail Raccoon
-> DONE
= again
The raccoon washes a bottle cap and gives it a happy little pat. # speaker: Ringtail Raccoon
-> DONE

=== cat_calm ===
{cat_calm > 1: -> again}
Mrrow! Thanks, Fae. That fizz made my whiskers all twitchy. # speaker: Cozy Cat
The cat curls around Fae's ankles, purring like a little motor. # speaker: Fae
-> DONE
= again
The cat blinks slowly at Fae. That means "I like you." # speaker: Cozy Cat
-> DONE

=== beach_frog_calm ===
{beach_frog_calm > 1: -> again}
Ribbit! The sand feels nice and cool again. Thanks, Fae! # speaker: Beach Frog
-> DONE
= again
Ribbit! The frog hops happily around a tide pool. # speaker: Beach Frog
-> DONE

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

=== arcade_closed ===
The arcade's door is locked. A sign says BACK SOON! # speaker: Fae
Beeps and boops are coming from inside... # speaker: Fae
-> DONE

=== arcade_keeper ===
{arcade_keeper > 1: -> again}
Whoa... what happened? My head was all fizzy, like a shaken-up soda! # speaker: Mr. Pip
A kid in a purple hood played every game in here this morning. # speaker: Mr. Pip
They gave me a purple fizzy soda to say thanks. One sip, and all I wanted was the high score! # speaker: Mr. Pip
So the fizz works on people too... # speaker: Fae
That kid set a new record on Star Racer, then scribbled out their initials in purple marker. Sneaky! # speaker: Mr. Pip
Thank you, Fae. You and your friends can play here any time. # speaker: Mr. Pip
-> DONE

= again
Mr. Pip polishes the claw machine. "Come back and play any time!" # speaker: Mr. Pip
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
=== claw_machine ===
{not calmed("arcade-keeper"):
    The machine is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
{plushesLeft() == 0:
    The claw machine is empty. I won every plush! # speaker: Fae
    -> DONE
}
{won("raccoon-plush"):
    That smug raccoon plush is all mine now. Ha! # speaker: Fae
- else:
    {plushesLeft() == 1:
        Just one plush left, and it's the very smug raccoon. # speaker: Fae
    - else:
        A claw machine full of plush critters, and one very smug raccoon. # speaker: Fae
    }
    Someday I'm going to win that raccoon. # speaker: Fae
}
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: claw 2
    Hold tight! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

=== skee_ball ===
{not calmed("arcade-keeper"):
    The skee-ball lane is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
A skee-ball lane! Roll the balls into the rings for tickets. # speaker: Fae
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: skee 2
    Here goes! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

=== boop_a_mole ===
{not calmed("arcade-keeper"):
    The Boop-a-Mole cabinet is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
Boop-a-Mole! Little moles pop up, and you boop their noses. Gently! # speaker: Fae
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: mole 2
    Boop time! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

=== comet_cruise ===
{not calmed("arcade-keeper"):
    The Comet Cruise cabinet is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
Comet Cruise! Steer the little rocket, catch the stars, and slip past the space rocks. # speaker: Fae
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: comet 2
    Blast off! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

// Mr. Pip runs the ticket counter once he's calm (Milestone 45): each prize
// is offered while Fae can pay for it and hasn't won it.
=== ticket_counter ===
{not calmed("arcade-keeper"):
    Jars of candy, a ring toss prize, and a big roll of orange tickets behind the counter. # speaker: Fae
    -> DONE
}
{won("pinwheel") and won("bouncy-ball") and won("toy-rocket") and won("star-racer-keychain"):
    You've won every prize on my counter. You're an arcade champ! # speaker: Mr. Pip
    -> DONE
}
~ temp pinwheel = not won("pinwheel") and tickets() >= 20
~ temp ball = not won("bouncy-ball") and tickets() >= 30
~ temp rocket = not won("toy-rocket") and tickets() >= 50
~ temp keychain = not won("star-racer-keychain") and tickets() >= 80
{not (pinwheel or ball or rocket or keychain):
    You have {tickets()} tickets. Skee-ball pays more! # speaker: Mr. Pip
    -> DONE
}
Tickets for prizes! What'll it be? # speaker: Mr. Pip
+ {pinwheel} [Rainbow Pinwheel, 20 tickets]
    A rainbow pinwheel. Blow on it and it spins! # speaker: Mr. Pip # trade: pinwheel 20
+ {ball} [Star Bouncy Ball, 30 tickets]
    A star bouncy ball. It bounces higher than you! # speaker: Mr. Pip # trade: bouncy-ball 30
+ {rocket} [Toy Rocket, 50 tickets]
    A toy rocket, just like the one on my wall. # speaker: Mr. Pip # trade: toy-rocket 50
+ {keychain} [Star Racer Keychain, 80 tickets]
    A Star Racer keychain. Only champs get these! # speaker: Mr. Pip # trade: star-racer-keychain 80
+ [Not now]
    Come back any time! # speaker: Mr. Pip
- -> DONE

=== star_racer ===
STAR RACER. HIGH SCORES! # speaker: Fae
{calmed("arcade-keeper"): The top score's initials are scribbled out in purple marker. # speaker: Fae}
{not calmed("arcade-keeper"): The screen is fizzing with purple scribbles. # speaker: Fae}
-> DONE

=== bakery ===
The bakery smells like warm cinnamon buns. # speaker: Baker
{coins() < 5:
    You need 5 coins for a snack. Keep exploring! # speaker: Baker
    -> DONE
}
+ [Buy a snack for 5 coins]
    A fresh snack, wrapped up just for you! # speaker: Baker # buy: snack 5
+ [Not now]
    No rush! Come back when you're hungry. # speaker: Baker
- -> DONE

=== grocery ===
Fresh orchard apples and crunchy fish crackers! Every critter has a favourite. # speaker: Grocer
{coins() < 8:
    Treats are 8 coins each. Come back after calming a few critters! # speaker: Grocer
    -> DONE
}
+ {coins() >= 8} [Orchard Apple (8 coins)]
    Crisp orchard slices, packed in paper! Meadow and forest critters love these. # speaker: Grocer # buy-treat: orchard-apple 8
+ {coins() >= 8} [Fish Cracker (8 coins)]
    Crunchy fish crackers, fresh from the jar! Pups, cats, and beach critters adore them. # speaker: Grocer # buy-treat: fish-cracker 8
+ [Not now]
    Stop by whenever your backpack needs a treat! # speaker: Grocer
- -> DONE

=== ice_cream ===
Welcome to Cloverhollow Scoops! Nothing calms a fizzy day like ice cream. # speaker: Scoops
{coins() < 10:
    A Berry Swirl Cone is 10 coins, and a Cozy Cocoa Sundae is 12. See you soon! # speaker: Scoops
    -> DONE
}
+ {coins() >= 10} [Berry Swirl Cone (10 coins)]
    One double-scoop Berry Swirl Cone! Folks around town can't resist it. # speaker: Scoops # buy-treat: berry-cone 10
+ {coins() >= 12} [Cozy Cocoa Sundae (12 coins)]
    A warm Cozy Cocoa Sundae with marshmallows! Winter friends go wild for this. # speaker: Scoops # buy-treat: cocoa-sundae 12
+ [Not now]
    Keep cool out there, Fae! # speaker: Scoops
- -> DONE

// The music room (Milestone 38).
VAR music_time = false
VAR music_quest = false
VAR song_start = false
VAR heard_bird = false
VAR has_flute = false
VAR xylophone_notes = 0
VAR xylophone_right = true
VAR xylophone_tune = ""

=== music_closed ===
The music room is locked. Music class is after PE. # speaker: Fae
-> DONE


=== art_room ===
{art_open: -> open}
{art_teacher_out: -> out}
{stash_found: -> paint}
A paint palette on the door. The art room, maybe? It's locked. # speaker: Fae
-> DONE
= paint
Purple paint seeps under the door. A paintbrush clatters, and a teacher steps into the hall! # speaker: Fae
~ art_teacher_out = true
-> DONE
= out
The door's still locked, and Ms. Rowan is swishing purple paint all over the hall! # speaker: Fae
-> DONE
= open
The art room door stands open. It smells like paint and glue sticks! # speaker: Fae
-> DONE

=== megaphone ===
{calmed("principal"): -> calm}
{principal_out: -> out}
A silver megaphone leans against the lockers, fizzing tiny purple bubbles. # speaker: Fae
Somebody shouts "GOOD MORNING, CLOVERHOLLOW!" and the principal marches out! # speaker: Fae
~ principal_out = true
-> DONE
= out
Mr. Bell is stomping up and down the hall, announcing EVERYTHING at once! # speaker: Fae
-> DONE
= calm
The megaphone is quiet now. It smells like cocoa and chalk dust. # speaker: Fae
-> DONE

=== principal ===
{principal > 1: -> again}
Oh my stars. My head is clear, and my voice is my own again! # speaker: Mr. Bell
A kid in a purple hood borrowed my megaphone for "special announcements"! # speaker: Mr. Bell
They left a fizzy purple soda on my desk, and one sip... whoosh! # speaker: Mr. Bell
All I remember is announcing EVERYTHING at once. Sorry about the noise! # speaker: Mr. Bell
-> DONE
= again
Lunch today is tacos. That is all. # speaker: Mr. Bell
{
- buster_reward:
    Oh, and one quiet announcement: Cloverhollow School is mighty proud of its Star-Line Explorer! # speaker: Mr. Bell
- calmed("art-teacher") and has_flute and has_lasso:
    Art, music, and gym are all humming happily again. Gold star for hallway teamwork, Fae! # speaker: Mr. Bell
}
-> DONE

=== art_teacher ===
{art_teacher > 1: -> again}
Thank goodness! My head feels clear, and my paintbrush feels like mine again. # speaker: Ms. Rowan
The kid in the purple hood left me one sip of fizzy purple soda. It made me fizzy too! # speaker: Ms. Rowan
And they borrowed every purple marker in my box. I hope they bring them back. # speaker: Ms. Rowan
Come in, Fae. The art room is open! # speaker: Ms. Rowan
~ art_open = true
-> DONE
= again
Welcome back, Fae! The easels are ready for you. # speaker: Ms. Rowan
-> DONE

=== art_easels ===
Three easels, three blank canvases, and enough paint to make a rainbow. # speaker: Fae
-> DONE
=== art_paintings ===
The class art wall is covered with bright paintings. A drying rack wobbles beside it. # speaker: Fae
-> DONE
=== art_sink ===
The sink is full of painty water. Ms. Rowan says brushes need a rinse right away! # speaker: Fae
-> DONE
=== art_markers ===
An empty purple marker box. Every single purple marker is gone. # speaker: Fae
-> DONE

=== music_teacher ===
{has_flute: -> again}
{music_quest: -> quest}
~ music_quest = true
Oh! Fae, come in, come in! Welcome to music class! # speaker: Ms. Willow
I'm afraid it's been a terribly dramatic morning. # speaker: Ms. Willow
Someone in a purple hood climbed in through my window and scribbled all over our class song! # speaker: Ms. Willow
{calmed("music-bird"): -> mallet_back}
And then a bluebird flew in after them and snatched my chime mallet! # speaker: Ms. Willow
* [I'll get it back!]
    Oh, would you? You're a dear. Gently, mind. It's only frightened. # speaker: Ms. Willow
* [Did you see who it was?]
    Only a purple hood, scrambling back out the window. Not so much as a hello! # speaker: Ms. Willow
- -> song
= mallet_back
And you've found my chime mallet! The bluebird had it? Oh, thank you, Fae! # speaker: Ms. Willow
-> song
= song
~ song_start = true
Our class song goes red, yellow, blue... # speaker: Ms. Willow
...and then I simply can't remember! The last note is under all those purple squiggles. # speaker: Ms. Willow
-> DONE
= quest
{not calmed("music-bird"): That bluebird still has my mallet. A kind word might calm it down. # speaker: Ms. Willow}
{calmed("music-bird"): You've got my mallet! Red, yellow, blue... and then? # speaker: Ms. Willow}
{calmed("music-bird") and not heard_bird: That bluebird keeps singing one bright note. Have a listen! # speaker: Ms. Willow}
{heard_bird: Try it on the xylophone! # speaker: Ms. Willow}
-> DONE
= again
Play that flute whenever you need a friend, Fae! # speaker: Ms. Willow
{recess: Now, off to recess! The playing field is out the gym's back door. # speaker: Ms. Willow}
-> DONE

=== music_bird_calm ===
{music_bird_calm > 1: -> again}
~ heard_bird = true
Tweet! The bluebird puffs out its chest, very pleased with itself. # speaker: Music Bird
It sings one bright, clear note. # speaker: Music Bird # sound: chime-red
That note sounds just like the red bar on the xylophone! # speaker: Fae
{music_quest:I've got Ms. Willow's chime mallet back!|A little wooden mallet. Whose could it be?} # speaker: Fae
-> DONE
= again
The bluebird hums along to nothing in particular, very softly. # speaker: Music Bird
-> DONE

// The xylophone: four bars, then the song is judged. After the flute, free play.
=== xylophone ===
{not calmed("music-bird"): The rainbow xylophone! But there's no mallet to play it with. # speaker: Fae}
{not calmed("music-bird"): -> DONE}
~ xylophone_notes = 0
~ xylophone_right = true
{has_flute:A little tune of my own!|Which bar first?} # speaker: Fae
-> bar
= bar
+ [Red] -> red
+ [Yellow] -> yellow
+ [Green] -> green
+ [Blue] -> blue
+ [Stop] -> DONE
= red
~ xylophone_notes += 1
{ xylophone_notes == 2 or xylophone_notes == 3:
    ~ xylophone_right = false
}
{ xylophone_notes == 1 or has_flute:
    ~ xylophone_tune = "Red"
  - else:
    ~ xylophone_tune = xylophone_tune + ", red"
}
{xylophone_tune}{has_flute or xylophone_notes == 4:!|...} # speaker: Fae # sound: chime-red
-> next
= yellow
~ xylophone_notes += 1
{ xylophone_notes != 2:
    ~ xylophone_right = false
}
{ xylophone_notes == 1 or has_flute:
    ~ xylophone_tune = "Yellow"
  - else:
    ~ xylophone_tune = xylophone_tune + ", yellow"
}
{xylophone_tune}{has_flute or xylophone_notes == 4:!|...} # speaker: Fae # sound: chime-yellow
-> next
= green
~ xylophone_notes += 1
~ xylophone_right = false
{ xylophone_notes == 1 or has_flute:
    ~ xylophone_tune = "Green"
  - else:
    ~ xylophone_tune = xylophone_tune + ", green"
}
{xylophone_tune}{has_flute or xylophone_notes == 4:!|...} # speaker: Fae # sound: chime-green
-> next
= blue
~ xylophone_notes += 1
{ xylophone_notes != 3:
    ~ xylophone_right = false
}
{ xylophone_notes == 1 or has_flute:
    ~ xylophone_tune = "Blue"
  - else:
    ~ xylophone_tune = xylophone_tune + ", blue"
}
{xylophone_tune}{has_flute or xylophone_notes == 4:!|...} # speaker: Fae # sound: chime-blue
-> next
= next
{has_flute or xylophone_notes < 4: -> bar}
{xylophone_right: -> song}
Hmm. That doesn't sound like the class song. # speaker: Fae
{not song_start: Maybe Ms. Willow knows how it goes. # speaker: Fae}
{song_start and not heard_bird: Maybe that bluebird knows the last note. # speaker: Fae}
-> DONE
= song
That's it! That's our class song! Bravo, Fae! # speaker: Ms. Willow
You found the note the scribbles hid. Now come here, I have something for you. # speaker: Ms. Willow
This was my very first flute, when I was just about your age. # speaker: Ms. Willow
Ms. Willow gives Fae a little wooden flute, painted with flowers and pastel bands. # speaker: Fae
~ has_flute = true
~ music_quest = true
Play it, and animal friends will come running to listen. # speaker: Ms. Willow
Fae plays a soft little tune. # speaker: Fae # sound: flute
~ recess = true
Oh! There's the bell. Recess! # speaker: Ms. Willow
Out to the playing field with you. Coach Ash props the gym's back door open at recess. # speaker: Ms. Willow
-> DONE

=== piano ===
An upright piano, polished till it shines. Ms. Willow plays the class song on it. # speaker: Fae
-> DONE

=== song_poster ===
Our class song, in big coloured dots... scribbled all over with purple marker! # speaker: Fae
The same purple as the Star Racer scribbles. # speaker: Fae
{not has_flute: The last note is completely hidden. # speaker: Fae}
-> DONE

=== music_window ===
The window's wide open. That's how the kid in the purple hood got in, and out again. # speaker: Fae
A few purple fuzzies are caught on the latch. # speaker: Fae
-> DONE

=== instrument_shelf ===
Tambourines, maracas, a drum, and a triangle. Everything a band needs! # speaker: Fae
-> DONE

// The playing field (Milestone 39).
VAR recess = false
VAR swung = false
VAR stash_found = false
VAR bridge_down = false
VAR found_mist_way = false
VAR visited_hills = false

=== arrive_hills ===
~ visited_hills = true
-> DONE

VAR lookout_cache_found = false

=== hills_lookout ===
{lookout_cache_found: The lookout is quiet and sunny. The Acorn Squirrel has already found the little cache. # speaker: Fae}
{not squirrel_with_me: The lookout is quiet and sunny. A few wildflowers nod in the breeze. # speaker: Fae}
{not squirrel_with_me: -> DONE}
The Acorn Squirrel scampers behind a stone and returns with a tiny tin. # speaker: Fae
~ lookout_cache_found = true
The lookout cache has two sweet treats! # speaker: Fae # gift: snack 2
-> DONE
VAR rope_bridge = false
VAR seal_open = false
VAR mist_notes = 0
VAR mist_right = true
VAR mist_tune = ""
VAR heard_wish = false
VAR milo_revealed = false

=== oak_squirrel_calm ===
{oak_squirrel_calm > 1: -> again}
Phew! Sorry about all the acorns. # speaker: Oak Squirrel
That big branch is my favourite spot. This morning a kid in a purple hood swung on it, right across the creek! # speaker: Oak Squirrel
They whooped all the way over. Then, fizz! I had to throw something at everybody. # speaker: Oak Squirrel
Swing across the creek on that branch... with Coach Ash's lasso! # speaker: Fae
-> DONE
= again
The squirrel hugs an acorn and keeps very, very still. # speaker: Oak Squirrel
-> DONE

=== oak_branch ===
{not calmed("oak-squirrel"): A fizzy squirrel is pelting acorns from the big branch! Nobody's getting near it like that. # speaker: Fae}
{not calmed("oak-squirrel"): -> DONE}
{not has_lasso: The old oak's branch reaches right across the creek. If only I had a rope... # speaker: Fae}
{not has_lasso: -> DONE}
{swung: -> again}
~ swung = true
The old oak's branch reaches right across the creek. # speaker: Fae
Fae twirls Coach Ash's lasso, loops it over the branch, and gives it a good tug. # speaker: Fae
Hold on tight... WHEEEE! # speaker: Fae # travel: field.east-bank
-> DONE
= again
Wheee! Fae swings across the creek again. # speaker: Fae # travel: field.east-bank
-> DONE

=== hood_stash ===
{stash_found: -> again}
~ stash_found = true
A purple backpack, tucked behind the old stump! # speaker: Fae
Purple markers... a bottle of fizzy purple soda... and a Star Racer token. # speaker: Fae
It's the hooded kid's stash! So this is where they ran at PE. # speaker: Fae
Was that a purple hood, way down the path? ...Gone again. # speaker: Fae
-> DONE
= again
The hooded kid's purple backpack. They haven't come back for it... yet. # speaker: Fae
-> DONE

=== bridge_lever ===
{bridge_down: The lever's down, and the old footbridge is across the creek. # speaker: Fae}
{bridge_down: -> DONE}
A lever, way up on the old footbridge's post. # speaker: Fae
{not has_lasso: It's much too high to reach! # speaker: Fae}
{not has_lasso: -> DONE}
Too high to reach... but not for a lasso! # speaker: Fae
Fae loops the lasso over the lever's handle and pulls with all her might. # speaker: Fae
~ bridge_down = true
CLUNK! Creeeak... The old footbridge swings down across the creek! # speaker: Fae
Now there's a way back across. Thanks, Coach Ash! # speaker: Fae
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

=== hopscotch ===
Fae hops the whole hopscotch on one foot, all the way to 7 and back! # speaker: Fae
-> DONE

=== tetherball ===
Fae gives the tetherball a whack. Round and round it goes! # speaker: Fae
-> DONE

// The clubhouse fix-up (Milestone 43).
VAR fridge_fixed = false
VAR fridge_baskets = 0
VAR garden_planted = false
VAR garden_calms = 0
VAR garden_sprouted = false
VAR garden_ripe = false
VAR sunberry_harvests = 0

// The core runs this after every calm (spec 7). It only counts: it never
// prints. The garden sprouts after one calm and ripens after three.
=== on_calm ===
{calmed("hooded-kid"):
    ~ forest_fizzy = false
}
{ garden_planted and not garden_ripe:
    ~ garden_calms += 1
    { garden_calms >= 1:
        ~ garden_sprouted = true
    }
    { garden_calms >= 3:
        ~ garden_ripe = true
    }
}
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

// Flute friends (Milestone 47).
VAR pup_petted = false
VAR pup_fed = false
VAR pup_friend = false
VAR pup_with_me = false
VAR pond_seen = false
VAR pond_tin = false

// The flute (F) plays this: a friend called to Fae's side, or sent home.
=== flute ===
Fae plays a little tune on her painted flute. # speaker: Fae # sound: flute
{not (pup_friend or squirrel_friend or bunny_friend): -> nobody}
+ {pup_friend and not pup_with_me} [Call the Pond Pup]
    ~ pup_with_me = true
    Woof! Woof! The Pond Pup comes running! # speaker: Pond Pup
    -> DONE
+ {pup_with_me} [Send the Pond Pup home]
    ~ pup_with_me = false
    Good boy! The Pond Pup trots off home, wagging. # speaker: Fae
    -> DONE
+ {squirrel_friend and not squirrel_with_me} [Call the Acorn Squirrel]
    ~ squirrel_with_me = true
    Chitter-chitter! The Acorn Squirrel scampers down a tree and hops along! # speaker: Acorn Squirrel
    -> DONE
+ {squirrel_with_me} [Send the Acorn Squirrel home]
    ~ squirrel_with_me = false
    Off you go! The Acorn Squirrel bounds away, his tail bouncing. # speaker: Fae
    -> DONE
+ {bunny_friend and not bunny_with_me} [Call Ribbon Bunny]
    ~ bunny_with_me = true
    Hop, hop! Ribbon Bunny bounds right up, her ribbon fluttering! # speaker: Ribbon Bunny
    -> DONE
+ {bunny_with_me} [Send Ribbon Bunny home]
    ~ bunny_with_me = false
    See you soon! Ribbon Bunny hops back toward the clover, waving an ear. # speaker: Fae
    -> DONE
+ [Just play]
    -> DONE
= nobody
Nobody comes... yet. Animal friends come running, Ms. Willow said. I need to make one first! # speaker: Fae
-> DONE

// The park pond: the Pond Pup swims (Milestone 47).
=== pond ===
{pond_tin: -> after}
~ pond_seen = true
The pond is cool and clear. Something glints at the bottom, out past the middle rock. # speaker: Fae
{not pup_with_me: It's too far to reach, and too cold to wade in. # speaker: Fae}
{not pup_with_me: -> DONE}
+ [Fetch, boy!]
    Splash! The Pond Pup paddles out past the rock and dives. # speaker: Fae
    ~ pond_tin = true
    He swims back with an old tin in his mouth. Inside: twelve shiny coins, and a note that says "For whoever finds this!" # speaker: Fae # gift: coins 12
    Good boy! Pond Pups really can swim. # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE
= after
The pond is cool and clear. Nothing glints at the bottom now. # speaker: Fae
-> DONE

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

=== tower ===
{has_lasso and not kite_down: -> kite}
The play tower, with its patched flag flapping on top. # speaker: Fae
-> DONE
= kite
~ kite_seen = true
A kite is caught on top of the play tower, hanging down the wall! # speaker: Fae
+ [Lasso it down]
    Fae twirls the lasso once, twice... and loops it right over the kite's string. # speaker: Fae
    ~ kite_down = true
    A gentle tug, and the kite flutters down into Fae's arms. # speaker: Fae
    There's a name on the crossbar, in green marker: ROSIE. Rosie from my class! # speaker: Fae
    I'll take it back to her at school. # speaker: Fae
    -> DONE
+ [Leave it]
    -> DONE

=== dock_end ===
{has_lasso and not has_map: -> bottle}
{sue_joined: -> fish_spot}
The end of Sue's dock. The water sparkles all the way to the sky. # speaker: Fae
-> DONE
= fish_spot
The end of Sue's dock. Shimmering fish dart beneath the turquoise ripples! # speaker: Fae
+ [Go fishing with Sue!]
    I've got our lucky bobber right here, let's see what's biting! # speaker: Sue # play: fish 0
    -> DONE
+ [Just enjoy the view]
    -> DONE
= bottle
~ bottle_seen = true
A bottle is bobbing in the water past the end of the dock! There's a rolled-up paper inside. # speaker: Fae
+ [Lasso it]
    Fae loops the lasso around the bottle's neck and reels it in, hand over hand. # speaker: Fae
    ~ has_map = true
    She pulls out the cork. The paper is an old treasure map! # speaker: Fae
    Two palm trees, a big log, and an X right between them. That's the beach, by the big driftwood log! # speaker: Fae
    -> DONE
+ [Leave it]
    -> DONE

=== palms ===
{has_map and not treasure_found: -> dig}
{treasure_found: The sand between the palms is all smoothed back over. # speaker: Fae}
{not treasure_found: Two palm trees lean together beside the big driftwood log. # speaker: Fae}
-> DONE
= dig
X marks the spot: right here, between the two palms! # speaker: Fae
+ [Dig]
    Fae borrows a spade from the beach toys and digs, and digs... # speaker: Fae
    ~ treasure_found = true
    Clunk! A little tin chest, full of shiny gold coins! # speaker: Fae # gift: coins 20
    Real pirate treasure! Wait till I tell Sue. # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE

=== ski_lift ===
{has_lasso and not scarf_down: -> scarf}
The ski lift creaks along its cable, the empty chairs swinging. # speaker: Fae
-> DONE
= scarf
~ scarf_seen = true
A long red scarf is caught on the pink lift chair, flapping in the wind. # speaker: Fae
+ [Lasso it down]
    Fae aims, throws... and the lasso loops right over the dangling scarf. # speaker: Fae
    ~ scarf_down = true
    One tug, and the scarf slips free. It's soft and warm, and it smells like cocoa. # speaker: Fae
    -> DONE
+ [Leave it]
    -> DONE


// The clubhouse kitchen (Milestone 52): Mom's old microwave on the fridge, her
// freezer's boxes to cook in it, and her old toy chest for Fae's treasures.
VAR has_microwave = false
VAR has_chest = false
VAR has_nuggets = false
VAR has_mac = false
VAR meals_cooked = 0

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
Fae closes the lid gently. # speaker: Fae
-> DONE
= drawings
Drawings pinned to the wall: a kid with a big smile, and hearts and flowers. # speaker: Fae
-> DONE

// The lodge keeper (Milestone 57): home from looking for her runaway hamster,
// fizzy from the hooded kid's soda, until Fae calms her.
VAR keeper_back = false
VAR lodge_open = false

=== lodge_keeper ===
{lodge_keeper > 1: -> again}
Oh my stars... what happened? My head was all fizzy, like a shaken-up soda! # speaker: Mrs. Flurry
My hamster Biscuit ran off this morning. While I was out looking for him, a kid in a purple hood gave me a fizzy purple soda. # speaker: Mrs. Flurry
One sip, and I didn't want ANYONE in my lodge. I'm so sorry about the snowballs, dears! # speaker: Mrs. Flurry
Biscuit came home all by himself, calm as can be. Somebody must have been kind to him. # speaker: Mrs. Flurry
That was us! # speaker: Fae
~ lodge_open = true
Then come in, come in, all of you! Warm up by the fire. # speaker: Mrs. Flurry
-> DONE
= again
Mrs. Flurry sweeps the snow off her porch. "The fire's lit, dears. Come in and warm up!" # speaker: Mrs. Flurry
A dizzy penguin keeps belly-sliding loops on the north slope, past the ski lift. Mind your toes out there! # speaker: Mrs. Flurry
{
- sanctuary_gift:
    Ranger Fern dropped by with warm alpine trail news! She said you earned a Sanctuary Ranger Basket! # speaker: Mrs. Flurry
- jordan_cabin_visited:
    Saw smoke curling from Jordan's mountain cabin earlier. Glad you stopped by to warm up there too! # speaker: Mrs. Flurry
}
-> DONE

=== lifeguard ===
{lifeguard > 1: -> again}
WHOA, kiddos! My head was all fizzy, like a shaken-up soda! # speaker: Ms. Coral
One sip of a fizzy purple soda from a kid in a purple hood, and I blew my whistle at everybody on my beach. # speaker: Ms. Coral
Sorry about the whistle blast, kiddos! # speaker: Ms. Coral
Here, share my watermelon. # speaker: Ms. Coral # gift: snack 3
-> DONE
= again
Ms. Coral smiles and checks the beach. "All clear, kiddos!" # speaker: Ms. Coral
"Oh, and mind the south rocks! Little crabs have been skittering there all morning, clicky-clacky!" # speaker: Ms. Coral
{
- bay_boat_charm:
    "I waved from the lifeguard chair when I saw your pastel rowboat gliding across the sunny cove!" # speaker: Ms. Coral
- sue_cottage_visited:
    "Sue's beach cottage looks extra bright today! Nothing beats friends hanging out by the tide!" # speaker: Ms. Coral
}
-> DONE

// Inside the lodge (Milestone 57).
VAR lodge_cocoa_had = false

=== lodge_fire ===
The fire crackles and pops. Fae holds her hands out to it. Toasty! # speaker: Fae
Now THIS is how you warm up after a snowball fight. # speaker: Jordan
-> DONE

=== lodge_cocoa ===
{lodge_cocoa_had: -> again}
A big copper pot of cocoa, with little marshmallows bobbing on top. # speaker: Fae
A note on the lid says: "Help yourselves, dears! Mrs. F." # speaker: Fae
~ lodge_cocoa_had = true
Fae pours a mug of cocoa to take along. # speaker: Fae # gift: snack 1
-> DONE
= again
The cocoa pot is still warm. Mmm, marshmallows. # speaker: Fae
-> DONE

=== lodge_guestbook ===
The lodge's guestbook, full of happy skiers' names. # speaker: Fae
On today's page, somebody signed in purple marker, then scribbled their name out. # speaker: Fae
There's a little paper plane doodled in the corner. # speaker: Fae
{saw_hood: The same purple as the marker the hooded kid dropped at school... # speaker: Fae}
-> DONE

=== lodge_hamster ===
A little wooden house by the fire. Inside, a round hamster is curled up fast asleep. # speaker: Fae
That must be Biscuit! He's snoring tiny squeaks. # speaker: Fae
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
This is the Enchanted Forest. The Ancient Tree dreams the whole land. # speaker: Lavender Fairy
The Mystic Pond grants wishes. A kid in a purple hood made a wish and drank from it. # speaker: Lavender Fairy
Then everything went fizzy and purple, with scribbles everywhere. The Ancient Tree can't dream properly with all that fizz! # speaker: Lavender Fairy
-> DONE

=== fairy_mint ===
The butterflies keep tickling my wings. I keep telling them, "Again!" # speaker: Mint Fairy
-> DONE

=== fairy_sky ===
The Ancient Tree is older than every tree, even the trees that think they are very old. # speaker: Sky Fairy
-> DONE

=== fairy_peach ===
Hee hee! The pond bubbles made my shoes go squeak. # speaker: Peach Fairy
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

// A second flute friend (Milestone 60): the Acorn Squirrel climbs.
VAR squirrel_petted = false
VAR squirrel_fed = false
VAR squirrel_friend = false
VAR squirrel_with_me = false
VAR knothole_seen = false
VAR acorn_found = false

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

// Crystal Cavern: a glowing cave off Pinecone Pass's north mountain gap,
// unlocked with the blacklight lantern, showcasing all three tools and two
// cozy cave critters.
VAR cavern_visited = false
VAR cavern_bridge_lit = false
VAR cavern_chime_seen = false
VAR cavern_chime_rung = false
VAR cavern_spring_seen = false
VAR cavern_spring_found = false

=== cavern_dark ===
A snow-dusted archway opens into the northern cliffs, sparkling faintly inside. # speaker: Fae
It's way too dark to step inside without a lantern! # speaker: Fae
-> DONE

=== cavern_tablet ===
~ cavern_visited = true
{cavern_bridge_lit: -> after}
Faint carved swirls cover the stone tablet, too dim to read. # speaker: Fae
Maybe the blacklight lantern would make them glow! # speaker: Fae
-> DONE
= after
The carved fairy swirls still shimmer softly across the stone tablet. # speaker: Fae
-> DONE

=== cavern_mural ===
~ cavern_visited = true
{cavern_bridge_lit: -> after}
Whoa! In the blacklight glow, old fairy swirls light up across the stone tablet! # speaker: Fae
"Where crystal water meets the mountain stone, step in light toward the song of the Mystic Pond." # speaker: Fae
~ cavern_bridge_lit = true
Three crystal stepping stones rise with a bright hum right across the turquoise stream! # speaker: Fae # sound: chime-blue
Now we can cross to the far side of the cavern! # speaker: Fae
-> DONE
= after
The glowing fairy swirls hum softly along the mural, keeping the crystal stepping stones bright. # speaker: Fae
-> DONE

=== cavern_lantern_look ===
~ cavern_visited = true
A mossy stone lantern tucked against the cavern wall, glowing soft and warm. # speaker: Fae
Every tiny echo in here sounds like a gentle lullaby. # speaker: Fae
-> DONE

=== cavern_stream ===
~ cavern_visited = true
{cavern_bridge_lit: -> after}
A bright turquoise stream rushes down from the waterfall. Way too deep to wade across! # speaker: Fae
Three flat stones glint under the water, carved with the same swirls as the stone tablet on the north wall. # speaker: Fae
-> DONE
= after
Three glowing crystal stepping stones bridge the turquoise stream. Safe to walk right across! # speaker: Fae
-> DONE

=== cavern_chime ===
~ cavern_visited = true
{cavern_chime_rung: -> after}
~ cavern_chime_seen = true
A sparkling golden star chime hangs high up in the crystal arch! # speaker: Fae
{not has_lasso: It's way too high to reach without a rope. # speaker: Fae}
{not has_lasso: -> DONE}
+ [Loop the lasso around the chime]
    Fae twirls Coach Ash's lasso and loops it neatly around the star chime! # speaker: Fae
    ~ cavern_chime_rung = true
    One gentle tug sends a clear, shimmering chime echoing all around the cavern! # speaker: Fae # sound: chime-blue
    A shimmering star crystal and a shower of sparkling coins tumble gently onto the sand! # speaker: Fae # gift: coins 15
    I'll keep this star crystal safe in our clubhouse chest! # speaker: Fae
    -> DONE
+ [Leave it]
    -> DONE
= after
The golden star chime sways gently in the arch, still humming a quiet tune. # speaker: Fae
-> DONE

=== cavern_spring ===
~ cavern_visited = true
{cavern_spring_found: -> after}
~ cavern_spring_seen = true
The crystal spring glows bright turquoise! Something glints way down at the bottom. # speaker: Fae
{not pup_with_me: It's too deep to reach, and way too chilly to wade in. # speaker: Fae}
{not pup_with_me and pup_friend: Bet the Pond Pup would love a splash in here! # speaker: Fae}
{not pup_with_me: -> DONE}
+ [Splash in, boy!]
    Splash! The Pond Pup leaps into the sparkling turquoise spring and dives right down! # speaker: Fae
    ~ cavern_spring_found = true
    He paddles back grinning with a tucked-away crystal pouch packed with sweet berry snacks! # speaker: Fae # gift: snack 2
    And ten shiny coins clinking inside too! Good boy! # speaker: Fae # gift: coins 10
    -> DONE
+ [Not now]
    -> DONE
= after
The crystal spring shimmers calm and clear. Nothing else glints on the sandy bottom. # speaker: Fae
-> DONE

=== bat_calm ===
{bat_calm > 1: -> again}
Squeak-squeak! My ears were buzzing like crazy from that purple fizz! # speaker: Cozy Bat
Now I can hear the crystal chimes singing again. Thank you, Fae! # speaker: Cozy Bat
-> DONE
= again
Squeak! This cavern is the coziest nap spot on the whole mountain. # speaker: Cozy Bat
-> DONE

=== crystal_mole_calm ===
{crystal_mole_calm > 1: -> again}
Sniffle-squeak! Thank goodness that purple dust cleared off my goggles! # speaker: Gem Mole
I was digging for sparkly quartz and bumped right into a fizzy puddle. You're the nicest! # speaker: Gem Mole
-> DONE
= again
Sniffle! Every crystal in this grotto is shining extra bright today. # speaker: Gem Mole
-> DONE

// Bon Appetit Cafe, Dad, townspeople, and Chef Bea's Star Cinnamon errand (Milestone 79).
VAR met_dad = false
VAR spice_quest = false
VAR spice_found = false
VAR spice_returned = false
VAR barnaby_gift = false

=== dad ===
{met_dad: -> again}
Hey there, kiddo! Caught me sneaking a fresh cinnamon bun before work. # speaker: Dad
How are Mom and baby Oliver holding up this morning? Still trying to eat his own socks? # speaker: Dad
He almost got one in his mouth before breakfast! # speaker: Fae
Sounds like our little guy. Hey, I'm glad you've been carrying that notebook everywhere, Fae. # speaker: Dad
Your mom and I gave you that journal so you'd always have your own special adventures, even with baby Oliver keeping the house busy. # speaker: Dad
~ met_dad = true
Here, take an extra cinnamon bun for your backpack. # speaker: Dad # gift: snack 1
And ten shiny coins in case you spot something fun in town! # speaker: Dad # gift: coins 10
-> DONE
= again
{
- milo_revealed:
    Mom told me you brought Milo right back to himself under the Ancient Tree. # speaker: Dad
    That's my Fae. Brave, kind, and never giving up on a friend! # speaker: Dad
- gem_reward_all:
    Grandpa Barnaby told the whole cafe you found all seven Star Gems across the valley! # speaker: Dad
    Wait till Oliver's old enough to hear your treasure-hunting stories! # speaker: Dad
- sanctuary_reward_14:
    Whoa, Ranger Fern wove you a real Sanctuary Clover Wreath? It smells like sunshine! # speaker: Dad
    Every critter in Cloverhollow sure is lucky to have you, kiddo. # speaker: Dad
- buster_reward:
    Look at Cloverhollow's official Star-Line Explorer! Buster was beaming about your stamps! # speaker: Dad
    Save me a story from the coast and the mountains for dinner tonight, okay? # speaker: Dad
- sue_compass and jordan_clover:
    You visited Sue's beach cottage and Jordan's mountain cabin? What a crew you've got! # speaker: Dad
    Sounds like your journal is bursting with memories already, kiddo! # speaker: Dad
- has_lantern:
    Whoa, is that Jordan's hiking lantern? Look at my brave explorer, lighting up the whole valley! # speaker: Dad
    Save me a story for dinner tonight, okay kiddo? # speaker: Dad
- clubhouse_claimed:
    Mom told me you and your friends fixed up a real woodland clubhouse! # speaker: Dad
    I'm so proud of you, kiddo. Don't forget to snack between adventures! # speaker: Dad
- else:
    Have a great day at school and around town, kiddo! # speaker: Dad
    If you ever need a break, Bon Appetit's cocoa is always warm. # speaker: Dad
}
-> DONE

=== chef_bea ===
{spice_found and not spice_returned: -> return_spice}
{not spice_quest: -> ask_spice}
{not spice_found: -> remind_spice}
{
- calmed("taco-chef"):
    Chef Mateo and I have been trading Star Cinnamon and taco spice notes all week! # speaker: Chef Bea
    Cloverhollow's kitchens have never smelled happier, all thanks to you! # speaker: Chef Bea
- buster_reward:
    I've been baking extra travel buns for Buster's Star-Line riders, Star-Line Explorer! # speaker: Chef Bea
    Nothing pairs better with a window seat than warm Star Cinnamon! # speaker: Chef Bea
- bay_boat_charm:
    I heard you rowed a pastel boat out to Bubblegum Bay's sunny cove! # speaker: Chef Bea
    Sea air works up a big appetite, so my Star Cinnamon tray is fresh for you! # speaker: Chef Bea
- else:
    Welcome back, Fae! My Star Cinnamon buns are rising golden and tall thanks to you! # speaker: Chef Bea
}
-> cafe_shop

= ask_spice
Welcome to Bon Appetit Cafe, sweetie! Pull up a chair anytime. # speaker: Chef Bea
I was all set to bake a fresh tray of my famous Star Cinnamon buns, except a fizzy little raccoon zipped right past the pastry window this morning! # speaker: Chef Bea
It snatched my shiny Star Cinnamon tin and dropped it somewhere out in Meadow Park while tearing across the grass. # speaker: Chef Bea
~ spice_quest = true
If you spot a sparkly spice tin out by the picnic blanket in Meadow Park, would you bring it home to me? # speaker: Chef Bea
You got it, Chef Bea! # speaker: Fae
-> cafe_shop

= remind_spice
Any luck spotting my shiny Star Cinnamon tin out in Meadow Park, Fae? # speaker: Chef Bea
That fizzy raccoon zoomed right past the picnic blanket, so check the clover near it! # speaker: Chef Bea
-> cafe_shop

= return_spice
Oh my stars, you found my Star Cinnamon tin! Not even a single dent! # speaker: Chef Bea
~ spice_returned = true
You saved the whole morning bake, Fae! Here, take two fresh Star Cinnamon buns for the trail. # speaker: Chef Bea # gift: snack 2
And fifteen coins for being Cloverhollow's finest helper! # speaker: Chef Bea # gift: coins 15
Oh, and one more thing: my golden Bon Appetit Star Pin! Keep it safe with your favorite adventure treasures. # speaker: Chef Bea # sound: chime-blue
Whoa, it smells like warm cinnamon! I'll keep it in our clubhouse chest! # speaker: Fae
-> cafe_shop

= cafe_shop
{coins() < 5: Fresh cinnamon buns are 5 coins apiece whenever your backpack needs a snack! # speaker: Chef Bea}
+ {coins() >= 5} [Buy a warm cinnamon bun (5 coins)]
    One warm, swirly cinnamon bun, wrapped in wax paper just for you! # speaker: Chef Bea # buy: snack 5
    -> DONE
+ [Just saying hi!]
    Always a treat to see your smiling face, Fae! Come back anytime. # speaker: Chef Bea
    -> DONE

=== park_spice_tin ===
{spice_found: -> after}
{spice_quest: -> collect}
A sparkly little tin tucked in the clover by the picnic blanket. It smells amazing, like warm cinnamon and vanilla! # speaker: Fae
-> DONE
= collect
A sparkly little tin tucked in the clover by the picnic blanket, stamped "Bon Appetit Star Cinnamon"! # speaker: Fae
~ spice_found = true
That's Chef Bea's missing spice tin! I'd better bring it right back to Bon Appetit Cafe. # speaker: Fae
-> DONE
= after
Just soft green clover by the picnic blanket, still smelling faintly of warm cinnamon. # speaker: Fae
-> DONE

=== barnaby ===
Ah, hello there, young Fae! Nothing beats a quiet cup of chamomile tea at Bon Appetit. # speaker: Grandpa Barnaby
When I was your age, folks around Cloverhollow whispered storybook legends about the Ancient Tree deep in the woods, and a glowing crystal cavern tucked high in the snowy pass. # speaker: Grandpa Barnaby
{
- calmed("hooded-kid"):
    And look at you now, bringing peace all the way to the Ancient Tree itself! The whole valley is humming again. # speaker: Grandpa Barnaby
- calmed("bat"):
    You even ventured into that glowing mountain cavern and calmed a bat! Those old legends really are alive! # speaker: Grandpa Barnaby
- calmed("owl"):
    Word reached town that you calmed the sleepy owl in Whispering Woods. That takes a steady heart! # speaker: Grandpa Barnaby
- calmed("hamster"):
    I heard you helped a snowy hamster up at Pinecone Pass! Nothing warms a mountain trail like kindness. # speaker: Grandpa Barnaby
- calmed("bluebird"):
    The breeze from Bubblegum Bay feels lighter already since you calmed that little bluebird! # speaker: Grandpa Barnaby
- calmed("fountain-frog"):
    Our town fountain sounds cheerful again since you sang to that grumpy frog! # speaker: Grandpa Barnaby
- else:
    If the town feels a little fizzy today, remember: a gentle song calms almost any ruffled feather. # speaker: Grandpa Barnaby
}
{(calmed("bluebird") or calmed("hamster") or calmed("bat") or calmed("owl")) and not barnaby_gift:
    ~ barnaby_gift = true
    Take these fifteen coins from an old storyteller, Fae. You've earned every single one keeping the valley peaceful! # speaker: Grandpa Barnaby # gift: coins 15
}
{
- gem_count() >= 7 and not gem_reward_all:
    ~ gem_reward_all = true
    ~ gem_reward_3 = true
    Well bless my teacup! You found ALL SEVEN Star Gems across Cloverhollow! Take these fifty coins for your grand treasure hunt! # speaker: Grandpa Barnaby # gift: coins 50
    And keep this Rainbow Star Geode for your clubhouse chest, along with a pair of warm snacks for the road! # speaker: Grandpa Barnaby # gift: snack 2 # sound: chime-red
- gem_reward_all and sanctuary_reward_14:
    All seven Star Gems AND Ranger Fern's Sanctuary Clover Wreath! What a golden chapter! # speaker: Grandpa Barnaby
- gem_reward_all and buster_reward:
    A Rainbow Star Geode and Buster's Golden Star-Line Whistle? A true valley legend, Fae! # speaker: Grandpa Barnaby
- gem_reward_all and sue_compass and jordan_clover:
    Sue's sea-glass compass, Jordan's pressed clover, and all seven Star Gems! Pure magic! # speaker: Grandpa Barnaby
- gem_count() >= 3 and not gem_reward_3:
    ~ gem_reward_3 = true
    My word, you've already found {gem_count()} gleaming Star Gems! Here are fifteen coins to cheer you on! # speaker: Grandpa Barnaby # gift: coins 15 # sound: chime-yellow
    Legend says seven Star Gems are tucked across Cloverhollow's lands, waiting for curious eyes and clever friends. # speaker: Grandpa Barnaby
- gem_count() > 0:
    I hear you've gathered {gem_count()} of 7 Star Gems so far! Keep shining your lantern and bringing your animal friends along! # speaker: Grandpa Barnaby
}
-> DONE

=== bree ===
Heya, Fae! Catching a quick cocoa break between routes! # speaker: Bree
My Cloverhollow Star Bus loops right from the plaza's star sign out to Bubblegum Bay's sandy coast and all the way up to Pinecone Pass! # speaker: Bree
{
- has_lantern or rode_bus:
    Psst, little mountain tip from your friendly bus driver: if you hike north past Pinecone Pass's cocoa stand, there's a snowy gap in the cliffs leading into Crystal Cavern! # speaker: Bree
    I've seen amethyst and gold lights glittering right through the archway. Bring a good lantern if you go peeking! # speaker: Bree
- else:
    Whenever you're ready to visit the beach or the snowy mountains, just head to the star sign in the plaza and hop aboard! # speaker: Bree
}
{
- milo_revealed:
    Word on my whole bus route is you helped Milo find his smile again! Best news all week! # speaker: Bree
- buster_reward:
    Buster showed off your full Star-Line Stamp Card in the break room! Welcome to the club! # speaker: Bree
- sanctuary_visited:
    Passengers keep raving about Ranger Fern's Wildlife Sanctuary meadow up above the hills! # speaker: Bree
- sue_cottage_visited and jordan_cabin_visited:
    Cozy stops at Sue's beach cottage AND Jordan's mountain cabin? You're riding like a pro! # speaker: Bree
- sue_cottage_visited:
    Sue's little beach cottage smells like sea salt and sunshine. Best stop near the coast! # speaker: Bree
- jordan_cabin_visited:
    I always spot chimney smoke curling from Jordan's mountain cabin on my Pinecone Pass run! # speaker: Bree
- calmed("principal"):
    Even Mr. Bell waved at my bus this morning without a megaphone! Town feels cozy again! # speaker: Bree
}
-> DONE

=== toby ===
Whoa, hey Fae! Are you getting a cinnamon bun too? The icing swirls are HUGE today! # speaker: Toby
I was just at the arcade trying to beat my record on Boop-a-Mole, Skee-Ball, and Comet Cruise! # speaker: Toby
{milo_revealed:
    Whoa, turns out those scribbled Star Racer initials belonged to Milo! Good thing you helped him out! # speaker: Toby
- else:
    Star Racer's top high score is still scribbled out in purple marker, which is super mysterious. Nobody knows whose initials were under there! # speaker: Toby
}
Oh, pro tip for calming fizzy critters: swing by the Grocery Market and Cloverhollow Scoops for Favourite Treats! # speaker: Toby
If you toss a critter its favorite treat in a calm-down, it calms down WAY faster than a regular snack! # speaker: Toby
{
- buster_reward:
    Whoa, you finished Buster's whole Star-Line Stamp Card?! That Golden Whistle is SO cool! # speaker: Toby
- sanctuary_visited:
    Wait, you found Ranger Fern's Wildlife Sanctuary?! I bet all those calm critters love pets! # speaker: Toby
- sue_cottage_visited and jordan_cabin_visited:
    You got to hang out at Sue's beach cottage AND Jordan's cabin? Best hangout spots ever! # speaker: Toby
- sue_cottage_visited:
    Sue invited you to her beach cottage? Her sea-glass lamp sounds like arcade neon, only cozier! # speaker: Toby
- jordan_cabin_visited:
    Jordan's cabin up in Pinecone Pass sounds awesome! Bet the cocoa kettle never cools down! # speaker: Toby
- calmed("principal"):
    Heard you calmed Mr. Bell down in the school hall! No more super-loud megaphone pop quizzes! # speaker: Toby
}
-> DONE

=== cafe_pastries ===
Warm golden cinnamon rolls, flaky croissants, and berry tarts stacked under a gleaming glass dome! # speaker: Fae
Everything smells like butter, brown sugar, and a cozy Saturday morning. # speaker: Fae
-> DONE

=== cafe_menu ===
TODAY'S SPECIALS: Star Cinnamon Buns, Honey Marshmallow Cocoa, Warm Apple Tarts, and Crispy Tacos on Tuesdays! # speaker: Chalkboard
The little chalk drawings of steaming mugs are super cute. # speaker: Fae
-> DONE

=== cafe_window ===
Sunlight pours through the arched window, looking right out over Cloverhollow Plaza's fountain and flower boxes! # speaker: Fae
You can almost hear the water sparkling outside. # speaker: Fae
-> DONE

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

=== function gem_count() ===
~ temp total = 0
{ gem_park:
    ~ total += 1
}
{ gem_bay:
    ~ total += 1
}
{ gem_trail:
    ~ total += 1
}
{ gem_pass:
    ~ total += 1
}
{ gem_cavern:
    ~ total += 1
}
{ gem_woods:
    ~ total += 1
}
{ gem_hills:
    ~ total += 1
}
~ return total

=== park_gem ===
{gem_park: -> after}
Whoa! Under the blacklight lantern, a faceted lavender crystal glows right out of the north meadow clover! # speaker: Fae
~ gem_park = true
Fae scoops up the Amethyst Star Gem! Its facets shimmer softly, and five shiny coins clink beneath it! # speaker: Fae # sound: chime-blue # gift: coins 5
-> DONE
= after
Soft lavender sparkles linger in the north meadow clover where the Amethyst Star Gem rested. # speaker: Fae
-> DONE

=== bay_gem ===
{gem_bay: -> after}
Something bright aqua glitters out in the rocky tide pool surf! # speaker: Fae
{not pup_with_me: The waves are way too deep to wade out there on my own. # speaker: Fae}
{not pup_with_me: -> DONE}
+ [Fetch it, boy!]
    Splash! Pond Pup bounds into the sparkling tide pool and paddles straight out! # speaker: Fae
    ~ gem_bay = true
    He trots back onto the sand carrying the Aqua Star Gem, with five sunny coins tucked beside it! # speaker: Fae # sound: chime-blue # gift: coins 5
    Good boy, Pond Pup! # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE
= after
The rocky tide pool shimmers in the breeze. Pond Pup's happy paw prints dot the wet sand. # speaker: Fae
-> DONE

=== trail_gem ===
{gem_trail: -> after}
A cozy little burrow tucks under the cliffside rocks, and a sunny yellow sparkle glints deep inside! # speaker: Fae
{not bunny_with_me: The burrow is way too tiny for my hand, just the right size for a clever bunny! # speaker: Fae}
{not bunny_with_me: -> DONE}
+ [Hop in, Ribbon Bunny!]
    Ribbon Bunny twitches her nose, zips straight down the rocky burrow, and pops back out! # speaker: Fae
    ~ gem_trail = true
    She rolls the gleaming Citrine Star Gem right to Fae's boots, along with five shiny coins! # speaker: Fae # sound: chime-yellow # gift: coins 5
    Way to go, Ribbon Bunny! # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE
= after
The cozy cliffside burrow is quiet and soft with clover. # speaker: Fae
-> DONE

=== pass_gem ===
{gem_pass: -> after}
High up on a snow-dusted pine branch, an icy blue crystal catches the mountain sun! # speaker: Fae
{not has_lasso: It's way too high up in the pine needles to reach by hand. # speaker: Fae}
{not has_lasso: -> DONE}
+ [Loop it down!]
    Fae twirls Coach Ash's lasso and loops the sparkling branch cleanly! # speaker: Fae
    ~ gem_pass = true
    Down tumbles the Frost Star Gem into the soft snow, along with five glittering coins! # speaker: Fae # sound: chime-blue # gift: coins 5
    Nice catch! # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE
= after
The snow-dusted pine branch sways gently in the crisp mountain air. # speaker: Fae
-> DONE

=== cavern_gem ===
{gem_cavern: -> after}
In the blacklight glow, a secret prism pocket sparkles along the east crystal grotto floor! # speaker: Fae
~ gem_cavern = true
Fae lifts out the Prism Star Gem! Rainbow light dances across the cavern walls, and five bright coins shine beside it! # speaker: Fae # sound: chime-red # gift: coins 5
-> DONE
= after
Faint rainbow glints dance across the east crystal grotto floor. # speaker: Fae
-> DONE

=== woods_gem ===
{gem_woods: -> after}
High up in a mossy tree hollow on the east edge of the clearing, a warm golden gem winks down! # speaker: Fae
{not squirrel_with_me: That mossy hollow is way up in the branches, too high to climb. # speaker: Fae}
{not squirrel_with_me: -> DONE}
+ [Climb up, buddy!]
    Chitter-chitter! Acorn Squirrel zips up the mossy bark and peeks into the hollow! # speaker: Fae
    ~ gem_woods = true
    He scampers back down with the glowing Amber Star Gem and five shiny coins! # speaker: Fae # sound: chime-yellow # gift: coins 5
    Awesome climb, buddy! # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE
= after
The mossy tree hollow on the east side of the clearing is cozy and empty now. # speaker: Fae
-> DONE

=== hills_gem ===
{gem_hills: -> after}
Tucked beside the meadow boulders is a clover-fringed burrow with a bright green twinkle inside! # speaker: Fae
{not bunny_with_me: It's way too narrow for me to reach in, but a nimble little bunny could hop right through! # speaker: Fae}
{not bunny_with_me: -> DONE}
+ [Hop in, Ribbon Bunny!]
    Ribbon Bunny gives a cheerful hop and wiggles straight down the clover burrow! # speaker: Fae
    ~ gem_hills = true
    She pops right back out with the sparkling Clover Star Gem and five shiny coins! # speaker: Fae # sound: chime-green # gift: coins 5
    Best bunny explorer ever! # speaker: Fae
    -> DONE
+ [Not now]
    -> DONE
= after
Soft four-leaf clovers sway beside the meadow boulder burrow. # speaker: Fae
-> DONE

// Peekaboo mini-boss Starey Owl & Taco Truck Talk mini-boss Chef Mateo (Milestone 81).
VAR moon_owl_out = false
VAR taco_chef_out = false
VAR mateo_snacks_given = false

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

=== taco_flyer ===
{not taco_chef_out:
    A bright paper flyer fluttering in the Clover Hills grass: "CLOVERHOLLOW TACO TRUCK! Crispy Tacos, Lime Squeeze, & Warm Smiles!" # speaker: Flyer
    Suddenly a swirling purple spice cloud puffs up beside the meadow path! # speaker: Fae
    ~ taco_chef_out = true
    WHOOSH! Chef Mateo marches into the clearing with swirly eyes, waving his wooden spoon! # speaker: Fae
    -> DONE
}
{calmed("taco-chef"):
    The colorful Cloverhollow Taco Truck flyer is pinned neatly to a clover post. It smells delicious out here! # speaker: Fae
- else:
    The bright Cloverhollow Taco Truck flyer flutters wildly in Chef Mateo's spicy breeze! # speaker: Fae
}
-> DONE

=== mateo_talk_1 ===
Nobody in Cloverhollow even CARES about crispy tacos anymore! My whole recipe feels fizzed up! # speaker: Chef Mateo
+ [Bon Appetit's chalkboard has Tuesday tacos!]
    Wait... Chef Bea wrote my crispy tacos right on the cafe chalkboard?! That warms my whole apron! # speaker: Chef Mateo # grade: great
    -> DONE
+ [Folks in town love your warm kitchen smell!]
    Hmph... well, my salsa DOES smell pretty amazing across the hills. # speaker: Chef Mateo # grade: good
    -> DONE
+ [Maybe tacos are just too crunchy?]
    TOO CRUNCHY?! Crunch is the soul of a taco, kiddo! # speaker: Chef Mateo # grade: miss
    -> DONE
-> DONE

=== mateo_talk_2 ===
Even the kids at school probably forgot what taco day tastes like... # speaker: Chef Mateo
+ [Principal Bell announced "Lunch is tacos!"]
    He announced taco day on the school speaker?! HA! I knew folks were excited! # speaker: Chef Mateo # grade: great
    -> DONE
+ [My whole class gets hungry before recess!]
    That's true! Hungry explorers always need a good lunch! # speaker: Chef Mateo # grade: good
    -> DONE
+ [Maybe everyone only wants cinnamon buns?]
    Hey, cinnamon buns are great, but you can't beat a warm taco for lunch! # speaker: Chef Mateo # grade: miss
    -> DONE
-> DONE

=== mateo_talk_3 ===
Why do you think folks keep coming back to my taco window anyway, Fae? # speaker: Chef Mateo
+ [Sharing crunchy snacks makes friends smile!]
    ...You're right, Fae. Cooking isn't about shouting louder, it's about sharing with friends! # speaker: Chef Mateo # grade: great
    -> DONE
+ [Your wooden spoon looks super professional!]
    Haha, well it IS my favorite stirring spoon, and it works best with a calm chef! # speaker: Chef Mateo # grade: good
    -> DONE
+ [Spicy clouds clear out stuffed noses?]
    Whoa, nobody wants a sneezy taco! Let me dial down the cayenne! # speaker: Chef Mateo # grade: miss
    -> DONE
-> DONE

=== taco_chef_calm ===
{mateo_snacks_given: -> again}
Whew... my head feels clear again! Thank you for talking me down, Fae! # speaker: Chef Mateo
A kid in a purple hood zoomed past my truck and handed me a fizzy purple soda as a "new drink idea." One sip and I started tossing spice clouds everywhere! # speaker: Chef Mateo
~ mateo_snacks_given = true
Here, take two fresh crispy taco snacks on the house for you and your friends! # speaker: Chef Mateo # gift: snack 2
And keep my shiny Golden Taco Badge in your clubhouse chest! You're officially Cloverhollow's best taste-tester! # speaker: Chef Mateo # sound: chime-yellow
Awesome! Thanks, Chef Mateo! # speaker: Fae
-> mateo_shop
= again
Hola, Fae! The grill is warm, the limes are fresh, and there's zero purple fizz in the salsa! # speaker: Chef Mateo
-> mateo_shop
= mateo_shop
{coins() < 4: Crispy taco snacks are 4 coins apiece whenever you want a crunch! # speaker: Chef Mateo}
+ {coins() >= 4} [Buy a crispy taco snack for 4 coins]
    One hot, crispy Cloverhollow taco, wrapped up tight for your backpack! # speaker: Chef Mateo # buy: snack 4
    -> DONE
+ [Just saying hi!]
    Always happy to see my favorite taste-tester, Fae! Come back anytime. # speaker: Chef Mateo
    -> DONE

// The Wildlife Sanctuary: living calm-animal meadow east of Clover Hills.
VAR sanctuary_visited = false
VAR sanctuary_reward_3 = false
VAR sanctuary_reward_8 = false
VAR sanctuary_reward_14 = false
VAR sanctuary_picnic_basket = false

=== function sanctuary_count() ===
~ temp total = 0
{calmed("fountain-frog") or calmed("frog"):
    ~ total = total + 1
}
{calmed("pup"):
    ~ total = total + 1
}
{calmed("cat"):
    ~ total = total + 1
}
{calmed("raccoon"):
    ~ total = total + 1
}
{calmed("bluebird"):
    ~ total = total + 1
}
{calmed("crab"):
    ~ total = total + 1
}
{calmed("hamster"):
    ~ total = total + 1
}
{calmed("penguin"):
    ~ total = total + 1
}
{calmed("bunny"):
    ~ total = total + 1
}
{calmed("squirrel"):
    ~ total = total + 1
}
{calmed("gull"):
    ~ total = total + 1
}
{calmed("owl"):
    ~ total = total + 1
}
{calmed("lamb"):
    ~ total = total + 1
}
{calmed("hedgehog"):
    ~ total = total + 1
}
{calmed("bat"):
    ~ total = total + 1
}
{calmed("crystal-mole"):
    ~ total = total + 1
}
{calmed("moon-owl"):
    ~ total = total + 1
}
~ return total

=== ranger_fern ===
~ temp count = sanctuary_count()
{not sanctuary_visited:
    ~ sanctuary_visited = true
    Welcome to Cloverhollow's Wildlife Sanctuary, Fae! I'm Ranger Fern. # speaker: Ranger Fern
    Whenever a valley critter shakes off that purple fizz, it loves wandering up to this sunny meadow for fresh clover, pond naps, and gentle company. # speaker: Ranger Fern
}
{
- count >= 14 and not sanctuary_reward_14:
    ~ sanctuary_reward_14 = true
    ~ sanctuary_reward_8 = true
    ~ sanctuary_reward_3 = true
    Look around this meadow, Fae! {count} of 17 valley animals are relaxing right here in the sunshine! # speaker: Ranger Fern
    I wove this Sanctuary Clover Wreath for your clubhouse keepsake chest, plus forty coins and two picnic snacks from the ranger pantry! # speaker: Ranger Fern # gift: coins 40 # sound: chime-red
    Every single creature in Cloverhollow knows you're a true friend! # speaker: Ranger Fern # gift: snack 2
    Whoa, it smells like alpine wildflowers! Thank you, Ranger Fern! # speaker: Fae
    -> DONE
- count >= 8 and not sanctuary_reward_8:
    ~ sanctuary_reward_8 = true
    ~ sanctuary_reward_3 = true
    Oh, my heart! {count} of 17 valley animals are already visiting our sanctuary meadow! # speaker: Ranger Fern
    Take twenty-five coins and two trail snacks from the ranger pouch, Fae. You've brought so much peace back to these hills! # speaker: Ranger Fern # gift: coins 25 # sound: chime-blue
    Keep soothing shy critters across the valley, and I'll have a handmade keepsake ready when fourteen friends visit! # speaker: Ranger Fern # gift: snack 2
    -> DONE
- count >= 3 and not sanctuary_reward_3:
    ~ sanctuary_reward_3 = true
    Look who's dropped by! {count} of 17 valley animals are already napping and playing in the meadow! # speaker: Ranger Fern
    Here's fifteen coins and a berry snack for being so kind to our furry and feathered neighbors! # speaker: Ranger Fern # gift: coins 15 # sound: chime-yellow
    Come say hi again once eight valley friends have found their way here! # speaker: Ranger Fern # gift: snack 1
    -> DONE
- count == 17:
    All 17 of 17 valley animals are visiting the Wildlife Sanctuary together! Listen to them chirp, purr, and splash! # speaker: Ranger Fern
    Feel free to pet any of your friends or spread out on the checkered picnic blanket whenever you like, Fae! # speaker: Ranger Fern
- count == 0:
    Right now 0 of 17 valley animals have wandered up here yet. # speaker: Ranger Fern
    Once you calm critters around Cloverhollow, Bubblegum Bay, Pinecone Pass, and the woods, they'll start visiting this meadow! # speaker: Ranger Fern
- else:
    Right now {count} of 17 valley animals are visiting the sanctuary meadow! # speaker: Ranger Fern
    Walk right up and pet anyone you've calmed, or check the wooden bulletin board to see which valley regions still have shy critters! # speaker: Ranger Fern
}
{
- sanctuary_gift:
    And thank you for checking our Pinecone Pass trail board! Hope the Ranger Basket came in handy! # speaker: Ranger Fern
- buster_reward:
    Look at you, an official Star-Line Explorer! Buster tells all the mountain hikers about you! # speaker: Ranger Fern
}
-> DONE

=== sanctuary_board ===
~ temp count = sanctuary_count()
"CLOVERHOLLOW WILDLIFE SANCTUARY — Today's Visitors: {count} of 17 valley animals!" # speaker: Sanctuary Board
{count == 17:
    Every single meadow, shoreline, cavern, and woodland friend has signed the visitor log with a muddy pawprint or feather! # speaker: Fae
    -> DONE
}
{not (calmed("fountain-frog") or calmed("frog")) or not calmed("pup") or not calmed("cat") or not calmed("raccoon"):
    Cloverhollow Town & Meadow Park still have shy critters around the fountain, alleys, and pond. # speaker: Sanctuary Board
}
{not calmed("bluebird") or not calmed("crab") or not calmed("gull"):
    Bubblegum Bay & Cliffside Trail still have coastal birds and shoreline friends waiting for a calm hello. # speaker: Sanctuary Board
}
{not calmed("hamster") or not calmed("penguin") or not calmed("bat") or not calmed("crystal-mole"):
    Pinecone Pass & Crystal Cavern still have mountain and crystal-cave neighbors tucked away in the snow and sparkle. # speaker: Sanctuary Board
}
{not calmed("bunny") or not calmed("squirrel") or not calmed("owl") or not calmed("lamb") or not calmed("hedgehog") or not calmed("moon-owl"):
    Whispering Woods & Clover Hills still have woodland and hillside critters hiding among the pines and clover. # speaker: Sanctuary Board
}
-> DONE

=== sanctuary_picnic ===
~ temp count = sanctuary_count()
Fae and Maddie hop onto the red-and-cream checkered picnic blanket in the warm alpine sun! # speaker: Fae
{sue_joined: Sue stretches out her legs and leans back on her elbows. "Best picnic spot in the whole valley!" # speaker: Sue}
{jordan_joined: Jordan unpacks a thermos of apple cider and grins at the clover hills. "Nothing beats fresh mountain air." # speaker: Jordan}
{
- count >= 8:
    All around the blanket, {count} peaceful valley critters blink sleepily in the breeze while butterflies drift overhead. # speaker: Fae
- count > 0:
    Across the sunlit grass, {count} calm valley friends twitch their ears happily as the breeze carries clover blossoms past. # speaker: Fae
- else:
    The meadow is quiet and golden, ready for all the calm critters who'll come visiting soon. # speaker: Fae
}
{not sanctuary_picnic_basket:
    ~ sanctuary_picnic_basket = true
    There's a warm honey biscuit tucked inside Ranger Fern's wicker picnic basket with a note: "For kind explorers!" # speaker: Fae # gift: snack 1 # sound: chime-green
}
-> DONE

=== sanctuary_barn ===
Sweet sun-dried hay and fresh clover fill the tidy timber barn. Little woven nests and cozy straw beds wait along the rafters for visiting critters! # speaker: Fae
-> DONE

=== pet_frog ===
Ribbit! Fountain Frog puffs its rosy cheeks and blows a tiny rainbow bubble that pops right on Fae's nose! # speaker: Fountain Frog # sound: chime-green
-> DONE

=== pet_pup ===
Arf! Pond Pup flops onto its back in the wildflowers and wags its fluffy tail like a tiny windmill! # speaker: Pond Pup # sound: chime-yellow
-> DONE

=== pet_bluebird ===
Tweet-tweet! Bay Bluebird hops onto the stone birdbath rim and whistles a bright three-note thank-you! # speaker: Bay Bluebird # sound: chime-yellow
-> DONE

=== pet_gull ===
Lookout Gull puffs out its snowy feathers proudly and lets Fae give one very dignified pat on the head! # speaker: Lookout Gull # sound: chime-green
-> DONE

=== pet_penguin ===
Waddle Penguin flaps its flippers in a delighted little circle and slides an inch across the cool grass! # speaker: Waddle Penguin # sound: chime-green
-> DONE

=== pet_lamb ===
Baa! Clover Lamb nudges Fae's hand with its velvety nose and munches a sprig of golden hay! # speaker: Clover Lamb # sound: chime-yellow
-> DONE

=== pet_bunny ===
Ribbon Bunny wiggles its twitchy pink nose and does a happy binky hop over the daisies! # speaker: Ribbon Bunny # sound: chime-yellow
-> DONE

=== pet_cat ===
Purrrr... Cozy Cat curls into a warm cinnamon loaf in the sunbeam and leans right into Fae's scritches! # speaker: Cozy Cat # sound: chime-green
-> DONE

=== pet_hamster ===
Hiker Hamster puffs both cheeks with clover seeds and gives Fae a tiny cheerful salute! # speaker: Hiker Hamster # sound: chime-yellow
-> DONE

=== pet_hedgehog ===
Sniff-sniff! Meadow Hedgehog uncurls its soft tummy and blinks happily at Fae from the clover patch! # speaker: Meadow Hedgehog # sound: chime-green
-> DONE

=== pet_squirrel ===
Chitter! Acorn Squirrel pats Fae's palm with tiny paws and proudly shows off its shiniest oak acorn! # speaker: Acorn Squirrel # sound: chime-yellow
-> DONE

=== pet_raccoon ===
Ringtail Raccoon peeks out with polite curiosity, washes a dandelion puff in its paws, and offers it to Fae! # speaker: Ringtail Raccoon # sound: chime-green
-> DONE

=== pet_owl ===
Hoo-hoo... Whispering Owl fluffs its soft feather tufts and blinks slowly with calm woodland wisdom! # speaker: Whispering Owl # sound: chime-green
-> DONE

=== pet_moon_owl ===
Hoo-hoo! Starry Owl blinks its golden crescent eyes fondly, letting a pinch of soft stardust drift onto Fae's sleeve! # speaker: Starry Owl # sound: chime-yellow
-> DONE

=== pet_bat ===
Squeak! Cozy Bat snuggles happily into its yellow star bandana and flutters a warm hello beside the mossy stones! # speaker: Cozy Bat # sound: chime-yellow
-> DONE

=== pet_mole ===
Gem Mole polishes a tiny sparkling meadow pebble with its paws and holds it up for Fae to admire! # speaker: Gem Mole # sound: chime-green
-> DONE

=== pet_crab ===
Click-clack! Sandy Crab does a cheerful sideways shuffle along the warm sunlit footpath and waves both claws! # speaker: Sandy Crab # sound: chime-yellow
-> DONE

// Other Kids' Houses: Sue's Beach Cottage & Jordan's Mountain Cabin.
VAR sue_cottage_visited = false
VAR sue_compass = false
VAR sue_basket_taken = false
VAR sue_note_read = false
VAR jordan_cabin_visited = false
VAR jordan_clover = false
VAR jordan_note_read = false

=== sue_cottage_locked ===
A cozy mint-green beach cottage sits up the sandy cove, with painted driftwood trim and a brass porthole door. Maybe whoever lives here is down by the dock! # speaker: Fae
-> DONE

=== jordan_cabin_locked ===
A snug timber cabin peeks through the pines along the west trail! Smoke curls from its chimney, so maybe the hiker who lives here is up near the snowman. # speaker: Fae
-> DONE

=== sue_workbench ===
{sue_compass: -> again}
~ sue_cottage_visited = true
~ sue_compass = true
Whoa, look at all those painted fishing bobbers, sea-glass jars, and that wooden model sailboat! # speaker: Fae
Heh, welcome to tackle headquarters! I paint every bobber myself so the bay fish can spot a friendly wiggle. # speaker: Sue
Pro tip for the Bubblegum Bay dock: cast all the way into the golden RARE band if you want to hook the legendary Golden Starfish Crown! # speaker: Sue
And here, take my Sea-Glass Compass for your clubhouse chest, plus ten coins I fished out of my lucky jar! Its needle always points toward the bay! # speaker: Sue # gift: coins 10 # sound: chime-blue
It's shimmering seafoam green! Thanks so much, Sue! # speaker: Fae
-> DONE
= again
Sue's tackle workbench is neatly lined with painted bobbers, sea-glass jars, and her model sailboat. # speaker: Fae
Remember, Fae: cast deep into the golden RARE band off the Bubblegum Bay dock for the Golden Starfish Crown! # speaker: Sue
-> DONE

=== sue_bed ===
Sue's twin bed is topped with a bright coral-and-peach patchwork quilt. # speaker: Fae
My mom stitched that quilt out of all my old summer bandanas! It still smells a little bit like salt air and sunshine. # speaker: Sue
It looks super cozy. Best sleepover fort headquarters ever! # speaker: Fae
Anytime you want to swap adventure stories and listen to the tide, you're invited, Fae! # speaker: Sue
-> DONE

=== sue_lamp ===
A round glass jar full of frosted aqua sea glass glows softly on the nightstand above two tidy seashells. # speaker: Fae
I found every piece of that glass after summer storms. Oh, and don't tell anyone, but I tucked a secret glow-ink seashell doodle behind the jars! # speaker: Sue
{has_lantern: Good thing I have Jordan's blacklight lantern! Let's shine it near the workbench charts and look closely. # speaker: Fae|A glow-ink doodle? Maybe we'll find a special lantern that can light it up someday! # speaker: Fae}
-> DONE

=== sue_snacks ===
{sue_basket_taken: -> again}
~ sue_basket_taken = true
A woven coastal wicker basket sits on the floorboards, packed with bright beach snack pouches! # speaker: Fae
Go ahead and grab two for the road, Fae! Exploring on an empty stomach is against Bay Explorers Club rules! # speaker: Sue # gift: snack 2
Two free beach snacks! You're the best, Sue! # speaker: Fae
-> DONE
= again
Sue's wicker snack basket is neat and tidy on the driftwood planks, ready for the next seaside picnic. # speaker: Fae
-> DONE

=== sue_secret_note ===
{sue_note_read: -> again}
~ sue_note_read = true
Under the blacklight lantern, a hidden glow-ink seashell star chart lights up beside Sue's workbench! # speaker: Fae
\"BAY EXPLORERS CLUB STAR CHART: 1. Catch a shiny bay fish. 2. Map every cove. 3. Find the best adventure crew in Cloverhollow... DONE!!\" # speaker: Glow Note
Aw, Sue! You drew Maddie, Jordan, and me right under the Little Dipper! # speaker: Fae
Hey, no peeking at my secret ink! Fine, keep the ten lucky arcade coins I taped behind the chart! # speaker: Sue # gift: coins 10 # sound: chime-yellow
-> DONE
= again
Sue's glowing \"Bay Explorers Club\" star chart shimmers softly in lavender ink, with tiny stars sketched around her adventure crew. # speaker: Fae
-> DONE

=== jordan_table ===
{jordan_clover: -> again}
~ jordan_cabin_visited = true
~ jordan_clover = true
Three framed alpine wildflower sketches lean beside strawberry seed packets and a steaming copper cocoa pot! # speaker: Fae
Those pressed blooms belonged to my grandma. She taught me how to read every trail, and she always said calm valleys grow the sweetest berries. # speaker: Jordan
Here, keep this Pressed Alpine Clover from her botany book in your clubhouse chest, and pour yourself a mug from the copper cocoa pot! # speaker: Jordan # gift: snack 1 # sound: chime-green
It smells like mountain pine and hot chocolate! Thank you, Jordan! # speaker: Fae
-> DONE
= again
Grandma's pressed alpine wildflowers, strawberry seed packets, and the warm copper cocoa pot make the cabin smell cozy and sweet. # speaker: Fae
Calm valleys grow the sweetest berries, just like Grandma always said. # speaker: Jordan
-> DONE

=== jordan_bed ===
A sturdy log bed piled high with thick forest-green plaid quilts. # speaker: Fae
Best spot on Pinecone Pass when the mountain wind whistles against the windowpane! # speaker: Jordan
{sue_joined: Whoa, those blankets look ten times fluffier than my beach quilt! I'm calling dibs on the top wool layer! # speaker: Sue}
Haha, there's plenty of quilt to go around after a long snowy hike! # speaker: Jordan
-> DONE

=== jordan_rack ===
A neat timber A-frame rack holds Jordan's olive hiking pack, coiled trail rope, and a glowing brass camp lantern. # speaker: Fae
Always pack dry socks, extra rope, and good light! Oh, I also marked my secret trail-blaze compass notes in invisible ink right by my pinned mountain map. # speaker: Jordan
{has_lantern: Let's switch on your blacklight lantern near the mountain map and read them! # speaker: Fae|Invisible ink on a mountain map? We'll definitely need a blacklight lantern for that! # speaker: Fae}
-> DONE

=== jordan_firewood ===
Split cedar logs are stacked crisply inside a woven timber basket, filling the room with warm pine scent. # speaker: Fae
Nothing beats fresh cedar firewood on snowy Pinecone Pass evenings. Maddie would definitely nap right beside this basket! # speaker: Jordan
-> DONE

=== jordan_map_glow ===
{jordan_note_read: -> again}
~ jordan_note_read = true
Under the blacklight lantern, glowing trail-blaze compass marks flare brightly below Jordan's pinned mountain map! # speaker: Fae
\"SECRET VALLEY PASSAGES: Pinecone Pass north snow gap → Crystal Cavern. Clover Hills sunlit east trail → Wildlife Sanctuary!\" # speaker: Trail Note
Whoa! You mapped every hidden trail across the whole valley, Jordan! # speaker: Fae
Gotta be prepared! Oh, and take the ten trail-emergency coins tucked in my map tube, explorer to explorer! # speaker: Jordan # gift: coins 10 # sound: chime-blue
-> DONE
= again
Jordan's glowing trail-blaze marks link Pinecone Pass to Crystal Cavern and Clover Hills to the Wildlife Sanctuary in crisp lavender ink. # speaker: Fae
-> DONE


// Buster the Bus Driver, Star-Line Stamp Card errand & regional souvenir treat stands (Milestone 97).
VAR buster_quest = false
VAR stamp_bay = false
VAR stamp_pass = false
VAR buster_reward = false

=== buster ===
{buster_reward: -> after}
{buster_quest: -> progress}
All aboard, kiddo! I'm Buster, driver of the Cloverhollow Star-Line! # speaker: Buster
My bus loops right from this star sign out to Bubblegum Bay's sandy beach and all the way up to Pinecone Pass's snowy pines. # speaker: Buster
~ buster_quest = true
Tell you what: take this Star-Line Stamp Card! Visit Bubblegum Bay's seaside stand for a wave stamp and Pinecone Pass's mountain stand for a pine stamp. # speaker: Buster
Bring me both stamps, and I've got my lucky Golden Star-Line Whistle plus a travel bonus waiting just for you! # speaker: Buster
{not club_open: We'll stay parked here until your clues point out of town, then just tap the star sign to hop aboard! # speaker: Buster}
Deal! I'll fill the whole Star-Line Stamp Card! # speaker: Fae
-> DONE
= progress
{stamp_bay and stamp_pass: -> complete}
{stamp_bay:
    Ooh, you've got the Bubblegum Bay wave stamp already! One more to go! # speaker: Buster
    Next stop is Pinecone Pass's mountain stand for the crisp pine stamp. Hop on at the star sign whenever the mountain route's open! # speaker: Buster
    -> DONE
}
{stamp_pass:
    Hey, look at that Pinecone Pass pine stamp! Only one stamp left! # speaker: Buster
    Swing by Bubblegum Bay's seaside stand for the wave stamp, then bring that full card right back to me! # speaker: Buster
    -> DONE
}
Still got two empty star squares on your Star-Line Stamp Card, kiddo! # speaker: Buster
{not club_open: Once your town clues open the road out to Bubblegum Bay, tap the star sign right here and we'll roll out to the coast and mountains! # speaker: Buster|Visit Bubblegum Bay's seaside stand for a wave stamp and Pinecone Pass's mountain stand for a pine stamp, then come right back! # speaker: Buster}
-> DONE
= complete
Whoa-ho! Let me take a peek at that Star-Line Stamp Card! # speaker: Buster
Both stamps, shiny as stars! You're an official Star-Line Explorer, Fae! # speaker: Buster
~ buster_reward = true
Here's twenty-five shiny coins for your travels... # speaker: Buster # gift: coins 25
...two fresh road snacks for the backpack... # speaker: Buster # gift: snack 2
...and my Golden Star-Line Whistle! Keep it safe in your clubhouse chest, kiddo! # speaker: Buster # sound: chime-yellow
Whoa, a real Golden Star-Line Whistle! Thanks, Buster! # speaker: Fae
-> DONE
= after
All aboard anytime, Star-Line Explorer! Keep that Golden Star-Line Whistle shining bright! # speaker: Buster
{
- sanctuary_visited:
    Heard Ranger Fern's Sanctuary meadow is full of calm critters! Best detour in the valley! # speaker: Buster
- sue_cottage_visited and jordan_cabin_visited:
    Stops at Sue's beach cottage AND Jordan's mountain cabin? You've mastered the whole Star-Line route! # speaker: Buster
- bay_boat_charm:
    I spotted your pastel rowboat bobbing out in Bubblegum Bay from the coastal bus stop! Smooth sailing! # speaker: Buster
- clubhouse_claimed:
    Heard your crew fixed up a cozy woodland clubhouse too! Now that's first-class travel! # speaker: Buster
- has_flute:
    That wooden flute sounds sweeter than my morning bus horn, kiddo! # speaker: Buster
- else:
    Whenever you want sea air or mountain snow, just tap the star sign down by the southern bus bench! # speaker: Buster
}
-> DONE

=== bay_souvenirs ===
Welcome to the Bubblegum Bay seaside stand! Fresh pastel Sea-Salt Taffy and sunny bay keepsakes! # speaker: Bay keeper
{buster_quest and not stamp_bay:
    ~ stamp_bay = true
    A Star-Line Stamp Card from Buster? Stamp! One shiny Bubblegum Bay wave stamp, all yours! # speaker: Bay keeper # sound: chime-blue
}
{coins() < 9:
    Sea-Salt Taffy is 9 coins a bag. Come back whenever your pockets jingle! # speaker: Bay keeper
    -> DONE
}
+ {coins() >= 9} [Buy Sea-Salt Taffy (9 coins)]
    One pastel bag of chewy Sea-Salt Taffy! Beach and cavern critters adore it! # speaker: Bay keeper # buy-treat: sea-salt-taffy 9
+ [Not now]
    Enjoy the ocean breeze, Fae! Stop by anytime! # speaker: Bay keeper
- -> DONE

=== pass_souvenirs ===
Welcome to the Pinecone Pass mountain stand! Warm Maple Pine Brittle and snowy keepsakes! # speaker: Pass keeper
{buster_quest and not stamp_pass:
    ~ stamp_pass = true
    Buster's Star-Line Stamp Card! Stamp! One crisp Pinecone Pass pine stamp, ready to roll! # speaker: Pass keeper # sound: chime-green
}
{coins() < 11:
    Maple Pine Brittle is 11 coins a pack. Come warm up again anytime! # speaker: Pass keeper
    -> DONE
}
+ {coins() >= 11} [Buy Maple Pine Brittle (11 coins)]
    Fresh golden Maple Pine Brittle! Mountain and forest critters go cozy-wild for it! # speaker: Pass keeper # buy-treat: maple-brittle 11
+ [Not now]
    Stay warm out on the snow trails, Fae! # speaker: Pass keeper
- -> DONE

// Living World Landmarks: Bubblegum Bay Boat Rental & Pinecone Pass Wildlife Sanctuary (Milestone 94).
VAR bay_boat_charm = false
VAR sanctuary_gift = false

=== bay_boats ===
Pastel wooden rowboats bob gently beside the south pier, ready for a sunny harbor ride! # speaker: Fae
A painted harbor tag says: "Free community boats - just bring the oars back tidy!" # speaker: Fae
+ [Take a row out to the sunny cove]
    -> cruise
+ [Stay by the pier]
    Maybe after a little more exploring! # speaker: Fae
    -> DONE
= cruise
Splash, splash! The pastel rowboat glides out across Bubblegum Bay's sparkling water. # speaker: Fae
{sue_joined: Sue dips her fingers into the warm waves and grins. "Best cove on the whole coast, Fae!" # speaker: Sue}
{jordan_joined: Jordan squints out past the sunlit ripples. "Whoa, you can see the pebbles down there!" # speaker: Jordan}
{pup_with_me: The Pond Pup leans over the bow with flapping ears, barking at every glittery splash! # speaker: Fae|Maddie curls up on the dry bow bench, blinking lazily in the warm sea breeze. # speaker: Fae}
{not bay_boat_charm:
    ~ bay_boat_charm = true
    Ooh! Something shimmers on a smooth pebble bar... a Sea-Glass Clover and ten shiny coins! # speaker: Fae # gift: coins 10 # sound: chime-blue
    What a lucky harbor treasure! I'll write this sunny cove row in my journal. # speaker: Fae
- else:
    Golden ripples dance below the oars while tiny silver minnows dart under the boat! # speaker: Fae
}
-> DONE

=== pass_sanctuary ===
~ temp friends = 0
{calmed("hamster"):
    ~ friends += 1
}
{calmed("penguin"):
    ~ friends += 1
}
{calmed("owl"):
    ~ friends += 1
}
{calmed("squirrel"):
    ~ friends += 1
}
{calmed("lamb"):
    ~ friends += 1
}
{calmed("hedgehog"):
    ~ friends += 1
}
{calmed("bat"):
    ~ friends += 1
}
{calmed("crystal-mole"):
    ~ friends += 1
}
A carved pine trail board stands along the snowy ridge: "PINECONE PASS WILDLIFE SANCTUARY!" # speaker: Fae
Logged mountain & woodland friends in the snow tracks: {friends} of 8! # speaker: Fae
{friends >= 3 and not sanctuary_gift:
    ~ sanctuary_gift = true
    Tucked under the trail board is a ribbon-tied Sanctuary Ranger Basket with a cozy thank-you note! # speaker: Fae
    Inside are twelve shiny coins and two warm trail snacks! # speaker: Fae # gift: coins 12 # gift: snack 2 # sound: chime-yellow
    {friends == 8: All eight mountain and woodland species left cozy pawprints around the board! What a peaceful valley! # speaker: Fae}
    -> DONE
}
{sanctuary_gift:
    The Sanctuary Ranger Basket sits empty save for fresh snowy pawprints crisscrossing the snow. # speaker: Fae
    {friends == 8: All eight mountain and woodland friends visited the sanctuary! What a cozy valley! # speaker: Fae}
    -> DONE
}
Calm 3 mountain or woodland critters and check back for a Sanctuary Ranger thank-you basket! # speaker: Fae
-> DONE

// Cloverhollow's Final Two Plaza Shops: Cloverhollow Grocery Market & Sweet Scoop Ice Cream Parlor.
VAR market_visited = false
VAR market_note_read = false
VAR parlor_visited = false
VAR parlor_note_read = false

=== grocer_pippin ===
{market_visited: -> again}
~ market_visited = true
Well hello there, Fae! Welcome inside Cloverhollow Grocery Market! # speaker: Grocer Pippin
Every morning I pick crisp red apples out by the orchard fence and bake tiny crunchy fish crackers so every critter in the valley has a favourite snack. # speaker: Grocer Pippin
Here, take a complimentary Orchard Apple sample straight from the front crate! # speaker: Grocer Pippin # gift: snack 1
Ooh, it smells so fresh and crunchy! Thank you, Grocer Pippin! # speaker: Fae
Need any critter treats or trail snacks for your backpack today? # speaker: Grocer Pippin
-> market_shop
= again
Welcome back to Cloverhollow Grocery Market, Fae! Fresh apples and crunchy crackers straight off the shelves! # speaker: Grocer Pippin
-> market_shop
= market_shop
{coins() < 5:
    Trail Snacks are 5 coins and critter treats are 8 coins apiece. Stop back in anytime your pockets jingle! # speaker: Grocer Pippin
    -> DONE
}
+ {coins() >= 8} [Orchard Apple — 8 coins (sweet critters love it!)]
    Crisp orchard slices, wrapped in brown paper! Sweet critters in the meadows, hills, and caves adore these! # speaker: Grocer Pippin # buy-treat: orchard-apple 8
    -> DONE
+ {coins() >= 8} [Fish Cracker — 8 coins (pond & bay friends love it!)]
    Crunchy little fish crackers, warm from the jar! Pups, cats, and bay friends can't resist them! # speaker: Grocer Pippin # buy-treat: fish-cracker 8
    -> DONE
+ {coins() >= 5} [Trail Snack — 5 coins]
    One tidy trail snack wrapped up for the road! Happy exploring, Fae! # speaker: Grocer Pippin # buy: snack 5
    -> DONE
+ [Just browsing!]
    Take your time! The jam shelves smell especially cozy today. # speaker: Grocer Pippin
    -> DONE

=== market_produce ===
Wooden produce bins brim with glossy red orchard apples, sunny oranges, and honey pears, all stacked into neat pyramids! # speaker: Fae
-> DONE

=== market_shelves ===
Tidy rows of homemade strawberry jam jars, crusty golden bread loaves, and brown paper grocery bags line the pine shelves! # speaker: Fae
-> DONE

=== market_berries ===
A stout timber barrel overflows with fresh wild berries picked along the meadow edges. # speaker: Fae
{has_lantern: Wait... Grocer Pippin mentioned someone tucked a glowing grocery list over by the jam shelves! Let's switch on Jordan's blacklight lantern and take a peek. # speaker: Fae|A tiny chalk doodle on the barrel rim hints that someone tucked an invisible-ink grocery list over by the jam shelves!}
-> DONE

=== market_list_glow ===
{market_note_read: -> again}
~ market_note_read = true
Under Jordan's blacklight lantern, a hidden lavender-ink recipe note lights up on the floorboards near the jam shelves! # speaker: Fae
\"SECRET ORCHARD TIP: Sweet critters in the meadows, hills, and caves go wild for Orchard Apples, while bay & pond friends can't resist Fish Crackers!\" # speaker: Glow Note
Ooh, and ten lucky change coins are tucked neatly under the note! # speaker: Fae # sound: chime-yellow # gift: coins 10
-> DONE
= again
The glowing Cloverhollow Recipe Note shimmers softly: Orchard Apples for sweet meadow, hill, and cave critters, and Fish Crackers for bay and pond friends! # speaker: Fae
-> DONE

=== scooper_penny ===
{parlor_visited: -> again}
~ parlor_visited = true
Yay, welcome inside Sweet Scoop Ice Cream Parlor, Fae! Pull up a stool! # speaker: Scooper Penny
Every first-time visitor gets a complimentary Cloverhollow Dream Sundae made to order! Which flavor should I scoop for your crew? # speaker: Scooper Penny
+ [Strawberry Swirl!]
    One towering Strawberry Swirl Dream Sundae, coming right up! # speaker: Scooper Penny # gift: snack 1 # sound: chime-blue
    Maddie's whiskers twitch as she happily licks a tiny pink ribbon of foam right off her nose! # speaker: Fae
    {sue_joined: Best strawberry swirl in town! Even sweeter than bay boardwalk taffy! # speaker: Sue}
    {jordan_joined: Whoa, it tastes like fresh clubhouse berries! # speaker: Jordan}
    -> parlor_shop
+ [Mint Cloud Chip!]
    One fluffy Mint Cloud Chip Dream Sundae with crispy cocoa sprinkles! # speaker: Scooper Penny # gift: snack 1 # sound: chime-blue
    Maddie gives one curious sniff, sneezes a tiny minty puff, and purrs like a motorboat! # speaker: Fae
    {sue_joined: Minty and cool like a sea breeze! Ten out of ten! # speaker: Sue}
    {jordan_joined: Reminds me of snowy Pinecone Pass air, only way tastier! # speaker: Jordan}
    -> parlor_shop
+ [Warm Honey Caramel!]
    One golden Warm Honey Caramel Dream Sundae, swirled nice and cozy! # speaker: Scooper Penny # gift: snack 1 # sound: chime-blue
    Maddie curls right around Fae's boots, eyes half-closed in pure caramel bliss! # speaker: Fae
    {sue_joined: Ooh, sticky-sweet perfection! Save me a spoonful! # speaker: Sue}
    {jordan_joined: Now THAT is prime mountain-explorer fuel! # speaker: Jordan}
    -> parlor_shop
= again
Welcome back to Sweet Scoop Ice Cream Parlor, Fae! The waffle cones are extra crispy today! # speaker: Scooper Penny
-> parlor_shop
= parlor_shop
{coins() < 10:
    Berry Swirl Cones are 10 coins and Cozy Cocoa Sundaes are 12 coins. Come cool off anytime! # speaker: Scooper Penny
    -> DONE
}
+ {coins() >= 10} [Berry Swirl Cone — 10 coins (sunny friends & shopkeepers love it!)]
    One double-scoop Berry Swirl Cone! Sunny critters and Cloverhollow shopkeepers adore this scoop! # speaker: Scooper Penny # buy-treat: berry-cone 10
    -> DONE
+ {coins() >= 12} [Cozy Cocoa Sundae — 12 coins (cozy winter & cave friends love it!)]
    One warm Cozy Cocoa Sundae with fluffy marshmallows! Winter and cave friends melt into smiles for this! # speaker: Scooper Penny # buy-treat: cocoa-sundae 12
    -> DONE
+ [Just admiring the flavors!]
    Keep cool out there, Fae! Our pastel tubs are always ready for a scoop break! # speaker: Scooper Penny
    -> DONE

=== parlor_gelato ===
Seven pastel tubs of strawberry, mint, vanilla-bean, and hot-cocoa swirl ice cream gleam beneath the curved glass case beside tall stacks of crispy waffle cones! # speaker: Fae
-> DONE

=== parlor_menu ===
Hand-lettered pastel chalk spells out today's parlor specials: Berry Swirl Cones, Cozy Cocoa Sundaes, and Double-Scoop Rainbow Bowls! # speaker: Fae
-> DONE

=== parlor_window ===
Through the sunny blue-striped awning window, Cloverhollow Plaza's fountain sparkles beside the flower planters! # speaker: Fae
{has_lantern: A tiny pastel sticker on the sill winks about a \"Secret Sundae Club\" invisible-ink doodle over by the curved gelato case! # speaker: Fae|A tiny pastel sticker on the sill winks about an invisible-ink \"Secret Sundae Club\" doodle hidden near the curved gelato case! # speaker: Fae}
-> DONE

=== parlor_secret_glow ===
{parlor_note_read: -> again}
~ parlor_note_read = true
Under Jordan's blacklight lantern, a sparkling lavender \"Secret Sundae Club\" doodle glows right beside the curved gelato case! # speaker: Fae
\"SCOOP MASTER SECRET: Try sharing a Berry Swirl Cone or Cozy Cocoa Sundae in battle—seeing their favourite treat melts chaos fizz right away!\" # speaker: Glow Note
And ten shiny parlor coins gleam neatly beside the secret doodle! # speaker: Fae # sound: chime-yellow # gift: coins 10
-> DONE
= again
The sparkling \"Secret Sundae Club\" glow-ink doodle reminds Fae that sharing a critter's favourite Berry Swirl Cone or Cozy Cocoa Sundae melts chaos fizz right away! # speaker: Fae
-> DONE

// Living NPCs across Cloverhollow: reactive townfolk, classmates, and trail neighbors.

=== npc_flora ===
{lanternOn():
    Oh, my word! Shining that little lantern makes every petal in the plaza shimmer like starlight! # speaker: Flora
}
{
- calmed("hooded-kid"):
    Look at these tulips now, Fae! Ever since you helped Milo feel right at home, every flowerbed in Cloverhollow is beaming! # speaker: Flora
- calmed("fountain-frog") and areaCalm():
    Hello, dear! With the fountain sparkling clean again, the whole plaza smells like sweet clover and sunshine. # speaker: Flora
- not areaCalm():
    Goodness me, Fae! A fizzy critter is bouncing right near my flower boxes! Mind your boots out there! # speaker: Flora
- else:
    Good morning, Fae! Pink bubbles from that fountain keep drifting straight into my marigolds. # speaker: Flora
}
{withParty("sue"):
    Your tulips always make the plaza feel brighter, Flora! # speaker: Sue
}
{withParty("jordan"):
    Those marigolds look even healthier than the wildflowers up on Pinecone Pass. # speaker: Jordan
}
{not garden_gift and (garden_ripe or withParty("ribbon-bunny")): -> garden_gift}
+ [Ask about her flowers]
    I planted clover, daisies, and sweet marigolds along the plaza walk. Kind hearts make a town bloom faster than fertilizer! # speaker: Flora
    {stickers() >= 5: With {stickers()} calm-down stickers in your book, you've been spreading kindness everywhere! # speaker: Flora}
    -> DONE
+ [Ask if she saw anything unusual]
    {calmed("hooded-kid"):
        Just happy neighbors and calm critters now! Every trail feels peaceful again. # speaker: Flora
    - else:
        Early this morning, a kid in a purple hood zoomed past my planters carrying a fizzy soda bottle. Left a trail of pink bubbles! # speaker: Flora
    }
    -> DONE
= garden_gift
{withParty("ribbon-bunny"):
    Why, look at your darling Ribbon Bunny sniffing my garden basket! She has the softest nose! # speaker: Flora
- else:
    I heard your clubhouse strawberry patch ripened! Fellow gardeners always share the harvest! # speaker: Flora
}
Here, take two honey-clover garden snacks for your backpack, Fae! # speaker: Flora # gift: snack 2 # sound: chime-green
Thank you so much, Flora! # speaker: Fae
-> DONE

=== npc_sammy_plaza ===
{lanternOn():
    Whoa! Purple glow-light! That looks like a secret arcade power-up! # speaker: Sammy
}
{
- not areaCalm():
    Whoa, Fae! There's a fizzy critter zooming around the plaza! Total boss battle energy! # speaker: Sammy
- clubhouse_claimed:
    Psst, Fae! The Cloverhollow Arcade lights just flickered back on! Someone inside sounded super fizzy though... # speaker: Sammy
- else:
    Heya, Fae! I've got a pocket full of shiny coins waiting for the arcade doors to open up! # speaker: Sammy
}
{withParty("sue"):
    Save us a turn on Skee-Ball once Mr. Pip opens up, Sammy! # speaker: Sue
}
+ [Ask about the arcade games]
    Boop-a-Mole, Skee-Ball, Comet Cruise, AND the claw machine! I'm totally winning a plushie today! # speaker: Sammy
    {stickers() >= 3: You've got {stickers()} stickers already? You've got serious gamer reflexes, Fae! # speaker: Sammy}
    -> DONE
+ [Ask about the purple fizz]
    {calmed("hooded-kid"):
        Wild that Milo could zip around so fast with that pond fizz! Glad he's hanging out with everyone again! # speaker: Sammy
    - else:
        I saw a kid in a purple hood peek right through the arcade window earlier, grinning like they had a cheat code! # speaker: Sammy
    }
    -> DONE

=== npc_sammy_arcade ===
{lanternOn():
    Whoa, purple lantern light in the arcade! This place looks twice as awesome! # speaker: Sammy
}
{
- won("star-racer-keychain"):
    NO WAY! You snagged the Star Racer Keychain from the ticket counter?! Legend status, Fae! # speaker: Sammy
- tickets() >= 10:
    Whoa, you've already racked up {tickets()} arcade tickets! Check out the counter before the good stuff goes! # speaker: Sammy
- else:
    YES! The arcade is back open, and Mr. Pip is totally chilled out again! Thanks a million, Fae! # speaker: Sammy
}
{withParty("sue"):
    First one to hit the top corner ring on Skee-Ball buys the cinnamon buns! # speaker: Sue
}
{withParty("jordan"):
    I'm aiming straight for Comet Cruise. Let's see how many stars we can catch! # speaker: Jordan
}
{not arcade_coins: -> arcade_coins}
+ [Ask for a high-score tip]
    On Skee-Ball, watch the aim arrow bounce cleanly off the edges. And on Boop-a-Mole, each mole gets a little quicker! # speaker: Sammy
    -> DONE
+ [Compare favorite machines]
    I love Comet Cruise, even when the rocks wobble past! {level() >= 4: At level {level()}, your timing must be unstoppable!|Keep practicing and you'll rule the scoreboard!} # speaker: Sammy
    -> DONE
= arcade_coins
Hey, you saved the whole arcade for all of us! Take ten arcade coins from my spare token pouch! # speaker: Sammy # gift: coins 10 # sound: chime-yellow
Awesome! Thanks, Sammy! # speaker: Fae
-> DONE

=== npc_pippa ===
{lanternOn():
    Ooh! Your blacklight lantern makes the park clover twinkle like tiny fireflies! # speaker: Pippa
}
{
- not areaCalm():
    Eep! Look out, Fae! The park critters got super bouncy from that purple fizz! # speaker: Pippa
- club_open:
    Whoa, you actually figured out the tree house password?! You're the coolest detective in Meadow Park! # speaker: Pippa
- else:
    Hi, Fae! Welcome to Meadow Park! I know every hiding spot, tree branch, and giggling critter in this meadow! # speaker: Pippa
}
{withParty("pond-pup"):
    AWW! Pond Pup is trotting right beside you! Look at that happy tail wag! # speaker: Pippa
}
{withParty("maddie"):
    Maddie looks extra fluffy in the park breeze today! # speaker: Pippa
}
{treats() > 0: Ooh, you're carrying specialty treats! Park critters go bananas for their favorite flavor! # speaker: Pippa}
+ [Try Pippa's Park Critter Riddle]
    -> riddle
+ [Ask what she spotted in the park]
    {calmed("hooded-kid"):
        Everything in Meadow Park is calm and cozy now! Even the pond ripples sound like a lullaby. # speaker: Pippa
    - else:
        Earlier a kid in a purple hood scrambled right past the picnic blanket whispering some silly password to the tree house! # speaker: Pippa
    }
    -> DONE
= riddle
Okay, ready? Which Meadow Park critter loves splashing by the water and once chased a fuzzy tennis ball? # speaker: Pippa
+ [The Pond Pup!]
    DING DING DING! You nailed it, Fae! Pond Pup is the splashiest friend in the whole park! # speaker: Pippa
    {not riddle_prize: -> riddle_prize}
    You're a certified park critter pro! # speaker: Pippa
    -> DONE
+ [A flying marshmallow?]
    Hee hee! If there's a flying marshmallow in Meadow Park, I want to meet it too! Try again anytime! # speaker: Pippa
    -> DONE
= riddle_prize
For acing my Meadow Park riddle, here's a crunchy park snack and five shiny coins! # speaker: Pippa # gift: snack 1 # gift: coins 5 # sound: chime-yellow
Yay, thanks Pippa! # speaker: Fae
-> DONE

=== npc_leo_hall ===
{lanternOn():
    Whoa! An ultraviolet blacklight beam! You could spot invisible ink all down East Hall with that! # speaker: Leo
}
{
- art_open:
    Ms. Rowan's Art Room is back open! I logged every purple paint swirl in my notebook before it cleared. # speaker: Leo
- art_teacher_out:
    Careful down the east end of the hall, Fae! Ms. Rowan got hit with purple fizz and is painting mid-air loops! # speaker: Leo
- else:
    Hey, Fae! I'm keeping a scientific log of every fizzy happening at Cloverhollow School! # speaker: Leo
}
{withParty("jordan"):
    Smart thinking taking notes, Leo. Good field logs always solve a trail mystery! # speaker: Jordan
}
{not npc_leo_hall.grant and not npc_leo_field.grant and stickers() >= 6: -> grant}
+ [Share your sticker count]
    Let's see... {stickers()} stickers recorded so far, and explorer level {level()}! # speaker: Leo
    {stickers() < 6: Bring me at least six critter stickers and I'll award you a Junior Field-Research Grant!|That's extraordinary field data, Fae!} # speaker: Leo
    -> DONE
+ [Ask about East Hall clues]
    {calmed("hooded-kid"):
        Now that Milo explained the Mystic Pond wish, every single fizz spike in my chart fits together! # speaker: Leo
    - else:
        Someone in a purple hood sprinted past these lockers way faster than normal jogging speed. Definitely fizz-powered! # speaker: Leo
    }
    -> DONE
= grant
Wait a second! You've already gathered {stickers()} critter stickers?! That qualifies for my official Junior Field-Research Grant! # speaker: Leo
Here are fifteen shiny coins to fund your continuing valley fieldwork! # speaker: Leo # gift: coins 15 # sound: chime-blue
Whoa, thanks Professor Leo! # speaker: Fae
-> DONE

=== npc_leo_field ===
{lanternOn():
    Testing your blacklight out in the sunshine? Clever! Hidden markers still react under UV light! # speaker: Leo
}
{
- not areaCalm():
    Heads up, Fae! That oak squirrel by the creek is tossing acorns at warp speed! # speaker: Leo
- stash_found:
    You found the hidden stash behind the stump?! Purple markers and a Star Racer token, huge breakthrough! # speaker: Leo
- bridge_down:
    Lowering the old footbridge with a lasso was pure engineering brilliance, Fae! # speaker: Leo
- else:
    Recess! Best time to map the playing field and check why the creek squirrel got so jumpy! # speaker: Leo
}
{withParty("acorn-squirrel"):
    An actual Acorn Squirrel on your team?! Hold on, let me sketch its climbing posture! # speaker: Leo
}
{not npc_leo_hall.grant and not npc_leo_field.grant and stickers() >= 6: -> grant}
+ [Ask about the playing field]
    The old oak branch stretches right over the creek, and there's a wooden lever across on the far bank. # speaker: Leo
    -> DONE
+ [Check your explorer stats]
    Explorer level {level()}, {stickers()} stickers logged, and {gem_count()} Star Gems charted! Top-notch work, Fae! # speaker: Leo
    -> DONE
= grant
Hold everything! {stickers()} critter stickers in your field album?! You earned my Junior Field-Research Grant! # speaker: Leo
Take fifteen shiny coins for your explorer supply kit! # speaker: Leo # gift: coins 15 # sound: chime-blue
Awesome, thanks Leo! # speaker: Fae
-> DONE

=== npc_maya_field ===
{lanternOn():
    Ooh! Your lantern casts the dreamiest lavender glow across the grass! # speaker: Maya
}
{
- not areaCalm():
    Whoa, watch your sketchbook! That fizzy squirrel by the oak is flinging acorns everywhere! # speaker: Maya
- saw_hood:
    Did you see that kid in a purple hood bolt past hopscotch? They dropped purple chalk sparks all over my shoes! # speaker: Maya
- else:
    Hey, Fae! Since the Art Room door is locked right now, I'm sketching clouds out here during recess! # speaker: Maya
}
{withParty("ribbon-bunny"):
    Eek, a Ribbon Bunny! Her pink bow matches my watercolor palette! # speaker: Maya
}
+ [Ask about the missing purple markers]
    Every single purple marker in the Art Room vanished overnight! Somebody must be on the world's biggest doodle spree. # speaker: Maya
    -> DONE
+ [Ask what she's drawing]
    A giant rainbow mural of Cloverhollow School, with extra sparkles around the oak tree! # speaker: Maya
    -> DONE

=== npc_maya_art ===
{lanternOn():
    Ooh, blacklight glow in the Art Room! All the neon paint tubes are lighting up like magic! # speaker: Maya
}
{
- calmed("hooded-kid"):
    Milo told us he wants to help repaint the hallway banner together! Having all our classmates back feels wonderful! # speaker: Maya
- else:
    Hooray! Ms. Rowan is feeling calm again, and the Art Room is finally open! Thank you, Fae! # speaker: Maya
}
{withParty("sue"):
    Your ocean paintings on the wall look just like Bubblegum Bay at sunset, Maya! # speaker: Sue
}
{withParty("jordan"):
    Next time you paint Pinecone Pass, add a couple of happy snow hamsters! # speaker: Jordan
}
{npc_wren.sketch_complete:
    Did you see Wren's finished Field Compendium?! That crystal rubbing and pressed clover inspired my whole new gallery series! # speaker: Maya
}
{not art_snack: -> art_snack}
+ [Look at her easel]
    I'm painting all the calm critters you've helped! {stickers() >= 8: With {stickers()} stickers in your album, I'm going to need a bigger canvas!|Tell me every new critter you meet!} # speaker: Maya
    -> DONE
+ [Ask about Ms. Rowan's paints]
    Ms. Rowan mixed a fresh batch of lavender paint: zero fizz, maximum sparkle! # speaker: Maya
    -> DONE
= art_snack
Before you head back out, take one of my lucky studio snacks! Artists and explorers both need fuel! # speaker: Maya # gift: snack 1 # sound: chime-yellow
Thanks, Maya! # speaker: Fae
-> DONE

=== npc_sal ===
{lanternOn():
    Shiver me compass! That glowing purple lantern shines brighter than the harbor lighthouse! # speaker: Captain Sal
}
{
- not areaCalm():
    Steady on deck, young skipper! There's a fizzy critter kicking up sand along the cove! # speaker: Captain Sal
- calmed("lifeguard"):
    Ahoy, Fae! With Ms. Coral back in good spirits and the beach calm, Bubblegum Bay is pure smooth sailing! # speaker: Captain Sal
- else:
    Ahoy there, Fae! Welcome to Bubblegum Bay, where the sand stays warm and the tide brings shiny surprises! # speaker: Captain Sal
}
{withParty("sue"):
    Ahoy, Sue! Still the sharpest fisher on the pier, I see! # speaker: Captain Sal
    You bet, Captain Sal! Saving the biggest waves for Fae's crew! # speaker: Sue
}
{withParty("pond-pup"):
    Ha! A seafaring Pond Pup! Bet that little matey could fetch treasure right out of the tide pools! # speaker: Captain Sal
}
{not harbor_snack: -> harbor_snack}
+ [Ask for a Bubblegum Bay sea tale]
    {treasure_found:
        Blimey, you actually dug up the old pirate treasure between the palms! That tale's true after all! # speaker: Captain Sal
    - else:
        Legend says an old sea captain corked a treasure map in a glass bottle and tossed it off the eastern dock! # speaker: Captain Sal
    }
    -> DONE
+ [Talk about Star Gems and tides]
    {gem_count() > 0:
        You've already charted {gem_count()} Star Gems?! Even the deep tide pools glint with hidden gems if a good swimmer looks! # speaker: Captain Sal
    - else:
        Keep your eyes peeled along the rocky surf. Shimmering treasures love hiding where the sea foam sparkles! # speaker: Captain Sal
    }
    -> DONE
+ {npc_gus.gave_postcard and not gave_mountain_letter} [Deliver Gus's Seashell Postcard!]
    -> gave_mountain_letter
= harbor_snack
Every brave harbor explorer deserves rations for the voyage! Take two salty-sweet sea-breeze snacks, Fae! # speaker: Captain Sal # gift: snack 2 # sound: chime-blue
Aye-aye, Captain Sal! Thank you! # speaker: Fae
-> DONE
= gave_mountain_letter
Well blow me down! Mailman Gus's Seashell Postcard sailed straight to the pier! Take eight shiny harbor coins for your swift feet, Fae! # speaker: Captain Sal # gift: coins 8 # sound: chime-blue
While you're charting the high roads, would you carry this Mountain Reply Letter up to Mina in Pinecone Pass? # speaker: Captain Sal
You bet, Captain Sal! I'll deliver it straight to Mina! # speaker: Fae
-> DONE

=== npc_nora ===
{lanternOn():
    Whoa! Your lantern makes all the wet seashells along the shore glow neon! # speaker: Nora
}
{
- not areaCalm():
    Hey! Keep those fizzy critters away from my shell collection! They almost flattened my tower! # speaker: Nora
- calmed("crab"):
    The little south-beach crabs stopped pinching and started tapping funny rhythms on the shells! So cute! # speaker: Nora
- else:
    Hi, Fae! I'm hunting for the rarest pink spiral shells in all of Bubblegum Bay! # speaker: Nora
}
{withParty("pond-pup"):
    Ooh, Pond Pup! Wanna help me sniff out shiny shells near the surf? # speaker: Nora
}
{withParty("sue"):
    Save me a lucky pink shell for my tackle box, Nora! # speaker: Sue
}
+ [Ask about her shell collection]
    I've got scalloped shells, star-striped shells, and a tiny pearl button! {treasure_found: Still nothing beats your real pirate treasure though!|One day I'll find pirate treasure too!} # speaker: Nora
    -> DONE
+ [Ask if she saw the hooded kid]
    {calmed("hooded-kid"):
        Hard to believe Milo zoomed all the way from town to the beach and back! Glad everything's chill now! # speaker: Nora
    - else:
        Someone in a purple hood sprinted right past the palm trees leaving fizzy purple footprints that popped in the surf! # speaker: Nora
    }
    -> DONE

=== npc_lark ===
{lanternOn():
    Aha! Carrying a trusty lantern on the cliffside ridge! Textbook backcountry preparedness, Fae! # speaker: Hiker Lark
}
{
- not areaCalm():
    Easy on the gravel, Fae! Fizzy critters have been hopping right across the Cliffside Trail! # speaker: Hiker Lark
- calmed("gull"):
    Listen to that ridge breeze now! Ever since you calmed the lookout gull, the cliffside songbirds came right back! # speaker: Hiker Lark
- else:
    Well hello, fellow trailblazer! Nothing beats birdwatching along the ridge between Bubblegum Bay and Pinecone Pass! # speaker: Hiker Lark
}
{withParty("jordan"):
    Jordan! Still hiking these switchbacks faster than the mountain squirrels? # speaker: Hiker Lark
    Only because I know where all the best lookout snacks are, Lark! # speaker: Jordan
}
{withParty("ribbon-bunny"):
    Oh, a Ribbon Bunny! Look how nimbly she spots tiny clover burrows tucked beneath the cliff boulders! # speaker: Hiker Lark
}
{shared_snack:
    Still grateful for that trail snack you shared, Fae! Best hiking fuel on the ridge! # speaker: Hiker Lark
}
{not gull_reward and calmed("gull"): -> gull_reward}
+ [Ask about wildlife on the trail]
    Bunnies and squirrels dart across the clover bends, and there's a grand ocean view out east by the lookout bench! # speaker: Hiker Lark
    {gem_count() > 0: And with {gem_count()} Star Gems found already, you've got true naturalist eyes! # speaker: Hiker Lark}
    -> DONE
+ [Ask where the trail leads]
    South winds down to warm Bubblegum Bay, and northwest climbs straight into the snowy pines of Pinecone Pass! # speaker: Hiker Lark
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= gull_reward
You calmed the lookout gull and brought peace back to my favorite birdwatching bench! # speaker: Hiker Lark
Please take fifteen shiny coins from my trail-spotter pouch! You earned every single one, Fae! # speaker: Hiker Lark # gift: coins 15 # sound: chime-green
Thanks so much, Hiker Lark! # speaker: Fae
-> DONE
= shared_snack
Here, Hiker Lark! I brought a trail snack to share! # speaker: Fae # feed: snack 1
Well now, that's proper trail fellowship, Fae! Crispy, sweet, and just what a ridge walker needs! # speaker: Hiker Lark
Here are eight shiny trail coins from my field pouch to say thank you! # speaker: Hiker Lark # gift: coins 8 # sound: chime-green
-> DONE

=== npc_mina ===
{lanternOn():
    Oh, how magical! Your blacklight beam turns the fresh snow on Pinecone Pass into sparkling stardust! # speaker: Mina
}
{
- not areaCalm():
    Oh my mittens! A fizzy mountain critter is darting through the drifts nearby! Stay warm and careful, Fae! # speaker: Mina
- lodge_open:
    What a joy seeing smoke curl from Mrs. Flurry's chimney again! The whole snowy pass feels ten degrees warmer! # speaker: Mina
- else:
    Welcome up to Pinecone Pass, dear! Nothing wakes you up like crisp mountain pine air and sweet cocoa! # speaker: Mina
}
{withParty("jordan"):
    Jordan, sweetheart, don't forget to zip up your jacket on the high ridge! # speaker: Mina
    Already zipped, Mina! And Fae's got snacks for the whole crew! # speaker: Jordan
}
+ [Ask about Pinecone Pass sights]
    {scarf_returned:
        The cocoa stand's smiling ear to ear ever since you lassoed that red scarf right off the ski lift! # speaker: Mina
    - else:
        Between the cocoa stand, the ski lift, and the snowy northern archways, this mountain is full of cozy secrets! # speaker: Mina
    }
    {calmed("penguin"): Even the belly-sliding penguin on the north slope is waddling happily now! # speaker: Mina}
    -> DONE
+ [Ask about the purple fizz up here]
    {calmed("hooded-kid"):
        I'm so glad Milo's wish turned out peacefully in the end. Everybody needs good friends to cheer them on! # speaker: Mina
    - else:
        A kid in a purple hood raced past the ski lift earlier, leaving glowing prints in the snow! # speaker: Mina
    }
    -> DONE
+ {npc_sal.gave_mountain_letter and not received_letter} [Deliver Captain Sal's Mountain Letter!]
    -> received_letter
= received_letter
Oh, goodness! A Mountain Reply Letter all the way from Captain Sal down at Bubblegum Bay! # speaker: Mina
Thank you from the bottom of my cocoa mug, Fae! Take twenty coins and two cozy mountain snacks for your pack! # speaker: Mina # gift: coins 20 # gift: snack 2 # sound: chime-red
Do let Mailman Gus know his cross-valley letter arrived safe and sound! # speaker: Mina
I will, Mina! Thank you so much! # speaker: Fae
-> DONE

=== npc_otis ===
{lanternOn():
    Hoho! Bringing a glowing blacklight right beside the hearth? Makes the lodge beams look like a starry night! # speaker: Otis
}
{
- calmed("hooded-kid"):
    The whole mountain feels restful tonight, Fae. Stories travel fast, and everyone thanks you for bringing peace back to Cloverhollow! # speaker: Otis
- else:
    Come on in from the snow, Fae! Pull up a chair by Mrs. Flurry's fireplace and thaw out your boots! # speaker: Otis
}
{withParty("maddie"):
    Look at Maddie eyeing the warm rug! Smart cat knows the coziest square foot in the lodge! # speaker: Otis
}
{withParty("jordan"):
    Still exploring every hidden trail past the lodge, Jordan? # speaker: Otis
    Every single one, Otis, especially with Fae leading the way! # speaker: Jordan
}
{shared_snack:
    That snack you shared tasted better than hearth-roasted marshmallows, Fae! # speaker: Otis
}
+ [Ask for a fireside story]
    Years ago, travelers up at Pinecone Pass heard chimes singing from the northern cliffs, right where Crystal Cavern hides! # speaker: Otis
    {calmed("bat"): And I hear you already ventured inside and calmed the cavern critters! What a tale! # speaker: Otis}
    -> DONE
+ [Warm up by the hearth]
    Nothing beats crackling pine logs and floating marshmallows. At explorer level {level()} with {stickers()} stickers, you've earned a cozy pause! # speaker: Otis
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= shared_snack
Here you go, Otis! Have a cozy snack by the fire! # speaker: Fae # feed: snack 1
Hoho, well isn't that the warmest kindness in Pinecone Pass! Goes down mighty fine beside the hearth! # speaker: Otis
Take eight shiny lodge coins for your explorer pouch, Fae! # speaker: Otis # gift: coins 8 # sound: chime-green
-> DONE

=== npc_pebble ===
{lanternOn():
    AHA! Magnificent! Your blacklight beam makes the cavern's quartz veins fluoresce in vivid violet! # speaker: Professor Pebble
}
{
- not areaCalm():
    Careful with your footing, young explorer! Fizzy vibrations are making the cave critters bounce off the stalagmites! # speaker: Professor Pebble
- cavern_bridge_lit:
    Extraordinary! Illuminating that ancient fairy mural raised crystal stepping stones right across the turquoise stream! # speaker: Professor Pebble
- else:
    Greetings, fellow scholar! Welcome to Crystal Cavern, Cloverhollow's most resonant subterranean marvel! # speaker: Professor Pebble
}
{withParty("pond-pup"):
    Wait, a swimming Pond Pup?! That turquoise spring across the stream might hide sunken treasures just for him! # speaker: Professor Pebble
}
{not bridge_reward and cavern_bridge_lit: -> bridge_reward}
+ [Ask about the cavern's crystals]
    {cavern_chime_rung:
        When you lassoed that high golden star chime, every crystal pillar in the grotto sang in harmony! # speaker: Professor Pebble
    - else:
        Notice the golden star chime hanging high in the northeast arch, and those carved fairy swirls along the northern tablet! # speaker: Professor Pebble
    }
    -> DONE
+ [Talk about Star Gems]
    {gem_count() >= 5:
        Astonishing! {gem_count()} Star Gems catalogued already! You rival the great mineralogists of Cloverhollow! # speaker: Professor Pebble
    - else:
        Legend tells of seven Star Gems scattered across the valley, and one sleeps in a prism pocket right inside this cavern! # speaker: Professor Pebble
    }
    -> DONE
+ {npc_wren.started_sketch and not gave_rubbing} [Ask for a crystal rubbing for Wren]
    -> gave_rubbing
= bridge_reward
Solving the glowing mural and lighting the crystal bridge is a landmark discovery! # speaker: Professor Pebble
Please accept this twenty-coin geology prize from my expedition satchel! # speaker: Professor Pebble # gift: coins 20 # sound: chime-blue
Whoa! Thank you, Professor Pebble! # speaker: Fae
-> DONE
= gave_rubbing
Aha! For young Wren's Cloverhollow Field Compendium! I made a crisp violet charcoal rubbing of our finest singing quartz pillar! # speaker: Professor Pebble # sound: chime-blue
Carry it safely back to Whispering Woods, Fae! # speaker: Professor Pebble
Got it, Professor Pebble! Wren is going to love this! # speaker: Fae
-> DONE

=== npc_moss ===
{lanternOn():
    Good eye, Fae. That blacklight lantern reveals woodland trails invisible to hurried feet! # speaker: Ranger Moss
}
{
- not areaCalm():
    Tread lightly through the ferns, Fae. A fizzy woodland critter is stirring up the clearing! # speaker: Ranger Moss
- calmed("hooded-kid"):
    The Whispering Woods are truly whispering again: gentle wind, soft owls, and not a speck of purple fizz left! # speaker: Ranger Moss
- calmed("moon-owl"):
    I heard Starry Owl's peaceful hoot from the southeast clearing! You have the quietest footsteps in the whole forest, Fae. # speaker: Ranger Moss
- clubhouse_claimed:
    Your team fixed up that old treehouse clubhouse nicely! Every great forest needs caring stewards. # speaker: Ranger Moss
- else:
    Welcome beneath the pines, Fae. Walk softly in the Whispering Woods and the trees will show you their secrets. # speaker: Ranger Moss
}
{withParty("acorn-squirrel"):
    Ah, an Acorn Squirrel riding along! Nobody knows the high oak hollows better than that nimble climber. # speaker: Ranger Moss
}
{withParty("jordan"):
    Good to see you back under the big oaks, Jordan! # speaker: Ranger Moss
    Wouldn't miss it, Ranger Moss! Fae spotted the secret trail herself! # speaker: Jordan
}
+ [Ask about the Whispering Woods]
    The big west oak hides a rattling knothole high in its bark, and the southern path opens out onto sunny Clover Hills. # speaker: Ranger Moss
    -> DONE
+ [Ask about the woodland critters]
    {calmed("owl"):
        The sleepy owls are gliding quietly overhead again. Gentle songs always carry farthest under the canopy. # speaker: Ranger Moss
    - else:
        Owls and raccoons roam this clearing. Step kindly, watch their moods, and your song will settle them right down! # speaker: Ranger Moss
    }
    -> DONE

=== npc_sunny ===
{lanternOn():
    Whoa! A glowing firefly lantern in the middle of Clover Hills! Even the clover leaves sparkle! # speaker: Sunny
}
{
- not areaCalm():
    Whoa, watch out! Fluffy fizz-critters are bouncing like popcorn down the hillside! # speaker: Sunny
- calmed("taco-chef"):
    Chef Mateo's salsa is back to normal, and the whole hillside smells like warm crispy tacos! Best day ever! # speaker: Sunny
- calmed("lamb"):
    All the clover lambs are grazing happily again! Thank you for calming them down, Fae! # speaker: Sunny
- else:
    Hi, Fae! Welcome up to Clover Hills: best breeze, softest grass, and fluffiest sheep in the whole valley! # speaker: Sunny
}
{withParty("ribbon-bunny"):
    Aww, Ribbon Bunny! Look how excited she gets near the clover-fringed burrows by the meadow boulders! # speaker: Sunny
}
{withParty("sue"):
    You can almost see Bubblegum Bay sparkling from up on this ridge, Sunny! # speaker: Sue
}
{treats() > 0: Ooh, you brought specialty treats up the hills! The lambs and hedgehogs LOVE snack time! # speaker: Sunny}
+ [Ask about Clover Hills trails]
    West drops right back into Meadow Park, and north winds up into the shady pines of Whispering Woods! # speaker: Sunny
    {gem_count() > 0: With {gem_count()} Star Gems in your pocket, check every cozy burrow between the boulders! # speaker: Sunny}
    -> DONE
+ [Ask about the valley view]
    From up here you can watch the whole valley breathe. {calmed("hooded-kid"): Even the Enchanted Forest glow looks extra warm today!|Whenever things get fizzy, a sunny hillside breeze helps!} # speaker: Sunny
    -> DONE
+ {npc_wren.started_sketch and not gave_clover} [Ask for a pressed clover for Wren]
    -> gave_clover
= gave_clover
Ooh, for Wren's nature sketchbook?! Here's my luckiest four-leaf clover, pressed crisp between two buttercup petals! # speaker: Sunny # sound: chime-green
Tell Wren the clover lambs say hi! # speaker: Sunny
Will do, Sunny! Thanks a bunch! # speaker: Fae
-> DONE

=== npc_gus ===
{lanternOn():
    Ho-ho! Shining that violet lantern right over my mail satchel? I could read tiny postcard stamps in the shade with that! # speaker: Mailman Gus
}
{
- calmed("hooded-kid"):
    Letters are pouring in from every corner of Cloverhollow, Fae! Ever since you helped Milo feel welcome again, everyone's writing thank-you cards! # speaker: Mailman Gus
- not areaCalm():
    Whoa there, Fae! Hold onto your hat, there's a fizzy critter zipping across my cobblestones! # speaker: Mailman Gus
- bossesCalmed() >= 3:
    Three-star special delivery news, Fae! Folks from the bay to the mountain pass are writing letters about your {bossesCalmed()} big calm-downs! # speaker: Mailman Gus
- calmed("fountain-frog"):
    Nothing beats a dry plaza walk for the mail route! Thank you for soothing that fizzy frog, Fae. # speaker: Mailman Gus
- else:
    Special delivery, Fae! Pink fountain bubbles nearly stamped my whole stack of Cloverhollow postcards! # speaker: Mailman Gus
}
{withParty("sue"):
    Did my new fishing tackle catalog arrive yet, Gus? # speaker: Sue
    Top of the satchel, Sue, dry as a whistle! # speaker: Mailman Gus
}
{withParty("jordan"):
    Any trail maps from Pinecone Pass in today's pouch, Gus? # speaker: Jordan
    Fresh bundle tied with blue twine, Jordan! # speaker: Mailman Gus
}
{treats() > 0: Smells like specialty critter treats in your backpack! Better aroma than parcel post! # speaker: Mailman Gus}
{mail_complete: Good seeing my favorite Honorary Junior Mail Carrier out on the plaza, Fae! # speaker: Mailman Gus}
{not mail_bonus and bossesCalmed() >= 2: -> mail_bonus}
+ [Ask about Cloverhollow's mail route]
    I walk from Bon Appetit Cafe past Flora's tulips, out to Bubblegum Bay, and clear up to Pinecone Lodge! # speaker: Mailman Gus
    {stickers() >= 4: With {stickers()} stickers in your album, half the valley already knows your name! # speaker: Mailman Gus}
    -> DONE
+ [Ask if any curious letters came in]
    {calmed("hooded-kid"):
        Mostly postcards inviting Milo and your friends to picnics! Best bundle I've carried all year! # speaker: Mailman Gus
    - else:
        One unaddressed envelope smelled strongly of purple fizz, and a kid in a purple hood dashed right past my mailbox! # speaker: Mailman Gus
    }
    -> DONE
+ {areaCalm() and not gave_postcard} [Offer to help deliver mail to the bay]
    -> gave_postcard
+ {npc_mina.received_letter and not mail_complete} [Tell Gus the mountain mail arrived!]
    -> mail_complete
= mail_bonus
Hold everything, Fae! The Cloverhollow Neighbors Club pooled a thank-you parcel for calming {bossesCalmed()} big valley troubles! # speaker: Mailman Gus
Ten crisp coins and a crunchy mail-route snack, signed and sealed just for you! # speaker: Mailman Gus # gift: coins 10 # gift: snack 1 # sound: chime-yellow
Whoa, special delivery! Thank you, Mailman Gus! # speaker: Fae
-> DONE
= gave_postcard
Why, bless your swift boots, Fae! Captain Sal down at Bubblegum Bay has been waiting on this Seashell Postcard all week! # speaker: Mailman Gus # sound: chime-blue
Tuck it safe in your journal pocket and hand it right to him down by the pier! # speaker: Mailman Gus
Count on me, Mailman Gus! # speaker: Fae
-> DONE
= mail_complete
Mina got Captain Sal's Mountain Reply Letter safe and sound?! Hold everything, that's cross-valley express service! # speaker: Mailman Gus
By the power of my brass mail whistle, I hereby name you Honorary Junior Mail Carrier of Cloverhollow! # speaker: Mailman Gus # gift: coins 15 # sound: chime-yellow
Whoa, Honorary Junior Mail Carrier! Thanks, Mailman Gus! # speaker: Fae
-> DONE

=== npc_hazel ===
{lanternOn():
    Oh, my stars! What a warm violet lantern glow, dear. It makes the meadow clover look dusted in fairy sugar! # speaker: Grandma Hazel
}
{
- calmed("hooded-kid"):
    Look how peaceful Meadow Park feels now, sweet Fae. Hearing that Milo made such kind friends warms this old heart right through. # speaker: Grandma Hazel
- not areaCalm():
    Oh dearie, step lightly! The meadow critters have caught a dreadful case of the purple zoomies! # speaker: Grandma Hazel
- bossesCalmed() >= 5:
    My goodness, {bossesCalmed()} major calm-downs across the valley! Cloverhollow has never seen a kinder explorer, Fae. # speaker: Grandma Hazel
- club_open:
    You opened the old park tree house! Why, kids have been whispering silly passwords to those branches since I was your age! # speaker: Grandma Hazel
- else:
    Hello there, sweet Fae! Nothing lifts the spirits like watching the meadow clover sway from this park bench. # speaker: Grandma Hazel
}
{withParty("maddie"):
    Why, hello Maddie! Your orange fur looks softer than my best knitted blanket! # speaker: Grandma Hazel
}
{withParty("sue"):
    Grandma Hazel always knows where the best picnic spots are, Fae! # speaker: Sue
}
{shared_snack:
    Thank you again for sharing that sweet snack earlier, dearie! Made my whole park sit extra cozy! # speaker: Grandma Hazel
}
{not basket_treat and (stickers() >= 2 or areaCalm()): -> basket_treat}
+ [Ask about Meadow Park's history]
    Long before the boardwalks were painted, neighbors planted these clover rings so anyone feeling lonely would find a friendly bench. # speaker: Grandma Hazel
    {gem_count() > 0: And look at you, already finding {gem_count()} of the valley's hidden Star Gems! # speaker: Grandma Hazel}
    -> DONE
+ [Share a quiet park moment]
    {has_flute:
        If you ever play a gentle tune on that painted flute, the whole meadow seems to lean in and listen! # speaker: Grandma Hazel
    - else:
        A deep breath and a kind song can untangle almost any knot, Fae. Take good care of your friends! # speaker: Grandma Hazel
    }
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= basket_treat
Wait a tick, dear! I baked extra honey-oat snacks for Pippa and any explorer passing through Meadow Park. # speaker: Grandma Hazel
Pop two right into your backpack before your next adventure! # speaker: Grandma Hazel # gift: snack 2 # sound: chime-green
Thank you so much, Grandma Hazel! # speaker: Fae
-> DONE
= shared_snack
Here, Grandma Hazel! Let's share a cozy snack on the bench! # speaker: Fae # feed: snack 1
Oh, bless your sweet heart, Fae! Nothing tastes finer than a snack shared with a kind neighbor! # speaker: Grandma Hazel
Take eight shiny coins from my knitting purse for your travels, sweetheart! # speaker: Grandma Hazel # gift: coins 8 # sound: chime-green
-> DONE

=== npc_bram ===
{lanternOn():
    Whoa! Stage-light violet right here on the hillside! Now that's the spotlight for a clover meadow encore! # speaker: Bram
}
{
- calmed("hooded-kid"):
    I'm writing a brand-new ballad about how you helped Milo find his groove again, Fae! Every lamb up here hums the chorus! # speaker: Bram
- not areaCalm():
    Easy on the strings! A fizzy critter is bouncing off-beat right through the clover! # speaker: Bram
- calmed("taco-chef"):
    Chef Mateo's grill is sizzling calm again, and the whole ridge smells like crispy tacos and sweet acoustic chords! # speaker: Bram
- bossesCalmed() >= 4:
    Four verses and counting! With {bossesCalmed()} big calm-downs under your belt, you're a valley folk hero, Fae! # speaker: Bram
- else:
    Hey there, Fae! Pull up a patch of clover and listen to the hills sing with my ukulele! # speaker: Bram
}
{withParty("sue"):
    Can we hear the Bubblegum Bay shanty next, Bram? # speaker: Sue
    Coming right up, Sue, with extra bounce! # speaker: Bram
}
{withParty("jordan"):
    Those chords carry clear down toward the Whispering Woods trail, Bram! # speaker: Jordan
}
{not melody_coins and (has_flute or calmed("lamb")): -> melody_coins}
+ [Talk about music in the hills]
    {has_flute:
        Play a note on your flute whenever you pass by! Ukulele and flute make the coziest meadow duet! # speaker: Bram
    - else:
        The lambs up on Clover Hills love echo melodies. Listen close to the notes and they'll bounce right along with you! # speaker: Bram
    }
    -> DONE
+ [Ask about the ridge trails]
    Sunny watches the eastern flock while I keep an eye on the clover meadows. {treats() > 0: And with {treats()} specialty treats in your pack, every critter up here will be your biggest fan!|Pack a snack or two if you head north into the woods!} # speaker: Bram
    -> DONE
= melody_coins
Hey, fellow musician! Anyone spreading calm tunes across Clover Hills deserves a busker's share from my hat! # speaker: Bram
Here's twelve shiny coins for your travels, Fae! Keep playing from the heart! # speaker: Bram # gift: coins 12 # sound: chime-blue
Awesome! Thanks, Bram! # speaker: Fae
-> DONE

=== npc_wren ===
{lanternOn():
    Ooh! Hold your lantern right there! Violet light makes the mossy bark patterns jump straight off the page! # speaker: Wren
}
{
- calmed("hooded-kid"):
    I drew a whole double-page spread of the calm Enchanted Forest, Fae! Even Milo signed the corner of my sketchbook! # speaker: Wren
- not areaCalm():
    Eep! Careful, Fae! Fizzy woodland critters keep jiggling the ferns while I try to ink my sketches! # speaker: Wren
- calmed("moon-owl"):
    I finally sketched Starry Owl perching peacefully in the high pines! Best drawing in my whole notebook! # speaker: Wren
- clubhouse_claimed:
    Your woodland clubhouse looks like something straight out of a storybook! I drew the porch roof three times already! # speaker: Wren
- else:
    Hi, Fae! Shh, look closely at these spotted red-cap mushrooms. I'm sketching every woodland secret I can spot! # speaker: Wren
}
{withParty("jordan"):
    Wren's sketches are almost as accurate as Ranger Moss's trail maps, Fae! # speaker: Jordan
}
{withParty("acorn-squirrel"):
    NO WAY! Your Acorn Squirrel actually sat still long enough for a portrait! # speaker: Wren
}
{sketch_complete:
    My completed Cloverhollow Field Compendium is my prized possession, Fae! Thanks for helping finish every chapter! # speaker: Wren
}
{not sketch_reward and (stickers() >= 5 or gem_count() >= 3): -> sketch_reward}
+ [Peek at Wren's woodland sketchbook]
    Let's see... mossy roots, spotted mushrooms, Ranger Moss's hat, and a dotted trail pointing south to Clover Hills! # speaker: Wren
    {bossesCalmed() >= 2: Plus I added {bossesCalmed()} gold stars for every big valley calm-down you've pulled off! # speaker: Wren}
    -> DONE
+ [Ask about hidden things in the woods]
    {calmed("hooded-kid"):
        Just cozy owls, fluttering leaves, and friendly critters from oak to creek! # speaker: Wren
    - else:
        Earlier I saw a kid in a purple hood hurry past the mossy stones muttering about some glowing pond deeper in the forest! # speaker: Wren
    }
    -> DONE
+ {not started_sketch} [Offer to help collect valley sketches]
    -> started_sketch
+ {npc_pebble.gave_rubbing and npc_sunny.gave_clover and not sketch_complete} [Share the crystal rubbing and clover!]
    -> sketch_complete
= sketch_reward
Wait, Fae! With {stickers()} critter stickers and {gem_count()} Star Gems, you're a real-life field naturalist! # speaker: Wren
Take eight coins and a trail snack from my sketching pack! # speaker: Wren # gift: coins 8 # gift: snack 1 # sound: chime-green
Thanks, Wren! Your drawings are awesome! # speaker: Fae
-> DONE
= started_sketch
Really?! You'd help me finish my Cloverhollow Field Compendium? # speaker: Wren
I still need a crystal rubbing from Professor Pebble in Crystal Cavern and a pressed clover from Sunny up on Clover Hills! # speaker: Wren
Leave it to me, Wren! I'll bring both right back! # speaker: Fae
-> DONE
= sketch_complete
NO WAY! A sparkling quartz rubbing from Professor Pebble AND a four-leaf pressed clover from Sunny?! # speaker: Wren
My Cloverhollow Field Compendium is finally complete! Maya and Theo in the Art Room are going to flip when they hear! # speaker: Wren
Take eighteen coins and two sketchbook snacks as my co-author prize, Fae! # speaker: Wren # gift: coins 18 # gift: snack 2 # sound: chime-yellow
We make a great team, Wren! # speaker: Fae
-> DONE

=== npc_tuck ===
{lanternOn():
    WHOA! Your purple lantern makes my snowdrift glitter like a giant grape popsicle! # speaker: Tuck
}
{
- calmed("hooded-kid"):
    The snow up here feels extra fluffy now that the purple fizz is gone! Wait till Milo sees our next snow fort! # speaker: Tuck
- not areaCalm():
    Whoa, duck! Fizzy critters are bowling straight toward my giant snowman! # speaker: Tuck
- lodge_open:
    Mrs. Flurry opened Pinecone Lodge back up! Mina promised hot cocoa with extra marshmallows once my snowman's done! # speaker: Tuck
- else:
    Heya, Fae! Welcome to Pinecone Pass! I'm rolling the absolute biggest, roundest snowman in Cloverhollow history! # speaker: Tuck
}
{withParty("jordan"):
    That bottom snowball is already taller than your snowshoes, Tuck! # speaker: Jordan
    Just wait till I stack the scarf and pinecone buttons, Jordan! # speaker: Tuck
}
{withParty("sue"):
    Bet a snowman out here could hold a fishing rod too! # speaker: Sue
}
{shared_snack:
    That snack you shared gave me turbo snowman-rolling power, Fae! # speaker: Tuck
}
{not snow_snack and (lodge_open or bossesCalmed() >= 2): -> snow_snack}
+ [Help inspect Tuck's giant snowman]
    Three stacked snowballs, two pine-twig arms, and a bright knit cap! {treats() > 0: And hey, carrying {treats()} warm treats up the pass is super smart!|Just don't tell the penguins, they try to slide off its nose!} # speaker: Tuck
    -> DONE
+ [Ask what's up the mountain trail]
    North leads past the warm lodge toward the sparkling Crystal Cavern, and the Star Bus stops right down the bend! # speaker: Tuck
    {stickers() >= 4: With {stickers()} stickers already, you're practically a mountain-pass legend, Fae! # speaker: Tuck}
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= snow_snack
Hey, thanks for keeping Pinecone Pass safe for snowman-building, Fae! # speaker: Tuck
I dug up seven lucky coins from the snowbank plus a cozy lodge snack for you! # speaker: Tuck # gift: coins 7 # gift: snack 1 # sound: chime-yellow
Whoa, awesome! Thanks, Tuck! # speaker: Fae
-> DONE
= shared_snack
Here, Tuck! Have a warm snack for your snowman-building break! # speaker: Fae # feed: snack 1
WHOA, snacks in the snow?! You are officially the coolest mountain buddy ever, Fae! # speaker: Tuck
Take eight shiny snow-fort coins I found by the pine bench! # speaker: Tuck # gift: coins 8 # sound: chime-green
-> DONE

=== npc_kai ===
{lanternOn():
    Whoa! A pocket lighthouse! You could signal every sailboat in Bubblegum Bay with that glow! # speaker: Kai
}
{
- calmed("hooded-kid"):
    Even the harbor ripples look calm and shiny now! Captain Sal says we should invite Milo down to launch paper boats too! # speaker: Kai
- not areaCalm():
    Watch your step on the sand, Fae! A fizzy critter is kicking up pink sea-foam near my paper boats! # speaker: Kai
- calmed("lifeguard"):
    Ms. Coral is back on beach watch and the whole bay is cheering! Best harbor day ever! # speaker: Kai
- treasure_found:
    HOLD EVERYTHING! You actually found the sunken pirate treasure on Bubblegum Bay?! Tell me everything! # speaker: Kai
- else:
    Ahoy, Fae! Captain Sal taught me how to fold seaworthy paper sailboats for the harbor tide! # speaker: Kai
}
{withParty("sue"):
    Sue! Captain Sal said you hooked the biggest shiny fish off the pier! # speaker: Kai
    Anytime you want a casting lesson, Kai, grab a pole! # speaker: Sue
}
{withParty("pond-pup"):
    AWW! Pond Pup wants to chase my paper sailboat right along the shallows! # speaker: Kai
}
{not harbor_find and (calmed("lifeguard") or treasure_found or bossesCalmed() >= 1): -> harbor_find}
+ [Ask about his paper sailboats]
    Fold the prow sharp, tuck the sail high, and launch right where the gentle waves curl! # speaker: Kai
    {gem_count() > 0: And with {gem_count()} Star Gems gleaming in your pack, you've got better treasure eyes than any pirate! # speaker: Kai}
    -> DONE
+ [Ask about Bubblegum Bay]
    Captain Sal watches the boats, Nora hunts pink spiral shells, and the Cliffside Trail climbs up east if you want an ocean view! # speaker: Kai
    -> DONE
= harbor_find
Ahoy, Fae! Thanks for making Bubblegum Bay smooth sailing for everyone! # speaker: Kai
I found nine shiny sand-dollars, I mean coins, tucked near the pier pilings, all yours! # speaker: Kai # gift: coins 9 # sound: chime-blue
Score! Thanks a bunch, Kai! # speaker: Fae
-> DONE

=== npc_sage ===
{lanternOn():
    Ah! Your violet lantern wakes every sleeping bluebell along the Misty Path! Even the ancient stones remember that glow. # speaker: Star-Watcher Sage
}
{
- calmed("hooded-kid"):
    Look how clear the silver mist hangs now, Fae. Ever since you helped Milo feel heard, the Enchanted Forest hums like a harp. # speaker: Star-Watcher Sage
- seal_open:
    You played the melody that opened the ancient stone seal! Beyond that archway waits the heart of the Enchanted Forest. # speaker: Star-Watcher Sage
- rope_bridge:
    The old rope bridge holds firm across the gully, Fae. Only the singing stone seal stands ahead now! # speaker: Star-Watcher Sage
- found_mist_way:
    You followed the lantern-lit bluebells right across the mist-band! Trusting your light always reveals the true path. # speaker: Star-Watcher Sage
- not areaCalm():
    Tread gently through the silver haze, young traveler. Fizzy currents ripple nearby! # speaker: Star-Watcher Sage
- else:
    Welcome to the Misty Path, Fae. Listen closely, and the bluebells will whisper where safe footing hides. # speaker: Star-Watcher Sage
}
{withParty("sue"):
    This mist reminds me of the sea fog rolling off Bubblegum Bay, Sage! # speaker: Sue
    Both hide wonders for patient eyes, Sue. # speaker: Star-Watcher Sage
}
{withParty("jordan"):
    Good thing we brought our lantern, lasso, and flute for this trail! # speaker: Jordan
    Well prepared, Jordan. Every tool you earned along the way has a part to play here. # speaker: Star-Watcher Sage
}
{not star_gift and (seal_open or bossesCalmed() >= 4): -> star_gift}
+ [Ask how to cross the Misty Path]
    Three gentle trials guard the enchanted gate: shine a violet lantern to find the bluebell stones, lasso the gully posts to swing the bridge, and play the chime melody at the seal! # speaker: Star-Watcher Sage
    {stickers() >= 6: With {stickers()} calm-down stickers in your journal, the forest already knows your kindness! # speaker: Star-Watcher Sage}
    -> DONE
+ [Ask about the Enchanted Forest ahead]
    {calmed("hooded-kid"):
        The fairies dance under a peaceful canopy, and Milo's laughter drifts back along the breeze. Well done, Fae. # speaker: Star-Watcher Sage
    - else:
        A lonely wish stirred the Mystic Pond deeper inside, sending fizzy ripples across Cloverhollow. A steady heart will settle it. # speaker: Star-Watcher Sage
    }
    -> DONE
= star_gift
For walking the valley with such patience and calming {bossesCalmed()} major troubles, please accept this starlight token! # speaker: Star-Watcher Sage
Twelve shiny coins and a trail snack to keep your step light, Fae! # speaker: Star-Watcher Sage # gift: coins 12 # gift: snack 1 # sound: chime-blue
Thank you so much, Star-Watcher Sage! # speaker: Fae
-> DONE

=== npc_poppy ===
{lanternOn():
    WHOA! Your purple lantern makes every arcade cabinet glow like a secret bonus stage! # speaker: Poppy
}
{
- calmed("hooded-kid"):
    Sammy and I are saving a whole row of Skee-Ball lanes for you and Milo! Best hangout in Cloverhollow! # speaker: Poppy
- not areaCalm():
    Whoa, watch the cabinets! Fizzy sparks are bouncing near the prize counter! # speaker: Poppy
- won("star-racer-keychain"):
    HOLD ON! You actually won the Star Racer Keychain?! Let me see it shine under the arcade lights! # speaker: Poppy
- bossesCalmed() >= 3:
    Three-plus big calm-downs AND arcade champion?! You've got {bossesCalmed()} hero stars already, Fae! # speaker: Poppy
- else:
    Heya, Fae! Thanks for calming Mr. Pip down so Sammy and I could get back to our favorite machines! # speaker: Poppy
}
{withParty("sue"):
    Ready for a friendly Boop-a-Mole rematch, Poppy? # speaker: Sue
    You're on, Sue! My mallet reflexes are warmed up! # speaker: Poppy
}
{withParty("jordan"):
    I'm still trying to figure out the claw machine physics, Poppy. # speaker: Jordan
    Pick plushes from the top of the heap first, Jordan! # speaker: Poppy
}
{not token_tip and (tickets() >= 5 or stickers() >= 4): -> token_tip}
+ [Ask for her secret arcade trick]
    In the claw machine, grab the top plushies before digging for the bottom ones! And in Comet Cruise, nudge early around wobbling rocks! # speaker: Poppy
    {stickers() >= 5: With {stickers()} critter stickers, your rhythm checks must be unstoppable! # speaker: Poppy}
    -> DONE
+ [Check her ticket tally]
    I'm only three tickets away from trading at Mr. Pip's counter! {tickets() > 0: Looks like you've got {tickets()} tickets saved up too!|Try a round of Skee-Ball and watch those tickets pour out!} # speaker: Poppy
    -> DONE
= token_tip
Hey, arcade pros always share spare coins! Take ten shiny tokens from my lucky coin cup, Fae! # speaker: Poppy # gift: coins 10 # sound: chime-yellow
Sweet! Thanks a million, Poppy! # speaker: Fae
-> DONE

=== npc_clara ===
{lanternOn():
    Oh, my! That soft violet lantern makes my knitted stripes shimmer like mountain auroras! # speaker: Clara
}
{
- calmed("hooded-kid"):
    The whole lodge feels like a warm hug now that Milo and all the valley critters are resting easy, Fae! # speaker: Clara
- not areaCalm():
    Oh dear, stay close to the hearth! Something fizzy is rustling outside the lodge porch! # speaker: Clara
- bossesCalmed() >= 4:
    Word travels fast up Pinecone Pass! With {bossesCalmed()} major calm-downs behind you, everyone here raises a cocoa mug to you! # speaker: Clara
- else:
    Welcome inside Pinecone Lodge, dear! Pull up a stool near Otis and let the crackling fireplace warm your mittens! # speaker: Clara
}
{withParty("sue"):
    Your knitted scarves are way warmer than my harbor raincoat, Clara! # speaker: Sue
    I'll knit you a sea-blue striped one next, Sue! # speaker: Clara
}
{withParty("jordan"):
    Clara makes the best pine-berry tea on the whole mountain, Fae! # speaker: Jordan
    Always a hot kettle waiting whenever you drop by, Jordan! # speaker: Clara
}
{shared_snack:
    Thank you again for sharing that delicious snack by the fire, Fae! Best tea companion in the pass! # speaker: Clara
}
+ [Ask about her knitting]
    I'm knitting cozy striped scarves for Mrs. Flurry, Otis, and every snowy explorer who braves Pinecone Pass! # speaker: Clara
    {stickers() >= 5: And with {stickers()} calm-down stickers in your book, you've brought warmth to half the valley! # speaker: Clara}
    -> DONE
+ [Ask about Pinecone Lodge]
    Otis tells fireside tales while Mrs. Flurry keeps the cocoa kettle singing. Even the little lodge hamster loves the cozy quiet! # speaker: Clara
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= shared_snack
Here, Clara! Would you like to share a cozy snack by the hearth? # speaker: Fae # feed: snack 1
Oh, how thoughtful, Fae! A crunchy snack pairs wonderfully with hot lodge tea! # speaker: Clara
Please tuck these eight shiny coins into your explorer pouch with my warmest thanks! # speaker: Clara # gift: coins 8 # sound: chime-green
-> DONE

=== npc_bramble ===
{lanternOn():
    Whoa, trail lantern! That violet glow picks out rare silver moss right along the cliff rocks! # speaker: Bramble
}
{
- calmed("hooded-kid"):
    Every bend from Bubblegum Bay up to Pinecone Pass is humming peaceful again! Tell Milo he's welcome on our ridge hikes anytime! # speaker: Bramble
- not areaCalm():
    Watch your boots on the gravel, Fae! A fizzy critter is zipping right around the cliff switchbacks! # speaker: Bramble
- calmed("gull"):
    Hooray! With that lookout gull settled down, Hiker Lark and I can hear the canyon songbirds clear down to the surf! # speaker: Bramble
- else:
    Howdy, trailblazer! Welcome to Cliffside Trail! I keep the signposts tidy and pack extra trail maps for hikers! # speaker: Bramble
}
{withParty("sue"):
    You can spot every fishing boat in Bubblegum Bay from up here, Bramble! # speaker: Sue
    Sure can, Sue! Best coastal overlook in Cloverhollow! # speaker: Bramble
}
{withParty("jordan"):
    Bramble showed me the quickest clover shortcut up to Pinecone Pass! # speaker: Jordan
    And Jordan still beats my ridge time by two minutes flat! # speaker: Bramble
}
{not ridge_gift and (calmed("gull") or bossesCalmed() >= 2): -> ridge_gift}
+ [Ask about the Cliffside Trail]
    Hiker Lark tracks the songbirds down near the signpost while I check the upper switchback toward Pinecone Pass. # speaker: Bramble
    {stickers() >= 4: With {stickers()} critter stickers already, you're a natural trail ranger, Fae! # speaker: Bramble}
    -> DONE
+ [Ask if he spotted anything unusual]
    {calmed("hooded-kid"):
        Just cheerful bunnies, calm squirrels, and neighbors waving across the ridge! # speaker: Bramble
    - else:
        Earlier a kid in a purple hood sprinted uphill faster than a startled jackrabbit, trailing fizzy purple sparkles! # speaker: Bramble
    }
    -> DONE
= ridge_gift
Any explorer who helps keep the valley trails calm deserves a ridge-walker's bonus! # speaker: Bramble
Take ten shiny coins and a crunchy trail snack from my pack, Fae! # speaker: Bramble # gift: coins 10 # gift: snack 1 # sound: chime-green
Awesome, thanks Bramble! # speaker: Fae
-> DONE

=== npc_gemma ===
{lanternOn():
    OH! Shine your lantern right over this wall! Every tiny quartz vein lights up like purple starlight! # speaker: Gemma
}
{
- calmed("hooded-kid"):
    The cavern crystals chime so sweetly now! Professor Pebble says we should show Milo the glowing prism arch sometime! # speaker: Gemma
- not areaCalm():
    Careful near the stream, Fae! Fizzy bats and crystal moles are echoing extra loud in here! # speaker: Gemma
- cavern_bridge_lit:
    WHOA! You lit the fairy mural and raised the crystal stepping stones! Best geological miracle ever! # speaker: Gemma
- else:
    Hi, Fae! I'm helping Professor Pebble map every humming quartz cluster inside Crystal Cavern! # speaker: Gemma
}
{withParty("sue"):
    That underground spring is almost as turquoise as Bubblegum Bay, Gemma! # speaker: Sue
    And it sparkles twice as bright under Fae's lantern, Sue! # speaker: Gemma
}
{withParty("jordan"):
    Wait till you hear the golden star chime ring across the grotto, Gemma! # speaker: Jordan
    I've got my notebook open and ready to sketch the soundwaves, Jordan! # speaker: Gemma
}
{not crystal_gift and (cavern_chime_rung or cavern_bridge_lit or gem_count() >= 2): -> crystal_gift}
+ [Ask about the cavern crystals]
    Purple quartz hums low, teal crystals ring bright, and golden clusters chime right along with a flute! # speaker: Gemma
    {bossesCalmed() >= 2: With {bossesCalmed()} major calm-downs logged, even the crystal moles trust your footsteps! # speaker: Gemma}
    -> DONE
+ [Compare Star Gem notes]
    {gem_count() > 0:
        You've already discovered {gem_count()} Star Gems?! Plus {stickers()} critter stickers? You're a legend in Professor Pebble's logbook! # speaker: Gemma
    - else:
        Professor Pebble says seven Star Gems hide across Cloverhollow, and one glints right inside this cavern's far eastern pocket! # speaker: Gemma
    }
    -> DONE
= crystal_gift
Whoa, you're a real-life cavern explorer! Here are twelve shiny coins from my geology jar! # speaker: Gemma # gift: coins 12 # sound: chime-blue
Whoa, thanks Gemma! # speaker: Fae
-> DONE

=== npc_bert ===
{lanternOn():
    Well I'll be! That purple lantern spots stray glitter and invisible chalk marks faster than my best dustpan! # speaker: Custodian Bert
}
{
- calmed("hooded-kid"):
    Not a single smudge of purple fizz left on the linoleum! And Milo even offered to help me stack chairs after school! # speaker: Custodian Bert
- not areaCalm():
    Hold onto your backpack, Fae! Fizzy paint splashes are bouncing right down East Hall! # speaker: Custodian Bert
- art_open:
    Ms. Rowan's Art Room is spotless and back open! Maya and Theo already have the clay table humming! # speaker: Custodian Bert
- recess:
    Nice and quiet in East Hall while Leo and the class run around outside for recess! # speaker: Custodian Bert
- else:
    Howdy, Fae! Custodian Bert here, keeping Cloverhollow School's hallways shiny enough to see your smile in! # speaker: Custodian Bert
}
{withParty("sue"):
    Your hallway floor shines brighter than a polished boat deck, Bert! # speaker: Sue
    Haha, high praise from a Bubblegum Bay sailor, Sue! # speaker: Custodian Bert
}
{withParty("jordan"):
    Sorry if we tracked any pinecone dust in from the pass, Custodian Bert! # speaker: Jordan
    No worries at all, Jordan! Adventures leave a few footprints, that's what brooms are for! # speaker: Custodian Bert
}
{not hall_gift and (art_open or bossesCalmed() >= 2): -> hall_gift}
+ [Ask about East Hall]
    Gym doors on the west, Ms. Willow's Music Room in the middle, and Ms. Rowan's Art Room down east! # speaker: Custodian Bert
    {stickers() >= 4: With {stickers()} critter stickers already, you've calmed more critters than I've swept chalk erasers! # speaker: Custodian Bert}
    -> DONE
+ [Ask if he saw anyone rush past]
    {calmed("hooded-kid"):
        Just cheerful students heading to art and music! Best sound in the whole building! # speaker: Custodian Bert
    - else:
        Somebody in a purple hood zoomed past my broom cart leaving fizzy purple sneaker prints that popped like soda bubbles! # speaker: Custodian Bert
    }
    -> DONE
= hall_gift
Thanks for helping keep our school calm and bright, Fae! Take nine shiny coins I found beneath the lost-and-found bench! # speaker: Custodian Bert # gift: coins 9 # sound: chime-yellow
Aw, thank you, Custodian Bert! # speaker: Fae
-> DONE

=== npc_theo ===
{lanternOn():
    WHOA! Your purple lantern makes my ceramic glaze samples glow neon right on the work table! # speaker: Theo
}
{
- calmed("hooded-kid"):
    Milo asked if I'd teach him how to sculpt a tiny clay frog next art class! Having everyone back together is the best! # speaker: Theo
- not areaCalm():
    Eep! Hold the clay table steady! Fizzy shakes might topple my tiny turtle! # speaker: Theo
- else:
    Hi, Fae! Thanks for helping Ms. Rowan calm down so Maya and I could get back to our clay and easels! # speaker: Theo
}
{withParty("sue"):
    Could you sculpt a tiny clay bluebird or harbor crab next, Theo? # speaker: Sue
    Ooh, a clay harbor crab with tiny pinchers! Adding it to my list, Sue! # speaker: Theo
}
{withParty("jordan"):
    Those miniature pine-tree stamps on your pottery look awesome, Theo! # speaker: Jordan
    Thanks, Jordan! I pressed real Pinecone Pass needles into the soft clay! # speaker: Theo
}
{npc_wren.sketch_complete:
    Maya told me you helped Wren finish the Field Compendium! I'm already sculpting a tiny crystal quartz and four-leaf clover bowl to celebrate! # speaker: Theo
}
{not studio_gift and (stickers() >= 3 or bossesCalmed() >= 2): -> studio_gift}
+ [Look at Theo's clay sculptures]
    I'm making a miniature set of every calm critter in Cloverhollow! {stickers() >= 6: With {stickers()} stickers in your album, you've given me a whole gallery to sculpt!|Show me every new critter you befriend!} # speaker: Theo
    -> DONE
+ [Ask about working with Maya]
    Maya paints the bright watercolor backdrops and I sculpt the tiny clay critters to stand in front! Teamwork makes the coolest art shows! # speaker: Theo
    -> DONE
= studio_gift
You inspired a whole shelf of calm-critter sculptures, Fae! Take ten shiny studio coins and a crunchy art-room snack! # speaker: Theo # gift: coins 10 # gift: snack 1 # sound: chime-green
Whoa, thank you, Theo! # speaker: Fae
-> DONE
