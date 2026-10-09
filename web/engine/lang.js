/* English first for Grade 2. Outside the Filipino, Makabansa and Araling Panlipunan games, every "Filipino · English"
   pair shows only its English half. The 🇵🇭 Filipino switch (lobby, game menu, world Settings) brings the Filipino back
   under the English; it is one device-level key, `study_fil_helper_v1`.
   localize(table) is how a module gets its Grade 2 words: it returns the table unchanged when both languages show, and an
   English-only copy otherwise (strings, nested objects, arrays and functions that return strings). */
(function (root) {
  'use strict';

  var KEY = 'study_fil_helper_v1';
  var SEP = ' · ';
  var BOTH_PAGES = /\/(filipino|makabansa|araling-panlipunan|kuwentista|batang-bayani|history-explorers|wikaharian)(\/|\.html)/;

  var FIL = ('ang ng mga sa ay ako ikaw ka mo ko niya siya sila tayo natin namin kami kayo ito iyan iyon dito doon ba po lang ' +
    'pa na at kung kapag hindi wala may mayroon para pero kasi dahil habang bawat bago pagkatapos muna ulit subukan pindutin ' +
    'piliin gusto gamitin kumusta salamat magaling galing tama mali sagot tanong aralin laro laro maglaro naglalaro puntos ' +
    'barya tindahan alaga buhok damit sombrero salamin mata leeg likod kamay bahay kuwarto hardin tarangkahan plasa palaruan ' +
    'bayan kaibigan huling halos tapos natapos nakuha natalo bagong isang dalawa tatlo apat lima pang yugto sunod susunod ' +
    'ngayon bukas kahapon araw linggo buwan oras minuto segundo lahat walang lamang nga si ni kay nina kina sina isa ' +
    'mamaya bumalik balik punta puntahan sundan kislap tunog musika yabag linaw ayos mapa pahinga nagpapahinga naghihintay ' +
    'inihahanda gumigising pumili pumipili piliin mabuti masaya malungkot kulay pangalan katawan pekas pisngi mukha ' +
    'saan sino alin bakit paano ilan magkano bilhin binili iyo iyong aking kanyang kanilang ating inyong tulong tulungan ' +
    'hawak hawakan makita makilala isukat ilagay ilipat lumaki lumalaki kumikinang parisukat medalya tropeo mesa ' +
    'bumisita bisita kapatid ate kuya bunso nanay tatay lola lolo tito tita mang mayora propesor punong nagsasalita ' +
    'hesus kuta laban yugto natutuhan natutunan matuto tara sumagot sagutin sinabi kapag hanggang pagkalipas ' +
    'unang ikalawang ikatlong sa mula patungo kasama kasamang basahin pakinggan makinig nakikinig pinili pinindot ' +
    'gawin ginawa gagawin tingnan tignan hanapin hinahanap nakita aralin paksa pagsusulit sagot').split(' ');
  var EN = ('the a an is are was were be to of for and in on at it this that you your yours we our they their he she his her ' +
    'tap press try again go find has have had do does did not no yes with from by or but if so as up out all any more most ' +
    'some new old good great nice well now today tomorrow yesterday week day days hour hours minute minutes question ' +
    'questions lesson lessons game games points coins coin shop room look hello hi sound sounds music quality settings ' +
    'friend friends done close next back later boss stage stages star stars right wrong answer pick choose buy your my ' +
    'me i can will would should could let lets get got see saw make made keep kept take took come came give gave ' +
    'play played playing walk talk ask asked story word words buddy village map list path').split(' ');
  var FIL_SET = {}, EN_SET = {};
  FIL.forEach(function (w) { FIL_SET[w] = true; });
  EN.forEach(function (w) { EN_SET[w] = true; });

  function words(s) { return (s.toLowerCase().match(/[a-zñ']+/g) || []); }

  function score(s) {
    var f = 0, e = 0;
    words(s).forEach(function (w) {
      if (FIL_SET[w]) f++;
      if (EN_SET[w]) e++;
    });
    return { f: f, e: e };
  }

  // Which half is English? The half with more Filipino words and fewer English words is Filipino; a tie keeps the
  // house order, Filipino first. Returns the index of the English half.
  function englishIndex(a, b) {
    var sa = score(a), sb = score(b), da = sa.f - sa.e, db = sb.f - sb.e;
    if (da === db) return 1;
    return da > db ? 1 : 0;
  }

  function leadOf(s) { return /^[^\p{L}\p{N}]*/u.exec(s)[0]; }

  // "🪙 Filipino text · English text" -> "🪙 English text". The leading emoji of the pair stays.
  function en(text) {
    if (typeof text !== 'string') return text;
    var cut = text.lastIndexOf(SEP);
    if (cut < 0) return text;
    var a = text.slice(0, cut), b = text.slice(cut + SEP.length), keep = englishIndex(a, b) === 0 ? a : b;
    var lead = leadOf(text);
    return keep.indexOf(lead) === 0 || !lead ? keep : lead + keep;
  }

  function storage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }
  var memory = null;

  function helper() {
    if (memory !== null) return memory;
    var s = storage(), v = null;
    try { v = s && s.getItem(KEY); } catch (e) {}
    return v === 'on';
  }
  function setHelper(on) {
    memory = !!on;
    var s = storage();
    try { if (s) s.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
  }

  function filipinoPage() {
    var loc = root.location;
    return !!(loc && BOTH_PAGES.test(loc.pathname || ''));
  }

  // true when text should show both languages: the helper is on, or this is a Filipino-language game.
  function both() { return helper() || filipinoPage(); }

  function walk(x) {
    if (typeof x === 'string') return en(x);
    if (typeof x === 'function') {
      var wrapped = function () { return walk(x.apply(this, arguments)); };
      Object.keys(x).forEach(function (k) { wrapped[k] = x[k]; });
      return wrapped;
    }
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === 'object') {
      var out = {};
      Object.keys(x).forEach(function (k) { out[k] = walk(x[k]); });
      return out;
    }
    return x;
  }

  function localize(table) { return both() ? table : walk(table); }

  // The 🇵🇭 Filipino switch. Returns a button; pressing it flips the helper and calls onChange (default: reload).
  function button(doc, onChange) {
    var b = doc.createElement('button');
    b.type = 'button';
    b.className = 'fil-helper';
    function paint() {
      var on = helper();
      b.textContent = '🇵🇭 Filipino: ' + (on ? 'On' : 'Off');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    b.addEventListener('click', function () {
      setHelper(!helper());
      paint();
      if (onChange) onChange(helper()); else if (root.location && root.location.reload) root.location.reload();
    });
    paint();
    return b;
  }

  var api = { filipinoGame: filipinoPage, en: en, helper: helper, setHelper: setHelper, both: both, localize: localize, button: button, KEY: KEY, englishIndex: englishIndex };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.Lang = api;
})(this);
