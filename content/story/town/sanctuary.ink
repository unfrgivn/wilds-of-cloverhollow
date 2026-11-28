=== function sanctuary_count() ===
~ temp total = 0
{calmed("fountain-frog") or calmed("frog"):
    ~ total = total + 1
}
{calmed("pup"):
    ~ total = total + 1
}
{calmed("cat"):
    ~ total = total + 1
}
{calmed("raccoon"):
    ~ total = total + 1
}
{calmed("bluebird"):
    ~ total = total + 1
}
{calmed("crab"):
    ~ total = total + 1
}
{calmed("hamster"):
    ~ total = total + 1
}
{calmed("penguin"):
    ~ total = total + 1
}
{calmed("bunny"):
    ~ total = total + 1
}
{calmed("squirrel"):
    ~ total = total + 1
}
{calmed("gull"):
    ~ total = total + 1
}
{calmed("owl"):
    ~ total = total + 1
}
{calmed("lamb"):
    ~ total = total + 1
}
{calmed("hedgehog"):
    ~ total = total + 1
}
{calmed("bat"):
    ~ total = total + 1
}
{calmed("crystal-mole"):
    ~ total = total + 1
}
{calmed("moon-owl"):
    ~ total = total + 1
}
~ return total

=== ranger_fern ===
~ temp count = sanctuary_count()
{not sanctuary_visited:
    ~ sanctuary_visited = true
    Welcome to Cloverhollow's Wildlife Sanctuary, Fae! I'm Ranger Fern. # speaker: Ranger Fern
    Whenever a valley critter shakes off that purple fizz, it loves wandering up to this sunny meadow for fresh clover, pond naps, and gentle company. # speaker: Ranger Fern
}
{
- count >= 14 and not sanctuary_reward_14:
    ~ sanctuary_reward_14 = true
    ~ sanctuary_reward_8 = true
    ~ sanctuary_reward_3 = true
    Look around this meadow, Fae! {count} of 17 valley animals are relaxing right here in the sunshine! # speaker: Ranger Fern
    I wove this Sanctuary Clover Wreath for your clubhouse keepsake chest, plus forty coins and two picnic snacks from the ranger pantry! # speaker: Ranger Fern # gift: coins 40 # sound: chime-red
    Every single creature in Cloverhollow knows you're a true friend! # speaker: Ranger Fern # gift: snack 2
    Whoa, it smells like alpine wildflowers! Thank you, Ranger Fern! # speaker: Fae
    {milo_revealed: -> festival_menu}
    -> DONE
- count >= 8 and not sanctuary_reward_8:
    ~ sanctuary_reward_8 = true
    ~ sanctuary_reward_3 = true
    Oh, my heart! {count} of 17 valley animals are already visiting our sanctuary meadow! # speaker: Ranger Fern
    Take twenty-five coins and two trail snacks from the ranger pouch, Fae. You've brought so much peace back to these hills! # speaker: Ranger Fern # gift: coins 25 # sound: chime-blue
    Keep soothing shy critters across the valley, and I'll have a handmade keepsake ready when fourteen friends visit! # speaker: Ranger Fern # gift: snack 2
    {milo_revealed: -> festival_menu}
    -> DONE
- count >= 3 and not sanctuary_reward_3:
    ~ sanctuary_reward_3 = true
    Look who's dropped by! {count} of 17 valley animals are already napping and playing in the meadow! # speaker: Ranger Fern
    Here's fifteen coins and a berry snack for being so kind to our furry and feathered neighbors! # speaker: Ranger Fern # gift: coins 15 # sound: chime-yellow
    Come say hi again once eight valley friends have found their way here! # speaker: Ranger Fern # gift: snack 1
    {milo_revealed: -> festival_menu}
    -> DONE
- count == 17:
    All 17 of 17 valley animals are visiting the Wildlife Sanctuary together! Listen to them chirp, purr, and splash! # speaker: Ranger Fern
    Feel free to pet any of your friends or spread out on the checkered picnic blanket whenever you like, Fae! # speaker: Ranger Fern
- count == 0:
    Right now 0 of 17 valley animals have wandered up here yet. # speaker: Ranger Fern
    Once you calm critters around Cloverhollow, Bubblegum Bay, Pinecone Pass, and the woods, they'll start visiting this meadow! # speaker: Ranger Fern
- else:
    Right now {count} of 17 valley animals are visiting the sanctuary meadow! # speaker: Ranger Fern
    Walk right up and pet anyone you've calmed, or check the wooden bulletin board to see which valley regions still have shy critters! # speaker: Ranger Fern
}
{
- sanctuary_gift:
    And thank you for checking our Pinecone Pass trail board! Hope the Ranger Basket came in handy! # speaker: Ranger Fern
- buster_reward:
    Look at you, an official Star-Line Explorer! Buster tells all the mountain hikers about you! # speaker: Ranger Fern
}
{milo_revealed: -> festival_menu}
-> DONE
= festival_menu
Sunny Cloverhollow is shining brighter than ever! Everyone gathered here to celebrate you, Fae! # speaker: Ranger Fern
+ {not festival_toast_done} [Raise a Sunny Cloverhollow Festival Toast!]
    -> festival_toast
