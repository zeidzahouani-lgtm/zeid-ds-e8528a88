import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Clock, Plus, Trash2, Tv, Bell, BellOff, Repeat, Pencil, CalendarClock, Timer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useScreens } from "@/hooks/useScreens";
import { useMedia } from "@/hooks/useMedia";
import { usePlaylists } from "@/hooks/usePlaylists";
import { useScreenSchedules, type ScreenSchedule } from "@/hooks/useScreenSchedules";
import { durationMinutes, formatDuration, nextOccurrence } from "@/lib/schedule-utils";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

type Repetition = "once" | "daily" | "weekdays" | "weekly" | "custom";

const REPETITIONS: { value: Repetition; label: string }[] = [
  { value: "once", label: "Une seule fois" },
  { value: "daily", label: "Tous les jours" },
  { value: "weekdays", label: "Du lundi au vendredi" },
  { value: "weekly", label: "Chaque semaine (même jour)" },
  { value: "custom", label: "Jours personnalisés" },
];

const REMINDERS = [
  { value: "0", label: "Aucun rappel" },
  { value: "5", label: "5 minutes avant" },
  { value: "15", label: "15 minutes avant" },
  { value: "30", label: "30 minutes avant" },
  { value: "60", label: "1 heure avant" },
  { value: "1440", label: "1 jour avant" },
];

function occursOn(sch: ScreenSchedule, date: Date) {
  if (!sch.active) return false;
  const key = format(date, "yyyy-MM-dd");
  if (sch.start_date && key < sch.start_date) return false;
  if (sch.end_date && key > sch.end_date) return false;
  return sch.days_of_week?.includes(date.getDay());
}

