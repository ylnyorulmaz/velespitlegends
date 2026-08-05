<template>
  <div class="container home">
    <h1>Velespit Legends</h1>
    <p class="lead">Text-based cycling team management. Decisions matter.</p>
    <p v-if="dashboard.season" class="text-muted">
      Season {{ dashboard.season.year }} — week {{ dashboard.season.currentWeek }} / {{ dashboard.season.totalWeeks }}
    </p>
    <p>
      <router-link to="/calendar" class="btn btn-primary mr-2">Race Calendar</router-link>
      <router-link to="/standings" class="btn btn-outline-primary mr-2">Standings</router-link>
      <router-link to="/results" class="btn btn-outline-secondary">Results</router-link>
    </p>

    <div class="row text-left mt-4">
      <div class="col-md-4 mb-3">
        <h5>Standings</h5>
        <ul class="list-group" v-if="dashboard.topTeams && dashboard.topTeams.length">
          <li
            v-for="t in dashboard.topTeams"
            :key="t._id"
            class="list-group-item d-flex justify-content-between"
          >
            <span>{{ t.name }}</span>
            <span>{{ t.seasonPoints || 0 }} pts · {{ t.wins || 0 }} wins</span>
          </li>
        </ul>
        <p v-else class="text-muted">No teams yet.</p>
      </div>

      <div class="col-md-4 mb-3">
        <h5>Next race</h5>
        <div v-if="dashboard.nextRace" class="border rounded p-3">
          <strong>{{ dashboard.nextRace.name }}</strong>
          <div>Week {{ dashboard.nextRace.seasonWeek || 1 }} · {{ formatDate(dashboard.nextRace.date) }}</div>
          <div class="text-muted">
            {{ dashboard.nextRace.profile }} · {{ dashboard.nextRace.distance }} km
          </div>
        </div>
        <div v-else-if="dashboard.upcomingRace" class="border rounded p-3 text-muted">
          Next up (week {{ dashboard.upcomingRace.seasonWeek }}):
          <strong>{{ dashboard.upcomingRace.name }}</strong>
          — advance the season to unlock
        </div>
        <p v-else class="text-muted">Add a race to the calendar.</p>
      </div>

      <div class="col-md-4 mb-3">
        <h5>Form watch</h5>
        <ul class="list-group" v-if="dashboard.formSnapshot && dashboard.formSnapshot.length">
          <li
            v-for="(r, idx) in dashboard.formSnapshot"
            :key="idx"
            class="list-group-item d-flex justify-content-between"
          >
            <span>{{ r.name }}</span>
            <span>F{{ r.form }} / fat {{ r.fatigue }}</span>
          </li>
        </ul>
        <p v-else class="text-muted">Race once to see roster form.</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'HomeManagement',
  data() {
    return {
      dashboard: {
        season: null,
        topTeams: [],
        nextRace: null,
        upcomingRace: null,
        formSnapshot: [],
        recentResults: [],
      },
    };
  },
  created() {
    this.load();
  },
  methods: {
    formatDate(value) {
      if (!value) return 'TBD';
      return String(value).slice(0, 10);
    },
    async load() {
      try {
        const { data } = await axios.get('/api/dashboard');
        this.dashboard = data;
      } catch (err) {
        // Keep empty dashboard if API fails
      }
    },
  },
};
</script>

<style scoped>
.home {
  padding-top: 1.5rem;
}
.lead {
  max-width: 36rem;
  margin-left: auto;
  margin-right: auto;
}
</style>
