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
  layout_id: string | null;
  playlist_id: string | null;
  program_id: string | null;
}

interface PlaylistItem {
  id: string;
  media_id: string;
  position: number;
  duration: number | null;
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
  const currentTime = now.toTimeString().slice(0, 5);
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

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const SESSION_ID = generateSessionId();
const HEARTBEAT_INTERVAL = 5000;
const SESSION_TIMEOUT = 15000;

export function useScreenRealtime(screenId: string | undefined) {
  const [screen, setScreen] = useState<ScreenData | null>(null);
  const [media, setMedia] = useState<MediaData | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const schedulesRef = useRef<ScheduleRow[]>([]);
  const realScreenIdRef = useRef<string | undefined>(undefined);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  // Keep a ref of screen to avoid resetting timer on heartbeat-only updates
  const screenRef = useRef<ScreenData | null>(null);

  const fetchPlaylist = useCallback(async (screenData: ScreenData) => {
    if (screenData.playlist_id) {
      const { data } = await supabase
        .from("playlist_items")
        .select("*, media:media_id(id, name, type, url, duration)")
        .eq("playlist_id", screenData.playlist_id)
        .order("position", { ascending: true });
      return (data ?? []) as PlaylistItem[];
    }
    const { data } = await supabase
      .from("playlist_items")
      .select("*, media:media_id(id, name, type, url, duration)")
      .eq("screen_id", screenData.id)
      .order("position", { ascending: true });
    return (data ?? []) as PlaylistItem[];
  }, []);

  const fetchSchedules = useCallback(async (screenData: ScreenData) => {
    if (screenData.program_id) {
      const { data } = await supabase
        .from("schedules")
        .select("*, media:media_id(id, name, type, url, duration)")
        .eq("program_id", screenData.program_id)
        .eq("active", true);
      return (data ?? []) as ScheduleRow[];
    }
    const { data } = await supabase
      .from("schedules")
      .select("*, media:media_id(id, name, type, url, duration)")
      .eq("screen_id", screenData.id)
      .eq("active", true);
    return (data ?? []) as ScheduleRow[];
  }, []);

  const resolveMedia = useCallback(
    (screenData: ScreenData | null, pl: PlaylistItem[], idx: number) => {
      const scheduled = getActiveScheduleMedia(schedulesRef.current);
      if (scheduled) { setMedia(scheduled); return; }
      if (pl.length > 0) { setMedia(pl[idx % pl.length]?.media ?? null); return; }
      if (screenData?.current_media_id) return;
      setMedia(null);
    },
    []
  );

  // Get effective duration for a playlist item (item override > media default > 10s)
  const getItemDuration = useCallback((pl: PlaylistItem[], idx: number): number => {
    if (pl.length === 0) return 0;
    const item = pl[idx % pl.length];
    if (!item) return 10;
    // Use playlist_items.duration override if set, else media.duration, else 10
    return item.duration ?? item.media?.duration ?? 10;
  }, []);

  useEffect(() => {
    if (!screenId) return;

    const init = async () => {
      let screenRes = await supabase.from("screens").select("*").eq("slug", screenId).maybeSingle();
      if (!screenRes.data) {
        screenRes = await supabase.from("screens").select("*").eq("id", screenId).maybeSingle();
      }
      const screenData = screenRes.data as any;
      if (!screenData) { setLoading(false); return; }
      realScreenIdRef.current = screenData.id;

      const userAgent = navigator.userAgent;
      const staleThreshold = new Date(Date.now() - SESSION_TIMEOUT).toISOString();

      let claimRes = await supabase.from("screens").update({
        player_session_id: SESSION_ID, player_heartbeat_at: new Date().toISOString(),
        player_user_agent: userAgent, status: "online",
      } as any).eq("id", screenData.id).is("player_session_id", null);

      if ((claimRes as any).count === 0) {
        claimRes = await supabase.from("screens").update({
          player_session_id: SESSION_ID, player_heartbeat_at: new Date().toISOString(),
          player_user_agent: userAgent, status: "online",
        } as any).eq("id", screenData.id).eq("player_session_id", SESSION_ID);
      }
      if ((claimRes as any).count === 0) {
        claimRes = await supabase.from("screens").update({
          player_session_id: SESSION_ID, player_heartbeat_at: new Date().toISOString(),
          player_user_agent: userAgent, status: "online",
        } as any).eq("id", screenData.id).lt("player_heartbeat_at", staleThreshold);
      }

      const { data: verifyData } = await supabase.from("screens").select("player_session_id").eq("id", screenData.id).single();
      if (verifyData && (verifyData as any).player_session_id !== SESSION_ID) {
        setSessionBlocked(true);
        setScreen(screenData as ScreenData);
        screenRef.current = screenData as ScreenData;
        setLoading(false);
        return;
      }

      heartbeatRef.current = setInterval(async () => {
        const realId = realScreenIdRef.current;
        if (!realId) return;
        try {
          await (supabase.from("screens").update({ player_heartbeat_at: new Date().toISOString() } as any) as any).eq("id", realId).eq("player_session_id", SESSION_ID);
        } catch (_) {}
      }, HEARTBEAT_INTERVAL);

      setScreen(screenData as ScreenData);
      screenRef.current = screenData as ScreenData;

      const [pl, sch] = await Promise.all([
        fetchPlaylist(screenData as ScreenData),
        fetchSchedules(screenData as ScreenData),
      ]);
      setPlaylist(pl);
      schedulesRef.current = sch;

      if (screenData?.current_media_id && pl.length === 0) {
        const { data: mediaData } = await supabase.from("media").select("*").eq("id", screenData.current_media_id).single();
        if (mediaData) setMedia(mediaData as MediaData);
      }

      resolveMedia(screenData, pl, 0);
      setLoading(false);
    };

    init();

    const setOffline = () => {
      const realId = realScreenIdRef.current;
      if (!realId) return;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/screens?id=eq.${realId}&player_session_id=eq.${SESSION_ID}&apikey=${apiKey}`;
      const body = JSON.stringify({ status: "offline", player_session_id: null, player_heartbeat_at: null, player_user_agent: null });
      try {
        fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}`, 'Prefer': 'return=minimal' },
          body, keepalive: true,
        }).catch(() => {});
      } catch (_) {}
    };

    window.addEventListener("beforeunload", setOffline);
    return () => { setOffline(); window.removeEventListener("beforeunload", setOffline); };
  }, [screenId, resolveMedia]);

  // Playlist advancement timer — uses refs to avoid resetting on heartbeat updates
  useEffect(() => {
    if (playlist.length <= 1) return;
    const duration = getItemDuration(playlist, currentIndex) * 1000;
    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % playlist.length;
        resolveMedia(screenRef.current, playlist, next);
        return next;
      });
    }, duration);
    return () => clearTimeout(timerRef.current);
  }, [currentIndex, playlist, resolveMedia, getItemDuration]);

  useEffect(() => {
    if (!screenId) return;
    const interval = setInterval(() => { resolveMedia(screenRef.current, playlist, currentIndex); }, 60_000);
    return () => clearInterval(interval);
  }, [screenId, playlist, currentIndex, resolveMedia]);

  useEffect(() => {
    const realId = realScreenIdRef.current;
    if (!realId) return;

    const channel = supabase
      .channel(`screen-${realId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "screens", filter: `id=eq.${realId}` }, async (payload) => {
        const newData = payload.new as ScreenData;
        const oldData = payload.old as Partial<ScreenData>;

        const relevantChange =
          newData.current_media_id !== oldData.current_media_id ||
          newData.layout_id !== oldData.layout_id ||
          newData.playlist_id !== oldData.playlist_id ||
          newData.program_id !== oldData.program_id ||
          newData.orientation !== oldData.orientation;

        // Always keep screen state fresh for UI fields
        setScreen(newData);
        screenRef.current = newData;

        if (!relevantChange) return;

        if (newData.current_media_id) {
          const { data: mediaData } = await supabase.from("media").select("*").eq("id", newData.current_media_id).single();
          if (mediaData) setMedia(mediaData as MediaData);
        }
        const [pl, sch] = await Promise.all([fetchPlaylist(newData), fetchSchedules(newData)]);
        setPlaylist(pl);
        schedulesRef.current = sch;
        setCurrentIndex(0);
        resolveMedia(newData, pl, 0);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, async () => {
        const s = screenRef.current;
        if (!s) return;
        const pl = await fetchPlaylist(s);
        setPlaylist(pl);
        setCurrentIndex(0);
        resolveMedia(s, pl, 0);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "schedules" }, async () => {
        const s = screenRef.current;
        if (!s) return;
        const sch = await fetchSchedules(s);
        schedulesRef.current = sch;
        resolveMedia(s, playlist, currentIndex);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [screen?.id, screen?.playlist_id, screen?.program_id, fetchPlaylist, fetchSchedules, resolveMedia]);

  const currentDuration = playlist.length > 0
    ? getItemDuration(playlist, currentIndex)
    : (media?.duration ?? 0);

  const forceTakeover = useCallback(async () => {
    const realId = realScreenIdRef.current;
    if (!realId) return;
    await supabase.from("screens").update({
      player_session_id: SESSION_ID, player_heartbeat_at: new Date().toISOString(),
      player_user_agent: navigator.userAgent, status: "online",
    } as any).eq("id", realId);
    setSessionBlocked(false);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      if (!realScreenIdRef.current) return;
      try {
        await (supabase.from("screens").update({ player_heartbeat_at: new Date().toISOString() } as any) as any).eq("id", realScreenIdRef.current).eq("player_session_id", SESSION_ID);
      } catch (_) {}
    }, HEARTBEAT_INTERVAL);
    const s = screenRef.current;
    if (!s) return;
    const [pl, sch] = await Promise.all([fetchPlaylist(s), fetchSchedules(s)]);
    setPlaylist(pl);
    schedulesRef.current = sch;
    if (s?.current_media_id && pl.length === 0) {
      const { data: mediaData } = await supabase.from("media").select("*").eq("id", s.current_media_id).single();
      if (mediaData) setMedia(mediaData as MediaData);
    }
    resolveMedia(s, pl, 0);
  }, [fetchPlaylist, fetchSchedules, resolveMedia]);

  return { screen, media, loading, sessionBlocked, forceTakeover, playlistLength: playlist.length, currentIndex, currentDuration, layoutId: screen?.layout_id ?? null };
}
