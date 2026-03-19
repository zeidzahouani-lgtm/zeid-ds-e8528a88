import { MonitorPlay, ArrowRight, Wifi, BarChart3, Layers, Zap, Radio, Tv, Monitor, Signal, Globe, Activity } from "lucide-react";
import { useMemo } from "react";

const ICONS = [MonitorPlay, ArrowRight, Wifi, BarChart3, Layers, Zap, Radio, Tv, Monitor, Signal, Globe, Activity];

interface Particle {
  id: number;
  Icon: typeof MonitorPlay;
  size: number;
  x: number;
  y: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
}

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      Icon: ICONS[i % ICONS.length],
      size: 18 + Math.random() * 28,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 14 + Math.random() * 18,
      delay: -(Math.random() * 20),
      opacity: 0.06 + Math.random() * 0.14,
      drift: 40 + Math.random() * 80,
    });
  }
  return particles;
}

export function LoginParticles() {
  const particles = useMemo(() => generateParticles(20), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden="true">
      {/* Floating icon particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="login-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animationDuration: `${p.duration}s, ${p.duration * 0.8}s`,
            animationDelay: `${p.delay}s, ${p.delay}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        >
          <p.Icon
            style={{ width: p.size, height: p.size, opacity: p.opacity }}
            className="text-primary drop-shadow-[0_0_6px_hsl(210_100%_56%/0.4)]"
            strokeWidth={1.2}
          />
        </div>
      ))}

      {/* Floating orbs for extra depth */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <line x1="10%" y1="20%" x2="40%" y2="60%" className="stroke-primary" strokeWidth="0.5" strokeDasharray="4 8">
          <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="8s" repeatCount="indefinite" />
        </line>
        <line x1="60%" y1="10%" x2="90%" y2="80%" className="stroke-primary" strokeWidth="0.5" strokeDasharray="4 8">
          <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="12s" repeatCount="indefinite" />
        </line>
        <line x1="80%" y1="15%" x2="30%" y2="90%" className="stroke-accent" strokeWidth="0.5" strokeDasharray="4 8">
          <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="10s" repeatCount="indefinite" />
        </line>
      </svg>
    </div>
  );
}
