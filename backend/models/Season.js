const mongoose = require('mongoose');

const DevelopmentLedgerSchema = new mongoose.Schema({
  week: Number,
  cyclist: { type: mongoose.Schema.Types.ObjectId, ref: 'Cyclist' },
  name: String,
  changes: [{
    skill: String,
    delta: Number,
    reason: String,
  }],
}, { _id: false });

const SeasonSummarySchema = new mongoose.Schema({
  generatedAt: { type: Date, default: Date.now },
  champion: {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    name: String,
    seasonPoints: Number,
    wins: Number,
  },
  budgetLeader: {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    name: String,
    budget: Number,
  },
  mostImproved: [{
    cyclist: { type: mongoose.Schema.Types.ObjectId, ref: 'Cyclist' },
    name: String,
    netDelta: Number,
    highlights: [String],
  }],
  mostDeclined: [{
    cyclist: { type: mongoose.Schema.Types.ObjectId, ref: 'Cyclist' },
    name: String,
    netDelta: Number,
    highlights: [String],
  }],
  topScorers: [{
    name: String,
    points: Number,
    races: Number,
  }],
  headline: { type: String, default: '' },
}, { _id: false });

const SeasonSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  currentWeek: { type: Number, default: 1, min: 1 },
  totalWeeks: { type: Number, default: 30, min: 1 },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
  },
  developmentLedger: [DevelopmentLedgerSchema],
  summary: SeasonSummarySchema,
}, { timestamps: true });

module.exports = mongoose.model('Season', SeasonSchema);
