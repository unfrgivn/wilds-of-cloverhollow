# Media sources

Where to look for existing openly licensed media (sound effects, ambience,
images) before synthesizing or generating it. Using a found asset in the game
still needs the owner's pick; this is a place to search, not a pre-approval.

## Openverse (noted by the owner, 2026-10-16)
API: https://api.openverse.org/v1/ (docs at the same URL). It searches openly
licensed media from many sources; no key is needed for light use.

Audio (checked 2026-10-16): about 5.2 million files from three sources.
- Freesound (about 592k): the useful one. Many short CC0 game sounds: coins,
  pickups, UI clicks, text blips, doors, page turns, whooshes, footsteps, and
  ambience (birds, waves, wind).
- Jamendo (about 645k): full songs, often BY-SA or NC. Not usable as is.
- Wikimedia audio (about 4.0 million): mostly speech and pronunciations.

How to search:
- `GET /v1/audio/?q=coin%20pickup&license=cc0&source=freesound&length=shortest&page_size=20`
- Don't filter by `category=sound_effect`: Freesound items have no category,
  so it returns nothing. `length=shortest` still lets 10 to 30 s clips
  through; check each result's `duration` (milliseconds).
- Each result has `url` (a direct Freesound MP3 preview, 128 to 260 kbps),
  `foreign_landing_url` (the Freesound page), `license`, `license_url`,
  `creator`, and `duration`. Original WAVs need a free Freesound account.
- Anonymous limits: 20 requests a minute and 200 a day (response headers
  `x-ratelimit-*`). Put queries in one script rather than one request per
  shell command; a free registered key raises the limits.

Rules for anything kept:
- CC0 only, unless the owner approves another license. No NC, no SA.
- Openverse aggregates metadata: confirm the license on the Freesound page
  before keeping a clip.
- Record each kept file like a kept generated asset: a recipe in
  `art/recipes/` with the Freesound URL, creator, license, the date checked,
  and the exact ffmpeg trim and level commands. Runtime files go in
  `public/assets/audio/`.
- Clips vary a lot in level (peaks from -11 to -0.1 dBFS in a sample of
  four) and often have leading silence: trim and level-match them.
- Clips come from many creators in many styles; pick for one coherent,
  gentle sound, and let the owner choose by ear.
