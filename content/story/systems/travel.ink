=== bus_stop ===
{not (visited_bay or sue_joined) and not (visited_pass or rode_bus):
    The Star-Line bus connects Cloverhollow to faraway towns, once I've walked the trail there and found their bus stop! # speaker: Fae
    {club_open: Maybe I should head down the east road past the plaza to find Bubblegum Bay first. # speaker: Fae}
    -> DONE
}
The bus is here! Where to? # speaker: Fae
+ {visited_pass or rode_bus} [Pinecone Pass!]
    ~ rode_bus = true
    Up we go! # speaker: Fae # travel: pass.bus
    -> DONE
+ {visited_bay or sue_joined} [Bubblegum Bay!]
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
+ {visited_pass or rode_bus} [Pinecone Pass!]
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
+ {visited_bay or sue_joined} [Bubblegum Bay!]
    Down to the beach! # speaker: Fae # travel: bay.bus-stop
    -> DONE
+ [Not yet.]
    Not yet. I want to look around a little more. # speaker: Fae
     -> DONE

=== arrive_hills ===
~ visited_hills = true
-> DONE

=== arrive_bay ===
~ visited_bay = true
-> DONE

=== arrive_pass ===
~ visited_pass = true
-> DONE

=== lane_signpost ===
SUNBERRY LANE. West: Cloverhollow Town Square. East: Willowbrook Crossing & Bubblegum Bay. # speaker: Sign
-> DONE

=== lane_bench ===
A sunny wooden bench right beside the clover meadow. Perfect for catching my breath and listening to the bees! # speaker: Fae
-> DONE

=== lane_berries ===
Wild sunberries! They're warm from the afternoon sun and smell a little bit like strawberry jam. # speaker: Fae
-> DONE

=== crossing_signpost ===
WILLOWBROOK CROSSING. West: Sunberry Lane. East: Salt-Marsh Boardwalk to Bubblegum Bay. # speaker: Sign
-> DONE

=== crossing_bench ===
From this bench under the weeping willows, I can watch sparkles race under the wooden bridge. # speaker: Fae
-> DONE

=== boardwalk_signpost ===
SALT-MARSH BOARDWALK. Watch your step over the tide pools, and smell the sea breeze! East: Bubblegum Bay. # speaker: Sign
-> DONE

=== boardwalk_bench ===
Ooh, I can smell salt air and bubblegum-pink waves from here! Bubblegum Bay must be right around the bend. # speaker: Fae
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
