# Coin Wallet and Reward Shop — Design

Date: 2026-10-01. Source: `docs/superpowers/prompts/2026-10-01-coin-shop-prompt.md` (decisions made with the girls; not re-litigated here).

## Goal
Turn studying into spendable coins that buy real-world rewards, without touching the lifetime points score. Phase 1 only: the wallet, the shop overlay, parent PIN approval, and purchase logging.

## Points vs coins
- Points (`<slug>_points_v1`) stay the lifetime score. The wallet only reads them, never writes them.
- Coins: `balance = 40 + max(0, floor(Σ(current[key] − baseline[key]) / 10)) − spent`.
- **Per-key baselines.** The first time a lobby sees a points key, it records that key's current value as its baseline. Points earned before launch, or earned in an app before its card joins a lobby, never become coins.
- 40-coin welcome gift per wallet, which is exactly one ML game on launch day. No daily earning cap.
- The displayed balance is never below 0.

## Two separate wallets
| | Grade 2 | Grade 5 |
|---|---|---|
| Storage key | `grade2_wallet_v1` | `grade5_wallet_v1` |
| Lobby | `grade 2/lobby.html` | `lobby-grade5.html` |
| Module file | `grade 2/wallet-grade2.js` | `wallet.js` (byte-identical) |
| Earns from | that lobby's `data-points-key` cards only | same |

- The grade comes from `<script src="…" data-grade="grade2|grade5">`. An invalid or missing grade means no wallet (no silent default), and the lobby hides the coin badge and the Shop button.
- Each wallet has its own baselines, welcome gift, spent total, purchase list, and ML daily limit. There is no combining and no transfers.
- Stored shape: `{ v: 1, baselines: { key: points }, spent: N, purchases: [{ item, coins, t }] }`.

## Module API (`create(storage, now, grade)`, exposed as `window.Wallet`)
- `track(points)`: baselines any key not seen before. This is the only write besides `buy`.
- `balance(points)`, `canBuy(itemId, points)` → `{ ok, need, daily }`, `buy(itemId, points)` → the purchase record or `null`, `purchases()`.
- `CATALOG` is a single constant array in the module, so prices can be edited in one place.
- Daily limits use the device's **local** calendar date (`YYYY-MM-DD` from local time, the same as study history). A UTC date would roll over at 8:00 AM in the Philippines.

## Catalog
| id | Item | Coins | Limit |
|---|---|---|---|
| `ml` | 🎮 Rest: play 1 ML (Mobile Legends) game | 40 | 1 per local day |
| `dinner` | 🍽️ Choose what's for dinner | 100 | |
| `dessert` | 🍨 Dessert treat | 100 | |
| `screen` | 📱 30 min extra screen time | 120 | |
| `movie` | 🎬 Movie night pick | 300 | |
| `late` | 🌙 Stay up 30 min later | 400 | |
| `toy` | 🧸 Small toy | 500 | |
| `big` | 🎡 Big goal: outing or a toy you've wanted | 1200 | |

The ML item shows: "One match, win or lose. Only after studying. Play time is extra, on top of your normal time." (with a Taglish version for Grade 2).

## Lobby UI
- A coin badge (`🪙 N coins`) and a `🛒 Shop` button under the points badge.
- The Shop overlay lists every item:
  - **Buy** when affordable.
  - **"N more coins"** when not affordable.
  - **"Come back tomorrow"** when ML was already bought today.
- The overlay also shows the next goal: the cheapest item she can't afford yet ("160 more coins to Movie night!").
- Buying: tap Buy → a parent enters PIN `0108` (with a Cancel option) → coins are deducted → a success message is shown.
  - A wrong PIN shakes and nothing is spent.
  - Hiding the tab, pressing Escape, or closing the overlay cancels the purchase.
- Copy: Grade 5 in English, Grade 2 in light Taglish. Item names are the same English names in both lobbies.
- Phone-width safe, and styled like the Parent panel overlay.

