<template>
  <div class="container">
    <h1>Season Standings</h1>

    <div class="row">
      <div class="col-md-6 mb-4">
        <h5>Teams</h5>
        <table class="table table-sm table-striped">
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
              <td>{{ team.rank }}</td>
              <td>{{ team.name }}</td>
              <td>{{ team.seasonPoints }}</td>
              <td>{{ team.wins }}</td>
              <td>{{ team.rosterSize }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!standings.teams.length" class="text-muted">No teams yet.</p>
      </div>

      <div class="col-md-6 mb-4">
        <h5>Riders</h5>
        <table class="table table-sm table-striped">
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
              <td>{{ rider.rank }}</td>
              <td>{{ rider.name }}</td>
              <td>{{ rider.points }}</td>
              <td>{{ rider.races }}</td>
              <td>{{ rider.wins }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!standings.riders.length" class="text-muted">No rider results yet.</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Standings',
  data() {
    return {
      standings: { teams: [], riders: [] },
    };
  },
  created() {
    this.load();
  },
  methods: {
    async load() {
      const { data } = await axios.get('/api/standings');
      this.standings = data;
    },
  },
};
</script>
