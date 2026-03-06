import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaUploader } from "@/components/dashboard/MediaUploader";
import { ScreenManager } from "@/components/dashboard/ScreenManager";
import { PlaylistManager } from "@/components/dashboard/PlaylistManager";
import { ScheduleManager } from "@/components/dashboard/ScheduleManager";
import { MonitorPlay, Image, Tv, ListMusic, Clock } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <MonitorPlay className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">SignageOS</h1>
            <p className="text-xs text-muted-foreground">Digital Signage Dashboard</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="screens" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="screens" className="gap-2">
              <Tv className="h-4 w-4" /> Écrans
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-2">
              <Image className="h-4 w-4" /> Médias
            </TabsTrigger>
            <TabsTrigger value="playlists" className="gap-2">
              <ListMusic className="h-4 w-4" /> Playlists
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-2">
              <Clock className="h-4 w-4" /> Programmation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="screens">
            <ScreenManager />
          </TabsContent>
          <TabsContent value="media">
            <MediaUploader />
          </TabsContent>
          <TabsContent value="playlists">
            <PlaylistManager />
          </TabsContent>
          <TabsContent value="schedules">
            <ScheduleManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
