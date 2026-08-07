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
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
  },
  teamName: { type: String, default: '' },
  score: Number,
  points: { type: Number, default: 0 },
  timeSeconds: { type: Number, default: 0 },
  gapSeconds: { type: Number, default: 0 },
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

// Note: field named "type" must use { type: String } or Mongoose treats the
// whole subdocument as a String (classic CastError on arrays of objects).
const RandomEventSchema = new mongoose.Schema({
  type: { type: String },
  kind: { type: String },
  rider: { type: String },
  isPlayer: { type: Boolean, default: false },
  scoreDelta: { type: Number },
  message: { type: String },
}, { _id: false });

const SegmentLogSchema = new mongoose.Schema({
  kmStart: Number,
  kmEnd: Number,
  profile: String,
  label: String,
  leader: String,
  leaderIsPlayer: { type: Boolean, default: false },
  events: [String],
  randomEvents: [RandomEventSchema],
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
  rivalTeamCount: { type: Number, default: 0 },
  teamResults: [{
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    teamName: { type: String },
    isPlayer: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    bestPosition: { type: Number },
    bestTimeSeconds: { type: Number, default: 0 },
    bestRider: { type: String, default: '' },
  }],
  injuriesApplied: [{
    cyclist: { type: mongoose.Schema.Types.ObjectId, ref: 'Cyclist' },
    name: { type: String },
    type: { type: String },
    weeksRemaining: { type: Number },
    description: { type: String },
  }],
  stageRace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StageRace',
    default: null,
  },
  stageNumber: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RaceResult', RaceResultSchema);
