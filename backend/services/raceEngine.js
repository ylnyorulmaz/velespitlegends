const POINTS = [25, 20, 16, 14, 12, 10, 8, 6, 4, 2];

/** AI gets tactic/role bonuses at this fraction of full player strength. */
const AI_ORDERS_FACTOR = 0.55;

/** Seconds-per-km baselines by segment profile (Tour-ish stage pace). */
const PROFILE_PACE_SEC_PER_KM = {
  flat: 56,
  hilly: 60,
  mountain: 72,
  classic: 62,
  tt: 50,
};

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

function ordersFactor(competitor) {
  return competitor && competitor.isPlayer ? 1 : AI_ORDERS_FACTOR;
}

function buildTeamComposition(squad) {
  const active = squad || [];
  const domestiquesActive = active.filter(
    (c) => c.role === 'domestique' && !c.dropped,
  ).length;
  const hasLeader = active.some((c) => c.role === 'leader' && !c.dropped);
  return { domestiquesActive, hasLeader };
}

function squadForCompetitor(competitor, active) {
  const pool = active || [];
  if (competitor.teamId) {
    return pool.filter((c) => c.teamId && String(c.teamId) === String(competitor.teamId));
  }
  if (competitor.isPlayer) {
    return pool.filter((c) => c.isPlayer);
  }
  return [competitor];
}

function roleSegmentBonus(competitor, segmentProfile, context) {
  const { segmentMeta = {} } = context;
  const teamComposition = buildTeamComposition(
    squadForCompetitor(competitor, context.activeCompetitors),
  );
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

  return bonus * ordersFactor(competitor);
}

function roleDropThreshold(competitor, baseThreshold) {
  if (competitor.role === 'protected') {
    return baseThreshold - (0.06 * ordersFactor(competitor));
  }
  return baseThreshold;
}

function tacticSegmentBonus(competitor, segmentProfile, tactic, segmentMeta = {}) {
  const teamwork = num(competitor.teamwork);
  const climb = num(competitor.climb);
  const sprint = num(competitor.sprint);
  const specialty = competitor.specialty || 'none';
  const isClimbSegment = segmentProfile === 'hilly' || segmentProfile === 'mountain';
  const isFlatSegment = segmentProfile === 'flat';
  const isClassic = segmentProfile === 'classic';
  let bonus = 0;

  switch (tactic) {
    case 'control':
      bonus = teamwork * 0.12 + (isClimbSegment ? 3 : 0);
      break;
    case 'attack':
      if (isClimbSegment || isClassic) {
        bonus = (specialty === 'breakaway' ? 8 : 4) + teamwork * 0.05;
      }
      break;
    case 'defend':
      bonus = isFlatSegment ? -2 : (isClimbSegment ? 4 : 1);
      break;
    case 'sprint_train':
      if (segmentMeta.isLastSegment && isFlatSegment) {
        bonus = (specialty === 'leadout' || specialty === 'none' ? 10 : 6) + sprint * 0.06;
      } else if (isFlatSegment) {
        bonus = sprint * 0.03;
      }
      break;
    case 'climb_pace':
      if (isClimbSegment) {
        bonus = (climb >= 75 ? 9 : 5) + climb * 0.04;
      }
      break;
    default:
      bonus = 0;
  }

  return bonus * ordersFactor(competitor);
}

function segmentPaceSecPerKm(profile) {
  return PROFILE_PACE_SEC_PER_KM[profile] || PROFILE_PACE_SEC_PER_KM.flat;
}

/**
 * Convert within-segment score gaps into race seconds and accumulate.
 */
