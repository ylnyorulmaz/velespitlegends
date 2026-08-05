const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const Cyclist = require('./models/Cyclist');
const Race = require('./models/Race');
const Team = require('./models/Team');
const Staff = require('./models/Staff');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/cycling_management';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

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

// Race routes
app.get('/api/races', async (req, res) => {
  const races = await Race.find();
  res.send(races);
});

app.post('/api/races', async (req, res) => {
  const race = new Race(req.body);
  await race.save();
  res.send(race);
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

// Serve static files from the Vue app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
