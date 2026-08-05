<template>
  <div class="container">
    <h1>Team Management</h1>
    <form @submit.prevent="addTeam">
      <div class="form-row">
        <div class="form-group col-md-4">
          <label for="name">Name</label>
          <input id="name" v-model="team.name" type="text" class="form-control" required>
        </div>
        <div class="form-group col-md-3">
          <label for="nationality">Nationality</label>
          <input id="nationality" v-model="team.nationality" type="text" class="form-control">
        </div>
        <div class="form-group col-md-3">
          <label for="budget">Budget</label>
          <input id="budget" v-model.number="team.budget" type="number" class="form-control" min="0">
        </div>
        <div class="form-group col-md-1">
          <label for="wins">Wins</label>
          <input id="wins" v-model.number="team.wins" type="number" class="form-control" min="0">
        </div>
        <div class="form-group col-md-1">
          <label for="ranking">Rank</label>
          <input id="ranking" v-model.number="team.ranking" type="number" class="form-control" min="0">
        </div>
      </div>
      <button type="submit" class="btn btn-primary">Add Team</button>
    </form>

    <ul class="list-group mt-3">
      <li v-for="t in teams" :key="t._id" class="list-group-item">
        <strong>{{ t.name }}</strong>
        — {{ t.nationality || '—' }}
        — budget ${{ t.budget }}
        — wins {{ t.wins }} / {{ t.seasonPoints || 0 }} pts
        — roster {{ (t.roster && t.roster.length) || 0 }}
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

const emptyTeam = () => ({
  name: '',
  nationality: '',
  budget: 1000000,
  wins: 0,
  ranking: 0,
  roster: [],
  staff: [],
});

export default {
  name: 'TeamManagement',
  data() {
    return {
      teams: [],
      team: emptyTeam(),
    };
  },
  created() {
    this.fetchTeams();
  },
  methods: {
    async fetchTeams() {
      const response = await axios.get('/api/teams');
      this.teams = response.data;
    },
    async addTeam() {
      const response = await axios.post('/api/teams', this.team);
      this.teams.push(response.data);
      this.team = emptyTeam();
    },
  },
};
</script>
