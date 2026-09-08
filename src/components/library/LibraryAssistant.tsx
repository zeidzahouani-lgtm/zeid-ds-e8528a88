import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2 } from "lucide-react";
import { useScreens } from "@/hooks/useScreens";
import { usePlaylists } from "@/hooks/usePlaylists";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  name: string;
  type: string;
  url: string;
  duration: number | null;
}

export default function LibraryAssistant({ media }: { media: MediaItem[] }) {
  const [open, setOpen] = useState(false);
  const [screenId, setScreenId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [makeDefault, setMakeDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  const { screens, updateScreen } = useScreens();
  const { addPlaylist } = usePlaylists();

  const screen = useMemo(() => (screens as any[]).find((s) => s.id === screenId), [screens, screenId]);

  /** Suggest content: everything usable, with sensible durations. */
  const suggest = () => {
    const next: Record<string, number> = {};
    media
      .filter((m) => m.type === "image" || m.type === "video" || m.type === "iframe")
      .slice(0, 8)
      .forEach((m) => {
        next[m.id] = m.type === "image" ? 10 : (m.duration && m.duration > 0 ? m.duration : 30);
      });
    setSelected(next);
    toast.success(`${Object.keys(next).length} contenus proposés`);
  };

  const toggle = (m: MediaItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[m.id] != null) delete next[m.id];
      else next[m.id] = m.type === "image" ? 10 : (m.duration && m.duration > 0 ? m.duration : 30);
      return next;
    });
  };

  const ids = Object.keys(selected);

  const apply = async () => {
    if (!screenId || ids.length === 0) return;
    setSaving(true);
    try {
      if (ids.length === 1 && !makeDefault) {
        await updateScreen.mutateAsync({ id: screenId, current_media_id: ids[0] });
      } else {
        const playlist: any = await addPlaylist.mutateAsync(`Assistant – ${screen?.name ?? "écran"}`);
        const rows = ids.map((mediaId, i) => ({
          playlist_id: playlist.id,
          media_id: mediaId,
          position: i,
          duration: selected[mediaId],
        }));
        const { error } = await supabase.from("playlist_items").insert(rows as any);
        if (error) throw error;
        await updateScreen.mutateAsync({
          id: screenId,
          playlist_id: playlist.id,
          current_media_id: null,
        } as any);
      }
      toast.success("Contenus appliqués à l'écran");
      setOpen(false);
      setSelected({});
    } catch (e: any) {
      toast.error(e.message ?? "Échec de l'application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4" /> Assistant
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Assistant de diffusion</DialogTitle>
            <DialogDescription>
              Choisissez un écran, sélectionnez les contenus et leur durée, puis appliquez-les
              comme affichage par défaut.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Écran</Label>
              <Select value={screenId} onValueChange={setScreenId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un écran" /></SelectTrigger>
                <SelectContent>
                  {(screens as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Contenus ({ids.length} sélectionnés)</Label>
              <Button variant="ghost" size="sm" className="gap-2" onClick={suggest}>
                <Wand2 className="h-4 w-4" /> Proposer
              </Button>
            </div>

            <div className="h-64 overflow-y-auto rounded-md border p-2">
              <div className="space-y-1">
                {media.map((m) => {
                  const on = selected[m.id] != null;
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                      <Checkbox checked={on} onCheckedChange={() => toggle(m)} className="shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-sm">{m.name}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0 hidden xs:inline-flex">{m.type}</Badge>
                      <Input
                        type="number"
                        min={1}
                        value={on ? selected[m.id] : ""}
                        disabled={!on}
                        onChange={(e) =>
                          setSelected((p) => ({ ...p, [m.id]: Math.max(1, Number(e.target.value) || 1) }))
                        }
                        className="h-8 w-16 shrink-0"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">s</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Affichage par défaut</p>
                <p className="text-xs text-muted-foreground">
                  Crée une playlist assignée à l'écran, reprise entre les programmations.
                </p>
              </div>
              <Switch checked={makeDefault} onCheckedChange={setMakeDefault} className="shrink-0" />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button disabled={!screenId || ids.length === 0 || saving} onClick={apply}>
              {saving ? "Application…" : "Appliquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
