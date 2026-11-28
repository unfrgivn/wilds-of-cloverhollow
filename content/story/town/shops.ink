=== bakery ===
The bakery smells like warm cinnamon buns. # speaker: Baker
{coins() < 5:
    You need 5 coins for a snack. Keep exploring! # speaker: Baker
    -> DONE
}
+ [Buy a snack for 5 coins]
    A fresh snack, wrapped up just for you! # speaker: Baker # buy: snack 5
+ [Not now]
    No rush! Come back when you're hungry. # speaker: Baker
- -> DONE

=== grocery ===
Fresh orchard apples and crunchy fish crackers! Every critter has a favourite. # speaker: Grocer
{coins() < 8:
    Treats are 8 coins each. Come back after calming a few critters! # speaker: Grocer
    -> DONE
}
+ {coins() >= 8} [Orchard Apple (8 coins)]
    Crisp orchard slices, packed in paper! Meadow and forest critters love these. # speaker: Grocer # buy-treat: orchard-apple 8
+ {coins() >= 8} [Fish Cracker (8 coins)]
    Crunchy fish crackers, fresh from the jar! Pups, cats, and beach critters adore them. # speaker: Grocer # buy-treat: fish-cracker 8
+ [Not now]
    Stop by whenever your backpack needs a treat! # speaker: Grocer
- -> DONE

=== ice_cream ===
Welcome to Cloverhollow Scoops! Nothing calms a fizzy day like ice cream. # speaker: Scoops
{coins() < 10:
    A Berry Swirl Cone is 10 coins, and a Cozy Cocoa Sundae is 12. See you soon! # speaker: Scoops
    -> DONE
}
+ {coins() >= 10} [Berry Swirl Cone (10 coins)]
    One double-scoop Berry Swirl Cone! Folks around town can't resist it. # speaker: Scoops # buy-treat: berry-cone 10
+ {coins() >= 12} [Cozy Cocoa Sundae (12 coins)]
    A warm Cozy Cocoa Sundae with marshmallows! Winter friends go wild for this. # speaker: Scoops # buy-treat: cocoa-sundae 12
+ [Not now]
    Keep cool out there, Fae! # speaker: Scoops
- -> DONE

=== dad ===
{met_dad: -> again}
Hey there, kiddo! Caught me sneaking a fresh cinnamon bun before work. # speaker: Dad
How are Mom and baby Oliver holding up this morning? Still trying to eat his own socks? # speaker: Dad
He almost got one in his mouth before breakfast! # speaker: Fae
Sounds like our little guy. Hey, I'm glad you've been carrying that notebook everywhere, Fae. # speaker: Dad
Your mom and I gave you that journal so you'd always have your own special adventures, even with baby Oliver keeping the house busy. # speaker: Dad
~ met_dad = true
Here, take an extra cinnamon bun for your backpack. # speaker: Dad # gift: snack 1
And ten shiny coins in case you spot something fun in town! # speaker: Dad # gift: coins 10
-> DONE
= again
{
- milo_revealed:
    Mom told me you brought Milo right back to himself under the Ancient Tree. # speaker: Dad
    That's my Fae. Brave, kind, and never giving up on a friend! # speaker: Dad
- gem_reward_all:
    Grandpa Barnaby told the whole cafe you found all seven Star Gems across the valley! # speaker: Dad
    Wait till Oliver's old enough to hear your treasure-hunting stories! # speaker: Dad
- sanctuary_reward_14:
    Whoa, Ranger Fern wove you a real Sanctuary Clover Wreath? It smells like sunshine! # speaker: Dad
    Every critter in Cloverhollow sure is lucky to have you, kiddo. # speaker: Dad
- buster_reward:
    Look at Cloverhollow's official Star-Line Explorer! Buster was beaming about your stamps! # speaker: Dad
    Save me a story from the coast and the mountains for dinner tonight, okay? # speaker: Dad
- sue_compass and jordan_clover:
    You visited Sue's beach cottage and Jordan's mountain cabin? What a crew you've got! # speaker: Dad
    Sounds like your journal is bursting with memories already, kiddo! # speaker: Dad
- has_lantern:
    Whoa, is that Jordan's hiking lantern? Look at my brave explorer, lighting up the whole valley! # speaker: Dad
    Save me a story for dinner tonight, okay kiddo? # speaker: Dad
- clubhouse_claimed:
    Mom told me you and your friends fixed up a real woodland clubhouse! # speaker: Dad
    I'm so proud of you, kiddo. Don't forget to snack between adventures! # speaker: Dad
- else:
    Have a great day at school and around town, kiddo! # speaker: Dad
    If you ever need a break, Bon Appetit's cocoa is always warm. # speaker: Dad
}
-> DONE

