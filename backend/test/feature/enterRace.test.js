const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { clearDb } = require('../helpers/mongo');
const { getTestApp } = require('../helpers/app');
const Cyclist = require('../../models/Cyclist');
const Team = require('../../models/Team');
const Race = require('../../models/Race');
const Season = require('../../models/Season');
const RaceResult = require('../../models/RaceResult');

async function seedWorld({ week = 5, injured = false, rostered = true } = {}) {
  await Season.create({
    year: 2026,
    currentWeek: week,
    totalWeeks: 30,
    status: 'active',
  });

  const riders = await Cyclist.insertMany([
    makeRider('Ace', { sprint: 88, climb: 55 }),
    makeRider('Mountain', { sprint: 50, climb: 90 }),
    makeRider('Dom', { sprint: 60, climb: 60, teamwork: 80 }),
  ]);

  if (injured) {
    riders[0].injury = { type: 'crash', weeksRemaining: 2, description: 'hurt' };
    await riders[0].save();
  }

  const team = await Team.create({
    name: 'Player FC',
    budget: 500000,
    roster: rostered ? riders.map((r) => r._id) : [],
  });

  for (const r of riders) {
    r.team = team._id;
    await r.save();
  }

  const race = await Race.create({
    name: 'One Day Cup',
    distance: 180,
    profile: 'hilly',
    prestige: 60,
    seasonWeek: 3,
    date: '2026-03-01',
  });

  return { team, riders, race };
}

function makeRider(name, skills = {}) {
  return {
    name,
    age: 26,
    potential: 75,
    salary: 30000,
    form: 80,
    fatigue: 10,
    specialty: 'none',
    teamwork: 65,
    sprint: 70,
    climb: 70,
    timeTrial: 70,
    endurance: 70,
    ...skills,
  };
}

describe('POST /api/races/:id/enter', () => {
  let app;

  before(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('rejects fewer than 3 riders', async () => {
    const { team, riders, race } = await seedWorld();
    const res = await request(app)
      .post(`/api/races/${race._id}/enter`)
      .send({ teamId: team._id, cyclistIds: [riders[0]._id, riders[1]._id] });
    assert.equal(res.status, 400);
  });

  it('rejects future season week', async () => {
    const { team, riders, race } = await seedWorld({ week: 1 });
    race.seasonWeek = 5;
    await race.save();
    const res = await request(app)
      .post(`/api/races/${race._id}/enter`)
      .send({
        teamId: team._id,
        cyclistIds: riders.map((r) => r._id),
        tactic: 'balanced',
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error || '', /opens in week|Current season week/i);
  });

  it('rejects injured starters', async () => {
    const { team, riders, race } = await seedWorld({ injured: true });
    const res = await request(app)
      .post(`/api/races/${race._id}/enter`)
      .send({
        teamId: team._id,
        cyclistIds: riders.map((r) => r._id),
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error || '', /injur/i);
  });

  it('rejects off-roster riders when roster is set', async () => {
    const { team, riders, race } = await seedWorld({ rostered: true });
    const outsider = await Cyclist.create(makeRider('Outsider'));
    const res = await request(app)
      .post(`/api/races/${race._id}/enter`)
      .send({
        teamId: team._id,
        cyclistIds: [riders[0]._id, riders[1]._id, outsider._id],
      });
    assert.equal(res.status, 400);
    assert.match(res.body.error || '', /roster/i);
  });

  it('simulates race, persists times, points, and completedEntries', async () => {
    const { team, riders, race } = await seedWorld();
    const res = await request(app)
      .post(`/api/races/${race._id}/enter`)
      .send({
        teamId: team._id,
        cyclistIds: riders.map((r) => r._id),
        tactic: 'attack',
        roles: {
          [String(riders[0]._id)]: 'leader',
          [String(riders[1]._id)]: 'climber',
          [String(riders[2]._id)]: 'domestique',
        },
      });

    assert.equal(res.status, 201, res.body.error || JSON.stringify(res.body));
    assert.ok(res.body.standings.length >= 3);
    assert.ok(res.body.standings[0].timeSeconds > 0);
    assert.equal(res.body.standings[0].gapSeconds, 0);
    assert.ok(res.body.segmentLog.length >= 1);
    assert.ok(Array.isArray(res.body.segmentLog[0].randomEvents));

    const stored = await RaceResult.findById(res.body._id).lean();
    assert.ok(stored);
    assert.ok(stored.standings[0].timeSeconds > 0);

    const updatedRace = await Race.findById(race._id).lean();
    assert.ok(updatedRace.completedEntries.some(
      (entry) => String(entry.team) === String(team._id),
    ));

    const refreshedTeam = await Team.findById(team._id).lean();
    assert.ok(refreshedTeam.seasonPoints >= 0);

    const again = await request(app)
      .post(`/api/races/${race._id}/enter`)
      .send({
        teamId: team._id,
        cyclistIds: riders.map((r) => r._id),
      });
    assert.equal(again.status, 400);
  });
});
