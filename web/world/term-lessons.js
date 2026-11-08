/* Made by tools/update-precache.js; do not edit. Each game's Term 2 lessons: how many (exams = summative
   practice lessons) and their ids, which the upper floors use (upstairs.js). */
(function (root) {
  'use strict';
  var TERMS = {
    "byte-buddies": {
      "lessons": 2,
      "exams": 0,
      "ids": [
        "Using the Internet Browser",
        "Surfing the Web"
      ]
    },
    "word-train": {
      "lessons": 3,
      "exams": 0,
      "ids": [
        "Synonyms and Antonyms",
        "Telling and Asking Sentences",
        "Commanding and Requesting Sentences"
      ]
    },
    "kuwentista": {
      "lessons": 0,
      "exams": 0,
      "ids": []
    },
    "growing-good": {
      "lessons": 3,
      "exams": 0,
      "ids": [
        "We Build Good Relationships",
        "We Care for Public Properties",
        "I Have Patience"
      ]
    },
    "batang-bayani": {
      "lessons": 5,
      "exams": 0,
      "ids": [
        "Ano ang Kultura?",
        "Katangian ng Kultura",
        "Kulturang Materyal",
        "Kulturang Di-Materyal",
        "Laro, Panitikan, at Awit"
      ]
    },
    "block-bot": {
      "lessons": 0,
      "exams": 0,
      "ids": []
    },
    "science-detectives": {
      "lessons": 0,
      "exams": 0,
      "ids": []
    },
    "history-explorers": {
      "lessons": 9,
      "exams": 0,
      "ids": [
        "kolonyalismo",
        "dahilan",
        "magellan",
        "mactan",
        "ekspedisyon",
        "legazpi",
        "puwersangmilitar",
        "tributopolo",
        "bandalagalyon"
      ]
    },
    "net-navigators": {
      "lessons": 5,
      "exams": 0,
      "ids": [
        "wordwindow",
        "worddocs",
        "wordpictures",
        "wordshapes",
        "wordsmartart"
      ]
    },
    "page-turners": {
      "lessons": 5,
      "exams": 0,
      "ids": [
        "actionverbs",
        "linkinghelping",
        "explanation",
        "newsreport",
        "deliveringnews"
      ]
    },
    "wikaharian": {
      "lessons": 4,
      "exams": 0,
      "ids": [
        "mundosalaro",
        "personipikasyon",
        "audio",
        "almanacatlas"
      ]
    },
    "rise-shine": {
      "lessons": 2,
      "exams": 0,
      "ids": [
        "caring",
        "compassion"
      ]
    },
    "math-mastery": {
      "lessons": 5,
      "exams": 0,
      "ids": [
        "decimalsteps",
        "estimateproducts",
        "multiplydecimals",
        "multiplysteps",
        "estimatequotients"
      ]
    },
    "rhythm-hues": {
      "lessons": 5,
      "exams": 0,
      "ids": [
        "vocal-music",
        "epic-chants",
        "precolonial-drama",
        "recorder-technique",
        "recorder-expression"
      ]
    },
    "rally-ready": {
      "lessons": 6,
      "exams": 0,
      "ids": [
        "badminton",
        "badmintonskills",
        "medicine",
        "medicinesafety",
        "gatewaydrugs",
        "gatewayeffects"
      ]
    },
    "life-lab": {
      "lessons": 13,
      "exams": 0,
      "ids": [
        "circulatory",
        "respiratory",
        "digestive",
        "nervous",
        "urinaryendocrine",
        "skeletalmuscular",
        "reproductive",
        "frogsbirds",
        "humanlifecycle",
        "animallifecycles",
        "camouflagemimicry",
        "plantlifecycle",
        "birdlifecycle"
      ]
    },
    "craft-corner": {
      "lessons": 6,
      "exams": 0,
      "ids": [
        "woodbamboo",
        "metals",
        "damages",
        "repairsafety",
        "repairtools",
        "repairmaterials"
      ]
    }
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TERMS;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.TermLessons = TERMS;
})(this);
