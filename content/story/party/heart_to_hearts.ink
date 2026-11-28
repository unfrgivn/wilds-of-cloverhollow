// Elevation Track E11: Optional Party Heart-to-Heart Scenes.
// Warm, optional character moments triggered at scenic hangout spots once
// story and party milestones are met. Pre-finale scenes strictly obey spec §1.2
// (never naming Milo before `milo_revealed`).

=== function heart_to_heart_count() ===
~ temp total = 0
{ h2h_fae_maddie_done:
    ~ total += 1
}
{ h2h_fae_sue_done:
    ~ total += 1
}
{ h2h_fae_jordan_done:
    ~ total += 1
}
{ h2h_sue_jordan_done:
    ~ total += 1
}
{ h2h_clubhouse_trio_done:
    ~ total += 1
}
{ h2h_sanctuary_encore_done:
    ~ total += 1
}
~ return total

// ---------------------------------------------------------------------------
// 1. Fae & Maddie (Bedroom / Meadow Park): The Journal Under the Pillow
// Directly honors NOTES.md lines 82-83: Mom & Dad's gift when Oliver was born.
// ---------------------------------------------------------------------------
=== h2h_fae_maddie ===
{h2h_fae_maddie_done: -> replay}
Fae sits cross-legged on the warm rug and opens her paint-smudged journal. # speaker: Fae # expr: happy # pose: sit # zoom: 1.08
Mrrrow? Maddie trots right over and rests her chin on the corner of page one. # speaker: Maddie # expr: happy # pose: sit
Hey, sleepyhead. Look at this very first smudge at the top of the page. # speaker: Fae # expr: happy # pose: talk
Do you remember the rainy night Mom and Dad gave me this notebook? # speaker: Fae # expr: neutral # pose: talk
Baby Oliver had just come home, and the whole house smelled like baby powder and warm blankets. # speaker: Fae # expr: worried # pose: sit
Everyone was tiptoeing around the crib, and I remember thinking maybe things were too busy for big-kid stories now. # speaker: Fae # expr: worried # pose: sit
Then Mom sat on my quilt and handed me this blank sketchbook tied with teal twine. # speaker: Fae # expr: happy # pose: talk
She and Dad said: "Even when a baby brother makes the house loud, you will ALWAYS have your own special adventures, Fae." # speaker: Fae # expr: happy # pose: talk
And Dad whispered that I could tuck it right under my pillow so nobody would ever leave me out. # speaker: Fae # expr: happy # pose: sit
Mrrrow-purrrr! Maddie kneads the blanket gently and curls into a round orange cinnamon roll right beside the cover. # speaker: Maddie # expr: happy # pose: sit
Yep! That very first night, you were still a tiny kitten, and you curled up right next to the spine and purred me straight to sleep. # speaker: Fae # expr: happy # pose: talk
Look! Your tiny orange pawprint is still right here on the inside cover! # speaker: Fae # expr: surprised # pose: cheer
What should I doodle right next to Maddie's pawprint? # speaker: Fae # expr: happy # pose: sit
+ [Draw Maddie in a tiny star cape!]
    Fae sketches a swooping gold star cape around the pawprint. Maddie gives the page an approving sniff! # speaker: Fae # expr: happy # pose: cheer
+ [Draw a giant jar of honey biscuits!]
    Fae paints a cozy jar of crispy clover biscuits. Maddie's tail thumps twice against the rug! # speaker: Fae # expr: happy # pose: cheer
- ~ h2h_fae_maddie_done = true
Best co-captain in Cloverhollow. Let's keep filling every single page together, Maddie! # speaker: Fae # expr: determined # pose: cheer # sound: chime-yellow
Maddie nudges a shiny stash of saved pocket coins and two cozy snacks out from under the rug corner! # speaker: Maddie # expr: happy # pose: sit # gift: coins 10 # gift: snack 2
-> DONE

