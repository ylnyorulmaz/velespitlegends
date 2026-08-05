const StageRace = require('../models/StageRace');
const Race = require('../models/Race');
const RaceResult = require('../models/RaceResult');

async function updateStageRaceGc(stageRaceId, teamId, race, result) {
  if (!stageRaceId) return null;

  const stageRace = await StageRace.findById(stageRaceId);
  if (!stageRace) return null;

  stageRace.gcStandings = stageRace.gcStandings || [];
  let entry = stageRace.gcStandings.find((row) => String(row.team) === String(teamId));

  if (!entry) {
    entry = {
      team: teamId,
      totalPoints: 0,
      stageWins: 0,
      stagesCompleted: 0,
      stageResults: [],
    };
    stageRace.gcStandings.push(entry);
  }

  const stagePoints = result.teamPointsEarned || 0;
  const stageWin = result.standings && result.standings[0] && result.standings[0].isPlayer;

  entry.stageResults = entry.stageResults || [];
  entry.stageResults.push({
    stageNumber: race.stageNumber,
    race: race._id,
    result: result._id,
    points: stagePoints,
  });
  entry.totalPoints = (entry.totalPoints || 0) + stagePoints;
  entry.stagesCompleted = (entry.stagesCompleted || 0) + 1;
  if (stageWin) entry.stageWins = (entry.stageWins || 0) + 1;

  stageRace.gcStandings.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return b.stageWins - a.stageWins;
  });

  const totalStages = await Race.countDocuments({ stageRace: stageRaceId });
  const allTeamsDone = stageRace.gcStandings.every(
    (row) => row.stagesCompleted >= totalStages,
  );
  if (allTeamsDone && totalStages > 0) {
    stageRace.status = 'completed';
  }

  await stageRace.save();
  return stageRace;
}

async function getPreviousStageRace(race) {
  if (!race.stageRace || !race.stageNumber || race.stageNumber <= 1) return null;
  return Race.findOne({
    stageRace: race.stageRace,
    stageNumber: race.stageNumber - 1,
  });
}

async function isStageUnlockedForTeam(race, teamId) {
  if (!race.stageRace || !race.stageNumber) return { ok: true };

  if (race.stageNumber === 1) return { ok: true };

  const previous = await getPreviousStageRace(race);
  if (!previous) return { ok: true };

  const completed = (previous.completedEntries || []).some(
    (entry) => String(entry.team) === String(teamId),
  );

  if (!completed) {
    return {
      ok: false,
      error: `Complete stage ${previous.stageNumber} (${previous.name}) before entering stage ${race.stageNumber}.`,
    };
  }

  return { ok: true };
}

async function createStageRaceWithStages(payload) {
  const { name, seasonWeekStart, prestige, stages } = payload;
  if (!name || !Array.isArray(stages) || stages.length < 2) {
    throw new Error('Stage race needs a name and at least 2 stages.');
  }

  const stageRace = await StageRace.create({
    name,
    seasonWeekStart: seasonWeekStart || 1,
    prestige: prestige || 70,
    gcStandings: [],
  });

  const createdRaces = [];
  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i];
    const race = await Race.create({
      name: stage.name || `${name} — Stage ${i + 1}`,
      date: stage.date,
      distance: stage.distance || 150,
      profile: stage.profile || 'hilly',
      prestige: stage.prestige || prestige || 70,
      seasonWeek: stage.seasonWeek || (seasonWeekStart + i),
      stageRace: stageRace._id,
      stageNumber: i + 1,
      segments: stage.segments || [],
    });
    createdRaces.push(race);
  }

  return { stageRace, stages: createdRaces };
}

module.exports = {
  updateStageRaceGc,
  getPreviousStageRace,
  isStageUnlockedForTeam,
  createStageRaceWithStages,
};
