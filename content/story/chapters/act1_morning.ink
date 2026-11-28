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
The fountain is still fizzing. {plan == "now": I'm going to go look!|I'll check it after school.} # speaker: Fae # expr: determined
-> DONE

=== pillow_journal ===
{awake: -> milo_calm.morning_journal}
My journal, right under my pillow where it belongs. # speaker: Fae # expr: happy
{
- plan == "now": Note to self: fizzing fountain. Go look NOW before the bubbles claim the plaza! # speaker: Fae # expr: determined
- plan == "later": Note to self: fizzing fountain. Check after school. # speaker: Fae # expr: determined
- else: Mom and Dad gave it to me when baby Oliver was born, so my own adventures would always have a front-row seat. # speaker: Fae # expr: happy
}
-> DONE

=== desk ===
{awake: -> milo_calm.morning_desk}
{My sketchbook! I drew Maddie as a dragon yesterday, complete with a very dignified nap hoard of shiny bottle caps.|Watercolor tins, stubby pencils, and one eraser Maddie definitely insists she never chewed.} # speaker: Fae # expr: happy
-> DONE

=== cat_bed ===
{awake: -> milo_calm.morning_cat_bed}
Maddie's bed. Still toast-warm, full of orange fur, and shaped like a dramatic cinnamon roll. # speaker: Fae # expr: happy
-> DONE

=== bedroom_shelf ===
My bookshelf! There's a cozy wooden deck right on top for displaying my favorite arcade plushes and prizes. # speaker: Fae
+ [Decorate Bedroom Shelf]
    Let's pick which cozy plushes perch on the top shelf! # speaker: Fae # open-decor: bedroom
    -> DONE
+ [Step back]
    My favorite sunny corner of the room. # speaker: Fae
    -> DONE

=== notice_board ===
~ read_notice = true
CLOVERHOLLOW NEWS: The fountain is fizzing! # speaker: Notice board
Has anyone seen a kid in a purple hood? They ran off from the fountain, giggling. # speaker: Notice board
{
- plan == "now": A kid in a purple hood? I bet that's who did it. # speaker: Fae # expr: determined
- else: A kid in a purple hood, fizzing up the fountain? Weird. # speaker: Fae # expr: surprised
}
-> DONE

=== fountain ===
{calmed("fountain-frog"):
    The bubbles are gone. The fountain sparkles like new! # speaker: Fae
- else:
    \{wave\}Pink bubbles...\{/wave\} and it smells like bubblegum? Maddie sneezes once and gives the stone rim a deeply offended glare. # speaker: Fae # expr: surprised
}
-> DONE

=== frog_calm ===
{frog_calm > 1: -> again}
Ribbit! Thank you for the gentle rhythm, Fae. My brain finally stopped doing backflips! # speaker: Fountain Frog # expr: happy
Something fizzy and \{color:lavender\}purple\{/color\} splashed into my fountain last night. Tasted like trouble, smelled like grape thunder! # speaker: Fountain Frog # expr: worried
-> DONE

= again
Ribbit! The fountain is humming in tune again, and not a single bubble smells like candy. # speaker: Fountain Frog # expr: happy
-> DONE

=== breakfast ===
{awake: -> milo_calm.morning_breakfast}
Three plates, three cups, and one tiny spoon for Oliver. Maddie is supervising from floor level with maximal pancake hope. # speaker: Fae # expr: happy
-> DONE

=== fridge ===
{awake: -> milo_calm.morning_fridge}
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
A giant mixing bowl of pancake batter and a precarious mountain of blueberries. Maddie's tail twitches like a tiny orange metronome. # speaker: Fae # expr: happy
-> DONE

=== oliver ===
{awake: -> milo_calm.morning_oliver}
{
- milo_revealed:
    Oliver claps both chubby hands at Maddie and beams up at Fae. "Ba! Yay!" # speaker: Oliver # expr: happy
    Mom laughs warmly from the kitchen. "Even Oliver can tell the valley is calm again!" # speaker: Mom # expr: happy
- buster_reward:
    Oliver spots Fae's shiny Golden Whistle and giggles. "Ba! Star!" # speaker: Oliver # expr: happy
    Mom laughs from the kitchen, flipping a golden pancake mid-air. # speaker: Mom # expr: happy
- else:
    Oliver shakes his rattle. "Ba!" # speaker: Oliver # expr: happy
    Mom laughs from the kitchen. "Careful, Maddie, he's eyeing your tail again!" # speaker: Mom # expr: happy
}
-> DONE

