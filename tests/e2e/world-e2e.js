// The 3D world: first visit and the character maker, a door into a game and 🏠 back, quick travel, the waking-up
// cover when the browser takes the 3D graphics away, the resting card when 3D cannot start, and Grade 2.
// Run: node tests/e2e/world-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver, injectDriver, WEBGL_ARGS } = require('./chrome.js');
const { WORLDS, VENDOR_FILES, ENGINE_FILES, LOBBIES, web, app, appFile, lobbyFile, engineFile, worldFile } = require('../paths.js');
const { lessons } = require('../content.js');
const { keyOf } = require(engineFile('recall.js'));
const LESSON_FILES = require(worldFile('lesson-files.js'));
const { JESUS } = require(worldFile('lines.js'));

const WAIT_MS = 8000;
const work = makeWorkDir('world-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'world-driver.page.js'), 'utf8');
const RETURN = '{ grade: "grade5", app: "life-lab" }';

// Today already greeted and comforted, and this week's boss finale seen, so Jesus's daily visit and the finale do not
// cover the other cases. The Jesus and finale cases turn it off.
const CALM = '<script>(function () { var k = Guide.dayKey(Date.now());'
  + 'Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: k, bossWin: Boss.weekKey(Date.now()), t: 1 })); })();</script>';

function stageWorld(name, grade, before, calm = true) {
  let html = fs.readFileSync(web(WORLDS[grade]), 'utf8');
  const seed = (calm ? CALM : '') + (before || '');
  if (seed) {
    const tag = '<script src="../vendor/three/three.min.js"></script>';
    if (!html.includes(tag)) throw new Error('three.min.js tag not found');
    html = html.replace(tag, seed + tag);
  }
  const site = path.join(work, name);
  const file = stage(site, WORLDS[grade], appendDriver(html, driver), ENGINE_FILES);
  for (const f of VENDOR_FILES) {
    const to = path.join(site, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(web(f), to);
  }
  fs.copyFileSync(web('world/world.css'), path.join(site, 'world', 'world.css'));
  return file;
}

function run(name, file, mode) {
  return readOutput(dumpDom(path.join(work, 'profile-' + name), file, '#e2e=' + mode, WAIT_MS, WEBGL_ARGS));
}

const SEEDED = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "boy", skin: 1, hair: "short", hairColor: 2, outfit: 3, pet: "kitten", petName: "Tom", t: 5 }));'
  + 'sessionStorage.setItem("world_return_v1", JSON.stringify(' + RETURN + '));</script>';

