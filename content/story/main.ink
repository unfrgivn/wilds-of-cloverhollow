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
VAR maple_in_hall = true
VAR hood_waiting = false
VAR saw_hood = false
VAR pe_time = false
VAR gym_quest = false
VAR saw_clipboard = false
VAR has_lasso = false
VAR found_clipboard = false
VAR coach_thanked = false
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
Has anyone seen a kid in a purple hood? They ran off from the fountain, giggling. # speaker: Notice board
{
- plan == "now": A kid in a purple hood? I bet that's who did it. # speaker: Fae
- else: A kid in a purple hood, fizzing up the fountain? Weird. # speaker: Fae
}
-> DONE

=== journal ===
{coach_thanked: Coach Ash gave me his lasso! It can pull down things that are up high, and maybe swing across gaps too. # speaker: Fae}
{gym_quest and not coach_thanked and calmed("gym-pup") and found_clipboard: I found Coach Ash's stopwatch and his clipboard! Back to Coach Ash. # speaker: Fae}
{gym_quest and not calmed("gym-pup"): A fizzy pup is zooming around the gym with Coach Ash's stopwatch. # speaker: Fae}
{gym_quest and not found_clipboard: {has_lasso:Coach Ash lent me his lasso, to get his clipboard down from the hoop.|{saw_clipboard:Coach Ash's clipboard is stuck on the basketball hoop. It's too high to reach!|Coach Ash's clipboard went flying, somewhere up high.}} # speaker: Fae}
{gym_quest: The kid in the purple hood knocked over Coach Ash's cart, then ran out the back door to the playing field. # speaker: Fae}
{has_flute: Ms. Willow gave me her very first flute! When I play it, animal friends come running. # speaker: Fae}
{heard_bird and not has_flute: The bluebird sang a note just like the red bar. Maybe that's the song's last note! # speaker: Fae}
{calmed("music-bird") and not has_flute: The bluebird gave back Ms. Willow's chime mallet. # speaker: Fae}
{music_quest and not calmed("music-bird"): A bluebird took Ms. Willow's chime mallet. Maybe a kind word will calm it down. # speaker: Fae}
{song_start and not has_flute: The class song goes red, yellow, blue... and the last note is under the purple scribbles. # speaker: Fae}
{music_quest and not has_flute: The kid in the purple hood climbed in through the music room window and scribbled on the class song. # speaker: Fae}
{music_time and not music_quest: Music class is next! Ms. Willow's music room is down the east hall. # speaker: Fae}
{pe_time and not gym_quest: Time for PE! The gym is down the east hall. # speaker: Fae}
{saw_hood and gym_hall and not pe_time: The gym doors are locked during story time. Ms. Maple will know when it's over. # speaker: Fae}
{saw_hood: A kid in a purple hood ran off toward the gym! They dropped a purple marker, the same purple as the Star Racer scribbles. # speaker: Fae}
{story_time and not saw_hood: Story time! Rosie and Milo are in my class. Maybe somebody saw the kid in the purple hood. # speaker: Fae}
{calmed("arcade-keeper") and not story_time: Ms. Maple said to be back in time for story time. Back to school! # speaker: Fae}
{calmed("arcade-keeper"): Mr. Pip, the arcade keeper, drank a fizzy soda from the kid in the purple hood. The spell works on people too! # speaker: Fae}
{calmed("arcade-keeper"): The hooded kid scribbled out their initials on the Star Racer high score. Someone from school again... # speaker: Fae}
{clubhouse_claimed and not calmed("arcade-keeper"): A note in the clubhouse said "NEXT STOP: THE ARCADE." The arcade is in the plaza, back home. # speaker: Fae}
{clubhouse_claimed: The Whispering Woods clubhouse is ours. Sue will fix a fridge, and Jordan will grow a garden. # speaker: Fae}
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
And there's a purple thread stuck to it... from a purple hood! # speaker: Fae
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
The clover up here is extra sweet. Want some? # speaker: Ribbon Bunny
-> DONE

=== squirrel_calm ===
{squirrel_calm > 1: -> again}
Phew! Sorry about all the acorns. # speaker: Acorn Squirrel
A kid in a purple hood traded me a shiny bottle cap for my best acorn. # speaker: Acorn Squirrel
Then, fizz! I couldn't stop throwing things. # speaker: Acorn Squirrel
-> DONE
= again
I'm saving my acorns for winter now. Nobody gets bonked! # speaker: Acorn Squirrel
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
{saw_hood: Did you catch them? They're SO fast. # speaker: Rosie}
{not saw_hood: Hurry, Fae! They went down the hall! # speaker: Rosie}
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
The clubhouse is ours now. Sue is planning a fridge, and Jordan is planning a garden. # speaker: Fae
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

=== claw_machine ===
A claw machine full of plush critters: a frog, a pup, and a very smug raccoon. # speaker: Fae
{calmed("arcade-keeper"): Someday I'm going to win that raccoon. # speaker: Fae}
-> DONE

=== ticket_counter ===
Jars of candy, a ring toss prize, and a big roll of orange tickets behind the counter. # speaker: Fae
-> DONE

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
A paint palette on the door. The art room, maybe? It's locked. # speaker: Fae
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
