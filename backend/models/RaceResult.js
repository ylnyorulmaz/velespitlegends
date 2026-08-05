const mongoose = require('mongoose');

const StandingSchema = new mongoose.Schema({
  position: Number,
  name: String,
  cyclist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cyclist',
    default: null,
  },
  isPlayer: { type: Boolean, default: false },
  score: Number,
  points: { type: Number, default: 0 },
}, { _id: false });

const FormChangeSchema = new mongoose.Schema({
  cyclist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cyclist',
  },
  name: String,
  formBefore: Number,
  formAfter: Number,
  formDelta: Number,
  fatigueBefore: Number,
  fatigueAfter: Number,
  fatigueDelta: Number,
}, { _id: false });

const SegmentTopSchema = new mongoose.Schema({
  name: String,
  score: Number,
  isPlayer: { type: Boolean, default: false },
}, { _id: false });

const SegmentLogSchema = new mongoose.Schema({
  kmStart: Number,
  kmEnd: Number,
  profile: String,
  label: String,
  leader: String,
  leaderIsPlayer: { type: Boolean, default: false },
  events: [String],
  randomEvents: [{
    type: String,
    kind: String,
    rider: String,
    isPlayer: { type: Boolean, default: false },
    scoreDelta: Number,
    message: String,
  }],
  topThree: [SegmentTopSchema],
}, { _id: false });

const RaceResultSchema = new mongoose.Schema({
  race: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Race',
    required: true,
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  riders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cyclist',
  }],
  summary: { type: String, default: '' },
  narrative: [String],
  segmentLog: [SegmentLogSchema],
  tactic: {
    type: String,
    default: 'balanced',
  },
  riderRoles: [{
    cyclist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cyclist',
    },
    name: String,
    role: String,
  }],
  standings: [StandingSchema],
  formChanges: [FormChangeSchema],
  teamPointsEarned: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RaceResult', RaceResultSchema);
