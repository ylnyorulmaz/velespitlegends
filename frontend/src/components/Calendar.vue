<template>
  <div class="container">
    <h1>Race Calendar</h1>
    <p class="text-muted">Pick a race, your team, and 3–8 riders, then race.</p>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <div class="form-row mb-3">
      <div class="form-group col-md-6">
        <label for="team">Team</label>
        <select id="team" v-model="selectedTeamId" class="form-control">
          <option disabled value="">Select team</option>
          <option v-for="t in teams" :key="t._id" :value="t._id">
            {{ t.name }} (wins {{ t.wins || 0 }})
          </option>
        </select>
      </div>
      <div class="form-group col-md-6">
        <label for="race">Race</label>
        <select id="race" v-model="selectedRaceId" class="form-control">
          <option disabled value="">Select race</option>
          <option v-for="r in races" :key="r._id" :value="r._id">
            {{ formatDate(r.date) }} — {{ r.name }} ({{ r.profile }}, {{ r.distance }} km)
          </option>
        </select>
      </div>
    </div>

    <h5>Select riders ({{ selectedRiderIds.length }}/8)</h5>
    <div v-if="!cyclists.length" class="alert alert-warning">
      No cyclists yet. Create some under Cyclists first.
    </div>
    <div class="rider-grid mb-3">
      <label
        v-for="c in cyclists"
        :key="c._id"
        class="rider-card"
        :class="{ selected: isSelected(c._id) }"
      >
        <input
          type="checkbox"
          :value="c._id"
          :checked="isSelected(c._id)"
          @change="toggleRider(c._id)"
        >
        <strong>{{ c.name }}</strong>
        <span>S{{ c.sprint }} C{{ c.climb }} TT{{ c.timeTrial }} E{{ c.endurance }}</span>
        <span>form {{ c.form }} · fatigue {{ c.fatigue }} · {{ c.specialty }}</span>
      </label>
    </div>

    <button
      class="btn btn-primary"
      :disabled="submitting || !canEnter"
      @click="enterRace"
    >
      {{ submitting ? 'Racing…' : 'Enter Race' }}
    </button>

    <hr class="my-4">
    <h4>Upcoming / all races</h4>
    <ul class="list-group">
      <li v-for="r in races" :key="'list-' + r._id" class="list-group-item">
        <strong>{{ r.name }}</strong>
        — {{ formatDate(r.date) }}
        — {{ r.distance }} km · {{ r.profile }} · prestige {{ r.prestige }}
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Calendar',
  data() {
    return {
      races: [],
      teams: [],
      cyclists: [],
      selectedRaceId: '',
      selectedTeamId: '',
      selectedRiderIds: [],
      submitting: false,
      error: '',
      success: '',
    };
  },
  computed: {
    canEnter() {
      return (
        this.selectedRaceId
        && this.selectedTeamId
        && this.selectedRiderIds.length >= 3
        && this.selectedRiderIds.length <= 8
      );
    },
  },
  created() {
    this.load();
  },
  methods: {
    formatDate(value) {
      if (!value) return 'TBD';
      return String(value).slice(0, 10);
    },
    isSelected(id) {
      return this.selectedRiderIds.includes(id);
    },
    toggleRider(id) {
      if (this.isSelected(id)) {
        this.selectedRiderIds = this.selectedRiderIds.filter((x) => x !== id);
        return;
      }
      if (this.selectedRiderIds.length >= 8) {
        this.error = 'Maximum 8 riders';
        return;
      }
      this.error = '';
      this.selectedRiderIds = [...this.selectedRiderIds, id];
    },
    async load() {
      const [races, teams, cyclists] = await Promise.all([
        axios.get('/api/races'),
        axios.get('/api/teams'),
        axios.get('/api/cyclists'),
      ]);
      this.races = races.data;
      this.teams = teams.data;
      this.cyclists = cyclists.data;
      if (this.teams.length && !this.selectedTeamId) {
        this.selectedTeamId = this.teams[0]._id;
      }
      if (this.races.length && !this.selectedRaceId) {
        this.selectedRaceId = this.races[0]._id;
      }
    },
    async enterRace() {
      if (!this.canEnter) return;
      this.submitting = true;
      this.error = '';
      this.success = '';
      try {
        const { data } = await axios.post(`/api/races/${this.selectedRaceId}/enter`, {
          teamId: this.selectedTeamId,
          cyclistIds: this.selectedRiderIds,
        });
        this.success = 'Race finished — opening result…';
        this.$router.push(`/results/${data._id}`);
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Failed to enter race';
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<style scoped>
.rider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}
.rider-card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  padding: 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.rider-card.selected {
  border-color: #007bff;
  background: #eef5ff;
}
.rider-card input {
  margin-bottom: 0.35rem;
}
</style>
