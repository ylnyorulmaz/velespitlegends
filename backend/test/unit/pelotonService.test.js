const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sortByRaceFitness,
  autoRolesForSquad,
  summarizeTeamResults,
} = require('../../services/pelotonService');

describe('pelotonService (pure)', () => {
  it('sortByRaceFitness ranks climbers first on mountain', () => {
    const riders = [
      { _id: 's', sprint: 90, climb: 40, timeTrial: 50, endurance: 70, specialty: 'none' },
      { _id: 'c', sprint: 40, climb: 95, timeTrial: 50, endurance: 70, specialty: 'none' },
    ];
    const ranked = sortByRaceFitness(riders, 'mountain');
    assert.equal(ranked[0]._id, 'c');
  });

  it('autoRolesForSquad assigns one leader and profile roles', () => {
    const riders = [
      { _id: '1', sprint: 90, climb: 40, timeTrial: 50, endurance: 70, specialty: 'none' },
      { _id: '2', sprint: 80, climb: 50, timeTrial: 50, endurance: 70, specialty: 'none' },
      { _id: '3', sprint: 40, climb: 40, timeTrial: 50, endurance: 70, specialty: 'none' },
    ];
    const roles = autoRolesForSquad(riders, 'flat');
    assert.equal(Object.values(roles).filter((r) => r === 'leader').length, 1);
    assert.equal(roles['1'], 'leader');
  });

  it('summarizeTeamResults aggregates points and skips field fillers', () => {
    const summary = summarizeTeamResults([
      { position: 1, points: 25, teamId: 't1', teamName: 'A', isPlayer: true },
      { position: 2, points: 20, teamId: 't2', teamName: 'B', isPlayer: false },
      { position: 3, points: 16, teamId: 't1', teamName: 'A', isPlayer: true },
      { position: 4, points: 14, name: 'Wild', isPlayer: false },
    ]);
    assert.equal(summary.length, 2);
    assert.equal(summary[0].teamId, 't1');
    assert.equal(summary[0].points, 41);
    assert.equal(summary[0].bestPosition, 1);
  });
});
