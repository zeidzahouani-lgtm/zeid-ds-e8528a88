import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tv, Image, Key, Activity, Wifi, WifiOff, LayoutGrid, ListMusic, Clock, ShieldAlert, ShieldOff } from "lucide-react";
import { useScreenLicenses } from "@/hooks/useScreenLicenses";
import { isScreenReallyOnline } from "@/lib/screen-utils";

interface Props {
  establishmentId: string;
}

export function EstablishmentDashboard({ establishmentId }: Props) {
  const { data: screens = [] } = useQuery({
    queryKey: ["est_dashboard_screens", establishmentId],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("screens")
        .select("id, name, status, updated_at, player_heartbeat_at")
        .eq("establishment_id", establishmentId);
      return data || [];
    },
  });

  const { data: mediaCount = 0 } = useQuery({
    queryKey: ["est_dashboard_media", establishmentId],
    queryFn: async () => {
      const { count } = await supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);
      return count || 0;
    },
  });

  const { data: layoutCount = 0 } = useQuery({
    queryKey: ["est_dashboard_layouts", establishmentId],
    queryFn: async () => {
      const { count } = await supabase
        .from("layouts")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);
      return count || 0;
    },
  });

  const { data: activeLicenses = 0 } = useQuery({
    queryKey: ["est_dashboard_licenses", establishmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("licenses")
        .select("id, is_active, screens!inner(establishment_id)")
        .eq("is_active", true);
      return (data || []).filter((l: any) => l.screens?.establishment_id === establishmentId).length;
    },
  });

  const { data: userCount = 0 } = useQuery({
    queryKey: ["est_dashboard_users", establishmentId],
    queryFn: async () => {
      const { count } = await supabase
        .from("user_establishments")
        .select("id", { count: "exact", head: true })
        .eq("establishment_id", establishmentId);
      return count || 0;
    },
  });

  const screenIds = useMemo(() => screens.map((s: any) => s.id), [screens]);
  const { data: licenseStatuses } = useScreenLicenses(screenIds);

  const onlineScreens = screens.filter((s: any) => isScreenReallyOnline(s)).length;
  const offlineScreens = screens.length - onlineScreens;

  // Last activity: most recent heartbeat or updated_at
  const lastActivity = screens.reduce((latest: string | null, s: any) => {
    const ts = s.player_heartbeat_at || s.updated_at;
    if (!latest || ts > latest) return ts;
    return latest;
  }, null);

  const stats = [
    { label: "Écrans", value: screens.length, icon: Tv, color: "text-primary" },
    { label: "En ligne", value: onlineScreens, icon: Wifi, color: "text-green-500" },
    { label: "Hors ligne", value: offlineScreens, icon: WifiOff, color: "text-destructive" },
    { label: "Médias", value: mediaCount, icon: Image, color: "text-blue-400" },
    { label: "Layouts", value: layoutCount, icon: LayoutGrid, color: "text-purple-400" },
    { label: "Licences actives", value: activeLicenses, icon: Key, color: "text-yellow-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Tableau de bord
        </h3>
        {lastActivity && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Clock className="h-3 w-3" />
            Dernière activité: {new Date(lastActivity).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-secondary/20 border-border/30">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-background/50 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Screen list */}
      {screens.length > 0 && (
        <Card className="bg-secondary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Détail des écrans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {screens.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-background/30">
                <div className="flex items-center gap-2">
                  <Tv className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{s.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={isScreenReallyOnline(s) ? "default" : "secondary"} className="text-[10px]">
                    {isScreenReallyOnline(s) ? "En ligne" : "Hors ligne"}
                  </Badge>
                  {licenseStatuses && !licenseStatuses[s.id]?.valid && (
                    <Badge variant="outline" className="text-destructive border-destructive/30 gap-1 text-[10px]">
                      {licenseStatuses[s.id]?.expired ? (
                        <><ShieldOff className="h-3 w-3" /> Expirée</>
                      ) : licenseStatuses[s.id]?.inactive ? (
                        <><ShieldAlert className="h-3 w-3" /> Désactivée</>
                      ) : (
                        <><ShieldAlert className="h-3 w-3" /> Sans licence</>
                      )}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
