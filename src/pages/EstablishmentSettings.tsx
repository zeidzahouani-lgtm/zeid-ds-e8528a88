import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, AtSign, Sparkles, Palette, Save, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useEstablishmentSettings } from "@/hooks/useEstablishmentSettings";
import BrandingTab from "@/components/settings/BrandingTab";

export default function EstablishmentSettings() {
  const { currentEstablishmentId, isEstablishmentAdmin, isMarketing, memberships } = useEstablishmentContext();
  const { settings, isLoading, getSetting, upsertSetting } = useEstablishmentSettings();

  const currentEst = memberships.find(m => m.establishment_id === currentEstablishmentId);

  // Email & AI local state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("");
  const [imapUser, setImapUser] = useState("");
  const [imapPass, setImapPass] = useState("");
  const [aiProvider, setAiProvider] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (!loaded && settings.length > 0) {
    setSmtpHost(getSetting("email_smtp_host") || "");
    setSmtpPort(getSetting("email_smtp_port") || "");
    setSmtpUser(getSetting("email_smtp_user") || "");
    setSmtpPass(getSetting("email_smtp_pass") || "");
    setImapHost(getSetting("email_imap_host") || "");
    setImapPort(getSetting("email_imap_port") || "");
    setImapUser(getSetting("email_imap_user") || "");
    setImapPass(getSetting("email_imap_pass") || "");
    setAiProvider(getSetting("ai_provider") || "");
    setAiApiKey(getSetting("ai_api_key") || "");
    setLoaded(true);
  }

  if (!currentEstablishmentId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">Sélectionnez un établissement</p>
      </div>
    );
  }

  if (isMarketing && !isEstablishmentAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Settings className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">Accès restreint</p>
        <p className="text-sm">Les utilisateurs marketing n'ont pas accès à la personnalisation de l'établissement.</p>
      </div>
    );
  }

  // All establishment members can access settings (not just admins)

  const saveMultiple = async (pairs: { key: string; value: string }[]) => {
    try {
      for (const pair of pairs) {
        await upsertSetting.mutateAsync(pair);
      }
      // Sync brand_logo_url -> establishments.logo_url (single source of truth)
      const logoPair = pairs.find(p => p.key === "brand_logo_url");
      if (logoPair && currentEstablishmentId) {
        await supabase
          .from("establishments")
          .update({ logo_url: logoPair.value || null, updated_at: new Date().toISOString() })
          .eq("id", currentEstablishmentId);
      }
      toast({ title: "Configuration sauvegardée" });
    } catch {
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" /> Configuration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Paramètres de <Badge variant="outline" className="ml-1">{currentEst?.establishment.name}</Badge>
        </p>
      </div>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="branding" className="gap-2"><Palette className="h-4 w-4" /> Branding</TabsTrigger>
          <TabsTrigger value="email" className="gap-2"><AtSign className="h-4 w-4" /> Email</TabsTrigger>
          <TabsTrigger value="ai" className="gap-2"><Sparkles className="h-4 w-4" /> IA</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingTab getSetting={getSetting} saveMultiple={saveMultiple} settings={settings} />
        </TabsContent>

        <TabsContent value="email">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">SMTP (envoi)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><label className="text-sm font-medium">Hôte</label><Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.example.com" className="mt-1" /></div>
                <div><label className="text-sm font-medium">Port</label><Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="465" className="mt-1" /></div>
                <div><label className="text-sm font-medium">Utilisateur</label><Input value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="user@example.com" className="mt-1" /></div>
                <div><label className="text-sm font-medium">Mot de passe</label><Input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} className="mt-1" /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">IMAP (réception)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><label className="text-sm font-medium">Hôte</label><Input value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder="imap.example.com" className="mt-1" /></div>
                <div><label className="text-sm font-medium">Port</label><Input value={imapPort} onChange={e => setImapPort(e.target.value)} placeholder="993" className="mt-1" /></div>
                <div><label className="text-sm font-medium">Utilisateur</label><Input value={imapUser} onChange={e => setImapUser(e.target.value)} placeholder="user@example.com" className="mt-1" /></div>
                <div><label className="text-sm font-medium">Mot de passe</label><Input type="password" value={imapPass} onChange={e => setImapPass(e.target.value)} className="mt-1" /></div>
              </CardContent>
            </Card>
          </div>
          <Button className="mt-4" onClick={() => saveMultiple([
            { key: "email_smtp_host", value: smtpHost }, { key: "email_smtp_port", value: smtpPort },
            { key: "email_smtp_user", value: smtpUser }, { key: "email_smtp_pass", value: smtpPass },
            { key: "email_imap_host", value: imapHost }, { key: "email_imap_port", value: imapPort },
            { key: "email_imap_user", value: imapUser }, { key: "email_imap_pass", value: imapPass },
          ])}><Save className="h-4 w-4 mr-2" /> Sauvegarder la config email</Button>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader><CardTitle className="text-base">Configuration IA</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><label className="text-sm font-medium">Fournisseur</label><Input value={aiProvider} onChange={e => setAiProvider(e.target.value)} placeholder="openai, gemini, ou default" className="mt-1" /></div>
              <div><label className="text-sm font-medium">Clé API</label><Input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder="sk-..." className="mt-1" /></div>
              <Button onClick={() => saveMultiple([{ key: "ai_provider", value: aiProvider }, { key: "ai_api_key", value: aiApiKey }])}><Save className="h-4 w-4 mr-2" /> Sauvegarder</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
