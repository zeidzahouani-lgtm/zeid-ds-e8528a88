import { useState } from "react";
import { ListMusic, Plus, Trash2, GripVertical, Tv, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { useMedia } from "@/hooks/useMedia";
import { useScreens } from "@/hooks/useScreens";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PlaylistManager() {
  const { playlists, isLoading: loadingPlaylists, addPlaylist, deletePlaylist } = usePlaylists();
  const { media } = useMedia();
  const { screens, updateScreen } = useScreens();
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("");
  const [selectedMedia, setSelectedMedia] = useState<string>("");
  const [newName, setNewName] = useState("");

  const { items, isLoading, addItem, removeItem } = usePlaylistItems(selectedPlaylist || undefined);

  // Screens assigned to this playlist
  const assignedScreens = screens.filter((s: any) => s.playlist_id === selectedPlaylist);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const result = await addPlaylist.mutateAsync(newName.trim());
      toast.success("Playlist créée");
      setNewName("");
      if (result?.id) setSelectedPlaylist(result.id);
    } catch {
      toast.error("Erreur");
    }
  };

  const handleAddMedia = async () => {
    if (!selectedMedia || !selectedPlaylist) return;
    try {
      await addItem.mutateAsync({ mediaId: selectedMedia, position: items.length });
      toast.success("Média ajouté");
      setSelectedMedia("");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleAssignScreen = async (screenId: string) => {
    try {
      await supabase.from("screens").update({ playlist_id: selectedPlaylist } as any).eq("id", screenId);
      toast.success("Écran assigné à la playlist");
      // Invalidate screens
      updateScreen.reset();
      window.dispatchEvent(new Event("invalidate-screens"));
    } catch {
      toast.error("Erreur");
    }
  };

  const handleUnassignScreen = async (screenId: string) => {
    try {
      await supabase.from("screens").update({ playlist_id: null } as any).eq("id", screenId);
      toast.success("Écran retiré de la playlist");
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create playlist */}
      <Card className="p-4 space-y-3 border-border/50">
        <p className="text-sm font-medium text-foreground">Nouvelle playlist</p>
        <div className="flex gap-2">
          <Input
            placeholder="Nom de la playlist"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="max-w-xs"
          />
          <Button onClick={handleCreate} disabled={!newName.trim()} className="gap-2">
            <FolderPlus className="h-4 w-4" /> Créer
          </Button>
        </div>
      </Card>

      {/* Select playlist */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Choisir une playlist" />
          </SelectTrigger>
          <SelectContent>
            {playlists.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPlaylist && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              deletePlaylist.mutate(selectedPlaylist);
              setSelectedPlaylist("");
              toast.success("Playlist supprimée");
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
          </Button>
        )}
      </div>

      {selectedPlaylist && (
        <>
          {/* Add media to playlist */}
          <Card className="p-4 space-y-3 border-border/50">
            <p className="text-sm font-medium text-foreground">Ajouter un média</p>
            <div className="flex gap-2 flex-wrap">
              <Select value={selectedMedia} onValueChange={setSelectedMedia}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Choisir un média" />
                </SelectTrigger>
                <SelectContent>
                  {media.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddMedia} disabled={!selectedMedia} className="gap-2">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
          </Card>

          {/* Playlist items */}
          {isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun média dans cette playlist.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <Card key={item.id} className="p-3 border-border/50">
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
          )}

          {/* Assign screens */}
          <Card className="p-4 space-y-3 border-border/50">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Tv className="h-4 w-4" /> Écrans assignés
            </p>
            {assignedScreens.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {assignedScreens.map((s: any) => (
                  <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
                    {s.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-1"
                      onClick={() => handleUnassignScreen(s.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Select onValueChange={handleAssignScreen}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Assigner un écran" />
                </SelectTrigger>
                <SelectContent>
                  {screens
                    .filter((s: any) => s.playlist_id !== selectedPlaylist)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
