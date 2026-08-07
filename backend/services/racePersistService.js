const Cyclist = require('../models/Cyclist');
const Team = require('../models/Team');
const Race = require('../models/Race');
const RaceResult = require('../models/RaceResult');
const { createRng } = require('./raceEngine');
const {
  extractInjuriesFromSegmentLog,
  applyInjuries,
} = require('./injuryService');
const { updateStageRaceGc } = require('./stageRaceService');

/**
 * Persist a finished simulation the same way POST /enter does.
 */
async function persistRaceOutcome({
  race,
  team,
  teamId,
  cyclistIds,
  riders,
  rivalSquads,
  sim,
  seed,
  tactic,
}) {
  const allRaceRiders = [
    ...riders,
    ...(rivalSquads || []).flatMap((squad) => squad.riders || []),
  ];

  const injuryRng = createRng(`${seed}-injuries`);
  const injuryPayload = extractInjuriesFromSegmentLog(
    sim.segmentLog,
    allRaceRiders,
    injuryRng,
  );
  const injuriesApplied = await applyInjuries(injuryPayload);

  const injuredIds = new Set(injuriesApplied.map((r) => String(r._id)));
  await Promise.all((sim.formChanges || []).map(async (change) => {
    if (injuredIds.has(String(change.cyclist))) return;
    await Cyclist.updateOne(
      { _id: change.cyclist },
      { $set: { fatigue: change.fatigueAfter, form: change.formAfter } },
    );
  }));

  for (const row of sim.teamResults || []) {
    if (!row.teamId) continue;
    await Team.updateOne(
      { _id: row.teamId },
      {
        $inc: {
          seasonPoints: row.points || 0,
          wins: row.bestPosition === 1 ? 1 : 0,
        },
      },
    );
    const refreshed = await Team.findById(row.teamId).select('seasonPoints');
    if (refreshed) {
      await Team.updateOne(
        { _id: row.teamId },
        { $set: { ranking: refreshed.seasonPoints || 0 } },
      );
    }
  }

  await Team.updateOne({ _id: teamId }, { $set: { roster: team.roster } });

  const result = await RaceResult.create({
    race: race._id,
    team: team._id,
    riders: cyclistIds,
    summary: sim.summary,
    narrative: sim.narrative,
    segmentLog: sim.segmentLog,
    tactic,
    riderRoles: sim.riderRoles,
    standings: sim.standings,
    formChanges: sim.formChanges,
    teamPointsEarned: sim.teamPointsEarned,
    rivalTeamCount: sim.rivalTeamCount || 0,
    teamResults: sim.teamResults,
    injuriesApplied: injuriesApplied.map((rider) => ({
      cyclist: rider._id,
      name: rider.name,
      type: rider.injury.type,
      weeksRemaining: rider.injury.weeksRemaining,
      description: rider.injury.description,
    })),
    stageRace: race.stageRace || null,
    stageNumber: race.stageNumber || null,
  });

  const freshRace = await Race.findById(race._id);
  freshRace.completedEntries = freshRace.completedEntries || [];
  const participatedTeamIds = new Set(
    (sim.teamResults || []).map((row) => String(row.teamId)).filter(Boolean),
  );
  participatedTeamIds.add(String(teamId));

  for (const tid of participatedTeamIds) {
    const already = freshRace.completedEntries.some((entry) => String(entry.team) === tid);
    if (already) continue;
    freshRace.completedEntries.push({
      team: tid,
      result: result._id,
      completedAt: new Date(),
    });
  }
  await freshRace.save();

  if (freshRace.stageRace) {
    for (const row of sim.teamResults || []) {
      if (!row.teamId) continue;
      await updateStageRaceGc(freshRace.stageRace, row.teamId, freshRace, {
        _id: result._id,
        teamPointsEarned: row.points,
        teamTimeSeconds: row.bestTimeSeconds || 0,
        stageWin: row.bestPosition === 1,
        standings: sim.standings,
      });
    }
  }

  return RaceResult.findById(result._id)
    .populate('race')
    .populate('team')
    .populate('riders');
}

module.exports = {
  persistRaceOutcome,
};
