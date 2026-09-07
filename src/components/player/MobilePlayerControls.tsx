import { useEffect, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";
import {
  isPlaybackMuted,
  isPlaybackPaused,
  onPlaybackStateChange,
  setPlaybackMuted,
  setPlaybackPaused,
} from "@/lib/player-audio";

/**
 * Touch-friendly overlay shown on phones / tablets only.
 * Tap anywhere to reveal: play/pause, sound on/off and fullscreen.
 */
export default function MobilePlayerControls() {
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [, force] = useState(0);

  useEffect(() => {
    const check = () =>
      setEnabled(
        typeof window !== "undefined" &&
          window.matchMedia("(pointer: coarse)").matches &&
          Math.min(window.innerWidth, window.innerHeight) <= 1024
      );
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => onPlaybackStateChange(() => force((v) => v + 1)), []);

  useEffect(() => {
    if (!enabled) return;
    const reveal = () => {
      setVisible(true);
    };
    window.addEventListener("touchstart", reveal, { passive: true });
    window.addEventListener("pointerdown", reveal, { passive: true });
    return () => {
      window.removeEventListener("touchstart", reveal);
      window.removeEventListener("pointerdown", reveal);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !visible) return;
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [enabled, visible]);

  if (!enabled) return null;

  const paused = isPlaybackPaused();
  const muted = isPlaybackMuted();

  const btn: React.CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: 26,
    border: "none",
    background: "rgba(15,18,25,0.72)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "max(18px, env(safe-area-inset-bottom))",
        display: "flex",
        justifyContent: "center",
        gap: 14,
        zIndex: 60,
        opacity: visible ? 1 : 0,
        transition: "opacity .35s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <button
        aria-label={paused ? "Reprendre" : "Mettre en pause"}
        style={btn}
        onClick={(e) => {
          e.stopPropagation();
          setPlaybackPaused(!paused);
        }}
      >
        {paused ? <Play size={22} /> : <Pause size={22} />}
      </button>
      <button
        aria-label={muted ? "Activer le son" : "Couper le son"}
        style={btn}
        onClick={(e) => {
          e.stopPropagation();
          setPlaybackMuted(!muted);
        }}
      >
        {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
      </button>
      <button
        aria-label="Plein écran"
        style={btn}
        onClick={(e) => {
          e.stopPropagation();
          const el: any = document.documentElement;
          (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
        }}
      >
        <Maximize2 size={22} />
      </button>
    </div>
  );
}
