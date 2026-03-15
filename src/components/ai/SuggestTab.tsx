import { useState } from "react";
import { Lightbulb, Loader2, LayoutGrid, ListMusic, Sparkles, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScreens } from "@/hooks/useScreens";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

interface LayoutRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index?: number;
  widget_type?: string;
  widget_config?: Record<string, any>;
  generate_image_prompt?: string;
  is_placeholder?: boolean;
}

interface LayoutSpec {
  width: number;
  height: number;
  background_color?: string;
  regions: LayoutRegion[];
}

interface PlaylistItem {
  name: string;
  duration: number;
  generate_image_prompt?: string;
  is_placeholder?: boolean;
}

interface PlaylistSpec {
  items: PlaylistItem[];
}

interface SuggestionItem {
  type: "layout" | "playlist" | "tip";
  title: string;
  description: string;
  layout?: LayoutSpec;
  playlist?: PlaylistSpec;
}

interface SuggestResult {
  summary: string;
  items: SuggestionItem[];
}

const presets = [
  "Suggère-moi une playlist pour un restaurant haut de gamme",
  "Propose un layout pour un écran d'accueil d'hôtel",
  "Quels contenus afficher dans une salle d'attente médicale ?",
  "Idées de layout et playlist pour une boutique de mode",
];

function LayoutPreview({ layout }: { layout: LayoutSpec }) {
  const scale = 280 / layout.width;
  const h = layout.height * scale;

  const widgetColors: Record<string, string> = {
    clock: "hsl(var(--primary) / 0.3)",
    weather: "hsl(var(--accent) / 0.3)",
    marquee: "hsl(var(--secondary) / 0.5)",
    iframe: "hsl(var(--muted) / 0.5)",
  };

  return (
    <div
      className="relative rounded-md border border-border overflow-hidden mx-auto"
      style={{ width: 280, height: h, backgroundColor: layout.background_color || "#1a1a2e" }}
    >
      {layout.regions.map((r, i) => (
        <div
          key={i}
          className="absolute border border-dashed border-primary/40 rounded-sm flex items-center justify-center text-[9px] font-medium text-foreground/70 overflow-hidden"
          style={{
            left: r.x * scale,
            top: r.y * scale,
            width: r.width * scale,
            height: r.height * scale,
            zIndex: r.z_index || 0,
            backgroundColor: r.generate_image_prompt
              ? "hsl(var(--primary) / 0.15)"
              : r.is_placeholder
              ? "hsl(var(--muted) / 0.3)"
              : r.widget_type
              ? widgetColors[r.widget_type] || "hsl(var(--muted) / 0.2)"
              : "hsl(var(--muted) / 0.1)",
          }}
        >
          <span className="text-center px-1 leading-tight">
            {r.widget_type === "clock" && "🕐"}
            {r.widget_type === "weather" && "🌤"}
            {r.widget_type === "marquee" && "📜"}
            {r.generate_image_prompt && "🖼 IA"}
            {r.is_placeholder && !r.generate_image_prompt && "📁"}
            {!r.widget_type && !r.generate_image_prompt && !r.is_placeholder && ""}{" "}
            {r.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function PlaylistPreview({ playlist }: { playlist: PlaylistSpec }) {
  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {playlist.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30 border border-border/50">
          <span className="text-sm">
            {item.generate_image_prompt ? "🖼" : item.is_placeholder ? "📁" : "📄"}
          </span>
          <span className="flex-1 text-foreground/80 truncate">{item.name}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">{item.duration}s</Badge>
        </div>
      ))}
    </div>
  );
}

function SuggestionCard({
  item,
  onCreateLayout,
  onCreatePlaylist,
  creatingId,
  screens,
}: {
  item: SuggestionItem;
  onCreateLayout: (item: SuggestionItem) => void;
  onCreatePlaylist: (item: SuggestionItem, screenId: string) => void;
  creatingId: string | null;
  screens: any[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedScreen, setSelectedScreen] = useState<string>("");
  const isCreating = creatingId === item.title;

  const typeConfig = {
    layout: { icon: LayoutGrid, badge: "Layout", color: "bg-primary/10 text-primary border-primary/20" },
    playlist: { icon: ListMusic, badge: "Playlist", color: "bg-accent/10 text-accent-foreground border-accent/20" },
    tip: { icon: Lightbulb, badge: "Conseil", color: "bg-muted text-muted-foreground border-border" },
  };
  const config = typeConfig[item.type] || typeConfig.tip;
  const Icon = config.icon;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={config.color}>{config.badge}</Badge>
            <h4 className="font-medium text-sm text-foreground truncate">{item.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        {(item.layout || item.playlist) && (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {expanded && item.layout && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {item.layout.width}×{item.layout.height} • {item.layout.regions.length} zones
            {item.layout.regions.filter(r => r.generate_image_prompt).length > 0 &&
              ` • ${item.layout.regions.filter(r => r.generate_image_prompt).length} images IA`}
            {item.layout.regions.filter(r => r.widget_type).length > 0 &&
              ` • ${item.layout.regions.filter(r => r.widget_type).length} widgets`}
          </p>
          <LayoutPreview layout={item.layout} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="gap-2" onClick={() => onCreateLayout(item)} disabled={isCreating}>
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isCreating ? "Création en cours..." : "Créer ce layout"}
            </Button>
          </div>
        </div>
      )}

      {expanded && item.playlist && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {item.playlist.items.length} éléments
            {item.playlist.items.filter(i => i.generate_image_prompt).length > 0 &&
              ` • ${item.playlist.items.filter(i => i.generate_image_prompt).length} images IA`}
            {item.playlist.items.filter(i => i.is_placeholder).length > 0 &&
              ` • ${item.playlist.items.filter(i => i.is_placeholder).length} placeholders`}
          </p>
          <PlaylistPreview playlist={item.playlist} />
          <div className="flex gap-2 pt-1 items-end">
            <div className="flex-1 max-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">Écran cible</label>
              <Select value={selectedScreen} onValueChange={setSelectedScreen}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choisir un écran" />
                </SelectTrigger>
                <SelectContent>
                  {screens.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => onCreatePlaylist(item, selectedScreen)}
              disabled={isCreating || !selectedScreen}
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {isCreating ? "Création..." : "Créer cette playlist"}
            </Button>
          </div>
        </div>
      )}

      {!item.layout && !item.playlist && item.type === "tip" && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3 w-3" /> Conseil
        </div>
      )}
    </Card>
  );
}

export default function SuggestTab() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const { screens } = useScreens();
  const { currentEstablishmentId } = useEstablishmentContext();

  const handleSuggest = async (text?: string) => {
    const q = text || prompt;
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "suggest", prompt: q },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLayout = async (item: SuggestionItem) => {
    if (!item.layout) return;
    setCreatingId(item.title);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "create_layout", layout: item.layout, title: item.title, establishmentId: currentEstablishmentId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Layout créé !");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setCreatingId(null);
    }
  };

  const handleCreatePlaylist = async (item: SuggestionItem, screenId: string) => {
    if (!item.playlist) return;
    setCreatingId(item.title);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "create_playlist", playlist: item.playlist, title: item.title, screenId, establishmentId: currentEstablishmentId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(data.message || "Playlist créée !");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création");
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Décrivez votre besoin</label>
        <Textarea
          placeholder="Ex: Je gère 3 écrans dans un restaurant, que me suggères-tu ?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p} variant="outline" size="sm" className="text-xs" onClick={() => { setPrompt(p); handleSuggest(p); }}>
            {p}
          </Button>
        ))}
      </div>
      <Button onClick={() => handleSuggest()} disabled={loading || !prompt.trim()} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
        {loading ? "Réflexion en cours..." : "Obtenir des suggestions"}
      </Button>

      {result && (
        <div className="space-y-3">
          {result.summary && (
            <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">{result.summary}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {result.items.map((item, i) => (
              <SuggestionCard
                key={i}
                item={item}
                onCreateLayout={handleCreateLayout}
                onCreatePlaylist={handleCreatePlaylist}
                creatingId={creatingId}
                screens={screens || []}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
