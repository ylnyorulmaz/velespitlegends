const fs = require('fs');
const path = require('path');

// Load backend/.env without an extra dependency
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const Cyclist = require('./models/Cyclist');
const Race = require('./models/Race');
const Team = require('./models/Team');
const Staff = require('./models/Staff');
const RaceResult = require('./models/RaceResult');
const StageRace = require('./models/StageRace');
const {
  simulateRace,
  staffTacticBonus,
  TACTICS,
  RIDER_ROLES,
  normalizeTactic,
  normalizeRoles,
  validateRaceSegments,
} = require('./services/raceEngine');
const {
  getOrCreateSeason,
  advanceSeasonWeek,
  getSeasonSummary,
} = require('./services/seasonService');
const {
  isInjured,
  computeMarketValue,
} = require('./services/injuryService');
const {
  isStageUnlockedForTeam,
  createStageRaceWithStages,
  decorateGcStandings,
} = require('./services/stageRaceService');
const {
  listMarketCyclists,
  signCyclist,
  releaseCyclist,
} = require('./services/transferService');
const { buildRivalSquads } = require('./services/pelotonService');
const { persistRaceOutcome } = require('./services/racePersistService');
const {
  startLiveRaceSession,
  continueLiveRace,
  finishLiveRace,
  getSession,
} = require('./services/liveRaceService');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/cycling_management';

async function connectDb(uri = MONGODB_URI) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(uri);
  return mongoose.connection;
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Cyclist routes
app.get('/api/cyclists', async (req, res) => {
  const cyclists = await Cyclist.find().populate('team');
  await Promise.all(cyclists.map(async (cyclist) => {
    if (!cyclist.name || !String(cyclist.name).trim()) {
      cyclist.name = `Rider ${String(cyclist._id).slice(-4)}`;
      await Cyclist.updateOne({ _id: cyclist._id }, { $set: { name: cyclist.name } });
    }
  }));
  res.send(cyclists.map((cyclist) => ({
    ...cyclist.toObject(),
    marketValue: computeMarketValue(cyclist),
    injured: isInjured(cyclist),
  })));
});

app.post('/api/cyclists', async (req, res) => {
  const cyclist = new Cyclist(req.body);
  await cyclist.save();
  res.send(cyclist);
});

// Optional rest day: recover fatigue / nudge form for selected riders
app.post('/api/cyclists/rest', async (req, res) => {
  const { cyclistIds } = req.body || {};
  if (!Array.isArray(cyclistIds) || !cyclistIds.length) {
    return res.status(400).json({ error: 'cyclistIds[] required' });
  }

  const cyclists = await Cyclist.find({ _id: { $in: cyclistIds } });
  for (const rider of cyclists) {
    if (isInjured(rider)) continue;
    rider.fatigue = Math.max(0, (rider.fatigue || 0) - 15);
    rider.form = Math.min(100, (rider.form || 70) + 2);
    await rider.save();
  }

  res.send(cyclists);
});

// Transfer market
app.get('/api/transfers/market', async (req, res) => {
  const market = await listMarketCyclists();
  res.send(market);
});

