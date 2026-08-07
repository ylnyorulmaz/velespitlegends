const POINTS = [25, 20, 16, 14, 12, 10, 8, 6, 4, 2];

const TACTICS = {
  balanced: {
    label: 'Balanced',
    description: 'Standard racing — no special bonuses or penalties.',
  },
  control: {
    label: 'Control the peloton',
    description: 'Steady tempo; your riders resist being dropped on climbs.',
  },
  attack: {
    label: 'Attack',
    description: 'Aggressive racing with bonuses on hilly, mountain, and classic segments.',
  },
  defend: {
    label: 'Defend',
    description: 'Protect positions; lower drop risk, slightly slower on flat roads.',
  },
  sprint_train: {
    label: 'Sprint train',
    description: 'Organise for a bunch sprint — big bonus on the final flat segment.',
  },
  climb_pace: {
    label: 'Climb pace',
    description: 'Hard tempo on climbs — bonus on hilly and mountain segments.',
  },
};

const VALID_TACTICS = Object.keys(TACTICS);

const RIDER_ROLES = {
  leader: {
    label: 'Leader',
    description: 'Protected finisher — bonus on the final segment and domestique support.',
  },
  sprinter: {
    label: 'Sprinter',
    description: 'Bonus on flat finishes; ideal for bunch sprints.',
  },
  climber: {
    label: 'Climber',
    description: 'Bonus on hilly and mountain segments.',
  },
  domestique: {
    label: 'Domestique',
    description: 'Works for the leader — boosts leader score, extra fatigue.',
  },
  protected: {
    label: 'Protected',
    description: 'Less likely to be dropped on climbs.',
  },
};

const VALID_ROLES = Object.keys(RIDER_ROLES);

const RANDOM_EVENTS = {
  flat_tire: {
    kind: 'negative',
    scoreDelta: -12,
    fatigueDelta: 8,
    drop: false,
    message: (name) => `${name} punctures and loses time at the roadside.`,
  },
  mechanical: {
    kind: 'negative',
    scoreDelta: -10,
    fatigueDelta: 6,
    drop: false,
    message: (name) => `${name} suffers a mechanical and slips back.`,
  },
  crash: {
    kind: 'negative',
    scoreDelta: -20,
    fatigueDelta: 15,
    drop: true,
    message: (name) => `${name} crashes and is left behind the peloton.`,
  },
  illness: {
    kind: 'negative',
    scoreDelta: -8,
    fatigueDelta: 12,
    drop: false,
    message: (name) => `${name} is struggling with sudden stomach cramps.`,
  },
  tailwind: {
    kind: 'positive',
    scoreDelta: 8,
    fatigueDelta: -4,
    drop: false,
    message: (name) => `${name} catches a tailwind and surges forward.`,
  },
  perfect_pacing: {
    kind: 'positive',
    scoreDelta: 6,
    fatigueDelta: -6,
    drop: false,
    message: (name) => `${name} nails the pacing and moves up effortlessly.`,
  },
  second_wind: {
    kind: 'positive',
    scoreDelta: 11,
    fatigueDelta: -10,
    drop: false,
    message: (name) => `${name} finds a second wind on the climb.`,
  },
  lucky_break: {
    kind: 'positive',
    scoreDelta: 9,
    fatigueDelta: 0,
    drop: false,
    message: (name) => `${name} slips through a gap as rivals hesitate.`,
  },
};

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

function normalizeTactic(tactic) {
  const key = String(tactic || 'balanced').toLowerCase();
  return VALID_TACTICS.includes(key) ? key : 'balanced';
}

function normalizeRoles(cyclistIds, rolesInput = {}) {
  const map = {};
  let leaderAssigned = false;

  cyclistIds.forEach((id) => {
    let role = String(rolesInput[id] || rolesInput[String(id)] || 'domestique').toLowerCase();
    if (!VALID_ROLES.includes(role)) role = 'domestique';
    if (role === 'leader') {
      if (leaderAssigned) role = 'domestique';
      else leaderAssigned = true;
    }
    map[String(id)] = role;
  });

  return map;
}

