<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useSketches } from "@wearesage/vue/stores/sketches";
import { useUI } from "@wearesage/vue/stores/ui";
import { useViewport } from "@wearesage/vue/stores/viewport";
import KaleidosyncStage from "./components/KaleidosyncStage.vue";
import ProjectionMapper from "./components/ProjectionMapper.vue";
import { useDesktopAudio } from "./composables/useDesktopAudio.js";
import { MAPPER_POPUP_CHANNEL, MAPPER_POPUP_FEATURES } from "./mapperPopupShared.js";
import {
  DESIGN_51_ID,
  DESIGN_51_LAYOUT_VERSION,
  createDesign51Sketch,
  getDesign51DefaultVariant,
} from "./designs/design51.js";

const PLAY_INTERVAL_MS = 30000;
const DESIGN_SANDBOX_ENABLED = false;
const BASE_DESIGN_TOTAL = 50;
const PANIC_SESSION_STORAGE_KEY = "bass-reactor:panic-session-v1";
const PANIC_AUDIO_RESTORE_DELAY_MS = 220;
// Estilos "filtro" de tela inteira (pos-processo CSS).
// Para criar/editar estilo visual, mexa em `src/components/KaleidosyncStage.vue`:
// - computed `styles` (saturate/brightness/contrast/grayscale)
// - classes CSS `.style-*` (scanline, halftone, pixel, etc.)
const VISUAL_STYLES = [
  { id: "default", label: "Original" },
  { id: "ascii-bw", label: "ASCII PB" },
  { id: "bw-jagged", label: "PB Serrilhado" },
  { id: "halftone-cmyk", label: "Halftone CMYK" },
  { id: "pixel-brutal", label: "Pixel Brutal" },
  { id: "pixel-brutal-xl", label: "Pixel Brutal XL" },
  { id: "crt-amber", label: "CRT Ambar" },
  { id: "duotone-ice", label: "Duotone Ice" },
  { id: "infrared-bloom", label: "Infra Bloom" },
];
const STYLE_CYCLE_IDS = ["default", "pixel-brutal", "bw-jagged", "crt-amber"];
const AUDIO_CAPTURE_TABS = [
  { id: "desktop", label: "Sistema" },
  { id: "application", label: "Aplicativo" },
  { id: "microphone", label: "Microfone" },
];
const QUALITY_MODES = [
  { id: "performance", label: "Alta perf" },
  { id: "balanced", label: "Medio" },
  { id: "beautiful", label: "Bonito" },
];
const DESIGN_FAMILIES = {
  // Familia citada por voce para "efeito kaleido".
  kaleido: [2, 17, 19, 22, 25, 26, 33, 40],
  // Familia citada por voce para "efeito buraco negro".
  blackHole: [49, 5, 14, 15, 24, 35, 39, 43, 45],
  // Formato colorido no fundo com filtro em cima.
  colorBackdropFilter: [3, 5, 6, 8, 12, 13, 32, 44, 45],
  // Parece celula / zoom de microscopio.
  cellMicroscope: [16, 18, 41, 46],
  // Tintas se misturando.
  inkMix: [10, 37],
  // Mesmo "motor" de movimento.
  motionTwin: [3, 8, 9, 11, 45],
  // Bolhas se formando.
  bubbleBuild: [1, 4, 7, 20, 21, 27, 28, 29, 47, 48, 50],
  // Reservadas para mapear depois em outras teclas.
  miamiVibesLines: [38, 42, 25],
  sunBlotch: [39, 43],
};

const audio = useDesktopAudio();
const sketches = useSketches();
const ui = useUI();
const viewport = useViewport();

const uiHidden = ref(false);
const performanceHudOpen = ref(false);
const playMode = ref(false);
const playCountdown = ref(30);
const visualStyle = ref("default");
const qualityMode = ref("balanced");
const lastNonAsciiVisualStyle = ref("default");
const audioModalOpen = ref(false);
const audioCaptureTab = ref("desktop");
const projectionMapperOpen = ref(false);
const projectionMapperInstanceKey = ref(0);
const projectionMapperRef = ref(null);
const projectionMapperPopupReady = ref(false);
const projectionMapperPopupWindow = ref(null);
const projectionMapperState = ref(createProjectionMapperEmptyState());
const design51EditorOpen = ref(false);
const designInspectorOpen = ref(false);
const design51ImportInput = ref(null);
const design51ImportStatus = ref("");
const design51ImportStatusKind = ref("idle");
const design51TemplateSketch = createDesign51Sketch();
const design51BaseVariant = ref(cloneValue(getDesign51DefaultVariant()));
const design51SourceIndex = ref(null);
const design51SourceDraft = ref("");

let playTimer = 0;
let playCountdownTimer = 0;
let nextPlayAt = 0;
let unsubscribeElectronShortcut = null;
let mapperPopupChannel = null;
let lastHandledVisualShortcut = { family: "", at: 0 };
let panicReloadInFlight = false;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createProjectionMapperEmptyState() {
  return {
    faces: [],
    selectedFaceId: null,
    faceOptions: [],
  };
}

function normalizeProjectionMapperState(value) {
  return {
    faces: Array.isArray(value?.faces) ? cloneValue(value.faces) : [],
    selectedFaceId: value?.selectedFaceId ?? null,
    faceOptions: Array.isArray(value?.faceOptions) ? cloneValue(value.faceOptions) : [],
  };
}

function getProjectionMapperStateSnapshot() {
  const liveSnapshot = projectionMapperRef.value?.getStateSnapshot?.();
  return normalizeProjectionMapperState(liveSnapshot || projectionMapperState.value || createProjectionMapperEmptyState());
}

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

function resolveSketchIndex(sketchValue) {
  if (!sketchValue) return -1;
  const iterations = sketches.iterations || [];
  const sketchId = sketchValue.id;

  if (sketchId) {
    const indexById = iterations.findIndex((item) => item?.id === sketchId);
    if (indexById !== -1) return indexById;
  }

  const shader = sketchValue.shader;
  if (!shader) return -1;
  return iterations.findIndex((item) => item?.shader === shader);
}

function buildPanicSessionSnapshot() {
  const variantIndex = Number(sketches.variant);

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    visualStyle: visualStyle.value,
    qualityMode: qualityMode.value,
    lastNonAsciiVisualStyle: lastNonAsciiVisualStyle.value,
    uiHidden: uiHidden.value,
    performanceHudOpen: performanceHudOpen.value,
    playMode: playMode.value,
    audioCaptureTab: audioCaptureTab.value,
    projectionMapperOpen: projectionMapperOpen.value,
    projectionMapperState: getProjectionMapperStateSnapshot(),
    design51EditorOpen: design51EditorOpen.value,
    designInspectorOpen: designInspectorOpen.value,
    shaderScrollOpen: Boolean(ui.showShaderScroll),
    currentSketchIndex: currentSketchIndex.value,
    sketches: {
      iterations: Array.isArray(sketches.iterations) ? cloneValue(sketches.iterations) : [],
      sketch: cloneValue(sketches.sketch || null),
      shader: typeof sketches.shader === "string" ? sketches.shader : "",
      uniforms: cloneValue(sketches.uniforms || {}),
      variant: Number.isInteger(variantIndex) && variantIndex >= 0 ? variantIndex : 0,
    },
    audio: {
      sourceMode: String(audio.sourceMode.value || "desktop"),
      selectedDesktopSourceId: String(audio.selectedDesktopSourceId.value || ""),
      selectedInputDeviceId: String(audio.selectedInputDeviceId.value || ""),
      running: Boolean(audio.running.value),
    },
  };
}

function savePanicSessionSnapshot() {
  try {
    localStorage.setItem(PANIC_SESSION_STORAGE_KEY, JSON.stringify(buildPanicSessionSnapshot()));
    return true;
  } catch (error) {
    console.warn("[BassReactor] Nao foi possivel salvar o snapshot de emergencia.", error);
    return false;
  }
}

