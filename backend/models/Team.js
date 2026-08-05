const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nationality: String,
  budget: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  ranking: { type: Number, default: 0 },
  seasonPoints: { type: Number, default: 0 },
  roster: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cyclist',
  }],
  staff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
  }],
});

module.exports = mongoose.model('Team', TeamSchema);
