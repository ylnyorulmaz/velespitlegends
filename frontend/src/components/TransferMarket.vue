<template>
  <div class="container">
    <h1>Transfer Market</h1>
    <p class="text-muted">Sign free agents or release riders from your team.</p>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <div class="form-group col-md-4 px-0 mb-4">
      <label for="team">Your team</label>
      <select id="team" v-model="selectedTeamId" class="form-control" @change="onTeamChange">
        <option disabled value="">Select team</option>
        <option v-for="t in teams" :key="t._id" :value="t._id">
          {{ t.name }} — budget ${{ t.budget || 0 }}
        </option>
      </select>
    </div>

    <div class="row">
      <div class="col-md-7 mb-4">
        <h5>Free agents</h5>
        <div v-if="!market.length" class="alert alert-secondary">No free agents available.</div>
        <ul class="list-group">
          <li
            v-for="c in market"
            :key="c._id"
            class="list-group-item d-flex justify-content-between align-items-center flex-wrap"
          >
            <div>
              <strong>{{ c.name }}</strong>
              <span class="text-muted small ml-2">
                S{{ c.sprint }} C{{ c.climb }} E{{ c.endurance }} · age {{ c.age }}
              </span>
            </div>
            <div>
              <span class="badge badge-dark mr-2">${{ c.marketValue }}</span>
              <button
                type="button"
                class="btn btn-sm btn-primary"
                :disabled="!selectedTeamId || signing === c._id"
                @click="signRider(c._id)"
              >
                Sign
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="col-md-5 mb-4">
        <h5>Current roster</h5>
        <div v-if="!selectedTeam" class="text-muted">Select a team.</div>
        <ul v-else class="list-group">
          <li
            v-for="c in teamRoster"
            :key="'r-' + c._id"
            class="list-group-item d-flex justify-content-between align-items-center"
          >
            <div>
              {{ c.name }}
              <span v-if="isInjured(c)" class="badge badge-danger ml-1">injured</span>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="releasing === c._id"
              @click="releaseRider(c._id)"
            >
              Release
            </button>
          </li>
        </ul>
        <p v-if="selectedTeam && !teamRoster.length" class="text-muted">Empty roster.</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'TransferMarket',
  data() {
    return {
      teams: [],
      market: [],
      selectedTeamId: '',
      signing: null,
      releasing: null,
      error: '',
      success: '',
    };
  },
  computed: {
    selectedTeam() {
      return this.teams.find((t) => t._id === this.selectedTeamId) || null;
    },
    teamRoster() {
      if (!this.selectedTeam || !this.selectedTeam.roster) return [];
      return this.selectedTeam.roster;
    },
  },
  created() {
    this.load();
  },
  methods: {
    isInjured(cyclist) {
      return cyclist.injury && cyclist.injury.type !== 'none' && (cyclist.injury.weeksRemaining || 0) > 0;
    },
    onTeamChange() {
      this.error = '';
      this.success = '';
    },
    async load() {
      const [teams, market] = await Promise.all([
        axios.get('/api/teams'),
        axios.get('/api/transfers/market'),
      ]);
      this.teams = teams.data;
      this.market = market.data;
      if (this.teams.length && !this.selectedTeamId) {
        this.selectedTeamId = this.teams[0]._id;
      }
    },
    async signRider(cyclistId) {
      this.signing = cyclistId;
      this.error = '';
      this.success = '';
      try {
        const { data } = await axios.post('/api/transfers/sign', {
          teamId: this.selectedTeamId,
          cyclistId,
        });
        this.success = `Signed ${data.cyclist.name} for $${data.cost}.`;
        await this.load();
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Sign failed';
      } finally {
        this.signing = null;
      }
    },
    async releaseRider(cyclistId) {
      this.releasing = cyclistId;
      this.error = '';
      this.success = '';
      try {
        const { data } = await axios.post('/api/transfers/release', {
          teamId: this.selectedTeamId,
          cyclistId,
        });
        this.success = `Released ${data.cyclist.name} to the market.`;
        await this.load();
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Release failed';
      } finally {
        this.releasing = null;
      }
    },
  },
};
</script>
