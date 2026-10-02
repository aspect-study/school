/* Loaded first by every page: the only engine file that touches the browser's storage.
   A learner's space keeps her keys under learner/<id>/, and its outbox notes every key saved or deleted
   since the last sync, so cloud sync (phase 5b) knows what to send. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var PREFIX = 'learner/';
  var OUTBOX = 'sync_outbox_v1';
  var SYNC = /^sync_/;

  function allKeys(raw) {
    var out = [];
    try { for (var i = 0; i < raw.length; i++) out.push(raw.key(i)); } catch (e) { return []; }
    return out;
  }

  function space(raw, id, now) {
    var base = PREFIX + id + '/';
    function get(k) { try { return raw.getItem(base + k); } catch (e) { return null; } }
    function readOutbox() {
      try { var o = JSON.parse(get(OUTBOX)); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
    }
    function writeOutbox(o) { try { raw.setItem(base + OUTBOX, JSON.stringify(o)); } catch (e) {} }
    function note(k) {
      if (SYNC.test(k)) return;
      var o = readOutbox();
      o[k] = now();
      writeOutbox(o);
    }

    return {
      id: id,
      getItem: get,
      // Errors reach the caller, as with localStorage: history and the wallet report "storage is full" from them.
      setItem: function (k, v) {
        raw.setItem(base + k, v);
        note(k);
      },
      removeItem: function (k) {
        try { raw.removeItem(base + k); } catch (e) { return; }
        note(k);
      },
      // For values that came from the cloud: saved without going back into the outbox.
      put: function (k, v) {
        if (v === null) { try { raw.removeItem(base + k); } catch (e) {} return; }
        raw.setItem(base + k, v);
      },
      keys: function () {
        return allKeys(raw).filter(function (k) { return k && k.indexOf(base) === 0; }).map(function (k) { return k.slice(base.length); });
      },
      outbox: readOutbox,
      // After a sync: forget what was sent, unless it changed again while sending.
      done: function (sent) {
        var o = readOutbox();
        Object.keys(sent).forEach(function (k) { if (o[k] === sent[k]) delete o[k]; });
        writeOutbox(o);
      }
    };
  }

  function spaces(raw) {
    var seen = {};
    allKeys(raw).forEach(function (k) {
      var m = /^learner\/([^/]+)\//.exec(k || '');
      if (m) seen[m[1]] = true;
    });
    return Object.keys(seen);
  }

  var exported = { space: space, spaces: spaces, PREFIX: PREFIX, OUTBOX: OUTBOX };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  var now = function () { return Date.now(); };
  root.StudyStore = {
    space: function (id) { return space(root.localStorage, id, now); },
    spaces: function () { return spaces(root.localStorage); },
    raw: root.localStorage
  };
})(this);
