const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { clearDb } = require('../helpers/mongo');
const { getTestApp } = require('../helpers/app');
const Cyclist = require('../../models/Cyclist');
const Team = require('../../models/Team');
const Race = require('../../models/Race');
const { buildRivalSquads } = require('../../services/pelotonService');

async function makeTeam(name, { injured = false } = {}) {
  const riders = await Cyclist.insertMany([
    { name: `${name} 1`, sprint: 70, climb: 70, timeTrial: 70, endurance: 70, form: 75 },
    { name: `${name} 2`, sprint: 65, climb: 65, timeTrial: 65, endurance: 65, form: 72 },
    { name: `${name} 3`, sprint: 60, climb: 60, timeTrial: 60, endurance: 60, form: 70 },
  ]);
  if (injured) {
    riders[0].injury = { type: 'crash', weeksRemaining: 2, description: 'x' };
    riders[1].injury = { type: 'illness', weeksRemaining: 1, description: 'y' };
    await riders[0].save();
    await riders[1].save();
  }
  const team = await Team.create({
    name,
    budget: 100000,
    roster: riders.map((r) => r._id),
  });
  for (const r of riders) {
    r.team = team._id;
    await r.save();
  }
  return team;
}

describe('rival squads', () => {
  let app;

  before(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('buildRivalSquads excludes player and completed teams and skips thin/injured rosters', async () => {
    const player = await makeTeam('Player');
    const rival = await makeTeam('Rival Good');
    const injuredTeam = await makeTeam('Rival Hurt', { injured: true });
    const done = await makeTeam('Already Done');
    const race = await Race.create({
      name: 'Peloton Cup',
      distance: 180,
      profile: 'mountain',
      prestige: 70,
      seasonWeek: 2,
    });

    const squads = await buildRivalSquads({
      playerTeamId: player._id,
      race,
      completedTeamIds: [done._id],
      maxTeams: 5,
      ridersPerTeam: 6,
    });

    const names = squads.map((s) => s.teamName);
    assert.ok(names.includes('Rival Good'));
    assert.ok(!names.includes('Player'));
    assert.ok(!names.includes('Already Done'));
    assert.ok(!names.includes('Rival Hurt'));
    assert.equal(squads[0].tactic, 'climb_pace');
    assert.ok(Object.values(squads[0].roles).includes('leader'));
  });

  it('GET /api/races/:id/rivals requires teamId', async () => {
    const player = await makeTeam('HTTP Player');
    await makeTeam('HTTP Rival');
    const race = await Race.create({
      name: 'Rivals API',
      distance: 160,
      profile: 'flat',
      prestige: 50,
      seasonWeek: 1,
    });

    const missing = await request(app).get(`/api/races/${race._id}/rivals`);
    assert.equal(missing.status, 400);

    const res = await request(app).get(`/api/races/${race._id}/rivals?teamId=${player._id}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.rivals));
    assert.ok(res.body.rivalTeamCount >= 1);
  });
});
