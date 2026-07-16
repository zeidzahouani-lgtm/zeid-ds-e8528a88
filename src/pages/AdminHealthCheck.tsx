import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, RefreshCw, Activity,
  Database, HardDrive, Tv, ListMusic,
} from "lucide-react";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { Navigate } from "react-router-dom";

type Severity = "ok" | "warn" | "error";
interface Finding {
  category: string;
  target: string;
  severity: Severity;
  message: string;
  detail?: any;
}
interface Report {
  status: Severity;
  counts: { ok: number; warn: number; error: number };
  duration_ms: number;
  timestamp: string;
  findings: Finding[];
}

const CATEGORY_ICONS: Record<string, any> = {
  rls: Database,
  storage: HardDrive,
  screen: Tv,
  screens: Tv,
  playlist: ListMusic,
};

const CATEGORY_LABELS: Record<string, string> = {
  rls: "Sécurité RLS",
  storage: "Stockage",
  screen: "Écrans",
  screens: "Écrans",
  playlist: "Playlists",
};

export default function AdminHealthCheck() {
  const { isGlobalAdmin, isLoading } = useEstablishmentContext();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-muted-foreground">Chargement...</div>;
  if (!isGlobalAdmin) return <Navigate to="/" replace />;

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("admin-health-check", { body: {} });
      if (fnErr) throw fnErr;
      setReport(data as Report);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const grouped = report
    ? report.findings.reduce<Record<string, Finding[]>>((acc, f) => {
        (acc[f.category] ??= []).push(f);
        return acc;
      }, {})
    : {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Health Check
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vérifie RLS, disponibilité des buckets, état des écrans et des playlists assignées.
          </p>
        </div>
        <Button onClick={runCheck} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyse en cours..." : report ? "Relancer l'analyse" : "Lancer l'analyse"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Échec du diagnostic</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {report && <SummaryCard report={report} />}

      {report && Object.entries(grouped).map(([cat, items]) => {
        const Icon = CATEGORY_ICONS[cat] ?? Activity;
        const label = CATEGORY_LABELS[cat] ?? cat;
        const errors = items.filter((f) => f.severity === "error").length;
        const warns = items.filter((f) => f.severity === "warn").length;
        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4" /> {label}
                <span className="ml-auto flex items-center gap-2 text-xs">
                  {errors > 0 && <Badge variant="destructive">{errors} erreur(s)</Badge>}
                  {warns > 0 && <Badge className="bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30">{warns} alerte(s)</Badge>}
                  {errors === 0 && warns === 0 && <Badge className="bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30">OK</Badge>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {items
                  .sort((a, b) => sevOrder(b.severity) - sevOrder(a.severity))
                  .map((f, i) => (
                    <FindingRow key={i} finding={f} />
                  ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!report && !loading && !error && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Clique sur « Lancer l'analyse » pour démarrer les vérifications.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ report }: { report: Report }) {
  const { counts, status, duration_ms, timestamp } = report;
  const color =
    status === "error" ? "border-destructive/50 bg-destructive/5"
    : status === "warn" ? "border-yellow-500/50 bg-yellow-500/5"
    : "border-emerald-500/50 bg-emerald-500/5";
  const label = status === "error" ? "Anomalies critiques détectées"
    : status === "warn" ? "Alertes non bloquantes"
    : "Tous les contrôles sont OK";
  return (
    <Card className={`border-2 ${color}`}>
      <CardContent className="py-4 flex flex-wrap items-center gap-4">
        <SeverityIcon severity={status} size={32} />
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold">{label}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleString()} · {duration_ms} ms
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {counts.ok}</div>
          <div className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-yellow-500" /> {counts.warn}</div>
          <div className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-destructive" /> {counts.error}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 text-sm">
      <SeverityIcon severity={finding.severity} size={16} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-xs text-muted-foreground">{finding.target}</span>
        </div>
        <div className="text-sm">{finding.message}</div>
        {finding.detail && (
          <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
            {typeof finding.detail === "string" ? finding.detail : JSON.stringify(finding.detail)}
          </pre>
        )}
      </div>
    </div>
  );
}

function SeverityIcon({ severity, size = 16 }: { severity: Severity; size?: number }) {
  const s = { height: size, width: size };
  if (severity === "error") return <XCircle style={s} className="text-destructive shrink-0 mt-0.5" />;
  if (severity === "warn") return <AlertTriangle style={s} className="text-yellow-500 shrink-0 mt-0.5" />;
  return <CheckCircle2 style={s} className="text-emerald-500 shrink-0 mt-0.5" />;
}

function sevOrder(s: Severity) {
  return s === "error" ? 3 : s === "warn" ? 2 : 1;
}