= replay
Fae flips back to page one of her journal, where Maddie's tiny kitten pawprint sits beside a fresh doodle. # speaker: Fae # expr: happy # pose: sit # zoom: 1.06
Mom and Dad's gift, and my very first teammate curled right beside it. Still my favorite page in the whole book. # speaker: Fae # expr: happy # pose: talk
Mrrrow-purrrr! Maddie bumps her forehead warmly against Fae's knee. # speaker: Maddie # expr: happy # pose: sit
-> DONE

// ---------------------------------------------------------------------------
// 2. Fae & Sue (Bubblegum Bay Dock): Sea-Glass Courage
// ---------------------------------------------------------------------------
=== h2h_fae_sue ===
{h2h_fae_sue_done: -> replay}
Fae and Sue sit side by side on the sun-warmed pier planks, dangling their boots above the pink ripples. # speaker: Fae # expr: happy # pose: sit # zoom: 1.08
You know what's funny, Fae? Folks at the bay think I've never been scared of a wave in my life. # speaker: Sue # expr: neutral # pose: sit
Wait, really? You look totally fearless out here on the dock! # speaker: Fae # expr: surprised # pose: talk
Ha! The very first summer we moved to Bubblegum Bay, the high tide rolled right over my sneakers and my knees turned to jellyfish! # speaker: Sue # expr: worried # pose: talk
I sat on the sand holding my fishing rod like it weighed a hundred pounds, too nervous to even cast. # speaker: Sue # expr: worried # pose: sit
Then I spotted a piece of frosted aqua sea glass shining right where the biggest wave had crashed. # speaker: Sue # expr: neutral # pose: talk
Sue pulls her smooth aqua sea-glass compass from her pocket and holds it up to the sunlight. # speaker: Fae # expr: happy # pose: sit
Rough storms tumbled all the sharp corners off this glass until it turned smooth enough to hold. # speaker: Sue # expr: happy # pose: talk
So I turned it into my compass! Being brave doesn't mean the waves stop looking huge. # speaker: Sue # expr: determined # pose: talk
It just means checking your steady needle and casting your line anyway. # speaker: Sue # expr: happy # pose: cheer
+ [Tell Sue I get nervous before big calm-downs too]
    Honestly, my hands shake a little every time a super fizzy critter bounces out of the bushes! # speaker: Fae # expr: worried # pose: talk
    See? Even Cloverhollow's bravest explorer gets tide-jitters! Good thing we've got each other's backs. # speaker: Sue # expr: happy # pose: cheer
+ [Ask Sue to teach me how to read the bay tide]
    Can you show me how you spot the calm current before the big waves roll in? # speaker: Fae # expr: happy # pose: talk
    Deal! First rule: watch the sea foam pause right before it turns pink. Second rule: always bring taffy! # speaker: Sue # expr: happy # pose: cheer
- ~ h2h_fae_sue_done = true
Here, Fae! Take my luckiest pocket Sea-Salt Taffy and twelve harbor coins for our adventure fund! # speaker: Sue # expr: happy # pose: cheer # gift: treat sea-salt-taffy 1 # gift: coins 12 # sound: chime-blue
Anytime the waves look loud, we'll face 'em together, crew captain! # speaker: Sue # expr: determined # pose: cheer
You bet, Sue! Best coastal teammate on the map! # speaker: Fae # expr: happy # pose: cheer
-> DONE

= replay
Fae and Sue swing their boots above the sparkling turquoise surf while Sue's sea-glass compass catches the sun. # speaker: Fae # expr: happy # pose: sit # zoom: 1.06
Steady needle, brave hearts, and salty bay breeze. Ready whenever you are, Fae! # speaker: Sue # expr: happy # pose: cheer
-> DONE