function restoreSketchSession(snapshot) {
  const sketchSession = snapshot?.sketches;
  if (!sketchSession || typeof sketchSession !== "object") return;

  if (Array.isArray(sketchSession.iterations) && sketchSession.iterations.length) {
    sketches.iterations = cloneValue(sketchSession.iterations);
  }

  const requestedIndex = Number(snapshot?.currentSketchIndex);
  const hasIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < (sketches.iterations?.length || 0);

  if (hasIndex) {
    sketches.selectSketch(cloneValue(sketches.iterations[requestedIndex]), "panic-restore");
  } else if (sketchSession.sketch) {
    sketches.selectSketch(cloneValue(sketchSession.sketch), "panic-restore");
  }

  if (typeof sketchSession.shader === "string") {
    sketches.shader = sketchSession.shader;
  }

  if (sketchSession.uniforms && typeof sketchSession.uniforms === "object" && !Array.isArray(sketchSession.uniforms)) {
    sketches.uniforms = cloneValue(sketchSession.uniforms);
  }

  const variantIndex = Number(sketchSession.variant);
  if (Number.isInteger(variantIndex) && variantIndex >= 0) {
    sketches.variant = variantIndex;
  }
}

async function restoreAudioSession(snapshot) {
  const audioSession = snapshot?.audio;
  if (!audioSession || typeof audioSession !== "object") return;

  audio.selectedDesktopSourceId.value = String(audioSession.selectedDesktopSourceId || "");
  audio.selectedInputDeviceId.value = String(audioSession.selectedInputDeviceId || "");

  if (!audioSession.running) return;

  if (!isElectronRuntime()) {
    audio.status.value = "Sessao restaurada. Reconecte o audio se necessario.";
    return;
  }

  if (String(audioSession.sourceMode || "desktop") === "input") {
    await audio.connectInputDevice(audio.selectedInputDeviceId.value);
    return;
  }

  await audio.connectDesktop(audio.selectedDesktopSourceId.value);
}

function queueProjectionMapperHydration() {
  nextTick(() => {
    projectionMapperRef.value?.applySnapshot?.(projectionMapperState.value);
    syncMapperPopupState();
  });
}

async function restorePanicSessionSnapshot() {
  let rawSnapshot = "";

  try {
    rawSnapshot = localStorage.getItem(PANIC_SESSION_STORAGE_KEY) || "";
  } catch {
    return;
  }

  if (!rawSnapshot) return;

  let snapshot = null;
  try {
    snapshot = JSON.parse(rawSnapshot);
  } catch (error) {
    console.warn("[BassReactor] Snapshot de emergencia invalido, ignorando.", error);
    localStorage.removeItem(PANIC_SESSION_STORAGE_KEY);
    return;
  }

  if (!snapshot || snapshot.version !== 1) {
    localStorage.removeItem(PANIC_SESSION_STORAGE_KEY);
    return;
  }

  restoreSketchSession(snapshot);

  if (VISUAL_STYLES.some((style) => style.id === snapshot.visualStyle)) {
    setVisualStyle(snapshot.visualStyle);
  }
  if (QUALITY_MODES.some((mode) => mode.id === snapshot.qualityMode)) {
    setQualityMode(snapshot.qualityMode);
  }
  if (VISUAL_STYLES.some((style) => style.id === snapshot.lastNonAsciiVisualStyle)) {
    lastNonAsciiVisualStyle.value = snapshot.lastNonAsciiVisualStyle;
  }

  uiHidden.value = Boolean(snapshot.uiHidden);
  performanceHudOpen.value = Boolean(snapshot.performanceHudOpen);
  audioCaptureTab.value = AUDIO_CAPTURE_TABS.some((tab) => tab.id === snapshot.audioCaptureTab) ? snapshot.audioCaptureTab : "desktop";
  projectionMapperState.value = normalizeProjectionMapperState(snapshot.projectionMapperState);
  design51EditorOpen.value = Boolean(snapshot.design51EditorOpen);
  designInspectorOpen.value = Boolean(snapshot.designInspectorOpen);
  ui.showShaderScroll = Boolean(snapshot.shaderScrollOpen) && !Boolean(snapshot.projectionMapperOpen);

  if (snapshot.playMode) {
    startPlayMode();
  } else {
    stopPlayMode();
  }

  if (snapshot.projectionMapperOpen) {
    setWorkspaceMode("mapper");
  } else {
    projectionMapperOpen.value = false;
    projectionMapperPopupReady.value = false;
  }

  window.setTimeout(() => {
    restoreAudioSession(snapshot).catch((error) => {
      console.warn("[BassReactor] Falha ao restaurar o audio apos o panic reload.", error);
    });
  }, PANIC_AUDIO_RESTORE_DELAY_MS);

  localStorage.removeItem(PANIC_SESSION_STORAGE_KEY);
}

function triggerPanicReload() {
  if (panicReloadInFlight) return;
  panicReloadInFlight = true;
  projectionMapperState.value = getProjectionMapperStateSnapshot();
  savePanicSessionSnapshot();

  if (window.bassReactorElectron?.reloadAllWindows) {
    window.bassReactorElectron.reloadAllWindows();
    return;
  }

  window.location.reload();
}

function disableSandboxDesigns() {
  const iterations = sketches.iterations || [];
  if (!Array.isArray(iterations) || !iterations.length) return;

  if (iterations.length > BASE_DESIGN_TOTAL) {
    iterations.splice(BASE_DESIGN_TOTAL);
  }

  if (sketches.sketch && resolveSketchIndex(sketches.sketch) >= BASE_DESIGN_TOTAL) {
    const fallbackSketch = iterations[0] || null;
    if (fallbackSketch) {
      sketches.selectSketch(cloneValue(fallbackSketch), "internal");
    }
  }

  design51EditorOpen.value = false;
}

const currentSketchIndex = computed(() => {
  return resolveSketchIndex(sketches.sketch);
});
const currentSketch = computed(() => sketches.sketch || null);
const isDesign51Active = computed(() => DESIGN_SANDBOX_ENABLED && sketches.sketch?.id === DESIGN_51_ID);
const design51EditorVisible = computed(() => isDesign51Active.value && design51EditorOpen.value && !projectionMapperOpen.value && !uiHidden.value && !ui.showShaderScroll);
const designInspectorVisible = computed(() => designInspectorOpen.value && !projectionMapperOpen.value && !uiHidden.value && !ui.showShaderScroll);
const currentAudioSourceLabel = computed(() => {
  if (audio.sourceMode.value === "input") {
    return "Microfone";
  }
  if (audio.sourceMode.value === "application") {
    return "Aplicativo";
  }
  return "Sistema";
});
const activeDesktopSourceLabel = computed(() => {
  const source = audio.desktopSources.value.find((entry) => entry.id === audio.selectedDesktopSourceId.value);
  return source?.label || "Selecionar aplicativo";
});
const qualityModeLabel = computed(() => {
  return QUALITY_MODES.find((mode) => mode.id === qualityMode.value)?.label || "Medio";
});
const visualStyleLabel = computed(() => {
  return VISUAL_STYLES.find((style) => style.id === visualStyle.value)?.label || "Original";
});
const baseDesignOptions = computed(() =>
  (sketches.iterations || []).slice(0, 50).map((item, index) => ({
    index,
    value: String(index),
    code: `Design ${String(index + 1).padStart(2, "0")}`,
    label: item?.id ? item.id.replace(/[-_]/g, " ").slice(0, 42) : `Design ${index + 1}`,
  }))
);

watch(
  design51SourceIndex,
  (nextValue) => {
    design51SourceDraft.value = Number.isInteger(nextValue) ? String(nextValue) : "";
  },
  { immediate: true }
);

const sketchName = computed(() => {
  const option = sketchOptions.value[currentSketchIndex.value];
  if (!option) return "Sem design";
  if (option.label === option.code) return option.code;
  return `${option.code} - ${option.label}`;
});
const playStatusLabel = computed(() => (playMode.value ? `Auto ${playCountdown.value}s` : "Manual"));

watch(
  visualStyle,
  (nextStyle) => {
    if (!VISUAL_STYLES.some((style) => style.id === nextStyle)) {
      visualStyle.value = "default";
      return;
    }
    if (nextStyle !== "ascii-bw") {
      lastNonAsciiVisualStyle.value = nextStyle;
    }
  },
  { immediate: true }
);

watch(
  audioCaptureTab,
  (nextTab) => {
    if (nextTab === "microphone") {
      audio.refreshInputDevices();
      return;
    }
    audio.refreshDesktopSources();
  },
  { immediate: true }
);

