/**
 * Animated gradient background with flowing blobs, grid overlay, and scan line.
 * Adapts to dark and light themes via CSS classes.
 */
export function AnimatedBackground() {
  return (
    <div className="animated-bg-container" aria-hidden="true">
      {/* Large gradient blobs */}
      <div className="animated-bg-blob animated-bg-blob-1" />
      <div className="animated-bg-blob animated-bg-blob-2" />
      <div className="animated-bg-blob animated-bg-blob-3" />
      <div className="animated-bg-blob animated-bg-blob-4" />
      {/* Grid overlay */}
      <div className="animated-bg-grid" />
      {/* Horizontal scan line */}
      <div className="animated-bg-scanline" />
      {/* Noise texture */}
      <div className="animated-bg-noise" />
    </div>
  );
}
