import { contextBridge, ipcRenderer } from "electron";

const VISUAL_SHORTCUT_EVENT = "bass-reactor:visual-shortcut";
const VISUAL_SHORTCUT_REQUEST = "bass-reactor:trigger-visual-shortcut";
const OPEN_MAPPER_POPUP_REQUEST = "bass-reactor:open-mapper-popup";
const CLOSE_MAPPER_POPUP_REQUEST = "bass-reactor:close-mapper-popup";
const LIST_DESKTOP_CAPTURE_SOURCES_REQUEST = "bass-reactor:list-desktop-capture-sources";
const SET_DESKTOP_CAPTURE_SOURCE_REQUEST = "bass-reactor:set-desktop-capture-source";
const RELOAD_ALL_WINDOWS_REQUEST = "bass-reactor:reload-all-windows";

function onVisualShortcut(callback) {
  if (typeof callback !== "function") return () => {};

  const listener = (_event, payload) => {
    callback(payload || {});
  };

  ipcRenderer.on(VISUAL_SHORTCUT_EVENT, listener);
  return () => {
    ipcRenderer.removeListener(VISUAL_SHORTCUT_EVENT, listener);
  };
}

function onRandomVisualShortcut(callback) {
  if (typeof callback !== "function") return () => {};

  return onVisualShortcut((payload) => {
    const family = String(payload?.family || "random").toLowerCase();
    if (family === "random") {
      callback(payload || {});
    }
  });
}

function triggerVisualShortcut(family = "random") {
  ipcRenderer.send(VISUAL_SHORTCUT_REQUEST, {
    family,
  });
}

function triggerRandomVisual() {
  triggerVisualShortcut("random");
}

function openMapperPopup() {
  ipcRenderer.send(OPEN_MAPPER_POPUP_REQUEST);
}

function closeMapperPopup() {
  ipcRenderer.send(CLOSE_MAPPER_POPUP_REQUEST);
}

function reloadAllWindows() {
  ipcRenderer.send(RELOAD_ALL_WINDOWS_REQUEST);
}

async function listDesktopCaptureSources() {
  const response = await ipcRenderer.invoke(LIST_DESKTOP_CAPTURE_SOURCES_REQUEST);
  return Array.isArray(response) ? response : [];
}

async function setDesktopCaptureSource(sourceId = "") {
  return ipcRenderer.invoke(SET_DESKTOP_CAPTURE_SOURCE_REQUEST, {
    sourceId,
  });
}

contextBridge.exposeInMainWorld("bassReactorElectron", {
  isElectron: true,
  onVisualShortcut,
  onRandomVisualShortcut,
  triggerVisualShortcut,
  triggerRandomVisual,
  openMapperPopup,
  closeMapperPopup,
  reloadAllWindows,
  listDesktopCaptureSources,
  setDesktopCaptureSource,
});
