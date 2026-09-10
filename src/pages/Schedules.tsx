import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, FolderCog } from "lucide-react";
import { ScheduleManager } from "@/components/dashboard/ScheduleManager";
import { ScreenScheduleCalendar } from "@/components/dashboard/ScreenScheduleCalendar";
import { useScheduleReminders } from "@/hooks/useScheduleReminders";

export default function Schedules() {
  useScheduleReminders();

  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {}
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Programmation</h1>
      <p className="text-muted-foreground text-sm mb-6">Planifiez l'affichage de vos contenus</p>

      <Tabs defaultValue="screen-calendar" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="screen-calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Calendrier par écran
          </TabsTrigger>
          <TabsTrigger value="programs" className="gap-2">
            <FolderCog className="h-4 w-4" /> Programmes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="screen-calendar">
          <ScreenScheduleCalendar />
        </TabsContent>
        <TabsContent value="programs">
          <ScheduleManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
