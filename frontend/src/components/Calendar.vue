<template>
  <div class="page-container">
    <PageHeader
      title="Race Calendar"
      subtitle="Pick a race, assign roles, select 3–8 riders, and line up your tactic."
      eyebrow="Race day"
    />

    <LoadingState v-if="loading" label="Loading calendar…" />

    <template v-else>
    <div v-if="season" class="season-bar vl-card mb-3">
      <div class="vl-card-body py-2 d-flex flex-wrap justify-content-between align-items-center">
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

    <div v-if="seasonSummary" class="alert alert-success">
      <h5 class="alert-heading mb-2">Season {{ seasonSummary.champion ? '' : '' }}complete</h5>
      <p class="mb-2">{{ seasonSummary.headline }}</p>
      <ul class="mb-2 small" v-if="seasonSummary.champion">
        <li>
          <strong>Champion:</strong> {{ seasonSummary.champion.name }}
          ({{ seasonSummary.champion.seasonPoints }} pts · {{ seasonSummary.champion.wins }} wins)
        </li>
        <li v-if="seasonSummary.budgetLeader">
          <strong>Healthiest budget:</strong> {{ seasonSummary.budgetLeader.name }}
          ({{ $ui.formatMoney(seasonSummary.budgetLeader.budget) }})
        </li>
      </ul>
      <div class="row small" v-if="seasonSummary.mostImproved && seasonSummary.mostImproved.length">
        <div class="col-md-6">
          <strong>Most improved</strong>
          <ul class="mb-0">
            <li v-for="r in seasonSummary.mostImproved" :key="'up-' + r.name">
              {{ r.name }} ({{ r.netDelta > 0 ? '+' : '' }}{{ r.netDelta }})
            </li>
          </ul>
        </div>
        <div class="col-md-6" v-if="seasonSummary.mostDeclined && seasonSummary.mostDeclined.length">
          <strong>Fading</strong>
          <ul class="mb-0">
            <li v-for="r in seasonSummary.mostDeclined" :key="'down-' + r.name">
              {{ r.name }} ({{ r.netDelta }})
            </li>
          </ul>
        </div>
      </div>
      <router-link to="/" class="btn btn-sm btn-outline-success mt-2">View on home</router-link>
    </div>

    <div v-if="error" class="alert alert-danger alert-dismissible fade show">
      {{ error }}
      <button type="button" class="close" @click="error = ''"><span>&times;</span></button>
    </div>
    <div v-if="success" class="alert alert-success alert-dismissible fade show">
      {{ success }}
      <button type="button" class="close" @click="success = ''"><span>&times;</span></button>
    </div>
    <div v-if="isCurrentEntryCompleted" class="alert alert-secondary">
      This team already completed the selected race. Pick another race or team.
    </div>
    <div v-else-if="rivalPreview && rivalPreview.rivalTeamCount" class="alert alert-info py-2">
      <strong>{{ rivalPreview.rivalTeamCount }} rival team(s)</strong> will start against you:
      {{ rivalPreview.rivals.map((r) => r.teamName).join(', ') }}.
      They auto-select a squad and earn season points too.
    </div>
    <div v-else-if="rivalPreview && rivalPreview.rivalTeamCount === 0" class="alert alert-light py-2 small">
      No other rostered teams available — wild-card fillers will pad the peloton.
    </div>

    <div class="form-row mb-3 vl-panel">
      <div class="col-12"><h6 class="text-muted mb-3">Race setup</h6></div>
      <div class="form-group col-md-4">
        <label for="team">Team</label>
        <select id="team" v-model="selectedTeamId" class="form-control" @change="onTeamChange">
          <option disabled value="">Select team</option>
          <option v-for="t in teams" :key="t._id" :value="t._id">
            {{ t.name }} (wins {{ t.wins || 0 }} · {{ formatBudget(t.budget) }})
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
        <span class="rider-meta">form {{ c.form }} · fatigue {{ c.fatigue }}</span>
        <div class="stat-bars mt-1">
          <div class="stat-bar-row">
            <span class="stat-bar-label">S</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" :style="{ width: $ui.statBarWidth(c.sprint) }" /></div>
          </div>
          <div class="stat-bar-row">
            <span class="stat-bar-label">C</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" :style="{ width: $ui.statBarWidth(c.climb) }" /></div>
          </div>
        </div>
        <span class="rider-meta">{{ c.specialty }}</span>
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
      class="btn btn-primary btn-lg"
      :disabled="submitting || !canEnter"
      @click="enterRace"
    >
      <span v-if="submitting" class="spinner-border spinner-border-sm mr-1" role="status" />
      {{ submitting ? 'Going to race day…' : 'Start race day' }}
    </button>

    <section class="mt-5">
      <h5 class="mb-3">Season calendar</h5>
      <div class="vl-card">
    <ul class="list-group list-group-flush">
      <li
        v-for="r in races"
        :key="'list-' + r._id"
        class="list-group-item vl-list-item"
        :class="{ 'bg-light': isRaceCompletedForTeam(r._id) }"
      >
        <div>
          <strong>{{ r.name }}</strong>
          <div class="small text-muted mt-1">
            {{ formatDate(r.date) }}
            · {{ r.distance }} km
            · <span :class="'profile-pill ' + $ui.profileBadgeClass(r.profile)">{{ r.profile }}</span>
            · week {{ r.seasonWeek || 1 }}
          </div>
        </div>
        <div>
          <span v-if="r.stageNumber" class="badge badge-primary mr-1">S{{ r.stageNumber }}</span>
          <span v-if="isRaceLocked(r)" class="badge badge-warning mr-1">locked</span>
          <span v-if="isRaceCompletedForTeam(r._id)" class="badge badge-success">done</span>
        </div>
      </li>
    </ul>
      </div>
    </section>
    </template>
  </div>