function buildTeamComposition(activePlayers) {
  const domestiquesActive = activePlayers.filter(
    (c) => c.role === 'domestique' && !c.dropped,
  ).length;
  const hasLeader = activePlayers.some((c) => c.role === 'leader' && !c.dropped);
  return { domestiquesActive, hasLeader };
}

function roleSegmentBonus(competitor, segmentProfile, context) {
  if (!competitor.isPlayer) return 0;

  const { segmentMeta = {}, teamComposition = {} } = context;
  const role = competitor.role || 'domestique';
  const isClimbSegment = segmentProfile === 'hilly' || segmentProfile === 'mountain';
  const isFlatSegment = segmentProfile === 'flat';
  let bonus = 0;

  switch (role) {
    case 'sprinter':
      if (segmentMeta.isLastSegment && isFlatSegment) {
        bonus += 8 + num(competitor.sprint) * 0.04;
        if (competitor.specialty === 'leadout') bonus += 4;
      }
      break;
    case 'climber':
      if (isClimbSegment) bonus += 6 + num(competitor.climb) * 0.03;
      break;
    case 'leader':
      if (segmentMeta.isLastSegment) bonus += 5;
      if (teamComposition.hasLeader && teamComposition.domestiquesActive) {
        bonus += Math.min(teamComposition.domestiquesActive * 3, 9);
      }
      break;
    case 'protected':
      if (isClimbSegment) bonus += 2;
      break;
    default:
      break;
  }

  return bonus;
}

function roleDropThreshold(competitor, baseThreshold) {
  if (competitor.isPlayer && competitor.role === 'protected') {
    return baseThreshold - 0.06;
  }
  return baseThreshold;
}

function tacticSegmentBonus(competitor, segmentProfile, tactic, segmentMeta = {}) {
  if (!competitor.isPlayer) return 0;

  const teamwork = num(competitor.teamwork);
  const climb = num(competitor.climb);
  const sprint = num(competitor.sprint);
  const specialty = competitor.specialty || 'none';
  const isClimbSegment = segmentProfile === 'hilly' || segmentProfile === 'mountain';
  const isFlatSegment = segmentProfile === 'flat';
  const isClassic = segmentProfile === 'classic';

  switch (tactic) {
    case 'control':
      return teamwork * 0.12 + (isClimbSegment ? 3 : 0);
    case 'attack':
      if (isClimbSegment || isClassic) {
        return (specialty === 'breakaway' ? 8 : 4) + teamwork * 0.05;
      }
      return 0;
    case 'defend':
      return isFlatSegment ? -2 : (isClimbSegment ? 4 : 1);
    case 'sprint_train':
      if (segmentMeta.isLastSegment && isFlatSegment) {
        return (specialty === 'leadout' || specialty === 'none' ? 10 : 6) + sprint * 0.06;
      }
      return isFlatSegment ? sprint * 0.03 : 0;
    case 'climb_pace':
      if (isClimbSegment) {
        return (climb >= 75 ? 9 : 5) + climb * 0.04;
      }
      return 0;
    default:
      return 0;
  }
}

function dropThreshold(tactic, hardSegment) {
  if (!hardSegment) return 0.84;
  if (tactic === 'defend') return 0.76;
  if (tactic === 'control') return 0.80;
  if (tactic === 'attack') return 0.88;
  return 0.84;
}

