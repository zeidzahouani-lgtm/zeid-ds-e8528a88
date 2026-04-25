import { useState } from "react";
import { useLayouts } from "@/hooks/useLayouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Plus, Trash2, Edit, Grid3x3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { WallLayoutPresetDialog } from "@/components/dashboard/WallLayoutPresetDialog";
import { EstablishmentAssignSelect } from "@/components/EstablishmentAssignSelect";

interface MiniRegion {
  id: string;
  layout_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  widget_type?: string | null;
  media?: { type: string; url: string } | null;
}

function LayoutMiniPreview({ layout }: { layout: { id: string; width: number; height: number; background_color: string; bg_type: string; bg_image_url: string | null } }) {
  const { data: regions = [] } = useQuery({
    queryKey: ["layout_regions_mini", layout.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("layout_regions")
        .select("id, layout_id, x, y, width, height, widget_type, media:media_id(type, url)")
        .eq("layout_id", layout.id)
        .order("z_index", { ascending: true });
      if (error) throw error;
      return data as MiniRegion[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const bgStyle: React.CSSProperties = {};
  if (layout.bg_type === "image" && layout.bg_image_url) {
    bgStyle.backgroundImage = `url(${layout.bg_image_url})`;
    bgStyle.backgroundSize = "cover";
    bgStyle.backgroundPosition = "center";
  } else {
    bgStyle.backgroundColor = layout.background_color || "#1a1a2e";
  }

  return (
    <div
      className="rounded border border-border/50 overflow-hidden relative"
      style={{ aspectRatio: `${layout.width}/${layout.height}`, ...bgStyle }}
    >
      {regions.map((r) => {
        const left = `${(r.x / layout.width) * 100}%`;
        const top = `${(r.y / layout.height) * 100}%`;
        const w = `${(r.width / layout.width) * 100}%`;
        const h = `${(r.height / layout.height) * 100}%`;

        const isImage = r.media?.type?.startsWith("image");
        const isVideo = r.media?.type?.startsWith("video");

        return (
          <div
            key={r.id}
            className="absolute border border-primary/30 rounded-sm overflow-hidden"
            style={{ left, top, width: w, height: h }}
          >
            {isImage && r.media?.url ? (
              <img src={r.media.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : isVideo && r.media?.url ? (
              <video src={r.media.url} className="w-full h-full object-cover" muted />
            ) : r.widget_type ? (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <span className="text-[8px] text-primary/60 uppercase font-medium">{r.widget_type}</span>
              </div>
            ) : (
              <div className="w-full h-full bg-muted/30" />
            )}
          </div>
        );
      })}
      {regions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LayoutGrid className="h-6 w-6 text-muted-foreground/20" />
        </div>
      )}
    </div>
  );
}

export default function Layouts() {
  const { layouts, isLoading, addLayout, deleteLayout, assignEstablishment } = useLayouts();
  const [newName, setNewName] = useState("");
  const [wallPresetOpen, setWallPresetOpen] = useState(false);
  const navigate = useNavigate();

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const layout = await addLayout.mutateAsync({ name: newName.trim() });
      toast({ title: "Layout créé", description: `"${newName}" a été créé.` });
      setNewName("");
      navigate(`/layouts/${layout.id}`);
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le layout.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" /> Layouts
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Créez des compositions multi-zones pour vos écrans
          </p>
        </div>
        <Badge variant="secondary">{layouts.length} layout(s)</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Nom du nouveau layout..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-xs"
        />
        <Button onClick={handleAdd} disabled={!newName.trim() || addLayout.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Créer
        </Button>
        <Button variant="outline" onClick={() => setWallPresetOpen(true)}>
          <Grid3x3 className="h-4 w-4 mr-1" /> Layout pour mur d'écrans
        </Button>
      </div>

      <WallLayoutPresetDialog open={wallPresetOpen} onOpenChange={setWallPresetOpen} />

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : layouts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun layout. Créez-en un pour commencer.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layouts.map((layout: any) => (
            <Card key={layout.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate flex items-center gap-2">
                    {layout.name}
                    {layout.wall_id && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Grid3x3 className="h-3 w-3" />
                        {layout.wall_mode === "tiled" ? "Mur (tuiles)" : "Mur (étiré)"}
                      </Badge>
                    )}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/layouts/${layout.id}`)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                      deleteLayout.mutate(layout.id, {
                        onSuccess: () => toast({ title: "Layout supprimé" }),
                        onError: () => toast({ title: "Erreur", description: "Impossible de supprimer le layout.", variant: "destructive" }),
                      });
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="cursor-pointer hover:ring-2 hover:ring-primary/30 rounded transition-all"
                  onClick={() => navigate(`/layouts/${layout.id}`)}
                >
                  <LayoutMiniPreview layout={layout} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {layout.width} × {layout.height}px
                </p>
                <div className="mt-2">
                  <EstablishmentAssignSelect
                    currentEstablishmentId={layout.establishment_id}
                    onAssign={(eid) => assignEstablishment.mutateAsync({ id: layout.id, establishmentId: eid })}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
