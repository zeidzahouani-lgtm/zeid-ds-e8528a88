import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Server, Save, Loader2, CheckCircle, XCircle, Zap, Eye, EyeOff, Shield, Inbox, Clock, History, Plus, KeyRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface EmailConfig {
  imap_host: string;
  imap_port: string;
  imap_user: string;
  imap_password: string;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  smtp_tls: boolean;
  from_name: string;
  from_email: string;
  auto_import: boolean;
  auth_method: string;
  oauth_tenant_id: string;
  oauth_client_id: string;
  oauth_client_secret: string;
}

const defaultConfig: EmailConfig = {
  imap_host: "", imap_port: "993", imap_user: "", imap_password: "", imap_tls: true,
  smtp_host: "", smtp_port: "587", smtp_user: "", smtp_password: "", smtp_tls: true,
  from_name: "", from_email: "", auto_import: false,
  auth_method: "basic", oauth_tenant_id: "", oauth_client_id: "", oauth_client_secret: "",
};

interface EmailAction {
  id: string;
  content_id: string | null;
  action_type: string;
  actor_email: string | null;
  details: string | null;
  created_at: string;
}

export default function AdminEmail() {
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"imap" | "smtp" | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showPasswords, setShowPasswords] = useState({ imap: false, smtp: false });
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [repliesResult, setRepliesResult] = useState<{ processed: number; results: any[] } | null>(null);

  const { data: actions = [], refetch: refetchActions } = useQuery({
    queryKey: ["email_actions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("email_actions") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as EmailAction[];
    },
  });

  useEffect(() => {
    loadConfig();
    const channel = supabase
      .channel("email-actions-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "email_actions" }, () => {
        refetchActions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("app_settings" as any)
      .select("key, value")
      .like("key", "email_%" as any) as any;
    if (data?.length) {
      const loaded = { ...defaultConfig };
      data.forEach((r: any) => {
        const key = r.key.replace("email_", "") as keyof EmailConfig;
        if (key in loaded) {
          if (typeof loaded[key] === "boolean") {
            (loaded as any)[key] = r.value === "true";
          } else {
            (loaded as any)[key] = r.value || "";
          }
        }
      });
      setConfig(loaded);
    }
  };

  const upsertSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase
      .from("app_settings" as any).select("id").eq("key", key).single() as any;
    if (existing) {
      await (supabase.from("app_settings") as any).update({ value, updated_at: new Date().toISOString() }).eq("key", key);
    } else {
      await (supabase.from("app_settings") as any).insert({ key, value });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(config);
      await Promise.all(entries.map(([key, value]) =>
        upsertSetting(`email_${key}`, String(value))
      ));
      toast.success("Configuration email sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (type: "imap" | "smtp") => {
    setTesting(type);
    setTestResults(prev => ({ ...prev, [type]: undefined as any }));
    try {
      const { data, error } = await supabase.functions.invoke("test-email", {
        body: { type, config },
      });
      if (error || data?.error) {
        setTestResults(prev => ({ ...prev, [type]: { success: false, message: data?.error || error?.message || "Erreur de connexion" } }));
        toast.error(`Test ${type.toUpperCase()} échoué`);
      } else {
        setTestResults(prev => ({ ...prev, [type]: { success: true, message: data?.message || `Connexion ${type.toUpperCase()} réussie` } }));
        toast.success(`Test ${type.toUpperCase()} réussi !`);
      }
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [type]: { success: false, message: e.message || "Erreur réseau" } }));
      toast.error(`Test ${type.toUpperCase()} échoué`);
    } finally {
      setTesting(null);
    }
  };

  const renderTestResult = (type: string) => {
    const result = testResults[type];
    if (!result) return null;
    return (
      <div className={`flex items-start gap-2 text-xs p-3 rounded-lg mt-3 ${result.success ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
        {result.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
        <span className="normal-case">{result.message}</span>
      </div>
    );
  };

  const actionBadge = (type: string) => {
    if (type === "validation") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Validation</Badge>;
    if (type === "annulation") return <Badge className="bg-destructive/20 text-destructive border-destructive/30">❌ Annulation</Badge>;
    if (type === "réception") return <Badge className="bg-primary/20 text-primary border-primary/30">📩 Réception</Badge>;
    if (type === "renvoi_accusé") return <Badge className="bg-accent/20 text-accent border-accent/30">🔄 Renvoi accusé</Badge>;
    return <Badge variant="outline">{type}</Badge>;
  };

  return (
    <div className="space-y-6 animate-cyber-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">Configuration Email</h1>
          <p className="text-muted-foreground text-sm mt-1 normal-case tracking-normal">
            Configurez les serveurs IMAP et SMTP pour l'import automatique de contenus par email
          </p>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <Switch
            checked={config.auto_import}
            onCheckedChange={async (v) => {
              setConfig({ ...config, auto_import: v });
              await upsertSetting("email_auto_import", String(v));
              toast.success(v ? "Système email activé" : "Système email désactivé");
            }}
          />
          <div className="flex items-center gap-2">
            {config.auto_import ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                <CheckCircle className="h-3 w-3" /> Actif
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3" /> Inactif
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Quick provider presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4 text-primary icon-neon" />
            Configuration rapide — Fournisseur de messagerie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4 normal-case">
            Sélectionnez votre fournisseur pour pré-remplir les paramètres serveur. Vous devrez ensuite entrer votre adresse email et votre mot de passe d'application.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Gmail */}
            <button
              type="button"
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 transition-all text-left group"
              onClick={() => {
                setConfig(prev => ({
                  ...prev,
                  imap_host: "imap.gmail.com",
                  imap_port: "993",
                  imap_tls: true,
                  smtp_host: "smtp.gmail.com",
                  smtp_port: "587",
                  smtp_tls: true,
                }));
                toast.success("Paramètres Gmail pré-remplis. Entrez votre email et mot de passe d'application Google.");
              }}
            >
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/20 transition-colors">
                <Mail className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Gmail</p>
                <p className="text-[11px] text-muted-foreground normal-case">Google — mot de passe d'application requis</p>
              </div>
            </button>

            {/* Microsoft / Outlook (OAuth2) */}
            <button
              type="button"
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 transition-all text-left group"
              onClick={() => {
                setConfig(prev => ({
                  ...prev,
                  imap_host: "outlook.office365.com",
                  imap_port: "993",
                  imap_tls: true,
                  smtp_host: "smtp.office365.com",
                  smtp_port: "587",
                  smtp_tls: true,
                  auth_method: "oauth2",
                }));
                toast.success("Microsoft Exchange sélectionné. Renseignez les identifiants OAuth2 Azure AD ci-dessous.");
              }}
            >
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Microsoft Exchange / Outlook.com</p>
                <p className="text-[11px] text-muted-foreground normal-case">OAuth2 — authentification moderne (recommandé)</p>
              </div>
            </button>

            {/* OVH */}
            <button
              type="button"
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/30 transition-all text-left group"
              onClick={() => {
                setConfig(prev => ({
                  ...prev,
                  imap_host: "ssl0.ovh.net",
                  imap_port: "993",
                  imap_tls: true,
                  smtp_host: "ssl0.ovh.net",
                  smtp_port: "465",
                  smtp_tls: true,
                }));
                toast.success("Paramètres OVH pré-remplis. Entrez votre email et mot de passe OVH.");
              }}
            >
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                <Server className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-sm">OVH</p>
                <p className="text-[11px] text-muted-foreground normal-case">OVH Mail Pro / MX Plan</p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Auth Method */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-primary icon-neon" />
            Méthode d'authentification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type d'authentification</Label>
            <Select value={config.auth_method} onValueChange={v => setConfig({ ...config, auth_method: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basique (mot de passe)</SelectItem>
                <SelectItem value="oauth2">OAuth2 / Microsoft Exchange (authentification moderne)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.auth_method === "oauth2" && (
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Shield className="h-4 w-4" />
                Configuration Azure AD (OAuth2)
              </div>
              <p className="text-xs text-muted-foreground normal-case leading-relaxed">
                Créez une application dans <strong>Azure AD → Inscriptions d'applications</strong>, puis accordez les permissions 
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-[11px]">IMAP.AccessAsApp</code> et 
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-[11px]">SMTP.SendAsApp</code> avec consentement administrateur.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tenant ID</Label>
                  <Input value={config.oauth_tenant_id} onChange={e => setConfig({ ...config, oauth_tenant_id: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client ID</Label>
                  <Input value={config.oauth_client_id} onChange={e => setConfig({ ...config, oauth_client_id: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client Secret</Label>
                  <Input type="password" value={config.oauth_client_secret} onChange={e => setConfig({ ...config, oauth_client_secret: e.target.value })} placeholder="~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground normal-case p-2 rounded bg-muted/50">
                💡 Le mot de passe n'est pas utilisé avec OAuth2. Seuls le Tenant ID, Client ID, Client Secret et l'adresse email sont nécessaires.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* IMAP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-primary icon-neon" />
              Serveur IMAP (réception)
              <Badge variant="outline" className="ml-auto text-[10px]">Réception</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Serveur</Label>
                <Input value={config.imap_host} onChange={e => setConfig({ ...config, imap_host: e.target.value })} placeholder="imap.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Port</Label>
                <Input value={config.imap_port} onChange={e => setConfig({ ...config, imap_port: e.target.value })} placeholder="993" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Utilisateur</Label>
              <Input value={config.imap_user} onChange={e => setConfig({ ...config, imap_user: e.target.value })} placeholder="votre@email.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mot de passe</Label>
              <div className="relative">
                <Input
                  type={showPasswords.imap ? "text" : "password"}
                  value={config.imap_password}
                  onChange={e => setConfig({ ...config, imap_password: e.target.value })}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPasswords(p => ({ ...p, imap: !p.imap }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPasswords.imap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={config.imap_tls} onCheckedChange={v => setConfig({ ...config, imap_tls: v })} />
              <Label className="text-xs flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> TLS/SSL
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleTest("imap")} disabled={testing === "imap" || !config.imap_host} className="w-full gap-2">
              {testing === "imap" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {testing === "imap" ? "Test en cours..." : "Tester la connexion IMAP"}
            </Button>
            {renderTestResult("imap")}
          </CardContent>
        </Card>

        {/* SMTP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-accent icon-neon" />
              Serveur SMTP (envoi)
              <Badge variant="outline" className="ml-auto text-[10px]">Envoi</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Serveur</Label>
                <Input value={config.smtp_host} onChange={e => setConfig({ ...config, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Port</Label>
                <Input value={config.smtp_port} onChange={e => setConfig({ ...config, smtp_port: e.target.value })} placeholder="587" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Utilisateur</Label>
              <Input value={config.smtp_user} onChange={e => setConfig({ ...config, smtp_user: e.target.value })} placeholder="votre@email.com" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mot de passe</Label>
              <div className="relative">
                <Input
                  type={showPasswords.smtp ? "text" : "password"}
                  value={config.smtp_password}
                  onChange={e => setConfig({ ...config, smtp_password: e.target.value })}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPasswords(p => ({ ...p, smtp: !p.smtp }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPasswords.smtp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={config.smtp_tls} onCheckedChange={v => setConfig({ ...config, smtp_tls: v })} />
              <Label className="text-xs flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> TLS/SSL
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleTest("smtp")} disabled={testing === "smtp" || !config.smtp_host} className="w-full gap-2">
              {testing === "smtp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {testing === "smtp" ? "Test en cours..." : "Tester la connexion SMTP"}
            </Button>
            {renderTestResult("smtp")}
          </CardContent>
        </Card>

        {/* General settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-primary icon-neon" />
              Paramètres généraux
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom de l'expéditeur</Label>
                <Input value={config.from_name} onChange={e => setConfig({ ...config, from_name: e.target.value })} placeholder="Mon Affichage Dynamique" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email de l'expéditeur</Label>
                <Input value={config.from_email} onChange={e => setConfig({ ...config, from_email: e.target.value })} placeholder="noreply@mondomaine.com" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Sauvegarde..." : "Sauvegarder la configuration"}
        </Button>
        <Button
          variant="outline"
          disabled={checkingReplies}
          className="gap-2"
          onClick={async () => {
            setCheckingReplies(true);
            setRepliesResult(null);
            try {
              const { data, error } = await supabase.functions.invoke("check-email-replies");
              if (error) throw error;
              setRepliesResult(data);
              if (data?.processed > 0) {
                toast.success(`${data.processed} réponse(s) email traitée(s)`);
              } else {
                toast.info("Aucune nouvelle réponse email");
              }
            } catch (e: any) {
              toast.error("Erreur: " + (e.message || "Impossible de vérifier"));
            } finally {
              setCheckingReplies(false);
            }
          }}
        >
          {checkingReplies ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
          Vérifier les réponses maintenant
        </Button>
      </div>

      {repliesResult && (
        <Card className="p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Résultat de la vérification</h3>
          </div>
          {repliesResult.processed === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune nouvelle réponse à traiter.</p>
          ) : (
            <div className="space-y-2">
              {repliesResult.results?.map((r: any, i: number) => (
                <div key={i} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${r.action === "validate" ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                  {r.action === "validate" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  <span>"{r.title}" → {r.action === "validate" ? "Validé" : "Annulé"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Email Action History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-primary icon-neon" />
            Historique des actions email
            <Badge variant="outline" className="ml-auto text-[10px]">{actions.length} action(s)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune action enregistrée pour le moment.</p>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
                      </TableCell>
                      <TableCell>{actionBadge(a.action_type)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.actor_email || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{a.details || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="p-4 mt-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">Vérification automatique</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Les réponses email sont vérifiées automatiquement toutes les minutes via un cron job. Les réponses contenant "valider" ou "annuler" sont traitées automatiquement.
        </p>
      </Card>
    </div>
  );
}