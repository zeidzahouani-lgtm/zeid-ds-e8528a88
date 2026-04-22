import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useVideoWalls } from "@/hooks/useVideoWalls";
import { useMedia } from "@/hooks/useMedia";
import { usePlaylists } from "@/hooks/usePlaylists";
import { toast } from "sonner";
import { Grid3x3, Image as ImageIcon, ListMusic, Ban } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type SourceType = "none" | "media" | "playlist";

export function VideoWallDialog({ open, onOpenChange }: Props) {
  const { createWall } = useVideoWalls();
  const { media } = useMedia();
  const { playlists } = usePlaylists();
  const [name, setName] = useState("");
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [sourceType, setSourceType] = useState<SourceType>("none");
  const [mediaId, setMediaId] = useState<string>("");
  const [playlistId, setPlaylistId] = useState<string>("");

  const total = rows * cols;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    if (sourceType === "media" && !mediaId) {
      toast.error("Sélectionnez un média");
      return;
    }
    if (sourceType === "playlist" && !playlistId) {
      toast.error("Sélectionnez une playlist");
      return;
    }
    try {
      await createWall.mutateAsync({
        name: name.trim(),
        rows,
        cols,
        mediaId: sourceType === "media" ? mediaId : null,
        playlistId: sourceType === "playlist" ? playlistId : null,
      });
      toast.success(`Mur "${name}" créé avec ${total} écran(s)`);
      setName("");
      setRows(2);
      setCols(2);
      setSourceType("none");
      setMediaId("");
      setPlaylistId("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la création");
    }
  };

  const selectedMedia = media.find((m: any) => m.id === mediaId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-primary" />
            Créer un mur d'écrans
          </DialogTitle>
          <DialogDescription>
            Une seule source sera découpée et répartie sur la grille. Chaque case sera un écran physique.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nom du mur</Label>
            <Input
              placeholder="Mur Hall d'entrée"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Lignes</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label>Colonnes</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              />
            </div>
          </div>

          {/* Source content */}
          <div className="space-y-2">
            <Label>Source du contenu</Label>
            <RadioGroup value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)} className="grid grid-cols-3 gap-2">
              <label className={`flex flex-col items-center gap-1 rounded-lg border p-2 cursor-pointer transition ${sourceType === "none" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
                <RadioGroupItem value="none" className="sr-only" />
                <Ban className="h-4 w-4" />
                <span className="text-xs">Aucune</span>
              </label>
              <label className={`flex flex-col items-center gap-1 rounded-lg border p-2 cursor-pointer transition ${sourceType === "media" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
                <RadioGroupItem value="media" className="sr-only" />
                <ImageIcon className="h-4 w-4" />
                <span className="text-xs">Média</span>
              </label>
              <label className={`flex flex-col items-center gap-1 rounded-lg border p-2 cursor-pointer transition ${sourceType === "playlist" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
                <RadioGroupItem value="playlist" className="sr-only" />
                <ListMusic className="h-4 w-4" />
                <span className="text-xs">Playlist</span>
              </label>
            </RadioGroup>

            {sourceType === "media" && (
              <Select value={mediaId} onValueChange={setMediaId}>
                <SelectTrigger><SelectValue placeholder="Choisir un média" /></SelectTrigger>
                <SelectContent>
                  {media.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun média disponible</div>}
                  {media.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} <span className="text-xs text-muted-foreground">({m.type})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {sourceType === "playlist" && (
              <Select value={playlistId} onValueChange={setPlaylistId}>
                <SelectTrigger><SelectValue placeholder="Choisir une playlist" /></SelectTrigger>
                <SelectContent>
                  {playlists.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucune playlist disponible</div>}
                  {playlists.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Visual preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Aperçu ({total} écrans)</Label>
            <div
              className="border border-border rounded-lg p-2 bg-muted/30 mx-auto relative overflow-hidden"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: 4,
                aspectRatio: `${cols * 16} / ${rows * 9}`,
                maxWidth: 320,
              }}
            >
              {Array.from({ length: total }).map((_, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                return (
                  <div
                    key={i}
                    className="bg-primary/10 border border-primary/40 rounded relative overflow-hidden flex items-center justify-center text-[10px] text-primary font-medium"
                  >
                    {selectedMedia && selectedMedia.type === "image" ? (
                      <div className="absolute inset-0 overflow-hidden">
                        <img
                          src={selectedMedia.url}
                          alt=""
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: `${cols * 100}%`,
                            height: `${rows * 100}%`,
                            objectFit: "cover",
                            transform: `translate(${-c * (100 / cols)}%, ${-r * (100 / rows)}%)`,
                            transformOrigin: "top left",
                          }}
                        />
                      </div>
                    ) : (
                      <span className="relative z-10 bg-background/60 px-1 rounded">{r + 1}-{c + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={createWall.isPending}>
            {createWall.isPending ? "Création..." : `Créer ${total} écran(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
