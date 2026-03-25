import { createApp } from "vue";
import { createPinia } from "pinia";
import MapperPopupApp from "./MapperPopupApp.vue";
import "../styles.css";
import "./styles.css";

const app = createApp(MapperPopupApp);

app.use(createPinia());
app.mount("#app");
