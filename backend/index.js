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
const { simulateRace, staffTacticBonus } = require('./services/raceEngine');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/cycling_management';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Cyclist routes
app.get('/api/cyclists', async (req, res) => {
  const cyclists = await Cyclist.find();
  res.send(cyclists);
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
    rider.fatigue = Math.max(0, (rider.fatigue || 0) - 15);
    rider.form = Math.min(100, (rider.form || 70) + 2);
    await rider.save();
  }

  res.send(cyclists);
});

// Race routes
app.get('/api/races', async (req, res) => {
  const races = await Race.find().sort({ date: 1 });
  res.send(races);
});

app.post('/api/races', async (req, res) => {
  const race = new Race(req.body);
  await race.save();
  res.send(race);
});

app.post('/api/races/:id/enter', async (req, res) => {
  try {
    const { teamId, cyclistIds } = req.body;

    if (!teamId || !Array.isArray(cyclistIds)) {
      return res.status(400).json({ error: 'teamId and cyclistIds[] are required' });
    }
    if (cyclistIds.length < 3 || cyclistIds.length > 8) {
      return res.status(400).json({ error: 'Select between 3 and 8 riders' });
    }

    const race = await Race.findById(req.params.id);
    if (!race) return res.status(404).json({ error: 'Race not found' });

    const team = await Team.findById(teamId).populate('staff');
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const alreadyCompleted = (race.completedEntries || []).some(
      (entry) => String(entry.team) === String(teamId),
    );
    if (alreadyCompleted) {
      return res.status(400).json({ error: 'This team already completed this race' });
    }

    const riders = await Cyclist.find({ _id: { $in: cyclistIds } });
    if (riders.length !== cyclistIds.length) {
      return res.status(400).json({ error: 'One or more cyclists not found' });
    }

    const rosterIds = (team.roster || []).map((id) => String(id));
    if (rosterIds.length > 0) {
      const offRoster = cyclistIds.filter((id) => !rosterIds.includes(String(id)));
      if (offRoster.length) {
        return res.status(400).json({ error: 'All selected riders must be on the team roster' });
      }
    }

    const staffBonus = staffTacticBonus(team.staff || []);
    const seed = `${race._id}-${teamId}-${race.date || ''}`;

    const rosterSet = new Set(team.roster.map((id) => String(id)));
    cyclistIds.forEach((id) => rosterSet.add(String(id)));
    team.roster = Array.from(rosterSet);

    const {
      standings,
      summary,
      narrative,
      formChanges,
      teamPointsEarned,
    } = simulateRace(race, riders, team.name, { teamId, seed, staffBonus });

    // Persist fatigue/form ticks
    await Promise.all(riders.map((rider) => rider.save()));

    if (standings[0] && standings[0].isPlayer) {
      team.wins = (team.wins || 0) + 1;
    }
    team.seasonPoints = (team.seasonPoints || 0) + teamPointsEarned;
    // ranking shown as season points standing (higher = better)
    team.ranking = team.seasonPoints;
    await team.save();

    const result = await RaceResult.create({
      race: race._id,
      team: team._id,
      riders: cyclistIds,
      summary,
      narrative,
      standings,
      formChanges,
      teamPointsEarned,
    });

    race.completedEntries = race.completedEntries || [];
    race.completedEntries.push({
      team: team._id,
      result: result._id,
      completedAt: new Date(),
    });
    await race.save();

    const populated = await RaceResult.findById(result._id)
      .populate('race')
      .populate('team')
      .populate('riders');

    res.status(201).send(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
  const teams = await Team.find().sort({ seasonPoints: -1 }).limit(5).populate('roster');
  const nextRace = await Race.findOne().sort({ date: 1 });
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
    topTeams: teams.map((t) => ({
      _id: t._id,
      name: t.name,
      budget: t.budget,
      wins: t.wins,
      seasonPoints: t.seasonPoints || 0,
    })),
    nextRace,
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
