import { createApp } from "vue";
import Tres from "@tresjs/core";
import { createPinia } from "pinia";
import App from "./App.vue";
import "../styles.css";
import "./styles.css";

const app = createApp(App);

app.use(createPinia());
app.use(Tres);
app.mount("#app");
