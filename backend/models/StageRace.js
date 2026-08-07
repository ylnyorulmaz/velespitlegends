const mongoose = require('mongoose');

const StageResultSchema = new mongoose.Schema({
  stageNumber: Number,
  race: { type: mongoose.Schema.Types.ObjectId, ref: 'Race' },
  result: { type: mongoose.Schema.Types.ObjectId, ref: 'RaceResult' },
  points: { type: Number, default: 0 },
  timeSeconds: { type: Number, default: 0 },
  gapSeconds: { type: Number, default: 0 },
  bestRider: { type: String, default: '' },
}, { _id: false });

const GcStandingSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  totalPoints: { type: Number, default: 0 },
  totalTimeSeconds: { type: Number, default: 0 },
  stageWins: { type: Number, default: 0 },
  stagesCompleted: { type: Number, default: 0 },
  stageResults: [StageResultSchema],
}, { _id: false });

const StageRaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  seasonWeekStart: { type: Number, default: 1, min: 1 },
  prestige: { type: Number, default: 70, min: 1, max: 100 },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
  },
  gcStandings: [GcStandingSchema],
}, { timestamps: true });

module.exports = mongoose.model('StageRace', StageRaceSchema);
