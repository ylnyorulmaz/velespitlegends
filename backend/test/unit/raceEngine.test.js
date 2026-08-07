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
  AI_ORDERS_FACTOR,
  tacticSegmentBonus,
  roleSegmentBonus,
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

  it('assignRaceTimes legacy score path sets winner gap 0', () => {
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

  it('assignRaceTimes uses accumulated segment race times', () => {
    const standings = [
      { name: 'A', cyclist: 'a', score: 50, isPlayer: true },
      { name: 'B', cyclist: 'b', score: 80, isPlayer: true },
    ];
    const competitors = [
      { name: 'A', cyclist: 'a', isPlayer: true, raceTimeSeconds: 10000 },
      { name: 'B', cyclist: 'b', isPlayer: true, raceTimeSeconds: 9800 },
    ];
    assignRaceTimes(standings, 180, competitors);
    assert.equal(standings[0].name, 'B');
    assert.equal(standings[0].timeSeconds, 9800);
    assert.equal(standings[0].gapSeconds, 0);
    assert.equal(standings[1].gapSeconds, 200);
    assert.equal(standings[0].points, 25);
  });

  it('AI receives weakened tactic/role bonuses', () => {
    assert.ok(AI_ORDERS_FACTOR > 0 && AI_ORDERS_FACTOR < 1);
    const player = {
      isPlayer: true, climb: 90, sprint: 50, teamwork: 70, specialty: 'none', role: 'climber',
    };
    const ai = {
      isPlayer: false, climb: 90, sprint: 50, teamwork: 70, specialty: 'none', role: 'climber',
      teamId: 'ai1',
    };
    const ctx = {
      segmentMeta: { isLastSegment: false },
      activeCompetitors: [
        ai,
        { isPlayer: false, role: 'domestique', teamId: 'ai1', dropped: false },
        { isPlayer: false, role: 'leader', teamId: 'ai1', dropped: false },
      ],
    };
    const playerTactic = tacticSegmentBonus(player, 'mountain', 'climb_pace', {});
    const aiTactic = tacticSegmentBonus(ai, 'mountain', 'climb_pace', {});
    assert.ok(playerTactic > 0);
    assert.ok(aiTactic > 0);
    assert.ok(Math.abs(aiTactic - playerTactic * AI_ORDERS_FACTOR) < 0.001);

    const playerRole = roleSegmentBonus(player, 'mountain', ctx);
    const aiRole = roleSegmentBonus(ai, 'mountain', ctx);
    assert.ok(playerRole > 0);
    assert.ok(aiRole > 0);
    assert.ok(aiRole < playerRole);
  });

  it('standings include race times and team best times', () => {
    const result = runSim('flat', { seedExtra: '-time' });
    assert.ok(result.standings[0].timeSeconds > 0);
    assert.equal(result.standings[0].gapSeconds, 0);
    assert.ok(result.standings[1].gapSeconds > 0);
    assert.ok(result.standings[1].timeSeconds > result.standings[0].timeSeconds);
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