export function ScreenScheduleCalendar() {
  const { screens } = useScreens();
  const { media } = useMedia();
  const { playlists } = usePlaylists();

  const [screenId, setScreenId] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [kind, setKind] = useState<"media" | "playlist">("media");
  const [mediaId, setMediaId] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [repetition, setRepetition] = useState<Repetition>("once");
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState("");
  const [reminder, setReminder] = useState("15");

  const { schedules, isLoading, addSchedule, updateSchedule, deleteSchedule } = useScreenSchedules(screenId || undefined);

  const currentScreen: any = screens.find((s: any) => s.id === screenId);

  const markedDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = -31; i < 120; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (schedules.some((s) => occursOn(s, d))) dates.push(d);
    }
    return dates;
  }, [schedules]);

  const daySchedules = useMemo(
    () => (selectedDate ? schedules.filter((s) => occursOn(s, selectedDate)) : []),
    [schedules, selectedDate]
  );

  const toggleCustomDay = (d: number) =>
    setCustomDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const resolveDays = (date: Date): number[] => {
    switch (repetition) {
      case "daily": return [0, 1, 2, 3, 4, 5, 6];
      case "weekdays": return [1, 2, 3, 4, 5];
      case "weekly": return [date.getDay()];
      case "custom": return customDays;
      default: return [date.getDay()];
    }
  };

  const openDialog = () => {
    if (!screenId) {
      toast.error("Choisissez d'abord un écran");
      return;
    }
    setEditingId(null);
    setMediaId("");
    setPlaylistId("");
    setKind("media");
    setStartTime("08:00");
    setEndTime("18:00");
    setRepetition("once");
    setCustomDays([]);
    setEndDate("");
    setReminder("15");
    setOpen(true);
  };

  const openEdit = (sch: ScreenSchedule) => {
    setEditingId(sch.id);
    setKind(sch.playlist_id ? "playlist" : "media");
    setMediaId(sch.media_id ?? "");
    setPlaylistId(sch.playlist_id ?? "");
    setStartTime(sch.start_time.slice(0, 5));
    setEndTime(sch.end_time.slice(0, 5));
    if (sch.start_date && sch.start_date === sch.end_date) setRepetition("once");
    else if (sch.days_of_week.length === 7) setRepetition("daily");
    else if (sch.days_of_week.join() === "1,2,3,4,5") setRepetition("weekdays");
    else if (sch.days_of_week.length === 1) setRepetition("weekly");
    else setRepetition("custom");
    setCustomDays(sch.days_of_week ?? []);
    setEndDate(sch.end_date && sch.end_date !== sch.start_date ? sch.end_date : "");
    setReminder(sch.reminder_minutes ? String(sch.reminder_minutes) : "0");
    if (sch.start_date) setSelectedDate(parseISO(sch.start_date));
    setOpen(true);
  };


  const handleSave = async () => {
    if (!selectedDate) {
      toast.error("Choisissez une date dans le calendrier");
      return;
    }
    if (kind === "media" && !mediaId) {
      toast.error("Choisissez un média à diffuser");
      return;
    }
    if (kind === "playlist" && !playlistId) {
      toast.error("Choisissez une playlist à diffuser");
      return;
    }
    if (endTime <= startTime) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    const days = resolveDays(selectedDate);
    if (days.length === 0) {
      toast.error("Sélectionnez au moins un jour");
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    setSaving(true);
    try {
      await addSchedule.mutateAsync({
        media_id: kind === "media" ? mediaId : null,
        playlist_id: kind === "playlist" ? playlistId : null,
        start_time: startTime,
        end_time: endTime,
        days_of_week: days,
        start_date: dateStr,
        end_date: repetition === "once" ? dateStr : endDate || null,
        reminder_minutes: reminder === "0" ? null : Number(reminder),
      });
      toast.success("Créneau planifié");
      setOpen(false);
      setMediaId("");
      setPlaylistId("");
    } catch (e: any) {
      console.error("Erreur planification créneau:", e);
      toast.error(e?.message || "Erreur lors de la planification");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-4">
      <Card className="p-4 border-border/50 flex flex-wrap items-center gap-3">
        <Tv className="h-4 w-4 text-primary" />
        <Select value={screenId} onValueChange={setScreenId}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Choisir un écran" />
          </SelectTrigger>
          <SelectContent>
            {screens.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {screenId && (
          <Button size="sm" className="gap-1.5" onClick={openDialog}>
            <Plus className="h-4 w-4" /> Planifier un créneau
          </Button>
        )}
        {currentScreen?.program_id && (
          <Badge variant="secondary" className="text-[10px]">
            Cet écran suit un programme : ses créneaux de programme restent prioritaires
          </Badge>
        )}
      </Card>

      {!screenId ? (
        <Card className="p-8 border-border/50 text-center text-muted-foreground text-sm">
          Sélectionnez un écran pour voir et planifier son calendrier.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
          <Card className="p-4 border-border/50 self-start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={fr}
              className="p-3 pointer-events-auto"
              modifiers={{ scheduled: markedDates }}
              modifiersClassNames={{ scheduled: "bg-primary/20 text-primary font-semibold rounded-md" }}
            />
            <div className="flex items-center gap-1.5 mt-3 px-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded bg-primary/20" />
              <span>Jour avec créneau planifié</span>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr }) : "Sélectionnez une date"}
              </h3>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : daySchedules.length === 0 ? (
              <Card className="p-8 border-border/50 flex flex-col items-center text-center text-muted-foreground">
                <CalendarDays className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Aucun créneau ce jour-là</p>
                <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openDialog}>
                  <Plus className="h-4 w-4" /> Planifier un créneau
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {daySchedules.map((sch) => (
                  <Card key={sch.id} className="p-3 border-border/50">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm truncate">
                        {sch.playlist?.name ?? sch.media?.name ?? "Contenu supprimé"}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {sch.start_time.slice(0, 5)} – {sch.end_time.slice(0, 5)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Repeat className="h-3 w-3" />
                        {sch.days_of_week.length === 7
                          ? "Tous les jours"
                          : sch.start_date && sch.start_date === sch.end_date
                          ? "Une fois"
                          : sch.days_of_week.map((d) => DAYS[d]).join(" ")}
                      </Badge>
                      <Badge
                        variant={sch.reminder_minutes ? "default" : "outline"}
                        className="text-[10px] gap-1 cursor-pointer"
                        onClick={() =>
                          updateSchedule.mutate(
                            { id: sch.id, reminder_minutes: sch.reminder_minutes ? null : 15 },
                            {
                              onSuccess: () =>
                                toast.success(sch.reminder_minutes ? "Rappel désactivé" : "Rappel 15 min avant activé"),
                            }
                          )
                        }
                      >
                        {sch.reminder_minutes ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                        {sch.reminder_minutes ? `Rappel ${sch.reminder_minutes} min avant` : "Sans rappel"}
                      </Badge>
                      {sch.end_date && sch.end_date !== sch.start_date && (
                        <Badge variant="secondary" className="text-[10px]">
                          jusqu'au {format(parseISO(sch.end_date), "d MMM yyyy", { locale: fr })}
                        </Badge>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7 ml-auto"
                        onClick={() => {
                          deleteSchedule.mutate(sch.id);
                          toast.success("Créneau supprimé");
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planifier un créneau</DialogTitle>
            <DialogDescription>
              {currentScreen?.name} —{" "}
              {selectedDate && format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              {(["media", "playlist"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    kind === k
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {k === "media" ? "Média" : "Playlist"}
                </button>
              ))}
            </div>

            {kind === "media" ? (
              <Select value={mediaId} onValueChange={setMediaId}>
                <SelectTrigger><SelectValue placeholder="Choisir un média" /></SelectTrigger>
                <SelectContent>
                  {media.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Select value={playlistId} onValueChange={setPlaylistId}>
                <SelectTrigger><SelectValue placeholder="Choisir une playlist" /></SelectTrigger>
                <SelectContent>
                  {playlists.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Heure de début</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Heure de fin</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Répétition</label>
              <Select value={repetition} onValueChange={(v) => setRepetition(v as Repetition)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPETITIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {repetition === "custom" && (
              <div className="flex gap-3 flex-wrap">
                {DAYS.map((label, i) => (
                  <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={customDays.includes(i)} onCheckedChange={() => toggleCustomDay(i)} />
                    <span className="text-xs">{label}</span>
                  </label>
                ))}
              </div>
            )}

            {repetition !== "once" && (
              <div>
                <label className="text-sm font-medium">Fin de la répétition (optionnel)</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Rappel avant le début</label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Planifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
