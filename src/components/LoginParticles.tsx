import { MonitorPlay, ArrowRight, Wifi, BarChart3, Layers, Zap, Radio, Tv } from "lucide-react";
import { useMemo } from "react";

const ICONS = [MonitorPlay, ArrowRight, Wifi, BarChart3, Layers, Zap, Radio, Tv];

interface Particle {
  id: number;
  Icon: typeof MonitorPlay;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  opacity: number;
  direction: number; // 0-360
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      Icon: ICONS[i % ICONS.length],
      size: 16 + Math.random() * 20,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 18 + Math.random() * 22,
      delay: -(Math.random() * 30),
      opacity: 0.04 + Math.random() * 0.08,
      direction: Math.random() * 360,
    });
  }
  return particles;
}

export function LoginParticles() {
  const particles = useMemo(() => generateParticles(14), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="login-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity,
            ["--float-angle" as string]: `${p.direction}deg`,
          }}
        >
          <p.Icon
            style={{ width: p.size, height: p.size }}
            className="text-primary"
            strokeWidth={1}
          />
        </div>
      ))}
    </div>
  );
}
