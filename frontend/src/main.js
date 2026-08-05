import Vue from 'vue';
import App from './App.vue';
import router from './router';
import './assets/styles.css';
import * as ui from './utils/ui';

Vue.config.productionTip = false;
Vue.prototype.$ui = ui;

new Vue({
  router,
  render: (h) => h(App),
}).$mount('#app');
