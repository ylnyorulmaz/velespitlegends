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

function buildSegments(race) {
  if (race.segments && race.segments.length) {
    return race.segments.map((segment) => ({
      km: num(segment.km, 10),
      profile: segment.profile || race.profile || 'flat',
      label: segment.label || segment.profile,
    }));
  }

  const distance = num(race.distance, 180);
  const profile = race.profile || 'flat';

  const templates = {
    flat: [
      { ratio: 0.55, profile: 'flat', label: 'Rolling roads' },
      { ratio: 0.25, profile: 'flat', label: 'Wind echelons' },
      { ratio: 0.20, profile: 'flat', label: 'Sprint finish' },
    ],
    hilly: [
      { ratio: 0.4, profile: 'flat', label: 'Opening phase' },
      { ratio: 0.35, profile: 'hilly', label: 'Middle climbs' },
      { ratio: 0.25, profile: 'hilly', label: 'Final uphill drag' },
    ],
    mountain: [
      { ratio: 0.3, profile: 'flat', label: 'Valley roads' },
      { ratio: 0.25, profile: 'hilly', label: 'Approach climbs' },
      { ratio: 0.35, profile: 'mountain', label: 'High mountains' },
      { ratio: 0.1, profile: 'flat', label: 'Descent to the line' },
    ],
    classic: [
      { ratio: 0.35, profile: 'flat', label: 'Neutralised start' },
      { ratio: 0.4, profile: 'classic', label: 'Cobbles and crosswinds' },
      { ratio: 0.25, profile: 'hilly', label: 'Final punch' },
    ],
    tt: [
      { ratio: 1, profile: 'tt', label: 'Full time trial' },
    ],
  };

  const parts = templates[profile] || templates.flat;
  const segments = parts.map((part) => ({
    km: Math.max(1, Math.round(distance * part.ratio)),
    profile: part.profile,
    label: part.label,
  }));

  const total = segments.reduce((sum, segment) => sum + segment.km, 0);
  if (total !== distance && segments.length) {
    segments[segments.length - 1].km += distance - total;
  }

  return segments;
}

function segmentScore(competitor, segmentProfile, context) {
  const { rng, staffBonus = 0 } = context;
  const roll = typeof rng === 'function' ? rng() : Math.random();
  const skill = profileSkill(competitor, segmentProfile);
  const form = num(competitor.form, 70);
  const fatigue = num(competitor.fatigue, 20);
  const variance = roll * 5;
  const staffBoost = competitor.isPlayer ? staffBonus * 0.015 : 0;
  const dropPenalty = competitor.dropped ? -20 : 0;

  return skill * 0.78 + form * 0.12 - fatigue * 0.22 + variance + staffBoost + dropPenalty;
}