function rollRandomEvents(active, segment, context) {
  const { rng, tactic } = context;
  const hardSegment = segment.profile === 'mountain' || segment.profile === 'hilly' || segment.profile === 'classic';
  const eventChance = (0.12 + (hardSegment ? 0.05 : 0)) * (tactic === 'attack' ? 1.15 : 1);
  const eventCount = rng() < eventChance ? 1 : (rng() < eventChance * 0.3 ? 2 : 0);

  if (!eventCount || !active.length) {
    return { events: [], randomEvents: [] };
  }

  const eventKeys = Object.keys(RANDOM_EVENTS);
  const randomEvents = [];
  const applied = new Set();

  for (let i = 0; i < eventCount; i += 1) {
    const pool = active.filter((c) => !c.dropped);
    if (!pool.length) break;

    const target = pool[Math.floor(rng() * pool.length)];
    const targetKey = target.name + target.isPlayer;
    if (applied.has(targetKey) && pool.length > 1) continue;
    applied.add(targetKey);

    const positiveBias = target.isPlayer ? 0.4 : 0.32;
    const wantPositive = rng() < positiveBias;
    const candidates = eventKeys.filter((key) => RANDOM_EVENTS[key].kind === (wantPositive ? 'positive' : 'negative'));
    const eventKey = candidates[Math.floor(rng() * candidates.length)] || eventKeys[0];
    const def = RANDOM_EVENTS[eventKey];

    target.segmentMod = target.segmentMod || { scoreDelta: 0, fatigueDelta: 0, forceDrop: false };
    target.segmentMod.scoreDelta += def.scoreDelta;
    target.segmentMod.fatigueDelta += def.fatigueDelta;
    if (def.drop) target.segmentMod.forceDrop = true;

    randomEvents.push({
      type: eventKey,
      kind: def.kind,
      rider: target.name,
      isPlayer: target.isPlayer,
      scoreDelta: def.scoreDelta,
      message: def.message(target.name),
    });
  }

  return {
    events: randomEvents.map((event) => event.message),
    randomEvents,
  };
}

function segmentScore(competitor, segmentProfile, context) {
  const { rng, segmentMeta = {} } = context;
  const tactic = competitor.tactic || context.tactic || 'balanced';
  const staffBonus = competitor.staffBonus != null ? competitor.staffBonus : (context.staffBonus || 0);
  const roll = typeof rng === 'function' ? rng() : Math.random();
  const skill = profileSkill(competitor, segmentProfile);
  const form = num(competitor.form, 70);
  const fatigue = num(competitor.fatigue, 20);
  const varianceRoll = tactic === 'attack' ? roll * 7 : roll * 5;
  const staffBoost = staffBonus * 0.015;
  const dropPenalty = competitor.dropped ? -20 : 0;
  const tacticBoost = tacticSegmentBonus(competitor, segmentProfile, tactic, segmentMeta);
  const roleBoost = roleSegmentBonus(competitor, segmentProfile, context);
  const eventBoost = competitor.segmentMod ? num(competitor.segmentMod.scoreDelta, 0) : 0;

  return skill * 0.78 + form * 0.12 - fatigue * 0.22 + varianceRoll + staffBoost + dropPenalty + tacticBoost + roleBoost + eventBoost;
}

