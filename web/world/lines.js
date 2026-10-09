/* Every line the characters say, except Mayor Mimi's (guide.js) and the hello lines (buddies.js). Buddies speak from her
   progress, Hoot about review, Bunny about saving; QUOTES are the talking trees' [Filipino, English] quotes. Grade 2 says
   English alone (both halves with the Filipino switch; grade2pair always has both); Grade 5 the English. Kind words only: nothing here ever scolds or compares. */
(function (root) {
  'use strict';

  function word(n, one, many) { return n === 1 ? one : many; }
  function qs(n) { return n + word(n, ' question is', ' questions are'); }
  function lessons(n) { return n + ' more ' + word(n, 'lesson', 'lessons'); }
  function coins(n) { return n + ' more ' + word(n, 'coin', 'coins'); }

  var EN = {
    boss: function (s) { return '⚔️ The boss is waiting in ' + s + '! Beat a stage at the Boss Fort.'; },
    due: function (n) { return '🔁 ' + qs(n) + ' ready for review. Tap Ask me!'; },
    dueGame: function (n) { return '🔁 ' + qs(n) + ' ready for review inside the game.'; },
    quest: function (s) { return '❗ There is a quest in ' + s + ' today!'; },
    allGold: '🏆 All gold! You are a star!',
    toGold: function (n) { return '🥈 Silver! ' + lessons(n) + ' for gold!'; },
    toSilver: function (n) { return '🥉 Bronze! ' + lessons(n) + ' for silver!'; },
    toBronze: function (n) { return '🏅 Get a medal on ' + lessons(n) + ' for bronze!'; },
    missed: function (d) { return '💛 I missed you! It has been ' + d + ' days.'; },
    fallback: 'Want to learn something new today?',
    thinking: '🤔 Let me find a question…',
    askNone: "🌟 You're all caught up! No questions are due.",
    askGame: "📖 These questions are best in the game. Let's go there!",
    askFail: "📖 Let's ask in the game!",
    right: function (p) { return p > 0 ? '🎉 Right! +' + p + ' points' : '🎉 Right!'; },
    answerIs: function (a) { return 'The right answer is ' + a; },
    hoot: {
      hello: function (n) { return 'Hoo-hoo! ' + qs(n) + ' ready for review. Shall I ask you?'; },
      none: 'Hoo! Nothing to review right now. Come back another day! 🌙',
      wise: [
        'Reviewing helps you remember what you learned.',
        'A lesson is easier to remember when you repeat it little by little.',
        'It is okay to make mistakes. That is how we learn!',
        'Sleep early to make your memory strong.'
      ]
    },
    bunny: {
      save: function (n, goal) { return 'Only ' + coins(n) + ' for ' + goal + '! 🐰 Keep going!'; },
      any: 'You have enough coins for a reward! Saving them is great too. 💛',
      tips: [
        'Every 20 points make 1 coin.',
        'Mommy or Tatay types the PIN when you buy.',
        'Buying never takes away your ⭐ points.'
      ]
    }
  };

  function rest(s) { return s.slice(s.indexOf(' ') + 1); }
  function pairBoth(fil, en) { return fil + ' · ' + en; }
  function pairEnglish(fil, en) {
    var lead = /^[^\p{L}\p{N}]*/u.exec(fil)[0];
    return lead && en.indexOf(lead) !== 0 ? lead + en : en;
  }
  var showBoth = !root.Lang || root.Lang.both();

  function filText(pair) { return {
    boss: function (s) { return pair('⚔️ Naghihintay ang boss sa ' + s + '! Talunin ang isang yugto sa Kuta ng Boss.', rest(EN.boss(s))); },
    due: function (n) { return pair('🔁 ' + n + ' tanong ang handa nang balikan. Pindutin ang Ask me!', rest(EN.due(n))); },
    dueGame: function (n) { return pair('🔁 ' + n + ' tanong ang handa nang balikan sa loob ng laro.', rest(EN.dueGame(n))); },
    quest: function (s) { return pair('❗ May quest sa ' + s + ' ngayong araw!', rest(EN.quest(s))); },
    allGold: pair('🏆 Puro ginto! Isa kang bituin!', 'All gold! You are a star!'),
    toGold: function (n) { return pair('🥈 Pilak! ' + n + ' pang aralin para sa ginto!', rest(EN.toGold(n))); },
    toSilver: function (n) { return pair('🥉 Tanso! ' + n + ' pang aralin para sa pilak!', rest(EN.toSilver(n))); },
    toBronze: function (n) { return pair('🏅 Kumuha ng medalya sa ' + n + ' pang aralin para sa tanso!', rest(EN.toBronze(n))); },
    missed: function (d) { return pair('💛 Na-miss kita! ' + d + ' araw na ang nakalipas.', rest(EN.missed(d))); },
    fallback: pair('Gusto mo bang matuto ng bago ngayong araw?', EN.fallback),
    thinking: pair('🤔 Teka, hahanap ako ng tanong…', 'Let me find a question…'),
    askNone: pair('🌟 Tapos mo na ang lahat ng babalikan! Walang tanong na nakatakda ngayon.', "You're all caught up! No questions are due."),
    askGame: pair('📖 Mas mainam ang mga tanong na ito sa loob ng laro. Doon tayo!', "These questions are best in the game. Let's go there!"),
    askFail: pair('📖 Sa loob ng laro na lang tayo magtanong!', "Let's ask in the game!"),
    right: function (p) { return p > 0 ? pair('🎉 Magaling! +' + p + ' puntos', 'Great job! +' + p + ' points') : pair('🎉 Magaling!', 'Great job!'); },
    answerIs: function (a) { return pair('Ang tamang sagot ay ' + a, 'The right answer is ' + a); },
    hoot: {
      hello: function (n) { return pair('Huu-huu! ' + n + ' tanong ang handa nang balikan. Gusto mo bang tanungin kita?', EN.hoot.hello(n)); },
      none: pair('Huu! Wala pang babalikan ngayon. Bumalik ka sa ibang araw! 🌙', EN.hoot.none),
      wise: [
        pair('Nakatutulong ang pagbabalik-aral para matandaan mo ang natutuhan mo.', EN.hoot.wise[0]),
        pair('Mas madaling tandaan ang aralin kapag inuulit nang paunti-unti.', EN.hoot.wise[1]),
        pair('Ayos lang magkamali. Doon tayo natututo!', EN.hoot.wise[2]),
        pair('Matulog nang maaga para lumakas ang iyong memorya.', EN.hoot.wise[3])
      ]
    },
    bunny: {
      save: function (n, goal) { return pair('Kaunti na lang! ' + n + (n === 1 ? ' coin' : ' coins') + ' pa para sa ' + goal + '! 🐰 Tuloy lang!', EN.bunny.save(n, goal)); },
      any: pair('Kaya mo nang bumili ng reward! Magaling din ang pag-iipon ng coins. 💛', EN.bunny.any),
      tips: [
        pair('Bawat 20 points ay 1 coin.', EN.bunny.tips[0]),
        pair('Si Mommy o Tatay ang nagta-type ng PIN kapag bumili ka.', EN.bunny.tips[1]),
        pair('Hindi nababawasan ang iyong ⭐ points kapag bumili ka.', EN.bunny.tips[2])
      ]
    }
  }; }

  var QUOTES = [
    ['Ang maliliit na hakbang araw-araw ay humahantong sa malalaking pangarap.', 'Small steps every day lead to big dreams.'],
    ['Natututo tayo sa mga pagkakamali. Subukan muli!', 'Mistakes help you learn. Try again!'],
    ['Maging mabait. Pinagniningning nito ang lahat.', 'Be kind. It makes everyone shine.'],
    ['Mas matapang ka kaysa sa iniisip mo.', 'You are braver than you think.'],
    ['Dinadala ka ng pagbabasa sa malalayong lugar.', 'Reading takes you to faraway places.'],
    ['Ang ngiti ay regalong maibibigay mo araw-araw.', 'A smile is a gift you can give every day.'],
    ['Ang pagsasanay ay nagdadala ng pag-unlad.', 'Practice makes progress.'],
    ['Magtanong ka. Lumalago ang isip na mausisa.', 'Ask questions. Curious minds grow.'],
    ['Sapat na palagi ang iyong makakaya.', 'Your best is always enough.'],
    ['Sumasaya ang puso kapag tumutulong sa iba.', 'Helping others makes your heart happy.'],
    ['Ang bawat eksperto ay nagsimula rin bilang baguhan.', 'Every expert was once a beginner.'],
    ['Bahagi rin ng pag-aaral ang pagpapahinga.', 'Rest is part of learning too.'],
    ['Sabihin ang "salamat." Isa itong munting mahiwagang salita.', 'Say thank you. It is a little magic word.'],
    ['Gawin ang iyong makakaya, at ipagmalaki ito.', 'Try your best, then be proud.'],
    ['Gumagaan ang mahirap kapag sinasanay.', 'Hard things get easier with practice.'],
    ['Kaya mong gawin ang mahihirap na bagay.', 'You can do hard things.'],
    ['Isang superpower ang pagiging mabuting kaibigan.', 'Being a good friend is a superpower.'],
    ['Matuto ng bago ngayong araw.', 'Learn something new today.'],
    ['Mahal ka ng pamilya mo, palagi.', 'Your family loves you, always.'],
    ['Sa tiyaga, nagiging puno ang maliliit na buto.', 'With patience, little seeds grow into trees.'],
    ['Nakatutulong sa abalang isip ang malinis na paligid.', 'A tidy space helps a busy mind.'],
    ['Ang mababait na salita ay parang sikat ng araw.', 'Kind words are like sunshine.'],
    ['Magpatuloy ka. Lumalaki at umuunlad ka!', 'Keep going. You are growing!'],
    ['Magbahagi, at lalaki ang saya.', 'Share, and the joy grows bigger.'],
    ['Maniwala ka sa iyong sarili.', 'Believe in yourself.'],
    ['Bawat pahinang binabasa mo ay nagpapatalino sa iyo.', 'Every page you read makes you wiser.'],
    ['Makinig nang mabuti, at marami kang matututuhan.', 'Listen well, and you will learn a lot.'],
    ['Ayos lang na hindi mo pa alam.', 'It is okay not to know yet.'],
    ['Lumilipas ang ulap. Bumabalik ang araw.', 'Clouds pass. The sun comes back.'],
    ['Maging tapat, kahit mahirap.', 'Be honest, even when it is hard.'],
    ['Pinalalakas ka ng tubig, tulog at laro.', 'Water, sleep and play keep you strong.'],
    ['Mahalaga ang iyong mga ideya.', 'Your ideas matter.'],
    ['Mag-isip muna bago sumagot.', 'Think first, then answer.'],
    ['Ipagdiwang ang maliliit na tagumpay!', 'Celebrate small wins!'],
    ['Mahalin ang bayan sa pamamagitan ng pag-aalaga rito.', 'Love your country by caring for it.'],
    ['Pinatitibay ng paggalang ang pagkakaibigan.', 'Respect makes friendships strong.'],
    ['Unti-unti, maraming natatapos.', 'Little by little, a lot gets done.'],
    ['Ikaw ang maging dahilan ng ngiti ng iba ngayong araw.', 'Be the reason someone smiles today.'],
    ['Huwag sumuko. Huminga nang malalim at subukan muli.', 'Do not give up. Take a breath and try again.'],
    ['Masaya ang pusong marunong magpasalamat.', 'A grateful heart is a happy heart.'],
    ['Mabagal tumubo ang puno, pero tumataas ito.', 'Trees grow slowly, but they grow tall.'],
    ['Mahalaga ang boses mo. Magsalita nang mahinahon at mabait.', 'Your voice matters. Speak gently and kindly.'],
    ['Isang pakikipagsapalaran ang pag-aaral!', 'Learning is an adventure!'],
    ['Ang mabubuting gawi ay nagbubunga ng magagandang araw.', 'Good habits grow good days.'],
    ['Alagaan ang mundo. Inaalagaan din tayo nito.', 'Take care of the earth. It takes care of us.'],
    ['Ang pagtulong sa bahay ay pagmamahal na isinasagawa.', 'Helping at home is love in action.'],
    ['Kumanta, gumuhit, sumayaw. Ipakita ang iyong saya!', 'Sing, draw, dance. Let your joy out!'],
    ['Ang tanong ay simula ng sagot.', 'A question is the start of an answer.'],
    ['Ang araw na ito ay isang bagong simula.', 'Today is a fresh new start.'],
    ['Magsikap, at maglaro nang patas.', 'Work hard, and play fair.'],
    ['Hindi ka sinusukat ng iyong mga pagkakamali, kundi ng iyong pagsisikap.', 'Your mistakes do not define you. Your tries do.'],
    ['Laging maganda ang mabuting puso.', 'A kind heart is always beautiful.'],
    ['Isa-isahin ang mga gawain.', 'Do one thing at a time.'],
    ['Maging mausisa tungkol sa mundo.', 'Wonder about the world.'],
    ['Ipinagmamalaki ka ng pamilya mo.', 'You make your family proud.'],
    ['Ang magkapatid ay puwedeng maging magkaibigan habambuhay.', 'Sisters can be best friends for life.'],
    ['Humingi ng tawad, at ayusin ang nagawa.', 'Say sorry, and make it right.'],
    ['Maging mabait din sa iyong sarili.', 'Be gentle with yourself too.'],
    ['Pinagagaan ng masayang tawa ang lahat.', 'A good laugh makes everything lighter.'],
    ['Kamangha-mangha ang pagkakalikha sa iyo.', 'You are wonderfully made.']
  ];

  // Jesus's words: [what he says, the verse in kid words, where it is]. Simple paraphrases, not one translation. He
  // never quizzes, pays, says "wrong" or talks about losing a streak.
  var JESUS_EN = {
    greet: [
      ['Good morning! I am so happy to see you today. 💛', 'This is the day the Lord has made. Let us be glad in it!', 'Psalm 118:24'],
      ['Hello, my friend! I am with you all day long.', 'I am with you always.', 'Matthew 28:20'],
      ['Good morning! You are so special to me.', 'You are precious and loved.', 'Isaiah 43:4'],
      ["Hi! Let's have a wonderful day together.", "God's love is new every morning.", 'Lamentations 3:22-23'],
      ['Good day! Remember, you can always talk to me.', 'Do not worry. Tell God about everything.', 'Philippians 4:6']
    ],
    garden: [
      ['Come sit with me and the little lamb. 🐑', 'The Lord is my shepherd. I have all I need.', 'Psalm 23:1'],
      ['Let the little children come to me. I love spending time with you!', 'Let the children come to me.', 'Mark 10:14'],
      ['Be kind to others, just like you want them to be kind to you.', 'Treat others the way you want to be treated.', 'Luke 6:31'],
      ['You are a light! Let your kindness shine.', 'Let your light shine before others.', 'Matthew 5:16'],
      ['I made the flowers, the birds, and you. You are wonderful!', 'I am wonderfully made.', 'Psalm 139:14'],
      ['When you feel scared, remember I am right here.', 'Be strong and brave. God is with you wherever you go.', 'Joshua 1:9'],
      ['Love one another, the way I love you.', 'Love one another as I have loved you.', 'John 13:34'],
      ['Saying thank you makes hearts happy.', 'Give thanks in all things.', '1 Thessalonians 5:18']
    ],
    proud: ['You tried so hard today. I am proud of how hard you tried!', 'Whatever you do, do it with all your heart.', 'Colossians 3:23'],
    hug: [
      ['I love you so much! 💛', "Nothing can take us away from God's love.", 'Romans 8:39'],
      ['You are never alone. I am always with you.', 'I am with you always.', 'Matthew 28:20'],
      ['A big hug for you! You are my treasure.', 'God cares for you.', '1 Peter 5:7']
    ],
    comfort: {
      wrong: [
        ['Learning can feel hard sometimes. That is okay. I am right here with you.', 'Do not be afraid, for I am with you.', 'Isaiah 41:10'],
        ['Some questions were tricky today. Take a deep breath. You can try again tomorrow.', 'Come to me when you are tired, and I will give you rest.', 'Matthew 11:28']
      ],
      streak: [
        ['Every day is a fresh new start. I love you just the same!', 'His love is new every morning.', 'Lamentations 3:23'],
        ['Rest is good too. Tomorrow is a new day to learn and play.', 'There is a time for everything.', 'Ecclesiastes 3:1']
      ],
      boss: [
        ['That boss was tough! Rest a little, then try again. I am with you!', 'I can do all things through Christ who gives me strength.', 'Philippians 4:13'],
        ['Brave hearts try again. I believe in you!', 'Be strong and take heart.', 'Psalm 31:24']
      ]
    }
  };
  var JESUS_FIL = {
    greet: [
      ['Magandang umaga! Masaya akong makita ka ngayon. 💛', 'Ito ang araw na ginawa ng Panginoon. Magalak tayo!', 'Awit 118:24'],
      ['Kumusta, kaibigan! Kasama mo ako buong araw.', 'Kasama mo ako palagi.', 'Mateo 28:20'],
      ['Magandang umaga! Napakahalaga mo sa akin.', 'Mahalaga ka at minamahal.', 'Isaias 43:4'],
      ['Kumusta! Magkaroon tayo ng masayang araw.', 'Bago tuwing umaga ang pag-ibig ng Diyos.', 'Panaghoy 3:22-23'],
      ['Magandang araw! Tandaan, puwede mo akong kausapin palagi.', 'Huwag mag-alala. Sabihin sa Diyos ang lahat.', 'Filipos 4:6']
    ],
    garden: [
      ['Halika, umupo ka kasama namin ng munting tupa. 🐑', 'Ang Panginoon ang aking pastol. Nasa akin ang lahat ng kailangan ko.', 'Awit 23:1'],
      ['Hayaan ninyong lumapit sa akin ang mga bata. Gustong-gusto kitang makasama!', 'Hayaan ninyong lumapit sa akin ang mga bata.', 'Marcos 10:14'],
      ['Maging mabait sa iba, gaya ng gusto mong kabaitan nila sa iyo.', 'Gawin sa iba ang gusto mong gawin nila sa iyo.', 'Lucas 6:31'],
      ['Isa kang ilaw! Hayaang magningning ang iyong kabaitan.', 'Hayaang magningning ang inyong ilaw sa harap ng iba.', 'Mateo 5:16'],
      ['Ginawa ko ang mga bulaklak, ang mga ibon, at ikaw. Kahanga-hanga ka!', 'Kahanga-hanga ang pagkakalikha sa akin.', 'Awit 139:14'],
      ['Kapag natatakot ka, tandaan na narito lang ako.', 'Magpakatatag at magpakatapang. Kasama mo ang Diyos saan ka man pumunta.', 'Josue 1:9'],
      ['Magmahalan kayo, gaya ng pagmamahal ko sa inyo.', 'Magmahalan kayo gaya ng pagmamahal ko sa inyo.', 'Juan 13:34'],
      ['Pinasasaya ng pasasalamat ang puso.', 'Magpasalamat sa lahat ng pagkakataon.', '1 Tesalonica 5:18']
    ],
    proud: ['Napakasipag mo ngayong araw. Ipinagmamalaki kita sa iyong pagsisikap!', 'Anuman ang gawin mo, gawin mo nang buong puso.', 'Colosas 3:23'],
    hug: [
      ['Mahal na mahal kita! 💛', 'Walang makapaghihiwalay sa atin sa pag-ibig ng Diyos.', 'Roma 8:39'],
      ['Hindi ka kailanman nag-iisa. Kasama mo ako palagi.', 'Kasama mo ako palagi.', 'Mateo 28:20'],
      ['Isang mahigpit na yakap para sa iyo! Ikaw ang aking kayamanan.', 'Iniingatan ka ng Diyos.', '1 Pedro 5:7']
    ],
    comfort: {
      wrong: [
        ['Minsan mahirap ang pag-aaral. Ayos lang iyon. Narito lang ako kasama mo.', 'Huwag kang matakot, sapagkat kasama mo ako.', 'Isaias 41:10'],
        ['May mga tanong na mahirap ngayon. Huminga nang malalim. Puwede kang sumubok ulit bukas.', 'Lumapit kayo sa akin kapag pagod kayo, at bibigyan ko kayo ng kapahingahan.', 'Mateo 11:28']
      ],
      streak: [
        ['Bagong simula ang bawat araw. Mahal pa rin kita!', 'Bago tuwing umaga ang kanyang pag-ibig.', 'Panaghoy 3:23'],
        ['Mabuti rin ang magpahinga. Bagong araw bukas para matuto at maglaro.', 'May tamang panahon para sa lahat.', 'Mangangaral 3:1']
      ],
      boss: [
        ['Ang lakas ng boss na iyon! Magpahinga muna, saka sumubok ulit. Kasama mo ako!', 'Kaya ko ang lahat sa tulong ni Cristo na nagbibigay sa akin ng lakas.', 'Filipos 4:13'],
        ['Sumusubok ulit ang matatapang na puso. Naniniwala ako sa iyo!', 'Magpakatatag kayo at lakasan ang loob.', 'Awit 31:24']
      ]
    }
  };

  function jline(en, fil, pair) {
    return fil ? { say: pair(fil[0], en[0]), verse: pair(fil[1], en[1]), ref: pair(fil[2], en[2]) } : { say: en[0], verse: en[1], ref: en[2] };
  }
  // Same shape as the tables: a list of lines, one line (proud), or an object of those.
  function jesus(en, fil, pair) {
    if (Array.isArray(en) && Array.isArray(en[0])) return en.map(function (x, i) { return jline(x, fil && fil[i], pair); });
    if (Array.isArray(en)) return jline(en, fil, pair);
    var out = {};
    Object.keys(en).forEach(function (k) { out[k] = jesus(en[k], fil && fil[k], pair); });
    return out;
  }
  var pairOf = showBoth ? pairBoth : pairEnglish;
  var JESUS = { grade5: jesus(JESUS_EN, null), grade2: jesus(JESUS_EN, JESUS_FIL, pairOf), grade2pair: jesus(JESUS_EN, JESUS_FIL, pairBoth) };

  var exported = {
    TEXT: { grade5: EN, grade2: filText(pairOf), grade2pair: filText(pairBoth) },
    QUOTES: QUOTES, JESUS: JESUS
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Lines = exported;
})(this);
