<template>
  <div class="container">
    <h1>Race Calendar</h1>
    <p class="text-muted">Pick a race, your team, rider roles, and 3–8 roster riders, then race.</p>

    <div v-if="season" class="season-bar card mb-3">
      <div class="card-body py-2 d-flex flex-wrap justify-content-between align-items-center">
        <div>
          <strong>Season {{ season.year }}</strong>
          — Week {{ season.currentWeek }} / {{ season.totalWeeks }}
          <span v-if="season.status === 'completed'" class="badge badge-secondary ml-2">completed</span>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="advancingSeason || season.status === 'completed'"
          @click="advanceSeason"
        >
          {{ advancingSeason ? 'Advancing…' : 'Advance week' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <div v-if="isCurrentEntryCompleted" class="alert alert-secondary">
      This team already completed the selected race. Pick another race or team.
    </div>

    <div class="form-row mb-3">
      <div class="form-group col-md-4">
        <label for="team">Team</label>
        <select id="team" v-model="selectedTeamId" class="form-control" @change="onTeamChange">
          <option disabled value="">Select team</option>
          <option v-for="t in teams" :key="t._id" :value="t._id">
            {{ t.name }} (wins {{ t.wins || 0 }})
          </option>
        </select>
      </div>
      <div class="form-group col-md-4">
        <label for="race">Race</label>
        <select id="race" v-model="selectedRaceId" class="form-control">
          <option disabled value="">Select race</option>
          <option
            v-for="r in availableRaces"
            :key="r._id"
            :value="r._id"
            :disabled="isRaceCompletedForTeam(r._id)"
          >
            W{{ r.seasonWeek || 1 }} · {{ formatDate(r.date) }} — {{ r.name }} ({{ r.profile }}, {{ r.distance }} km)
            {{ isRaceCompletedForTeam(r._id) ? ' ✓ done' : '' }}
            {{ isRaceLocked(r) ? ' 🔒' : '' }}
          </option>
        </select>
      </div>
      <div class="form-group col-md-4">
        <label for="tactic">Team tactic</label>
        <select id="tactic" v-model="selectedTactic" class="form-control">
          <option v-for="(info, key) in tactics" :key="key" :value="key">
            {{ info.label }}
          </option>
        </select>
        <small v-if="tactics[selectedTactic]" class="form-text text-muted">
          {{ tactics[selectedTactic].description }}
        </small>
      </div>
    </div>

    <div v-if="selectedRace && selectedRace.stageRace" class="alert alert-info py-2">
      Stage race stage {{ selectedRace.stageNumber }}
      <span v-if="selectedRace.stageNumber > 1"> — complete previous stage first</span>
    </div>

    <div v-if="isSelectedRaceLocked" class="alert alert-warning">
      This race opens in week {{ selectedRace.seasonWeek }}. Advance the season to race it.
    </div>

    <h5>Select riders ({{ selectedRiderIds.length }}/8)</h5>
    <div v-if="!availableCyclists.length" class="alert alert-warning">
      <span v-if="selectedTeam && selectedTeam.roster && selectedTeam.roster.length">
        No roster riders found. Add cyclists to this team first (enter a race once to attach them).
      </span>
      <span v-else-if="!cyclists.length">
        No cyclists yet. Create some under Cyclists first.
      </span>
      <span v-else>
        This team has no roster yet — showing all cyclists. They will join the roster after the race.
      </span>
    </div>
    <div class="rider-grid mb-3">
      <div
        v-for="c in availableCyclists"
        :key="c._id"
        class="rider-card"
        :class="{ selected: isSelected(c._id), injured: isInjured(c) }"
      >
        <label class="rider-select">
          <input
            type="checkbox"
            :value="c._id"
            :checked="isSelected(c._id)"
            :disabled="isInjured(c)"
            @change="toggleRider(c._id)"
          >
          <strong>{{ c.name }}</strong>
          <span v-if="isInjured(c)" class="badge badge-danger ml-1">{{ injuryLabel(c) }}</span>
        </label>
        <span>S{{ c.sprint }} C{{ c.climb }} TT{{ c.timeTrial }} E{{ c.endurance }}</span>
        <span>form {{ c.form }} · fatigue {{ c.fatigue }} · {{ c.specialty }}</span>
        <select
          v-if="isSelected(c._id)"
          v-model="riderRoles[c._id]"
          class="form-control form-control-sm mt-1"
          @click.stop
        >
          <option v-for="(info, key) in roles" :key="key" :value="key">
            {{ info.label }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="selectedTeam && selectedTeam.roster && selectedTeam.roster.length" class="rest-panel card mb-3">
      <div class="card-body py-2">
        <div class="d-flex flex-wrap justify-content-between align-items-center mb-2">
          <strong>Rest day</strong>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="resting || !restRiderIds.length"
            @click="restRiders"
          >
            {{ resting ? 'Resting…' : `Rest selected (${restRiderIds.length})` }}
          </button>
        </div>
        <div class="rest-grid">
          <label v-for="c in teamRosterCyclists" :key="'rest-' + c._id" class="rest-rider">
            <input
              type="checkbox"
              :value="c._id"
              :checked="restRiderIds.includes(c._id)"
              @change="toggleRestRider(c._id)"
            >
            {{ c.name }} (fat {{ c.fatigue }})
          </label>
        </div>
      </div>
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
      <li
        v-for="r in races"
        :key="'list-' + r._id"
        class="list-group-item"
        :class="{ 'list-group-item-secondary': isRaceCompletedForTeam(r._id) }"
      >
        <strong>{{ r.name }}</strong>
        — {{ formatDate(r.date) }}
        — {{ r.distance }} km · {{ r.profile }} · prestige {{ r.prestige }} · week {{ r.seasonWeek || 1 }}
        <span v-if="r.stageNumber" class="badge badge-primary ml-1">Stage {{ r.stageNumber }}</span>
        <span v-if="isRaceLocked(r)" class="badge badge-warning ml-2">locked</span>
        <span v-if="isRaceCompletedForTeam(r._id)" class="badge badge-success ml-2">completed</span>
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
      selectedTactic: 'balanced',
      tactics: {},
      roles: {},
      riderRoles: {},
      season: null,
      advancingSeason: false,
      restRiderIds: [],
      resting: false,
      submitting: false,
      error: '',
      success: '',
    };
  },
  computed: {
    selectedTeam() {
      return this.teams.find((t) => t._id === this.selectedTeamId) || null;
    },
    selectedRace() {
      return this.races.find((r) => r._id === this.selectedRaceId) || null;
    },
    availableRaces() {
      return this.races;
    },
    teamRosterCyclists() {
      if (!this.selectedTeam || !this.selectedTeam.roster) return [];
      const rosterIds = new Set(this.selectedTeam.roster.map((r) => String(r._id || r)));
      return this.cyclists.filter((c) => rosterIds.has(String(c._id)));
    },
    availableCyclists() {
      if (!this.selectedTeam || !this.selectedTeam.roster || !this.selectedTeam.roster.length) {
        return this.cyclists;
      }
      const rosterIds = new Set(this.selectedTeam.roster.map((r) => String(r._id || r)));
      return this.cyclists.filter((c) => rosterIds.has(String(c._id)));
    },
    isCurrentEntryCompleted() {
      return this.isRaceCompletedForTeam(this.selectedRaceId);
    },
    isSelectedRaceLocked() {
      return this.selectedRace && this.isRaceLocked(this.selectedRace);
    },
    canEnter() {
      return (
        this.selectedRaceId
        && this.selectedTeamId
        && this.selectedRiderIds.length >= 3
        && this.selectedRiderIds.length <= 8
        && !this.isCurrentEntryCompleted
        && !this.isSelectedRaceLocked
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
    isRaceCompletedForTeam(raceId) {
      if (!raceId || !this.selectedTeamId) return false;
      const race = this.races.find((r) => r._id === raceId);
      if (!race || !race.completedEntries) return false;
      return race.completedEntries.some(
        (entry) => String(entry.team) === String(this.selectedTeamId),
      );
    },
    isRaceLocked(race) {
      if (!race || !this.season) return false;
      return (race.seasonWeek || 1) > this.season.currentWeek;
    },
    isInjured(cyclist) {
      return cyclist.injured
        || (cyclist.injury && cyclist.injury.type !== 'none' && (cyclist.injury.weeksRemaining || 0) > 0);
    },
    injuryLabel(cyclist) {
      if (!this.isInjured(cyclist)) return '';
      const weeks = cyclist.injury && cyclist.injury.weeksRemaining;
      const type = cyclist.injury && cyclist.injury.type === 'crash' ? 'crash' : 'illness';
      return `${type} ${weeks}w`;
    },
    onTeamChange() {
      this.selectedRiderIds = [];
      this.riderRoles = {};
      this.restRiderIds = [];
      this.error = '';
    },
    isSelected(id) {
      return this.selectedRiderIds.includes(id);
    },
    toggleRider(id) {
      const cyclist = this.cyclists.find((c) => c._id === id);
      if (cyclist && this.isInjured(cyclist)) {
        this.error = `${cyclist.name} is injured and cannot race.`;
        return;
      }
      if (this.isSelected(id)) {
        this.selectedRiderIds = this.selectedRiderIds.filter((x) => x !== id);
        const nextRoles = { ...this.riderRoles };
        delete nextRoles[id];
        this.riderRoles = nextRoles;
        return;
      }
      if (this.selectedRiderIds.length >= 8) {
        this.error = 'Maximum 8 riders';
        return;
      }
      this.error = '';
      this.selectedRiderIds = [...this.selectedRiderIds, id];
      if (!this.riderRoles[id]) {
        this.$set(this.riderRoles, id, 'domestique');
      }
    },
    toggleRestRider(id) {
      if (this.restRiderIds.includes(id)) {
        this.restRiderIds = this.restRiderIds.filter((x) => x !== id);
      } else {
        this.restRiderIds = [...this.restRiderIds, id];
      }
    },
    async restRiders() {
      if (!this.restRiderIds.length) return;
      this.resting = true;
      this.error = '';
      try {
        await axios.post('/api/cyclists/rest', { cyclistIds: this.restRiderIds });
        this.success = 'Riders rested — fatigue reduced.';
        this.restRiderIds = [];
        const { data } = await axios.get('/api/cyclists');
        this.cyclists = data;
        await this.reloadTeams();
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Rest failed';
      } finally {
        this.resting = false;
      }
    },
    async reloadTeams() {
      const { data } = await axios.get('/api/teams');
      this.teams = data;
    },
    async advanceSeason() {
      this.advancingSeason = true;
      this.error = '';
      this.success = '';
      try {
        const { data } = await axios.post('/api/season/advance');
        this.season = data.season;
        this.success = data.message;
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Failed to advance season';
      } finally {
        this.advancingSeason = false;
      }
    },
    async load() {
      const [races, teams, cyclists, tactics, roles, season] = await Promise.all([
        axios.get('/api/races'),
        axios.get('/api/teams'),
        axios.get('/api/cyclists'),
        axios.get('/api/tactics'),
        axios.get('/api/roles'),
        axios.get('/api/season'),
      ]);
      this.races = races.data;
      this.teams = teams.data;
      this.cyclists = cyclists.data;
      this.tactics = tactics.data;
      this.roles = roles.data;
      this.season = season.data;
      if (this.teams.length && !this.selectedTeamId) {
        this.selectedTeamId = this.teams[0]._id;
      }
      if (this.races.length && !this.selectedRaceId) {
        this.selectedRaceId = this.races.find(
          (r) => !this.isRaceCompletedForTeam(r._id),
        )?._id || this.races[0]._id;
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
          tactic: this.selectedTactic,
          roles: this.riderRoles,
        });
        this.success = 'Race finished — opening result…';
        await this.load();
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
.rider-select {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
  cursor: pointer;
}
.rest-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
}
.rest-rider {
  margin: 0;
  cursor: pointer;
}
.rider-card.injured {
  opacity: 0.75;
  background: #fff5f5;
}
.season-bar {
  max-width: 48rem;
}
</style>
