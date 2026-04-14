import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain, Snowflake, Wind, MapPin, Loader2, CloudDrizzle, CloudLightning, CloudFog, Cloudy } from "lucide-react";

interface WeatherWidgetProps {
  config?: {
    city?: string;
    country?: string;
    temperature?: number;
    condition?: "sunny" | "cloudy" | "rainy" | "snowy";
    useRealtime?: boolean;
    transparentBg?: boolean;
    textColor?: string;
  };
}

const icons = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
  drizzle: CloudDrizzle,
  storm: CloudLightning,
  fog: CloudFog,
  partly_cloudy: Cloudy,
};

const labels: Record<string, string> = {
  sunny: "Ensoleillé",
  cloudy: "Nuageux",
  rainy: "Pluvieux",
  snowy: "Neigeux",
  drizzle: "Bruine",
  storm: "Orageux",
  fog: "Brumeux",
  partly_cloudy: "Partiellement nuageux",
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

// Map WMO weather codes to conditions
function wmoToCondition(code: number): string {
  if (code === 0 || code === 1) return "sunny";
  if (code === 2) return "partly_cloudy";
  if (code === 3) return "cloudy";
  if (code >= 45 && code <= 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rainy";
  if (code >= 71 && code <= 77) return "snowy";
  if (code >= 80 && code <= 82) return "rainy";
  if (code >= 85 && code <= 86) return "snowy";
  if (code >= 95 && code <= 99) return "storm";
  return "cloudy";
}

interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed: number;
  humidity: number;
}

export default function WeatherWidget({ config }: WeatherWidgetProps) {
  const city = config?.city || "Paris";
  const country = config?.country || "FR";
  const useRealtime = config?.useRealtime !== false;
  const countryInfo = COUNTRY_LIST.find((c) => c.code === country);

  const [realtime, setRealtime] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!useRealtime) {
      setRealtime(null);
      return;
    }

    let cancelled = false;

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        // Geocode city
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`
        );
        const geoData = await geoRes.json();
        if (!geoData.results?.length) {
          throw new Error("Ville introuvable");
        }
        const { latitude, longitude } = geoData.results[0];

        // Fetch weather
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
        );
        const weatherData = await weatherRes.json();

        if (!cancelled) {
          setRealtime({
            temperature: Math.round(weatherData.current.temperature_2m),
            condition: wmoToCondition(weatherData.current.weather_code),
            windSpeed: Math.round(weatherData.current.wind_speed_10m),
            humidity: weatherData.current.relative_humidity_2m,
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Erreur météo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWeather();
    // Refresh every 10 minutes
    const interval = setInterval(fetchWeather, 600000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [city, useRealtime]);

  const temp = realtime?.temperature ?? config?.temperature ?? 22;
  const condition = realtime?.condition || config?.condition || "sunny";
  const Icon = icons[condition as keyof typeof icons] || Sun;

  const customColor = config?.textColor;
  const textStyle: React.CSSProperties = customColor
    ? { color: customColor, textShadow: config?.transparentBg ? "0 0 8px rgba(0,0,0,0.3)" : undefined }
    : config?.transparentBg
      ? { color: "#1a1a2e", textShadow: "0 0 8px rgba(255,255,255,0.6)" }
      : {};

  return (
    <div
      className={`flex flex-col items-center justify-center h-full w-full p-4 relative ${config?.transparentBg ? '' : customColor ? '' : 'bg-gradient-to-br from-blue-900 to-blue-700 text-white'}`}
      style={{ ...(config?.transparentBg || customColor ? textStyle : {}), backgroundColor: !config?.transparentBg && customColor ? 'hsl(220 60% 20%)' : undefined }}
    >
      {loading && !realtime && (
        <Loader2 className="h-8 w-8 animate-spin opacity-60" />
      )}
      {error && (
        <p className="text-[10px] text-red-500 absolute top-1 left-1">{error}</p>
      )}
      {useRealtime && realtime && (
        <div className="absolute top-1 right-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="Temps réel" />
        </div>
      )}
      <Icon className="h-12 w-12 mb-2" />
      <p className="text-3xl font-bold">{temp}°C</p>
      <p className="text-sm opacity-80 mt-1">{labels[condition] || condition}</p>
      {realtime && (
        <div className="flex items-center gap-3 mt-1 text-[10px] opacity-70">
          <span className="flex items-center gap-0.5"><Wind className="h-2.5 w-2.5" /> {realtime.windSpeed} km/h</span>
          <span>💧 {realtime.humidity}%</span>
        </div>
      )}
      <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
        <MapPin className="h-3 w-3" /> {city}{countryInfo ? `, ${countryInfo.flag}` : ""}
      </p>
    </div>
  );
}
