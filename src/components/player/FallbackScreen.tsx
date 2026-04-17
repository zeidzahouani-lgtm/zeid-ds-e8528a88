import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

interface FallbackScreenProps {
  screenName: string;
  screenId: string;
  logoUrl: string;
  showLogo: boolean;
}

/**
 * Lightweight fallback screen using pure CSS animations instead of canvas.
 * Compatible with LG WebOS, Android TV, and low-power devices.
 */
export default function FallbackScreen({ screenName, screenId, logoUrl, showLogo }: FallbackScreenProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");

  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative overflow-hidden" style={{ backgroundColor: "#0a0e17", width: "100%", height: "100%" }}>
      {/* Pure CSS animated background - no canvas for device compatibility */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 30% 40%, hsla(222,47%,12%,1) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, hsla(210,60%,10%,1) 0%, transparent 50%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 50%, hsla(210,80%,30%,0.06) 0%, transparent 50%)",
        animation: "fallback-drift 20s ease-in-out infinite alternate",
      }} />

      {/* Content overlay */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        zIndex: 10,
      }}>
        {/* Logo */}
        {logoUrl && showLogo && (
          <img
            src={logoUrl}
            alt="Logo"
            style={{ height: 56, width: "auto", objectFit: "contain", marginBottom: 40, opacity: 0.7 }}
          />
        )}

        {/* Clock - using vmin for rotation-safe sizing */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, userSelect: "none" }}>
          <span style={{ fontSize: "min(16vmin, 160px)", fontWeight: 200, letterSpacing: "-0.02em", lineHeight: 1, color: "hsl(213,20%,88%)" }}>
            {hours}
          </span>
          <span style={{ fontSize: "min(16vmin, 160px)", fontWeight: 200, lineHeight: 1, color: "hsla(210,100%,56%,0.5)", animation: "fallback-blink 2s ease-in-out infinite" }}>
            :
          </span>
          <span style={{ fontSize: "min(16vmin, 160px)", fontWeight: 200, letterSpacing: "-0.02em", lineHeight: 1, color: "hsl(213,20%,88%)" }}>
            {mins}
          </span>
          <span style={{ fontSize: "min(6vmin, 48px)", fontWeight: 300, marginLeft: 8, opacity: 0.4, lineHeight: 1, color: "hsl(213,20%,70%)" }}>
            {secs}
          </span>
        </div>

        {/* Date */}
        <p style={{ marginTop: 16, fontSize: "min(2.5vmin, 20px)", fontWeight: 300, textTransform: "capitalize", letterSpacing: "0.05em", color: "hsl(213,15%,45%)" }}>
          {dateStr}
        </p>

        {/* Screen name */}
        <p style={{ marginTop: 32, fontSize: "min(1.6vmin, 14px)", textTransform: "uppercase", letterSpacing: "0.25em", fontWeight: 500, color: "hsla(210,100%,56%,0.3)" }}>
          {screenName}
        </p>

        {/* QR Upload */}
        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity: 0.6 }}>
          <p style={{ fontSize: "min(1.4vmin, 11px)", textTransform: "uppercase", letterSpacing: "0.2em", color: "hsl(213,15%,35%)" }}>
            Scannez pour diffuser
          </p>
          <div style={{ backgroundColor: "rgba(255,255,255,0.9)", padding: 12, borderRadius: 12, width: 144, height: 144, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <QRCodeSVG
              value={`${window.location.origin}/upload/${screenId}`}
              size={120}
              level="M"
              bgColor="transparent"
              style={{ display: "block", width: 120, height: 120 }}
            />
          </div>
        </div>
      </div>

      {/* CSS animations injected inline for device compatibility */}
      <style>{`
        @keyframes fallback-drift {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(5%, -3%) scale(1.1); }
        }
        @keyframes fallback-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
