import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isScreenReallyOnline } from "@/lib/screen-utils";
import { Tv, Wifi, WifiOff, RefreshCw, Clock } from "lucide-react";

interface ScreenRow {
  id: string;
  name: string;
  status: string | null;
  updated_at: string | null;
  player_heartbeat_at: string | null;
  pending_action: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  resync: "Re-synchronisation",
  restart: "Redémarrage",
  shutdown: "Extinction",
};

function relativeTime(iso: string | null) {
  if (!iso) return "Jamais";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "à l'instant";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function ConnectedScreens() {
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  const { data: screens = [], isLoading } = useQuery({
    queryKey: ["connected_screens", currentEstablishmentId, isGlobalAdmin],
    refetchInterval: 10_000,
    queryFn: async (): Promise<ScreenRow[]> => {
      let query = supabase
        .from("screens")
        .select("id, name, status, updated_at, player_heartbeat_at, pending_action")
        .order("name");
      if (currentEstablishmentId) query = query.eq("establishment_id", currentEstablishmentId);
      else if (!isGlobalAdmin) return [];
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ScreenRow[];
    },
  });

  const online = screens.filter((s) => isScreenReallyOnline(s));
  const offline = screens.filter((s) => !isScreenReallyOnline(s));

  const pending = screens
    .map((s) => {
      const reasons: string[] = [];
      if (s.pending_action) reasons.push(ACTION_LABELS[s.pending_action] ?? s.pending_action);
      const hb = s.player_heartbeat_at ? new Date(s.player_heartbeat_at).getTime() : 0;
      const up = s.updated_at ? new Date(s.updated_at).getTime() : 0;
      if (!isScreenReallyOnline(s) && up > hb) reasons.push("Configuration modifiée hors ligne");
      return { screen: s, reasons };
    })
    .filter((p) => p.reasons.length > 0);

  const stats = [
    { label: "Écrans", value: screens.length, icon: Tv, color: "text-primary" },
    { label: "Connectés", value: online.length, icon: Wifi, color: "text-green-500" },
    { label: "Hors ligne", value: offline.length, icon: WifiOff, color: "text-destructive" },
    { label: "Mises à jour en attente", value: pending.length, icon: RefreshCw, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Écrans connectés</h1>
        <p className="text-sm text-muted-foreground">
          Statut en direct de chaque écran, dernière synchronisation et mises à jour en attente.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted/50 ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">État des écrans</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Chargement…</p>
          ) : screens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aucun écran.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Écran</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Dernière synchro</TableHead>
                  <TableHead>En attente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {screens.map((s) => {
                  const isOn = isScreenReallyOnline(s);
                  const p = pending.find((x) => x.screen.id === s.id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <Tv className="h-3.5 w-3.5 text-muted-foreground" />
                        {s.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isOn ? "default" : "secondary"} className="gap-1 text-[10px]">
                          {isOn ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {isOn ? "Connecté" : "Hors ligne"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(s.player_heartbeat_at || s.updated_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p ? (
                          <div className="flex flex-wrap gap-1">
                            {p.reasons.map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">À jour</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-500" /> Mises à jour en attente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tous les écrans sont à jour.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((p) => (
                <li key={p.screen.id} className="flex items-center justify-between text-sm rounded-md bg-muted/40 px-3 py-2">
                  <span className="font-medium">{p.screen.name}</span>
                  <span className="text-xs text-muted-foreground">{p.reasons.join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
