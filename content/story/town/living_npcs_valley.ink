// Living NPCs across Cloverhollow: reactive townfolk, classmates, and trail neighbors.
=== npc_flora ===
{lanternOn():
    Oh, my word! Shining that little lantern makes every petal in the plaza shimmer like starlight! # speaker: Flora
}
{
- calmed("hooded-kid"):
    Look at these tulips now, Fae! Ever since you helped Milo feel right at home, every flowerbed in Cloverhollow is beaming! # speaker: Flora
- calmed("fountain-frog") and areaCalm():
    Hello, dear! With the fountain sparkling clean again, the whole plaza smells like sweet clover and sunshine. # speaker: Flora
- not areaCalm():
    Goodness me, Fae! A fizzy critter is bouncing right near my flower boxes! Mind your boots out there! # speaker: Flora
- else:
    Good morning, Fae! Pink bubbles from that fountain keep drifting straight into my marigolds. # speaker: Flora
}
{withParty("sue"):
    Your tulips always make the plaza feel brighter, Flora! # speaker: Sue
}
{withParty("jordan"):
    Those marigolds look even healthier than the wildflowers up on Pinecone Pass. # speaker: Jordan
}
{not garden_gift and (garden_ripe or withParty("ribbon-bunny")): -> garden_gift}
+ [Ask about her flowers]
    I planted clover, daisies, and sweet marigolds along the plaza walk. Kind hearts make a town bloom faster than fertilizer! # speaker: Flora
    {stickers() >= 5: With {stickers()} calm-down stickers in your book, you've been spreading kindness everywhere! # speaker: Flora}
    -> DONE
+ [Ask if she saw anything unusual]
    {calmed("hooded-kid"):
        Just happy neighbors and calm critters now! Every trail feels peaceful again. # speaker: Flora
    - else:
        Early this morning, a kid in a purple hood zoomed past my planters carrying a fizzy soda bottle. Left a trail of pink bubbles! # speaker: Flora
    }
    -> DONE
= garden_gift
{withParty("ribbon-bunny"):
    Why, look at your darling Ribbon Bunny sniffing my garden basket! She has the softest nose! # speaker: Flora
- else:
    I heard your clubhouse strawberry patch ripened! Fellow gardeners always share the harvest! # speaker: Flora
}
Here, take two honey-clover garden snacks for your backpack, Fae! # speaker: Flora # gift: snack 2 # sound: chime-green
Thank you so much, Flora! # speaker: Fae
-> DONE

=== npc_sammy_plaza ===
{lanternOn():
    Whoa! Purple glow-light! That looks like a secret arcade power-up! # speaker: Sammy
}
{
- not areaCalm():
    Whoa, Fae! There's a fizzy critter zooming around the plaza! Total boss battle energy! # speaker: Sammy
- clubhouse_claimed:
    Psst, Fae! The Cloverhollow Arcade lights just flickered back on! Someone inside sounded super fizzy though... # speaker: Sammy
- else:
    Heya, Fae! I've got a pocket full of shiny coins waiting for the arcade doors to open up! # speaker: Sammy
}
{withParty("sue"):
    Save us a turn on Skee-Ball once Mr. Pip opens up, Sammy! # speaker: Sue
}
+ [Ask about the arcade games]
    Boop-a-Mole, Skee-Ball, Comet Cruise, AND the claw machine! I'm totally winning a plushie today! # speaker: Sammy
    {stickers() >= 3: You've got {stickers()} stickers already? You've got serious gamer reflexes, Fae! # speaker: Sammy}
    -> DONE
+ [Ask about the purple fizz]
    {calmed("hooded-kid"):
        Wild that Milo could zip around so fast with that pond fizz! Glad he's hanging out with everyone again! # speaker: Sammy
    - else:
        I saw a kid in a purple hood peek right through the arcade window earlier, grinning like they had a cheat code! # speaker: Sammy
    }
    -> DONE

=== npc_sammy_arcade ===
{lanternOn():
    Whoa, purple lantern light in the arcade! This place looks twice as awesome! # speaker: Sammy
}
{
- won("star-racer-keychain"):
    NO WAY! You snagged the Star Racer Keychain from the ticket counter?! Legend status, Fae! # speaker: Sammy
- tickets() >= 10:
    Whoa, you've already racked up {tickets()} arcade tickets! Check out the counter before the good stuff goes! # speaker: Sammy
- else:
    YES! The arcade is back open, and Mr. Pip is totally chilled out again! Thanks a million, Fae! # speaker: Sammy
}
{withParty("sue"):
    First one to hit the top corner ring on Skee-Ball buys the cinnamon buns! # speaker: Sue
}
{withParty("jordan"):
    I'm aiming straight for Comet Cruise. Let's see how many stars we can catch! # speaker: Jordan
}
{not arcade_coins: -> arcade_coins}
+ [Ask for a high-score tip]
    On Skee-Ball, watch the aim arrow bounce cleanly off the edges. And on Boop-a-Mole, each mole gets a little quicker! # speaker: Sammy
    -> DONE
+ [Compare favorite machines]
    I love Comet Cruise, even when the rocks wobble past! {level() >= 4: At level {level()}, your timing must be unstoppable!|Keep practicing and you'll rule the scoreboard!} # speaker: Sammy
    -> DONE
= arcade_coins
Hey, you saved the whole arcade for all of us! Take ten arcade coins from my spare token pouch! # speaker: Sammy # gift: coins 10 # sound: chime-yellow
Awesome! Thanks, Sammy! # speaker: Fae
-> DONE

=== npc_pippa ===
{lanternOn():
    Ooh! Your blacklight lantern makes the park clover twinkle like tiny fireflies! # speaker: Pippa
}
{
- not areaCalm():
    Eep! Look out, Fae! The park critters got super bouncy from that purple fizz! # speaker: Pippa
- club_open:
    Whoa, you actually figured out the tree house password?! You're the coolest detective in Meadow Park! # speaker: Pippa
- else:
    Hi, Fae! Welcome to Meadow Park! I know every hiding spot, tree branch, and giggling critter in this meadow! # speaker: Pippa
}
{withParty("pond-pup"):
    AWW! Pond Pup is trotting right beside you! Look at that happy tail wag! # speaker: Pippa
}
{withParty("maddie"):
    Maddie looks extra fluffy in the park breeze today! # speaker: Pippa
}
{treats() > 0: Ooh, you're carrying specialty treats! Park critters go bananas for their favorite flavor! # speaker: Pippa}
+ [Try Pippa's Park Critter Riddle]
    -> riddle
+ [Ask what she spotted in the park]
    {calmed("hooded-kid"):
        Everything in Meadow Park is calm and cozy now! Even the pond ripples sound like a lullaby. # speaker: Pippa
    - else:
        Earlier a kid in a purple hood scrambled right past the picnic blanket whispering some silly password to the tree house! # speaker: Pippa
    }
    -> DONE
= riddle
Okay, ready? Which Meadow Park critter loves splashing by the water and once chased a fuzzy tennis ball? # speaker: Pippa
+ [The Pond Pup!]
    DING DING DING! You nailed it, Fae! Pond Pup is the splashiest friend in the whole park! # speaker: Pippa
    {not riddle_prize: -> riddle_prize}
    You're a certified park critter pro! # speaker: Pippa
    -> DONE
+ [A flying marshmallow?]
    Hee hee! If there's a flying marshmallow in Meadow Park, I want to meet it too! Try again anytime! # speaker: Pippa
    -> DONE
= riddle_prize
For acing my Meadow Park riddle, here's a crunchy park snack and five shiny coins! # speaker: Pippa # gift: snack 1 # gift: coins 5 # sound: chime-yellow
Yay, thanks Pippa! # speaker: Fae
-> DONE

=== npc_leo_hall ===
{lanternOn():
    Whoa! An ultraviolet blacklight beam! You could spot invisible ink all down East Hall with that! # speaker: Leo
}
{
- art_open:
    Ms. Rowan's Art Room is back open! I logged every purple paint swirl in my notebook before it cleared. # speaker: Leo
- art_teacher_out:
    Careful down the east end of the hall, Fae! Ms. Rowan got hit with purple fizz and is painting mid-air loops! # speaker: Leo
- else:
    Hey, Fae! I'm keeping a scientific log of every fizzy happening at Cloverhollow School! # speaker: Leo
}
{withParty("jordan"):
    Smart thinking taking notes, Leo. Good field logs always solve a trail mystery! # speaker: Jordan
}
{not npc_leo_hall.grant and not npc_leo_field.grant and stickers() >= 6: -> grant}
+ [Share your sticker count]
    Let's see... {stickers()} stickers recorded so far, and explorer level {level()}! # speaker: Leo
    {stickers() < 6: Bring me at least six critter stickers and I'll award you a Junior Field-Research Grant!|That's extraordinary field data, Fae!} # speaker: Leo
    -> DONE
+ [Ask about East Hall clues]
    {calmed("hooded-kid"):
        Now that Milo explained the Mystic Pond wish, every single fizz spike in my chart fits together! # speaker: Leo
    - else:
        Someone in a purple hood sprinted past these lockers way faster than normal jogging speed. Definitely fizz-powered! # speaker: Leo
    }
    -> DONE
= grant
Wait a second! You've already gathered {stickers()} critter stickers?! That qualifies for my official Junior Field-Research Grant! # speaker: Leo
Here are fifteen shiny coins to fund your continuing valley fieldwork! # speaker: Leo # gift: coins 15 # sound: chime-blue
Whoa, thanks Professor Leo! # speaker: Fae
-> DONE

=== npc_leo_field ===
{lanternOn():
    Testing your blacklight out in the sunshine? Clever! Hidden markers still react under UV light! # speaker: Leo
}
{
- not areaCalm():
    Heads up, Fae! That oak squirrel by the creek is tossing acorns at warp speed! # speaker: Leo
- stash_found:
    You found the hidden stash behind the stump?! Purple markers and a Star Racer token, huge breakthrough! # speaker: Leo
- bridge_down:
    Lowering the old footbridge with a lasso was pure engineering brilliance, Fae! # speaker: Leo
- else:
    Recess! Best time to map the playing field and check why the creek squirrel got so jumpy! # speaker: Leo
}
{withParty("acorn-squirrel"):
    An actual Acorn Squirrel on your team?! Hold on, let me sketch its climbing posture! # speaker: Leo
}
{not npc_leo_hall.grant and not npc_leo_field.grant and stickers() >= 6: -> grant}
+ [Ask about the playing field]
    The old oak branch stretches right over the creek, and there's a wooden lever across on the far bank. # speaker: Leo
    -> DONE
+ [Check your explorer stats]
    Explorer level {level()}, {stickers()} stickers logged, and {gem_count()} Star Gems charted! Top-notch work, Fae! # speaker: Leo
    -> DONE
= grant
Hold everything! {stickers()} critter stickers in your field album?! You earned my Junior Field-Research Grant! # speaker: Leo
Take fifteen shiny coins for your explorer supply kit! # speaker: Leo # gift: coins 15 # sound: chime-blue
Awesome, thanks Leo! # speaker: Fae
-> DONE

=== npc_maya_field ===
{lanternOn():
    Ooh! Your lantern casts the dreamiest lavender glow across the grass! # speaker: Maya
}
{
- not areaCalm():
    Whoa, watch your sketchbook! That fizzy squirrel by the oak is flinging acorns everywhere! # speaker: Maya
- saw_hood:
    Did you see that kid in a purple hood bolt past hopscotch? They dropped purple chalk sparks all over my shoes! # speaker: Maya
- else:
    Hey, Fae! Since the Art Room door is locked right now, I'm sketching clouds out here during recess! # speaker: Maya
}
{withParty("ribbon-bunny"):
    Eek, a Ribbon Bunny! Her pink bow matches my watercolor palette! # speaker: Maya
}
+ [Ask about the missing purple markers]
    Every single purple marker in the Art Room vanished overnight! Somebody must be on the world's biggest doodle spree. # speaker: Maya
    -> DONE
+ [Ask what she's drawing]
    A giant rainbow mural of Cloverhollow School, with extra sparkles around the oak tree! # speaker: Maya
    -> DONE

=== npc_maya_art ===
{lanternOn():
    Ooh, blacklight glow in the Art Room! All the neon paint tubes are lighting up like magic! # speaker: Maya
}
{
- calmed("hooded-kid"):
    Milo told us he wants to help repaint the hallway banner together! Having all our classmates back feels wonderful! # speaker: Maya
- else:
    Hooray! Ms. Rowan is feeling calm again, and the Art Room is finally open! Thank you, Fae! # speaker: Maya
}
{withParty("sue"):
    Your ocean paintings on the wall look just like Bubblegum Bay at sunset, Maya! # speaker: Sue
}
{withParty("jordan"):
    Next time you paint Pinecone Pass, add a couple of happy snow hamsters! # speaker: Jordan
}
{npc_wren.sketch_complete:
    Did you see Wren's finished Field Compendium?! That crystal rubbing and pressed clover inspired my whole new gallery series! # speaker: Maya
}
{not art_snack: -> art_snack}
+ [Look at her easel]
    I'm painting all the calm critters you've helped! {stickers() >= 8: With {stickers()} stickers in your album, I'm going to need a bigger canvas!|Tell me every new critter you meet!} # speaker: Maya
    -> DONE
+ [Ask about Ms. Rowan's paints]
    Ms. Rowan mixed a fresh batch of lavender paint: zero fizz, maximum sparkle! # speaker: Maya
    -> DONE
= art_snack
Before you head back out, take one of my lucky studio snacks! Artists and explorers both need fuel! # speaker: Maya # gift: snack 1 # sound: chime-yellow
Thanks, Maya! # speaker: Fae
-> DONE

=== npc_sal ===
{lanternOn():
    Shiver me compass! That glowing purple lantern shines brighter than the harbor lighthouse! # speaker: Captain Sal
}
{
- not areaCalm():
    Steady on deck, young skipper! There's a fizzy critter kicking up sand along the cove! # speaker: Captain Sal
- calmed("lifeguard"):
    Ahoy, Fae! With Ms. Coral back in good spirits and the beach calm, Bubblegum Bay is pure smooth sailing! # speaker: Captain Sal
- else:
    Ahoy there, Fae! Welcome to Bubblegum Bay, where the sand stays warm and the tide brings shiny surprises! # speaker: Captain Sal
}
{withParty("sue"):
    Ahoy, Sue! Still the sharpest fisher on the pier, I see! # speaker: Captain Sal
    You bet, Captain Sal! Saving the biggest waves for Fae's crew! # speaker: Sue
}
{withParty("pond-pup"):
    Ha! A seafaring Pond Pup! Bet that little matey could fetch treasure right out of the tide pools! # speaker: Captain Sal
}
{not harbor_snack: -> harbor_snack}
+ [Ask for a Bubblegum Bay sea tale]
    {treasure_found:
        Blimey, you actually dug up the old pirate treasure between the palms! That tale's true after all! # speaker: Captain Sal
    - else:
        Legend says an old sea captain corked a treasure map in a glass bottle and tossed it off the eastern dock! # speaker: Captain Sal
    }
    -> DONE
+ [Talk about Star Gems and tides]
    {gem_count() > 0:
        You've already charted {gem_count()} Star Gems?! Even the deep tide pools glint with hidden gems if a good swimmer looks! # speaker: Captain Sal
    - else:
        Keep your eyes peeled along the rocky surf. Shimmering treasures love hiding where the sea foam sparkles! # speaker: Captain Sal
    }
    -> DONE
+ {npc_gus.gave_postcard and not gave_mountain_letter} [Deliver Gus's Seashell Postcard!]
    -> gave_mountain_letter
= harbor_snack
Every brave harbor explorer deserves rations for the voyage! Take two salty-sweet sea-breeze snacks, Fae! # speaker: Captain Sal # gift: snack 2 # sound: chime-blue
Aye-aye, Captain Sal! Thank you! # speaker: Fae
-> DONE
= gave_mountain_letter
Well blow me down! Mailman Gus's Seashell Postcard sailed straight to the pier! Take eight shiny harbor coins for your swift feet, Fae! # speaker: Captain Sal # gift: coins 8 # sound: chime-blue
While you're charting the high roads, would you carry this Mountain Reply Letter up to Mina in Pinecone Pass? # speaker: Captain Sal
You bet, Captain Sal! I'll deliver it straight to Mina! # speaker: Fae
-> DONE

=== npc_nora ===
{lanternOn():
    Whoa! Your lantern makes all the wet seashells along the shore glow neon! # speaker: Nora
}
{
- not areaCalm():
    Hey! Keep those fizzy critters away from my shell collection! They almost flattened my tower! # speaker: Nora
- calmed("crab"):
    The little south-beach crabs stopped pinching and started tapping funny rhythms on the shells! So cute! # speaker: Nora
- else:
    Hi, Fae! I'm hunting for the rarest pink spiral shells in all of Bubblegum Bay! # speaker: Nora
}
{withParty("pond-pup"):
    Ooh, Pond Pup! Wanna help me sniff out shiny shells near the surf? # speaker: Nora
}
{withParty("sue"):
    Save me a lucky pink shell for my tackle box, Nora! # speaker: Sue
}
+ [Ask about her shell collection]
    I've got scalloped shells, star-striped shells, and a tiny pearl button! {treasure_found: Still nothing beats your real pirate treasure though!|One day I'll find pirate treasure too!} # speaker: Nora
    -> DONE
+ [Ask if she saw the hooded kid]
    {calmed("hooded-kid"):
        Hard to believe Milo zoomed all the way from town to the beach and back! Glad everything's chill now! # speaker: Nora
    - else:
        Someone in a purple hood sprinted right past the palm trees leaving fizzy purple footprints that popped in the surf! # speaker: Nora
    }
    -> DONE

=== npc_lark ===
{lanternOn():
    Aha! Carrying a trusty lantern on the cliffside ridge! Textbook backcountry preparedness, Fae! # speaker: Hiker Lark
}
{
- not areaCalm():
    Easy on the gravel, Fae! Fizzy critters have been hopping right across the Cliffside Trail! # speaker: Hiker Lark
- calmed("gull"):
    Listen to that ridge breeze now! Ever since you calmed the lookout gull, the cliffside songbirds came right back! # speaker: Hiker Lark
- else:
    Well hello, fellow trailblazer! Nothing beats birdwatching along the ridge between Bubblegum Bay and Pinecone Pass! # speaker: Hiker Lark
}
{withParty("jordan"):
    Jordan! Still hiking these switchbacks faster than the mountain squirrels? # speaker: Hiker Lark
    Only because I know where all the best lookout snacks are, Lark! # speaker: Jordan
}
{withParty("ribbon-bunny"):
    Oh, a Ribbon Bunny! Look how nimbly she spots tiny clover burrows tucked beneath the cliff boulders! # speaker: Hiker Lark
}
{shared_snack:
    Still grateful for that trail snack you shared, Fae! Best hiking fuel on the ridge! # speaker: Hiker Lark
}
{not gull_reward and calmed("gull"): -> gull_reward}
+ [Ask about wildlife on the trail]
    Bunnies and squirrels dart across the clover bends, and there's a grand ocean view out east by the lookout bench! # speaker: Hiker Lark
    {gem_count() > 0: And with {gem_count()} Star Gems found already, you've got true naturalist eyes! # speaker: Hiker Lark}
    -> DONE
+ [Ask where the trail leads]
    South winds down to warm Bubblegum Bay, and northwest climbs straight into the snowy pines of Pinecone Pass! # speaker: Hiker Lark
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= gull_reward
You calmed the lookout gull and brought peace back to my favorite birdwatching bench! # speaker: Hiker Lark
Please take fifteen shiny coins from my trail-spotter pouch! You earned every single one, Fae! # speaker: Hiker Lark # gift: coins 15 # sound: chime-green
Thanks so much, Hiker Lark! # speaker: Fae
-> DONE
= shared_snack
Here, Hiker Lark! I brought a trail snack to share! # speaker: Fae # feed: snack 1
Well now, that's proper trail fellowship, Fae! Crispy, sweet, and just what a ridge walker needs! # speaker: Hiker Lark
Here are eight shiny trail coins from my field pouch to say thank you! # speaker: Hiker Lark # gift: coins 8 # sound: chime-green
-> DONE

=== npc_mina ===
{lanternOn():
    Oh, how magical! Your blacklight beam turns the fresh snow on Pinecone Pass into sparkling stardust! # speaker: Mina
}
{
- not areaCalm():
    Oh my mittens! A fizzy mountain critter is darting through the drifts nearby! Stay warm and careful, Fae! # speaker: Mina
- lodge_open:
    What a joy seeing smoke curl from Mrs. Flurry's chimney again! The whole snowy pass feels ten degrees warmer! # speaker: Mina
- else:
    Welcome up to Pinecone Pass, dear! Nothing wakes you up like crisp mountain pine air and sweet cocoa! # speaker: Mina
}
{withParty("jordan"):
    Jordan, sweetheart, don't forget to zip up your jacket on the high ridge! # speaker: Mina
    Already zipped, Mina! And Fae's got snacks for the whole crew! # speaker: Jordan
}
+ [Ask about Pinecone Pass sights]
    {scarf_returned:
        The cocoa stand's smiling ear to ear ever since you lassoed that red scarf right off the ski lift! # speaker: Mina
    - else:
        Between the cocoa stand, the ski lift, and the snowy northern archways, this mountain is full of cozy secrets! # speaker: Mina
    }
    {calmed("penguin"): Even the belly-sliding penguin on the north slope is waddling happily now! # speaker: Mina}
    -> DONE
+ [Ask about the purple fizz up here]
    {calmed("hooded-kid"):
        I'm so glad Milo's wish turned out peacefully in the end. Everybody needs good friends to cheer them on! # speaker: Mina
    - else:
        A kid in a purple hood raced past the ski lift earlier, leaving glowing prints in the snow! # speaker: Mina
    }
    -> DONE
+ {npc_sal.gave_mountain_letter and not received_letter} [Deliver Captain Sal's Mountain Letter!]
    -> received_letter
= received_letter
Oh, goodness! A Mountain Reply Letter all the way from Captain Sal down at Bubblegum Bay! # speaker: Mina
Thank you from the bottom of my cocoa mug, Fae! Take twenty coins and two cozy mountain snacks for your pack! # speaker: Mina # gift: coins 20 # gift: snack 2 # sound: chime-red
Do let Mailman Gus know his cross-valley letter arrived safe and sound! # speaker: Mina
I will, Mina! Thank you so much! # speaker: Fae
-> DONE

=== npc_otis ===
{lanternOn():
    Hoho! Bringing a glowing blacklight right beside the hearth? Makes the lodge beams look like a starry night! # speaker: Otis
}
{
- calmed("hooded-kid"):
    The whole mountain feels restful tonight, Fae. Stories travel fast, and everyone thanks you for bringing peace back to Cloverhollow! # speaker: Otis
- else:
    Come on in from the snow, Fae! Pull up a chair by Mrs. Flurry's fireplace and thaw out your boots! # speaker: Otis
}
{withParty("maddie"):
    Look at Maddie eyeing the warm rug! Smart cat knows the coziest square foot in the lodge! # speaker: Otis
}
{withParty("jordan"):
    Still exploring every hidden trail past the lodge, Jordan? # speaker: Otis
    Every single one, Otis, especially with Fae leading the way! # speaker: Jordan
}
{shared_snack:
    That snack you shared tasted better than hearth-roasted marshmallows, Fae! # speaker: Otis
}
+ [Ask for a fireside story]
    Years ago, travelers up at Pinecone Pass heard chimes singing from the northern cliffs, right where Crystal Cavern hides! # speaker: Otis
    {calmed("bat"): And I hear you already ventured inside and calmed the cavern critters! What a tale! # speaker: Otis}
    -> DONE
+ [Warm up by the hearth]
    Nothing beats crackling pine logs and floating marshmallows. At explorer level {level()} with {stickers()} stickers, you've earned a cozy pause! # speaker: Otis
    -> DONE
+ {snacks() > 0 and not shared_snack} [Share a cozy snack!]
    -> shared_snack
= shared_snack
Here you go, Otis! Have a cozy snack by the fire! # speaker: Fae # feed: snack 1
Hoho, well isn't that the warmest kindness in Pinecone Pass! Goes down mighty fine beside the hearth! # speaker: Otis
Take eight shiny lodge coins for your explorer pouch, Fae! # speaker: Otis # gift: coins 8 # sound: chime-green
-> DONE

=== npc_pebble ===
{lanternOn():
    AHA! Magnificent! Your blacklight beam makes the cavern's quartz veins fluoresce in vivid violet! # speaker: Professor Pebble
}
{
- not areaCalm():
    Careful with your footing, young explorer! Fizzy vibrations are making the cave critters bounce off the stalagmites! # speaker: Professor Pebble
- cavern_bridge_lit:
    Extraordinary! Illuminating that ancient fairy mural raised crystal stepping stones right across the turquoise stream! # speaker: Professor Pebble
- else:
    Greetings, fellow scholar! Welcome to Crystal Cavern, Cloverhollow's most resonant subterranean marvel! # speaker: Professor Pebble
}
{withParty("pond-pup"):
    Wait, a swimming Pond Pup?! That turquoise spring across the stream might hide sunken treasures just for him! # speaker: Professor Pebble
}
{not bridge_reward and cavern_bridge_lit: -> bridge_reward}
+ [Ask about the cavern's crystals]
    {cavern_chime_rung:
        When you lassoed that high golden star chime, every crystal pillar in the grotto sang in harmony! # speaker: Professor Pebble
    - else:
        Notice the golden star chime hanging high in the northeast arch, and those carved fairy swirls along the northern tablet! # speaker: Professor Pebble
    }
    -> DONE
+ [Talk about Star Gems]
    {gem_count() >= 5:
        Astonishing! {gem_count()} Star Gems catalogued already! You rival the great mineralogists of Cloverhollow! # speaker: Professor Pebble
    - else:
        Legend tells of seven Star Gems scattered across the valley, and one sleeps in a prism pocket right inside this cavern! # speaker: Professor Pebble
    }
    -> DONE
+ {npc_wren.started_sketch and not gave_rubbing} [Ask for a crystal rubbing for Wren]
    -> gave_rubbing
= bridge_reward
Solving the glowing mural and lighting the crystal bridge is a landmark discovery! # speaker: Professor Pebble
Please accept this twenty-coin geology prize from my expedition satchel! # speaker: Professor Pebble # gift: coins 20 # sound: chime-blue
Whoa! Thank you, Professor Pebble! # speaker: Fae
-> DONE
= gave_rubbing
Aha! For young Wren's Cloverhollow Field Compendium! I made a crisp violet charcoal rubbing of our finest singing quartz pillar! # speaker: Professor Pebble # sound: chime-blue
Carry it safely back to Whispering Woods, Fae! # speaker: Professor Pebble
Got it, Professor Pebble! Wren is going to love this! # speaker: Fae
-> DONE

=== npc_moss ===
{lanternOn():
    Good eye, Fae. That blacklight lantern reveals woodland trails invisible to hurried feet! # speaker: Ranger Moss
}
{
- not areaCalm():
    Tread lightly through the ferns, Fae. A fizzy woodland critter is stirring up the clearing! # speaker: Ranger Moss
- calmed("hooded-kid"):
    The Whispering Woods are truly whispering again: gentle wind, soft owls, and not a speck of purple fizz left! # speaker: Ranger Moss
- calmed("moon-owl"):
    I heard Starry Owl's peaceful hoot from the southeast clearing! You have the quietest footsteps in the whole forest, Fae. # speaker: Ranger Moss
- clubhouse_claimed:
    Your team fixed up that old treehouse clubhouse nicely! Every great forest needs caring stewards. # speaker: Ranger Moss
- else:
    Welcome beneath the pines, Fae. Walk softly in the Whispering Woods and the trees will show you their secrets. # speaker: Ranger Moss
}
{withParty("acorn-squirrel"):
    Ah, an Acorn Squirrel riding along! Nobody knows the high oak hollows better than that nimble climber. # speaker: Ranger Moss
}
{withParty("jordan"):
    Good to see you back under the big oaks, Jordan! # speaker: Ranger Moss
    Wouldn't miss it, Ranger Moss! Fae spotted the secret trail herself! # speaker: Jordan
}
+ [Ask about the Whispering Woods]
    The big west oak hides a rattling knothole high in its bark, and the southern path opens out onto sunny Clover Hills. # speaker: Ranger Moss
    -> DONE
+ [Ask about the woodland critters]
    {calmed("owl"):
        The sleepy owls are gliding quietly overhead again. Gentle songs always carry farthest under the canopy. # speaker: Ranger Moss
    - else:
        Owls and raccoons roam this clearing. Step kindly, watch their moods, and your song will settle them right down! # speaker: Ranger Moss
    }
    -> DONE

=== npc_sunny ===
{lanternOn():
    Whoa! A glowing firefly lantern in the middle of Clover Hills! Even the clover leaves sparkle! # speaker: Sunny
}
{
- not areaCalm():
    Whoa, watch out! Fluffy fizz-critters are bouncing like popcorn down the hillside! # speaker: Sunny
- calmed("taco-chef"):
    Chef Mateo's salsa is back to normal, and the whole hillside smells like warm crispy tacos! Best day ever! # speaker: Sunny
- calmed("lamb"):
    All the clover lambs are grazing happily again! Thank you for calming them down, Fae! # speaker: Sunny
- else:
    Hi, Fae! Welcome up to Clover Hills: best breeze, softest grass, and fluffiest sheep in the whole valley! # speaker: Sunny
}
{withParty("ribbon-bunny"):
    Aww, Ribbon Bunny! Look how excited she gets near the clover-fringed burrows by the meadow boulders! # speaker: Sunny
}
{withParty("sue"):
    You can almost see Bubblegum Bay sparkling from up on this ridge, Sunny! # speaker: Sue
}
{treats() > 0: Ooh, you brought specialty treats up the hills! The lambs and hedgehogs LOVE snack time! # speaker: Sunny}
+ [Ask about Clover Hills trails]
    West drops right back into Meadow Park, and north winds up into the shady pines of Whispering Woods! # speaker: Sunny
    {gem_count() > 0: With {gem_count()} Star Gems in your pocket, check every cozy burrow between the boulders! # speaker: Sunny}
    -> DONE
+ [Ask about the valley view]
    From up here you can watch the whole valley breathe. {calmed("hooded-kid"): Even the Enchanted Forest glow looks extra warm today!|Whenever things get fizzy, a sunny hillside breeze helps!} # speaker: Sunny
    -> DONE
+ {npc_wren.started_sketch and not gave_clover} [Ask for a pressed clover for Wren]
    -> gave_clover
= gave_clover
Ooh, for Wren's nature sketchbook?! Here's my luckiest four-leaf clover, pressed crisp between two buttercup petals! # speaker: Sunny # sound: chime-green
Tell Wren the clover lambs say hi! # speaker: Sunny
Will do, Sunny! Thanks a bunch! # speaker: Fae
-> DONE

// ===========================================================================
// Elevation Track E11: Interactive Multi-Step Living NPC Quests (Valley)
// 1. Grandpa Barnaby's Star Chart (Blacklight Lantern: Plaza, Bay, Pass)
// 2. Rosie's Runaway Kite Chain (Rainbow Lasso: Park, Lane, Crossing, Boardwalk)
// ===========================================================================

=== function star_chart_count() ===
~ temp total = 0
{ star_chart_plaza:
    ~ total += 1
}
{ star_chart_bay:
    ~ total += 1
}
{ star_chart_pass:
    ~ total += 1
}
~ return total

=== barnaby_star_chart_prompt ===
{star_chart_count() >= 3: -> barnaby_star_chart.complete}
+ {not star_chart_quest} [Ask about his old Star Chart]
    -> barnaby_star_chart.start
+ {star_chart_quest} [Check Star Chart progress ({star_chart_count()}/3)]
    -> barnaby_star_chart.progress
+ [Enjoy your chamomile tea!]
    Always a pleasure, young Fae. Keep your lantern bright! # speaker: Grandpa Barnaby # expr: happy # pose: talk
    -> DONE

=== barnaby_star_chart ===
= start
~ star_chart_quest = true
Aha! Is that a genuine blacklight hiking lantern clipped to your pack, Fae?! # speaker: Grandpa Barnaby # expr: surprised # pose: talk
Years ago, our Cloverhollow Stargazers painted three secret star-chart constellations in invisible glow-ink across the valley. # speaker: Grandpa Barnaby # expr: happy # pose: talk
One sleeps on Cloverhollow Plaza's southeast cobblestones, one hides by Bubblegum Bay's southern sand, and one shines on Pinecone Pass's northern snowy ridge! # speaker: Grandpa Barnaby # expr: neutral # pose: talk
Switch on your blacklight lantern to trace all three markings, and we can restore my observatory map! # speaker: Grandpa Barnaby # expr: happy # pose: cheer
Count on me, Grandpa Barnaby! I'll light up every single constellation! # speaker: Fae # expr: determined # pose: tool_lantern # sound: chime-blue
-> DONE

= progress
Let's see how our observatory map is coming along: {star_chart_count()} of 3 invisible star-chart markings copied so far! # speaker: Grandpa Barnaby # expr: happy # pose: talk
{not star_chart_plaza: Shine your blacklight lantern over the southeast garden cobblestones in Cloverhollow Plaza for the Clover Dipper! # speaker: Grandpa Barnaby # expr: neutral # pose: talk}
{not star_chart_bay: Check the southwest sandy shore of Bubblegum Bay under blacklight for the Starfish Compass constellation! # speaker: Grandpa Barnaby # expr: neutral # pose: talk}
{not star_chart_pass: Look along the northern snowy ridge of Pinecone Pass near the cavern trail under blacklight for the Alpine Crown! # speaker: Grandpa Barnaby # expr: neutral # pose: talk}
I'll keep my blacklight lantern ready, Grandpa Barnaby! # speaker: Fae # expr: determined # pose: tool_lantern
-> DONE

= complete
~ star_chart_quest = true
~ star_chart_done = true
Well bless my spectacles! All three lost star-chart constellations, copied straight into your watercolor journal! # speaker: Grandpa Barnaby # expr: surprised # pose: cheer
The Clover Dipper, the Starfish Compass, and the Alpine Crown! Look how they link the whole valley together! # speaker: Grandpa Barnaby # expr: happy # pose: talk
{withParty("jordan"): Whoa, those northern ridge stars line up right with the Alpine Summit trail! # speaker: Jordan # expr: surprised # pose: cheer}
{withParty("sue"): And the Starfish Compass points straight out toward Starlight Island! # speaker: Sue # expr: happy # pose: cheer}
My observatory map is whole again, Fae! Please take twenty-five stargazer coins and two warm bakery snacks! # speaker: Grandpa Barnaby # expr: happy # pose: cheer # gift: coins 25 # gift: snack 2 # sound: chime-red
Thank you so much, Grandpa Barnaby! Best treasure map in the sky! # speaker: Fae # expr: happy # pose: cheer
-> DONE

=== star_chart_plaza_glow ===
{star_chart_plaza: -> after}
~ star_chart_plaza = true
Under Jordan's blacklight lantern, a delicate violet constellation blooms right across the plaza cobblestones! # speaker: Fae # expr: surprised # pose: tool_lantern # sound: chime-blue
"STAR CHART I: THE CLOVER DIPPER. Four bright stars pointing east from Cloverhollow Plaza toward the sea." # speaker: Glow Note
Fae carefully copies the Clover Dipper into her journal! ({star_chart_count()} of 3 Star Chart markings found!) # speaker: Fae # expr: happy # pose: cheer
{star_chart_count() >= 3:
    That's all three Star Chart constellations! Time to show Grandpa Barnaby at Bon Appetit Cafe! # speaker: Fae # expr: happy # pose: cheer
- else:
    {not star_chart_quest: Grandpa Barnaby at Bon Appetit Cafe would LOVE to see this old star-chart ink! # speaker: Fae # expr: happy # pose: talk}
}
-> DONE
= after
The violet Clover Dipper constellation shimmers softly on the plaza stones beneath the blacklight glow. # speaker: Fae # expr: happy # pose: tool_lantern
-> DONE

=== star_chart_bay_glow ===
{star_chart_bay: -> after}
~ star_chart_bay = true
A swirling violet star-map gleams across the smooth beach pebbles in the blacklight beam! # speaker: Fae # expr: surprised # pose: tool_lantern # sound: chime-blue
"STAR CHART II: THE STARFISH COMPASS. Five coastal stars guiding sailors over Bubblegum Bay's pink tide." # speaker: Glow Note
Fae traces the Starfish Compass neatly onto her map page! ({star_chart_count()} of 3 Star Chart markings found!) # speaker: Fae # expr: happy # pose: cheer
{star_chart_count() >= 3:
    That's all three Star Chart constellations! Let's bring them straight to Grandpa Barnaby at Bon Appetit Cafe! # speaker: Fae # expr: happy # pose: cheer
- else:
    {not star_chart_quest: Bet Grandpa Barnaby at Bon Appetit Cafe knows the story behind these hidden star charts! # speaker: Fae # expr: happy # pose: talk}
}
-> DONE
= after
The glowing Starfish Compass constellation sparkles gently along the sandy cove shore. # speaker: Fae # expr: happy # pose: tool_lantern
-> DONE

=== star_chart_pass_glow ===
{star_chart_pass: -> after}
~ star_chart_pass = true
High on the snowy northern ridge, violet star-lines flare bright across a frosted boulder under Fae's lantern! # speaker: Fae # expr: surprised # pose: tool_lantern # sound: chime-blue
"STAR CHART III: THE ALPINE CROWN. Seven pine-peak stars crowning Pinecone Pass above the mountain clouds." # speaker: Glow Note
Fae sketches the Alpine Crown beside her trail notes! ({star_chart_count()} of 3 Star Chart markings found!) # speaker: Fae # expr: happy # pose: cheer
{star_chart_count() >= 3:
    All three Star Chart constellations copied! Grandpa Barnaby at Bon Appetit Cafe is going to be thrilled! # speaker: Fae # expr: happy # pose: cheer
- else:
    {not star_chart_quest: Grandpa Barnaby at Bon Appetit Cafe loves old valley sky maps, let's show him! # speaker: Fae # expr: happy # pose: talk}
}
-> DONE
= after
The violet Alpine Crown star-chart shimmers quietly across the northern snow ridge. # speaker: Fae # expr: happy # pose: tool_lantern
-> DONE

// ---------------------------------------------------------------------------
// 2. Rosie's Runaway Kite Chain (Park -> Lane -> Crossing -> Boardwalk)
// ---------------------------------------------------------------------------
=== function kite_tail_count() ===
~ temp total = 0
{ kite_tail_park:
    ~ total += 1
}
{ kite_tail_lane:
    ~ total += 1
}
{ kite_tail_crossing:
    ~ total += 1
}
{ kite_tail_boardwalk:
    ~ total += 1
}
~ return total

=== rosie_kite_chain_prompt ===
{kite_tail_count() >= 4: -> rosie_kite_chain.complete}
+ {not kite_chain_quest} [Ask about her runaway kite ribbons]
    -> rosie_kite_chain.start
+ {kite_chain_quest} [Check runaway kite ribbons ({kite_tail_count()}/4)]
    -> rosie_kite_chain.progress
+ [See you soon, Rosie!]
    Bye, Fae! Watch out for breezy gusts! # speaker: Rosie # expr: happy # pose: talk
    -> DONE

=== rosie_kite_chain ===
= start
~ kite_chain_quest = true
Oh, Fae! Wait, you've got Coach Ash's rainbow lasso! # speaker: Rosie # expr: surprised # pose: cheer
A giant playful breeze untied all four pastel ribbon tails from my favorite kite and sent them dancing east! # speaker: Rosie # expr: worried # pose: talk
One snagged high in Meadow Park, and the rest drifted right down East Road across Sunberry Lane, Willowbrook Crossing, and Salt-Marsh Boardwalk! # speaker: Rosie # expr: neutral # pose: talk
Could you track the fluttering trail and lasso-snag all four ribbon tails back for me? # speaker: Rosie # expr: happy # pose: talk
Leave it to my rainbow lasso, Rosie! I'll catch every single ribbon! # speaker: Fae # expr: determined # pose: tool_lasso # sound: chime-yellow
-> DONE

= progress
Ooh, you've already lassoed {kite_tail_count()} of 4 runaway kite ribbons! # speaker: Rosie # expr: happy # pose: cheer
{not kite_tail_park: The Rose Ribbon is still fluttering up in the eastern trees of Meadow Park! # speaker: Rosie # expr: neutral # pose: talk}
{not kite_tail_lane: Look for the Lemon Ribbon looping above the meadow fence on Sunberry Lane! # speaker: Rosie # expr: neutral # pose: talk}
{not kite_tail_crossing: The Mint Ribbon drifted into the willow branches at Willowbrook Crossing! # speaker: Rosie # expr: neutral # pose: talk}
{not kite_tail_boardwalk: And the Sky-Blue Ribbon sailed all the way out to Salt-Marsh Boardwalk! # speaker: Rosie # expr: neutral # pose: talk}
I'm right on their trail, Rosie! # speaker: Fae # expr: determined # pose: tool_lasso
-> DONE

= complete
~ kite_chain_quest = true
~ kite_chain_done = true
MY RIBBONS!! Rose, Lemon, Mint, and Sky-Blue, not a single bow frayed! # speaker: Rosie # expr: surprised # pose: cheer
You tracked that sneaky spring gust clear from Meadow Park to Salt-Marsh Boardwalk with Coach Ash's lasso! # speaker: Rosie # expr: happy # pose: cheer
{withParty("sue"): Wait till you see how high that kite flies in the Bubblegum Bay sea breeze, Rosie! # speaker: Sue # expr: happy # pose: cheer}
Thank you a million times, Fae! Take twenty-five shiny coins, a Berry Swirl Cone treat, and a cottage snack! # speaker: Rosie # expr: happy # pose: cheer # gift: coins 25 # gift: treat berry-cone 1 # gift: snack 1 # sound: chime-yellow
Yay! Can't wait to fly it together in Meadow Park! # speaker: Fae # expr: happy # pose: cheer
-> DONE

=== kite_ribbon_park ===
{kite_tail_park: -> after}
A bright rose-pink kite ribbon flutters high in the eastern park breeze, trailing tiny paper stars eastward! # speaker: Fae # expr: surprised # pose: idle
{not has_lasso:
    It's way too high up in the branches to reach by hand. # speaker: Fae # expr: worried # pose: idle
    -> DONE
}
+ [Lasso-snag the Rose Ribbon!]
    Fae spins Coach Ash's rainbow lasso overhead and loops the fluttering rose bow cleanly! # speaker: Fae # expr: determined # pose: tool_lasso # sound: chime-yellow
    ~ kite_tail_park = true
    Got it! Rose Ribbon Tail recovered ({kite_tail_count()}/4)! More pastel sparkles drift east toward Sunberry Lane! # speaker: Fae # expr: happy # pose: cheer
    -> DONE
+ [Not now]
    -> DONE
= after
The eastern meadow branches sway gently now that Rosie's rose kite ribbon is safe in Fae's pack. # speaker: Fae # expr: happy # pose: idle
-> DONE

=== kite_ribbon_lane ===
{kite_tail_lane: -> after}
A sunny lemon-yellow kite ribbon whips playfully atop a tall meadow sapling beside Sunberry Lane! # speaker: Fae # expr: surprised # pose: idle
{not has_lasso:
    It's caught way above my head. A lasso could flick it right down! # speaker: Fae # expr: worried # pose: idle
    -> DONE
}
+ [Lasso-snag the Lemon Ribbon!]
    Whoosh! Fae flicks the rainbow lasso and snags the lemon ribbon right off the branch! # speaker: Fae # expr: determined # pose: tool_lasso # sound: chime-yellow
    ~ kite_tail_lane = true
    Snagged! Lemon Ribbon Tail recovered ({kite_tail_count()}/4)! The breeze points east toward Willowbrook Crossing! # speaker: Fae # expr: happy # pose: cheer
    -> DONE
+ [Not now]
    -> DONE
= after
Wildflowers bob peacefully along Sunberry Lane where Rosie's lemon ribbon was tangled. # speaker: Fae # expr: happy # pose: idle
-> DONE

=== kite_ribbon_crossing ===
{kite_tail_crossing: -> after}
A soft mint-green kite ribbon loops around a weeping willow bough dangling over Willowbrook Crossing! # speaker: Fae # expr: surprised # pose: idle
{not has_lasso:
    Too high to grab without something long and loopy! # speaker: Fae # expr: worried # pose: idle
    -> DONE
}
+ [Lasso-snag the Mint Ribbon!]
    Fae twirls the rainbow lasso with a crisp snap and reels the mint ribbon down into her hand! # speaker: Fae # expr: determined # pose: tool_lasso # sound: chime-green
    ~ kite_tail_crossing = true
    Nice catch! Mint Ribbon Tail recovered ({kite_tail_count()}/4)! One more gust leads east to Salt-Marsh Boardwalk! # speaker: Fae # expr: happy # pose: cheer
    -> DONE
+ [Not now]
    -> DONE
= after
The weeping willow over Willowbrook Crossing sways softly in the creek breeze. # speaker: Fae # expr: happy # pose: idle
-> DONE

=== kite_ribbon_boardwalk ===
{kite_tail_boardwalk: -> after}
A fluttering sky-blue kite ribbon snaps in the salty breeze from a tall marsh post beside Salt-Marsh Boardwalk! # speaker: Fae # expr: surprised # pose: idle
{not has_lasso:
    That piling is way out over the marsh reeds. I'd need a lasso to snag it! # speaker: Fae # expr: worried # pose: idle
    -> DONE
}
+ [Lasso-snag the Sky-Blue Ribbon!]
    Fae aims across the marsh reeds, casts the rainbow lasso, and tugs the sky-blue ribbon free! # speaker: Fae # expr: determined # pose: tool_lasso # sound: chime-blue
    ~ kite_tail_boardwalk = true
    Got the Sky-Blue Ribbon Tail ({kite_tail_count()}/4)! {kite_tail_count() >= 4: That's all four ribbons! Let's take them back to Rosie at her flower cottage!|Let's grab the rest along the trail!} # speaker: Fae # expr: happy # pose: cheer
    -> DONE
+ [Not now]
    -> DONE
= after
Sea-marsh reeds rustle gently by the boardwalk post where Rosie's sky-blue ribbon used to fly. # speaker: Fae # expr: happy # pose: idle
-> DONE
