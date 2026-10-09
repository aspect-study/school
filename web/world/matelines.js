/* What the playground kids say (playmates part 1): hellos in each friend's own way, lines about her real progress,
   the reactions to her answers, and 60 fun "getting to know you" questions. Grade 2 lines are English, or "Filipino · English"
   with the Filipino switch on (the bubble's pair mode); buttons and the word pops over a kid's head are English only. Pure. */
(function (root) {
  'use strict';

  // { id, en, fil, choices (English, they are buttons) }
  var FUN = [
    { id: 'pet', en: 'Cats or dogs?', fil: 'Pusa o aso?', choices: ['🐱 Cats', '🐶 Dogs'] },
    { id: 'fruit', en: 'What is your favourite fruit?', fil: 'Ano ang paborito mong prutas?', choices: ['🥭 Mango', '🍌 Banana', '🍉 Watermelon', '🍓 Strawberry'] },
    { id: 'color', en: 'What is your favourite colour?', fil: 'Ano ang paborito mong kulay?', choices: ['💗 Pink', '💙 Blue', '💚 Green', '💜 Purple'] },
    { id: 'fly', en: 'If you could fly, where would you go?', fil: 'Kung kaya mong lumipad, saan ka pupunta?', choices: ['🌙 The moon', '🏝️ A beach', '⛰️ The mountains', '🏫 School'] },
    { id: 'weather', en: 'Sunny days or rainy days?', fil: 'Maaraw o maulan na araw?', choices: ['☀️ Sunny', '🌧️ Rainy'] },
    { id: 'merienda', en: 'What is the best merienda?', fil: 'Ano ang pinakamasarap na merienda?', choices: ['🍌 Turon', '🍡 Banana cue', '🥟 Siomai', '🍞 Pandesal'] },
    { id: 'animal', en: 'Which animal would you like to be?', fil: 'Anong hayop ang gusto mong maging?', choices: ['🦁 Lion', '🐬 Dolphin', '🦋 Butterfly', '🐼 Panda'] },
    { id: 'power', en: 'Pick a superpower!', fil: 'Pumili ka ng superpower!', choices: ['💪 Super strength', '👻 Invisible', '⚡ Super speed', '🧠 Read minds'] },
    { id: 'breakfast', en: 'Rice or bread for breakfast?', fil: 'Kanin o tinapay sa almusal?', choices: ['🍚 Rice', '🍞 Bread'] },
    { id: 'ride', en: 'What is your favourite ride here?', fil: 'Ano ang paborito mong sakyan dito?', choices: ['🛝 Slide', '🌈 Swings', '⚖️ See-saw', '🎠 Merry-go-round'] },
    { id: 'subject', en: 'What is your favourite subject?', fil: 'Ano ang paborito mong asignatura?', choices: ['➕ Math', '🔬 Science', '📖 English', '🎨 Arts'] },
    { id: 'swim', en: 'Beach or swimming pool?', fil: 'Dagat o swimming pool?', choices: ['🏖️ Beach', '🏊 Pool'] },
    { id: 'dessert', en: 'What is the best dessert?', fil: 'Ano ang pinakamasarap na panghimagas?', choices: ['🍧 Halo-halo', '🍦 Ice cream', '🍰 Cake', '🍮 Leche flan'] },
    { id: 'time', en: 'Morning or night?', fil: 'Umaga o gabi?', choices: ['🌅 Morning', '🌃 Night'] },
    { id: 'art', en: 'Drawing or painting?', fil: 'Pagguhit o pagpinta?', choices: ['✏️ Drawing', '🖌️ Painting'] },
    { id: 'dino', en: 'Which dinosaur is the coolest?', fil: 'Aling dinosaur ang pinakaastig?', choices: ['🦖 T-rex', '🦕 Long neck', '🦅 Flying one'] },
    { id: 'holiday', en: 'What is the happiest day of the year?', fil: 'Ano ang pinakamasayang araw ng taon?', choices: ['🎄 Christmas', '🎂 My birthday', '🎆 New Year'] },
    { id: 'space', en: 'Would you go to space?', fil: 'Gusto mo bang pumunta sa kalawakan?', choices: ['🚀 Yes!', '🌍 No, I like Earth'] },
    { id: 'sky', en: 'Rainbow or stars?', fil: 'Bahaghari o mga bituin?', choices: ['🌈 Rainbow', '⭐ Stars'] },
    { id: 'sport', en: 'What is your favourite sport?', fil: 'Ano ang paborito mong isport?', choices: ['🏀 Basketball', '🏐 Volleyball', '🏸 Badminton', '🏊 Swimming'] },
    { id: 'noodles', en: 'Pancit or spaghetti?', fil: 'Pansit o spaghetti?', choices: ['🍜 Pancit', '🍝 Spaghetti'] },
    { id: 'books', en: 'Stories or comics?', fil: 'Kuwento o komiks?', choices: ['📚 Stories', '💥 Comics'] },
    { id: 'smallpet', en: 'A fish or a bird for a pet?', fil: 'Isda o ibon bilang alaga?', choices: ['🐠 Fish', '🐦 Bird'] },
    { id: 'ulam', en: 'Chicken or fish for lunch?', fil: 'Manok o isda sa tanghalian?', choices: ['🍗 Chicken', '🐟 Fish'] },
    { id: 'drink', en: 'Hot chocolate or cold juice?', fil: 'Mainit na tsokolate o malamig na juice?', choices: ['☕ Hot chocolate', '🧃 Cold juice'] },
    { id: 'game', en: 'Tag or hide-and-seek?', fil: 'Habulan o taguan?', choices: ['🏃 Tag', '🙈 Hide-and-seek'] },
    { id: 'music', en: 'Which instrument would you play?', fil: 'Anong instrumento ang gusto mong tugtugin?', choices: ['🎸 Guitar', '🥁 Drums', '🎹 Piano', '🎺 Trumpet'] },
    { id: 'shape', en: 'What is your favourite shape?', fil: 'Ano ang paborito mong hugis?', choices: ['⭐ Star', '❤️ Heart', '⚪ Circle', '🔺 Triangle'] },
    { id: 'flower', en: 'What is your favourite flower?', fil: 'Ano ang paborito mong bulaklak?', choices: ['🌻 Sunflower', '🌹 Rose', '🌸 Sampaguita', '🌷 Tulip'] },
    { id: 'job', en: 'What do you want to be when you grow up?', fil: 'Ano ang gusto mong maging paglaki mo?', choices: ['🩺 Doctor', '📚 Teacher', '🚀 Astronaut', '🎨 Artist'] },
    { id: 'wake', en: 'Early bird or sleepyhead?', fil: 'Maagang gumising o antukin?', choices: ['🐓 Early bird', '😴 Sleepyhead'] },
    { id: 'sunmoon', en: 'The sun or the moon?', fil: 'Ang araw o ang buwan?', choices: ['☀️ Sun', '🌙 Moon'] },
    { id: 'build', en: 'Puzzles or building blocks?', fil: 'Puzzle o building blocks?', choices: ['🧩 Puzzles', '🧱 Blocks'] },
    { id: 'trip', en: 'Ride a jeepney, a boat or a plane?', fil: 'Sasakay ka ng jeep, bangka o eroplano?', choices: ['🚙 Jeepney', '⛵ Boat', '✈️ Plane'] },
    { id: 'sweet', en: 'Chocolate or candy?', fil: 'Tsokolate o kendi?', choices: ['🍫 Chocolate', '🍬 Candy'] },
    { id: 'farm', en: 'Which farm animal do you like best?', fil: 'Aling hayop sa bukid ang pinakagusto mo?', choices: ['🐄 Cow', '🐐 Goat', '🐔 Chicken', '🐃 Carabao'] },
    { id: 'rainplay', en: 'Would you play in the rain?', fil: 'Maglalaro ka ba sa ulan?', choices: ['☔ Yes, fun!', '🏠 No, stay dry'] },
    { id: 'zoo', en: 'Zoo or aquarium?', fil: 'Zoo o aquarium?', choices: ['🦒 Zoo', '🐙 Aquarium'] },
    { id: 'hat', en: 'Pick a hat!', fil: 'Pumili ka ng sombrero!', choices: ['👑 Crown', '🎩 Top hat', '🧢 Cap'] },
    { id: 'party', en: 'Best party game?', fil: 'Ano ang pinakamasayang laro sa party?', choices: ['🎁 Pabitin', '🎉 Piñata', '🪑 Trip to Jerusalem'] },
    { id: 'grow', en: 'Grow flowers or vegetables?', fil: 'Magtanim ng bulaklak o gulay?', choices: ['🌼 Flowers', '🥕 Vegetables'] },
    { id: 'kitchen', en: 'Help cook or help bake?', fil: 'Tumulong magluto o mag-bake?', choices: ['🍳 Cook', '🧁 Bake'] },
    { id: 'robot', en: 'Would you like a robot friend?', fil: 'Gusto mo ba ng robot na kaibigan?', choices: ['🤖 Yes!', '🙂 Maybe'] },
    { id: 'explore', en: 'Climb a mountain or explore a cave?', fil: 'Umakyat sa bundok o pumasok sa kuweba?', choices: ['⛰️ Mountain', '🦇 Cave'] },
    { id: 'bug', en: 'Bee or butterfly?', fil: 'Bubuyog o paru-paro?', choices: ['🐝 Bee', '🦋 Butterfly'] },
    { id: 'lucky', en: 'What is your lucky number?', fil: 'Ano ang masuwerte mong numero?', choices: ['3️⃣ Three', '7️⃣ Seven', '9️⃣ Nine'] },
    { id: 'note', en: 'Write a letter or make a card?', fil: 'Sumulat ng liham o gumawa ng kard?', choices: ['✉️ Letter', '💌 Card'] },
    { id: 'sea', en: 'Which sea animal do you like best?', fil: 'Aling hayop sa dagat ang pinakagusto mo?', choices: ['🐢 Turtle', '🦈 Shark', '🐳 Whale', '🦀 Crab'] },
    { id: 'noise', en: 'A quiet library or a noisy party?', fil: 'Tahimik na library o maingay na party?', choices: ['🤫 Library', '🥳 Party'] },
    { id: 'pizza', en: 'Pizza or burger?', fil: 'Pizza o burger?', choices: ['🍕 Pizza', '🍔 Burger'] },
    { id: 'myth', en: 'Unicorn or dragon?', fil: 'Unicorn o dragon?', choices: ['🦄 Unicorn', '🐉 Dragon'] },
    { id: 'magic', en: 'A magic wand or a flying carpet?', fil: 'Magic wand o lumilipad na karpet?', choices: ['🪄 Wand', '🧞 Carpet'] },
    { id: 'camp', en: 'Camping or a sleepover?', fil: 'Kamping o sleepover?', choices: ['⛺ Camping', '🛏️ Sleepover'] },
    { id: 'corn', en: 'Corn or sweet potato?', fil: 'Mais o kamote?', choices: ['🌽 Corn', '🍠 Sweet potato'] },
    { id: 'chore', en: 'How do you like to help at home?', fil: 'Paano mo gustong tumulong sa bahay?', choices: ['🧹 Sweep', '🍽️ Wash dishes', '🧺 Fold clothes', '🌱 Water plants'] },
    { id: 'move', en: 'Dance or sing?', fil: 'Sumayaw o kumanta?', choices: ['💃 Dance', '🎤 Sing'] },
    { id: 'rest', en: 'A long nap or a long play?', fil: 'Mahabang tulog o mahabang laro?', choices: ['😴 Nap', '🤸 Play'] },
    { id: 'rainbow', en: 'Pick a rainbow colour!', fil: 'Pumili ka ng kulay ng bahaghari!', choices: ['❤️ Red', '🧡 Orange', '💛 Yellow', '💙 Blue'] },
    { id: 'friends', en: 'Play with one friend or many friends?', fil: 'Makipaglaro sa isang kaibigan o sa marami?', choices: ['🙂 One friend', '🎉 Many friends'] },
    { id: 'week', en: 'School day or weekend?', fil: 'Araw ng pasok o Sabado at Linggo?', choices: ['🏫 School day', '🎈 Weekend'] }
  ];

  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  var TEXT = {
    grade5: {
      newFriend: 'New friend',
      title: 'Playground friends',
      hello: {
        migo: ['Hahaha! Hi! Did you see me spin? 😄', 'Knock knock! … I forgot the joke. Hahaha!', 'The merry-go-round makes me dizzy. I love it! 🎠'],
        ella: ['Oh, hi… I like your outfit. 🌷', 'Hello! Want to swing with me later?', 'Hi! I\'m glad you came today. 😊'],
        tomas: ['Race you to the slide! ⚡', 'I\'m the fastest kid here! Well… almost.', 'Ready, set, go! Oh wait, hi! 😆'],
        bea: ['Okay, everyone! Line up for the see-saw! Oh, hi! 📋', 'You can ride with me. I\'ll count to three!', 'Hello! Rule number one: have fun!'],
        jun: ['Did you know? A swing is a kind of pendulum! 🔭', 'Hi! I like facts. Do you?', 'Fun fact: the slide works because of gravity!'],
        luna: ['Hi! Did you bring your pet? 🐾', 'I saw a butterfly here this morning! 🦋', 'Hello! The clouds look like bunnies today. ☁️']
      },
      newHello: ['Hi! I\'m new here. Wanna play? 🙂', 'Hello! This playground is so fun!', 'Hi! Is that your pet? So cute!', 'Hey! I just moved here. Let\'s be friends!'],
      gold: function (subject) { return 'Whoa, a gold medal in ' + subject + '? Galing! 🏅'; },
      golds: function (n) { return n + ' gold medals! You study a lot! 🏅'; },
      streak: function (n) { return 'A ' + n + '-day streak! Keep it going! 🔥'; },
      bossLeft: function (n) { return 'The boss still has ' + n + ' stage' + (n === 1 ? '' : 's') + ' left. You can do it! ⚔️'; },
      bossBeaten: 'You beat the boss this week? So cool! 🏆',
      remember: function (q, choice) { return 'I remember! You said ' + choice + ' for “' + q.en + '” 😊'; },
      thinking: '🤔 Let me think of a question…',
      right: ['🎉 Galing! You got it!', '⭐ Yes! So smart!', '🙌 Right! Teach me sometime!'],
      answerIs: function (a) { return 'Oops! It\'s ' + a + '. Next time! 💪'; },
      same: 'Me too!! 🤩',
      other: function (mine) { return 'Ooh, cool! I like ' + mine + '.'; },
      pickRide: 'Which ride? 🎠',
      play: '🎠 Let\'s play!',
      tara: 'Tara!',
      yourTurn: 'Your turn!'
    },
    grade2: L({
      newFriend: 'Bagong kaibigan · New friend',
      title: 'Mga kalaro · Playground friends',
      hello: {
        migo: ['Hahaha! Hi! Nakita mo ba akong umikot? 😄 · Hahaha! Hi! Did you see me spin? 😄',
          'Tok tok! … Nakalimutan ko ang biro. Hahaha! · Knock knock! … I forgot the joke. Hahaha!',
          'Nahihilo ako sa merry-go-round. Gustong-gusto ko! 🎠 · The merry-go-round makes me dizzy. I love it! 🎠'],
        ella: ['Uy, hi… Ang ganda ng damit mo. 🌷 · Oh, hi… I like your outfit. 🌷',
          'Hello! Gusto mo bang mag-swing tayo mamaya? · Hello! Want to swing with me later?',
          'Hi! Masaya ako na dumating ka. 😊 · Hi! I\'m glad you came today. 😊'],
        tomas: ['Karera tayo papunta sa slide! ⚡ · Race you to the slide! ⚡',
          'Ako ang pinakamabilis dito! Halos… · I\'m the fastest kid here! Well… almost.',
          'Handa, takbo! Ay, hi! 😆 · Ready, set, go! Oh wait, hi! 😆'],
        bea: ['Sige, pila tayo sa see-saw! Uy, hi! 📋 · Okay, everyone! Line up for the see-saw! Oh, hi! 📋',
          'Sumakay ka kasama ko. Bibilang ako hanggang tatlo! · You can ride with me. I\'ll count to three!',
          'Hello! Unang tuntunin: magsaya! · Hello! Rule number one: have fun!'],
        jun: ['Alam mo ba? Ang swing ay isang uri ng pendulum! 🔭 · Did you know? A swing is a kind of pendulum! 🔭',
          'Hi! Mahilig ako sa mga fact. Ikaw ba? · Hi! I like facts. Do you?',
          'Fun fact: dumudulas tayo sa slide dahil sa gravity! · Fun fact: the slide works because of gravity!'],
        luna: ['Hi! Kasama mo ba ang alaga mo? 🐾 · Hi! Did you bring your pet? 🐾',
          'May nakita akong paru-paro dito kaninang umaga! 🦋 · I saw a butterfly here this morning! 🦋',
          'Hello! Mukhang kuneho ang mga ulap ngayon. ☁️ · Hello! The clouds look like bunnies today. ☁️']
      },
      newHello: ['Hi! Bago ako dito. Laro tayo? 🙂 · Hi! I\'m new here. Wanna play? 🙂',
        'Hello! Ang saya dito sa palaruan! · Hello! This playground is so fun!',
        'Hi! Alaga mo ba iyan? Ang cute! · Hi! Is that your pet? So cute!',
        'Uy! Kalilipat ko lang dito. Magkaibigan tayo! · Hey! I just moved here. Let\'s be friends!'],
      gold: function (subject) { return 'Wow, gold medal sa ' + subject + '? Galing! 🏅 · Whoa, a gold medal in ' + subject + '? Great job! 🏅'; },
      golds: function (n) { return n + ' gold medal! Masipag kang mag-aral! 🏅 · ' + n + ' gold medals! You study a lot! 🏅'; },
      streak: function (n) { return n + ' araw na sunod-sunod! Ituloy mo! 🔥 · A ' + n + '-day streak! Keep it going! 🔥'; },
      bossLeft: function (n) { return 'May ' + n + ' stage pa ang boss. Kaya mo iyan! ⚔️ · The boss still has ' + n + ' stage' + (n === 1 ? '' : 's') + ' left. You can do it! ⚔️'; },
      bossBeaten: 'Natalo mo ang boss ngayong linggo? Astig! 🏆 · You beat the boss this week? So cool! 🏆',
      remember: function (q, choice) { return 'Naaalala ko! ' + choice + ' ang sagot mo sa “' + q.fil + '” 😊 · I remember! You said ' + choice + ' for “' + q.en + '” 😊'; },
      thinking: '🤔 Mag-iisip ako ng tanong… · 🤔 Let me think of a question…',
      right: ['🎉 Galing! Tama ka! · 🎉 Great job! You got it!', '⭐ Oo! Ang talino mo! · ⭐ Yes! So smart!', '🙌 Tama! Turuan mo ako minsan! · 🙌 Right! Teach me sometime!'],
      answerIs: function (a) { return 'Ay! Ang sagot ay ' + a + '. Sa susunod! 💪 · Oops! The answer is ' + a + '. Next time! 💪'; },
      same: 'Ako rin!! 🤩 · Me too!! 🤩',
      other: function (mine) { return 'Wow, astig! Mas gusto ko ang ' + mine + '. · Ooh, cool! I like ' + mine + '.'; },
      pickRide: 'Saan tayo sasakay? 🎠 · Which ride? 🎠',
      play: '🎠 Let\'s play!',
      tara: 'Tara!',
      yourTurn: 'Your turn!'
    })
  };

  // The bank as a grade shows it: text (one line, Grade 2 "Filipino · English") and sub (the bubble's lines).
  function fun(grade) {
    return FUN.map(function (q) {
      var two = grade === 'grade2' && (!root.Lang || root.Lang.both());
      return { id: q.id, en: q.en, fil: q.fil, choices: q.choices, text: two ? q.fil + ' · ' + q.en : q.en, sub: two ? q.fil + '\n' + q.en : q.en };
    });
  }

  // facts = { gold (a subject name with gold medals, or null), golds, streak, bossLeft, bossBeaten }
  function progress(grade, f) {
    var T = TEXT[grade], out = [];
    if (f.gold) out.push(T.gold(f.gold));
    if (f.golds >= 3) out.push(T.golds(f.golds));
    if (f.streak >= 2) out.push(T.streak(f.streak));
    if (f.bossBeaten) out.push(T.bossBeaten);
    else if (f.bossLeft > 0) out.push(T.bossLeft(f.bossLeft));
    return out;
  }

  // From town.js's snapshot, the subject names by app and her streak.
  function facts(snap, names, streak) {
    var golds = 0, best = null, most = 0, apps = (snap && snap.apps) || {}, fort = (snap && snap.fort) || {};
    Object.keys(apps).forEach(function (app) {
      var g = apps[app] && apps[app].tally ? Number(apps[app].tally.gold) || 0 : 0;
      golds += g;
      if (g > most) { most = g; best = app; }
    });
    var total = Number(fort.total) || 0, cleared = Number(fort.cleared) || 0;
    return {
      gold: best ? names[best] || null : null, golds: golds, streak: Number(streak) || 0,
      bossLeft: Math.max(0, total - cleared), bossBeaten: !!fort.beaten && total > 0
    };
  }

  var exported = { FUN: FUN, TEXT: TEXT, fun: fun, progress: progress, facts: facts };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateLines = exported;
})(this);
