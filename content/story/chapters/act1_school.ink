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
{milo_revealed: -> again}
{classroom_teacher > 1 and saw_hood and not pe_time: -> pe}
{classroom_teacher > 1: -> again}
Today's story is about a dragon who sneezes bubbles instead of fire! # speaker: Ms. Maple
Bubbles... like the fountain this morning. # speaker: Fae
Everyone in the village got very sticky. Settle in, everyone! # speaker: Ms. Maple
{saw_hood: -> pe}
-> DONE
= again
{
- milo_revealed:
    I'm so proud of you, Fae! Helping Milo open up brought calm right back to Cloverhollow. # speaker: Ms. Maple
- sanctuary_reward_14:
    Oh, what a lovely woven Sanctuary Clover Wreath! Ranger Fern must be so proud of you, Fae! # speaker: Ms. Maple
- gem_reward_all:
    All seven valley Star Gems? You have the brightest explorer's eye in Cloverhollow, Fae! # speaker: Ms. Maple
- else:
    Remember, Fae: a kind word can calm almost anything. # speaker: Ms. Maple
}
-> DONE
= pe
That's the end of our story! Time for PE, everyone. # speaker: Ms. Maple
Coach Ash is waiting for you in the gym, down the east hall. # speaker: Ms. Maple
~ pe_time = true
The gym! That's where the kid in the purple hood was headed. # speaker: Fae
-> DONE

=== milo ===
{milo_revealed: -> epilogue}
{milo > 1: -> again}
Fae! Did you hear? Somebody beat the Star Racer high score at the arcade! # speaker: Milo
I've been trying all year. And they scribbled out their initials, so nobody knows who! # speaker: Milo
Whoever it was must be really, REALLY good at Star Racer. # speaker: Milo
-> DONE
= again
Milo folds a paper airplane. "This one's a Star Racer!" # speaker: Milo
-> DONE
= epilogue
Hey Fae! No more purple fizz! Want to race paper airplanes at recess? For real this time! # speaker: Milo
{
- sanctuary_reward_14:
    Whoa, Ranger Fern wove you a Sanctuary Clover Wreath?! You're the real valley legend, Fae! # speaker: Milo
- buster_reward:
    Whoa, a Golden Star-Line Whistle from Buster?! Show me how to blow it after school, okay? # speaker: Milo
}
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
{
- milo_revealed:
    Wait, the purple hood was Milo all along?! I'm glad the mystery's solved and the halls are calm! # speaker: Rosie
- kite_returned and buster_reward:
    Whoa, Buster gave you a Golden Star-Line Whistle?! Even cooler than flying my kite at the park! # speaker: Rosie
- sue_compass and jordan_clover:
    You visited Sue's cottage AND Jordan's cabin? Our class is going to want a whole story time on that! # speaker: Rosie
- saw_hood:
    Did you catch them? They're SO fast. # speaker: Rosie
- else:
    Hurry, Fae! They went down the hall! # speaker: Rosie
}
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
Everyone's cubby has a coat hook, a crooked paper name tag, and at least one runaway crayon. # speaker: Fae # expr: happy
Mine holds spare striped socks, my dragon-Maddie drawing, and a tiny folded paper star someone left along the rail. # speaker: Fae # expr: happy
-> DONE

