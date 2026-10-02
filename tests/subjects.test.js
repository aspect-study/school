const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile, lobbyFile } = require('./paths.js');
const { SUBJECTS } = require(engineFile('subjects.js'));

for (const grade of [5, 2]) {
  test('the parent page lists the same Grade ' + grade + ' subjects as the lobby cards', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    const cards = [...html.matchAll(/data-app="([^"]+)"[\s\S]*?subject-title">([^<]+)<[\s\S]*?data-points-key="([^"]+)"/g)]
      .map((m) => ({ app: m[1], title: m[2].replace(/&amp;/g, '&'), pointsKey: m[3] }));
    assert.deepEqual(SUBJECTS[grade], cards);
  });
}
