import Vue from "vue";
import App from "./App.vue";
import CarbonComponentsVue from "@carbon/vue/src/index";
import ChartsVue from "@carbon/charts-vue";
import { model } from "@/model.js";
import { showResultFromUpload } from "@/helpers";

window.model = model;
window.cbomModel = model;
window.showResultFromUpload = showResultFromUpload;

Vue.use(CarbonComponentsVue);
Vue.use(ChartsVue);
Vue.config.productionTip = false;
Vue.config.silent = true; // Removes ALL Vue warnings

new Vue({
  render: (h) => h(App),
  created() {
    // TODO: uncomment
    // window.onbeforeunload = function () {
    //   if (model.showResults) {
    //     console.log("User tried refreshing the page")
    //     return "Changes will be lost" // The custom message won't be displayed on modern browsers
    //   }
    // }
  },
}).$mount("#app");