=== mom ===
{awake: -> milo_calm.morning_mom}
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
{
- milo_revealed:
    I'm so proud of you, sweetie! Helping Milo feel seen brought calm right back to the valley. # speaker: Mom
    Sunny Cloverhollow looks so bright! Dad and Ranger Fern saved you a spot at the Sanctuary Festival! # speaker: Mom
- sanctuary_reward_14:
    Ranger Fern wove you a Sanctuary Clover Wreath? I'm so proud of my little critter friend! # speaker: Mom
- gem_reward_all:
    All seven Star Gems and Grandpa Barnaby's Rainbow Geode? That calls for celebration pancakes! # speaker: Mom
- buster_reward:
    What a shiny Golden Star-Line Whistle! You really explored every corner of the valley, sweetie. # speaker: Mom
- sunberry_harvests > 0:
    A glowing Golden Sunberry from your garden? Let's top tomorrow's blueberry pancakes with one! # speaker: Mom
- else:
    Have a good day, sweetie. Stay curious! # speaker: Mom
}
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
-> milo_calm.epilogue_front_door

=== front_door_morning_notice ===
-> milo_calm.front_door_notice

=== tree_ending ===
-> milo_calm.epilogue_tree_ending

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
A checkered picnic spread: triangle sandwiches, chilled lemonade, and an empty berry basket. # speaker: Fae # expr: surprised
Somebody inhaled every single berry and left a trail of tiny \{color:lavender\}purple paw prints\{/color\}! Maddie sniffs one and sneezes dramatically. # speaker: Fae # expr: worried
-> DONE

=== bay_road_closed ===
The east road goes to Bubblegum Bay! # speaker: Fae
First let's untangle the hooded kid's trail right here in town. Maddie agrees, mostly because there might be snacks! # speaker: Fae # expr: determined
-> DONE

