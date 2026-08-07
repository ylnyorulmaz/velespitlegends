const crypto = require('crypto');
const {
  createLiveRaceState,
  stepLiveRace,
  finalizeLiveRace,
  publicLiveView,
  normalizeTactic,
  normalizeRoles,
  staffTacticBonus,
} = require('./raceEngine');
const { buildRivalSquads } = require('./pelotonService');
const { persistRaceOutcome } = require('./racePersistService');

const sessions = new Map();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function pruneSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

function getSession(sessionId) {
  pruneSessions();
  return sessions.get(sessionId) || null;
}

async function startLiveRaceSession({
  race,
  team,
  teamId,
  cyclistIds,
  riders,
  rawTactic,
  rawRoles,
}) {
  pruneSessions();

  const staffBonus = staffTacticBonus(team.staff || []);
  const tactic = normalizeTactic(rawTactic);
  const roles = normalizeRoles(cyclistIds, rawRoles || {});
  const roleKey = Object.values(roles).sort().join('-');
  const seed = `${race._id}-${teamId}-${race.date || ''}-${tactic}-${roleKey}`;

  const rosterSet = new Set((team.roster || []).map((id) => String(id)));
  cyclistIds.forEach((id) => rosterSet.add(String(id)));
  const teamRoster = Array.from(rosterSet);

  const completedTeamIds = (race.completedEntries || []).map((entry) => entry.team);
  const rivalSquads = await buildRivalSquads({
    playerTeamId: teamId,
    race,
    completedTeamIds,
    maxTeams: 5,
    ridersPerTeam: 6,
  });

  const racePlain = typeof race.toObject === 'function' ? race.toObject() : race;
  const state = createLiveRaceState(racePlain, riders, team.name, {
    teamId,
    seed,
    staffBonus,
    tactic,
    roles,
    rivalSquads,
  });

  const sessionId = crypto.randomBytes(12).toString('hex');
  sessions.set(sessionId, {
    id: sessionId,
    createdAt: Date.now(),
    raceId: String(race._id),
    teamId: String(teamId),
    cyclistIds: cyclistIds.map(String),
    teamRoster,
    rivalSquads,
    playerRiders: riders,
    state,
    resultId: null,
  });

  return {
    sessionId,
    ...publicLiveView(state),
  };
}

async function persistSession(session, race, team) {
  const sim = finalizeLiveRace(session.state);
  const populated = await persistRaceOutcome({
    race,
    team: {
      _id: team._id,
      roster: session.teamRoster,
    },
    teamId: session.teamId,
    cyclistIds: session.cyclistIds,
    riders: session.playerRiders,
    rivalSquads: session.rivalSquads,
    sim,
    seed: session.state.seed,
    tactic: session.state.tactic,
  });
  session.resultId = String(populated._id);
  sessions.delete(session.id);
  return { sim, populated };
}

async function continueLiveRace(sessionId, { tactic } = {}, { race, team } = {}) {
  const session = getSession(sessionId);
  if (!session) {
    const err = new Error('Race session expired or not found. Start again from the calendar.');
    err.status = 404;
    throw err;
  }
  if (session.resultId) {
    return {
      sessionId,
      status: 'completed',
      resultId: session.resultId,
      done: true,
      ...publicLiveView(session.state),
    };
  }

  const step = stepLiveRace(session.state, { tactic });
  if (!step.done) {
    return {
      sessionId,
      done: false,
      newLines: step.lines,
      ...publicLiveView(session.state),
    };
  }

  const { populated } = await persistSession(session, race, team);
  return {
    sessionId,
    done: true,
    status: 'completed',
    resultId: populated._id,
    result: populated,
    newLines: step.lines,
    feed: (populated.narrative || []).slice(),
    ...publicLiveView({
      ...session.state,
      status: 'completed',
      feed: populated.narrative || session.state.feed,
    }),
  };
}

async function finishLiveRace(sessionId, { tactic } = {}, { race, team } = {}) {
  const session = getSession(sessionId);
  if (!session) {
    const err = new Error('Race session expired or not found. Start again from the calendar.');
    err.status = 404;
    throw err;
  }
  if (session.resultId) {
    return { sessionId, resultId: session.resultId, alreadyFinished: true };
  }

  if (tactic != null) {
    stepLiveRace(session.state, { tactic });
  }

  const { populated, sim } = await persistSession(session, race, team);
  return {
    sessionId,
    resultId: populated._id,
    result: populated,
    feed: sim.narrative,
  };
}

module.exports = {
  startLiveRaceSession,
  continueLiveRace,
  finishLiveRace,
  getSession,
};
