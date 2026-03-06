import { useState } from "react";
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { useSchedules } from "@/hooks/useSchedules";
import { toast } from "sonner";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function ScheduleManager() {
  const { screens } = useScreens();
  const { media } = useMedia();
  const [selectedScreen, setSelectedScreen] = useState("");
  const [formMedia, setFormMedia] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const { schedules, isLoading, addSchedule, updateSchedule, deleteSchedule } =
    useSchedules(selectedScreen || undefined);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleAdd = async () => {
    if (!formMedia || !selectedScreen) return;
    try {
      await addSchedule.mutateAsync({
        media_id: formMedia,
        start_time: startTime,
        end_time: endTime,
        days_of_week: days,
      });
      toast.success("Programmation ajoutée");
      setFormMedia("");
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">Programmation Horaire</h2>
      </div>

      <Select value={selectedScreen} onValueChange={setSelectedScreen}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Choisir un écran" />
        </SelectTrigger>
        <SelectContent>
          {screens.map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedScreen && (
        <>
          <Card className="glass-panel p-4 space-y-4">
            <p className="text-sm font-medium text-foreground">Nouvelle programmation</p>
            <div className="flex flex-wrap gap-3 items-end">
              <Select value={formMedia} onValueChange={setFormMedia}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Média" />
                </SelectTrigger>
                <SelectContent>
                  {media.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Début</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[130px]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fin</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-[130px]" />
              </div>
              <Button onClick={handleAdd} disabled={!formMedia} className="gap-2">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((label, i) => (
                <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={days.includes(i)} onCheckedChange={() => toggleDay(i)} />
                  <span className="text-xs text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </Card>

          {isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : schedules.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune programmation pour cet écran.</p>
          ) : (
            <div className="space-y-2">
              {schedules.map((sch) => (
                <Card key={sch.id} className="glass-panel p-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">
                      {sch.media?.name ?? "Média supprimé"}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {sch.start_time.slice(0, 5)} – {sch.end_time.slice(0, 5)}
                    </Badge>
                    <div className="flex gap-1">
                      {DAYS.map((label, i) => (
                        <Badge
                          key={i}
                          variant={sch.days_of_week.includes(i) ? "default" : "outline"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {label.charAt(0)}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 ml-auto"
                      onClick={() =>
                        updateSchedule.mutate({ id: sch.id, active: !sch.active })
                      }
                      title={sch.active ? "Désactiver" : "Activer"}
                    >
                      {sch.active ? (
                        <ToggleRight className="h-4 w-4 text-status-online" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-status-offline" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteSchedule.mutate(sch.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