watch(
  isDesign51Active,
  (active) => {
    design51EditorOpen.value = active;
  },
  { immediate: true }
);

watch(
  () => sketches.iterations?.length,
  () => {
    if (!DESIGN_SANDBOX_ENABLED) {
      disableSandboxDesigns();
    }
  },
  { immediate: true }
);

function getDesign51StoredSketch() {
  return (sketches.iterations || []).find((item) => item?.id === DESIGN_51_ID) || null;
}

function setDesign51Sketch(nextSketch, sourceIndex = null) {
  const iterations = sketches.iterations || [];
  const clonedSketch = cloneValue({
    ...nextSketch,
    id: DESIGN_51_ID,
    variants: Array.isArray(nextSketch?.variants) && nextSketch.variants.length ? cloneValue(nextSketch.variants) : [cloneValue(getDesign51DefaultVariant())],
  });

  if (iterations.length <= 50) {
    iterations.push(clonedSketch);
  } else {
    iterations.splice(50, 1, clonedSketch);
  }

  design51BaseVariant.value = cloneValue(clonedSketch.variants?.[0] || getDesign51DefaultVariant());
  design51SourceIndex.value = Number.isInteger(sourceIndex) ? sourceIndex : null;

  if (isDesign51Active.value) {
    sketches.selectSketch(cloneValue(clonedSketch), "pointer");
    if (playMode.value) schedulePlayCycle();
  }

  return clonedSketch;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isStrictPositiveUniformKey(key) {
  return /zoom|contrast|orb|ball|radius|size|thickness|divider|divide|div|multiplier|split|shape|brightness|outer|inner|center|sides|iterations|iterator|orbs|count/i.test(
    key
  );
}

function isIntegerUniformKey(key) {
  return /sides|iterations|iterator|orbs|count/i.test(key);
}

function buildZeroValueForUniform(key, value) {
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) {
    if (/col|color|rgb|red|green|blue/i.test(key)) {
      return value.map(() => 1);
    }
    return value.map(() => 0);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  if (isIntegerUniformKey(key)) return 1;
  if (/zoom|contrast|brightness/i.test(key)) return 1;
  if (isStrictPositiveUniformKey(key)) return 1;
  return 0;
}

function buildZeroVariantFromSketch(sourceSketch) {
  const sourceVariant = sourceSketch?.variants?.[0] || {};
  return Object.fromEntries(
    Object.entries(sourceVariant).map(([key, entry]) => [key, { value: buildZeroValueForUniform(key, entry?.value) }])
  );
}

function useDesign51Template() {
  setDesign51Sketch(createDesign51Sketch(), null);
  setDesign51ImportStatus("Design 51 voltou para o template original.", "success");
}

function applyBaseDesignTo51(sourceIndex) {
  const nextIndex = Number(sourceIndex);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= 50) {
    useDesign51Template();
    return;
  }

  const sourceSketch = cloneValue((sketches.iterations || [])[nextIndex]);
  if (!sourceSketch) return;

  setDesign51Sketch(sourceSketch, nextIndex);

  const option = baseDesignOptions.value.find((item) => item.index === nextIndex);
  if (option) {
    setDesign51ImportStatus(`${option.code} copiado fielmente para o 51.`, "success");
    return;
  }
  setDesign51ImportStatus(`Design ${String(nextIndex + 1).padStart(2, "0")} copiado fielmente para o 51.`, "success");
}

function getSelectedDesign51SourceIndex() {
  const rawValue = String(design51SourceDraft.value || "");
  if (rawValue === "") return null;
  const nextIndex = Number(rawValue);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= 50) return null;
  return nextIndex;
}

function startDesign51FromSelectedShader(mode = "clone") {
  const nextIndex = getSelectedDesign51SourceIndex();
  if (nextIndex === null) {
    useDesign51Template();
    return;
  }

  if (mode === "clone") {
    applyBaseDesignTo51(nextIndex);
    return;
  }

  const sourceSketch = cloneValue((sketches.iterations || [])[nextIndex]);
  if (!sourceSketch) return;

  setDesign51Sketch(
    {
      ...sourceSketch,
      variants: [buildZeroVariantFromSketch(sourceSketch)],
    },
    nextIndex
  );

  const option = baseDesignOptions.value.find((item) => item.index === nextIndex);
  if (option) {
    setDesign51ImportStatus(`${option.code} carregado no 51 em modo do zero.`, "success");
    return;
  }
  setDesign51ImportStatus(`Design ${String(nextIndex + 1).padStart(2, "0")} carregado no 51 em modo do zero.`, "success");
}

function handleDesign51SourceDraftChange(event) {
  design51SourceDraft.value = String(event.target.value || "");
}

design51BaseVariant.value = cloneValue(getDesign51StoredSketch()?.variants?.[0] || getDesign51DefaultVariant());

function inferInspectorFieldMeta(key, value) {
  const label = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (typeof value === "boolean") {
    return { key, label, type: "boolean", defaultValue: value };
  }

  if (Array.isArray(value)) {
    const maxMagnitude = Math.max(1, ...value.map((entry) => Math.abs(Number(entry) || 0)));
    return {
      key,
      label,
      type: "vector",
      step: maxMagnitude <= 2 ? 0.01 : maxMagnitude <= 20 ? 0.1 : 1,
      min: value.some((entry) => Number(entry) < 0) ? -maxMagnitude * 4 : 0,
      max: maxMagnitude * 4,
      defaultValue: value,
    };
  }

  const numericValue = Number(value || 0);
  const integer = /sides|iterations|iterator|orbs|count|divider|div$/i.test(key);
  const maxMagnitude = Math.max(1, Math.abs(numericValue), integer ? Math.abs(numericValue) + 2 : 0);

  return {
    key,
    label,
    type: "number",
    integer,
    step: integer ? 1 : maxMagnitude <= 2 ? 0.01 : maxMagnitude <= 20 ? 0.1 : 1,
    min: numericValue < 0 ? -maxMagnitude * 4 : 0,
    max: maxMagnitude * 4,
    defaultValue: numericValue,
  };
}

function getActiveVariantIndex() {
  const rawIndex = Number(sketches.variant);
  return Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : 0;
}

const inspectorFields = computed(() => {
  const activeVariantIndex = getActiveVariantIndex();
  const uniforms = sketches.uniforms || currentSketch.value?.variants?.[activeVariantIndex] || currentSketch.value?.variants?.[0] || {};
  return Object.keys(uniforms)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => inferInspectorFieldMeta(key, uniforms[key]?.value));
});

const inspectorShaderDraft = ref(currentSketch.value?.shader || "");

watch(
  () => currentSketch.value?.shader,
  (shader) => {
    inspectorShaderDraft.value = shader || "";
  },
  { immediate: true }
);

function normalizeInspectorValue(field, rawValue) {
  if (field.type === "boolean") {
    return Boolean(rawValue);
  }

  if (field.type === "vector") {
    const source = Array.isArray(rawValue) ? rawValue : [];
    return source.map((entry) => {
      let nextEntry = Number(entry);
      if (!Number.isFinite(nextEntry)) nextEntry = 0;
      if (typeof field.min === "number") nextEntry = Math.max(field.min, nextEntry);
      if (typeof field.max === "number") nextEntry = Math.min(field.max, nextEntry);
      return Number(nextEntry.toFixed(4));
    });
  }

  let nextValue = Number(rawValue);
  if (!Number.isFinite(nextValue)) {
    nextValue = Number(field.defaultValue ?? 0);
  }
  if (typeof field.min === "number") nextValue = Math.max(field.min, nextValue);
  if (typeof field.max === "number") nextValue = Math.min(field.max, nextValue);
  if (field.integer) nextValue = Math.round(nextValue);
  return Number(nextValue.toFixed(4));
}

