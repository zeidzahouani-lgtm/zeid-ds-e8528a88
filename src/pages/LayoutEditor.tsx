import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLayouts, useLayoutRegions, LayoutRegion } from "@/hooks/useLayouts";
import { useMedia } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Move, Maximize2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type DragMode = "move" | "resize" | null;

interface DragState {
  regionId: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
}

export default function LayoutEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { layouts, updateLayout } = useLayouts();
  const { regions, addRegion, updateRegion, deleteRegion } = useLayoutRegions(id);
  const { media } = useMedia();
  const canvasRef = useRef<HTMLDivElement>(null);

  const layout = layouts.find((l) => l.id === id);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [layoutName, setLayoutName] = useState("");

  useEffect(() => {
    if (layout) setLayoutName(layout.name);
  }, [layout]);

  const CANVAS_MAX_WIDTH = 800;
  const scale = layout ? Math.min(CANVAS_MAX_WIDTH / layout.width, 1) : 1;

  const handleAddRegion = async () => {
    if (!id) return;
    try {
      await addRegion.mutateAsync({
        layout_id: id,
        name: `Zone ${regions.length + 1}`,
        x: 50 + regions.length * 20,
        y: 50 + regions.length * 20,
        width: 300,
        height: 200,
        z_index: regions.length,
      });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter la zone.", variant: "destructive" });
    }
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, region: LayoutRegion, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedRegionId(region.id);
      setDragState({
        regionId: region.id,
        mode,
        startX: e.clientX,
        startY: e.clientY,
        origX: region.x,
        origY: region.y,
        origW: region.width,
        origH: region.height,
      });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !layout) return;
      const dx = (e.clientX - dragState.startX) / scale;
      const dy = (e.clientY - dragState.startY) / scale;

      const region = regions.find((r) => r.id === dragState.regionId);
      if (!region) return;

      if (dragState.mode === "move") {
        const newX = Math.max(0, Math.min(layout.width - region.width, Math.round(dragState.origX + dx)));
        const newY = Math.max(0, Math.min(layout.height - region.height, Math.round(dragState.origY + dy)));
        // Update locally via optimistic — we'll save on mouseUp
        Object.assign(region, { x: newX, y: newY });
      } else if (dragState.mode === "resize") {
        const newW = Math.max(50, Math.round(dragState.origW + dx));
        const newH = Math.max(50, Math.round(dragState.origH + dy));
        Object.assign(region, { width: newW, height: newH });
      }
      // Force re-render
      setDragState({ ...dragState });
    },
    [dragState, layout, regions, scale]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;
    const region = regions.find((r) => r.id === dragState.regionId);
    if (region) {
      updateRegion.mutate({
        id: region.id,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      });
    }
    setDragState(null);
  }, [dragState, regions, updateRegion]);

  const handleSaveName = () => {
    if (!id || !layoutName.trim()) return;
    updateLayout.mutate({ id, name: layoutName.trim() });
    toast({ title: "Layout sauvegardé" });
  };

  const selectedRegion = regions.find((r) => r.id === selectedRegionId);

  const regionColors = [
    "hsl(var(--primary) / 0.3)",
    "hsl(210 80% 60% / 0.3)",
    "hsl(150 60% 50% / 0.3)",
    "hsl(30 80% 55% / 0.3)",
    "hsl(280 60% 55% / 0.3)",
    "hsl(0 70% 55% / 0.3)",
  ];

  if (!layout) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Chargement du layout...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/layouts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          className="max-w-xs font-semibold"
        />
        <Button size="sm" onClick={handleSaveName}>
          <Save className="h-4 w-4 mr-1" /> Sauvegarder
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {layout.width} × {layout.height}px
        </span>
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant="outline" onClick={handleAddRegion}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter une zone
            </Button>
          </div>

          <div
            className="border border-border rounded-lg overflow-hidden bg-black relative select-none"
            style={{
              width: layout.width * scale,
              height: layout.height * scale,
            }}
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {regions.map((region, idx) => {
              const isSelected = region.id === selectedRegionId;
              const color = regionColors[idx % regionColors.length];
              return (
                <div
                  key={region.id}
                  className={`absolute border-2 transition-shadow cursor-move flex flex-col items-center justify-center ${
                    isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-white/30"
                  }`}
                  style={{
                    left: region.x * scale,
                    top: region.y * scale,
                    width: region.width * scale,
                    height: region.height * scale,
                    zIndex: region.z_index + 1,
                    backgroundColor: color,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, region, "move")}
                  onClick={() => setSelectedRegionId(region.id)}
                >
                  {/* Media preview */}
                  {region.media && region.media.type?.startsWith("image") && (
                    <img
                      src={region.media.url}
                      alt={region.media.name}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    />
                  )}
                  {region.media && region.media.type?.startsWith("video") && (
                    <video
                      src={region.media.url}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      muted
                    />
                  )}

                  {/* Label */}
                  <span className="text-[10px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded z-10 pointer-events-none">
                    {region.name}
                  </span>

                  {/* Move icon */}
                  <Move className="h-3 w-3 text-white/60 mt-1 pointer-events-none" />

                  {/* Resize handle */}
                  <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center bg-primary/80 rounded-tl"
                    onMouseDown={(e) => handleMouseDown(e, region, "resize")}
                  >
                    <Maximize2 className="h-2.5 w-2.5 text-primary-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Properties panel */}
        <Card className="w-72 shrink-0 self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Propriétés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedRegion ? (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Nom</label>
                  <Input
                    value={selectedRegion.name}
                    onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, name: e.target.value })}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">X</label>
                    <Input
                      type="number"
                      value={selectedRegion.x}
                      onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, x: +e.target.value })}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Y</label>
                    <Input
                      type="number"
                      value={selectedRegion.y}
                      onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, y: +e.target.value })}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Largeur</label>
                    <Input
                      type="number"
                      value={selectedRegion.width}
                      onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, width: +e.target.value })}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Hauteur</label>
                    <Input
                      type="number"
                      value={selectedRegion.height}
                      onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, height: +e.target.value })}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Média</label>
                  <Select
                    value={selectedRegion.media_id || "none"}
                    onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, media_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {media.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Z-Index</label>
                  <Input
                    type="number"
                    value={selectedRegion.z_index}
                    onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, z_index: +e.target.value })}
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    deleteRegion.mutate(selectedRegion.id);
                    setSelectedRegionId(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer la zone
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sélectionnez une zone pour modifier ses propriétés.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