=== chef_bea ===
{spice_found and not spice_returned: -> return_spice}
{not spice_quest: -> ask_spice}
{not spice_found: -> remind_spice}
{
- calmed("taco-chef"):
    Chef Mateo and I have been trading Star Cinnamon and taco spice notes all week! # speaker: Chef Bea
    Cloverhollow's kitchens have never smelled happier, all thanks to you! # speaker: Chef Bea
- buster_reward:
    I've been baking extra travel buns for Buster's Star-Line riders, Star-Line Explorer! # speaker: Chef Bea
    Nothing pairs better with a window seat than warm Star Cinnamon! # speaker: Chef Bea
- bay_boat_charm:
    I heard you rowed a pastel boat out to Bubblegum Bay's sunny cove! # speaker: Chef Bea
    Sea air works up a big appetite, so my Star Cinnamon tray is fresh for you! # speaker: Chef Bea
- else:
    Welcome back, Fae! My Star Cinnamon buns are rising golden and tall thanks to you! # speaker: Chef Bea
}
-> cafe_shop

= ask_spice
Welcome to Bon Appetit Cafe, sweetie! Pull up a chair anytime. # speaker: Chef Bea
I was all set to bake a fresh tray of my famous Star Cinnamon buns, except a fizzy little raccoon zipped right past the pastry window this morning! # speaker: Chef Bea
It snatched my shiny Star Cinnamon tin and dropped it somewhere out in Meadow Park while tearing across the grass. # speaker: Chef Bea
~ spice_quest = true
If you spot a sparkly spice tin out by the picnic blanket in Meadow Park, would you bring it home to me? # speaker: Chef Bea
You got it, Chef Bea! # speaker: Fae
-> cafe_shop

= remind_spice
Any luck spotting my shiny Star Cinnamon tin out in Meadow Park, Fae? # speaker: Chef Bea
That fizzy raccoon zoomed right past the picnic blanket, so check the clover near it! # speaker: Chef Bea
-> cafe_shop

= return_spice
Oh my stars, you found my Star Cinnamon tin! Not even a single dent! # speaker: Chef Bea
~ spice_returned = true
You saved the whole morning bake, Fae! Here, take two fresh Star Cinnamon buns for the trail. # speaker: Chef Bea # gift: snack 2
And fifteen coins for being Cloverhollow's finest helper! # speaker: Chef Bea # gift: coins 15
Oh, and one more thing: my golden Bon Appetit Star Pin! Keep it safe with your favorite adventure treasures. # speaker: Chef Bea # sound: chime-blue
Whoa, it smells like warm cinnamon! I'll keep it in our clubhouse chest! # speaker: Fae
-> cafe_shop