// ---------------------------------------------------------------------------
// 3. Fae & Jordan (Pinecone Pass Lookout): Catching Your Breath
// ---------------------------------------------------------------------------
=== h2h_fae_jordan ===
{h2h_fae_jordan_done: -> replay}
Snowflakes drift lazily past the wooden overlook as Jordan sets his heavy hiking pack down with a quiet sigh. # speaker: Fae # expr: neutral # pose: sit # zoom: 1.08
Whoa, hey Fae! Didn't hear your boots in the snow. Ready to blaze the next switchback? # speaker: Jordan # expr: surprised # pose: talk
Jordan, wait a second. You've been double-checking everyone's bootlaces and trail markers all morning! # speaker: Fae # expr: worried # pose: talk
Are YOUR feet tired? You never stop to take a break! # speaker: Fae # expr: worried # pose: sit
Jordan glances out over the frosted pines, then lets his shoulders drop a little. # speaker: Jordan # expr: worried # pose: sit
I guess... everybody up on Pinecone Pass counts on me to be the cheerful mountain guide who always knows the shortcut. # speaker: Jordan # expr: worried # pose: talk
When folks get nervous about snowy trails or fizzy critters, I figure if I keep grinning and carrying the extra rope, nobody else has to worry. # speaker: Jordan # expr: worried # pose: sit
Sometimes my pack gets kinda heavy, though. # speaker: Jordan # expr: neutral # pose: sit
+ [Offer to carry the trail map for a while]
    Hand me that map pouch right now, Jordan! On a real team, nobody has to be the strong one all by themselves. # speaker: Fae # expr: determined # pose: talk
    Haha... okay, fair point! You're pretty tough to argue with when you put your hands on your hips, Fae. # speaker: Jordan # expr: happy # pose: talk
+ [Sit quietly and watch the pine snow fall together]
    Let's just sit here for a minute and watch the snow sparkle on the pines. No shortcuts, no hurry. # speaker: Fae # expr: happy # pose: sit
    Whoa... I forgot how peaceful the mountain sounds when I'm not busy counting mileposts. Thanks, Fae. # speaker: Jordan # expr: happy # pose: sit
- ~ h2h_fae_jordan_done = true
You know what? Sharing the trail with you, Sue, and Maddie makes my pack feel half as heavy already. # speaker: Jordan # expr: happy # pose: cheer
Here, take my favorite Maple Brittle crunch and twelve trail coins from my guide pouch! # speaker: Jordan # expr: happy # pose: cheer # gift: treat maple-brittle 1 # gift: coins 12 # sound: chime-green
Deal! Anytime you need a breather, we stop for snow views and cocoa! # speaker: Fae # expr: happy # pose: cheer
-> DONE

= replay
Fae and Jordan lean back at the snowy overlook, watching pine needles glitter in the crisp mountain air. # speaker: Fae # expr: happy # pose: sit # zoom: 1.06
Best trail breather in Pinecone Pass. Whenever you're ready to roll, lead the way, Fae! # speaker: Jordan # expr: happy # pose: cheer
-> DONE

// ---------------------------------------------------------------------------
// 4. Sue & Jordan (Bon Appetit Cafe): Hot Cocoa vs. Sea-Salt Taffy!
// ---------------------------------------------------------------------------
=== h2h_sue_jordan ===
{h2h_sue_jordan_done: -> replay}
At a sunlit Bon Appetit Cafe table, Sue slaps a wax-paper taffy wrapper down right beside Jordan's steaming marshmallow cocoa. # speaker: Fae # expr: surprised # pose: sit # zoom: 1.08
Okay, Fae, settle this once and for all! Which snack is the TRUE champion of Cloverhollow exploration? # speaker: Sue # expr: determined # pose: talk
Obviously sea-salt taffy! Pocket-sized, chewy, ocean-fresh, and it NEVER spills when a bunny hops past! # speaker: Sue # expr: happy # pose: cheer
Hold EVERYTHING! Have you tried hot marshmallow cocoa after hiking three icy switchbacks?! # speaker: Jordan # expr: surprised # pose: talk
Cocoa warms your mittens, smells like cinnamon clouds, and gives you instant mountain pep! # speaker: Jordan # expr: determined # pose: cheer
Maddie hops onto the table corner, sniffs the cocoa steam, then bats a taffy wrapper with one fluffy paw. # speaker: Maddie # expr: happy # pose: sit
Both of them lean forward, waiting for Fae's official tie-breaking captain verdict! # speaker: Fae # expr: happy # pose: sit
+ [Vote Team Sea-Salt Taffy!]
    BOOM! Bubblegum Bay takes the trophy! Sorry, mountain boy, coastal snacks rule the map! # speaker: Sue # expr: happy # pose: cheer
    Alright, alright, I admit sea-salt taffy IS weirdly good on a long trail... as long as we save cocoa for sunset! # speaker: Jordan # expr: happy # pose: talk
