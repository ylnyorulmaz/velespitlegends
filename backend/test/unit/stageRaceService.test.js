const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formatRaceTime,
  formatGapSeconds,
  decorateGcStandings,
} = require('../../services/stageRaceService');

describe('stageRaceService (pure)', () => {
  it('formatRaceTime renders m:ss and h:mm:ss', () => {
    assert.equal(formatRaceTime(125), '2:05');
    assert.equal(formatRaceTime(3661), '1:01:01');
    assert.equal(formatRaceTime(-5), '0:00');
  });

  it('formatGapSeconds prefixes +', () => {
    assert.equal(formatGapSeconds(12), '+12s');
    assert.equal(formatGapSeconds(75), '+1:15');
    assert.equal(formatGapSeconds(3661), '+1:01:01');
  });

  it('decorateGcStandings adds leader gap labels', () => {
    const rows = decorateGcStandings([
      { team: 't1', totalTimeSeconds: 10000, stageWins: 1 },
      { team: 't2', totalTimeSeconds: 10045, stageWins: 0 },
    ]);
    assert.equal(rows[0].gcGapSeconds, 0);
    assert.equal(rows[0].gcGapLabel, '');
    assert.equal(rows[1].gcGapSeconds, 45);
    assert.equal(rows[1].gcGapLabel, '+45s');
    assert.ok(rows[0].gcTimeLabel);
  });

  it('decorateGcStandings handles empty input', () => {
    assert.deepEqual(decorateGcStandings([]), []);
    assert.deepEqual(decorateGcStandings(null), []);
  });
});
