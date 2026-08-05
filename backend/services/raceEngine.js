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

function raceDayScore(rider, profile) {
  const skill = profileSkill(rider, profile);
  const form = num(rider.form, 70);
  const fatigue = num(rider.fatigue, 20);
  const teamwork = num(rider.teamwork);
  // Keep variance small so profile/skills dominate
  const variance = Math.random() * 10;
  return skill * 0.72 + form * 0.2 + teamwork * 0.05 - fatigue * 0.28 + variance;
}

function makeRivals(profile, count = 8) {
  return Array.from({ length: count }, (_, i) => {
    const base = {
      name: RIVAL_NAMES[i % RIVAL_NAMES.length],
      sprint: 45 + Math.random() * 40,
      climb: 45 + Math.random() * 40,
      timeTrial: 45 + Math.random() * 40,
      endurance: 50 + Math.random() * 35,
      form: 55 + Math.random() * 30,
      fatigue: 10 + Math.random() * 30,
      teamwork: 40 + Math.random() * 30,
      specialty: 'none',
    };

    // Bias rivals so the peloton is competitive on the race profile
    if (profile === 'mountain') base.climb += 12;
    if (profile === 'flat') base.sprint += 12;
    if (profile === 'tt') base.timeTrial += 12;
    if (profile === 'classic') base.endurance += 10;

    return base;
  });
}

function buildNarrative(race, standings, teamName) {
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

  return [
    openers[profile] || openers.flat,
    middles[profile] || middles.hilly,
    finale,
    teamLine,
  ];
}

function applyConditionTick(riders, standings, race) {
  const distance = num(race.distance, 180);
  const changes = [];

  for (const rider of riders) {
    const row = standings.find((s) => s.isPlayer && String(s.cyclist) === String(rider._id));
    const position = row ? row.position : 99;
    const formBefore = num(rider.form, 70);
    const fatigueBefore = num(rider.fatigue, 20);

    const raceLoad = 8 + distance / 45 + (position > 10 ? 3 : position > 5 ? 1 : 0);
    let formDelta = 0;
    if (position === 1) formDelta = 5;
    else if (position <= 3) formDelta = 3;
    else if (position <= 8) formDelta = 1;
    else formDelta = -2;

    // Heavy fatigue blunts form gains
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

function simulateRace(race, riders, teamName) {
  const profile = race.profile || 'flat';
  const playerRows = riders.map((rider) => ({
    name: rider.name || 'Unknown rider',
    cyclist: rider._id,
    isPlayer: true,
    specialtyHint: rider.specialty || 'none',
    score: raceDayScore(rider, profile),
  }));

  const rivalRows = makeRivals(profile).map((rival) => ({
    name: rival.name,
    cyclist: null,
    isPlayer: false,
    specialtyHint: 'none',
    score: raceDayScore(rival, profile),
  }));

  const standings = [...playerRows, ...rivalRows].sort((a, b) => b.score - a.score);

  standings.forEach((row, index) => {
    row.position = index + 1;
    row.score = Math.round(row.score * 10) / 10;
    row.points = POINTS[index] || 0;
  });

  const narrative = buildNarrative(race, standings, teamName);
  const formChanges = applyConditionTick(riders, standings, race);
  const teamPointsEarned = standings
    .filter((row) => row.isPlayer)
    .reduce((sum, row) => sum + (row.points || 0), 0);

  const summary = narrative.join(' ');

  // Strip helper field before persistence
  standings.forEach((row) => {
    delete row.specialtyHint;
  });

  return {
    standings,
    narrative,
    summary,
    formChanges,
    teamPointsEarned,
  };
}

module.exports = { simulateRace, profileSkill };
