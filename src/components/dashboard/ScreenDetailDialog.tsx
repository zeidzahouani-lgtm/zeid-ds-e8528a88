import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Monitor, Wifi, WifiOff, Clock, Globe, Cpu, Calendar, Hash, LayoutGrid, ListMusic, CalendarClock, ShieldAlert, ShieldOff, ShieldCheck, Tv, Smartphone, Tablet, Laptop } from "lucide-react";
import { isScreenReallyOnline } from "@/lib/screen-utils";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

interface ScreenDetailDialogProps {
  screen: any | null;
  licenseStatus?: { valid: boolean; expired?: boolean; inactive?: boolean } | null;
  assignedMedia?: any;
  assignedLayout?: any;
  assignedPlaylist?: any;
  assignedProgram?: any;
  onClose: () => void;
}

function parseDeviceInfo(ua: string | null): { device: string; browser: string; os: string; icon: React.ReactNode } {
  if (!ua) return { device: "Inconnu", browser: "Inconnu", os: "Inconnu", icon: <Monitor className="h-4 w-4" /> };
  const lower = ua.toLowerCase();

  let device = "PC";
  let icon: React.ReactNode = <Laptop className="h-4 w-4" />;
  if (lower.includes("webos") || lower.includes("lgwebos") || lower.includes("lg netcast") || lower.includes("netcast") || lower.includes("smarttv") || /\blg[- ]/.test(lower) || lower.includes("lge") || lower.includes("colt/")) {
    device = "LG Smart TV"; icon = <Tv className="h-4 w-4" />;
  } else if (lower.includes("tizen") || lower.includes("samsung")) {
    device = "Samsung Tizen"; icon = <Tv className="h-4 w-4" />;
  } else if (lower.includes("fully kiosk") || lower.includes("fullykiosk")) {
    device = "Fully Kiosk"; icon = <Tv className="h-4 w-4" />;
  } else if (lower.includes("android tv") || lower.includes("androidtv") || lower.includes("googletv")) {
    device = "Android TV"; icon = <Tv className="h-4 w-4" />;
  } else if (lower.includes("firetv") || lower.includes("fire tv")) {
    device = "Fire TV"; icon = <Tv className="h-4 w-4" />;
  } else if (/iphone|android.*mobile/.test(lower)) {
    device = "Mobile"; icon = <Smartphone className="h-4 w-4" />;
  } else if (/ipad|android(?!.*mobile)|tablet/.test(lower)) {
    device = "Tablette"; icon = <Tablet className="h-4 w-4" />;
  }

  let browser = "Inconnu";
  const edgeMatch = ua.match(/Edg\/(\d+)/);
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  const safariMatch = ua.match(/Version\/(\d+\.\d+).*Safari/);
  if (edgeMatch) browser = `Edge ${edgeMatch[1]}`;
  else if (chromeMatch) browser = `Chrome ${chromeMatch[1]}`;
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1]}`;
  else if (safariMatch) browser = `Safari ${safariMatch[1]}`;

  let os = "Inconnu";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os")) os = "macOS";
  else if (lower.includes("webos")) os = "webOS";
  else if (lower.includes("tizen")) os = "Tizen";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("linux")) os = "Linux";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";

  return { device, browser, os, icon };
}

const Row = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <span className="text-sm text-muted-foreground flex items-center gap-2">
      {icon} {label}
    </span>
    <span className="text-sm font-medium text-foreground text-right max-w-[60%] break-all">{value}</span>
  </div>
);

export default function ScreenDetailDialog({ screen, licenseStatus, assignedMedia, assignedLayout, assignedPlaylist, assignedProgram, onClose }: ScreenDetailDialogProps) {
  if (!screen) return null;

  const online = isScreenReallyOnline(screen);
  const deviceInfo = parseDeviceInfo(screen.player_user_agent);
  const heartbeat = screen.player_heartbeat_at;
  const createdAt = screen.created_at;

  // Calculate uptime from first heartbeat (approximation: use updated_at as session start)
  const uptimeText = heartbeat
    ? formatDistanceToNow(new Date(heartbeat), { locale: fr, addSuffix: false })
    : "—";

  return (
    <Dialog open={!!screen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            Détails de l'écran
          </DialogTitle>
          <DialogDescription>{screen.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Section */}
          <div className="rounded-lg border border-border p-4 space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">État</h4>
            <Row
              label="Statut"
              icon={online ? <Wifi className="h-3.5 w-3.5 text-green-500" /> : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
              value={
                <Badge variant="outline" className={online ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}>
                  {online ? "En ligne" : "Hors ligne"}
                </Badge>
              }
            />
            <Row
              label="Dernier signal"
              icon={<Clock className="h-3.5 w-3.5" />}
              value={heartbeat ? formatDistanceToNow(new Date(heartbeat), { locale: fr, addSuffix: true }) : "Jamais"}
            />
            <Row
              label="Session active depuis"
              icon={<Clock className="h-3.5 w-3.5" />}
              value={uptimeText}
            />
            <Row
              label="Licence"
              icon={licenseStatus?.valid ? <ShieldCheck className="h-3.5 w-3.5 text-green-500" /> : <ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
              value={
                <Badge variant="outline" className={licenseStatus?.valid ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}>
                  {licenseStatus?.valid ? "Valide" : licenseStatus?.expired ? "Expirée" : licenseStatus?.inactive ? "Désactivée" : "Sans licence"}
                </Badge>
              }
            />
          </div>

          {/* Device Section */}
          <div className="rounded-lg border border-border p-4 space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Appareil</h4>
            <Row label="Type" icon={deviceInfo.icon} value={deviceInfo.device} />
            <Row label="Navigateur" icon={<Globe className="h-3.5 w-3.5" />} value={deviceInfo.browser} />
            <Row label="Système" icon={<Cpu className="h-3.5 w-3.5" />} value={deviceInfo.os} />
            <Row label="IP publique" icon={<Globe className="h-3.5 w-3.5" />} value={screen.player_ip || "Non disponible"} />
            <Row label="IP locale (LAN)" icon={<Globe className="h-3.5 w-3.5" />} value={screen.player_lan_ip || "Non disponible"} />
            <Row label="Orientation" icon={<Monitor className="h-3.5 w-3.5" />} value={screen.orientation || "landscape"} />
            <Row
              label="Résolution"
              icon={<Monitor className="h-3.5 w-3.5" />}
              value={screen.player_user_agent ? `Détecté via ${deviceInfo.device}` : "—"}
            />
          </div>

          {/* Content Section */}
          <div className="rounded-lg border border-border p-4 space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contenu</h4>
            <Row
              label="Média actuel"
              icon={<Monitor className="h-3.5 w-3.5" />}
              value={assignedMedia?.name || "Aucun"}
            />
            <Row
              label="Layout"
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              value={assignedLayout?.name || "Aucun"}
            />
            <Row
              label="Playlist"
              icon={<ListMusic className="h-3.5 w-3.5" />}
              value={assignedPlaylist?.name || "Aucune"}
            />
            <Row
              label="Programme"
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              value={assignedProgram?.name || "Aucun"}
            />
          </div>

          {/* Technical Section */}
          <div className="rounded-lg border border-border p-4 space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Technique</h4>
            <Row label="ID" icon={<Hash className="h-3.5 w-3.5" />} value={<span className="text-xs font-mono">{screen.id}</span>} />
            <Row label="Slug" icon={<Hash className="h-3.5 w-3.5" />} value={screen.slug || "—"} />
            <Row label="Session ID" icon={<Hash className="h-3.5 w-3.5" />} value={<span className="text-xs font-mono">{screen.player_session_id || "—"}</span>} />
            <Row
              label="Créé le"
              icon={<Calendar className="h-3.5 w-3.5" />}
              value={createdAt ? format(new Date(createdAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "—"}
            />
          </div>

          {/* User Agent raw */}
          {screen.player_user_agent && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">User Agent</h4>
              <p className="text-[11px] text-muted-foreground font-mono break-all leading-relaxed">
                {screen.player_user_agent}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
