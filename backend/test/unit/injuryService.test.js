const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  computeMarketValue,
  isInjured,
  injuryLabel,
  extractInjuriesFromSegmentLog,
} = require('../../services/injuryService');

describe('injuryService (pure)', () => {
  it('computeMarketValue scales with skills and ages down veterans', () => {
    const young = computeMarketValue({
      sprint: 80, climb: 80, timeTrial: 80, endurance: 80, potential: 80, age: 25,
    });
    const old = computeMarketValue({
      sprint: 80, climb: 80, timeTrial: 80, endurance: 80, potential: 80, age: 35,
    });
    assert.ok(young > 0);
    assert.ok(old < young);
    assert.equal(old, Math.round(young * 0.85));
  });

  it('isInjured requires type and weeksRemaining', () => {
    assert.equal(!!isInjured({ injury: { type: 'none', weeksRemaining: 2 } }), false);
    assert.equal(!!isInjured({ injury: { type: 'crash', weeksRemaining: 0 } }), false);
    assert.equal(!!isInjured({ injury: { type: 'crash', weeksRemaining: 2 } }), true);
    assert.equal(!!isInjured({}), false);
  });

  it('injuryLabel formats crash and illness', () => {
    assert.equal(injuryLabel({ injury: { type: 'crash', weeksRemaining: 3 } }), 'Crash recovery (3w)');
    assert.equal(injuryLabel({ injury: { type: 'illness', weeksRemaining: 1 } }), 'Illness (1w)');
    assert.equal(injuryLabel({ injury: { type: 'none', weeksRemaining: 0 } }), null);
  });

  it('extractInjuriesFromSegmentLog maps crash/illness by rider name once', () => {
    const riders = [
      { _id: 'id1', name: 'Alice' },
      { _id: 'id2', name: 'Bob' },
    ];
    const segmentLog = [{
      randomEvents: [
        { type: 'crash', rider: 'Alice' },
        { type: 'crash', rider: 'Alice' },
        { type: 'illness', rider: 'Bob' },
        { type: 'crash', rider: 'Wild card #3' },
        { type: 'tailwind', rider: 'Alice' },
      ],
    }];
    const injuries = extractInjuriesFromSegmentLog(segmentLog, riders, () => 0);
    assert.equal(injuries.length, 2);
    assert.equal(injuries[0].type, 'crash');
    assert.equal(injuries[0].weeksRemaining, 2);
    assert.equal(injuries[0].cyclist, 'id1');
    assert.equal(injuries[1].type, 'illness');
    assert.equal(injuries[1].weeksRemaining, 1);
  });
});
