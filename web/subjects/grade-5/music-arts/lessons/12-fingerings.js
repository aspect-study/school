(function () {
  // Draws a fingering chart like the deck's: thumb hole 0 apart at the top, front holes 1-7 below; filled = covered.
  function chart(covered) {
    let holes = '';
    for (let i = 1; i <= 7; i++) {
      const y = 52 + (i - 1) * 22;
      holes += '<circle cx="70" cy="' + y + '" r="7" fill="' + (i <= covered ? '#2B2B2B' : '#fff') + '" stroke="#2B2B2B" stroke-width="2"/>' +
        '<text x="96" y="' + (y + 4) + '" font-size="11" fill="#2B2B2B" font-family="sans-serif">' + i + '</text>';
    }
    const label = 'Fingering chart: thumb hole covered, ' + (covered ? 'front holes 1 to ' + covered + ' covered' : 'all front holes open');
    return '<svg class="fingering" viewBox="0 0 120 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + label + '">' +
      '<rect x="4" y="4" width="112" height="212" rx="12" fill="#FFF8EC" stroke="#E2D3B8"/>' +
      '<path d="M58 12 h24 l-3 18 h-18 z" fill="#E9D8B4" stroke="#8A6D3B" stroke-width="1.5"/>' +
      '<rect x="58" y="30" width="24" height="170" rx="6" fill="#E9D8B4" stroke="#8A6D3B" stroke-width="1.5"/>' +
      '<circle cx="28" cy="52" r="7" fill="#2B2B2B" stroke="#2B2B2B" stroke-width="2"/>' +
      '<text x="28" y="74" font-size="10" text-anchor="middle" fill="#2B2B2B" font-family="sans-serif">0 back</text>' +
      holes + '</svg>';
  }

  StudyKit.lesson({
    id: 'fingerings',
    icon: '🎵',
    title: 'Playing Low C to High C',
    subtitle: 'Fingerings, sounds & note sequences',
    cards: [
      { front: 'The Pattern', back: 'The <b>thumb hole (0) stays covered</b> for every note from low C to high C. Going up the scale, you <b>open one more front hole from the bottom</b> each time.' },
      { front: 'DO = Low C', back: chart(7) + 'Thumb hole + <b>all seven front holes</b> covered. Every hole is completely covered. Sound: <b>low, warm and clear</b>.' },
      { front: 'RE = D', back: chart(6) + 'Thumb hole + the <b>top six</b> front holes covered. The lowest front hole is open. Sound: low, clear and warm, <b>higher than low C</b>.' },
      { front: 'MI = E', back: chart(5) + 'Thumb hole + the <b>top five</b> front holes covered. The two lower front holes are open. Sound: clear, bright middle-range pitch, <b>higher than D</b>.' },
      { front: 'FA = F', back: chart(4) + 'Thumb hole (0) + the <b>top four</b> front holes (1&ndash;4) covered. The bottom three (5&ndash;7) are open. Sound: clear, bright, <b>higher than E</b>.' },
      { front: 'SOL = G', back: chart(3) + 'Thumb hole + the <b>top three</b> front holes covered. The other four front holes are open. Sound: <b>mellow, warm and smooth</b>; G is lower than A.' },
      { front: 'LA = A', back: chart(2) + 'Thumb hole (0) + the <b>top two</b> front holes (1 &amp; 2) covered. Holes 3&ndash;7 are open. Sound: clear, warm, slightly lower than B.' },
      { front: 'TI = B', back: chart(1) + 'Thumb hole (0) + the <b>top front hole (1)</b> covered. Holes 2&ndash;7 are open. Sound: clear, bright, <b>higher than A</b>.' },
      { front: 'DO = High C', back: chart(0) + 'Cover <b>only the thumb hole (0)</b>. All seven front holes are open. Use <b>faster, controlled airflow</b> without blowing too forcefully. Sound: <b>high, bright and clear</b>.' },
      { front: 'Practice Sequences', back: '<b>Sequence 1:</b> C (low) &rarr; D &rarr; E &mdash; keep your breath steady and even.<br><b>Sequence 2:</b> F &rarr; G &rarr; A &mdash; lift fingers smoothly, no gaps in sound.<br><b>Sequence 3:</b> B &rarr; C &rarr; A &mdash; practice slowly first, then faster.' },
      { front: 'Note Sequence: B, A, G', back: 'The deck&rsquo;s practice lines use only <b>TI (B), LA (A) and SOL (G)</b>:<br>B-A-G-A &nbsp; B-B-B &nbsp; A-A-A &nbsp; B-B-B<br>B-A-G-A &nbsp; B-B-B &nbsp; A-A-B-A &nbsp; G-G-G<br>Then play &ldquo;Mary Had a Little Lamb.&rdquo;' },
      { front: '🔑 How to Answer', tip: true, back: 'Count the covered FRONT holes: <b>7 = low C, 6 = D, 5 = E, 4 = F, 3 = G, 2 = A, 1 = B, 0 = high C</b>. The thumb hole is covered for all of them.' }
    ],
    quiz: [
      { q: 'Which note does this fingering play?', art: chart(7), options: ['Low C (DO)', 'D (RE)', 'High C (DO)', 'G (SOL)'], correct: 0, explain: 'All seven front holes and the thumb hole are covered: that is low C (DO).', why: ['', 'D leaves the lowest front hole open. Here every hole is covered.', 'High C covers ONLY the thumb hole. Here every hole is covered.', 'G covers only the top three front holes.'], tip: 'Every hole covered = the lowest note, low C.' },
      { q: 'Which note does this fingering play?', art: chart(5), options: ['D (RE)', 'E (MI)', 'F (FA)', 'A (LA)'], correct: 1, explain: 'Thumb hole + the top five front holes covered: that is E (MI).', why: ['D covers SIX front holes. Here only five are covered.', '', 'F covers FOUR front holes. Here five are covered.', 'A covers only TWO front holes.'], tip: '5 covered front holes = E. Count: 7 C, 6 D, 5 E.' },
      { q: 'Which note does this fingering play?', art: chart(3), options: ['F (FA)', 'A (LA)', 'G (SOL)', 'B (TI)'], correct: 2, explain: 'Thumb hole + the top three front holes covered: that is G (SOL).', why: ['F covers FOUR front holes. Here only three are covered.', 'A covers TWO front holes. Here three are covered.', '', 'B covers only ONE front hole.'], tip: '3 covered front holes = G.' },
      { q: 'Which note does this fingering play?', art: chart(1), options: ['A (LA)', 'B (TI)', 'High C (DO)', 'G (SOL)'], correct: 1, explain: 'Thumb hole + only the top front hole (1) covered: that is B (TI).', why: ['A covers TWO front holes. Here only hole 1 is covered.', '', 'High C covers NO front holes, only the thumb hole. Here hole 1 is covered too.', 'G covers THREE front holes.'], tip: '1 covered front hole = B (TI).' },
      { q: 'Which note does this fingering play?', art: chart(0), options: ['Low C (DO)', 'B (TI)', 'High C (DO)', 'E (MI)'], correct: 2, explain: 'Only the thumb hole is covered and all seven front holes are open: that is high C (DO).', why: ['Low C covers ALL the holes. Here all front holes are open.', 'B covers the thumb hole AND hole 1. Here hole 1 is open.', '', 'E covers five front holes.'], tip: 'Only the thumb = high C. All the holes = low C.' },
      { q: 'Which note uses all holes covered?', options: ['High C', 'Low C', 'G', 'B'], correct: 1, explain: 'Low C: thumb hole covered + all seven front holes covered.', why: ['High C covers only the thumb hole.', '', 'G covers the thumb and the top three front holes.', 'B covers the thumb and only hole 1.'], tip: 'All holes covered = the lowest note = low C.' },
      { q: 'How do you play high C (DO)?', options: ['Cover all eight holes', 'Cover only the thumb hole and keep all seven front holes open', 'Cover only hole 7', 'Cover the thumb hole and the top four front holes, then blow very hard'], correct: 1, explain: 'For high C, cover only the thumb hole (0) and keep all seven front holes (1&ndash;7) open, with faster, controlled airflow.', why: ['Covering all the holes plays LOW C.', '', 'The thumb hole must stay covered. The deck never uses hole 7 alone.', 'The top four front holes (with the thumb) play F.'], tip: 'High C = thumb only.' },
      { q: 'To play A (LA), which holes do you cover?', options: ['The thumb hole and the top two front holes', 'The thumb hole and the top four front holes', 'Only the thumb hole', 'All seven front holes'], correct: 0, explain: 'For A, cover the thumb hole (0) and the top two front holes (1 &amp; 2). Keep holes 3&ndash;7 open.', why: ['', 'The thumb and the top four front holes play F.', 'Only the thumb hole plays high C.', 'All seven front holes (with the thumb) play low C.'], tip: 'LA = 2 front holes. Going down from B (1 hole), add one finger.' },
      { q: 'As you go UP the scale from low C to high C, what changes?', options: ['You open one more front hole from the bottom each time', 'You cover one more hole each time', 'You uncover the thumb hole first', 'Nothing changes at all; you just blow harder and harder for each note'], correct: 0, explain: 'Low C covers all seven front holes, D six, E five, F four, G three, A two, B one, and high C none. One more hole opens from the bottom each step.', why: ['', 'It is the opposite: going UP, you uncover holes.', 'The thumb hole stays covered for all of these notes.', 'Each note has its own fingering; the finger holes change.'], tip: 'Higher note = more open holes.' },
      { q: 'How should you blow to play high C?', options: ['Faster, controlled airflow without blowing too forcefully', 'As hard as you can', 'Very weakly and slowly, with almost no air coming out of your mouth', 'Through your nose'], correct: 0, explain: 'For high C, use faster, controlled airflow without blowing too forcefully.', why: ['', 'The deck warns not to blow too forcefully.', 'You need faster air for a high note, not almost no air.', 'The recorder is played with the mouth (the beak).'], tip: 'Higher note = a little faster air, but still controlled.' },
      { q: 'Which notes make up Practice Sequence 2?', options: ['C, D, E', 'F, G, A', 'B, C, A', 'G, G, G'], correct: 1, explain: 'Sequence 1 is C &ndash; D &ndash; E, Sequence 2 is F &ndash; G &ndash; A, and Sequence 3 is B &ndash; C &ndash; A.', why: ['C, D, E is Sequence 1.', '', 'B, C, A is Sequence 3.', 'G-G-G is the last line of the note sequence practice, not Sequence 2.'], tip: 'The sequences climb the scale: 1 = C D E, 2 = F G A, 3 = B C A.' },
      { q: 'The note sequence practice lines (B-A-G-A, B-B-B, A-A-A&hellip;) use which three notes?', options: ['C, D, E', 'B, A, G', 'F, G, A', 'D, E, F'], correct: 1, explain: 'The practice lines use only TI (B), LA (A) and SOL (G), the notes for &ldquo;Mary Had a Little Lamb.&rdquo;', why: ['C, D, E is Practice Sequence 1, not these lines.', '', 'F, G, A is Practice Sequence 2. These lines have no F.', 'D, E, F are not in these lines.'], tip: 'B-A-G: three neighbors going down from TI.' },
      { q: 'True or False: E (MI) is higher than D (RE).', options: ['True', 'False'], correct: 0, explain: 'True. The deck says E produces a clear, bright middle-range pitch that is higher than D.', why: ['', 'False is not right. Going up the scale, MI comes after RE, so E is higher than D.'], tip: 'Do, re, MI: each step up the scale is higher.' },
      { q: 'True or False: To play G (SOL), cover the thumb hole and all seven front holes.', options: ['True', 'False'], correct: 1, explain: 'False. G covers the thumb hole and only the top THREE front holes. Covering all seven plays low C.', why: ['True is not right. Covering every hole plays low C, not G.', ''], tip: 'G = 3 front holes.' }
    ]
  });
})();
