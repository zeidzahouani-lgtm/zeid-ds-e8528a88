import { useState } from "react";
import { Wand2, ArrowRight, ArrowLeft, Check, Image as ImageIcon, ListMusic, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

type Kind = "none" | "media" | "playlist";

interface Props {
  media: { id: string; name: string }[];
  playlists: { id: string; name: string }[];
  screens: { id: string; name: string }[];
  onFinish: (data: {
    name: string;
    defaultKind: Kind;
    defaultMediaId: string | null;
    defaultPlaylistId: string | null;
    slot: {
      kind: "media" | "playlist";
      mediaId: string | null;
      playlistId: string | null;
      startTime: string;
      endTime: string;
      days: number[];
    } | null;
    screenIds: string[];
  }) => Promise<void>;
}

export function ProgramWizard({ media, playlists, screens, onFinish }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [defaultKind, setDefaultKind] = useState<Kind>("playlist");
  const [defaultMediaId, setDefaultMediaId] = useState("");
  const [defaultPlaylistId, setDefaultPlaylistId] = useState("");

  const [withSlot, setWithSlot] = useState(true);
  const [slotKind, setSlotKind] = useState<"media" | "playlist">("media");
  const [slotMediaId, setSlotMediaId] = useState("");
  const [slotPlaylistId, setSlotPlaylistId] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("14:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [screenIds, setScreenIds] = useState<string[]>([]);

  const reset = () => {
    setStep(0); setName(""); setDefaultKind("playlist"); setDefaultMediaId(""); setDefaultPlaylistId("");
    setWithSlot(true); setSlotKind("media"); setSlotMediaId(""); setSlotPlaylistId("");
    setStartTime("12:00"); setEndTime("14:00"); setDays([1, 2, 3, 4, 5]); setScreenIds([]);
  };

  const toggle = (list: number[], v: number, set: (l: number[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort());

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) {
      if (defaultKind === "media") return !!defaultMediaId;
      if (defaultKind === "playlist") return !!defaultPlaylistId;
      return true;
    }
    if (step === 2) {
      if (!withSlot) return true;
      return slotKind === "media" ? !!slotMediaId && days.length > 0 : !!slotPlaylistId && days.length > 0;
    }
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await onFinish({
        name: name.trim(),
        defaultKind,
        defaultMediaId: defaultKind === "media" ? defaultMediaId : null,
        defaultPlaylistId: defaultKind === "playlist" ? defaultPlaylistId : null,
        slot: withSlot
          ? {
              kind: slotKind,
              mediaId: slotKind === "media" ? slotMediaId : null,
              playlistId: slotKind === "playlist" ? slotPlaylistId : null,
              startTime, endTime, days,
            }
          : null,
        screenIds,
      });
      toast.success("Programme configuré");
      setOpen(false);
      reset();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la configuration");
    } finally {
      setSaving(false);
    }
  };

  const KindButton = ({ active, onClick, icon, label }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Wand2 className="h-4 w-4" /> Assistant de programmation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assistant de programmation</DialogTitle>
          <DialogDescription>
            Étape {step + 1} sur 4 — créez un programme, un contenu par défaut et vos créneaux.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {step === 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom du programme</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Programme Hall" />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Contenu par défaut</p>
              <p className="text-xs text-muted-foreground">
                Diffusé en permanence, sauf pendant les créneaux programmés. La diffusion par défaut reprend
                automatiquement dès la fin du créneau.
              </p>
              <div className="flex gap-2">
                <KindButton active={defaultKind === "playlist"} onClick={() => setDefaultKind("playlist")} icon={<ListMusic className="h-4 w-4" />} label="Playlist" />
                <KindButton active={defaultKind === "media"} onClick={() => setDefaultKind("media")} icon={<ImageIcon className="h-4 w-4" />} label="Média" />
                <KindButton active={defaultKind === "none"} onClick={() => setDefaultKind("none")} icon={<Ban className="h-4 w-4" />} label="Aucun" />
              </div>
              {defaultKind === "playlist" && (
                <Select value={defaultPlaylistId} onValueChange={setDefaultPlaylistId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une playlist" /></SelectTrigger>
                  <SelectContent>
                    {playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {defaultKind === "media" && (
                <Select value={defaultMediaId} onValueChange={setDefaultMediaId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un média" /></SelectTrigger>
                  <SelectContent>
                    {media.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox checked={withSlot} onCheckedChange={(c) => setWithSlot(!!c)} />
                Ajouter un créneau programmé
              </label>
              {withSlot && (
                <>
                  <div className="flex gap-2">
                    <KindButton active={slotKind === "media"} onClick={() => setSlotKind("media")} icon={<ImageIcon className="h-4 w-4" />} label="Média" />
                    <KindButton active={slotKind === "playlist"} onClick={() => setSlotKind("playlist")} icon={<ListMusic className="h-4 w-4" />} label="Playlist" />
                  </div>
                  {slotKind === "media" ? (
                    <Select value={slotMediaId} onValueChange={setSlotMediaId}>
                      <SelectTrigger><SelectValue placeholder="Choisir un média" /></SelectTrigger>
                      <SelectContent>
                        {media.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={slotPlaylistId} onValueChange={setSlotPlaylistId}>
                      <SelectTrigger><SelectValue placeholder="Choisir une playlist" /></SelectTrigger>
                      <SelectContent>
                        {playlists.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Début</label>
                      <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-[130px]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fin</label>
                      <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-[130px]" />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((label, i) => (
                      <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox checked={days.includes(i)} onCheckedChange={() => toggle(days, i, setDays)} />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Écrans concernés</p>
              {screens.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun écran disponible.</p>
              ) : (
                <div className="max-h-56 overflow-auto space-y-1">
                  {screens.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-muted/50">
                      <Checkbox
                        checked={screenIds.includes(s.id)}
                        onCheckedChange={() =>
                          setScreenIds((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
              <Card className="p-3 text-xs text-muted-foreground border-border/50">
                Récapitulatif : « {name || "…"} » — défaut :{" "}
                {defaultKind === "none"
                  ? "aucun"
                  : defaultKind === "playlist"
                  ? playlists.find((p) => p.id === defaultPlaylistId)?.name ?? "—"
                  : media.find((m) => m.id === defaultMediaId)?.name ?? "—"}
                {withSlot ? ` • créneau ${startTime}–${endTime}` : " • aucun créneau"}
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Button>
          {step < 3 ? (
            <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)} className="gap-2">
              Suivant <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={saving} onClick={handleFinish} className="gap-2">
              <Check className="h-4 w-4" /> Terminer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
