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
{sanctuary_reward_14: Ranger Fern wove me a Sanctuary Clover Wreath for welcoming so many calm critters to the Wildlife Sanctuary! # speaker: Fae}
{sanctuary_visited and not sanctuary_reward_14: I found the Wildlife Sanctuary east of Clover Hills! Ranger Fern looks after every calm animal who visits the meadow. # speaker: Fae}
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
Thanks for helping, Fae! # speaker: Nurse Holly
-> DONE

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
Fae and Jordan fill a whole basket, and tuck it into the fridge. # speaker: Fae
~ fridge_baskets += 1
~ garden_ripe = false
~ garden_calms = 1
The plants are still growing. Two more calm critters, and there'll be more! # speaker: Jordan
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
Welcome back, Fae! My Star Cinnamon buns are rising golden and tall thanks to you! # speaker: Chef Bea
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
-> DONE

=== toby ===
Whoa, hey Fae! Are you getting a cinnamon bun too? The icing swirls are HUGE today! # speaker: Toby
I was just at the arcade trying to beat my record on Boop-a-Mole, Skee-Ball, and Comet Cruise! # speaker: Toby
Star Racer's top high score is still scribbled out in purple marker, which is super mysterious. Nobody knows whose initials were under there! # speaker: Toby
Oh, pro tip for calming fizzy critters: swing by the Grocery Market and Cloverhollow Scoops for Favourite Treats! # speaker: Toby
If you toss a critter its favorite treat in a calm-down, it calms down WAY faster than a regular snack! # speaker: Toby
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
    -> DONE
- count == 0:
    Right now 0 of 17 valley animals have wandered up here yet. # speaker: Ranger Fern
    Once you calm critters around Cloverhollow, Bubblegum Bay, Pinecone Pass, and the woods, they'll start visiting this meadow! # speaker: Ranger Fern
    -> DONE
- else:
    Right now {count} of 17 valley animals are visiting the sanctuary meadow! # speaker: Ranger Fern
    Walk right up and pet anyone you've calmed, or check the wooden bulletin board to see which valley regions still have shy critters! # speaker: Ranger Fern
    -> DONE
}

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