+ {festival_toast_done} [Replay the Sunny Cloverhollow Festival Toast!]
    -> festival_toast_replay
+ [Enjoy the sunny meadow]
    Take your time exploring the meadow, Fae! Every critter and friend is glad you're here! # speaker: Ranger Fern
    -> DONE
= festival_toast
~ festival_toast_done = true
Gather 'round, everyone! Cups of clover lemonade up beneath the alpine sunshine! # speaker: Ranger Fern
To Fae—for listening when I was tangled in purple fizz, and showing me how fun sharing really is! # speaker: Milo
To all our calm critters, blooming clover garlands, and brand-new sunny mornings in Cloverhollow! # speaker: Rosie
To the bravest, kindest kid in the valley—your mom and I couldn't be prouder of you, kiddo! # speaker: Dad
Cheers from Bon Appetit Cafe! Honey-clover tarts and fiesta tacos for every friend on the blanket! # speaker: Chef Bea
To sea breezes, Starlight Island, and the best adventure crew on the whole map! # speaker: Sue
To Alpine Summit auroras, glowing clues, and never running out of marshmallows! # speaker: Jordan
Mrrrow-purrrr! Maddie lifts one fluffy orange paw right into the middle of the cheers! # speaker: Maddie
To Sunny Cloverhollow—and every single friend and critter who makes it home! # speaker: Fae # sound: chime-yellow
And for our guest of honor, here's a gleaming Festival Star Pouch with thirty shiny coins! # speaker: Ranger Fern # gift: coins 30 # sound: chime-red
Plus two fresh meadow picnic snacks for wherever your next sunny trail leads! # speaker: Ranger Fern # gift: snack 2
-> DONE
= festival_toast_replay
Gather 'round again, everyone! Cups of clover lemonade up beneath the alpine sunshine! # speaker: Ranger Fern
To Fae—for listening when I was tangled in purple fizz, and showing me how fun sharing really is! # speaker: Milo
To all our calm critters, blooming clover garlands, and brand-new sunny mornings in Cloverhollow! # speaker: Rosie
To the bravest, kindest kid in the valley—your mom and I couldn't be prouder of you, kiddo! # speaker: Dad
Cheers from Bon Appetit Cafe! Honey-clover tarts and fiesta tacos for every friend on the blanket! # speaker: Chef Bea
To sea breezes, Starlight Island, and the best adventure crew on the whole map! # speaker: Sue
To Alpine Summit auroras, glowing clues, and never running out of marshmallows! # speaker: Jordan
Mrrrow-purrrr! Maddie lifts one fluffy orange paw right into the middle of the cheers! # speaker: Maddie
To Sunny Cloverhollow—and every single friend and critter who makes it home! # speaker: Fae # sound: chime-red
-> DONE

=== sanctuary_board ===
~ temp count = sanctuary_count()
"CLOVERHOLLOW WILDLIFE SANCTUARY — Today's Visitors: {count} of 17 valley animals!" # speaker: Sanctuary Board
{count == 17:
    Every single meadow, shoreline, cavern, and woodland friend has signed the visitor log with a muddy pawprint or feather! # speaker: Fae
    -> DONE
}
{not (calmed("fountain-frog") or calmed("frog")) or not calmed("pup") or not calmed("cat") or not calmed("raccoon"):
    Cloverhollow Town & Meadow Park still have shy critters around the fountain, alleys, and pond. # speaker: Sanctuary Board
}
{not calmed("bluebird") or not calmed("crab") or not calmed("gull"):
    Bubblegum Bay & Cliffside Trail still have coastal birds and shoreline friends waiting for a calm hello. # speaker: Sanctuary Board
}
{not calmed("hamster") or not calmed("penguin") or not calmed("bat") or not calmed("crystal-mole"):
    Pinecone Pass & Crystal Cavern still have mountain and crystal-cave neighbors tucked away in the snow and sparkle. # speaker: Sanctuary Board
}
{not calmed("bunny") or not calmed("squirrel") or not calmed("owl") or not calmed("lamb") or not calmed("hedgehog") or not calmed("moon-owl"):
    Whispering Woods & Clover Hills still have woodland and hillside critters hiding among the pines and clover. # speaker: Sanctuary Board
}
-> DONE

