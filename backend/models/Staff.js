const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  name: String,
  role: String,
  experience: Number,
  skillLevel: Number,
  specialization: String,
  salary: Number,
  morale: Number,
  relationshipWithRiders: Number,
  relationshipWithOtherStaff: Number,
});

module.exports = mongoose.model('Staff', StaffSchema);
