<template>
  <div class="container">
    <h1>Race Management</h1>

    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">{{ editingId ? 'Edit race' : 'Add race' }}</h5>
        <form @submit.prevent="saveRace">
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
              <input id="distance" v-model.number="race.distance" type="number" class="form-control" min="1">
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
            <div class="form-group col-md-2">
              <label for="prestige">Prestige</label>
              <input id="prestige" v-model.number="race.prestige" type="number" class="form-control" min="1" max="100">
            </div>
            <div class="form-group col-md-1">
              <label for="seasonWeek">Week</label>
              <input id="seasonWeek" v-model.number="race.seasonWeek" type="number" class="form-control" min="1">
            </div>
          </div>

          <div class="custom-control custom-checkbox mb-3">
            <input
              id="useCustomSegments"
              v-model="useCustomSegments"
              type="checkbox"
              class="custom-control-input"
            >
            <label class="custom-control-label" for="useCustomSegments">
              Custom segment course (optional)
            </label>
          </div>

          <div v-if="useCustomSegments" class="segment-editor mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <strong>Segments</strong>
              <button type="button" class="btn btn-sm btn-outline-secondary" @click="addSegment">
                + Add segment
              </button>
            </div>
            <p class="small text-muted mb-2">
              Segment km must total {{ race.distance || 0 }} km.
              Current total: <strong :class="segmentTotalClass">{{ segmentKmTotal }}</strong> km
            </p>
            <div
              v-for="(segment, idx) in race.segments"
              :key="'seg-' + idx"
              class="form-row align-items-end mb-2"
            >
              <div class="form-group col-md-2">
                <label>Km</label>
                <input v-model.number="segment.km" type="number" class="form-control" min="1">
              </div>
              <div class="form-group col-md-3">
                <label>Profile</label>
                <select v-model="segment.profile" class="form-control">
                  <option value="flat">Flat</option>
                  <option value="hilly">Hilly</option>
                  <option value="mountain">Mountain</option>
                  <option value="classic">Classic</option>
                  <option value="tt">Time Trial</option>
                </select>
              </div>
              <div class="form-group col-md-5">
                <label>Label</label>
                <input v-model="segment.label" type="text" class="form-control" placeholder="Segment name">
              </div>
              <div class="form-group col-md-2">
                <button
                  type="button"
                  class="btn btn-outline-danger btn-block"
                  :disabled="race.segments.length <= 1"
                  @click="removeSegment(idx)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div v-if="formError" class="alert alert-danger py-2">{{ formError }}</div>

          <button type="submit" class="btn btn-primary mr-2">
            {{ editingId ? 'Update race' : 'Add race' }}
          </button>
          <button v-if="editingId" type="button" class="btn btn-light" @click="cancelEdit">
            Cancel
          </button>
        </form>
      </div>
    </div>

    <ul class="list-group">
      <li v-for="r in races" :key="r._id" class="list-group-item">
        <div class="d-flex justify-content-between align-items-start flex-wrap">
          <div>
            <strong>{{ r.name }}</strong>
            — {{ formatDate(r.date) }}
            — {{ r.distance }} km
        — {{ r.profile }}
        — prestige {{ r.prestige }}
        — week {{ r.seasonWeek || 1 }}
            <span v-if="r.segments && r.segments.length" class="badge badge-info ml-1">
              {{ r.segments.length }} custom segments
            </span>
            <ul v-if="r.segments && r.segments.length" class="small text-muted mb-0 mt-1 pl-3">
              <li v-for="(seg, idx) in r.segments" :key="r._id + '-s' + idx">
                {{ seg.km }} km · {{ seg.profile }} · {{ seg.label || 'Segment ' + (idx + 1) }}
              </li>
            </ul>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary" @click="startEdit(r)">
            Edit
          </button>
        </div>
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
  seasonWeek: 1,
  segments: [],
});

const emptySegment = (profile = 'flat') => ({
  km: 30,
  profile,
  label: '',
});

export default {
  name: 'RaceManagement',
  data() {
    return {
      races: [],
      race: emptyRace(),
      editingId: null,
      useCustomSegments: false,
      formError: '',
    };
  },
  computed: {
    segmentKmTotal() {
      if (!this.useCustomSegments || !this.race.segments) return 0;
      return this.race.segments.reduce((sum, segment) => sum + (Number(segment.km) || 0), 0);
    },
    segmentTotalClass() {
      return this.segmentKmTotal === Number(this.race.distance) ? 'text-success' : 'text-danger';
    },
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
    addSegment() {
      if (!this.race.segments) this.race.segments = [];
      this.race.segments.push(emptySegment(this.race.profile));
    },
    removeSegment(index) {
      this.race.segments.splice(index, 1);
    },
    startEdit(race) {
      this.editingId = race._id;
      this.race = {
        name: race.name,
        date: race.date ? String(race.date).slice(0, 10) : '',
        distance: race.distance,
        profile: race.profile,
        prestige: race.prestige,
        seasonWeek: race.seasonWeek || 1,
        segments: (race.segments || []).map((segment) => ({
          km: segment.km,
          profile: segment.profile,
          label: segment.label || '',
        })),
      };
      this.useCustomSegments = this.race.segments.length > 0;
      this.formError = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    cancelEdit() {
      this.editingId = null;
      this.race = emptyRace();
      this.useCustomSegments = false;
      this.formError = '';
    },
    buildPayload() {
      const payload = {
        name: this.race.name,
        date: this.race.date || undefined,
        distance: Number(this.race.distance),
        profile: this.race.profile,
        prestige: Number(this.race.prestige),
        seasonWeek: Number(this.race.seasonWeek) || 1,
        segments: [],
      };

      if (this.useCustomSegments) {
        payload.segments = this.race.segments.map((segment) => ({
          km: Number(segment.km),
          profile: segment.profile,
          label: segment.label || segment.profile,
        }));
      }

      return payload;
    },
    async saveRace() {
      this.formError = '';
      const payload = this.buildPayload();

      if (this.useCustomSegments) {
        if (!payload.segments.length) {
          this.formError = 'Add at least one segment or disable custom segments.';
          return;
        }
        const total = payload.segments.reduce((sum, segment) => sum + segment.km, 0);
        if (total !== payload.distance) {
          this.formError = `Segment km total (${total}) must match race distance (${payload.distance}).`;
          return;
        }
      }

      try {
        if (this.editingId) {
          const { data } = await axios.put(`/api/races/${this.editingId}`, payload);
          const index = this.races.findIndex((race) => race._id === this.editingId);
          if (index >= 0) this.$set(this.races, index, data);
          this.cancelEdit();
        } else {
          const { data } = await axios.post('/api/races', payload);
          this.races.push(data);
          this.race = emptyRace();
          this.useCustomSegments = false;
        }
      } catch (err) {
        this.formError = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Failed to save race';
      }
    },
  },
};
</script>

<style scoped>
.segment-editor {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 1rem;
  background: #f8f9fa;
}
</style>
