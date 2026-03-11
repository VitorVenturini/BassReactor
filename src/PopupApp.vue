<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useSketches } from "@wearesage/vue/stores/sketches";
import { useUI } from "@wearesage/vue/stores/ui";
import KaleidosyncStage from "./components/KaleidosyncStage.vue";

const POPUP_CHANNEL = "bass-reactor-vue-popup";
const HEARTBEAT_TIMEOUT_MS = 2500;

const sketches = useSketches();
const ui = useUI();

const blink = ref(0);
const motion = ref(0);
const colorIntensity = ref(0);
const running = ref(false);
const status = ref("Aguardando a janela principal enviar o visualizer...");
const sketchName = ref("No sketch");
const connected = ref(false);

let channel = null;
let lastFrameAt = 0;
let staleTimer = 0;

function isElectronRuntime() {
  return Boolean(window.bassReactorElectron?.isElectron);
}

function isRandomShortcut(event) {
  if (event.code === "NumpadDivide") return true;
  if (event.key === "/" && event.location === 3) return true;
  return false;
}

function handleKeydown(event) {
  if (!isRandomShortcut(event)) return;
  event.preventDefault();
  channel?.postMessage({ type: "popup-shortcut-random" });
}

function applyVisualSync(payload = {}) {
  if (!payload.sketch) return;
  ui.showShaderScroll = false;
  sketches.selectSketch(payload.sketch, "internal");
  if (payload.shader) sketches.shader = payload.shader;
  if (payload.uniforms) sketches.uniforms = payload.uniforms;
  sketchName.value = payload.sketch.id ? payload.sketch.id.replace(/[-_]/g, " ") : "No sketch";
}

function applyFrameSync(payload = {}) {
  connected.value = true;
  running.value = Boolean(payload.running);
  blink.value = Number(payload.blink || 0);
  motion.value = Number(payload.motion || 0);
  colorIntensity.value = Number(payload.colorIntensity || 0);
  status.value = payload.status || "Sincronizado com a janela principal.";
  if (payload.sketchName) {
    sketchName.value = payload.sketchName.replace(/[-_]/g, " ");
  }
  lastFrameAt = Date.now();
}

function ensureChannel() {
  if (channel || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel(POPUP_CHANNEL);
  channel.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "visual-sync") {
      applyVisualSync(message.payload);
      return;
    }
    if (message.type === "frame-sync") {
      applyFrameSync(message.payload);
    }
  };
}

function startStaleCheck() {
  staleTimer = window.setInterval(() => {
    if (!lastFrameAt) return;
    if (Date.now() - lastFrameAt < HEARTBEAT_TIMEOUT_MS) return;
    connected.value = false;
    running.value = false;
    status.value = "Conexao com a janela principal perdida. Reabra o popup se necessario.";
  }, 500);
}

onMounted(() => {
  ensureChannel();
  startStaleCheck();
  if (!isElectronRuntime()) {
    window.addEventListener("keydown", handleKeydown);
  }
  document.body.classList.add("popup-only-visualizer");
  channel?.postMessage({ type: "popup-ready" });
});

onBeforeUnmount(() => {
  if (staleTimer) {
    window.clearInterval(staleTimer);
  }
  if (!isElectronRuntime()) {
    window.removeEventListener("keydown", handleKeydown);
  }
  channel?.postMessage({ type: "popup-closing" });
  channel?.close();
});
</script>

<template>
  <div class="popup-app">
    <KaleidosyncStage :blink="blink" :motion="motion" :color-intensity="colorIntensity" />
  </div>
</template>

<style scoped>
.popup-app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #02040a;
}
</style>
