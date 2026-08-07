const StageRace = require('../models/StageRace');
const Race = require('../models/Race');

function formatGapSeconds(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `+${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (m > 0) return `+${m}:${String(sec).padStart(2, '0')}`;
  return `+${sec}s`;
}

function formatRaceTime(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function teamBestStageTime(teamId, standings) {
  const rows = (standings || []).filter(
    (row) => row.teamId && String(row.teamId) === String(teamId),
  );
  if (!rows.length) return null;
  rows.sort((a, b) => a.position - b.position);
  return rows[0];
}

async function updateStageRaceGc(stageRaceId, teamId, race, result) {
  if (!stageRaceId) return null;

  const stageRace = await StageRace.findById(stageRaceId);
  if (!stageRace) return null;

  stageRace.gcStandings = stageRace.gcStandings || [];
  let entry = stageRace.gcStandings.find((row) => String(row.team) === String(teamId));

  if (!entry) {
    // Push then re-read: mongoose clones plain objects into subdocs, so keep
    // mutating the array element — not the discarded plain object.
    stageRace.gcStandings.push({
      team: teamId,
      totalPoints: 0,
      totalTimeSeconds: 0,
      stageWins: 0,
      stagesCompleted: 0,
      stageResults: [],
    });
    entry = stageRace.gcStandings[stageRace.gcStandings.length - 1];
  }

  // Avoid double-counting the same stage for a team
  entry.stageResults = entry.stageResults || [];
  const already = entry.stageResults.some(
    (row) => Number(row.stageNumber) === Number(race.stageNumber),
  );
  if (already) {
    await stageRace.save();
    return stageRace;
  }

  const stagePoints = result.teamPointsEarned || 0;
  const best = teamBestStageTime(teamId, result.standings);
  const stageTime = result.teamTimeSeconds != null
    ? result.teamTimeSeconds
    : (best && best.timeSeconds != null ? best.timeSeconds : 0);
  const stageGap = best && best.gapSeconds != null ? best.gapSeconds : 0;
  const stageWin = Boolean(
    result.stageWin
    || (best && best.position === 1)
    || (result.standings
      && result.standings[0]
      && result.standings[0].teamId
      && String(result.standings[0].teamId) === String(teamId)),
  );

  entry.stageResults.push({
    stageNumber: race.stageNumber,
    race: race._id,
    result: result._id || result.resultId || null,
    points: stagePoints,
    timeSeconds: stageTime,
    gapSeconds: stageGap,
    bestRider: best ? best.name : '',
  });
  entry.totalPoints = (entry.totalPoints || 0) + stagePoints;
  entry.totalTimeSeconds = (entry.totalTimeSeconds || 0) + stageTime;
  entry.stagesCompleted = (entry.stagesCompleted || 0) + 1;
  if (stageWin) entry.stageWins = (entry.stageWins || 0) + 1;

  // Time GC: lowest cumulative time wins; ties → more stage wins
  stageRace.gcStandings.sort((a, b) => {
    const timeA = a.totalTimeSeconds || 0;
    const timeB = b.totalTimeSeconds || 0;
    if (timeA !== timeB) return timeA - timeB;
    if (b.stageWins !== a.stageWins) return b.stageWins - a.stageWins;
    return (b.totalPoints || 0) - (a.totalPoints || 0);
  });

  const totalStages = await Race.countDocuments({ stageRace: stageRaceId });
  const allTeamsDone = stageRace.gcStandings.length > 0
    && stageRace.gcStandings.every((row) => row.stagesCompleted >= totalStages);
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

function decorateGcStandings(gcStandings) {
  if (!gcStandings || !gcStandings.length) return [];
  const leaderTime = gcStandings[0].totalTimeSeconds || 0;
  return gcStandings.map((row, index) => {
    const plain = typeof row.toObject === 'function' ? row.toObject() : { ...row };
    const gap = index === 0 ? 0 : Math.max(0, (plain.totalTimeSeconds || 0) - leaderTime);
    return {
      ...plain,
      gcGapSeconds: gap,
      gcTimeLabel: formatRaceTime(plain.totalTimeSeconds || 0),
      gcGapLabel: index === 0 ? '' : formatGapSeconds(gap),
    };
  });
}

module.exports = {
  updateStageRaceGc,
  getPreviousStageRace,
  isStageUnlockedForTeam,
  createStageRaceWithStages,
  decorateGcStandings,
  formatRaceTime,
  formatGapSeconds,
};
