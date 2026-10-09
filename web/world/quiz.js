/* ❓ Ask me! questions from a game's own lesson data. Each game builds its review key in its own reviewInfo (in its
   page); SHAPES says how, so the world finds the same review box the game uses (the test checks every question).
   Only questions the speech bubble can show are asked: multiple choice and true/false, without a picture, a reading
   passage or a generated lesson. Math Mastery reviews skills, so its buddy sends her to the game instead. */
(function (root) {
  'use strict';

  // index: options are strings and correct is an index. typed: type 'mc' with {text, correct} options, or 'tf' with answer.
  // art: the field that goes into the key as the picture (null: the game leaves it out). text: the answer goes
  // through textOf. decode: the game decodes a few entities first. tf: the game's True/False words.
  var INDEX = { shape: 'index', art: 'art', text: true };
  var TYPED = { shape: 'typed', art: null, decode: true, tf: ['True', 'False'] };
  var SHAPES = {
    'history-explorers': INDEX, 'wikaharian': INDEX, 'page-turners': INDEX, 'rise-shine': INDEX, 'rally-ready': INDEX,
    'craft-corner': INDEX, 'life-lab': INDEX, 'net-navigators': INDEX, 'rhythm-hues': INDEX,
    'block-bot': { shape: 'index', art: 'art', text: false },
    'kuwentista': { shape: 'index', art: null, text: false },
    'word-train': TYPED, 'growing-good': TYPED, 'science-detectives': TYPED,
    'byte-buddies': { shape: 'typed', art: 'pic', decode: true, tf: ['True', 'False'] },
    'batang-bayani': { shape: 'typed', art: null, decode: false, tf: ['Tama', 'Mali'] }
  };

  // The same replacements as the Grade 2 games' decode().
  function decode(str) {
    return str
      .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
      .replace(/&rsquo;/g, '’').replace(/&mdash;/g, '—').replace(/&minus;/g, '−').replace(/&amp;/g, '&');
  }

  function supports(app) { return Object.prototype.hasOwnProperty.call(SHAPES, app); }

  function rightOption(item) {
    return (item.options || []).filter(function (o) { return o && o.correct; })[0] || null;
  }

  function askable(app, lesson, item) {
    var c = SHAPES[app];
    if (!c || !item || (lesson && lesson.generate) || item.art || item.pic || item.passage) return false;
    if (c.shape === 'index') return Array.isArray(item.options) && typeof item.correct === 'number' && item.options[item.correct] !== undefined;
    return item.type === 'tf' ? typeof item.answer === 'boolean' : item.type === 'mc' && !!rightOption(item);
  }

  // The game's reviewInfo: { q, art, answer, historyQ, historyAnswer }. Block Bot names its picture questions in its own
  // way (historyQuestion), but picture questions are never asked here, so only their keys must match.
  function info(app, item, textOf) {
    var c = SHAPES[app], art = c.art ? item[c.art] : undefined;
    if (c.shape === 'index') {
      var answer = item.options[item.correct];
      return { q: item.q, art: art, answer: c.text ? textOf(answer) : answer, historyQ: art ? item.q + ' [' + answer + ']' : item.q, historyAnswer: answer };
    }
    var right = item.type === 'tf' ? null : rightOption(item);
    var said = item.type === 'tf' ? (item.answer ? c.tf[0] : c.tf[1]) : (right || {}).text;
    return {
      q: item.q, art: art, answer: right ? textOf(c.decode ? decode(right.text) : right.text) : '',
      historyQ: art ? item.q + ' [' + said + ']' : item.q, historyAnswer: said
    };
  }

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1)), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function both() { return [].slice.call(arguments).filter(Boolean).join('\n'); }

  // What the bubble shows: the question, a helper line, the choices (shuffled), the right answer and the game's own
  // explanations. history is the text the game saves for that choice.
  function view(app, item, textOf, rand) {
    var c = SHAPES[app];
    rand = rand || Math.random;
    function t(s) { return s ? textOf(c.shape === 'typed' && c.decode ? decode(String(s)) : s) : ''; }
    if (c.shape === 'index') {
      var options = shuffle(item.options.map(function (o, i) {
        return { text: t(o), right: i === item.correct, history: o, why: both(t((item.why || [])[i]), t((item.whyEn || [])[i])) };
      }), rand);
      return { q: t(item.q), sub: t(item.qen), options: options, answer: t(item.options[item.correct]), app: app, explain: both(t(item.explain), t(item.en)), good: '' };
    }
    var out = { app: app, q: t(item.q), sub: '', explain: t(item.bad), good: t(item.good) };
    if (item.type === 'tf') {
      out.options = [true, false].map(function (v, i) {
        return { text: c.tf[i], right: item.answer === v, history: c.tf[i], why: item.answer === v ? '' : t(item.why) };
      });
      out.answer = c.tf[item.answer ? 0 : 1];
    } else {
      out.options = shuffle(item.options.map(function (o) {
        return { text: t(o.text), right: !!o.correct, history: o.text, why: o.correct ? '' : t(o.why) };
      }), rand);
      out.answer = t(rightOption(item).text);
    }
    return out;
  }

  var exported = { SHAPES: SHAPES, supports: supports, askable: askable, info: info, view: view, decode: decode };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Quiz = exported;
})(this);
