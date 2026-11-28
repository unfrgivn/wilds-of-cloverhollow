=== pup_calm ===
{pup_calm > 1: -> again}
Woof! Woof! The pup flops down and wags his whole body. # speaker: Pond Pup
He drops a soggy tennis ball at my feet. It's all purple and fizzy. # speaker: Fae
And there's a purple thread stuck to it... from a purple hood! # speaker: Fae
Woof! # speaker: Pond Pup
He's pointing his nose at the road to school. # speaker: Fae
-> DONE

= again
{pup_friend: -> friend}
Woof! The Pond Pup wants to play fetch. # speaker: Pond Pup
{has_flute: -> bond}
-> DONE
// A pat and a treat make a friend (NOTES.md), in either order.
= bond
+ {not pup_petted} [Pet him]
    ~ pup_petted = true
    Fae scratches behind his floppy ears. His back leg thumps the ground. # speaker: Fae
+ {not pup_fed} [Share a snack]
    {snacks() == 0:
        I'm out of snacks. The bakery sells them, and the clubhouse garden grows strawberries. # speaker: Fae
        -> DONE
    }
    ~ pup_fed = true
    Fae shares a snack. Crunch, crunch, gone! He licks her nose. # speaker: Fae # feed: snack 1
+ [Wave bye]
    Woof! # speaker: Pond Pup
    -> DONE
- {pup_petted and pup_fed: -> befriend}
-> bond
= befriend
~ pup_friend = true
The Pond Pup's tail wags so hard that his whole body wiggles. # speaker: Fae
He's my friend now! When I play my flute, he'll come running. # speaker: Fae
-> DONE
= friend
Woof! This pup wags at me like we're old friends. Word gets around! # speaker: Fae
-> DONE

=== bunny_calm ===
{bunny_calm > 1: -> again}
Thank you! I was hopping in circles all morning. # speaker: Ribbon Bunny
A kid in a purple hood zipped by, and everything went all fizzy! # speaker: Ribbon Bunny
That hooded kid again! # speaker: Fae
-> DONE
= again
{bunny_friend: -> friend}
The clover up here is extra sweet. Want some? # speaker: Ribbon Bunny
{has_flute: -> bond}
-> DONE
// Smoothing her ribbon and sharing a snack make a friend (Milestone 80), in either order.
= bond
+ {not bunny_petted} [Smooth her ribbon]
    ~ bunny_petted = true
    Fae gently smooths the silky ribbon between her ears. Her nose gives a happy twitch! # speaker: Fae
+ {not bunny_fed} [Share a snack]
    {snacks() == 0:
        I'm out of snacks. The bakery sells them, and the clubhouse garden grows strawberries. # speaker: Fae
        -> DONE
    }
    ~ bunny_fed = true
    Fae shares a snack. She nibbles it happily with her ears bobbing! # speaker: Fae # feed: snack 1
+ [Wave bye]
    Hop, hop! # speaker: Ribbon Bunny
    -> DONE
- {bunny_petted and bunny_fed: -> befriend}
-> bond
= befriend
~ bunny_friend = true
Ribbon Bunny does a happy twirl around Fae's boots, her ribbon fluttering! # speaker: Fae
She's my friend now! When I play my flute, she'll come hopping right over. # speaker: Fae
-> DONE
= friend
Hop, hop! Ribbon Bunny wiggles her nose at me like we're old friends! # speaker: Fae
-> DONE

=== squirrel_calm ===
{squirrel_calm > 1: -> again}
Phew! Sorry about all the acorns. # speaker: Acorn Squirrel
A kid in a purple hood traded me a shiny bottle cap for my best acorn. # speaker: Acorn Squirrel
Then, fizz! I couldn't stop throwing things. # speaker: Acorn Squirrel
-> DONE
= again
{squirrel_friend: -> friend}
I'm saving my acorns for winter now. Nobody gets bonked! # speaker: Acorn Squirrel
{has_flute: -> bond}
-> DONE
// A chin scratch and a treat make a friend (Milestone 60), in either order.
= bond
+ {not squirrel_petted} [Scratch his chin]
    ~ squirrel_petted = true
    Fae scratches under his chin. His eyes go all squinty and happy. # speaker: Fae
+ {not squirrel_fed} [Share a snack]
    {snacks() == 0:
        I'm out of snacks. The bakery sells them, and the clubhouse garden grows strawberries. # speaker: Fae
        -> DONE
    }
    ~ squirrel_fed = true
    Fae shares a snack. He stuffs it all in his cheeks at once! # speaker: Fae # feed: snack 1
+ [Wave bye]
    Chitter! # speaker: Acorn Squirrel
    -> DONE
- {squirrel_petted and squirrel_fed: -> befriend}
-> bond
= befriend
~ squirrel_friend = true
The Acorn Squirrel hops right up onto Fae's shoe and chitters. # speaker: Fae
He's my friend now! When I play my flute, he'll come scampering. # speaker: Fae
-> DONE
= friend
Chitter! This squirrel flicks his tail at me like we're old friends. Word gets around! # speaker: Fae
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
