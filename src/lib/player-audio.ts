/**
 * Player audio helper.
 *
 * Browsers (and Android TV WebViews) block unmuted autoplay until the page has
 * received a user gesture. The player therefore:
 *   1. tries to play each video WITH sound,
 *   2. falls back to muted playback if the browser refuses,
 *   3. remembers that sound is blocked so the UI can show a "activer le son"
 *      hint, and unmutes every live video as soon as any gesture happens.
 */

const videos = new Set<HTMLVideoElement>();
let blocked = false;
const listeners = new Set<(blocked: boolean) => void>();

function notify() {
  listeners.forEach((l) => {
    try { l(blocked); } catch {}
  });
}

export function onAudioBlockedChange(cb: (blocked: boolean) => void) {
  listeners.add(cb);
  cb(blocked);
  return () => { listeners.delete(cb); };
}

export function isAudioBlocked() {
  return blocked;
}

async function tryPlayWithSound(el: HTMLVideoElement) {
  try {
    el.muted = false;
    el.volume = 1;
    await el.play();
    if (blocked) { blocked = false; notify(); }
  } catch {
    // Autoplay policy: fall back to muted so the video still plays.
    try {
      el.muted = true;
      await el.play();
    } catch {}
    if (!blocked) { blocked = true; notify(); }
  }
}

/** Unmute every registered video (call from a user gesture). */
export function unlockAudio() {
  videos.forEach((el) => {
    el.muted = false;
    el.volume = 1;
    el.play().catch(() => {});
  });
  if (blocked) { blocked = false; notify(); }
}

/** React ref callback: attach to every <video> rendered by the player. */
export function audioVideoRef(el: HTMLVideoElement | null) {
  if (!el) return;
  if (videos.has(el)) return;
  videos.add(el);
  el.addEventListener("emptied", () => videos.delete(el), { once: true });
  // Chrome needs the element to be ready before play() resolves reliably.
  const attempt = () => tryPlayWithSound(el);
  if (el.readyState >= 2) attempt();
  else el.addEventListener("loadeddata", attempt, { once: true });
}

if (typeof window !== "undefined") {
  const gesture = () => unlockAudio();
  ["pointerdown", "keydown", "touchstart", "click"].forEach((ev) =>
    window.addEventListener(ev, gesture, { passive: true })
  );
}