=== park_sign ===
MEADOW PARK. Please keep your pets on the path! (Cats who pretend they cannot read still count.) # speaker: Sign
{not calmed("pup"): Somebody's very enthusiastic pet is barking up a storm by the pond! # speaker: Fae # expr: surprised}
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

// Elevation Track E10: Milo Foreshadowing Beat 2 (Plaza / Market).
// Strict §1.2 secrecy: Milo appears purely as a kind, overwhelmed classmate.
=== milo_foreshadow_plaza ===
~ milo_beat_plaza = true
By the grocery crates, a jumpy stray raccoon backs into an apple basket while noisy shoppers wave their arms! # speaker: Fae # expr: surprised # zoom: 1.07
Hey! Back off a second! It's not trying to steal anything, it's just \{shake\}terrified\{/shake\} of all the yelling! # speaker: Milo # expr: determined
Milo kneels slowly and rolls a crisp red apple slice under the wooden crate. # speaker: Fae # expr: happy
\{whisper\}I get it, little guy. Everything in town gets way too loud when nobody stops to listen...\{/whisper\} # speaker: Milo # expr: worried
Mrrrow-purrrr! Maddie trots up and gives Milo's sneaker a tiny, solemn head-bump of approval. # speaker: Maddie # expr: happy # pose: maddie sit
Whoa, Fae! Hey! I didn't see you there. The little guy just looked cornered, you know? # speaker: Milo # expr: surprised
* [That was really kind of you, Milo.]
    Heh... thanks. Critters just want a quiet corner without everybody staring. Catch you at school, Fae! # speaker: Milo # expr: happy
* [Town HAS been super noisy today.]
    Right? Sometimes I wish there were a giant volume knob for the whole plaza. See you later, Fae! # speaker: Milo # expr: worried
- The raccoon peeks out nibbling its apple slice as Milo gives one quick wave and hurries down the cobblestones. # speaker: Fae # expr: neutral
-> DONE

// Elevation Track E10: Milo Foreshadowing Beat 5 (Sketch Loft / Park edge).
// Strict §1.2 secrecy: ZERO Milo name, ZERO hood/fizz/pond spoilers.
=== milo_foreshadow_loft ===
~ milo_beat_loft = true
Sliding a comic back into the wooden crate, Fae spots a creased, torn sketchbook corner tucked under Issue #12. # speaker: Fae # expr: surprised # zoom: 1.09
Fae unfolds it gently. Drawn in soft pencil and lilac ink is a tiny comic hero in a swirling \{color:lavender\}purple cape\{/color\}, standing alone on a hill. # speaker: Fae # expr: worried # pose: talk
Down in the valley below, classmates laugh around a sunny treehouse. The caped hero's speech bubble is rubbed fuzzy by an eraser. # speaker: Fae # expr: worried
Mrrrow... Maddie rests one warm orange paw on the curled paper edge, eyes soft and round. # speaker: Maddie # expr: worried # pose: maddie sit
\{whisper\}Whoever sketched this didn't want to ruin anyone's day. They just wanted a seat at the table.\{/whisper\} # speaker: Fae # expr: determined
Fae folds the torn corner carefully and tucks it right back beneath the stack of rocket comics. # speaker: Fae # expr: neutral
-> DONE

// Elevation Track E10: Empathetic Mini-Boss Pre-Battle Stress Vignette 5 (Mr. Pip).
=== vignette_mr_pip ===
~ vignette_pip_seen = true
Token jam on Skee-Ball lane two! Claw tangled around that smug raccoon plush AGAIN! # speaker: Mr. Pip # expr: worried # zoom: 1.08
And I spent all morning polishing every joystick, only for somebody to shatter my \{color:gold\}Star Racer\{/color\} record and dash without even leaving initials! # speaker: Mr. Pip # expr: determined
\{shake\}BEEP-BOOP-FIZZ!\{/shake\} Wait... why are my sneakers vibrating?! NOBODY leaves an arcade mess on MY watch! # speaker: Mr. Pip # expr: surprised # sound: chime-red
Mrrrow! Maddie flattens her ears at the whirring cabinets while Fae winces sympathetically. # speaker: Maddie # expr: worried
Poor Mr. Pip... he's been juggling ten broken machines all by himself, and that purple soda pushed him straight into overdrive! # speaker: Fae # expr: worried
{sue_joined: Don't sweat it, Mr. Pip! Let's calm this high-score storm down and give you a real breather! # speaker: Sue # expr: determined}
{not sue_joined: Hang tight, Mr. Pip! We're going to help you catch your breath! # speaker: Fae # expr: determined}
-> DONE

// Elevation Track E10: Empathetic Mini-Boss Pre-Battle Stress Vignette 6 (Chef Mateo).
=== vignette_chef_mateo ===
~ vignette_mateo_seen = true
Twenty minutes chopping fresh cilantro, hand-painting forty sunny flyers, and one gust of hillside wind eats the whole stack! # speaker: Chef Mateo # expr: worried # zoom: 1.08
My grandma's crispy taco shells are a work of art! Does \{shake\}ANYBODY\{/shake\} in Cloverhollow care about a proper crunch anymore?! # speaker: Chef Mateo # expr: determined
Wait... that purple soda smelled like habanero thunder! \{pop\}MORE SPICE! EXTRA CRUNCH!\{/pop\} EVERYBODY TASTE-TESTS RIGHT NOW! # speaker: Chef Mateo # expr: surprised # sound: chime-red
Maddie hides behind Fae's sneakers, squinting suspiciously at a drifting cloud of paprika sparkles. # speaker: Fae # expr: worried
Aw... he just worked his heart out on those flyers and got worried nobody would show up! # speaker: Fae # expr: worried
{jordan_joined: Let's talk tacos with him and remind him the whole valley loves his kitchen! # speaker: Jordan # expr: determined}
{not jordan_joined: Let's remind him how much Cloverhollow loves his cooking, one calm word at a time! # speaker: Fae # expr: determined}
-> DONE