function applySegmentTimeGaps(scored, segment, totalDistance, kmEnd) {
  if (!scored.length) return;
  const winnerScore = scored[0].score || 0;
  const pace = segmentPaceSecPerKm(segment.profile);
  const baseSegTime = Math.round(num(segment.km, 0) * pace);
  const remainingKm = Math.max(0, num(totalDistance, 0) - num(kmEnd, 0));

  scored.forEach(({ competitor, score }, index) => {
    const deficit = Math.max(0, winnerScore - (score || 0));
    let gap = 0;
    if (index > 0) {
      // Score deficit → seconds; longer/harder sectors stretch gaps
      gap = Math.round(deficit * (0.85 + num(segment.km, 0) / 90) + index * 2);
      if (segment.profile === 'mountain') gap = Math.round(gap * 1.15);
    }
    if (competitor.dropped) {
      gap += Math.round(40 + num(segment.km, 0) * 0.45);
    }
    competitor.raceTimeSeconds = (competitor.raceTimeSeconds || 0) + baseSegTime + gap;
  });

  // Riders who just lost contact pay out the remaining race at a slow chase pace
  scored.forEach(({ competitor }) => {
    if (!competitor.dropped || competitor.dropTimeApplied) return;
    competitor.dropTimeApplied = true;
    if (remainingKm > 0) {
      competitor.raceTimeSeconds += Math.round(remainingKm * (pace + 18));
    }
  });
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
    raceTimeSeconds: 0,
    dropTimeApplied: false,
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
  // Role bonuses use each rider's own squad (player or AI team)
  context.activeCompetitors = active;

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

  applySegmentTimeGaps(scored, segment, totalDistance, kmEnd);

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
    }));

  assignRaceTimes(standings, race.distance || totalDistance, competitors);

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

function competitorTimeKey(row) {
  if (row.cyclist != null) return `id:${row.cyclist}`;
  return `name:${row.name}:${Boolean(row.isPlayer)}`;
}

/**
 * Prefer accumulated segment-gap race times (Tour-like).
 * Falls back to score-derived times for legacy/unit callers.
 */
