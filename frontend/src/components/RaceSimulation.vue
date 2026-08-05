<template>
    <div>
      <div id="simulation"></div>
      <button @click="startSimulation" class="btn btn-primary">Start Simulation</button>
    </div>
  </template>
  
  <script>
  import p5 from 'p5';
  
  export default {
    name: 'RaceSimulation',
    data() {
      return {
        simulation: null
      };
    },
    methods: {
      startSimulation() {
        this.simulation = new p5(this.sketch, 'simulation');
      },
      sketch(p) {
        p.setup = function() {
          p.createCanvas(800, 400);
        };
  
        p.draw = function() {
          p.background(200);
          // Simulation logic goes here
        };
      }
    }
  };
  </script>
  
  <style>
  #simulation {
    border: 1px solid #000;
  }
  </style>
  