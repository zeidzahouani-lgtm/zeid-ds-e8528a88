import { Cloud, Sun, CloudRain, Snowflake, Wind, MapPin } from "lucide-react";

interface WeatherWidgetProps {
  config?: {
    city?: string;
    country?: string;
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

export const COUNTRY_LIST = [
  { code: "MA", name: "Maroc", flag: "🇲🇦" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "US", name: "États-Unis", flag: "🇺🇸" },
  { code: "GB", name: "Royaume-Uni", flag: "🇬🇧" },
  { code: "DE", name: "Allemagne", flag: "🇩🇪" },
  { code: "ES", name: "Espagne", flag: "🇪🇸" },
  { code: "IT", name: "Italie", flag: "🇮🇹" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "BE", name: "Belgique", flag: "🇧🇪" },
  { code: "CH", name: "Suisse", flag: "🇨🇭" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "DZ", name: "Algérie", flag: "🇩🇿" },
  { code: "TN", name: "Tunisie", flag: "🇹🇳" },
  { code: "EG", name: "Égypte", flag: "🇪🇬" },
  { code: "SA", name: "Arabie Saoudite", flag: "🇸🇦" },
  { code: "AE", name: "Émirats Arabes Unis", flag: "🇦🇪" },
  { code: "TR", name: "Turquie", flag: "🇹🇷" },
  { code: "JP", name: "Japon", flag: "🇯🇵" },
  { code: "CN", name: "Chine", flag: "🇨🇳" },
  { code: "IN", name: "Inde", flag: "🇮🇳" },
  { code: "BR", name: "Brésil", flag: "🇧🇷" },
  { code: "AU", name: "Australie", flag: "🇦🇺" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
];

export default function WeatherWidget({ config }: WeatherWidgetProps) {
  const city = config?.city || "Paris";
  const country = config?.country || "FR";
  const temp = config?.temperature ?? 22;
  const condition = config?.condition || "sunny";
  const Icon = icons[condition] || Sun;
  const countryInfo = COUNTRY_LIST.find((c) => c.code === country);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-blue-900 to-blue-700 text-white p-4">
      <Icon className="h-12 w-12 mb-2" />
      <p className="text-3xl font-bold">{temp}°C</p>
      <p className="text-sm opacity-80 mt-1">{labels[condition]}</p>
      <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
        <MapPin className="h-3 w-3" /> {city}{countryInfo ? `, ${countryInfo.flag}` : ""}
      </p>
    </div>
  );
}
