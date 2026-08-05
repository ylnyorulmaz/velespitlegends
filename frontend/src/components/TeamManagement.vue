<template>
    <div class="container">
      <h1>Team Management</h1>
      <form @submit.prevent="addTeam">
        <div class="form-group">
          <label for="name">Name:</label>
          <input type="text" id="name" v-model="team.name" class="form-control">
        </div>
        <div class="form-group">
          <label for="uciCode">UCI Code:</label>
          <input type="text" id="uciCode" v-model="team.uciCode" class="form-control">
        </div>
        <div class="form-group">
          <label for="classification">Classification:</label>
          <input type="text" id="classification" v-model="team.classification" class="form-control">
        </div>
        <div class="form-group">
          <label for="nationality">Nationality:</label>
          <input type="text" id="nationality" v-model="team.nationality" class="form-control">
        </div>
        <div class="form-group">
          <label for="budget">Budget:</label>
          <input type="number" id="budget" v-model="team.budget" class="form-control">
        </div>
        <button type="submit" class="btn btn-primary">Add Team</button>
      </form>
      <ul class="list-group mt-3">
        <li v-for="team in teams" :key="team._id" class="list-group-item">
          {{ team.name }} - {{ team.uciCode }} - {{ team.classification }} - {{ team.nationality }} - ${{ team.budget }}
        </li>
      </ul>
    </div>
  </template>
  
  <script>
  import axios from 'axios';
  
  export default {
    name: 'TeamManagement',
    data() {
      return {
        teams: [],
        team: {
          name: '',
          uciCode: '',
          classification: '',
          nationality: '',
          budget: 0,
          roster: [],
          staff: []
        }
      };
    },
    created() {
      this.fetchTeams();
    },
    methods: {
      async fetchTeams() {
        const response = await axios.get('http://localhost:3000/api/teams');
        this.teams = response.data;
      },
      async addTeam() {
        const response = await axios.post('http://localhost:3000/api/teams', this.team);
        this.teams.push(response.data);
        this.team = {
          name: '',
          uciCode: '',
          classification: '',
          nationality: '',
          budget: 0,
          roster: [],
          staff: []
        };
      }
    }
  };
  </script>
  