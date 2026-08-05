const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: String,
  uciCode: String,
  classification: String,
  nationality: String,
  budget: Number,
  roster: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cyclist'
  }],
  staff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }],
  sponsors: {
    mainSponsor: String,
    secondarySponsors: [String],
    technicalSponsors: [String],
  },
  equipment: {
    bikeBrand: String,
    componentManufacturers: [String],
    clothingAndAccessories: [String],
  },
  facilities: {
    headquartersLocation: String,
    trainingFacilities: String,
    serviceCourse: String,
  },
  teamBus: {
    brand: String,
    model: String,
    features: [String],
  },
  supportVehicles: [{
    type: String,
    enum: ['car', 'van', 'truck']
  }],
  performanceMetrics: {
    uciRanking: Number,
    wins: Number,
    podiumFinishes: Number,
    pointsAccumulated: Number,
  },
  teamSpecialties: [String],
  teamCulture: {
    racingPhilosophy: String,
    trainingMethods: String,
    teamBuildingApproaches: String,
  },
  youthDevelopment: String,
  innovationLevel: String,
  mediaPresence: {
    socialMediaFollowing: Number,
    mediaCoverage: Number,
    publicRelationsEffectiveness: Number,
  },
  fanBase: Number,
  historicalPerformance: {
    pastMajorWins: [String],
    yearsInExistence: Number,
    notableAlumni: [String],
  },
  teamChemistry: Number,
  leadershipStructure: String,
  contractManagement: {
    averageContractLength: Number,
    salaryStructure: Number,
  },
  internationalDiversity: Number,
  tacticalFlexibility: Number,
  recoveryAndMedicalSupport: {
    qualityOfRecoveryProtocols: Number,
    medicalStaff: Number,
  },
  logisticsEfficiency: Number,
  sponsorshipAppeal: Number,
  environmentalImpact: String,
  communityEngagement: String,
  dataAnalyticsCapability: Number,
  brandStrength: Number,
  financialStability: Number,
  talentScouting: Number,
  reputation: {
    amongFans: Number,
    withinPeloton: Number,
    withRaceOrganizers: Number,
  }
});

module.exports = mongoose.model('Team', TeamSchema);
