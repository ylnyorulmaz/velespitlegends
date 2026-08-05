<template>
    <div class="container">
      <h1>Staff Management</h1>
      <form @submit.prevent="addStaff">
        <div class="form-group">
          <label for="name">Name:</label>
          <input type="text" id="name" v-model="staffMember.name" class="form-control">
        </div>
        <div class="form-group">
          <label for="role">Role:</label>
          <input type="text" id="role" v-model="staffMember.role" class="form-control">
        </div>
        <div class="form-group">
          <label for="experience">Experience (years):</label>
          <input type="number" id="experience" v-model="staffMember.experience" class="form-control">
        </div>
        <div class="form-group">
          <label for="skillLevel">Skill Level:</label>
          <input type="number" id="skillLevel" v-model="staffMember.skillLevel" class="form-control">
        </div>
        <div class="form-group">
          <label for="specialization">Specialization:</label>
          <input type="text" id="specialization" v-model="staffMember.specialization" class="form-control">
        </div>
        <button type="submit" class="btn btn-primary">Add Staff Member</button>
      </form>
      <ul class="list-group mt-3">
        <li v-for="staffMember in staff" :key="staffMember._id" class="list-group-item">
          {{ staffMember.name }} - {{ staffMember.role }} - {{ staffMember.experience }} years - Skill Level: {{ staffMember.skillLevel }} - {{ staffMember.specialization }}
        </li>
      </ul>
    </div>
  </template>
  
  <script>
  import axios from 'axios';
  
  export default {
    name: 'StaffManagement',
    data() {
      return {
        staff: [],
        staffMember: {
          name: '',
          role: '',
          experience: 0,
          skillLevel: 0,
          specialization: ''
        }
      };
    },
    created() {
      this.fetchStaff();
    },
    methods: {
      async fetchStaff() {
        const response = await axios.get('http://localhost:3000/api/staff');
        this.staff = response.data;
      },
      async addStaff() {
        const response = await axios.post('http://localhost:3000/api/staff', this.staffMember);
        this.staff.push(response.data);
        this.staffMember = {
          name: '',
          role: '',
          experience: 0,
          skillLevel: 0,
          specialization: ''
        };
      }
    }
  };
  </script>
  