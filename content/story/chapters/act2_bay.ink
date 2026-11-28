=== sue ===
Whoa, hi! Careful, these planks are a little wobbly. # speaker: Sue # expr: happy
I'm Sue! I fish this dock rain or shine, only today the bay fish are doing \{wave\}fizzy backflips\{/wave\}! # speaker: Sue # expr: determined
And that dramatic bluebird keeps kick-flipping sand straight into my favorite bait bucket. # speaker: Sue # expr: worried
Hold on... \{color:lavender\}purple fizz\{/color\}? Did a kid in a purple hood tear through here too?! # speaker: Sue # expr: surprised
* [Yes! I'm following their trail.]
    Hah, I KNEW it! Grab your gear, captain, count me and my lucky rod in! # speaker: Sue # expr: happy # pose: sue cheer
* [I think so. Want to help me find out?]
    Are you kidding? Of course! Let me grab my rod. # speaker: Sue # expr: happy # pose: sue cheer
 - ~ sue_joined = true
-> DONE

=== bluebird_calm ===
{bluebird_calm > 1: -> again}
Chirp! Thank you, Fae. My feathers finally stopped buzzing like a seaside kazoo! # speaker: Bay Bluebird # expr: happy
That kid in the purple hood zipped right up the trail toward the snowy mountains! # speaker: Bay Bluebird # expr: determined
-> DONE

= again
Chirp-chirp! Smooth tides, zero sand in Sue's bait bucket. The bay feels sunny again! # speaker: Bay Bluebird # expr: happy
-> DONE

=== gull_calm ===
{gull_calm > 1: -> again}
Squawk! Listen, I am deeply embarrassed about the great sandwich heist. I couldn't stop myself! # speaker: Lookout Gull # expr: worried
A kid in a purple hood tossed me a fizzy cracker, and suddenly my brain yelled "ACQUIRE ALL SNACKS!" # speaker: Lookout Gull # expr: surprised
A fizzy cracker? Everywhere that hooded kid sprints, the whole valley gets turned up to eleven. # speaker: Fae # expr: determined
-> DONE
= again
Strict lookout duty from now on. Zero unauthorized picnic raids, scout's honor! # speaker: Lookout Gull # expr: happy
-> DONE

=== crab_calm ===
{crab_calm > 1: -> again}
Click-click! Thank you, small friend. My claws feel calm as the tide. # speaker: Sandy Crab
A kid in a purple hood rolled me a fizzy bottle, and naturally I snip-snipped the cap clean off! # speaker: Sandy Crab # expr: surprised
Next thing I knew, bubbles went straight to my shell and I was challenging driftwoods to a snip-off! # speaker: Sandy Crab # expr: happy
-> DONE
= again
The south tide pools have the finest afternoon foam. Polite snips only! Click! # speaker: Sandy Crab # expr: happy
-> DONE

=== beach_frog_calm ===
{beach_frog_calm > 1: -> again}
Ribbit! Cool sand between my toes and zero soda bubbles in my tide pool. Five stars, Fae! # speaker: Beach Frog # expr: happy
-> DONE
= again
Ribbit! The frog lounges in a shallow tide pool like a tiny green tourist on vacation. # speaker: Beach Frog # expr: happy
-> DONE

=== bay_sign ===
BUBBLEGUM BAY. Fishing, splashing, and ambitious sandcastles welcome! (Seagull snack treaties remain strictly unenforced.) # speaker: Sign
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
Pastel pink and cream shells! When Fae holds one to Maddie's ear, Maddie blinks solemnly at the tiny ocean roar inside. # speaker: Fae # expr: happy
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

=== bay_souvenirs ===
{
- buster_reward and bay_boat_charm:
    Spotted your pastel rowboat and lucky sea-glass clover out on the bay, Fae! Ready for fresh taffy? # speaker: Bay keeper
- buster_reward:
    Hey, Buster's Golden Star-Line Whistle! Welcome back to the seaside stand, Star-Line Explorer! # speaker: Bay keeper
- else:
    Welcome to the Bubblegum Bay seaside stand! Fresh pastel Sea-Salt Taffy and sunny bay keepsakes! # speaker: Bay keeper
}
{buster_quest and not stamp_bay:
    ~ stamp_bay = true
    A Star-Line Stamp Card from Buster? Stamp! One shiny Bubblegum Bay wave stamp, all yours! # speaker: Bay keeper # sound: chime-blue
}
~ temp ready_fish = fishCount()
{coins() < 9 and ready_fish == 0:
    Sea-Salt Taffy is 9 coins a bag. Come back whenever your pockets jingle! # speaker: Bay keeper
    -> DONE
}
+ {coins() >= 9} [Buy Sea-Salt Taffy (9 coins)]
    One pastel bag of chewy Sea-Salt Taffy! Beach and cavern critters adore it! # speaker: Bay keeper # buy-treat: sea-salt-taffy 9
+ {ready_fish > 0} [Trade a bay catch for 12 Arcade Tickets ({ready_fish} ready)]
    Ooh, what a shiny Bubblegum Bay catch! Here are twelve crisp arcade tickets for your trip back to town! # speaker: Bay keeper # trade-fish: tickets 12 # sound: chime-blue
+ {ready_fish > 0} [Trade a bay catch for 14 Coins ({ready_fish} ready)]
    A fresh bay treasure! Here are fourteen shiny coins for your purse! # speaker: Bay keeper # trade-fish: coins 14 # sound: chime-yellow
+ [Not now]
    Enjoy the ocean breeze, Fae! Stop by anytime! # speaker: Bay keeper
- -> DONE

=== bay_boats ===
Pastel wooden rowboats bob gently beside the south pier, ready for a sunny harbor ride! # speaker: Fae
A painted harbor tag says: "Free community boats - just bring the oars back tidy!" # speaker: Fae
+ [Take a row out to the sunny cove]
    -> cruise
+ {sue_joined} [Row out to Starlight Island!]
    All aboard! Fae and the crew dip the oars and glide across Bubblegum Bay toward Starlight Island! # speaker: Fae # sound: chime-blue # travel: island.pier
    -> DONE
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

=== island_boat ===
Our pastel wooden rowboat bobs gently beside Starlight Island's sunny landing pier, oars tucked neatly inside. # speaker: Fae
+ [Row back to Bubblegum Bay]
    Oars in! Fae and the crew glide across the sparkling waves back to Bubblegum Bay! # speaker: Fae # sound: chime-blue # travel: bay.boats
    -> DONE
+ [Stay on Starlight Island]
    Let's enjoy the island breeze a little longer! # speaker: Fae
    -> DONE

=== island_shells ===
Four giant pastel seashells curve around the sparkling tide pool, humming softly in the sea breeze from left to right: Coral-Red, Butter-Yellow, Mint-Green, and Sky-Blue! # speaker: Fae
{island_shells_solved: -> replay_menu}
-> puzzle_menu
= puzzle_menu
+ [Tap the shells from left to right: Red, Yellow, Green, Blue!]
    ~ island_shells_solved = true
    Ding! The Coral-Red shell rings out with a warm, rosy chime! # speaker: Fae # sound: chime-red
    Ting! The Butter-Yellow shell answers with a bright, sunny note! # speaker: Fae # sound: chime-yellow
    Ring! The Mint-Green shell joins in like sparkling sea foam! # speaker: Fae # sound: chime-green
    Bong! The Sky-Blue shell crowns the melody in shimmering ocean harmony! # speaker: Fae # sound: chime-blue
    {has_flute: Fae lifts her silver flute and weaves a shimmering fifth harmony note right over the four shells, making the whole tide pool sparkle! # speaker: Fae}
    {sue_joined: Whoa, listen to that tide-pool chorus! Every shell on the bay is humming along! # speaker: Sue}
    Bubbles dance up from the clear water... revealing a sparkling Tide-Pool Pearl Cache tucked with twenty shiny coins! # speaker: Fae # gift: coins 20
    -> DONE
+ [Tap a playful random chord]
    Boing-plink-bonk! The giant shells giggle back with a silly jazzy wobble! # speaker: Fae # sound: chime-yellow
    {jordan_joined: Haha, free-form seashell jazz! Try tapping them straight from left to right, Fae! # speaker: Jordan|Haha, silly seashell jazz! Let's try tapping them from left to right! # speaker: Fae}
    -> puzzle_menu
+ [Just listen to the waves]
    The tide pool laps gently against the four pastel shells. # speaker: Fae
    -> DONE
= replay_menu
+ [Play the four-note seashell harmony again]
    Ding! Coral-Red rings warm and bright! # speaker: Fae # sound: chime-red
    Ting! Butter-Yellow sparkles across the water! # speaker: Fae # sound: chime-yellow
    Ring! Mint-Green hums with the ocean breeze! # speaker: Fae # sound: chime-green
    Bong! Sky-Blue finishes the soothing tide-pool chord! # speaker: Fae # sound: chime-blue
    {has_flute: Fae's flute floats a gentle silver harmony above the waves. # speaker: Fae}
    -> DONE
+ [Just listen to the waves]
    The four pastel shells hum peacefully beside the sparkling tide pool. # speaker: Fae
    -> DONE

=== island_lighthouse ===
~ island_visited = true
A warm brass plaque gleams beside the arched wooden door of the coral-striped Tide-Pool Lighthouse: "Guiding Bubblegum Bay's boats safely home since the first sunny tide." # speaker: Fae
{not island_lighthouse_checked:
    ~ island_lighthouse_checked = true
    Look, tucked right on the sunlit threshold is a ribbon-tied Lighthouse Sea-Breeze Snack Tin from the harbor keeper! # speaker: Fae # gift: snack 2 # sound: chime-yellow
    {sue_joined: Sweet! Two fresh sea-breeze snacks for the crew—this lighthouse keeper thinks of everything! # speaker: Sue}
    -> DONE
}
{has_lantern: A tiny sea-star etched at the bottom of the brass plaque hints that sea-fairy starlight runes shimmer along the clover meadow rise under a violet lantern! # speaker: Fae|The brass lantern high overhead glows warmly across the turquoise waves of Bubblegum Bay. # speaker: Fae}
-> DONE

=== island_bottle ===
{island_bottle_found: -> again}
~ island_bottle_found = true
Resting in the warm sand beside the driftwood log is a corked sea-glass bottle with a rolled cream letter inside! # speaker: Fae
Fae pops the cork and unrolls the sunlit harbor note: "Fair winds and bright skies to whoever discovers Starlight Island! — An old Bubblegum Bay explorer." # speaker: Fae
Clink! Fifteen shiny bay coins slide right out from the folded parchment! # speaker: Fae # gift: coins 15 # sound: chime-green
{jordan_joined: A real message in a bottle! Now this officially counts as a legendary island expedition! # speaker: Jordan}
-> DONE
= again
Fae tucked the old Bubblegum Bay explorer's sunlit note safely back inside the sea-glass bottle beside the driftwood log. # speaker: Fae
-> DONE

=== island_beacon_glow ===
{island_glow_read: -> again}
~ island_glow_read = true
Under Jordan's blacklight lantern, bioluminescent sea-fairy starlight runes blossom across the clover meadow rise! # speaker: Fae
"STARLIGHT BEACON VERSE: As long as the coral tower shines above the tide pool, every friend on Bubblegum Bay finds a warm harbor!" # speaker: Glow Note
Ooh! Ten moonlit coins shimmer right beside the glowing bluebell runes! # speaker: Fae # sound: chime-red # gift: coins 10
-> DONE
= again
The bioluminescent Starlight Beacon Verse shimmers softly across the meadow: "As long as the coral tower shines above the tide pool, every friend on Bubblegum Bay finds a warm harbor!" # speaker: Fae
-> DONE

// Elevation Track E10: Milo Foreshadowing Beat 3 (Bubblegum Bay / East Road).
// Strict §1.2 secrecy: ZERO Milo name! Only a glowing rocket doodle inside a crumpled wrapper.
=== milo_foreshadow_bay ===
~ milo_beat_bay = true
Half-buried beside the pastel tide shells glints a bent \{color:lavender\}purple-fizz bottlecap\{/color\} tucked inside a crumpled wrapper. # speaker: Fae # expr: surprised # zoom: 1.09
Fae smooths the damp paper open carefully. There's something faint sketched along the inside fold! # speaker: Fae # expr: determined
{has_lantern: Under the blacklight lantern's soft violet glow, a tiny hand-drawn \{color:gold\}rocket\{/color\} and three crooked stars shimmer to life beside a scratched-out word!|Catching the bright coastal sunlight, faint lilac ink reveals a tiny hand-drawn \{color:gold\}rocket\{/color\} and three stars beside a scratched-out word!} # speaker: Fae # expr: surprised # sound: chime-blue
{sue_joined: Whoa, let me see! A rocket doodle? Whoever dropped this doesn't draw like a villain, they draw like a kid from school! # speaker: Sue # expr: surprised}
Mrrrow? Maddie pats the shiny bottlecap gently with one velvet paw and tilts her ears. # speaker: Maddie # expr: worried # pose: maddie sit
\{whisper\}Why would somebody scribble out their own little rocket like that...\{/whisper\} I'm saving this clue in my journal. # speaker: Fae # expr: worried
-> DONE

// Elevation Track E10: Empathetic Mini-Boss Pre-Battle Stress Vignette 4 (Ms. Coral).
=== vignette_ms_coral ===
~ vignette_coral_seen = true
Three runaway beach balls! A flock of gulls staging an organized watermelon heist! And sunscreen straight in my left eyebrow! # speaker: Ms. Coral # expr: worried # zoom: 1.08
Nineteen kiddos cannonballing at the same second, and I haven't had one quiet breath since sunrise! # speaker: Ms. Coral # expr: determined
\{shake\}TWEEEEET!\{/shake\} Wait, why does that purple soda make my whistle feel ten times louder?! NOBODY EVEN LOOKS AT THE TIDE! # speaker: Ms. Coral # expr: surprised # sound: chime-red
Maddie puffs her orange tail to twice its normal width at the shrill whistle blast. # speaker: Maddie # expr: surprised
Aw, Ms. Coral works nonstop keeping the whole beach safe! That fizzy drink just cranked her lifeguard worries up to tidal-wave volume! # speaker: Fae # expr: worried
{sue_joined: Hang in there, Ms. Coral! We'll catch every runaway beach ball until the bay feels sunny again! # speaker: Sue # expr: determined}
{not sue_joined: Don't worry, Ms. Coral! We'll help you catch your breath and save the picnic! # speaker: Fae # expr: determined}
-> DONE
