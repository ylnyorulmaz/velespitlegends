/* eslint-disable no-console */
/**
 * Deterministic smoke tests for raceEngine — no DB, no Jest.
 * Run: npm test --prefix backend
 */
const assert = require('assert');
const {
  simulateRace,
  normalizeRoles,
  normalizeTactic,
  createRng,
  validateRaceSegments,
  profileSkill,
} = require('../services/raceEngine');
const { developRider } = require('../services/developmentService');
const { weeklyWage } = require('../services/seasonService');

function ridersFixture() {
  return [
    {
      _id: 'a', name: 'Sprinter', sprint: 90, climb: 40, timeTrial: 50, endurance: 70,
      form: 80, fatigue: 10, teamwork: 60, specialty: 'leadout', age: 26, potential: 75,
    },
    {
      _id: 'b', name: 'Climber', sprint: 40, climb: 92, timeTrial: 55, endurance: 75,
      form: 80, fatigue: 10, teamwork: 60, specialty: 'none', age: 27, potential: 80,
    },
    {
      _id: 'c', name: 'Helper', sprint: 55, climb: 55, timeTrial: 55, endurance: 70,
      form: 75, fatigue: 12, teamwork: 70, specialty: 'none', age: 29, potential: 60,
    },
  ];
}

function runSim(profile, seedExtra = '') {
  const race = {
    _id: `race-${profile}${seedExtra}`,
    name: `${profile} test`,
    distance: 180,
    profile,
    prestige: 70,
    date: '2026-01-01',
  };
  const riders = ridersFixture();
  const roles = normalizeRoles(['a', 'b', 'c'], { a: 'sprinter', b: 'climber', c: 'domestique' });
  return simulateRace(race, riders, 'Test Team', {
    teamId: 'team1',
    seed: `${race._id}-team1-${race.date}-balanced-${Object.values(roles).sort().join('-')}`,
    tactic: normalizeTactic('balanced'),
    roles,
  });
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('raceEngine / season smoke tests\n');

test('RNG is deterministic for same seed', () => {
  const a = createRng('fixed-seed');
  const b = createRng('fixed-seed');
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepStrictEqual(seqA, seqB);
});

test('same seed → same winner', () => {
  const r1 = runSim('flat');
  const r2 = runSim('flat');
  assert.strictEqual(r1.standings[0].name, r2.standings[0].name);
  assert.strictEqual(r1.standings[0].score, r2.standings[0].score);
  assert.strictEqual(r1.segmentLog.length, r2.segmentLog.length);
});

test('climber outskills sprinter on mountain profileSkill', () => {
  const [sprinter, climber] = ridersFixture();
  assert.ok(profileSkill(climber, 'mountain') > profileSkill(sprinter, 'mountain'));
  assert.ok(profileSkill(sprinter, 'flat') > profileSkill(climber, 'flat'));
});

test('mountain sim: climber beats sprinter among player riders', () => {
  const result = runSim('mountain');
  const players = result.standings.filter((row) => row.isPlayer);
  const climber = players.find((row) => row.name === 'Climber');
  const sprinter = players.find((row) => row.name === 'Sprinter');
  assert.ok(climber && sprinter, 'player riders present');
  assert.ok(climber.position < sprinter.position, `expected Climber ahead, got C${climber.position} S${sprinter.position}`);
});

test('flat sim: sprinter beats climber among player riders', () => {
  const result = runSim('flat');
  const players = result.standings.filter((row) => row.isPlayer);
  const climber = players.find((row) => row.name === 'Climber');
  const sprinter = players.find((row) => row.name === 'Sprinter');
  assert.ok(sprinter.position < climber.position, `expected Sprinter ahead, got S${sprinter.position} C${climber.position}`);
});

test('segment km validation', () => {
  assert.strictEqual(validateRaceSegments(180, [{ km: 90 }, { km: 90 }]), null);
  assert.ok(validateRaceSegments(180, [{ km: 100 }, { km: 50 }]));
});

test('normalizeRoles enforces single leader', () => {
  const roles = normalizeRoles(['a', 'b', 'c'], { a: 'leader', b: 'leader', c: 'sprinter' });
  const leaders = Object.values(roles).filter((r) => r === 'leader');
  assert.strictEqual(leaders.length, 1);
});

test('weeklyWage slices season salary', () => {
  assert.strictEqual(weeklyWage(30000, 30), 1000);
  assert.strictEqual(weeklyWage(0, 30), 0);
});

test('young high-potential rider can grow', () => {
  const rider = {
    age: 22,
    potential: 90,
    sprint: 50,
    climb: 50,
    timeTrial: 50,
    endurance: 50,
    teamwork: 50,
  };
  let grew = false;
  for (let i = 0; i < 40; i += 1) {
    const clone = { ...rider };
    const changes = developRider(clone, () => 0.1);
    if (changes.some((c) => c.delta > 0)) {
      grew = true;
      break;
    }
  }
  assert.ok(grew, 'expected at least one growth over forced rolls');
});

test('veteran can decline', () => {
  const rider = {
    age: 35,
    potential: 70,
    sprint: 80,
    climb: 80,
    timeTrial: 80,
    endurance: 80,
    teamwork: 80,
  };
  const changes = developRider({ ...rider }, () => 0.1);
  assert.ok(changes.length && changes[0].delta < 0, 'expected decline');
});

test('standings include race times and gaps', () => {
  const result = runSim('flat', '-time');
  assert.ok(result.standings[0].timeSeconds > 0);
  assert.strictEqual(result.standings[0].gapSeconds, 0);
  assert.ok(result.standings[1].gapSeconds > 0);
  assert.ok(result.standings[1].timeSeconds > result.standings[0].timeSeconds);
  assert.ok(result.teamResults[0].bestTimeSeconds > 0);
});

test('multi-team peloton includes rival squad riders', () => {
  const race = {
    _id: 'mt1', name: 'Multi', distance: 180, profile: 'hilly', prestige: 60, date: '2026-02-01',
  };
  const riders = ridersFixture();
  const rivalSquads = [{
    teamId: 'rival-team',
    teamName: 'Rival FC',
    tactic: 'attack',
    staffBonus: 2,
    roles: { r1: 'leader', r2: 'domestique', r3: 'domestique' },
    riders: [
      {
        _id: 'r1', name: 'Rival Ace', sprint: 70, climb: 70, timeTrial: 70, endurance: 70,
        form: 75, fatigue: 10, teamwork: 60, specialty: 'none',
      },
      {
        _id: 'r2', name: 'Rival Dom', sprint: 55, climb: 55, timeTrial: 55, endurance: 60,
        form: 70, fatigue: 15, teamwork: 65, specialty: 'none',
      },
      {
        _id: 'r3', name: 'Rival Help', sprint: 50, climb: 60, timeTrial: 50, endurance: 65,
        form: 72, fatigue: 12, teamwork: 60, specialty: 'none',
      },
    ],
  }];
  const result = simulateRace(race, riders, 'Player FC', {
    teamId: 'player-team',
    tactic: 'balanced',
    roles: normalizeRoles(['a', 'b', 'c'], { b: 'leader' }),
    rivalSquads,
  });
  assert.strictEqual(result.rivalTeamCount, 1);
  assert.ok(result.standings.some((row) => row.name === 'Rival Ace'));
  assert.ok(result.standings.some((row) => row.teamName === 'Rival FC'));
  assert.ok(result.teamResults.some((row) => row.teamName === 'Rival FC'));
  assert.ok(result.teamResults.some((row) => row.isPlayer));
  assert.ok(result.narrative.some((line) => line.includes('rival team')));
});

console.log(`\n${passed} tests passed`);
if (process.exitCode) {
  console.error('FAILED');
  process.exit(1);
}
console.log('OK');
