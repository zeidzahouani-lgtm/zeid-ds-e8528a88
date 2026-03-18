import { useState, useEffect, useRef } from "react";

interface DiagnosticProps {
  screenId: string | undefined;
  screenName: string | undefined;
  screenStatus: string | undefined;
  mediaId: string | null | undefined;
  mediaType: string | null | undefined;
  mediaUrl: string | null | undefined;
  layoutId: string | null;
  playlistLength: number;
  currentIndex: number;
  sessionBlocked: boolean;
  licenseValid: boolean | null;
  orientation: string | undefined;
}

interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  msg: string;
}

function getBrowserInfo() {
  var ua = navigator.userAgent;
  var lower = ua.toLowerCase();

  var platform = "Unknown";
  if (lower.indexOf("webos") >= 0 || lower.indexOf("lgwebos") >= 0) platform = "LG webOS";
  else if (lower.indexOf("tizen") >= 0) platform = "Samsung Tizen";
  else if (lower.indexOf("android tv") >= 0 || lower.indexOf("googletv") >= 0) platform = "Android TV";
  else if (lower.indexOf("firetv") >= 0 || lower.indexOf("fire tv") >= 0) platform = "Fire TV";
  else if (lower.indexOf("chromecast") >= 0) platform = "Chromecast";
  else if (lower.indexOf("philips") >= 0 || lower.indexOf("saphi") >= 0) platform = "Philips";
  else if (lower.indexOf("iphone") >= 0) platform = "iPhone";
  else if (lower.indexOf("ipad") >= 0) platform = "iPad";
  else if (lower.indexOf("android") >= 0 && lower.indexOf("mobile") >= 0) platform = "Android Mobile";
  else if (lower.indexOf("android") >= 0) platform = "Android Tablet";
  else if (lower.indexOf("windows") >= 0) platform = "Windows";
  else if (lower.indexOf("mac os") >= 0) platform = "macOS";
  else if (lower.indexOf("linux") >= 0) platform = "Linux";

  var browser = "Unknown";
  var version = "";
  var chromeMatch = ua.match(/Chrome\/(\d+)/);
  var firefoxMatch = ua.match(/Firefox\/(\d+)/);
  var safariMatch = ua.match(/Version\/(\d+\.\d+).*Safari/);
  var edgeMatch = ua.match(/Edg\/(\d+)/);

  if (edgeMatch) { browser = "Edge"; version = edgeMatch[1]; }
  else if (chromeMatch) { browser = "Chrome"; version = chromeMatch[1]; }
  else if (firefoxMatch) { browser = "Firefox"; version = firefoxMatch[1]; }
  else if (safariMatch) { browser = "Safari"; version = safariMatch[1]; }

  return { platform: platform, browser: browser, version: version, userAgent: ua };
}

function checkFeatureSupport() {
  var features: Array<{ name: string; supported: boolean }> = [];

  features.push({ name: "Fetch API", supported: typeof fetch !== "undefined" });
  features.push({ name: "Promise", supported: typeof Promise !== "undefined" });
  features.push({ name: "WebSocket", supported: typeof WebSocket !== "undefined" });
  features.push({ name: "CSS Grid", supported: typeof CSS !== "undefined" && CSS.supports ? CSS.supports("display", "grid") : false });
  features.push({ name: "CSS Flexbox", supported: typeof CSS !== "undefined" && CSS.supports ? CSS.supports("display", "flex") : true });
  features.push({ name: "requestAnimationFrame", supported: typeof requestAnimationFrame !== "undefined" });
  features.push({ name: "localStorage", supported: (function() { try { localStorage.setItem("_test", "1"); localStorage.removeItem("_test"); return true; } catch(e) { return false; } })() });
  features.push({ name: "Fullscreen API", supported: !!(document.documentElement as any).requestFullscreen });
  features.push({ name: "Video Autoplay", supported: !!document.createElement("video").canPlayType });
  features.push({ name: "ES2017 async/await", supported: true }); // If this code runs, it's supported

  return features;
}

var panelStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  backgroundColor: "rgba(0,0,0,0.92)",
  color: "#e5e7eb",
  fontFamily: "monospace",
  fontSize: 12,
  overflow: "auto",
  padding: 16,
};

var sectionStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  backgroundColor: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};

var headingStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 8,
  color: "#60a5fa",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

var rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "3px 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

var badgeOk: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 700,
};

var badgeError: React.CSSProperties = {
  color: "#ef4444",
  fontWeight: 700,
};

var badgeWarn: React.CSSProperties = {
  color: "#f59e0b",
  fontWeight: 700,
};

