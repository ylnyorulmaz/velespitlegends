function rider(overrides = {}) {
  return {
    _id: overrides._id || 'rider-a',
    name: overrides.name || 'Test Rider',
    sprint: 70,
    climb: 70,
    timeTrial: 70,
    endurance: 70,
    teamwork: 60,
    form: 80,
    fatigue: 10,
    specialty: 'none',
    age: 26,
    potential: 75,
    salary: 30000,
    ...overrides,
  };
}

function ridersTrio() {
  return [
    rider({
      _id: 'a', name: 'Sprinter', sprint: 90, climb: 40, timeTrial: 50,
      endurance: 70, specialty: 'leadout',
    }),
    rider({
      _id: 'b', name: 'Climber', sprint: 40, climb: 92, timeTrial: 55,
      endurance: 75, potential: 80,
    }),
    rider({
      _id: 'c', name: 'Helper', sprint: 55, climb: 55, timeTrial: 55,
      endurance: 70, teamwork: 70, age: 29, potential: 60,
    }),
  ];
}

function raceFixture(overrides = {}) {
  return {
    _id: 'race-1',
    name: 'Test Classic',
    distance: 180,
    profile: 'flat',
    prestige: 70,
    date: '2026-01-01',
    seasonWeek: 1,
    ...overrides,
  };
}

module.exports = {
  rider,
  ridersTrio,
  raceFixture,
};
