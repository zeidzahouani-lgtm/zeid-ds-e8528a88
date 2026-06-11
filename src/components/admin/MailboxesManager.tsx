import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Inbox, Plus, Zap, Loader2, CheckCircle, XCircle, Trash2, Shield, Mail, Cloud } from "lucide-react";
import { toast } from "sonner";

interface Mailbox {
  id: string;
  label: string;
  protocol: "imap" | "pop3";
  host: string;
  port: number;
  username: string;
  password: string | null;
  use_tls: boolean;
  is_active: boolean;
  last_test_at: string | null;
  last_test_success: boolean | null;
  last_test_message: string | null;
  auth_method: string | null;
  oauth_tenant_id: string | null;
  oauth_client_id: string | null;
  oauth_client_secret: string | null;
  provider: string | null;
}

type Mode = "manual" | "office365";

const empty = {
  label: "",
  protocol: "imap" as "imap" | "pop3",
  host: "",
  port: 993,
  username: "",
  password: "",
  use_tls: true,
  // OAuth2 / Office 365
  oauth_tenant_id: "",
  oauth_client_id: "",
  oauth_client_secret: "",
};

export default function MailboxesManager() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("manual");
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await (supabase.from("email_mailboxes" as any) as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Impossible de charger les boîtes");
      return;
    }
    setMailboxes((data || []) as Mailbox[]);
  };

  useEffect(() => { load(); }, []);

  const handleProtocolChange = (p: "imap" | "pop3") => {
    setForm(f => ({ ...f, protocol: p, port: p === "imap" ? 993 : 995 }));
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === "office365") {
      setForm(f => ({
        ...f,
        protocol: "imap",
        host: "outlook.office365.com",
        port: 993,
        use_tls: true,
      }));
    } else {
      setForm(f => ({ ...f, host: "", port: f.protocol === "imap" ? 993 : 995 }));
    }
  };

  const handleCreate = async () => {
    if (mode === "office365") {
      if (!form.label || !form.username || !form.oauth_tenant_id || !form.oauth_client_id || !form.oauth_client_secret) {
        toast.error("Libellé, email, Tenant ID, Client ID et Client Secret requis");
        return;
      }
    } else {
      if (!form.label || !form.host || !form.username) {
        toast.error("Libellé, serveur et utilisateur requis");
        return;
      }
    }
    setSaving(true);
    const payload: any = {
      label: form.label,
      protocol: form.protocol,
      host: form.host,
      port: Number(form.port),
      username: form.username,
      password: mode === "office365" ? null : (form.password || null),
      use_tls: form.use_tls,
      is_active: false,
      auth_method: mode === "office365" ? "oauth2" : "basic",
      provider: mode === "office365" ? "office365" : "custom",
      oauth_tenant_id: mode === "office365" ? form.oauth_tenant_id : null,
      oauth_client_id: mode === "office365" ? form.oauth_client_id : null,
      oauth_client_secret: mode === "office365" ? form.oauth_client_secret : null,
    };
    const { error } = await (supabase.from("email_mailboxes" as any) as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Boîte ajoutée");
    setForm({ ...empty });
    setMode("manual");
    setOpen(false);
    load();
  };

  const toggleActive = async (mb: Mailbox, v: boolean) => {
    const { error } = await (supabase.from("email_mailboxes" as any) as any)
      .update({ is_active: v }).eq("id", mb.id);
    if (error) { toast.error(error.message); return; }
    setMailboxes(prev => prev.map(m => m.id === mb.id ? { ...m, is_active: v } : m));
    toast.success(v ? "Boîte activée" : "Boîte désactivée");
  };

  const remove = async (mb: Mailbox) => {
    if (!confirm(`Supprimer "${mb.label}" ?`)) return;
    const { error } = await (supabase.from("email_mailboxes" as any) as any).delete().eq("id", mb.id);
    if (error) { toast.error(error.message); return; }
    setMailboxes(prev => prev.filter(m => m.id !== mb.id));
    toast.success("Boîte supprimée");
  };

  const testMailbox = async (mb: Mailbox) => {
    setTestingId(mb.id);
    try {
      const isOauth = mb.auth_method === "oauth2";
      const cfg: any = mb.protocol === "imap"
        ? { imap_host: mb.host, imap_port: String(mb.port), imap_user: mb.username, imap_password: mb.password, auth_method: isOauth ? "oauth2" : "basic" }
        : { pop_host: mb.host, pop_port: String(mb.port), pop_user: mb.username, pop_password: mb.password };
      if (isOauth) {
        cfg.oauth_tenant_id = mb.oauth_tenant_id;
        cfg.oauth_client_id = mb.oauth_client_id;
        cfg.oauth_client_secret = mb.oauth_client_secret;
      }
      const { data, error } = await supabase.functions.invoke("test-email", {
        body: { type: mb.protocol, config: cfg },
      });
      const success = !!data?.success && !error;
      const message = data?.message || data?.error || error?.message || "Erreur inconnue";
      await (supabase.from("email_mailboxes" as any) as any).update({
        last_test_at: new Date().toISOString(),
        last_test_success: success,
        last_test_message: message,
      }).eq("id", mb.id);
      setMailboxes(prev => prev.map(m => m.id === mb.id ? { ...m, last_test_at: new Date().toISOString(), last_test_success: success, last_test_message: message } : m));
      success ? toast.success(`Test ${mb.protocol.toUpperCase()} réussi`) : toast.error(`Test ${mb.protocol.toUpperCase()} échoué`);
    } catch (e: any) {
      toast.error(e.message || "Erreur réseau");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Inbox className="h-4 w-4 text-primary icon-neon" />
          Boîtes IMAP / POP / Office 365
          <Badge variant="outline" className="ml-2 text-[10px]">{mailboxes.length}</Badge>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ ...empty }); setMode("manual"); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="ml-auto gap-2"><Plus className="h-4 w-4" /> Ajouter une boîte</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nouvelle boîte de réception</DialogTitle>
              </DialogHeader>

              <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="manual" className="gap-2"><Mail className="h-4 w-4" /> IMAP / POP</TabsTrigger>
                  <TabsTrigger value="office365" className="gap-2"><Cloud className="h-4 w-4" /> Office 365</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-3 mt-4">
                  <div className="space-y-2">
                    <Label>Libellé</Label>
                    <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ex: Contact, Support, Ventes…" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Protocole</Label>
                      <Select value={form.protocol} onValueChange={(v) => handleProtocolChange(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="imap">IMAP</SelectItem>
                          <SelectItem value="pop3">POP3</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Serveur</Label>
                    <Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder={form.protocol === "imap" ? "imap.exemple.com" : "pop.exemple.com"} />
                  </div>
                  <div className="space-y-2">
                    <Label>Utilisateur</Label>
                    <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="user@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe</Label>
                    <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.use_tls} onCheckedChange={v => setForm({ ...form, use_tls: v })} />
                    <Label className="flex items-center gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> TLS/SSL</Label>
                  </div>
                </TabsContent>

                <TabsContent value="office365" className="space-y-3 mt-4">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 text-[11px] text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Connexion Microsoft 365 (OAuth2)</p>
                    <p>1. Créez une application dans Microsoft Entra (Azure AD).</p>
                    <p>2. Activez l'API <span className="font-mono">https://outlook.office365.com/.default</span>.</p>
                    <p>3. Générez un Client Secret puis copiez le Tenant ID / Client ID / Client Secret ci-dessous.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Libellé</Label>
                    <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ex: Boîte Office 365" />
                  </div>
                  <div className="space-y-2">
                    <Label>Adresse email</Label>
                    <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="user@votredomaine.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tenant ID</Label>
                    <Input value={form.oauth_tenant_id} onChange={e => setForm({ ...form, oauth_tenant_id: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client ID (Application ID)</Label>
                    <Input value={form.oauth_client_id} onChange={e => setForm({ ...form, oauth_client_id: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input type="password" value={form.oauth_client_secret} onChange={e => setForm({ ...form, oauth_client_secret: e.target.value })} placeholder="••••••••••••" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Serveur IMAP</Label>
                      <Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Ajouter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mailboxes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune boîte additionnelle. Cliquez sur "Ajouter une boîte" pour brancher un compte IMAP, POP ou Office 365.
          </p>
        ) : (
          <div className="space-y-3">
            {mailboxes.map(mb => (
              <div key={mb.id} className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-lg border border-border bg-secondary/30">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {mb.provider === "office365" ? <Cloud className="h-5 w-5 text-primary" /> : <Mail className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{mb.label}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">{mb.protocol}</Badge>
                      {mb.provider === "office365" && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Office 365</Badge>
                      )}
                      {mb.auth_method === "oauth2" && (
                        <Badge variant="outline" className="text-[10px]">OAuth2</Badge>
                      )}
                      {mb.is_active
                        ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] gap-1"><CheckCircle className="h-3 w-3" /> Active</Badge>
                        : <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> Inactive</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate normal-case">
                      {mb.username} @ {mb.host}:{mb.port} {mb.use_tls && "· TLS"}
                    </p>
                    {mb.last_test_at && (
                      <p className={`text-[11px] mt-1 ${mb.last_test_success ? "text-green-400" : "text-destructive"}`}>
                        Dernier test: {mb.last_test_success ? "✅" : "❌"} {mb.last_test_message?.slice(0, 120)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={mb.is_active} onCheckedChange={(v) => toggleActive(mb, v)} />
                  <Button variant="outline" size="sm" onClick={() => testMailbox(mb)} disabled={testingId === mb.id} className="gap-1">
                    {testingId === mb.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Tester
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(mb)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
