import { ScheduleManager } from "@/components/dashboard/ScheduleManager";

export default function Schedules() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Programmation</h1>
      <p className="text-muted-foreground text-sm mb-6">Planifiez l'affichage de vos contenus</p>
      <ScheduleManager />
    </div>
  );
}
