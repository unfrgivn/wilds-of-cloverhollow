=== npc_gus ===
{lanternOn():
    Ho-ho! Shining that violet lantern right over my mail satchel? I could read tiny postcard stamps in the shade with that! # speaker: Mailman Gus
}
{
- calmed("hooded-kid"):
    Letters are pouring in from every corner of Cloverhollow, Fae! Ever since you helped Milo feel welcome again, everyone's writing thank-you cards! # speaker: Mailman Gus
- not areaCalm():
    Whoa there, Fae! Hold onto your hat, there's a fizzy critter zipping across my cobblestones! # speaker: Mailman Gus
- bossesCalmed() >= 3:
    Three-star special delivery news, Fae! Folks from the bay to the mountain pass are writing letters about your {bossesCalmed()} big calm-downs! # speaker: Mailman Gus
- calmed("fountain-frog"):
    Nothing beats a dry plaza walk for the mail route! Thank you for soothing that fizzy frog, Fae. # speaker: Mailman Gus
- else:
    Special delivery, Fae! Pink fountain bubbles nearly stamped my whole stack of Cloverhollow postcards! # speaker: Mailman Gus
}
{withParty("sue"):
    Did my new fishing tackle catalog arrive yet, Gus? # speaker: Sue
    Top of the satchel, Sue, dry as a whistle! # speaker: Mailman Gus
}
{withParty("jordan"):
    Any trail maps from Pinecone Pass in today's pouch, Gus? # speaker: Jordan
    Fresh bundle tied with blue twine, Jordan! # speaker: Mailman Gus
}
{treats() > 0: Smells like specialty critter treats in your backpack! Better aroma than parcel post! # speaker: Mailman Gus}
{mail_complete: Good seeing my favorite Honorary Junior Mail Carrier out on the plaza, Fae! # speaker: Mailman Gus}
{not mail_bonus and bossesCalmed() >= 2: -> mail_bonus}
+ [Ask about Cloverhollow's mail route]
    I walk from Bon Appetit Cafe past Flora's tulips, out to Bubblegum Bay, and clear up to Pinecone Lodge! # speaker: Mailman Gus
    {stickers() >= 4: With {stickers()} stickers in your album, half the valley already knows your name! # speaker: Mailman Gus}
    -> DONE
+ [Ask if any curious letters came in]
    {calmed("hooded-kid"):
        Mostly postcards inviting Milo and your friends to picnics! Best bundle I've carried all year! # speaker: Mailman Gus
    - else:
        One unaddressed envelope smelled strongly of purple fizz, and a kid in a purple hood dashed right past my mailbox! # speaker: Mailman Gus
    }
    -> DONE
+ {areaCalm() and not gave_postcard} [Offer to help deliver mail to the bay]
    -> gave_postcard
+ {npc_mina.received_letter and not mail_complete} [Tell Gus the mountain mail arrived!]
    -> mail_complete
= mail_bonus
Hold everything, Fae! The Cloverhollow Neighbors Club pooled a thank-you parcel for calming {bossesCalmed()} big valley troubles! # speaker: Mailman Gus
Ten crisp coins and a crunchy mail-route snack, signed and sealed just for you! # speaker: Mailman Gus # gift: coins 10 # gift: snack 1 # sound: chime-yellow
Whoa, special delivery! Thank you, Mailman Gus! # speaker: Fae
-> DONE
= gave_postcard
Why, bless your swift boots, Fae! Captain Sal down at Bubblegum Bay has been waiting on this Seashell Postcard all week! # speaker: Mailman Gus # sound: chime-blue
Tuck it safe in your journal pocket and hand it right to him down by the pier! # speaker: Mailman Gus
Count on me, Mailman Gus! # speaker: Fae
-> DONE
= mail_complete
Mina got Captain Sal's Mountain Reply Letter safe and sound?! Hold everything, that's cross-valley express service! # speaker: Mailman Gus
By the power of my brass mail whistle, I hereby name you Honorary Junior Mail Carrier of Cloverhollow! # speaker: Mailman Gus # gift: coins 15 # sound: chime-yellow
Whoa, Honorary Junior Mail Carrier! Thanks, Mailman Gus! # speaker: Fae
-> DONE

=== npc_hazel ===
{lanternOn():
    Oh, my stars! What a warm violet lantern glow, dear. It makes the meadow clover look dusted in fairy sugar! # speaker: Grandma Hazel
}
{
- calmed("hooded-kid"):
    Look how peaceful Meadow Park feels now, sweet Fae. Hearing that Milo made such kind friends warms this old heart right through. # speaker: Grandma Hazel
- not areaCalm():
    Oh dearie, step lightly! The meadow critters have caught a dreadful case of the purple zoomies! # speaker: Grandma Hazel
- bossesCalmed() >= 5:
    My goodness, {bossesCalmed()} major calm-downs across the valley! Cloverhollow has never seen a kinder explorer, Fae. # speaker: Grandma Hazel
- club_open:
    You opened the old park tree house! Why, kids have been whispering silly passwords to those branches since I was your age! # speaker: Grandma Hazel
- else:
    Hello there, sweet Fae! Nothing lifts the spirits like watching the meadow clover sway from this park bench. # speaker: Grandma Hazel
}
{withParty("maddie"):
    Why, hello Maddie! Your orange fur looks softer than my best knitted blanket! # speaker: Grandma Hazel
}
{withParty("sue"):
    Grandma Hazel always knows where the best picnic spots are, Fae! # speaker: Sue
}
{shared_snack:
    Thank you again for sharing that sweet snack earlier, dearie! Made my whole park sit extra cozy! # speaker: Grandma Hazel
}
{not basket_treat and (stickers() >= 2 or areaCalm()): -> basket_treat}
+ [Ask about Meadow Park's history]
    Long before the boardwalks were painted, neighbors planted these clover rings so anyone feeling lonely would find a friendly bench. # speaker: Grandma Hazel
    {gem_count() > 0: And look at you, already finding {gem_count()} of the valley's hidden Star Gems! # speaker: Grandma Hazel}
    -> DONE
+ [Share a quiet park moment]
    {has_flute:
        If you ever play a gentle tune on that painted flute, the whole meadow seems to lean in and listen! # speaker: Grandma Hazel
    - else:
        A deep breath and a kind song can untangle almost any knot, Fae. Take good care of your friends! # speaker: Grandma Hazel
    }
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= basket_treat
Wait a tick, dear! I baked extra honey-oat snacks for Pippa and any explorer passing through Meadow Park. # speaker: Grandma Hazel
Pop two right into your backpack before your next adventure! # speaker: Grandma Hazel # gift: snack 2 # sound: chime-green
Thank you so much, Grandma Hazel! # speaker: Fae
-> DONE
= shared_snack
Here, Grandma Hazel! Let's share a cozy snack on the bench! # speaker: Fae # feed: snack 1
Oh, bless your sweet heart, Fae! Nothing tastes finer than a snack shared with a kind neighbor! # speaker: Grandma Hazel
Take eight shiny coins from my knitting purse for your travels, sweetheart! # speaker: Grandma Hazel # gift: coins 8 # sound: chime-green
-> DONE

=== npc_bram ===
{lanternOn():
    Whoa! Stage-light violet right here on the hillside! Now that's the spotlight for a clover meadow encore! # speaker: Bram
}
{
- calmed("hooded-kid"):
    I'm writing a brand-new ballad about how you helped Milo find his groove again, Fae! Every lamb up here hums the chorus! # speaker: Bram
- not areaCalm():
    Easy on the strings! A fizzy critter is bouncing off-beat right through the clover! # speaker: Bram
- calmed("taco-chef"):
    Chef Mateo's grill is sizzling calm again, and the whole ridge smells like crispy tacos and sweet acoustic chords! # speaker: Bram
- bossesCalmed() >= 4:
    Four verses and counting! With {bossesCalmed()} big calm-downs under your belt, you're a valley folk hero, Fae! # speaker: Bram
- else:
    Hey there, Fae! Pull up a patch of clover and listen to the hills sing with my ukulele! # speaker: Bram
}
{withParty("sue"):
    Can we hear the Bubblegum Bay shanty next, Bram? # speaker: Sue
    Coming right up, Sue, with extra bounce! # speaker: Bram
}
{withParty("jordan"):
    Those chords carry clear down toward the Whispering Woods trail, Bram! # speaker: Jordan
}
{not melody_coins and (has_flute or calmed("lamb")): -> melody_coins}
+ [Talk about music in the hills]
    {has_flute:
        Play a note on your flute whenever you pass by! Ukulele and flute make the coziest meadow duet! # speaker: Bram
    - else:
        The lambs up on Clover Hills love echo melodies. Listen close to the notes and they'll bounce right along with you! # speaker: Bram
    }
    -> DONE
+ [Ask about the ridge trails]
    Sunny watches the eastern flock while I keep an eye on the clover meadows. {treats() > 0: And with {treats()} specialty treats in your pack, every critter up here will be your biggest fan!|Pack a snack or two if you head north into the woods!} # speaker: Bram
    -> DONE
= melody_coins
Hey, fellow musician! Anyone spreading calm tunes across Clover Hills deserves a busker's share from my hat! # speaker: Bram
Here's twelve shiny coins for your travels, Fae! Keep playing from the heart! # speaker: Bram # gift: coins 12 # sound: chime-blue
Awesome! Thanks, Bram! # speaker: Fae
-> DONE

=== npc_wren ===
{lanternOn():
    Ooh! Hold your lantern right there! Violet light makes the mossy bark patterns jump straight off the page! # speaker: Wren
}
{
- calmed("hooded-kid"):
    I drew a whole double-page spread of the calm Enchanted Forest, Fae! Even Milo signed the corner of my sketchbook! # speaker: Wren
- not areaCalm():
    Eep! Careful, Fae! Fizzy woodland critters keep jiggling the ferns while I try to ink my sketches! # speaker: Wren
- calmed("moon-owl"):
    I finally sketched Starry Owl perching peacefully in the high pines! Best drawing in my whole notebook! # speaker: Wren
- clubhouse_claimed:
    Your woodland clubhouse looks like something straight out of a storybook! I drew the porch roof three times already! # speaker: Wren
- else:
    Hi, Fae! Shh, look closely at these spotted red-cap mushrooms. I'm sketching every woodland secret I can spot! # speaker: Wren
}
{withParty("jordan"):
    Wren's sketches are almost as accurate as Ranger Moss's trail maps, Fae! # speaker: Jordan
}
{withParty("acorn-squirrel"):
    NO WAY! Your Acorn Squirrel actually sat still long enough for a portrait! # speaker: Wren
}
{sketch_complete:
    My completed Cloverhollow Field Compendium is my prized possession, Fae! Thanks for helping finish every chapter! # speaker: Wren
}
{not sketch_reward and (stickers() >= 5 or gem_count() >= 3): -> sketch_reward}
+ [Peek at Wren's woodland sketchbook]
    Let's see... mossy roots, spotted mushrooms, Ranger Moss's hat, and a dotted trail pointing south to Clover Hills! # speaker: Wren
    {bossesCalmed() >= 2: Plus I added {bossesCalmed()} gold stars for every big valley calm-down you've pulled off! # speaker: Wren}
    -> DONE
+ [Ask about hidden things in the woods]
    {calmed("hooded-kid"):
        Just cozy owls, fluttering leaves, and friendly critters from oak to creek! # speaker: Wren
    - else:
        Earlier I saw a kid in a purple hood hurry past the mossy stones muttering about some glowing pond deeper in the forest! # speaker: Wren
    }
    -> DONE
+ {not started_sketch} [Offer to help collect valley sketches]
    -> started_sketch
+ {npc_pebble.gave_rubbing and npc_sunny.gave_clover and not sketch_complete} [Share the crystal rubbing and clover!]
    -> sketch_complete
= sketch_reward
Wait, Fae! With {stickers()} critter stickers and {gem_count()} Star Gems, you're a real-life field naturalist! # speaker: Wren
Take eight coins and a trail snack from my sketching pack! # speaker: Wren # gift: coins 8 # gift: snack 1 # sound: chime-green
Thanks, Wren! Your drawings are awesome! # speaker: Fae
-> DONE
= started_sketch
Really?! You'd help me finish my Cloverhollow Field Compendium? # speaker: Wren
I still need a crystal rubbing from Professor Pebble in Crystal Cavern and a pressed clover from Sunny up on Clover Hills! # speaker: Wren
Leave it to me, Wren! I'll bring both right back! # speaker: Fae
-> DONE
= sketch_complete
NO WAY! A sparkling quartz rubbing from Professor Pebble AND a four-leaf pressed clover from Sunny?! # speaker: Wren
My Cloverhollow Field Compendium is finally complete! Maya and Theo in the Art Room are going to flip when they hear! # speaker: Wren
Take eighteen coins and two sketchbook snacks as my co-author prize, Fae! # speaker: Wren # gift: coins 18 # gift: snack 2 # sound: chime-yellow
We make a great team, Wren! # speaker: Fae
-> DONE

=== npc_tuck ===
{lanternOn():
    WHOA! Your purple lantern makes my snowdrift glitter like a giant grape popsicle! # speaker: Tuck
}
{
- calmed("hooded-kid"):
    The snow up here feels extra fluffy now that the purple fizz is gone! Wait till Milo sees our next snow fort! # speaker: Tuck
- not areaCalm():
    Whoa, duck! Fizzy critters are bowling straight toward my giant snowman! # speaker: Tuck
- lodge_open:
    Mrs. Flurry opened Pinecone Lodge back up! Mina promised hot cocoa with extra marshmallows once my snowman's done! # speaker: Tuck
- else:
    Heya, Fae! Welcome to Pinecone Pass! I'm rolling the absolute biggest, roundest snowman in Cloverhollow history! # speaker: Tuck
}
{withParty("jordan"):
    That bottom snowball is already taller than your snowshoes, Tuck! # speaker: Jordan
    Just wait till I stack the scarf and pinecone buttons, Jordan! # speaker: Tuck
}
{withParty("sue"):
    Bet a snowman out here could hold a fishing rod too! # speaker: Sue
}
{shared_snack:
    That snack you shared gave me turbo snowman-rolling power, Fae! # speaker: Tuck
}
{not snow_snack and (lodge_open or bossesCalmed() >= 2): -> snow_snack}
+ [Help inspect Tuck's giant snowman]
    Three stacked snowballs, two pine-twig arms, and a bright knit cap! {treats() > 0: And hey, carrying {treats()} warm treats up the pass is super smart!|Just don't tell the penguins, they try to slide off its nose!} # speaker: Tuck
    -> DONE
+ [Ask what's up the mountain trail]
    North leads past the warm lodge toward the sparkling Crystal Cavern, and the Star Bus stops right down the bend! # speaker: Tuck
    {stickers() >= 4: With {stickers()} stickers already, you're practically a mountain-pass legend, Fae! # speaker: Tuck}
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= snow_snack
Hey, thanks for keeping Pinecone Pass safe for snowman-building, Fae! # speaker: Tuck
I dug up seven lucky coins from the snowbank plus a cozy lodge snack for you! # speaker: Tuck # gift: coins 7 # gift: snack 1 # sound: chime-yellow
Whoa, awesome! Thanks, Tuck! # speaker: Fae
-> DONE
= shared_snack
Here, Tuck! Have a warm snack for your snowman-building break! # speaker: Fae # feed: snack 1
WHOA, snacks in the snow?! You are officially the coolest mountain buddy ever, Fae! # speaker: Tuck
Take eight shiny snow-fort coins I found by the pine bench! # speaker: Tuck # gift: coins 8 # sound: chime-green
-> DONE

=== npc_kai ===
{lanternOn():
    Whoa! A pocket lighthouse! You could signal every sailboat in Bubblegum Bay with that glow! # speaker: Kai
}
{
- calmed("hooded-kid"):
    Even the harbor ripples look calm and shiny now! Captain Sal says we should invite Milo down to launch paper boats too! # speaker: Kai
- not areaCalm():
    Watch your step on the sand, Fae! A fizzy critter is kicking up pink sea-foam near my paper boats! # speaker: Kai
- calmed("lifeguard"):
    Ms. Coral is back on beach watch and the whole bay is cheering! Best harbor day ever! # speaker: Kai
- treasure_found:
    HOLD EVERYTHING! You actually found the sunken pirate treasure on Bubblegum Bay?! Tell me everything! # speaker: Kai
- else:
    Ahoy, Fae! Captain Sal taught me how to fold seaworthy paper sailboats for the harbor tide! # speaker: Kai
}
{withParty("sue"):
    Sue! Captain Sal said you hooked the biggest shiny fish off the pier! # speaker: Kai
    Anytime you want a casting lesson, Kai, grab a pole! # speaker: Sue
}
{withParty("pond-pup"):
    AWW! Pond Pup wants to chase my paper sailboat right along the shallows! # speaker: Kai
}
{not harbor_find and (calmed("lifeguard") or treasure_found or bossesCalmed() >= 1): -> harbor_find}
+ [Ask about his paper sailboats]
    Fold the prow sharp, tuck the sail high, and launch right where the gentle waves curl! # speaker: Kai
    {gem_count() > 0: And with {gem_count()} Star Gems gleaming in your pack, you've got better treasure eyes than any pirate! # speaker: Kai}
    -> DONE
+ [Ask about Bubblegum Bay]
    Captain Sal watches the boats, Nora hunts pink spiral shells, and the Cliffside Trail climbs up east if you want an ocean view! # speaker: Kai
    -> DONE
= harbor_find
Ahoy, Fae! Thanks for making Bubblegum Bay smooth sailing for everyone! # speaker: Kai
I found nine shiny sand-dollars, I mean coins, tucked near the pier pilings, all yours! # speaker: Kai # gift: coins 9 # sound: chime-blue
Score! Thanks a bunch, Kai! # speaker: Fae
-> DONE

=== npc_sage ===
{lanternOn():
    Ah! Your violet lantern wakes every sleeping bluebell along the Misty Path! Even the ancient stones remember that glow. # speaker: Star-Watcher Sage
}
{
- calmed("hooded-kid"):
    Look how clear the silver mist hangs now, Fae. Ever since you helped Milo feel heard, the Enchanted Forest hums like a harp. # speaker: Star-Watcher Sage
- seal_open:
    You played the melody that opened the ancient stone seal! Beyond that archway waits the heart of the Enchanted Forest. # speaker: Star-Watcher Sage
- rope_bridge:
    The old rope bridge holds firm across the gully, Fae. Only the singing stone seal stands ahead now! # speaker: Star-Watcher Sage
- found_mist_way:
    You followed the lantern-lit bluebells right across the mist-band! Trusting your light always reveals the true path. # speaker: Star-Watcher Sage
- not areaCalm():
    Tread gently through the silver haze, young traveler. Fizzy currents ripple nearby! # speaker: Star-Watcher Sage
- else:
    Welcome to the Misty Path, Fae. Listen closely, and the bluebells will whisper where safe footing hides. # speaker: Star-Watcher Sage
}
{withParty("sue"):
    This mist reminds me of the sea fog rolling off Bubblegum Bay, Sage! # speaker: Sue
    Both hide wonders for patient eyes, Sue. # speaker: Star-Watcher Sage
}
{withParty("jordan"):
    Good thing we brought our lantern, lasso, and flute for this trail! # speaker: Jordan
    Well prepared, Jordan. Every tool you earned along the way has a part to play here. # speaker: Star-Watcher Sage
}
{not star_gift and (seal_open or bossesCalmed() >= 4): -> star_gift}
+ [Ask how to cross the Misty Path]
    Three gentle trials guard the enchanted gate: shine a violet lantern to find the bluebell stones, lasso the gully posts to swing the bridge, and play the chime melody at the seal! # speaker: Star-Watcher Sage
    {stickers() >= 6: With {stickers()} calm-down stickers in your journal, the forest already knows your kindness! # speaker: Star-Watcher Sage}
    -> DONE
+ [Ask about the Enchanted Forest ahead]
    {calmed("hooded-kid"):
        The fairies dance under a peaceful canopy, and Milo's laughter drifts back along the breeze. Well done, Fae. # speaker: Star-Watcher Sage
    - else:
        A lonely wish stirred the Mystic Pond deeper inside, sending fizzy ripples across Cloverhollow. A steady heart will settle it. # speaker: Star-Watcher Sage
    }
    -> DONE
= star_gift
For walking the valley with such patience and calming {bossesCalmed()} major troubles, please accept this starlight token! # speaker: Star-Watcher Sage
Twelve shiny coins and a trail snack to keep your step light, Fae! # speaker: Star-Watcher Sage # gift: coins 12 # gift: snack 1 # sound: chime-blue
Thank you so much, Star-Watcher Sage! # speaker: Fae
-> DONE

=== npc_poppy ===
{lanternOn():
    WHOA! Your purple lantern makes every arcade cabinet glow like a secret bonus stage! # speaker: Poppy
}
{
- calmed("hooded-kid"):
    Sammy and I are saving a whole row of Skee-Ball lanes for you and Milo! Best hangout in Cloverhollow! # speaker: Poppy
- not areaCalm():
    Whoa, watch the cabinets! Fizzy sparks are bouncing near the prize counter! # speaker: Poppy
- won("star-racer-keychain"):
    HOLD ON! You actually won the Star Racer Keychain?! Let me see it shine under the arcade lights! # speaker: Poppy
- bossesCalmed() >= 3:
    Three-plus big calm-downs AND arcade champion?! You've got {bossesCalmed()} hero stars already, Fae! # speaker: Poppy
- else:
    Heya, Fae! Thanks for calming Mr. Pip down so Sammy and I could get back to our favorite machines! # speaker: Poppy
}
{withParty("sue"):
    Ready for a friendly Boop-a-Mole rematch, Poppy? # speaker: Sue
    You're on, Sue! My mallet reflexes are warmed up! # speaker: Poppy
}
{withParty("jordan"):
    I'm still trying to figure out the claw machine physics, Poppy. # speaker: Jordan
    Pick plushes from the top of the heap first, Jordan! # speaker: Poppy
}
{not token_tip and (tickets() >= 5 or stickers() >= 4): -> token_tip}
+ [Ask for her secret arcade trick]
    In the claw machine, grab the top plushies before digging for the bottom ones! And in Comet Cruise, nudge early around wobbling rocks! # speaker: Poppy
    {stickers() >= 5: With {stickers()} critter stickers, your rhythm checks must be unstoppable! # speaker: Poppy}
    -> DONE
+ [Check her ticket tally]
    I'm only three tickets away from trading at Mr. Pip's counter! {tickets() > 0: Looks like you've got {tickets()} tickets saved up too!|Try a round of Skee-Ball and watch those tickets pour out!} # speaker: Poppy
    -> DONE
= token_tip
Hey, arcade pros always share spare coins! Take ten shiny tokens from my lucky coin cup, Fae! # speaker: Poppy # gift: coins 10 # sound: chime-yellow
Sweet! Thanks a million, Poppy! # speaker: Fae
-> DONE

=== npc_clara ===
{lanternOn():
    Oh, my! That soft violet lantern makes my knitted stripes shimmer like mountain auroras! # speaker: Clara
}
{
- calmed("hooded-kid"):
    The whole lodge feels like a warm hug now that Milo and all the valley critters are resting easy, Fae! # speaker: Clara
- not areaCalm():
    Oh dear, stay close to the hearth! Something fizzy is rustling outside the lodge porch! # speaker: Clara
- bossesCalmed() >= 4:
    Word travels fast up Pinecone Pass! With {bossesCalmed()} major calm-downs behind you, everyone here raises a cocoa mug to you! # speaker: Clara
- else:
    Welcome inside Pinecone Lodge, dear! Pull up a stool near Otis and let the crackling fireplace warm your mittens! # speaker: Clara
}
{withParty("sue"):
    Your knitted scarves are way warmer than my harbor raincoat, Clara! # speaker: Sue
    I'll knit you a sea-blue striped one next, Sue! # speaker: Clara
}
{withParty("jordan"):
    Clara makes the best pine-berry tea on the whole mountain, Fae! # speaker: Jordan
    Always a hot kettle waiting whenever you drop by, Jordan! # speaker: Clara
}
{shared_snack:
    Thank you again for sharing that delicious snack by the fire, Fae! Best tea companion in the pass! # speaker: Clara
}
+ [Ask about her knitting]
    I'm knitting cozy striped scarves for Mrs. Flurry, Otis, and every snowy explorer who braves Pinecone Pass! # speaker: Clara
    {stickers() >= 5: And with {stickers()} calm-down stickers in your book, you've brought warmth to half the valley! # speaker: Clara}
    -> DONE
+ [Ask about Pinecone Lodge]
    Otis tells fireside tales while Mrs. Flurry keeps the cocoa kettle singing. Even the little lodge hamster loves the cozy quiet! # speaker: Clara
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= shared_snack
Here, Clara! Would you like to share a cozy snack by the hearth? # speaker: Fae # feed: snack 1
Oh, how thoughtful, Fae! A crunchy snack pairs wonderfully with hot lodge tea! # speaker: Clara
Please tuck these eight shiny coins into your explorer pouch with my warmest thanks! # speaker: Clara # gift: coins 8 # sound: chime-green
-> DONE

=== npc_bramble ===
{lanternOn():
    Whoa, trail lantern! That violet glow picks out rare silver moss right along the cliff rocks! # speaker: Bramble
}
{
- calmed("hooded-kid"):
    Every bend from Bubblegum Bay up to Pinecone Pass is humming peaceful again! Tell Milo he's welcome on our ridge hikes anytime! # speaker: Bramble
- not areaCalm():
    Watch your boots on the gravel, Fae! A fizzy critter is zipping right around the cliff switchbacks! # speaker: Bramble
- calmed("gull"):
    Hooray! With that lookout gull settled down, Hiker Lark and I can hear the canyon songbirds clear down to the surf! # speaker: Bramble
- else:
    Howdy, trailblazer! Welcome to Cliffside Trail! I keep the signposts tidy and pack extra trail maps for hikers! # speaker: Bramble
}
{withParty("sue"):
    You can spot every fishing boat in Bubblegum Bay from up here, Bramble! # speaker: Sue
    Sure can, Sue! Best coastal overlook in Cloverhollow! # speaker: Bramble
}
{withParty("jordan"):
    Bramble showed me the quickest clover shortcut up to Pinecone Pass! # speaker: Jordan
    And Jordan still beats my ridge time by two minutes flat! # speaker: Bramble
}
{not ridge_gift and (calmed("gull") or bossesCalmed() >= 2): -> ridge_gift}
+ [Ask about the Cliffside Trail]
    Hiker Lark tracks the songbirds down near the signpost while I check the upper switchback toward Pinecone Pass. # speaker: Bramble
    {stickers() >= 4: With {stickers()} critter stickers already, you're a natural trail ranger, Fae! # speaker: Bramble}
    -> DONE
+ [Ask if he spotted anything unusual]
    {calmed("hooded-kid"):
        Just cheerful bunnies, calm squirrels, and neighbors waving across the ridge! # speaker: Bramble
    - else:
        Earlier a kid in a purple hood sprinted uphill faster than a startled jackrabbit, trailing fizzy purple sparkles! # speaker: Bramble
    }
    -> DONE
= ridge_gift
Any explorer who helps keep the valley trails calm deserves a ridge-walker's bonus! # speaker: Bramble
Take ten shiny coins and a crunchy trail snack from my pack, Fae! # speaker: Bramble # gift: coins 10 # gift: snack 1 # sound: chime-green
Awesome, thanks Bramble! # speaker: Fae
-> DONE

=== npc_gemma ===
{lanternOn():
    OH! Shine your lantern right over this wall! Every tiny quartz vein lights up like purple starlight! # speaker: Gemma
}
{
- calmed("hooded-kid"):
    The cavern crystals chime so sweetly now! Professor Pebble says we should show Milo the glowing prism arch sometime! # speaker: Gemma
- not areaCalm():
    Careful near the stream, Fae! Fizzy bats and crystal moles are echoing extra loud in here! # speaker: Gemma
- cavern_bridge_lit:
    WHOA! You lit the fairy mural and raised the crystal stepping stones! Best geological miracle ever! # speaker: Gemma
- else:
    Hi, Fae! I'm helping Professor Pebble map every humming quartz cluster inside Crystal Cavern! # speaker: Gemma
}
{withParty("sue"):
    That underground spring is almost as turquoise as Bubblegum Bay, Gemma! # speaker: Sue
    And it sparkles twice as bright under Fae's lantern, Sue! # speaker: Gemma
}
{withParty("jordan"):
    Wait till you hear the golden star chime ring across the grotto, Gemma! # speaker: Jordan
    I've got my notebook open and ready to sketch the soundwaves, Jordan! # speaker: Gemma
}
{not crystal_gift and (cavern_chime_rung or cavern_bridge_lit or gem_count() >= 2): -> crystal_gift}
+ [Ask about the cavern crystals]
    Purple quartz hums low, teal crystals ring bright, and golden clusters chime right along with a flute! # speaker: Gemma
    {bossesCalmed() >= 2: With {bossesCalmed()} major calm-downs logged, even the crystal moles trust your footsteps! # speaker: Gemma}
    -> DONE
+ [Compare Star Gem notes]
    {gem_count() > 0:
        You've already discovered {gem_count()} Star Gems?! Plus {stickers()} critter stickers? You're a legend in Professor Pebble's logbook! # speaker: Gemma
    - else:
        Professor Pebble says seven Star Gems hide across Cloverhollow, and one glints right inside this cavern's far eastern pocket! # speaker: Gemma
    }
    -> DONE
= crystal_gift
Whoa, you're a real-life cavern explorer! Here are twelve shiny coins from my geology jar! # speaker: Gemma # gift: coins 12 # sound: chime-blue
Whoa, thanks Gemma! # speaker: Fae
-> DONE

=== npc_bert ===
{lanternOn():
    Well I'll be! That purple lantern spots stray glitter and invisible chalk marks faster than my best dustpan! # speaker: Custodian Bert
}
{
- calmed("hooded-kid"):
    Not a single smudge of purple fizz left on the linoleum! And Milo even offered to help me stack chairs after school! # speaker: Custodian Bert
- not areaCalm():
    Hold onto your backpack, Fae! Fizzy paint splashes are bouncing right down East Hall! # speaker: Custodian Bert
- art_open:
    Ms. Rowan's Art Room is spotless and back open! Maya and Theo already have the clay table humming! # speaker: Custodian Bert
- recess:
    Nice and quiet in East Hall while Leo and the class run around outside for recess! # speaker: Custodian Bert
- else:
    Howdy, Fae! Custodian Bert here, keeping Cloverhollow School's hallways shiny enough to see your smile in! # speaker: Custodian Bert
}
{withParty("sue"):
    Your hallway floor shines brighter than a polished boat deck, Bert! # speaker: Sue
    Haha, high praise from a Bubblegum Bay sailor, Sue! # speaker: Custodian Bert
}
{withParty("jordan"):
    Sorry if we tracked any pinecone dust in from the pass, Custodian Bert! # speaker: Jordan
    No worries at all, Jordan! Adventures leave a few footprints, that's what brooms are for! # speaker: Custodian Bert
}
{not hall_gift and (art_open or bossesCalmed() >= 2): -> hall_gift}
+ [Ask about East Hall]
    Gym doors on the west, Ms. Willow's Music Room in the middle, and Ms. Rowan's Art Room down east! # speaker: Custodian Bert
    {stickers() >= 4: With {stickers()} critter stickers already, you've calmed more critters than I've swept chalk erasers! # speaker: Custodian Bert}
    -> DONE
+ [Ask if he saw anyone rush past]
    {calmed("hooded-kid"):
        Just cheerful students heading to art and music! Best sound in the whole building! # speaker: Custodian Bert
    - else:
        Somebody in a purple hood zoomed past my broom cart leaving fizzy purple sneaker prints that popped like soda bubbles! # speaker: Custodian Bert
    }
    -> DONE
= hall_gift
Thanks for helping keep our school calm and bright, Fae! Take nine shiny coins I found beneath the lost-and-found bench! # speaker: Custodian Bert # gift: coins 9 # sound: chime-yellow
Aw, thank you, Custodian Bert! # speaker: Fae
-> DONE

=== npc_theo ===
{lanternOn():
    WHOA! Your purple lantern makes my ceramic glaze samples glow neon right on the work table! # speaker: Theo
}
{
- calmed("hooded-kid"):
    Milo asked if I'd teach him how to sculpt a tiny clay frog next art class! Having everyone back together is the best! # speaker: Theo
- not areaCalm():
    Eep! Hold the clay table steady! Fizzy shakes might topple my tiny turtle! # speaker: Theo
- else:
    Hi, Fae! Thanks for helping Ms. Rowan calm down so Maya and I could get back to our clay and easels! # speaker: Theo
}
{withParty("sue"):
    Could you sculpt a tiny clay bluebird or harbor crab next, Theo? # speaker: Sue
    Ooh, a clay harbor crab with tiny pinchers! Adding it to my list, Sue! # speaker: Theo
}
{withParty("jordan"):
    Those miniature pine-tree stamps on your pottery look awesome, Theo! # speaker: Jordan
    Thanks, Jordan! I pressed real Pinecone Pass needles into the soft clay! # speaker: Theo
}
{npc_wren.sketch_complete:
    Maya told me you helped Wren finish the Field Compendium! I'm already sculpting a tiny crystal quartz and four-leaf clover bowl to celebrate! # speaker: Theo
}
{not studio_gift and (stickers() >= 3 or bossesCalmed() >= 2): -> studio_gift}
+ [Look at Theo's clay sculptures]
    I'm making a miniature set of every calm critter in Cloverhollow! {stickers() >= 6: With {stickers()} stickers in your album, you've given me a whole gallery to sculpt!|Show me every new critter you befriend!} # speaker: Theo
    -> DONE
+ [Ask about working with Maya]
    Maya paints the bright watercolor backdrops and I sculpt the tiny clay critters to stand in front! Teamwork makes the coolest art shows! # speaker: Theo
    -> DONE
= studio_gift
You inspired a whole shelf of calm-critter sculptures, Fae! Take ten shiny studio coins and a crunchy art-room snack! # speaker: Theo # gift: coins 10 # gift: snack 1 # sound: chime-green
Whoa, thank you, Theo! # speaker: Fae
-> DONE

=== npc_marigold ===
{lanternOn():
    Oh, my stars! That violet lantern makes Grocer Pippin's berry barrel shimmer like velvet jewels! # speaker: Mrs. Marigold
}
{
- calmed("hooded-kid"):
    Oh, Fae, sweetheart! Ever since you helped Milo feel right at home with everyone, the whole plaza has been stopping by for celebratory berry pies and crisp orchard apples! # speaker: Mrs. Marigold
- market_note_read:
    Grocer Pippin told me you spotted that secret lavender orchard tip near the jam shelves! What a sharp explorer's eye you have, Fae! # speaker: Mrs. Marigold
- else:
    Well hello there, Fae! Nothing beats wandering down these pine shelves while Grocer Pippin stacks fresh red apples and meadow berries! # speaker: Mrs. Marigold
}
{withParty("sue"):
    Mrs. Marigold! Think Grocer Pippin saved a jar of those crunchy Fish Crackers for my dock snacks? # speaker: Sue
    Front shelf, Sue dear, baked nice and crisp for you and your seaside friends! # speaker: Mrs. Marigold
}
{withParty("jordan"):
    Those wild berries smell almost as sweet as the strawberries from our clubhouse deck, Mrs. Marigold! # speaker: Jordan
    Why, thank you, Jordan! You and Fae have quite the green thumb up in Whispering Woods! # speaker: Mrs. Marigold
}
{treats() > 0: Ooh, I can smell lovely critter treats tucked in your backpack! You're ready to brighten any furry friend's mood! # speaker: Mrs. Marigold}
+ [Ask about Grocer Pippin's best produce]
    Orchard Apples are a dream for sweet meadow, hill, and cavern critters, while Fish Crackers make every bay and pond friend wiggle with delight! # speaker: Mrs. Marigold
    {stickers() >= 5: With {stickers()} calm friends in your sticker album, you probably know every critter's favorite snack by heart! # speaker: Mrs. Marigold}
    -> DONE
+ [Ask what Mrs. Marigold is baking]
    {calmed("hooded-kid"):
        A giant four-berry celebration tart for you, Sue, Jordan, and Milo! Cloverhollow has so much to cheer about! # speaker: Mrs. Marigold
    - else:
        Wild meadow berry hand pies! The berries in Pippin's barrel are plump and sweet, just right for a cozy kitchen tray. # speaker: Mrs. Marigold
    }
    -> DONE
+ {not basket_treat} [Help Mrs. Marigold pick a ripe orchard apple]
    -> basket_treat
= basket_treat
Oh, bless your kind heart, Fae! You picked the glossiest red apple in the whole crate! # speaker: Mrs. Marigold
Please take this crisp Orchard Apple treat and six shiny market coins as my thank-you! # speaker: Mrs. Marigold # gift: treat orchard-apple 1 # gift: coins 6 # sound: chime-green
Ooh, thank you so much, Mrs. Marigold! # speaker: Fae
-> DONE

=== npc_danny ===
{lanternOn():
    WHOA! Your purple blacklight makes the pastel gelato tubs glow like cosmic neon space scoops! # speaker: Danny
}
{
- calmed("hooded-kid"):
    Fae! You're a total legend! Scooper Penny let Milo and me design a Victory Rainbow Dream Sundae to celebrate you calming the whole forest! # speaker: Danny
- parlor_note_read:
    No way! You found the Secret Sundae Club glow doodle by the curved gelato case?! That officially makes you top-tier parlor royalty! # speaker: Danny
- else:
    Hey, Fae! Pull up a stool! Scooper Penny's crispy waffle cones smell SO amazing right now! # speaker: Danny
}
{withParty("sue"):
    Danny! Tell me Mint Cloud Chip didn't run out before I got here! # speaker: Sue
    Relax, Sue! Penny just wheeled out a giant fresh tub with extra cocoa sprinkles! # speaker: Danny
}
{withParty("jordan"):
    Have you tried the Warm Honey Caramel Dream Sundae yet, Danny? Best mountain-explorer fuel around! # speaker: Jordan
    Ooh, YES! Two scoops of caramel plus a crispy cone is unbeatable, Jordan! # speaker: Danny
}
{treats() > 0: Whoa, nice! You're already carrying critter treats! Every critter in Cloverhollow flips for Berry Swirl Cones! # speaker: Danny}
+ [Ask Danny's favorite Dream Sundae flavor]
    Tough call between Strawberry Swirl and Cozy Cocoa Sundae with fluffy marshmallows! Penny says Berry Swirl Cones even cheer up the grumpiest shopkeepers! # speaker: Danny
    {bossesCalmed() >= 2: Heard you already calmed {bossesCalmed()} big valley troubles, so you definitely deserve a triple scoop! # speaker: Danny}
    -> DONE
+ [Ask about the Secret Sundae Club]
    {calmed("hooded-kid"):
        We just made you, Sue, Jordan, and Milo honorary VIPs of the Secret Sundae Club! Extra sprinkles forever! # speaker: Danny
    - else:
        Scooper Penny keeps a super-secret sundae doodle tucked near the gelato case, and rumor says only a purple glow reveals it! # speaker: Danny
    }
    -> DONE
+ {not scoop_bonus} [Trade ice-cream flavor tips with Danny]
    -> scoop_bonus
= scoop_bonus
Wait, strawberry swirl WITH crunchy honey drizzle?! That's genius, Fae! I'm telling Scooper Penny right away! # speaker: Danny
Here, take my spare Berry Swirl Cone treat and six lucky parlor coins for the pro scoop tip! # speaker: Danny # gift: treat berry-cone 1 # gift: coins 6 # sound: chime-blue
Awesome, thanks, Danny! # speaker: Fae
-> DONE

// ===========================================================================
// Elevation Track E11: Interactive Multi-Step Living NPC Quests (Wilds)
// 3. Toby's Sleepy Lullaby (Harmony Flute: Plaza, Meadow Park, Whispering Woods)
// 4. Chef Bea's Valley Spice Run (Sea-Salt, Pine-Sugar, Woodland Mint)
// ===========================================================================

=== function lullaby_count() ===
~ temp total = 0
{ lullaby_note_plaza:
    ~ total += 1
}
{ lullaby_note_park:
    ~ total += 1
}
{ lullaby_note_woods:
    ~ total += 1
}
~ return total

=== toby_lullaby_prompt ===
{lullaby_count() >= 3: -> toby_lullaby.complete}
+ {not lullaby_quest} [Ask about his sleepy town-square lullaby]
    -> toby_lullaby.start
+ {lullaby_quest} [Check Lullaby notes ({lullaby_count()}/3)]
    -> toby_lullaby.progress
+ [Save me a cinnamon bun, Toby!]
    You got it, Fae! Extra icing swirl! # speaker: Toby # expr: happy # pose: cheer
    -> DONE

=== toby_lullaby ===
= start
~ lullaby_quest = true
WHOA, hold on, Fae! Is that Ms. Willow's Harmony Flute?! # speaker: Toby # expr: surprised # pose: cheer
I'm trying to write a super-cozy Sleepy Cloverhollow Lullaby for bedtime in the town square, so even the bounciest critters can nap peacefully! # speaker: Toby # expr: happy # pose: talk
I just need three real valley echoes: play your Harmony Flute by the Plaza Fountain garden, the Meadow Park Pond reeds, and the Whispering Woods Echo Stone! # speaker: Toby # expr: determined # pose: talk
Just press your flute near each spot (or check the singing stones), jot down the notes, and bring all three back to me! # speaker: Toby # expr: happy # pose: talk
Ooh, a town-square bedtime lullaby! I'll collect all three valley notes, Toby! # speaker: Fae # expr: happy # pose: tool_flute # sound: flute
-> DONE

= progress
Awesome! You've already caught {lullaby_count()} of 3 Sleepy Lullaby echoes! # speaker: Toby # expr: happy # pose: talk
{not lullaby_note_plaza: Play your Harmony Flute near the echoing garden stone southeast of Cloverhollow Plaza's fountain! # speaker: Toby # expr: neutral # pose: talk}
{not lullaby_note_park: Try playing your Harmony Flute by the quiet reed bank beside Meadow Park's pond! # speaker: Toby # expr: neutral # pose: talk}
{not lullaby_note_woods: And play a soft note by the mossy Echo Stone in Whispering Woods! # speaker: Toby # expr: neutral # pose: talk}
On it, Toby! Flute at the ready! # speaker: Fae # expr: determined # pose: tool_flute
-> DONE

= complete
~ lullaby_quest = true
~ lullaby_done = true
WAIT A SECOND! Water-chime blue, pond-reed green, AND pine-breeze gold?! # speaker: Toby # expr: surprised # pose: cheer
Toby hums the three notes together while Fae plays them softly on her Harmony Flute! # speaker: Fae # expr: happy # pose: tool_flute # sound: flute-blue
Doo-daa-diii... WHOA, even my eyelids got cozy! Maddie's already yawning! # speaker: Toby # expr: happy # pose: cheer
{withParty("maddie"): Mrrrow-yaaaawn... Maddie stretches both front paws and curls her tail happily! # speaker: Maddie # expr: happy # pose: sit}
That's officially the Cloverhollow Sleepy Lullaby! Take twenty-five coins, an Orchard Apple treat, and a cafe snack for co-writing it with me! # speaker: Toby # expr: happy # pose: cheer # gift: coins 25 # gift: treat orchard-apple 1 # gift: snack 1 # sound: chime-yellow
Best band in Cloverhollow, Toby! # speaker: Fae # expr: happy # pose: cheer
-> DONE

=== lullaby_plaza ===
{lullaby_note_plaza: -> after}
A smooth carved garden stone near the plaza fountain hums faintly with the sound of splashing water. # speaker: Fae # expr: happy # pose: idle
{not has_flute:
    If I had a musical instrument, I bet this stone would echo the prettiest melody! # speaker: Fae # expr: neutral # pose: idle
    -> DONE
}
+ [Play the Harmony Flute here!]
    Fae plays a gentle bluebell melody on her Harmony Flute beside the fountain garden! # speaker: Fae # expr: happy # pose: tool_flute # sound: flute-blue
    ~ lullaby_note_plaza = true
    Ping-loo-laa! The water drops echo back a sleepy, sparkling lullaby chord! ({lullaby_count()}/3 notes captured!) # speaker: Fae # expr: surprised # pose: cheer # sound: chime-blue
    {lullaby_count() >= 3: That's all three valley lullaby notes! Let's bring the tune back to Toby at Bon Appetit Cafe! # speaker: Fae # expr: happy # pose: cheer}
    -> DONE
+ [Listen quietly for now]
    -> DONE
= after
The plaza fountain stone hums back the cozy blue water-chime note from Toby's Sleepy Lullaby. # speaker: Fae # expr: happy # pose: idle
-> DONE

=== lullaby_park ===
{lullaby_note_park: -> after}
Soft cattail reeds along the Meadow Park pond sway like tiny wind chimes in the afternoon breeze. # speaker: Fae # expr: happy # pose: idle
{not has_flute:
    They sound like they're waiting for a flute melody to answer them! # speaker: Fae # expr: neutral # pose: idle
    -> DONE
}
+ [Play the Harmony Flute here!]
    Fae plays a warm meadow note on her Harmony Flute by the quiet pond bank! # speaker: Fae # expr: happy # pose: tool_flute # sound: flute-green
    ~ lullaby_note_park = true
    Hummm-shhh-laa! The pond reeds whisper back a sleepy emerald harmony! ({lullaby_count()}/3 notes captured!) # speaker: Fae # expr: surprised # pose: cheer # sound: chime-green
    {lullaby_count() >= 3: All three lullaby echoes captured! Time to share the finished song with Toby at Bon Appetit Cafe! # speaker: Fae # expr: happy # pose: cheer}
    -> DONE
+ [Listen quietly for now]
    -> DONE
= after
The Meadow Park pond reeds sway gently in rhythm with the sleepy emerald harmony. # speaker: Fae # expr: happy # pose: idle
-> DONE

=== lullaby_woods ===
{lullaby_note_woods: -> after}
A mossy hollow Echo Stone sits beneath the tall pines of Whispering Woods, catching every hush of wind. # speaker: Fae # expr: happy # pose: idle
{not has_flute:
    The forest canopy sounds like a wooden music box waiting for a flute! # speaker: Fae # expr: neutral # pose: idle
    -> DONE
}
+ [Play the Harmony Flute here!]
    Fae plays a soft, dreamy lullaby note on her Harmony Flute under the whispering pines! # speaker: Fae # expr: happy # pose: tool_flute # sound: flute-yellow
    ~ lullaby_note_woods = true
    Wooo-laaa-hmm! Golden pine needles shimmer as the woods echo a warm bedtime chord! ({lullaby_count()}/3 notes captured!) # speaker: Fae # expr: surprised # pose: cheer # sound: chime-yellow
    {lullaby_count() >= 3: That's all three valley echoes! Let's take our Sleepy Lullaby straight back to Toby at Bon Appetit Cafe! # speaker: Fae # expr: happy # pose: cheer}
    -> DONE
+ [Listen quietly for now]
    -> DONE
= after
The mossy Echo Stone hums quietly beneath the pines, holding its warm bedtime harmony. # speaker: Fae # expr: happy # pose: idle
-> DONE

// ---------------------------------------------------------------------------
// 4. Chef Bea's Valley Spice Run (Coastal Sea-Salt, Alpine Pine-Sugar, Woodland Mint)
// ---------------------------------------------------------------------------
=== function valley_spice_count() ===
~ temp total = 0
{ valley_spice_salt:
    ~ total += 1
}
{ valley_spice_pine:
    ~ total += 1
}
{ valley_spice_mint:
    ~ total += 1
}
~ return total

=== bea_spice_run ===
{valley_spice_count() >= 3: -> complete}
{valley_spice_quest: -> progress}
~ valley_spice_quest = true
Oh, sweetie, I've been dreaming up a brand-new Cloverhollow Festival pastry that celebrates every corner of our valley! # speaker: Chef Bea # expr: happy # pose: cheer
To bake my Three-Biome Cloverhollow Tart, I need three fresh ingredients straight from the wilds: # speaker: Chef Bea # expr: determined # pose: talk
Pink Coastal Sea-Salt from Bubblegum Bay's southern shore, Alpine Pine-Sugar from Pinecone Pass's eastern snowbank, and Woodland Mint from Whispering Woods! # speaker: Chef Bea # expr: happy # pose: talk
If you gather all three on your travels, I'll bake the first golden batch just for your crew! # speaker: Chef Bea # expr: happy # pose: cheer
Ooh, a Three-Biome Festival Tart! I'll forage every single flavor, Chef Bea! # speaker: Fae # expr: happy # pose: cheer # sound: chime-green
-> DONE

= progress
Let's check your spice satchel: {valley_spice_count()} of 3 regional festival ingredients gathered so far! # speaker: Chef Bea # expr: happy # pose: talk
{not valley_spice_salt: Check the sunny tide stones on the south shore of Bubblegum Bay for sparkling Coastal Sea-Salt! # speaker: Chef Bea # expr: neutral # pose: talk}
{not valley_spice_pine: Look along the frosted eastern pine bank at Pinecone Pass for sweet Alpine Pine-Sugar! # speaker: Chef Bea # expr: neutral # pose: talk}
{not valley_spice_mint: And sniff near the mossy west clearing of Whispering Woods for fresh Woodland Mint! # speaker: Chef Bea # expr: neutral # pose: talk}
I'll bring back the whole spice rainbow, Chef Bea! # speaker: Fae # expr: determined # pose: cheer
-> DONE

= complete
~ valley_spice_quest = true
~ valley_spice_done = true
OH MY STARS! Sparkling sea-salt, frosted pine-sugar, AND crisp woodland mint, fresh as morning dew! # speaker: Chef Bea # expr: surprised # pose: cheer
Stand back, sweetie, the Bon Appetit oven is working pure Cloverhollow magic! # speaker: Chef Bea # expr: happy # pose: cheer # sound: chime-yellow
A golden, flaky Three-Biome Cloverhollow Tart slides out of the oven smelling like sea breeze, snowy cocoa, and sweet forest clover! # speaker: Fae # expr: surprised # pose: cheer
{withParty("sue"): Wait, salty-sweet crust AND fresh mint glaze?! Chef Bea, you're a culinary wizard! # speaker: Sue # expr: happy # pose: cheer}
{withParty("jordan"): That pine-sugar crunch tastes just like sunrise on Pinecone Pass! # speaker: Jordan # expr: happy # pose: cheer}
Here is your chef's honor reward: thirty shiny coins, two warm festival tart snacks, and a jar of Sunberry Nectar! # speaker: Chef Bea # expr: happy # pose: cheer # gift: coins 30 # gift: snack 2 # gift: treat sunberry-nectar 1 # sound: chime-red
Thank you, Chef Bea! Best pastry in the whole valley! # speaker: Fae # expr: happy # pose: cheer
-> DONE

=== spice_sea_salt ===
{valley_spice_salt: -> after}
Glistening pink-and-white sea-salt crystals sparkle in a sun-baked hollow along Bubblegum Bay's shore! # speaker: Fae # expr: surprised # pose: idle
{not (valley_spice_quest or spice_returned):
    They smell crisp like ocean spray! Bet Chef Bea at Bon Appetit Cafe could bake wonders with these once her kitchen is back on track. # speaker: Fae # expr: happy # pose: talk
    -> DONE
}
~ valley_spice_salt = true
Fae scoops a tidy paper packet of sparkling Coastal Sea-Salt for Chef Bea! ({valley_spice_count()}/3 festival spices!) # speaker: Fae # expr: happy # pose: cheer # sound: chime-blue
{valley_spice_count() >= 3: That's all three regional spices! Back to Chef Bea at Bon Appetit Cafe for the Festival Tart! # speaker: Fae # expr: happy # pose: cheer}
-> DONE
= after
Tiny pink sea-salt crystals continue drying in the warm Bubblegum Bay sun. # speaker: Fae # expr: happy # pose: idle
-> DONE

=== spice_pine_sugar ===
{valley_spice_pine: -> after}
Sweet, frosted amber pine-sugar droplets glint like tiny icicles along an eastern pine bank in Pinecone Pass! # speaker: Fae # expr: surprised # pose: idle
{not (valley_spice_quest or spice_returned):
    Smells like winter caramel and pine needles! Chef Bea at Bon Appetit Cafe would flip for this once she's baking again. # speaker: Fae # expr: happy # pose: talk
    -> DONE
}
~ valley_spice_pine = true
Fae wraps a cozy scoop of frosted Alpine Pine-Sugar in wax paper for Chef Bea! ({valley_spice_count()}/3 festival spices!) # speaker: Fae # expr: happy # pose: cheer # sound: chime-yellow
{valley_spice_count() >= 3: All three regional spices gathered! Time to head back to Chef Bea at Bon Appetit Cafe! # speaker: Fae # expr: happy # pose: cheer}
-> DONE
= after
Snow-dusted pine boughs smell faintly of sweet mountain sugar. # speaker: Fae # expr: happy # pose: idle
-> DONE

=== spice_woodland_mint ===
{valley_spice_mint: -> after}
Tufts of bright emerald Woodland Mint sprout beside a mossy stone in Whispering Woods, smelling cool and sweet! # speaker: Fae # expr: surprised # pose: idle
{not (valley_spice_quest or spice_returned):
    Ooh, what a cozy peppermint scent! Chef Bea at Bon Appetit Cafe would love these leaves once her spice rack is ready. # speaker: Fae # expr: happy # pose: talk
    -> DONE
}
~ valley_spice_mint = true
Fae picks a fragrant bundle of fresh Woodland Mint leaves for Chef Bea! ({valley_spice_count()}/3 festival spices!) # speaker: Fae # expr: happy # pose: cheer # sound: chime-green
{valley_spice_count() >= 3: That's all three valley spices! Let's bring them to Chef Bea at Bon Appetit Cafe! # speaker: Fae # expr: happy # pose: cheer}
-> DONE
= after
Fresh woodland mint leaves sway in the shady Whispering Woods breeze. # speaker: Fae # expr: happy # pose: idle
-> DONE
