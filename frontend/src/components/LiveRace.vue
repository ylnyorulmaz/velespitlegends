<template>
  <div class="page-container live-race-page">
    <LoadingState v-if="loading" label="Connecting to race radio…" />

    <div v-else-if="error" class="alert alert-danger">
      {{ error }}
      <div class="mt-2">
        <router-link to="/calendar" class="btn btn-sm btn-outline-secondary">Back to calendar</router-link>
      </div>
    </div>

    <div v-else class="live-race-layout">
      <header class="live-race-header">
        <div>
          <div class="live-eyebrow">Race radio</div>
          <h1 class="live-title">{{ view.raceName || 'Race day' }}</h1>
          <p class="live-sub mb-0">
            {{ view.teamName }}
            · segment {{ Math.min(view.segmentIndex + (view.remaining ? 1 : 0), view.segmentTotal) }}/{{ view.segmentTotal }}
            · orders: <strong>{{ tacticLabel(view.tactic) }}</strong>
          </p>
        </div>
        <router-link to="/calendar" class="btn btn-sm btn-outline-light">Abandon view</router-link>
      </header>

      <div class="live-race-grid">
        <section class="cm-feed-panel" ref="feedPanel">
          <div class="cm-feed" ref="feed">
            <p
              v-for="(line, idx) in displayedLines"
              :key="idx"
              class="cm-line"
              :class="lineClass(line)"
            >
              {{ line }}
            </p>
            <p v-if="typing" class="cm-line cm-cursor">▌</p>
          </div>
        </section>

        <aside class="live-side">
          <div class="live-card">
            <h5>Virtual classification</h5>
            <table class="table table-sm table-dark mb-0">
              <tbody>
                <tr
                  v-for="row in view.standingsPreview || []"
                  :key="row.position + row.name"
                  :class="{ 'row-player': row.isPlayer }"
                >
                  <td class="pos">{{ row.position }}</td>
                  <td>
                    {{ row.name }}
                    <span v-if="row.isPlayer" class="badge badge-warning">you</span>
                  </td>
                  <td class="text-muted small">{{ row.dropped ? 'DNF' : '' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="!(view.standingsPreview && view.standingsPreview.length)" class="text-muted small mb-0 mt-2">
              Classification appears after the first sector.
            </p>
          </div>

          <div v-if="!finished" class="live-card orders-card">
            <h5>Team orders</h5>
            <div v-if="decisionBanner" class="decision-banner mb-2">
              {{ decisionBanner }}
            </div>
            <p v-if="view.nextSegment" class="small text-muted">
              Next: {{ view.nextSegment.label }}
              ({{ view.nextSegment.profile }}, {{ view.nextSegment.km }} km)
            </p>
            <p class="small text-muted">
              Quiet sectors auto-roll. You only stop for climbs, finales, and crises.
            </p>
            <div class="tactic-grid">
              <button
                v-for="(info, id) in tactics"
                :key="id"
                type="button"
                class="btn btn-sm tactic-btn"
                :class="selectedTactic === id ? 'btn-warning' : 'btn-outline-light'"
                :disabled="busy || typing"
                @click="selectedTactic = id"
              >
                {{ info.label }}
              </button>
            </div>
            <p class="small text-muted mt-2 mb-3">{{ tacticBlurb }}</p>
            <button
              type="button"
              class="btn btn-warning btn-block"
              :disabled="busy || typing"
              @click="continueRace"
            >
              {{ busy ? 'Racing…' : continueLabel }}
            </button>
            <button
              type="button"
              class="btn btn-outline-light btn-block mt-2"
              :disabled="busy || typing"
              @click="skipToFinish"
            >
              Skip to finish
            </button>
          </div>

          <div v-else class="live-card">
            <h5>Race complete</h5>
            <p class="small">Full report is ready.</p>
            <button type="button" class="btn btn-warning btn-block" @click="goResults">
              Open results
            </button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import LoadingState from '@/components/LoadingState.vue';

export default {
  name: 'LiveRace',
  components: { LoadingState },
  data() {
    return {
      loading: true,
      busy: false,
      typing: false,
      error: '',
      sessionId: null,
      view: {
        feed: [],
        standingsPreview: [],
        tactics: {},
        segmentIndex: 0,
        segmentTotal: 0,
        remaining: 0,
        tactic: 'balanced',
      },
      displayedLines: [],
      selectedTactic: 'balanced',
      finished: false,
      resultId: null,
      typeTimer: null,
    };
  },
  computed: {
    tactics() {
      return this.view.tactics || {};
    },
    tacticBlurb() {
      const info = this.tactics[this.selectedTactic];
      return info ? info.description : '';
    },
    decisionBanner() {
      const d = this.view.decision;
      if (!d) return '';
      if (d.headline) return d.headline;
      const labels = {
        opening: 'Opening orders',
        climb: 'Climbing sector ahead',
        finale: 'Finale — last orders',
        classic: 'Classic sector ahead',
        time_trial: 'Time trial kilometres',
        long_sector: 'Long sector ahead',
        crisis_crash: 'Crash crisis',
        crisis_illness: 'Illness crisis',
        crisis_dropped: 'Riders dropped',
        crisis_position: 'Position crisis',
      };
      return labels[d.reason] || 'Race orders';
    },
    continueLabel() {
      const reason = this.view.decision && this.view.decision.reason;
      if (reason === 'opening') return 'Confirm orders & race';
      if (reason && String(reason).startsWith('crisis')) return 'Issue orders & continue';
      return 'Set orders & continue';
    },
  },
  async created() {
    this.sessionId = this.$route.params.sessionId;
    if (!this.sessionId) {
      this.error = 'Missing race session.';
      this.loading = false;
      return;
    }
    try {
      const { data } = await axios.get(`/api/races/live/${this.sessionId}`);
      this.applyView(data);
      await this.revealLines(data.feed || []);
    } catch (err) {
      this.error = (err.response && err.response.data && err.response.data.error)
        || err.message
        || 'Could not load race session';
    } finally {
      this.loading = false;
    }
  },
  beforeDestroy() {
    if (this.typeTimer) clearTimeout(this.typeTimer);
  },
  methods: {
    tacticLabel(id) {
      const info = this.tactics[id];
      return (info && info.label) || id || '—';
    },
    lineClass(line) {
      if (!line) return '';
      if (line.startsWith('***') || line.startsWith('—')) return 'cm-emphasis';
      if (/Team radio/i.test(line)) return 'cm-radio';
      if (/wins|Superb|Finish/i.test(line)) return 'cm-highlight';
      return '';
    },
    applyView(data) {
      this.view = { ...this.view, ...data };
      this.selectedTactic = data.tactic || this.selectedTactic;
      if (data.done || data.status === 'completed' || data.resultId) {
        this.finished = true;
        this.resultId = data.resultId || this.resultId;
      }
    },
    scrollFeed() {
      this.$nextTick(() => {
        const el = this.$refs.feedPanel;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
    revealLines(lines) {
      return new Promise((resolve) => {
        const queue = [...lines];
        if (!queue.length) {
          resolve();
          return;
        }
        this.typing = true;
        const tick = () => {
          if (!queue.length) {
            this.typing = false;
            this.scrollFeed();
            resolve();
            return;
          }
          this.displayedLines.push(queue.shift());
          this.scrollFeed();
          this.typeTimer = setTimeout(tick, 45);
        };
        tick();
      });
    },
    async continueRace() {
      if (this.busy || this.typing || this.finished) return;
      this.busy = true;
      this.error = '';
      try {
        const { data } = await axios.post(`/api/races/live/${this.sessionId}/continue`, {
          tactic: this.selectedTactic,
        });
        this.applyView(data);
        const prior = new Set(this.displayedLines);
        const fresh = (data.newLines && data.newLines.length)
          ? data.newLines
          : (data.feed || []).filter((line) => !prior.has(line));
        await this.revealLines(fresh);
        if (data.done && data.resultId) {
          this.finished = true;
          this.resultId = data.resultId;
        }
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Continue failed';
      } finally {
        this.busy = false;
      }
    },
    async skipToFinish() {
      if (this.busy || this.typing || this.finished) return;
      this.busy = true;
      try {
        const { data } = await axios.post(`/api/races/live/${this.sessionId}/finish`, {
          tactic: this.selectedTactic,
        });
        this.resultId = data.resultId;
        this.finished = true;
        if (data.feed) {
          const prior = new Set(this.displayedLines);
          await this.revealLines(data.feed.filter((line) => !prior.has(line)));
        }
      } catch (err) {
        this.error = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Finish failed';
      } finally {
        this.busy = false;
      }
    },
    goResults() {
      if (this.resultId) this.$router.push(`/results/${this.resultId}`);
      else this.$router.push('/results');
    },
  },
};
</script>

<style scoped>
.live-race-page {
  max-width: 1100px;
}

.live-race-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--vl-radius);
  background: linear-gradient(145deg, #0b1f14 0%, #143d28 55%, #0f2744 100%);
  color: #e8f0e9;
}

.live-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  color: #a8c4b0;
  margin-bottom: 0.25rem;
}

.live-title {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 1.75rem;
  margin: 0 0 0.35rem;
  color: #f5f7f2;
}

.live-sub {
  color: #c5d5c8;
  font-size: 0.92rem;
}

.live-race-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(260px, 1fr);
  gap: 1rem;
}

@media (max-width: 900px) {
  .live-race-grid {
    grid-template-columns: 1fr;
  }
}

.cm-feed-panel {
  background: #0c1210;
  border: 1px solid #243028;
  border-radius: var(--vl-radius);
  min-height: 420px;
  max-height: 70vh;
  overflow-y: auto;
  padding: 1.25rem 1.4rem;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.35);
}

.cm-feed {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 0.92rem;
  line-height: 1.55;
  color: #d7e6d9;
}

.cm-line {
  margin: 0 0 0.55rem;
  white-space: pre-wrap;
}

.cm-emphasis {
  color: #f5c518;
  font-weight: 600;
}

.cm-radio {
  color: #7ec8a3;
  font-style: italic;
}

.cm-highlight {
  color: #fff3bf;
}

.cm-cursor {
  color: #f5c518;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.live-card {
  background: #122018;
  border: 1px solid #2a4034;
  border-radius: var(--vl-radius);
  padding: 1rem 1.1rem;
  color: #e4eee6;
  margin-bottom: 1rem;
}

.live-card h5 {
  font-size: 0.95rem;
  margin-bottom: 0.75rem;
  color: #f5c518;
}

.live-card .table-dark {
  background: transparent;
  color: #dce8de;
}

.live-card .table-dark td {
  border-top-color: #2a4034;
  padding: 0.35rem 0.25rem;
}

.live-card .pos {
  width: 2rem;
  color: #8aa892;
}

.row-player {
  background: rgba(245, 197, 24, 0.12);
}

.tactic-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.tactic-btn {
  text-align: left;
  white-space: normal;
  line-height: 1.2;
  min-height: 2.4rem;
}

.decision-banner {
  background: rgba(245, 197, 24, 0.14);
  border: 1px solid rgba(245, 197, 24, 0.35);
  border-radius: 6px;
  padding: 0.55rem 0.7rem;
  color: #ffe9a8;
  font-size: 0.88rem;
  line-height: 1.35;
}
</style>
