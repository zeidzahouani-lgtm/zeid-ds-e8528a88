import { useState } from "react";
import { useLayouts } from "@/hooks/useLayouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Plus, Trash2, Edit, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export default function Layouts() {
  const { layouts, isLoading, addLayout, deleteLayout } = useLayouts();
  const [newName, setNewName] = useState("");
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

      <div className="flex gap-2">
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
      </div>

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
          {layouts.map((layout) => (
            <Card key={layout.id} className="group hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{layout.name}</span>
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
                  className="bg-muted/50 rounded border border-border/50 flex items-center justify-center cursor-pointer hover:bg-muted transition-colors"
                  style={{ aspectRatio: `${layout.width}/${layout.height}` }}
                  onClick={() => navigate(`/layouts/${layout.id}`)}
                >
                  <Monitor className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {layout.width} × {layout.height}px
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
