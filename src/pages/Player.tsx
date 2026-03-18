import { useParams } from "react-router-dom";
import { useScreenRealtime } from "@/hooks/useScreenRealtime";
import { MonitorPlay, ShieldOff, KeyRound, MonitorX } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import WidgetRenderer from "@/components/widgets/WidgetRenderer";
import { validateLicense, activateLicenseByKey } from "@/hooks/useLicenses";
import { QRCodeSVG } from "qrcode.react";
import FallbackScreen from "@/components/player/FallbackScreen";
import DiagnosticOverlay from "@/components/player/DiagnosticOverlay";

// Hook to fetch active contents for a screen filtered by current time
function useActiveContents(screenId: string | undefined) {
  const [contents, setContents] = useState<Array<{ id: string; image_url: string; title: string | null; metadata: Record<string, any> | null }>>([]);

  useEffect(() => {
    if (!screenId) return;

    const fetchContents = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("contents" as any)
        .select("id, image_url, title, metadata")
        .eq("screen_id", screenId)
        .eq("status", "active")
        .or(`start_time.is.null,start_time.lte.${now}`)
        .or(`end_time.is.null,end_time.gte.${now}`)
        .order("created_at", { ascending: false }) as any;
      setContents(data || []);
    };

    fetchContents();
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
  bg_type?: string;
  bg_image_url?: string | null;
  bg_image_fit?: string;
  bg_overlay_darken?: number;
  bg_overlay_blur?: number;
}

interface PlayerBranding {
  logoUrl: string;
  showLogo: boolean;
  bgColor: string;
  watermark: string;
  showSignatureOnPlayer: boolean;
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
    return <img src={media.url} alt={media.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  if (media.type === "video") {
    return (
      <video
        key={media.id}
        src={media.url}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        autoPlay
        muted
        loop={!playlistLength || playlistLength <= 1}
        playsInline
      />
    );
  }
  return <iframe src={media.url} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title={media.name} />;
}

function usePlayerBranding(screenId?: string): PlayerBranding {
  const [branding, setBranding] = useState<PlayerBranding>({
    logoUrl: "",
    showLogo: true,
    bgColor: "#000000",
    watermark: "",
    showSignatureOnPlayer: false,
  });

  useEffect(() => {
    if (!screenId) return;

    const fetchBranding = async () => {
      const { data: screenData } = await supabase
        .from("screens")
        .select("establishment_id")
        .eq("id", screenId)
        .single();

      let logoUrl = "";
      let showLogo = true;
      let bgColor = "#000000";
      let watermark = "";
      let showSignatureOnPlayer = false;

      if (screenData?.establishment_id) {
        const { data: estData } = await supabase
          .from("establishments")
          .select("logo_url")
          .eq("id", screenData.establishment_id)
          .single();
        if (estData?.logo_url) logoUrl = estData.logo_url;

        const { data: estSettings } = await supabase
          .from("establishment_settings")
          .select("key, value")
          .eq("establishment_id", screenData.establishment_id)
          .in("key", ["brand_show_logo_player", "brand_player_bg_color", "brand_player_watermark", "brand_logo_url"]);

        if (estSettings) {
          const settingsMap: Record<string, string> = {};
          estSettings.forEach((s: any) => { if (s.value) settingsMap[s.key] = s.value; });
          if (settingsMap.brand_logo_url && !logoUrl) logoUrl = settingsMap.brand_logo_url;
          if (settingsMap.brand_show_logo_player === "false") showLogo = false;
          if (settingsMap.brand_player_bg_color) bgColor = settingsMap.brand_player_bg_color;
          if (settingsMap.brand_player_watermark) watermark = settingsMap.brand_player_watermark;
        }
      }

      // Check global setting for signature on player
      const { data: globalSettings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["logo_url", "show_signature_on_player"]);

      if (globalSettings) {
        globalSettings.forEach((s: any) => {
          if (s.key === "logo_url" && s.value && !logoUrl) logoUrl = s.value;
          if (s.key === "show_signature_on_player" && s.value === "true") showSignatureOnPlayer = true;
        });
      }

      setBranding({ logoUrl, showLogo, bgColor, watermark, showSignatureOnPlayer });
    };

    fetchBranding();
  }, [screenId]);

  return branding;
}

function CompanyLogo({ logoUrl, show = true }: { logoUrl: string; show?: boolean }) {
  if (!logoUrl || !show) return null;
  return <img src={logoUrl} alt="Logo" style={{ height: 64, width: "auto", objectFit: "contain", marginBottom: 16 }} />;
}

function Watermark({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div style={{
      position: "absolute", bottom: 16, right: 16, zIndex: 50,
      color: "rgba(255,255,255,0.2)", fontSize: 12, fontWeight: 500,
      letterSpacing: "0.05em", pointerEvents: "none",
    }}>
      {text}
    </div>
  );
}

function PlayerSignature({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div style={{
      position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
      zIndex: 50, color: "rgba(255,255,255,0.15)", fontSize: 10,
      fontWeight: 400, letterSpacing: "0.1em", pointerEvents: "none",
      whiteSpace: "nowrap",
    }}>
      ScreenFlow by Dravox
    </div>
  );
}

function LayoutRenderer({ layoutId, screenOrientation }: { layoutId: string; screenOrientation: string }) {
  const [layout, setLayout] = useState<LayoutData | null>(null);
  const [regions, setRegions] = useState<LayoutRegionData[]>([]);

  useEffect(() => {
    const fetchLayout = async () => {
      const [layoutRes, regionsRes] = await Promise.all([
        supabase.from("layouts").select("id, width, height, background_color, bg_type, bg_image_url, bg_image_fit, bg_overlay_darken, bg_overlay_blur").eq("id", layoutId).single(),
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
    <div style={{
      width: "100%", height: "100%", position: "relative",
      backgroundColor: layout.background_color,
      backgroundImage: layout.bg_type === "image" && layout.bg_image_url ? `url(${layout.bg_image_url})` : undefined,
      backgroundSize: layout.bg_image_fit === "contain" ? "contain" : layout.bg_image_fit === "repeat" ? "auto" : "cover",
      backgroundRepeat: layout.bg_image_fit === "repeat" ? "repeat" : "no-repeat",
      backgroundPosition: "center",
      ...rotationStyle,
    }}>
      {layout.bg_type === "image" && layout.bg_image_url && ((layout.bg_overlay_darken || 0) > 0) && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundColor: `rgba(0,0,0,${(layout.bg_overlay_darken || 0) / 100})`,
          zIndex: 0,
        }} />
      )}
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
  showLogo,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  requestFullscreen: () => void;
  message: string;
  screenId: string;
  onActivated: () => void;
  logoUrl: string;
  showLogo: boolean;
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
    <div ref={containerRef} style={{ position: "fixed", inset: 0, backgroundColor: "#000", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={requestFullscreen}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center", padding: 32, maxWidth: 400, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <CompanyLogo logoUrl={logoUrl} show={showLogo} />
        <div style={{ height: 80, width: 80, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldOff style={{ height: 40, width: 40, color: "#ef4444" }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em" }}>Licence invalide</h1>
        <p style={{ color: "#9ca3af" }}>{message}</p>

        <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <KeyRound style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", height: 16, width: 16, color: "#6b7280" }} />
              <input
                type="text"
                value={key}
                onChange={(e) => { setKey(e.target.value.toUpperCase()); setError(""); }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                style={{
                  width: "100%", height: 44, paddingLeft: 40, paddingRight: 12,
                  borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#fff",
                  fontFamily: "monospace", letterSpacing: "0.1em", fontSize: 14,
                }}
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={checking || !key.trim()}
              style={{
                height: 44, padding: "0 20px", borderRadius: 8,
                backgroundColor: "#3b82f6", color: "#000", fontWeight: 600,
                fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase",
                border: "none", cursor: checking || !key.trim() ? "not-allowed" : "pointer",
                opacity: checking || !key.trim() ? 0.4 : 1,
              }}
            >
              {checking ? "..." : "Activer"}
            </button>
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>}
        </form>

        <div style={{ width: "100%", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 20, marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>ou scannez pour assigner depuis l'admin</p>
          <div style={{ backgroundColor: "#fff", padding: 12, borderRadius: 12 }}>
            <QRCodeSVG
              value={`${window.location.origin}/admin/licenses?screen=${screenId}`}
              size={140}
              level="M"
            />
          </div>
        </div>

        <p style={{ fontSize: 11, color: "#4b5563", marginTop: 8 }}>
          Vérification automatique toutes les 5 secondes
        </p>
      </div>
    </div>
  );
}

function ActiveContentCarousel({ contents, screenOrientation }: { contents: Array<{ id: string; image_url: string; title: string | null; metadata: Record<string, any> | null }>; screenOrientation: string }) {
  const [index, setIndex] = useState(0);
  const current = contents[Math.min(index, contents.length - 1)];
  const contentType = (current?.metadata as any)?.type || "image";

  const advance = useCallback(() => {
    if (contents.length <= 1) return;
    setIndex(prev => (prev + 1) % contents.length);
  }, [contents.length]);

  useEffect(() => {
    if (contents.length <= 1 && contentType !== "video") return;
    if (contentType === "video") return;
    const timer = setInterval(advance, 10000);
    return () => clearInterval(timer);
  }, [contents.length, contentType, advance]);

  if (!current) return null;

  const contentOrientation = (current.metadata as any)?.orientation || screenOrientation;
  const rotationStyle = getOrientationStyle(contentOrientation);

  return (
    <div style={{ width: "100%", height: "100%", ...rotationStyle }}>
      {contentType === "video" ? (
        <video
          key={current.id}
          src={current.image_url}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          autoPlay
          muted
          playsInline
          onEnded={contents.length > 1 ? advance : undefined}
          loop={contents.length <= 1}
        />
      ) : (
        <img src={current.image_url} alt={current.title || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      )}
    </div>
  );
}

export default function Player() {
  const { id } = useParams<{ id: string }>();
  const debugMode = typeof window !== "undefined" && window.location.search.indexOf("debug=1") >= 0;
  const { screen, media, loading, sessionBlocked, forceTakeover, playlistLength, currentIndex, currentDuration, layoutId } = useScreenRealtime(id);
  const activeContents = useActiveContents(screen?.id);
  const branding = usePlayerBranding(screen?.id);
  const [visible, setVisible] = useState(true);
  const [hasContent, setHasContent] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();

  // License validation
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

    const interval = setInterval(() => {
      if (licenseValid !== true) checkLicense();
    }, 5000);

    const channel = supabase
      .channel(`license-realtime-${screen.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "licenses", filter: `screen_id=eq.${screen.id}` },
        () => { checkLicense(); }
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
    try { el.requestFullscreen?.().catch(() => {}); } catch (_) {}
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
    const nowHasContent = !!(media || activeContents.length > 0);
    setHasContent(nowHasContent);
  }, [media, activeContents]);

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

  const playerBgStyle: React.CSSProperties = { backgroundColor: branding.bgColor };

  if (loading) {
    return (
      <div style={{ ...playerBgStyle, position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <CompanyLogo logoUrl={branding.logoUrl} show={branding.showLogo} />
          <MonitorPlay style={{ height: 48, width: 48, color: "#3b82f6" }} />
          <p style={{ color: "#9ca3af" }}>Connexion à l'écran...</p>
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#ef4444", fontSize: 18 }}>Écran introuvable</p>
      </div>
    );
  }

  if (sessionBlocked) {
    return (
      <div ref={containerRef} style={{ ...playerBgStyle, position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center", padding: 32 }}>
          <CompanyLogo logoUrl={branding.logoUrl} show={branding.showLogo} />
          <div style={{ height: 80, width: 80, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MonitorX style={{ height: 40, width: 40, color: "#ef4444" }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em" }}>Écran déjà actif</h1>
          <p style={{ color: "#9ca3af", maxWidth: 380 }}>
            Cet écran est déjà ouvert sur un autre appareil. Fermez l'autre session pour pouvoir l'utiliser ici.
          </p>
          <button
            onClick={forceTakeover}
            style={{
              marginTop: 16, padding: "12px 24px", borderRadius: 8,
              backgroundColor: "#3b82f6", color: "#fff", fontWeight: 600,
              border: "none", cursor: "pointer", fontSize: 14,
            }}
          >
            Forcer la prise de contrôle
          </button>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
            Vérification automatique toutes les 15 secondes
          </p>
        </div>
        <Watermark text={branding.watermark} />
      </div>
    );
  }

  if (licenseValid === null) {
    return (
      <div style={{ ...playerBgStyle, position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <CompanyLogo logoUrl={branding.logoUrl} show={branding.showLogo} />
          <MonitorPlay style={{ height: 48, width: 48, color: "#3b82f6" }} />
          <p style={{ color: "#9ca3af" }}>Vérification de la licence...</p>
        </div>
      </div>
    );
  }

  if (licenseValid === false) {
    return (
      <LicenseScreen
        containerRef={containerRef}
        requestFullscreen={requestFullscreen}
        message={licenseMessage}
        screenId={screen.id}
        onActivated={() => setLicenseValid(true)}
        logoUrl={branding.logoUrl}
        showLogo={branding.showLogo}
      />
    );
  }

  if (layoutId) {
    return (
      <div ref={containerRef} style={{ ...playerBgStyle, position: "fixed", inset: 0, overflow: "hidden", cursor: "none" }} onClick={requestFullscreen}>
        <LayoutRenderer layoutId={layoutId} screenOrientation={screen.orientation} />
        <Watermark text={branding.watermark} />
        <PlayerSignature show={branding.showSignatureOnPlayer} />
      </div>
    );
  }

  const rotationStyle = getOrientationStyle(screen.orientation);

  return (
    <div ref={containerRef} style={{ ...playerBgStyle, position: "fixed", inset: 0, overflow: "hidden", cursor: "none" }} onClick={requestFullscreen}>
      <div style={{ width: "100%", height: "100%", transition: "transform 0.7s ease-in-out", ...rotationStyle }}>
        <div style={{ width: "100%", height: "100%", transition: "opacity 0.5s ease-in-out", opacity: visible ? 1 : 0 }}>
          {/* Fallback screen */}
          <div style={{
            position: "absolute", inset: 0,
            transition: "opacity 1s ease-in-out",
            opacity: hasContent ? 0 : 1,
            pointerEvents: hasContent ? "none" : "auto",
          }}>
            <FallbackScreen
              screenName={screen.name}
              screenId={screen.id}
              logoUrl={branding.logoUrl}
              showLogo={branding.showLogo}
            />
          </div>

          {/* Actual content */}
          <div style={{
            position: "absolute", inset: 0,
            transition: "opacity 1s ease-in-out",
            opacity: hasContent ? 1 : 0,
            pointerEvents: hasContent ? "auto" : "none",
          }}>
            {activeContents.length > 0 && !media ? (
              <ActiveContentCarousel contents={activeContents} screenOrientation={screen.orientation} />
            ) : media ? (
              <MediaRenderer media={media} playlistLength={playlistLength} />
            ) : null}
          </div>
        </div>

        {playlistLength > 1 && currentDuration > 0 && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, backgroundColor: "rgba(255,255,255,0.1)" }}>
            <div style={{ height: "100%", backgroundColor: "#3b82f6", width: `${progress}%` }} />
          </div>
        )}

        {playlistLength > 1 && (
          <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
            {Array.from({ length: playlistLength }).map((_, i) => (
              <div key={i} style={{
                height: 6, borderRadius: 3,
                transition: "all 0.3s",
                width: i === currentIndex ? 24 : 6,
                backgroundColor: i === currentIndex ? "#3b82f6" : "rgba(255,255,255,0.2)",
              }} />
            ))}
          </div>
        )}
      </div>
      <Watermark text={branding.watermark} />
      <PlayerSignature show={branding.showSignatureOnPlayer} />
    </div>
  );
}
