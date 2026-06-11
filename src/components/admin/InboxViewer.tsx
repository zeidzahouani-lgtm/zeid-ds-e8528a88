import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Inbox, RefreshCw, Search, Paperclip, Mail, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInboxEmails, InboxEmail } from "@/hooks/useInboxEmails";

export default function InboxViewer() {
  const { emails, isLoading, subscribeRealtime } = useInboxEmails();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<InboxEmail | null>(null);

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
    return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm flex-wrap">
            <Inbox className="h-4 w-4 text-primary icon-neon" />
            Boîte de réception
            <Badge variant="outline" className="text-[10px]">{emails.length}</Badge>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="h-8 pl-7 w-48 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-2">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualiser
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 normal-case">
              {search ? "Aucun email ne correspond à votre recherche." : "Aucun email reçu pour le moment."}
            </p>
          ) : (
            <ScrollArea className="h-[480px] pr-3">
              <div className="space-y-2">
                {filtered.map(email => (
                  <button
                    key={email.id}
                    onClick={() => setSelected(email)}
                    className="w-full text-left p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/50 hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate normal-case">
                            {email.from_name || email.from_email}
                          </p>
                          {email.has_attachments && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Paperclip className="h-3 w-3" /> {email.attachment_count}
                            </Badge>
                          )}
                          {email.is_processed && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                              Traité
                            </Badge>
                          )}
                          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                            {formatDate(email.raw_date || email.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 mt-0.5 truncate normal-case">
                          {email.subject || "(sans objet)"}
                        </p>
                        {email.body_preview && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 normal-case">
                            {email.body_preview}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="normal-case">{selected?.subject || "(sans objet)"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-2">
                <span className="normal-case">
                  <strong className="text-foreground">{selected.from_name || selected.from_email}</strong>
                  {selected.from_name && <span className="ml-1">&lt;{selected.from_email}&gt;</span>}
                </span>
                <span>{formatDate(selected.raw_date || selected.created_at)}</span>
              </div>
              <div className="whitespace-pre-wrap text-foreground/90 max-h-80 overflow-auto normal-case">
                {selected.body_preview || "(aucun aperçu disponible)"}
              </div>
              {selected.attachment_urls?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
