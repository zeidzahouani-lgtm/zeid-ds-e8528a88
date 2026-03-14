import { useState, useEffect } from "react";
import { Monitor, Plus, Trash2, RotateCcw, Wifi, WifiOff, ExternalLink, LayoutGrid, ListMusic, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { useLayouts } from "@/hooks/useLayouts";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { toast } from "sonner";

function PlaylistPanel({ screenId, media }: { screenId: string; media: any[] }) {
  const { items, addItem, removeItem } = usePlaylistItems(screenId);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {items.length === 0 ? "Aucun média dans la playlist." : `${items.length} média(s) dans la playlist.`}
      </p>
      {items.map((item: any) => (
        <div key={item.id} className="flex items-center justify-between border rounded-md p-2">
          <span className="text-sm">{item.media?.name || "Média inconnu"}</span>
          <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(item.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <div className="border-t pt-3">
        <label className="text-sm font-medium">Ajouter un média</label>
        <Select onValueChange={(mediaId) => addItem.mutate({ mediaId, position: items.length })}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Choisir un média..." />
          </SelectTrigger>
          <SelectContent>
            {media.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ScreenManager() {
  const { screens, isLoading, addScreen, updateScreen, deleteScreen } = useScreens();
  const { media } = useMedia();
  const { layouts } = useLayouts();
  const [newName, setNewName] = useState("");
  const [playlistScreenId, setPlaylistScreenId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addScreen.mutateAsync(newName);
      toast.success("Écran ajouté");
      setNewName("");
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">Gestion des Écrans</h2>
        <span className="text-sm text-muted-foreground">({screens.length})</span>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Nom du nouvel écran"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-xs"
        />
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {screens.map((screen) => (
            <Card key={screen.id} className="glass-panel p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <Monitor className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">{screen.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {screen.status === 'online' ? (
                        <Badge variant="outline" className="text-status-online border-status-online/30 gap-1 text-xs">
                          <Wifi className="h-3 w-3" /> En ligne
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-status-offline border-status-offline/30 gap-1 text-xs">
                          <WifiOff className="h-3 w-3" /> Hors ligne
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Orientation */}
                <Select
                  value={screen.orientation}
                  onValueChange={(val) => updateScreen.mutate({ id: screen.id, orientation: val })}
                >
                  <SelectTrigger className="w-[150px]">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Paysage</SelectItem>
                    <SelectItem value="portrait">Portrait</SelectItem>
                  </SelectContent>
                </Select>

                {/* Media selector */}
                <Select
                  value={screen.current_media_id ?? "none"}
                  onValueChange={(val) =>
                    updateScreen.mutate({ id: screen.id, current_media_id: val === "none" ? null : val })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sélectionner un média" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun média</SelectItem>
                    {media.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Layout selector */}
                <Select
                  value={(screen as any).layout_id ?? "none"}
                  onValueChange={(val) =>
                    updateScreen.mutate({ id: screen.id, layout_id: val === "none" ? null : val } as any)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun layout</SelectItem>
                    {layouts.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPlaylistScreenId(screen.id)}
                    title="Gérer la playlist"
                  >
                    <ListMusic className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`/player/${(screen as any).slug || screen.id}`, '_blank')}
                    title="Ouvrir le player"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteScreen.mutate(screen.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Playlist dialog */}
      <Dialog open={!!playlistScreenId} onOpenChange={() => setPlaylistScreenId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListMusic className="h-5 w-5" /> Playlist
            </DialogTitle>
            <DialogDescription>
              {screens.find((s) => s.id === playlistScreenId)?.name}
            </DialogDescription>
          </DialogHeader>
          {playlistScreenId && <PlaylistPanel screenId={playlistScreenId} media={media} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
