/* Made by tools/update-precache.js; do not edit. Each game's Term 2 lessons: how many (exams = summative
   practice lessons) and their ids, which the upper floors use (upstairs.js). */
(function (root) {
  'use strict';
  var TERMS = {
    "byte-buddies": {
      "lessons": 5,
      "exams": 0,
      "ids": [
        "Using the Internet Browser",
        "Surfing the Web",
        "Using Hyperlinks",
        "Searching Online",
        "Staying Safe Online"
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
      "lessons": 6,
      "exams": 0,
      "ids": [
        "tagpuan",
        "tambalan",
        "impormatibo",
        "wasto",
        "pananalita",
        "lansakan"
      ]
    },
    "growing-good": {
      "lessons": 7,
      "exams": 0,
      "ids": [
        "We Build Good Relationships",
        "We Care for Public Properties",
        "I Have Patience",
        "I Am Honest",
        "Review for ST #1",
        "I Am Clean and Orderly",
        "I Believe"
      ]
    },
    "batang-bayani": {
      "lessons": 9,
      "exams": 0,
      "ids": [
        "Ano ang Kultura?",
        "Katangian ng Kultura",
        "Kulturang Materyal",
        "Kulturang Di-Materyal",
        "Laro, Panitikan, at Awit",
        "Mga Pagdiriwang sa Ating Bansa",
        "Katutubong Pamayanan",
        "Katutubong Pamayanan sa Luzon",
        "Katutubong Pamayanan sa Visayas at Mindanao"
      ]
    },
    "block-bot": {
      "lessons": 9,
      "exams": 0,
      "ids": [
        "circles",
        "composite",
        "subnumberline",
        "subnoregroup",
        "subregroup",
        "subwordproblems",
        "meters",
        "centimeters",
        "patterns"
      ]
    },
    "science-detectives": {
      "lessons": 7,
      "exams": 0,
      "ids": [
        "A Part of Me: Discovering Plants and Their Parts",
        "Everybody Needs Plants",
        "Plants Need Us Too",
        "Finding Out About Living Things and Their Interactions",
        "I Am a Responsible Living Thing",
        "Review for ST #1: Plants",
        "Yes, I Can See the Difference!"
      ]
    },
    "history-explorers": {
      "lessons": 15,
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
        "bandalagalyon",
        "pampolitika",
        "anyosining",
        "kababaihan",
        "kasarian",
        "pagtugonpueblo",
        "pagtugonmuslim"
      ]
    },
    "net-navigators": {
      "lessons": 12,
      "exams": 0,
      "ids": [
        "wordwindow",
        "worddocs",
        "wordpictures",
        "wordshapes",
        "wordsmartart",
        "wordcharts",
        "wordtables",
        "flyersposters",
        "createprint",
        "pptwindow",
        "pptslides",
        "pptsmartart"
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
      "lessons": 8,
      "exams": 0,
      "ids": [
        "mundosalaro",
        "personipikasyon",
        "audio",
        "almanacatlas",
        "kondisyunal",
        "pokuslayon",
        "reynadanaya",
        "elementomultimedia"
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
      "lessons": 6,
      "exams": 0,
      "ids": [
        "decimalsteps",
        "estimateproducts",
        "multiplydecimals",
        "multiplysteps",
        "estimatequotients",
        "gmdasfracdec"
      ]
    },
    "rhythm-hues": {
      "lessons": 8,
      "exams": 0,
      "ids": [
        "vocal-music",
        "epic-chants",
        "precolonial-drama",
        "recorder-technique",
        "recorder-expression",
        "art-mediums",
        "okir-patterns",
        "art-techniques"
      ]
    },
    "rally-ready": {
      "lessons": 8,
      "exams": 0,
      "ids": [
        "badminton",
        "badmintonskills",
        "medicine",
        "medicinesafety",
        "gatewaydrugs",
        "gatewayeffects",
        "polka",
        "dancesteps"
      ]
    },
    "life-lab": {
      "lessons": 14,
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
        "birdlifecycle",
        "st1review"
      ]
    },
    "craft-corner": {
      "lessons": 7,
      "exams": 0,
      "ids": [
        "woodbamboo",
        "metals",
        "damages",
        "repairsafety",
        "repairtools",
        "repairmaterials",
        "servicecost"
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
