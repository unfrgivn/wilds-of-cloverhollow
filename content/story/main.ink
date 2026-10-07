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
EXTERNAL calmed(id)
EXTERNAL coins()

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
My journal, right under my pillow where it belongs. # speaker: Fae
{
- plan == "now": Note to self: fizzing fountain. Go look NOW. # speaker: Fae
- plan == "later": Note to self: fizzing fountain. Check after school. # speaker: Fae
- else: Mom and Dad gave it to me when Oliver was born. # speaker: Fae
}
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
Has anyone seen a raccoon in a purple hood? # speaker: Notice board
{
- plan == "now": A raccoon in a hood? I bet that's who did it. # speaker: Fae
- else: A raccoon... in a hood? Weird. # speaker: Fae
}
-> DONE

=== journal ===
{clubhouse_claimed: The Whispering Woods clubhouse is ours. Sue will fix a fridge, and Jordan will grow a garden. # speaker: Fae}
{found_old_trail: The raccoon's glowing trail goes west through the pines, toward the Whispering Woods. # speaker: Fae}
{calmed("gull"): The grumpy gull at the lookout was fizzy too. That raccoon gets around! # speaker: Fae}
{has_lantern: Jordan gave me his blacklight lantern. The raccoon took a secret trail you can only see in its light! # speaker: Fae}
{jordan_joined: Jordan is on my team now! He's hiked every trail on the mountain. # speaker: Fae}
{calmed("bunny") and calmed("squirrel"): The Cliffside Trail runs between Pinecone Pass and Bubblegum Bay. Its bunny and squirrel are calm again! # speaker: Fae}
{rode_bus: Pinecone Pass is covered in snow, with a lodge and a cocoa stand. The raccoon must be up here somewhere. # speaker: Fae}
{calmed("bluebird") and not rode_bus: The bus at the plaza's star sign goes up into the mountains, to Pinecone Pass! # speaker: Fae}
{calmed("bluebird"): The Bay Bluebird says the raccoon zipped off toward the mountains. # speaker: Fae}
{sue_joined: Sue is on my team now! She knows every good fishing spot. # speaker: Fae}
{club_open: The purple hood in the tree house has a Cloverhollow School name tag. Whose is it? # speaker: Fae}
{club_open and not sue_joined: The east road leads to Bubblegum Bay. The club's fizzy purple soda smelled just like the fountain's bubblegum bubbles. # speaker: Fae}
{knows_password and not club_open: The raccoon's club password is "Fizzlesticks". A club... like the tree house in the park? # speaker: Fae}
{hall_pass: I have a hall pass! Time to follow the raccoon's trail. # speaker: Fae}
{calmed("pup"): The Pond Pup is calm. A raccoon paw print points toward the school. # speaker: Fae}
{calmed("frog") and not calmed("pup"): Purple fizz drips lead out of the plaza to Meadow Park. # speaker: Fae}
{coins() > 0: I have coins! The bakery in the plaza sells snacks for 5 coins. # speaker: Fae}
{calmed("frog"): The Fountain Frog is calm. Something purple fizzed into his fountain. # speaker: Fae}
{read_notice: A raccoon in a purple hood was seen in town. # speaker: Fae}
{plan == "now": Go see why the fountain is fizzing! # speaker: Fae}
{plan == "later": Check the fizzing fountain after school. # speaker: Fae}
-> DONE

=== fountain ===
{calmed("frog"):
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
The fridge is covered in drawings, shopping lists, and one very proud glittery family photo. # speaker: Fae
-> DONE

=== island ===
A big bowl of pancake batter and a whole mountain of blueberries. Yum. # speaker: Fae
-> DONE

=== oliver ===
Oliver shakes his rattle. "Ba!" # speaker: Oliver
Mom laughs from the kitchen. # speaker: Mom
-> DONE

=== mom ===
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

=== pup_calm ===
{pup_calm > 1: -> again}
Woof! Woof! The pup flops down and wags his whole body. # speaker: Pond Pup
He drops a soggy tennis ball at my feet. It's all purple and fizzy. # speaker: Fae
And there's a tiny paw print on it... a raccoon paw print! # speaker: Fae
Woof! # speaker: Pond Pup
He's pointing his nose at the road to school. # speaker: Fae
-> DONE

= again
Woof! The Pond Pup wants to play fetch. # speaker: Pond Pup
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
But I want to follow the raccoon's trail first. # speaker: Fae
-> DONE

=== sue ===
Whoa, hi! Careful, these planks are a little wobbly. # speaker: Sue
I'm Sue. I fish here every day... but today the fish are all fizzy! # speaker: Sue
And that flappy bluebird keeps kicking sand in my bait bucket. # speaker: Sue
Wait. Purple fizz? Was it a raccoon in a hood? # speaker: Sue
* [Yes! I'm following his trail.]
    I knew it! Count me in. # speaker: Sue
* [I think so. Want to help me find out?]
    Are you kidding? Of course! Let me grab my rod. # speaker: Sue
 - ~ sue_joined = true
-> DONE

=== bluebird_calm ===
{bluebird_calm > 1: -> again}
Chirp! Thank you, Fae. My wings feel calm again. # speaker: Bay Bluebird
The raccoon zipped off toward the mountains! # speaker: Bay Bluebird
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
* {calmed("bluebird")} [Pinecone Pass!]
    ~ rode_bus = true
    Up we go! # speaker: Fae # travel: pass.bus
    -> DONE
* {club_open} [Bubblegum Bay!]
    To the beach! # speaker: Fae # travel: bay.bus-stop
    -> DONE
* [Not yet.]
    Not yet. I'll stay in Cloverhollow a little longer. # speaker: Fae
-> DONE

=== bay_bus_stop ===
The bus stops here on its way between the towns. Where to? # speaker: Fae
* [Cloverhollow!]
    Home to town! # speaker: Fae # travel: plaza.bus-stop
    -> DONE
* {calmed("bluebird")} [Pinecone Pass!]
    ~ rode_bus = true
    Up we go! # speaker: Fae # travel: pass.bus
    -> DONE
* [Not yet.]
    Not yet. I want to stay at the beach a little longer. # speaker: Fae
-> DONE

=== pass_bus_stop ===
The bus is ready to roll. Where to? # speaker: Fae
* [Cloverhollow!]
    Back to town! # speaker: Fae # travel: plaza.bus-stop
    -> DONE
* {club_open} [Bubblegum Bay!]
    Down to the beach! # speaker: Fae # travel: bay.bus-stop
    -> DONE
* [Not yet.]
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
A raccoon in a purple hood zipped by, and everything went all fizzy! # speaker: Ribbon Bunny
That raccoon again! # speaker: Fae
-> DONE
= again
The clover up here is extra sweet. Want some? # speaker: Ribbon Bunny
-> DONE

=== squirrel_calm ===
{squirrel_calm > 1: -> again}
Phew! Sorry about all the acorns. # speaker: Acorn Squirrel
A raccoon traded me a shiny bottle cap for my best acorn. # speaker: Acorn Squirrel
Then, fizz! I couldn't stop throwing things. # speaker: Acorn Squirrel
-> DONE
= again
I'm saving my acorns for winter now. Nobody gets bonked! # speaker: Acorn Squirrel
-> DONE

=== gull_calm ===
{gull_calm > 1: -> again}
Squawk! Sorry about your snacks. I couldn't help myself! # speaker: Lookout Gull
A raccoon in a purple hood fed me a fizzy cracker. Then I wanted ALL the snacks! # speaker: Lookout Gull
A fizzy cracker? Everywhere that raccoon goes, things go fizzy. # speaker: Fae
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
* [Did a raccoon in a purple hood come by?]
    He zoomed past on a sled, laughing his head off! Let's go after him. # speaker: Jordan
- ~ jordan_joined = true
-> DONE

=== hamster_calm ===
{hamster_calm > 1: -> again}
Squeak! Thank you. My head feels all cozy again. # speaker: Hiker Hamster
The raccoon? He ran off down a secret trail. You can only see it at night... # speaker: Hiker Hamster
A trail you can only see at night? # speaker: Fae
Trail markers glow under blacklight! Here, Fae, take my lantern. # speaker: Jordan
~ has_lantern = true
Jordan hands Fae his blacklight lantern: a big round purple lens on a rainbow handle. # speaker: Fae
Switch it on and look around. Raccoon tracks glow! # speaker: Jordan
-> DONE

= again
Squeak! Watch out for snowballs. Hee hee. # speaker: Hiker Hamster
-> DONE

=== lift_note ===
Glowing raccoon doodles on the lift tower! A masked face, a swirl, and a star. # speaker: Fae
The squiggles look like secret writing. Was the raccoon leaving a message for someone? # speaker: Fae
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
The cocoa stand steams beside the snowy trail. # speaker: Cocoa seller
{coins() < 5:
    A mug of cocoa costs 5 coins. Maybe calm a critter first? # speaker: Cocoa seller
    -> DONE
}
+ [Buy a mug of cocoa for 5 coins]
    Here you go, a warm mug of cocoa! # speaker: Cocoa seller # buy: snack 5
+ [Not now]
    All right! Stay cozy out there. # speaker: Cocoa seller
- -> DONE

=== lodge_door ===
The lodge is locked. A note says: "Back soon, gone looking for a runaway hamster." # speaker: Fae
-> DONE


=== bay_sign ===
BUBBLEGUM BAY. Fishing, splashing, and sandcastles welcome! # speaker: Sign
-> DONE

=== bay_picnic ===
A beach picnic: watermelon slices, a sun hat, and a sandy towel. # speaker: Fae
{not calmed("bluebird"): Everything's covered in sand. That bluebird again! # speaker: Fae}
-> DONE

=== shells ===
Pretty shells! They sound like tiny waves when I shake them. # speaker: Fae
-> DONE

=== park_sign ===
MEADOW PARK. Please keep your pets on the path! # speaker: Sign
{not calmed("pup"): Somebody's pet is barking by the pond. # speaker: Fae}
-> DONE


=== teacher ===
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

=== raccoon ===
Heh heh heh! So YOU'RE the one who keeps un-fizzing my critters! # speaker: Raccoon
{calmed("frog") and calmed("pup"): The Fizzy Frog AND the Zoomie Pup? Hmph! # speaker: Raccoon}
You'll never get into my secret club. Not without the password! # speaker: Raccoon
* [What's the password?]
    Ha! As if I'd tell you it's "Fizzlesticks"! ...Oops. # speaker: Raccoon
* [Why are you making everything fizzy?]
    Because fizzy is FUN! Way more fun than school! # speaker: Raccoon
    And only my club knows the magic word: "Fizzlesticks"! ...Oops. # speaker: Raccoon
- ~ knows_password = true
~ raccoon_waiting = false
With a puff of purple fizz, the raccoon is gone! # speaker: Fae
-> DONE

=== old_trail_closed ===
The pines are quiet and snowy. The old trail only appears under the lantern's glow. # speaker: Fae
-> DONE

=== clubhouse ===
{clubhouse_claimed: -> clubhouse_again}
The raccoon's abandoned clubhouse smells like purple fizzy soda. # speaker: Fae
Comic books are scattered beside a half-eaten fizzy cracker. # speaker: Fae
With the lantern on, invisible ink glows across the wall: "Meet the boss at the Ancient Tree in the Enchanted Forest." # speaker: Fae
The Enchanted Forest is sealed. Whoever the boss is, the note does not say. # speaker: Fae
{calmed("owl"):
    ~ clubhouse_claimed = true
    Sue will fix up a fridge for the clubhouse. # speaker: Sue
    Jordan will start a little garden outside. # speaker: Jordan
    This is our club now! # speaker: Fae
}
-> DONE

= clubhouse_again
The clubhouse is ours now. Sue is planning a fridge, and Jordan is planning a garden. # speaker: Fae
-> DONE

=== owl_calm ===
{owl_calm > 1: -> again}
The owl whispers, "The trees remember every secret." # speaker: Whispering Owl
The raccoon left purple fizz, comic books, and a cracker in the clubhouse. # speaker: Whispering Owl
The owl hoots wisely. "The boss waits by the Ancient Tree in the sealed forest." # speaker: Whispering Owl
-> DONE
= again
The wise owl whispers through the leaves. # speaker: Whispering Owl
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
