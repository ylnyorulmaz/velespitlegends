const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  simulateRace,
  normalizeRoles,
  normalizeTactic,
  createRng,
  validateRaceSegments,
  profileSkill,
  staffTacticBonus,
  raceDifficulty,
  buildSegments,
  assignRaceTimes,
  VALID_TACTICS,
} = require('../../services/raceEngine');
const { ridersTrio, raceFixture } = require('../helpers/fixtures');

function runSim(profile, extras = {}) {
  const race = raceFixture({
    _id: `race-${profile}${extras.seedExtra || ''}`,
    profile,
    ...extras.race,
  });
  const riders = ridersTrio();
  const roles = normalizeRoles(
    ['a', 'b', 'c'],
    extras.roles || { a: 'sprinter', b: 'climber', c: 'domestique' },
  );
  return simulateRace(race, riders, 'Test Team', {
    teamId: 'team1',
    seed: extras.seed || `${race._id}-team1-${race.date}-balanced-${Object.values(roles).sort().join('-')}`,
    tactic: normalizeTactic(extras.tactic || 'balanced'),
    roles,
    rivalSquads: extras.rivalSquads || [],
  });
}

describe('raceEngine', () => {
  it('RNG is deterministic for the same seed', () => {
    const a = createRng('fixed-seed');
    const b = createRng('fixed-seed');
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  it('different seeds diverge', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    assert.notDeepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  it('same seed yields the same winner and segment count', () => {
    const r1 = runSim('flat');
    const r2 = runSim('flat');
    assert.equal(r1.standings[0].name, r2.standings[0].name);
    assert.equal(r1.standings[0].score, r2.standings[0].score);
    assert.equal(r1.segmentLog.length, r2.segmentLog.length);
  });

  it('profileSkill favors specialists', () => {
    const [sprinter, climber] = ridersTrio();
    assert.ok(profileSkill(climber, 'mountain') > profileSkill(sprinter, 'mountain'));
    assert.ok(profileSkill(sprinter, 'flat') > profileSkill(climber, 'flat'));
    const cobbles = { ...sprinter, specialty: 'cobbles', sprint: 70, climb: 70 };
    assert.ok(profileSkill(cobbles, 'classic') > profileSkill(sprinter, 'classic'));
  });

  it('mountain sim: climber beats sprinter among player riders', () => {
    const result = runSim('mountain');
    const players = result.standings.filter((row) => row.isPlayer);
    const climber = players.find((row) => row.name === 'Climber');
    const sprinter = players.find((row) => row.name === 'Sprinter');
    assert.ok(climber.position < sprinter.position);
  });

  it('flat sim: sprinter beats climber among player riders', () => {
    const result = runSim('flat');
    const players = result.standings.filter((row) => row.isPlayer);
    const climber = players.find((row) => row.name === 'Climber');
    const sprinter = players.find((row) => row.name === 'Sprinter');
    assert.ok(sprinter.position < climber.position);
  });

  it('validateRaceSegments checks km sum', () => {
    assert.equal(validateRaceSegments(180, [{ km: 90 }, { km: 90 }]), null);
    assert.match(validateRaceSegments(180, [{ km: 100 }, { km: 50 }]), /must match/);
    assert.equal(validateRaceSegments(180, []), null);
  });

  it('normalizeRoles enforces a single leader and defaults invalid roles', () => {
    const roles = normalizeRoles(['a', 'b', 'c'], { a: 'leader', b: 'leader', c: 'nope' });
    assert.equal(Object.values(roles).filter((r) => r === 'leader').length, 1);
    assert.equal(roles.c, 'domestique');
  });

  it('normalizeTactic falls back to balanced', () => {
    assert.equal(normalizeTactic('attack'), 'attack');
    assert.equal(normalizeTactic('bogus'), 'balanced');
    assert.equal(normalizeTactic(null), 'balanced');
    assert.ok(VALID_TACTICS.includes('sprint_train'));
  });

  it('staffTacticBonus aggregates staff skills', () => {
    assert.equal(staffTacticBonus([]), 0);
    assert.equal(staffTacticBonus(null), 0);
    const bonus = staffTacticBonus([{ skillLevel: 10, experience: 5 }]);
    assert.equal(bonus, 10 * 0.5 + 5 * 0.2);
  });

  it('raceDifficulty scales with prestige and distance', () => {
    const easy = raceDifficulty({ prestige: 50, distance: 100 });
    const hard = raceDifficulty({ prestige: 100, distance: 200 });
    assert.ok(hard > easy);
  });

  it('buildSegments covers full race distance', () => {
    for (const profile of ['flat', 'hilly', 'mountain', 'classic', 'tt']) {
      const race = raceFixture({ profile, distance: 180 });
      const segments = buildSegments(race);
      const total = segments.reduce((sum, s) => sum + s.km, 0);
      assert.equal(total, 180, profile);
    }
  });

  it('buildSegments honors custom segments', () => {
    const race = raceFixture({
      segments: [
        { km: 60, profile: 'flat', label: 'A' },
        { km: 120, profile: 'hilly', label: 'B' },
      ],
    });
    const segments = buildSegments(race);
    assert.equal(segments.length, 2);
    assert.equal(segments[0].label, 'A');
  });

  it('assignRaceTimes sets winner gap 0 and ascending times', () => {
    const standings = [
      { score: 100, dropped: false },
      { score: 90, dropped: false },
      { score: 80, dropped: true },
    ];
    assignRaceTimes(standings, 180);
    assert.equal(standings[0].gapSeconds, 0);
    assert.ok(standings[0].timeSeconds > 0);
    assert.ok(standings[1].gapSeconds > 0);
    assert.ok(standings[2].gapSeconds > standings[1].gapSeconds);
  });

  it('standings include race times and team best times', () => {
    const result = runSim('flat', { seedExtra: '-time' });
    assert.ok(result.standings[0].timeSeconds > 0);
    assert.equal(result.standings[0].gapSeconds, 0);
    assert.ok(result.standings[1].gapSeconds > 0);
    assert.ok(result.teamResults[0].bestTimeSeconds > 0);
  });

  it('multi-team peloton includes rival squad riders', () => {
    const rivalSquads = [{
      teamId: 'rival-team',
      teamName: 'Rival FC',
      tactic: 'attack',
      staffBonus: 2,
      roles: { r1: 'leader', r2: 'domestique', r3: 'domestique' },
      riders: [
        riderLike('r1', 'Rival Ace'),
        riderLike('r2', 'Rival Dom'),
        riderLike('r3', 'Rival Help'),
      ],
    }];
    const result = runSim('hilly', { rivalSquads, seedExtra: '-mt' });
    assert.equal(result.rivalTeamCount, 1);
    assert.ok(result.standings.some((row) => row.name === 'Rival Ace'));
    assert.ok(result.teamResults.some((row) => row.teamName === 'Rival FC'));
    assert.ok(result.narrative.some((line) => /rival/i.test(line)));
  });

  it('points table awards top-10 values', () => {
    const result = runSim('flat', { seedExtra: '-pts' });
    assert.equal(result.standings[0].points, 25);
    assert.equal(result.standings[1].points, 20);
    assert.ok(result.teamPointsEarned >= 0);
  });
});

function riderLike(id, name) {
  return {
    _id: id,
    name,
    sprint: 60,
    climb: 60,
    timeTrial: 60,
    endurance: 65,
    form: 72,
    fatigue: 12,
    teamwork: 60,
    specialty: 'none',
  };
}
