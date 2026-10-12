/* The parent's reward shop editor, drawn inside the Rewards tab of the Parent panel (tablet lobbies and phone page).
   It only talks to the wallet's shop API (wallet.shop), which validates and saves. Text goes in with textContent only. */
(function (root) {
  'use strict';

  var CSS =
    '.se-note{margin:0 0 10px;}' +
    '.se-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px;}' +
    '.se-top input[type=search]{flex:1 1 160px;min-width:0;font:inherit;padding:8px 12px;border-radius:999px;border:1px solid var(--border);background:var(--bg);color:var(--ink);}' +
    '.se-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:8px 0;border-top:1px solid var(--border);}' +
    '.se-row.se-off .se-name{opacity:.55;text-decoration:line-through;}' +
    '.se-emoji{font-size:1.4rem;}' +
    '.se-name{flex:1 1 140px;min-width:0;font-weight:800;overflow-wrap:anywhere;}' +
    '.se-price{font-weight:800;white-space:nowrap;}' +
    '.se-tag{font-size:.75rem;font-weight:800;padding:2px 8px;border-radius:999px;background:var(--bg-alt);color:var(--ink-soft);white-space:nowrap;}' +
    '.se-actions{display:flex;flex-wrap:wrap;gap:6px;}' +
    '.se-form{padding:10px 0;border-top:1px solid var(--border);}' +
    '.se-form label{display:block;font-weight:800;margin:8px 0 4px;}' +
    '.se-form input[type=text],.se-form input[type=number],.se-form select{font:inherit;padding:8px 12px;border-radius:12px;border:1px solid var(--border);background:var(--bg);color:var(--ink);max-width:100%;}' +
    '.se-form input[type=text]{width:100%;box-sizing:border-box;}' +
    '.se-picks{display:flex;flex-wrap:wrap;gap:6px;}' +
    '.se-pick{font-size:1.3rem;padding:4px 8px;border-radius:12px;border:2px solid var(--border);background:var(--card);cursor:pointer;}' +
    '.se-pick[aria-pressed=true]{border-color:var(--ink);background:var(--bg-alt);}' +
    '.se-price-row{display:flex;gap:6px;align-items:center;}' +
    '.se-price-row input{width:6em;text-align:center;}' +
    '.se-error{margin:4px 0 0;color:#b91c1c;font-weight:700;font-size:.9rem;}' +
    '.se-confirm{flex:1 1 100%;font-weight:800;}' +
    '.se-foot{margin-top:12px;}';

  var ERROR_TEXT = {
    name: 'Type a name, up to 40 letters.',
    price: 'Price must be a whole number from 10 to 10000 coins.',
    emoji: 'Pick a picture.',
    note: 'The note can be up to 80 letters.',
    limit: 'Pick 1, 2 or 3 a day, or no limit.',
    full: 'You already have 40 rewards of your own. Delete one first.',
    save: 'Could not save. Try again.',
    item: 'That reward is not there any more.'
  };
  var FIELD_OF = { name: 'name', price: 'price', emoji: 'emoji', note: 'note', limit: 'limit' };
  var SEARCH_FROM = 12;

  function addStyle(doc) {
    if (doc.getElementById('shop-editor-css')) return;
    var s = doc.createElement('style');
    s.id = 'shop-editor-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  function mount(o) {
    var doc = root.document, box = o.box, W = o.wallet;
    var picks = W.emojiPicks;
    var editing = null;
    var confirming = null;
    var query = '';
    var formError = null;
    var draft = null;
    addStyle(doc);

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function button(text, label, onClick, cls) {
      var b = el('button', cls || 'p-btn', text);
      b.type = 'button';
      if (label) b.setAttribute('aria-label', label);
      b.addEventListener('click', onClick);
      return b;
    }
    function changed() { if (o.onChange) o.onChange(); }

    function applyResult(result, done) {
      if (result.ok) {
        editing = null;
        confirming = null;
        formError = null;
        draft = null;
        if (done) done(result);
        draw();
        changed();
        return;
      }
      formError = { field: FIELD_OF[result.error] || 'save', text: ERROR_TEXT[result.error] || ERROR_TEXT.save };
      draw();
    }

    function limitText(item) { return item.perDay ? ' · ' + item.perDay + ' a day' : ''; }

    function drawRow(r) {
      var row = el('div', 'se-row' + (r.hidden ? ' se-off' : ''));
      row.appendChild(el('span', 'se-emoji', r.item.emoji));
      row.appendChild(el('span', 'se-name', r.item.name));
      row.appendChild(el('span', 'se-price', '🪙 ' + r.item.coins + limitText(r.item)));
      if (r.hidden || r.edited) row.appendChild(el('span', 'se-tag', r.hidden ? 'hidden' : 'edited'));
      if (confirming && confirming.id === r.id) {
        row.appendChild(el('div', 'se-confirm', confirming.kind === 'delete' ? 'Delete this reward for good?' : 'Put this reward back the way it was?'));
        var sure = el('div', 'se-actions');
        sure.appendChild(button('Cancel', 'Cancel for ' + r.item.name, function () { confirming = null; draw(); }));
        sure.appendChild(button(confirming.kind === 'delete' ? 'Delete' : 'Reset', (confirming.kind === 'delete' ? 'Delete ' : 'Reset ') + r.item.name, function () {
          applyResult(confirming.kind === 'delete' ? W.shop.removeItem(r.id) : W.shop.resetItem(r.id));
        }, 'p-btn on'));
        row.appendChild(sure);
        return row;
      }
      var actions = el('div', 'se-actions');
      actions.appendChild(button(r.hidden ? 'Show' : 'Hide', (r.hidden ? 'Show ' : 'Hide ') + r.item.name, function () {
        applyResult(W.shop.setHidden(r.id, !r.hidden));
      }));
      actions.appendChild(button('Edit', 'Edit ' + r.item.name, function () { editing = r.id; confirming = null; formError = null; draft = null; draw(); }));
      if (r.custom) actions.appendChild(button('Delete', 'Delete ' + r.item.name, function () { confirming = { kind: 'delete', id: r.id }; draw(); }));
      else if (r.edited) actions.appendChild(button('Reset', 'Reset ' + r.item.name, function () { confirming = { kind: 'reset', id: r.id }; draw(); }));
      row.appendChild(actions);
      return row;
    }

    function errorFor(field) {
      return formError && formError.field === field ? el('p', 'se-error', formError.text) : null;
    }

    function drawForm(r) {
      var item = r ? r.item : { name: '', emoji: picks[0] || '', coins: 100 };
      var original = item;
      var custom = !r || r.custom;
      var form = el('div', 'se-form');
      if (draft) item = draft;
      var chosen = item.emoji;

      var nameLabel = el('label', '', 'Name');
      var name = el('input');
      name.type = 'text';
      name.maxLength = 40;
      name.value = item.name;
      name.setAttribute('aria-label', 'Reward name');
      form.appendChild(nameLabel);
      form.appendChild(name);
      if (errorFor('name')) form.appendChild(errorFor('name'));

      form.appendChild(el('label', '', 'Picture'));
      var row = el('div', 'se-picks');
      var pickButtons = picks.map(function (e) {
        var b = el('button', 'se-pick', e);
        b.type = 'button';
        b.setAttribute('aria-pressed', e === chosen ? 'true' : 'false');
        b.addEventListener('click', function () {
          chosen = e;
          pickButtons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        });
        row.appendChild(b);
        return b;
      });
      form.appendChild(row);
      if (errorFor('emoji')) form.appendChild(errorFor('emoji'));

      form.appendChild(el('label', '', 'Price in coins'));
      var priceRow = el('div', 'se-price-row');
      var price = el('input');
      price.type = 'number';
      price.min = '10';
      price.max = '10000';
      price.step = '10';
      price.value = String(item.coins);
      price.setAttribute('aria-label', 'Price in coins');
      function nudge(by) {
        var n = Number(price.value);
        price.value = String(Math.max(10, Math.min(10000, (isFinite(n) ? n : 0) + by)));
      }
      priceRow.appendChild(button('−10', 'Lower the price by 10', function () { nudge(-10); }));
      priceRow.appendChild(price);
      priceRow.appendChild(button('+10', 'Raise the price by 10', function () { nudge(10); }));
      form.appendChild(priceRow);
      if (errorFor('price')) form.appendChild(errorFor('price'));

      var note, limit;
      if (custom) {
        form.appendChild(el('label', '', 'Note (optional)'));
        note = el('input');
        note.type = 'text';
        note.maxLength = 80;
        note.value = item.note || '';
        note.setAttribute('aria-label', 'Note');
        form.appendChild(note);
        if (errorFor('note')) form.appendChild(errorFor('note'));

        form.appendChild(el('label', '', 'How often'));
        limit = el('select');
        [['0', 'No limit'], ['1', '1 a day'], ['2', '2 a day'], ['3', '3 a day']].forEach(function (pair) {
          var opt = el('option', '', pair[1]);
          opt.value = pair[0];
          limit.appendChild(opt);
        });
        limit.value = String(item.perDay || 0);
        limit.setAttribute('aria-label', 'How often');
        form.appendChild(limit);
        if (errorFor('limit')) form.appendChild(errorFor('limit'));
      }
      if (errorFor('save')) form.appendChild(errorFor('save'));

      function save() {
        var fields = {};
        draft = { name: name.value, emoji: chosen, coins: price.value, note: note ? note.value : '', perDay: limit ? Number(limit.value) : 0 };
        if (custom) {
          fields = { name: name.value, emoji: chosen, coins: Number(price.value), note: note.value, perDay: Number(limit.value) };
        } else {
          if (name.value !== original.name) fields.name = name.value;
          if (chosen !== original.emoji) fields.emoji = chosen;
          if (Number(price.value) !== original.coins) fields.coins = Number(price.value);
          if (!Object.keys(fields).length) { editing = null; formError = null; draft = null; draw(); return; }
        }
        applyResult(r ? W.shop.editItem(r.id, fields) : W.shop.addItem(fields));
      }
      name.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') save(); });
      price.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') save(); });

      var actions = el('div', 'se-actions se-foot');
      actions.appendChild(button('Save', 'Save the reward', save, 'p-btn on'));
      actions.appendChild(button('Cancel', 'Cancel', function () { editing = null; formError = null; draft = null; draw(); }));
      form.appendChild(actions);
      return form;
    }

    function draw() {
      box.textContent = '';
      box.appendChild(el('h3', '', '🛒 Reward shop'));
      box.appendChild(el('p', 'p-note se-note', 'Rewards you add are only for this child. Coins already spent stay spent.'));
      var rows = W.shop.rows();
      if (editing && editing !== 'new' && !rows.some(function (r) { return r.id === editing; })) editing = null;
      var top = el('div', 'se-top');
      top.appendChild(button('➕ Add a reward', 'Add a reward', function () { editing = 'new'; confirming = null; formError = null; draft = null; draw(); }, 'p-btn on'));
      if (rows.length > SEARCH_FROM) {
        var search = el('input');
        search.type = 'search';
        search.value = query;
        search.placeholder = 'Search rewards';
        search.setAttribute('aria-label', 'Search rewards');
        search.addEventListener('input', function () {
          query = search.value.trim().toLowerCase();
          drawList(list, rows);
        });
        top.appendChild(search);
      }
      box.appendChild(top);
      if (editing === 'new') box.appendChild(drawForm(null));
      var list = el('div', 'se-list');
      box.appendChild(list);
      drawList(list, rows);

      var foot = el('div', 'se-foot');
      if (confirming && confirming.kind === 'all') {
        foot.appendChild(el('div', 'se-confirm', 'Put every reward back to the starter list and delete the ones you added?'));
        var sure = el('div', 'se-actions');
        sure.appendChild(button('Cancel', 'Cancel resetting the shop', function () { confirming = null; draw(); }));
        sure.appendChild(button('Reset the whole shop', 'Reset the whole shop', function () { applyResult(W.shop.resetAll()); }, 'p-btn on'));
        foot.appendChild(sure);
      } else {
        foot.appendChild(button('Reset the whole shop', 'Reset the whole shop', function () { confirming = { kind: 'all' }; draw(); }));
      }
      box.appendChild(foot);
    }

    function drawList(list, rows) {
      list.textContent = '';
      rows.forEach(function (r) {
        if (query && r.item.name.toLowerCase().indexOf(query) < 0) return;
        list.appendChild(editing === r.id ? drawForm(r) : drawRow(r));
      });
    }

    // A sync can call render while a form is open; keep what the parent is typing.
    function render() {
      if (editing) return;
      draw();
    }

    draw();
    return { render: render };
  }

  root.ShopEditor = { mount: mount };
})(this);
