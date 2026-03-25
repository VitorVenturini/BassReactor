<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import ProjectionMapperPanel from "./components/ProjectionMapperPanel.vue";
import { MAPPER_POPUP_CHANNEL } from "./mapperPopupShared.js";

const state = ref(createEmptyState());

let channel = null;

function createEmptyState() {
  return {
    faces: [],
    selectedFaceId: null,
    faceOptions: [],
  };
}

function ensureChannel() {
  if (channel || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel(MAPPER_POPUP_CHANNEL);
  channel.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "mapper-state-sync") {
      state.value = message.payload || createEmptyState();
    }
  };
}

function postCommand(type, payload = {}) {
  channel?.postMessage({
    type: "mapper-command",
    payload: {
      type,
      ...payload,
    },
  });
}

function closeWindow() {
  window.close();
}

onMounted(() => {
  ensureChannel();
  document.body.classList.add("popup-only-visualizer");
  channel?.postMessage({ type: "mapper-popup-ready" });
});

onBeforeUnmount(() => {
  channel?.postMessage({ type: "mapper-popup-closing" });
  channel?.close();
});
</script>

<template>
  <div class="mapper-popup-app">
    <div class="mapper-popup-app__actions">
      <button class="ghost" @click="postCommand('clear-all-faces')" :disabled="!state.faces.length">Limpar faces</button>
      <button class="ghost" @click="postCommand('reset-mapper')">Resetar mapper</button>
      <button class="ghost" @click="closeWindow">Fechar janela</button>
    </div>

    <ProjectionMapperPanel
      :faces="state.faces"
      :selected-face-id="state.selectedFaceId"
      :face-options="state.faceOptions"
      @add-face="postCommand('add-face')"
      @remove-face="postCommand('remove-selected-face')"
      @select-face="postCommand('select-face', { faceId: $event })"
      @set-face-design="postCommand('set-face-design', $event)"
      @set-face-style="postCommand('set-face-style', $event)"
      @set-face-flip="postCommand('set-face-flip', $event)"
      @toggle-face-transform="postCommand('toggle-face-transform', { faceId: $event })"
      @reset-face="postCommand('reset-selected-face')"
      @close="closeWindow"
    />
  </div>
</template>

<style scoped>
.mapper-popup-app {
  min-height: 100vh;
  background: #02040a;
}

.mapper-popup-app__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  padding: 1rem 1rem 0;
  background: linear-gradient(180deg, rgba(255, 143, 60, 0.08), rgba(255, 143, 60, 0));
}

.mapper-popup-app__actions .ghost {
  min-width: 0;
}
</style>
