<template>
  <div class="page-container home">
    <LoadingState v-if="loading" label="Loading dashboard…" />

    <template v-else>
      <section class="hero-banner">
        <div v-if="dashboard.season" class="hero-season">
          Season {{ dashboard.season.year }} · Week {{ dashboard.season.currentWeek }} / {{ dashboard.season.totalWeeks }}
        </div>
        <h1 class="page-title">Velespit Legends</h1>
        <p class="lead">Build your squad, pick your tactics, and race through the season. Every decision counts.</p>
        <div class="hero-actions">
          <router-link to="/calendar" class="btn btn-primary mr-2 mb-2">Enter a race</router-link>
          <router-link to="/standings" class="btn btn-outline-light mr-2 mb-2">Standings</router-link>
          <router-link to="/transfers" class="btn btn-outline-light mr-2 mb-2">Transfers</router-link>
          <router-link to="/stage-races" class="btn btn-outline-light mb-2">Stage races</router-link>
        </div>
      </section>

      <div class="row">
        <div class="col-md-4 mb-3">
          <div class="stat-tile">
            <div class="stat-tile-label">Team standings</div>
            <template v-if="dashboard.topTeams && dashboard.topTeams.length">
              <ul class="list-unstyled mb-0">
                <li
                  v-for="(t, idx) in dashboard.topTeams"
                  :key="t._id"
                  class="vl-list-item px-0"
                >
                  <span>
                    <span class="rank-badge mr-2" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</span>
                    {{ t.name }}
                  </span>
                  <span class="text-muted small">{{ t.seasonPoints || 0 }} pts</span>
                </li>
              </ul>
            </template>
            <EmptyState
              v-else
              icon="🏆"
              title="No teams yet"
              message="Create a team to start the season."
            />
          </div>
        </div>

        <div class="col-md-4 mb-3">
          <div class="stat-tile">
            <div class="stat-tile-label">Next race</div>
            <template v-if="dashboard.nextRace">
              <div class="stat-tile-value" style="font-size: 1.15rem;">{{ dashboard.nextRace.name }}</div>
              <div class="stat-tile-meta">
                Week {{ dashboard.nextRace.seasonWeek || 1 }}
                · {{ $ui.formatDate(dashboard.nextRace.date) }}
              </div>
              <div class="mt-2">
                <span :class="'profile-pill ' + $ui.profileBadgeClass(dashboard.nextRace.profile)">
                  {{ $ui.profileLabel(dashboard.nextRace.profile) }}
                </span>
                <span class="text-muted small ml-2">{{ dashboard.nextRace.distance }} km</span>
              </div>
              <router-link to="/calendar" class="btn btn-sm btn-outline-primary mt-3">Go to calendar</router-link>
            </template>
            <div v-else-if="dashboard.upcomingRace" class="stat-tile-meta">
              <strong>{{ dashboard.upcomingRace.name }}</strong> unlocks week {{ dashboard.upcomingRace.seasonWeek }}.
              Advance the season on the calendar.
            </div>
            <EmptyState
              v-else
              icon="🗓"
              title="No races scheduled"
              message="Add races under Race Management."
            />
          </div>
        </div>

        <div class="col-md-4 mb-3">
          <div class="stat-tile">
            <div class="stat-tile-label">Form watch</div>
            <template v-if="dashboard.formSnapshot && dashboard.formSnapshot.length">
              <ul class="list-unstyled mb-0">
                <li
                  v-for="(r, idx) in dashboard.formSnapshot"
                  :key="idx"
                  class="vl-list-item px-0"
                >
                  <span>{{ r.name }}</span>
                  <span class="small">
                    <span class="text-success">F{{ r.form }}</span>
                    <span class="text-muted"> · fat {{ r.fatigue }}</span>
                  </span>
                </li>
              </ul>
            </template>
            <EmptyState
              v-else
              icon="📊"
              title="No form data"
              message="Enter a race to track rider condition."
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import axios from 'axios';
import LoadingState from '@/components/LoadingState.vue';
import EmptyState from '@/components/EmptyState.vue';

export default {
  name: 'HomeManagement',
  components: { LoadingState, EmptyState },
  data() {
    return {
      loading: true,
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
    async load() {
      this.loading = true;
      try {
        const { data } = await axios.get('/api/dashboard');
        this.dashboard = data;
      } catch (err) {
        // Keep empty dashboard if API fails
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
