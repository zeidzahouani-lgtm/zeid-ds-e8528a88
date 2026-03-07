import { PlaylistManager } from "@/components/dashboard/PlaylistManager";

export default function Playlists() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Playlists</h1>
      <p className="text-muted-foreground text-sm mb-6">Gérez les playlists de vos écrans</p>
      <PlaylistManager />
    </div>
  );
}