function assignRaceTimes(standings, distance, competitors = null) {
  if (!standings.length) return;

  const hasAccumulated = Array.isArray(competitors)
    && competitors.some((c) => (c.raceTimeSeconds || 0) > 0);

  if (hasAccumulated) {
    const timeByKey = new Map();
    competitors.forEach((c) => {
      timeByKey.set(competitorTimeKey(c), Math.round(c.raceTimeSeconds || 0));
    });

    standings.forEach((row) => {
      const accumulated = timeByKey.get(competitorTimeKey(row));
      if (accumulated != null && accumulated > 0) {
        row.timeSeconds = accumulated;
      } else {
        row.timeSeconds = Math.round(num(distance, 180) * 58) + 600;
      }
    });

    // Classification by race time; score breaks ties
    standings.sort((a, b) => {
      if (a.dropped !== b.dropped) return a.dropped ? 1 : -1;
      if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
      return (b.score || 0) - (a.score || 0);
    });

    const leaderTime = standings[0].timeSeconds || 0;
    standings.forEach((row, index) => {
      row.position = index + 1;
      row.points = POINTS[index] || 0;
      row.gapSeconds = index === 0 ? 0 : Math.max(0, (row.timeSeconds || 0) - leaderTime);
    });
    return;
  }

  // Legacy: derive times from final score order
  standings.sort((a, b) => (b.score || 0) - (a.score || 0));
  const baseSeconds = Math.round(num(distance, 180) * 58);
  const winnerScore = standings[0].score || 0;
  standings.forEach((row, index) => {
    const deficit = Math.max(0, winnerScore - (row.score || 0));
    const gapSeconds = index === 0
      ? 0
      : Math.round(deficit * 3.5 + index * 4 + (row.dropped ? 90 : 0));
    row.position = index + 1;
    row.points = POINTS[index] || 0;
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

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const map = { 1: 'st', 2: 'nd', 3: 'rd' };
  return `${n}${map[n % 10] || 'th'}`;
}

function currentOrderSnapshot(competitors) {
  return [...competitors]
    .map((c) => ({
      name: c.name,
      isPlayer: c.isPlayer,
      teamName: c.teamName,
      teamId: c.teamId,
      cyclist: c.cyclist,
      score: Math.round(c.cumulativeScore * 10) / 10,
      dropped: Boolean(c.dropped),
    }))
    .sort((a, b) => {
      if (a.dropped !== b.dropped) return a.dropped ? 1 : -1;
      return b.score - a.score;
    })
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function buildCmIntro(race, teamName, tactic, rivalSquads, riderRoles) {
  const tacticInfo = TACTICS[normalizeTactic(tactic)];
  const leader = (riderRoles || []).find((r) => r.role === 'leader');
  const lines = [
    `*** ${race.name} — race day ***`,
    `${num(race.distance, 180)} km of ${race.profile || 'road'} racing. Prestige ${num(race.prestige, 50)}.`,
    `${teamName} leave the bus with a ${tacticInfo.label.toLowerCase()} plan. ${tacticInfo.description}`,
  ];
  if (leader) {
    lines.push(`${leader.name} wears the captain's armband today.`);
  }
  if (rivalSquads && rivalSquads.length) {
    lines.push(
      `Lined up against you: ${rivalSquads.map((s) => s.teamName).join(', ')}.`,
    );
  }
  lines.push('The flag drops. Here we go…');
  return lines;
}

function buildCmSegmentFeed(segment, competitors, teamName, tactic) {
  const lines = [];
  const profileHooks = {
    flat: `Wide roads and a fast bunch through ${segment.label}.`,
    hilly: `Rolling terrain now — ${segment.label}. Someone will try something.`,
    mountain: `The road tilts skyward on ${segment.label}. This is where the race can explode.`,
    classic: `Classic roads: ${segment.label}. Positioning is everything.`,
    tt: `Against the clock on ${segment.label}. Pure effort.`,
  };
  lines.push(profileHooks[segment.profile] || `Through ${segment.label}.`);

  (segment.events || []).forEach((event) => lines.push(event));
  (segment.randomEvents || []).forEach((event) => {
    if (event && event.message) lines.push(event.message);
  });

  const order = currentOrderSnapshot(competitors);
  const active = order.filter((r) => !r.dropped);
  const bestPlayer = active.find((r) => r.isPlayer);
  if (bestPlayer) {
    if (bestPlayer.position === 1) {
      lines.push(`Superb from ${teamName} — ${bestPlayer.name} hits the front!`);
    } else if (bestPlayer.position <= 5) {
      lines.push(
        `Good news in the team car: ${bestPlayer.name} is ${ordinal(bestPlayer.position)} overall.`,
      );
    } else if (bestPlayer.position <= 12) {
      lines.push(
        `${bestPlayer.name} sits ${ordinal(bestPlayer.position)} — ${teamName} still in the hunt.`,
      );
    } else {
      lines.push(
        `Worrying signs: ${bestPlayer.name} is back in ${ordinal(bestPlayer.position)}. Time for fresh orders?`,
      );
    }
  }

  const leader = active[0];
  if (leader && !leader.isPlayer) {
    lines.push(`${leader.name} (${leader.teamName || 'the field'}) sets the virtual pace.`);
  }

  lines.push(`Race orders remain: ${TACTICS[normalizeTactic(tactic)].label}.`);
  return lines;
}

/**
 * Sparse decision points: pause before key terrain / finale, or after a crisis.
 * Everyday flat middle kilometres auto-roll without asking.
 */
function isKeySegment(segment, index, total) {
  if (!segment) return false;
  if (index === total - 1) return true; // finale
  const profile = segment.profile || 'flat';
  if (profile === 'mountain' || profile === 'hilly' || profile === 'classic' || profile === 'tt') {
    return true;
  }
  if (num(segment.km, 0) >= 70) return true;
  return false;
}

function detectDecisionCrisis(logEntry, competitors, teamName) {
  if (!logEntry) return null;

  const playerEvents = (logEntry.randomEvents || []).filter((e) => e.isPlayer);
  const crash = playerEvents.find((e) => e.type === 'crash' || e.type === 'illness');
  if (crash) {
    return {
      reason: crash.type === 'crash' ? 'crisis_crash' : 'crisis_illness',
      headline: `${crash.rider} is in trouble — the car needs new orders.`,
    };
  }

  const order = currentOrderSnapshot(competitors);
  const bestPlayer = order.find((r) => r.isPlayer && !r.dropped);
  const droppedPlayer = order.find((r) => r.isPlayer && r.dropped);
  if (droppedPlayer) {
    return {
      reason: 'crisis_dropped',
      headline: `${droppedPlayer.name} has been dropped. ${teamName} must rethink the plan.`,
    };
  }

  if (bestPlayer && bestPlayer.position >= 12) {
    return {
      reason: 'crisis_position',
      headline: `${bestPlayer.name} has slipped to ${ordinal(bestPlayer.position)}. Time to change approach?`,
    };
  }

  const playerMentionDropped = (logEntry.events || []).some(
    (line) => /is dropped|out of contention/i.test(line)
      && order.some((r) => r.isPlayer && line.includes(r.name)),
  );
  if (playerMentionDropped) {
    return {
      reason: 'crisis_dropped',
      headline: `Contact lost in the peloton — ${teamName} need fresh instructions.`,
    };
  }

  return null;
}

function decisionReasonForSegment(segment, index, total) {
  if (!segment) return 'opening';
  if (index === total - 1) return 'finale';
  if (segment.profile === 'mountain' || segment.profile === 'hilly') return 'climb';
  if (segment.profile === 'classic') return 'classic';
  if (segment.profile === 'tt') return 'time_trial';
  if (num(segment.km, 0) >= 70) return 'long_sector';
  return 'opening';
}

function buildCmDecisionPrompt(nextSegment, remaining, decision = null) {
  if (!nextSegment) {
    return ['The finish line is in sight — no more changes.'];
  }

  const reason = (decision && decision.reason) || decisionReasonForSegment(
    nextSegment,
    // remaining includes next; index ≈ total - remaining
    null,
    null,
  );
  const reasonHints = {
    opening: 'Set your race orders before the flag drops.',
    climb: 'The road goes up — this is a decisive sector.',
    finale: 'The finish is coming. Last chance to change orders.',
    classic: 'Classic roads ahead — positioning will decide it.',
    time_trial: 'Time-trial kilometres — pure effort from here.',
    long_sector: 'A long sector looms — commit to a plan.',
    crisis_crash: 'Crisis in the race — react from the team car.',
    crisis_illness: 'Medical scare — adapt the plan.',
    crisis_dropped: 'Riders are losing the bunch — change tactics?',
    crisis_position: 'You are drifting backwards — new orders?',
  };

  const lines = ['— Team radio —'];
  if (decision && decision.headline) lines.push(decision.headline);
  lines.push(
    `Next: ${nextSegment.label} (${nextSegment.profile}, ${nextSegment.km} km). ${remaining} segment(s) left.`,
  );
  lines.push(reasonHints[reason] || reasonHints.opening);
  lines.push('Change your race orders, or stick with the plan and roll on.');
  return lines;
}

/**
 * Interactive CM-style race: create state, then stepLiveRace per segment.
 * RNG lives on the state object (in-memory sessions).
 */
function createLiveRaceState(race, riders, teamName, options = {}) {
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

  const competitors = riders.map((rider) => toCompetitor(rider, {
    isPlayer: true,
    cyclist: rider._id,
    teamId,
    teamName,
    role: rolesMap[String(rider._id)] || 'domestique',
    tactic,
    staffBonus,
  }));

  const allDbRiders = [...riders];
  rivalSquads.forEach((squad) => {
    (squad.riders || []).forEach((rider) => {
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

  const padCount = Math.max(0, 8 - Math.max(0, competitors.length - riders.length));
  if (padCount > 0) {
    makeRivals(race.profile || 'flat', rng, padCount).forEach((rival) => {
      competitors.push(toCompetitor(rival, { isPlayer: false, teamName: 'Wild card' }));
    });
  }

  const riderRoles = riders.map((rider) => ({
    cyclist: rider._id,
    name: rider.name,
    role: rolesMap[String(rider._id)] || 'domestique',
  }));

  const feed = buildCmIntro(race, teamName, tactic, rivalSquads, riderRoles);
  const next = segments[0];
  const openingDecision = {
    reason: 'opening',
    headline: `${teamName} — confirm your race orders before the flag drops.`,
  };
  feed.push(...buildCmDecisionPrompt(next, segments.length, openingDecision));

  return {
    seed,
    race,
    teamId,
    teamName,
    tactic,
    staffBonus,
    rolesMap,
    riderRoles,
    rivalSquads,
    riders: allDbRiders,
    playerRiderIds: riders.map((r) => r._id),
    segments,
    totalDistance,
    competitors,
    segmentLog: [],
    kmCursor: 0,
    segmentIndex: 0,
    rng,
    status: 'awaiting_orders',
    decision: openingDecision,
    feed,
    tacticHistory: [{ segmentIndex: 0, tactic }],
  };
}

function applyPlayerTactic(state, rawTactic) {
  const tactic = normalizeTactic(rawTactic);
  state.tactic = tactic;
  state.competitors.forEach((c) => {
    if (c.isPlayer) c.tactic = tactic;
  });
  return tactic;
}

function resolveOneLiveSegment(state) {
  const segment = state.segments[state.segmentIndex];
  state.kmCursor += segment.km;
  const context = {
    rng: state.rng,
    race: state.race,
    staffBonus: state.staffBonus,
    tactic: state.tactic,
    segmentMeta: {
      isLastSegment: state.segmentIndex === state.segments.length - 1,
      segmentIndex: state.segmentIndex,
    },
  };

  const logEntry = resolveSegment(
    state.competitors,
    segment,
    state.kmCursor,
    state.totalDistance,
    context,
  );
  state.segmentLog.push(logEntry);
  const lines = buildCmSegmentFeed(logEntry, state.competitors, state.teamName, state.tactic);
  state.feed.push(...lines);
  state.segmentIndex += 1;
  return { logEntry, lines };
}

/**
 * Advance the race. With stopAtDecision (default), auto-rolls quiet sectors
 * and only pauses for key terrain, the finale, or a crisis.
 */
function advanceLiveRace(state, options = {}) {
  const stopAtDecision = options.stopAtDecision !== false;

  if (state.status === 'finished' || state.status === 'completed') {
    return {
      done: true,
      state,
      lines: [],
      standingsPreview: currentOrderSnapshot(state.competitors),
      remaining: 0,
    };
  }

  const prevTactic = state.tactic;
  const burstLines = [];
  if (options.tactic != null) {
    const nextTactic = applyPlayerTactic(state, options.tactic);
    if (nextTactic !== prevTactic) {
      const orderLine = `*** Orders from the car: switch to ${TACTICS[nextTactic].label}. ***`;
      state.feed.push(orderLine);
      burstLines.push(orderLine);
      state.tacticHistory.push({ segmentIndex: state.segmentIndex, tactic: nextTactic });
    }
  }

  state.decision = null;

  if (state.segmentIndex >= state.segments.length) {
    state.status = 'finished';
    return {
      done: true,
      state,
      lines: burstLines,
      standingsPreview: currentOrderSnapshot(state.competitors),
      remaining: 0,
    };
  }

  // Safety: never infinite-loop
  let guard = 0;
  while (state.segmentIndex < state.segments.length && guard < 40) {
    guard += 1;
    const { logEntry, lines } = resolveOneLiveSegment(state);
    burstLines.push(...lines);

    if (state.segmentIndex >= state.segments.length) {
      state.status = 'finished';
      state.decision = null;
      const closing = [
        '— Finish —',
        'The race is over. Final classifications coming through…',
      ];
      state.feed.push(...closing);
      burstLines.push(...closing);
      return {
        done: true,
        state,
        lines: burstLines,
        standingsPreview: currentOrderSnapshot(state.competitors),
        remaining: 0,
      };
    }

    if (!stopAtDecision) {
      continue;
    }

    const remaining = state.segments.length - state.segmentIndex;
    const nextSegment = state.segments[state.segmentIndex];
    const crisis = detectDecisionCrisis(logEntry, state.competitors, state.teamName);
    const upcomingKey = isKeySegment(
      nextSegment,
      state.segmentIndex,
      state.segments.length,
    );

    if (crisis || upcomingKey) {
      const decision = crisis || {
        reason: decisionReasonForSegment(
          nextSegment,
          state.segmentIndex,
          state.segments.length,
        ),
        headline: null,
      };
      const prompt = buildCmDecisionPrompt(nextSegment, remaining, decision);
      state.feed.push(...prompt);
      burstLines.push(...prompt);
      state.status = 'awaiting_orders';
      state.decision = decision;
      return {
        done: false,
        state,
        lines: burstLines,
        standingsPreview: currentOrderSnapshot(state.competitors),
        nextSegment,
        remaining,
        decision,
      };
    }

    const bridge = 'The race rolls on through quieter kilometres…';
    state.feed.push(bridge);
    burstLines.push(bridge);
  }

  state.status = 'finished';
  return {
    done: true,
    state,
    lines: burstLines,
    standingsPreview: currentOrderSnapshot(state.competitors),
    remaining: 0,
  };
}

function stepLiveRace(state, options = {}) {
  return advanceLiveRace(state, { ...options, stopAtDecision: true });
}

function finalizeLiveRace(state) {
  while (state.segmentIndex < state.segments.length) {
    advanceLiveRace(state, { stopAtDecision: false });
  }

  const standings = state.competitors
    .map((competitor) => ({
      name: competitor.name,
      cyclist: competitor.cyclist,
      isPlayer: competitor.isPlayer,
      teamId: competitor.teamId,
      teamName: competitor.teamName,
      score: Math.round(competitor.cumulativeScore * 10) / 10,
      dropped: competitor.dropped,
    }));

  assignRaceTimes(standings, state.race.distance || state.totalDistance, state.competitors);

  const narrative = state.feed.slice();
  const winner = standings[0];
  const bestPlayer = standings.find((row) => row.isPlayer);
  narrative.push(`${winner.name} wins${winner.isPlayer ? ` for ${state.teamName}` : ''}.`);
  if (bestPlayer) {
    narrative.push(
      `${state.teamName} best: ${bestPlayer.name} in P${bestPlayer.position} (${bestPlayer.points} pts).`,
    );
  }

  const formChanges = applyConditionTick(
    state.riders,
    standings,
    state.race,
    state.competitors,
  );
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

  standings.forEach((row) => {
    delete row.dropped;
  });

  return {
    standings,
    narrative,
    summary: narrative.join(' '),
    formChanges,
    teamPointsEarned,
    teamResults,
    rivalTeamCount: (state.rivalSquads || []).length,
    segmentLog: state.segmentLog,
    segments: state.segments,
    seed: state.seed,
    tactic: state.tactic,
    riderRoles: state.riderRoles,
    staffBonus: Math.round(state.staffBonus * 10) / 10,
    tacticHistory: state.tacticHistory,
  };
}

function publicLiveView(state) {
  const remaining = Math.max(0, state.segments.length - state.segmentIndex);
  return {
    status: state.status,
    tactic: state.tactic,
    feed: state.feed.slice(),
    standingsPreview: currentOrderSnapshot(state.competitors).slice(0, 8),
    segmentIndex: state.segmentIndex,
    segmentTotal: state.segments.length,
    remaining,
    nextSegment: remaining > 0 ? state.segments[state.segmentIndex] : null,
    decision: state.decision || null,
    raceName: state.race && state.race.name,
    teamName: state.teamName,
    tactics: TACTICS,
  };
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
  createLiveRaceState,
  stepLiveRace,
  advanceLiveRace,
  finalizeLiveRace,
  publicLiveView,
  applyPlayerTactic,
  isKeySegment,
  detectDecisionCrisis,
  AI_ORDERS_FACTOR,
  tacticSegmentBonus,
  roleSegmentBonus,
  TACTICS,
  VALID_TACTICS,
  RIDER_ROLES,
  VALID_ROLES,
  normalizeTactic,
  normalizeRoles,
  validateRaceSegments,
};
