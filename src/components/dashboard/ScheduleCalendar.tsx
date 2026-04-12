import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Clock, CalendarDays, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay, isWithinInterval, parseISO, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import type { Schedule } from "@/hooks/useSchedules";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

interface Props {
  schedules: Schedule[];
  media: { id: string; name: string }[];
  onAdd: (schedule: {
    media_id: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    start_date?: string | null;
    end_date?: string | null;
  }) => Promise<void>;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

function getScheduleDates(sch: Schedule): Date[] {
  const start = sch.start_date ? parseISO(sch.start_date) : null;
  const end = sch.end_date ? parseISO(sch.end_date) : null;

  if (!start && !end) return [];

  const rangeStart = start || new Date();
  const rangeEnd = end || new Date(rangeStart.getTime() + 90 * 24 * 60 * 60 * 1000);

  try {
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).filter((d) =>
      sch.days_of_week.includes(d.getDay())
    );
  } catch {
    return [];
  }
}

export function ScheduleCalendar({ schedules, media, onAdd, onDelete, disabled }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formMedia, setFormMedia] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adding, setAdding] = useState(false);

  // Build a map of dates that have scheduled items
  const scheduleDateMap = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    schedules.forEach((sch) => {
      if (!sch.active) return;
      const dates = getScheduleDates(sch);
      dates.forEach((d) => {
        const key = format(d, "yyyy-MM-dd");
        const existing = map.get(key) || [];
        existing.push(sch);
        map.set(key, existing);
      });
      // Also mark recurring schedules without dates (they apply every matching day)
      if (!sch.start_date && !sch.end_date) {
        // Mark next 90 days for recurring
        const today = new Date();
        for (let i = 0; i < 90; i++) {
          const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
          if (sch.days_of_week.includes(d.getDay())) {
            const key = format(d, "yyyy-MM-dd");
            const existing = map.get(key) || [];
            if (!existing.find((s) => s.id === sch.id)) {
              existing.push(sch);
              map.set(key, existing);
            }
          }
        }
      }
    });
    return map;
  }, [schedules]);

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedSchedules = scheduleDateMap.get(selectedDateStr) || [];

  const datesWithSchedules = useMemo(() => {
    return Array.from(scheduleDateMap.keys()).map((k) => parseISO(k));
  }, [scheduleDateMap]);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleAdd = async () => {
    if (!formMedia) return;
    setAdding(true);
    try {
      await onAdd({
        media_id: formMedia,
        start_time: startTime,
        end_time: endTime,
        days_of_week: days,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      setShowAddDialog(false);
      setFormMedia("");
    } finally {
      setAdding(false);
    }
  };

  const openAddForDate = () => {
    if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      setStartDate(dateStr);
      setEndDate(dateStr);
      const dayOfWeek = selectedDate.getDay();
      setDays([dayOfWeek]);
    }
    setShowAddDialog(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
      {/* Calendar */}
      <Card className="p-4 border-border/50 self-start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          locale={fr}
          className={cn("p-3 pointer-events-auto")}
          modifiers={{
            scheduled: datesWithSchedules,
          }}
          modifiersClassNames={{
            scheduled: "bg-primary/20 text-primary font-semibold rounded-md",
          }}
        />
        <div className="flex items-center gap-2 mt-3 px-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 rounded bg-primary/20" />
          <span>Jours avec programmation</span>
        </div>
      </Card>

      {/* Selected date details */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {selectedDate
                ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })
                : "Sélectionnez une date"}
            </h3>
          </div>
          {selectedDate && !disabled && (
            <Button size="sm" onClick={openAddForDate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Planifier
            </Button>
          )}
        </div>

        {selectedSchedules.length === 0 ? (
          <Card className="p-8 border-border/50 flex flex-col items-center text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">Aucune programmation pour cette date</p>
            {!disabled && (
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openAddForDate}>
                <Plus className="h-4 w-4" /> Ajouter une programmation
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {selectedSchedules.map((sch) => (
              <Card key={sch.id} className="p-3 border-border/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">
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
                  {sch.start_date && (
                    <Badge variant="secondary" className="text-[10px]">
                      {sch.start_date}{sch.end_date && sch.end_date !== sch.start_date ? ` → ${sch.end_date}` : ""}
                    </Badge>
                  )}
                  {!sch.start_date && (
                    <Badge variant="secondary" className="text-[10px]">Récurrent</Badge>
                  )}
                  {!disabled && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7 ml-auto"
                      onClick={() => onDelete(sch.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add schedule dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planifier un affichage</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Média</label>
              <Select value={formMedia} onValueChange={setFormMedia}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir un média" />
                </SelectTrigger>
                <SelectContent>
                  {media.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Heure début</label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Heure fin</label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Date début</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Date fin</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Jours de la semaine</label>
              <div className="flex gap-3 flex-wrap">
                {DAYS.map((label, i) => (
                  <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={days.includes(i)} onCheckedChange={() => toggleDay(i)} />
                    <span className="text-xs">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!formMedia || adding}>
              {adding ? "Ajout..." : "Planifier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
