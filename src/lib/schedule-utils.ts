import { format } from "date-fns";

export interface SlotLike {
  active: boolean;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string | null;
  end_date: string | null;
}

export function occursOn(sch: SlotLike, date: Date) {
  if (!sch.active) return false;
  const key = format(date, "yyyy-MM-dd");
  if (sch.start_date && key < sch.start_date) return false;
  if (sch.end_date && key > sch.end_date) return false;
  return !!sch.days_of_week?.includes(date.getDay());
}

/** Durée du créneau en minutes */
export function durationMinutes(sch: { start_time: string; end_time: string }) {
  const [sh, sm] = sch.start_time.split(":").map(Number);
  const [eh, em] = sch.end_time.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function formatDuration(minutes: number) {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

function atTime(date: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

/** Prochaine date/heure de début du créneau (à partir de `from`), ou null si terminé */
export function nextOccurrence(sch: SlotLike, from: Date = new Date()): Date | null {
  for (let i = 0; i < 400; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (!occursOn(sch, d)) continue;
    const start = atTime(d, sch.start_time);
    if (start >= from) return start;
  }
  return null;
}

export type SlotState = "upcoming" | "running" | "done";

/** État du créneau pour un jour donné */
export function slotState(sch: SlotLike, now: Date = new Date()): SlotState {
  if (occursOn(sch, now)) {
    const start = atTime(now, sch.start_time);
    const end = atTime(now, sch.end_time);
    if (now >= start && now <= end) return "running";
    if (now < start) return "upcoming";
  }
  return nextOccurrence(sch, now) ? "upcoming" : "done";
}

export const STATE_LABELS: Record<SlotState, string> = {
  upcoming: "À venir",
  running: "En cours",
  done: "Terminé",
};
