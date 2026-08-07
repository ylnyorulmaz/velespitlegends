const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { clearDb } = require('../helpers/mongo');
const { getTestApp } = require('../helpers/app');
const Cyclist = require('../../models/Cyclist');
const Team = require('../../models/Team');
const { signCyclist, releaseCyclist } = require('../../services/transferService');
const { computeMarketValue } = require('../../services/injuryService');

describe('transfers', () => {
  let app;

  before(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('signCyclist fails on insufficient budget', async () => {
    const free = await Cyclist.create({
      name: 'Star',
      sprint: 90,
      climb: 90,
      timeTrial: 90,
      endurance: 90,
      potential: 90,
      age: 25,
      team: null,
    });
    const team = await Team.create({ name: 'Poor', budget: 10, roster: [] });
    await assert.rejects(() => signCyclist(team._id, free._id), /Insufficient budget/);
  });

  it('sign and release update roster and team pointer', async () => {
    const free = await Cyclist.create({
      name: 'Free Agent',
      sprint: 60,
      climb: 60,
      timeTrial: 60,
      endurance: 60,
      potential: 60,
      age: 24,
      team: null,
    });
    const cost = computeMarketValue(free);
    const team = await Team.create({ name: 'Buyers', budget: cost + 1000, roster: [] });

    const signed = await signCyclist(team._id, free._id);
    assert.equal(String(signed.cyclist.team), String(team._id));
    assert.ok(signed.team.roster.some((id) => String(id) === String(free._id)));

    const released = await releaseCyclist(team._id, free._id);
    assert.equal(released.cyclist.team, null);
    assert.equal(released.team.roster.length, 0);
  });

  it('HTTP market / sign / release', async () => {
    const free = await Cyclist.create({
      name: 'Market Kid',
      sprint: 55,
      climb: 55,
      timeTrial: 55,
      endurance: 55,
      potential: 70,
      age: 22,
      team: null,
    });
    const cost = computeMarketValue(free);
    const team = await Team.create({ name: 'HTTP FC', budget: cost + 5000, roster: [] });

    const market = await request(app).get('/api/transfers/market');
    assert.equal(market.status, 200);
    assert.ok(market.body.some((c) => c.name === 'Market Kid'));

    const signed = await request(app)
      .post('/api/transfers/sign')
      .send({ teamId: team._id, cyclistId: free._id });
    assert.equal(signed.status, 201, signed.body.error || '');

    const released = await request(app)
      .post('/api/transfers/release')
      .send({ teamId: team._id, cyclistId: free._id });
    assert.equal(released.status, 200, released.body.error || '');
  });
});