export default function DiagnosticOverlay(props: DiagnosticProps) {
  var info = getBrowserInfo();
  var features = checkFeatureSupport();
  var logsRef = useRef<LogEntry[]>([]);
  var _s = useState(0);
  var bump = _s[1];
  var networkOk = useState(true);
  var setNetworkOk = networkOk[1];
  var isNetworkOk = networkOk[0];
  var supabaseOk = useState<boolean | null>(null);
  var setSupabaseOk = supabaseOk[1];
  var isSupabaseOk = supabaseOk[0];
  var mediaLoadOk = useState<boolean | null>(null);
  var setMediaLoadOk = mediaLoadOk[1];
  var isMediaLoadOk = mediaLoadOk[0];
  var uptime = useState(0);
  var setUptime = uptime[1];
  var uptimeVal = uptime[0];

  // Capture console errors
  useEffect(function() {
    var origError = console.error;
    var origWarn = console.warn;

    console.error = function() {
      var args = Array.prototype.slice.call(arguments);
      var msg = args.map(function(a: any) { return typeof a === "string" ? a : JSON.stringify(a); }).join(" ");
      logsRef.current = logsRef.current.slice(-49).concat([{
        time: new Date().toLocaleTimeString(),
        level: "error",
        msg: msg.slice(0, 200),
      }]);
      bump(function(v: number) { return v + 1; });
      origError.apply(console, args);
    };

    console.warn = function() {
      var args = Array.prototype.slice.call(arguments);
      var msg = args.map(function(a: any) { return typeof a === "string" ? a : JSON.stringify(a); }).join(" ");
      logsRef.current = logsRef.current.slice(-49).concat([{
        time: new Date().toLocaleTimeString(),
        level: "warn",
        msg: msg.slice(0, 200),
      }]);
      bump(function(v: number) { return v + 1; });
      origWarn.apply(console, args);
    };

    // Global error handler
    var onError = function(e: ErrorEvent) {
      logsRef.current = logsRef.current.slice(-49).concat([{
        time: new Date().toLocaleTimeString(),
        level: "error",
        msg: (e.message || "Unknown error") + " @ " + (e.filename || "") + ":" + (e.lineno || ""),
      }]);
      bump(function(v: number) { return v + 1; });
    };

    window.addEventListener("error", onError);

    return function() {
      console.error = origError;
      console.warn = origWarn;
      window.removeEventListener("error", onError);
    };
  }, []);

  // Uptime counter
  useEffect(function() {
    var iv = setInterval(function() { setUptime(function(v: number) { return v + 1; }); }, 1000);
    return function() { clearInterval(iv); };
  }, []);

  // Network & Supabase check
  useEffect(function() {
    var check = function() {
      setNetworkOk(navigator.onLine !== false);

      fetch(import.meta.env.VITE_SUPABASE_URL + "/rest/v1/?apikey=" + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
        method: "HEAD",
      }).then(function(r) {
        setSupabaseOk(r.ok);
      }).catch(function() {
        setSupabaseOk(false);
      });
    };
    check();
    var iv = setInterval(check, 10000);
    return function() { clearInterval(iv); };
  }, []);

  // Media load check
  useEffect(function() {
    if (!props.mediaUrl) { setMediaLoadOk(null); return; }
    fetch(props.mediaUrl, { method: "HEAD" }).then(function(r) {
      setMediaLoadOk(r.ok);
    }).catch(function() {
      setMediaLoadOk(false);
    });
  }, [props.mediaUrl]);

  var formatUptime = function(s: number) {
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    return (h > 0 ? h + "h " : "") + m + "m " + sec + "s";
  };

  var memInfo = (performance as any).memory;

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", margin: 0 }}>
          🔧 MODE DIAGNOSTIC
        </h1>
        <span style={{ color: "#6b7280", fontSize: 11 }}>
          Uptime: {formatUptime(uptimeVal)} | {new Date().toLocaleString()}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Device Info */}
        <div style={sectionStyle}>
          <div style={headingStyle}>📱 Appareil / Navigateur</div>
          <div style={rowStyle}><span>Plateforme</span><span style={{ fontWeight: 700 }}>{info.platform}</span></div>
          <div style={rowStyle}><span>Navigateur</span><span>{info.browser} {info.version}</span></div>
          <div style={rowStyle}><span>Résolution</span><span>{window.screen.width}×{window.screen.height}</span></div>
          <div style={rowStyle}><span>Viewport</span><span>{window.innerWidth}×{window.innerHeight}</span></div>
          <div style={rowStyle}><span>DPR</span><span>{window.devicePixelRatio}</span></div>
          <div style={{ ...rowStyle, borderBottom: "none" }}>
            <span>User Agent</span>
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", wordBreak: "break-all", padding: "4px 0" }}>
            {info.userAgent}
          </div>
        </div>

        {/* Connectivity */}
        <div style={sectionStyle}>
          <div style={headingStyle}>🌐 Connectivité</div>
          <div style={rowStyle}>
            <span>Réseau</span>
            <span style={isNetworkOk ? badgeOk : badgeError}>{isNetworkOk ? "✓ En ligne" : "✗ Hors ligne"}</span>
          </div>
          <div style={rowStyle}>
            <span>Backend</span>
            <span style={isSupabaseOk === null ? badgeWarn : isSupabaseOk ? badgeOk : badgeError}>
              {isSupabaseOk === null ? "⏳ Test..." : isSupabaseOk ? "✓ OK" : "✗ Injoignable"}
            </span>
          </div>
          <div style={rowStyle}>
            <span>Média accessible</span>
            <span style={isMediaLoadOk === null ? badgeWarn : isMediaLoadOk ? badgeOk : badgeError}>
              {isMediaLoadOk === null ? (props.mediaUrl ? "⏳ Test..." : "— Aucun") : isMediaLoadOk ? "✓ OK" : "✗ Erreur chargement"}
            </span>
          </div>
          {memInfo && (
            <div style={rowStyle}>
              <span>Mémoire JS</span>
              <span>{Math.round(memInfo.usedJSHeapSize / 1048576)}MB / {Math.round(memInfo.jsHeapSizeLimit / 1048576)}MB</span>
            </div>
          )}
        </div>

        {/* Screen State */}
        <div style={sectionStyle}>
          <div style={headingStyle}>🖥️ État Écran</div>
          <div style={rowStyle}><span>ID</span><span style={{ fontSize: 10 }}>{props.screenId || "—"}</span></div>
          <div style={rowStyle}><span>Nom</span><span>{props.screenName || "—"}</span></div>
          <div style={rowStyle}><span>Statut</span><span style={props.screenStatus === "online" ? badgeOk : badgeError}>{props.screenStatus || "—"}</span></div>
          <div style={rowStyle}><span>Orientation</span><span>{props.orientation || "landscape"}</span></div>
          <div style={rowStyle}>
            <span>Session bloquée</span>
            <span style={props.sessionBlocked ? badgeError : badgeOk}>{props.sessionBlocked ? "✗ OUI" : "✓ Non"}</span>
          </div>
          <div style={rowStyle}>
            <span>Licence</span>
            <span style={props.licenseValid === null ? badgeWarn : props.licenseValid ? badgeOk : badgeError}>
              {props.licenseValid === null ? "⏳ Vérification" : props.licenseValid ? "✓ Valide" : "✗ Invalide"}
            </span>
          </div>
        </div>

        {/* Media State */}
        <div style={sectionStyle}>
          <div style={headingStyle}>🎬 Contenu</div>
          <div style={rowStyle}><span>Layout</span><span>{props.layoutId || "Aucun"}</span></div>
          <div style={rowStyle}><span>Playlist</span><span>{props.playlistLength} élément(s)</span></div>
          <div style={rowStyle}><span>Index courant</span><span>{props.currentIndex + 1} / {Math.max(props.playlistLength, 1)}</span></div>
          <div style={rowStyle}><span>Type média</span><span>{props.mediaType || "—"}</span></div>
          <div style={rowStyle}><span>ID média</span><span style={{ fontSize: 10 }}>{props.mediaId || "—"}</span></div>
          {props.mediaUrl && (
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span>URL</span>
            </div>
          )}
          {props.mediaUrl && (
            <div style={{ fontSize: 10, color: "#9ca3af", wordBreak: "break-all", padding: "4px 0" }}>
              {props.mediaUrl}
            </div>
          )}
        </div>
      </div>

      {/* Feature Support */}
      <div style={sectionStyle}>
        <div style={headingStyle}>⚙️ Compatibilité Navigateur</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {features.map(function(f) {
            return (
              <span key={f.name} style={{
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: f.supported ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                color: f.supported ? "#22c55e" : "#ef4444",
                border: "1px solid " + (f.supported ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"),
              }}>
                {f.supported ? "✓" : "✗"} {f.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Error Logs */}
      <div style={sectionStyle}>
        <div style={headingStyle}>📋 Journal d'erreurs ({logsRef.current.length})</div>
        {logsRef.current.length === 0 ? (
          <p style={{ color: "#22c55e", fontSize: 11 }}>Aucune erreur capturée ✓</p>
        ) : (
          <div style={{ maxHeight: 200, overflow: "auto" }}>
            {logsRef.current.slice().reverse().map(function(log, i) {
              return (
                <div key={i} style={{
                  padding: "4px 8px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  fontSize: 11,
                  color: log.level === "error" ? "#ef4444" : "#f59e0b",
                }}>
                  <span style={{ color: "#6b7280", marginRight: 8 }}>{log.time}</span>
                  <span style={{ fontWeight: 600, marginRight: 8 }}>[{log.level.toUpperCase()}]</span>
                  {log.msg}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", color: "#6b7280", fontSize: 10, marginTop: 8 }}>
        Fermer : retirer <strong>?debug=1</strong> de l'URL | Rafraîchir : F5
      </div>
    </div>
  );
}
