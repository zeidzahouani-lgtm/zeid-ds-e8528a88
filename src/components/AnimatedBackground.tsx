import { useEffect, useRef } from "react";

/**
 * Subtle animated gradient background with flowing wave motion.
 * Uses CSS only for performance (GPU-composited transforms & opacity).
 */
export function AnimatedBackground() {
  return (
    <div className="animated-bg-container" aria-hidden="true">
      {/* Primary gradient blob */}
      <div className="animated-bg-blob animated-bg-blob-1" />
      {/* Secondary gradient blob */}
      <div className="animated-bg-blob animated-bg-blob-2" />
      {/* Tertiary gradient blob */}
      <div className="animated-bg-blob animated-bg-blob-3" />
      {/* Noise overlay for texture */}
      <div className="animated-bg-noise" />
    </div>
  );
}
