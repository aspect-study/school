// The 3DSkuwela opening animation: an overlay that plays over the world while it loads, once per browser session.
// Add ?intro=1 to the world URL to replay it. Skipped when the device asks for reduced motion.
(function (root) {
  var doc = root.document;
  var forced = /[?&]intro=1/.test(root.location.search);

  try {
    if (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  } catch (e) {}
  try {
    var store = root.sessionStorage;
    if (!forced && store.getItem('intro_seen_v1')) return;
    store.setItem('intro_seen_v1', '1');
  } catch (e) {}

  var letters = 'Skuwela'.split('').map(function (c, i) {
    return '<span style="--i:' + i + '">' + c + '</span>';
  }).join('');
  var sparks = [[14, 22, 1.7], [82, 18, 2.0], [24, 70, 2.3], [76, 66, 1.9], [50, 10, 2.5], [90, 44, 2.6], [8, 48, 2.2]].map(function (s) {
    return '<i class="i-spark" style="left:' + s[0] + '%;top:' + s[1] + '%;--d:' + s[2] + 's"></i>';
  }).join('');

  var el = doc.createElement('div');
  el.className = 'i-overlay';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="i-rays"></div>' + sparks +
    '<div class="i-card"><img class="i-logo" src="../assets/icons/grade5-512.png" alt="">' +
    '<div class="i-word"><span class="i-3d" data-t="3D">3D</span><span class="i-sk">' + letters + '</span></div></div>';
  doc.body.appendChild(el);

  var started = false;
  function go() {
    if (started) return;
    started = true;
    el.className += ' go';
    root.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4400);
  }

  var fonts = doc.fonts && doc.fonts.load ? doc.fonts.load('800 70px "Baloo 2"') : null;
  if (fonts) fonts.then(go, go);
  root.setTimeout(go, 700);
})(this);
