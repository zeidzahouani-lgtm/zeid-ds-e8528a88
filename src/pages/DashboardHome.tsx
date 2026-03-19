import { useMemo } from "react";
import { Tv, Image, ListMusic, Clock, Wifi, WifiOff, ShieldAlert, ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { Link, Navigate } from "react-router-dom";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { EstablishmentDashboard } from "@/components/establishments/EstablishmentDashboard";
import { useScreenLicenses } from "@/hooks/useScreenLicenses";

export default function DashboardHome() {
  const { screens } = useScreens();
  const { media } = useMedia();
  const { isGlobalAdmin, currentEstablishmentId, memberships, isLoading } = useEstablishmentContext();

  // Non-global-admin with an establishment: show establishment dashboard
  if (!isLoading && !isGlobalAdmin && currentEstablishmentId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm mt-1 normal-case tracking-normal">
            {memberships.find(m => m.establishment_id === currentEstablishmentId)?.establishment?.name || "Mon établissement"}
          </p>
        </div>
        <EstablishmentDashboard establishmentId={currentEstablishmentId} />
      </div>
    );
  }

  const screenIds = useMemo(() => screens.map((s: any) => s.id), [screens]);
  const { data: licenseStatuses } = useScreenLicenses(screenIds);

  const online = screens.filter((s: any) => s.status === "online").length;
  const offline = screens.length - online;

  const stats = [
    { label: "Écrans", value: screens.length, icon: Tv, link: "/displays", glowClass: "neon-glow-cyan", colorClass: "text-primary" },
    { label: "En ligne", value: online, icon: Wifi, link: "/displays", glowClass: "", colorClass: "text-status-online" },
    { label: "Hors ligne", value: offline, icon: WifiOff, link: "/displays", glowClass: "", colorClass: "text-status-offline" },
    { label: "Médias", value: media.length, icon: Image, link: "/library", glowClass: "neon-glow-violet", colorClass: "text-accent" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm mt-1 normal-case tracking-normal">Vue d'ensemble de votre affichage dynamique</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.link}>
            <Card className="p-5 cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-secondary flex items-center justify-center ${stat.colorClass}`}>
                  <stat.icon className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                </div>
                <div>
                  <p className={`text-2xl font-bold font-mono ${stat.glowClass}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4 tracking-wider">Écrans récents</h2>
        {screens.length === 0 ? (
          <Card className="p-8 text-center">
            <Tv className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground normal-case">Aucun écran configuré</p>
            <Link to="/displays" className="text-primary text-sm hover:underline mt-2 inline-block normal-case">
              Ajouter un écran →
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {screens.slice(0, 6).map((screen: any) => (
              <Card key={screen.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Tv className="h-5 w-5 text-primary shrink-0 icon-neon" />
                  <div className="min-w-0">
                    <p className="font-medium truncate normal-case">{screen.name}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {screen.status === "online" ? (
                        <span className="text-xs text-status-online flex items-center gap-1 normal-case">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-online neon-pulse-online inline-block" />
                          En ligne
                        </span>
                      ) : (
                        <span className="text-xs text-status-offline flex items-center gap-1 normal-case">
                          <span className="h-1.5 w-1.5 rounded-full bg-status-offline inline-block" />
                          Hors ligne
                        </span>
                      )}
                      {licenseStatuses && !licenseStatuses[screen.id]?.valid && (
                        <Badge variant="outline" className="text-destructive border-destructive/30 gap-1 text-[10px] px-1.5 py-0 normal-case">
                          {licenseStatuses[screen.id]?.expired ? (
                            <><ShieldOff className="h-3 w-3" /> Expirée</>
                          ) : licenseStatuses[screen.id]?.inactive ? (
                            <><ShieldAlert className="h-3 w-3" /> Désactivée</>
                          ) : (
                            <><ShieldAlert className="h-3 w-3" /> Sans licence</>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
