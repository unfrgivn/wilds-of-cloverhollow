=== arcade_closed ===
The arcade's door is locked. A sign says BACK SOON! # speaker: Fae
Beeps and boops are coming from inside... # speaker: Fae
-> DONE

=== arcade_keeper ===
{arcade_keeper > 1: -> again}
Whoa... what happened? My head was all fizzy, like a shaken-up soda! # speaker: Mr. Pip
A kid in a purple hood played every game in here this morning. # speaker: Mr. Pip
They gave me a purple fizzy soda to say thanks. One sip, and all I wanted was the high score! # speaker: Mr. Pip
So the fizz works on people too... # speaker: Fae
That kid set a new record on Star Racer, then scribbled out their initials in purple marker. Sneaky! # speaker: Mr. Pip
Thank you, Fae. You and your friends can play here any time. # speaker: Mr. Pip
-> DONE

= again
Mr. Pip polishes the claw machine. "Come back and play any time!" # speaker: Mr. Pip
-> DONE

=== claw_machine ===
{not calmed("arcade-keeper"):
    The machine is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
{plushesLeft() == 0:
    The claw machine is empty. I won every plush! # speaker: Fae
    -> DONE
}
{won("raccoon-plush"):
    That smug raccoon plush is all mine now. Ha! # speaker: Fae
- else:
    {plushesLeft() == 1:
        Just one plush left, and it's the very smug raccoon. # speaker: Fae
    - else:
        A claw machine full of plush critters, and one very smug raccoon. # speaker: Fae
    }
    Someday I'm going to win that raccoon. # speaker: Fae
}
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: claw 2
    Hold tight! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

=== skee_ball ===
{not calmed("arcade-keeper"):
    The skee-ball lane is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
A skee-ball lane! Roll the balls into the rings for tickets. # speaker: Fae
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: skee 2
    Here goes! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

=== boop_a_mole ===
{not calmed("arcade-keeper"):
    The Boop-a-Mole cabinet is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
Boop-a-Mole! Little moles pop up, and you boop their noses. Gently! # speaker: Fae
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: mole 2
    Boop time! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

=== comet_cruise ===
{not calmed("arcade-keeper"):
    The Comet Cruise cabinet is all fizzy with purple scribbles. # speaker: Fae
    I'd better calm Mr. Pip first. # speaker: Fae
    -> DONE
}
Comet Cruise! Steer the little rocket, catch the stars, and slip past the space rocks. # speaker: Fae
{coins() < 2:
    I need 2 coins to play. # speaker: Fae
    -> DONE
}
+ [Play for 2 coins] # play: comet 2
    Blast off! # speaker: Fae
    -> DONE
+ [Not now]
    Maybe another time. # speaker: Fae
    -> DONE
-> DONE

// Mr. Pip runs the ticket counter once he's calm (Milestone 45): each prize
// is offered while Fae can pay for it and hasn't won it.
=== ticket_counter ===
{not calmed("arcade-keeper"):
    Jars of candy, a ring toss prize, and a big roll of orange tickets behind the counter. # speaker: Fae
    -> DONE
}
~ temp all_prizes = won("pinwheel") and won("bouncy-ball") and won("toy-rocket") and won("star-racer-keychain")
~ temp can_buy_tickets = coins() >= 25
{all_prizes and not can_buy_tickets:
    You've won every prize on my counter. You're an arcade champ! # speaker: Mr. Pip
    -> DONE
}
~ temp pinwheel = not won("pinwheel") and tickets() >= 20
~ temp ball = not won("bouncy-ball") and tickets() >= 30
~ temp rocket = not won("toy-rocket") and tickets() >= 50
~ temp keychain = not won("star-racer-keychain") and tickets() >= 80
{not (pinwheel or ball or rocket or keychain or can_buy_tickets):
    You have {tickets()} tickets. Skee-ball pays more! # speaker: Mr. Pip
    -> DONE
}
{all_prizes:
    You've won every prize on my counter, arcade champ! Need extra tickets for clubhouse decor? # speaker: Mr. Pip
- else:
    Tickets for prizes! What'll it be? # speaker: Mr. Pip
}
+ {pinwheel} [Rainbow Pinwheel, 20 tickets]
    A rainbow pinwheel. Blow on it and it spins! # speaker: Mr. Pip # trade: pinwheel 20
+ {ball} [Star Bouncy Ball, 30 tickets]
    A star bouncy ball. It bounces higher than you! # speaker: Mr. Pip # trade: bouncy-ball 30
+ {rocket} [Toy Rocket, 50 tickets]
    A toy rocket, just like the one on my wall. # speaker: Mr. Pip # trade: toy-rocket 50
+ {keychain} [Star Racer Keychain, 80 tickets]
    A Star Racer keychain. Only champs get these! # speaker: Mr. Pip # trade: star-racer-keychain 80
+ {can_buy_tickets} [Trade 25 coins for 15 Arcade Tickets]
    Clink-clink! Fifteen shiny orange arcade tickets, fresh off the roll! # speaker: Mr. Pip # buy-tickets: 25 15 # sound: chime-yellow
+ [Not now]
    Come back any time! # speaker: Mr. Pip
- -> DONE

=== star_racer ===
STAR RACER. HIGH SCORES! # speaker: Fae
{calmed("arcade-keeper"): The top score's initials are scribbled out in purple marker. # speaker: Fae}
{not calmed("arcade-keeper"): The screen is fizzing with purple scribbles. # speaker: Fae}
-> DONE
