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

=== pass_souvenirs ===
{
- buster_reward and sanctuary_gift:
    Heard you earned the Wildlife Sanctuary ranger basket up on the ridge, Fae! Warm brittle waiting! # speaker: Pass keeper
- buster_reward:
    Welcome back, Star-Line Explorer! Buster's Golden Whistle shines bright against the alpine snow! # speaker: Pass keeper
- else:
    Welcome to the Pinecone Pass mountain stand! Warm Maple Pine Brittle and snowy keepsakes! # speaker: Pass keeper
}
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

=== summit_lift ===
The sunny red ski-lift chair sways gently beside the snowy unloading deck, ready for the glide back down to Pinecone Pass. # speaker: Fae
+ [Ride the ski lift back down to Pinecone Pass]
    Down we glide over the snowy pines! # speaker: Fae # sound: chime-blue # travel: pass.ski-lift
    -> DONE
+ [Stay up at the summit]
    Let's take in the mountaintop air a little longer! # speaker: Fae
    -> DONE

=== summit_telescope ===
~ summit_visited = true
{not summit_telescope_used:
    ~ summit_telescope_used = true
    Fae wipes a dusting of snow off the gleaming brass panoramic telescope! Ten lucky lookout coins glint right in the coin tray! # speaker: Fae # gift: coins 10 # sound: chime-yellow
    {jordan_joined: On a clear day like this, you can see the whole Cloverhollow valley from up here! # speaker: Jordan}
- else:
    The gleaming brass panoramic telescope swivels smoothly along the north railing. # speaker: Fae
}
-> lookout
= lookout
+ [Look south toward Cloverhollow]
    Way down in the sunny valley, Cloverhollow Plaza's fountain sparkles between the red roofs of Bon Appetit Cafe, the Grocery Market, and our own house! # speaker: Fae
    -> lookout
+ [Look east toward Bubblegum Bay]
    {sue_joined: Hey, swing it east! I can spot my wooden fishing dock and the turquoise waves of Bubblegum Bay sparkling from way up here! # speaker: Sue|Far to the east, Bubblegum Bay's wooden fishing dock stretches out into sparkling turquoise waves! # speaker: Fae}
    -> lookout
+ [Look west toward Whispering Woods & the Ancient Tree]
    {calmed("hooded-kid"):
        West past Whispering Woods, the Ancient Tree shines with warm golden light now that Milo and the whole valley are calm again! # speaker: Fae
    - else:
        {forest_fizzy:
            West beyond the pine canopy of Whispering Woods, a faint swirling violet shimmer rises above the Ancient Tree. # speaker: Fae
        - else:
            West past Whispering Woods, the Ancient Tree glows peacefully above a calm sunlit canopy! # speaker: Fae
        }
    }
    -> lookout
+ [Step back from the telescope]
    What a view! # speaker: Fae
    -> DONE

=== summit_thermos ===
{summit_cocoa_taken: -> again}
~ summit_cocoa_taken = true
A cheerful red-and-silver thermos rests on the sunny wooden bench with a note from Mrs. Flurry: "Warming-Hut Cocoa for summit hikers!" # speaker: Fae
Fae pours steaming mugs of marshmallow cocoa for the whole crew—and packs two cozy summit snacks for the trail! # speaker: Fae # gift: snack 2 # sound: chime-green
{sue_joined: Whoa, hot cocoa above the clouds! Best pit stop ever! # speaker: Sue}
{jordan_joined: Mrs. Flurry's cinnamon marshmallow blend never misses! # speaker: Jordan}
-> DONE
= again
Mrs. Flurry's red-and-silver warming-hut thermos sits cozily on the wooden bench, still radiating a faint hint of cinnamon cocoa. # speaker: Fae
-> DONE

=== summit_cabin ===
Warm golden light glows through the frosted panes of the ski-patrol warming hut, smelling of cedar smoke and cinnamon. # speaker: Fae
{has_lantern: A weathered brass plaque beside the door notes that mountain hikers sometimes leave hidden trail runes over by the west stone cairn—only visible under a special violet light! # speaker: Fae|A weathered brass plaque beside the door welcomes hikers to rest by the thermos bench and admire the ancient west stone cairn. # speaker: Fae}
-> DONE

=== summit_cairn_glow ===
{summit_aurora_read: -> again}
~ summit_aurora_read = true
Under Jordan's blacklight lantern, shimmering lavender-and-gold runes wake across the ancient stacked summit stones! # speaker: Fae
"ALPINE AURORA LEGEND: When the valley below is calm and kind, the mountaintop snow dances with lavender and gold light!" # speaker: Glow Note
Whoa... and fifteen gleaming mountaintop coins sparkle inside a tiny hollow beneath the cairn! # speaker: Fae # sound: chime-red # gift: coins 15
-> DONE
= again
The glowing Alpine Aurora Legend shimmers softly across the stone cairn: "When the valley below is calm and kind, the mountaintop snow dances with lavender and gold light!" # speaker: Fae
-> DONE

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
