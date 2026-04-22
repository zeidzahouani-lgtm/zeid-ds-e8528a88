import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVideoWalls } from "@/hooks/useVideoWalls";
import { toast } from "sonner";
import { Grid3x3 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function VideoWallDialog({ open, onOpenChange }: Props) {
  const { createWall } = useVideoWalls();
  const [name, setName] = useState("");
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);

  const total = rows * cols;

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nom requis");
      return;
    }
    try {
      await createWall.mutateAsync({ name: name.trim(), rows, cols });
      toast.success(`Mur "${name}" créé avec ${total} écran(s)`);
      setName("");
      setRows(2);
      setCols(2);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la création");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-primary" />
            Créer un mur d'écrans
          </DialogTitle>
          <DialogDescription>
            Une seule image/vidéo sera découpée et répartie sur la grille. Chaque case sera un écran physique.
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

          {/* Visual preview */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Aperçu ({total} écrans)</Label>
            <div
              className="border border-border rounded-lg p-2 bg-muted/30 mx-auto"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gap: 4,
                aspectRatio: `${cols * 16} / ${rows * 9}`,
                maxWidth: 320,
              }}
            >
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primary/20 border border-primary/40 rounded flex items-center justify-center text-[10px] text-primary font-medium"
                >
                  {Math.floor(i / cols) + 1}-{(i % cols) + 1}
                </div>
              ))}
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
