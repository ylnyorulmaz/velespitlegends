<template>
  <div class="container">
    <h1>Stage Races</h1>
    <p class="text-muted">Multi-stage tours with a general classification (GC).</p>

    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">Create stage race</h5>
        <form @submit.prevent="createStageRace">
          <div class="form-row">
            <div class="form-group col-md-5">
              <label>Tour name</label>
              <input v-model="form.name" type="text" class="form-control" required placeholder="e.g. Alpine Tour">
            </div>
            <div class="form-group col-md-3">
              <label>Start week</label>
              <input v-model.number="form.seasonWeekStart" type="number" class="form-control" min="1">
            </div>
            <div class="form-group col-md-2">
              <label>Prestige</label>
              <input v-model.number="form.prestige" type="number" class="form-control" min="1" max="100">
            </div>
            <div class="form-group col-md-2 d-flex align-items-end">
              <button type="button" class="btn btn-outline-secondary btn-block" @click="addStage">
                + Stage
              </button>
            </div>
          </div>

          <div
            v-for="(stage, idx) in form.stages"
            :key="'stage-' + idx"
            class="stage-row border rounded p-2 mb-2"
          >
            <div class="form-row">
              <div class="form-group col-md-4">
                <label>Stage {{ idx + 1 }} name</label>
                <input v-model="stage.name" type="text" class="form-control" :placeholder="'Stage ' + (idx + 1)">
              </div>
              <div class="form-group col-md-2">
                <label>Distance</label>
                <input v-model.number="stage.distance" type="number" class="form-control" min="50">
              </div>
              <div class="form-group col-md-2">
                <label>Profile</label>
                <select v-model="stage.profile" class="form-control">
                  <option value="flat">Flat</option>
                  <option value="hilly">Hilly</option>
                  <option value="mountain">Mountain</option>
                  <option value="classic">Classic</option>
                  <option value="tt">TT</option>
                </select>
              </div>
              <div class="form-group col-md-2">
                <label>Week</label>
                <input v-model.number="stage.seasonWeek" type="number" class="form-control" min="1">
              </div>
              <div class="form-group col-md-2 d-flex align-items-end">
                <button
                  type="button"
                  class="btn btn-outline-danger btn-block"
                  :disabled="form.stages.length <= 2"
                  @click="removeStage(idx)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div v-if="formError" class="alert alert-danger py-2">{{ formError }}</div>
          <button type="submit" class="btn btn-primary">Create tour</button>
        </form>
      </div>
    </div>

    <div v-if="!stageRaces.length" class="alert alert-secondary">No stage races yet.</div>

    <div v-for="tour in stageRaces" :key="tour._id" class="card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between flex-wrap">
          <div>
            <h5 class="mb-1">{{ tour.name }}</h5>
            <span class="text-muted small">
              Week {{ tour.seasonWeekStart }} · prestige {{ tour.prestige }}
              · <span class="badge" :class="tour.status === 'completed' ? 'badge-success' : 'badge-info'">
                {{ tour.status }}
              </span>
            </span>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary" @click="loadDetail(tour._id)">
            {{ expandedId === tour._id ? 'Hide' : 'Details' }}
          </button>
        </div>

        <div v-if="expandedId === tour._id && tourDetail" class="mt-3">
          <h6>Stages</h6>
          <ul class="list-group mb-3">
            <li
              v-for="stage in tourDetail.stages"
              :key="stage._id"
              class="list-group-item"
            >
              Stage {{ stage.stageNumber }}: {{ stage.name }}
              — {{ stage.distance }} km · {{ stage.profile }} · week {{ stage.seasonWeek }}
            </li>
          </ul>

          <h6>GC standings</h6>
          <table v-if="tourDetail.stageRace.gcStandings && tourDetail.stageRace.gcStandings.length" class="table table-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>Pts</th>
                <th>Stages</th>
                <th>Wins</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in tourDetail.stageRace.gcStandings" :key="idx">
                <td>{{ idx + 1 }}</td>
                <td>{{ row.team && row.team.name }}</td>
                <td>{{ row.totalPoints }}</td>
                <td>{{ row.stagesCompleted }}</td>
                <td>{{ row.stageWins }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-muted small">No GC data yet — complete stage 1 from Calendar.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

const emptyStage = (week) => ({
  name: '',
  distance: 160,
  profile: 'hilly',
  seasonWeek: week,
});

export default {
  name: 'StageRaceManagement',
  data() {
    return {
      stageRaces: [],
      form: {
        name: '',
        seasonWeekStart: 1,
        prestige: 75,
        stages: [emptyStage(1), emptyStage(2), emptyStage(3)],
      },
      formError: '',
      expandedId: null,
      tourDetail: null,
    };
  },
  created() {
    this.fetchStageRaces();
  },
  methods: {
    addStage() {
      const week = this.form.seasonWeekStart + this.form.stages.length;
      this.form.stages.push(emptyStage(week));
    },
    removeStage(index) {
      this.form.stages.splice(index, 1);
    },
    async fetchStageRaces() {
      const { data } = await axios.get('/api/stage-races');
      this.stageRaces = data;
    },
    async createStageRace() {
      this.formError = '';
      try {
        await axios.post('/api/stage-races', this.form);
        this.form.name = '';
        this.form.stages = [emptyStage(1), emptyStage(2), emptyStage(3)];
        await this.fetchStageRaces();
      } catch (err) {
        this.formError = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Failed to create stage race';
      }
    },
    async loadDetail(id) {
      if (this.expandedId === id) {
        this.expandedId = null;
        this.tourDetail = null;
        return;
      }
      const { data } = await axios.get(`/api/stage-races/${id}`);
      this.expandedId = id;
      this.tourDetail = data;
    },
  },
};
</script>

<style scoped>
.stage-row {
  background: #f8f9fa;
}
</style>