function toCompetitor(rider, meta = {}) {
  return {
    name: rider.name || 'Unknown rider',
    cyclist: meta.cyclist !== undefined ? meta.cyclist : rider._id || null,
    isPlayer: Boolean(meta.isPlayer),
    teamId: meta.teamId || null,
    teamName: meta.teamName || (meta.isPlayer ? 'Player' : 'Field'),
    specialty: rider.specialty || 'none',
    sprint: num(rider.sprint),
    climb: num(rider.climb),
    timeTrial: num(rider.timeTrial),
    endurance: num(rider.endurance),
    form: num(rider.form, 70),
    fatigue: num(rider.fatigue, 20),
    teamwork: num(rider.teamwork),
    role: meta.role || 'domestique',
    tactic: normalizeTactic(meta.tactic || 'balanced'),
    staffBonus: num(meta.staffBonus, 0),
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

  active.forEach((competitor) => {
    competitor.segmentMod = { scoreDelta: 0, fatigueDelta: 0, forceDrop: false };
  });

  const randomRoll = rollRandomEvents(active, segment, context);
  // Role bonuses use the entering player's squad composition as the reference block
  const playerActive = active.filter((c) => c.isPlayer);
  context.teamComposition = buildTeamComposition(playerActive);

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
    const eventFatigue = competitor.segmentMod ? num(competitor.segmentMod.fatigueDelta, 0) : 0;
    const domestiqueFatigue = competitor.role === 'domestique' ? 3 : 0;
    const dropCutoff = dropThreshold(competitor.tactic || context.tactic, hardSegment);
    competitor.fatigue = clamp(
      Math.round(competitor.fatigue + fatigueTick + eventFatigue + domestiqueFatigue),
      0,
      100,
    );

    const personalDropCutoff = roleDropThreshold(competitor, dropCutoff);

    if (competitor.segmentMod && competitor.segmentMod.forceDrop && !competitor.dropped) {
      competitor.dropped = true;
      events.push(`${competitor.name} is out of contention after the incident.`);
    } else if (
      hardSegment
      && index >= Math.floor(scored.length * 0.55)
      && score < average * personalDropCutoff
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
    randomEvents: randomRoll.randomEvents,
    topThree: scored.slice(0, 3).map((row) => ({
      name: row.competitor.name,
      score: Math.round(row.score * 10) / 10,
      isPlayer: row.competitor.isPlayer,
    })),
  };
}

function buildNarrativeFromSegments(race, segmentLog, standings, teamName, staffBonus, tactic, riderRoles) {
  const winner = standings[0];
  const bestPlayer = standings.find((row) => row.isPlayer);
  const tacticInfo = TACTICS[tactic];
  const leaderRole = (riderRoles || []).find((entry) => entry.role === 'leader');

  const lines = [`${race.name} unfolds over ${num(race.distance, 180)} km.`];

  if (tacticInfo && tactic !== 'balanced') {
    lines.push(`${teamName} races with a ${tacticInfo.label.toLowerCase()} plan.`);
  }

  if (leaderRole) {
    lines.push(`${leaderRole.name} is the designated leader for ${teamName}.`);
  }

  segmentLog.forEach((segment) => {
    lines.push(segment.events[0]);
    segment.events.slice(1).forEach((event) => lines.push(event));
    (segment.randomEvents || []).forEach((event) => lines.push(event.message));
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
      (c) => c.cyclist && String(c.cyclist) === String(rider._id),
    );
    if (competitor) {
      rider.fatigue = competitor.fatigue;
    }

    const row = standings.find((s) => s.cyclist && String(s.cyclist) === String(rider._id));
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
  const tactic = normalizeTactic(options.tactic);
  const rolesMap = normalizeRoles(
    riders.map((rider) => rider._id),
    options.roles || {},
  );
  const roleKey = Object.values(rolesMap).sort().join('-');
  const seed = options.seed || `${race._id}-${teamId}-${race.date || ''}-${tactic}-${roleKey}`;
  const rng = createRng(seed);
  const staffBonus = options.staffBonus || 0;
  const rivalSquads = Array.isArray(options.rivalSquads) ? options.rivalSquads : [];

  const segments = buildSegments(race);
  const totalDistance = segments.reduce((sum, segment) => sum + segment.km, 0);

  const competitors = [
    ...riders.map((rider) => toCompetitor(rider, {
      isPlayer: true,
      cyclist: rider._id,
      teamId,
      teamName,
      role: rolesMap[String(rider._id)] || 'domestique',
      tactic,
      staffBonus,
    })),
  ];

  const allDbRiders = [...riders];

  rivalSquads.forEach((squad) => {
    const squadRiders = squad.riders || [];
    squadRiders.forEach((rider) => {
      allDbRiders.push(rider);
      competitors.push(toCompetitor(rider, {
        isPlayer: false,
        cyclist: rider._id,
        teamId: squad.teamId,
        teamName: squad.teamName || 'Rival team',
        role: (squad.roles && squad.roles[String(rider._id)]) || 'domestique',
        tactic: squad.tactic || 'balanced',
        staffBonus: squad.staffBonus || 0,
      }));
    });
  });

  // Pad peloton with procedural riders if few DB rivals
  const targetField = 8;
  const padCount = Math.max(0, targetField - Math.max(0, competitors.length - riders.length));
  if (padCount > 0) {
    makeRivals(race.profile || 'flat', rng, padCount).forEach((rival) => {
      competitors.push(toCompetitor(rival, {
        isPlayer: false,
        teamName: 'Wild card',
      }));
    });
  }

  const riderRoles = riders.map((rider) => ({
    cyclist: rider._id,
    name: rider.name,
    role: rolesMap[String(rider._id)] || 'domestique',
  }));

  const segmentLog = [];
  let kmCursor = 0;

  segments.forEach((segment, index) => {
    kmCursor += segment.km;
    const context = {
      rng,
      race,
      staffBonus,
      tactic,
      segmentMeta: {
        isLastSegment: index === segments.length - 1,
        segmentIndex: index,
      },
    };
    segmentLog.push(resolveSegment(competitors, segment, kmCursor, totalDistance, context));
  });

  const standings = competitors
    .map((competitor) => ({
      name: competitor.name,
      cyclist: competitor.cyclist,
      isPlayer: competitor.isPlayer,
      teamId: competitor.teamId,
      teamName: competitor.teamName,
      score: Math.round(competitor.cumulativeScore * 10) / 10,
      dropped: competitor.dropped,
    }))
    .sort((a, b) => b.score - a.score);

  standings.forEach((row, index) => {
    row.position = index + 1;
    row.points = POINTS[index] || 0;
  });

  assignRaceTimes(standings, race.distance || totalDistance);

  const narrative = buildNarrativeFromSegments(
    race, segmentLog, standings, teamName, staffBonus, tactic, riderRoles,
  );

  if (rivalSquads.length) {
    narrative.splice(
      1,
      0,
      `${rivalSquads.length} rival team(s) line up against ${teamName}: ${rivalSquads.map((s) => s.teamName).join(', ')}.`,
    );
  }

  const formChanges = applyConditionTick(allDbRiders, standings, race, competitors);
  const teamPointsEarned = standings
    .filter((row) => row.isPlayer)
    .reduce((sum, row) => sum + (row.points || 0), 0);

  const teamResultsMap = new Map();
  standings.forEach((row) => {
    if (!row.teamId) return;
    const key = String(row.teamId);
    const prev = teamResultsMap.get(key) || {
      teamId: row.teamId,
      teamName: row.teamName,
      isPlayer: Boolean(row.isPlayer),
      points: 0,
      bestPosition: row.position,
      bestTimeSeconds: row.timeSeconds,
      bestRider: row.name,
    };
    prev.points += row.points || 0;
    if (row.position < prev.bestPosition) {
      prev.bestPosition = row.position;
      prev.bestTimeSeconds = row.timeSeconds;
      prev.bestRider = row.name;
    }
    if (row.isPlayer) prev.isPlayer = true;
    if (row.teamName) prev.teamName = row.teamName;
    teamResultsMap.set(key, prev);
  });
  const teamResults = Array.from(teamResultsMap.values())
    .sort((a, b) => (a.bestTimeSeconds - b.bestTimeSeconds) || (b.points - a.points));

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
    teamResults,
    rivalTeamCount: rivalSquads.length,
    segmentLog,
    segments,
    seed,
    tactic,
    riderRoles,
    staffBonus: Math.round(staffBonus * 10) / 10,
  };
}

function assignRaceTimes(standings, distance) {
  if (!standings.length) return;
  const baseSeconds = Math.round(num(distance, 180) * 58); // ~58s/km ≈ Tour pace
  const winnerScore = standings[0].score || 0;

  standings.forEach((row, index) => {
    const deficit = Math.max(0, winnerScore - (row.score || 0));
    const gapSeconds = index === 0
      ? 0
      : Math.round(deficit * 3.5 + index * 4 + (row.dropped ? 90 : 0));
    row.gapSeconds = gapSeconds;
    row.timeSeconds = baseSeconds + gapSeconds;
  });
}

function validateRaceSegments(distance, segments) {
  if (!segments || !segments.length) return null;
  const total = segments.reduce((sum, segment) => sum + num(segment.km, 0), 0);
  const target = num(distance, 0);
  if (total !== target) {
    return `Segment km total (${total}) must match race distance (${target})`;
  }
  return null;
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
  assignRaceTimes,
  TACTICS,
  VALID_TACTICS,
  RIDER_ROLES,
  VALID_ROLES,
  normalizeTactic,
  normalizeRoles,
  validateRaceSegments,
};
