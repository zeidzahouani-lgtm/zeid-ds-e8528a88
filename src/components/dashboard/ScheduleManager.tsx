import { useState } from "react";
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, Tv, FolderPlus, CalendarDays, List, ListMusic, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrograms } from "@/hooks/usePrograms";
import { useSchedules } from "@/hooks/useSchedules";
import { useMedia } from "@/hooks/useMedia";
import { useScreens } from "@/hooks/useScreens";
import { usePlaylists } from "@/hooks/usePlaylists";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { EstablishmentAssignSelect } from "@/components/EstablishmentAssignSelect";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function ScheduleManager() {
  const { programs, isLoading: loadingPrograms, addProgram, deleteProgram, assignEstablishment } = usePrograms();
  const { media } = useMedia();
  const { screens } = useScreens();
  const { playlists } = usePlaylists();
  const [selectedProgram, setSelectedProgram] = useState("");
  const [newName, setNewName] = useState("");
  const [contentType, setContentType] = useState<"media" | "playlist">("media");
  const [formMedia, setFormMedia] = useState("");
  const [formPlaylist, setFormPlaylist] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const { schedules, isLoading, addSchedule, updateSchedule, deleteSchedule } =
    useSchedules(selectedProgram || undefined);

  const assignedScreens = screens.filter((s: any) => s.program_id === selectedProgram);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const result = await addProgram.mutateAsync(newName.trim());
      toast.success("Programme créé");
      setNewName("");
      if (result?.id) setSelectedProgram(result.id);
    } catch {
      toast.error("Erreur");
    }
  };

  const handleAdd = async () => {
    if (!selectedProgram) return;
    if (contentType === "media" && !formMedia) return;
    if (contentType === "playlist" && !formPlaylist) return;
    try {
      await addSchedule.mutateAsync({
        media_id: contentType === "media" ? formMedia : null,
        playlist_id: contentType === "playlist" ? formPlaylist : null,
        start_time: startTime,
        end_time: endTime,
        days_of_week: days,
      });
      toast.success("Programmation ajoutée");
      setFormMedia("");
      setFormPlaylist("");
    } catch (e) {
      console.error(e);
      toast.error("Erreur");
    }
  };

  const handleCalendarAdd = async (schedule: {
    media_id: string;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    start_date?: string | null;
    end_date?: string | null;
  }) => {
    try {
      await addSchedule.mutateAsync(schedule);
      toast.success("Programmation planifiée");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleAssignScreen = async (screenId: string) => {
    try {
      await supabase.from("screens").update({ program_id: selectedProgram } as any).eq("id", screenId);
      toast.success("Écran assigné au programme");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleUnassignScreen = async (screenId: string) => {
    try {
      await supabase.from("screens").update({ program_id: null } as any).eq("id", screenId);
      toast.success("Écran retiré du programme");
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="space-y-6">
      {/* Create program */}
      <Card className="p-4 space-y-3 border-border/50">
        <p className="text-sm font-medium text-foreground">Nouveau programme</p>
        <div className="flex gap-2">
          <Input
            placeholder="Nom du programme"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="max-w-xs"
          />
          <Button onClick={handleCreate} disabled={!newName.trim()} className="gap-2">
            <FolderPlus className="h-4 w-4" /> Créer
          </Button>
        </div>
      </Card>

      {/* Select program */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={selectedProgram} onValueChange={setSelectedProgram}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Choisir un programme" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedProgram && (
          <>
            <div className="w-[260px]">
              <EstablishmentAssignSelect
                currentEstablishmentId={(programs.find((p) => p.id === selectedProgram) as any)?.establishment_id}
                onAssign={(eid) => assignEstablishment.mutateAsync({ id: selectedProgram, establishmentId: eid })}
              />
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                deleteProgram.mutate(selectedProgram);
                setSelectedProgram("");
                toast.success("Programme supprimé");
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
            </Button>
          </>
        )}
      </div>

      {selectedProgram && (
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" /> Calendrier
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" /> Liste
            </TabsTrigger>
            <TabsTrigger value="screens" className="gap-2">
              <Tv className="h-4 w-4" /> Écrans
            </TabsTrigger>
          </TabsList>

          {/* Calendar view */}
          <TabsContent value="calendar">
            <ScheduleCalendar
              schedules={schedules as any}
              media={media}
              onAdd={handleCalendarAdd}
              onDelete={(id) => deleteSchedule.mutate(id)}
              onUpdate={(id, updates) => updateSchedule.mutate({ id, ...updates } as any)}
            />
          </TabsContent>

          {/* List view */}
          <TabsContent value="list" className="space-y-4">
            {/* Add schedule entry */}
            <Card className="p-4 space-y-4 border-border/50">
              <p className="text-sm font-medium text-foreground">Nouvelle programmation</p>

              {/* Type toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContentType("media")}
                  className={`flex-1 max-w-[180px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    contentType === "media"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <ImageIcon className="h-4 w-4" /> Média unique
                </button>
                <button
                  type="button"
                  onClick={() => setContentType("playlist")}
                  className={`flex-1 max-w-[180px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    contentType === "playlist"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <ListMusic className="h-4 w-4" /> Playlist
                </button>
              </div>

              <div className="flex flex-wrap gap-3 items-end">
                {contentType === "media" ? (
                  <Select value={formMedia} onValueChange={setFormMedia}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Choisir un média" />
                    </SelectTrigger>
                    <SelectContent>
                      {media.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={formPlaylist} onValueChange={setFormPlaylist}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Choisir une playlist" />
                    </SelectTrigger>
                    <SelectContent>
                      {playlists.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-muted-foreground">
                          Aucune playlist. Créez-en une dans l'onglet Playlists.
                        </div>
                      ) : (
                        playlists.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Début</label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[130px]" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fin</label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-[130px]" />
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={contentType === "media" ? !formMedia : !formPlaylist}
                  className="gap-2"
                >
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

            {/* Schedule list */}
            {isLoading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : schedules.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucune programmation dans ce programme.</p>
            ) : (
              <div className="space-y-2">
                {schedules.map((sch: any) => {
                  const isPlaylist = !!sch.playlist_id;
                  return (
                    <Card key={sch.id} className="p-3 border-border/50">
                      <div className="flex items-center gap-3 flex-wrap">
                        {isPlaylist ? (
                          <ListMusic className="h-4 w-4 text-primary shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="font-medium truncate">
                          {isPlaylist
                            ? sch.playlist?.name ?? "Playlist supprimée"
                            : sch.media?.name ?? "Média supprimé"}
                        </span>
                        <Badge variant={isPlaylist ? "default" : "secondary"} className="text-[10px]">
                          {isPlaylist ? "Playlist" : "Média"}
                        </Badge>
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
                            {sch.start_date}
                            {sch.end_date && sch.end_date !== sch.start_date ? ` → ${sch.end_date}` : ""}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ml-auto"
                          onClick={() => updateSchedule.mutate({ id: sch.id, active: !sch.active })}
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
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Screens tab */}
          <TabsContent value="screens">
            <Card className="p-4 space-y-3 border-border/50">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Tv className="h-4 w-4" /> Écrans assignés
              </p>
              {assignedScreens.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {assignedScreens.map((s: any) => (
                    <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
                      {s.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-1"
                        onClick={() => handleUnassignScreen(s.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Select onValueChange={handleAssignScreen}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Assigner un écran" />
                  </SelectTrigger>
                  <SelectContent>
                    {screens
                      .filter((s: any) => s.program_id !== selectedProgram)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
