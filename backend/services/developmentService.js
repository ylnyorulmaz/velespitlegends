const SKILL_KEYS = ['sprint', 'climb', 'timeTrial', 'endurance', 'teamwork'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function averageSkill(rider) {
  const total = SKILL_KEYS.reduce((sum, key) => sum + num(rider[key], 50), 0);
  return total / SKILL_KEYS.length;
}

/**
 * Weekly development based on age + potential.
 * Young riders with headroom grow; veterans slowly decline.
 * Pure function — mutates a plain copy for reporting, returns change list.
 */
function developRider(rider, rng = Math.random) {
  const age = num(rider.age, 24);
  const potential = clamp(num(rider.potential, 50), 1, 100);
  const avg = averageSkill(rider);
  const changes = [];

  const roll = typeof rng === 'function' ? rng() : Math.random();

  if (age <= 27 && potential - avg >= 4 && roll < 0.45) {
    const candidates = SKILL_KEYS
      .map((key) => ({ key, value: num(rider[key], 50) }))
      .filter((s) => s.value < potential)
      .sort((a, b) => a.value - b.value);
    if (candidates.length) {
      const pick = candidates[0];
      const before = pick.value;
      const after = clamp(before + 1, 1, 100);
      rider[pick.key] = after;
      changes.push({
        skill: pick.key,
        before,
        after,
        delta: after - before,
        reason: 'youth_growth',
      });
    }
  } else if (age <= 30 && potential - avg >= 8 && roll < 0.22) {
    const candidates = SKILL_KEYS
      .map((key) => ({ key, value: num(rider[key], 50) }))
      .filter((s) => s.value < potential);
    if (candidates.length) {
      const pick = candidates[Math.floor(roll * candidates.length) % candidates.length];
      const before = pick.value;
      const after = clamp(before + 1, 1, 100);
      rider[pick.key] = after;
      changes.push({
        skill: pick.key,
        before,
        after,
        delta: after - before,
        reason: 'prime_growth',
      });
    }
  } else if (age >= 33 && roll < 0.35) {
    const candidates = SKILL_KEYS
      .map((key) => ({ key, value: num(rider[key], 50) }))
      .filter((s) => s.value >= 55)
      .sort((a, b) => b.value - a.value);
    if (candidates.length) {
      const pick = candidates[0];
      const before = pick.value;
      const after = clamp(before - 1, 1, 100);
      rider[pick.key] = after;
      changes.push({
        skill: pick.key,
        before,
        after,
        delta: after - before,
        reason: 'age_decline',
      });
    }
  }

  return changes;
}

module.exports = {
  SKILL_KEYS,
  averageSkill,
  developRider,
};