function updateCurrentSketchUniform(key, nextValue) {
  if (!currentSketch.value) return;
  const activeVariantIndex = getActiveVariantIndex();

  if (!currentSketch.value.variants?.[activeVariantIndex]) {
    currentSketch.value.variants ||= [];
    currentSketch.value.variants[activeVariantIndex] = {};
  }
  currentSketch.value.variants[activeVariantIndex][key] = { value: nextValue };

  if (!sketches.uniforms?.[key]) {
    sketches.uniforms[key] = { value: nextValue };
  } else {
    sketches.uniforms[key].value = nextValue;
  }

  const activeIndex = currentSketchIndex.value;
  if (activeIndex >= 0 && sketches.iterations?.[activeIndex]) {
    if (!sketches.iterations[activeIndex].variants?.[activeVariantIndex]) {
      sketches.iterations[activeIndex].variants ||= [];
      sketches.iterations[activeIndex].variants[activeVariantIndex] = {};
    }
    sketches.iterations[activeIndex].variants[activeVariantIndex][key] = { value: nextValue };
  }
}

function updateInspectorField(field, rawValue) {
  updateCurrentSketchUniform(field.key, normalizeInspectorValue(field, rawValue));
}

function getInspectorFieldValue(key) {
  return sketches.uniforms?.[key]?.value ?? currentSketch.value?.variants?.[0]?.[key]?.value;
}

function formatInspectorFieldValue(field) {
  const value = getInspectorFieldValue(field.key);
  if (field.type === "boolean") return value ? "On" : "Off";
  if (field.type === "vector") return (Array.isArray(value) ? value : []).map((entry) => Number(entry || 0).toFixed(2)).join(", ");
  if (field.integer) return String(Math.round(Number(value || 0)));
  return Number(value || 0).toFixed(2);
}

function getInspectorVectorValues(field) {
  const value = getInspectorFieldValue(field.key);
  return Array.isArray(value) ? value : [];
}

function updateInspectorVectorField(field, componentIndex, rawValue) {
  const nextValues = [...getInspectorVectorValues(field)];
  nextValues[componentIndex] = rawValue;
  updateInspectorField(field, nextValues);
}

function applyInspectorShader() {
  if (!currentSketch.value) return;
  const nextShader = String(inspectorShaderDraft.value || "");
  currentSketch.value.shader = nextShader;
  sketches.shader = nextShader;
  const activeIndex = currentSketchIndex.value;
  if (activeIndex >= 0 && sketches.iterations?.[activeIndex]) {
    sketches.iterations[activeIndex].shader = nextShader;
  }
}