try {
  const fresh = run('fresh', stageWorld('fresh', 5), 'fresh');
  assert.deepEqual(fresh.errors, [], 'fresh: page errors');
  assert.equal(fresh.makerOpen, true, 'the first visit opens the character maker');
  assert.equal(fresh.makerTitle, 'Make your character!');
  assert.equal(fresh.makerClosed, true);
  assert.equal(fresh.saved.hair, 'bob');
  assert.equal(fresh.saved.pet, 'puppy');
  assert.ok(fresh.saved.t > 0, 'saved with a time');
  assert.deepEqual([fresh.at.x, fresh.at.z], [0, 84], 'she starts at the gate');
  assert.equal(fresh.near, 'life-lab');
  assert.equal(fresh.act, '🔬 Go to Science!');
  assert.equal(fresh.went, '../subjects/grade-5/science/index.html?reset=1', 'the door opens the lobby card\'s page');
  assert.deepEqual([fresh.ret.grade, fresh.ret.app], ['grade5', 'life-lab']);
  assert.ok(fresh.ret.before && fresh.ret.before.at > 0, 'the door keeps what she had, for her pet to celebrate');
  assert.deepEqual([fresh.park.x, fresh.park.z], [-48, 44], 'quick travel lands in the park');
  console.log('ok first visit, door, quick travel');

  const back = run('back', stageWorld('back', 5, SEEDED), 'back');
  assert.deepEqual(back.errors, [], 'back: page errors');
  assert.equal(back.makerOpen, false, 'a made character skips the maker');
  assert.equal(back.state.near, 'life-lab', 'back from a game, she stands outside its door');
  assert.ok(back.view.dist < 15 / 0.45 - 5, 'the camera stops short of the building behind her: ' + back.view.dist);
  console.log('ok back at the door');

  const snd = run('sounds', stageWorld('sounds', 5, SEEDED), 'sounds');
  assert.deepEqual(snd.errors, [], 'sounds: page errors');
  assert.ok(snd.heard.includes('emote-wave'), 'her emote reaches the sound engine');
  assert.ok(snd.heard.includes('pet-kitten'), 'a tap on her kitten asks for its meow');
  assert.equal(snd.stepsLabel, '👣 Footsteps');
  assert.equal(snd.prefs.steps, false, 'Off saves footsteps off on this device');
  assert.equal(snd.packLabel, '🎵 Sounds');
  assert.equal(snd.packBefore, 'kids', 'Happy Chimes is the default');
  assert.equal(snd.packAfter, 'battle', 'the Settings choice switches the pack');
  assert.equal(snd.packPressed, 'true');
  console.log('ok sounds: emote, pet voice, footsteps setting');

  const lost = run('lost', stageWorld('lost', 5, SEEDED), 'lost');
  assert.deepEqual(lost.errors, [], 'lost: page errors');
  assert.equal(lost.hasExt, true, 'Chrome can lose the context on purpose');
  assert.equal(lost.wakingShown, true, 'the waking-up cover shows');
  assert.equal(lost.wakingHiddenAfter, true, 'and goes away when the graphics come back');
  console.log('ok waking up');

  // Medals, markers, Mimi and the trail, the guide's door link and the fort, from seeded progress.
  const WEEK = 'function p(n) { return (n < 10 ? "0" : "") + n; }'
    + 'var d = new Date(), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7);'
    + 'var week = m.getFullYear() + "-" + p(m.getMonth() + 1) + "-" + p(m.getDate());';
  const AVATAR = 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));';
  const AVATAR_SCRIPT = '<script>' + AVATAR + '</script>';
  const PROGRESS = '<script>(function () {' + WEEK
    + 'Learner.storage.setItem("boss_v1", JSON.stringify({ v: 1, week: week, stages: [{ app: "life-lab", title: "Matter", cleared: false }, { app: "math-mastery", title: "Fractions", cleared: true }], paid: [] }));'
    + 'Learner.storage.setItem("mastery_v1", JSON.stringify({ v: 1, apps: { "life-lab": { t: 1, order: ["a"], lessons: { a: { title: "Matter", now: 3, best: 3, paid: 3 } } } } }));'
    + 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));'
    + '})();</script>';
  const prog = run('progress', stageWorld('progress', 5, PROGRESS), 'progress');
  assert.deepEqual(prog.errors, [], 'progress: page errors');
  assert.equal(prog.lifeLevel, 3, 'all-gold Science has a gold roof');
  assert.deepEqual(prog.lifeMarkers, ['boss'], 'the boss stage floats over Science');
  assert.equal(prog.fort.next, 'life-lab');
  assert.equal(prog.fort.cleared, 1);
  assert.equal(prog.fort.total, 2);
  assert.equal(prog.target, 'life-lab', 'the guide points at the boss stage');
  assert.equal(prog.greeted, true, 'Mimi greets her the first time today she comes to the plaza');
  assert.equal(prog.mimiText, '⚔️ The boss is waiting in Science! Follow the sparkles ✨');
  assert.equal(prog.trail.to, 'life-lab');
  assert.ok(prog.trail.count > 10, 'the sparkle trail is drawn');
  assert.deepEqual(prog.trailAfterArrive, { to: null, count: 0 }, 'the trail goes out when she arrives');
  assert.equal(prog.doorWent, '../subjects/grade-5/science/index.html?reset=1&boss=1', 'the door keeps the guide\'s link');
  assert.equal(prog.fortHref, '../subjects/grade-5/science/index.html?reset=1&boss=1', 'the fort opens the next boss stage');
  console.log('ok medals, markers, Mimi, trail, fort');

  // The boss stands beside the fort (off the path) with 3 minions for each open stage, and says hello with the real count.
  const FORT = '<script>(function () {' + WEEK
    + 'Learner.storage.setItem("boss_v1", JSON.stringify({ v: 1, week: week, stages: [{ app: "life-lab", title: "Matter", cleared: false }, { app: "math-mastery", title: "Fractions", cleared: false }, { app: "page-turners", title: "Nouns", cleared: true }], paid: [] }));'
    + AVATAR + '})();</script>';
  const fort = run('fort', stageWorld('fort', 5, FORT), 'fort');
  assert.deepEqual(fort.errors, [], 'fort: page errors');
  assert.equal(fort.fort.minions, 6, '2 open stages × 3');
  assert.equal(fort.boss.minions, 6, 'six minions stand around him');
  assert.equal(fort.boss.shown, true);
  assert.equal(fort.onPath, false, 'his stage and minions stay off the path');
  assert.equal(fort.act, '⚔️ Enter the Boss Fort!');
  assert.match(fort.text, / 6 /, 'his hello has the real count');
  assert.deepEqual(fort.buttons, ['⚔️ Enter the Boss Fort!', 'Later']);
  console.log('ok fort boss');

  // Every stage cleared and the finale not seen: the finale step, the pop, the chest, then once only.
  const DAILY_NOT_SEEN = 'var k = Guide.dayKey(Date.now()); Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: k, t: 1 }));';
  const FINALE = '<script>(function () {' + WEEK + DAILY_NOT_SEEN
    + 'Learner.storage.setItem("boss_v1", JSON.stringify({ v: 1, week: week, stages: [{ app: "life-lab", title: "Matter", cleared: true }, { app: "math-mastery", title: "Fractions", cleared: true }], paid: [week + "|full"] }));'
    + AVATAR + '})();</script>';
  const fin = run('finale', stageWorld('finale', 5, FINALE, false), 'finale');
  assert.deepEqual(fin.errors, [], 'finale: page errors');
  assert.equal(fin.finale, true);
  assert.equal(fin.target, 'boss', "Mimi's trail goes to the fort");
  assert.equal(fin.step, '🎉 You cleared every stage! Go see the boss at the Boss Fort!');
  assert.equal(fin.before.shown, true, 'he waits for his finale');
  assert.equal(fin.before.minions, 0);
  assert.equal(fin.act, '🎉 See the boss!');
  assert.equal(fin.during.playing, true);
  assert.match(fin.beatenText, /you win!/i);
  assert.deepEqual(fin.chestButtons, ['🎁 Open!']);
  assert.equal(fin.chestClosed, 'closed', 'the chest dropped');
  assert.match(fin.winText, /^You beat .+! Your 10 coins are already in your wallet 🪙$/);
  assert.equal(fin.chestOpen, 'open');
  assert.equal(fin.daily.bossWin.length, 10, "bossWin saved as this week's key");
  assert.equal(fin.after, false, 'the finale plays once a week');
  assert.equal(fin.afterBoss.shown, false);
  assert.equal(fin.afterBoss.chest, 'open', 'the open chest stays for the week');
  assert.equal(fin.afterAct, '💤 Boss Fort');
  console.log('ok boss finale');

  const SHOP_BACK = '<script>sessionStorage.setItem("world_return_v1", JSON.stringify({ grade: "grade5", app: "shop" }));'
    + 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));</script>';
  const back2 = run('shopback', stageWorld('shopback', 5, SHOP_BACK), 'back');
  assert.deepEqual(back2.errors, [], 'shop back: page errors');
  assert.deepEqual([back2.state.x, back2.state.z], [54, 0], 'back from the shop she stands in Shop Plaza');
  console.log('ok back in Shop Plaza');

  // The lobby shop opened from the world sends her back when she closes it.
  const lobbyDriver = 'addEventListener("pageshow", function () { setTimeout(function () {'
    + 'var went = null; ShopReturn.go = function (u) { went = u; };'
    + 'var open = !document.getElementById("shop-overlay").hidden;'
    + 'document.getElementById("shop-close").click();'
    + 'var pre = document.createElement("pre"); pre.id = "e2e-out";'
    + 'pre.textContent = JSON.stringify({ open: open, went: went, ret: JSON.parse(sessionStorage.getItem("world_return_v1")), errors: window.__e2eErrors || [] });'
    + 'document.body.appendChild(pre); }, 0); });';
  const lobbyFile5 = stage(path.join(work, 'lobby'), LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), lobbyDriver), ENGINE_FILES);
  const shop = readOutput(dumpDom(path.join(work, 'profile-lobby'), lobbyFile5, '#shop-world', 3000));
  assert.deepEqual(shop.errors, [], 'lobby: page errors');
  assert.equal(shop.open, true, '#shop-world opens the shop');
  assert.equal(shop.went, '../world/grade-5.html', 'closing it goes back to the world');
  assert.deepEqual(shop.ret, { grade: 'grade5', app: 'shop' });
  console.log('ok lobby shop and back');

  const noGl = '<script>HTMLCanvasElement.prototype.getContext = function () { return null; };</script>';
  const rest = run('resting', stageWorld('resting', 5, noGl), 'resting');
  assert.equal(rest.resting, true, 'no 3D: the resting card shows');
  assert.equal(rest.loadingHidden, true);
  assert.equal(rest.href, '../lobby/grade-5.html');
  assert.equal(rest.title, 'The world is resting 😴');
  console.log('ok resting card');

  const g2 = run('grade2', stageWorld('grade2', 2), 'grade2');
  assert.deepEqual(g2.errors, [], 'grade 2: page errors');
  assert.equal(g2.makerOpen, true);
  assert.equal(g2.makerTitle, 'Make your character!', 'Grade 2 labels are English by default');
  assert.equal(g2.bigJoystick, true);
  assert.equal(g2.plainTap, true, 'a tap walks her there');
  assert.equal(g2.pinchTap, false, 'lifting the fingers after a pinch is not a tap');
  assert.equal(g2.play, '🎾 Play', 'buttons stay English on Grade 2');
  assert.match(g2.buddyText, /^Beep! Hello, friend! /, 'a Grade 2 buddy speaks English by default');
  assert.doesNotMatch(g2.buddyText, /Kumusta/, 'no Filipino until the switch is on');
  console.log('ok grade 2');

  // Talking characters: a buddy's line, ❓ Ask me! moving the same review box the game would, a lesson file that does not
  // load, Hoot, Bunny and a tree. The question is one without HTML, so its plain text is its button's text.
  const item = lessons('life-lab').flatMap((l) => l.quiz).find((q) => !q.art && !/[<&]/.test(q.q + q.options.join('')));
  const answer = item.options[item.correct];
  const key = keyOf('life-lab', { q: item.q, answer });
  const TALK = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));'
    + 'var __items = {}; __items[' + JSON.stringify(key) + '] = { box: 2, due: "2026-01-01", t: 1 }; __items["page-turners|feed"] = { box: 1, due: "2026-01-01", t: 1 };'
    + 'Learner.storage.setItem("review_v1", JSON.stringify({ v: 1, items: __items }));'
    + 'window.__key = ' + JSON.stringify(key) + '; window.__answer = ' + JSON.stringify(answer) + ';</script>';
  const talkFile = stageWorld('talk', 5, TALK);
  const lf = LESSON_FILES['life-lab'];
  for (const f of lf.files) {
    const to = path.join(work, 'talk', 'world', lf.dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(web('world'), lf.dir, f), to);
  }
  const talk = run('talk', talkFile, 'talk');
  assert.deepEqual(talk.errors, [], 'talk: page errors');
  assert.equal(talk.near, 'buddy:life-lab');
  assert.equal(talk.act, '💬 Talk to Fizz');
  assert.equal(talk.buddyText, 'Ribbit! Science is so cool! 🔁 1 question is ready for review. Tap Ask me!');
  assert.deepEqual(talk.buddyButtons, ['❓ Ask me!', '💬 More', '👋 Bye'], 'the main button comes first');
  assert.ok(talk.options.includes(answer), 'the due question is asked');
  assert.equal(talk.after, '🎉 Right! +14 points');
  assert.equal(talk.box, 3, 'the same review box the game uses moved up');
  assert.equal(talk.points, '14');
  assert.deepEqual(talk.history, [{ kind: 'review', correct: 1, finished: false }]);
  assert.equal(talk.failText, "📖 Let's ask in the game!");
  assert.deepEqual(talk.failButtons, ['📖 Go to English!', '👋 Bye']);
  assert.equal(talk.hootNear, 'hoot');
  assert.equal(talk.hootText, 'Hoo-hoo! 1 question is ready for review. Shall I ask you?');
  assert.match(talk.bunnyText, /coins/);
  assert.deepEqual(talk.bunnyButtons, ['🛍️ Open the shop', '💬 More', '👋 Bye']);
  assert.equal(talk.treeNear, 'tree:0');
  assert.equal(talk.treeText, talk.treeWant);
  console.log('ok buddies, Ask me!, Hoot, Bunny and a tree');
  // The pet teacher: a wrong answer to Fizz's question, and her chick explains it with her pick, the right answer and
  // the lesson's steps; Got It! hands back to Fizz.
  const teach = run('teach', talkFile, 'teach');
  assert.deepEqual(teach.errors, [], 'teach: page errors');
  assert.ok(teach.teach, 'the pet teacher bubble shows');
  assert.equal(teach.teach.who, '🐥 Piyo');
  assert.equal(teach.teach.picked, teach.wrong);
  assert.equal(teach.teach.answer, answer);
  assert.equal(teach.teach.steps[teach.teach.steps.length - 1], 'Remember: ' + answer);
  assert.ok(teach.teach.steps.length >= 2, 'the lesson explains it: ' + JSON.stringify(teach.teach.steps));
  assert.deepEqual(teach.teachButtons, ['Got It!']);
  assert.equal(teach.petTeaching, true);
  assert.equal(teach.petBubble, '💡');
  assert.equal(teach.box, 1, 'scored like the game: a wrong answer sends it to box 1');
  assert.equal(teach.afterText, 'The right answer is ' + answer);
  assert.deepEqual(teach.afterButtons, ['👋 Bye']);
  assert.equal(teach.petAfter, false);
  console.log('ok the pet teacher');

  // Gifts and monsters: a Hard gift (her due box-1 question) pays 3 coins and a found item; a fresh question is Easy;
  // a wrong answer brings the pet teacher and Try again; a monster calls a helper, and the helper's gift is earned.
  const LOOT = TALK.replace('{ box: 2, due: "2026-01-01", t: 1 }', '{ box: 1, due: "2026-01-01", t: 1 }');
  assert.notEqual(LOOT, TALK);
  const lootFile = stageWorld('loot', 5, LOOT);
  for (const f of lf.files) {
    const to = path.join(work, 'loot', 'world', lf.dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(web('world'), lf.dir, f), to);
  }
  const loot = run('loot', lootFile, 'loot');
  assert.deepEqual(loot.errors, [], 'loot: page errors');
  assert.match(loot.giftNear, /^gift:/);
  assert.equal(loot.giftAct, '🎁 Open the gift');
  assert.match(loot.hardSub, /⭐⭐⭐ Hard/);
  assert.equal(loot.hardText, '🎉 Right! The gift is open!');
  assert.match(loot.hardSub2, /🪙 You got 3 coins!/);
  assert.match(loot.hardSub2, /✨ You found .*! Wear it at the mirror\./);
  assert.equal(Object.keys(loot.wardrobe.owned).length, 1, 'one found item saved');
  assert.equal(Object.values(loot.wardrobe.owned)[0].coins, 0);
  assert.equal(loot.afterOpen, 0, 'the opened gift is gone');
  assert.match(loot.easySub, /⭐ Easy/);
  assert.ok(loot.teach && loot.teach.steps.length >= 1, 'the pet teacher explains');
  assert.equal(loot.closedText, 'Still closed! Try another question?');
  assert.deepEqual(loot.closedButtons, ['🔁 Try again', '👋 Bye']);
  assert.equal(loot.easyText, '🎉 Right! The gift is open!');
  assert.match(loot.monsterNear, /^monster:/);
  assert.equal(loot.monsterAct, '⚔️ Battle Grumble');
  assert.equal(loot.calledText, 'Hehe! I called a friend!');
  assert.deepEqual(loot.afterWrong, [true], 'the monster is gone, its helper is here');
  assert.equal(loot.defeatText, 'Pop! You did it! I left you a gift! 🎁');
  assert.equal(loot.monstersLeft, 0);
  assert.deepEqual(loot.dropped, ['easy']);
  assert.equal(loot.earnedText, '🎉 A gift from the monster!');
  assert.match(loot.earnedSub, /🪙 You got 1 coin!/);
  assert.equal(loot.coins, 5, '3 + 1 + 1 world coins');
  assert.equal(loot.loot.coins, 5);
  assert.ok(loot.loot.asked.length >= 4, 'every question asked is kept for today');
  assert.ok(loot.history.length >= 1 && loot.history.every((e) => e.kind === 'review' && !e.finished), 'saved like Ask me!, never finished');
  console.log('ok gifts and monsters');

  // Playground games: tag from a kid's bubble, hide-and-seek from the board, Play again (she hides, disguises, Boo!),
  // and a friend running up to ask.
  const games = run('games', stageWorld('games', 5, AVATAR_SCRIPT), 'games');
  assert.deepEqual(games.errors, [], 'games: page errors');
  assert.ok(games.talkButtons.includes("🎲 Let's play!"), games.talkButtons.join());
  assert.deepEqual(games.kindButtons, ['🏃 Tag & Chase', '🙈 Hide & Seek', '👋 Bye']);
  assert.deepEqual(games.chaseButtons, ['🏷️ Tag!', '🏃 Patintero!', '⬅ Back', '👋 Bye']);
  assert.equal(games.tag.kind, 'tag');
  assert.equal(games.tag.it, 'her');
  assert.equal(games.tag.players, 4);
  assert.ok(games.tag.props >= 4, 'random props for tag');
  assert.match(games.tag.pill, /^🏷️ You're it! Tag a friend! · ⏱️ 2:00$/);
  assert.equal(games.tagged.it, games.tagged.want, 'the kid she touched is it');
  assert.match(games.tagged.pill, /is counting… 3/);
  assert.deepEqual([games.chase.glow, games.chase.caught, games.chase.glowAfter], [true, true, false], 'a close chaser makes the edge glow until she is caught');
  assert.ok(games.chase.beats >= 1, 'the heartbeat thumps while the chaser is close');
  assert.deepEqual(games.afterEnd, { playing: false, talking: false, props: 0 }, '✖ End game: no bubble, props gone');
  assert.equal(games.boardAct, '🎲 Games board');
  assert.deepEqual(games.boardButtons, ['🏃 Tag & Chase', '🙈 Hide & Seek', '👋 Bye']);
  assert.equal(games.seekStart.kind, 'seek');
  assert.equal(games.seekStart.count, 10);
  assert.match(games.seekStart.pill, /Cover your eyes and count… 10/);
  assert.ok(games.seekStart.props >= 10, 'props all over the map: ' + games.seekStart.props);
  assert.equal(games.frozenCount, true, 'she cannot move while counting');
  assert.equal(games.seekStart.cover, '10', 'her eyes are covered while she counts');
  assert.deepEqual(games.afterCount, { cover: null, hidden: 4, hint: null }, 'eyes open on hidden kids, and no hint yet');
  assert.equal(games.hidden, 4);
  assert.equal(games.hiddenDrawn, 0, 'hidden kids are not drawn');
  assert.equal(games.endText, "You found everyone! You're a great finder! 🔎");
  assert.deepEqual(games.endButtons, ['🔁 Play again', '👋 Bye']);
  assert.ok(games.endSub.length > 10, 'a reason the game is good for her');
  assert.equal(games.hide.kind, 'hide');
  assert.equal(games.hide.phase, 'count');
  assert.match(games.hide.pill, /Hide! .* is counting… 10/);
  assert.equal(games.disguiseShown, true);
  assert.equal(games.disguised, true);
  assert.equal(games.booShown, true);
  assert.match(games.booText, /^You surprised .*! 😆 You win!$/);
  assert.deepEqual(games.afterBoo, { disguised: false, playing: false });
  assert.match(games.inviteText, /^Want to play (tag|hide-and-seek|Patintero)\?$/);
  assert.deepEqual(games.inviteButtons, ['Yes!', 'No thanks']);
  assert.equal(games.afterNo, false);
  console.log('ok playground games: tag, hide-and-seek, disguise and Boo!, a friend asks');

  // Patintero: she runs first and is frozen while the ready count runs; a guard tags her and she guards the middle line
  // behind her fence; she tags a runner and her team runs again; ✖ End game takes the rings and the fence away; the
  // board starts it too.
  const pat = run('patintero', stageWorld('patintero', 5, AVATAR_SCRIPT), 'patintero');
  assert.deepEqual(pat.errors, [], 'patintero: page errors');
  assert.equal(pat.start.kind, 'patintero');
  assert.equal(pat.start.phase, 'ready');
  assert.match(pat.start.pill, /^🏃 Patintero 🔵 0 – 0 🔴 · ⏱️ 4:00$/);
  assert.equal(pat.start.hint, 'Cross every line and come back!');
  assert.deepEqual(pat.start.teams, [4, 4]);
  assert.equal(pat.start.rings, 8);
  assert.equal(pat.start.behindHome, true, 'she starts behind the home line');
  assert.equal(pat.start.movedWhileReady, false, 'she cannot move while the ready count runs');
  assert.equal(pat.play.phase, 'play');
  assert.deepEqual([pat.tagged.guarding, pat.tagged.post, pat.tagged.onMid], [true, 'mid', true], 'tagged: she guards on the middle line');
  assert.deepEqual(pat.tagged.fenced, { side: true, mid: true });
  assert.equal(pat.tagged.hint, '😲 Tagged! Teams swap!');
  assert.equal(pat.tagger.running, true);
  assert.equal(pat.tagger.hint, '🎉 Got one! Teams swap!');
  assert.deepEqual(pat.afterEnd, { playing: false, rings: 0, walks: true }, '✖ End game: no rings, no fence');
  assert.equal(pat.fromBoard, 'patintero');
  console.log('ok patintero: ready, tagged and guarding, tagging back, end, from the board');

  // Playmates part 1: nine kids near the playground only, a friend on the see-saw's far end who lands with her, Ella's
  // study question saved to history with 0 points and no review box, an invited friend on the other swing, Migo's fun
  // question remembered in mates_v1.
  const MATES = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 0, hair: "bob", hairColor: 0, outfit: 0, pet: "chick", petName: "", t: 5 }));'
    + 'Math.random = (function () { var s = 7; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();</script>';
  const matesFile = stageWorld('mates', 5, MATES);
  for (const f of lf.files) {
    const to = path.join(work, 'mates', 'world', lf.dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(web('world'), lf.dir, f), to);
  }
  const mt = run('mates', matesFile, 'mates');
  assert.deepEqual(mt.errors, [], 'mates: page errors');
  assert.equal(mt.visible, 9, 'nine kids at the playground');
  assert.equal(mt.seesawAct, '⚖️ Ride the see-saw!', 'the ride stays the thing to tap');
  assert.deepEqual(mt.partner, [1], 'a friend on the far end');
  assert.equal(mt.landed, 0, 'everyone got off with her');
  assert.deepEqual(mt.ellaButtons.slice(-3), ["🎠 Let's play!", "🎲 Let's play!", '👋 Bye']);
  assert.ok(mt.ellaButtons.length >= 5, 'a Life Lab question with its choices: ' + mt.ellaButtons);
  assert.ok(/Galing|Right|smart|Oops/.test(mt.ellaAfter), mt.ellaAfter);
  assert.deepEqual(mt.history, [{ kind: 'review', answered: 1, finished: false, points: 0 }]);
  assert.equal(mt.points, null, 'no points');
  assert.equal(mt.reviewSame, true, 'no review box moved');
  assert.equal(mt.asked, 1);
  assert.equal(mt.ellaState, 'follow');
  assert.deepEqual(mt.ellaSeat, { id: 'swings', i: 1 }, 'the invited friend takes the other swing');
  assert.ok(mt.migoButtons.length >= 4, 'a fun question with choices');
  assert.ok(/Me too|cool/.test(mt.migoAfter), mt.migoAfter);
  assert.equal(Object.keys(mt.fun).length, 1, 'Migo remembers her answer');
  assert.equal(mt.farVisible, 0, 'hidden away from the playground');
  console.log('ok playmates: ride together, study and fun questions, invite');

  // Phase 4: Jesus greets her once a day where she starts; Hug sends hearts; Bye walks him back to his bench; in his
  // garden he talks with her. On a hard day (a boss stage missed today) he comes in a golden glow.
  const says = (list) => list.map((l) => l.say);
  const kin = run('kin', stageWorld('kin', 5, AVATAR_SCRIPT, false), 'kin');
  assert.deepEqual(kin.errors, [], 'kin: page errors');
  assert.ok(says(JESUS.grade5.greet).includes(kin.greetText), 'a morning greeting: ' + kin.greetText);
  assert.deepEqual(kin.greetButtons, ['🤗 Hug', '👋 Bye']);
  assert.equal(kin.came.glow, false, 'no glow on a good day');
  assert.ok(says(JESUS.grade5.hug).includes(kin.hugText), kin.hugText);
  assert.equal(kin.back.mode, 'garden', 'after Bye he goes back to his bench');
  assert.equal(kin.daily.greeted, kin.today);
  assert.equal(kin.daily.comforted || '', '');
  assert.equal(kin.again, false, 'once a day');
  assert.equal(kin.gardenNear, 'jesus');
  assert.equal(kin.gardenAct, '💬 Talk to Jesus');
  assert.deepEqual(kin.gardenButtons, ['🤗 Hug', '💬 More', '👋 Bye']);
  assert.ok(says(JESUS.grade5.garden).includes(kin.gardenText), kin.gardenText);
  console.log('ok Jesus: greeting, hug, back to the garden, garden talk');

  const SAD = AVATAR_SCRIPT + '<script>(function () { var k = Guide.dayKey(Date.now());'
    + 'Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: "", t: 1 }));'
    + 'Learner.storage.setItem("boss_missed_v1", JSON.stringify({ v: 1, day: k })); })();</script>';
  const sad = run('comfort', stageWorld('comfort', 5, SAD, false), 'comfort');
  assert.deepEqual(sad.errors, [], 'comfort: page errors');
  assert.ok(says(JESUS.grade5.comfort.boss).includes(sad.text), 'comfort for the missed boss stage: ' + sad.text);
  assert.equal(sad.glow, true, 'he comes in a golden glow');
  assert.equal(sad.daily.comforted, sad.today);
  console.log('ok Jesus comforts her on a hard day');

  // Her sister by the gate takes a cheer; a swing goes on until Stop, the slide ends by itself, the 10-minute nudge stops a merry-go-round ride and brings Mimi.
  const FAMILY = AVATAR_SCRIPT + '<script>(function () { var now = Date.now();'
    + 'Learner.storage.setItem("family_peek_v1", JSON.stringify({ mia: { profile: { name: "Mia", grade: 2 }, world: {},'
    + ' look: { v: 1, body: "girl", skin: 1, hair: "pigtails", hairColor: 3, outfit: 2, pet: "panda", petWear: { hat: "pet-crown" }, petName: "", t: 5 },'
    + ' family: { v: 1, at: now, news: [], sent: [] }, total: 0, readAt: now } })); })();</script>';
  const fam = run('family', stageWorld('family', 5, FAMILY), 'family');
  assert.deepEqual(fam.errors, [], 'family: page errors');
  assert.deepEqual(fam.sisters, ['mia']);
  assert.equal(fam.near, 'sister:mia');
  assert.equal(fam.act, '💬 Talk to Mia');
  assert.equal(fam.petNearSister, '💖', 'her pet shows a heart near her sister');
  assert.deepEqual(fam.sisterPets, [{ pet: 'panda', hat: 'pet-crown', spot: 'walk' }], 'her sister\'s pet as she saved it');
  assert.deepEqual([fam.play.action, fam.play.buddy], ['play', true], 'near her sister\'s pet, they play');
  assert.deepEqual([fam.played.action, fam.played.buddy, fam.played.bubble], [null, false, '💖']);
  assert.deepEqual(fam.sisterPetsAfter, fam.sisterPets, 'her sister\'s pet goes back as it was');
  assert.equal(fam.replay, null, 'not again within a minute');
  assert.equal(fam.text, '✨ Mia is playing now! Want to send a cheer?');
  assert.equal(fam.buttons.length, 7, 'six cheers and Bye');
  assert.equal(fam.buttons[6], '👋 Bye');
  assert.equal(fam.sent, 1, 'the cheer is saved, to go out on the next sync');
  assert.equal(fam.sentText, 'Sent! 💌');
  assert.equal(fam.rideAct, '🌈 Ride the swing!');
  assert.equal(fam.riding, 'swings');
  assert.equal(fam.stillRiding, 'swings', 'the swing goes on until Stop');
  assert.equal(fam.stopShown, true, 'Stop shows while it loops');
  assert.ok(Math.abs(fam.rideZoom - 0.45 / 0.9) < 1e-9, 'she can zoom while she rides: ' + fam.rideZoom);
  assert.equal(fam.stopAfterTap, false, 'Stop hides once tapped');
  assert.equal(fam.rodeDone, null, 'after Stop she lands');
  assert.deepEqual(fam.rideSounds, ['ride-start', 'swing', 'swing', 'swing', 'swing', 'swing', 'swing', 'swing', 'ride-land'],
    'a creak each second until the ending, then the landing');
  assert.deepEqual([fam.after.x, fam.after.z], [fam.end.x, fam.end.z], 'she lands beside the swing');
  assert.equal(fam.slideRiding, 'slide');
  assert.equal(fam.slideStop, false, 'the slide has no Stop');
  assert.equal(fam.slideDone, null, 'the slide ends by itself');
  assert.equal(fam.merryRiding, 'merry');
  assert.equal(fam.nudgeRiding, null, 'the nudge stops the ride first');
  assert.equal(fam.nudgeText.indexOf("Let's learn something!"), 0, fam.nudgeText);
  assert.equal(fam.sisGame.ids.length, 5, 'four kids and her sister: ' + fam.sisGame.ids.join());
  assert.equal(fam.sisGame.ids[4], 'sister');
  assert.notEqual(fam.sisGame.near, 'sister:mia', 'her sister in a game is not for talking to');
  assert.equal(fam.sisIt.it, 'sister', 'she can tag her sister');
  assert.match(fam.sisIt.pill, /^🏷️ Mia is counting… 3/);
  assert.deepEqual(fam.sisChase, { glow: true, caught: true, moved: true }, 'her sister chases and catches her');
  assert.equal(fam.sisBack, true, 'after the game her sister walks back');
  assert.deepEqual([fam.sisHome.back, fam.sisHome.game, fam.sisHome.x, fam.sisHome.z], [false, false, fam.sisSpot.x, fam.sisSpot.z], 'to her spot by the gate');
  console.log('ok sister cheers, a looping ride and Stop, the slide, the 10-minute nudge');

  // Sprint makes her 1.4x as fast and turns off when she stops; the wheel and a pinch zoom, kept on the device.
  const ctlRun = run('controls', stageWorld('controls', 5, AVATAR_SCRIPT), 'controls');
  assert.deepEqual(ctlRun.errors, [], 'controls: page errors');
  assert.equal(ctlRun.startZoom, 0.45, 'the world starts zoomed all the way out');
  assert.equal(ctlRun.pressed, 'true');
  assert.equal(ctlRun.armed, true, 'sprint stays on while she stands');
  assert.ok(Math.abs(ctlRun.ran / ctlRun.walked - 1.4) < 0.05, 'sprint is 1.4x: ' + ctlRun.ran + ' vs ' + ctlRun.walked);
  assert.equal(ctlRun.speedOn, true, 'speed lines while she runs');
  assert.equal(ctlRun.pressedBrief, 'true', 'a moment\'s pause (changing keys) keeps sprint on');
  assert.equal(ctlRun.pressedAfter, 'false', 'sprint turns off once she has stopped');
  assert.equal(ctlRun.speedAfter, false);
  assert.equal(ctlRun.wheelZoom, 1.5, 'the wheel zooms in up to 1.5x');
  assert.ok(Math.abs(ctlRun.dist - 10) < 0.5, 'the camera comes in to 15 / 1.5: ' + ctlRun.dist);
  assert.ok(Math.abs(ctlRun.pinchZoom - 1.2) < 1e-9, 'pinching 200px to 160px zooms 1.5x to 1.2x: ' + ctlRun.pinchZoom);
  assert.equal(ctlRun.pinchYaw, true, 'a pinch does not turn the camera');
  assert.equal(ctlRun.gauge, Math.round((ctlRun.pinchZoom - 0.45) / 1.05 * 100) + '%', 'the gauge shows the zoom level');
  assert.ok(Math.abs(ctlRun.afterOut - ctlRun.pinchZoom / 1.2) < 1e-9, 'the − button zooms out a step');
  assert.ok(Math.abs(ctlRun.afterIn - ctlRun.pinchZoom) < 1e-9, 'the + button zooms in a step');
  const ZOOMED = AVATAR_SCRIPT + '<script>Learner.storage.setItem("world3d_device_v1", JSON.stringify({ v: 1, quality: "auto", music: true, steps: true, zoom: 1.5 }));</script>';
  const zoomed = run('zoomed', stageWorld('zoomed', 5, ZOOMED), 'zoomed');
  assert.deepEqual(zoomed.errors, [], 'zoomed: page errors');
  assert.equal(zoomed.view.zoom, 0.45, 'an old saved zoom does not matter: the world still starts zoomed out');
  assert.ok(Math.abs(zoomed.view.dist - 15 / 0.45) < 0.5, 'wide view: ' + zoomed.view.dist);
  console.log('ok sprint, wheel and pinch zoom, zoom gauge, starts zoomed out');

  // Lola Lana's Boutique: try on two things and close (her look comes back), buy a cap with 100 coins, then take it
  // off and put it back on at the mirror.
  const RICH = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "pigtails", hairColor: 2, outfit: 3, pet: "kitten", petName: "", wear: { back: "fairywings" }, t: 5 }));'
    + 'Learner.storage.setItem("wallet_v1", JSON.stringify({ v: 1, baselines: {}, spent: 40, bonus: 100, purchases: [], oldPointsCounted: true }));</script>';
  const wr = run('wardrobe', stageWorld('wardrobe', 5, RICH), 'wardrobe');
  assert.deepEqual(wr.errors, [], 'wardrobe: page errors');
  assert.equal(wr.near, 'boutique');
  assert.equal(wr.act, "🧶 Open Lola Lana's Boutique");
  assert.equal(wr.open, true);
  assert.equal(wr.have, '🪙 You have 100 coins');
  assert.equal(wr.trying.hat, 'crown', 'try-ons stack: the crown');
  assert.equal(wr.trying.clothes, 'princess', 'and the dress together');
  assert.equal(wr.afterClose.hat, '', 'closing puts her look back');
  assert.equal(wr.afterClose.clothes, '');
  assert.equal(wr.afterClose.back, '', 'wings she does not own here are not drawn');
  assert.equal(wr.closed, true);
  assert.equal(wr.confirm, 'Buy Cap for 50 coins?');
  assert.equal(wr.msg, 'It is yours! 💖');
  assert.deepEqual(wr.owned, ['cap']);
  assert.equal(wr.savedHat, 'cap', 'a bought item is worn and saved');
  assert.equal(wr.savedBack, 'fairywings', 'wings bought on another device, not synced yet, stay saved');
  assert.equal(wr.balance, 50);
  assert.deepEqual(wr.bought, [['cap', 50, 'wardrobe']]);
  assert.deepEqual(wr.crownBuy, { text: '650 more coins', disabled: true });
  assert.equal(wr.afterBuy.hat, 'cap');
  assert.equal(wr.makerOpen, true, 'the mirror opens the maker');
  assert.equal(wr.noHat, '', 'None takes the cap off');
  assert.equal(wr.mirrorHat, 'cap', 'and it can go back on');
  assert.equal(wr.mirrorBack, 'fairywings', 'the mirror keeps them too');
  console.log('ok boutique: try-on, close, buy, mirror');

  // Mang Kiko's Pet Stall: try a panda and a crown and close (her kitten comes back), buy a hamster and a party hat with
  // 600 coins; tap it, give it a treat, let it sit and sleep; at the mirror it rides on her shoulder.
  const PETS = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "pigtails", hairColor: 2, outfit: 3, pet: "kitten", petName: "", t: 5 }));'
    + 'Learner.storage.setItem("wallet_v1", JSON.stringify({ v: 1, baselines: {}, spent: 40, bonus: 600, purchases: [], oldPointsCounted: true }));</script>';
  const pt = run('pets', stageWorld('pets', 5, PETS), 'pets');
  assert.deepEqual(pt.errors, [], 'pets: page errors');
  assert.equal(pt.near, 'petshop');
  assert.equal(pt.act, "🦜 Open Mang Kiko's Pet Stall");
  assert.equal(pt.open, true);
  assert.equal(pt.title, "🦜 Mang Kiko's Pet Stall");
  assert.equal(pt.cards.length, 13, 'only the pets she can buy');
  assert.ok(!pt.cards.includes('chick'));
  assert.equal(pt.trying, 'panda', 'trying a pet swaps it');
  assert.equal(pt.tryingHat, 'pet-crown', 'gear goes on the pet she is trying');
  assert.equal(pt.afterClose.pet, 'kitten', 'closing brings her pet back');
  assert.equal(pt.afterClose.wear.hat, '');
  assert.equal(pt.confirm, 'Buy Hamster for 150 coins?');
  assert.deepEqual(pt.owned, ['hamster', 'pet-partyhat']);
  assert.deepEqual(pt.saved, { pet: 'hamster', hat: 'pet-partyhat' });
  assert.equal(pt.balance, 400);
  assert.deepEqual(pt.bought, [['hamster', 150, 'pets'], ['pet-partyhat', 50, 'pets']]);
  assert.equal(pt.afterBuy.pet, 'hamster');
  assert.equal(pt.afterBuy.wear.hat, 'pet-partyhat');
  assert.equal(pt.tapped, true, 'a tap on the pet lands on it');
  assert.deepEqual([pt.happy.mood, pt.happy.bubble], ['happy', '💖']);
  assert.equal(pt.treat, true);
  assert.equal(pt.treatAgain, false, 'one treat every 2 seconds');
  assert.deepEqual([pt.munch.mood, pt.munch.bubble], ['munch', '🍪']);
  assert.equal(pt.sit, 'sit');
  assert.deepEqual([pt.sleep.mood, pt.sleep.bubble], ['sleep', '💤']);
  assert.equal(pt.makerOpen, true);
  assert.deepEqual(pt.spotsHamster, ['walk', 'shoulder', 'head']);
  assert.equal(pt.riding, 'shoulder');
  assert.deepEqual(pt.spotsKitten, ['walk', 'arms']);
  assert.equal(pt.kittenSpot, 'walk', 'a spot the new pet cannot ride goes back to walking');
  assert.deepEqual(pt.mirror, { pet: 'hamster', spot: 'shoulder', color: 2, hat: 'pet-partyhat' });
  assert.equal(pt.rides, 'shoulder');
  console.log('ok pet stall: try, buy, pat, treat, sit, sleep, mirror Pet tab');

  // Tricks and toys: Bow and the ball are free; try Dance and the bone at the stall; buy Spin; Play → Spin; Play → ball:
  // the whole fetch round trip.
  const tr = run('tricks', stageWorld('tricks', 5, PETS), 'tricks');
  assert.deepEqual(tr.errors, [], 'tricks: page errors');
  assert.equal(tr.trickCards.length, 7);
  assert.equal(tr.bowFree, '🎁 Free');
  assert.deepEqual([tr.demo.action, tr.demo.trick], ['trick', 'trick-dance'], 'trying a trick shows it');
  assert.deepEqual([tr.demoToy.action, tr.demoToy.toy], ['hold', true], 'trying a toy: the pet holds it');
  assert.equal(tr.confirm, 'Buy Spin for 100 coins?');
  assert.ok(tr.owned.includes('trick-spin'));
  assert.deepEqual(tr.items, ['toy-ball', 'trick-bow', 'trick-spin'], 'toys first, then her tricks');
  assert.equal(tr.rowClosed, true);
  assert.deepEqual([tr.spin.action, tr.spin.trick, tr.spin.mood], ['trick', 'trick-spin', 'trick']);
  assert.equal(tr.busy, false, 'one action at a time');
  assert.deepEqual([tr.afterSpin.action, tr.afterSpin.bubble], [null, '💖']);
  assert.deepEqual([tr.thrown.action, tr.thrown.stage, tr.thrown.toy], ['fetch', 'throw', true]);
  assert.deepEqual(tr.stages, ['throw', 'run', 'pick', 'back', 'drop']);
  assert.deepEqual([tr.fetched.action, tr.fetched.toy, tr.fetched.bubble], [null, false, '💖']);
  assert.ok(Math.hypot(tr.fetched.x - tr.her.x, tr.fetched.z - tr.her.z) < 4, 'the pet is back beside her');
  console.log('ok tricks and fetch: stall tabs, try, buy, Play row, spin, ball round trip');

  // Kuya Pilo's Toy Stall: try a prop, see an emote, buy a prop and an emote; Use with an arms pet; the Emote row;
  // teleport ends a move; an outfit idle after standing still; the mirror Props tab.
  const TOYS = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "bob", hairColor: 2, outfit: 3, pet: "kitten", petSpot: "arms", petName: "", t: 5 }));'
    + 'Learner.storage.setItem("wallet_v1", JSON.stringify({ v: 1, baselines: {}, spent: 0, bonus: 600, purchases: [], oldPointsCounted: true }));</script>';
  const ty = run('toys', stageWorld('toys', 5, TOYS), 'toys');
  assert.deepEqual(ty.errors, [], 'toys: page errors');
  assert.equal(ty.near, 'toyshop');
  assert.equal(ty.act, "🎈 Open Kuya Pilo's Toy Stall");
  assert.equal(ty.open, true);
  assert.equal(ty.title, "🎈 Kuya Pilo's Toy Stall");
  assert.equal(ty.propCards.length, 12);
  assert.equal(ty.balloonFree, '🎁 Free');
  assert.equal(ty.trying, 'magicwand', 'trying a prop puts it in her hand');
  assert.equal(ty.emoteCards, 11);
  assert.deepEqual([ty.demo.move, ty.demo.demo], ['emote-dance', true], 'trying an emote: she does it');
  assert.equal(ty.confirm, 'Buy Ukulele for 300 coins?');
  assert.deepEqual(ty.owned, ['emote-spin', 'ukulele']);
  assert.deepEqual(ty.bought, [['emote-spin', 150, 'toys'], ['ukulele', 300, 'toys']]);
  assert.deepEqual(ty.afterClose, { holding: 'ukulele', move: null, saved: 'ukulele' }, 'a bought prop stays in her hand');
  assert.equal(ty.useShown, true);
  assert.equal(ty.using.move, 'use-ukulele');
  assert.deepEqual([ty.petWatch.action, ty.petWatch.down], ['watch', true], 'the kitten hops down from her arms to watch');
  assert.equal(ty.afterUse.move, null);
  assert.deepEqual([ty.afterUse.pet.action, ty.afterUse.pet.down], [null, false], 'and climbs back');
  assert.ok(ty.fx <= 40, 'effects stay under the cap');
  assert.deepEqual(ty.emotes, ['emote-wave', 'emote-clap', 'emote-cheer', 'emote-spin']);
  assert.equal(ty.rowClosed, true);
  assert.equal(ty.spin.move, 'emote-spin');
  assert.equal(ty.cancelled, null, 'quick travel ends a move');
  assert.ok(ty.idle && ty.idle.idle && ty.idle.move.indexOf('idle-') === 0, 'an outfit idle after standing still');
  assert.deepEqual(ty.mirrorProps, ['', 'balloon', 'ukulele'], 'the mirror lists None, the free balloon and what she owns');
  assert.equal(ty.mirrorSaved, 'balloon');
  assert.equal(ty.holdingAfter, 'balloon');
  console.log('ok toy stall: try, demo, buy, Use, Emote row, idle, mirror Props');

  // My Room: the house door and the hop in, the starter room, the mirror inside, the desk asking the due question, a
  // trophy; 🛠️ Decorate (place, select and move by taps on the room, turn, a refused move, put away, buy with Yes, a No,
  // blue walls, ✅ Done); out to the doorstep; Tito Tasyo's workshop: the tabs, the turning preview, a locked earned
  // piece, buying the globe (owned, not placed, logged via 'house').
  const HOUSE = AVATAR_SCRIPT.replace('</script>', '')
    + 'Learner.storage.setItem("wallet_v1", JSON.stringify({ v: 1, baselines: {}, spent: 40, bonus: 1000, purchases: [], oldPointsCounted: true }));'
    + 'var __items = {}; __items[' + JSON.stringify(key) + '] = { box: 2, due: "2026-01-01", t: 1 };'
    + 'Learner.storage.setItem("review_v1", JSON.stringify({ v: 1, items: __items }));'
    + 'window.__answer = ' + JSON.stringify(answer) + ';</script>';
  const houseFile = stageWorld('house', 5, HOUSE);
  for (const f of lf.files) {
    const to = path.join(work, 'house', 'world', lf.dir, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(web('world'), lf.dir, f), to);
  }
  const hs = run('house', houseFile, 'house');
  assert.deepEqual(hs.errors, [], 'house: page errors');
  assert.notEqual(hs.visitNear, 'house-visit', 'no sister room, no visit pill');
  assert.equal(hs.doorNear, 'house-in');
  assert.equal(hs.doorAct, '🚪 Go in');
  assert.equal(hs.inside, true);
  assert.equal(hs.room.size, 4, 'a new room is 4 by 4');
  assert.deepEqual(hs.room.placed, [{ id: 'home-bed', c: 0, r: 3, turn: 1 }, { id: 'home-rug-round', c: 1, r: 1, turn: 0 }], 'the starter bed and rug');
  assert.deepEqual([hs.room.wall, hs.room.floor, hs.room.stars], ['home-wall-pink', 'home-floor-wood', false]);
  assert.deepEqual(hs.room.items, ['room-out', 'room-out:walk', 'mirror', 'desk']);
  assert.ok(hs.shownOut > 50, 'outdoors: ' + hs.shownOut);
  assert.ok(hs.shownIn <= 4, 'inside only the room, her and her pet show: ' + hs.shownIn);
  assert.ok(hs.room.hidden > 50, 'the outdoors is hidden');
  assert.equal(hs.landed.near, 'room-out', 'she lands on the door square');
  assert.equal(hs.popup, false, 'no popup on the very first visit');
  assert.equal(hs.mirrorNear, 'mirror');
  assert.equal(hs.mirrorAct, '🪞 Change my look');
  assert.equal(hs.makerOpen, true, 'the mirror inside opens the maker');
  assert.equal(hs.makerClosed, true);
  assert.equal(hs.deskNear, 'desk');
  assert.equal(hs.deskAct, '✏️ Study');
  assert.equal(hs.seat.kind, 'desk', 'she sits at the desk');
  assert.deepEqual([hs.deskPet.resting, hs.deskPet.mood, hs.deskPet.y], [true, 'sit', 2.07], 'her chick hops onto the desk and sits');
  assert.ok(Math.abs(hs.deskPet.x - 200.9) < 1e-9 && Math.abs(hs.deskPet.z - 198.05) < 1e-9, 'on its front corner: ' + hs.deskPet.x + ',' + hs.deskPet.z);
  assert.equal(hs.deskWho, '✏️ Study desk');
  assert.ok(hs.deskOptions.includes(answer), 'the due question is asked at the desk');
  assert.match(hs.deskAfter, /^🎉 Right!/);
  assert.equal(hs.deskRight, 1, 'a right desk answer counts');
  assert.equal(hs.answers, 1);
  assert.equal(hs.donePill, true, '✅ Done shows while she sits');
  assert.equal(hs.doneText, '✅ Done');
  assert.equal(hs.seatAfter, null, 'Done stands her up');
  assert.deepEqual([hs.deskPetAfter.resting, hs.deskPetAfter.y], [false, 0], 'and her chick hops down beside her');
  assert.equal(hs.tapped, true, 'a tap on the Life Lab trophy');
  assert.equal(hs.trophyText, '🔬 Life Lab: 🥇 0 · 🥈 0 · 🥉 0');
  assert.equal(hs.decoPill, true, '🛠️ Decorate shows in her own room');
  assert.equal(hs.decoPillText, '🛠️ Decorate');
  assert.equal(hs.decoOpen, true);
  assert.deepEqual([hs.decoPet.resting, hs.decoPet.mood, hs.decoPetShown], [true, 'sit', true], 'her pet sits in the Decorate view');
  assert.ok(Math.abs(hs.decoPet.x - 203.6) < 1e-9 && Math.abs(hs.decoPet.z - 196.4) < 1e-9, 'on the walkway: ' + hs.decoPet.x + ',' + hs.decoPet.z);
  assert.ok(hs.decoDist > 22, 'the camera lifts above the room: ' + hs.decoDist);
  assert.deepEqual(hs.decoSee, ['e', 's'], 'the south and east walls turn see-through');
  assert.deepEqual(hs.decoHud, [true, true, true], 'the joystick, the pill and the top bar hide');
  assert.deepEqual(hs.decoTabs, ['🛏️ Furniture', '🖼️ Wall', '🧸 Fun', '🎨 Room', '⭐ Earned']);
  assert.equal(hs.decoHello, 'Tap a piece to put it in your room, or tap one in the room to move it.');
  assert.deepEqual(hs.decoCards, [{ id: 'home-bed', state: 'on' }, { id: 'home-rug-round', state: 'on' }, { id: 'home-lamp', state: 'mine' }, { id: 'home-plant', state: 'sale' }]);
  assert.equal(hs.decoWalk, 0, 'walking is off');
  assert.deepEqual(hs.lampRoom, [{ id: 'home-bed', c: 0, r: 3, turn: 1 }, { id: 'home-rug-round', c: 1, r: 1, turn: 0 }, { id: 'home-lamp', c: 2, r: 3, turn: 0 }], 'the lamp goes by the north wall, saved');
  assert.equal(hs.bedTap, true);
  assert.equal(hs.bedSel, 0, 'a tap on the bed in the room selects it');
  assert.equal(hs.bedMsg, 'Tap a glowing square to move it there. ✨');
  assert.deepEqual(hs.bedMoved, { id: 'home-bed', c: 0, r: 2, turn: 1 }, 'a tap on a glowing square moves it');
  assert.deepEqual(hs.bedTurned, { id: 'home-bed', c: 0, r: 2, turn: 2 }, '↻ Turn: a quarter turn');
  assert.deepEqual(hs.refused, { shakes: 1, bed: { id: 'home-bed', c: 0, r: 2, turn: 2 }, sel: 0 }, 'the door square shakes it and keeps it');
  assert.deepEqual(hs.lampAway, ['home-bed', 'home-rug-round'], '📦 Put away');
  assert.equal(hs.awaySel, null);
  assert.equal(hs.plantAsk, 'Buy Potted plant for 50 coins?');
  assert.equal(hs.plantGhost, 'home-plant', 'a see-through plant shows where it would go');
  assert.deepEqual(hs.plantRoom[2], { id: 'home-plant', c: 1, r: 3, turn: 0 }, 'Yes buys it and places it');
  assert.equal(hs.plantCoins, 50);
  assert.equal(hs.plantMsg, 'It is yours! 💖');
  assert.deepEqual(hs.plantHistory, [['home-plant', 50, 'house']]);
  assert.deepEqual(hs.tentAsk, [true, 'home-tent']);
  assert.deepEqual(hs.tentNo, { asking: false, ghost: null, placed: ['home-bed', 'home-rug-round', 'home-plant'], coins: 50, owned: ['home-plant'] }, 'No: the see-through tent goes, nothing is bought');
  assert.deepEqual(hs.blue, ['home-wall-blue', 'home-wall-blue'], 'blue walls, saved');
  assert.equal(hs.decoClosed, true);
  assert.equal(hs.decoPetAfter.resting, false, 'Done: her pet follows her again');
  assert.ok(Math.abs(hs.doneDist - hs.doneNominal) < 1, 'the camera comes back down to its zoomed distance: ' + hs.doneDist);
  assert.deepEqual(hs.doneSee, ['e'], 'only the wall behind her (she faces the shelf) stays see-through');
  assert.deepEqual(hs.doneHud, [false, false]);
  assert.ok(hs.doneWalk > 0.5, 'she walks again: ' + hs.doneWalk);
  assert.equal(hs.outAct, '🚪 Go out');
  assert.deepEqual([hs.out.x, hs.out.z], [48.3, 54], 'out on the doorstep');
  assert.notEqual(hs.out.near, 'house-in', "past the door's reach");
  assert.ok(Math.abs(hs.out.face + Math.PI / 2) < 1e-9, 'facing away from the house');
  assert.equal(hs.insideAfter, false);
  assert.ok(hs.shownAfter > 50, 'the outdoors is back: ' + hs.shownAfter);
  assert.equal(hs.tasyoNear, 'carpenter');
  assert.equal(hs.tasyoAct, "🔨 Open Tito Tasyo's Workshop");
  assert.equal(hs.carpenterOpen, true);
  assert.equal(hs.tasyoTitle, "🔨 Tito Tasyo's Workshop");
  assert.deepEqual(hs.tabs, ['🛏️ Furniture', '🖼️ Wall', '🧸 Fun', '🎨 Room', '⭐ Earned']);
  assert.ok(hs.funCards.includes('home-globe') && hs.funCards.includes('home-aquarium'));
  assert.equal(hs.preview, 'home-globe', 'the globe turns on the display stand');
  assert.equal(hs.locked, '🔒 Learn 7 days in a row', 'an earned piece shows how to earn it');
  assert.equal(hs.lockedBuy, false, 'and is never for sale');
  assert.equal(hs.confirm, 'Buy Globe for 110 coins?');
  assert.equal(hs.msg, 'It is yours! 💖');
  assert.equal(hs.coinsDown, 110);
  assert.deepEqual(hs.owned, ['home-plant', 'home-globe']);
  assert.deepEqual(hs.bought.slice().sort(), [['home-globe', 110, 'house'], ['home-plant', 50, 'house']]);
  assert.equal(hs.previewAfter, null, 'the stand goes away when the stall closes');
  assert.equal(hs.carpenterClosed, true);
  assert.deepEqual(hs.placedAfter, ['home-bed', 'home-rug-round', 'home-plant'], 'a piece bought at the stall waits to be placed');
  assert.equal(hs.answersAgain, 0, 'going back in starts a new desk visit');
  assert.deepEqual([hs.shopInside, hs.shopTrail], [false, 'shop'], "the mirror's More at … takes her out, then the trail starts");
  console.log('ok My Room: in, mirror, desk, trophy, Decorate, out; Tito Tasyo: preview, locked, buy');

  // The room grows with medals: 15 lessons with a medal (one gold) and a 7-day streak, after a visit at 4 by 4.
  const GROW = AVATAR_SCRIPT.replace('</script>', '') + '(function () {'
    + 'var lessons = {}, order = [];'
    + 'for (var i = 0; i < 15; i++) { order.push("l" + i); lessons["l" + i] = { title: "L" + i, now: i ? 1 : 3, best: i ? 1 : 3, paid: i ? 1 : 3 }; }'
    + 'Learner.storage.setItem("mastery_v1", JSON.stringify({ v: 1, apps: { "life-lab": { t: 1, order: order, lessons: lessons } } }));'
    + 'var days = []; for (var d = 0; d < 7; d++) days.push(Guide.dayKey(Date.now() - d * 86400000));'
    + 'Learner.storage.setItem("quests_v1", JSON.stringify({ v: 1, days: days }));'
    + 'Learner.storage.setItem("house_v1", JSON.stringify({ v: 1, seen: { at: 1, size: 4, trophies: {} } }));'
    + '})();</script>';
  const gr = run('grow', stageWorld('grow', 5, GROW), 'grow');
  assert.deepEqual(gr.errors, [], 'grow: page errors');
  assert.equal(gr.room.size, 5, '15 medals: 5 by 5');
  const grown = gr.text.split('\n');
  assert.equal(grown[0], 'Your room grew! 🏡');
  assert.ok(grown.includes('You earned the Streak lamp! 🌟'), gr.text);
  assert.ok(grown.includes('You earned the Gold frame! 🌟'), gr.text);
  assert.ok(grown.includes("Life Lab's trophy is Bronze now! 🏆"), gr.text);
  assert.deepEqual(gr.buttons, ['Yay!']);
  assert.equal(gr.seen.size, 5, 'what she saw is saved');
  assert.equal(gr.seen.trophies['life-lab'], 1);
  assert.deepEqual(gr.earned, ['home-gold-frame', 'home-streak-lamp']);
  assert.equal(gr.again, false, 'the popup shows once');
  console.log('ok My Room grows with medals and celebrates');

  // Her sister's room: the visit pill, her lamp and starry walls, no desk or mirror, a trophy shows its name only, Cheer.
  const VISIT = AVATAR_SCRIPT + '<script>(function () { var now = Date.now();'
    + 'Learner.storage.setItem("family_peek_v1", JSON.stringify({ mia: { profile: { name: "Mia", grade: 2 }, world: {},'
    + ' look: { v: 1, body: "girl", skin: 1, hair: "pigtails", hairColor: 3, outfit: 2, pet: "panda", petName: "", t: 5 },'
    + ' family: { v: 1, at: now, news: [], sent: [] }, total: 0, readAt: now,'
    + ' house: { v: 1, owned: { "home-wall-stars": { t: 1, coins: 150 } }, room: { at: 1, placed: [{ id: "home-lamp", c: 0, r: 3, turn: 0 }], wall: "home-wall-stars", floor: "home-floor-wood", stars: false },'
    + ' seen: { at: 1, size: 4, trophies: { "science-detectives": 2 } } } } })); })();</script>';
  const vs = run('visit', stageWorld('visit', 5, VISIT), 'visit');
  assert.deepEqual(vs.errors, [], 'visit: page errors');
  assert.equal(vs.near, 'house-visit');
  assert.equal(vs.act, "👀 Visit Bunso's room");
  assert.equal(vs.room.visit, 'mia');
  assert.equal(vs.room.size, 4);
  assert.deepEqual(vs.room.placed, [{ id: 'home-lamp', c: 0, r: 3, turn: 0 }], "her sister's lamp");
  assert.equal(vs.room.wall, 'home-wall-stars', 'and her starry walls');
  assert.deepEqual(vs.room.items, ['room-out', 'room-out:walk'], 'no desk, no mirror');
  assert.equal(vs.room.trophies['science-detectives'], 2, 'trophy colours from her last visit');
  assert.equal(vs.popup, false);
  assert.equal(vs.tapped, true);
  assert.equal(vs.trophyText, '🔍 Science Detectives', 'only the subject name');
  assert.equal(vs.trophyWho, '🏆 Mia');
  assert.equal(vs.cheerShown, true);
  assert.equal(vs.cheerText, '💛 Cheer');
  assert.equal(vs.cheerBubble, '✨ Mia is playing now! Want to send a cheer?');
  assert.equal(vs.sent, 1, 'a cheer goes out');
  assert.equal(vs.sentText, 'Sent! 💌');
  assert.equal(vs.house, null, 'a visit saves nothing of her own');
  assert.deepEqual([vs.out.x, vs.out.z], [48.3, 54]);
  console.log("ok her sister's room: view only, trophy names, a cheer");

  // Back from Life Lab with a finished quiz: the pet waits 1.5 s, then celebrates with ⭐; a reload does not repeat it.
  const CHEER = AVATAR_SCRIPT + '<script>(function () {'
    + 'sessionStorage.setItem("world_return_v1", JSON.stringify({ grade: "grade5", app: "life-lab", before: { at: Date.now() - 60000, week: "", cleared: 0 } }));'
    + 'var id = StudyHistory.quizStarted("life-lab", "Life Lab", "1", "Lesson 1", false, 5); StudyHistory.quizFinished(id, 3, 50, 5); })();</script>';
  const ch = run('cheer', stageWorld('cheer', 5, CHEER), 'cheer');
  assert.deepEqual(ch.errors, [], 'cheer: page errors');
  assert.equal(ch.at.near, 'life-lab', 'back at the door she went into');
  assert.deepEqual(ch.ret, { grade: 'grade5', app: 'life-lab' }, 'before is used once; the door stays');
  assert.equal(ch.cheer, '⭐', 'a finished round: the pet hops with ⭐');
  console.log('ok celebration at the door after a finished round');

  // 🏠 in a game opened from the world goes back to the world.
  const learnerTag = '<script src="../../../engine/learner.js"';
  let html = fs.readFileSync(appFile('life-lab'), 'utf8');
  if (!html.includes(learnerTag)) throw new Error('learner.js tag not found in life-lab');
  html = html.replace(learnerTag, '<script>sessionStorage.setItem("world_return_v1", JSON.stringify(' + RETURN + '));</script>' + learnerTag);
  const navDriver = 'var __went = null; Nav.go = function (u) { __went = u; }; document.getElementById("nav-home").click();'
    + '(function () { var pre = document.createElement("pre"); pre.id = "e2e-out"; pre.textContent = JSON.stringify({ went: __went, errors: window.__e2eErrors || [] }); document.body.appendChild(pre); })();';
  const gameFile = stage(path.join(work, 'game'), app('life-lab').page, injectDriver(html, navDriver), ENGINE_FILES);
  const g = readOutput(dumpDom(path.join(work, 'profile-game'), gameFile, ''));
  assert.deepEqual(g.errors, [], 'game: page errors');
  assert.equal(g.went, '../../../world/grade-5.html');
  console.log('ok 🏠 goes back to the world');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
