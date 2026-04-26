import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck, Loader2, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, KeyRound, Server, UserCog, Eye, EyeOff,
} from "lucide-react";

const SSH_CONFIG_KEY = "screenflow.ssh_deploy_config.v1";
const ADMIN_EMAIL = "screenflow@screenflow.local";
const DEFAULT_PASSWORD = "260390DS";

type CheckResult = {
  auth_user_exists: boolean;
  email_confirmed: boolean;
  has_admin_role: boolean;
  has_profile: boolean;
  can_login: boolean;
  user_id: string | null;
  public_url: string | null;
};

type StatusBadge = "ok" | "missing" | "broken" | "unknown";

export default function FirstAdminLogin() {
  const { isGlobalAdmin } = useEstablishmentContext();

  // SSH config (loaded from localStorage, editable)
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("22");
  const [sshUser, setSshUser] = useState("root");
  const [sshPassword, setSshPassword] = useState("");
  const [sshRemoteDir, setSshRemoteDir] = useState("/opt/screenflow");
  const [showPwd, setShowPwd] = useState(false);

  // State
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SSH_CONFIG_KEY);
      if (!raw) return;
      const c = JSON.parse(raw);
      if (c.sshHost) setSshHost(c.sshHost);
      if (c.sshPort) setSshPort(c.sshPort);
      if (c.sshUser) setSshUser(c.sshUser);
      if (c.sshRemoteDir) setSshRemoteDir(c.sshRemoteDir);
    } catch {}
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Public route: accessible without login to bootstrap the first admin account.

  const getFreshAccessToken = async () => {
    const refreshed = await supabase.auth.refreshSession();
    let session = refreshed.data.session;
    if (!session?.access_token) {
      const fallback = await supabase.auth.getSession();
      session = fallback.data.session;
    }
    if (session?.access_token) return session.access_token;
    toast.error("Session expirée. Reconnectez-vous.");
    window.location.href = "/login";
    return null;
  };

  const validateSsh = () => {
    if (!sshHost.trim() || !sshUser.trim() || !sshPassword) {
      toast.error("Renseignez l'IP, l'utilisateur et le mot de passe SSH du serveur.");
      return false;
    }
    return true;
  };

  const pollJob = async (jobId: string, maxMs = 5 * 60 * 1000): Promise<{
    status: "success" | "error" | "timeout";
    parsed: any;
  }> => {
    const settingsKey = `ssh_deploy_job:${jobId}`;
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, 2500));
      const { data: row } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", settingsKey)
        .maybeSingle();
      if (!row?.value) continue;
      let parsed: any;
      try { parsed = JSON.parse(row.value as string); } catch { continue; }
      if (Array.isArray(parsed.logs)) setLogs(parsed.logs);
      if (parsed.check_result) setResult(parsed.check_result);
      if (parsed.status === "success") return { status: "success", parsed };
      if (parsed.status === "error") return { status: "error", parsed };
    }
    return { status: "timeout", parsed: null };
  };

  const handleCheck = async () => {
    if (!validateSsh()) return;
    setChecking(true);
    setLogs(["🔍 Vérification du compte admin en cours…"]);
    setResult(null);
    setHasChecked(false);
    try {
      const token = await getFreshAccessToken();
      if (!token) return;
      const { data, error } = await supabase.functions.invoke("ssh-deploy", {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: "check_admin_status",
          host: sshHost.trim(),
          port: parseInt(sshPort) || 22,
          username: sshUser.trim(),
          password: sshPassword,
          remote_dir: sshRemoteDir.trim() || "/opt/screenflow",
        },
      });
      if (error) throw error;
      const jobId = data?.job_id as string | undefined;
      if (!jobId) {
        toast.error("Job non démarré");
        return;
      }
      const res = await pollJob(jobId);
      setHasChecked(true);
      if (res.status === "success") {
        toast.success("Vérification terminée");
      } else if (res.status === "error") {
        toast.error("Échec : " + (res.parsed?.error || "inconnu"));
      } else {
        toast.warning("Délai dépassé — consultez les logs.");
      }
    } catch (e: any) {
      setLogs(prev => [...prev, "✗ Erreur: " + (e?.message || String(e))]);
      toast.error("Erreur: " + (e?.message || String(e)));
    } finally {
      setChecking(false);
    }
  };

  const handleRepair = async () => {
    if (!validateSsh()) return;
    if (!window.confirm(
      `Créer ou réparer le compte admin ?\n\n` +
      `Email    : ${ADMIN_EMAIL}\n` +
      `Mot de passe : ${DEFAULT_PASSWORD}\n\n` +
      `Cela va (ré)créer le compte si nécessaire, lui attribuer le rôle admin, ` +
      `et réinitialiser le mot de passe.`
    )) return;

    setRepairing(true);
    setLogs(["🔐 Création / réparation du compte admin en cours…"]);
    try {
      const token = await getFreshAccessToken();
      if (!token) return;
      const { data, error } = await supabase.functions.invoke("ssh-deploy", {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: "reset_admin_password",
          host: sshHost.trim(),
          port: parseInt(sshPort) || 22,
          username: sshUser.trim(),
          password: sshPassword,
          remote_dir: sshRemoteDir.trim() || "/opt/screenflow",
          admin_password: DEFAULT_PASSWORD,
        },
      });
      if (error) throw error;
      const jobId = data?.job_id as string | undefined;
      if (!jobId) {
        toast.error("Job non démarré");
        return;
      }
      const res = await pollJob(jobId);
      if (res.status === "success") {
        toast.success("Compte admin prêt ✓ — Reconnectez-vous depuis l'écran de login.");
        // Re-check status to refresh badges
        setTimeout(() => { void handleCheck(); }, 500);
      } else if (res.status === "error") {
        toast.error("Échec : " + (res.parsed?.error || "inconnu"));
      } else {
        toast.warning("Délai dépassé — consultez les logs.");
      }
    } catch (e: any) {
      setLogs(prev => [...prev, "✗ Erreur: " + (e?.message || String(e))]);
      toast.error("Erreur: " + (e?.message || String(e)));
    } finally {
      setRepairing(false);
    }
  };

  // Derived global status
  const overall: StatusBadge = !hasChecked
    ? "unknown"
    : result?.auth_user_exists && result.has_admin_role && result.has_profile && result.can_login
      ? "ok"
      : !result?.auth_user_exists
        ? "missing"
        : "broken";

  const busy = checking || repairing;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Première connexion admin</h1>
          <p className="text-sm text-muted-foreground">
            Vérifiez et réparez le compte administrateur par défaut sur votre serveur local.
          </p>
        </div>
      </div>

      {/* SSH config card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" /> Serveur cible
          </CardTitle>
          <CardDescription>
            Identifiants SSH du serveur où tourne le Supabase auto-hébergé (pré-remplis si déjà déployé).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>IP / Hôte</Label>
            <Input value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="192.168.1.10" />
          </div>
          <div className="space-y-2">
            <Label>Port SSH</Label>
            <Input value={sshPort} onChange={e => setSshPort(e.target.value)} placeholder="22" />
          </div>
          <div className="space-y-2">
            <Label>Utilisateur</Label>
            <Input value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="root" />
          </div>
          <div className="space-y-2">
            <Label>Mot de passe SSH</Label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                value={sshPassword}
                onChange={e => setSshPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Dossier distant</Label>
            <Input value={sshRemoteDir} onChange={e => setSshRemoteDir(e.target.value)} placeholder="/opt/screenflow" />
          </div>
        </CardContent>
      </Card>

      {/* Check + Repair card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCog className="h-4 w-4" /> Compte administrateur
              </CardTitle>
              <CardDescription className="font-mono text-xs mt-1">{ADMIN_EMAIL}</CardDescription>
            </div>
            <OverallBadge status={overall} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCheck} disabled={busy} variant="outline">
              {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Vérifier l'état
            </Button>
            <Button onClick={handleRepair} disabled={busy}>
              {repairing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Créer / Réparer le compte admin
            </Button>
          </div>

          {hasChecked && result && (
            <>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <CheckRow label="Compte Auth existe" ok={result.auth_user_exists} />
                <CheckRow label="Email confirmé" ok={result.email_confirmed} />
                <CheckRow label="Rôle admin attribué" ok={result.has_admin_role} />
                <CheckRow label="Profil public présent" ok={result.has_profile} />
                <CheckRow
                  label="Login fonctionne (mdp défaut)"
                  ok={result.can_login}
                  hint={!result.can_login && result.auth_user_exists
                    ? "Le compte existe mais le mot de passe n'est pas celui par défaut."
                    : undefined}
                />
                {result.public_url && (
                  <div className="text-xs text-muted-foreground md:col-span-2 truncate">
                    URL publique : <span className="font-mono">{result.public_url}</span>
                  </div>
                )}
              </div>

              {overall === "ok" && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Tout est en ordre</AlertTitle>
                  <AlertDescription>
                    Connectez-vous avec <span className="font-mono">{ADMIN_EMAIL}</span> et le mot de passe{" "}
                    <span className="font-mono">{DEFAULT_PASSWORD}</span> sur l'URL publique.
                  </AlertDescription>
                </Alert>
              )}
              {overall === "missing" && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Compte introuvable</AlertTitle>
                  <AlertDescription>
                    Cliquez sur « Créer / Réparer » pour générer le premier compte admin.
                  </AlertDescription>
                </Alert>
              )}
              {overall === "broken" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Compte incomplet ou cassé</AlertTitle>
                  <AlertDescription>
                    Au moins une vérification a échoué. Cliquez sur « Créer / Réparer » pour tout reconstruire.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Journal d'exécution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs max-h-80 overflow-y-auto space-y-0.5">
              {logs.map((l, i) => (
                <div key={i} className="whitespace-pre-wrap">{l}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CheckRow({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border bg-card">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

function OverallBadge({ status }: { status: StatusBadge }) {
  if (status === "unknown")
    return <Badge variant="outline">Non vérifié</Badge>;
  if (status === "ok")
    return <Badge className="bg-primary text-primary-foreground hover:bg-primary/90"><CheckCircle2 className="h-3 w-3 mr-1" />Opérationnel</Badge>;
  if (status === "missing")
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Manquant</Badge>;
  return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />À réparer</Badge>;
}