function downloadCurrentSketchJson() {
  if (!currentSketch.value) return;
  const payload = {
    index: currentSketchIndex.value,
    sketch: cloneValue(currentSketch.value),
    uniforms: cloneValue(sketches.uniforms || {}),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bass-reactor-design-${String(currentSketchIndex.value + 1).padStart(2, "0")}-snapshot.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cloneCurrentSketchTo51() {
  if (!DESIGN_SANDBOX_ENABLED) return;
  if (!currentSketch.value || currentSketch.value.id === DESIGN_51_ID) return;
  setDesign51Sketch(currentSketch.value, currentSketchIndex.value >= 0 && currentSketchIndex.value < 50 ? currentSketchIndex.value : null);
  sketches.selectSketchByIndex(50, "pointer");
  designInspectorOpen.value = false;
  design51EditorOpen.value = true;
  setDesign51ImportStatus("Clone fiel aplicado no Design 51. Continue editando no Editor 51.", "success");
}

function setDesign51ImportStatus(message, kind = "idle") {
  design51ImportStatus.value = message;
  design51ImportStatusKind.value = kind;
}

function getDesign51FieldValue(key) {
  if (isDesign51Active.value && sketches.uniforms?.[key]) {
    return sketches.uniforms[key].value;
  }

  const storedValue = getDesign51StoredSketch()?.variants?.[0]?.[key]?.value;
  if (storedValue !== undefined) {
    return storedValue;
  }

  return design51BaseVariant.value[key]?.value ?? design51TemplateSketch.variants[0]?.[key]?.value;
}

function normalizeDesign51Value(field, rawValue) {
  if (field.type === "boolean") {
    return Boolean(rawValue);
  }

  let nextValue = Number(rawValue);
  if (!Number.isFinite(nextValue)) {
    nextValue = Number(field.defaultValue ?? 0);
  }

  if (typeof field.min === "number") {
    nextValue = Math.max(field.min, nextValue);
  }
  if (typeof field.max === "number") {
    nextValue = Math.min(field.max, nextValue);
  }
  if (field.integer) {
    nextValue = Math.round(nextValue);
  }

  return Number(nextValue.toFixed(4));
}

function applyDesign51FieldValue(key, nextValue) {
  const storedSketch = getDesign51StoredSketch();
  if (!storedSketch) return;

  if (!storedSketch.variants?.[0]) {
    storedSketch.variants = [cloneValue(design51BaseVariant.value)];
  }
  storedSketch.variants[0][key] = { value: nextValue };

  if (!isDesign51Active.value) return;

  if (!sketches.sketch?.variants?.[0]) {
    sketches.sketch.variants = [cloneValue(design51BaseVariant.value)];
  }
  sketches.sketch.variants[0][key] = { value: nextValue };

  if (!sketches.uniforms?.[key]) {
    sketches.uniforms[key] = { value: nextValue };
    return;
  }

  sketches.uniforms[key].value = nextValue;
}

function updateDesign51Field(field, rawValue) {
  applyDesign51FieldValue(field.key, normalizeDesign51Value(field, rawValue));
}

function resetDesign51Editor() {
  Object.entries(design51BaseVariant.value || {}).forEach(([key, entry]) => {
    applyDesign51FieldValue(key, entry.value);
  });
  setDesign51ImportStatus("Layout resetado para a base atual.", "success");
}

function formatDesign51FieldValue(field) {
  const value = getDesign51FieldValue(field.key);
  if (field.type === "boolean") {
    return value ? "On" : "Off";
  }
  if (field.integer) {
    return String(Math.round(Number(value || 0)));
  }
  return Number(value || 0).toFixed(2);
}

function toggleDesign51Editor() {
  if (!DESIGN_SANDBOX_ENABLED) return;
  if (!isDesign51Active.value) return;
  if (projectionMapperOpen.value) {
    closeProjectionMapper();
  }
  designInspectorOpen.value = false;
  design51EditorOpen.value = !design51EditorOpen.value;
}

function toggleDesignInspector() {
  if (!currentSketch.value) return;
  if (projectionMapperOpen.value) {
    closeProjectionMapper();
  }
  design51EditorOpen.value = false;
  designInspectorOpen.value = !designInspectorOpen.value;
}

function closeProjectionMapper() {
  setWorkspaceMode("visualizer");
}

function setWorkspaceMode(mode) {
  const shouldOpenMapper = String(mode || "visualizer") === "mapper";
  if (projectionMapperOpen.value === shouldOpenMapper) {
    if (shouldOpenMapper) {
      queueProjectionMapperHydration();
    }
    return;
  }

  if (!shouldOpenMapper) {
    projectionMapperState.value = getProjectionMapperStateSnapshot();
  }

  projectionMapperOpen.value = shouldOpenMapper;
  if (projectionMapperOpen.value) {
    design51EditorOpen.value = false;
    designInspectorOpen.value = false;
    ui.showShaderScroll = false;
    queueProjectionMapperHydration();
    openProjectionMapperPopup();
    return;
  }
  projectionMapperPopupReady.value = false;
  closeProjectionMapperPopup();
}

function setAudioCaptureTab(mode) {
  const nextMode = String(mode || "desktop");
  if (!AUDIO_CAPTURE_TABS.some((tab) => tab.id === nextMode)) return;
  audioCaptureTab.value = nextMode;
}

function openAudioModal() {
  audioModalOpen.value = true;
  if (audioCaptureTab.value === "microphone") {
    audio.refreshInputDevices();
    return;
  }
  audio.refreshDesktopSources();
}

function closeAudioModal() {
  audioModalOpen.value = false;
}

function handleAudioInputDeviceChange(event) {
  audio.selectedInputDeviceId.value = String(event.target.value || "");
}

function handleDesktopSourceChange(event) {
  audio.selectedDesktopSourceId.value = String(event.target.value || "");
}

function connectSelectedAudioInput() {
  audio.connectInputDevice(audio.selectedInputDeviceId.value);
}

function connectDesktopSystemAudio() {
  audio.connectDesktop();
}

function connectSelectedDesktopSource() {
  audio.connectDesktop(audio.selectedDesktopSourceId.value);
}

function ensureMapperPopupChannel() {
  if (mapperPopupChannel || typeof BroadcastChannel === "undefined") return;
  mapperPopupChannel = new BroadcastChannel(MAPPER_POPUP_CHANNEL);
  mapperPopupChannel.onmessage = (event) => {
    const message = event.data || {};
    if (message.type === "mapper-popup-ready") {
      projectionMapperPopupReady.value = true;
      syncMapperPopupState();
      return;
    }
    if (message.type === "mapper-popup-closing") {
      projectionMapperPopupReady.value = false;
      projectionMapperPopupWindow.value = null;
      return;
    }
    if (message.type === "mapper-command") {
      if (message.payload?.type === "panic-reload") {
        triggerPanicReload();
        return;
      }
      projectionMapperRef.value?.applyCommand?.(message.payload || {});
    }
  };
}

function syncMapperPopupState() {
  if (!mapperPopupChannel || !projectionMapperPopupReady.value) return;
  mapperPopupChannel.postMessage({
    type: "mapper-state-sync",
    payload: getProjectionMapperStateSnapshot(),
  });
}

function handleProjectionMapperStateChange(nextState) {
  projectionMapperState.value = normalizeProjectionMapperState(nextState || createProjectionMapperEmptyState());
  syncMapperPopupState();
}

function openProjectionMapperPopup() {
  ensureMapperPopupChannel();

  if (window.bassReactorElectron?.openMapperPopup) {
    window.bassReactorElectron.openMapperPopup();
    return;
  }

  if (projectionMapperPopupWindow.value && !projectionMapperPopupWindow.value.closed) {
    projectionMapperPopupWindow.value.focus();
    return;
  }

  const popup = window.open("./vue-mapper-popup.html", "bass_reactor_mapper_popup", MAPPER_POPUP_FEATURES);
  if (!popup) return;
  projectionMapperPopupWindow.value = popup;
  projectionMapperPopupReady.value = false;
  popup.addEventListener("beforeunload", () => {
    projectionMapperPopupReady.value = false;
    projectionMapperPopupWindow.value = null;
  });
}

function closeProjectionMapperPopup() {
  projectionMapperPopupReady.value = false;
  if (window.bassReactorElectron?.closeMapperPopup) {
    window.bassReactorElectron.closeMapperPopup();
  }
  if (projectionMapperPopupWindow.value && !projectionMapperPopupWindow.value.closed) {
    projectionMapperPopupWindow.value.close();
  }
  projectionMapperPopupWindow.value = null;
}

function collectDesign51Values() {
  return Object.fromEntries(
    Object.keys(getDesign51StoredSketch()?.variants?.[0] || {}).map((key) => [key, getDesign51FieldValue(key)])
  );
}

function buildDesign51LayoutPayload() {
  const storedSketch = getDesign51StoredSketch() || design51TemplateSketch;
  return {
    kind: "bass-reactor-design51-layout",
    version: DESIGN_51_LAYOUT_VERSION,
    designId: DESIGN_51_ID,
    exportedAt: new Date().toISOString(),
    visualStyle: visualStyle.value,
    sourceDesignIndex: design51SourceIndex.value,
    shader: storedSketch.shader,
    values: collectDesign51Values(),
  };
}

function downloadDesign51Layout() {
  const payload = buildDesign51LayoutPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `bass-reactor-design51-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setDesign51ImportStatus("Layout exportado em JSON.", "success");
}

function triggerDesign51Import() {
  design51ImportInput.value?.click?.();
}

function applyImportedDesign51Values(values) {
  let appliedCount = 0;

  Object.entries(values || {}).forEach(([key, rawValue]) => {
    const field = inferInspectorFieldMeta(key, rawValue);
    applyDesign51FieldValue(key, normalizeInspectorValue(field, rawValue));
    appliedCount += 1;
  });

  return appliedCount;
}

async function importDesign51Layout(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const values =
      parsed?.kind === "bass-reactor-design51-layout" && parsed?.values && typeof parsed.values === "object"
        ? parsed.values
        : parsed;

    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new Error("Formato invalido.");
    }

    if (parsed?.visualStyle && VISUAL_STYLES.some((style) => style.id === parsed.visualStyle)) {
      visualStyle.value = parsed.visualStyle;
    }

    if (Number.isInteger(parsed?.sourceDesignIndex) && parsed.sourceDesignIndex >= 0 && parsed.sourceDesignIndex < 50) {
      applyBaseDesignTo51(parsed.sourceDesignIndex);
    } else if (typeof parsed?.shader === "string" && parsed.shader.trim()) {
      setDesign51Sketch(
        {
          id: DESIGN_51_ID,
          shader: parsed.shader,
          variants: [Object.fromEntries(Object.entries(values).map(([key, rawValue]) => [key, { value: rawValue }]))],
        },
        null
      );
    } else {
      useDesign51Template();
    }

    const appliedCount = applyImportedDesign51Values(values);
    if (!appliedCount) {
      throw new Error("Nenhum campo reconhecido.");
    }

    setDesign51ImportStatus(`Layout importado com ${appliedCount} campos aplicados.`, "success");
  } catch (error) {
    setDesign51ImportStatus(`Falha ao importar JSON: ${error?.message || "arquivo invalido"}.`, "error");
  } finally {
    if (event.target) {
      event.target.value = "";
    }
  }
}

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
    nextSketch("autoplay");
  }, PLAY_INTERVAL_MS);
}

function startPlayMode() {
  if (playMode.value) {
    schedulePlayCycle();
    return;
  }
  playMode.value = true;
  schedulePlayCycle();
}

function stopPlayMode() {
  if (!playMode.value) return;
  playMode.value = false;
  schedulePlayCycle();
}

function togglePlayMode() {
  if (playMode.value) {
    stopPlayMode();
    return;
  }
  startPlayMode();
}

function toggleUiHidden() {
  uiHidden.value = !uiHidden.value;
  if (uiHidden.value) {
    ui.showShaderScroll = false;
  }
}

function togglePerformanceHud() {
  performanceHudOpen.value = !performanceHudOpen.value;
}

function setQualityMode(nextMode) {
  const normalizedMode = String(nextMode || "balanced");
  if (!QUALITY_MODES.some((mode) => mode.id === normalizedMode)) return;
  qualityMode.value = normalizedMode;
}

function cycleQualityMode(direction = 1) {
  const currentIndex = QUALITY_MODES.findIndex((mode) => mode.id === qualityMode.value);
  const safeIndex = currentIndex === -1 ? 1 : currentIndex;
  const nextIndex = (safeIndex + direction + QUALITY_MODES.length) % QUALITY_MODES.length;
  setQualityMode(QUALITY_MODES[nextIndex].id);
}

function forcePerformanceMode() {
  setQualityMode("performance");
}

function toggleDesigns() {
  ui.showShaderScroll = !ui.showShaderScroll;
  if (ui.showShaderScroll) {
    uiHidden.value = false;
  }
}

function selectSketchAtIndex(nextIndex, source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= total) return;
  sketches.selectSketchByIndex(nextIndex, source);
  if (playMode.value) schedulePlayCycle();
}

function nextSketch(source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!total) return;
  const currentIndex = currentSketchIndex.value;
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % total;
  selectSketchAtIndex(nextIndex, source);
}

function previousSketch(source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!total) return;
  const currentIndex = currentSketchIndex.value;
  const nextIndex = currentIndex < 0 ? total - 1 : (currentIndex - 1 + total) % total;
  selectSketchAtIndex(nextIndex, source);
}

function randomSketch(source = "keyboard") {
  const total = sketchOptions.value.length;
  if (!total) return;

  let nextIndex = Math.floor(Math.random() * total);
  const currentIndex = currentSketchIndex.value;

  if (total > 1 && currentIndex >= 0 && nextIndex === currentIndex) {
    nextIndex = (currentIndex + 1 + Math.floor(Math.random() * (total - 1))) % total;
  }

  selectSketchAtIndex(nextIndex, source);
}

function getFamilyIndexes(familyName) {
  const designNumbers = DESIGN_FAMILIES[familyName];
  if (!Array.isArray(designNumbers)) return [];
  const total = sketchOptions.value.length;
  return [...new Set(designNumbers.map((n) => Number(n) - 1).filter((index) => index >= 0 && index < total))];
}

function randomSketchFromIndexes(indexes, source = "keyboard") {
  if (!Array.isArray(indexes) || !indexes.length) return;

  const currentIndex = currentSketchIndex.value;
  let pool = indexes;
  if (indexes.length > 1 && currentIndex >= 0 && indexes.includes(currentIndex)) {
    pool = indexes.filter((index) => index !== currentIndex);
  }

  const nextIndex = pool[Math.floor(Math.random() * pool.length)];
  selectSketchAtIndex(nextIndex, source);
}

function randomSketchFromFamily(familyName, source = "keyboard") {
  const indexes = getFamilyIndexes(familyName);
  if (!indexes.length) {
    randomSketch(source);
    return;
  }
  randomSketchFromIndexes(indexes, source);
}

function isRandomSketchShortcut(event) {
  if (event.code === "NumpadDivide") return true;
  if (event.key === "/" && event.location === 3) return true;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "q") return true;
  return false;
}

function isAltLetterShortcut(event, letter) {
  return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === letter;
}

function handleVisualShortcutPayload(payload, source = "global-shortcut") {
  const familyRaw = String(payload?.family || "random");
  const family = familyRaw.toLowerCase();

  if (family === "quality-performance" || family === "performance-mode" || family === "safe-performance") {
    forcePerformanceMode();
    return;
  }
  if (handleVisualStyleShortcutPayload(family)) {
    return;
  }
  if (family === "next" || family === "next-order" || family === "next-sketch") {
    nextSketch();
    return;
  }
  if (family === "kaleido") {
    randomSketchFromFamily("kaleido", source);
    return;
  }
  if (family === "black-hole" || family === "blackhole" || family === "black_hole") {
    randomSketchFromFamily("blackHole", source);
    return;
  }
  if (family === "rosette" || family === "rosette-balls" || family === "balls-rosette") {
    randomSketchFromFamily("bubbleBuild", source);
    return;
  }
  if (
    family === "color-backdrop-filter" ||
    family === "color-backdrop" ||
    family === "orbital" ||
    family === "orbital-trig" ||
    family === "orbitaltrig"
  ) {
    randomSketchFromFamily("colorBackdropFilter", source);
    return;
  }
  if (family === "cell" || family === "microscope" || family === "cell-microscope") {
    randomSketchFromFamily("cellMicroscope", source);
    return;
  }
  if (family === "ink" || family === "ink-mix") {
    randomSketchFromFamily("inkMix", source);
    return;
  }
  if (family === "motion" || family === "motion-twin") {
    randomSketchFromFamily("motionTwin", source);
    return;
  }
  if (family === "bubble" || family === "bubble-build") {
    randomSketchFromFamily("bubbleBuild", source);
    return;
  }

  randomSketch(source);
}

function setVisualStyle(nextStyle) {
  const normalizedStyle = String(nextStyle || "default");
  if (!VISUAL_STYLES.some((style) => style.id === normalizedStyle)) return;
  if (normalizedStyle !== "ascii-bw") {
    lastNonAsciiVisualStyle.value = normalizedStyle;
  }
  visualStyle.value = normalizedStyle;
}

function cycleVisualStyle(direction = 1) {
  const currentIndex = STYLE_CYCLE_IDS.indexOf(visualStyle.value);
  if (currentIndex === -1) {
    const fallbackStyle = direction >= 0 ? STYLE_CYCLE_IDS[0] : STYLE_CYCLE_IDS[STYLE_CYCLE_IDS.length - 1];
    setVisualStyle(fallbackStyle);
    return;
  }

  const nextIndex = (currentIndex + direction + STYLE_CYCLE_IDS.length) % STYLE_CYCLE_IDS.length;
  setVisualStyle(STYLE_CYCLE_IDS[nextIndex]);
}

function toggleAsciiStyle() {
  if (visualStyle.value === "ascii-bw") {
    setVisualStyle(lastNonAsciiVisualStyle.value || STYLE_CYCLE_IDS[0] || "default");
    return;
  }
  visualStyle.value = "ascii-bw";
}

function isAsciiStyleShortcut(event) {
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "e";
}

function isStyleCycleShortcut(event, direction) {
  if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
  if (direction > 0) return event.key === "ArrowDown";
  return event.key === "ArrowUp";
}

function getCanonicalVisualShortcutFamily(family) {
  const normalizedFamily = String(family || "").toLowerCase();
  if (normalizedFamily === "style-prev" || normalizedFamily === "visual-style-prev") return "style-prev";
  if (normalizedFamily === "style-next" || normalizedFamily === "visual-style-next") return "style-next";
  if (normalizedFamily === "style-ascii" || normalizedFamily === "ascii" || normalizedFamily === "ascii-bw") {
    return "style-ascii";
  }
  return "";
}

function markVisualShortcutHandled(family) {
  const canonicalFamily = getCanonicalVisualShortcutFamily(family);
  if (!canonicalFamily) return;
  lastHandledVisualShortcut = { family: canonicalFamily, at: Date.now() };
}

function shouldIgnoreDuplicateVisualShortcut(family) {
  const canonicalFamily = getCanonicalVisualShortcutFamily(family);
  if (!canonicalFamily) return false;
  return (
    lastHandledVisualShortcut.family === canonicalFamily &&
    Date.now() - lastHandledVisualShortcut.at < 220
  );
}

function isQualityCycleShortcut(event, direction) {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
  if (direction > 0) return event.key === "End";
  return event.key === "Home";
}

function handleVisualStyleShortcutPayload(family) {
  const canonicalFamily = getCanonicalVisualShortcutFamily(family);
  if (shouldIgnoreDuplicateVisualShortcut(canonicalFamily)) {
    return true;
  }
  if (canonicalFamily === "style-prev") {
    markVisualShortcutHandled(canonicalFamily);
    cycleVisualStyle(-1);
    return true;
  }
  if (canonicalFamily === "style-next") {
    markVisualShortcutHandled(canonicalFamily);
    cycleVisualStyle(1);
    return true;
  }
  if (canonicalFamily === "style-ascii") {
    markVisualShortcutHandled(canonicalFamily);
    toggleAsciiStyle();
    return true;
  }
  return false;
}

function handleLocalVisualStyleShortcuts(event) {
  if (isAsciiStyleShortcut(event)) {
    event.preventDefault();
    if (shouldIgnoreDuplicateVisualShortcut("style-ascii")) return true;
    markVisualShortcutHandled("style-ascii");
    toggleAsciiStyle();
    return true;
  }
  if (isStyleCycleShortcut(event, -1)) {
    event.preventDefault();
    if (shouldIgnoreDuplicateVisualShortcut("style-prev")) return true;
    markVisualShortcutHandled("style-prev");
    cycleVisualStyle(-1);
    return true;
  }
  if (isStyleCycleShortcut(event, 1)) {
    event.preventDefault();
    if (shouldIgnoreDuplicateVisualShortcut("style-next")) return true;
    markVisualShortcutHandled("style-next");
    cycleVisualStyle(1);
    return true;
  }
  return false;
}

function handleKeydown(event) {
  const target = event.target;
  const editable =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;

  if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === "Enter") {
    event.preventDefault();
    forcePerformanceMode();
    return;
  }

  if (!editable && handleLocalVisualStyleShortcuts(event)) {
    return;
  }

  // Em desktop (Electron) os Alt+letra sao globais via main.mjs.
  // Em web, mantemos fallback local.
  if (!editable && !isElectronRuntime()) {
    if (isAltLetterShortcut(event, "q")) {
      event.preventDefault();
      randomSketch("keyboard");
      return;
    }
    if (isAltLetterShortcut(event, "w")) {
      event.preventDefault();
      randomSketchFromFamily("kaleido", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "e")) {
      event.preventDefault();
      randomSketchFromFamily("blackHole", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "y")) {
      event.preventDefault();
      randomSketchFromFamily("cellMicroscope", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "u")) {
      event.preventDefault();
      randomSketchFromFamily("inkMix", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "i")) {
      event.preventDefault();
      randomSketchFromFamily("motionTwin", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "o")) {
      event.preventDefault();
      randomSketchFromFamily("bubbleBuild", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "t")) {
      event.preventDefault();
      randomSketchFromFamily("colorBackdropFilter", "keyboard-family");
      return;
    }
    if (isAltLetterShortcut(event, "x")) {
      event.preventDefault();
      nextSketch();
      return;
    }
  }

  if (!editable && !isElectronRuntime() && isRandomSketchShortcut(event)) {
    event.preventDefault();
    randomSketch("keyboard");
    return;
  }
  if (!editable && event.key === "Backspace") {
    event.preventDefault();
    toggleDesignInspector();
    return;
  }
  if (!editable && event.key.toLowerCase() === "u") {
    event.preventDefault();
    toggleUiHidden();
    return;
  }
  if (!editable && isQualityCycleShortcut(event, -1)) {
    event.preventDefault();
    cycleQualityMode(-1);
    return;
  }
  if (!editable && isQualityCycleShortcut(event, 1)) {
    event.preventDefault();
    cycleQualityMode(1);
    return;
  }
  if (!event.ctrlKey && !event.altKey && !event.metaKey && (event.key === "ArrowRight" || event.key === "ArrowDown")) {
    event.preventDefault();
    nextSketch();
  }
  if (!event.ctrlKey && !event.altKey && !event.metaKey && (event.key === "ArrowLeft" || event.key === "ArrowUp")) {
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
  if (!editable && event.key.toLowerCase() === "p") {
    event.preventDefault();
    togglePerformanceHud();
  }
  if (!editable && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "r") {
    event.preventDefault();
    triggerPanicReload();
    return;
  }
  if (event.key === "Escape") {
    ui.showShaderScroll = false;
    uiHidden.value = false;
    if (audioModalOpen.value) {
      closeAudioModal();
    }
    if (design51EditorOpen.value) {
      design51EditorOpen.value = false;
    }
    if (designInspectorOpen.value) {
      designInspectorOpen.value = false;
    }
    if (projectionMapperOpen.value) {
      closeProjectionMapper();
    }
  }
}

onMounted(() => {
  ensureMapperPopupChannel();
  if (window.bassReactorElectron?.onVisualShortcut) {
    unsubscribeElectronShortcut = window.bassReactorElectron.onVisualShortcut((payload) => {
      handleVisualShortcutPayload(payload, "global-shortcut");
    });
  } else if (window.bassReactorElectron?.onRandomVisualShortcut) {
    unsubscribeElectronShortcut = window.bassReactorElectron.onRandomVisualShortcut(() => {
      randomSketch("global-shortcut");
    });
  }

  window.addEventListener("keydown", handleKeydown);
  restorePanicSessionSnapshot().catch((error) => {
    console.warn("[BassReactor] Falha ao restaurar o panic snapshot.", error);
  });
});

onBeforeUnmount(() => {
  clearPlayTimers();
  closeProjectionMapperPopup();
  if (mapperPopupChannel) {
    mapperPopupChannel.close();
    mapperPopupChannel = null;
  }
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
      v-if="!projectionMapperOpen"
      :blink="audio.blink.value"
      :motion="audio.motionStream.value"
      :color-intensity="audio.colorIntensity.value"
      :visual-style="visualStyle"
      :quality-mode="qualityMode"
      :show-performance-hud="performanceHudOpen"
    />
    <ProjectionMapper
      v-else
      :key="projectionMapperInstanceKey"
      ref="projectionMapperRef"
      :sketches="sketches.iterations || []"
      :blink="audio.blink.value"
      :motion="audio.motionStream.value"
      @state-change="handleProjectionMapperStateChange"
    />

    <div v-if="!projectionMapperOpen" class="ks-gradient"></div>

    <aside class="ks-panel ks-panel--compact" :class="{ 'is-hidden': uiHidden || ui.showShaderScroll }">
      <div class="ks-panel__top">
        <div>
          <p class="eyebrow">Bass Reactor</p>
          <h1>Kaleido Reactor</h1>
          <p class="hint">U esconde a UI. Home e End alternam a qualidade. Alt + Enter forca alta performance. P abre o painel de performance. R salva e recarrega tudo.</p>
        </div>
      </div>

      <section class="ks-section">
        <div class="section-header">
          <h2>Workspace</h2>
          <span class="section-chip">{{ projectionMapperOpen ? "Mapper" : "View" }}</span>
        </div>
        <nav class="ks-mode-tabs" aria-label="Modo da tela">
          <button class="ks-mode-tabs__tab" :class="{ 'is-active': !projectionMapperOpen }" @click="setWorkspaceMode('visualizer')">
            View
          </button>
          <button class="ks-mode-tabs__tab" :class="{ 'is-active': projectionMapperOpen }" @click="setWorkspaceMode('mapper')">
            Mapper
          </button>
        </nav>
      </section>

      <section class="ks-section">
        <div class="section-header">
          <h2>Audio</h2>
          <span class="section-chip" :class="{ 'section-chip--live': audio.running.value }">{{ currentAudioSourceLabel }}</span>
        </div>
        <button @click="openAudioModal">Entradas de audio</button>
        <p class="ks-footnote">{{ audio.status.value }}</p>
      </section>

      <section class="ks-section">
        <div class="section-header">
          <h2>View</h2>
          <span class="section-chip">{{ qualityModeLabel }}</span>
        </div>

        <div class="ks-icon-row ks-actions--spaced" aria-label="Controles da view">
          <button class="ghost ks-icon-button" title="Anterior" aria-label="Anterior" @click="previousSketch">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button class="ghost ks-icon-button" :class="{ 'is-active': playMode }" title="Play" aria-label="Play" @click="startPlayMode">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 6l10 6-10 6z" />
            </svg>
          </button>
          <button class="ghost ks-icon-button" title="Parar" aria-label="Parar" @click="stopPlayMode" :disabled="!playMode">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 8h8v8H8z" />
            </svg>
          </button>
          <button class="ghost ks-icon-button" title="Proximo" aria-label="Proximo" @click="nextSketch">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <button class="ghost ks-icon-button" title="Fullscreen" aria-label="Fullscreen" @click="viewport.toggleFullscreen">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
            </svg>
          </button>
        </div>

        <nav class="ks-mode-tabs ks-mode-tabs--compact" aria-label="Qualidade da view">
          <button
            v-for="mode in QUALITY_MODES"
            :key="mode.id"
            class="ks-mode-tabs__tab"
            :class="{ 'is-active': qualityMode === mode.id }"
            @click="setQualityMode(mode.id)"
          >
            {{ mode.label }}
          </button>
        </nav>
        <p class="ks-footnote">Home/End alterna entre os 3 modos. Alt + Enter joga direto para Alta perf se a tela pesar.</p>

        <p class="ks-footnote">Ctrl + cima/baixo alterna entre Original, Pixel, PB Serrilhado e CRT. Alt + Shift + E liga o ASCII. Atual: {{ visualStyleLabel }}.</p>

        <div v-if="DESIGN_SANDBOX_ENABLED && isDesign51Active" class="ks-actions ks-actions--spaced">
          <button class="ghost" :class="{ 'is-active': design51EditorOpen }" @click="toggleDesign51Editor">Editor 51</button>
        </div>
      </section>
    </aside>

    <div v-if="audioModalOpen" class="ks-modal-backdrop" @click="closeAudioModal">
      <section class="ks-modal" aria-label="Configuracao de audio" @click.stop>
        <div class="ks-modal__top">
          <div>
            <p class="eyebrow">Audio</p>
            <h2>Entradas de audio</h2>
          </div>
          <button class="ghost" @click="closeAudioModal">Fechar</button>
        </div>

        <nav class="ks-mode-tabs ks-mode-tabs--compact" aria-label="Entradas de audio">
          <button
            v-for="tab in AUDIO_CAPTURE_TABS"
            :key="tab.id"
            class="ks-mode-tabs__tab"
            :class="{ 'is-active': audioCaptureTab === tab.id }"
            @click="setAudioCaptureTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <template v-if="audioCaptureTab === 'desktop'">
          <div class="ks-actions">
            <button @click="connectDesktopSystemAudio" :disabled="audio.busy.value">Conectar sistema</button>
            <button class="ghost" @click="audio.refreshDesktopSources">Atualizar lista</button>
            <button class="ghost" @click="audio.stop" :disabled="!audio.running.value">Parar audio</button>
          </div>
        </template>

        <template v-else-if="audioCaptureTab === 'application'">
          <p v-if="!isElectronRuntime()" class="ks-footnote">A selecao de aplicativo especifico fica disponivel na versao desktop do Electron.</p>
          <template v-else>
            <label class="ks-select">
              <span>Aplicativo ou janela</span>
              <select :value="audio.selectedDesktopSourceId.value" @change="handleDesktopSourceChange">
                <option v-for="source in audio.desktopSources.value" :key="source.id" :value="source.id">
                  {{ source.label }}
                </option>
              </select>
            </label>
            <div class="ks-actions">
              <button @click="connectSelectedDesktopSource" :disabled="audio.busy.value || !audio.selectedDesktopSourceId.value">
                Conectar aplicativo
              </button>
              <button class="ghost" @click="audio.refreshDesktopSources">Atualizar lista</button>
              <button class="ghost" @click="audio.stop" :disabled="!audio.running.value">Parar audio</button>
            </div>
            <p class="ks-footnote">{{ activeDesktopSourceLabel }}</p>
          </template>
        </template>

        <template v-else>
          <label class="ks-select">
            <span>Microfone</span>
            <select :value="audio.selectedInputDeviceId.value" @change="handleAudioInputDeviceChange">
              <option v-for="device in audio.inputDevices.value" :key="device.deviceId" :value="device.deviceId">
                {{ device.label }}
              </option>
            </select>
          </label>
          <div class="ks-actions">
            <button @click="connectSelectedAudioInput" :disabled="audio.busy.value || !audio.selectedInputDeviceId.value">Conectar microfone</button>
            <button class="ghost" @click="audio.refreshInputDevices">Atualizar lista</button>
            <button class="ghost" @click="audio.stop" :disabled="!audio.running.value">Parar audio</button>
          </div>
        </template>

        <p class="ks-status" :class="{ error: audio.error.value }">{{ audio.status.value }}</p>
      </section>
    </div>

    <aside v-if="DESIGN_SANDBOX_ENABLED && isDesign51Active" class="ks-editor" :class="{ 'is-hidden': !design51EditorVisible }">
      <div class="ks-editor__top">
        <div>
          <p class="eyebrow">Design 51</p>
          <h2>Live Builder</h2>
        </div>
        <div class="ks-editor__actions">
          <button class="ghost" @click="downloadDesign51Layout">Salvar JSON</button>
          <button class="ghost" @click="triggerDesign51Import">Importar JSON</button>
          <button class="ghost" @click="resetDesign51Editor">Resetar</button>
          <button class="ghost" @click="toggleDesign51Editor">Fechar</button>
        </div>
      </div>

      <p class="ks-editor__hint">Escolha um shader base e decida como quer começar: copia fiel ou do zero. No modo do zero, o shader e mantido, mas os uniforms voltam para uma base neutra para voce construir manualmente.</p>
      <input ref="design51ImportInput" class="ks-editor__file" type="file" accept=".json,application/json" @change="importDesign51Layout" />
      <p v-if="design51ImportStatus" class="ks-editor__status" :class="`is-${design51ImportStatusKind}`">{{ design51ImportStatus }}</p>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Shader base</h3>
          <span class="section-chip">{{ design51SourceIndex === null ? "Template 51" : `Origem ${String(design51SourceIndex + 1).padStart(2, "0")}` }}</span>
        </div>

        <label class="ks-select ks-select--editor">
          <span>Escolher shader base</span>
          <select :value="design51SourceDraft" @change="handleDesign51SourceDraftChange">
            <option value="">Template original do 51</option>
            <option v-for="option in baseDesignOptions" :key="option.index" :value="option.value">
              {{ option.code }}{{ option.label ? ` - ${option.label}` : "" }}
            </option>
          </select>
        </label>
        <div class="ks-editor__actions ks-editor__actions--inline">
          <button class="ghost" @click="startDesign51FromSelectedShader('clone')">Copiar fiel</button>
          <button class="ghost" @click="startDesign51FromSelectedShader('zero')">Comecar do zero</button>
        </div>
      </section>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Uniforms do shader</h3>
          <span class="section-chip">{{ inspectorFields.length }} campos</span>
        </div>

        <div class="ks-editor__grid">
          <div
            v-for="field in inspectorFields"
            :key="field.key"
            class="ks-editor__field"
            :class="{ 'is-boolean': field.type === 'boolean' }"
          >
            <div class="ks-editor__field-top">
              <span>{{ field.label }}</span>
              <strong>{{ formatInspectorFieldValue(field) }}</strong>
            </div>

            <label v-if="field.type === 'boolean'" class="ks-toggle">
              <input
                type="checkbox"
                :checked="Boolean(getInspectorFieldValue(field.key))"
                @change="updateInspectorField(field, $event.target.checked)"
              />
              <span>{{ getInspectorFieldValue(field.key) ? "Ligado" : "Desligado" }}</span>
            </label>

            <div v-else-if="field.type === 'vector'" class="ks-editor__vector">
              <div v-for="(entry, componentIndex) in getInspectorVectorValues(field)" :key="`${field.key}-${componentIndex}`" class="ks-editor__vector-row">
                <span>Valor {{ componentIndex + 1 }}</span>
                <input
                  type="range"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
                <input
                  class="ks-editor__number"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
              </div>
            </div>

            <template v-else>
              <input
                type="range"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
              <input
                class="ks-editor__number"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
            </template>
          </div>
        </div>
      </section>
    </aside>

    <aside v-if="currentSketch" class="ks-editor ks-editor--inspector" :class="{ 'is-hidden': !designInspectorVisible }">
      <div class="ks-editor__top">
        <div>
          <p class="eyebrow">Inspector</p>
          <h2>{{ sketchName }}</h2>
        </div>
        <div class="ks-editor__actions">
          <button class="ghost" @click="downloadCurrentSketchJson">Baixar JSON</button>
          <button v-if="DESIGN_SANDBOX_ENABLED && !isDesign51Active" class="ghost" @click="cloneCurrentSketchTo51">Clonar no 51</button>
          <button class="ghost" @click="toggleDesignInspector">Fechar</button>
        </div>
      </div>

      <p class="ks-editor__hint">Aqui voce acessa o shader real e todos os uniforms do design selecionado. Esse e o caminho certo para estudar a tela de forma fiel.</p>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Shader</h3>
          <span class="section-chip">{{ currentSketch.shader?.length || 0 }} chars</span>
        </div>
        <textarea class="ks-editor__textarea" v-model="inspectorShaderDraft"></textarea>
        <div class="ks-editor__actions ks-editor__actions--inline">
          <button class="ghost" @click="applyInspectorShader">Aplicar shader</button>
        </div>
      </section>

      <section class="ks-editor__section">
        <div class="section-header">
          <h3>Uniforms</h3>
          <span class="section-chip">{{ inspectorFields.length }} campos</span>
        </div>

        <div class="ks-editor__grid">
          <div v-for="field in inspectorFields" :key="field.key" class="ks-editor__field" :class="{ 'is-boolean': field.type === 'boolean' }">
            <div class="ks-editor__field-top">
              <span>{{ field.label }}</span>
              <strong>{{ formatInspectorFieldValue(field) }}</strong>
            </div>

            <label v-if="field.type === 'boolean'" class="ks-toggle">
              <input
                type="checkbox"
                :checked="Boolean(getInspectorFieldValue(field.key))"
                @change="updateInspectorField(field, $event.target.checked)"
              />
              <span>{{ getInspectorFieldValue(field.key) ? "Ligado" : "Desligado" }}</span>
            </label>

            <div v-else-if="field.type === 'vector'" class="ks-editor__vector">
              <div v-for="(entry, componentIndex) in getInspectorVectorValues(field)" :key="`${field.key}-${componentIndex}`" class="ks-editor__vector-row">
                <span>Valor {{ componentIndex + 1 }}</span>
                <input
                  type="range"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
                <input
                  class="ks-editor__number"
                  type="number"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="Number(entry)"
                  @input="updateInspectorVectorField(field, componentIndex, $event.target.value)"
                />
              </div>
            </div>

            <template v-else>
              <input
                type="range"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
              <input
                class="ks-editor__number"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step"
                :value="Number(getInspectorFieldValue(field.key))"
                @input="updateInspectorField(field, $event.target.value)"
              />
            </template>
          </div>
        </div>
      </section>
    </aside>
  </div>
</template>
