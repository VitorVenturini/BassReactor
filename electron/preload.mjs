import { contextBridge, ipcRenderer } from "electron";

const RANDOM_VISUAL_EVENT = "bass-reactor:random-visual";
const RANDOM_VISUAL_REQUEST = "bass-reactor:trigger-random-visual";

function onRandomVisualShortcut(callback) {
  if (typeof callback !== "function") return () => {};

  const listener = (_event, payload) => {
    callback(payload || {});
  };

  ipcRenderer.on(RANDOM_VISUAL_EVENT, listener);
  return () => {
    ipcRenderer.removeListener(RANDOM_VISUAL_EVENT, listener);
  };
}

function triggerRandomVisual() {
  ipcRenderer.send(RANDOM_VISUAL_REQUEST);
}

contextBridge.exposeInMainWorld("bassReactorElectron", {
  isElectron: true,
  onRandomVisualShortcut,
  triggerRandomVisual,
});