=== reading_corner ===
A cozy reading rug piled with squishy beanbags and well-loved picture books. Maddie immediately eyes the sunniest cushion like a tiny orange monarch. # speaker: Fae # expr: happy
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
{
- milo_revealed:
    Ha! Looks like Milo's hall-sprint record finally met its match in your calm-down team, Fae! # speaker: Coach Ash
- cavern_chime_rung:
    You twirled my Rainbow Lasso to ring Crystal Cavern's star chime? Now THAT'S gold-medal form! # speaker: Coach Ash
- buster_reward:
    TWEET! A grand salute to Cloverhollow's official Star-Line Explorer! Keep stretching those legs! # speaker: Coach Ash
- else:
    {not music_quest: Music is next, Fae! Ms. Willow's room is down the east hall. # speaker: Coach Ash}
    {recess: Recess! I've propped the back door open. Out you go! # speaker: Coach Ash}
    Keep that lasso handy, Fae! And watch out for that purple hood. # speaker: Coach Ash
}
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
A giant rolling bin of gym balls: shiny red ones, bouncy blue ones, and one dramatically pancake-flat ball that refuses to retire. # speaker: Fae # expr: happy
-> DONE

=== climbing_rope ===
A thick braided climbing rope stretching all the way to the rafters, with a shiny brass bell at the top! One day I'm ringing that bell on the first try. # speaker: Fae # expr: determined
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
The hall bulletin board: Friday's spelling bee, a bake sale poster with twelve exclamation points, and one lonely striped mitten pinned under "IS THIS YOURS?!" # speaker: Fae # expr: happy
-> DONE

=== trophies ===
Gleaming trophies for spelling, junior soccer, and Cloverhollow's fiercely contested Giant Pumpkin Championship. Maddie checks her reflection in the pumpkin cup. # speaker: Fae # expr: happy
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
{
- milo_revealed:
    Milo brought back every purple marker and painted a whole galaxy of stars with me today, Fae! # speaker: Ms. Rowan
- sanctuary_reward_14:
    I packed my sketchbook for Ranger Fern's meadow! All those calm critters deserve watercolor portraits! # speaker: Ms. Rowan
- sunberry_harvests > 0:
    Ooh, those glowing Golden Sunberry hues! I've been mixing honey-gold paint to match them all week! # speaker: Ms. Rowan
- else:
    Welcome back, Fae! The easels are ready for you. # speaker: Ms. Rowan
}
-> DONE

=== art_easels ===
Three wooden easels, three crisp blank canvases, and enough pastel paint jars to redecorate the entire county. # speaker: Fae # expr: happy
-> DONE

=== art_paintings ===
The art wall bursts with bright student watercolors: swirling galaxies, lopsided cats, and a drying rack wobbling heroically under twelve soggy rainbows. # speaker: Fae # expr: happy
-> DONE

=== art_sink ===
A deep porcelain sink swirling with turquoise-and-gold rinse water. Ms. Rowan says tired brushes deserve a gentle bath right away! # speaker: Fae # expr: happy
-> DONE

=== art_markers ===
A wooden marker caddy where red, gold, and teal sit neatly in rows... and the entire \{color:lavender\}purple\{/color\} slot is wiped clean. Every last one gone. # speaker: Fae # expr: worried
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
{
- milo_revealed:
    Oh, what sweet harmony! Helping Milo find his calm again is the finest song in Cloverhollow, Fae. # speaker: Ms. Willow
- sanctuary_reward_14:
    Your flute and kindness filled Ranger Fern's meadow with calm friends! Pure woodland music, dear! # speaker: Ms. Willow
- gem_reward_all:
    All seven Star Gems, and Ribbon Bunny hops along to your flute now? Simply enchanting, Fae! # speaker: Ms. Willow
- else:
    Play that flute whenever you need a friend, Fae! # speaker: Ms. Willow
    {recess: Now, off to recess! The playing field is out the gym's back door. # speaker: Ms. Willow}
}
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

=== hopscotch ===
Fae hops the whole chalk hopscotch grid on one sneaker, all the way to 7 and back! Maddie awards a stern ten out of ten tail-flicks. # speaker: Fae # expr: happy # pose: cheer
-> DONE

=== tetherball ===
\{pop\}WHACK!\{/pop\} Fae sends the tetherball orbiting the pole while Maddie tracks every loop like a miniature orange satellite! # speaker: Fae # expr: happy
-> DONE

// Elevation Track E10: Milo Foreshadowing Beat 1 (School Hall / Classroom).
// Strict §1.2 secrecy: Milo appears purely as a quiet, self-conscious classmate.
=== milo_foreshadow_school ===
~ milo_beat_school = true
Tucked in the quiet corner beside the art wall, Milo hunches over a worn notebook, humming a soft four-note tune: "\{wave\}da-da-da-DUM...\{/wave\}" # speaker: Fae # expr: neutral # zoom: 1.08
Mrrrow? Maddie pads straight over and nudges the margin of his page, showing a tiny crayon rocket blasting into huge blank sky. # speaker: Maddie # expr: happy # pose: maddie sit
Whoa! Hey, Maddie! Milo snaps the sketchbook shut in a hurry and rubs the back of his neck with a wobbly grin. # speaker: Milo # expr: surprised
Hey, Milo! Are you okay? Your rocket page looked awesome! # speaker: Fae # expr: worried
Oh, totally fine, Fae! Just... practicing between bells. Everybody in class already has their big thing, you know? Rosie's kites, your adventures... # speaker: Milo # expr: worried
* [Want to sketch together after school?]
    Wait, for real?! \{pause:6\}Maybe once I finish one really cool page first. \{whisper\}So it's actually worth showing.\{/whisper\} # speaker: Milo # expr: surprised
* [That little hummed tune sounded great!]
    Heh, thanks... I hum it when the room gets too loud. Makes my brain feel like a rocket countdown: \{wave\}da-da-da-DUM...\{/wave\} # speaker: Milo # expr: happy
- Milo tucks his pencil behind his ear and gives Fae a shy thumbs-up before turning back to the corner desk. # speaker: Fae # expr: neutral
-> DONE

// Elevation Track E10: Empathetic Mini-Boss Pre-Battle Stress Vignette 2 (Ms. Rowan).
=== vignette_ms_rowan ===
~ vignette_rowan_seen = true
Parent Art Show is TOMORROW! Twenty-eight skies dried upside-down, glitter landed in my tea, and... # speaker: Ms. Rowan # expr: worried # zoom: 1.08
I had \{shake\}THIRTY-TWO\{/shake\} purple markers at eight o'clock sharp! How is an art teacher supposed to paint a twilight sunset without purple?! # speaker: Ms. Rowan # expr: determined
One quick sip of bubbly grape soda to calm my nerves, and \{pop\}WHOOSH!\{/pop\} NOW THE HALLWAY IS MY CANVAS! # speaker: Ms. Rowan # expr: surprised # sound: chime-red
Mrrrow! Maddie hops neatly onto Fae's boot to keep her orange paws safe from flying lilac droplets. # speaker: Maddie # expr: worried
Aw, Ms. Rowan isn't mean at all! She's just stretched way too thin before the Art Show, and that fizzy drink turned stress into a paint tornado! # speaker: Fae # expr: worried
{sue_joined: Let's brush this whirlwind back into something pretty so she can actually finish her tea! # speaker: Sue # expr: determined}
{not sue_joined: Hold steady, Ms. Rowan! We'll help clear the swirls right back into calm color! # speaker: Fae # expr: determined}
-> DONE

// Elevation Track E10: Empathetic Mini-Boss Pre-Battle Stress Vignette 3 (Mr. Bell).
=== vignette_mr_bell ===
~ vignette_bell_seen = true
The hall intercom is stuck, three kids lost left mittens, and somebody typed "TACONADO TUESDAY" on lunch! # speaker: Mr. Bell # expr: worried # zoom: 1.08
I still have two hundred and fourteen students' names to greet before the bell, and my spare clipboard vanished into thin air! # speaker: Mr. Bell # expr: determined
\{shake\}AHEM! TESTING, ONE, TWO, SEVENTEEN!\{/shake\} Why is my voice echoing like a foghorn?! ATTENTION, EVERYBODY, ATTENTION! # speaker: Mr. Bell # expr: surprised # sound: chime-red
Maddie presses both paws flat over her ears and gives Fae an unmistakable "please turn the principal down" look. # speaker: Fae # expr: worried
Poor Mr. Bell... he cares so much about keeping the whole school running on time that one fizzy sip made every announcement burst out at once! # speaker: Fae # expr: worried
{jordan_joined: Let's give him a calm breather before he accidentally announces next month's fire drill too! # speaker: Jordan # expr: determined}
{not jordan_joined: Take a deep breath, Mr. Bell! We've got your back! # speaker: Fae # expr: determined}
-> DONE
