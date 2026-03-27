import { useState, useMemo } from "react";
import { Monitor, Plus, Trash2, RotateCcw, Wifi, WifiOff, ExternalLink, LayoutGrid, ListMusic, Image, Smartphone, Laptop, Tablet, CalendarClock, RefreshCw, Tv, Power, Eye, ShieldAlert, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { useLayouts } from "@/hooks/useLayouts";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePrograms } from "@/hooks/usePrograms";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScreenLicenses } from "@/hooks/useScreenLicenses";

type OrientationPreview = {
  label: string;
  rotationClass: string;
};

const ORIENTATION_PREVIEWS: Record<string, OrientationPreview> = {
  landscape: { label: "0°", rotationClass: "rotate-0" },
  portrait: { label: "90°", rotationClass: "rotate-90" },
  "landscape-flipped": { label: "180°", rotationClass: "rotate-180" },
  "portrait-flipped": { label: "270°", rotationClass: "-rotate-90" },
};

const getOrientationPreview = (orientation: string): OrientationPreview =>
  ORIENTATION_PREVIEWS[orientation] ?? ORIENTATION_PREVIEWS.landscape;

import { isScreenReallyOnline } from "@/lib/screen-utils";

function parseUserAgent(ua: string | null): { device: string; icon: React.ReactNode } {
  if (!ua) return { device: "Inconnu", icon: <Monitor className="h-3 w-3" /> };
  const lower = ua.toLowerCase();
  // Smart TVs
  if (lower.includes("webos") || lower.includes("lgwebos") || lower.includes("lg netcast"))
    return { device: "LG WebOS", icon: <Tv className="h-3 w-3" /> };
  // LG TVs with Fully Kiosk or generic Chrome — detect by "lg" brand patterns
  if (/\blg[- ]/.test(lower) || lower.includes("lg/") || lower.includes("lge"))
    return { device: "LG Smart TV", icon: <Tv className="h-3 w-3" /> };
  if (lower.includes("tizen") || lower.includes("samsung"))
    return { device: "Samsung Tizen", icon: <Tv className="h-3 w-3" /> };
  if (lower.includes("philips") || lower.includes("nettv") || lower.includes("saphi"))
    return { device: "Philips", icon: <Tv className="h-3 w-3" /> };
  if (lower.includes("android tv") || lower.includes("androidtv") || lower.includes("googletv"))
    return { device: "Android TV", icon: <Tv className="h-3 w-3" /> };
  if (lower.includes("fully kiosk") || lower.includes("fullykiosk"))
    return { device: "Fully Kiosk", icon: <Tv className="h-3 w-3" /> };
  if (lower.includes("firetv") || lower.includes("fire tv") || (lower.includes("silk") && lower.includes("fire")))
    return { device: "Fire TV", icon: <Tv className="h-3 w-3" /> };
  if (lower.includes("chromecast") || lower.includes("crkey"))
    return { device: "Chromecast", icon: <Tv className="h-3 w-3" /> };
  // Mobile / Tablet
  if (/iphone|android.*mobile/.test(lower)) return { device: "Mobile", icon: <Smartphone className="h-3 w-3" /> };
  if (/ipad|android(?!.*mobile)|tablet/.test(lower)) return { device: "Tablette", icon: <Tablet className="h-3 w-3" /> };
  // Desktop browsers
  let browser = "Navigateur";
  if (lower.includes("chrome") && !lower.includes("edg")) browser = "Chrome";
  else if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("edg")) browser = "Edge";
  let os = "";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os")) os = "Mac";
  else if (lower.includes("linux") && !lower.includes("android")) os = "Linux";
  return { device: os ? `${browser} / ${os}` : browser, icon: <Laptop className="h-3 w-3" /> };
}

