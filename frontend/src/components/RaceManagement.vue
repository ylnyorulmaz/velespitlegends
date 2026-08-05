<template>
    <div class="container">
      <h1>Race Management</h1>
      <form @submit.prevent="addRace">
        <div class="form-group">
          <label for="name">Name:</label>
          <input type="text" id="name" v-model="race.name" class="form-control">
        </div>
        <div class="form-group">
          <label for="startDate">Start Date:</label>
          <input type="date" id="startDate" v-model="race.startDate" class="form-control">
        </div>
        <div class="form-group">
          <label for="endDate">End Date:</label>
          <input type="date" id="endDate" v-model="race.endDate" class="form-control">
        </div>
        <div class="form-group">
          <label for="classification">Classification:</label>
          <input type="text" id="classification" v-model="race.classification" class="form-control">
        </div>
        <div class="form-group">
          <label for="format">Format:</label>
          <input type="text" id="format" v-model="race.format" class="form-control">
        </div>
        <div class="form-group">
          <label for="totalDistance">Total Distance (km):</label>
          <input type="number" id="totalDistance" v-model="race.totalDistance" class="form-control">
        </div>
        <button type="submit" class="btn btn-primary">Add Race</button>
      </form>
      <ul class="list-group mt-3">
        <li v-for="race in races" :key="race._id" class="list-group-item">
          {{ race.name }} - {{ race.startDate }} - {{ race.endDate }} - {{ race.classification }} - {{ race.format }} - {{ race.totalDistance }} km
        </li>
      </ul>
    </div>
  </template>
  
  <script>
  import axios from 'axios';
  
  export default {
    name: 'RaceManagement',
    data() {
      return {
        races: [],
        race: {
          name: '',
          startDate: '',
          endDate: '',
          classification: '',
          format: '',
          totalDistance: 0
        }
      };
    },
    created() {
      this.fetchRaces();
    },
    methods: {
      async fetchRaces() {
        const response = await axios.get('/api/races');
        this.races = response.data;
      },
      async addRace() {
        const response = await axios.post('/api/races', this.race);
        this.races.push(response.data);
        this.race = {
          name: '',
          startDate: '',
          endDate: '',
          classification: '',
          format: '',
          totalDistance: 0
        };
      }
    }
  };
  </script>
  