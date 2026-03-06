import { useState } from "react";
import { ListMusic, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { toast } from "sonner";

export function PlaylistManager() {
  const { screens } = useScreens();
  const { media } = useMedia();
  const [selectedScreen, setSelectedScreen] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<string>("");
  const { items, isLoading, addItem, removeItem } = usePlaylistItems(selectedScreen || undefined);

  const handleAdd = async () => {
    if (!selectedMedia || !selectedScreen) return;
    try {
      await addItem.mutateAsync({ mediaId: selectedMedia, position: items.length });
      toast.success("Média ajouté à la playlist");
      setSelectedMedia("");
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">Gestion des Playlists</h2>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedScreen} onValueChange={setSelectedScreen}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Choisir un écran" />
          </SelectTrigger>
          <SelectContent>
            {screens.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedScreen && (
          <>
            <Select value={selectedMedia} onValueChange={setSelectedMedia}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Ajouter un média" />
              </SelectTrigger>
              <SelectContent>
                {media.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!selectedMedia} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </>
        )}
      </div>

      {selectedScreen && (
        isLoading ? (
          <p className="text-muted-foreground">Chargement...</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun média dans la playlist. Ajoutez-en un ci-dessus.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <Card key={item.id} className="glass-panel p-3">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="text-xs shrink-0">{index + 1}</Badge>
                  <ListMusic className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium flex-1 truncate">
                    {(item as any).media?.name ?? "Média inconnu"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(item as any).media?.duration ?? 10}s
                  </span>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
