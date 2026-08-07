<template>
  <div class="page-container">
    <PageHeader
      v-if="!detail"
      title="Race Results"
      subtitle="Full race reports, segment timelines, and standings."
      eyebrow="History"
    />

    <LoadingState v-if="loading" label="Loading results…" />

    <div v-else-if="detail">
      <p class="mb-3">
        <router-link to="/results" class="btn btn-sm btn-outline-secondary">← All results</router-link>
      </p>
      <PageHeader
        :title="detail.race && detail.race.name"
        :subtitle="resultSubtitle"
        eyebrow="Race report"
      />

      <div v-if="detail.stageNumber" class="alert alert-info py-2">
        Stage {{ detail.stageNumber }} of a stage race
      </div>

      <div v-if="detail.injuriesApplied && detail.injuriesApplied.length" class="alert alert-warning mb-3">
        <h5 class="alert-heading">Injuries after race</h5>
        <ul class="mb-0">
          <li v-for="(inj, idx) in detail.injuriesApplied" :key="idx">
            <strong>{{ inj.name }}</strong> — {{ inj.description }} ({{ inj.weeksRemaining }} week(s) out)
          </li>
        </ul>
      </div>

      <div v-if="detail.riderRoles && detail.riderRoles.length" class="mb-3">
        <h5>Team roles</h5>
        <div class="role-tags">
          <span
            v-for="entry in detail.riderRoles"
            :key="entry.cyclist"
            class="badge badge-light mr-2 mb-1"
          >
            {{ entry.name }} — {{ roleLabel(entry.role) }}
          </span>
        </div>
      </div>

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
              <div
                v-if="segment.randomEvents && segment.randomEvents.length"
                class="random-events small mb-2"
              >
                <div
                  v-for="(event, rIdx) in segment.randomEvents"
                  :key="'re-' + rIdx"
                  class="random-event"
                  :class="event.kind === 'positive' ? 'event-positive' : 'event-negative'"
                >
                  {{ event.message }}
                  <span v-if="event.isPlayer" class="badge badge-info ml-1">you</span>
                </div>
              </div>
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

      <div v-if="detail.teamResults && detail.teamResults.length" class="mb-4">
        <h5>Team classification</h5>
        <table class="table table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Best</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in detail.teamResults"
              :key="row.teamId || idx"
              :class="{ 'table-primary': row.isPlayer }"
            >
              <td>{{ idx + 1 }}</td>
              <td>
                {{ row.teamName }}
                <span v-if="row.isPlayer" class="badge badge-info">you</span>
              </td>
              <td>P{{ row.bestPosition }}</td>
              <td>{{ row.points }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="detail.rivalTeamCount" class="small text-muted">
          {{ detail.rivalTeamCount }} rival team(s) started this race.
        </p>
      </div>

      <h5>Standings</h5>
      <table class="table table-sm table-striped">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Rider</th>
            <th>Team</th>
            <th>Time</th>
            <th>Gap</th>
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
            <td class="small">{{ row.teamName || '—' }}</td>
            <td>{{ $ui.formatRaceTime(row.timeSeconds) }}</td>
            <td class="text-muted">{{ row.position === 1 ? '—' : $ui.formatGap(row.gapSeconds) }}</td>
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

    <div v-else-if="!loading">
      <EmptyState
        v-if="!results.length"
        icon="🏁"
        title="No results yet"
        message="Enter a race from the Calendar to see your first report."
      >
        <router-link to="/calendar" class="btn btn-primary">Go to calendar</router-link>
      </EmptyState>
      <div v-else class="vl-card">
      <ul class="list-group list-group-flush">
        <li
          v-for="r in results"
          :key="r._id"
          class="list-group-item vl-list-item"
        >
          <div>
            <strong>{{ r.race && r.race.name }}</strong>
            <div class="small text-muted">
              {{ r.team && r.team.name }}
              · +{{ r.teamPointsEarned || 0 }} pts
              · {{ $ui.formatDateTime(r.createdAt) }}
            </div>
          </div>
          <router-link class="btn btn-sm btn-outline-primary" :to="`/results/${r._id}`">
            View report
          </router-link>
        </li>
      </ul>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import EmptyState from '@/components/EmptyState.vue';

export default {
  name: 'Results',
  components: { PageHeader, LoadingState, EmptyState },
  data() {
    return {
      loading: true,
      results: [],
      detail: null,
      tactics: {},
      roles: {},
    };
  },
  computed: {
    resultSubtitle() {
      if (!this.detail || !this.detail.race) return '';
      const parts = [
        this.detail.team && this.detail.team.name,
        `${this.detail.race.distance} km`,
        `+${this.detail.teamPointsEarned || 0} pts`,
      ].filter(Boolean);
      if (this.detail.tactic && this.detail.tactic !== 'balanced') {
        parts.push(this.tacticLabel(this.detail.tactic));
      }
      return parts.join(' · ');
    },
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
    tacticLabel(key) {
      if (this.tactics[key]) return this.tactics[key].label;
      return key;
    },
    roleLabel(key) {
      if (this.roles[key]) return this.roles[key].label;
      return key;
    },
    async load() {
      this.loading = true;
      try {
      if (!Object.keys(this.tactics).length) {
        const [tactics, roles] = await Promise.all([
          axios.get('/api/tactics'),
          axios.get('/api/roles'),
        ]);
        this.tactics = tactics.data;
        this.roles = roles.data;
      }
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
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.narrative,
.segment-timeline {
  max-width: 48rem;
}
.narrative p {
  margin-bottom: 0.4rem;
}
</style>
