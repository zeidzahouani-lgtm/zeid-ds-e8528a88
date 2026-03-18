import { useEffect, useRef, useState } from "react";

interface MarqueeWidgetProps {
  config?: {
    text?: string;
    speed?: number;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
    transparentBg?: boolean;
  };
}

export default function MarqueeWidget({ config }: MarqueeWidgetProps) {
  const text = config?.text || "Bienvenue ! Ceci est un message défilant.";
  const speed = config?.speed ?? 80;
  const bg = config?.backgroundColor || "#1a1a2e";
  const color = config?.textColor || "#ffffff";
  const fontSize = config?.fontSize ?? 24;
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (textRef.current) setTextWidth(textRef.current.offsetWidth);
    if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
  }, [text, fontSize]);

  useEffect(() => {
    if (!textWidth || !containerWidth) return;
    let raf: number;
    let lastTime = performance.now();
    const totalDistance = containerWidth + textWidth;

    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      setOffset((prev) => {
        const next = prev + speed * delta;
        return next > totalDistance ? 0 : next;
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [speed, textWidth, containerWidth]);

  return (
    <div
      ref={containerRef}
      className="flex items-center h-full w-full overflow-hidden"
      style={{ backgroundColor: config?.transparentBg ? 'transparent' : bg }}
    >
      <span
        ref={textRef}
        className="whitespace-nowrap font-bold"
        style={{
          color,
          fontSize: `${fontSize}px`,
          transform: `translateX(${containerWidth - offset}px)`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
