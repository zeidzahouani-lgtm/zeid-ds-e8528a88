import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, LineChart as LineChartIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Area,
  ComposedChart,
} from "recharts";

type Row = {
  created_at: string;
  status: "ready" | "not_ready";
  http_status: number | null;
  checks_ok: number;
  checks_total: number;
  checks: Array<{ name: string; ok: boolean; latency_ms: number; error?: string }>;
};

const CHECK_LABELS: Record<string, string> = {
  database: "Base de données",
  rpc_resolve_player_screen: "Résolution écran",
  rpc_log_player_metric: "Collecte métriques",
  rpc_player_health_snapshot: "Agrégation santé",
};

const CHECK_COLORS: Record<string, string> = {
  database: "hsl(210 90% 55%)",
  rpc_resolve_player_screen: "hsl(150 65% 45%)",
  rpc_log_player_metric: "hsl(35 90% 55%)",
  rpc_player_health_snapshot: "hsl(280 65% 60%)",
};

const RANGES = [
  { value: "1h", label: "1 h", ms: 60 * 60 * 1000 },
  { value: "6h", label: "6 h", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "24 h", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 j", ms: 7 * 24 * 60 * 60 * 1000 },
];

export function ReadinessHistoryChart() {
  const [range, setRange] = useState("24h");
  const rangeMs = RANGES.find((r) => r.value === range)!.ms;

  const { data: rows = [], refetch, isFetching } = useQuery({
    queryKey: ["player-readiness-history", range],
    queryFn: async () => {
      const since = new Date(Date.now() - rangeMs).toISOString();
      const { data, error } = await (supabase as any)
        .from("player_readiness_history")
        .select("created_at,status,http_status,checks_ok,checks_total,checks")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    refetchInterval: 60000,
  });

  const { chartData, checkNames, uptimePct, avgByCheck } = useMemo(() => {
    const names = new Set<string>();
    const sums: Record<string, { total: number; count: number }> = {};
    const points = rows.map((r) => {
      const point: any = {
        ts: new Date(r.created_at).getTime(),
        label: new Date(r.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        ready: r.status === "ready" ? 1 : 0,
        notReadyBand: r.status === "ready" ? 0 : 1,
      };
      for (const c of r.checks ?? []) {
        names.add(c.name);
        point[c.name] = c.latency_ms;
        if (!sums[c.name]) sums[c.name] = { total: 0, count: 0 };
        sums[c.name].total += c.latency_ms;
        sums[c.name].count += 1;
      }
      return point;
    });
    const readyCount = rows.filter((r) => r.status === "ready").length;
    const pct = rows.length ? (readyCount / rows.length) * 100 : 0;
    const avgs = Object.fromEntries(
      Object.entries(sums).map(([k, v]) => [k, Math.round(v.total / Math.max(v.count, 1))]),
    );
    return {
      chartData: points,
      checkNames: Array.from(names),
      uptimePct: pct,
      avgByCheck: avgs as Record<string, number>,
    };
  }, [rows]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <LineChartIcon className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold uppercase tracking-wide">Historique readiness</span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {rows.length} probe(s)
        </Badge>
        <Badge
          variant={uptimePct >= 99 ? "outline" : uptimePct >= 90 ? "secondary" : "destructive"}
          className="text-[10px]"
        >
          Uptime {uptimePct.toFixed(2)}%
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={range === r.value ? "default" : "ghost"}
              onClick={() => setRange(r.value)}
              className="h-7 px-2 text-xs"
            >
              {r.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground p-6 text-center">
          Aucune donnée sur cette période. Les probes se remplissent au fil des appels à
          <code className="font-mono ml-1">/functions/v1/player-ready</code>.
        </div>
      ) : (
        <>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Statut ready / not_ready
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis domain={[0, 1]} ticks={[0, 1]} tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: any, name: any) => {
                    if (name === "ready") return [v === 1 ? "Ready" : "Not ready", "Statut"];
                    return [v, name];
                  }}
                />
                <Area
                  type="stepAfter"
                  dataKey="notReadyBand"
                  fill="hsl(0 84% 60% / 0.25)"
                  stroke="none"
                  isAnimationActive={false}
                />
                <Line
                  type="stepAfter"
                  dataKey="ready"
                  stroke="hsl(142 70% 45%)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Latence par check (ms)
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10 }} width={45} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {checkNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={CHECK_LABELS[name] ?? name}
                    stroke={CHECK_COLORS[name] ?? "hsl(220 10% 50%)"}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {checkNames.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
              {checkNames.map((name) => (
                <div key={name} className="text-xs p-2 rounded-lg bg-muted/40 border border-border/40">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: CHECK_COLORS[name] ?? "hsl(220 10% 50%)" }}
                    />
                    <span className="font-medium truncate">{CHECK_LABELS[name] ?? name}</span>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    Moyenne&nbsp;: <b className="text-foreground">{avgByCheck[name] ?? 0} ms</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
