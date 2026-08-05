<template>
  <div class="container">
    <h1>Cyclist Management</h1>
    <form @submit.prevent="addCyclist">
      <div class="form-group">
        <label for="name">Name:</label>
        <input type="text" id="name" v-model="cyclist.name" class="form-control">
      </div>
      <div class="form-group">
        <label for="salary">Salary:</label>
        <input type="number" id="salary" v-model="cyclist.salary" class="form-control">
      </div>
      <!-- Add form fields for other attributes here -->
      <button type="submit" class="btn btn-primary">Add Cyclist</button>
    </form>
    <ul class="list-group mt-3">
      <li v-for="cyclist in cyclists" :key="cyclist._id" class="list-group-item">
        {{ cyclist.name }} - ${{ cyclist.salary }}
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'CyclistManagement',
  data() {
    return {
      cyclists: [],
      cyclist: {
        name: '',
        salary: 0,
        physicalAttributes: {},
        mentalAttributes: {},
        technicalSkills: {},
        enduranceSkills: {},
        specializedSkills: {},
        raceTypeSpecialization: {},
        environmentalAdaptations: {},
        teamRelatedSkills: {},
        careerAttributes: {},
        formAndCondition: {},
        offBikeAttributes: {}
      }
    };
  },
  created() {
    this.fetchCyclists();
  },
  methods: {
    async fetchCyclists() {
      const response = await axios.get('http://localhost:3000/api/cyclists');
      this.cyclists = response.data;
    },
    async addCyclist() {
      const response = await axios.post('http://localhost:3000/api/cyclists', this.cyclist);
      this.cyclists.push(response.data);
      this.cyclist = {
        name: '',
        salary: 0,
        physicalAttributes: {},
        mentalAttributes: {},
        technicalSkills: {},
        enduranceSkills: {},
        specializedSkills: {},
        raceTypeSpecialization: {},
        environmentalAdaptations: {},
        teamRelatedSkills: {},
        careerAttributes: {},
        formAndCondition: {},
        offBikeAttributes: {}
      };
    }
  }
};
</script>
