<template>
  <div class="page-container">
    <PageHeader
      title="Cyclists"
      subtitle="Create riders and track form, fatigue, contracts, and injuries."
      eyebrow="Roster"
    />

    <div class="vl-card mb-4">
      <div class="vl-card-header">Add cyclist</div>
      <div class="vl-card-body">
        <form @submit.prevent="addCyclist">
          <div class="form-row">
            <div class="form-group col-md-6">
              <label for="name">Name</label>
              <input id="name" v-model="cyclist.name" type="text" class="form-control" required placeholder="Rider name">
            </div>
            <div class="form-group col-md-3">
              <label for="age">Age</label>
              <input id="age" v-model.number="cyclist.age" type="number" class="form-control" min="18" max="40">
            </div>
            <div class="form-group col-md-3">
              <label for="salary">Salary</label>
              <input id="salary" v-model.number="cyclist.salary" type="number" class="form-control" min="0">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-md-3" v-for="stat in skillFields" :key="stat.key">
              <label :for="stat.key">{{ stat.label }}</label>
              <input
                :id="stat.key"
                v-model.number="cyclist[stat.key]"
                type="number"
                class="form-control"
                min="1"
                max="100"
              >
            </div>
          </div>

          <div class="form-row">
            <div class="form-group col-md-4">
              <label for="specialty">Specialty</label>
              <select id="specialty" v-model="cyclist.specialty" class="form-control">
                <option value="none">None</option>
                <option value="cobbles">Cobbles</option>
                <option value="breakaway">Breakaway</option>
                <option value="leadout">Leadout</option>
              </select>
            </div>
            <div class="form-group col-md-4 d-flex align-items-end">
              <button type="submit" class="btn btn-primary" :disabled="saving">
                {{ saving ? 'Adding…' : 'Add cyclist' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <LoadingState v-if="loading" compact label="Loading riders…" />

    <EmptyState
      v-else-if="!cyclists.length"
      icon="🚴"
      title="No cyclists yet"
      message="Add your first rider above, or sign free agents from Transfers."
    >
      <router-link to="/transfers" class="btn btn-sm btn-outline-primary">Transfer market</router-link>
    </EmptyState>

    <div v-else class="cyclist-list">
      <div v-for="c in cyclists" :key="c._id" class="cyclist-card">
        <div class="cyclist-card-header">
          <div>
            <div class="cyclist-name">{{ c.name }}</div>
            <div class="text-muted small">Age {{ c.age }} · {{ c.specialty }}</div>
          </div>
          <div class="cyclist-badges">
            <span v-if="c.team && c.team.name" class="badge badge-primary">{{ c.team.name }}</span>
            <span v-else class="badge badge-secondary">Free agent</span>
            <span v-if="$ui.isInjured(c)" class="badge badge-danger">{{ $ui.injuryLabel(c) }}</span>
          </div>
        </div>
        <div class="row">
          <div class="col-md-6">
            <div class="stat-bar-row" v-for="stat in ['sprint', 'climb', 'timeTrial', 'endurance']" :key="stat">
              <span class="stat-bar-label">{{ statLabel(stat) }}</span>
              <div class="stat-bar-track">
                <div class="stat-bar-fill" :style="{ width: $ui.statBarWidth(c[stat]) }" />
              </div>
              <span class="small text-muted">{{ c[stat] }}</span>
            </div>
          </div>
          <div class="col-md-6 small text-muted">
            <div>Form <strong class="text-dark">{{ c.form }}</strong> · Fatigue <strong class="text-dark">{{ c.fatigue }}</strong></div>
            <div>Potential {{ c.potential }} · Teamwork {{ c.teamwork }}</div>
            <div v-if="c.marketValue">Value {{ $ui.formatMoney(c.marketValue) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import EmptyState from '@/components/EmptyState.vue';

const emptyCyclist = () => ({
  name: '',
  salary: 50000,
  age: 24,
  potential: 60,
  sprint: 50,
  climb: 50,
  timeTrial: 50,
  endurance: 50,
  form: 70,
  fatigue: 20,
  specialty: 'none',
  teamwork: 50,
});

export default {
  name: 'CyclistManagement',
  components: { PageHeader, LoadingState, EmptyState },
  data() {
    return {
      loading: true,
      saving: false,
      cyclists: [],
      cyclist: emptyCyclist(),
      skillFields: [
        { key: 'sprint', label: 'Sprint' },
        { key: 'climb', label: 'Climb' },
        { key: 'timeTrial', label: 'Time Trial' },
        { key: 'endurance', label: 'Endurance' },
        { key: 'form', label: 'Form' },
        { key: 'fatigue', label: 'Fatigue' },
        { key: 'potential', label: 'Potential' },
        { key: 'teamwork', label: 'Teamwork' },
      ],
    };
  },
  created() {
    this.fetchCyclists();
  },
  methods: {
    statLabel(key) {
      const map = { sprint: 'S', climb: 'C', timeTrial: 'T', endurance: 'E' };
      return map[key] || key[0].toUpperCase();
    },
    async fetchCyclists() {
      this.loading = true;
      try {
        const response = await axios.get('/api/cyclists');
        this.cyclists = response.data;
      } finally {
        this.loading = false;
      }
    },
    async addCyclist() {
      this.saving = true;
      try {
        await axios.post('/api/cyclists', this.cyclist);
        this.cyclist = emptyCyclist();
        await this.fetchCyclists();
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>