app.post('/api/transfers/sign', async (req, res) => {
  try {
    const { teamId, cyclistId } = req.body;
    if (!teamId || !cyclistId) {
      return res.status(400).json({ error: 'teamId and cyclistId are required' });
    }
    const result = await signCyclist(teamId, cyclistId);
    res.status(201).send(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/transfers/release', async (req, res) => {
  try {
    const { teamId, cyclistId } = req.body;
    if (!teamId || !cyclistId) {
      return res.status(400).json({ error: 'teamId and cyclistId are required' });
    }
    const result = await releaseCyclist(teamId, cyclistId);
    res.send(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Stage races
app.get('/api/stage-races', async (req, res) => {
  const stageRaces = await StageRace.find().sort({ createdAt: -1 }).populate('gcStandings.team');
  res.send(stageRaces);
});

app.get('/api/stage-races/:id', async (req, res) => {
  const stageRace = await StageRace.findById(req.params.id).populate('gcStandings.team');
  if (!stageRace) return res.status(404).json({ error: 'Stage race not found' });

  const stages = await Race.find({ stageRace: stageRace._id }).sort({ stageNumber: 1 });
  const plain = stageRace.toObject();
  plain.gcStandings = decorateGcStandings(plain.gcStandings || []);
  res.send({ stageRace: plain, stages });
});

app.post('/api/stage-races', async (req, res) => {
  try {
    const segmentChecks = (req.body.stages || []).map(
      (stage) => validateRaceSegments(stage.distance, stage.segments),
    ).filter(Boolean);
    if (segmentChecks.length) {
      return res.status(400).json({ error: segmentChecks[0] });
    }

    const created = await createStageRaceWithStages(req.body);
    res.status(201).send(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Season routes
app.get('/api/season', async (req, res) => {
  const season = await getOrCreateSeason();
  res.send(season);
});

app.post('/api/season/advance', async (req, res) => {
  try {
    const result = await advanceSeasonWeek();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/season/summary', async (req, res) => {
  try {
    const result = await getSeasonSummary();
    res.send(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/roles', (req, res) => {
  res.send(RIDER_ROLES);
});

app.get('/api/standings', async (req, res) => {
  const teams = await Team.find().sort({ seasonPoints: -1, wins: -1 });
  const results = await RaceResult.find();

  const riderMap = new Map();
  for (const result of results) {
    for (const row of result.standings || []) {
      if (!row.isPlayer || !row.cyclist) continue;
      const id = String(row.cyclist);
      const prev = riderMap.get(id) || {
        cyclist: row.cyclist,
        name: row.name,
        points: 0,
        races: 0,
        wins: 0,
      };
      prev.points += row.points || 0;
      prev.races += 1;
      if (row.position === 1) prev.wins += 1;
      riderMap.set(id, prev);
    }
  }

  const riders = Array.from(riderMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.wins - a.wins;
  });

  res.send({
    teams: teams.map((team, index) => ({
      rank: index + 1,
      _id: team._id,
      name: team.name,
      seasonPoints: team.seasonPoints || 0,
      wins: team.wins || 0,
      rosterSize: (team.roster || []).length,
    })),
    riders: riders.map((rider, index) => ({
      rank: index + 1,
      ...rider,
    })),
  });
});

// Race routes
app.get('/api/tactics', (req, res) => {
  res.send(TACTICS);
});

app.get('/api/races', async (req, res) => {
  const races = await Race.find().sort({ date: 1 });
  res.send(races);
});

app.get('/api/races/:id/rivals', async (req, res) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: 'Race not found' });
    const teamId = req.query.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId query required' });

    const completedTeamIds = (race.completedEntries || []).map((entry) => entry.team);
    const rivalSquads = await buildRivalSquads({
      playerTeamId: teamId,
      race,
      completedTeamIds,
      maxTeams: 5,
      ridersPerTeam: 6,
    });

    res.send({
      rivalTeamCount: rivalSquads.length,
      rivals: rivalSquads.map((squad) => ({
        teamId: squad.teamId,
        teamName: squad.teamName,
        riderCount: (squad.riders || []).length,
        tactic: squad.tactic,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/races', async (req, res) => {
  const segmentError = validateRaceSegments(req.body.distance, req.body.segments);
  if (segmentError) {
    return res.status(400).json({ error: segmentError });
  }
  const race = new Race(req.body);
  await race.save();
  res.send(race);
});

app.put('/api/races/:id', async (req, res) => {
  try {
    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: 'Race not found' });

    const payload = { ...req.body };
    if (payload.segments && payload.segments.length) {
      const segmentError = validateRaceSegments(payload.distance ?? race.distance, payload.segments);
      if (segmentError) {
        return res.status(400).json({ error: segmentError });
      }
    } else if (payload.segments && !payload.segments.length) {
      payload.segments = [];
    }

    Object.assign(race, payload);
    await race.save();
    res.send(race);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function loadRaceEntryContext(raceId, body) {
  const { teamId, cyclistIds } = body || {};
  if (!teamId || !Array.isArray(cyclistIds)) {
    const err = new Error('teamId and cyclistIds[] are required');
    err.status = 400;
    throw err;
  }
  if (cyclistIds.length < 3 || cyclistIds.length > 8) {
    const err = new Error('Select between 3 and 8 riders');
    err.status = 400;
    throw err;
  }

  const race = await Race.findById(raceId);
  if (!race) {
    const err = new Error('Race not found');
    err.status = 404;
    throw err;
  }

  const team = await Team.findById(teamId).populate('staff');
  if (!team) {
    const err = new Error('Team not found');
    err.status = 404;
    throw err;
  }

  const alreadyCompleted = (race.completedEntries || []).some(
    (entry) => String(entry.team) === String(teamId),
  );
  if (alreadyCompleted) {
    const err = new Error('This team already completed this race');
    err.status = 400;
    throw err;
  }

  const season = await getOrCreateSeason();
  const raceWeek = race.seasonWeek || 1;
  if (raceWeek > season.currentWeek) {
    const err = new Error(
      `This race opens in week ${raceWeek}. Current season week is ${season.currentWeek}.`,
    );
    err.status = 400;
    throw err;
  }

  const stageUnlock = await isStageUnlockedForTeam(race, teamId);
  if (!stageUnlock.ok) {
    const err = new Error(stageUnlock.error);
    err.status = 400;
    throw err;
  }

  const riders = await Cyclist.find({ _id: { $in: cyclistIds } });
  if (riders.length !== cyclistIds.length) {
    const err = new Error('One or more cyclists not found');
    err.status = 400;
    throw err;
  }

  await Promise.all(riders.map(async (rider) => {
    if (!rider.name || !String(rider.name).trim()) {
      rider.name = `Rider ${String(rider._id).slice(-4)}`;
      await Cyclist.updateOne({ _id: rider._id }, { $set: { name: rider.name } });
    }
  }));

  const injuredRiders = riders.filter((rider) => isInjured(rider));
  if (injuredRiders.length) {
    const err = new Error(
      `Injured riders cannot start: ${injuredRiders.map((r) => r.name).join(', ')}`,
    );
    err.status = 400;
    throw err;
  }

  const rosterIds = (team.roster || []).map((id) => String(id));
  if (rosterIds.length > 0) {
    const offRoster = cyclistIds.filter((id) => !rosterIds.includes(String(id)));
    if (offRoster.length) {
      const err = new Error('All selected riders must be on the team roster');
      err.status = 400;
      throw err;
    }
  }

  return { race, team, teamId, cyclistIds, riders };
}

app.post('/api/races/:id/enter', async (req, res) => {
  try {
    const { tactic: rawTactic, roles: rawRoles } = req.body;
    const ctx = await loadRaceEntryContext(req.params.id, req.body);

    const staffBonus = staffTacticBonus(ctx.team.staff || []);
    const tactic = normalizeTactic(rawTactic);
    const roles = normalizeRoles(ctx.cyclistIds, rawRoles || {});
    const roleKey = Object.values(roles).sort().join('-');
    const seed = `${ctx.race._id}-${ctx.teamId}-${ctx.race.date || ''}-${tactic}-${roleKey}`;

    const rosterSet = new Set(ctx.team.roster.map((id) => String(id)));
    ctx.cyclistIds.forEach((id) => rosterSet.add(String(id)));
    ctx.team.roster = Array.from(rosterSet);

    const completedTeamIds = (ctx.race.completedEntries || []).map((entry) => entry.team);
    const rivalSquads = await buildRivalSquads({
      playerTeamId: ctx.teamId,
      race: ctx.race,
      completedTeamIds,
      maxTeams: 5,
      ridersPerTeam: 6,
    });

    const sim = simulateRace(ctx.race, ctx.riders, ctx.team.name, {
      teamId: ctx.teamId,
      seed,
      staffBonus,
      tactic,
      roles,
      rivalSquads,
    });

    const populated = await persistRaceOutcome({
      race: ctx.race,
      team: ctx.team,
      teamId: ctx.teamId,
      cyclistIds: ctx.cyclistIds,
      riders: ctx.riders,
      rivalSquads,
      sim,
      seed,
      tactic,
    });

    res.status(201).send(populated);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// CM-style interactive race: commentary + mid-race orders
app.post('/api/races/:id/live/start', async (req, res) => {
  try {
    const { tactic: rawTactic, roles: rawRoles } = req.body;
    const ctx = await loadRaceEntryContext(req.params.id, req.body);
    const session = await startLiveRaceSession({
      race: ctx.race,
      team: ctx.team,
      teamId: ctx.teamId,
      cyclistIds: ctx.cyclistIds,
      riders: ctx.riders,
      rawTactic,
      rawRoles,
    });
    res.status(201).send(session);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/races/live/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Race session not found' });
  const { publicLiveView } = require('./services/raceEngine');
  res.send({ sessionId: session.id, ...publicLiveView(session.state) });
});

app.post('/api/races/live/:sessionId/continue', async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Race session not found' });
    const race = await Race.findById(session.raceId);
    const team = await Team.findById(session.teamId);
    if (!race || !team) return res.status(404).json({ error: 'Race or team missing' });

    const payload = await continueLiveRace(
      req.params.sessionId,
      { tactic: req.body && req.body.tactic },
      { race, team },
    );
    res.send(payload);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/races/live/:sessionId/finish', async (req, res) => {
  try {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Race session not found' });
    const race = await Race.findById(session.raceId);
    const team = await Team.findById(session.teamId);
    if (!race || !team) return res.status(404).json({ error: 'Race or team missing' });

    const payload = await finishLiveRace(
      req.params.sessionId,
      { tactic: req.body && req.body.tactic },
      { race, team },
    );
    res.status(201).send(payload);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Results routes
app.get('/api/results', async (req, res) => {
  const results = await RaceResult.find()
    .sort({ createdAt: -1 })
    .populate('race')
    .populate('team');
  res.send(results);
});

app.get('/api/results/:id', async (req, res) => {
  const result = await RaceResult.findById(req.params.id)
    .populate('race')
    .populate('team')
    .populate('riders');
  if (!result) return res.status(404).json({ error: 'Result not found' });
  res.send(result);
});

// Team routes
app.get('/api/teams', async (req, res) => {
  const teams = await Team.find().populate('roster').populate('staff');
  res.send(teams);
});

app.post('/api/teams', async (req, res) => {
  const team = new Team(req.body);
  await team.save();
  res.send(team);
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const allowed = ['name', 'nationality', 'budget', 'roster', 'staff'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) team[field] = req.body[field];
    });

    await team.save();
    const populated = await Team.findById(team._id).populate('roster').populate('staff');
    res.send(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Staff routes
app.get('/api/staff', async (req, res) => {
  const staff = await Staff.find();
  res.send(staff);
});

app.post('/api/staff', async (req, res) => {
  const staffMember = new Staff(req.body);
  await staffMember.save();
  res.send(staffMember);
});

// Dashboard summary for home
app.get('/api/dashboard', async (req, res) => {
  const season = await getOrCreateSeason();
  const teams = await Team.find().sort({ seasonPoints: -1 }).limit(5).populate('roster');
  const nextRace = await Race.findOne({
    seasonWeek: { $lte: season.currentWeek },
  }).sort({ seasonWeek: 1, date: 1 });
  const upcomingRace = await Race.findOne({
    seasonWeek: { $gt: season.currentWeek },
  }).sort({ seasonWeek: 1, date: 1 });
  const recent = await RaceResult.find()
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('race')
    .populate('team');

  const topTeam = teams[0] || null;
  const formSnapshot = topTeam && topTeam.roster
    ? topTeam.roster.slice(0, 5).map((r) => ({
      name: r.name,
      form: r.form,
      fatigue: r.fatigue,
    }))
    : [];

  res.send({
    season,
    topTeams: teams.map((t) => ({
      _id: t._id,
      name: t.name,
      budget: t.budget,
      wins: t.wins,
      seasonPoints: t.seasonPoints || 0,
    })),
    nextRace,
    upcomingRace,
    recentResults: recent,
    formSnapshot,
  });
});

// Serve built frontend when available (dev uses webpack on :8080)
const frontendDist = path.join(__dirname, '../frontend/dist');
const frontendIndex = path.join(frontendDist, 'index.html');
if (fs.existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(frontendIndex);
  });
}

if (require.main === module) {
  connectDb()
    .then(() => {
      console.log('Connected to MongoDB');
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err.message);
      process.exit(1);
    });
}

module.exports = { app, connectDb, MONGODB_URI };
