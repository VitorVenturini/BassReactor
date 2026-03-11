<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useSketches } from "@wearesage/vue/stores/sketches";
import { useUI } from "@wearesage/vue/stores/ui";
import { useViewport } from "@wearesage/vue/stores/viewport";
import KaleidosyncStage from "./components/KaleidosyncStage.vue";
import { useDesktopAudio } from "./composables/useDesktopAudio.js";

const PLAY_INTERVAL_MS = 30000;
const VISUAL_STYLES = [
  { id: "default", label: "Original" },
  { id: "bw-jagged", label: "PB Serrilhado" },
  { id: "halftone-cmyk", label: "Halftone CMYK" },
  { id: "pixel-brutal", label: "Pixel Brutal" },
];

const audio = useDesktopAudio();
const sketches = useSketches();
const ui = useUI();
const viewport = useViewport();

const uiHidden = ref(false);
const playMode = ref(false);
const playCountdown = ref(30);
const visualStyle = ref("default");

let playTimer = 0;
let playCountdownTimer = 0;
let nextPlayAt = 0;
let unsubscribeElectronShortcut = null;

const sketchOptions = computed(() =>
  (sketches.iterations || []).map((item, index) => {
    const fallback = `Design ${String(index + 1).padStart(2, "0")}`;
    const rawName = item?.id ? item.id.replace(/[-_]/g, " ").slice(0, 36) : fallback;
    return {
      index,
      label: rawName,
      code: fallback,
    };
  })
);

const currentSketchIndex = computed(() => {
  const shader = sketches.sketch?.shader;
  if (!shader) return -1;
  return (sketches.iterations || []).findIndex((item) => item?.shader === shader);
});

const sketchName = computed(() => {
  const option = sketchOptions.value[currentSketchIndex.value];
  if (!option) return "Sem design";
  if (option.label === option.code) return option.code;
  return `${option.code} - ${option.label}`;
});

function clearPlayTimers() {
  window.clearTimeout(playTimer);
  window.clearInterval(playCountdownTimer);
  playTimer = 0;
  playCountdownTimer = 0;
}

function isElectronRuntime() {
  return Boolean(window.bassReactorElectron?.isElectron);
}

function syncPlayCountdown() {
  if (!playMode.value || !nextPlayAt) {
    playCountdown.value = 30;
    return;
  }
  playCountdown.value = Math.max(1, Math.ceil((nextPlayAt - Date.now()) / 1000));
}

function schedulePlayCycle() {
  clearPlayTimers();
  if (!playMode.value) {
    playCountdown.value = 30;
    nextPlayAt = 0;
    return;
  }

  nextPlayAt = Date.now() + PLAY_INTERVAL_MS;
  syncPlayCountdown();
  playCountdownTimer = window.setInterval(syncPlayCountdown, 250);
  playTimer = window.setTimeout(() => {
    sketches.selectNextSketch("autoplay");
    schedulePlayCycle();
  }, PLAY_INTERVAL_MS);
}

function togglePlayMode() {
  playMode.value = !playMode.value;
  schedulePlayCycle();
}

function toggleUiHidden() {
  uiHidden.value = !uiHidden.value;
  if (uiHidden.value) {
    ui.showShaderScroll = false;
  }
}

function toggleDesigns() {
  ui.showShaderScroll = !ui.showShaderScroll;
  if (ui.showShaderScroll) {
    uiHidden.value = false;
  }
}

function nextSketch() {
  sketches.selectNextSketch("keyboard");
  if (playMode.value) schedulePlayCycle();
}

function previousSketch() {
  sketches.selectPreviousSketch("keyboard");
  if (playMode.value) schedulePlayCycle();
}

function randomSketch(source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!total) return;

  let nextIndex = Math.floor(Math.random() * total);
  const currentIndex = currentSketchIndex.value;

  if (total > 1 && currentIndex >= 0 && nextIndex === currentIndex) {
    nextIndex = (currentIndex + 1 + Math.floor(Math.random() * (total - 1))) % total;
  }

  sketches.selectSketchByIndex(nextIndex, source);
  if (playMode.value) schedulePlayCycle();
}

function isRandomSketchShortcut(event) {
  if (event.code === "NumpadDivide") return true;
  if (event.key === "/" && event.location === 3) return true;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "q") return true;
  return false;
}

function selectSketchByIndex(event) {
  const nextIndex = Number(event.target.value);
  if (!Number.isInteger(nextIndex) || nextIndex < 0) return;
  sketches.selectSketchByIndex(nextIndex, "pointer");
  if (playMode.value) schedulePlayCycle();
}

function selectVisualStyle(event) {
  const nextStyle = String(event.target.value || "default");
  if (!VISUAL_STYLES.some((style) => style.id === nextStyle)) return;
  visualStyle.value = nextStyle;
}

function handleKeydown(event) {
  if (!isElectronRuntime() && isRandomSketchShortcut(event)) {
    event.preventDefault();
    randomSketch("keyboard");
  }
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    nextSketch();
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    previousSketch();
  }
  if (event.key.toLowerCase() === "d") {
    event.preventDefault();
    toggleDesigns();
  }
  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    viewport.toggleFullscreen();
  }
  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    toggleUiHidden();
  }
  if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    togglePlayMode();
  }
  if (event.key === "Escape") {
    ui.showShaderScroll = false;
    uiHidden.value = false;
  }
}

