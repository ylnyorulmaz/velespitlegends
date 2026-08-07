export function formatDate(value) {
  if (!value) return 'TBD';
  return String(value).slice(0, 10);
}

export function formatDateTime(value) {
  if (!value) return '';
  return String(value).replace('T', ' ').slice(0, 16);
}

export function formatDelta(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : `${n}`;
}

export function deltaClass(value) {
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-danger';
  return 'text-muted';
}

export function profileBadgeClass(profile) {
  const map = {
    flat: 'profile-flat',
    hilly: 'profile-hilly',
    mountain: 'profile-mountain',
    classic: 'profile-classic',
    tt: 'profile-tt',
  };
  return map[profile] || 'profile-flat';
}

export function profileLabel(profile) {
  const map = {
    flat: 'Flat',
    hilly: 'Hilly',
    mountain: 'Mountain',
    classic: 'Classic',
    tt: 'Time Trial',
  };
  return map[profile] || profile;
}

export function statBarWidth(value, max = 100) {
  return `${Math.max(4, Math.min(100, (Number(value) / max) * 100))}%`;
}

export function isInjured(cyclist) {
  return cyclist.injured
    || (cyclist.injury && cyclist.injury.type !== 'none' && (cyclist.injury.weeksRemaining || 0) > 0);
}

export function injuryLabel(cyclist) {
  if (!isInjured(cyclist)) return '';
  const weeks = cyclist.injury && cyclist.injury.weeksRemaining;
  const type = cyclist.injury && cyclist.injury.type === 'crash' ? 'Crash' : 'Illness';
  return `${type} · ${weeks}w out`;
}

export function formatMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function formatRaceTime(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatGap(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (!s) return '';
  return `+${formatRaceTime(s)}`;
}
