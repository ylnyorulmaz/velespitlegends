<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg navbar-light bg-light">
      <a class="navbar-brand" href="#">Velespit Legends</a>
      <div class="collapse navbar-collapse">
        <ul class="navbar-nav mr-auto">
          <li class="nav-item">
            <router-link to="/" class="nav-link">Home</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/cyclists" class="nav-link">Cyclists</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/teams" class="nav-link">Teams</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/races" class="nav-link">Races</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/transfers" class="nav-link">Transfers</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/stage-races" class="nav-link">Stage Races</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/standings" class="nav-link">Standings</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/calendar" class="nav-link">Calendar</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/results" class="nav-link">Results</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/staff" class="nav-link">Staff</router-link>
          </li>
        </ul>
      </div>
    </nav>
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App',
};
</script>
