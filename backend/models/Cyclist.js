const mongoose = require('mongoose');

const CyclistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  salary: { type: Number, default: 0 },
  age: { type: Number, default: 24 },
  potential: { type: Number, default: 50, min: 1, max: 100 },
  sprint: { type: Number, default: 50, min: 1, max: 100 },
  climb: { type: Number, default: 50, min: 1, max: 100 },
  timeTrial: { type: Number, default: 50, min: 1, max: 100 },
  endurance: { type: Number, default: 50, min: 1, max: 100 },
  form: { type: Number, default: 70, min: 1, max: 100 },
  fatigue: { type: Number, default: 20, min: 0, max: 100 },
  specialty: {
    type: String,
    enum: ['none', 'cobbles', 'breakaway', 'leadout'],
    default: 'none',
  },
  teamwork: { type: Number, default: 50, min: 1, max: 100 },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
  },
  injury: {
    type: {
      type: String,
      enum: ['none', 'crash', 'illness'],
      default: 'none',
    },
    weeksRemaining: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
  },
});

module.exports = mongoose.model('Cyclist', CyclistSchema);
