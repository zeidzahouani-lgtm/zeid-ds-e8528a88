import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useVideoWalls } from "@/hooks/useVideoWalls";
import { useLayouts } from "@/hooks/useLayouts";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Grid3x3, Maximize2, Copy } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function WallLayoutPresetDialog({ open, onOpenChange }: Props) {
  const { walls } = useVideoWalls();
  const { addLayout } = useLayouts();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [wallId, setWallId] = useState<string>("");
  const [mode, setMode] = useState<"stretched" | "tiled">("stretched");
  const [tileWidth, setTileWidth] = useState(1920);
  const [tileHeight, setTileHeight] = useState(1080);

  const selectedWall = useMemo(() => walls.find((w: any) => w.id === wallId), [walls, wallId]);

  const finalDims = useMemo(() => {
    if (!selectedWall) return { w: tileWidth, h: tileHeight };
    if (mode === "stretched") {
      return { w: tileWidth * selectedWall.cols, h: tileHeight * selectedWall.rows };
    }
    return { w: tileWidth, h: tileHeight };
  }, [selectedWall, mode, tileWidth, tileHeight]);

  const handleCreate = async () => {
    if (!name.trim() || !selectedWall) {
      toast({ title: "Champs requis", description: "Nom et mur obligatoires.", variant: "destructive" });
      return;
    }
    try {
      const layout: any = await addLayout.mutateAsync({
        name: name.trim(),
        width: finalDims.w,
        height: finalDims.h,
        wall_id: selectedWall.id,
        wall_mode: mode,
      });
      toast({ title: "Layout mur créé", description: `${finalDims.w}×${finalDims.h}px` });
      onOpenChange(false);
      setName("");
      navigate(`/layouts/${layout.id}`);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-primary" /> Layout pour mur d'écrans
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Nom du layout</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Vitrine 4K mur 2x2" />
          </div>

          <div className="grid gap-2">
            <Label>Mur d'écrans cible</Label>
            <Select value={wallId} onValueChange={setWallId}>
              <SelectTrigger>
                <SelectValue placeholder={walls.length === 0 ? "Aucun mur — créez-en un d'abord" : "Sélectionner un mur"} />
              </SelectTrigger>
              <SelectContent>
                {walls.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.rows}×{w.cols})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="grid grid-cols-2 gap-3">
              <label className={`flex flex-col gap-1 border rounded-lg p-3 cursor-pointer transition ${mode === "stretched" ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="stretched" />
                  <Maximize2 className="h-4 w-4" />
                  <span className="font-medium text-sm">Étiré sur tout le mur</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">Une seule composition découpée. Canvas: {selectedWall ? `${tileWidth * selectedWall.cols}×${tileHeight * selectedWall.rows}` : "—"}</p>
              </label>
              <label className={`flex flex-col gap-1 border rounded-lg p-3 cursor-pointer transition ${mode === "tiled" ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="tiled" />
                  <Copy className="h-4 w-4" />
                  <span className="font-medium text-sm">Répliqué sur chaque tuile</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">Chaque écran affiche le layout entier. Canvas: {tileWidth}×{tileHeight}</p>
              </label>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Largeur d'une tuile (px)</Label>
              <Input type="number" min={320} value={tileWidth} onChange={(e) => setTileWidth(Math.max(320, parseInt(e.target.value) || 1920))} />
            </div>
            <div className="grid gap-2">
              <Label>Hauteur d'une tuile (px)</Label>
              <Input type="number" min={240} value={tileHeight} onChange={(e) => setTileHeight(Math.max(240, parseInt(e.target.value) || 1080))} />
            </div>
          </div>

          {selectedWall && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-2">
                Canvas final : <span className="font-mono text-foreground">{finalDims.w} × {finalDims.h}px</span>
              </p>
              <div
                className="grid gap-1 mx-auto bg-background/50 rounded p-1"
                style={{
                  gridTemplateColumns: `repeat(${selectedWall.cols}, 1fr)`,
                  aspectRatio: `${finalDims.w}/${finalDims.h}`,
                  maxWidth: 280,
                }}
              >
                {Array.from({ length: selectedWall.rows * selectedWall.cols }).map((_, i) => (
                  <div key={i} className="bg-primary/10 border border-primary/30 rounded-sm" />
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || !wallId || addLayout.isPending}>
            Créer et ouvrir l'éditeur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
