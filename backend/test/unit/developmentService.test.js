const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { averageSkill, developRider, SKILL_KEYS } = require('../../services/developmentService');

describe('developmentService', () => {
  it('averageSkill averages the five skills', () => {
    assert.equal(averageSkill({
      sprint: 50, climb: 60, timeTrial: 70, endurance: 80, teamwork: 90,
    }), 70);
  });

  it('youth growth raises the lowest skill under potential', () => {
    const rider = {
      age: 22,
      potential: 90,
      sprint: 40,
      climb: 55,
      timeTrial: 55,
      endurance: 55,
      teamwork: 55,
    };
    const changes = developRider(rider, () => 0.1);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].reason, 'youth_growth');
    assert.equal(changes[0].skill, 'sprint');
    assert.equal(changes[0].delta, 1);
    assert.equal(rider.sprint, 41);
  });

  it('prime growth can fire for mid-twenties with headroom', () => {
    const rider = {
      age: 29,
      potential: 90,
      sprint: 60,
      climb: 60,
      timeTrial: 60,
      endurance: 60,
      teamwork: 60,
    };
    const changes = developRider(rider, () => 0.1);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].reason, 'prime_growth');
    assert.equal(changes[0].delta, 1);
  });

  it('veterans decline their highest skill', () => {
    const rider = {
      age: 35,
      potential: 70,
      sprint: 80,
      climb: 70,
      timeTrial: 70,
      endurance: 70,
      teamwork: 70,
    };
    const changes = developRider(rider, () => 0.1);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].reason, 'age_decline');
    assert.equal(changes[0].skill, 'sprint');
    assert.equal(changes[0].delta, -1);
  });

  it('no change when roll misses thresholds', () => {
    const rider = {
      age: 24,
      potential: 90,
      sprint: 50,
      climb: 50,
      timeTrial: 50,
      endurance: 50,
      teamwork: 50,
    };
    const changes = developRider(rider, () => 0.99);
    assert.equal(changes.length, 0);
  });

  it('no youth growth when skills already at potential', () => {
    const rider = {
      age: 22,
      potential: 60,
      sprint: 60,
      climb: 60,
      timeTrial: 60,
      endurance: 60,
      teamwork: 60,
    };
    const changes = developRider(rider, () => 0.1);
    assert.equal(changes.length, 0);
  });

  it('exports SKILL_KEYS', () => {
    assert.deepEqual(SKILL_KEYS, ['sprint', 'climb', 'timeTrial', 'endurance', 'teamwork']);
  });
});
