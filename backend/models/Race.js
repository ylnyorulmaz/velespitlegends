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
});

module.exports = mongoose.model('Race', RaceSchema);
