const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { clearDb } = require('../helpers/mongo');
const { getTestApp } = require('../helpers/app');
const Team = require('../../models/Team');
const StageRace = require('../../models/StageRace');
const {
  updateStageRaceGc,
  isStageUnlockedForTeam,
  createStageRaceWithStages,
  decorateGcStandings,
} = require('../../services/stageRaceService');

describe('stage race GC (time-based)', () => {
  before(async () => {
    await getTestApp();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('createStageRaceWithStages requires ≥2 stages', async () => {
    await assert.rejects(
      () => createStageRaceWithStages({ name: 'Tour', stages: [{ name: 'S1' }] }),
      /at least 2/i,
    );
  });

  it('accumulates time GC, skips double-count, sorts by time', async () => {
    const { stageRace, stages } = await createStageRaceWithStages({
      name: 'Mini Tour',
      seasonWeekStart: 1,
      prestige: 80,
      stages: [
        { name: 'Stage 1', distance: 160, profile: 'flat', seasonWeek: 1 },
        { name: 'Stage 2', distance: 180, profile: 'mountain', seasonWeek: 2 },
      ],
    });

    const teamA = await Team.create({ name: 'Fast', budget: 1 });
    const teamB = await Team.create({ name: 'Slow', budget: 1 });

    await updateStageRaceGc(stageRace._id, teamA._id, stages[0], {
      teamPointsEarned: 25,
      teamTimeSeconds: 9000,
      stageWin: true,
      standings: [{
        position: 1, teamId: teamA._id, name: 'A1', timeSeconds: 9000, gapSeconds: 0,
      }],
    });
    await updateStageRaceGc(stageRace._id, teamB._id, stages[0], {
      teamPointsEarned: 16,
      teamTimeSeconds: 9120,
      standings: [{
        position: 3, teamId: teamB._id, name: 'B1', timeSeconds: 9120, gapSeconds: 120,
      }],
    });

    // Idempotent for same stage
    await updateStageRaceGc(stageRace._id, teamA._id, stages[0], {
      teamPointsEarned: 25,
      teamTimeSeconds: 9000,
      standings: [{
        position: 1, teamId: teamA._id, name: 'A1', timeSeconds: 9000, gapSeconds: 0,
      }],
    });

    let tour = await StageRace.findById(stageRace._id).lean();
    assert.equal(tour.gcStandings.find((r) => String(r.team) === String(teamA._id)).stagesCompleted, 1);
    assert.equal(tour.gcStandings[0].totalTimeSeconds, 9000);

    await updateStageRaceGc(stageRace._id, teamA._id, stages[1], {
      teamPointsEarned: 20,
      teamTimeSeconds: 10000,
      standings: [{
        position: 2, teamId: teamA._id, name: 'A1', timeSeconds: 10000, gapSeconds: 40,
      }],
    });
    await updateStageRaceGc(stageRace._id, teamB._id, stages[1], {
      teamPointsEarned: 25,
      teamTimeSeconds: 9960,
      stageWin: true,
      standings: [{
        position: 1, teamId: teamB._id, name: 'B1', timeSeconds: 9960, gapSeconds: 0,
      }],
    });

    tour = await StageRace.findById(stageRace._id).lean();
    const decorated = decorateGcStandings(tour.gcStandings);
    assert.equal(tour.status, 'completed');
    assert.equal(decorated[0].totalTimeSeconds, 19000); // Fast 9000+10000
    assert.equal(decorated[1].totalTimeSeconds, 19080); // Slow 9120+9960
    assert.ok(decorated[1].gcGapSeconds > 0);
  });

  it('isStageUnlockedForTeam blocks stage 2 until stage 1 done', async () => {
    const { stages } = await createStageRaceWithStages({
      name: 'Lock Tour',
      stages: [
        { name: 'S1', distance: 150, profile: 'flat', seasonWeek: 1 },
        { name: 'S2', distance: 150, profile: 'hilly', seasonWeek: 2 },
      ],
    });
    const team = await Team.create({ name: 'Locker', budget: 1 });
    const locked = await isStageUnlockedForTeam(stages[1], team._id);
    assert.equal(locked.ok, false);

    stages[0].completedEntries = [{ team: team._id, result: null }];
    await stages[0].save();

    const open = await isStageUnlockedForTeam(stages[1], team._id);
    assert.equal(open.ok, true);
  });
});
