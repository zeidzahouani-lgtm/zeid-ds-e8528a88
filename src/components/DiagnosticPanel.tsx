import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bug, ChevronDown, ChevronUp, Copy, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function DiagnosticPanel() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const {
    currentEstablishmentId,
    memberships,
    isGlobalAdmin,
    isMarketing,
    currentRole,
    isLoading: ctxLoading,
  } = useEstablishmentContext();

  const { data: roles = [] } = useQuery({
    queryKey: ["diag_roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data || []).map((r: any) => r.role);
    },
  });

  const { data: screensDiag, isLoading: screensLoading } = useQuery({
    queryKey: ["diag_screens", user?.id, currentEstablishmentId],
    enabled: !!user && !ctxLoading,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const all = await supabase.from("screens").select("id, name, establishment_id");
      let scoped: typeof all | null = null;
      if (currentEstablishmentId) {
        scoped = await supabase
          .from("screens")
          .select("id, name, establishment_id")
          .eq("establishment_id", currentEstablishmentId);
      }
      return {
        allCount: all.data?.length ?? 0,
        allError: all.error?.message ?? null,
        scopedCount: scoped?.data?.length ?? null,
        scopedError: scoped?.error?.message ?? null,
      };
    },
  });

  const diagnose = (): { level: "ok" | "warn" | "error"; message: string } => {
    if (ctxLoading || screensLoading) return { level: "warn", message: "Chargement du contexte..." };
    if (!user) return { level: "error", message: "Non authentifié — reconnecte-toi." };
    if (screensDiag?.allError)
      return { level: "error", message: `RLS bloque la lecture de screens : ${screensDiag.allError}` };
    if ((screensDiag?.allCount ?? 0) === 0) {
      if (!isGlobalAdmin && memberships.length === 0)
        return {
          level: "error",
          message: "Aucun établissement rattaché à ton compte — RLS filtre tout. Demande à un admin de t'ajouter dans user_establishments.",
        };
      return { level: "warn", message: "Aucun écran n'existe (ou aucun visible via RLS pour ce rôle)." };
    }
    if (currentEstablishmentId && screensDiag?.scopedCount === 0)
      return {
        level: "warn",
        message: `${screensDiag.allCount} écran(s) visibles au total, mais 0 dans l'établissement sélectionné. Change d'établissement ou vérifie screens.establishment_id.`,
      };
    return { level: "ok", message: `${screensDiag?.allCount ?? 0} écran(s) accessible(s) via RLS.` };
  };

  const diag = diagnose();

  const payload = {
    user_id: user?.id,
    email: user?.email,
    global_roles: roles,
    is_global_admin: isGlobalAdmin,
    is_marketing: isMarketing,
    current_establishment_id: currentEstablishmentId,
    current_role: currentRole,
    memberships: memberships.map((m) => ({
      establishment_id: m.establishment_id,
      name: m.establishment?.name,
      role: m.role,
    })),
    screens_visible_total: screensDiag?.allCount,
    screens_visible_scoped: screensDiag?.scopedCount,
    rls_error: screensDiag?.allError,
    diagnosis: diag.message,
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="text-xs text-muted-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Bug className="h-3.5 w-3.5" /> Panneau diagnostic
            <Badge
              variant="outline"
              className={
                diag.level === "ok"
                  ? "text-status-online border-status-online/40"
                  : diag.level === "warn"
                  ? "text-yellow-500 border-yellow-500/40"
                  : "text-destructive border-destructive/40"
              }
            >
              {diag.level === "ok" ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : diag.level === "warn" ? (
                <AlertTriangle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              {diag.level.toUpperCase()}
            </Badge>
          </span>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 text-xs">
          <div className="rounded-lg border p-2 bg-secondary/20">
            <p className="font-medium mb-1">Diagnostic</p>
            <p className="text-muted-foreground">{diag.message}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Row label="User ID" value={user?.id ?? "—"} mono />
            <Row label="Email" value={user?.email ?? "—"} />
            <Row
              label="Rôles globaux"
              value={roles.length ? roles.join(", ") : "aucun"}
            />
            <Row label="Admin global" value={isGlobalAdmin ? "oui" : "non"} />
            <Row label="Rôle courant (établissement)" value={currentRole ?? "—"} />
            <Row label="Établissement sélectionné" value={currentEstablishmentId ?? "aucun (vue globale)"} mono />
            <Row
              label="Établissements rattachés"
              value={memberships.length ? memberships.map((m) => `${m.establishment?.name} (${m.role})`).join(" · ") : "aucun"}
            />
            <Row
              label="Écrans visibles (RLS)"
              value={
                screensLoading
                  ? "…"
                  : `${screensDiag?.allCount ?? 0} au total${
                      currentEstablishmentId ? ` · ${screensDiag?.scopedCount ?? 0} dans l'établissement` : ""
                    }`
              }
            />
            {screensDiag?.allError && (
              <Row label="Erreur RLS" value={screensDiag.allError} />
            )}
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
                toast.success("Diagnostic copié");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copier le rapport
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded border p-2 bg-background/40">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-xs break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
