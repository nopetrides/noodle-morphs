const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const IS_SMOKE_CHECK = process.argv.includes('--smoke-check');
const ENV_STEAM_APP_ID = Number(process.env.STEAM_APP_ID || 0);
const HAS_LOCAL_STEAM_APP_ID_FILE = fs.existsSync(path.resolve(__dirname, '..', 'steam_appid.txt'));
const RESOLVED_STEAM_APP_ID = Number.isInteger(ENV_STEAM_APP_ID) && ENV_STEAM_APP_ID > 0 ? ENV_STEAM_APP_ID : null;

let steamworks = null;
let steamClient = null;
let steamInitError = null;
let overlayHookEnabled = false;

try {
  steamworks = require('steamworks.js');
  if (!IS_SMOKE_CHECK && typeof steamworks.electronEnableSteamOverlay === 'function') {
    // Pass `true` to disable steamworks.js's unconditional 60 Hz background invalidation loop;
    // we drive our own focus-aware invalidator below so unfocused/minimized windows truly idle at 0 GPU churn.
    steamworks.electronEnableSteamOverlay(true);
    overlayHookEnabled = true;
  }
} catch (err) {
  steamInitError = `Failed to load steamworks.js: ${err && err.message ? err.message : String(err)}`;
}

function initSteam() {
  if (!steamworks || IS_SMOKE_CHECK) return;
  if (!RESOLVED_STEAM_APP_ID && !HAS_LOCAL_STEAM_APP_ID_FILE) {
    steamClient = null;
    steamInitError = 'No Steam AppID configured (set STEAM_APP_ID or add a local gitignored steam_appid.txt).';
    return;
  }
  try {
    steamClient = RESOLVED_STEAM_APP_ID
      ? steamworks.init(RESOLVED_STEAM_APP_ID)
      : steamworks.init();
    steamInitError = null;
  } catch (err) {
    steamClient = null;
    steamInitError = err && err.message ? err.message : String(err);
  }
}

function getSteamDiagnostics() {
  if (!steamClient) {
    return {
      available: false,
      appId: RESOLVED_STEAM_APP_ID || 0,
      overlayHookEnabled,
      personaName: null,
      steamId64: null,
      isSteamDeck: false,
      subscribedWorkshopCount: 0,
      error: steamInitError || 'Steam client not running.',
    };
  }

  let personaName = null;
  let steamId64 = null;
  let isSteamDeck = false;
  let subscribedWorkshopCount = 0;
  let activeAppId = RESOLVED_STEAM_APP_ID || 0;

  try {
    activeAppId = steamClient.utils.getAppId();
  } catch {
    // Ignore
  }
  try {
    personaName = steamClient.localplayer.getName();
    steamId64 = steamClient.localplayer.getSteamId().steamId64.toString();
  } catch {
    // Ignore optional player metadata read errors
  }
  try {
    isSteamDeck = Boolean(steamClient.utils.isSteamRunningOnSteamDeck());
  } catch {
    // Ignore
  }
  try {
    subscribedWorkshopCount = steamClient.workshop.getSubscribedItems().length;
  } catch {
    // Ignore
  }

  return {
    available: true,
    appId: activeAppId,
    overlayHookEnabled,
    personaName,
    steamId64,
    isSteamDeck,
    subscribedWorkshopCount,
    error: null,
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#1B1713',
    title: 'Noodle Morphs',
    show: !IS_SMOKE_CHECK,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  win.loadFile(distIndex);

  // Smart focus-aware Steam Overlay keep-alive:
  // Only invalidates at a gentle 15 Hz when focused & static (paused/occluded); when the game is
  // actively ticking TerrariumCanvas + UI, Chromium already presents at targetFps with zero extra invalidations!
  if (overlayHookEnabled && !IS_SMOKE_CHECK) {
    let overlayRepaintTimer = null;
    let overlayKeepAlive = false;

    const stopOverlayRepaint = () => {
      if (overlayRepaintTimer !== null) {
        clearInterval(overlayRepaintTimer);
        overlayRepaintTimer = null;
      }
    };
    const startOverlayRepaint = () => {
      stopOverlayRepaint();
      if (!overlayKeepAlive || win.isDestroyed() || !win.isFocused() || win.isMinimized() || !win.isVisible()) {
        return;
      }
      overlayRepaintTimer = setInterval(() => {
        if (!overlayKeepAlive || win.isDestroyed() || !win.isFocused() || win.isMinimized() || !win.isVisible()) {
          stopOverlayRepaint();
          return;
        }
        if (!win.webContents.isPainting()) {
          win.webContents.invalidate();
        }
      }, 1000 / 20);
    };

    const handleOverlayKeepAlive = (_event, active) => {
      const next = Boolean(active);
      if (next !== overlayKeepAlive) {
        overlayKeepAlive = next;
        if (overlayKeepAlive) startOverlayRepaint();
        else stopOverlayRepaint();
      }
    };
    ipcMain.on('desktop:set-overlay-keepalive', handleOverlayKeepAlive);
    ipcMain.on('desktop:set-target-fps', () => {});

    win.on('focus', startOverlayRepaint);
    win.on('restore', startOverlayRepaint);
    win.on('show', startOverlayRepaint);
    win.on('blur', stopOverlayRepaint);
    win.on('minimize', stopOverlayRepaint);
    win.on('hide', stopOverlayRepaint);
    win.on('closed', () => {
      stopOverlayRepaint();
      ipcMain.removeListener('desktop:set-overlay-keepalive', handleOverlayKeepAlive);
    });
    win.once('ready-to-show', startOverlayRepaint);
  }

  if (IS_SMOKE_CHECK) {
    win.webContents.once('did-finish-load', async () => {
      try {
        const gpu = app.getGPUFeatureStatus();
        const title = await win.webContents.executeJavaScript('document.title');
        const hasBridge = await win.webContents.executeJavaScript(
          'Boolean(window.noodleMorphsDesktop)'
        );
        console.log(
          JSON.stringify({
            smokeOk: true,
            title,
            hasBridge,
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            canvasGpu: gpu['2d_canvas'] || gpu.canvas,
            webglGpu: gpu.webgl,
          })
        );
      } catch (err) {
        console.error('Smoke check failed:', err);
        process.exitCode = 1;
      } finally {
        app.quit();
      }
    });
    win.webContents.once('did-fail-load', (_e, code, desc) => {
      console.error(`Failed to load dist/index.html: ${code} ${desc}`);
      process.exitCode = 1;
      app.quit();
    });
  }

  return win;
}

ipcMain.handle('desktop:get-diagnostics', () => {
  return {
    runtime: 'electron',
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    platform: process.platform,
    gpuFeatures: app.getGPUFeatureStatus(),
    steam: getSteamDiagnostics(),
  };
});

ipcMain.handle('desktop:open-steam-overlay', () => {
  if (!steamClient) {
    return { ok: false, error: steamInitError || 'Steam not connected' };
  }
  try {
    // Dialog.Friends = 0
    steamClient.overlay.activateDialog(0);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('desktop:quit', () => {
  app.quit();
});

app.whenReady().then(() => {
  initSteam();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