+ [Vote Team Marshmallow Cocoa!]
    YES! Pinecone Pass mountain warmth wins the gold medal! You can't beat melty marshmallows! # speaker: Jordan # expr: happy # pose: cheer
    Okay fine, dipping my cold fingers around a warm mug after fishing DOES sound pretty cozy... # speaker: Sue # expr: happy # pose: talk
+ [Combine them: cocoa mug PLUS taffy pocket snack!]
    Why pick one? Sea-salt taffy keeps us zippy on the trail, and marshmallow cocoa warms us up at camp! # speaker: Fae # expr: happy # pose: cheer
    Wait a second... coast snack AND mountain mug? That's peak teamwork right there! # speaker: Sue # expr: surprised # pose: cheer
    I can't even argue with that! Coast, mountain, and Cloverhollow town: unstoppable combo! # speaker: Jordan # expr: happy # pose: cheer
- ~ h2h_sue_jordan_done = true
Sue and Jordan bump fists across the cafe table, both grinning from ear to ear. # speaker: Fae # expr: happy # pose: sit
To celebrate our official Coast-Meets-Mountain Snack Treaty, this Cozy Cocoa Sundae and twelve cafe coins are on us! # speaker: Jordan # expr: happy # pose: cheer # gift: treat cocoa-sundae 1 # gift: coins 12 # sound: chime-yellow
Best debate we've ever had! Next round of cinnamon buns is on me! # speaker: Sue # expr: happy # pose: cheer
-> DONE

= replay
Sue and Jordan clink a mug of marshmallow cocoa against a twist of sea-salt taffy at their favorite sunlit table. # speaker: Fae # expr: happy # pose: sit # zoom: 1.06
Coast-Meets-Mountain Snack Treaty still holding strong, Captain Fae! # speaker: Sue # expr: happy # pose: cheer
One hundred percent! Best cafe crew in Cloverhollow! # speaker: Jordan # expr: happy # pose: cheer
-> DONE

