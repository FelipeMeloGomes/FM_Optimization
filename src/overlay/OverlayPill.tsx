import { useEffect, useState } from 'react';
import type { OverlayFrame, OverlaySettings } from '../../electron/shared/overlay-types';
import './overlay.css';

/** O overlay visível dentro do jogo: só o número e a palavra FPS. */
export function OverlayPill() {
  const [frame, setFrame] = useState<OverlayFrame | null>(null);
  const [settings, setSettings] = useState<OverlaySettings | null>(null);

  useEffect(() => {
    const offFrame = window.overlayAPI.onFrame(setFrame);
    const offSettings = window.overlayAPI.onSettings(setSettings);
    return () => {
      offFrame();
      offSettings();
    };
  }, []);

  if (!frame?.visible) return null;

  return (
    <div
      data-testid="overlay-pill"
      className={`overlay-root ${settings?.position ?? 'top-left'}`}
      style={{ opacity: settings?.opacity ?? 0.85 }}
    >
      <div data-testid="fps-value" className={`fps-value ${frame.color}`}>
        <span className="fps-number">{frame.fps}</span>
        <span className="fps-label">FPS</span>
      </div>
    </div>
  );
}
