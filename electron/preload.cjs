const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noodleMorphsDesktop', {
  getDiagnostics: () => ipcRenderer.invoke('desktop:get-diagnostics'),
  openSteamOverlay: () => ipcRenderer.invoke('desktop:open-steam-overlay'),
  setTargetFps: (fps) => ipcRenderer.send('desktop:set-target-fps', fps),
  setOverlayKeepAlive: (active) => ipcRenderer.send('desktop:set-overlay-keepalive', active),
  quitApp: () => ipcRenderer.invoke('desktop:quit'),
});
