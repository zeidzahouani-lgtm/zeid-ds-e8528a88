import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, ShieldAlert, RefreshCw, CheckCircle2, Download, Activity, HeartPulse, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

type HealthSnapshot = {
  status: "healthy" | "degraded" | "unhealthy";
  errors: { last_5m: number; last_1h: number; last_24h: number; by_type_1h: Record<string, number> };
  latency_1h: { samples: number; avg_ms: number; p95_ms: number };
  screens: { total: number; online: number; offline: number };
  failure_rate_per_screen_1h?: number;
};

type ReadinessCheck = { name: string; ok: boolean; latency_ms: number; error?: string };
type Readiness = {
  status: "ready" | "not_ready";
  timestamp?: string;
  checks?: ReadinessCheck[];
  error?: string;
  httpStatus?: number;
};

const CHECK_LABELS: Record<string, string> = {
  database: "Base de données",
  rpc_resolve_player_screen: "Résolution écran (anon)",
  rpc_log_player_metric: "Collecte des métriques",
  rpc_player_health_snapshot: "Agrégation santé",
};

type PlayerError = {
  id: string;
  screen_key: string | null;
  screen_id: string | null;
  establishment_id: string | null;
  error_type: string;
  message: string | null;
  url: string | null;
  user_agent: string | null;
  resolved: boolean;
  created_at: string;
};

const PERIODS = [
  { value: "1h", label: "Dernière heure", ms: 60 * 60 * 1000 },
  { value: "24h", label: "24 dernières heures", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 derniers jours", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "30 derniers jours", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "Tout l'historique", ms: 0 },
];

const TYPE_LABELS: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" | "default" }> = {
  screen_not_found: { label: "Écran introuvable", variant: "destructive" },
  media_missing: { label: "Média manquant", variant: "destructive" },
  session_blocked: { label: "Session bloquée", variant: "secondary" },
  license_invalid: { label: "Licence invalide", variant: "secondary" },
};

