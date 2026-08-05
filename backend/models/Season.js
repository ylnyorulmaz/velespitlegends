const mongoose = require('mongoose');

const SeasonSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  currentWeek: { type: Number, default: 1, min: 1 },
  totalWeeks: { type: Number, default: 30, min: 1 },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active',
  },
}, { timestamps: true });

module.exports = mongoose.model('Season', SeasonSchema);
