const Season = require('../models/Season');
const Cyclist = require('../models/Cyclist');

async function getOrCreateSeason() {
  let season = await Season.findOne({ status: 'active' }).sort({ createdAt: -1 });
  if (!season) {
    season = await Season.create({
      year: new Date().getFullYear(),
      currentWeek: 1,
      totalWeeks: 30,
      status: 'active',
    });
  }
  return season;
}

async function advanceSeasonWeek() {
  const season = await getOrCreateSeason();
  if (season.currentWeek >= season.totalWeeks) {
    season.status = 'completed';
    await season.save();
    return { season, message: 'Season completed — no more weeks to advance.' };
  }

  season.currentWeek += 1;
  await season.save();

  const cyclists = await Cyclist.find();
  await Promise.all(cyclists.map(async (rider) => {
    rider.fatigue = Math.max(0, (rider.fatigue || 0) - 5);
    rider.form = Math.min(100, (rider.form || 70) + 1);
    await rider.save();
  }));

  const { tickInjuryRecovery } = require('./injuryService');
  const injuryTick = await tickInjuryRecovery();

  return {
    season,
    message: `Advanced to week ${season.currentWeek}. All riders recovered slightly.`,
    ridersRecovered: cyclists.length,
    injuryRecovery: injuryTick,
  };
}

module.exports = {
  getOrCreateSeason,
  advanceSeasonWeek,
};
