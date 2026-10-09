# Walkable 3D World — Phase 4 plan OUTLINE (not the full plan yet)

Research is done; the full step-by-step plan (with code, in the phase 3 format) still needs to be written from this.
Spec: `docs/superpowers/specs/2026-10-05-walkable-3d-world-design.md`, "Phase 4".

## Findings from the code (2026-10-06)

- World pages do NOT load `family.js` or `cloud.js`. The sister's data comes from `family_peek_v1`, which only the lobby's
  cloud sync fills. Cheers sent in the world are saved to `family_v1` and sync on the next lobby open (accepted gap, same as games).
- `family.js` `mountUi` returns early with no `#campus`, so loading it on world pages (with data-grade) is safe.
- A lost boss stage is not saved anywhere (`boss.js stageResult` only returns a popup), and the `boss_v1` merge drops extra
  fields. A new key is needed.
- `Quests.streakOf(days, today)` is pure. "Streak broke today" = `streakOf(days, today).days === 0 && streakOf(days, yesterday).days > 0`.
  Jesus's lines must never mention losing a streak (quests.js rule).
- `StudyHistory.list()` quiz entries have `t`, `answered`, `correct`. Hard day = 5+ wrong today and under 60% right.
- `world3d_v1` is read by `prefs.readDaily` (only `mimi` today).
- Every existing world e2e case would be blocked by a morning greeting, so the e2e must seed `world3d_v1`
  greeted/comforted = today by default ("CALM" seed in `stageWorld`).

## Decisions made while planning (within the spec)

- Jesus's greeting: he appears beside where she starts (the gate on a normal first open), walks up, and the bubble opens.
  Comfort: he appears ~7 units away with a golden glow and walks to her. Comfort wins over the greeting and marks both.
- Walking back: he walks a few steps toward the garden, then a golden sparkle puts him on his bench (no full cross-map walk).
- Mimi's nudge: she appears with a sparkle a few steps away, walks to her, says `Chat.join(T.nudge, step.text)` with Go ▶ (trail) / Later,
  then sparkles back to the fountain.
- Jesus and the sister are moving characters: not in `Layout.interactables`; `world-main` uses `L.nearest(items.concat(kin.items()), …)`.
- Sister cheers use the speech bubble (same cheers, `Family.canSend` / `Family.send`, same limits), not the lobby card.
- Long study day (30+ answers today) → Jesus's garden opens with the "proud of how hard you tried" line.

## Files

| File | Change |
|---|---|
| `web/world/prefs.js` | `readDaily` adds `greeted`, `comforted` |
| `web/engine/boss.js` | on a miss save `boss_missed_v1` = today; export `MISSED_KEY`, `missedDay(storage)` |
| `web/engine/family.js` | `PEEK_STATE` + `'avatar_v1'`; `store` keeps `look: parseObj(st.avatar_v1)`; `sisters` returns `look` (update tests/family.test.js lines 39, 122) |
| `web/world/lines.js` | `jesus: { greet[5], garden[6+], proud, hug, comfort: { wrong, streak, boss } }`, each `{ say, verse, ref }`; Grade 2 say/verse paired; no "wrong", "mali", coins, points, quiz |
| `web/world/text.js` | `hug`, `jesus` ('Jesus' / 'Hesus · Jesus'), `sayHi`, `rides.{slide,swings,seesaw,merry}`, `nudge`, `sisterChoosing`, `sisterHello` (buttons English-only list in the text test) |
| `web/world/care.js` (new, pure) | `tally(entries, today)`, `streakBroke(days, today, streakOf)`, `hardDay({tally, broke, bossMissed})` → 'wrong'/'streak'/'boss'/null, `visit(daily, today, reason)` → 'comfort'/'greet'/null, `gardenLines` |
| `web/world/nudge.js` (new, pure) | `create(limit=600)` → `tick(dt, counting)`, `due()`, `reset()` |
| `web/world/rides.js` (new, pure) | slide/swings/seesaw/merry: time, start/end spots, `pose(grade, id, k)` → {x,y,z,face,sit,arms} (slide end z≈76, swing seat x 27.2 len 3.2, seesaw end x+2.6, merry r 1.5) |
| `web/world/walk.js` | `advance(x, z, tx, tz, dist)` |
| `web/world/layout.js` | `freeSpot(grade, x, z, face, d)`, jesus seat at bench, lamb obstacle, sister spots by the gate, `ride` interactables |
| `web/world/cast.js` | `jesus(S)` (from the mockup: robe, sash, halo, hug(), glow(on), sit(on), walking) and `lamb(S)` |
| `web/world/avatar.js` | `animate(t, walkT, mag, pose)` with `sit`, `wave`, `cheer` |
| `web/world/build.js` | playground moving parts (swing pivot, seesaw plank, merry group) + `ride(id, k)`; `hearts(x, y, z)` |
| `web/world/kin.js` (new) | Jesus (garden talk, Hug, greet/comfort visits, walk back) + sister at the gate (look, tag, ✨ playing glow, 🎨 choosing sign, cheers bubble) |
| `web/world/play.js` (new) | ride controller: freeze, pose her, animate the ride, teleport to the end spot |
| `web/world/town.js` | `nudge(st)` for Mimi |
| `web/world/world-main.js` | create kin + play + nudge; dynamic items; debug hooks (jesus, sister, ride, nudgeNow) |
| `grade-5.html`, `grade-2.html`, `tests/paths.js` | load `../engine/family.js` (data-grade, after subjects) and care, nudge, rides (after lines), kin, play (after folk); `node tools/update-precache.js` |
| tests | prefs, boss, family, lines, text, new care/nudge/rides tests, walk, layout, wiring; e2e CALM seed + a family/ride/nudge case |
