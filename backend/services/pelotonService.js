const Team = require('../models/Team');
const { isInjured } = require('./injuryService');
const { staffTacticBonus, profileSkill, normalizeRoles } = require('./raceEngine');

const PROFILE_TACTIC = {
  flat: 'sprint_train',
  hilly: 'attack',
  mountain: 'climb_pace',
  classic: 'attack',
  tt: 'balanced',
};

function sortByRaceFitness(riders, profile) {
  return [...riders].sort((a, b) => profileSkill(b, profile) - profileSkill(a, profile));
}

function autoRolesForSquad(riders, profile) {
  const ids = riders.map((r) => String(r._id));
  const ranked = sortByRaceFitness(riders, profile);
  const raw = {};
  if (ranked[0]) raw[String(ranked[0]._id)] = 'leader';

  ranked.slice(1).forEach((rider) => {
    const id = String(rider._id);
    if (profile === 'flat' || profile === 'classic') {
      raw[id] = num(rider.sprint) >= num(rider.climb) ? 'sprinter' : 'domestique';
    } else if (profile === 'mountain' || profile === 'hilly') {
      raw[id] = num(rider.climb) >= 60 ? 'climber' : 'domestique';
    } else {
      raw[id] = 'domestique';
    }
  });

  // Ensure at least one domestique / protected mix
  return normalizeRoles(ids, raw);
}

function num(value, fallback = 50) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build AI squads from other DB teams that have not yet completed this race.
 */
async function buildRivalSquads({
  playerTeamId,
  race,
  completedTeamIds = [],
  maxTeams = 5,
  ridersPerTeam = 6,
} = {}) {
  const excluded = new Set(
    [...completedTeamIds, playerTeamId].filter(Boolean).map((id) => String(id)),
  );

  const teams = await Team.find().populate('roster').populate('staff').sort({ _id: 1 });
  const profile = (race && race.profile) || 'flat';
  const squads = [];

  for (const team of teams) {
    if (excluded.has(String(team._id))) continue;

    const available = (team.roster || []).filter(
      (rider) => rider && rider._id && !isInjured(rider) && rider.name && String(rider.name).trim(),
    );
    if (available.length < 3) continue;

    const selected = sortByRaceFitness(available, profile)
      .slice(0, Math.min(ridersPerTeam, 8, available.length));
    if (selected.length < 3) continue;

    squads.push({
      teamId: team._id,
      teamName: team.name,
      riders: selected,
      staffBonus: staffTacticBonus(team.staff || []),
      tactic: PROFILE_TACTIC[profile] || 'balanced',
      roles: autoRolesForSquad(selected, profile),
    });

    if (squads.length >= maxTeams) break;
  }

  return squads;
}

function summarizeTeamResults(standings) {
  const byTeam = new Map();

  for (const row of standings || []) {
    const key = row.teamId ? String(row.teamId) : (row.isPlayer ? 'player' : 'field');
    if (!row.teamId && !row.isPlayer) continue;

    const prev = byTeam.get(key) || {
      teamId: row.teamId || null,
      teamName: row.teamName || (row.isPlayer ? 'Player' : 'Field'),
      isPlayer: Boolean(row.isPlayer),
      points: 0,
      bestPosition: row.position,
      riderCount: 0,
    };

    prev.points += row.points || 0;
    prev.bestPosition = Math.min(prev.bestPosition, row.position);
    prev.riderCount += 1;
    if (row.teamName) prev.teamName = row.teamName;
    if (row.isPlayer) prev.isPlayer = true;
    byTeam.set(key, prev);
  }

  return Array.from(byTeam.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.bestPosition - b.bestPosition;
  });
}

module.exports = {
  buildRivalSquads,
  summarizeTeamResults,
  autoRolesForSquad,
  sortByRaceFitness,
};
