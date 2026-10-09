/* Words for the 3D world. Grade 2 pairs Filipino with English on labels (shown only when the Filipino switch is on); buttons are English on both grades. */
(function (root) {
  'use strict';

  var BUTTONS = {
    mimiTalk: '💬 Talk to Mayor Mimi', goTrail: 'Go ▶', later: 'Later', counter: '🛍️ Open the shop',
    fortGo: '⚔️ Enter the Boss Fort!', seeBoss: '🎉 See the boss!', openChest: '🎁 Open!', fortClosed: '💤 Boss Fort',
    go: 'Go to {name}!', mirror: '🪞 Change my look', signpost: '⚡ Quick travel', close: 'Close', lobby: '🏠 Lobby',
    toLobby: '🗺️ Back to the lobby', settings: '⚙️', on: 'On', off: 'Off',
    more: '💬 More', ask: '❓ Ask me!', bye: '👋 Bye', next: '❓ Next question', talkTo: '💬 Talk to {name}',
    listen: '🌳 Listen to the tree', reviewGame: '🔁 Review in the game', bunny: 'Bunny',
    hug: '🤗 Hug', cheerAgain: '💌 Another cheer',
    rides: { slide: '🛝 Go down the slide!', swings: '🌈 Ride the swing!', seesaw: '⚖️ Ride the see-saw!', merry: '🎠 Ride the merry-go-round!' },
    qualityNames: { auto: 'Auto', high: 'High', low: 'Low' },
    lana: 'Lola Lana', boutiqueGo: "🧶 Open Lola Lana's Boutique", buy: 'Buy', yes: 'Yes', no: 'No',
    need: '{n} more coins', owned: '✓ Owned', shopMore: "🛍️ More at Lola Lana's",
    petshopGo: "🦜 Open Mang Kiko's Pet Stall", petsMore: "🦜 More at Mang Kiko's", treat: '🍪 Treat',
    play: '🎾 Play', free: '🎁 Free',
    toyshopGo: "🎈 Open Kuya Pilo's Toy Stall", toysMore: "🎈 More at Kuya Pilo's", use: '✨ Use', emote: '😊 Emote',
    sprint: 'Sprint', zoomIn: 'Zoom in', zoomOut: 'Zoom out', stop: '⏹️ Stop',
    goIn: '🚪 Go in', goOut: '🚪 Go out', visitAte: "👀 Visit Ate's room", visitKuya: "👀 Visit Kuya's room", visitBunso: "👀 Visit Bunso's room",
    visitSister: "👀 Visit your sister's room", visitBrother: "👀 Visit your brother's room",
    decorate: '🛠️ Decorate', done: '✅ Done', study: '✏️ Study', sit: '🪑 Sit', cheerPill: '💛 Cheer', turn: '↻ Turn',
    putAway: '📦 Put away', tasyoGo: "🔨 Open Tito Tasyo's Workshop", yay: 'Yay!', locked: '🔒 {how}',
    credit: 'Made with ❤️ by Tatay Oliver for his daughters',
    tabs: {
      me: 'Me', pet: 'Pet', clothes: 'Clothes', hats: 'Hats', accessories: 'Accessories', face: 'Face', hair: 'Hair & Glitter', pets: 'Pets', gear: 'Pet gear', tricks: 'Tricks', toys: 'Toys', props: 'Props', emotes: 'Emotes',
      furniture: '🛏️ Furniture', wall: '🖼️ Wall', fun: '🧸 Fun', room: '🎨 Room', earned: '⭐ Earned'
    }
  };
  var MAKER_BUTTONS = {
    done: 'Done ✨',
    none: 'None',
    bodies: { girl: 'Girl', boy: 'Boy' },
    hairs: { pigtails: 'Pigtails', bob: 'Bob', short: 'Short', braids: 'Braids', ponytail: 'Ponytail', curly: 'Curly' },
    spots: { walk: 'Walk beside', shoulder: 'On my shoulder', head: 'On my head', arms: 'In my arms' },
    eyesNames: { round: 'Round', sleepy: 'Sleepy', sparkly: 'Sparkly', smiley: 'Smiley' }
  };

  function words(labels, maker) {
    var out = Object.assign({}, BUTTONS, labels);
    out.maker = Object.assign({}, MAKER_BUTTONS, maker);
    return out;
  }

  var TEXT = {
    grade5: words({
      title: 'Campus', loading: 'Loading the world…', waking: '✨ Waking up…',
      resting: 'The world is resting 😴', restingLine: 'Here is the Campus map!',
      travelTitle: '⚡ Where to?', settingsTitle: 'Settings', music: '🎵 Music', sound: '🔊 Sound', soundPack: '🎵 Sounds', steps: '👣 Footsteps', quality: 'Quality',
      mimi: 'Mayor Mimi', mimiIdle: 'Hello! Explore the world and have fun!', follow: 'Follow the sparkles ✨',
      fortCount: '⚔️ {c} of {n} stages cleared', fortNone: '🐉 The boss comes when you have played a few games',
      fortBeaten: '🏆 Boss beaten! A new boss comes on Monday',
      finaleStep: '🎉 You cleared every stage! Go see the boss at the Boss Fort!',
      bossWin: 'You beat {en}! Your {coins} coins are already in your wallet 🪙',
      bossWinPlain: 'You beat {en}! Great job this week! 🎉',
      hoot: 'Professor Hoot', tree: 'Talking Tree', askTitle: 'Ask me! in the Campus', gotIt: 'Got It!',
      jesus: 'Jesus', nudge: "Let's learn something!",
      sisterHello: '💖 Hi! Want to send {name} a cheer?',
      sisterPlaying: '✨ {name} is playing now! Want to send a cheer?',
      sisterChoosing: '🎨 {name} is still choosing her look! Want to send a cheer?',
      sisterChoosingBoy: '🎨 {name} is still choosing his look! Want to send a cheer?',
      boutique: "Lola Lana's Boutique", lanaHello: 'Hello! Tap anything to try it on. 🧶',
      have: '🪙 You have {n} coins', confirm: 'Buy {en} for {coins} coins?', bought: 'It is yours! 💖',
      notEnough: 'Not enough coins yet.', failed: 'Something went wrong. Try again.',
      paused: '⏰ Coins are paused until the tablet date is right.',
      petshop: "Mang Kiko's Pet Stall", kikoHello: 'Hello! Tap a pet to meet it. 🦜',
      toyshop: "Kuya Pilo's Toy Stall", piloHello: 'Hello! Tap a toy to hold it, or a move to see it. 🎈',
      tasyo: "Tito Tasyo's Workshop", tasyoHello: 'Hello! Tap anything to see it. Your room is waiting! 🔨',
      noRoom: 'No room for this one yet. Your room grows with medals! 🏅', grew: 'Your room grew! 🏡',
      earnedPop: 'You earned the {en}! 🌟', trophyUp: "{en}'s trophy is {lvl} now! 🏆", desk: 'Study desk',
      deskDone: "That's 3 questions for this visit! Come back later. 🌟", toGo: '{n} to go', myRoom: 'My Room',
      needMore: 'You need {n} more coins. 🪙', placed: '🏠 In the room',
      decoHello: 'Tap a piece to put it in your room, or tap one in the room to move it.',
      decoMove: 'Tap a glowing square to move it there. ✨',
      places: {
        gate: 'Gate', plaza: 'Plaza', boss: 'Boss Fort', garden: "Jesus' Garden", shop: 'Shop Plaza',
        park: 'Whispering Park', house: 'My Little House', playground: 'Playground'
      }
    }, {
      title: 'Make your character!', body: 'Body', skin: 'Skin', hair: 'Hair', hairColor: 'Hair color',
      outfit: 'Outfit', pet: 'Pet', petName: 'Pet name', eyes: 'Eyes', freckles: 'Freckles', blush: 'Blush',
      petColor: 'Pet color', petSpot: 'Where it rides',
      petSlots: { hat: 'Pet hat', neck: 'Around its neck', back: 'On its back', glasses: 'Pet glasses' },
      slots: { clothes: 'Clothes', hat: 'Hat', glasses: 'Glasses', back: 'On my back', neck: 'Neck', sticker: 'Sticker', paint: 'Face paint', dye: 'Special hair', shimmer: 'Body shimmer', prop: 'In my hand' }
    }),
    grade2: words({
      title: 'Bayan · Village', loading: 'Inihahanda ang bayan… · Loading the village…', waking: '✨ Gumigising… · Waking up…',
      resting: 'Nagpapahinga ang bayan 😴 · The village is resting 😴', restingLine: 'Narito ang mapa ng bayan! · Here is the village map!',
      travelTitle: '⚡ Saan tayo pupunta? · Where to?', settingsTitle: 'Ayos · Settings', music: '🎵 Musika · Music',
      sound: '🔊 Tunog · Sound', soundPack: '🎵 Mga tunog · Sounds', steps: '👣 Yabag · Footsteps', quality: 'Linaw · Quality',
      mimi: 'Mayora Mimi · Mayor Mimi', mimiIdle: 'Kumusta! Maglibot at magsaya sa bayan! · Hello! Explore the world and have fun!',
      follow: 'Sundan ang mga kislap ✨ · Follow the sparkles ✨',
      fortCount: '⚔️ {c} sa {n} na yugto ang tapos · {c} of {n} stages cleared',
      fortNone: '🐉 Darating ang boss kapag nakapaglaro ka na · The boss comes when you have played a few games',
      fortBeaten: '🏆 Natalo mo na ang Boss! Bagong boss sa Lunes · Boss beaten! A new boss comes on Monday',
      finaleStep: '🎉 Natapos mo ang lahat ng yugto! Puntahan ang boss sa Kuta ng Boss! · You cleared every stage! Go see the boss at the Boss Fort!',
      bossWin: 'Natalo mo si {fil}! Nasa pitaka mo na ang iyong {coins} barya 🪙 · You beat {en}! Your {coins} coins are already in your wallet 🪙',
      bossWinPlain: 'Natalo mo si {fil}! Magaling ka ngayong linggo! 🎉 · You beat {en}! Great job this week! 🎉',
      hoot: 'Propesor Hoot · Professor Hoot', tree: 'Punong Nagsasalita · Talking Tree',
      askTitle: 'Tanong sa Bayan · Ask me! in the Village', gotIt: 'Got It!',
      jesus: 'Hesus · Jesus', nudge: "Tara, matuto tayo! · Let's learn something!",
      sisterHello: '💖 Kumusta! Gusto mo bang padalhan ng cheer si {name}? · Hi! Want to send {name} a cheer?',
      sisterPlaying: '✨ Naglalaro ngayon si {name}! Gusto mo bang magpadala ng cheer? · {name} is playing now! Want to send a cheer?',
      sisterChoosing: '🎨 Pumipili pa si {name} ng kanyang itsura! Gusto mo bang magpadala ng cheer? · {name} is still choosing her look! Want to send a cheer?',
      sisterChoosingBoy: '🎨 Pumipili pa si {name} ng kanyang itsura! Gusto mo bang magpadala ng cheer? · {name} is still choosing his look! Want to send a cheer?',
      boutique: "Tindahan ng Damit ni Lola Lana · Lola Lana's Boutique",
      lanaHello: 'Kumusta! Pindutin ang kahit ano para isukat ito. 🧶 · Hello! Tap anything to try it on. 🧶',
      have: '🪙 Mayroon kang {n} coins · You have {n} coins',
      confirm: 'Bilhin ang {fil} sa halagang {coins} coins? · Buy {en} for {coins} coins?',
      bought: 'Iyo na ito! 💖 · It is yours! 💖',
      notEnough: 'Kulang pa ang coins mo. · Not enough coins yet.',
      failed: 'May nangyaring mali. Subukan ulit. · Something went wrong. Try again.',
      paused: '⏰ Hihinto muna ang coins hanggang tama na ang petsa ng tablet. · Coins are paused until the tablet date is right.',
      petshop: "Tindahan ng Alaga ni Mang Kiko · Mang Kiko's Pet Stall",
      kikoHello: 'Kumusta! Pindutin ang isang alaga para makilala ito. 🦜 · Hello! Tap a pet to meet it. 🦜',
      toyshop: "Tindahan ng Laruan ni Kuya Pilo · Kuya Pilo's Toy Stall",
      piloHello: 'Kumusta! Pindutin ang laruan para hawakan ito, o ang galaw para makita ito. 🎈 · Hello! Tap a toy to hold it, or a move to see it. 🎈',
      tasyo: "Karpinterya ni Tito Tasyo · Tito Tasyo's Workshop",
      tasyoHello: 'Kumusta! Pindutin ang kahit ano para makita ito. Naghihintay ang kuwarto mo! 🔨 · Hello! Tap anything to see it. Your room is waiting! 🔨',
      noRoom: 'Wala pang puwesto para dito. Lumalaki ang kuwarto mo sa bawat medalya! · No room for this one yet. Your room grows with medals! 🏅',
      grew: 'Lumaki ang kuwarto mo! · Your room grew!',
      earnedPop: 'Nakuha mo ang {fil}! 🌟 · You earned the {en}! 🌟',
      trophyUp: "{fil} na ang tropeo ng {name}! 🏆 · {en}'s trophy is {lvl} now! 🏆",
      desk: 'Mesa sa Pag-aaral · Study desk',
      deskDone: "Tatlong tanong na para sa pagbisitang ito! Bumalik ka mamaya. 🌟 · That's 3 questions for this visit! Come back later. 🌟",
      toGo: '{n} pa · {n} to go', myRoom: 'Kuwarto Ko · My Room',
      needMore: 'Kailangan mo pa ng {n} coins. 🪙 · You need {n} more coins. 🪙', placed: '🏠 Nasa kuwarto · In the room',
      decoHello: 'Pindutin ang isang gamit para ilagay ito sa kuwarto mo, o pindutin ang nasa kuwarto para ilipat ito. · Tap a piece to put it in your room, or tap one in the room to move it.',
      decoMove: 'Pindutin ang kumikinang na parisukat para ilipat ito roon. ✨ · Tap a glowing square to move it there. ✨',
      places: {
        gate: 'Tarangkahan · Gate', plaza: 'Plasa · Plaza', boss: 'Kuta ng Boss · Boss Fort', garden: "Hardin ni Jesus · Jesus' Garden",
        shop: 'Tindahan · Shop Plaza', park: 'Parke ng Bulong · Whispering Park', house: 'Munting Bahay Ko · My Little House',
        playground: 'Palaruan · Playground'
      }
    }, {
      title: 'Gawin ang iyong karakter! · Make your character!', body: 'Katawan · Body', skin: 'Kulay ng balat · Skin',
      hair: 'Buhok · Hair', hairColor: 'Kulay ng buhok · Hair color', outfit: 'Damit · Outfit', pet: 'Alaga · Pet',
      petName: 'Pangalan ng alaga · Pet name', eyes: 'Mata · Eyes', freckles: 'Pekas · Freckles', blush: 'Pamumula ng pisngi · Blush',
      petColor: 'Kulay ng alaga · Pet color', petSpot: 'Saan sasakay ang alaga · Where it rides',
      petSlots: {
        hat: 'Sombrero ng alaga · Pet hat', neck: 'Sa leeg ng alaga · Around its neck', back: 'Sa likod ng alaga · On its back',
        glasses: 'Salamin sa mata ng alaga · Pet glasses'
      },
      slots: {
        clothes: 'Damit · Clothes', hat: 'Sombrero · Hat', glasses: 'Salamin sa mata · Glasses', back: 'Sa likod · On my back',
        neck: 'Sa leeg · Neck', sticker: 'Sticker sa mukha · Sticker', paint: 'Pinta sa mukha · Face paint',
        dye: 'Espesyal na buhok · Special hair', shimmer: 'Kinang sa katawan · Body shimmer', prop: 'Hawak sa kamay · In my hand'
      }
    })
  };

  // Floating signs in the world are English only: a Grade 2 "Filipino · English" pair keeps its English half and its
  // leading emoji. Filipino subject names ("Filipino", "Makabansa") have no pair, so they stay.
  function english(text) {
    var cut = text.lastIndexOf(' · ');
    if (cut < 0) return text;
    var en = text.slice(cut + 3), lead = /^[^\p{L}\p{N}]*/u.exec(text)[0];
    return en.indexOf(lead) === 0 ? en : lead + en;
  }

  function englishAll(x) {
    if (typeof x === 'string') return english(x);
    var out = {};
    Object.keys(x).forEach(function (k) { out[k] = typeof x[k] === 'object' && x[k] ? englishAll(x[k]) : typeof x[k] === 'string' ? english(x[k]) : x[k]; });
    return out;
  }

  // The words the page reads. Grade 2 shows only the English half of every pair unless both is true (the 🇵🇭 Filipino
  // switch is on); TEXT itself stays raw for the tests.
  function localized(grade, both) { return grade === 'grade2' && !both ? englishAll(TEXT.grade2) : TEXT[grade]; }

  var VISIT = { ate: 'visitAte', kuya: 'visitKuya', bunso: 'visitBunso', sister: 'visitSister', brother: 'visitBrother' };
  function visitKey(rel) { return VISIT[rel] || 'visitSister'; }

  var exported = { TEXT: TEXT, english: english, localized: localized, visitKey: visitKey };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Text = exported;
})(this);
