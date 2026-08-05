<template>
  <div class="container">
    <h1>Race Results</h1>

    <div v-if="detail">
      <p>
        <router-link to="/results">← All results</router-link>
      </p>
      <h3>
        {{ detail.race && detail.race.name }}
        <small class="text-muted" v-if="detail.team">— {{ detail.team.name }}</small>
      </h3>
      <p class="text-muted" v-if="detail.race">
        {{ detail.race.profile }} · {{ detail.race.distance }} km
        · team pts +{{ detail.teamPointsEarned || 0 }}
      </p>

      <div v-if="detail.narrative && detail.narrative.length" class="narrative mb-3">
        <h5>Race report</h5>
        <p v-for="(line, idx) in detail.narrative" :key="idx">{{ line }}</p>
      </div>
      <p v-else class="summary">{{ detail.summary }}</p>

      <h5>Standings</h5>
      <table class="table table-sm table-striped">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Rider</th>
            <th>Score</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in detail.standings"
            :key="row.position + '-' + row.name"
            :class="{ 'table-primary': row.isPlayer }"
          >
            <td>{{ row.position }}</td>
            <td>
              {{ row.name }}
              <span v-if="row.isPlayer" class="badge badge-info">you</span>
            </td>
            <td>{{ row.score }}</td>
            <td>{{ row.points }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="detail.formChanges && detail.formChanges.length" class="mt-4">
        <h5>Condition after race</h5>
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Rider</th>
              <th>Form</th>
              <th>Fatigue</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in detail.formChanges" :key="c.cyclist">
              <td>{{ c.name }}</td>
              <td>
                {{ c.formBefore }} → {{ c.formAfter }}
                <span :class="deltaClass(c.formDelta)">({{ formatDelta(c.formDelta) }})</span>
              </td>
              <td>
                {{ c.fatigueBefore }} → {{ c.fatigueAfter }}
                <span :class="deltaClass(-c.fatigueDelta)">({{ formatDelta(c.fatigueDelta) }})</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else>
      <div v-if="!results.length" class="alert alert-secondary">
        No results yet. Enter a race from the Calendar.
      </div>
      <ul class="list-group">
        <li
          v-for="r in results"
          :key="r._id"
          class="list-group-item d-flex justify-content-between align-items-center"
        >
          <div>
            <strong>{{ r.race && r.race.name }}</strong>
            — {{ r.team && r.team.name }}
            <span v-if="r.teamPointsEarned != null" class="text-muted">
              (+{{ r.teamPointsEarned }} pts)
            </span>
            <div class="small text-muted">{{ formatDate(r.createdAt) }}</div>
          </div>
          <router-link class="btn btn-sm btn-outline-primary" :to="`/results/${r._id}`">
            View
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'Results',
  data() {
    return {
      results: [],
      detail: null,
    };
  },
  watch: {
    '$route.params.id': {
      immediate: true,
      handler() {
        this.load();
      },
    },
  },
  methods: {
    formatDate(value) {
      if (!value) return '';
      return String(value).replace('T', ' ').slice(0, 16);
    },
    formatDelta(value) {
      const n = Number(value) || 0;
      return n > 0 ? `+${n}` : `${n}`;
    },
    deltaClass(value) {
      if (value > 0) return 'text-success';
      if (value < 0) return 'text-danger';
      return 'text-muted';
    },
    async load() {
      const id = this.$route.params.id;
      if (id) {
        const { data } = await axios.get(`/api/results/${id}`);
        this.detail = data;
        this.results = [];
      } else {
        const { data } = await axios.get('/api/results');
        this.results = data;
        this.detail = null;
      }
    },
  },
};
</script>

<style scoped>
.summary,
.narrative {
  max-width: 48rem;
  line-height: 1.5;
}
.narrative p {
  margin-bottom: 0.4rem;
}
</style>