onMounted(() => {
  if (window.bassReactorElectron?.onRandomVisualShortcut) {
    unsubscribeElectronShortcut = window.bassReactorElectron.onRandomVisualShortcut(() => {
      randomSketch("global-shortcut");
    });
  }
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  clearPlayTimers();
  if (typeof unsubscribeElectronShortcut === "function") {
    unsubscribeElectronShortcut();
    unsubscribeElectronShortcut = null;
  }
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="ks-app">
    <KaleidosyncStage
      :blink="audio.blink.value"
      :motion="audio.motionStream.value"
      :color-intensity="audio.colorIntensity.value"
      :visual-style="visualStyle"
    />

    <div class="ks-gradient"></div>

    <aside class="ks-panel ks-panel--compact" :class="{ 'is-hidden': uiHidden || ui.showShaderScroll }">
      <div class="ks-panel__top">
        <div>
          <p class="eyebrow">Kaleidosync Mode</p>
          <h1>Kaleido Reactor</h1>
        </div>
        <button class="ghost" @click="toggleUiHidden">Hide UI</button>
      </div>

      <p class="hint">Modo desktop focado em performance. Sem popup e sem overlays quando voce esconde a UI.</p>

      <div class="ks-actions">
        <button class="primary" @click="audio.connectDesktop" :disabled="audio.busy.value">
          {{ audio.running.value ? "Reconectar audio" : "Conectar desktop" }}
        </button>
        <button @click="toggleDesigns">Designs</button>
        <button :class="{ 'is-active': playMode }" @click="togglePlayMode">
          {{ playMode ? `Play ${playCountdown}s` : "Play" }}
        </button>
        <button @click="previousSketch">Anterior</button>
        <button @click="nextSketch">Proximo</button>
        <button @click="viewport.toggleFullscreen">Fullscreen</button>
        <button @click="audio.stop" :disabled="!audio.running.value">Parar</button>
      </div>

      <section class="ks-section">
        <div class="section-header">
          <h2>Sketch</h2>
          <span class="section-chip">{{ playMode ? `${sketchName} | Play ${playCountdown}s` : sketchName }}</span>
        </div>
        <label class="ks-select">
          <span>Selecionar design</span>
          <select :value="currentSketchIndex" @change="selectSketchByIndex">
            <option v-for="option in sketchOptions" :key="option.index" :value="option.index">
              {{ option.code }}{{ option.label !== option.code ? ` - ${option.label}` : "" }}
            </option>
          </select>
        </label>
        <label class="ks-select">
          <span>Estilo visual</span>
          <select :value="visualStyle" @change="selectVisualStyle">
            <option v-for="style in VISUAL_STYLES" :key="style.id" :value="style.id">
              {{ style.label }}
            </option>
          </select>
        </label>
        <div class="level-list">
          <div class="level-row">
            <span>Grave / movimento</span>
            <div class="level-bar">
              <div
                class="level-bar__fill"
                :style="{ transform: `scaleX(${Math.max(0.04, Math.min(1, audio.motionAmount.value))})` }"
              ></div>
            </div>
            <strong>{{ Math.round(audio.motionAmount.value * 100) }}%</strong>
          </div>
          <div class="level-row">
            <span>Medio / pisca</span>
            <div class="level-bar">
              <div
                class="level-bar__fill level-bar__fill--hot"
                :style="{ transform: `scaleX(${Math.max(0.04, Math.min(1, audio.blink.value))})` }"
              ></div>
            </div>
            <strong>{{ Math.round(audio.blink.value * 100) }}%</strong>
          </div>
          <div class="level-row">
            <span>Agudo / cor</span>
            <div class="level-bar">
              <div
                class="level-bar__fill level-bar__fill--cool"
                :style="{ transform: `scaleX(${Math.max(0.04, Math.min(1, audio.colorIntensity.value))})` }"
              ></div>
            </div>
            <strong>{{ Math.round(audio.colorIntensity.value * 100) }}%</strong>
          </div>
        </div>
      </section>

      <section class="ks-section">
        <div class="section-header">
          <h2>Status</h2>
          <span class="section-chip">{{ audio.running.value ? "Desktop" : "Idle" }}</span>
        </div>
        <p class="ks-status" :class="{ error: audio.error.value }">{{ audio.status.value }}</p>
        <p class="ks-footnote">
          Existem {{ sketchOptions.length }} designs. Use as setas ou o seletor acima e me diga o codigo exato, por exemplo:
          `Design 07`.
        </p>
        <p class="ks-footnote">Modo `play`: troca automaticamente para o proximo design a cada 30 segundos e reinicia o contador quando voce troca manualmente.</p>
        <p class="ks-footnote">Mapa atual: `grave` controla o movimento, `medio` controla o pisca e `agudo` controla a intensidade da cor.</p>
        <p class="ks-footnote">Novos estilos: `PB Serrilhado`, `Halftone CMYK` e `Pixel Brutal` no seletor de estilo visual.</p>
        <p class="ks-footnote">Atalhos: `Ctrl + Q` ou `/` do numpad trocam design aleatorio, setas trocam o sketch, `M` play, `D` abre designs, `F` fullscreen, `H` esconde/mostra toda a UI.</p>
      </section>
    </aside>
  </div>
</template>
