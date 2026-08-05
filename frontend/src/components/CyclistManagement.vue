<template>
  <div class="container">
    <h1>Cyclist Management</h1>
    <form @submit.prevent="addCyclist">
      <div class="form-row">
        <div class="form-group col-md-6">
          <label for="name">Name</label>
          <input id="name" v-model="cyclist.name" type="text" class="form-control" required>
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
      </div>

      <button type="submit" class="btn btn-primary">Add Cyclist</button>
    </form>

    <ul class="list-group mt-3">
      <li v-for="c in cyclists" :key="c._id" class="list-group-item">
        <strong>{{ c.name }}</strong>
        ({{ c.age }}) — S{{ c.sprint }} / C{{ c.climb }} / TT{{ c.timeTrial }} / E{{ c.endurance }}
        — form {{ c.form }}, fatigue {{ c.fatigue }}
        — {{ c.specialty }} — ${{ c.salary }}
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

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
  data() {
    return {
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
    async fetchCyclists() {
      const response = await axios.get('/api/cyclists');
      this.cyclists = response.data;
    },
    async addCyclist() {
      const response = await axios.post('/api/cyclists', this.cyclist);
      this.cyclists.push(response.data);
      this.cyclist = emptyCyclist();
    },
  },
};
</script>
