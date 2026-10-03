/* Each grade's subjects as the lobby cards show them, for the parent page, which has no cards.
   tests/subjects.test.js keeps this list equal to the cards. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var SUBJECTS = {
    5: [
      { app: 'history-explorers', title: 'Araling Panlipunan', pointsKey: 'historyexplorers_points_v1' },
      { app: 'wikaharian', title: 'Filipino', pointsKey: 'wikaharian_points_v1' },
      { app: 'math-mastery', title: 'Math', pointsKey: 'mathmastery_points_v1' },
      { app: 'page-turners', title: 'English', pointsKey: 'pageturners_points_v1' },
      { app: 'rise-shine', title: 'GMRC', pointsKey: 'riseshine_points_v1' },
      { app: 'rally-ready', title: 'P.E. & Health', pointsKey: 'rallyready_points_v1' },
      { app: 'craft-corner', title: 'TLE', pointsKey: 'craftcorner_points_v1' },
      { app: 'life-lab', title: 'Science', pointsKey: 'lifelab_points_v1' },
      { app: 'net-navigators', title: 'Computer', pointsKey: 'netnavigators_points_v1' },
      { app: 'rhythm-hues', title: 'Music & Arts', pointsKey: 'rhythmhues_points_v1' }
    ],
    2: [
      { app: 'block-bot', title: 'Math', pointsKey: 'blockbot_points_v1' },
      { app: 'kuwentista', title: 'Filipino', pointsKey: 'kuwentista_points_v1' },
      { app: 'word-train', title: 'English', pointsKey: 'wordtrain_points_v1' },
      { app: 'batang-bayani', title: 'Makabansa', pointsKey: 'batangbayani_points_v1' },
      { app: 'growing-good', title: 'GMRC', pointsKey: 'growinggood_points_v1' },
      { app: 'byte-buddies', title: 'Computer', pointsKey: 'bytebuddies_points_v1' },
      { app: 'science-detectives', title: 'Science', pointsKey: 'sciencedetectives_points_v1' }
    ]
  };

  var exported = { SUBJECTS: SUBJECTS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Subjects = SUBJECTS;
})(this);
