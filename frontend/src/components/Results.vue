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

      <div
        v-if="detail.segmentLog && detail.segmentLog.length"
        class="segment-timeline mb-4"
      >
        <h5>Race timeline</h5>
        <div class="segment-track mb-2">
          <div
            v-for="(segment, idx) in detail.segmentLog"
            :key="'track-' + idx"
            class="segment-track-bar"
            :class="'profile-' + segment.profile"
            :style="segmentTrackStyle(segment)"
            :title="`${segment.label} (km ${segment.kmStart}–${segment.kmEnd})`"
          />
        </div>
        <div class="segment-cards">
          <div
            v-for="(segment, idx) in detail.segmentLog"
            :key="'seg-' + idx"
            class="segment-card card mb-2"
            :class="{ 'border-primary': segment.leaderIsPlayer }"
          >
            <div class="card-body py-2 px-3">
              <div class="d-flex justify-content-between align-items-start flex-wrap">
                <div>
                  <span class="badge badge-secondary mr-2">
                    km {{ segment.kmStart }}–{{ segment.kmEnd }}
                  </span>
                  <span class="badge" :class="profileBadgeClass(segment.profile)">
                    {{ segment.profile }}
                  </span>
                  <strong class="ml-2">{{ segment.label }}</strong>
                </div>
                <div class="text-right">
                  <span class="text-muted small">Leader</span>
                  <div>
                    {{ segment.leader }}
                    <span v-if="segment.leaderIsPlayer" class="badge badge-info">you</span>
                  </div>
                </div>
              </div>
              <ul v-if="segment.events && segment.events.length > 1" class="segment-events small mb-2 mt-2">
                <li v-for="(event, eIdx) in segment.events.slice(1)" :key="eIdx">{{ event }}</li>
              </ul>
              <div v-if="segment.topThree && segment.topThree.length" class="segment-top small text-muted">
                Top 3:
                <span
                  v-for="(row, tIdx) in segment.topThree"
                  :key="tIdx"
                  :class="{ 'font-weight-bold text-dark': row.isPlayer }"
                >
                  {{ row.name }} ({{ row.score }})<span v-if="tIdx < segment.topThree.length - 1"> · </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="detail.narrative && detail.narrative.length" class="narrative mb-3">
        <h5>Race report</h5>
        <p v-for="(line, idx) in detail.narrative" :key="idx">{{ line }}</p>
      </div>
      <p v-else-if="detail.summary" class="summary">{{ detail.summary }}</p>

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
    raceDistance() {
      if (this.detail && this.detail.race && this.detail.race.distance) {
        return Number(this.detail.race.distance) || 0;
      }
      if (this.detail && this.detail.segmentLog && this.detail.segmentLog.length) {
        const last = this.detail.segmentLog[this.detail.segmentLog.length - 1];
        return Number(last.kmEnd) || 0;
      }
      return 0;
    },
    segmentTrackStyle(segment) {
      const total = this.raceDistance();
      const span = Math.max(0, Number(segment.kmEnd) - Number(segment.kmStart));
      const width = total > 0 ? `${(span / total) * 100}%` : '100%';
      return { flex: `0 0 ${width}`, maxWidth: width };
    },
    profileBadgeClass(profile) {
      const map = {
        flat: 'badge-light',
        hilly: 'badge-warning',
        mountain: 'badge-danger',
        classic: 'badge-dark',
        tt: 'badge-info',
      };
      return map[profile] || 'badge-secondary';
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
.narrative,
.segment-timeline {
  max-width: 48rem;
  line-height: 1.5;
}
.narrative p {
  margin-bottom: 0.4rem;
}
.segment-track {
  display: flex;
  height: 0.65rem;
  border-radius: 0.35rem;
  overflow: hidden;
  background: #e9ecef;
}
.segment-track-bar {
  min-width: 2px;
}
.segment-track-bar.profile-flat { background: #adb5bd; }
.segment-track-bar.profile-hilly { background: #ffc107; }
.segment-track-bar.profile-mountain { background: #dc3545; }
.segment-track-bar.profile-classic { background: #343a40; }
.segment-track-bar.profile-tt { background: #17a2b8; }
.segment-events {
  padding-left: 1.1rem;
  margin-bottom: 0;
}
.segment-events li {
  margin-bottom: 0.15rem;
}
</style>
