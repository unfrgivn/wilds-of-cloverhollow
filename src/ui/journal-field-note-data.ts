import type { AtlasImage } from "./atlas";
import type { HeartToHeartSummary } from "../core/heart-to-hearts";
import type {
  CritterFieldNote,
  JournalKeepsake,
  KeepsakeId,
  StarGemEntry,
} from "../core/journal";
import type { TreasuresSummary } from "../core/treasures";

export type InspectedJournalItem = {
  kind: "sticker" | "prize" | "fish" | "keepsake";
  id: string;
};

export type PrizeFieldNoteMeta = {
  origin: string;
  displayNote: string;
  blurb: string;
};

export type JournalFieldNoteSticker = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
  fieldNote?: CritterFieldNote | null;
};

export type JournalFieldNotePrize = {
  id: string;
  name: string;
  owned: boolean;
  image: AtlasImage | null;
};

export type JournalFieldNoteFish = {
  id: string;
  name: string;
  image: AtlasImage | null;
  owned: boolean;
  rare: boolean;
  coins: number;
  snacks: number;
  blurb: string;
};

export type JournalFieldNoteSource = {
  stickers: readonly JournalFieldNoteSticker[];
  prizes?: readonly JournalFieldNotePrize[];
  fish?: readonly JournalFieldNoteFish[];
  keepsakes?: readonly JournalKeepsake[];
  starGems?: readonly StarGemEntry[];
  treasures?: TreasuresSummary;
  heartToHearts?: HeartToHeartSummary;
  heartToHeartsCompleted?: number;
  encoreTrophies?: number;
  decorCount?: number;
  puzzlesSolved?: number;
  stickersOwned?: number;
  stickersTotal?: number;
  prizesOwned?: number;
  prizesTotal?: number;
  gems?: { found: number; total: number };
  valleyComplete?: boolean;
  members?: readonly { id: string }[];
  arcadeRecords?: { taco?: number };
};

export type FieldNoteData = {
  kind: InspectedJournalItem["kind"];
  signature: string;
  ariaLabel: string;
  rare: boolean;
  portraitHidden: boolean;
  portraitImage: AtlasImage | null;
  portraitAriaLabel: string | null;
  charmId: KeepsakeId | null;
  name: string;
  subtitle: string;
  oldFriend: boolean;
  foundKey: string;
  foundValue: string;
  detailKey: string;
  detailValue: string;
  feelings: readonly CritterFieldNote["feelings"][number][] | null;
  favouriteTreats: readonly string[] | null;
  blurb: string;
  blessingId: KeepsakeId | null;
};

/** CSS selector for the Journal collection slot matching an inspected item. */
export function focusRestoreSelector(item: InspectedJournalItem | null): string | null {
  if (item === null) return null;
  if (item.kind === "sticker") {
    return `.journal-stickers .journal-slot[data-sticker="${item.id}"]`;
  }
  if (item.kind === "prize") {
    return `.journal-prizes .journal-slot[data-prize="${item.id}"]`;
  }
  if (item.kind === "fish") {
    return `.journal-fish .journal-slot[data-fish="${item.id}"]`;
  }
  return `.journal-keepsakes .journal-slot[data-keepsake="${item.id}"]`;
}

/** Lists the inspectable owned entry IDs for a given Journal collection shelf in display order. */
export function inspectableShelfIds(
  view: JournalFieldNoteSource,
  kind: InspectedJournalItem["kind"],
): string[] {
  if (kind === "sticker") {
    return view.stickers
      .filter((s) => s.owned && s.fieldNote !== null && s.fieldNote !== undefined)
      .map((s) => s.id);
  }
  if (kind === "prize") {
    return (view.prizes ?? [])
      .filter((p) => p.owned && p.image !== null)
      .map((p) => p.id);
  }
  if (kind === "fish") {
    return (view.fish ?? []).filter((f) => f.owned).map((f) => f.id);
  }
  return (view.keepsakes ?? []).filter((k) => k.owned).map((k) => k.id);
}

/** Steps backward or forward with wrap-around across owned entries on the same Journal shelf. */
export function stepInspectedItem(
  view: JournalFieldNoteSource,
  current: InspectedJournalItem,
  delta: -1 | 1,
): { next: InspectedJournalItem; index: number; total: number } | null {
  const ids = inspectableShelfIds(view, current.kind);
  if (ids.length < 2) return null;
  const idx = ids.indexOf(current.id);
  if (idx === -1) return null;
  const nextIndex = (((idx + delta) % ids.length) + ids.length) % ids.length;
  const nextId = ids[nextIndex];
  if (nextId === undefined) return null;
  return {
    next: { kind: current.kind, id: nextId },
    index: nextIndex,
    total: ids.length,
  };
}

const CLAW_ORIGIN = "Claw Machine · Mr. Pip's Arcade";
const COUNTER_ORIGIN = "Ticket Counter · Mr. Pip's Arcade";
const PRIZE_HOME = "Clubhouse Shelf";