### Script layout (keeps `tests/copies.test.js` meaningful)
1. `<script src="study-history…">` and `<script src="wallet…">` with `data-grade`.
2. The per-lobby points script, which now also sets `window.SHOP_TEXT` (the grade's copy).
3. `<script data-shop>`: the shop script, identical in both lobbies (the copies test now checks this).
4. `<script>`: the Parent panel, still the last plain inline script and still identical.

## Study history
- New entry type `purchase`: `{ type: 'purchase', app: 'shop', appTitle: 'Shop', item, itemName, coins }`, recorded by `StudyHistory.purchased(item, itemName, coins)`.
- Parent panel row: `🛒 Bought <item name> — <N> coins`.
- CSV: type `Shop purchase`, Lesson column `<item name> (<N> coins)`.
- Purchases count as 0 study minutes.
- Both history files stay byte-identical, and both Parent panel scripts stay identical.

## Follow-up decisions (2026-10-01)
- **Points are not reset when they become coins.** Points stay the lifetime score. The same points can never make coins twice, because `spent` is subtracted. The shop shows how the balance was made: `⭐ 1000 new points → 🪙 100 coins · 🎁 40 welcome · 🛒 40 spent` (Taglish in Grade 2), from `Wallet.earned(points)`.
- **Shop purchases are kept for 7 local days.** Each lobby load runs `StudyHistory.prunePurchases(7)` and `Wallet.prune(7)`. Only `purchase` entries are removed, and other study history stays. The wallet keeps `spent`, so pruning never gives coins back, and today's ML purchase stays, so the daily limit holds.
- **Download shop history (.csv)** button in the Parent panel's Backup section (`StudyHistory.exportPurchasesCsv()`: Date, Time, Item, Coins). A note there tells the parent to download weekly.
- The Grade 2 Buy button says "Buy" (not "Bilhin").

## Rules
- Coins come only from studying. Nothing takes coins away except a parent-approved purchase.
- Spending never lowers points.

## Tests
- `tests/wallet.test.js` covers:
  - the welcome gift, the baseline excluding old points, and floor division
  - clamping when points drop
  - a new key being baselined on first sight
  - insufficient funds
  - the ML limit across local midnight, plus 7 AM and 9 AM on the same day (with `TZ=Asia/Manila`)
  - points never written
  - write failure
  - grade validation
  - two wallets sharing one storage object, fully isolated
- `tests/study-history.test.js`: purchase entries (list, summary, CSV, import).
- `tests/copies.test.js`: the wallet files are identical, and the `data-shop` scripts are identical.
- `tests/e2e/lobby-e2e.js` (both grades):
  - the badge shows the welcome gift and baselines are snapshotted
  - earning, the next goal, and a PIN-approved buy (a wrong PIN spends nothing)
  - "Come back tomorrow"
  - the history 🛒 line
  - the other grade's wallet stays untouched
  - no-JS fallback hides the shop

## Deployment
Copy `wallet.js` (Grade 5) or `grade 2/wallet-grade2.js` (Grade 2) to each device next to the lobby, the same way as the study-history files. Without it, the lobby simply hides the coins and the shop.

## Later phases (not built now)
- **Phase 2: in-quiz power-ups** bought with coins.
  - Rules: max 2 per quiz, none in the Mock/Final Exam. A helped answer earns half points and doesn't extend the streak. Every use is logged in study history.
  - 💡 Hint (~3, shows the existing `tip`).
  - ✂️ 50/50 (~5, not on True/False or Block Bot number lines).
  - 🔁 Second Chance (half points).
  - 🛡️ Streak Shield.
  - ⏭️ Save for Later.
  - 👨‍👩‍👧 Ask Family: Ate is Grade 2 only and the cheapest; Mommy and Tatay too. The helper explains but doesn't give the answer. (Cancel-for-refund was dropped in 2c; see below.)
  - The "Hindi maintindihan?" helper stays free.
  - ~~First extract the copy-pasted points engine into a shared `study-kit.js`.~~ Not needed: the points rule is one line per game, so only the power-ups were shared.
- **Phase 2a: built 2026-10-01.** 💡 Hint (3) and ✂️ 50/50 (5), paid in the quiz (no PIN), in all 15 games' lesson quizzes.
  - `powerups.js` (Grade 5) = `grade 2/powerups-grade2.js` (byte-identical), loaded after the fx file with `data-grade`. Prices live in the wallet file (`POWER_UPS`); `Wallet.spend(coins)` raises `spent` and adds no purchase record.
  - Games call `PowerUps.offer({...})` when they show a question and `PowerUps.answered()` when the child answers; it returns whether the answer was helped. Helped and right: half points (5), the streak doesn't move, and the sound is a plain ding.
  - Tap twice to pay. 50/50 crosses out half the options (never on 2-option questions or Block Bot number lines); the crossed-out answers come back after answering so they can still be explored.
  - Each use is logged on the quiz entry (`powerUps: [{kind, coins, q}]`), shown in the Parent panel and in a new last "Power-ups" CSV column.
  - Math Mastery's UPAC Walkthrough and Case Studies have no power-ups: every step there already shows its tip and model answer.
  - Copy the power-ups file to each tablet next to the games, like the wallet and fx files. If the file is missing, the games still play, just without power-ups.
- **Phase 2b: built 2026-10-01.** Same bar, same max of 2 per quiz, none in the Mock Exam.
  - 🔁 Second Chance (5): bought before answering, on questions with 3+ options. A wrong first pick is caught before the game sees it (capture-phase click listener), marked, and she picks again. Half points only if the second try was needed.
  - 🛡️ Streak Shield (4): offered once the streak is 2+. The next miss in this quiz keeps the streak (`PowerUps.shield()` in every wrong branch); an unused shield ends with the quiz. It does not make an answer "helped".
  - ⏭️ Save for Later (2): not on the last question, and not once any help (Hint, 50/50, Second Chance, Ask Family) was used on that question; otherwise the help would carry into a full-points answer later. The question moves to the end of the round (`rerender` passed in `offer`) and is answered later for full points.
  - Once both power-ups are used, the button row hides and only the notes stay.
- **Phase 2c: built 2026-10-01.** 👨‍👩‍👧 Ask Family: one button opens a helper picker. Prices: 👧 Ate 2 (Grade 2 only), 👩 Mommy 4, 👨 Tatay 4.
  - After paying, a card says "Go ask Mommy!" / "Tanungin si Ate!": show them the question; they explain the idea but don't say the answer; she still chooses. A right answer earns half points (helped).
  - **No cancel (parent's choice, 2026-10-01):** paying is final. A cancel-before-answering refund was built first, then removed: she could get help and then cancel for full points and her coins back. The tap-twice confirm guards against mistakes, and the guide says to check first that the helper is free.
  - It runs on trust: the app can't check that anyone helped. One helper per question, and Save for Later is off while someone is explaining.
  - No game changes: it lives entirely in the power-ups file.
- **Phase 3: cosmetics** (themes, mascot outfits). **Skipped** (parent decided 2026-10-01: most work for the least learning).
