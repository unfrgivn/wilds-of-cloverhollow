VAR plan = "none"
VAR ate_breakfast = false
VAR read_notice = false
EXTERNAL calmed(id)

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
Has anyone seen a raccoon in a purple hood? # speaker: Notice board
{
- plan == "now": A raccoon in a hood? I bet that's who did it. # speaker: Fae
- else: A raccoon... in a hood? Weird. # speaker: Fae
}
-> DONE

=== journal ===
{calmed("pup"): The Pond Pup is calm. A raccoon paw print points toward the school. # speaker: Fae}
{calmed("frog") and not calmed("pup"): Purple fizz drips lead out of the plaza to Meadow Park. # speaker: Fae}
{calmed("frog"): The Fountain Frog is calm. Something purple fizzed into his fountain. # speaker: Fae}
{read_notice: A raccoon in a purple hood was seen in town. # speaker: Fae}
{plan == "now": Go see why the fountain is fizzing! # speaker: Fae}
{plan == "later": Check the fizzing fountain after school. # speaker: Fae}
-> DONE

=== fountain ===
{calmed("frog"):
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
And there's a tiny paw print on it... a raccoon paw print! # speaker: Fae
Woof! # speaker: Pond Pup
He's pointing his nose at the road to school. # speaker: Fae
-> DONE

= again
Woof! The Pond Pup wants to play fetch. # speaker: Pond Pup
-> DONE

=== tree_house ===
A tree house with a round door and a little sign: CLUB MEMBERS ONLY. # speaker: Fae
I wonder what the password is. # speaker: Fae
-> DONE

=== picnic ===
A picnic with sandwiches, lemonade, and a basket of berries. # speaker: Fae
Somebody ate every single berry... and left purple paw prints! # speaker: Fae
-> DONE

=== park_sign ===
MEADOW PARK. Please keep your pets on the path! # speaker: Sign
{not calmed("pup"): Somebody's pet is barking by the pond. # speaker: Fae}
-> DONE
