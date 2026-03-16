import { useEffect, useState } from "react";
import {
  Mail, CheckCircle2, XCircle, Clock, Play, Trash2, Eye, Loader2, Copy, ExternalLink, RefreshCw, Pencil, Inbox, Paperclip, ArrowRight, Image as ImageIcon, Send, KeyRound, Plus, Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContents, Content } from "@/hooks/useContents";
import { useScreens } from "@/hooks/useScreens";
import { useInboxEmails, InboxEmail } from "@/hooks/useInboxEmails";
import { ManualContentForm } from "@/components/autoflow/ManualContentForm";
import { EditContentDialog } from "@/components/autoflow/EditContentDialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: Clock },
  scheduled: { label: "Programmé", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Clock },
  active: { label: "Actif", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: Play },
  rejected: { label: "Rejeté", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AutoFlow() {
  const { contents, isLoading, updateStatus, deleteContent, subscribeRealtime } = useContents();
  const { screens } = useScreens();
  const { emails, isLoading: inboxLoading, subscribeRealtime: subscribeInbox } = useInboxEmails();
  const queryClient = useQueryClient();
  const [accessCodes, setAccessCodes] = useState<any[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [addingCode, setAddingCode] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [preview, setPreview] = useState<Content | null>(null);
  const [editContent, setEditContent] = useState<Content | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const [checkingInbox, setCheckingInbox] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<InboxEmail | null>(null);
  const [activeTab, setActiveTab] = useState("contents");
  const [resendingAck, setResendingAck] = useState<string | null>(null);

  const handleResendAck = async (c: Content) => {
    setResendingAck(c.id);
    try {
      const { data, error } = await supabase.functions.invoke("resend-ack", {
        body: { content_id: c.id },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erreur lors du renvoi");
      } else {
        toast.success(data?.message || "Accusé de réception renvoyé");
      }
    } catch (e: any) {
      toast.error("Erreur: " + (e.message || "Impossible de renvoyer"));
    } finally {
      setResendingAck(null);
    }
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, email, display_name").order("email");
    setProfiles(data || []);
  };

  useEffect(() => {
    const unsub1 = subscribeRealtime();
    const unsub2 = subscribeInbox();
    loadAccessCodes();
    loadProfiles();
    return () => { unsub1(); unsub2(); };
  }, []);

  const loadAccessCodes = async () => {
    const { data } = await (supabase.from("access_codes") as any).select("*").order("created_at", { ascending: false });
    setAccessCodes(data || []);
  };

  const handleAddCode = async () => {
    if (!newCode.trim() || !newUserName.trim()) return;
    setAddingCode(true);
    try {
      const insertData: any = {
        code: newCode.trim().toUpperCase(),
        user_name: newUserName.trim(),
      };
      if (newUserId && newUserId !== "none") insertData.user_id = newUserId;
      const { error } = await (supabase.from("access_codes") as any).insert(insertData);
      if (error) throw error;
      toast.success("Code d'accès créé");
      setNewCode("");
      setNewUserName("");
      setNewUserId("");
      loadAccessCodes();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setAddingCode(false);
    }
  };

  const toggleCode = async (id: string, isActive: boolean) => {
    await (supabase.from("access_codes") as any).update({ is_active: !isActive }).eq("id", id);
    loadAccessCodes();
  };

  const deleteCode = async (id: string) => {
    await (supabase.from("access_codes") as any).delete().eq("id", id);
    loadAccessCodes();
    toast.success("Code supprimé");
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/content-webhook`;

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    toast.success("URL du webhook copiée !");
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const filtered = filter === "all" ? contents : contents.filter(c => c.status === filter);

  const handleApprove = (c: Content) => {
    updateStatus.mutate({ id: c.id, status: "active" }, { onSuccess: () => toast.success("Contenu approuvé et activé") });
  };
  const handleReject = (c: Content) => {
    updateStatus.mutate({ id: c.id, status: "rejected" }, { onSuccess: () => toast.success("Contenu rejeté") });
  };
  const handleSchedule = (c: Content) => {
    updateStatus.mutate({ id: c.id, status: "scheduled" }, { onSuccess: () => toast.success("Contenu programmé") });
  };
  const handleDelete = (c: Content) => {
    deleteContent.mutate(c.id, { onSuccess: () => toast.success("Contenu supprimé") });
  };

  const getScreenName = (screenId: string | null) => {
    if (!screenId) return "Aucun";
    const s = screens?.find((s: any) => s.id === screenId);
    return s?.name || screenId.slice(0, 8);
  };

  const handleCheckInbox = async () => {
    setCheckingInbox(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-inbox");
      if (error) throw error;
      if (data?.imported > 0) {
        toast.success(`${data.imported} contenu(s) importé(s) depuis ${data.total} email(s)`);
      } else if (data?.total > 0) {
        toast.info(`${data.total} email(s) récupéré(s), aucune image à importer`);
      } else {
        toast.info("Aucun nouvel email");
      }
      queryClient.invalidateQueries({ queryKey: ["inbox_emails"] });
      queryClient.invalidateQueries({ queryKey: ["contents"] });
    } catch (e: any) {
      toast.error("Erreur: " + (e.message || "Impossible de vérifier la boîte mail"));
    } finally {
      setCheckingInbox(false);
    }
  };

  const handleImportAsContent = async (email: InboxEmail) => {
    if (!email.attachment_urls?.length) {
      toast.error("Cet email n'a aucune pièce jointe image");
      return;
    }
    try {
      const { error } = await (supabase.from("contents") as any).insert({
        image_url: email.attachment_urls[0],
        title: email.subject || `Email de ${email.from_name || email.from_email}`,
        status: "pending",
        source: "email",
        sender_email: email.from_email,
      });
      if (error) throw error;
      await (supabase.from("inbox_emails") as any).update({ is_processed: true }).eq("id", email.id);
      toast.success("Contenu importé avec succès");
      queryClient.invalidateQueries({ queryKey: ["contents"] });
      queryClient.invalidateQueries({ queryKey: ["inbox_emails"] });
    } catch (e: any) {
      toast.error("Erreur: " + e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Mail className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Flux Automatique</h1>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Recevez et gérez les contenus envoyés par email ou webhook
      </p>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="contents" className="gap-2">
            <Play className="h-4 w-4" />
            Contenus ({contents.length})
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-2">
            <Inbox className="h-4 w-4" />
            Boîte de réception ({emails.length})
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Codes d'accès ({accessCodes.length})
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: CONTENUS ===== */}
        <TabsContent value="contents">
          {/* Webhook URL */}
          <Card className="p-4 mb-6 bg-muted/30">
            <div className="flex items-start gap-3">
              <ExternalLink className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium mb-1">URL du Webhook</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Envoyez un POST avec <code className="bg-muted px-1 rounded">{"{ action, image_url, schedule_start, schedule_end, screen_id, sender_email }"}</code>
                </p>
                <div className="flex gap-2 items-center">
                  <code className="text-xs bg-background px-2 py-1 rounded border border-border truncate flex-1">{webhookUrl}</code>
                  <Button variant="outline" size="sm" onClick={copyWebhook} className="gap-1.5 shrink-0">
                    {webhookCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {webhookCopied ? "Copié" : "Copier"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="scheduled">Programmés</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="rejected">Rejetés</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filtered.length} élément{filtered.length > 1 ? "s" : ""}</Badge>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              disabled={checkingReplies}
              onClick={async () => {
                setCheckingReplies(true);
                try {
                  const { data, error } = await supabase.functions.invoke("check-email-replies");
                  if (error) throw error;
                  if (data?.processed > 0) {
                    toast.success(`${data.processed} réponse(s) email traitée(s)`);
                    queryClient.invalidateQueries({ queryKey: ["contents"] });
                  } else {
                    toast.info("Aucune nouvelle réponse email");
                  }
                } catch (e: any) {
                  toast.error("Erreur: " + (e.message || "Impossible de vérifier les emails"));
                } finally {
                  setCheckingReplies(false);
                }
              }}
            >
              {checkingReplies ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Vérifier les réponses
            </Button>
            <div className="ml-auto">
              <ManualContentForm screens={screens || []} />
            </div>
          </div>

          {/* Content list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun contenu reçu</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Utilisez le webhook ou le bouton "Ajouter" pour envoyer des contenus</p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((c) => {
                const cfg = statusConfig[c.status] || statusConfig.pending;
                const StatusIcon = cfg.icon;
                return (
                  <Card key={c.id} className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-16 rounded-md border border-border bg-muted/30 overflow-hidden cursor-pointer shrink-0" onClick={() => setPreview(c)}>
                        <img src={c.image_url} alt={c.title || ""} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium truncate">{c.title || "Sans titre"}</h4>
                          <Badge variant="outline" className={`${cfg.color} text-[10px] shrink-0`}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Reçu: {formatDate(c.created_at)}</span>
                          {c.start_time && <span>Début: {formatDate(c.start_time)}</span>}
                          {c.end_time && <span>Fin: {formatDate(c.end_time)}</span>}
                          <span>Écran: {getScreenName(c.screen_id)}</span>
                          {c.source && <span>Source: {c.source}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreview(c)} title="Aperçu">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditContent(c)} title="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {c.status === "pending" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => handleApprove(c)} title="Approuver">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" onClick={() => handleSchedule(c)} title="Programmer">
                              <Clock className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700" onClick={() => handleReject(c)} title="Rejeter">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {c.status === "rejected" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleApprove(c)} title="Réactiver">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {c.status === "active" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleReject(c)} title="Désactiver">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c)} title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {c.sender_email && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-primary"
                            onClick={() => handleResendAck(c)}
                            disabled={resendingAck === c.id}
                            title="Renvoyer l'accusé de réception"
                          >
                            {resendingAck === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== TAB: BOÎTE DE RÉCEPTION ===== */}
        <TabsContent value="inbox">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Button
              variant="default" size="sm" className="gap-1.5"
              disabled={checkingInbox}
              onClick={handleCheckInbox}
            >
              {checkingInbox ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Relever les emails
            </Button>
            <Badge variant="outline">{emails.length} email{emails.length > 1 ? "s" : ""}</Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              {emails.filter(e => e.is_processed).length} importé{emails.filter(e => e.is_processed).length > 1 ? "s" : ""}
            </Badge>
          </div>

          {inboxLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <Card className="p-8 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Boîte de réception vide</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Cliquez sur "Relever les emails" pour récupérer les emails non lus
              </p>
            </Card>
          ) : (
            <div className="grid gap-2">
              {emails.map((email) => (
                <Card key={email.id} className={`p-4 transition-colors ${email.is_processed ? "bg-muted/20" : "bg-background"}`}>
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 mt-0.5">
                      {email.has_attachments ? (
                        email.attachment_urls?.length > 0 ? (
                          <div className="w-14 h-14 rounded-md border border-border overflow-hidden bg-muted/30">
                            <img src={email.attachment_urls[0]} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-md border border-border flex items-center justify-center bg-muted/30">
                            <Paperclip className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )
                      ) : (
                        <div className="w-14 h-14 rounded-md border border-border flex items-center justify-center bg-muted/30">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium truncate">{email.subject || "(Sans objet)"}</h4>
                        {email.is_processed && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] shrink-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Importé
                          </Badge>
                        )}
                        {email.has_attachments && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            <Paperclip className="h-3 w-3 mr-1" />
                            {email.attachment_count} PJ
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium">{email.from_name || email.from_email}</span>
                        {email.from_name && <span>&lt;{email.from_email}&gt;</span>}
                        <span>{formatDate(email.raw_date || email.created_at)}</span>
                      </div>
                      {email.body_preview && (
                        <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{email.body_preview}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewEmail(email)} title="Voir">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {email.has_attachments && email.attachment_urls?.length > 0 && !email.is_processed && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-primary"
                          onClick={() => handleImportAsContent(email)}
                          title="Importer comme contenu"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== TAB: CODES D'ACCÈS ===== */}
        <TabsContent value="codes">
          <Card className="p-4 mb-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-medium mb-1">Codes d'accès QR Upload</h3>
                <p className="text-xs text-muted-foreground">
                  Ces codes permettent aux utilisateurs d'envoyer du contenu via le QR Code affiché sur les écrans en veille.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-2 mb-4 items-end flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Code</label>
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="EX: DEMO2026"
                className="w-40 font-mono"
                maxLength={20}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Nom utilisateur</label>
              <Input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Jean Dupont"
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Utilisateur lié</label>
              <Select value={newUserId} onValueChange={setNewUserId}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Aucun (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name || p.email || p.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddCode} disabled={addingCode || !newCode.trim() || !newUserName.trim()} className="gap-1.5">
              {addingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter
            </Button>
          </div>

          {accessCodes.length === 0 ? (
            <Card className="p-8 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun code d'accès</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Créez un code pour permettre l'upload via QR Code</p>
            </Card>
          ) : (
            <div className="grid gap-2">
              {accessCodes.map((ac) => {
                const linkedProfile = profiles.find((p) => p.id === ac.user_id);
                return (
                  <Card key={ac.id} className="p-3 flex items-center gap-3">
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded tracking-wider">{ac.code}</code>
                    <span className="text-sm flex-1">{ac.user_name}</span>
                    {linkedProfile && (
                      <Badge variant="secondary" className="text-xs">
                        {linkedProfile.display_name || linkedProfile.email}
                      </Badge>
                    )}
                    <Badge variant="outline" className={ac.is_active ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground"}>
                      {ac.is_active ? "Actif" : "Désactivé"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => toggleCode(ac.id, ac.is_active)}>
                      {ac.is_active ? "Désactiver" : "Activer"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCode(ac.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Content Dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.title || "Aperçu du contenu"}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <img src={preview.image_url} alt={preview.title || ""} className="w-full rounded-lg border border-border" />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Statut:</span> {statusConfig[preview.status]?.label}</div>
                <div><span className="text-muted-foreground">Source:</span> {preview.source || "—"}</div>
                <div><span className="text-muted-foreground">Début:</span> {formatDate(preview.start_time)}</div>
                <div><span className="text-muted-foreground">Fin:</span> {formatDate(preview.end_time)}</div>
                <div><span className="text-muted-foreground">Écran:</span> {getScreenName(preview.screen_id)}</div>
                <div><span className="text-muted-foreground">Reçu:</span> {formatDate(preview.created_at)}</div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="gap-2" onClick={() => { setPreview(null); setEditContent(preview); }}>
                  <Pencil className="h-4 w-4" /> Modifier
                </Button>
                {preview.status === "pending" && (
                  <>
                    <Button className="gap-2" onClick={() => { handleApprove(preview); setPreview(null); }}>
                      <CheckCircle2 className="h-4 w-4" /> Approuver
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => { handleSchedule(preview); setPreview(null); }}>
                      <Clock className="h-4 w-4" /> Programmer
                    </Button>
                    <Button variant="destructive" className="gap-2" onClick={() => { handleReject(preview); setPreview(null); }}>
                      <XCircle className="h-4 w-4" /> Rejeter
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Email Dialog */}
      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {previewEmail?.subject || "(Sans objet)"}
            </DialogTitle>
          </DialogHeader>
          {previewEmail && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">De :</span> {previewEmail.from_name ? `${previewEmail.from_name} <${previewEmail.from_email}>` : previewEmail.from_email}</div>
                <div><span className="text-muted-foreground">Date :</span> {formatDate(previewEmail.raw_date || previewEmail.created_at)}</div>
              </div>

              {previewEmail.body_preview && (
                <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {previewEmail.body_preview}
                </div>
              )}

              {previewEmail.attachment_urls && previewEmail.attachment_urls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Pièces jointes ({previewEmail.attachment_count})
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {previewEmail.attachment_urls.map((url, i) => (
                      <div key={i} className="rounded-lg border border-border overflow-hidden">
                        <img src={url} alt={`Pièce jointe ${i + 1}`} className="w-full h-40 object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {previewEmail.has_attachments && previewEmail.attachment_urls?.length > 0 && !previewEmail.is_processed && (
                  <Button className="gap-2" onClick={() => { handleImportAsContent(previewEmail); setPreviewEmail(null); }}>
                    <ArrowRight className="h-4 w-4" /> Importer comme contenu
                  </Button>
                )}
                {previewEmail.is_processed && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Déjà importé
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <EditContentDialog
        content={editContent}
        screens={screens || []}
        open={!!editContent}
        onOpenChange={(open) => { if (!open) setEditContent(null); }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["contents"] })}
      />
    </div>
  );
}
