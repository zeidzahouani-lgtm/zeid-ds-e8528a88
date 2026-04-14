import { useState, useEffect } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";

interface ClockWidgetProps {
  config?: {
    format?: "12h" | "24h";
    showDate?: boolean;
    showSeconds?: boolean;
    gmtOffset?: number;
    transparentBg?: boolean;
    textColor?: string;
  };
}

export const GMT_OFFSETS = [
  { value: -12, label: "GMT-12" },
  { value: -11, label: "GMT-11" },
  { value: -10, label: "GMT-10 (Hawaii)" },
  { value: -9, label: "GMT-9 (Alaska)" },
  { value: -8, label: "GMT-8 (Los Angeles)" },
  { value: -7, label: "GMT-7 (Denver)" },
  { value: -6, label: "GMT-6 (Chicago)" },
  { value: -5, label: "GMT-5 (New York)" },
  { value: -4, label: "GMT-4 (Santiago)" },
  { value: -3, label: "GMT-3 (São Paulo)" },
  { value: -2, label: "GMT-2" },
  { value: -1, label: "GMT-1 (Açores)" },
  { value: 0, label: "GMT+0 (Londres, Casablanca)" },
  { value: 1, label: "GMT+1 (Paris, Alger)" },
  { value: 2, label: "GMT+2 (Le Caire)" },
  { value: 3, label: "GMT+3 (Riyad, Moscou)" },
  { value: 3.5, label: "GMT+3:30 (Téhéran)" },
  { value: 4, label: "GMT+4 (Dubaï)" },
  { value: 5, label: "GMT+5 (Karachi)" },
  { value: 5.5, label: "GMT+5:30 (Mumbai)" },
  { value: 6, label: "GMT+6 (Dacca)" },
  { value: 7, label: "GMT+7 (Bangkok)" },
  { value: 8, label: "GMT+8 (Pékin, Singapour)" },
  { value: 9, label: "GMT+9 (Tokyo)" },
  { value: 10, label: "GMT+10 (Sydney)" },
  { value: 11, label: "GMT+11" },
  { value: 12, label: "GMT+12 (Auckland)" },
];

export default function ClockWidget({ config }: ClockWidgetProps) {
  const [now, setNow] = useState(new Date());
  const { settings } = useAppSettings();
  const format = config?.format || "24h";
  const showDate = config?.showDate !== false;
  const showSeconds = config?.showSeconds !== false;

  // Use widget-specific gmtOffset, fallback to global setting
  const gmtOffset = config?.gmtOffset !== undefined && config?.gmtOffset !== null
    ? config.gmtOffset
    : settings.default_gmt_offset
      ? parseFloat(settings.default_gmt_offset)
      : undefined;

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute adjusted time based on GMT offset
  const getAdjustedDate = () => {
    if (gmtOffset === undefined || gmtOffset === null) return now;
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + gmtOffset * 3600000);
  };

  const adjusted = getAdjustedDate();

  const hours = format === "12h" ? adjusted.getHours() % 12 || 12 : adjusted.getHours();
  const mins = String(adjusted.getMinutes()).padStart(2, "0");
  const secs = String(adjusted.getSeconds()).padStart(2, "0");
  const ampm = format === "12h" ? (adjusted.getHours() >= 12 ? "PM" : "AM") : "";

  const dateStr = adjusted.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const offsetLabel = gmtOffset !== undefined && gmtOffset !== null
    ? `GMT${gmtOffset >= 0 ? "+" : ""}${gmtOffset % 1 === 0 ? gmtOffset : gmtOffset.toFixed(1).replace(".", ":")}`
    : null;

  const customColor = config?.textColor;
  const textStyle: React.CSSProperties = customColor
    ? { color: customColor, textShadow: config?.transparentBg ? "0 0 8px rgba(0,0,0,0.3)" : undefined }
    : config?.transparentBg
      ? { color: "#1a1a2e", textShadow: "0 0 8px rgba(255,255,255,0.6)" }
      : {};

  return (
    <div
      className={`flex flex-col items-center justify-center h-full w-full p-4 ${config?.transparentBg ? '' : customColor ? '' : 'bg-black/80 text-white'}`}
      style={{ ...(config?.transparentBg || customColor ? textStyle : {}), backgroundColor: !config?.transparentBg && customColor ? 'rgba(0,0,0,0.8)' : undefined }}
    >
      <div className="text-4xl font-bold font-mono tracking-wider">
        {String(hours).padStart(2, "0")}:{mins}
        {showSeconds && <span className="text-2xl opacity-70">:{secs}</span>}
        {ampm && <span className="text-lg ml-2 opacity-70">{ampm}</span>}
      </div>
      {offsetLabel && (
        <p className="text-[10px] opacity-60 mt-0.5 font-mono">{offsetLabel}</p>
      )}
      {showDate && (
        <p className="text-sm opacity-70 mt-2 capitalize">{dateStr}</p>
      )}
    </div>
  );
}
