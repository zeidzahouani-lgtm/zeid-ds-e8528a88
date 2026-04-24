import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLayouts, useLayoutRegions, LayoutRegion } from "@/hooks/useLayouts";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useMedia } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, Trash2, Save, Move, Maximize2, Image, Video, Globe, Clock, Cloud, Type,
  Monitor, Smartphone, LayoutGrid, Columns, PanelLeft, Square, Eye, QrCode, Palette, AlignLeft,
  ImageIcon, Check, ArrowUpDown, Rss, Images, ArrowUp, ArrowDown, Grid3x3, Magnet,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import WidgetRenderer from "@/components/widgets/WidgetRenderer";
import { COUNTRY_LIST } from "@/components/widgets/WeatherWidget";
import { GMT_OFFSETS } from "@/components/widgets/ClockWidget";
import { POPULAR_CURRENCIES } from "@/components/widgets/CurrencyWidget";
import { QR_CODE_TYPES, type QRCodeType } from "@/components/widgets/QRCodeWidget";

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

const WIDGET_TYPES = [
  { value: "clock", label: "Horloge", icon: Clock },
  { value: "weather", label: "Météo", icon: Cloud },
  { value: "marquee", label: "Texte défilant", icon: Type },
  { value: "fixedtext", label: "Texte fixe", icon: AlignLeft },
  { value: "qrcode", label: "QR Code", icon: QrCode },
  { value: "currency", label: "Cours devises", icon: ArrowUpDown },
  { value: "rss", label: "Flux RSS", icon: Rss },
  { value: "slideshow", label: "Diaporama", icon: Images },
];

interface PresetTemplate {
  id: string;
  name: string;
  icon: typeof Monitor;
  description: string;
  regions: (w: number, h: number) => Array<{ name: string; x: number; y: number; width: number; height: number; z_index: number; widget_type?: string; widget_config?: any }>;
}

const PRESETS: PresetTemplate[] = [
  {
    id: "fullscreen",
    name: "Plein Écran",
    icon: Square,
    description: "1 seule zone de contenu",
    regions: (w, h) => [
      { name: "Contenu principal", x: 0, y: 0, width: w, height: h, z_index: 0 },
    ],
  },
  {
    id: "split-70-30",
    name: "Split 70/30",
    icon: Columns,
    description: "Zone principale + barre latérale widgets",
    regions: (w, h) => [
      { name: "Contenu principal", x: 0, y: 0, width: Math.round(w * 0.7), height: h, z_index: 0 },
      { name: "Barre latérale", x: Math.round(w * 0.7), y: 0, width: Math.round(w * 0.3), height: Math.round(h * 0.5), z_index: 1 },
      { name: "Widget", x: Math.round(w * 0.7), y: Math.round(h * 0.5), width: Math.round(w * 0.3), height: Math.round(h * 0.5), z_index: 2, widget_type: "weather", widget_config: { city: "Paris", temperature: 22, condition: "sunny" } },
    ],
  },
  {
    id: "l-shape",
    name: "L-Shape",
    icon: PanelLeft,
    description: "Zone centrale + latérale + ticker bas",
    regions: (w, h) => {
      const tickerH = Math.round(h * 0.1);
      const sideW = Math.round(w * 0.25);
      return [
        { name: "Contenu central", x: 0, y: 0, width: w - sideW, height: h - tickerH, z_index: 0 },
        { name: "Barre latérale", x: w - sideW, y: 0, width: sideW, height: h - tickerH, z_index: 1 },
        { name: "Ticker", x: 0, y: h - tickerH, width: w, height: tickerH, z_index: 2, widget_type: "marquee", widget_config: { text: "Bienvenue ! Ceci est un message défilant.", speed: 80, backgroundColor: "#1a1a2e", textColor: "#ffffff", fontSize: 24 } },
      ];
    },
  },
  {
    id: "grid-2x2",
    name: "Grille 2×2",
    icon: LayoutGrid,
    description: "4 zones égales en grille",
    regions: (w, h) => {
      const hw = Math.round(w / 2);
      const hh = Math.round(h / 2);
      return [
        { name: "Zone 1", x: 0, y: 0, width: hw, height: hh, z_index: 0 },
        { name: "Zone 2", x: hw, y: 0, width: w - hw, height: hh, z_index: 1 },
        { name: "Zone 3", x: 0, y: hh, width: hw, height: h - hh, z_index: 2 },
        { name: "Zone 4", x: hw, y: hh, width: w - hw, height: h - hh, z_index: 3 },
      ];
    },
  },
];

const DEFAULT_WIDGET_CONFIGS: Record<string, any> = {
  clock: { format: "24h", showDate: true, showSeconds: true, gmtOffset: null },
  weather: { city: "Paris", country: "FR", temperature: 22, condition: "sunny", useRealtime: true },
  marquee: { text: "Bienvenue ! Ceci est un message défilant.", speed: 80, backgroundColor: "#1a1a2e", textColor: "#ffffff", fontSize: 24 },
  fixedtext: { text: "Texte fixe", fontSize: 24, textColor: "#ffffff", backgroundColor: "transparent", textAlign: "center", fontWeight: "bold" },
  qrcode: { qrType: "url", url: "https://example.com", label: "Scannez-moi", bgColor: "#ffffff", fgColor: "#000000" },
  currency: { mode: "auto", baseCurrency: "EUR", targetCurrencies: ["USD", "TND", "GBP"], manualRates: {} },
  rss: { feedUrl: "", maxItems: 5, showDescription: false, scrollSpeed: 30, accentColor: "#3b82f6" },
  slideshow: { items: [], playlistId: null, defaultDuration: 5, transition: "fade", transitionDuration: 600, fit: "cover", backgroundColor: "#000000" },
};

