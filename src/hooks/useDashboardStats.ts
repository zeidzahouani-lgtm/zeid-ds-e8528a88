import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { isScreenReallyOnline } from "@/lib/screen-utils";

export interface ScreenUptimeEntry {
  id: string;
  name: string;
  totalHeartbeats: number;
  isOnline: boolean;
  lastSeen: string | null;
  hasContent: boolean;
  orientation: string;
  fallbackSince: string | null;
}

export interface DashboardStats {
  totalScreens: number;
  onlineScreens: number;
  offlineScreens: number;
  inFallback: number;
  totalMedia: number;
  mediaByType: Record<string, number>;
  totalPlaylists: number;
  totalLayouts: number;
  activeLicenses: number;
  expiredLicenses: number;
  unassignedLicenses: number;
  totalContents: number;
  pendingContents: number;
  activeContents: number;
  screenUptimeRanking: ScreenUptimeEntry[];
  recentNotifications: any[];
  storageUsedMB: number;
  avgMediaPerScreen: number;
}

export function useDashboardStats() {
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  return useQuery<DashboardStats>({
    queryKey: ["dashboard_stats", currentEstablishmentId, isGlobalAdmin],
    refetchInterval: 15_000,
    queryFn: async () => {
      // --- Screens ---
      let screenQuery = supabase
        .from("screens")
        .select("id, name, status, player_heartbeat_at, current_media_id, layout_id, playlist_id, orientation, fallback_since, program_id")
        .order("created_at", { ascending: false });
      if (currentEstablishmentId) screenQuery = screenQuery.eq("establishment_id", currentEstablishmentId);
      else if (!isGlobalAdmin) return emptyStats();
      const { data: screens = [] } = await screenQuery;

      const onlineScreens = screens.filter((s: any) => isScreenReallyOnline(s)).length;
      const inFallback = screens.filter((s: any) => s.fallback_since !== null && isScreenReallyOnline(s)).length;

      // Screen uptime ranking: based on heartbeat recency as a proxy for activity
      const screenUptimeRanking: ScreenUptimeEntry[] = screens
        .map((s: any) => ({
          id: s.id,
          name: s.name,
          totalHeartbeats: s.player_heartbeat_at ? 1 : 0,
          isOnline: isScreenReallyOnline(s),
          lastSeen: s.player_heartbeat_at || null,
          hasContent: !!(s.current_media_id || s.layout_id || s.playlist_id || s.program_id),
          orientation: s.orientation || "landscape",
          fallbackSince: s.fallback_since,
        }))
        .sort((a, b) => {
          // Online first, then by last heartbeat
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          if (!a.lastSeen) return 1;
          if (!b.lastSeen) return -1;
          return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        });

      // --- Media ---
      let mediaQuery = supabase.from("media").select("id, type");
      if (currentEstablishmentId) mediaQuery = mediaQuery.eq("establishment_id", currentEstablishmentId);
      const { data: media = [] } = await mediaQuery;

      const mediaByType: Record<string, number> = {};
      media.forEach((m: any) => {
        const t = m.type || "other";
        mediaByType[t] = (mediaByType[t] || 0) + 1;
      });

      // --- Playlists ---
      let plQuery = supabase.from("playlists").select("id", { count: "exact", head: true });
      if (currentEstablishmentId) plQuery = plQuery.eq("establishment_id", currentEstablishmentId);
      const { count: totalPlaylists = 0 } = await plQuery;

      // --- Layouts ---
      let layQuery = supabase.from("layouts").select("id", { count: "exact", head: true });
      if (currentEstablishmentId) layQuery = layQuery.eq("establishment_id", currentEstablishmentId);
      const { count: totalLayouts = 0 } = await layQuery;

      // --- Licenses ---
      const screenIds = screens.map((s: any) => s.id);
      let licData: any[] = [];
      if (screenIds.length > 0) {
        const { data } = await supabase
          .from("licenses")
          .select("id, is_active, valid_until, screen_id")
          .in("screen_id", screenIds);
        licData = data || [];
      }
      // Also unassigned licenses for the establishment
      if (currentEstablishmentId) {
        const { data: unassigned } = await supabase
          .from("licenses")
          .select("id, is_active, valid_until, screen_id")
          .eq("establishment_id", currentEstablishmentId)
          .is("screen_id", null);
        licData = [...licData, ...(unassigned || [])];
      }

      const now = new Date();
      const activeLicenses = licData.filter((l: any) => l.is_active && new Date(l.valid_until) > now).length;
      const expiredLicenses = licData.filter((l: any) => new Date(l.valid_until) <= now).length;
      const unassignedLicenses = licData.filter((l: any) => !l.screen_id).length;

      // --- Contents ---
      let contQuery = supabase.from("contents").select("id, status");
      if (currentEstablishmentId) {
        // Filter by screens in this establishment
        if (screenIds.length > 0) {
          contQuery = contQuery.in("screen_id", screenIds);
        } else {
          contQuery = contQuery.eq("screen_id", "00000000-0000-0000-0000-000000000000");
        }
      }
      const { data: contents = [] } = await contQuery;
      const pendingContents = contents.filter((c: any) => c.status === "pending").length;
      const activeContents = contents.filter((c: any) => c.status === "active").length;

      // --- Recent notifications ---
      let notifQuery = supabase
        .from("notifications")
        .select("id, title, message, type, created_at, is_read")
        .order("created_at", { ascending: false })
        .limit(5);
      if (currentEstablishmentId) notifQuery = notifQuery.eq("establishment_id", currentEstablishmentId);
      const { data: recentNotifications = [] } = await notifQuery;

      // --- Avg media per screen ---
      const screensWithContent = screens.filter((s: any) => s.current_media_id || s.playlist_id || s.layout_id).length;
      const avgMediaPerScreen = screens.length > 0 ? Math.round((screensWithContent / screens.length) * 100) : 0;

      return {
        totalScreens: screens.length,
        onlineScreens,
        offlineScreens: screens.length - onlineScreens,
        inFallback,
        totalMedia: media.length,
        mediaByType,
        totalPlaylists: totalPlaylists || 0,
        totalLayouts: totalLayouts || 0,
        activeLicenses,
        expiredLicenses,
        unassignedLicenses,
        totalContents: contents.length,
        pendingContents,
        activeContents,
        screenUptimeRanking,
        recentNotifications,
        storageUsedMB: 0,
        avgMediaPerScreen,
      };
    },
  });
}

function emptyStats(): DashboardStats {
  return {
    totalScreens: 0, onlineScreens: 0, offlineScreens: 0, inFallback: 0,
    totalMedia: 0, mediaByType: {}, totalPlaylists: 0, totalLayouts: 0,
    activeLicenses: 0, expiredLicenses: 0, unassignedLicenses: 0,
    totalContents: 0, pendingContents: 0, activeContents: 0,
    screenUptimeRanking: [], recentNotifications: [], storageUsedMB: 0,
    avgMediaPerScreen: 0,
  };
}
