const mongoose = require('mongoose');

const RaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: Date,
  distance: { type: Number, default: 0 },
  profile: {
    type: String,
    enum: ['flat', 'hilly', 'mountain', 'classic', 'tt'],
    default: 'flat',
  },
  prestige: { type: Number, default: 50, min: 1, max: 100 },
  seasonWeek: { type: Number, min: 1, default: 1 },
  stageRace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StageRace',
    default: null,
  },
  stageNumber: { type: Number, min: 1, default: null },
  segments: [{
    km: Number,
    profile: {
      type: String,
      enum: ['flat', 'hilly', 'mountain', 'classic', 'tt'],
    },
    label: String,
  }],
  completedEntries: [{
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    result: { type: mongoose.Schema.Types.ObjectId, ref: 'RaceResult' },
    completedAt: { type: Date, default: Date.now },
  }],
});

module.exports = mongoose.model('Race', RaceSchema);
