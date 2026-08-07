const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createLiveRaceState,
  stepLiveRace,
  finalizeLiveRace,
  normalizeRoles,
  isKeySegment,
  detectDecisionCrisis,
} = require('../../services/raceEngine');
const { ridersTrio, raceFixture } = require('../helpers/fixtures');

function stagedRace() {
  return raceFixture({
    _id: 'sparse-1',
    profile: 'hilly',
    distance: 180,
    segments: [
      { km: 50, profile: 'flat', label: 'Early roads' },
      { km: 50, profile: 'flat', label: 'Valley roads' },
      { km: 80, profile: 'mountain', label: 'Summit finish' },
    ],
  });
}

describe('live race (CM-style)', () => {
  it('starts with intro feed and awaits opening orders', () => {
    const state = createLiveRaceState(stagedRace(), ridersTrio(), 'Manager FC', {
      teamId: 't1',
      tactic: 'balanced',
      roles: normalizeRoles(['a', 'b', 'c'], { b: 'leader' }),
    });
    assert.equal(state.status, 'awaiting_orders');
    assert.equal(state.decision.reason, 'opening');
    assert.ok(state.feed.some((line) => /flag drops|Here we go/i.test(line)));
    assert.ok(state.feed.some((line) => /Team radio/i.test(line)));
  });

  it('isKeySegment marks climbs and finales', () => {
    assert.equal(isKeySegment({ profile: 'flat', km: 40 }, 0, 3), false);
    assert.equal(isKeySegment({ profile: 'mountain', km: 40 }, 1, 3), true);
    assert.equal(isKeySegment({ profile: 'flat', km: 40 }, 2, 3), true);
  });

  it('auto-rolls quiet flats then pauses before the mountain', () => {
    const state = createLiveRaceState(stagedRace(), ridersTrio(), 'Manager FC', {
      teamId: 't1',
      seed: 'sparse-seed-auto',
      tactic: 'balanced',
      roles: normalizeRoles(['a', 'b', 'c'], { b: 'leader' }),
    });

    const burst = stepLiveRace(state, { tactic: 'climb_pace' });
    assert.equal(burst.done, false);
    // Two flats resolved; paused before summit (index 2)
    assert.equal(state.segmentIndex, 2);
    assert.equal(state.segmentLog.length, 2);
    assert.equal(state.tactic, 'climb_pace');
    assert.ok(['climb', 'finale', 'long_sector'].includes(state.decision.reason));
    assert.ok(state.feed.some((line) => /quieter kilometres|Summit finish|Climb pace|climb pace/i.test(line)));
    assert.ok(burst.standingsPreview.length > 0);
  });

  it('detectDecisionCrisis flags player crash events', () => {
    const crisis = detectDecisionCrisis(
      {
        randomEvents: [{ type: 'crash', isPlayer: true, rider: 'Sprinter' }],
        events: [],
      },
      [
        {
          name: 'Sprinter', isPlayer: true, cumulativeScore: 10, dropped: false, teamName: 'X',
        },
      ],
      'Manager FC',
    );
    assert.equal(crisis.reason, 'crisis_crash');
  });

  it('finalize produces standings times and narrative without getting stuck', () => {
    const race = raceFixture({ _id: 'live-2', profile: 'flat' });
    const state = createLiveRaceState(race, ridersTrio(), 'Manager FC', {
      teamId: 't1',
      seed: 'live-seed-2',
      tactic: 'sprint_train',
      roles: normalizeRoles(['a', 'b', 'c'], { a: 'sprinter' }),
    });
    const result = finalizeLiveRace(state);
    assert.ok(result.standings[0].timeSeconds > 0);
    assert.ok(result.segmentLog.length >= 1);
    assert.ok(result.narrative.some((line) => /wins/i.test(line)));
    assert.equal(result.tactic, 'sprint_train');
  });
});
