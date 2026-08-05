const Cyclist = require('../models/Cyclist');
const Team = require('../models/Team');
const { computeMarketValue } = require('./injuryService');

async function listMarketCyclists() {
  const cyclists = await Cyclist.find({ team: null }).sort({ name: 1 });
  return cyclists.map((cyclist) => ({
    ...cyclist.toObject(),
    marketValue: computeMarketValue(cyclist),
  }));
}

async function signCyclist(teamId, cyclistId) {
  const team = await Team.findById(teamId);
  if (!team) throw new Error('Team not found');

  const cyclist = await Cyclist.findById(cyclistId);
  if (!cyclist) throw new Error('Cyclist not found');
  if (cyclist.team) throw new Error('Cyclist is already under contract');

  const cost = computeMarketValue(cyclist);
  if ((team.budget || 0) < cost) {
    throw new Error(`Insufficient budget. Need $${cost}, have $${team.budget || 0}.`);
  }

  team.budget = (team.budget || 0) - cost;
  team.roster = team.roster || [];
  if (!team.roster.some((id) => String(id) === String(cyclistId))) {
    team.roster.push(cyclist._id);
  }

  cyclist.team = team._id;
  if (!cyclist.salary) cyclist.salary = Math.round(cost / 12);

  await team.save();
  await cyclist.save();

  return { team, cyclist, cost };
}

async function releaseCyclist(teamId, cyclistId) {
  const team = await Team.findById(teamId);
  if (!team) throw new Error('Team not found');

  const cyclist = await Cyclist.findById(cyclistId);
  if (!cyclist) throw new Error('Cyclist not found');
  if (String(cyclist.team) !== String(teamId)) {
    throw new Error('Cyclist is not on this team');
  }

  team.roster = (team.roster || []).filter((id) => String(id) !== String(cyclistId));
  cyclist.team = null;

  await team.save();
  await cyclist.save();

  return { team, cyclist };
}

module.exports = {
  listMarketCyclists,
  signCyclist,
  releaseCyclist,
  computeMarketValue,
};
