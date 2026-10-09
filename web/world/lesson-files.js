/* Made by tools/update-precache.js; do not edit. Each game's lesson files, which the 3D world loads when she asks
   for review questions (ask.js). */
(function (root) {
  'use strict';
  var FILES = {
    "byte-buddies": {
      "title": "Byte Buddies",
      "pointsKey": "bytebuddies_points_v1",
      "progressKey": "bytebuddies_progress_v1",
      "dir": "../subjects/grade-2/computer/",
      "files": [
        "lessons/01-taking-care-of-myself-and-my-computer.js",
        "lessons/02-computer-laboratory-rules.js",
        "lessons/03-elements-of-a-computer-system.js",
        "lessons/04-parts-of-the-desktop.js",
        "lessons/05-common-desktop-icons.js",
        "lessons/06-changing-the-desktop-wallpaper.js",
        "lessons/07-quick-launch-bar-and-notification-area.js",
        "lessons/08-understanding-the-internet.js",
        "lessons/09-exploring-the-places-on-the-internet.js",
        "lessons/10-connecting-to-the-internet.js"
      ]
    },
    "word-train": {
      "title": "Word Train",
      "pointsKey": "wordtrain_points_v1",
      "progressKey": "wordtrain_progress_v1",
      "dir": "../subjects/grade-2/english/",
      "files": [
        "lessons/01-review-of-the-alphabet.js",
        "lessons/02-onset-and-rime.js",
        "lessons/03-cvc-words.js",
        "lessons/04-high-frequency-and-math-words.js",
        "lessons/05-common-and-proper-nouns.js",
        "lessons/06-gender-nouns.js",
        "lessons/07-action-verbs.js",
        "lessons/08-adjectives.js",
        "lessons/09-personal-pronouns.js",
        "lessons/10-demonstrative-pronouns.js",
        "lessons/11-sentences-and-predicate.js",
        "lessons/12-intonation.js",
        "lessons/13-sequence-of-events.js"
      ]
    },
    "kuwentista": {
      "title": "Kuwentista",
      "pointsKey": "kuwentista_points_v1",
      "progressKey": "kuwentista_progress_v2",
      "dir": "../subjects/grade-2/filipino/",
      "files": [
        "lessons/01-alpabeto.js",
        "lessons/02-pangngalan.js",
        "lessons/03-panghalip.js",
        "lessons/04-magkatugma.js",
        "lessons/05-panguri.js",
        "lessons/06-pandiwa.js",
        "lessons/07-intonasyon.js",
        "lessons/08-kwento.js",
        "lessons/09-kayarian.js",
        "lessons/10-reaksyon.js",
        "lessons/11-antas.js",
        "lessons/12-sightwords.js",
        "lessons/13-kongkreto.js",
        "lessons/14-parirala.js",
        "lessons/15-pantukoy.js"
      ]
    },
    "growing-good": {
      "title": "Growing Good",
      "pointsKey": "growinggood_points_v1",
      "progressKey": "growinggood_progress_v1",
      "dir": "../subjects/grade-2/gmrc/",
      "files": [
        "lessons/01-i-know-who-i-am.js",
        "lessons/02-i-got-this-feeling.js",
        "lessons/03-i-pray.js",
        "lessons/04-i-take-care-of-myself.js",
        "lessons/05-i-spend-wisely.js",
        "lessons/06-thrifty-ways.js",
        "lessons/07-i-obey.js",
        "lessons/08-i-can.js"
      ]
    },
    "batang-bayani": {
      "title": "Batang Bayani",
      "pointsKey": "batangbayani_points_v1",
      "progressKey": "batangbayani_progress_v1",
      "dir": "../subjects/grade-2/makabansa/",
      "files": [
        "lessons/01-ano-ang-komunidad.js",
        "lessons/02-batayang-impormasyon-ng-komunidad.js",
        "lessons/03-kahalagahan-ng-komunidad.js",
        "lessons/04-klima-at-panahon.js",
        "lessons/05-lokasyon-ng-komunidad-ayon-sa-kapaligira.js",
        "lessons/06-lawak-at-populasyon-ng-komunidad.js",
        "lessons/07-anyong-lupa.js",
        "lessons/08-anyong-tubig.js",
        "lessons/09-mga-simbolo-sa-mapa.js",
        "lessons/10-pangalawang-direksiyon.js",
        "lessons/11-mga-taong-naninirahan-sa-komunidad.js",
        "lessons/12-mga-institusyong-panlipunan.js",
        "lessons/13-gawain-at-tungkulin-ng-mga-bumubuo-sa-ko.js",
        "lessons/14-gawain-at-tungkulin-ng-bata-sa-komunidad.js"
      ]
    },
    "block-bot": {
      "title": "Block Bot",
      "pointsKey": "blockbot_points_v1",
      "progressKey": "blockbot_progress_v2",
      "dir": "../subjects/grade-2/math/",
      "files": [
        "lessons/01-blocks.js",
        "lessons/02-readwrite.js",
        "lessons/03-skip.js",
        "lessons/04-compare.js",
        "lessons/05-order.js",
        "lessons/06-ordinal.js",
        "lessons/07-placevalue.js",
        "lessons/08-numberline.js",
        "lessons/09-expanded.js",
        "lessons/10-addnoregroup.js",
        "lessons/11-addregroup.js",
        "lessons/12-money.js"
      ]
    },
    "science-detectives": {
      "title": "Science Detectives",
      "pointsKey": "sciencedetectives_points_v1",
      "progressKey": "sciencedetectives_progress_v1",
      "dir": "../subjects/grade-2/science/",
      "files": [
        "lessons/01-my-body-parts.js",
        "lessons/02-my-five-senses.js",
        "lessons/03-what-is-matter.js",
        "lessons/04-animals-and-their-babies.js",
        "lessons/05-each-animal-has-its-own-home.js",
        "lessons/06-how-do-animals-survive.js"
      ]
    },
    "history-explorers": {
      "title": "History Explorers",
      "pointsKey": "historyexplorers_points_v1",
      "progressKey": "historyexplorers_progress_v1",
      "dir": "../subjects/grade-5/araling-panlipunan/",
      "files": [
        "lessons/01-barangay.js",
        "lessons/02-pinuno.js",
        "lessons/03-antas.js",
        "lessons/04-hanapbuhay.js",
        "lessons/05-teknolohiya.js",
        "lessons/06-kalinangan.js",
        "lessons/07-materyal.js",
        "lessons/08-paniniwala.js",
        "lessons/09-babaylan.js",
        "lessons/10-pangitain.js",
        "lessons/11-paglilibing.js",
        "lessons/12-kasal.js",
        "lessons/13-pinagmulan.js",
        "lessons/14-kasaysayan.js",
        "lessons/15-disiplina.js",
        "lessons/16-batayan.js",
        "lessons/17-pananaw.js",
        "lessons/18-kaalamang-bayan.js",
        "lessons/19-teorya.js",
        "lessons/20-unang-pilipino.js",
        "lessons/21-teorya-tao.js",
        "lessons/22-ebidensiya.js",
        "lessons/23-lokasyon.js",
        "lessons/24-herarkiya.js",
        "lessons/25-di-materyal.js",
        "lessons/26-islam.js",
        "lessons/27-sultanato.js",
        "lessons/28-katuruan-islam.js",
        "lessons/29-tsina.js"
      ]
    },
    "net-navigators": {
      "title": "Net Navigators",
      "pointsKey": "netnavigators_points_v1",
      "progressKey": "netnavigators_progress_v1",
      "dir": "../subjects/grade-5/computer/",
      "files": [
        "lessons/01-search.js",
        "lessons/02-evaluate.js",
        "lessons/03-filesharing.js",
        "lessons/04-risks.js",
        "lessons/05-online.js",
        "lessons/06-netiquette.js",
        "lessons/07-chat.js",
        "lessons/08-discussion.js"
      ]
    },
    "page-turners": {
      "title": "Page Turners",
      "pointsKey": "pageturners_points_v1",
      "progressKey": "pageturners_progress_v1",
      "dir": "../subjects/grade-5/english/",
      "files": [
        "lessons/01-elements.js",
        "lessons/02-plot.js",
        "lessons/03-sequence.js",
        "lessons/04-spelling.js",
        "lessons/05-traits.js",
        "lessons/06-conclusions.js",
        "lessons/07-figurative.js",
        "lessons/08-sound.js",
        "lessons/09-predicting.js",
        "lessons/10-mainidea.js",
        "lessons/11-summary.js",
        "lessons/12-outline.js",
        "lessons/13-purpose.js",
        "lessons/14-tone.js",
        "lessons/15-generalize.js",
        "lessons/16-connotation.js",
        "lessons/17-dictionary.js",
        "lessons/18-nouns.js",
        "lessons/19-complement.js",
        "lessons/20-pronouns.js",
        "lessons/21-pronouns2.js",
        "lessons/22-factopinion.js",
        "lessons/23-visual.js"
      ]
    },
    "wikaharian": {
      "title": "Wikaharian",
      "pointsKey": "wikaharian_points_v1",
      "progressKey": "wikaharian_progress_v1",
      "dir": "../subjects/grade-5/filipino/",
      "files": [
        "lessons/01-tula.js",
        "lessons/02-kathangisip.js",
        "lessons/03-teksto.js",
        "lessons/04-pokus.js",
        "lessons/05-pangangkop.js",
        "lessons/06-kababalaghan.js",
        "lessons/07-realidad.js",
        "lessons/08-denotasyon.js",
        "lessons/09-antas-panguri.js",
        "lessons/10-palansak.js",
        "lessons/11-pangabay.js",
        "lessons/12-mito-alamat.js",
        "lessons/13-liham.js",
        "lessons/14-sanggunian.js",
        "lessons/15-multimedia.js",
        "lessons/16-diberbal.js",
        "lessons/17-angkop-wika.js",
        "lessons/18-pormularyo.js",
        "lessons/19-pananda.js",
        "lessons/20-mga-akda.js"
      ]
    },
    "rise-shine": {
      "title": "Rise & Shine",
      "pointsKey": "riseshine_points_v1",
      "progressKey": "riseshine_progress_v1",
      "dir": "../subjects/grade-5/gmrc/",
      "files": [
        "lessons/01-myself.js",
        "lessons/02-saving.js",
        "lessons/03-dignity.js",
        "lessons/04-faith.js",
        "lessons/05-strengthsave.js",
        "lessons/06-dignitywords.js",
        "lessons/07-signs.js",
        "lessons/08-trafficrules.js",
        "lessons/09-manners.js",
        "lessons/10-sacred.js",
        "lessons/11-gratitude.js",
        "lessons/12-ewaste.js",
        "lessons/13-devices.js"
      ]
    },
    "rhythm-hues": {
      "title": "Rhythm & Hues",
      "pointsKey": "rhythmhues_points_v1",
      "progressKey": "rhythmhues_progress_v1",
      "dir": "../subjects/grade-5/music-arts/",
      "files": [
        "lessons/01-songs.js",
        "lessons/02-idiophones.js",
        "lessons/03-drums-strings-flutes.js",
        "lessons/04-theater-dance.js",
        "lessons/05-visual-arts.js",
        "lessons/06-materials-patterns.js",
        "lessons/07-recorder-history.js",
        "lessons/08-consorts.js",
        "lessons/09-recorder-parts.js",
        "lessons/10-recorder-care.js",
        "lessons/11-reading-notes.js",
        "lessons/12-fingerings.js"
      ]
    },
    "rally-ready": {
      "title": "Rally Ready",
      "pointsKey": "rallyready_points_v1",
      "progressKey": "rallyready_progress_v1",
      "dir": "../subjects/grade-5/pe-health/",
      "files": [
        "lessons/01-netwall.js",
        "lessons/02-abc.js",
        "lessons/03-gameon.js",
        "lessons/04-kitchen.js",
        "lessons/05-stress.js",
        "lessons/06-movestress.js",
        "lessons/07-stresswords.js",
        "lessons/08-skillsaction.js",
        "lessons/09-stresscauses.js",
        "lessons/10-stresssigns.js",
        "lessons/11-copeways.js",
        "lessons/12-bullying.js",
        "lessons/13-lifeskills.js",
        "lessons/14-relaxtech.js",
        "lessons/15-siyatong.js",
        "lessons/16-puberty.js",
        "lessons/17-pubertychanges.js",
        "lessons/18-pubertycare.js"
      ]
    },
    "life-lab": {
      "title": "Life Lab",
      "pointsKey": "lifelab_points_v1",
      "progressKey": "lifelab_progress_v1",
      "dir": "../subjects/grade-5/science/",
      "files": [
        "lessons/01-whatmatter.js",
        "lessons/02-matter.js",
        "lessons/03-measure.js",
        "lessons/04-volume.js",
        "lessons/05-changes.js",
        "lessons/06-physchem.js",
        "lessons/07-scimethod.js",
        "lessons/08-investigate.js",
        "lessons/09-bacteria.js",
        "lessons/10-fungi.js",
        "lessons/11-plantgroups.js",
        "lessons/12-vertebrates.js",
        "lessons/13-invertebrates.js",
        "lessons/14-rootsystem.js",
        "lessons/15-shootsystem.js",
        "lessons/16-specialized.js",
        "lessons/17-classify.js",
        "lessons/18-adapt.js"
      ]
    },
    "craft-corner": {
      "title": "Craft Corner",
      "pointsKey": "craftcorner_points_v1",
      "progressKey": "craftcorner_progress_v1",
      "dir": "../subjects/grade-5/tle/",
      "files": [
        "lessons/01-furnishing.js",
        "lessons/02-embtools.js",
        "lessons/03-embdesign.js",
        "lessons/04-crochettools.js",
        "lessons/05-crochetstitches.js",
        "lessons/06-embstitches.js",
        "lessons/07-crochetabbr.js",
        "lessons/08-handsewing.js",
        "lessons/09-machinesewing.js"
      ]
    }
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FILES;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.LessonFiles = FILES;
})(this);
