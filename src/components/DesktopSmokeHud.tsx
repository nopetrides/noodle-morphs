import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Monitor, Sparkles } from 'lucide-react';
import {
  consumeTerrariumFrameCount,
  type DesktopDiagnostics,
  getDesktopBridge,
} from '../platform/desktopBridge';

/**
 * Lightweight Phase 1.5 desktop smoke-test HUD (renders ONLY inside Electron).
 * Displays GPU Canvas2D acceleration status, rolling FPS, and Steamworks / Overlay status.
 */
export function DesktopSmokeHud() {
  const bridge = getDesktopBridge();
  const [diag, setDiag] = useState<DesktopDiagnostics | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [fps, setFps] = useState<number>(0);
  const [overlayMsg, setOverlayMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge
      .getDiagnostics()
      .then((info) => {
        if (!cancelled) setDiag(info);
      })
      .catch(() => {
        // Ignore diagnostics IPC error
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    // Reset counter on mount and sample actual TerrariumCanvas redraws/sec without spinning an extra rAF loop
    consumeTerrariumFrameCount();
    let lastSample = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const frames = consumeTerrariumFrameCount();
      const elapsed = Math.max(1, now - lastSample);
      lastSample = now;
      setFps(Math.round((frames * 1000) / elapsed));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bridge]);

  if (!bridge) return null;

  const canvasStatus = diag?.gpuFeatures?.['2d_canvas'] ?? diag?.gpuFeatures?.canvas ?? 'checking…';
  const canvasOk = canvasStatus.startsWith('enabled');
  const steamOk = Boolean(diag?.steam.available);

  const handleTestOverlay = async () => {
    setOverlayMsg(null);
    const res = await bridge.openSteamOverlay();
    if (res.ok) {
      setOverlayMsg('Overlay dialog triggered! (Also test Shift+Tab)');
    } else {
      setOverlayMsg(res.error ?? 'Steam Overlay unavailable');
    }
  };

  return (
    <aside
      data-testid="desktop-smoke-hud"
      className="fixed top-3 left-3 z-50 w-72 rounded-xl bg-[#16120E]/92 border border-[#56B8B0]/45 shadow-xl shadow-black/70 text-[#F5EFE4] text-[11px] backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 cursor-pointer text-left"
      >
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#A6ECE3]">
          <Monitor className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Electron Smoke</span>
          <span className="font-mono-code text-[10px] px-1.5 py-0.5 rounded bg-[#233234] text-[#D8F7F2] tabular-nums">
            {fps} FPS
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-[#9E8F7B]" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[#9E8F7B]" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#D8BC87]/15 space-y-2">
          <div className="grid grid-cols-2 gap-1.5 font-mono-code text-[10px]">
            <div className="rounded bg-[#221C16] px-2 py-1">
              <div className="text-[#9E8F7B]">Electron</div>
              <div className="text-[#F5EFE4]">{diag?.electronVersion ?? '…'}</div>
            </div>
            <div className="rounded bg-[#221C16] px-2 py-1">
              <div className="text-[#9E8F7B]">Canvas2D GPU</div>
              <div className={canvasOk ? 'text-[#8CE8B2]' : 'text-[#F6B486]'}>{canvasStatus}</div>
            </div>
          </div>

          <div className="rounded-lg bg-[#221C16] border border-[#D8BC87]/15 p-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 font-medium text-[#EFE5D6]">
                <Activity className="w-3 h-3 text-[#D9A754]" aria-hidden="true" />
                <span>Steamworks</span>
              </span>
              <span
                className={`font-mono-code text-[10px] font-semibold ${
                  steamOk ? 'text-[#8CE8B2]' : 'text-[#F5B486]'
                }`}
              >
                {steamOk ? `App ${diag?.steam.appId}` : 'Offline'}
              </span>
            </div>
            {steamOk ? (
              <div className="text-[10px] text-[#C8BAA5] space-y-0.5">
                <div>
                  User: <strong className="text-[#F5EFE4]">{diag?.steam.personaName ?? 'Connected'}</strong>
                </div>
                <div>
                  Overlay hook: {diag?.steam.overlayHookEnabled ? 'Enabled' : 'Disabled'} · Workshop:{' '}
                  {diag?.steam.subscribedWorkshopCount ?? 0} item(s)
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-[#C8BAA5] leading-snug">
                {diag?.steam.error ?? 'Steamworks offline. Configure STEAM_APP_ID or local steam_appid.txt.'}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={!steamOk}
            onClick={handleTestOverlay}
            className="w-full py-1.5 px-2.5 rounded-lg bg-[#56B8B0] hover:bg-[#6CCAC2] disabled:opacity-40 text-[#102022] font-semibold text-[11px] cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            <span>Trigger Steam Overlay</span>
          </button>

          {overlayMsg && <p className="text-[10px] text-[#BCEFE9] leading-snug">{overlayMsg}</p>}
          <p className="text-[10px] text-[#8F806E]">
            Press <kbd className="px-1 rounded bg-[#2A231C] text-[#DFD3C2]">Shift+Tab</kbd> to test native
            Steam Overlay.
          </p>
        </div>
      )}
    </aside>
  );
}