// ---------------------------------------------------------------------------
// 5. Full Party Trio + Maddie (Clubhouse): Snack Night Found Family
// Strictly obeys spec §1.2: NEVER names Milo before `milo_revealed`!
// ---------------------------------------------------------------------------
=== h2h_clubhouse_trio ===
{h2h_clubhouse_trio_done: -> replay}
Warm lantern light spills across the wooden floorboards of the Whispering Woods Clubhouse. # speaker: Fae # expr: happy # pose: sit # zoom: 1.08
{meals_cooked > 0: A fresh plate of crispy microwave dino snacks steams right in the middle of the rug!|A bowl of chilled clubhouse strawberries and trail biscuits sits right in the middle of the rug!} # speaker: Fae # expr: happy # pose: sit
Mrrrow-purrrr! Maddie curls up right in the warm center circle, eyes half-closed in total bliss. # speaker: Maddie # expr: happy # pose: sit
Can you believe this morning none of us even knew each other's favorite snacks, and now we've got our own secret clubhouse? # speaker: Sue # expr: happy # pose: talk
From the bay pier to the snowy ridge to a treehouse in the pines. Pretty awesome crew for one wild day! # speaker: Jordan # expr: happy # pose: cheer
{milo_revealed: -> post_reveal_reflection}
Sue nibbles a snack and looks thoughtfully toward the clubhouse window. # speaker: Sue # expr: worried # pose: sit
Hey, Fae... that kid in the purple hood we keep chasing. All those scribbled scores and spilled purple sodas... # speaker: Sue # expr: worried # pose: talk
Do you think they're actually trying to be mean? Or do you think they just wanted somebody to notice them? # speaker: Jordan # expr: worried # pose: talk
Fae traces the clover emblem on her journal cover, thinking about how lonely it feels to worry about being left out. # speaker: Fae # expr: neutral # pose: sit
I think when someone makes that much noise with purple fizz, maybe they just forgot how to ask to play. # speaker: Fae # expr: determined # pose: talk
When we finally catch up to the kid in the purple hood, I want to listen first. Really listen. # speaker: Fae # expr: determined # pose: talk
Count me in! We'll calm the fizz and save them a seat right here on the rug! # speaker: Sue # expr: happy # pose: cheer
Same here! Every kid in Cloverhollow deserves a crew like ours. # speaker: Jordan # expr: happy # pose: cheer
-> trio_toast

= post_reveal_reflection
Jordan chuckles and sets an extra cushion beside the snack plate. # speaker: Jordan # expr: happy # pose: sit
Still wild how much difference it made when we stopped chasing the purple hood and actually listened to Milo! # speaker: Jordan # expr: happy # pose: talk
Next clubhouse snack night, we're definitely saving that cushion for Milo and his comic sketchbook! # speaker: Sue # expr: happy # pose: cheer
And plenty of extra snacks so nobody ever feels left out of the fun! # speaker: Fae # expr: happy # pose: cheer
-> trio_toast

= trio_toast
How should we kick off Clubhouse Snack Night? # speaker: Fae # expr: happy # pose: sit
+ [Raise a toast to the Cloverhollow Crew!]
    To Fae, Sue, Jordan, and Maddie, found family from the town square to the mountain pines! # speaker: Fae # expr: happy # pose: cheer
    CHEERS! Maddie lifts one orange paw right into the middle of the huddle! # speaker: Sue # expr: happy # pose: cheer
+ [Slip Maddie the very crispest snack nibble!]
    Fae sneaks the warmest, crunchiest nibble right under Maddie's whiskers. Instant turbo-purr! # speaker: Fae # expr: happy # pose: sit
    Haha, look at that purr! Official clubhouse mascot approved! # speaker: Jordan # expr: happy # pose: cheer
- ~ h2h_clubhouse_trio_done = true
We pooled our clubhouse snack jar for the road ahead: Sunberry Nectar, two cozy snacks, and fifteen shiny coins! # speaker: Jordan # expr: happy # pose: cheer # gift: treat sunberry-nectar 1 # gift: snack 2 # gift: coins 15 # sound: chime-red
Whatever adventure comes next, we're taking it on together! # speaker: Fae # expr: determined # pose: cheer
-> DONE

= replay
The clubhouse rug glows with warm lantern light while Fae, Sue, Jordan, and Maddie share snacks and trade trail stories. # speaker: Fae # expr: happy # pose: sit # zoom: 1.06
Best found family in Cloverhollow, and our clubhouse door is always open! # speaker: Sue # expr: happy # pose: cheer
-> DONE

