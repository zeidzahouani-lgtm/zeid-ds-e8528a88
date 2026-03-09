import { Cloud, Sun, CloudRain, Snowflake, Wind } from "lucide-react";

interface WeatherWidgetProps {
  config?: {
    city?: string;
    temperature?: number;
    condition?: "sunny" | "cloudy" | "rainy" | "snowy";
  };
}

const icons = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
};

const labels: Record<string, string> = {
  sunny: "Ensoleillé",
  cloudy: "Nuageux",
  rainy: "Pluvieux",
  snowy: "Neigeux",
};

export default function WeatherWidget({ config }: WeatherWidgetProps) {
  const city = config?.city || "Paris";
  const temp = config?.temperature ?? 22;
  const condition = config?.condition || "sunny";
  const Icon = icons[condition] || Sun;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-blue-900 to-blue-700 text-white p-4">
      <Icon className="h-12 w-12 mb-2" />
      <p className="text-3xl font-bold">{temp}°C</p>
      <p className="text-sm opacity-80 mt-1">{labels[condition]}</p>
      <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
        <Wind className="h-3 w-3" /> {city}
      </p>
    </div>
  );
}
