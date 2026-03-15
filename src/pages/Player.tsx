import { useParams } from "react-router-dom";
import { useScreenRealtime } from "@/hooks/useScreenRealtime";
import { MonitorPlay, ShieldOff, KeyRound, QrCode, MonitorX } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import WidgetRenderer from "@/components/widgets/WidgetRenderer";
import { validateLicense, activateLicenseByKey } from "@/hooks/useLicenses";
import { QRCodeSVG } from "qrcode.react";

// Hook to fetch active contents for a screen filtered by current time
function useActiveContents(screenId: string | undefined) {
  const [contents, setContents] = useState<Array<{ id: string; image_url: string; title: string | null }>>([]);

  useEffect(() => {
    if (!screenId) return;

    const fetchContents = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("contents" as any)
        .select("id, image_url, title")
        .eq("screen_id", screenId)
        .eq("status", "active")
        .or(`start_time.is.null,start_time.lte.${now}`)
        .or(`end_time.is.null,end_time.gte.${now}`)
        .order("created_at", { ascending: false }) as any;
      setContents(data || []);
    };

    fetchContents();
    // Refresh every 30 seconds to check time-based content
    const interval = setInterval(fetchContents, 30000);

    const channel = supabase
      .channel(`contents-player-${screenId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "contents", filter: `screen_id=eq.${screenId}` }, () => fetchContents())
      .subscribe();

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [screenId]);

  return contents;
}

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

function getOrientationStyle(orientation: string): React.CSSProperties {
  const swappedBase: React.CSSProperties = {
    transformOrigin: "center center",
    width: "100vh",
    height: "100vw",
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: "calc(-50vw)",
    marginLeft: "calc(-50vh)",
  };
  switch (orientation) {
    case "portrait":
      return { ...swappedBase, transform: "rotate(90deg)" };
    case "landscape-flipped":
      return { transform: "rotate(180deg)", width: "100%", height: "100%" };
    case "portrait-flipped":
      return { ...swappedBase, transform: "rotate(270deg)" };
    default:
      return {};
  }
}

function MediaRenderer({ media, playlistLength }: { media: { id: string; name: string; type: string; url: string }; playlistLength?: number }) {
  if (media.type === "image") {
    return <img src={media.url} alt={media.name} className="w-full h-full object-cover" />;
  }
  if (media.type === "video") {
    return (
      <video key={media.id} src={media.url} className="w-full h-full object-cover" autoPlay loop={!playlistLength || playlistLength <= 1} playsInline />
    );
  }
  return <iframe src={media.url} className="w-full h-full border-0" allowFullScreen title={media.name} />;
}

function usePlayerLogo() {
  const [logoUrl, setLogoUrl] = useState<string>("");
  useEffect(() => {
    supabase.from("app_settings").select("key, value").eq("key", "logo_url").single()
      .then(({ data }) => { if (data?.value) setLogoUrl(data.value); });
  }, []);
  return logoUrl;
}

function CompanyLogo({ logoUrl }: { logoUrl: string }) {
  if (!logoUrl) return null;
  return <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-4" />;
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

  const rotationStyle = getOrientationStyle(screenOrientation);

  return (
    <div className="w-full h-full relative" style={{
      backgroundColor: layout.background_color,
      ...rotationStyle,
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

function LicenseScreen({
  containerRef,
  requestFullscreen,
  message,
  screenId,
  onActivated,
  logoUrl,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  requestFullscreen: () => void;
  message: string;
  screenId: string;
  onActivated: () => void;
  logoUrl: string;
}) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setChecking(true);
    setError("");
    const result = await activateLicenseByKey(key, screenId);
    if (result.valid) {
      onActivated();
    } else {
      setError(result.message || "Clé invalide");
    }
    setChecking(false);
  };

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black flex items-center justify-center" onClick={requestFullscreen}>
      <div className="flex flex-col items-center gap-6 text-center p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {logoUrl && <CompanyLogo logoUrl={logoUrl} />}
        <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldOff className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-destructive uppercase tracking-widest">Licence invalide</h1>
        <p className="text-gray-400">{message}</p>

        <form onSubmit={handleSubmit} className="w-full space-y-3 mt-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={key}
                onChange={(e) => { setKey(e.target.value.toUpperCase()); setError(""); }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full h-11 pl-10 pr-3 rounded-lg bg-white/5 border border-white/10 text-white font-mono tracking-widest text-sm placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={checking || !key.trim()}
              className="h-11 px-5 rounded-lg bg-primary text-black font-semibold text-sm tracking-wider uppercase hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {checking ? "..." : "Activer"}
            </button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </form>

        <div className="w-full border-t border-white/5 pt-5 mt-3 flex flex-col items-center gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">ou scannez pour assigner depuis l'admin</p>
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG
              value={`${window.location.origin}/admin/licenses?screen=${screenId}`}
              size={140}
              level="M"
            />
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-2">
          Vérification automatique toutes les 5 secondes
          <span className="inline-block ml-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </p>
      </div>
    </div>
  );
}

function ActiveContentCarousel({ contents }: { contents: Array<{ id: string; image_url: string; title: string | null }> }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (contents.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % contents.length);
    }, 10000); // 10s per image
    return () => clearInterval(timer);
  }, [contents.length]);

  const current = contents[Math.min(index, contents.length - 1)];
  if (!current) return null;

  return <img src={current.image_url} alt={current.title || ""} className="w-full h-full object-cover" />;
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const { screen, media, loading, sessionBlocked, forceTakeover, playlistLength, currentIndex, currentDuration, layoutId } = useScreenRealtime(id);
  const activeContents = useActiveContents(screen?.id);
  const logoUrl = usePlayerLogo();
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  // License validation - must wait for screen to be resolved to get the real UUID
  const [licenseValid, setLicenseValid] = useState<boolean | null>(null);
  const [licenseMessage, setLicenseMessage] = useState("");

  useEffect(() => {
    if (!screen?.id) return;

    const checkLicense = () => {
      validateLicense(screen.id).then((result) => {
        setLicenseValid(result.valid);
        if (!result.valid) setLicenseMessage(result.message || "Licence invalide");
      });
    };

    checkLicense();

    // Re-check every 5 seconds if license is not valid
    const interval = setInterval(() => {
      if (licenseValid !== true) checkLicense();
    }, 5000);

    // Realtime: immediately re-check when any license for this screen changes
    const channel = supabase
      .channel(`license-realtime-${screen.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "licenses", filter: `screen_id=eq.${screen.id}` },
        () => {
          checkLicense();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [screen?.id, licenseValid]);

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
          <CompanyLogo logoUrl={logoUrl} />
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

  // Session blocked — another device is already playing this screen
  if (sessionBlocked) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <CompanyLogo logoUrl={logoUrl} />
          <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <MonitorX className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-destructive uppercase tracking-widest">Écran déjà actif</h1>
          <p className="text-muted-foreground max-w-sm">
            Cet écran est déjà ouvert sur un autre appareil. Fermez l'autre session pour pouvoir l'utiliser ici.
          </p>
          <button
            onClick={forceTakeover}
            className="mt-4 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Forcer la prise de contrôle
          </button>
          <p className="text-xs text-muted-foreground/50 mt-2">
            Vérification automatique toutes les 15 secondes
            <span className="inline-block ml-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </p>
        </div>
      </div>
    );
  }

  // Still validating license
  if (licenseValid === null) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <CompanyLogo logoUrl={logoUrl} />
          <MonitorPlay className="h-12 w-12 text-primary" />
          <p className="text-muted-foreground">Vérification de la licence...</p>
        </div>
      </div>
    );
  }

  // LICENSE CHECK - Show black screen with manual entry
  if (licenseValid === false) {
    return (
      <LicenseScreen
        containerRef={containerRef}
        requestFullscreen={requestFullscreen}
        message={licenseMessage}
        screenId={screen.id}
        onActivated={() => setLicenseValid(true)}
        logoUrl={logoUrl}
      />
    );
  }

  if (layoutId) {
    return (
      <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden cursor-none" onClick={requestFullscreen}>
        <LayoutRenderer layoutId={layoutId} screenOrientation={screen.orientation} />
      </div>
    );
  }

  const rotationStyle = getOrientationStyle(screen.orientation);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black overflow-hidden cursor-none" onClick={requestFullscreen}>
      <div className="w-full h-full transition-transform duration-700 ease-in-out" style={rotationStyle}>
        <div className="w-full h-full transition-opacity duration-500 ease-in-out" style={{ opacity: visible ? 1 : 0 }}>
          {!media && activeContents.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <CompanyLogo logoUrl={logoUrl} />
              <MonitorPlay className="h-16 w-16 text-primary/30" />
              <p className="text-muted-foreground text-lg">{screen.name}</p>
              <p className="text-muted-foreground/50 text-sm">En attente de contenu...</p>
            </div>
          ) : activeContents.length > 0 && !media ? (
            /* Show active automated contents when no playlist media */
            <ActiveContentCarousel contents={activeContents} />
          ) : media ? (
            <MediaRenderer media={media} playlistLength={playlistLength} />
          ) : null}
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
