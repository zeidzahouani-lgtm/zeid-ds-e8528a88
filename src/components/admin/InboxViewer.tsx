import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Inbox, RefreshCw, Search, Paperclip, Loader2, ExternalLink, Reply, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInboxEmails, InboxEmail } from "@/hooks/useInboxEmails";

export default function InboxViewer() {
  const { emails, isLoading, subscribeRealtime } = useInboxEmails();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<InboxEmail | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<InboxEmail | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InboxEmail | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsub = subscribeRealtime();
    return unsub;
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-inbox", { body: {} });
      if (error) throw error;
      toast.success(`Inbox synchronisée${data?.processed ? ` (${data.processed} nouveaux)` : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Impossible de rafraîchir");
    } finally {
      setRefreshing(false);
    }
  };

  const openReply = (email: InboxEmail) => {
    setReplyTarget(email);
    setReplyBody("");
    setReplyOpen(true);
  };

  const handleSendReply = async () => {
    if (!replyTarget || !replyBody.trim()) {
      toast.error("Le message ne peut pas être vide");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-reply", {
        body: {
          to: replyTarget.from_email,
          subject: replyTarget.subject,
          body: replyBody,
          in_reply_to: replyTarget.message_id,
        },
      });
      if (error) throw error;
      toast.success("Réponse envoyée");
      setReplyOpen(false);
      setReplyTarget(null);
      setReplyBody("");
    } catch (e: any) {
      toast.error(e.message || "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await (supabase.from("inbox_emails") as any).delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Email supprimé");
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Échec de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = emails.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.from_email?.toLowerCase().includes(q) ||
      e.from_name?.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q) ||
      e.body_preview?.toLowerCase().includes(q)
    );
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    return sameDay
      ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  const initials = (e: InboxEmail) => {
    const src = (e.from_name || e.from_email || "?").trim();
    const parts = src.split(/[\s@.]+/).filter(Boolean);
    return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
  };

  return (
    <>
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Inbox className="h-4 w-4 text-primary icon-neon" />
            Boîte de réception
            <Badge variant="outline" className="text-[10px]">{emails.length}</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-auto gap-2"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualiser
            </Button>
          </CardTitle>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par expéditeur, sujet, contenu…"
              className="pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 normal-case px-6">
              {search ? "Aucun email ne correspond à votre recherche." : "Aucun email reçu pour le moment."}
            </p>
          ) : (
            <ScrollArea className="h-[520px]">
              <ul className="divide-y divide-border">
                {filtered.map(email => (
                  <li key={email.id} className="group relative">
                    <button
                      onClick={() => setSelected(email)}
                      className="w-full text-left px-4 py-3 hover:bg-secondary/40 focus:bg-secondary/50 focus:outline-none transition-colors flex gap-3 items-start"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-semibold">
                        {initials(email)}
                      </div>
                      <div className="flex-1 min-w-0 pr-20">
                        <div className="flex items-baseline gap-2">
                          <p className="font-medium text-sm truncate normal-case flex-1">
                            {email.from_name || email.from_email}
                          </p>
                          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                            {formatDate(email.raw_date || email.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 truncate normal-case mt-0.5">
                          {email.subject || <span className="italic text-muted-foreground">(sans objet)</span>}
                        </p>
                        {email.body_preview && (
                          <p className="text-xs text-muted-foreground line-clamp-1 normal-case mt-0.5">
                            {email.body_preview}
                          </p>
                        )}
                        {(email.has_attachments || email.is_processed) && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {email.has_attachments && (
                              <Badge variant="outline" className="text-[10px] h-5 gap-1 px-1.5">
                                <Paperclip className="h-2.5 w-2.5" /> {email.attachment_count}
                              </Badge>
                            )}
                            {email.is_processed && (
                              <Badge className="bg-green-500/15 text-green-500 border-green-500/30 text-[10px] h-5 px-1.5">
                                Traité
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); openReply(email); }}
                        title="Répondre"
                      >
                        <Reply className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(email); }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Reader dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="normal-case text-base pr-8 break-words">
              {selected?.subject || "(sans objet)"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm flex-1 overflow-hidden flex flex-col">
              <div className="flex items-start gap-3 border-b border-border pb-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-semibold">
                  {initials(selected)}
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-medium text-foreground text-sm normal-case truncate">
                    {selected.from_name || selected.from_email}
                  </p>
                  {selected.from_name && (
                    <p className="text-muted-foreground truncate normal-case">&lt;{selected.from_email}&gt;</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                  {selected.raw_date || selected.created_at
                    ? new Date(selected.raw_date || selected.created_at).toLocaleString("fr-FR", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </span>
              </div>
              <ScrollArea className="flex-1 pr-3 -mr-3">
                <div className="whitespace-pre-wrap break-words text-foreground/90 normal-case text-sm leading-relaxed">
                  {selected.body_preview || (
                    <span className="italic text-muted-foreground">(aucun aperçu disponible)</span>
                  )}
                </div>
              </ScrollArea>
              {selected.attachment_urls?.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Pièces jointes ({selected.attachment_urls.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selected.attachment_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-xs transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Pièce {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-2"
                  onClick={() => setDeleteTarget(selected)}
                >
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
                <Button size="sm" className="gap-2" onClick={() => openReply(selected)}>
                  <Reply className="h-4 w-4" /> Répondre
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply dialog */}
      <Dialog open={replyOpen} onOpenChange={(v) => { if (!v) { setReplyOpen(false); setReplyTarget(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="normal-case text-base">Répondre à {replyTarget?.from_name || replyTarget?.from_email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground normal-case">
              <span className="font-medium">À :</span> {replyTarget?.from_email}
            </div>
            <div className="text-xs text-muted-foreground normal-case">
              <span className="font-medium">Sujet :</span> {replyTarget?.subject?.startsWith("Re:") ? replyTarget?.subject : `Re: ${replyTarget?.subject || "(sans objet)"}`}
            </div>
            <Textarea
              value={replyBody}
              onChange={e => setReplyBody(e.target.value)}
              placeholder="Votre réponse…"
              rows={8}
              className="resize-none text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)} disabled={sending}>
              Annuler
            </Button>
            <Button onClick={handleSendReply} disabled={sending || !replyBody.trim()} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet email ?</AlertDialogTitle>
            <AlertDialogDescription className="normal-case">
              Cette action est irréversible. L'email « {deleteTarget?.subject || "(sans objet)"} » sera définitivement supprimé de la boîte de réception.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
