import { useParams } from "react-router-dom";
import { useScreenRealtime } from "@/hooks/useScreenRealtime";
import { MonitorPlay, ShieldOff } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import WidgetRenderer from "@/components/widgets/WidgetRenderer";
import { validateLicense } from "@/hooks/useLicenses";

interface LayoutRegionData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  media_id: string | null;
  widget_type: string | null;
  widget_config: Record<string, any> | null;
  media: { id: string; name: string; type: string; url: string } | null;
}

interface LayoutData {
  id: string;
  width: number;
  height: number;
  background_color: string;
}

function MediaRenderer({ media, playlistLength }: { media: { id: string; name: string; type: string; url: string }; playlistLength?: number }) {
  if (media.type === "image") {
    return <img src={media.url} alt={media.name} className="w-full h-full object-cover" />;
  }
  if (media.type === "video") {
    return (
      <video key={media.id} src={media.url} className="w-full h-full object-cover" autoPlay loop={!playlistLength || playlistLength <= 1} muted playsInline />
    );
  }
  return <iframe src={media.url} className="w-full h-full border-0" allowFullScreen title={media.name} />;
}

function LayoutRenderer({ layoutId, screenOrientation }: { layoutId: string; screenOrientation: string }) {
  const [layout, setLayout] = useState<LayoutData | null>(null);
  const [regions, setRegions] = useState<LayoutRegionData[]>([]);

  useEffect(() => {
    const fetchLayout = async () => {
      const [layoutRes, regionsRes] = await Promise.all([
        supabase.from("layouts").select("id, width, height, background_color").eq("id", layoutId).single(),
        supabase.from("layout_regions").select("*, media:media_id(id, name, type, url)").eq("layout_id", layoutId).order("z_index", { ascending: true }),
      ]);
      if (layoutRes.data) setLayout(layoutRes.data as LayoutData);
      if (regionsRes.data) setRegions(regionsRes.data as LayoutRegionData[]);
    };
    fetchLayout();

    const channel = supabase
      .channel(`layout-regions-${layoutId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "layout_regions", filter: `layout_id=eq.${layoutId}` }, () => {
        fetchLayout();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [layoutId]);

  if (!layout) return null;
  const isPortrait = screenOrientation === "portrait";

  return (
    <div className="w-full h-full relative" style={{
      backgroundColor: layout.background_color,
      ...(isPortrait ? { transform: "rotate(90deg)", transformOrigin: "center center", width: "100vh", height: "100vw", position: "absolute", top: "50%", left: "50%", marginTop: "calc(-50vw)", marginLeft: "calc(-50vh)" } : {}),
    }}>
      {regions.map((region) => {
        const style: React.CSSProperties = {
          position: "absolute",
          left: `${(region.x / layout.width) * 100}%`,
          top: `${(region.y / layout.height) * 100}%`,
          width: `${(region.width / layout.width) * 100}%`,
          height: `${(region.height / layout.height) * 100}%`,
          zIndex: region.z_index,
          overflow: "hidden",
        };
        return (
          <div key={region.id} style={style}>
            {region.widget_type ? (
              <WidgetRenderer widgetType={region.widget_type} widgetConfig={region.widget_config ?? undefined} />
            ) : region.media ? (
              <MediaRenderer media={region.media} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const { screen, media, loading, playlistLength, currentIndex, currentDuration, layoutId } = useScreenRealtime(id);
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  // License validation - must wait for screen to be resolved to get the real UUID
  const [licenseValid, setLicenseValid] = useState<boolean | null>(null);
  const [licenseMessage, setLicenseMessage] = useState("");

  useEffect(() => {
    // Only validate once we have the resolved screen with its real ID
    if (!screen?.id) return;
    validateLicense(screen.id).then((result) => {
      setLicenseValid(result.valid);
      if (!result.valid) setLicenseMessage(result.message || "Licence invalide");
    });
  }, [screen?.id]);

  const requestFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el || document.fullscreenElement) return;
    el.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => {
      requestFullscreen();
      document.removeEventListener("click", handler);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [requestFullscreen]);

  useEffect(() => {
    if (layoutId) return;
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, [media?.id, currentIndex, layoutId]);

  useEffect(() => {
    if (!currentDuration || currentDuration <= 0 || layoutId) {
      setProgress(0);
      return;
    }
    const durationMs = currentDuration * 1000;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [media?.id, currentIndex, currentDuration, layoutId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <MonitorPlay className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Connexion à l'écran...</p>
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <p className="text-destructive text-lg">Écran introuvable</p>
      </div>
    );
  }

  // Still validating license
  if (licenseValid === null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <MonitorPlay className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Vérification de la licence...</p>
        </div>
      </div>
    );
  }

  // LICENSE CHECK - Show black screen with message if invalid
  if (licenseValid === false) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-black flex items-center justify-center cursor-pointer" onClick={requestFullscreen}>
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldOff className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-destructive uppercase tracking-widest">Licence invalide</h1>
          <p className="text-muted-foreground max-w-md">{licenseMessage}</p>
          <p className="text-xs text-muted-foreground/50 mt-4">Contactez votre administrateur pour obtenir une licence valide.</p>
        </div>
      </div>
    );
  }

  if (layoutId) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden cursor-none" onClick={requestFullscreen}>
        <LayoutRenderer layoutId={layoutId} screenOrientation={screen.orientation} />
      </div>
    );
  }

  const isPortrait = screen.orientation === "portrait";

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden cursor-none" onClick={requestFullscreen}>
      <div className="w-full h-full transition-transform duration-700 ease-in-out" style={isPortrait ? { transform: "rotate(90deg)", transformOrigin: "center center", width: "100vh", height: "100vw", position: "absolute", top: "50%", left: "50%", marginTop: "calc(-50vw)", marginLeft: "calc(-50vh)" } : undefined}>
        <div className="w-full h-full transition-opacity duration-500 ease-in-out" style={{ opacity: visible ? 1 : 0 }}>
          {!media ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <MonitorPlay className="h-16 w-16 text-primary/30" />
              <p className="text-muted-foreground text-lg">{screen.name}</p>
              <p className="text-muted-foreground/50 text-sm">En attente de contenu...</p>
            </div>
          ) : (
            <MediaRenderer media={media} playlistLength={playlistLength} />
          )}
        </div>

        {playlistLength > 1 && currentDuration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/20">
            <div className="h-full bg-primary transition-none" style={{ width: `${progress}%` }} />
          </div>
        )}

        {playlistLength > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {Array.from({ length: playlistLength }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
