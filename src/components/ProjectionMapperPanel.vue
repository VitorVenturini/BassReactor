<script setup>
import { computed } from "vue";

const props = defineProps({
  faces: {
    type: Array,
    default: () => [],
  },
  selectedFaceId: {
    type: Number,
    default: null,
  },
  faceOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["add-face", "remove-face", "select-face", "set-face-design", "set-face-style", "set-face-flip", "toggle-face-transform", "reset-face", "close"]);
const FACE_VISUAL_STYLE_OPTIONS = [
  { value: "default", label: "Original" },
  { value: "ascii-bw", label: "ASCII PB" },
  { value: "bw-jagged", label: "PB Serrilhado" },
  { value: "halftone-cmyk", label: "Halftone CMYK" },
  { value: "pixel-brutal", label: "Pixel Brutal" },
  { value: "pixel-brutal-xl", label: "Pixel Brutal XL" },
  { value: "crt-amber", label: "CRT Ambar" },
  { value: "duotone-ice", label: "Duotone Ice" },
  { value: "infrared-bloom", label: "Infra Bloom" },
];

const selectedFace = computed(() => props.faces.find((face) => face.id === props.selectedFaceId) || null);

function handleDesignChange(event) {
  if (!selectedFace.value) return;
  emit("set-face-design", {
    faceId: selectedFace.value.id,
    designIndex: Number(event.target.value),
  });
}

function handleVisualStyleChange(event) {
  if (!selectedFace.value) return;
  emit("set-face-style", {
    faceId: selectedFace.value.id,
    visualStyle: String(event.target.value || "default"),
  });
}

function handleFlipChange(axis, event) {
  if (!selectedFace.value) return;
  emit("set-face-flip", {
    faceId: selectedFace.value.id,
    axis,
    value: Boolean(event.target.checked),
  });
}
</script>

<template>
  <aside class="mapper-panel">
    <div class="mapper-panel__top">
      <div>
        <p class="eyebrow">Projection Mapper</p>
        <h2>Faces e perspectiva</h2>
      </div>
      <div class="mapper-panel__actions">
        <button class="ghost" @click="$emit('add-face')">Adicionar face</button>
        <button class="ghost" @click="$emit('remove-face')" :disabled="!selectedFace">Remover</button>
        <button class="ghost" @click="$emit('close')">Fechar</button>
      </div>
    </div>

    <p class="mapper-panel__hint">Cada face usa um design real e pode ter os quatro cantos arrastados para encaixar na perspectiva do projetor.</p>

    <section class="mapper-panel__section">
      <div class="section-header">
        <h3>Camadas</h3>
        <span class="section-chip">{{ faces.length }} ativas</span>
      </div>

      <div class="mapper-panel__face-list">
        <button
          v-for="(face, index) in faces"
          :key="`picker-${face.id}`"
          class="mapper-panel__face-chip"
          :class="{ 'is-selected': face.id === selectedFaceId }"
          @click="$emit('select-face', face.id)"
        >
          {{ index === 0 ? `Topo · Face ${face.id}` : `Face ${face.id}` }}
        </button>
      </div>
      <p class="mapper-panel__hint mapper-panel__hint--small">Selecionar uma face traz essa camada para cima no mapper.</p>
    </section>

    <section class="mapper-panel__section">
      <div class="section-header">
        <h3>Face selecionada</h3>
        <span class="section-chip">{{ selectedFace ? `Face ${selectedFace.id}` : "Nenhuma" }}</span>
      </div>

      <template v-if="selectedFace">
        <label class="ks-select ks-select--editor">
          <span>Design da face</span>
          <select :value="selectedFace.designIndex" @change="handleDesignChange">
            <option v-for="option in faceOptions" :key="option.index" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="ks-select ks-select--editor">
          <span>Filtro da face</span>
          <select :value="selectedFace.visualStyle || 'default'" @change="handleVisualStyleChange">
            <option v-for="style in FACE_VISUAL_STYLE_OPTIONS" :key="style.value" :value="style.value">
              {{ style.label }}
            </option>
          </select>
        </label>

        <div class="mapper-panel__toggles">
          <label class="ks-toggle">
            <input type="checkbox" :checked="Boolean(selectedFace.flipX)" @change="handleFlipChange('x', $event)" />
            <span>Inverter horizontal</span>
          </label>
          <label class="ks-toggle">
            <input type="checkbox" :checked="Boolean(selectedFace.flipY)" @change="handleFlipChange('y', $event)" />
            <span>Inverter vertical</span>
          </label>
        </div>

        <div class="mapper-panel__actions mapper-panel__actions--inline">
          <button class="ghost" @click="$emit('toggle-face-transform', selectedFace.id)">
            {{ Array.isArray(selectedFace.cutPoints) && selectedFace.cutPoints.length ? "Remover transformacao" : "Transformar" }}
          </button>
          <button class="ghost" @click="$emit('reset-face')">Resetar quad</button>
        </div>

        <p class="mapper-panel__hint mapper-panel__hint--small">Transformar corta a face em 3 trechos conectados. Depois voce arrasta os 4 cantos e os 4 pontos novos para dobrar a mesma face.</p>
      </template>

      <p v-else class="mapper-panel__hint mapper-panel__hint--small">Adicione uma face e selecione-a para escolher o design e ajustar a perspectiva.</p>
    </section>
  </aside>
</template>

<style scoped>
.mapper-panel {
  height: 100%;
  max-height: 100%;
  overflow: auto;
  padding: 1rem 1rem 1.1rem;
  color: #eff6ff;
  background: linear-gradient(165deg, rgba(10, 14, 22, 0.98), rgba(8, 13, 21, 0.92));
}

.mapper-panel__top,
.mapper-panel__actions {
  display: flex;
  align-items: center;
}

.mapper-panel__top {
  justify-content: space-between;
  gap: 0.8rem;
}

.mapper-panel__actions {
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mapper-panel__actions--inline {
  justify-content: flex-start;
  margin-top: 0.7rem;
}

.mapper-panel__top h2,
.mapper-panel__section h3 {
  margin: 0;
}

.mapper-panel__hint {
  margin: 0.75rem 0 0;
  color: #9cb1c8;
  line-height: 1.45;
}

.mapper-panel__hint--small {
  font-size: 0.82rem;
}

.mapper-panel__section {
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.mapper-panel__face-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.7rem;
}

.mapper-panel__toggles {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.7rem;
}

.mapper-panel__face-chip {
  width: auto;
  min-width: 90px;
  padding-inline: 0.9rem;
}

.mapper-panel__face-chip.is-selected {
  background: linear-gradient(135deg, rgba(255, 122, 24, 0.24), rgba(255, 212, 71, 0.16));
  border-color: rgba(255, 196, 109, 0.42);
  color: #fff5da;
}
</style>