export default function LayoutEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { layouts, updateLayout } = useLayouts();
  const { regions, addRegion, updateRegion, deleteRegion } = useLayoutRegions(id);
  const { media } = useMedia();
  const { playlists } = usePlaylists();
  const canvasRef = useRef<HTMLDivElement>(null);

  const layout = layouts.find((l) => l.id === id);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [layoutName, setLayoutName] = useState("");
  const [activePanel, setActivePanel] = useState<"properties" | "library" | "widgets" | "presets" | "background">("presets");
  const [showPreview, setShowPreview] = useState(false);
  const [showBgLibrary, setShowBgLibrary] = useState(false);
  const [showSlideshowPicker, setShowSlideshowPicker] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridDivisions, setGridDivisions] = useState(12);

  useEffect(() => {
    if (layout) {
      setLayoutName(layout.name);
      setOrientation(layout.width >= layout.height ? "landscape" : "portrait");
    }
  }, [layout]);

  const CANVAS_MAX_WIDTH = 650;
  const CANVAS_MAX_HEIGHT = 500;
  const canvasW = layout?.width ?? 1920;
  const canvasH = layout?.height ?? 1080;
  const scale = Math.min(CANVAS_MAX_WIDTH / canvasW, CANVAS_MAX_HEIGHT / canvasH, 1);

  const handleOrientationChange = (newOrientation: "landscape" | "portrait") => {
    if (!id || !layout) return;
    setOrientation(newOrientation);
    const w = newOrientation === "landscape" ? 1920 : 1080;
    const h = newOrientation === "landscape" ? 1080 : 1920;
    updateLayout.mutate({ id, width: w, height: h });
  };

  const handleApplyPreset = async (preset: PresetTemplate) => {
    if (!id || !layout) return;
    // Delete all existing regions
    for (const r of regions) {
      await deleteRegion.mutateAsync(r.id);
    }
    // Create new regions from preset
    const w = layout.width;
    const h = layout.height;
    const newRegions = preset.regions(w, h);
    for (const r of newRegions) {
      await addRegion.mutateAsync({ layout_id: id, ...r } as any);
    }
    setSelectedRegionId(null);
    toast({ title: `Template "${preset.name}" appliqué`, description: `${newRegions.length} zone(s) créée(s).` });
  };

  const handleAddRegion = async () => {
    if (!id) return;
    try {
      const result = await addRegion.mutateAsync({
        layout_id: id,
        name: `Zone ${regions.length + 1}`,
        x: 50 + regions.length * 20,
        y: 50 + regions.length * 20,
        width: 300,
        height: 200,
        z_index: regions.length,
      });
      setSelectedRegionId(result.id);
      setActivePanel("properties");
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter la zone.", variant: "destructive" });
    }
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, region: LayoutRegion, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedRegionId(region.id);
      setActivePanel("properties");
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

      const stepX = layout.width / gridDivisions;
      const stepY = layout.height / gridDivisions;
      const snap = (val: number, step: number) => snapToGrid ? Math.round(val / step) * step : val;

      if (dragState.mode === "move") {
        const newX = Math.max(0, Math.min(layout.width - region.width, Math.round(snap(dragState.origX + dx, stepX))));
        const newY = Math.max(0, Math.min(layout.height - region.height, Math.round(snap(dragState.origY + dy, stepY))));
        Object.assign(region, { x: newX, y: newY });
      } else if (dragState.mode === "resize") {
        const newW = Math.max(50, Math.round(snap(dragState.origW + dx, stepX)));
        const newH = Math.max(50, Math.round(snap(dragState.origH + dy, stepY)));
        Object.assign(region, { width: newW, height: newH });
      }
      setDragState({ ...dragState });
    },
    [dragState, layout, regions, scale, snapToGrid, gridDivisions]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;
    const region = regions.find((r) => r.id === dragState.regionId);
    if (region) {
      updateRegion.mutate({ id: region.id, x: region.x, y: region.y, width: region.width, height: region.height });
    }
    setDragState(null);
  }, [dragState, regions, updateRegion]);

  const handleAssignMedia = (mediaId: string) => {
    if (!selectedRegionId) {
      toast({ title: "Sélectionnez une zone", variant: "destructive" });
      return;
    }
    updateRegion.mutate({ id: selectedRegionId, media_id: mediaId, widget_type: null, widget_config: null } as any);
    toast({ title: "Média assigné à la zone" });
  };

  const handleAssignWidget = (widgetType: string) => {
    if (!selectedRegionId) {
      toast({ title: "Sélectionnez une zone", variant: "destructive" });
      return;
    }
    updateRegion.mutate({ id: selectedRegionId, media_id: null, widget_type: widgetType, widget_config: DEFAULT_WIDGET_CONFIGS[widgetType] || {} } as any);
    toast({ title: `Widget "${WIDGET_TYPES.find(w => w.value === widgetType)?.label}" assigné` });
  };

  const handleSaveName = () => {
    if (!id || !layoutName.trim()) return;
    updateLayout.mutate({ id, name: layoutName.trim() });
    toast({ title: "Layout sauvegardé" });
  };

  const selectedRegion = regions.find((r) => r.id === selectedRegionId);

  const regionColors = [
    "hsl(185 100% 55% / 0.25)",
    "hsl(210 80% 60% / 0.25)",
    "hsl(150 60% 50% / 0.25)",
    "hsl(30 80% 55% / 0.25)",
    "hsl(280 60% 55% / 0.25)",
    "hsl(0 70% 55% / 0.25)",
  ];

  if (!layout) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement du layout...</div>;
  }

  const renderRegionOnCanvas = (region: LayoutRegion, idx: number, isPreview = false) => {
    const isSelected = !isPreview && region.id === selectedRegionId;
    const color = regionColors[idx % regionColors.length];
    const hasWidget = !!(region as any).widget_type;
    const regionStyle: any = (region as any).widget_config;
    const bgColor = regionStyle?.zone_bg || "transparent";
    const borderColor = regionStyle?.zone_border || "transparent";

    return (
      <div
        key={region.id}
        className={`absolute border-2 transition-shadow flex flex-col items-center justify-center overflow-hidden ${
          isPreview ? "" : "cursor-move"
        } ${isSelected ? "border-primary shadow-lg shadow-primary/20" : isPreview ? "border-white/10" : "border-white/30"}`}
        style={{
          left: region.x * scale,
          top: region.y * scale,
          width: region.width * scale,
          height: region.height * scale,
          zIndex: region.z_index + 1,
          backgroundColor: hasWidget || region.media ? bgColor : (bgColor !== "transparent" ? bgColor : color),
          borderColor: borderColor !== "transparent" ? borderColor : undefined,
        }}
        onMouseDown={isPreview ? undefined : (e) => handleMouseDown(e, region, "move")}
        onClick={isPreview ? undefined : (e) => { e.stopPropagation(); setSelectedRegionId(region.id); setActivePanel("properties"); }}
      >
        {hasWidget && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <WidgetRenderer widgetType={(region as any).widget_type} widgetConfig={(region as any).widget_config} />
          </div>
        )}
        {!hasWidget && region.media && region.media.type?.startsWith("image") && (
          <img src={region.media.url} alt={region.media.name} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        )}
        {!hasWidget && region.media && region.media.type?.startsWith("video") && (
          <video src={region.media.url} className="absolute inset-0 w-full h-full object-cover pointer-events-none" muted autoPlay loop />
        )}

        {!isPreview && (
          <>
            <span className="text-[10px] font-medium text-white bg-black/60 px-1.5 py-0.5 rounded z-10 pointer-events-none">
              {region.name}
              {hasWidget && <span className="ml-1 opacity-70">• {WIDGET_TYPES.find(w => w.value === (region as any).widget_type)?.label}</span>}
              {region.media && !hasWidget && <span className="ml-1 opacity-70">• {region.media.name}</span>}
            </span>
            <Move className="h-3 w-3 text-white/60 mt-1 pointer-events-none" />
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center bg-primary/80 rounded-tl"
              onMouseDown={(e) => handleMouseDown(e, region, "resize")}
            >
              <Maximize2 className="h-2.5 w-2.5 text-primary-foreground" />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/layouts")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input value={layoutName} onChange={(e) => setLayoutName(e.target.value)} className="max-w-xs font-semibold" />
        <Button size="sm" onClick={handleSaveName}>
          <Save className="h-4 w-4 mr-1" /> Sauvegarder
        </Button>

        {/* Orientation switcher */}
        <div className="flex items-center gap-1 ml-auto border rounded-md overflow-hidden">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              orientation === "landscape" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => handleOrientationChange("landscape")}
          >
            <Monitor className="h-3.5 w-3.5" /> 16:9
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              orientation === "portrait" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
            onClick={() => handleOrientationChange("portrait")}
          >
            <Smartphone className="h-3.5 w-3.5" /> 9:16
          </button>
        </div>

        <Button size="sm" variant={showPreview ? "default" : "outline"} onClick={() => setShowPreview(!showPreview)}>
          <Eye className="h-4 w-4 mr-1" /> Prévisualiser
        </Button>

        <Badge variant="secondary">{layout.width} × {layout.height}px</Badge>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Prévisualisation Live
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div
              className="relative bg-black rounded-lg overflow-hidden border border-border/50"
              style={{
                width: canvasW * scale * 0.8,
                height: canvasH * scale * 0.8,
                backgroundColor: layout.background_color || "#000000",
                backgroundImage: (layout as any).bg_type === "image" && (layout as any).bg_image_url ? `url(${(layout as any).bg_image_url})` : undefined,
                backgroundSize: (layout as any).bg_image_fit === "contain" ? "contain" : (layout as any).bg_image_fit === "repeat" ? "auto" : "cover",
                backgroundRepeat: (layout as any).bg_image_fit === "repeat" ? "repeat" : "no-repeat",
                backgroundPosition: "center",
              }}
            >
              {/* Preview overlay */}
              {(layout as any).bg_type === "image" && (layout as any).bg_image_url && ((layout as any).bg_overlay_darken > 0 || (layout as any).bg_overlay_blur > 0) && (
                <div className="absolute inset-0 pointer-events-none z-[0]" style={{
                  backgroundColor: `rgba(0,0,0,${((layout as any).bg_overlay_darken || 0) / 100})`,
                  backdropFilter: (layout as any).bg_overlay_blur > 0 ? `blur(${(layout as any).bg_overlay_blur}px)` : undefined,
                }} />
              )}
              {regions.map((r, idx) => {
                const previewScale = scale * 0.8;
                return (
                  <div
                    key={r.id}
                    className="absolute overflow-hidden"
                    style={{
                      left: r.x * previewScale,
                      top: r.y * previewScale,
                      width: r.width * previewScale,
                      height: r.height * previewScale,
                      zIndex: r.z_index + 1,
                      backgroundColor: (r as any).widget_config?.zone_bg || regionColors[idx % regionColors.length],
                      borderColor: (r as any).widget_config?.zone_border || "transparent",
                      borderWidth: (r as any).widget_config?.zone_border ? 2 : 0,
                    }}
                  >
                    {(r as any).widget_type && (
                      <div className="absolute inset-0">
                        <WidgetRenderer widgetType={(r as any).widget_type} widgetConfig={(r as any).widget_config} />
                      </div>
                    )}
                    {!(r as any).widget_type && r.media && r.media.type?.startsWith("image") && (
                      <img src={r.media.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {!(r as any).widget_type && r.media && r.media.type?.startsWith("video") && (
                      <video src={r.media.url} className="absolute inset-0 w-full h-full object-cover" muted autoPlay loop />
                    )}
                    {!(r as any).widget_type && !r.media && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[8px] text-white/40">{r.name}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        {/* Canvas area */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <Button size="sm" variant="outline" onClick={handleAddRegion}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter une zone
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card">
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Grille</span>
              <Switch checked={showGrid} onCheckedChange={setShowGrid} />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card">
              <Magnet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Aimanter</span>
              <Switch checked={snapToGrid} onCheckedChange={setSnapToGrid} />
            </div>
            <Select value={String(gridDivisions)} onValueChange={(v) => setGridDivisions(parseInt(v))}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 divisions</SelectItem>
                <SelectItem value="8">8 divisions</SelectItem>
                <SelectItem value="12">12 divisions</SelectItem>
                <SelectItem value="16">16 divisions</SelectItem>
                <SelectItem value="24">24 divisions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="border border-border rounded-lg overflow-hidden relative select-none mx-auto"
            style={{
              width: canvasW * scale,
              height: canvasH * scale,
              backgroundColor: layout.background_color || "#000000",
              backgroundImage: (layout as any).bg_type === "image" && (layout as any).bg_image_url ? `url(${(layout as any).bg_image_url})` : undefined,
              backgroundSize: (layout as any).bg_image_fit === "contain" ? "contain" : (layout as any).bg_image_fit === "repeat" ? "auto" : "cover",
              backgroundRepeat: (layout as any).bg_image_fit === "repeat" ? "repeat" : "no-repeat",
              backgroundPosition: "center",
            }}
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelectedRegionId(null)}
          >
            {/* Background overlay (darken + blur) */}
            {(layout as any).bg_type === "image" && (layout as any).bg_image_url && ((layout as any).bg_overlay_darken > 0 || (layout as any).bg_overlay_blur > 0) && (
              <div className="absolute inset-0 pointer-events-none z-[0]" style={{
                backgroundColor: `rgba(0,0,0,${((layout as any).bg_overlay_darken || 0) / 100})`,
                backdropFilter: (layout as any).bg_overlay_blur > 0 ? `blur(${(layout as any).bg_overlay_blur}px)` : undefined,
              }} />
            )}
            {/* Grid overlay */}
            {showGrid && (
              <>
                <div className="absolute inset-0 pointer-events-none z-[0]" style={{
                  opacity: snapToGrid ? 0.45 : 0.25,
                  backgroundImage: "linear-gradient(hsl(var(--primary) / 0.5) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.5) 1px, transparent 1px)",
                  backgroundSize: `${(canvasW * scale) / gridDivisions}px ${(canvasH * scale) / gridDivisions}px`,
                }} />
                <div className="absolute inset-0 pointer-events-none z-[0] opacity-40" style={{
                  backgroundImage: "linear-gradient(hsl(var(--primary) / 0.9) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary) / 0.9) 1px, transparent 1px)",
                  backgroundSize: `${(canvasW * scale) / 2}px ${(canvasH * scale) / 2}px`,
                  backgroundPosition: "center",
                }} />
              </>
            )}
            {regions.map((region, idx) => renderRegionOnCanvas(region, idx))}
          </div>

          {/* Region list below canvas */}
          {regions.length > 0 && (
            <div className="mt-3 space-y-1">
              {regions.map((r, idx) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    r.id === selectedRegionId ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                  onClick={() => { setSelectedRegionId(r.id); setActivePanel("properties"); }}
                >
                  <div className="w-3 h-3 rounded-sm border" style={{ backgroundColor: regionColors[idx % regionColors.length] }} />
                  <span className="font-medium">{r.name}</span>
                  <span className="opacity-60">{r.width}×{r.height}</span>
                  {(r as any).widget_type && <span className="ml-auto opacity-60">{WIDGET_TYPES.find(w => w.value === (r as any).widget_type)?.label}</span>}
                  {r.media && !(r as any).widget_type && <span className="ml-auto opacity-60">{r.media.name}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-80 shrink-0 space-y-2">
          {/* Panel tabs */}
          <div className="flex border rounded-md overflow-hidden">
            {(["presets", "background", "library", "widgets", "properties"] as const).map((tab) => (
              <button
                key={tab}
                className={`flex-1 text-[10px] sm:text-xs py-1.5 font-medium transition-colors ${activePanel === tab ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                onClick={() => setActivePanel(tab)}
              >
                {tab === "presets" ? "Templates" : tab === "background" ? "Fond" : tab === "library" ? "Médias" : tab === "widgets" ? "Widgets" : "Propriétés"}
              </button>
            ))}
          </div>

          {/* Presets */}
          {activePanel === "presets" && (
            <Card className="self-start">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" /> Layouts prédéfinis
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  Cliquez sur un modèle pour l'appliquer. Les zones existantes seront remplacées.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  // Mini preview
                  const previewW = 120;
                  const previewH = orientation === "landscape" ? 68 : 120;
                  const pw = orientation === "landscape" ? 1920 : 1080;
                  const ph = orientation === "landscape" ? 1080 : 1920;
                  const ps = Math.min(previewW / pw, previewH / ph);
                  const previewRegions = preset.regions(pw, ph);

                  return (
                    <div
                      key={preset.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer transition-colors hover:bg-primary/10 hover:border-primary/30"
                      onClick={() => handleApplyPreset(preset)}
                    >
                      <div className="shrink-0 relative bg-black rounded overflow-hidden" style={{ width: pw * ps, height: ph * ps }}>
                        {previewRegions.map((r, i) => (
                          <div
                            key={i}
                            className="absolute"
                            style={{
                              left: r.x * ps,
                              top: r.y * ps,
                              width: r.width * ps,
                              height: r.height * ps,
                              backgroundColor: regionColors[i % regionColors.length],
                              border: "1px solid hsl(185 100% 55% / 0.3)",
                            }}
                          />
                        ))}
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary" /> {preset.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{preset.description}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Background */}
          {activePanel === "background" && (
            <Card className="self-start">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" /> Fond d'écran
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Type toggle */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Type de fond</label>
                  <div className="flex border rounded-md overflow-hidden">
                    <button
                      className={`flex-1 text-xs py-2 font-medium transition-colors ${
                        (layout as any).bg_type !== "image" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                      onClick={() => updateLayout.mutate({ id: id!, bg_type: "color" })}
                    >
                      🎨 Couleur Unie
                    </button>
                    <button
                      className={`flex-1 text-xs py-2 font-medium transition-colors ${
                        (layout as any).bg_type === "image" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                      onClick={() => updateLayout.mutate({ id: id!, bg_type: "image" })}
                    >
                      🖼️ Image
                    </button>
                  </div>
                </div>

                {/* Color picker (always shown as base layer) */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Couleur de fond</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={layout.background_color || "#000000"}
                      onChange={(e) => updateLayout.mutate({ id: id!, background_color: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                    />
                    <Input
                      value={layout.background_color || "#000000"}
                      onChange={(e) => updateLayout.mutate({ id: id!, background_color: e.target.value })}
                      className="h-8 text-sm font-mono flex-1"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                {/* Image options */}
                {(layout as any).bg_type === "image" && (
                  <div className="space-y-3 border-t border-border pt-3">
                    {(layout as any).bg_image_url && (
                      <div className="relative rounded-lg overflow-hidden border border-border">
                        <img src={(layout as any).bg_image_url} alt="Fond" className="w-full h-32 object-cover" />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-6 text-[10px]"
                          onClick={() => updateLayout.mutate({ id: id!, bg_image_url: null })}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Retirer
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowBgLibrary(true)}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" /> Choisir depuis la bibliothèque
                    </Button>

                    {/* Fit mode */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Ajustement</label>
                      <Select
                        value={(layout as any).bg_image_fit || "cover"}
                        onValueChange={(v) => updateLayout.mutate({ id: id!, bg_image_fit: v })}
                      >
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cover">Remplir (Cover)</SelectItem>
                          <SelectItem value="contain">Ajuster (Contain)</SelectItem>
                          <SelectItem value="repeat">Mosaïque (Repeat)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filters */}
                    <div className="space-y-3 border-t border-border pt-3">
                      <p className="text-xs font-medium flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-primary" /> Filtres</p>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 flex justify-between">
                          Assombrir <span className="font-mono">{(layout as any).bg_overlay_darken || 0}%</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={80}
                          value={(layout as any).bg_overlay_darken || 0}
                          onChange={(e) => updateLayout.mutate({ id: id!, bg_overlay_darken: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 flex justify-between">
                          Flouter <span className="font-mono">{(layout as any).bg_overlay_blur || 0}px</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={20}
                          value={(layout as any).bg_overlay_blur || 0}
                          onChange={(e) => updateLayout.mutate({ id: id!, bg_overlay_blur: +e.target.value })}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activePanel === "library" && (
            <Card className="self-start">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="h-4 w-4" /> Médias disponibles
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  {selectedRegionId ? "Cliquez pour assigner à la zone sélectionnée" : "Sélectionnez d'abord une zone"}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="p-3 space-y-1">
                    {media.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">Aucun média.</p>
                    ) : (
                      media.map((m) => (
                        <div
                          key={m.id}
                          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors border ${
                            selectedRegionId ? "hover:bg-primary/10 hover:border-primary/30 border-transparent" : "border-transparent opacity-50 cursor-not-allowed"
                          }`}
                          onClick={() => selectedRegionId && handleAssignMedia(m.id)}
                        >
                          {m.type?.startsWith("image") ? (
                            <img src={m.url} alt={m.name} className="h-10 w-10 rounded object-cover shrink-0" />
                          ) : m.type?.startsWith("video") ? (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                              <Video className="h-5 w-5 text-accent" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                              <Globe className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground">{m.type}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Widgets */}
          {activePanel === "widgets" && (
            <Card className="self-start">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Widgets disponibles
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  {selectedRegionId ? "Cliquez pour assigner à la zone sélectionnée" : "Sélectionnez d'abord une zone"}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {WIDGET_TYPES.map((w) => {
                  const Icon = w.icon;
                  return (
                    <div
                      key={w.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRegionId ? "hover:bg-primary/10 hover:border-primary/30 border-border" : "border-border opacity-50 cursor-not-allowed"
                      }`}
                      onClick={() => selectedRegionId && handleAssignWidget(w.value)}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{w.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {w.value === "clock" && "Horloge numérique avec date"}
                          {w.value === "weather" && "Météo avec température"}
                          {w.value === "marquee" && "Message défilant personnalisable"}
                          {w.value === "fixedtext" && "Texte statique personnalisable"}
                          {w.value === "qrcode" && "QR Code interactif"}
                          {w.value === "currency" && "Cours des devises"}
                          {w.value === "rss" && "Flux RSS / actualités"}
                          {w.value === "slideshow" && "Diaporama de plusieurs images"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Properties */}
          {activePanel === "properties" && (
            <Card className="self-start">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Propriétés de la zone</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-3">
                  <div className="space-y-3">
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
                        <Input type="number" value={selectedRegion.x} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, x: +e.target.value })} className="h-8 text-sm mt-1" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Y</label>
                        <Input type="number" value={selectedRegion.y} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, y: +e.target.value })} className="h-8 text-sm mt-1" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Largeur</label>
                        <Input type="number" value={selectedRegion.width} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, width: +e.target.value })} className="h-8 text-sm mt-1" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Hauteur</label>
                        <Input type="number" value={selectedRegion.height} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, height: +e.target.value })} className="h-8 text-sm mt-1" />
                      </div>
                    </div>

                    {/* Zone colors */}
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-medium flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-primary" /> Apparence de la zone</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Fond</label>
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="color"
                              value={(selectedRegion as any).widget_config?.zone_bg || "#000000"}
                              onChange={(e) => updateRegion.mutate({
                                id: selectedRegion.id,
                                widget_config: { ...(selectedRegion as any).widget_config, zone_bg: e.target.value },
                              } as any)}
                              className="w-8 h-8 rounded border border-border cursor-pointer"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] h-6 px-1"
                              onClick={() => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, zone_bg: "transparent" } } as any)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Bordure</label>
                          <div className="flex items-center gap-1 mt-1">
                            <input
                              type="color"
                              value={(selectedRegion as any).widget_config?.zone_border || "#ffffff"}
                              onChange={(e) => updateRegion.mutate({
                                id: selectedRegion.id,
                                widget_config: { ...(selectedRegion as any).widget_config, zone_border: e.target.value },
                              } as any)}
                              className="w-8 h-8 rounded border border-border cursor-pointer"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[10px] h-6 px-1"
                              onClick={() => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, zone_border: "transparent" } } as any)}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content type selector */}
                    <div>
                      <label className="text-xs text-muted-foreground">Contenu</label>
                      <Select
                        value={(selectedRegion as any).widget_type ? `widget:${(selectedRegion as any).widget_type}` : selectedRegion.media_id ? "media" : "none"}
                        onValueChange={(v) => {
                          if (v === "none") {
                            updateRegion.mutate({ id: selectedRegion.id, media_id: null, widget_type: null, widget_config: { ...(selectedRegion as any).widget_config, zone_bg: (selectedRegion as any).widget_config?.zone_bg, zone_border: (selectedRegion as any).widget_config?.zone_border } } as any);
                          } else if (v === "media") {
                            updateRegion.mutate({ id: selectedRegion.id, widget_type: null, widget_config: { zone_bg: (selectedRegion as any).widget_config?.zone_bg, zone_border: (selectedRegion as any).widget_config?.zone_border } } as any);
                          } else if (v.startsWith("widget:")) {
                            const wType = v.replace("widget:", "");
                            const zoneProps = { zone_bg: (selectedRegion as any).widget_config?.zone_bg, zone_border: (selectedRegion as any).widget_config?.zone_border };
                            updateRegion.mutate({ id: selectedRegion.id, media_id: null, widget_type: wType, widget_config: { ...DEFAULT_WIDGET_CONFIGS[wType], ...zoneProps } } as any);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          <SelectItem value="media">📷 Média</SelectItem>
                          {WIDGET_TYPES.map((w) => (
                            <SelectItem key={w.value} value={`widget:${w.value}`}>🧩 {w.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Media selector */}
                    {!(selectedRegion as any).widget_type && (
                      <div>
                        <label className="text-xs text-muted-foreground">Média assigné</label>
                        <Select
                          value={selectedRegion.media_id || "none"}
                          onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, media_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Aucun</SelectItem>
                            {media.map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Transparent background toggle for all widgets */}
                    {(selectedRegion as any).widget_type && (
                      <div className="border-t border-border pt-3 space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={(selectedRegion as any).widget_config?.transparentBg === true}
                              onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, transparentBg: e.target.checked } } as any)}
                            />
                            🪟 Fond transparent
                          </label>
                          <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">Rend le fond du widget transparent</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">🎨 Couleur du texte</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={(selectedRegion as any).widget_config?.textColor || "#ffffff"}
                              onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)}
                              className="w-8 h-8 rounded border border-border cursor-pointer"
                            />
                            <input
                              type="text"
                              value={(selectedRegion as any).widget_config?.textColor || "#ffffff"}
                              onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)}
                              className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs font-mono"
                              placeholder="#ffffff"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Widget-specific configs */}
                    {(selectedRegion as any).widget_type === "marquee" && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium">Configuration Texte défilant</p>
                        <div>
                          <label className="text-xs text-muted-foreground">Texte</label>
                          <Input value={(selectedRegion as any).widget_config?.text || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, text: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Vitesse</label>
                          <Input type="number" value={(selectedRegion as any).widget_config?.speed || 80} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, speed: +e.target.value } } as any)} className="h-8 text-sm mt-1" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">🎨 Couleur du texte</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="w-10 h-8 rounded border border-border cursor-pointer" />
                            <Input value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="h-8 text-xs flex-1" placeholder="#ffffff" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Taille du texte (px)</label>
                          <Input type="number" value={(selectedRegion as any).widget_config?.fontSize || 24} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, fontSize: +e.target.value } } as any)} className="h-8 text-sm mt-1" />
                        </div>
                      </div>
                    )}

                    {(selectedRegion as any).widget_type === "weather" && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium">Configuration Météo</p>
                        <div>
                          <label className="text-xs text-muted-foreground flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={(selectedRegion as any).widget_config?.useRealtime !== false}
                              onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, useRealtime: e.target.checked } } as any)}
                            />
                            🌐 Météo temps réel (Open-Meteo)
                          </label>
                          <p className="text-[10px] text-muted-foreground mt-0.5 ml-5">Données actualisées toutes les 10 min, sans clé API</p>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Pays</label>
                          <Select value={(selectedRegion as any).widget_config?.country || "FR"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, country: v } } as any)}>
                            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COUNTRY_LIST.map((c) => (
                                <SelectItem key={c.code} value={c.code}>{c.flag} {c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Ville</label>
                          <Input value={(selectedRegion as any).widget_config?.city || "Paris"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, city: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                        </div>
                        {(selectedRegion as any).widget_config?.useRealtime === false && (
                          <>
                            <div>
                              <label className="text-xs text-muted-foreground">Température (°C)</label>
                              <Input type="number" value={(selectedRegion as any).widget_config?.temperature ?? 22} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, temperature: +e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Condition</label>
                              <Select value={(selectedRegion as any).widget_config?.condition || "sunny"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, condition: v } } as any)}>
                                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sunny">☀️ Ensoleillé</SelectItem>
                                  <SelectItem value="cloudy">☁️ Nuageux</SelectItem>
                                  <SelectItem value="rainy">🌧️ Pluvieux</SelectItem>
                                  <SelectItem value="snowy">❄️ Neigeux</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {(selectedRegion as any).widget_type === "clock" && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium">Configuration Horloge</p>
                        <div>
                          <label className="text-xs text-muted-foreground">Format</label>
                          <Select value={(selectedRegion as any).widget_config?.format || "24h"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, format: v } } as any)}>
                            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="24h">24h</SelectItem>
                              <SelectItem value="12h">12h (AM/PM)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Fuseau horaire (GMT)</label>
                          <Select
                            value={(selectedRegion as any).widget_config?.gmtOffset !== null && (selectedRegion as any).widget_config?.gmtOffset !== undefined ? String((selectedRegion as any).widget_config.gmtOffset) : "local"}
                            onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, gmtOffset: v === "local" ? null : parseFloat(v) } } as any)}
                          >
                            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">🖥️ Heure locale</SelectItem>
                              {GMT_OFFSETS.map((o) => (
                                <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-muted-foreground flex items-center gap-2">
                            <input type="checkbox" checked={(selectedRegion as any).widget_config?.showDate !== false} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, showDate: e.target.checked } } as any)} />
                            Date
                          </label>
                          <label className="text-xs text-muted-foreground flex items-center gap-2">
                            <input type="checkbox" checked={(selectedRegion as any).widget_config?.showSeconds !== false} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, showSeconds: e.target.checked } } as any)} />
                            Secondes
                          </label>
                        </div>
                      </div>
                    )}

                    {(selectedRegion as any).widget_type === "fixedtext" && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium">Configuration Texte fixe</p>
                        <div>
                          <label className="text-xs text-muted-foreground">Texte</label>
                          <Input value={(selectedRegion as any).widget_config?.text || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, text: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Taille</label>
                            <Input type="number" value={(selectedRegion as any).widget_config?.fontSize || 24} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, fontSize: +e.target.value } } as any)} className="h-8 text-sm mt-1" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">🎨 Couleur du texte</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input type="color" value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="w-8 h-8 rounded border border-border cursor-pointer" />
                              <Input value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="h-8 text-sm flex-1" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Alignement</label>
                          <Select value={(selectedRegion as any).widget_config?.textAlign || "center"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textAlign: v } } as any)}>
                            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="left">Gauche</SelectItem>
                              <SelectItem value="center">Centre</SelectItem>
                              <SelectItem value="right">Droite</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {(selectedRegion as any).widget_type === "qrcode" && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium">Configuration QR Code</p>
                        <div>
                          <label className="text-xs text-muted-foreground">Type de QR Code</label>
                          <Select value={(selectedRegion as any).widget_config?.qrType || "url"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, qrType: v } } as any)}>
                            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {QR_CODE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label} — {t.description}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* URL */}
                        {((selectedRegion as any).widget_config?.qrType || "url") === "url" && (
                          <div>
                            <label className="text-xs text-muted-foreground">URL</label>
                            <Input value={(selectedRegion as any).widget_config?.url || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, url: e.target.value } } as any)} className="h-8 text-sm mt-1" placeholder="https://..." />
                          </div>
                        )}

                        {/* Location */}
                        {(selectedRegion as any).widget_config?.qrType === "location" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Latitude</label>
                              <Input value={(selectedRegion as any).widget_config?.latitude || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, latitude: e.target.value } } as any)} className="h-8 text-sm mt-1" placeholder="33.5731" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Longitude</label>
                              <Input value={(selectedRegion as any).widget_config?.longitude || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, longitude: e.target.value } } as any)} className="h-8 text-sm mt-1" placeholder="-7.5898" />
                            </div>
                          </div>
                        )}

                        {/* Contact vCard */}
                        {(selectedRegion as any).widget_config?.qrType === "contact" && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Nom complet</label>
                              <Input value={(selectedRegion as any).widget_config?.contactName || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, contactName: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Téléphone</label>
                              <Input value={(selectedRegion as any).widget_config?.contactPhone || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, contactPhone: e.target.value } } as any)} className="h-8 text-sm mt-1" placeholder="+212..." />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Email</label>
                              <Input value={(selectedRegion as any).widget_config?.contactEmail || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, contactEmail: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Organisation</label>
                              <Input value={(selectedRegion as any).widget_config?.contactOrg || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, contactOrg: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                          </div>
                        )}

                        {/* WiFi */}
                        {(selectedRegion as any).widget_config?.qrType === "wifi" && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Nom du réseau (SSID)</label>
                              <Input value={(selectedRegion as any).widget_config?.wifiSsid || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, wifiSsid: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Mot de passe</label>
                              <Input value={(selectedRegion as any).widget_config?.wifiPassword || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, wifiPassword: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Chiffrement</label>
                              <Select value={(selectedRegion as any).widget_config?.wifiEncryption || "WPA"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, wifiEncryption: v } } as any)}>
                                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="WPA">WPA/WPA2</SelectItem>
                                  <SelectItem value="WEP">WEP</SelectItem>
                                  <SelectItem value="nopass">Aucun</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}

                        {/* Email */}
                        {(selectedRegion as any).widget_config?.qrType === "email" && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Adresse email</label>
                              <Input value={(selectedRegion as any).widget_config?.emailAddress || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, emailAddress: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Sujet</label>
                              <Input value={(selectedRegion as any).widget_config?.emailSubject || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, emailSubject: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                            </div>
                          </div>
                        )}

                        {/* Phone */}
                        {(selectedRegion as any).widget_config?.qrType === "phone" && (
                          <div>
                            <label className="text-xs text-muted-foreground">Numéro de téléphone</label>
                            <Input value={(selectedRegion as any).widget_config?.phoneNumber || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, phoneNumber: e.target.value } } as any)} className="h-8 text-sm mt-1" placeholder="+212..." />
                          </div>
                        )}

                        {/* Free text */}
                        {(selectedRegion as any).widget_config?.qrType === "text" && (
                          <div>
                            <label className="text-xs text-muted-foreground">Texte libre</label>
                            <Input value={(selectedRegion as any).widget_config?.freeText || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, freeText: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-muted-foreground">Label</label>
                          <Input value={(selectedRegion as any).widget_config?.label || ""} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, label: e.target.value } } as any)} className="h-8 text-sm mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Fond</label>
                            <input type="color" value={(selectedRegion as any).widget_config?.bgColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, bgColor: e.target.value } } as any)} className="w-full h-8 mt-1 rounded border border-border cursor-pointer" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">QR</label>
                            <input type="color" value={(selectedRegion as any).widget_config?.fgColor || "#000000"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, fgColor: e.target.value } } as any)} className="w-full h-8 mt-1 rounded border border-border cursor-pointer" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">🎨 Couleur du label</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={(selectedRegion as any).widget_config?.fgColor || "#000000"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, fgColor: e.target.value } } as any)} className="w-10 h-8 rounded border border-border cursor-pointer" />
                            <Input value={(selectedRegion as any).widget_config?.fgColor || "#000000"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, fgColor: e.target.value } } as any)} className="h-8 text-xs flex-1" placeholder="#000000" />
                          </div>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Utilisée pour le QR et le label</p>
                        </div>
                      </div>
                    )}

                    {(selectedRegion as any).widget_type === "currency" && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium">Configuration Cours de devises</p>
                        <div>
                          <label className="text-xs text-muted-foreground">Mode</label>
                          <Select value={(selectedRegion as any).widget_config?.mode || "auto"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, mode: v } } as any)}>
                            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">🌐 Automatique (Internet)</SelectItem>
                              <SelectItem value="manual">✏️ Manuel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Devise de base</label>
                          <Select value={(selectedRegion as any).widget_config?.baseCurrency || "EUR"} onValueChange={(v) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, baseCurrency: v } } as any)}>
                            <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {POPULAR_CURRENCIES.map((c) => (
                                <SelectItem key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Devises cibles</label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {POPULAR_CURRENCIES.filter(c => c.code !== ((selectedRegion as any).widget_config?.baseCurrency || "EUR")).map((c) => {
                              const targets: string[] = (selectedRegion as any).widget_config?.targetCurrencies || ["USD", "TND", "GBP"];
                              const isSelected = targets.includes(c.code);
                              return (
                                <button
                                  key={c.code}
                                  type="button"
                                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:border-primary/50"}`}
                                  onClick={() => {
                                    const newTargets = isSelected ? targets.filter(t => t !== c.code) : [...targets, c.code];
                                    updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, targetCurrencies: newTargets } } as any);
                                  }}
                                >
                                  {c.flag} {c.code}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {(selectedRegion as any).widget_config?.mode === "manual" && (
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">Taux manuels</label>
                            {((selectedRegion as any).widget_config?.targetCurrencies || ["USD", "TND", "GBP"]).map((code: string) => {
                              const info = POPULAR_CURRENCIES.find(c => c.code === code);
                              return (
                                <div key={code} className="flex items-center gap-2">
                                  <span className="text-xs w-16">{info?.flag} {code}</span>
                                  <Input
                                    type="number"
                                    step="0.0001"
                                    value={(selectedRegion as any).widget_config?.manualRates?.[code] || ""}
                                    onChange={(e) => {
                                      const newRates = { ...((selectedRegion as any).widget_config?.manualRates || {}), [code]: parseFloat(e.target.value) || 0 };
                                      updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, manualRates: newRates } } as any);
                                    }}
                                    className="h-7 text-xs flex-1"
                                    placeholder="0.0000"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-muted-foreground">🎨 Couleur du texte</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="w-10 h-8 rounded border border-border cursor-pointer" />
                            <Input value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="h-8 text-xs flex-1" placeholder="#ffffff" />
                          </div>
                        </div>
                      </div>
                    )}

                    {(selectedRegion as any).widget_type === "rss" && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-medium">Configuration Flux RSS</p>
                        <div>
                          <label className="text-xs text-muted-foreground">URL du flux</label>
                          <Input
                            value={(selectedRegion as any).widget_config?.feedUrl || ""}
                            onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, feedUrl: e.target.value } } as any)}
                            className="h-8 text-sm mt-1"
                            placeholder="https://example.com/rss.xml"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Nb articles</label>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={(selectedRegion as any).widget_config?.maxItems || 5}
                              onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, maxItems: +e.target.value } } as any)}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Vitesse</label>
                            <Input
                              type="number"
                              min={10}
                              max={100}
                              value={(selectedRegion as any).widget_config?.scrollSpeed || 30}
                              onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, scrollSpeed: +e.target.value } } as any)}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                        </div>
                        <label className="text-xs text-muted-foreground flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(selectedRegion as any).widget_config?.showDescription === true}
                            onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, showDescription: e.target.checked } } as any)}
                          />
                          Afficher les descriptions
                        </label>
                        <div>
                          <label className="text-xs text-muted-foreground">Couleur d'accent</label>
                          <input type="color" value={(selectedRegion as any).widget_config?.accentColor || "#3b82f6"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, accentColor: e.target.value } } as any)} className="w-full h-8 mt-1 rounded border border-border cursor-pointer" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">🎨 Couleur du texte</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="w-10 h-8 rounded border border-border cursor-pointer" />
                            <Input value={(selectedRegion as any).widget_config?.textColor || "#ffffff"} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, widget_config: { ...(selectedRegion as any).widget_config, textColor: e.target.value } } as any)} className="h-8 text-xs flex-1" placeholder="#ffffff" />
                          </div>
                        </div>
                      </div>
                    )}

                    {(selectedRegion as any).widget_type === "slideshow" && (() => {
                      const cfg = (selectedRegion as any).widget_config || {};
                      const slideItems: any[] = Array.isArray(cfg.items) ? cfg.items : [];
                      const updateCfg = (patch: any) =>
                        updateRegion.mutate({
                          id: selectedRegion.id,
                          widget_config: { ...cfg, ...patch },
                        } as any);
                      const updateItem = (idx: number, patch: any) => {
                        const next = slideItems.map((it, i) => (i === idx ? { ...it, ...patch } : it));
                        updateCfg({ items: next });
                      };
                      const removeItem = (idx: number) => {
                        const next = slideItems.filter((_, i) => i !== idx);
                        updateCfg({ items: next });
                      };
                      const moveItem = (idx: number, dir: -1 | 1) => {
                        const j = idx + dir;
                        if (j < 0 || j >= slideItems.length) return;
                        const next = [...slideItems];
                        [next[idx], next[j]] = [next[j], next[idx]];
                        updateCfg({ items: next });
                      };
                      return (
                        <div className="space-y-3 border-t border-border pt-3">
                          <p className="text-xs font-medium flex items-center gap-1.5">
                            <Images className="h-3.5 w-3.5 text-primary" /> Configuration Diaporama
                          </p>

                          <div>
                            <label className="text-xs text-muted-foreground">Source</label>
                            <Select
                              value={cfg.playlistId ? "playlist" : "manual"}
                              onValueChange={(v) =>
                                updateCfg(v === "playlist" ? { playlistId: playlists[0]?.id ?? null } : { playlistId: null })
                              }
                            >
                              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="manual">📷 Sélection manuelle</SelectItem>
                                <SelectItem value="playlist">🎵 Playlist existante</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {cfg.playlistId && (
                            <div>
                              <label className="text-xs text-muted-foreground">Playlist</label>
                              <Select value={cfg.playlistId} onValueChange={(v) => updateCfg({ playlistId: v })}>
                                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                <SelectContent>
                                  {playlists.length === 0 ? (
                                    <SelectItem value="__none" disabled>Aucune playlist</SelectItem>
                                  ) : (
                                    playlists.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Les médias et l'ordre sont récupérés depuis la playlist.
                              </p>
                            </div>
                          )}

                          {!cfg.playlistId && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-muted-foreground">Médias ({slideItems.length})</label>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowSlideshowPicker(true)}>
                                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                                </Button>
                              </div>
                              {slideItems.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground italic">
                                  Aucun média. Cliquez sur "Ajouter" pour ajouter des images ou vidéos.
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {slideItems.map((it, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-1.5 border border-border rounded">
                                      {it.type?.startsWith("video") ? (
                                        <div className="relative h-9 w-12 rounded overflow-hidden shrink-0 bg-muted">
                                          <video src={it.url} className="h-full w-full object-cover" muted preload="metadata" />
                                          <Video className="absolute bottom-0.5 right-0.5 h-3 w-3 text-white drop-shadow" />
                                        </div>
                                      ) : (
                                        <img src={it.url} alt="" className="h-9 w-12 rounded object-cover shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-muted-foreground">#{idx + 1} • durée (s)</p>
                                        <Input
                                          type="number"
                                          min={1}
                                          value={it.duration ?? cfg.defaultDuration ?? 5}
                                          onChange={(e) => updateItem(idx, { duration: Math.max(1, +e.target.value) })}
                                          className="h-6 text-xs"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-0.5">
                                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => moveItem(idx, -1)} disabled={idx === 0}>
                                          <ArrowUp className="h-3 w-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => moveItem(idx, 1)} disabled={idx === slideItems.length - 1}>
                                          <ArrowDown className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeItem(idx)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Durée par défaut (s)</label>
                              <Input type="number" min={1} value={cfg.defaultDuration ?? 5} onChange={(e) => updateCfg({ defaultDuration: Math.max(1, +e.target.value) })} className="h-8 text-sm mt-1" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Transition (ms)</label>
                              <Input type="number" min={0} step={100} value={cfg.transitionDuration ?? 600} onChange={(e) => updateCfg({ transitionDuration: Math.max(0, +e.target.value) })} className="h-8 text-sm mt-1" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Effet de transition</label>
                            <Select value={cfg.transition || "fade"} onValueChange={(v) => updateCfg({ transition: v })}>
                              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fade">Fondu</SelectItem>
                                <SelectItem value="slide">Glissement</SelectItem>
                                <SelectItem value="none">Aucune</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Ajustement</label>
                            <Select value={cfg.fit || "cover"} onValueChange={(v) => updateCfg({ fit: v })}>
                              <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cover">Remplir (cover)</SelectItem>
                                <SelectItem value="contain">Ajuster (contain)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Couleur de fond</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input type="color" value={cfg.backgroundColor || "#000000"} onChange={(e) => updateCfg({ backgroundColor: e.target.value })} className="w-10 h-8 rounded border border-border cursor-pointer" />
                              <Input value={cfg.backgroundColor || "#000000"} onChange={(e) => updateCfg({ backgroundColor: e.target.value })} className="h-8 text-xs flex-1 font-mono" />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {selectedRegion.media && !(selectedRegion as any).widget_type && (
                      <div className="border rounded-md overflow-hidden">
                        {selectedRegion.media.type?.startsWith("image") ? (
                          <img src={selectedRegion.media.url} alt={selectedRegion.media.name} className="w-full h-32 object-cover" />
                        ) : selectedRegion.media.type?.startsWith("video") ? (
                          <video src={selectedRegion.media.url} className="w-full h-32 object-cover" muted autoPlay loop />
                        ) : (
                          <div className="w-full h-32 bg-muted flex items-center justify-center">
                            <Globe className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-muted-foreground">Z-Index</label>
                      <Input type="number" value={selectedRegion.z_index} onChange={(e) => updateRegion.mutate({ id: selectedRegion.id, z_index: +e.target.value })} className="h-8 text-sm mt-1" />
                    </div>
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => { deleteRegion.mutate(selectedRegion.id); setSelectedRegionId(null); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer la zone
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sélectionnez une zone pour modifier ses propriétés.</p>
                )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Background Image Library Modal */}
      <Dialog open={showBgLibrary} onOpenChange={setShowBgLibrary}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" /> Choisir une image de fond
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <div className="grid grid-cols-3 gap-3 p-1">
              {media.filter(m => m.type?.startsWith("image")).length === 0 ? (
                <p className="col-span-3 text-center text-sm text-muted-foreground py-12">Aucune image dans la bibliothèque.</p>
              ) : (
                media.filter(m => m.type?.startsWith("image")).map((m) => {
                  const isSelected = (layout as any).bg_image_url === m.url;
                  return (
                    <div
                      key={m.id}
                      className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:border-primary/60 ${
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border"
                      }`}
                      onClick={() => {
                        updateLayout.mutate({ id: id!, bg_image_url: m.url, bg_type: "image" });
                        setShowBgLibrary(false);
                        toast({ title: "Image de fond appliquée" });
                      }}
                    >
                      <img src={m.url} alt={m.name} className="w-full h-28 object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        {isSelected && (
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-5 w-5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1 truncate">{m.name}</p>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Slideshow media picker */}
      <Dialog open={showSlideshowPicker} onOpenChange={setShowSlideshowPicker}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Images className="h-5 w-5 text-primary" /> Ajouter des images au diaporama
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Cliquez sur les images à ajouter. Elles seront empilées dans l'ordre des clics.
          </p>
          <ScrollArea className="h-[400px]">
            <div className="grid grid-cols-3 gap-3 p-1">
              {media.filter((m) => m.type?.startsWith("image") || m.type?.startsWith("video")).length === 0 ? (
                <p className="col-span-3 text-center text-sm text-muted-foreground py-12">
                  Aucun média dans la bibliothèque.
                </p>
              ) : (
                media
                  .filter((m) => m.type?.startsWith("image") || m.type?.startsWith("video"))
                  .map((m) => {
                    const region = selectedRegion;
                    const cfg = (region as any)?.widget_config || {};
                    const items: any[] = Array.isArray(cfg.items) ? cfg.items : [];
                    const alreadyCount = items.filter((it) => it.url === m.url).length;
                    return (
                      <div
                        key={m.id}
                        className="relative group rounded-lg overflow-hidden border-2 border-border cursor-pointer hover:border-primary/60 transition-all"
                        onClick={() => {
                          if (!region) return;
                          const next = [
                            ...items,
                            { url: m.url, type: m.type, duration: cfg.defaultDuration ?? 5 },
                          ];
                          updateRegion.mutate({
                            id: region.id,
                            widget_config: { ...cfg, items: next },
                          } as any);
                          toast({ title: `"${m.name}" ajouté au diaporama` });
                        }}
                      >
                        {m.type?.startsWith("image") ? (
                          <img src={m.url} alt={m.name} className="w-full h-28 object-cover" />
                        ) : (
                          <div className="relative w-full h-28 bg-muted">
                            <video src={m.url} className="w-full h-full object-cover" muted preload="metadata" />
                            <span className="absolute bottom-1 left-1 px-1 rounded bg-black/60 text-white text-[9px] font-semibold">VIDÉO</span>
                          </div>
                        )}
                        {alreadyCount > 0 && (
                          <div className="absolute top-1 right-1 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                            ×{alreadyCount}
                          </div>
                        )}
                        <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1 truncate">{m.name}</p>
                      </div>
                    );
                  })
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setShowSlideshowPicker(false)}>Terminé</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
