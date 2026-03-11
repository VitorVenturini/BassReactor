import { createApp } from "vue";
import Tres from "@tresjs/core";
import { createPinia } from "pinia";
import PopupApp from "./PopupApp.vue";
import "../styles.css";
import "./styles.css";

const app = createApp(PopupApp);

app.use(createPinia());
app.use(Tres);
app.mount("#app");
