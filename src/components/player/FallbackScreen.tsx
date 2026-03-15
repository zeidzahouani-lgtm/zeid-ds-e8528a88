import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface FallbackScreenProps {
  screenName: string;
  screenId: string;
  logoUrl: string;
  showLogo: boolean;
}

export default function FallbackScreen({ screenName, screenId, logoUrl, showLogo }: FallbackScreenProps) {
  const [now, setNow] = useState(new Date());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Animated gradient background to prevent burn-in
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const animate = () => {
      t += 0.002;
      const w = canvas.width;
      const h = canvas.height;

      // Slowly shifting gradient positions
      const x1 = Math.sin(t * 0.7) * 0.3 + 0.3;
      const y1 = Math.cos(t * 0.5) * 0.3 + 0.3;
      const x2 = Math.cos(t * 0.6) * 0.3 + 0.7;
      const y2 = Math.sin(t * 0.8) * 0.3 + 0.7;

      const grad = ctx.createRadialGradient(
        w * x1, h * y1, 0,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.8
      );
      grad.addColorStop(0, `hsla(222, 47%, 8%, 1)`);
      grad.addColorStop(0.4, `hsla(225, 50%, 5%, 1)`);
      grad.addColorStop(1, `hsla(220, 40%, 3%, 1)`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle floating orbs
      const drawOrb = (cx: number, cy: number, r: number, hue: number, alpha: number) => {
        const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        orbGrad.addColorStop(0, `hsla(${hue}, 80%, 50%, ${alpha})`);
        orbGrad.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
        ctx.fillStyle = orbGrad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      };

      drawOrb(
        w * (0.3 + Math.sin(t * 0.4) * 0.15),
        h * (0.4 + Math.cos(t * 0.3) * 0.15),
        Math.min(w, h) * 0.35,
        210, 0.06
      );
      drawOrb(
        w * (0.7 + Math.cos(t * 0.5) * 0.12),
        h * (0.6 + Math.sin(t * 0.35) * 0.12),
        Math.min(w, h) * 0.3,
        192, 0.04
      );
      drawOrb(
        w * (0.5 + Math.sin(t * 0.6) * 0.1),
        h * (0.2 + Math.cos(t * 0.45) * 0.1),
        Math.min(w, h) * 0.25,
        260, 0.03
      );

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
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
    <div className="w-full h-full relative overflow-hidden">
      {/* Animated canvas background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {/* Logo */}
        {logoUrl && showLogo && (
          <img
            src={logoUrl}
            alt="Logo"
            className="h-14 w-auto object-contain mb-10 opacity-70"
          />
        )}

        {/* Clock */}
        <div className="flex items-baseline gap-1 select-none">
          <span className="text-[min(12vw,160px)] font-extralight tracking-tight leading-none"
            style={{ color: "hsl(213, 20%, 88%)" }}>
            {hours}
          </span>
          <span className="text-[min(12vw,160px)] font-extralight leading-none animate-pulse"
            style={{ color: "hsl(210, 100%, 56%, 0.5)" }}>
            :
          </span>
          <span className="text-[min(12vw,160px)] font-extralight tracking-tight leading-none"
            style={{ color: "hsl(213, 20%, 88%)" }}>
            {mins}
          </span>
          <span className="text-[min(5vw,48px)] font-light ml-2 opacity-40 leading-none"
            style={{ color: "hsl(213, 20%, 70%)" }}>
            {secs}
          </span>
        </div>

        {/* Date */}
        <p className="mt-4 text-[min(2vw,20px)] font-light capitalize tracking-wide"
          style={{ color: "hsl(213, 15%, 45%)" }}>
          {dateStr}
        </p>

        {/* Screen name */}
        <p className="mt-8 text-[min(1.2vw,14px)] uppercase tracking-[0.25em] font-medium"
          style={{ color: "hsl(210, 100%, 56%, 0.3)" }}>
          {screenName}
        </p>

        {/* QR Upload */}
        <div className="mt-12 flex flex-col items-center gap-3 opacity-60 hover:opacity-90 transition-opacity duration-500">
          <p className="text-[min(1vw,11px)] uppercase tracking-[0.2em]"
            style={{ color: "hsl(213, 15%, 35%)" }}>
            Scannez pour diffuser
          </p>
          <div className="bg-white/90 p-3 rounded-xl backdrop-blur-sm">
            <QRCodeSVG
              value={`${window.location.origin}/upload/${screenId}`}
              size={120}
              level="M"
              bgColor="transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
