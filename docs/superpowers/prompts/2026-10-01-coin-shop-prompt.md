I want to add a coin wallet and a reward shop to my daughters' study games. The design decisions are already made (below). Please write a short spec to `docs/superpowers/specs/2026-10-01-coin-shop-design.md`, show it to me for approval, then plan and build **Phase 1 only**.

## House rules
- Never run `git commit` (this folder is not a git repo anyway). After every change, give me a suggested commit message in a code block, with no `Co-Authored-By:` line.
- Use comments sparingly. Only comment non-obvious code.
- Keep everything self-contained: no CDN, no build step, no server. These are local HTML files opened from disk.

## Project context (verify in the code before relying on it)
- `C:\Users\ADMIN\IdeaProjects\school\` contains standalone single-file HTML study games plus two lobbies:
  - `lobby-grade5.html` at the root, for the Grade 5 child (the older sister, "Ate"), linking 8 root apps.
  - `grade 2/lobby.html`, for the Grade 2 child, linking 7 apps in `grade 2/`.
- The girls use **separate devices**. Every `localStorage` key is per device. Nothing is hosted, so no cross-device features.
- **Points:** every app stores a permanent counter in `<slug>_points_v1` (10 per correct answer, +5 streak bonus from 3 in a row; a perfect 10-question lesson is 140). Each lobby already sums all its apps' keys, read from `data-points-key` attributes on the subject cards, into `#points-combined-badge`. Opening an app from the lobby uses `?reset=1`, which wipes that app's stars but never its points.
- **Study history:** root `study-history.js` and `grade 2/study-history-grade2.js` are **byte-identical** (`tests/copies.test.js` enforces this: edit the Grade 2 copy, then copy it to the root). Pages pick their grade with `<script src="..." data-grade="grade5|grade2">`, and it is exposed as `window.StudyHistory`. Both lobbies run an **identical Parent panel script** (also enforced by the test), gated by the hard-coded **PIN `0108`**, which lists history entries via `describe(e)`.
- **Parent panel identity check:** `tests/copies.test.js` compares the **last** inline `<script>` (no `src`) of each lobby, which is currently the Parent panel. Keep the Parent panel as the last inline script. Don't add a new inline script after it, or the test silently compares the wrong code. Grade-specific shop copy (English vs Taglish) can't be hard-coded in the Parent panel script because it must stay identical. Put it in each lobby's first inline script (the per-lobby points script) or in a per-grade data object. If you need a different structure, update the copies test to match and say so.
- **Tests:** `node --test` (unit tests in `tests/`; `node --test tests/` does NOT work on this machine), plus `node tests/e2e/lobby-e2e.js` and `node tests/e2e/lobby-e2e.js 5` (headless Chrome).

## The design (decided, don't re-litigate)
**Points and coins are separate.** Points stay the lifetime score that only goes up. Coins are spendable, and spending never lowers points.

**Coin formula, per grade:**
`balance = 40 (welcome gift) + floor((currentTotalPoints - baselinePoints) / 10) - coinsSpent`
- `baselinePoints` is snapshotted the first time the lobby loads after this feature ships, so points earned before launch do NOT become coins. Instead, both girls start with the 40-coin welcome gift, which is exactly one ML game on launch day.
- Clamp the earned part at 0, so it can never go negative.
- No daily earning cap in Phase 1.
- Edge case to record in the spec: if a subject card is added to a lobby later and that app already has points on the device, a single baseline would turn those old points into coins in one jump. To prevent this, store the baseline **per points key** (`baselines: { key: points }`), and snapshot a key the first time the lobby sees it. The balance is then 40 + floor(sum of (current − baseline) per key / 10) − spent, which is identical to the formula above for the launch-day apps.

**Two completely separate wallets, one per grade (must hold even when both lobbies run on the same laptop):**
- Grade 2 wallet: key `grade2_wallet_v1`, shown **only** in `grade 2/lobby.html`, earned **only** from the 7 Grade 2 apps' points keys.
- Grade 5 wallet: key `grade5_wallet_v1`, shown **only** in `lobby-grade5.html`, earned **only** from the 8 Grade 5 apps' points keys.
- Each wallet has its **own** baseline, its **own** 40-coin welcome gift, its **own** spent total and purchase list, and its **own** 1-ML-game-per-day limit. Grade 2 buying an ML game must not block Grade 5 from buying one that day, and the reverse.
- Never add the two wallets together, never show one child's coins in the other's lobby, and no transfers between them.
- The grade comes from the script tag's `data-grade` attribute, the same way study-history picks its key. Each wallet's points list comes from its own lobby's `data-points-key` cards, never a hard-coded list of all 15 apps.
- Each wallet stores its per-key baselines, total spent, and a purchase list (item id, coins, timestamp).
- Unit tests must prove the isolation: two wallets sharing one storage object, where earning, buying, the ML daily limit and the welcome gift in one never change the other.