</template>

<script>
import axios from 'axios';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';

export default {
  name: 'Calendar',
  components: { PageHeader, LoadingState },
  data() {
    return {
      loading: true,
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
      rivalPreview: null,
      seasonSummary: null,
    };
  },
  watch: {
    selectedRaceId() {
      this.loadRivalPreview();
    },
    selectedTeamId() {
      this.loadRivalPreview();
    },
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
      this.loadRivalPreview();
    },
    async loadRivalPreview() {
      this.rivalPreview = null;
      if (!this.selectedRaceId || !this.selectedTeamId || this.isCurrentEntryCompleted) return;
      try {
        const { data } = await axios.get(`/api/races/${this.selectedRaceId}/rivals`, {
          params: { teamId: this.selectedTeamId },
        });
        this.rivalPreview = data;
      } catch (err) {
        this.rivalPreview = null;
      }
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
    formatBudget(value) {
      if (this.$ui && this.$ui.formatMoney) return this.$ui.formatMoney(value);
      return `$${Number(value || 0).toLocaleString('en-US')}`;
    },
    async advanceSeason() {
      this.advancingSeason = true;
      this.error = '';
      this.success = '';
      try {
        const { data } = await axios.post('/api/season/advance');
        this.season = data.season;
        this.success = data.message;
        if (data.summary) this.seasonSummary = data.summary;
        await Promise.all([this.reloadTeams(), this.loadCyclists(), this.loadSeasonSummary()]);
        if (this.$root && this.$root.$emit) {
          this.$root.$emit('season-updated', data.season);
        }
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Failed to advance season';
      } finally {
        this.advancingSeason = false;
      }
    },
    async loadCyclists() {
      const { data } = await axios.get('/api/cyclists');
      this.cyclists = data;
    },
    async loadSeasonSummary() {
      try {
        const { data } = await axios.get('/api/season/summary');
        this.seasonSummary = data.complete ? data.summary : null;
      } catch (err) {
        this.seasonSummary = null;
      }
    },
    async load() {
      this.loading = true;
      try {
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
      await Promise.all([this.loadRivalPreview(), this.loadSeasonSummary()]);
      } finally {
        this.loading = false;
      }
    },
    async enterRace() {
      if (!this.canEnter) return;
      this.submitting = true;
      this.error = '';
      this.success = '';
      try {
        const { data } = await axios.post(`/api/races/${this.selectedRaceId}/live/start`, {
          teamId: this.selectedTeamId,
          cyclistIds: this.selectedRiderIds,
          tactic: this.selectedTactic,
          roles: this.riderRoles,
        });
        this.success = 'Race day — opening radio…';
        this.$router.push(`/race-day/${data.sessionId}`);
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Failed to start race';
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
