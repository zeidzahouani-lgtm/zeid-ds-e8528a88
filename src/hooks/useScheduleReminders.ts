import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReminderRow {
  id: string;
  screen_id: string | null;
  start_time: string;
  days_of_week: number[];
  start_date: string | null;
  end_date: string | null;
  reminder_minutes: number | null;
  active: boolean;
  media?: { name: string } | null;
  playlist?: { name: string } | null;
}

const FIRED_KEY = "schedule_reminders_fired";

function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveFired(map: Record<string, number>) {
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const cleaned = Object.fromEntries(Object.entries(map).filter(([, t]) => t > cutoff));
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(cleaned));
  } catch {}
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Watches scheduled slots that have a reminder configured and notifies
 * the user shortly before the slot starts.
 */
export function useScheduleReminders(enabled = true) {
  const screensRef = useRef<Record<string, string>>({});

  const { data: reminders = [] } = useQuery({
    queryKey: ["schedule_reminders"],
    enabled,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select(
          "id, screen_id, start_time, days_of_week, start_date, end_date, reminder_minutes, active, media:media_id(name), playlist:playlist_id(name)"
        )
        .not("reminder_minutes", "is", null)
        .eq("active", true);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ReminderRow[];
      const ids = Array.from(new Set(rows.map((r) => r.screen_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: screens } = await supabase.from("screens").select("id, name").in("id", ids);
        screensRef.current = Object.fromEntries((screens ?? []).map((s: any) => [s.id, s.name]));
      }
      return rows;
    },
  });

  useEffect(() => {
    if (!enabled || reminders.length === 0) return;

    const check = () => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const fired = loadFired();
      let changed = false;

      reminders.forEach((r) => {
        if (!r.reminder_minutes) return;
        if (!r.days_of_week?.includes(now.getDay())) return;
        if (r.start_date && todayStr < r.start_date) return;
        if (r.end_date && todayStr > r.end_date) return;

        const [h, m] = r.start_time.split(":").map(Number);
        const start = new Date(now);
        start.setHours(h, m || 0, 0, 0);
        const remindAt = start.getTime() - r.reminder_minutes * 60 * 1000;
        const delta = now.getTime() - remindAt;
        if (delta < 0 || delta > 5 * 60 * 1000) return;

        const key = `${r.id}_${todayStr}`;
        if (fired[key]) return;
        fired[key] = Date.now();
        changed = true;

        const label = r.playlist?.name || r.media?.name || "Contenu programmé";
        const screenName = r.screen_id ? screensRef.current[r.screen_id] : null;
        const message = `${label} démarre à ${pad(h)}:${pad(m || 0)}${screenName ? ` sur ${screenName}` : ""}`;

        toast.info("Rappel de programmation", { description: message, duration: 12000 });
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Rappel de programmation", { body: message });
          }
        } catch {}
      });

      if (changed) saveFired(fired);
    };

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [reminders, enabled]);
}