= cafe_shop
{coins() < 5: Fresh cinnamon buns are 5 coins apiece whenever your backpack needs a snack! # speaker: Chef Bea}
+ {coins() >= 5} [Buy a warm cinnamon bun (5 coins)]
    One warm, swirly cinnamon bun, wrapped in wax paper just for you! # speaker: Chef Bea # buy: snack 5
    -> DONE
+ {spice_returned and (visited_pass or jordan_joined) and not valley_spice_done} [Ask about the Valley Spice Run]
    -> bea_spice_run
+ {spice_returned and coins() >= 50} [Bon Appetit Trail Basket — 50 coins (2 Brittle, 2 Taffy, 3 Snacks)]
    A ribbon-tied Bon Appetit Trail Basket packed with brittle, taffy, and three warm trail snacks! # speaker: Chef Bea # buy-basket: cafe-basket 50 # sound: chime-yellow
    -> DONE
+ {spice_returned and coins() >= 75} [Golden Valley Feast Basket — 75 coins (Sunberry, 2 Cones, 2 Brittle, 2 Snacks)]
    My grand Golden Valley Feast Basket, tucked with a shimmering Sunberry, cones, brittle, and warm snacks! # speaker: Chef Bea # buy-basket: valley-feast 75 # sound: chime-yellow
    -> DONE
+ [Just saying hi!]
    Always a treat to see your smiling face, Fae! Come back anytime. # speaker: Chef Bea
    -> DONE

=== park_spice_tin ===
{spice_found: -> after}
{spice_quest: -> collect}
A sparkly little tin tucked in the clover by the picnic blanket. It smells amazing, like warm cinnamon and vanilla! # speaker: Fae
-> DONE
= collect
A sparkly little tin tucked in the clover by the picnic blanket, stamped "Bon Appetit Star Cinnamon"! # speaker: Fae
~ spice_found = true
That's Chef Bea's missing spice tin! I'd better bring it right back to Bon Appetit Cafe. # speaker: Fae
-> DONE
= after
Just soft green clover by the picnic blanket, still smelling faintly of warm cinnamon. # speaker: Fae
-> DONE

=== barnaby ===
Ah, hello there, young Fae! Nothing beats a quiet cup of chamomile tea at Bon Appetit. # speaker: Grandpa Barnaby
When I was your age, folks around Cloverhollow whispered storybook legends about the Ancient Tree deep in the woods, and a glowing crystal cavern tucked high in the snowy pass. # speaker: Grandpa Barnaby
{
- calmed("hooded-kid"):
    And look at you now, bringing peace all the way to the Ancient Tree itself! The whole valley is humming again. # speaker: Grandpa Barnaby
- calmed("bat"):
    You even ventured into that glowing mountain cavern and calmed a bat! Those old legends really are alive! # speaker: Grandpa Barnaby
- calmed("owl"):
    Word reached town that you calmed the sleepy owl in Whispering Woods. That takes a steady heart! # speaker: Grandpa Barnaby
- calmed("hamster"):
    I heard you helped a snowy hamster up at Pinecone Pass! Nothing warms a mountain trail like kindness. # speaker: Grandpa Barnaby
- calmed("bluebird"):
    The breeze from Bubblegum Bay feels lighter already since you calmed that little bluebird! # speaker: Grandpa Barnaby
- calmed("fountain-frog"):
    Our town fountain sounds cheerful again since you sang to that grumpy frog! # speaker: Grandpa Barnaby
- else:
    If the town feels a little fizzy today, remember: a gentle song calms almost any ruffled feather. # speaker: Grandpa Barnaby
}
{(calmed("bluebird") or calmed("hamster") or calmed("bat") or calmed("owl")) and not barnaby_gift:
    ~ barnaby_gift = true
    Take these fifteen coins from an old storyteller, Fae. You've earned every single one keeping the valley peaceful! # speaker: Grandpa Barnaby # gift: coins 15
}
{
- gem_count() >= 7 and not gem_reward_all:
    ~ gem_reward_all = true
    ~ gem_reward_3 = true
    Well bless my teacup! You found ALL SEVEN Star Gems across Cloverhollow! Take these fifty coins for your grand treasure hunt! # speaker: Grandpa Barnaby # gift: coins 50
    And keep this Rainbow Star Geode for your clubhouse chest, along with a pair of warm snacks for the road! # speaker: Grandpa Barnaby # gift: snack 2 # sound: chime-red
- gem_reward_all and sanctuary_reward_14:
    All seven Star Gems AND Ranger Fern's Sanctuary Clover Wreath! What a golden chapter! # speaker: Grandpa Barnaby
- gem_reward_all and buster_reward:
    A Rainbow Star Geode and Buster's Golden Star-Line Whistle? A true valley legend, Fae! # speaker: Grandpa Barnaby
- gem_reward_all and sue_compass and jordan_clover:
    Sue's sea-glass compass, Jordan's pressed clover, and all seven Star Gems! Pure magic! # speaker: Grandpa Barnaby
- gem_count() >= 3 and not gem_reward_3:
    ~ gem_reward_3 = true
    My word, you've already found {gem_count()} gleaming Star Gems! Here are fifteen coins to cheer you on! # speaker: Grandpa Barnaby # gift: coins 15 # sound: chime-yellow
    Legend says seven Star Gems are tucked across Cloverhollow's lands, waiting for curious eyes and clever friends. # speaker: Grandpa Barnaby
- gem_count() > 0:
    I hear you've gathered {gem_count()} of 7 Star Gems so far! Keep shining your lantern and bringing your animal friends along! # speaker: Grandpa Barnaby
}
{has_lantern and not star_chart_done: -> barnaby_star_chart_prompt}
{star_chart_done: My restored Cloverhollow Star Chart hangs proud by my teacup thanks to your blacklight lantern, Fae! # speaker: Grandpa Barnaby # expr: happy # pose: talk}
-> DONE

=== bree ===
Heya, Fae! Catching a quick cocoa break between routes! # speaker: Bree
My Cloverhollow Star Bus loops right from the plaza's star sign out to Bubblegum Bay's sandy coast and all the way up to Pinecone Pass! # speaker: Bree
{
- has_lantern or rode_bus:
    Psst, little mountain tip from your friendly bus driver: if you hike north past Pinecone Pass's cocoa stand, there's a snowy gap in the cliffs leading into Crystal Cavern! # speaker: Bree
    I've seen amethyst and gold lights glittering right through the archway. Bring a good lantern if you go peeking! # speaker: Bree
- else:
    Whenever you're ready to visit the beach or the snowy mountains, just head to the star sign in the plaza and hop aboard! # speaker: Bree
}
{
- milo_revealed:
    Word on my whole bus route is you helped Milo find his smile again! Best news all week! # speaker: Bree
- buster_reward:
    Buster showed off your full Star-Line Stamp Card in the break room! Welcome to the club! # speaker: Bree
- sanctuary_visited:
    Passengers keep raving about Ranger Fern's Wildlife Sanctuary meadow up above the hills! # speaker: Bree
- sue_cottage_visited and jordan_cabin_visited:
    Cozy stops at Sue's beach cottage AND Jordan's mountain cabin? You're riding like a pro! # speaker: Bree
- sue_cottage_visited:
    Sue's little beach cottage smells like sea salt and sunshine. Best stop near the coast! # speaker: Bree
- jordan_cabin_visited:
    I always spot chimney smoke curling from Jordan's mountain cabin on my Pinecone Pass run! # speaker: Bree
- calmed("principal"):
    Even Mr. Bell waved at my bus this morning without a megaphone! Town feels cozy again! # speaker: Bree
}
-> DONE

=== toby ===
Whoa, hey Fae! Are you getting a cinnamon bun too? The icing swirls are HUGE today! # speaker: Toby
I was just at the arcade trying to beat my record on Boop-a-Mole, Skee-Ball, and Comet Cruise! # speaker: Toby
{milo_revealed:
    Whoa, turns out those scribbled Star Racer initials belonged to Milo! Good thing you helped him out! # speaker: Toby
- else:
    Star Racer's top high score is still scribbled out in purple marker, which is super mysterious. Nobody knows whose initials were under there! # speaker: Toby
}
Oh, pro tip for calming fizzy critters: swing by the Grocery Market and Cloverhollow Scoops for Favourite Treats! # speaker: Toby
If you toss a critter its favorite treat in a calm-down, it calms down WAY faster than a regular snack! # speaker: Toby
{
- buster_reward:
    Whoa, you finished Buster's whole Star-Line Stamp Card?! That Golden Whistle is SO cool! # speaker: Toby
- sanctuary_visited:
    Wait, you found Ranger Fern's Wildlife Sanctuary?! I bet all those calm critters love pets! # speaker: Toby
- sue_cottage_visited and jordan_cabin_visited:
    You got to hang out at Sue's beach cottage AND Jordan's cabin? Best hangout spots ever! # speaker: Toby
- sue_cottage_visited:
    Sue invited you to her beach cottage? Her sea-glass lamp sounds like arcade neon, only cozier! # speaker: Toby
- jordan_cabin_visited:
    Jordan's cabin up in Pinecone Pass sounds awesome! Bet the cocoa kettle never cools down! # speaker: Toby
- calmed("principal"):
    Heard you calmed Mr. Bell down in the school hall! No more super-loud megaphone pop quizzes! # speaker: Toby
}
{has_flute and not lullaby_done: -> toby_lullaby_prompt}
{lullaby_done: Half the plaza is humming our Sleepy Cloverhollow Lullaby already! Best flute duet partner ever, Fae! # speaker: Toby # expr: happy # pose: cheer}
-> DONE

=== cafe_pastries ===
Warm golden cinnamon rolls, flaky croissants, and berry tarts stacked under a gleaming glass dome! # speaker: Fae
Everything smells like butter, brown sugar, and a cozy Saturday morning. # speaker: Fae
-> DONE

=== cafe_menu ===
TODAY'S SPECIALS: Star Cinnamon Buns, Honey Marshmallow Cocoa, Warm Apple Tarts, and Crispy Tacos on Tuesdays! # speaker: Chalkboard
The little chalk drawings of steaming mugs are super cute. # speaker: Fae
-> DONE

=== cafe_window ===
Sunlight pours through the arched window, looking right out over Cloverhollow Plaza's fountain and flower boxes! # speaker: Fae
You can almost hear the water sparkling outside. # speaker: Fae
-> DONE

=== buster ===
{buster_reward: -> after}
{buster_quest: -> progress}
All aboard, kiddo! I'm Buster, driver of the Cloverhollow Star-Line! # speaker: Buster
My bus loops right from this star sign out to Bubblegum Bay's sandy beach and all the way up to Pinecone Pass's snowy pines. # speaker: Buster
~ buster_quest = true
Tell you what: take this Star-Line Stamp Card! Visit Bubblegum Bay's seaside stand for a wave stamp and Pinecone Pass's mountain stand for a pine stamp. # speaker: Buster
Bring me both stamps, and I've got my lucky Golden Star-Line Whistle plus a travel bonus waiting just for you! # speaker: Buster
{not club_open: We'll stay parked here until your clues point out of town, then just tap the star sign to hop aboard! # speaker: Buster}
Deal! I'll fill the whole Star-Line Stamp Card! # speaker: Fae
{milo_revealed: Sunny Cloverhollow is sparkling from Alpine Summit to Starlight Island to the Wildlife Sanctuary! # speaker: Buster}
-> DONE
= progress
{stamp_bay and stamp_pass: -> complete}
{stamp_bay:
    Ooh, you've got the Bubblegum Bay wave stamp already! One more to go! # speaker: Buster
    Next stop is Pinecone Pass's mountain stand for the crisp pine stamp. Hop on at the star sign whenever the mountain route's open! # speaker: Buster
    {milo_revealed: Sunny Cloverhollow is sparkling from Alpine Summit to Starlight Island to the Wildlife Sanctuary! # speaker: Buster}
    -> DONE
}
{stamp_pass:
    Hey, look at that Pinecone Pass pine stamp! Only one stamp left! # speaker: Buster
    Swing by Bubblegum Bay's seaside stand for the wave stamp, then bring that full card right back to me! # speaker: Buster
    {milo_revealed: Sunny Cloverhollow is sparkling from Alpine Summit to Starlight Island to the Wildlife Sanctuary! # speaker: Buster}
    -> DONE
}
Still got two empty star squares on your Star-Line Stamp Card, kiddo! # speaker: Buster
{not club_open: Once your town clues open the road out to Bubblegum Bay, tap the star sign right here and we'll roll out to the coast and mountains! # speaker: Buster|Visit Bubblegum Bay's seaside stand for a wave stamp and Pinecone Pass's mountain stand for a pine stamp, then come right back! # speaker: Buster}
{milo_revealed: Sunny Cloverhollow is sparkling from Alpine Summit to Starlight Island to the Wildlife Sanctuary! # speaker: Buster}
-> DONE
= complete
Whoa-ho! Let me take a peek at that Star-Line Stamp Card! # speaker: Buster
Both stamps, shiny as stars! You're an official Star-Line Explorer, Fae! # speaker: Buster
~ buster_reward = true
Here's twenty-five shiny coins for your travels... # speaker: Buster # gift: coins 25
...two fresh road snacks for the backpack... # speaker: Buster # gift: snack 2
...and my Golden Star-Line Whistle! Keep it safe in your clubhouse chest, kiddo! # speaker: Buster # sound: chime-yellow
Whoa, a real Golden Star-Line Whistle! Thanks, Buster! # speaker: Fae
-> DONE
= after
All aboard anytime, Star-Line Explorer! Keep that Golden Star-Line Whistle shining bright! # speaker: Buster
{
- milo_revealed:
    Sunny Cloverhollow is sparkling from Alpine Summit to Starlight Island to the Wildlife Sanctuary! # speaker: Buster
- sanctuary_visited:
    Heard Ranger Fern's Sanctuary meadow is full of calm critters! Best detour in the valley! # speaker: Buster
- sue_cottage_visited and jordan_cabin_visited:
    Stops at Sue's beach cottage AND Jordan's mountain cabin? You've mastered the whole Star-Line route! # speaker: Buster
- bay_boat_charm:
    I spotted your pastel rowboat bobbing out in Bubblegum Bay from the coastal bus stop! Smooth sailing! # speaker: Buster
- clubhouse_claimed:
    Heard your crew fixed up a cozy woodland clubhouse too! Now that's first-class travel! # speaker: Buster
- has_flute:
    That wooden flute sounds sweeter than my morning bus horn, kiddo! # speaker: Buster
- else:
    Whenever you want sea air or mountain snow, just tap the star sign down by the southern bus bench! # speaker: Buster
}
-> DONE

=== grocer_pippin ===
{market_visited: -> again}
~ market_visited = true
Well hello there, Fae! Welcome inside Cloverhollow Grocery Market! # speaker: Grocer Pippin
Every morning I pick crisp red apples out by the orchard fence and bake tiny crunchy fish crackers so every critter in the valley has a favourite snack. # speaker: Grocer Pippin
Here, take a complimentary Orchard Apple sample straight from the front crate! # speaker: Grocer Pippin # gift: snack 1
Ooh, it smells so fresh and crunchy! Thank you, Grocer Pippin! # speaker: Fae
Need any critter treats or trail snacks for your backpack today? # speaker: Grocer Pippin
-> market_shop
= again
{
- milo_revealed:
    So happy Milo and the whole valley feel sunny and calm again, Fae! Fresh apples are waiting! # speaker: Grocer Pippin
- sunberry_harvests > 0:
    That glowing Golden Sunberry from your clubhouse garden is pure orchard magic, Fae! Welcome back! # speaker: Grocer Pippin
- sanctuary_reward_14:
    Word is Ranger Fern's meadow is brimming with calm critters! That makes an old grocer smile, Fae! # speaker: Grocer Pippin
- buster_reward:
    Well hello, official Star-Line Explorer! That Golden Whistle deserves our crispest orchard apples! # speaker: Grocer Pippin
- else:
    Welcome back to Cloverhollow Grocery Market, Fae! Fresh apples and crunchy crackers straight off the shelves! # speaker: Grocer Pippin
}
-> market_shop
= market_shop
{coins() < 5:
    Trail Snacks are 5 coins and critter treats are 8 coins apiece. Stop back in anytime your pockets jingle! # speaker: Grocer Pippin
    -> DONE
}
+ {coins() >= 8} [Orchard Apple — 8 coins (sweet critters love it!)]
    Crisp orchard slices, wrapped in brown paper! Sweet critters in the meadows, hills, and caves adore these! # speaker: Grocer Pippin # buy-treat: orchard-apple 8
    -> DONE
+ {coins() >= 8} [Fish Cracker — 8 coins (pond & bay friends love it!)]
    Crunchy little fish crackers, warm from the jar! Pups, cats, and bay friends can't resist them! # speaker: Grocer Pippin # buy-treat: fish-cracker 8
    -> DONE
+ {coins() >= 5} [Trail Snack — 5 coins]
    One tidy trail snack wrapped up for the road! Happy exploring, Fae! # speaker: Grocer Pippin # buy: snack 5
    -> DONE
+ {coins() >= 45} [Cloverhollow Market Basket — 45 coins (2 Apples, 2 Crackers, 2 Snacks)]
    One woven Cloverhollow Market Basket packed with crisp apples, crunchy crackers, and two trail snacks! # speaker: Grocer Pippin # buy-basket: market-basket 45 # sound: chime-green
    -> DONE
+ [Just browsing!]
    Take your time! The jam shelves smell especially cozy today. # speaker: Grocer Pippin
    -> DONE

=== market_produce ===
Wooden produce bins brim with glossy red orchard apples, sunny oranges, and honey pears, all stacked into neat pyramids! # speaker: Fae
-> DONE

=== market_shelves ===
Tidy rows of homemade strawberry jam jars, crusty golden bread loaves, and brown paper grocery bags line the pine shelves! # speaker: Fae
-> DONE

=== market_berries ===
A stout timber barrel overflows with fresh wild berries picked along the meadow edges. # speaker: Fae
{has_lantern: Wait... Grocer Pippin mentioned someone tucked a glowing grocery list over by the jam shelves! Let's switch on Jordan's blacklight lantern and take a peek. # speaker: Fae|A tiny chalk doodle on the barrel rim hints that someone tucked an invisible-ink grocery list over by the jam shelves!}
-> DONE

=== market_list_glow ===
{market_note_read: -> again}
~ market_note_read = true
Under Jordan's blacklight lantern, a hidden lavender-ink recipe note lights up on the floorboards near the jam shelves! # speaker: Fae
\"SECRET ORCHARD TIP: Sweet critters in the meadows, hills, and caves go wild for Orchard Apples, while bay & pond friends can't resist Fish Crackers!\" # speaker: Glow Note
Ooh, and ten lucky change coins are tucked neatly under the note! # speaker: Fae # sound: chime-yellow # gift: coins 10
-> DONE
= again
The glowing Cloverhollow Recipe Note shimmers softly: Orchard Apples for sweet meadow, hill, and cave critters, and Fish Crackers for bay and pond friends! # speaker: Fae
-> DONE

=== scooper_penny ===
{parlor_visited: -> again}
~ parlor_visited = true
Yay, welcome inside Sweet Scoop Ice Cream Parlor, Fae! Pull up a stool! # speaker: Scooper Penny
Every first-time visitor gets a complimentary Cloverhollow Dream Sundae made to order! Which flavor should I scoop for your crew? # speaker: Scooper Penny
+ [Strawberry Swirl!]
    One towering Strawberry Swirl Dream Sundae, coming right up! # speaker: Scooper Penny # gift: snack 1 # sound: chime-blue
    Maddie's whiskers twitch as she happily licks a tiny pink ribbon of foam right off her nose! # speaker: Fae
    {sue_joined: Best strawberry swirl in town! Even sweeter than bay boardwalk taffy! # speaker: Sue}
    {jordan_joined: Whoa, it tastes like fresh clubhouse berries! # speaker: Jordan}
    -> parlor_shop
+ [Mint Cloud Chip!]
    One fluffy Mint Cloud Chip Dream Sundae with crispy cocoa sprinkles! # speaker: Scooper Penny # gift: snack 1 # sound: chime-blue
    Maddie gives one curious sniff, sneezes a tiny minty puff, and purrs like a motorboat! # speaker: Fae
    {sue_joined: Minty and cool like a sea breeze! Ten out of ten! # speaker: Sue}
    {jordan_joined: Reminds me of snowy Pinecone Pass air, only way tastier! # speaker: Jordan}
    -> parlor_shop
+ [Warm Honey Caramel!]
    One golden Warm Honey Caramel Dream Sundae, swirled nice and cozy! # speaker: Scooper Penny # gift: snack 1 # sound: chime-blue
    Maddie curls right around Fae's boots, eyes half-closed in pure caramel bliss! # speaker: Fae
    {sue_joined: Ooh, sticky-sweet perfection! Save me a spoonful! # speaker: Sue}
    {jordan_joined: Now THAT is prime mountain-explorer fuel! # speaker: Jordan}
    -> parlor_shop
= again
{
- milo_revealed:
    Peace is back in Cloverhollow, Fae! I saved extra rainbow victory sprinkles for you and Milo! # speaker: Scooper Penny
- sue_compass and jordan_clover:
    You visited Sue's beach cottage AND Jordan's mountain cabin? You earned double scoops today, Fae! # speaker: Scooper Penny
- bay_boat_charm:
    I heard you took a pastel rowboat out across Bubblegum Bay! Sunny harbor cruises deserve ice cream! # speaker: Scooper Penny
- buster_reward:
    Ooh, Buster's Golden Star-Line Whistle! Nothing pairs with explorer whistles like crisp waffle cones! # speaker: Scooper Penny
- else:
    Welcome back to Sweet Scoop Ice Cream Parlor, Fae! The waffle cones are extra crispy today! # speaker: Scooper Penny
}
-> parlor_shop
= parlor_shop
{coins() < 10:
    Berry Swirl Cones are 10 coins and Cozy Cocoa Sundaes are 12 coins. Come cool off anytime! # speaker: Scooper Penny
    -> DONE
}
+ {coins() >= 10} [Berry Swirl Cone — 10 coins (sunny friends & shopkeepers love it!)]
    One double-scoop Berry Swirl Cone! Sunny critters and Cloverhollow shopkeepers adore this scoop! # speaker: Scooper Penny # buy-treat: berry-cone 10
    -> DONE
+ {coins() >= 12} [Cozy Cocoa Sundae — 12 coins (cozy winter & cave friends love it!)]
    One warm Cozy Cocoa Sundae with fluffy marshmallows! Winter and cave friends melt into smiles for this! # speaker: Scooper Penny # buy-treat: cocoa-sundae 12
    -> DONE
+ {coins() >= 55} [Sweet Scoop Party Basket — 55 coins (2 Berry Cones, 2 Sundaes, 2 Snacks)]
    One pastel Sweet Scoop Party Basket packed with Berry Swirl Cones, Cozy Cocoa Sundaes, and two sweet snacks! # speaker: Scooper Penny # buy-basket: parlor-basket 55 # sound: chime-blue
    -> DONE
+ [Just admiring the flavors!]
    Keep cool out there, Fae! Our pastel tubs are always ready for a scoop break! # speaker: Scooper Penny
    -> DONE

=== parlor_gelato ===
Seven pastel tubs of strawberry, mint, vanilla-bean, and hot-cocoa swirl ice cream gleam beneath the curved glass case beside tall stacks of crispy waffle cones! # speaker: Fae
-> DONE

=== parlor_menu ===
Hand-lettered pastel chalk spells out today's parlor specials: Berry Swirl Cones, Cozy Cocoa Sundaes, and Double-Scoop Rainbow Bowls! # speaker: Fae
-> DONE

=== parlor_window ===
Through the sunny blue-striped awning window, Cloverhollow Plaza's fountain sparkles beside the flower planters! # speaker: Fae
{has_lantern: A tiny pastel sticker on the sill winks about a \"Secret Sundae Club\" invisible-ink doodle over by the curved gelato case! # speaker: Fae|A tiny pastel sticker on the sill winks about an invisible-ink \"Secret Sundae Club\" doodle hidden near the curved gelato case! # speaker: Fae}
-> DONE

=== parlor_secret_glow ===
{parlor_note_read: -> again}
~ parlor_note_read = true
Under Jordan's blacklight lantern, a sparkling lavender \"Secret Sundae Club\" doodle glows right beside the curved gelato case! # speaker: Fae
\"SCOOP MASTER SECRET: Try sharing a Berry Swirl Cone or Cozy Cocoa Sundae in battle—seeing their favourite treat melts chaos fizz right away!\" # speaker: Glow Note
And ten shiny parlor coins gleam neatly beside the secret doodle! # speaker: Fae # sound: chime-yellow # gift: coins 10
-> DONE
= again
The sparkling \"Secret Sundae Club\" glow-ink doodle reminds Fae that sharing a critter's favourite Berry Swirl Cone or Cozy Cocoa Sundae melts chaos fizz right away! # speaker: Fae
-> DONE

=== taco_flyer ===
{not taco_chef_out:
    A bright paper flyer fluttering in the Clover Hills grass: "CLOVERHOLLOW TACO TRUCK! Crispy Tacos, Lime Squeeze, & Warm Smiles!" # speaker: Flyer
    Suddenly a swirling purple spice cloud puffs up beside the meadow path! # speaker: Fae
    ~ taco_chef_out = true
    WHOOSH! Chef Mateo marches into the clearing with swirly eyes, waving his wooden spoon! # speaker: Fae
    -> DONE
}
{calmed("taco-chef"):
    The colorful Cloverhollow Taco Truck flyer is pinned neatly to a clover post. It smells delicious out here! # speaker: Fae
- else:
    The bright Cloverhollow Taco Truck flyer flutters wildly in Chef Mateo's spicy breeze! # speaker: Fae
}
-> DONE

=== mateo_talk_1 ===
Nobody in Cloverhollow even CARES about crispy tacos anymore! My whole recipe feels fizzed up! # speaker: Chef Mateo
+ [Bon Appetit's chalkboard has Tuesday tacos!]
    Wait... Chef Bea wrote my crispy tacos right on the cafe chalkboard?! That warms my whole apron! # speaker: Chef Mateo # grade: great
    -> DONE
+ [Folks in town love your warm kitchen smell!]
    Hmph... well, my salsa DOES smell pretty amazing across the hills. # speaker: Chef Mateo # grade: good
    -> DONE
+ [Maybe tacos are just too crunchy?]
    TOO CRUNCHY?! Crunch is the soul of a taco, kiddo! # speaker: Chef Mateo # grade: miss
    -> DONE
-> DONE

=== mateo_talk_2 ===
Even the kids at school probably forgot what taco day tastes like... # speaker: Chef Mateo
+ [Principal Bell announced "Lunch is tacos!"]
    He announced taco day on the school speaker?! HA! I knew folks were excited! # speaker: Chef Mateo # grade: great
    -> DONE
+ [My whole class gets hungry before recess!]
    That's true! Hungry explorers always need a good lunch! # speaker: Chef Mateo # grade: good
    -> DONE
+ [Maybe everyone only wants cinnamon buns?]
    Hey, cinnamon buns are great, but you can't beat a warm taco for lunch! # speaker: Chef Mateo # grade: miss
    -> DONE
-> DONE

=== mateo_talk_3 ===
Why do you think folks keep coming back to my taco window anyway, Fae? # speaker: Chef Mateo
+ [Sharing crunchy snacks makes friends smile!]
    ...You're right, Fae. Cooking isn't about shouting louder, it's about sharing with friends! # speaker: Chef Mateo # grade: great
    -> DONE
+ [Your wooden spoon looks super professional!]
    Haha, well it IS my favorite stirring spoon, and it works best with a calm chef! # speaker: Chef Mateo # grade: good
    -> DONE
+ [Spicy clouds clear out stuffed noses?]
    Whoa, nobody wants a sneezy taco! Let me dial down the cayenne! # speaker: Chef Mateo # grade: miss
    -> DONE
-> DONE

=== taco_chef_calm ===
{mateo_snacks_given: -> again}
Whew... my head feels clear again! Thank you for talking me down, Fae! # speaker: Chef Mateo
A kid in a purple hood zoomed past my truck and handed me a fizzy purple soda as a "new drink idea." One sip and I started tossing spice clouds everywhere! # speaker: Chef Mateo
~ mateo_snacks_given = true
Here, take two fresh crispy taco snacks on the house for you and your friends! # speaker: Chef Mateo # gift: snack 2
And keep my shiny Golden Taco Badge in your clubhouse chest! You're officially Cloverhollow's best taste-tester! # speaker: Chef Mateo # sound: chime-yellow
Awesome! Thanks, Chef Mateo! # speaker: Fae
-> mateo_shop
= again
Hola, Fae! The grill is warm, the limes are fresh, and there's zero purple fizz in the salsa! # speaker: Chef Mateo
-> mateo_shop
= mateo_shop
{coins() < 4: Crispy taco snacks are 4 coins apiece whenever you want a crunch! # speaker: Chef Mateo}
+ {coins() >= 4} [Buy a crispy taco snack for 4 coins]
    One hot, crispy Cloverhollow taco, wrapped up tight for your backpack! # speaker: Chef Mateo # buy: snack 4
    -> DONE
+ [Help run the Taco Truck kitchen!]
    Put on your lucky apron, Fae—let's build some crispy Cloverhollow tacos! # speaker: Chef Mateo # play: taco 0
    -> DONE
+ [Just saying hi!]
    Always happy to see my favorite taste-tester, Fae! Come back anytime. # speaker: Chef Mateo
    -> DONE