const prizeNote = (origin: string, blurb: string): PrizeFieldNoteMeta => ({
  origin,
  displayNote: PRIZE_HOME,
  blurb,
});

const PRIZE_FIELD_NOTES: Readonly<Record<string, PrizeFieldNoteMeta>> = {
  "frog-plush": prizeNote(
    CLAW_ORIGIN,
    "Squishy moss-green frog with a big stitched grin; Maddie swears it squeaks on rainy nights.",
  ),
  "pup-plush": prizeNote(
    CLAW_ORIGIN,
    "Floppy-eared puppy with a velvet nose, rescued right from the top of the claw heap.",
  ),
  "raccoon-plush": prizeNote(
    CLAW_ORIGIN,
    "A delightfully smug bandit in plush form, guarding the clubhouse shelf with tiny paws.",
  ),
  "cat-plush": prizeNote(
    CLAW_ORIGIN,
    "Soft ginger tabby stitched with a curled tail, always ready for a sunlit afternoon nap.",
  ),
  "bunny-plush": prizeNote(
    CLAW_ORIGIN,
    "Long pastel ears and a cotton-puff tail that feels like hugging a sunny meadow cloud.",
  ),
  "bluebird-plush": prizeNote(
    CLAW_ORIGIN,
    "Plump sky-blue songbird with stitched wings that brighten up the whole clubhouse.",
  ),
  "hamster-plush": prizeNote(
    CLAW_ORIGIN,
    "Round golden cheeks packed tight with stuffing, looking ready to stash a warm snack.",
  ),
  "squirrel-plush": prizeNote(
    CLAW_ORIGIN,
    "Fluffy chestnut tail curled taller than its head, like a tiny friend from Pinecone Pass.",
  ),
  "owl-plush": prizeNote(
    CLAW_ORIGIN,
    "Wide starry button eyes watching gently over Fae's clubhouse adventures after dusk.",
  ),
  pinwheel: prizeNote(
    COUNTER_ORIGIN,
    "Spinning pastel petals that whirl into a rainbow whenever a breeze drifts by.",
  ),
  "bouncy-ball": prizeNote(
    COUNTER_ORIGIN,
    "Clear speckled bouncy ball with a tiny gold star floating right in the bouncy center.",
  ),
  "toy-rocket": prizeNote(
    COUNTER_ORIGIN,
    "Tin-painted red-and-cream comet cruiser ready for pretend launches past the marquee.",
  ),
  "star-racer-keychain": prizeNote(
    COUNTER_ORIGIN,
    "Mr. Pip's legendary 80-ticket champ prize, the very Star Racer charm Milo dreamed about.",
  ),
};

const FALLBACK_PRIZE_NOTE = prizeNote(
  "Mr. Pip's Arcade",
  "A treasured prize won at Mr. Pip's Arcade and tucked proudly onto the clubhouse shelf.",
);

/** Returns handcrafted Cloverhollow field-note lore for an Arcade Prize. */
export function prizeFieldNote(prizeId: string): PrizeFieldNoteMeta {
  return PRIZE_FIELD_NOTES[prizeId] ?? FALLBACK_PRIZE_NOTE;
}

/** Formats Fae's warm 1-line critter field note blurb from its encounter history. */
export function fieldNoteBlurb(note: CritterFieldNote): string {
  if (note.oldFriend) return "An old friend! Waves happily whenever Fae walks by.";
  if (note.calms >= 2) return "Brightens up fast for a gentle song and a favorite snack.";
  if (note.lands.length > 1) return "Loves wandering between sunny spots across the valley.";
  const firstFeeling = note.feelings[0]?.id;
  if (firstFeeling === "bored") return "A curious soul who just needed a playful friend.";
  if (firstFeeling === "hungry") return "Follows its nose straight to warm snacks and treats.";
  if (firstFeeling === "grumpy") return "A little prickly at first, then soft as moss once calm.";
  if (firstFeeling === "zoomy") return "Full of bouncy energy until a gentle rhythm settles it.";
  if (firstFeeling === "curious") return "Watches every sparkle and sound with bright, eager eyes.";
  return "A cozy valley friend sketched right into Fae's notebook.";
}

/** Projects an owned critter sticker into its pure Field Note card data. */
export function stickerFieldNote(sticker: JournalFieldNoteSticker): FieldNoteData | null {
  const note = sticker.fieldNote ?? null;
  if (!sticker.owned || note === null) return null;
  return {
    kind: "sticker",
    signature: [
      "sticker",
      sticker.id,
      note.level,
      note.calms,
      note.oldFriend,
      note.lands.join(","),
      note.feelings.map((item) => item.id).join(","),
      note.favouriteTreats.join(","),
    ].join("|"),
    ariaLabel: "Critter field note",
    rare: false,
    portraitHidden: false,
    portraitImage: sticker.image,
    portraitAriaLabel: note.name,
    charmId: null,
    name: note.name,
    subtitle: `Lv ${note.level} · ${note.chaosName}`,
    oldFriend: note.oldFriend,
    foundKey: "Found in",
    foundValue: note.lands.join(", "),
    detailKey: "Calmed",
    detailValue: `${note.calms} ${note.calms === 1 ? "time" : "times"}`,
    feelings: note.feelings,
    favouriteTreats: note.favouriteTreats,
    blurb: fieldNoteBlurb(note),
    blessingId: null,
  };
}

