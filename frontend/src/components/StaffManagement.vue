<template>
  <div class="page-container">
    <PageHeader
      title="Staff"
      subtitle="Hire coaches and support staff — assign them to teams for race-day bonuses."
      eyebrow="Management"
    />

    <div class="vl-card mb-4">
      <div class="vl-card-header">Add staff member</div>
      <div class="vl-card-body">
        <form @submit.prevent="addStaff">
          <div class="form-row">
            <div class="form-group col-md-4">
              <label for="name">Name</label>
              <input id="name" v-model="staffMember.name" type="text" class="form-control" required>
            </div>
            <div class="form-group col-md-4">
              <label for="role">Role</label>
              <input id="role" v-model="staffMember.role" type="text" class="form-control" placeholder="e.g. Head coach">
            </div>
            <div class="form-group col-md-2">
              <label for="experience">Experience (yrs)</label>
              <input id="experience" v-model.number="staffMember.experience" type="number" class="form-control" min="0">
            </div>
            <div class="form-group col-md-2">
              <label for="skillLevel">Skill</label>
              <input id="skillLevel" v-model.number="staffMember.skillLevel" type="number" class="form-control" min="1" max="100">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group col-md-6">
              <label for="specialization">Specialization</label>
              <input id="specialization" v-model="staffMember.specialization" type="text" class="form-control">
            </div>
            <div class="form-group col-md-6 d-flex align-items-end">
              <button type="submit" class="btn btn-primary">Add staff</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <EmptyState v-if="!staff.length" icon="👥" title="No staff yet" message="Add staff above, then assign them on the Teams page." />

    <div v-else class="vl-card">
      <ul class="list-group list-group-flush">
        <li v-for="member in staff" :key="member._id" class="list-group-item vl-list-item">
          <div>
            <strong>{{ member.name }}</strong>
            <div class="small text-muted">{{ member.role }} · {{ member.specialization }}</div>
          </div>
          <span class="text-muted small">Skill {{ member.skillLevel }} · {{ member.experience }} yrs</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import PageHeader from '@/components/PageHeader.vue';
import EmptyState from '@/components/EmptyState.vue';

export default {
  name: 'StaffManagement',
  components: { PageHeader, EmptyState },
  data() {
    return {
      staff: [],
      staffMember: {
        name: '',
        role: '',
        experience: 0,
        skillLevel: 50,
        specialization: '',
      },
    };
  },
  created() {
    this.fetchStaff();
  },
  methods: {
    async fetchStaff() {
      const response = await axios.get('/api/staff');
      this.staff = response.data;
    },
    async addStaff() {
      const response = await axios.post('/api/staff', this.staffMember);
      this.staff.push(response.data);
      this.staffMember = {
        name: '',
        role: '',
        experience: 0,
        skillLevel: 50,
        specialization: '',
      };
    },
  },
};
</script>
