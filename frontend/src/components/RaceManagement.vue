<template>
  <div class="container">
    <h1>Race Management</h1>
    <form @submit.prevent="addRace">
      <div class="form-row">
        <div class="form-group col-md-4">
          <label for="name">Name</label>
          <input id="name" v-model="race.name" type="text" class="form-control" required>
        </div>
        <div class="form-group col-md-3">
          <label for="date">Date</label>
          <input id="date" v-model="race.date" type="date" class="form-control">
        </div>
        <div class="form-group col-md-2">
          <label for="distance">Distance (km)</label>
          <input id="distance" v-model.number="race.distance" type="number" class="form-control" min="0">
        </div>
        <div class="form-group col-md-2">
          <label for="profile">Profile</label>
          <select id="profile" v-model="race.profile" class="form-control">
            <option value="flat">Flat</option>
            <option value="hilly">Hilly</option>
            <option value="mountain">Mountain</option>
            <option value="classic">Classic</option>
            <option value="tt">Time Trial</option>
          </select>
        </div>
        <div class="form-group col-md-1">
          <label for="prestige">Prestige</label>
          <input id="prestige" v-model.number="race.prestige" type="number" class="form-control" min="1" max="100">
        </div>
      </div>
      <button type="submit" class="btn btn-primary">Add Race</button>
    </form>

    <ul class="list-group mt-3">
      <li v-for="r in races" :key="r._id" class="list-group-item">
        <strong>{{ r.name }}</strong>
        — {{ formatDate(r.date) }}
        — {{ r.distance }} km
        — {{ r.profile }}
        — prestige {{ r.prestige }}
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

const emptyRace = () => ({
  name: '',
  date: '',
  distance: 180,
  profile: 'flat',
  prestige: 50,
});

export default {
  name: 'RaceManagement',
  data() {
    return {
      races: [],
      race: emptyRace(),
    };
  },
  created() {
    this.fetchRaces();
  },
  methods: {
    formatDate(value) {
      if (!value) return '—';
      return String(value).slice(0, 10);
    },
    async fetchRaces() {
      const response = await axios.get('/api/races');
      this.races = response.data;
    },
    async addRace() {
      const response = await axios.post('/api/races', this.race);
      this.races.push(response.data);
      this.race = emptyRace();
    },
  },
};
</script>
