const Season = require('../models/Season');
const Cyclist = require('../models/Cyclist');
const Team = require('../models/Team');
const RaceResult = require('../models/RaceResult');
const { developRider } = require('./developmentService');

function weeklyWage(salary, totalWeeks) {
  const weeks = Math.max(1, Number(totalWeeks) || 30);
  const amount = Number(salary) || 0;
  if (amount <= 0) return 0;
  return Math.max(1, Math.round(amount / weeks));
}

async function getOrCreateSeason() {
  let season = await Season.findOne({ status: 'active' }).sort({ createdAt: -1 });
  if (!season) {
    season = await Season.create({
      year: new Date().getFullYear(),
      currentWeek: 1,
      totalWeeks: 30,
      status: 'active',
      developmentLedger: [],
    });
  }
  return season;
}

async function runWeeklyPayroll(totalWeeks) {
  const teams = await Team.find().populate('roster').populate('staff');
  const payroll = [];

  for (const team of teams) {
    let riderWages = 0;
    let staffWages = 0;

    for (const rider of team.roster || []) {
      riderWages += weeklyWage(rider.salary, totalWeeks);
    }
    for (const member of team.staff || []) {
      staffWages += weeklyWage(member.salary, totalWeeks);
    }

    const total = riderWages + staffWages;
    const before = Number(team.budget) || 0;
    const after = Math.max(0, before - total);
    const shortfall = total > before ? total - before : 0;

    team.budget = after;
    await team.save();

    if (shortfall > 0 && team.roster && team.roster.length) {
      await Promise.all((team.roster || []).map(async (rider) => {
        if (!rider || !rider._id) return;
        const form = Math.max(1, (rider.form || 70) - 2);
        await Cyclist.updateOne({ _id: rider._id }, { $set: { form } });
      }));
    }

    if (total > 0 || shortfall > 0) {
      payroll.push({
        teamId: team._id,
        teamName: team.name,
        riderWages,
        staffWages,
        total,
        budgetBefore: before,
        budgetAfter: after,
        shortfall,
        insolvent: shortfall > 0,
      });
    }
  }

  return payroll;
}

async function runWeeklyDevelopment() {
  const cyclists = await Cyclist.find();
  const development = [];

  for (const rider of cyclists) {
    const snapshot = rider.toObject();
    const changes = developRider(snapshot);
    if (!changes.length) continue;

    const $set = {};
    for (const change of changes) {
      $set[change.skill] = change.after;
    }
    await Cyclist.updateOne({ _id: rider._id }, { $set });
    development.push({
      cyclist: rider._id,
      name: rider.name,
      age: rider.age,
      potential: rider.potential,
      changes,
    });
  }

  return development;
}

async function buildSeasonSummary(season) {
  const teams = await Team.find().sort({ seasonPoints: -1, wins: -1 });
  const championTeam = teams[0] || null;
  const budgetSorted = [...teams].sort((a, b) => (b.budget || 0) - (a.budget || 0));
  const budgetLeader = budgetSorted[0] || null;

  const netByRider = new Map();
  for (const entry of season.developmentLedger || []) {
    const key = String(entry.cyclist || entry.name);
    const prev = netByRider.get(key) || {
      cyclist: entry.cyclist,
      name: entry.name,
      netDelta: 0,
      highlights: [],
    };
    for (const change of entry.changes || []) {
      prev.netDelta += change.delta || 0;
      if (change.delta) {
        prev.highlights.push(
          `${change.skill} ${change.delta > 0 ? '+' : ''}${change.delta}`,
        );
      }
    }
    netByRider.set(key, prev);
  }

  const rankedDev = Array.from(netByRider.values()).sort((a, b) => b.netDelta - a.netDelta);
  const mostImproved = rankedDev.filter((r) => r.netDelta > 0).slice(0, 5).map((r) => ({
    cyclist: r.cyclist,
    name: r.name,
    netDelta: r.netDelta,
    highlights: r.highlights.slice(0, 4),
  }));
  const mostDeclined = rankedDev.filter((r) => r.netDelta < 0).slice(-5).reverse().map((r) => ({
    cyclist: r.cyclist,
    name: r.name,
    netDelta: r.netDelta,
    highlights: r.highlights.slice(0, 4),
  }));

  const results = await RaceResult.find();
  const riderPoints = new Map();
  for (const result of results) {
    for (const row of result.standings || []) {
      if (!row.isPlayer || !row.name) continue;
      const key = String(row.cyclist || row.name);
      const prev = riderPoints.get(key) || { name: row.name, points: 0, races: 0 };
      prev.points += row.points || 0;
      prev.races += 1;
      riderPoints.set(key, prev);
    }
  }
  const topScorers = Array.from(riderPoints.values())
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  const championName = championTeam ? championTeam.name : 'No champion';
  const headline = championTeam
    ? `${championName} wins the ${season.year} season with ${championTeam.seasonPoints || 0} pts and ${championTeam.wins || 0} wins.`
    : `Season ${season.year} completed.`;

  return {
    generatedAt: new Date(),
    champion: championTeam ? {
      teamId: championTeam._id,
      name: championTeam.name,
      seasonPoints: championTeam.seasonPoints || 0,
      wins: championTeam.wins || 0,
    } : null,
    budgetLeader: budgetLeader ? {
      teamId: budgetLeader._id,
      name: budgetLeader.name,
      budget: budgetLeader.budget || 0,
    } : null,
    mostImproved,
    mostDeclined,
    topScorers,
    headline,
  };
}

