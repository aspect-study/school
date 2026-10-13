/* A tap chat in the speech bubble: a character's opening line, its reply buttons, the line each reply leads to, and Bye.
   Grade 2 shows "Filipino · English" through Talk's pair mode (the 🇵🇭 switch decides how much of it); Grade 5 English.
   Cosmetic: nothing is saved. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Speech = node ? require('./speech.js') : null;

  function speech() { return Speech || root.World3D.Speech; }

  function textOf(line, ctx, grade) {
    var en = speech().fill(line.say, ctx), fil = line.fil ? speech().fill(line.fil, ctx) : '';
    if (grade === 'grade2' && fil) return { text: fil + ' · ' + en, pair: true };
    return { text: en, pair: false };
  }

  // choose(reply) runs when a reply is tapped; bye runs for the Bye button.
  function buttons(line, byeText, choose, bye) {
    var out = (line.replies || []).map(function (r) { return { text: r.text, onClick: function () { choose(r); } }; });
    out.push({ text: byeText, main: !out.length, onClick: bye });
    return out;
  }

  // o = { doc, data, speaker, face, who, ctx, state, rand, grade, byeText, onClose }; returns false when no line fits.
  // onClose runs once, when the whole chat ends (Bye, a last reply, Escape or close()), never between two steps.
  function open(o) {
    var W = root.World3D, line = speech().pick(o.data, o.speaker, o.ctx, o.state, o.rand, true), handle = null, ended = false;
    if (!line) return false;
    function end() {
      if (ended) return;
      ended = true;
      if (o.onClose) o.onClose();
    }
    function step(l) {
      var t = textOf(l, o.ctx, o.grade), mine = null;
      mine = handle = W.Talk.open({
        doc: o.doc, face: o.face, who: o.who, text: t.text, pair: t.pair, stack: true,
        buttons: buttons(l, o.byeText, function (r) {
          var next = speech().reply(o.data, r);
          if (next) step(next);
          else end();
        }, end),
        // Talk closes a bubble before running the tapped button, so wait for that button: a reply opens the next step.
        onClose: function () {
          Promise.resolve().then(function () { if (handle === mine) end(); });
        }
      });
    }
    step(line);
    return { close: function () { if (handle) handle.close(); } };
  }

  var exported = { textOf: textOf, buttons: buttons, open: open };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.SpeechChat = exported;
})(this);
