import Vue from 'vue';
import Router from 'vue-router';
import Home from '@/components/HomeManagement.vue';
import CyclistManagement from '@/components/CyclistManagement.vue';
import TeamManagement from '@/components/TeamManagement.vue';
import RaceManagement from '@/components/RaceManagement.vue';
import StaffManagement from '@/components/StaffManagement.vue';
import Calendar from '@/components/Calendar.vue';
import Results from '@/components/Results.vue';

Vue.use(Router);

export default new Router({
  mode: 'history',
  routes: [
    { path: '/', component: Home },
    { path: '/cyclists', component: CyclistManagement },
    { path: '/teams', component: TeamManagement },
    { path: '/races', component: RaceManagement },
    { path: '/staff', component: StaffManagement },
    { path: '/calendar', component: Calendar },
    { path: '/results', component: Results },
    { path: '/results/:id', component: Results },
  ],
});