function toCompetitor(rider, meta = {}) {
  return {
    name: rider.name || 'Unknown rider',
    cyclist: meta.cyclist !== undefined ? meta.cyclist : rider._id || null,
    isPlayer: Boolean(meta.isPlayer),
    specialty: rider.specialty || 'none',
    sprint: num(rider.sprint),
    climb: num(rider.climb),
    timeTrial: num(rider.timeTrial),
    endurance: num(rider.endurance),
    form: num(rider.form, 70),
    fatigue: num(rider.fatigue, 20),
    teamwork: num(rider.teamwork),
    cumulativeScore: 0,
    dropped: false,
  };
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

function resolveSegment(competitors, segment, kmEnd, totalDistance, context) {
  const active = competitors.filter((c) => !c.dropped);
  const weight = segment.km / totalDistance;
  const events = [];

  const scored = active.map((competitor) => ({
    competitor,
    score: segmentScore(competitor, segment.profile, context),
  }));

  scored.sort((a, b) => b.score - a.score);
  const average = scored.reduce((sum, row) => sum + row.score, 0) / (scored.length || 1);
  const hardSegment = segment.profile === 'mountain' || segment.profile === 'hilly';

  scored.forEach(({ competitor, score }, index) => {
    competitor.cumulativeScore += score * weight;

    const fatigueTick = segment.km / 22 + (hardSegment ? 2 : 0);
    competitor.fatigue = clamp(Math.round(competitor.fatigue + fatigueTick), 0, 100);

    if (
      hardSegment
      && index >= Math.floor(scored.length * 0.55)
      && score < average * 0.84
      && !competitor.dropped
    ) {
      competitor.dropped = true;
      events.push(`${competitor.name} is dropped on ${segment.label.toLowerCase()}.`);
    }
  });

  const leader = scored[0];
  const kmStart = kmEnd - segment.km;
  const leaderLine = `km ${kmStart}–${kmEnd} (${segment.label}): ${leader.competitor.name} leads the segment.`;
  events.unshift(leaderLine);

  const playerInSegment = scored.find((row) => row.competitor.isPlayer);
  if (
    playerInSegment
    && playerInSegment.competitor.specialty === 'breakaway'
    && playerInSegment === leader
  ) {
    events.push(`${playerInSegment.competitor.name} sails clear in the break.`);
  }

  if (
    segment.profile === 'classic'
    && playerInSegment
    && playerInSegment.competitor.specialty === 'cobbles'
    && playerInSegment.score >= average * 1.05
  ) {
    events.push(`${playerInSegment.competitor.name} handles the pavé near the front.`);
  }

  return {
    kmStart,
    kmEnd,
    profile: segment.profile,
    label: segment.label,
    leader: leader.competitor.name,
    leaderIsPlayer: leader.competitor.isPlayer,
    events,
    topThree: scored.slice(0, 3).map((row) => ({
      name: row.competitor.name,
      score: Math.round(row.score * 10) / 10,
      isPlayer: row.competitor.isPlayer,
    })),
  };
}

function buildNarrativeFromSegments(race, segmentLog, standings, teamName, staffBonus) {
  const winner = standings[0];
  const bestPlayer = standings.find((row) => row.isPlayer);

  const lines = [`${race.name} unfolds over ${num(race.distance, 180)} km.`];

  segmentLog.forEach((segment) => {
    lines.push(segment.events[0]);
    segment.events.slice(1).forEach((event) => lines.push(event));
  });

  lines.push(`${winner.name} wins${winner.isPlayer ? ` for ${teamName}` : ''}.`);

  if (bestPlayer) {
    lines.push(`${teamName} best: ${bestPlayer.name} in P${bestPlayer.position} (${bestPlayer.points} pts).`);
  } else {
    lines.push(`${teamName} fails to place a rider.`);
  }

  if (staffBonus > 0) {
    lines.push(`The ${teamName} staff setup added a small edge in the decisive phase.`);
  }

  return lines;
}

function applyConditionTick(riders, standings, race, competitors) {
  const distance = num(race.distance, 180);
  const prestige = num(race.prestige, 50);
  const changes = [];

  for (const rider of riders) {
    const competitor = competitors.find(
      (c) => c.isPlayer && String(c.cyclist) === String(rider._id),
    );
    if (competitor) {
      rider.fatigue = competitor.fatigue;
    }

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
    const fatigueAfter = clamp(Math.round(fatigueBefore + raceLoad * 0.35), 0, 100);

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
  const teamId = options.teamId || 'team';
  const seed = options.seed || `${race._id}-${teamId}-${race.date || ''}`;
  const rng = createRng(seed);
  const staffBonus = options.staffBonus || 0;
  const context = { rng, race, staffBonus };

  const segments = buildSegments(race);
  const totalDistance = segments.reduce((sum, segment) => sum + segment.km, 0);

  const competitors = [
    ...riders.map((rider) => toCompetitor(rider, { isPlayer: true, cyclist: rider._id })),
    ...makeRivals(race.profile || 'flat', rng).map((rival) => toCompetitor(rival, { isPlayer: false })),
  ];

  const segmentLog = [];
  let kmCursor = 0;

  segments.forEach((segment) => {
    kmCursor += segment.km;
    segmentLog.push(resolveSegment(competitors, segment, kmCursor, totalDistance, context));
  });

  const standings = competitors
    .map((competitor) => ({
      name: competitor.name,
      cyclist: competitor.cyclist,
      isPlayer: competitor.isPlayer,
      score: Math.round(competitor.cumulativeScore * 10) / 10,
      dropped: competitor.dropped,
    }))
    .sort((a, b) => b.score - a.score);

  standings.forEach((row, index) => {
    row.position = index + 1;
    row.points = POINTS[index] || 0;
  });

  const narrative = buildNarrativeFromSegments(race, segmentLog, standings, teamName, staffBonus);
  const formChanges = applyConditionTick(riders, standings, race, competitors);
  const teamPointsEarned = standings
    .filter((row) => row.isPlayer)
    .reduce((sum, row) => sum + (row.points || 0), 0);

  const summary = narrative.join(' ');

  standings.forEach((row) => {
    delete row.dropped;
  });

  return {
    standings,
    narrative,
    summary,
    formChanges,
    teamPointsEarned,
    segmentLog,
    segments,
    seed,
    staffBonus: Math.round(staffBonus * 10) / 10,
  };
}

// Legacy helper kept for tests / tooling
function raceDayScore(rider, profile, scoreContext = {}) {
  return segmentScore(toCompetitor(rider, { isPlayer: true }), profile, scoreContext);
}

module.exports = {
  simulateRace,
  profileSkill,
  createRng,
  staffTacticBonus,
  raceDifficulty,
  buildSegments,
  raceDayScore,
};