=== sanctuary_picnic ===
~ temp count = sanctuary_count()
Fae and Maddie hop onto the red-and-cream checkered picnic blanket in the warm alpine sun! # speaker: Fae
{sue_joined: Sue stretches out her legs and leans back on her elbows. "Best picnic spot in the whole valley!" # speaker: Sue}
{jordan_joined: Jordan unpacks a thermos of apple cider and grins at the clover hills. "Nothing beats fresh mountain air." # speaker: Jordan}
{
- count >= 8:
    All around the blanket, {count} peaceful valley critters blink sleepily in the breeze while butterflies drift overhead. # speaker: Fae
- count > 0:
    Across the sunlit grass, {count} calm valley friends twitch their ears happily as the breeze carries clover blossoms past. # speaker: Fae
- else:
    The meadow is quiet and golden, ready for all the calm critters who'll come visiting soon. # speaker: Fae
}
{not sanctuary_picnic_basket:
    ~ sanctuary_picnic_basket = true
    There's a warm honey biscuit tucked inside Ranger Fern's wicker picnic basket with a note: "For kind explorers!" # speaker: Fae # gift: snack 1 # sound: chime-green
}
{milo_revealed: Milo hops onto the checkered blanket with his sketchbook, drawing Maddie napping in the sun! # speaker: Milo}
-> DONE

=== sanctuary_barn ===
Sweet sun-dried hay and fresh clover fill the tidy timber barn. Little woven nests and cozy straw beds wait along the rafters for visiting critters! # speaker: Fae
-> DONE

=== pet_frog ===
Ribbit! Fountain Frog puffs its rosy cheeks and blows a tiny rainbow bubble that pops right on Fae's nose! # speaker: Fountain Frog # sound: chime-green
-> DONE

=== pet_pup ===
Arf! Pond Pup flops onto its back in the wildflowers and wags its fluffy tail like a tiny windmill! # speaker: Pond Pup # sound: chime-yellow
-> DONE

=== pet_bluebird ===
Tweet-tweet! Bay Bluebird hops onto the stone birdbath rim and whistles a bright three-note thank-you! # speaker: Bay Bluebird # sound: chime-yellow
-> DONE

=== pet_gull ===
Lookout Gull puffs out its snowy feathers proudly and lets Fae give one very dignified pat on the head! # speaker: Lookout Gull # sound: chime-green
-> DONE

=== pet_penguin ===
Waddle Penguin flaps its flippers in a delighted little circle and slides an inch across the cool grass! # speaker: Waddle Penguin # sound: chime-green
-> DONE

=== pet_lamb ===
Baa! Clover Lamb nudges Fae's hand with its velvety nose and munches a sprig of golden hay! # speaker: Clover Lamb # sound: chime-yellow
-> DONE

=== pet_bunny ===
Ribbon Bunny wiggles its twitchy pink nose and does a happy binky hop over the daisies! # speaker: Ribbon Bunny # sound: chime-yellow
-> DONE

=== pet_cat ===
Purrrr... Cozy Cat curls into a warm cinnamon loaf in the sunbeam and leans right into Fae's scritches! # speaker: Cozy Cat # sound: chime-green
-> DONE

=== pet_hamster ===
Hiker Hamster puffs both cheeks with clover seeds and gives Fae a tiny cheerful salute! # speaker: Hiker Hamster # sound: chime-yellow
-> DONE

=== pet_hedgehog ===
Sniff-sniff! Meadow Hedgehog uncurls its soft tummy and blinks happily at Fae from the clover patch! # speaker: Meadow Hedgehog # sound: chime-green
-> DONE

=== pet_squirrel ===
Chitter! Acorn Squirrel pats Fae's palm with tiny paws and proudly shows off its shiniest oak acorn! # speaker: Acorn Squirrel # sound: chime-yellow
-> DONE

=== pet_raccoon ===
Ringtail Raccoon peeks out with polite curiosity, washes a dandelion puff in its paws, and offers it to Fae! # speaker: Ringtail Raccoon # sound: chime-green
-> DONE

=== pet_owl ===
Hoo-hoo... Whispering Owl fluffs its soft feather tufts and blinks slowly with calm woodland wisdom! # speaker: Whispering Owl # sound: chime-green
-> DONE

=== pet_moon_owl ===
Hoo-hoo! Starry Owl blinks its golden crescent eyes fondly, letting a pinch of soft stardust drift onto Fae's sleeve! # speaker: Starry Owl # sound: chime-yellow
-> DONE

=== pet_bat ===
Squeak! Cozy Bat snuggles happily into its yellow star bandana and flutters a warm hello beside the mossy stones! # speaker: Cozy Bat # sound: chime-yellow
-> DONE

=== pet_mole ===
Gem Mole polishes a tiny sparkling meadow pebble with its paws and holds it up for Fae to admire! # speaker: Gem Mole # sound: chime-green
-> DONE

=== pet_crab ===
Click-clack! Sandy Crab does a cheerful sideways shuffle along the warm sunlit footpath and waves both claws! # speaker: Sandy Crab # sound: chime-yellow
-> DONE
