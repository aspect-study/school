# Living world: moving characters and unique pets

Date: 2026-10-09. Status: design approved by the owner.

## Goal

World characters and playmates stand still today (only a bob and head tilt in `cast.js` `life()`; fixed positions in
`folk.js`). Make them move and do things, and give some of them a unique pet that acts like its species and reacts to
what is around it. All of it is cosmetic: no coins, no points, no saved data.

## Scope

- Characters that get routines: the subject buddies, Professor Hoot, Bunny, Mayor Mimi, and the four shop owners
  (Lola Lana, Mang Kiko, Kuya Pilo, Tito Tasyo).
- Pets: about 5 of the 9 playmates, Hoot, Bunny, Mimi and 2-3 buddies. Every pet is a different species (or colour of a
  species) with its own name; no two alike. The 16 species and models already in `pets.js` and `petbody.js` are reused.
- Not in scope: her own pet (`petlife.js` stays as is, except what is reused), new art beyond small pose additions,
  any saved state.

## Design

### 1. `web/world/routines.js` (new, pure, no Three.js, Node-testable)

Same style as `matemind.js` and `petlife.js`. `create(o)` takes
`{ actors: [{ id, kind, home: { x, z }, leash, routines, pet? }], blocked(x, z, r), rand }`; `tick(dt, her)` with
`her = { x, z, cam, talkingTo, busy }` returns `{ poses: { id: { x, z, face, action, t } }, pops: [], sounds: [] }`.

Each actor runs: pick a routine, walk to its point (inside the leash around home), do the action for its length, rest
1-3 s, repeat. Rules:

- Leash: 3-6 squares from home, never on a blocked square (doors, rides, walkways stay clear).
- Talking: when she taps an actor, it stops, faces her, and resumes about 2 s after the talk closes. While the pet
  teacher or a question gift is open (`her.busy`), nobody starts a new routine.
- Keep out of her camera lane the way `matemind.js` does.
- Distance gate: actors further than 40 units from her stand still. A hard cap on moving actors at once (default 12)
  keeps tablets smooth; the nearest ones win.

### 2. Routines per character (data table in `routines.js`)

- Buddies: sweep, read, water the plant, sit and look up; wave when she passes within 5.
- Shop owners: arrange items, serve an invisible customer, stretch, sip, hum.
- Hoot: perch, read, short hover flight between two perches. Bunny: hops around the shop. Mimi: patrols a loop of the
  paths and waves.
- Playmates keep their existing `matemind.js` behavior; their pet follows them (see 3).

### 3. Pets

- A pet is an actor with an owner. It stays within 2-4 squares of the owner, follows when the owner walks, joins the
  owner's rides and games as a small sidekick, and sits beside the owner during a talk.
- Species behaviors (3-4 each, in a data table): parrot perches on the owner's shoulder and says a word; fox stalks
  and pounces; turtle crosses slowly and pulls into its shell when she runs close; dragon breathes sparkles; kitten
  chases a butterfly; puppy fetches and sniffs; the rest get fitting ones (hamster runs in circles, bunny hops,
  piglet rolls, penguin slides, carabao calf grazes, panda eats bamboo, unicorn prances, tarsier stares, duckling
  paddles, chick pecks).
- Reactions: looks at her when near and gets excited when she waves; hops after its owner when the owner starts a ride;
  plays with another pet when two are close; stops and flees when a tag chaser passes; sleeps when its owner has been
  still a while.

### 4. Rendering

- `cast.js`: characters expose `setPose({ x, z, face, action })`; `life()` keeps the bob and adds walk bob and the new
  poses (sweep, read, stretch, wave, sip).
- `mates3d.js`: each kid with a pet mounts a `petbody.js` pet next to them.
- `petbody.js`: small additions for the new moods (shell, pounce, breathe, graze, sleep) on top of `animate(t, mood)`.
- `folk.js` and `world-main.js`: create the routine engine, feed `her`, apply poses each frame.

### 5. Text

English-first rules hold: no new Filipino strings; pops are emoji or short English lines.

## Testing

- `tests/routines.test.js` (Node): leash radius, never entering blocked squares, facing her during a talk, resuming
  after, the moving cap, the distance gate, pets staying near the owner, each species table entry naming a known routine.
- `tests/e2e/life-e2e.js` (headless Chrome): after 10 s the buddies, owners and pets have moved from their start
  positions, pets exist on the chosen kids and characters, and a talk freezes the actor.
- `node tests/e2e/world-e2e.js` and `node --test` must still pass; run `node tools/update-precache.js` after adding files.

## Accepted gaps

Pets of playmates do not get their own talks. Tablet smoothness check is on the owner's side.
