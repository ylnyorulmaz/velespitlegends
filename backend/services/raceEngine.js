const POINTS = [25, 20, 16, 14, 12, 10, 8, 6, 4, 2];

const RIVAL_NAMES = [
  'Luca Verdon', 'Jonas Kite', 'Mateo Rivas', 'Erik Holm', 'Piotr Vale',
  'Samir Costa', 'Nils Berger', 'Hugo March', 'Kenji Arai', 'Owen Blake',
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function num(value, fallback = 50) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Deterministic PRNG from a string seed (same seed → same race outcome). */
function createRng(seedString) {
  let h = 2166136261;
  const str = String(seedString);
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return function next() {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function staffTacticBonus(staffMembers) {
  if (!staffMembers || !staffMembers.length) return 0;
  return staffMembers.reduce(
    (sum, member) => sum + num(member.skillLevel, 50) * 0.5 + num(member.experience, 0) * 0.2,
    0,
  );
}

function raceDifficulty(race) {
  const prestige = num(race?.prestige, 50);
  const distance = num(race?.distance, 180);
  return (prestige / 100) * clamp(distance / 200, 0.5, 1.5);
}

function profileSkill(rider, profile) {
  const sprint = num(rider.sprint);
  const climb = num(rider.climb);
  const tt = num(rider.timeTrial);
  const endurance = num(rider.endurance);
  const teamwork = num(rider.teamwork);
  const specialty = rider.specialty || 'none';

  switch (profile) {
    case 'flat':
      return sprint * 0.7 + endurance * 0.25 + (specialty === 'leadout' ? 8 : 0);
    case 'hilly':
      return climb * 0.45 + endurance * 0.4 + sprint * 0.15;
    case 'mountain':
      return climb * 0.75 + endurance * 0.25;
    case 'classic':
      return endurance * 0.4 + sprint * 0.3 + teamwork * 0.1
        + (specialty === 'cobbles' ? 14 : 0)
        + (specialty === 'breakaway' ? 8 : 0);
    case 'tt':
      return tt * 0.85 + endurance * 0.15;
    default:
      return endurance;
  }
}

function raceDayScore(rider, profile, context = {}) {
  const { rng = Math.random, race, staffBonus = 0 } = context;
  const roll = typeof rng === 'function' ? rng() : Math.random();

  const skill = profileSkill(rider, profile);
  const form = num(rider.form, 70);
  const fatigue = num(rider.fatigue, 20);
  const teamwork = num(rider.teamwork);

  const difficulty = raceDifficulty(race);
  const varianceMax = clamp(12 - difficulty * 4, 4, 10);
  const variance = roll * varianceMax;
  const staffBoost = staffBonus * 0.03;

  return skill * 0.72 + form * 0.2 + teamwork * 0.05 - fatigue * 0.28 + variance + staffBoost;
}

function makeRivals(profile, rng, count = 8) {
  return Array.from({ length: count }, (_, i) => {
    const base = {
      name: RIVAL_NAMES[i % RIVAL_NAMES.length],
      sprint: 45 + rng() * 40,
      climb: 45 + rng() * 40,
      timeTrial: 45 + rng() * 40,
      endurance: 50 + rng() * 35,
      form: 55 + rng() * 30,
      fatigue: 10 + rng() * 30,
      teamwork: 40 + rng() * 30,
      specialty: 'none',
    };

    if (profile === 'mountain') base.climb += 12;
    if (profile === 'flat') base.sprint += 12;
    if (profile === 'tt') base.timeTrial += 12;
    if (profile === 'classic') base.endurance += 10;

    return base;
  });
}

function buildNarrative(race, standings, teamName, staffBonus) {
  const profile = race.profile || 'flat';
  const distance = race.distance || 180;
  const winner = standings[0];
  const bestPlayer = standings.find((row) => row.isPlayer);
  const playerLeader = standings.filter((row) => row.isPlayer).slice(0, 2);

  const openers = {
    flat: `The bunch stays glued through the first ${Math.round(distance * 0.4)} km of ${race.name}.`,
    hilly: `Early rollers on ${race.name} already stretch the peloton.`,
    mountain: `The road tilts up and the mountain men move forward on ${race.name}.`,
    classic: `Crosswinds and rough roads shred the race at ${race.name}.`,
    tt: `One by one, riders roll down the ramp at ${race.name}.`,
  };

  const middles = {
    flat: `${playerLeader[0] ? playerLeader[0].name : 'A domestique'} tries to keep the sprinters calm into the final circuit.`,
    hilly: `A sharp climb with ${Math.round(distance * 0.2)} km left blows the front group apart.`,
    mountain: `On the decisive ascent, pure climbing watts decide who survives.`,
    classic: `Cobbles and fatigue punish anyone short on endurance.`,
    tt: `Splits appear against the clock; aero position and power win the day.`,
  };

  if (profile === 'classic' && bestPlayer && bestPlayer.specialtyHint === 'cobbles') {
    middles.classic = `${bestPlayer.name} thrives on the pavé and stays near the front.`;
  }
  if (profile === 'mountain' && bestPlayer) {
    middles.mountain = `${bestPlayer.name} sets a hard tempo on the steepest slopes.`;
  }
  if (profile === 'flat' && bestPlayer) {
    middles.flat = `${bestPlayer.name} fights for the wheels into the final kilometre.`;
  }

  const finale = `${winner.name} takes the win${winner.isPlayer ? ` for ${teamName}` : ''}.`;
  const teamLine = bestPlayer
    ? `${teamName} best: ${bestPlayer.name} in P${bestPlayer.position} (${bestPlayer.points} pts).`
    : `${teamName} fails to place a rider.`;

  const lines = [
    openers[profile] || openers.flat,
    middles[profile] || middles.hilly,
    finale,
    teamLine,
  ];

  if (staffBonus > 0) {
    lines.push(`The ${teamName} staff setup added a small edge in the decisive phase.`);
  }

  return lines;
}

function applyConditionTick(riders, standings, race) {
  const distance = num(race.distance, 180);
  const prestige = num(race.prestige, 50);
  const changes = [];

  for (const rider of riders) {
    const row = standings.find((s) => s.isPlayer && String(s.cyclist) === String(rider._id));
    const position = row ? row.position : 99;
    const formBefore = num(rider.form, 70);
    const fatigueBefore = num(rider.fatigue, 20);

    const raceLoad = 8 + distance / 45 + (prestige / 100) * 4 + (position > 10 ? 3 : position > 5 ? 1 : 0);
    let formDelta = 0;
    if (position === 1) formDelta = 5;
    else if (position <= 3) formDelta = 3;
    else if (position <= 8) formDelta = 1;
    else formDelta = -2;

    formDelta -= Math.floor(raceLoad / 6);

    const formAfter = clamp(Math.round(formBefore + formDelta), 1, 100);
    const fatigueAfter = clamp(Math.round(fatigueBefore + raceLoad), 0, 100);

    changes.push({
      cyclist: rider._id,
      name: rider.name,
      formBefore,
      formAfter,
      formDelta: formAfter - formBefore,
      fatigueBefore,
      fatigueAfter,
      fatigueDelta: fatigueAfter - fatigueBefore,
    });

    rider.form = formAfter;
    rider.fatigue = fatigueAfter;
  }

  return changes;
}

function simulateRace(race, riders, teamName, options = {}) {
  const profile = race.profile || 'flat';
  const teamId = options.teamId || 'team';
  const seed = options.seed || `${race._id}-${teamId}-${race.date || ''}`;
  const rng = createRng(seed);
  const staffBonus = options.staffBonus || 0;
  const scoreContext = { rng, race, staffBonus };

  const playerRows = riders.map((rider) => ({
    name: rider.name || 'Unknown rider',
    cyclist: rider._id,
    isPlayer: true,
    specialtyHint: rider.specialty || 'none',
    score: raceDayScore(rider, profile, scoreContext),
  }));

  const rivalRows = makeRivals(profile, rng).map((rival) => ({
    name: rival.name,
    cyclist: null,
    isPlayer: false,
    specialtyHint: 'none',
    score: raceDayScore(rival, profile, { rng, race, staffBonus: 0 }),
  }));

  const standings = [...playerRows, ...rivalRows].sort((a, b) => b.score - a.score);

  standings.forEach((row, index) => {
    row.position = index + 1;
    row.score = Math.round(row.score * 10) / 10;
    row.points = POINTS[index] || 0;
  });

  const narrative = buildNarrative(race, standings, teamName, staffBonus);
  const formChanges = applyConditionTick(riders, standings, race);
  const teamPointsEarned = standings
    .filter((row) => row.isPlayer)
    .reduce((sum, row) => sum + (row.points || 0), 0);

  const summary = narrative.join(' ');

  standings.forEach((row) => {
    delete row.specialtyHint;
  });

  return {
    standings,
    narrative,
    summary,
    formChanges,
    teamPointsEarned,
    seed,
    staffBonus: Math.round(staffBonus * 10) / 10,
  };
}

module.exports = {
  simulateRace,
  profileSkill,
  createRng,
  staffTacticBonus,
  raceDifficulty,
};