async function advanceSeasonWeek() {
  const season = await getOrCreateSeason();

  if (season.status === 'completed') {
    return {
      season,
      message: 'Season already completed.',
      summary: season.summary || null,
    };
  }

  if (season.currentWeek >= season.totalWeeks) {
    season.status = 'completed';
    if (!season.summary) {
      season.summary = await buildSeasonSummary(season);
    }
    await season.save();
    return {
      season,
      message: season.summary && season.summary.headline
        ? season.summary.headline
        : 'Season completed — no more weeks to advance.',
      summary: season.summary,
    };
  }

  season.currentWeek += 1;

  const cyclists = await Cyclist.find();
  await Promise.all(cyclists.map(async (rider) => {
    await Cyclist.updateOne(
      { _id: rider._id },
      {
        $set: {
          fatigue: Math.max(0, (rider.fatigue || 0) - 5),
          form: Math.min(100, (rider.form || 70) + 1),
        },
      },
    );
  }));

  const payroll = await runWeeklyPayroll(season.totalWeeks);
  const development = await runWeeklyDevelopment();

  season.developmentLedger = season.developmentLedger || [];
  for (const entry of development) {
    season.developmentLedger.push({
      week: season.currentWeek,
      cyclist: entry.cyclist,
      name: entry.name,
      changes: entry.changes.map((c) => ({
        skill: c.skill,
        delta: c.delta,
        reason: c.reason,
      })),
    });
  }

  const { tickInjuryRecovery } = require('./injuryService');
  const injuryTick = await tickInjuryRecovery();

  const payrollTotal = payroll.reduce((sum, row) => sum + row.total, 0);
  const insolventTeams = payroll.filter((row) => row.insolvent).map((row) => row.teamName);
  const grew = development.filter((d) => d.changes.some((c) => c.delta > 0)).length;
  const declined = development.filter((d) => d.changes.some((c) => c.delta < 0)).length;

  const parts = [
    `Advanced to week ${season.currentWeek}.`,
    `Payroll −$${payrollTotal.toLocaleString('en-US')} across ${payroll.length} team(s).`,
  ];
  if (insolventTeams.length) {
    parts.push(`Budget shortfall (form −2): ${insolventTeams.join(', ')}.`);
  }
  if (grew || declined) {
    parts.push(`Development: ${grew} improved, ${declined} declined.`);
  } else {
    parts.push('No skill changes this week.');
  }

  let summary = null;
  if (season.currentWeek >= season.totalWeeks) {
    season.status = 'completed';
    summary = await buildSeasonSummary(season);
    season.summary = summary;
    parts.push(summary.headline || 'Season finished!');
  }

  await season.save();

  return {
    season,
    message: parts.join(' '),
    ridersRecovered: cyclists.length,
    injuryRecovery: injuryTick,
    payroll,
    development,
    summary,
  };
}

async function getSeasonSummary() {
  let season = await Season.findOne({ status: 'completed' }).sort({ updatedAt: -1 });
  if (!season) {
    season = await getOrCreateSeason();
  }
  if (season.status === 'completed' && !season.summary) {
    season.summary = await buildSeasonSummary(season);
    await season.save();
  }
  return {
    season,
    summary: season.summary || null,
    complete: season.status === 'completed',
  };
}

module.exports = {
  getOrCreateSeason,
  advanceSeasonWeek,
  weeklyWage,
  runWeeklyPayroll,
  runWeeklyDevelopment,
  buildSeasonSummary,
  getSeasonSummary,
};
