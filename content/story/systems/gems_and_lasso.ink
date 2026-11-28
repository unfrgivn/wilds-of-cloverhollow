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

=== hills_lookout ===
{lookout_cache_found: The lookout is quiet and sunny. The Acorn Squirrel has already found the little cache. # speaker: Fae}
{not squirrel_with_me: The lookout is quiet and sunny. A few wildflowers nod in the breeze. # speaker: Fae}
{not squirrel_with_me: -> DONE}
The Acorn Squirrel scampers behind a stone and returns with a tiny tin. # speaker: Fae
~ lookout_cache_found = true
The lookout cache has two sweet treats! # speaker: Fae # gift: snack 2
-> DONE

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
{calmed("lodge-keeper"): -> lift_ride}
The ski lift creaks along its cable, the empty chairs swinging. # speaker: Fae
-> DONE
= lift_ride
The Pinecone Pass ski lift hums smoothly along its cable, carrying sunny red chairs right up to Alpine Summit Overlook! # speaker: Fae
+ [Ride up to Alpine Summit!]
    Hold onto your hats—we're gliding above the treetops! # speaker: Jordan # sound: chime-blue # travel: summit.lift-top
    -> DONE
+ [Stay at Pinecone Pass]
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
