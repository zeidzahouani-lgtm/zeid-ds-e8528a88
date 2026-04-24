import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useLayouts } from "@/hooks/useLayouts";
import { useVideoWalls } from "@/hooks/useVideoWalls";
import { Grid3x3, Eye, Settings, Plus, Trash2, Image as ImageIcon, ListMusic, Ban, RotateCcw, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  wall: { id: string; name: string; rows: number; cols: number } | null;
}

type SourceType = "none" | "media" | "playlist" | "layout";

const ORIENTATION_ROTATION: Record<string, number> = {
  landscape: 0,
  portrait: 90,
  "landscape-flipped": 180,
  "portrait-flipped": 270,
};

export function WallConfigDialog({ open, onOpenChange, wall }: Props) {
  const { screens } = useScreens();
  const { media } = useMedia();
  const { playlists } = usePlaylists();
  const { layouts } = useLayouts();
  const { assignSourceToWall, addScreenToWall, removeScreenFromWall, moveScreenInWall, updateScreenOrientation } = useVideoWalls();

  const [sourceType, setSourceType] = useState<SourceType>("none");
  const [mediaId, setMediaId] = useState<string>("");
  const [playlistId, setPlaylistId] = useState<string>("");
  const [layoutId, setLayoutId] = useState<string>("");
  const [syncAll, setSyncAll] = useState(true);

  // Add-screen state
  const [addScreenId, setAddScreenId] = useState("");
  const [addRow, setAddRow] = useState(0);
  const [addCol, setAddCol] = useState(0);

  const wallScreens = useMemo(
    () => (wall ? screens.filter((s: any) => s.wall_id === wall.id) : []),
    [screens, wall]
  );

  const standaloneScreens = useMemo(
    () => screens.filter((s: any) => !s.wall_id),
    [screens]
  );

  // Detect if all screens currently share a single source (auto-init the controls)
  useEffect(() => {
    if (!wall || wallScreens.length === 0) {
      setSourceType("none");
      setMediaId("");
      setPlaylistId("");
      setLayoutId("");
      return;
    }
    const firstMedia = wallScreens[0].current_media_id;
    const firstPlaylist = (wallScreens[0] as any).playlist_id;
    const firstLayout = (wallScreens[0] as any).layout_id;
    const allSameMedia = firstMedia && wallScreens.every((s: any) => s.current_media_id === firstMedia);
    const allSamePlaylist = firstPlaylist && wallScreens.every((s: any) => s.playlist_id === firstPlaylist);
    const allSameLayout = firstLayout && wallScreens.every((s: any) => s.layout_id === firstLayout);
    if (allSameLayout) {
      setSourceType("layout");
      setLayoutId(firstLayout);
    } else if (allSamePlaylist) {
      setSourceType("playlist");
      setPlaylistId(firstPlaylist);
    } else if (allSameMedia) {
      setSourceType("media");
      setMediaId(firstMedia);
    }
  }, [wall?.id, wallScreens.length]);

  // Find the next free cell for adding screens
  useEffect(() => {
    if (!wall) return;
    const occupied = new Set(wallScreens.map((s: any) => `${s.wall_row}-${s.wall_col}`));
    for (let r = 0; r < wall.rows; r++) {
      for (let c = 0; c < wall.cols; c++) {
        if (!occupied.has(`${r}-${c}`)) {
          setAddRow(r);
          setAddCol(c);
          return;
        }
      }
    }
  }, [wall?.id, wallScreens.length]);

  if (!wall) return null;

  const handleApplySource = async () => {
    try {
      await assignSourceToWall.mutateAsync({
        wallId: wall.id,
        mediaId: sourceType === "media" ? mediaId || null : null,
        playlistId: sourceType === "playlist" ? playlistId || null : null,
        layoutId: sourceType === "layout" ? layoutId || null : null,
      });
      toast.success(syncAll ? "Source synchronisée sur tous les écrans" : "Source appliquée");
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const handleAddScreen = async () => {
    if (!addScreenId) {
      toast.error("Choisissez un écran");
      return;
    }
    try {
      await addScreenToWall.mutateAsync({ wallId: wall.id, screenId: addScreenId, row: addRow, col: addCol });
      toast.success("Écran ajouté au mur");
      setAddScreenId("");
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  const handleRemoveScreen = async (screenId: string) => {
    try {
      await removeScreenFromWall.mutateAsync(screenId);
      toast.success("Écran retiré du mur");
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  // Check cell occupancy
  const cellMap = new Map<string, any>();
  wallScreens.forEach((s: any) => {
    if (s.wall_row != null && s.wall_col != null) cellMap.set(`${s.wall_row}-${s.wall_col}`, s);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-primary" />
            Configuration : {wall.name}
          </DialogTitle>
          <DialogDescription>
            Mur {wall.rows}×{wall.cols} • {wallScreens.length}/{wall.rows * wall.cols} écran(s) assigné(s)
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="preview" className="gap-2"><Eye className="h-4 w-4" /> Aperçu</TabsTrigger>
            <TabsTrigger value="source" className="gap-2"><ImageIcon className="h-4 w-4" /> Source</TabsTrigger>
            <TabsTrigger value="screens" className="gap-2"><Settings className="h-4 w-4" /> Écrans</TabsTrigger>
          </TabsList>

          {/* ============== PREVIEW ============== */}
          <TabsContent value="preview" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aperçu temps réel — chaque case affiche ce que diffuse réellement le player de l'écran (avec son orientation).
            </p>
            <div
              className="border border-border rounded-lg p-2 bg-muted/30 mx-auto"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${wall.cols}, 1fr)`,
                gridTemplateRows: `repeat(${wall.rows}, 1fr)`,
                gap: 4,
                aspectRatio: `${wall.cols * 16} / ${wall.rows * 9}`,
                maxWidth: 800,
                width: "100%",
              }}
            >
              {Array.from({ length: wall.rows * wall.cols }).map((_, i) => {
                const r = Math.floor(i / wall.cols);
                const c = i % wall.cols;
                const screen = cellMap.get(`${r}-${c}`);
                const orientation = screen?.orientation || "landscape";
                const rotation = ORIENTATION_ROTATION[orientation] ?? 0;
                const isPortrait = rotation === 90 || rotation === 270;

                return (
                  <div
                    key={i}
                    className="relative bg-black border border-primary/30 rounded overflow-hidden"
                  >
                    {screen ? (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            width: isPortrait ? "100%" : "100%",
                            height: isPortrait ? "100%" : "100%",
                            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                            transformOrigin: "center center",
                          }}
                        >
                          <iframe
                            key={`${screen.id}-${orientation}`}
                            src={`/player/${screen.slug || screen.id}?preview=1&orient=${orientation}`}
                            title={screen.name}
                            className="w-full h-full border-0 bg-black pointer-events-none"
                            allow="autoplay"
                            style={{ width: "100%", height: "100%" }}
                          />
                        </div>
                        <div className="absolute top-1 left-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-mono z-10">
                          {r + 1}-{c + 1}
                        </div>
                        <div className="absolute bottom-1 right-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] z-10 flex items-center gap-1">
                          <RotateCcw className="h-2.5 w-2.5" />
                          {rotation}°
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-muted/40">
                        <Plus className="h-4 w-4 opacity-40" />
                        <span className="text-[10px] mt-1">{r + 1}-{c + 1}</span>
                        <span className="text-[9px] opacity-60">Vide</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ============== SOURCE ============== */}
          <TabsContent value="source" className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
              <div>
                <Label className="text-sm">Synchroniser sur tous les écrans du mur</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Si activé, la source sélectionnée remplace la configuration de chaque écran. Sinon, gardez la config par écran via la liste.
                </p>
              </div>
              <Switch checked={syncAll} onCheckedChange={setSyncAll} />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {([
                { v: "none", icon: Ban, label: "Aucune" },
                { v: "media", icon: ImageIcon, label: "Média" },
                { v: "playlist", icon: ListMusic, label: "Playlist" },
                { v: "layout", icon: LayoutGrid, label: "Layout" },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSourceType(v)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition ${
                    sourceType === v ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>

            {sourceType === "media" && (
              <Select value={mediaId} onValueChange={setMediaId}>
                <SelectTrigger><SelectValue placeholder={media.length === 0 ? "Aucun média disponible" : "Choisir un média"} /></SelectTrigger>
                <SelectContent>
                  {media.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun média dans la bibliothèque</div>}
                  {media.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} <span className="text-xs text-muted-foreground">({m.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {sourceType === "playlist" && (
              <Select value={playlistId} onValueChange={setPlaylistId}>
                <SelectTrigger><SelectValue placeholder={playlists.length === 0 ? "Aucune playlist disponible" : "Choisir une playlist"} /></SelectTrigger>
                <SelectContent>
                  {playlists.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucune playlist créée</div>}
                  {playlists.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {sourceType === "layout" && (
              <Select value={layoutId} onValueChange={setLayoutId}>
                <SelectTrigger><SelectValue placeholder={layouts.length === 0 ? "Aucun layout disponible" : "Choisir un layout"} /></SelectTrigger>
                <SelectContent>
                  {layouts.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun layout créé</div>}
                  {layouts.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              onClick={handleApplySource}
              disabled={assignSourceToWall.isPending || !syncAll}
              className="w-full"
            >
              {assignSourceToWall.isPending
                ? "Application..."
                : syncAll
                ? `Appliquer à ${wallScreens.length} écran(s)`
                : "Mode personnalisé — Modifiez chaque écran depuis l'onglet Écrans"}
            </Button>
          </TabsContent>

          {/* ============== SCREENS ============== */}
          <TabsContent value="screens" className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Écrans du mur</Label>
              {wallScreens.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 border border-dashed rounded">Aucun écran assigné.</p>
              ) : (
                <div className="space-y-1.5">
                  {wallScreens
                    .sort((a: any, b: any) => (a.wall_row - b.wall_row) || (a.wall_col - b.wall_col))
                    .map((s: any) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-muted/20">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {s.wall_row + 1}-{s.wall_col + 1}
                        </Badge>
                        <span className="text-sm font-medium flex-1 min-w-[120px] truncate">{s.name}</span>

                        {/* Position (row/col) — instant update */}
                        <Select
                          value={String(s.wall_row)}
                          onValueChange={(v) => moveScreenInWall.mutate({ wallId: wall.id, screenId: s.id, row: parseInt(v), col: s.wall_col })}
                        >
                          <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: wall.rows }).map((_, i) => (
                              <SelectItem key={i} value={String(i)}>L{i + 1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(s.wall_col)}
                          onValueChange={(v) => moveScreenInWall.mutate({ wallId: wall.id, screenId: s.id, row: s.wall_row, col: parseInt(v) })}
                        >
                          <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: wall.cols }).map((_, i) => (
                              <SelectItem key={i} value={String(i)}>C{i + 1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Orientation — instant update, syncs preview */}
                        <Select
                          value={s.orientation || "landscape"}
                          onValueChange={(v) => updateScreenOrientation.mutate({ screenId: s.id, orientation: v })}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <RotateCcw className="h-3 w-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="landscape">Paysage 0°</SelectItem>
                            <SelectItem value="portrait">Portrait 90°</SelectItem>
                            <SelectItem value="landscape-flipped">Paysage 180°</SelectItem>
                            <SelectItem value="portrait-flipped">Portrait 270°</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveScreen(s.id)}
                          title="Retirer du mur"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-3 border-t border-border">
              <Label className="text-sm">Ajouter un écran existant</Label>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Select value={addScreenId} onValueChange={setAddScreenId}>
                    <SelectTrigger><SelectValue placeholder="Choisir un écran" /></SelectTrigger>
                    <SelectContent>
                      {standaloneScreens.length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground">Aucun écran libre</div>
                      )}
                      {standaloneScreens.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Select value={String(addRow)} onValueChange={(v) => setAddRow(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Lig." /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: wall.rows }).map((_, i) => (
                        <SelectItem key={i} value={String(i)}>L{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Select value={String(addCol)} onValueChange={(v) => setAddCol(parseInt(v))}>
                    <SelectTrigger><SelectValue placeholder="Col." /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: wall.cols }).map((_, i) => (
                        <SelectItem key={i} value={String(i)}>C{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="col-span-2 gap-1"
                  onClick={handleAddScreen}
                  disabled={addScreenToWall.isPending || !addScreenId}
                >
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </div>
              {cellMap.has(`${addRow}-${addCol}`) && (
                <p className="text-xs text-yellow-600">
                  ⚠ La case L{addRow + 1}-C{addCol + 1} est déjà occupée. L'écran existant restera et le nouveau le rejoindra à la même position.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
