const Cyclist = require('../models/Cyclist');

function computeMarketValue(cyclist) {
  const avgSkill = (
    (cyclist.sprint || 50)
    + (cyclist.climb || 50)
    + (cyclist.timeTrial || 50)
    + (cyclist.endurance || 50)
  ) / 4;
  const potential = cyclist.potential || 50;
  const ageFactor = cyclist.age && cyclist.age > 32 ? 0.85 : 1;
  return Math.round((avgSkill * 1200 + potential * 600) * ageFactor);
}

function isInjured(cyclist) {
  return cyclist.injury
    && cyclist.injury.type !== 'none'
    && (cyclist.injury.weeksRemaining || 0) > 0;
}

function injuryLabel(cyclist) {
  if (!isInjured(cyclist)) return null;
  const type = cyclist.injury.type === 'crash' ? 'Crash recovery' : 'Illness';
  return `${type} (${cyclist.injury.weeksRemaining}w)`;
}

function extractInjuriesFromSegmentLog(segmentLog, riders, rng = Math.random) {
  const riderByName = new Map(riders.map((rider) => [rider.name, rider]));
  const injuries = [];
  const seen = new Set();

  for (const segment of segmentLog || []) {
    for (const event of segment.randomEvents || []) {
      if (!event.isPlayer || seen.has(event.rider)) continue;
      if (event.type !== 'crash' && event.type !== 'illness') continue;

      const rider = riderByName.get(event.rider);
      if (!rider) continue;

      seen.add(event.rider);
      const weeks = event.type === 'crash'
        ? 2 + Math.floor(rng() * 3)
        : 1 + Math.floor(rng() * 2);

      injuries.push({
        cyclist: rider._id,
        name: rider.name,
        type: event.type,
        weeksRemaining: weeks,
        description: event.type === 'crash'
          ? 'Injured in a race crash — needs recovery time.'
          : 'Medical issues after the race — sidelined for recovery.',
      });
    }
  }

  return injuries;
}

async function applyInjuries(injuries) {
  const updated = [];
  for (const injury of injuries) {
    const rider = await Cyclist.findById(injury.cyclist);
    if (!rider) continue;
    rider.injury = {
      type: injury.type,
      weeksRemaining: injury.weeksRemaining,
      description: injury.description,
    };
    rider.form = Math.max(1, (rider.form || 70) - (injury.type === 'crash' ? 8 : 4));
    await rider.save();
    updated.push(rider);
  }
  return updated;
}

async function tickInjuryRecovery() {
  const injured = await Cyclist.find({ 'injury.weeksRemaining': { $gt: 0 } });
  const recovered = [];

  for (const rider of injured) {
    rider.injury.weeksRemaining = Math.max(0, (rider.injury.weeksRemaining || 0) - 1);
    if (rider.injury.weeksRemaining === 0) {
      rider.injury = { type: 'none', weeksRemaining: 0, description: '' };
      recovered.push(rider.name);
    }
    await rider.save();
  }

  return { ticked: injured.length, recovered };
}

module.exports = {
  computeMarketValue,
  isInjured,
  injuryLabel,
  extractInjuriesFromSegmentLog,
  applyInjuries,
  tickInjuryRecovery,
};