// ---------------------------------------------------------------------------
// 6. Post-Finale Heart-to-Heart (Wildlife Sanctuary): Wildest Dream Moments
// Unlocks ONLY after `milo_revealed` is true (spec §1.2 compliant!).
// ---------------------------------------------------------------------------
=== h2h_sanctuary_encore ===
{h2h_sanctuary_encore_done: -> replay}
Beneath the sunlit alpine sky of the Wildlife Sanctuary, Fae, Maddie, Sue, Jordan, and Milo gather in a ring of clover. # speaker: Fae # expr: happy # pose: sit # zoom: 1.08
Okay, I have to ask now that the purple fizz is totally gone... # speaker: Sue # expr: happy # pose: talk
Milo, how on EARTH did you sprint from the school hallway to Pinecone Pass faster than Buster's Star-Line Bus?! # speaker: Sue # expr: surprised # pose: cheer
Milo hides his face behind his sketchbook, laughing so hard his shoulders shake. # speaker: Milo # expr: happy # pose: sit
Honestly?! My sneakers were SO tired! That pond fizz gave me rocket legs, and I tripped into a snowdrift twice behind the lodge! # speaker: Milo # expr: surprised # pose: talk
NO WAY! I thought those big snow tracks were a giant mountain yeti! # speaker: Jordan # expr: surprised # pose: cheer
And remember when the plaza fountain blew pink bubblegum bubbles bigger than my backpack?! # speaker: Fae # expr: happy # pose: cheer
Or when Coach Ash's clipboard got stuck on top of the basketball hoop and Fae lassoed it on the first swirl?! # speaker: Jordan # expr: happy # pose: cheer
Mrrrow! Maddie does a proud little somersault in the clover, making everyone burst out laughing. # speaker: Maddie # expr: happy # pose: cheer
Milo sets his sketchbook down and smiles warmly at the whole circle. # speaker: Milo # expr: happy # pose: sit
Hey... seriously, though. Thank you guys for not giving up on me under the Ancient Tree. # speaker: Milo # expr: happy # pose: talk
Trying to be the best all by myself was lonely. Hanging out with you four beats any high score in town. # speaker: Milo # expr: happy # pose: sit
What was YOUR favorite moment of our whole crazy adventure, Fae? # speaker: Milo # expr: happy # pose: talk
+ [Calming the bubblegum Fountain Frog in the plaza!]
    That very first frog blowing giant pink bubbles started everything, and showed us kindness beats chaos! # speaker: Fae # expr: happy # pose: cheer
    Classic day-one hero energy! Maddie was already ready to rumble! # speaker: Sue # expr: happy # pose: cheer
+ [Meeting Sue by the bay and Jordan on the pass!]
    Finding my crew across Bubblegum Bay and Pinecone Pass turned a scary mystery into the best trip ever! # speaker: Fae # expr: happy # pose: cheer
    Aww, stop it, you're gonna make my sea-glass compass fog up! # speaker: Sue # expr: happy # pose: talk
    Best team I've ever hiked with, hands down! # speaker: Jordan # expr: happy # pose: cheer
+ [Reaching Milo under the Ancient Tree!]
    Painting the scribbles back and hearing your real story under the Ancient Tree, that's the page I'll never forget. # speaker: Fae # expr: happy # pose: sit
    Thanks, Fae. Next time I want to draw something huge, I'm asking you to paint the background with me! # speaker: Milo # expr: happy # pose: cheer
- ~ h2h_sanctuary_encore_done = true
We all chipped in a grand Sanctuary Adventure Memory Pouch for you: twenty-five coins and glowing Sunberry Nectar! # speaker: Milo # expr: happy # pose: cheer # gift: coins 25 # gift: treat sunberry-nectar 1 # sound: chime-red
Every critter in the meadow chirps and purrs in harmony as the breeze sweeps across Sunny Cloverhollow! # speaker: Fae # expr: happy # pose: cheer
-> DONE

= replay
Fae, Maddie, Sue, Jordan, and Milo swap stories in the sunny sanctuary clover while calm critters nap all around them. # speaker: Fae # expr: happy # pose: sit # zoom: 1.06
Best dream adventure, and best friends, in all of Cloverhollow! # speaker: Milo # expr: happy # pose: cheer
-> DONE
