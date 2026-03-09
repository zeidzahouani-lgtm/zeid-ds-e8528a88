import { useState, useEffect } from "react";

interface ClockWidgetProps {
  config?: {
    format?: "12h" | "24h";
    showDate?: boolean;
    showSeconds?: boolean;
  };
}

export default function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(new Date());
  const format = config?.format || "24h";
  const showDate = config?.showDate !== false;
  const showSeconds = config?.showSeconds !== false;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = format === "12h" ? now.getHours() % 12 || 12 : now.getHours();
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");
  const ampm = format === "12h" ? (now.getHours() >= 12 ? "PM" : "AM") : "";

  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-black/80 text-white p-4">
      <div className="text-4xl font-bold font-mono tracking-wider">
        {String(hours).padStart(2, "0")}:{mins}
        {showSeconds && <span className="text-2xl opacity-70">:{secs}</span>}
        {ampm && <span className="text-lg ml-2 opacity-70">{ampm}</span>}
      </div>
      {showDate && (
        <p className="text-sm opacity-60 mt-2 capitalize">{dateStr}</p>
      )}
    </div>
  );
}
