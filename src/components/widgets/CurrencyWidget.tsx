import { useState, useEffect } from "react";
import { ArrowUpDown, RefreshCw, Wifi, WifiOff } from "lucide-react";

export const POPULAR_CURRENCIES = [
  { code: "USD", label: "Dollar US", flag: "🇺🇸" },
  { code: "EUR", label: "Euro", flag: "🇪🇺" },
  { code: "GBP", label: "Livre Sterling", flag: "🇬🇧" },
  { code: "TND", label: "Dinar Tunisien", flag: "🇹🇳" },
  { code: "MAD", label: "Dirham Marocain", flag: "🇲🇦" },
  { code: "DZD", label: "Dinar Algérien", flag: "🇩🇿" },
  { code: "SAR", label: "Riyal Saoudien", flag: "🇸🇦" },
  { code: "AED", label: "Dirham EAU", flag: "🇦🇪" },
  { code: "JPY", label: "Yen Japonais", flag: "🇯🇵" },
  { code: "CNY", label: "Yuan Chinois", flag: "🇨🇳" },
  { code: "CAD", label: "Dollar Canadien", flag: "🇨🇦" },
  { code: "CHF", label: "Franc Suisse", flag: "🇨🇭" },
  { code: "TRY", label: "Livre Turque", flag: "🇹🇷" },
  { code: "EGP", label: "Livre Égyptienne", flag: "🇪🇬" },
  { code: "LYD", label: "Dinar Libyen", flag: "🇱🇾" },
];

interface CurrencyWidgetProps {
  config?: {
    mode?: "auto" | "manual";
    baseCurrency?: string;
    targetCurrencies?: string[];
    manualRates?: Record<string, number>;
    backgroundColor?: string;
    textColor?: string;
    transparentBg?: boolean;
  };
}

interface RateData {
  code: string;
  rate: number;
  flag: string;
  label: string;
}

export default function CurrencyWidget({ config }: CurrencyWidgetProps) {
  const mode = config?.mode || "auto";
  const baseCurrency = config?.baseCurrency || "EUR";
  const targetCurrencies = config?.targetCurrencies || ["USD", "TND", "GBP"];
  const manualRates = config?.manualRates || {};
  const bgColor = config?.backgroundColor || "#0f172a";
  const textColor = config?.textColor || "#ffffff";
  const transparentBg = config?.transparentBg ?? false;

  const [rates, setRates] = useState<RateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getCurrencyInfo = (code: string) => {
    return POPULAR_CURRENCIES.find((c) => c.code === code) || { code, label: code, flag: "💱" };
  };

  useEffect(() => {
    if (mode === "manual") {
      const manualData: RateData[] = targetCurrencies.map((code) => {
        const info = getCurrencyInfo(code);
        return { code, rate: manualRates[code] || 0, flag: info.flag, label: info.label };
      });
      setRates(manualData);
      setError(null);
      return;
    }

    let cancelled = false;
    const fetchRates = async () => {
      setLoading(true);
      setError(null);
      try {
        const targets = targetCurrencies.join(",");
        const res = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=${baseCurrency}&symbols=${targets}`
        );
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (cancelled) return;
        const fetched: RateData[] = Object.entries(data.rates as Record<string, number>).map(
          ([code, rate]) => {
            const info = getCurrencyInfo(code);
            return { code, rate, flag: info.flag, label: info.label };
          }
        );
        setRates(fetched);
        setLastUpdate(new Date());
      } catch {
        if (!cancelled) setError("Erreur de connexion");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mode, baseCurrency, targetCurrencies.join(","), JSON.stringify(manualRates)]);

  const baseInfo = getCurrencyInfo(baseCurrency);

  return (
    <div
      className="flex flex-col h-full w-full justify-center p-3 overflow-hidden"
      style={{
        backgroundColor: transparentBg ? "transparent" : bgColor,
        color: textColor,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
            Cours de change
          </span>
        </div>
        <div className="flex items-center gap-1">
          {mode === "auto" ? (
            <Wifi className="h-3 w-3 opacity-50" />
          ) : (
            <WifiOff className="h-3 w-3 opacity-50" />
          )}
          {loading && <RefreshCw className="h-3 w-3 animate-spin opacity-50" />}
        </div>
      </div>

      <div className="text-xs font-medium opacity-60 mb-1.5">
        Base: {baseInfo.flag} {baseCurrency}
      </div>

      {error && (
        <div className="text-[10px] text-red-400 mb-1">{error}</div>
      )}

      <div className="flex-1 flex flex-col justify-center gap-1.5 min-h-0">
        {rates.map((r) => (
          <div
            key={r.code}
            className="flex items-center justify-between rounded px-2 py-1"
            style={{ backgroundColor: `${textColor}10` }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{r.flag}</span>
              <span className="text-xs font-medium">{r.code}</span>
            </div>
            <span className="text-sm font-bold tabular-nums">
              {r.rate > 0 ? r.rate.toFixed(r.rate < 10 ? 4 : 2) : "—"}
            </span>
          </div>
        ))}
        {rates.length === 0 && !loading && (
          <div className="text-xs opacity-50 text-center">Aucune devise configurée</div>
        )}
      </div>

      {lastUpdate && mode === "auto" && (
        <div className="text-[9px] opacity-40 mt-1.5 text-right">
          Màj: {lastUpdate.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