/** Projects an owned arcade prize into its pure Field Note card data. */
export function prizeFieldNoteData(prize: JournalFieldNotePrize): FieldNoteData {
  const meta = prizeFieldNote(prize.id);
  return {
    kind: "prize",
    signature: [
      "prize",
      prize.id,
      prize.name,
      meta.origin,
      meta.displayNote,
      meta.blurb,
      prize.image !== null,
    ].join("|"),
    ariaLabel: "Arcade prize note",
    rare: false,
    portraitHidden: prize.image === null,
    portraitImage: prize.image,
    portraitAriaLabel: prize.name,
    charmId: null,
    name: prize.name,
    subtitle: "Arcade Prize",
    oldFriend: false,
    foundKey: "Found",
    foundValue: meta.origin,
    detailKey: "Home",
    detailValue: meta.displayNote,
    feelings: null,
    favouriteTreats: null,
    blurb: meta.blurb,
    blessingId: null,
  };
}

/** Projects a caught Bubblegum Bay fish into its pure Field Note card data. */
export function fishFieldNote(fish: JournalFieldNoteFish): FieldNoteData {
  const snackBonus = fish.snacks > 0 ? `, +${fish.snacks} snack` : "";
  return {
    kind: "fish",
    signature: [
      "fish",
      fish.id,
      fish.rare,
      fish.coins,
      fish.snacks,
      fish.blurb,
      fish.image !== null,
    ].join("|"),
    ariaLabel: "Fish catch note",
    rare: fish.rare,
    portraitHidden: fish.image === null,
    portraitImage: fish.image,
    portraitAriaLabel: fish.name,
    charmId: null,
    name: fish.name,
    subtitle: fish.rare ? "Bubblegum Bay · Rare Catch" : "Bubblegum Bay · Bay Catch",
    oldFriend: false,
    foundKey: "Found in",
    foundValue: "Bubblegum Bay Dock",
    detailKey: "Reward",
    detailValue: `+${fish.coins} coins${snackBonus}`,
    feelings: null,
    favouriteTreats: null,
    blurb: fish.blurb,
    blessingId: null,
  };
}

/** Projects an owned clubhouse keepsake into its pure Field Note card data. */
export function keepsakeFieldNote(keepsake: JournalKeepsake): FieldNoteData {
  return {
    kind: "keepsake",
    signature: [
      "keepsake",
      keepsake.id,
      keepsake.source,
      keepsake.displaySpot,
      keepsake.memory,
    ].join("|"),
    ariaLabel: "Keepsake memory note",
    rare: false,
    portraitHidden: true,
    portraitImage: null,
    portraitAriaLabel: null,
    charmId: keepsake.id,
    name: keepsake.name,
    subtitle: "Clubhouse Keepsake",
    oldFriend: false,
    foundKey: "Found in",
    foundValue: keepsake.source,
    detailKey: "Displayed",
    detailValue: keepsake.displaySpot,
    feelings: null,
    favouriteTreats: null,
    blurb: keepsake.memory,
    blessingId: keepsake.id,
  };
}

/** Resolves the active inspected Journal item against a snapshot, or null if no longer owned. */
export function resolveFieldNote(
  view: JournalFieldNoteSource,
  item: InspectedJournalItem,
): FieldNoteData | null {
  if (item.kind === "sticker") {
    const sticker = view.stickers.find(
      (candidate) => candidate.id === item.id && candidate.owned && candidate.fieldNote != null,
    );
    return sticker === undefined ? null : stickerFieldNote(sticker);
  }
  if (item.kind === "prize") {
    const prize = (view.prizes ?? []).find(
      (candidate) => candidate.id === item.id && candidate.owned && candidate.image !== null,
    );
    return prize === undefined ? null : prizeFieldNoteData(prize);
  }
  if (item.kind === "fish") {
    const fish = (view.fish ?? []).find(
      (candidate) => candidate.id === item.id && candidate.owned,
    );
    return fish === undefined ? null : fishFieldNote(fish);
  }
  const keepsake = (view.keepsakes ?? []).find(
    (candidate) => candidate.id === item.id && candidate.owned,
  );
  return keepsake === undefined ? null : keepsakeFieldNote(keepsake);
}

/** Deterministic change-detection signature for the Field Treasures summary modal. */
export function treasuresSignature(summary: TreasuresSummary): string {
  return [
    summary.stamps.started,
    summary.stamps.bay,
    summary.stamps.pass,
    summary.stamps.complete,
    summary.keepsakes.map((item) => `${item.id}:${item.unlocked}`).join(","),
    summary.catches.map((item) => `${item.id}:${item.caught}`).join(","),
  ].join("|");
}
