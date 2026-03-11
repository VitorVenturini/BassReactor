import { computed, onBeforeUnmount, ref, watch } from "vue";

const POPUP_CHANNEL = "bass-reactor-vue-popup";
const POPUP_FEATURES = "popup=yes,width=1280,height=720,resizable=yes";

function clonePayload(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

export function useVisualizerPopup({ audio, sketches, onRandomShortcut }) {
  const popupWindow = ref(null);
  const popupReady = ref(false);
  const status = ref("Pop-up desligado.");
  const error = ref(false);
  const isOpen = computed(() => Boolean(popupWindow.value && !popupWindow.value.closed));

  let channel = null;
  let frameTimer = 0;

  function ensureChannel() {
    if (channel || typeof BroadcastChannel === "undefined") return;
    channel = new BroadcastChannel(POPUP_CHANNEL);
    channel.onmessage = (event) => {
      const message = event.data || {};

      if (message.type === "popup-ready") {
        popupReady.value = true;
        error.value = false;
        status.value = "Pop-up conectado. O visualizer agora pode rodar em janela separada.";
        syncVisualState();
        syncFrameState();
        return;
      }

      if (message.type === "popup-closing") {
        cleanupPopupState(false);
        return;
      }

      if (message.type === "popup-shortcut-random") {
        onRandomShortcut?.();
      }
    };
  }

  function postMessage(type, payload) {
    if (!channel) return;
    channel.postMessage({ type, payload });
  }

  function syncVisualState() {
    postMessage("visual-sync", {
      sketch: clonePayload(sketches.sketch),
      shader: sketches.shader || null,
      uniforms: clonePayload(sketches.uniforms),
    });
  }

  function syncFrameState() {
    postMessage("frame-sync", {
      running: audio.running.value,
      blink: audio.blink.value,
      motion: audio.motionStream.value,
      colorIntensity: audio.colorIntensity.value,
      status: audio.status.value,
      sketchName: sketches.sketch?.id || "",
      sentAt: Date.now(),
    });
  }

  function stopFrameSync() {
    if (frameTimer) {
      window.clearInterval(frameTimer);
      frameTimer = 0;
    }
  }

  function startFrameSync() {
    stopFrameSync();
    frameTimer = window.setInterval(() => {
      if (!isOpen.value) {
        cleanupPopupState(false);
        return;
      }
      syncFrameState();
    }, 33);
  }

  function cleanupPopupState(updateStatus = true) {
    stopFrameSync();
    popupReady.value = false;
    popupWindow.value = null;
    if (updateStatus) {
      status.value = "Pop-up desligado.";
    }
  }

  function openPopup() {
    ensureChannel();

    if (isOpen.value) {
      popupWindow.value.focus();
      status.value = "Pop-up ja aberto.";
      return;
    }

    const popup = window.open("./vue-popup.html", "bass_reactor_vue_popup", POPUP_FEATURES);
    if (!popup) {
      error.value = true;
      status.value = "Pop-up bloqueado pelo navegador. Libere pop-ups para este site.";
      return;
    }

    popupWindow.value = popup;
    popupReady.value = false;
    error.value = false;
    status.value = "Abrindo pop-up do visualizer...";

    popup.addEventListener("beforeunload", () => {
      cleanupPopupState(true);
    });

    startFrameSync();
  }

  function closePopup() {
    if (popupWindow.value && !popupWindow.value.closed) {
      popupWindow.value.close();
    }
    cleanupPopupState(true);
  }

  function togglePopup() {
    if (isOpen.value) {
      closePopup();
      return;
    }
    openPopup();
  }

  watch(
    () => [sketches.shader, sketches.uniformKeysSerialized, sketches.uniformValuesSerialized],
    () => {
      if (!popupReady.value) return;
      syncVisualState();
    },
    { deep: true }
  );

  watch(
    () => audio.running.value,
    () => {
      if (!popupReady.value) return;
      syncFrameState();
    }
  );

  onBeforeUnmount(() => {
    closePopup();
    if (channel) {
      channel.close();
      channel = null;
    }
  });

  return {
    isOpen,
    popupReady,
    status,
    error,
    openPopup,
    closePopup,
    togglePopup,
  };
}