**Shop (real-world rewards, both lobbies, same catalog):**

| Item | Coins | Limit |
|---|---|---|
| 🎮 Rest: play 1 ML (Mobile Legends) game | 40 | **max 1 per day** (local calendar date) |
| 🍽️ Choose what's for dinner | 100 | |
| 🍨 Dessert treat | 100 | |
| 📱 30 min extra screen time | 120 | |
| 🎬 Movie night pick | 300 | |
| 🌙 Stay up 30 min later | 400 | |
| 🧸 Small toy | 500 | |
| 🎡 Big goal: outing or a toy you've wanted | 1200 | |

Keep the catalog in one constant array so I can edit prices easily.

- **ML game rules to show on the item:** "One match, win or lose. Only after studying. Play time is extra, on top of your normal time."
- **Buying flow:** the child taps an item, then a parent enters PIN `0108` to approve, then coins are deducted. If there aren't enough coins, the item shows how many more she needs (e.g. "12 more coins") instead of a Buy button. If ML was already bought today, it shows "Come back tomorrow".
- Every purchase is **logged in the study history** as a new entry type (e.g. `type: 'purchase'`, with item and coins), and the Parent panel lists it with a 🛒 line. Keep the two history files byte-identical and the two Parent panel scripts identical.
- **UI:** a coin balance badge (🪙 N coins) near the existing points badge, and a "🛒 Shop" button that opens an overlay. Grade 5 copy is in English. Grade 2 copy is in light Taglish, matching that lobby's tone. Kid-friendly and phone-width safe. Show the next affordable goal ("40 more coins to Movie night!").
- Never take coins away for behavior or wrong answers. Coins only come from studying.

**Suggested structure:** a small wallet module, `wallet.js` at the root and a byte-identical `grade 2/wallet-grade2.js`, exposing a pure `create(storage, now, grade)` API like study-history (balance, canBuy, buy, purchases). Add it to `tests/copies.test.js` and write unit tests covering: welcome gift, baseline excluding old points, floor division, the ML 1-per-day limit across a day boundary (the day is the device's **local** calendar date, not UTC: the Philippines is UTC+8, so a UTC date would roll over at 8:00 AM and allow two ML games in one morning; test buys just before and just after local midnight, and two buys at 7 AM and 9 AM on the same local day), insufficient funds, a newly added points key being baselined on first sight (its old points give no coins), and that points are never written. Extend the lobby e2e for both grades.

## Later phases (record in the spec, DO NOT build now)
- **Phase 2, in-quiz power-ups** bought with coins. Max 2 per quiz, none in the Mock/Final Exam, a helped answer earns half points and doesn't extend the streak, and every use is logged in the study history so I can see weak topics:
  - 💡 Hint ~3 coins: shows the item's existing 💡 `tip` before answering.
  - ✂️ 50/50 ~5 coins: removes 2 wrong options. Disabled on True/False and on Block Bot number-line questions.
  - 🔁 Second Chance: retry before the answer is revealed, for half points.
  - 🛡️ Streak Shield: one wrong answer doesn't break the streak.
  - ⏭️ Save for Later: moves the question to the end of the quiz.
  - 👨‍👩‍👧 Ask Family: Ate (Grade 2 only, cheapest), Mommy, Tatay. The app pauses with "Go ask Mommy!". Rule: the helper explains but doesn't say the answer. She can cancel for a refund if no one is free.
  - The "Hindi maintindihan?" English helper stays FREE, never a power-up.
  - The points engine is copy-pasted into all 15 apps (three layout families plus Math Mastery's three modes), so extract a shared `study-kit.js` first.
- **Phase 3, cosmetics** (themes, mascot outfits): lowest priority, maybe never.

## Deployment note for the spec
`wallet.js` / `wallet-grade2.js` must be copied to each device along with the HTML, the same as the study-history files.

Start by reading both lobbies, `study-history.js`, and `tests/`, then write the spec.
