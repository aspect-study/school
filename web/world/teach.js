/* 🎓 The pet teacher: after a wrong answer in the world, her pet shows what she picked, the right answer and the lesson's
   own why and explain as short numbered steps. Pure: lesson() turns a Quiz.view and the option she tapped into the
   bubble's words; talk.js draws them and world-main.js has the pet say them. */
(function (root) {
  'use strict';
  var MAX_SPLIT = 4;

  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  var FILIPINO_APPS = ['kuwentista', 'batang-bayani'];
  function pair(fil, en) { return fil + ' · ' + en; }

  var GRADE2 = {
    hello: [
      pair('Ayos lang! Tingnan natin ito nang magkasama.', "It's okay! Let's look at it together."),
      pair('Magandang subok! Ganito iyon.', 'Good try! Here is how it works.'),
      pair('Natututo tayo sa pagkakamali! Tingnan mo:', 'Mistakes help us learn! Look:')
    ],
    picked: 'Pinili mo · You picked', answer: 'Tamang sagot · Right answer',
    remember: function (a) { return 'Tandaan · Remember: ' + a; }
  };

  var TEXT = {
    grade5: {
      hello: ["It's okay! Let's look at it together.", 'Good try! Here is how it works.', 'Mistakes help us learn! Look:'],
      picked: 'You picked', answer: 'Right answer', remember: function (a) { return 'Remember: ' + a; }
    },
    grade2: L(GRADE2),
    grade2pair: GRADE2
  };

  function lines(s) {
    return String(s || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  }

  // Sentences of one line: split after . ! or ? followed by a space. Keeps short lines whole.
  function sentences(line) {
    var out = [], re = /[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g, m;
    while ((m = re.exec(line)) !== null) {
      var s = m[0].trim();
      if (s) out.push(s);
    }
    return out.length ? out : [line];
  }

  // One step per paragraph block: two lines (Filipino, then English) stay one step, or only the English one when
  // englishOnly; one line is split into sentences.
  function stepsOf(text, englishOnly) {
    var ls = lines(text);
    if (!ls.length) return [];
    if (ls.length > 1) return [englishOnly ? ls[ls.length - 1] : ls.join('\n')];
    var parts = sentences(ls[0]);
    if (parts.length <= MAX_SPLIT) return parts;
    return parts.slice(0, MAX_SPLIT - 1).concat([parts.slice(MAX_SPLIT - 1).join(' ')]);
  }

  // view: Quiz.view(...); opt: the option she tapped (wrong). rand picks the hello line.
  function lesson(grade, view, opt, rand) {
    var filipino = grade === 'grade2' && !!view && FILIPINO_APPS.indexOf(view.app) >= 0;
    var T = TEXT[filipino ? 'grade2pair' : grade] || TEXT.grade5, r = rand || Math.random;
    var englishOnly = grade === 'grade2' && !filipino && !!root.Lang && !root.Lang.both();
    var why = opt && opt.why ? stepsOf(opt.why, englishOnly) : [];
    var explain = stepsOf(view && view.explain, englishOnly);
    // A why that says the same as the explanation is shown once.
    if (why.length && why.join('\n') === explain.join('\n')) explain = [];
    var steps = why.concat(explain);
    steps.push(T.remember((view && view.answer) || ''));
    return {
      hello: T.hello[Math.floor(r() * T.hello.length) % T.hello.length],
      pickedLabel: T.picked, answerLabel: T.answer,
      picked: opt ? opt.text : '', answer: (view && view.answer) || '', steps: steps
    };
  }

  var exported = { TEXT: TEXT, lesson: lesson, stepsOf: stepsOf, MAX_SPLIT: MAX_SPLIT };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Teach = exported;
})(this);
