<template>
  <div id="app">
    <nav class="app-navbar navbar navbar-expand-lg navbar-dark">
      <router-link to="/" class="navbar-brand">
        <span class="brand-mark">V</span>
        Velespit Legends
      </router-link>

      <button
        class="navbar-toggler"
        type="button"
        data-toggle="collapse"
        data-target="#mainNav"
        aria-controls="mainNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon" />
      </button>

      <div id="mainNav" class="collapse navbar-collapse">
        <ul class="navbar-nav mr-auto">
          <li class="nav-section-label d-none d-lg-block">Race</li>
          <li class="nav-item">
            <router-link to="/calendar" class="nav-link">Calendar</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/results" class="nav-link">Results</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/standings" class="nav-link">Standings</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/stage-races" class="nav-link">Stage Races</router-link>
          </li>

          <li class="nav-section-label d-none d-lg-block">Team</li>
          <li class="nav-item">
            <router-link to="/teams" class="nav-link">Teams</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/cyclists" class="nav-link">Cyclists</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/transfers" class="nav-link">Transfers</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/staff" class="nav-link">Staff</router-link>
          </li>

          <li class="nav-section-label d-none d-lg-block">Setup</li>
          <li class="nav-item">
            <router-link to="/races" class="nav-link">Races</router-link>
          </li>
        </ul>

        <div v-if="season" class="navbar-season-pill">
          S{{ season.year }} · W{{ season.currentWeek }}/{{ season.totalWeeks }}
        </div>
      </div>
    </nav>

    <main class="app-main">
      <router-view />
    </main>

    <footer class="app-footer">
      Velespit Legends — manage your team, race the season.
    </footer>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'App',
  data() {
    return {
      season: null,
    };
  },
  created() {
    this.loadSeason();
    this.$root.$on('season-updated', this.onSeasonUpdated);
  },
  beforeDestroy() {
    this.$root.$off('season-updated', this.onSeasonUpdated);
  },
  watch: {
    $route() {
      this.loadSeason();
    },
  },
  methods: {
    onSeasonUpdated(season) {
      if (season) this.season = season;
      else this.loadSeason();
    },
    async loadSeason() {
      try {
        const { data } = await axios.get('/api/season');
        this.season = data;
      } catch (err) {
        this.season = null;
      }
    },
  },
};
</script>
