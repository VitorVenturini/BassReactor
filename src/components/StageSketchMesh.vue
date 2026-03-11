<template>
  <TresMesh
    ref="mesh"
    :visible="visible && opacity > 0.001 && scale > 0"
    :position="position"
    :scale="[scale, scale, 1]"
  >
    <TresPlaneGeometry :args="[aspectRatio, 1]" />
    <TresShaderMaterial
      :side="0"
      :vertex-shader="vertexShader"
      :fragment-shader="fragmentShader"
      :uniforms="uniforms"
      :transparent="opacity < 0.999"
      :opacity="opacity"
      :depth-write="opacity >= 0.999"
    />
  </TresMesh>
</template>

<script setup>
import { shallowRef } from "vue";
import { useShader } from "@wearesage/vue";

const props = defineProps({
  shader: {
    type: String,
    default: "",
  },
  uniforms: {
    type: Object,
    default: () => ({}),
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
  dpr: {
    type: Number,
    default: 1,
  },
  volume: {
    type: Number,
    default: 1,
  },
  stream: {
    type: Number,
    default: 0,
  },
  time: {
    type: Number,
    default: 0,
  },
  visible: {
    type: Boolean,
    default: true,
  },
  opacity: {
    type: Number,
    default: 1,
  },
  position: {
    type: Array,
    default: () => [0, 0, 0],
  },
  scale: {
    type: Number,
    default: 1,
  },
});

const mesh = shallowRef();
const { aspectRatio, vertexShader, fragmentShader, uniforms, render: prepShader } = useShader(props, mesh);

defineExpose({
  update: prepShader,
});
</script>
