<template>
  <div class="container">
    <h1>Team Management</h1>

    <form @submit.prevent="addTeam" class="mb-4">
      <div class="form-row">
        <div class="form-group col-md-4">
          <label for="name">Name</label>
          <input id="name" v-model="team.name" type="text" class="form-control" required>
        </div>
        <div class="form-group col-md-3">
          <label for="nationality">Nationality</label>
          <input id="nationality" v-model="team.nationality" type="text" class="form-control">
        </div>
        <div class="form-group col-md-3">
          <label for="budget">Budget</label>
          <input id="budget" v-model.number="team.budget" type="number" class="form-control" min="0">
        </div>
        <div class="form-group col-md-2 d-flex align-items-end">
          <button type="submit" class="btn btn-primary btn-block">Add Team</button>
        </div>
      </div>
    </form>

    <div v-if="formError" class="alert alert-danger">{{ formError }}</div>
    <div v-if="formSuccess" class="alert alert-success">{{ formSuccess }}</div>

    <ul class="list-group">
      <li v-for="t in teams" :key="t._id" class="list-group-item">
        <div class="d-flex justify-content-between align-items-start flex-wrap mb-2">
          <div>
            <strong>{{ t.name }}</strong>
            — {{ t.nationality || '—' }}
            — budget ${{ t.budget }}
            — wins {{ t.wins }} / {{ t.seasonPoints || 0 }} pts
            — roster {{ (t.roster && t.roster.length) || 0 }}
            — staff {{ (t.staff && t.staff.length) || 0 }}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            @click="startEdit(t)"
          >
            {{ editingId === t._id ? 'Editing…' : 'Edit roster & staff' }}
          </button>
        </div>

        <div v-if="editingId === t._id" class="edit-panel border rounded p-3 mt-2">
          <div class="row">
            <div class="col-md-6">
              <h6>Roster</h6>
              <div class="checkbox-list">
                <label v-for="c in cyclists" :key="c._id + '-r'" class="d-block">
                  <input
                    type="checkbox"
                    :value="c._id"
                    :checked="editRoster.includes(c._id)"
                    @change="toggleRoster(c._id)"
                  >
                  {{ c.name }}
                  <span class="text-muted small">F{{ c.form }} · fat {{ c.fatigue }}</span>
                </label>
              </div>
            </div>
            <div class="col-md-6">
              <h6>Staff</h6>
              <div class="checkbox-list">
                <label v-for="s in staff" :key="s._id + '-s'" class="d-block">
                  <input
                    type="checkbox"
                    :value="s._id"
                    :checked="editStaff.includes(s._id)"
                    @change="toggleStaff(s._id)"
                  >
                  {{ s.name }} — {{ s.role }}
                  <span class="text-muted small">skill {{ s.skillLevel }}</span>
                </label>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-success btn-sm mt-2 mr-2" @click="saveTeam(t._id)">
            Save
          </button>
          <button type="button" class="btn btn-light btn-sm mt-2" @click="cancelEdit">
            Cancel
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

const emptyTeam = () => ({
  name: '',
  nationality: '',
  budget: 1000000,
  roster: [],
  staff: [],
});

export default {
  name: 'TeamManagement',
  data() {
    return {
      teams: [],
      cyclists: [],
      staff: [],
      team: emptyTeam(),
      editingId: null,
      editRoster: [],
      editStaff: [],
      formError: '',
      formSuccess: '',
    };
  },
  created() {
    this.load();
  },
  methods: {
    async load() {
      const [teams, cyclists, staff] = await Promise.all([
        axios.get('/api/teams'),
        axios.get('/api/cyclists'),
        axios.get('/api/staff'),
      ]);
      this.teams = teams.data;
      this.cyclists = cyclists.data;
      this.staff = staff.data;
    },
    async addTeam() {
      this.formError = '';
      this.formSuccess = '';
      try {
        const { data } = await axios.post('/api/teams', this.team);
        this.teams.push(data);
        this.team = emptyTeam();
        this.formSuccess = 'Team created.';
      } catch (err) {
        this.formError = err.message;
      }
    },
    startEdit(team) {
      this.editingId = team._id;
      this.editRoster = (team.roster || []).map((r) => String(r._id || r));
      this.editStaff = (team.staff || []).map((s) => String(s._id || s));
      this.formError = '';
      this.formSuccess = '';
    },
    cancelEdit() {
      this.editingId = null;
      this.editRoster = [];
      this.editStaff = [];
    },
    toggleRoster(id) {
      const key = String(id);
      if (this.editRoster.includes(key)) {
        this.editRoster = this.editRoster.filter((x) => x !== key);
      } else {
        this.editRoster = [...this.editRoster, key];
      }
    },
    toggleStaff(id) {
      const key = String(id);
      if (this.editStaff.includes(key)) {
        this.editStaff = this.editStaff.filter((x) => x !== key);
      } else {
        this.editStaff = [...this.editStaff, key];
      }
    },
    async saveTeam(teamId) {
      this.formError = '';
      this.formSuccess = '';
      try {
        const { data } = await axios.put(`/api/teams/${teamId}`, {
          roster: this.editRoster,
          staff: this.editStaff,
        });
        const index = this.teams.findIndex((team) => team._id === teamId);
        if (index >= 0) this.$set(this.teams, index, data);
        this.formSuccess = 'Team updated.';
        this.cancelEdit();
      } catch (err) {
        this.formError = (err.response && err.response.data && err.response.data.error)
          || err.message
          || 'Failed to update team';
      }
    },
  },
};
</script>

<style scoped>
.checkbox-list {
  max-height: 220px;
  overflow-y: auto;
  font-size: 0.9rem;
}
.edit-panel {
  background: #f8f9fa;
}
</style>
