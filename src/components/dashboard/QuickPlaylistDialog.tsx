import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListMusic, Plus, Check, Loader2 } from "lucide-react";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useMedia } from "@/hooks/useMedia";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenId?: string | null;
  screenName?: string | null;
  onCreated?: (playlistId: string) => void;
}

/**
 * Dialog rapide : nomme une playlist, sélectionne des médias en un clic,
 * et l'assigne (optionnellement) à un écran.
 */
export function QuickPlaylistDialog({ open, onOpenChange, screenId, screenName, onCreated }: Props) {
  const { addPlaylist } = usePlaylists();
  const { media } = useMedia();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setSelected([]);
    setSaving(false);
  };

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Donnez un nom à la playlist");
      return;
    }
    if (selected.length === 0) {
      toast.error("Sélectionnez au moins un média");
      return;
    }
    setSaving(true);
    try {
      const playlist = await addPlaylist.mutateAsync(name.trim());
      const playlistId = playlist.id;

      // Insert items in order
      const items = selected.map((mediaId, position) => ({
        playlist_id: playlistId,
        media_id: mediaId,
        position,
      }));
      const { error: itemsErr } = await supabase.from("playlist_items").insert(items as any);
      if (itemsErr) throw itemsErr;

      // Optionally assign to screen
      if (screenId) {
        const { error: assignErr } = await supabase
          .from("screens")
          .update({ playlist_id: playlistId } as any)
          .eq("id", screenId);
        if (assignErr) throw assignErr;
      }

      toast.success(
        screenId
          ? `Playlist créée et assignée à ${screenName ?? "l'écran"}`
          : "Playlist créée"
      );
      onCreated?.(playlistId);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de la création");
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListMusic className="h-5 w-5 text-primary" />
            Créer une playlist
          </DialogTitle>
          <DialogDescription>
            {screenName
              ? `Sera assignée à l'écran "${screenName}"`
              : "Nommez votre playlist puis sélectionnez les médias à inclure."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom de la playlist</label>
            <Input
              placeholder="Ex: Promotions du midi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Médias à inclure</label>
              <Badge variant="secondary">{selected.length} sélectionné(s)</Badge>
            </div>

            {media.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                Aucun média disponible. Importez d'abord des médias dans la bibliothèque.
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-1">
                {media.map((m: any) => {
                  const isSelected = selected.includes(m.id);
                  const order = selected.indexOf(m.id) + 1;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.id)}
                      className={`relative rounded-lg border-2 transition-all text-left p-2 ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold z-10">
                          {order}
                        </div>
                      )}
                      <div className="aspect-video rounded bg-muted overflow-hidden mb-1.5 relative">
                        {m.type === "image" ? (
                          <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                        ) : m.type === "video" ? (
                          <>
                            <video src={m.url} className="w-full h-full object-cover" muted preload="metadata" />
                            <span className="absolute bottom-1 left-1 px-1 rounded bg-black/60 text-white text-[9px] font-semibold">VIDÉO</span>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <ListMusic className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs truncate font-medium">{m.name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || selected.length === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Création..." : "Créer la playlist"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
