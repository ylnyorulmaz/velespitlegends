<template>
  <div class="page-container">
    <PageHeader
      title="Season Standings"
      subtitle="Team and rider points across the season."
      eyebrow="Rankings"
    />

    <LoadingState v-if="loading" label="Loading standings…" />

    <div v-else class="row">
      <div class="col-md-6 mb-4">
        <h5>Teams</h5>
        <div class="vl-card">
        <table class="table table-sm table-striped mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Pts</th>
              <th>Wins</th>
              <th>Roster</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="team in standings.teams" :key="team._id">
              <td><span class="rank-badge" :class="'rank-' + team.rank">{{ team.rank }}</span></td>
              <td>{{ team.name }}</td>
              <td>{{ team.seasonPoints }}</td>
              <td>{{ team.wins }}</td>
              <td>{{ team.rosterSize }}</td>
            </tr>
          </tbody>
        </table>
        </div>
        <EmptyState v-if="!standings.teams.length" icon="🏆" title="No teams yet" />
      </div>

      <div class="col-md-6 mb-4">
        <h5 class="mb-3">Riders</h5>
        <div class="vl-card">
        <table class="table table-sm table-striped mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Rider</th>
              <th>Pts</th>
              <th>Races</th>
              <th>Wins</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rider in standings.riders" :key="rider.cyclist">
              <td><span class="rank-badge" :class="'rank-' + rider.rank">{{ rider.rank }}</span></td>
              <td>{{ rider.name }}</td>
              <td>{{ rider.points }}</td>
              <td>{{ rider.races }}</td>
              <td>{{ rider.wins }}</td>
            </tr>
          </tbody>
        </table>
        </div>
        <EmptyState v-if="!standings.riders.length" icon="🚴" title="No rider results yet" />
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import EmptyState from '@/components/EmptyState.vue';

export default {
  name: 'Standings',
  components: { PageHeader, LoadingState, EmptyState },
  data() {
    return {
      loading: true,
      standings: { teams: [], riders: [] },
    };
  },
  created() {
    this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      try {
        const { data } = await axios.get('/api/standings');
        this.standings = data;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
