import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Mail, Server, Save, Loader2, CheckCircle, XCircle, Zap, Eye, EyeOff, Shield, Inbox, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
}

const defaultConfig: EmailConfig = {
  imap_host: "", imap_port: "993", imap_user: "", imap_password: "", imap_tls: true,
  smtp_host: "", smtp_port: "587", smtp_user: "", smtp_password: "", smtp_tls: true,
  from_name: "", from_email: "", auto_import: false,
};

export default function AdminEmail() {
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"imap" | "smtp" | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showPasswords, setShowPasswords] = useState({ imap: false, smtp: false });

  useEffect(() => {
    loadConfig();
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

  return (
    <div className="space-y-6 animate-cyber-in">
      <div>
        <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">Configuration Email</h1>
        <p className="text-muted-foreground text-sm mt-1 normal-case tracking-normal">
          Configurez les serveurs IMAP et SMTP pour l'import automatique de contenus par email
        </p>
      </div>

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
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <Switch checked={config.auto_import} onCheckedChange={v => setConfig({ ...config, auto_import: v })} />
              <div>
                <Label className="text-sm">Import automatique des pièces jointes</Label>
                <p className="text-[10px] text-muted-foreground normal-case">
                  Les images reçues par email seront automatiquement ajoutées au flux avec le statut "en attente"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Sauvegarde..." : "Sauvegarder la configuration"}
      </Button>
    </div>
  );
}
