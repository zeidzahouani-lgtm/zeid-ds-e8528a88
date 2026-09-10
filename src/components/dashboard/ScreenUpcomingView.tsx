import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, SkipForward, Tv, Play, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useScreens } from "@/hooks/useScreens";
import { useTrackedSchedules, useLaunchSchedule, type TrackedSchedule } from "@/hooks/useScheduleTracking";
import { durationMinutes, formatDuration, nextOccurrence, slotState, STATE_LABELS } from "@/lib/schedule-utils";

export function ScreenUpcomingView() {
  const { screens } = useScreens();
  const { schedules } = useTrackedSchedules();
  const launch = useLaunchSchedule();
  const [screenId, setScreenId] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [tick, setTick] = useState(0);

  const lastLaunchedRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();

  const upcoming = useMemo(() => {
    return schedules
      .filter((s) => s.screen_id === screenId)
      .map((s) => ({ sch: s, next: nextOccurrence(s, now), state: slotState(s, now), duration: durationMinutes(s) }))
      .filter((r) => r.next !== null || r.state === "running")
      .sort((a, b) => (a.next?.getTime() ?? 0) - (b.next?.getTime() ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, screenId, tick]);

  const current = upcoming.find((r) => r.state === "running") ?? null;
  const nextSlot = upcoming.find((r) => r !== current) ?? null;

  const doLaunch = (sch: TrackedSchedule, label: string) => {
    launch.mutate(sch, {
      onSuccess: () => toast.success(label),
      onError: (e: any) => toast.error(e?.message || "Impossible de lancer l'affichage"),
    });
  };

  // Passage automatique au créneau suivant dès qu'il démarre (une seule fois par créneau)
  useEffect(() => {
    if (!autoAdvance) {
      lastLaunchedRef.current = null;
      return;
    }
    if (!screenId) return;
    const starting = upcoming.find((r) => r.state === "running");
    if (!starting) return;
    if (lastLaunchedRef.current === starting.sch.id) return;
    lastLaunchedRef.current = starting.sch.id;
    launch.mutate(starting.sch, {
      onSuccess: () =>
        toast.success(
          `Créneau lancé : ${starting.sch.playlist?.name ?? starting.sch.media?.name ?? "contenu"}`,
        ),
      onError: () => {
        lastLaunchedRef.current = null;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvance, screenId, tick, upcoming]);

  return (
    <div className="space-y-4">
      <Card className="p-4 border-border/50 flex flex-wrap items-center gap-3">
        <Tv className="h-4 w-4 text-primary" />
        <Select value={screenId} onValueChange={setScreenId}>
          <SelectTrigger className="w-[260px]"><SelectValue placeholder="Choisir un écran" /></SelectTrigger>
          <SelectContent>
            {screens.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {screenId && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} />
              Passage automatique au créneau suivant
            </label>
            <Button
              size="sm"
              className="ml-auto gap-1.5"
              disabled={!nextSlot || launch.isPending}
              onClick={() => nextSlot && doLaunch(nextSlot.sch, "Passage au créneau suivant")}
            >
              <SkipForward className="h-4 w-4" /> Créneau suivant
            </Button>
          </>
        )}
      </Card>

      {!screenId ? (
        <Card className="p-8 border-border/50 text-center text-muted-foreground text-sm">
          Sélectionnez un écran pour voir ses créneaux à venir.
        </Card>
      ) : upcoming.length === 0 ? (
        <Card className="p-8 border-border/50 text-center text-muted-foreground text-sm">
          Aucun créneau à venir sur cet écran.
        </Card>
      ) : (
        <div className="space-y-2">
          {upcoming.map(({ sch, next, state, duration }) => (
            <Card
              key={sch.id}
              className={`p-4 border-border/50 ${state === "running" ? "border-primary/60 bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={state === "running" ? "default" : "secondary"} className="text-[10px]">
                  {STATE_LABELS[state]}
                </Badge>
                <span className="font-medium text-sm truncate">
                  {sch.playlist?.name ?? sch.media?.name ?? "Contenu supprimé"}
                </span>
                <Badge variant="outline" className="text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  {sch.start_time.slice(0, 5)} – {sch.end_time.slice(0, 5)}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{formatDuration(duration)}</Badge>
                <Badge variant="outline" className="text-[10px] gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {next ? format(next, "EEE d MMM HH:mm", { locale: fr }) : "En cours"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-1.5"
                  disabled={launch.isPending}
                  onClick={() => doLaunch(sch, "Diffusion lancée")}
                >
                  <Play className="h-3.5 w-3.5" /> Lancer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
