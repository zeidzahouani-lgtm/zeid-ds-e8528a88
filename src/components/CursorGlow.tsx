import { useCallback, useRef, useEffect } from "react";

/**
 * Wraps children in a container that tracks cursor position and applies
 * a radial glow + subtle 3D tilt effect (inspired by glassmorphism card patterns).
 */
export function CursorGlow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  const handleMove = useCallback((e: MouseEvent) => {
    const el = containerRef.current;
    const glow = glowRef.current;
    if (!el || !glow) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // Tilt (max ±6deg)
      const rotateY = ((x - cx) / cx) * 6;
      const rotateX = ((cy - y) / cy) * 6;

      el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.01)`;
      glow.style.background = `radial-gradient(circle at ${x}px ${y}px, hsl(var(--primary) / 0.15) 0%, transparent 60%)`;
      glow.style.opacity = "1";
    });
  }, []);

  const handleLeave = useCallback(() => {
    const el = containerRef.current;
    const glow = glowRef.current;
    if (el) el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
    if (glow) glow.style.opacity = "0";
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);

    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMove, handleLeave]);

  return (
    <div
      ref={containerRef}
      className={`relative transition-transform duration-200 ease-out ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div
        ref={glowRef}
        className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 transition-opacity duration-300 z-0"
      />
      {children}
    </div>
  );
}
