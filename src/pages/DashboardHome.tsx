import { Tv, Image, ListMusic, Clock, Wifi, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { Link } from "react-router-dom";

export default function DashboardHome() {
  const { screens } = useScreens();
  const { media } = useMedia();

  const online = screens.filter((s: any) => s.status === "online").length;
  const offline = screens.length - online;

  const stats = [
    { label: "Écrans", value: screens.length, icon: Tv, link: "/displays", color: "text-primary" },
    { label: "En ligne", value: online, icon: Wifi, link: "/displays", color: "text-[hsl(var(--status-online))]" },
    { label: "Hors ligne", value: offline, icon: WifiOff, link: "/displays", color: "text-[hsl(var(--status-offline))]" },
    { label: "Médias", value: media.length, icon: Image, link: "/library", color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de votre affichage dynamique</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} to={stat.link}>
            <Card className="glass-panel p-5 hover:border-primary/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-secondary flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent screens */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Écrans récents</h2>
        {screens.length === 0 ? (
          <Card className="glass-panel p-8 text-center">
            <Tv className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun écran configuré</p>
            <Link to="/displays" className="text-primary text-sm hover:underline mt-2 inline-block">
              Ajouter un écran →
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {screens.slice(0, 6).map((screen: any) => (
              <Card key={screen.id} className="glass-panel p-4">
                <div className="flex items-center gap-3">
                  <Tv className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{screen.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {screen.status === "online" ? (
                        <span className="text-xs text-[hsl(var(--status-online))] flex items-center gap-1">
                          <Wifi className="h-3 w-3" /> En ligne
                        </span>
                      ) : (
                        <span className="text-xs text-[hsl(var(--status-offline))] flex items-center gap-1">
                          <WifiOff className="h-3 w-3" /> Hors ligne
                        </span>
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
