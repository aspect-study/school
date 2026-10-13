# 3D world: module map

Read this before opening files in `web/world/`. Each file is an ES5 IIFE that adds one namespace to `World3D` (`W.Scene`,
`W.Town`, ...). **Pure** = no Three.js and no DOM, so `node --test` can run it. Line counts are rounded, as of 2026-10-13.

## Adding or removing a world script

1. Add the file in `web/world/`.
2. Add its name to `tools/world-manifest.json` (`world` list, in load order: a file loads after the files it uses).
3. Run `node tools/update-world-pages.js` (rewrites the script block of `grade-2.html` and `grade-5.html`), then
   `node tools/update-precache.js`.
4. `tests/paths.js` reads the same manifest, so `tests/world3d-wiring.test.js` checks both pages against it.

`backdrop.html` (the start page's animated town) has its own short list in `tests/paths.js` (`BACKDROP_FILES`).

## Where to look for a change

| I want to change... | Open |
| --- | --- |
| What a character says | `lines.js`, `speech/*.js` (pools), `matelines.js` (playground kids); rules in `speech.js` |
| When characters talk on their own | `chatter.js` (who/when), `bubbles.js` (the bubble) |
| A building, path, prop or place | `layout.js` (where), `build.js` (draws it), `decor.js` (progress markers) |
| A new game's door | `layout.js` APPS entry, `buddies.js`, `cast.js`; see README "Adding content" |
| Her clothes, pet or room catalog | `items.js`, `pets.js`, `emotes.js`, `furniture.js` (data); `wear.js`, `petbody.js`, `room3d.js` (drawing) |
| A shop | `boutique.js`, `petshop.js`, `toyshop.js`, `carpenter.js` on the shared `stall.js` panel |
| Walking, camera, joystick | `walk.js` (maths), `move.js` (input and camera), `stamina.js` |
| Playground rides | `rides.js` (maths), `play.js` (her riding), `mateboard.js` (kids' seats) |
| Playground games | `mategame.js` + `games3d.js` (tag, hide-and-seek), `patintero.js` + `replay.js` |
| Gifts and monsters | `loot.js` (pure), `loot3d.js` |
| Review questions in the world | `quiz.js`, `ask.js`, `teach.js`, `lesson-files.js` (generated) |
| A game opening inside the world | `portal.js` |
| Rendering, quality, resize | `scene.js` (stage), `world-main.js` `frame()` / `applyQuality()` |

## Stage and core

| File | Lines | Job |
| --- | --- | --- |
| `scene.js` | 204 | Renderer, camera, lights, sky, cached toon materials and shapes (`S.add`, `S.rbox`, `S.label`...), quality, resize, context-loss texture refresh. Everything draws through it. |
| `world-main.js` | 1790 | Page start, the frame loop, doors, overlays (settings, travel), HUD wiring, My Room enter/exit, the mirror. Wires every module below with a context object. Read it by line range, never whole. |
| `layout.js` | 345 | Where everything stands, per grade. Pure data and geometry. |
| `text.js` | 185 | Words for the world (Grade 2 pairs Filipino with English). |
| `prefs.js` | 111 | Device prefs, return door, frame-rate watcher (asks for low quality). Pure. |
| `walk.js` / `move.js` | 55 / 278 | Movement maths (pure) / pointer, keys, joystick and camera. |
| `stamina.js` | 50 | Her heart while she sprints. Pure. |
| `hud.js` | 21 | Coins pill and quests pill. |
| `intro.js` + `intro.css` | | The opening animation (loads first, before the manifest scripts). |

## `tick()` order (world-main.js, about line 1351)

`ctl.update` (input) -> ride or seat pose -> footsteps -> her move runner -> her avatar pose -> pet (`pal.tick`) -> stamina
and HUD toggles -> nearest interactable -> `world.animate` -> room view -> then, outdoors only: `town`, `folk`, `kin`,
`mates`, `life` -> chatter and bubbles -> `loot`, `games` -> nudge -> `S.follow` -> auto low quality. `frame()` requests the
next frame first, runs `tick(min(dt, 0.05))`, then `S.render()`.

## World drawing (Three.js)

| File | Lines | Job |
| --- | --- | --- |
| `build.js` | 401 | Ground, paths, buildings, fort, plaza, gardens, playground, gate, signs. |
| `decor.js` | 137 | Medal flags, banners, floating markers that follow her progress. |
| `cast.js` | 606 | Mayor Mimi, the subject buddies, Hoot, Bunny, talking trees. |
| `fort-boss.js` | 196 | The weekly boss and his finale. |
| `avatar.js` / `wear.js` | 194 / 509 | Her chibi character / one builder per wardrobe item. |
| `petbody.js` / `pettricks.js` | 358 / 91 | One builder per pet and gear / trick and toy shapes. |
| `companion.js` | 457 | Her pet in the world (follows, rides, bubble). |
| `room3d.js` | 1087 | My Room in 3D: walls, desk, mirror, shelf, one builder per furniture piece. |
| `mates3d.js` | 332 | The playground kids in 3D. |
| `life.js` | 190 | The living world in 3D (routines for characters and pets). |
| `games3d.js` | 736 | Playground games in 3D. |
| `loot3d.js` | 383 | Gifts and monsters in 3D. |
| `bubbles.js` | 115 | Ambient word bubbles over heads. |

## Characters and town (progress and talk)

| File | Lines | Job |
| --- | --- | --- |
| `town.js` | 239 | Progress on the map; Mimi, the fort gate, the nudge. |
| `folk.js` | 251 | The talking characters; Ask me!; study desk. |
| `kin.js` | 462 | Jesus, her sister, comfort days, cheers. |
| `talk.js` | 106 | The speech bubble panel (face, words, buttons). |
| `speechchat.js` | 60 | Tap chat inside the bubble. |
| `play.js` | 66 | Her playground rides. |
| `nudge.js` | 30 | Study nudge after 10 minutes. Pure. |

## Pure logic (no Three.js)

| File | Job |
| --- | --- |
| `progress.js`, `care.js`, `cheer.js` | What her progress shows; what kind of day she has; what her pet celebrates. |
| `chat.js`, `speech.js`, `speechctx.js`, `chatter.js`, `lines.js`, `speech/*.js` | Which line is said, when, and the line pools. |
| `mates.js`, `matelines.js`, `matequiz.js`, `mateboard.js`, `matemind.js`, `mategame.js`, `patintero.js`, `replay.js` | The playground kids: who, what they say and ask, seats, behavior, games, replay. |
| `petlife.js`, `lifedata.js`, `routines.js` | Pet mood; routine data; the state machine for characters and pets. |
| `loot.js`, `quiz.js`, `teach.js` | Gift and monster rules; Ask me! questions; the pet teacher's steps. |
| `rides.js`, `moves.js`, `moverun.js` | Ride maths; move poses; running one move at a time. |
| `room.js`, `trophies.js` | My Room squares; the trophy shelf. |
| `look.js`, `closet.js`, `house.js` | Saved data: her look, what she owns, her house (each syncs). |
| `items.js`, `pets.js`, `emotes.js`, `furniture.js`, `buddies.js` | Catalogs (data). |
| `sfx.js`, `music.js` | Sound effects and the music-box loop (Web Audio). |

## Panels and shops (DOM)

`stall.js` (shared shop panel), `boutique.js`, `petshop.js`, `toyshop.js`, `carpenter.js`, `maker.js` (character maker),
`decorate.js` (Decorate view), `playbar.js`, `usebar.js`, `portal.js` (game in an iframe), `ask.js` (Ask me! scoring).

## Generated or separate

`lesson-files.js` is written by `tools/update-precache.js`: never edit it. `backdrop*.js` and `backdrop.html` are the start
page's town. `world.css` styles the world page.

## Rules that save tokens

- A new feature is a new file plus one line in `tools/world-manifest.json` and one wiring line in `world-main.js`.
- Keep rules in a pure module and drawing in a `*3d.js` or builder module, so the rules can be tested without WebGL.
- Share shapes and materials through `scene.js`; a module that makes its own textures disposes of them.
