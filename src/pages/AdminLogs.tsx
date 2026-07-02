import { useMemo, useState } from "react";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Download, ShieldAlert } from "lucide-react";

const ACTION_OPTIONS = [
  { value: "", label: "Toutes les actions" },
  { value: "auth.sign_in", label: "Connexion" },
  { value: "auth.sign_out", label: "Déconnexion" },
  { value: "screen.create", label: "Écran — création" },
  { value: "screen.update", label: "Écran — modification" },
  { value: "screen.delete", label: "Écran — suppression" },
  { value: "content.create", label: "Contenu — création" },
  { value: "content.update", label: "Contenu — modification" },
  { value: "content.delete", label: "Contenu — suppression" },
  { value: "playlist.create", label: "Playlist — création" },
  { value: "playlist.delete", label: "Playlist — suppression" },
  { value: "user.create", label: "Utilisateur — création" },
  { value: "user.delete", label: "Utilisateur — suppression" },
  { value: "license.assign", label: "Licence — attribution" },
];

function actionBadge(action: string) {
  if (action.endsWith(".delete")) return "destructive";
  if (action.endsWith(".create")) return "default";
  if (action.startsWith("auth.")) return "secondary";
  return "outline";
}

export default function AdminLogs() {
  const { isGlobalAdmin, isLoading } = useEstablishmentContext();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");

  const { data: logs = [], isLoading: loadingLogs, refetch } = useActivityLogs({ search, action });

  const filtered = useMemo(() => logs, [logs]);

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Chargement…</div>;
  }

  if (!isGlobalAdmin) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-semibold">Accès réservé</h2>
        <p className="text-sm text-muted-foreground">
          Seuls les administrateurs globaux peuvent consulter le journal d'activité.
        </p>
      </Card>
    );
  }

  const exportCsv = () => {
    const header = ["Date", "Utilisateur", "Action", "Entité", "ID", "Description"];
    const rows = filtered.map((l) => [
      new Date(l.created_at).toISOString(),
      l.user_email ?? "",
      l.action,
      l.entity_type ?? "",
      l.entity_id ?? "",
      (l.description ?? "").replace(/\n/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-activite-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow-blue">
            <ScrollText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Journal d'activité</h1>
            <p className="text-xs text-muted-foreground">
              Historique de toutes les actions effectuées sur la plateforme
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Rafraîchir
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1.5" /> Exporter CSV
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Rechercher (email, action, description…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={action || "__all__"} onValueChange={(v) => setAction(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Type d'action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((o) => (
                <SelectItem key={o.value || "__all__"} value={o.value || "__all__"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground ml-auto self-center">
            {filtered.length} entrée(s)
          </div>
        </div>

        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entité</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLogs && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                    Chargement…
                  </TableCell>
                </TableRow>
              )}
              {!loadingLogs && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                    Aucune activité pour le moment.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.user_email ?? <span className="text-muted-foreground italic">anonyme</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionBadge(log.action) as any} className="text-[10px]">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.entity_type ? (
                      <div>
                        <div className="font-medium">{log.entity_type}</div>
                        {log.entity_id && (
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                            {log.entity_id}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-md">
                    <div className="truncate">{log.description ?? "—"}</div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