export default function AdminPlayerErrors() {
  const { isGlobalAdmin, isLoading } = useEstablishmentContext();
  const [period, setPeriod] = useState("7d");
  const [errorType, setErrorType] = useState("__all__");
  const [establishmentId, setEstablishmentId] = useState("__all__");
  const [search, setSearch] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const { data: establishments = [] } = useQuery({
    queryKey: ["admin-establishments-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("establishments").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ["player-health"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("player_health_snapshot");
      if (error) throw error;
      return data as HealthSnapshot;
    },
    refetchInterval: 30000,
  });

  const { data: readiness, refetch: refetchReadiness, isFetching: readinessFetching } = useQuery({
    queryKey: ["player-readiness"],
    queryFn: async (): Promise<Readiness> => {
      try {
        const base = (import.meta as any).env?.VITE_SUPABASE_URL;
        const res = await fetch(`${base}/functions/v1/player-ready`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        return { ...body, httpStatus: res.status };
      } catch (err) {
        return { status: "not_ready", error: (err as Error).message };
      }
    },
    refetchInterval: 30000,
  });

  const { data: errors = [], isLoading: loadingErrors, refetch, isRefetching } = useQuery({
    queryKey: ["player-errors", period, errorType, establishmentId, showResolved],
    queryFn: async () => {
      let q = supabase.from("player_errors").select("*").order("created_at", { ascending: false }).limit(500);
      const p = PERIODS.find((x) => x.value === period);
      if (p && p.ms > 0) {
        q = q.gte("created_at", new Date(Date.now() - p.ms).toISOString());
      }
      if (errorType !== "__all__") q = q.eq("error_type", errorType);
      if (establishmentId !== "__all__") {
        if (establishmentId === "__none__") q = q.is("establishment_id", null);
        else q = q.eq("establishment_id", establishmentId);
      }
      if (!showResolved) q = q.eq("resolved", false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PlayerError[];
    },
  });

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => refetch(), 30000);
    return () => clearInterval(t);
  }, [refetch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return errors;
    const s = search.toLowerCase();
    return errors.filter(
      (e) =>
        (e.screen_key ?? "").toLowerCase().includes(s) ||
        (e.message ?? "").toLowerCase().includes(s) ||
        (e.url ?? "").toLowerCase().includes(s),
    );
  }, [errors, search]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const e of errors) byType[e.error_type] = (byType[e.error_type] ?? 0) + 1;
    return { total: errors.length, byType };
  }, [errors]);

  const estName = (id: string | null) => {
    if (!id) return "—";
    return establishments.find((e: any) => e.id === id)?.name ?? id.slice(0, 8);
  };

  const markResolved = async (id: string) => {
    const { error } = await supabase.from("player_errors").update({ resolved: true }).eq("id", id);
    if (error) {
      toast.error("Impossible de marquer résolu");
      return;
    }
    toast.success("Marqué comme résolu");
    refetch();
  };

  const exportCsv = () => {
    const header = ["Date", "Type", "Écran", "Établissement", "Message", "URL", "Résolu"];
    const rows = filtered.map((e) => [
      new Date(e.created_at).toISOString(),
      e.error_type,
      e.screen_key ?? "",
      estName(e.establishment_id),
      (e.message ?? "").replace(/\n/g, " "),
      e.url ?? "",
      e.resolved ? "oui" : "non",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `player-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="text-muted-foreground text-sm">Chargement…</div>;

  if (!isGlobalAdmin) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-semibold">Accès réservé</h2>
        <p className="text-sm text-muted-foreground">
          Seuls les administrateurs globaux peuvent consulter les incidents player.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-blue">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Incidents Player</h1>
            <p className="text-xs text-muted-foreground">
              Surveillance des erreurs de chargement des écrans (écran introuvable, média manquant…)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefetching ? "animate-spin" : ""}`} /> Rafraîchir
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1.5" /> Exporter CSV
          </Button>
        </div>
      </div>

      {health && (
        <Card className="p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className={`h-5 w-5 ${
              health.status === "healthy" ? "text-green-500" :
              health.status === "degraded" ? "text-amber-500" : "text-red-500"
            }`} />
            <span className="text-sm font-semibold uppercase tracking-wide">
              {health.status === "healthy" ? "Système sain" :
               health.status === "degraded" ? "Dégradé" : "Incident majeur"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Écrans en ligne&nbsp;: <b className="text-foreground">{health.screens.online}/{health.screens.total}</b></div>
          <div className="text-xs text-muted-foreground">Erreurs (5 min)&nbsp;: <b className="text-foreground">{health.errors.last_5m}</b></div>
          <div className="text-xs text-muted-foreground">Taux d'échec/écran (1 h)&nbsp;: <b className="text-foreground">{health.failure_rate_per_screen_1h ?? (health.screens.total ? (health.errors.last_1h / health.screens.total).toFixed(2) : 0)}</b></div>
          <div className="text-xs text-muted-foreground">Latence moyenne (1 h)&nbsp;: <b className="text-foreground">{Math.round(Number(health.latency_1h.avg_ms) || 0)} ms</b></div>
          <div className="text-xs text-muted-foreground">p95 latence&nbsp;: <b className="text-foreground">{Math.round(Number(health.latency_1h.p95_ms) || 0)} ms</b> <span className="opacity-60">({health.latency_1h.samples} échant.)</span></div>
          <Button variant="ghost" size="sm" onClick={() => refetchHealth()} className="ml-auto">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Health
          </Button>
        </Card>
      )}

      {readiness && (() => {
        const isReady = readiness.status === "ready";
        const failed = (readiness.checks ?? []).filter((c) => !c.ok);
        return (
          <Card className="p-4">
            <Collapsible defaultOpen={!isReady}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <HeartPulse className={`h-5 w-5 ${isReady ? "text-green-500" : "text-red-500"}`} />
                  <span className="text-sm font-semibold uppercase tracking-wide">
                    {isReady ? "Ready" : "Not ready"}
                  </span>
                  <Badge variant={isReady ? "outline" : "destructive"} className="text-[10px]">
                    {isReady ? "Tous les checks OK" : `${failed.length} check(s) en échec`}
                  </Badge>
                </div>
                {readiness.checks && (
                  <div className="text-xs text-muted-foreground">
                    Checks&nbsp;: <b className="text-foreground">{readiness.checks.length - failed.length}/{readiness.checks.length}</b>
                  </div>
                )}
                {readiness.timestamp && (
                  <div className="text-xs text-muted-foreground">
                    Dernier probe&nbsp;: <b className="text-foreground">{new Date(readiness.timestamp).toLocaleTimeString("fr-FR")}</b>
                  </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => refetchReadiness()} disabled={readinessFetching}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${readinessFetching ? "animate-spin" : ""}`} /> Ready
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="group">
                      <span className="text-xs">Détails</span>
                      <ChevronDown className="h-3.5 w-3.5 ml-1 group-data-[state=open]:hidden" />
                      <ChevronUp className="h-3.5 w-3.5 ml-1 hidden group-data-[state=open]:inline" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent className="mt-3">
                {readiness.error && !readiness.checks && (
                  <div className="text-xs text-destructive font-mono p-2 rounded bg-destructive/10">
                    {readiness.error}
                  </div>
                )}
                {readiness.checks && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Check</TableHead>
                          <TableHead className="w-[100px]">Statut</TableHead>
                          <TableHead className="w-[120px]">Latence</TableHead>
                          <TableHead>Erreur</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {readiness.checks.map((c) => (
                          <TableRow key={c.name} className={c.ok ? "" : "bg-destructive/5"}>
                            <TableCell className="text-xs font-medium">
                              {CHECK_LABELS[c.name] ?? c.name}
                              <div className="text-[10px] text-muted-foreground font-mono">{c.name}</div>
                            </TableCell>
                            <TableCell>
                              {c.ok ? (
                                <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-600">OK</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">Échec</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{c.latency_ms} ms</TableCell>
                            <TableCell className="text-xs text-destructive font-mono max-w-md truncate" title={c.error ?? ""}>
                              {c.error ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {readiness.httpStatus && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    HTTP {readiness.httpStatus} · endpoint <code className="font-mono">/functions/v1/player-ready</code>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })()}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total (période)</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        {Object.entries(stats.byType)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([t, n]) => (
            <Card key={t} className="p-4">
              <div className="text-xs text-muted-foreground">{TYPE_LABELS[t]?.label ?? t}</div>
              <div className="text-2xl font-bold">{n}</div>
            </Card>
          ))}
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Rechercher (écran, message, URL…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={errorType} onValueChange={setErrorType}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([v, cfg]) => (
                <SelectItem key={v} value={v}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={establishmentId} onValueChange={setEstablishmentId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Établissement" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les établissements</SelectItem>
              <SelectItem value="__none__">Sans établissement</SelectItem>
              {establishments.map((e: any) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showResolved ? "default" : "outline"}
            size="sm"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? "Inclut résolus" : "Actifs uniquement"}
          </Button>
          <div className="text-xs text-muted-foreground ml-auto self-center">
            {filtered.length} incident(s)
          </div>
        </div>

        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Écran</TableHead>
                <TableHead>Établissement</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[120px]">Statut</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingErrors && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">Chargement…</TableCell>
                </TableRow>
              )}
              {!loadingErrors && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                    Aucun incident sur cette période 🎉
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((e) => {
                const cfg = TYPE_LABELS[e.error_type] ?? { label: e.error_type, variant: "outline" as const };
                return (
                  <TableRow key={e.id} className={e.resolved ? "opacity-60" : ""}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant as any} className="text-[10px]">{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{e.screen_key ?? "—"}</TableCell>
                    <TableCell className="text-xs">{estName(e.establishment_id)}</TableCell>
                    <TableCell className="text-xs max-w-md">
                      <div className="truncate">{e.message ?? "—"}</div>
                      {e.url && (
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{e.url}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.resolved ? (
                        <Badge variant="outline" className="text-[10px]">Résolu</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Actif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!e.resolved && (
                        <Button variant="ghost" size="sm" onClick={() => markResolved(e.id)} title="Marquer résolu">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