function PlaylistPanel({ screenId, media }: { screenId: string; media: any[] }) {
  const { items, addItem, removeItem } = usePlaylistItems(screenId);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {items.length === 0 ? "Aucun média dans la playlist." : `${items.length} média(s) dans la playlist.`}
      </p>
      {items.map((item: any) => (
        <div key={item.id} className="flex items-center justify-between border rounded-md p-2">
          <span className="text-sm">{item.media?.name || "Média inconnu"}</span>
          <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(item.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <div className="border-t pt-3">
        <label className="text-sm font-medium">Ajouter un média</label>
        <Select onValueChange={(mediaId) => addItem.mutate({ mediaId, position: items.length })}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Choisir un média..." />
          </SelectTrigger>
          <SelectContent>
            {media.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function ScreenManager() {
  const { screens, isLoading, addScreen, updateScreen, deleteScreen } = useScreens();
  const { media } = useMedia();
  const { layouts } = useLayouts();
  const { playlists } = usePlaylists();
  const { programs } = usePrograms();
  const { currentEstablishmentId } = useEstablishmentContext();
  const queryClient = useQueryClient();
  const screenIds = useMemo(() => screens.map((s: any) => s.id), [screens]);
  const { data: licenseStatuses } = useScreenLicenses(screenIds);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["screens"] });
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const { data: maxScreens } = useQuery({
    queryKey: ["establishment-max-screens", currentEstablishmentId],
    enabled: !!currentEstablishmentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("establishments")
        .select("max_screens")
        .eq("id", currentEstablishmentId!)
        .single();
      return data?.max_screens ?? 0;
    },
  });

  const quotaReached = maxScreens != null && maxScreens > 0 && screens.length >= maxScreens;
  const [newName, setNewName] = useState("");
  const [playlistScreenId, setPlaylistScreenId] = useState<string | null>(null);
  const [previewScreen, setPreviewScreen] = useState<{ id: string; slug: string | null; name: string } | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addScreen.mutateAsync(newName);
      toast.success("Écran ajouté");
      setNewName("");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'ajout");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">Gestion des Écrans</h2>
        <span className="text-sm text-muted-foreground">({screens.length})</span>
        <Button variant="outline" size="icon" onClick={handleRefresh} title="Actualiser les écrans" className="ml-auto">
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Nom du nouvel écran"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="max-w-xs"
        />
        <Button onClick={handleAdd} disabled={quotaReached} className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
        {maxScreens != null && maxScreens > 0 && (
          <Badge variant={quotaReached ? "destructive" : "secondary"} className="text-sm px-3 py-1">
            {screens.length}/{maxScreens} écrans
          </Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {screens.map((screen) => {
            const assignedMedia = media.find((m) => m.id === screen.current_media_id);
            const assignedLayout = layouts.find((l) => l.id === (screen as any).layout_id);
            const assignedPlaylist = playlists.find((p) => p.id === (screen as any).playlist_id);
            const assignedProgram = programs.find((p) => p.id === (screen as any).program_id);
            const orientationPreview = getOrientationPreview(screen.orientation);

            return (
            <Card key={screen.id} className="glass-panel p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Thumbnail */}
                <div className="relative w-24 h-16 rounded-md border border-border bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center">
                  {assignedMedia && assignedMedia.type === "image" ? (
                    <img src={assignedMedia.url} alt={assignedMedia.name} className="w-full h-full object-cover" />
                  ) : assignedMedia && assignedMedia.type === "video" ? (
                    <video src={assignedMedia.url} className="w-full h-full object-cover" muted preload="metadata" />
                  ) : assignedLayout ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <LayoutGrid className="h-4 w-4 text-primary/60" />
                      <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{assignedLayout.name}</span>
                    </div>
                  ) : (
                    <Image className="h-5 w-5 text-muted-foreground/30" />
                  )}

                  <div className="absolute bottom-1 right-1 h-5 min-w-5 px-1 rounded border border-border bg-background/90 flex items-center justify-center gap-1">
                    <Monitor className={`h-3 w-3 text-foreground/70 transition-transform ${orientationPreview.rotationClass}`} />
                    <span className="text-[9px] leading-none text-muted-foreground">{orientationPreview.label}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <Monitor className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">{screen.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {isScreenReallyOnline(screen) ? (
                        <>
                          <Badge variant="outline" className="text-status-online border-status-online/30 gap-1 text-xs">
                            <Wifi className="h-3 w-3" /> En ligne
                          </Badge>
                          {(() => {
                            const parsed = parseUserAgent((screen as any).player_user_agent);
                            return (
                              <Badge variant="outline" className="text-muted-foreground border-border gap-1 text-xs">
                                {parsed.icon} {parsed.device}
                              </Badge>
                            );
                          })()}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-status-offline border-status-offline/30 gap-1 text-xs">
                          <WifiOff className="h-3 w-3" /> Hors ligne
                        </Badge>
                      )}
                      {licenseStatuses && !licenseStatuses[screen.id]?.valid && (
                        <Badge variant="outline" className="text-destructive border-destructive/30 gap-1 text-xs">
                          {licenseStatuses[screen.id]?.expired ? (
                            <><ShieldOff className="h-3 w-3" /> Licence expirée</>
                          ) : licenseStatuses[screen.id]?.inactive ? (
                            <><ShieldAlert className="h-3 w-3" /> Licence désactivée</>
                          ) : (
                            <><ShieldAlert className="h-3 w-3" /> Sans licence</>
                          )}
                        </Badge>
                      )}
                      {assignedPlaylist && (
                        <Badge variant="outline" className="text-primary border-primary/30 gap-1 text-xs">
                          <ListMusic className="h-3 w-3" /> {assignedPlaylist.name}
                        </Badge>
                      )}
                      {assignedProgram && (
                        <Badge variant="outline" className="text-accent-foreground border-accent/30 gap-1 text-xs">
                          <CalendarClock className="h-3 w-3" /> {assignedProgram.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Orientation */}
                <Select
                  value={screen.orientation}
                  onValueChange={(val) => updateScreen.mutate({ id: screen.id, orientation: val })}
                >
                  <SelectTrigger className="w-[150px]">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Paysage (0°)</SelectItem>
                    <SelectItem value="portrait">Portrait (90°)</SelectItem>
                    <SelectItem value="landscape-flipped">Paysage inversé (180°)</SelectItem>
                    <SelectItem value="portrait-flipped">Portrait inversé (270°)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Media selector */}
                <Select
                  value={screen.current_media_id ?? "none"}
                  onValueChange={(val) =>
                    updateScreen.mutate({ id: screen.id, current_media_id: val === "none" ? null : val })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sélectionner un média" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun média</SelectItem>
                    {media.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Layout selector */}
                <Select
                  value={(screen as any).layout_id ?? "none"}
                  onValueChange={(val) =>
                    updateScreen.mutate({ id: screen.id, layout_id: val === "none" ? null : val } as any)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Layout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun layout</SelectItem>
                    {layouts.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPreviewScreen({ id: screen.id, slug: (screen as any).slug || screen.id, name: screen.name })}
                    title="Aperçu en temps réel"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPlaylistScreenId(screen.id)}
                    title="Gérer la playlist"
                  >
                    <ListMusic className="h-4 w-4" />
                  </Button>
                  {screen.status === 'online' && (
                    <Button
                      variant="outline"
                      size="icon"
                      title="Forcer l'arrêt de la session"
                      onClick={async () => {
                        try {
                          await updateScreen.mutateAsync({
                            id: screen.id,
                            status: 'offline',
                          } as any);
                          await supabase.from("screens").update({
                            player_session_id: null,
                            player_heartbeat_at: null,
                          }).eq("id", screen.id);
                          toast.success("Session arrêtée");
                        } catch {
                          toast.error("Erreur lors de l'arrêt");
                        }
                      }}
                      className="text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(`/player/${(screen as any).slug || screen.id}`, '_blank')}
                    title="Ouvrir le player"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => deleteScreen.mutate(screen.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {/* Playlist dialog */}
      <Dialog open={!!playlistScreenId} onOpenChange={() => setPlaylistScreenId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListMusic className="h-5 w-5" /> Playlist
            </DialogTitle>
            <DialogDescription>
              {screens.find((s) => s.id === playlistScreenId)?.name}
            </DialogDescription>
          </DialogHeader>
          {playlistScreenId && <PlaylistPanel screenId={playlistScreenId} media={media} />}
        </DialogContent>
      </Dialog>

      {/* Live preview dialog */}
      <Dialog open={!!previewScreen} onOpenChange={() => setPreviewScreen(null)}>
        <DialogContent className="max-w-5xl w-[95vw] h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Aperçu en temps réel
            </DialogTitle>
            <DialogDescription>
              {previewScreen?.name} — Ce que l'écran affiche actuellement
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-6 pb-6 min-h-0">
            {previewScreen && (
              <iframe
                src={`/player/${previewScreen.slug || previewScreen.id}?preview=1`}
                className="w-full h-full rounded-lg border border-border bg-black"
                title={`Aperçu - ${previewScreen.name}`}
                allow="autoplay"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
