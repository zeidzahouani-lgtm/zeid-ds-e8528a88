import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatabaseZap, Loader2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type RestoreResults = Record<string, { ok: boolean; count: number; error?: string }>;

export function LoginRestoreButton() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [tablesPayload, setTablesPayload] = useState<Record<string, any[]> | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [results, setResults] = useState<RestoreResults | null>(null);

  // When dialog opens, check whether bootstrap is still allowed
  useEffect(() => {
    if (!open) return;
    setChecking(true);
    setResults(null);
    setTablesPayload(null);
    setFile(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("bootstrap-admin", {
          body: { action: "check" },
        });
        if (error) throw error;
        setHasAdmin(Boolean(data?.has_admin));
      } catch {
        setHasAdmin(null);
      } finally {
        setChecking(false);
      }
    })();
  }, [open]);

  const handleFile = async (f: File | null) => {
    setFile(f);
    setTablesPayload(null);
    setResults(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".json")) {
      toast.error("Sélectionnez un fichier .json");
      return;
    }
    setParsing(true);
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      const payload: Record<string, any[]> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (k.startsWith("_")) continue;
        if (Array.isArray(v)) payload[k] = v;
      }
      const total = Object.values(payload).reduce((s, r) => s + r.length, 0);
      if (total === 0) throw new Error("Aucune donnée à restaurer");
      setTablesPayload(payload);
      toast.success(`${total} lignes détectées dans ${Object.keys(payload).length} tables`);
    } catch (e: any) {
      toast.error("Fichier invalide : " + e.message);
    } finally {
      setParsing(false);
    }
  };

  const launch = async () => {
    if (!tablesPayload) return;
    if (!window.confirm(
      "Restaurer la base de données depuis cette sauvegarde JSON ?\n\n" +
      "Les lignes existantes seront mises à jour (mode upsert).\n" +
      "Cette opération n'est disponible que si aucun compte admin n'existe encore."
    )) return;
    setRestoring(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("restore-backup", {
        body: { tables: tablesPayload, mode: "upsert" },
      });
      if (error) throw error;
      setResults(data?.results || {});
      toast.success("Restauration terminée ✓");
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || String(e)));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="fixed bottom-3 right-3 z-30 h-8 gap-1.5 text-xs text-muted-foreground hover:text-primary backdrop-blur-sm bg-card/40 border border-border/30"
          title="Restaurer la base depuis une sauvegarde JSON"
        >
          <DatabaseZap className="h-3.5 w-3.5" />
          Restaurer DB
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DatabaseZap className="h-4 w-4" />
            Restaurer la base de données
          </DialogTitle>
          <DialogDescription>
            Importez une sauvegarde JSON pour initialiser cette instance.
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Vérification…
          </div>
        ) : hasAdmin ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Restauration désactivée</AlertTitle>
            <AlertDescription>
              Un compte administrateur existe déjà. Pour restaurer, utilisez la page « Sauvegarde »
              une fois connecté.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Disponible uniquement quand aucun admin n'existe encore. Le fichier doit être un export JSON
                généré depuis l'interface « Sauvegarde ».
              </AlertDescription>
            </Alert>

            <label className="block">
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleFile(e.target.files?.[0] || null)}
                disabled={parsing || restoring}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </label>

            {parsing && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Analyse du fichier…
              </p>
            )}

            {tablesPayload && !results && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1 max-h-40 overflow-auto">
                <p className="font-medium text-foreground">Aperçu :</p>
                {Object.entries(tablesPayload).map(([t, rows]) => (
                  <div key={t} className="flex justify-between text-muted-foreground">
                    <span>{t}</span>
                    <span>{rows.length} lignes</span>
                  </div>
                ))}
              </div>
            )}

            {results && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1 max-h-40 overflow-auto">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-online" /> Résultats
                </p>
                {Object.entries(results).map(([t, r]) => (
                  <div key={t} className="flex justify-between">
                    <span className="text-muted-foreground">{t}</span>
                    <span className={r.ok ? "text-status-online" : "text-destructive"}>
                      {r.ok ? `${r.count} ✓` : (r.error || "erreur")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fermer</Button>
          {!hasAdmin && (
            <Button onClick={launch} disabled={!tablesPayload || restoring || parsing}>
              {restoring ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Restauration…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Restaurer</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
