const mongoose = require('mongoose');

const CyclistSchema = new mongoose.Schema({
  name: String,
  salary: Number,
  physicalAttributes: {
    height: Number,
    weight: Number,
    bodyFatPercentage: Number,
    lungCapacity: Number,
    vo2Max: Number,
  },
  mentalAttributes: {
    mentalToughness: Number,
    concentration: Number,
    tacticalIntelligence: Number,
    leadership: Number,
    adaptability: Number,
    stressResistance: Number,
  },
  technicalSkills: {
    sprinting: Number,
    climbing: Number,
    timeTrialing: Number,
    descending: Number,
    cornering: Number,
    positioning: Number,
    bikeHandling: Number,
  },
  enduranceSkills: {
    aerobicEndurance: Number,
    anaerobicEndurance: Number,
    recoveryRate: Number,
    fatigueResistance: Number,
  },
  specializedSkills: {
    cobblestoneRiding: Number,
    crosswindRiding: Number,
    breakawayAbility: Number,
    leadoutSkills: Number,
    paceSetting: Number,
  },
  raceTypeSpecialization: {
    grandTourAptitude: Number,
    oneDayClassicAptitude: Number,
    stageRaceAptitude: Number,
    timeTrialSpecialist: Number,
  },
  environmentalAdaptations: {
    heatTolerance: Number,
    coldWeatherPerformance: Number,
    highAltitudeAdaptation: Number,
    wetConditionsHandling: Number,
  },
  teamRelatedSkills: {
    teamwork: Number,
    communication: Number,
    mentoringAbility: Number,
    followingTeamTactics: Number,
  },
  careerAttributes: {
    age: Number,
    experience: Number,
    potential: Number,
    fame: Number,
    versatility: Number,
  },
  formAndCondition: {
    currentForm: Number,
    fatigueLevel: Number,
    injuryProneness: Number,
    recoverySpeed: Number,
  },
  offBikeAttributes: {
    mediaHandling: Number,
    sponsorshipAppeal: Number,
    trainingDiscipline: Number,
    nutritionManagement: Number,
  },
});

module.exports = mongoose.model('Cyclist', CyclistSchema);
