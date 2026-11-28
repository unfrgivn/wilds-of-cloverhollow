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
{awake: -> milo_calm.morning_journal}
My journal, right under my pillow where it belongs. # speaker: Fae
{
- plan == "now": Note to self: fizzing fountain. Go look NOW. # speaker: Fae
- plan == "later": Note to self: fizzing fountain. Check after school. # speaker: Fae
- else: Mom and Dad gave it to me when Oliver was born. # speaker: Fae
}
-> DONE

=== desk ===
{awake: -> milo_calm.morning_desk}
{My sketchbook! I drew Maddie as a dragon yesterday.|Paints, pencils, and one very chewed eraser.} # speaker: Fae
-> DONE

=== cat_bed ===
{awake: -> milo_calm.morning_cat_bed}
Maddie's bed. Still warm, and full of orange fur. # speaker: Fae
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
- plan == "now": A kid in a purple hood? I bet that's who did it. # speaker: Fae
- else: A kid in a purple hood, fizzing up the fountain? Weird. # speaker: Fae
}
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
{awake: -> milo_calm.morning_breakfast}
Three plates, three cups, and a tiny spoon for Oliver. Breakfast is almost ready. # speaker: Fae
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
A big bowl of pancake batter and a whole mountain of blueberries. Yum. # speaker: Fae
-> DONE

=== oliver ===
{awake: -> milo_calm.morning_oliver}
{
- milo_revealed:
    Oliver claps both chubby hands at Maddie and beams up at Fae. "Ba! Yay!" # speaker: Oliver
    Mom laughs warmly from the kitchen. "Even Oliver can tell the valley is calm again!" # speaker: Mom
- buster_reward:
    Oliver spots Fae's shiny Golden Whistle and giggles. "Ba! Star!" # speaker: Oliver
    Mom laughs from the kitchen. # speaker: Mom
- else:
    Oliver shakes his rattle. "Ba!" # speaker: Oliver
    Mom laughs from the kitchen. # speaker: Mom
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
A picnic with sandwiches, lemonade, and a basket of berries. # speaker: Fae
Somebody ate every single berry... and left purple paw prints! # speaker: Fae
-> DONE

=== bay_road_closed ===
The east road goes to Bubblegum Bay! # speaker: Fae
But I want to follow the hooded kid's trail first. # speaker: Fae
-> DONE

=== park_sign ===
MEADOW PARK. Please keep your pets on the path! # speaker: Sign
{not calmed("pup"): Somebody's pet is barking by the pond. # speaker: Fae}
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
