import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MediaData {
  id: string;
  name: string;
  type: string;
  url: string;
  duration: number;
}

interface ScreenData {
  id: string;
  name: string;
  orientation: string;
  status: string;
  current_media_id: string | null;
}

interface PlaylistItem {
  id: string;
  media_id: string;
  position: number;
  media: MediaData;
}

interface ScheduleRow {
  id: string;
  media_id: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  active: boolean;
  media: MediaData | null;
}

function getActiveScheduleMedia(schedules: ScheduleRow[]): MediaData | null {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  const currentDay = now.getDay();

  for (const sch of schedules) {
    if (!sch.active || !sch.media) continue;
    if (!sch.days_of_week.includes(currentDay)) continue;
    const start = sch.start_time.slice(0, 5);
    const end = sch.end_time.slice(0, 5);
    if (currentTime >= start && currentTime <= end) {
      return sch.media;
    }
  }
  return null;
}

export function useScreenRealtime(screenId: string | undefined) {
  const [screen, setScreen] = useState<ScreenData | null>(null);
  const [media, setMedia] = useState<MediaData | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const schedulesRef = useRef<ScheduleRow[]>([]);

  const fetchPlaylist = useCallback(async () => {
    if (!screenId) return [];
    const { data } = await supabase
      .from("playlist_items")
      .select("*, media:media_id(id, name, type, url, duration)")
      .eq("screen_id", screenId)
      .order("position", { ascending: true });
    return (data ?? []) as PlaylistItem[];
  }, [screenId]);

  const fetchSchedules = useCallback(async () => {
    if (!screenId) return [];
    const { data } = await supabase
      .from("schedules")
      .select("*, media:media_id(id, name, type, url, duration)")
      .eq("screen_id", screenId)
      .eq("active", true);
    return (data ?? []) as ScheduleRow[];
  }, [screenId]);

  // Determine what media to show
  const resolveMedia = useCallback(
    (screenData: ScreenData | null, pl: PlaylistItem[], idx: number) => {
      // 1. Check active schedule
      const scheduled = getActiveScheduleMedia(schedulesRef.current);
      if (scheduled) {
        setMedia(scheduled);
        return;
      }
      // 2. Check playlist
      if (pl.length > 0) {
        setMedia(pl[idx % pl.length]?.media ?? null);
        return;
      }
      // 3. Fallback to single assigned media
      if (screenData?.current_media_id) {
        // media already set from initial fetch or update
        return;
      }
      setMedia(null);
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    if (!screenId) return;

    const init = async () => {
        // Try by slug first, then by id (backward compat)
        let screenRes = await supabase.from("screens").select("*").eq("slug", screenId).single();
        if (screenRes.error) {
          screenRes = await supabase.from("screens").select("*").eq("id", screenId).single();
        }
        fetchSchedules(),
      ]);

      const screenData = screenRes.data as ScreenData | null;
      if (screenData) {
        setScreen(screenData);
        await supabase.from("screens").update({ status: "online" }).eq("id", screenId);
      }

      setPlaylist(pl);
      schedulesRef.current = sch;

      // If single media assigned and no playlist/schedule override
      if (screenData?.current_media_id && pl.length === 0) {
        const { data: mediaData } = await supabase
          .from("media")
          .select("*")
          .eq("id", screenData.current_media_id)
          .single();
        if (mediaData) setMedia(mediaData as MediaData);
      }

      resolveMedia(screenData, pl, 0);
      setLoading(false);
    };

    init();

    // Set offline on tab close / navigation
    const setOffline = () => {
      if (!screenId) return;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/screens?id=eq.${screenId}&apikey=${apiKey}`;
      const body = JSON.stringify({ status: "offline" });
      // keepalive fetch works on beforeunload and supports headers
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Prefer': 'return=minimal',
        },
        body,
        keepalive: true,
      }).catch(() => {});
    };

    const onVisChange = () => {
      if (document.visibilityState === "hidden") setOffline();
    };

    window.addEventListener("beforeunload", setOffline);
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      setOffline();
      window.removeEventListener("beforeunload", setOffline);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [screenId, fetchPlaylist, fetchSchedules, resolveMedia]);

  // Playlist rotation timer
  useEffect(() => {
    if (playlist.length <= 1) return;

    const currentItem = playlist[currentIndex % playlist.length];
    const duration = (currentItem?.media?.duration ?? 10) * 1000;

    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % playlist.length;
        resolveMedia(screen, playlist, next);
        return next;
      });
    }, duration);

    return () => clearTimeout(timerRef.current);
  }, [currentIndex, playlist, screen, resolveMedia]);

  // Check schedules every minute
  useEffect(() => {
    if (!screenId) return;
    const interval = setInterval(() => {
      resolveMedia(screen, playlist, currentIndex);
    }, 60_000);
    return () => clearInterval(interval);
  }, [screenId, screen, playlist, currentIndex, resolveMedia]);

  // Real-time: screen updates
  useEffect(() => {
    if (!screenId) return;

    const channel = supabase
      .channel(`screen-${screenId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "screens",
        filter: `id=eq.${screenId}`,
      }, async (payload) => {
        const newData = payload.new as ScreenData;
        setScreen(newData);

        if (newData.current_media_id) {
          const { data: mediaData } = await supabase
            .from("media")
            .select("*")
            .eq("id", newData.current_media_id)
            .single();
          if (mediaData) setMedia(mediaData as MediaData);
        }

        // Re-fetch playlist & schedules
        const [pl, sch] = await Promise.all([fetchPlaylist(), fetchSchedules()]);
        setPlaylist(pl);
        schedulesRef.current = sch;
        setCurrentIndex(0);
        resolveMedia(newData, pl, 0);
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "playlist_items",
      }, async () => {
        const pl = await fetchPlaylist();
        setPlaylist(pl);
        setCurrentIndex(0);
        resolveMedia(screen, pl, 0);
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "schedules",
      }, async () => {
        const sch = await fetchSchedules();
        schedulesRef.current = sch;
        resolveMedia(screen, playlist, currentIndex);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [screenId, screen, playlist, currentIndex, fetchPlaylist, fetchSchedules, resolveMedia]);

  const currentDuration = playlist.length > 0
    ? (playlist[currentIndex % playlist.length]?.media?.duration ?? 10)
    : (media?.duration ?? 0);

  return { screen, media, loading, playlistLength: playlist.length, currentIndex, currentDuration };
}
