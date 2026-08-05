import Vue from 'vue';
import Router from 'vue-router';
import Home from '@/components/HomeManagement.vue';
import CyclistManagement from '@/components/CyclistManagement.vue';
import TeamManagement from '@/components/TeamManagement.vue';
import RaceManagement from '@/components/RaceManagement.vue';
import StaffManagement from '@/components/StaffManagement.vue';
import Calendar from '@/components/Calendar.vue';
import Results from '@/components/Results.vue';
import Standings from '@/components/Standings.vue';
import TransferMarket from '@/components/TransferMarket.vue';
import StageRaceManagement from '@/components/StageRaceManagement.vue';

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
    { path: '/standings', component: Standings },
    { path: '/transfers', component: TransferMarket },
    { path: '/stage-races', component: StageRaceManagement },
    { path: '/results', component: Results },
    { path: '/results/:id', component: Results },
  ],
});
