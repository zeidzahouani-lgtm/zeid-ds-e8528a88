import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, Tv, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useTrackedSchedules, useLaunchSchedule, type TrackedSchedule } from "@/hooks/useScheduleTracking";
import { durationMinutes, formatDuration, nextOccurrence, slotState, STATE_LABELS } from "@/lib/schedule-utils";

const STATE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  running: "default",
  upcoming: "secondary",
  done: "outline",
};

export function ScheduleTracking() {
  const { schedules, isLoading } = useTrackedSchedules();
  const launch = useLaunchSchedule();
  const [screenFilter, setScreenFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const now = new Date();

  const screensList = useMemo(() => {
    const map = new Map<string, string>();
    schedules.forEach((s) => s.screen && map.set(s.screen.id, s.screen.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [schedules]);

  const rows = useMemo(() => {
    return schedules
      .map((s) => ({
        sch: s,
        state: slotState(s, now),
        next: nextOccurrence(s, now),
        duration: durationMinutes(s),
      }))
      .filter((r) => (screenFilter === "all" ? true : r.sch.screen_id === screenFilter))
      .filter((r) => (stateFilter === "all" ? true : r.state === stateFilter))
      .sort((a, b) => {
        const order = { running: 0, upcoming: 1, done: 2 } as const;
        if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
        return (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, screenFilter, stateFilter]);

  const handleLaunch = (sch: TrackedSchedule) => {
    launch.mutate(sch, {
      onSuccess: () => toast.success(`Diffusion lancée sur ${sch.screen?.name ?? "l'écran"}`),
      onError: (e: any) => toast.error(e?.message || "Impossible de lancer l'affichage"),
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-border/50 flex flex-wrap items-center gap-3">
        <ListChecks className="h-4 w-4 text-primary" />
        <Select value={screenFilter} onValueChange={setScreenFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les écrans</SelectItem>
            {screensList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            <SelectItem value="running">En cours</SelectItem>
            <SelectItem value="upcoming">À venir</SelectItem>
            <SelectItem value="done">Terminé</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{rows.length} créneau(x)</span>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : rows.length === 0 ? (
        <Card className="p-8 border-border/50 text-center text-muted-foreground text-sm">
          Aucun créneau programmé.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map(({ sch, state, next, duration }) => (
            <Card key={sch.id} className="p-3 border-border/50">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant={STATE_VARIANT[state]} className="text-[10px]">
                  {STATE_LABELS[state]}
                </Badge>
                <span className="flex items-center gap-1.5 text-sm font-medium min-w-0">
                  <Tv className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{sch.screen?.name ?? "Écran inconnu"}</span>
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {sch.playlist?.name ?? sch.media?.name ?? "Contenu supprimé"}
                </span>
                <Badge variant="outline" className="text-xs gap-1">
                  <Clock className="h-3 w-3" />
                  {sch.start_time.slice(0, 5)} – {sch.end_time.slice(0, 5)}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{formatDuration(duration)}</Badge>
                <Badge variant="outline" className="text-[10px]">
                  {next ? `Prochaine : ${format(next, "EEE d MMM HH:mm", { locale: fr })}` : "Plus de diffusion"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto gap-1.5"
                  disabled={launch.isPending || !sch.screen_id}
                  onClick={() => handleLaunch(sch)}
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
