const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { clearDb } = require('../helpers/mongo');
const { getTestApp } = require('../helpers/app');
const Cyclist = require('../../models/Cyclist');
const Team = require('../../models/Team');
const Race = require('../../models/Race');
const RaceResult = require('../../models/RaceResult');

describe('RaceResult schema (mongoose type trap)', () => {
  before(async () => {
    await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('persists randomEvents and injuriesApplied objects without CastError', async () => {
    const team = await Team.create({ name: 'Schema FC', budget: 100000 });
    const rider = await Cyclist.create({
      name: 'Schema Rider',
      team: team._id,
      sprint: 70,
      climb: 70,
    });
    const race = await Race.create({
      name: 'Schema Race',
      distance: 180,
      profile: 'flat',
      prestige: 50,
      seasonWeek: 1,
    });

    const doc = await RaceResult.create({
      race: race._id,
      team: team._id,
      riders: [rider._id],
      summary: 'ok',
      narrative: ['line'],
      segmentLog: [{
        kmStart: 0,
        kmEnd: 180,
        profile: 'flat',
        label: 'All',
        leader: 'Schema Rider',
        events: ['go'],
        randomEvents: [{
          type: 'crash',
          kind: 'bad',
          rider: 'Schema Rider',
          isPlayer: true,
          scoreDelta: -20,
          message: 'Went down',
        }],
        topThree: [{ name: 'Schema Rider', score: 100, isPlayer: true }],
      }],
      standings: [{
        position: 1,
        name: 'Schema Rider',
        cyclist: rider._id,
        isPlayer: true,
        teamId: team._id,
        teamName: 'Schema FC',
        score: 100,
        points: 25,
        timeSeconds: 10440,
        gapSeconds: 0,
      }],
      injuriesApplied: [{
        cyclist: rider._id,
        name: 'Schema Rider',
        type: 'crash',
        weeksRemaining: 3,
        description: 'Hurt',
      }],
    });

    const loaded = await RaceResult.findById(doc._id).lean();
    assert.equal(loaded.segmentLog[0].randomEvents[0].type, 'crash');
    assert.equal(loaded.segmentLog[0].randomEvents[0].message, 'Went down');
    assert.equal(loaded.injuriesApplied[0].type, 'crash');
    assert.equal(loaded.injuriesApplied[0].weeksRemaining, 3);
  });
});
