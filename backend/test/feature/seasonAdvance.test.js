const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { clearDb } = require('../helpers/mongo');
const { getTestApp } = require('../helpers/app');
const Cyclist = require('../../models/Cyclist');
const Team = require('../../models/Team');
const Season = require('../../models/Season');
const {
  advanceSeasonWeek,
  runWeeklyPayroll,
  getSeasonSummary,
} = require('../../services/seasonService');
const { applyInjuries, tickInjuryRecovery, isInjured } = require('../../services/injuryService');

describe('season advance + summary', () => {
  let app;

  before(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('runWeeklyPayroll deducts wages and applies insolvency form hit', async () => {
    const rider = await Cyclist.create({
      name: 'Paid',
      salary: 30000,
      form: 70,
      sprint: 60,
      climb: 60,
      timeTrial: 60,
      endurance: 60,
    });
    const team = await Team.create({
      name: 'Broke FC',
      budget: 100,
      roster: [rider._id],
    });
    rider.team = team._id;
    await rider.save();

    const payroll = await runWeeklyPayroll(30);
    const refreshed = await Team.findById(team._id);
    const riderAfter = await Cyclist.findById(rider._id);
    assert.equal(refreshed.budget, 0);
    assert.ok(payroll.some((row) => row.shortfall > 0));
    assert.equal(riderAfter.form, 68);
  });

  it('tickInjuryRecovery clears injury at week 0', async () => {
    const rider = await Cyclist.create({
      name: 'Hurt',
      injury: { type: 'illness', weeksRemaining: 1, description: 'sick' },
    });
    assert.equal(isInjured(rider), true);
    await tickInjuryRecovery();
    const after = await Cyclist.findById(rider._id);
    assert.equal(after.injury.type, 'none');
    assert.equal(after.injury.weeksRemaining, 0);
  });

  it('applyInjuries persists crash form penalty', async () => {
    const rider = await Cyclist.create({ name: 'Crashy', form: 80 });
    await applyInjuries([{
      cyclist: rider._id,
      name: 'Crashy',
      type: 'crash',
      weeksRemaining: 3,
      description: 'down',
    }]);
    const after = await Cyclist.findById(rider._id);
    assert.equal(after.injury.type, 'crash');
    assert.equal(after.form, 72);
  });

  it('completing final week builds season summary', async () => {
    const team = await Team.create({
      name: 'Champs',
      budget: 250000,
      seasonPoints: 120,
      wins: 4,
    });
    const youth = await Cyclist.create({
      name: 'Prospect',
      age: 21,
      potential: 95,
      sprint: 45,
      climb: 45,
      timeTrial: 45,
      endurance: 45,
      teamwork: 45,
      team: team._id,
      salary: 1000,
    });
    team.roster = [youth._id];
    await team.save();

    await Season.create({
      year: 2026,
      currentWeek: 30,
      totalWeeks: 30,
      status: 'active',
      developmentLedger: [{
        week: 10,
        cyclist: youth._id,
        name: 'Prospect',
        changes: [{ skill: 'sprint', delta: 2, reason: 'youth_growth' }],
      }],
    });

    const { season } = await advanceSeasonWeek();
    assert.equal(season.status, 'completed');
    assert.ok(season.summary);
    assert.equal(season.summary.champion.name, 'Champs');
    assert.ok(season.summary.headline);

    const viaApi = await request(app).get('/api/season/summary');
    assert.equal(viaApi.status, 200);
    assert.equal(viaApi.body.complete, true);
    assert.equal(viaApi.body.summary.champion.name, 'Champs');

    const summary = await getSeasonSummary();
    assert.equal(summary.complete, true);
  });

  it('POST /api/season/advance bumps week', async () => {
    await Season.create({
      year: 2026,
      currentWeek: 4,
      totalWeeks: 30,
      status: 'active',
    });
    const res = await request(app).post('/api/season/advance');
    assert.equal(res.status, 200);
    assert.equal(res.body.season.currentWeek, 5);
  });
});
