import { useState } from "react";
import {
  ListMusic, Plus, Trash2, GripVertical, Tv, Save, Clock,
  ChevronRight, ChevronLeft, Sparkles, Check, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePlaylists } from "@/hooks/usePlaylists";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { useMedia } from "@/hooks/useMedia";
import { useScreens } from "@/hooks/useScreens";
import { supabase } from "@/integrations/supabase/client";
import { EstablishmentAssignSelect } from "@/components/EstablishmentAssignSelect";
import { toast } from "sonner";

type WizardStep = "list" | "name" | "media" | "screens" | "edit";

export function PlaylistManager() {
  const { playlists, isLoading: loadingPlaylists, addPlaylist, deletePlaylist, renamePlaylist, assignEstablishment } = usePlaylists();
  const { media } = useMedia();
  const { screens } = useScreens();

  const [step, setStep] = useState<WizardStep>("list");
  const [draftName, setDraftName] = useState("");
  const [draftMedia, setDraftMedia] = useState<string[]>([]);
  const [draftScreens, setDraftScreens] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const editingPlaylist = playlists.find((p) => p.id === editingId);

  // ========== WIZARD ==========
  const startWizard = () => {
    setDraftName("");
    setDraftMedia([]);
    setDraftScreens([]);
    setStep("name");
  };

  const cancelWizard = () => {
    setStep("list");
    setDraftName("");
    setDraftMedia([]);
    setDraftScreens([]);
  };

  const toggleMedia = (id: string) => {
    setDraftMedia((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleScreen = (id: string) => {
    setDraftScreens((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const finishWizard = async () => {
    if (!draftName.trim() || draftMedia.length === 0) return;
    setCreating(true);
    try {
      const playlist = await addPlaylist.mutateAsync(draftName.trim());
      const items = draftMedia.map((mediaId, position) => ({
        playlist_id: playlist.id,
        media_id: mediaId,
        position,
      }));
      const { error: itemsErr } = await supabase.from("playlist_items").insert(items as any);
      if (itemsErr) throw itemsErr;

      if (draftScreens.length > 0) {
        await Promise.all(
          draftScreens.map((sid) =>
            supabase.from("screens").update({ playlist_id: playlist.id } as any).eq("id", sid)
          )
        );
      }

      toast.success("Playlist créée avec succès");
      cancelWizard();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // ========== RENDER ==========
  if (step === "edit" && editingId) {
    return (
      <PlaylistEditor
        playlistId={editingId}
        playlistName={editingPlaylist?.name ?? ""}
        onBack={() => {
          setEditingId(null);
          setStep("list");
        }}
        onRename={(newName) => renamePlaylist.mutate({ id: editingId, name: newName })}
      />
    );
  }

  if (step !== "list") {
    return (
      <WizardView
        step={step}
        setStep={setStep}
        draftName={draftName}
        setDraftName={setDraftName}
        draftMedia={draftMedia}
        toggleMedia={toggleMedia}
        draftScreens={draftScreens}
        toggleScreen={toggleScreen}
        media={media}
        screens={screens}
        onCancel={cancelWizard}
        onFinish={finishWizard}
        creating={creating}
      />
    );
  }

  // ========== LIST VIEW ==========
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {playlists.length} playlist{playlists.length > 1 ? "s" : ""}
        </p>
        <Button onClick={startWizard} className="gap-2">
          <Sparkles className="h-4 w-4" /> Créer une playlist
        </Button>
      </div>

      {loadingPlaylists ? (
        <p className="text-muted-foreground text-sm">Chargement...</p>
      ) : playlists.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <ListMusic className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Aucune playlist pour le moment.
          </p>
          <Button onClick={startWizard} className="gap-2">
            <Sparkles className="h-4 w-4" /> Créer ma première playlist
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => {
            const assignedScreens = screens.filter((s: any) => s.playlist_id === p.id);
            return (
              <Card key={p.id} className="p-4 border-border/50 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ListMusic className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => {
                      if (confirm(`Supprimer la playlist "${p.name}" ?`)) {
                        deletePlaylist.mutate(p.id);
                        toast.success("Playlist supprimée");
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {assignedScreens.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {assignedScreens.map((s: any) => (
                      <Badge key={s.id} variant="secondary" className="text-xs gap-1">
                        <Tv className="h-2.5 w-2.5" />
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    setEditingId(p.id);
                    setStep("edit");
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Gérer le contenu
                </Button>
                <div className="mt-2">
                  <EstablishmentAssignSelect
                    currentEstablishmentId={(p as any).establishment_id}
                    onAssign={(eid) => assignEstablishment.mutateAsync({ id: p.id, establishmentId: eid })}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ========== WIZARD COMPONENT ==========
function WizardView({
  step, setStep, draftName, setDraftName, draftMedia, toggleMedia,
  draftScreens, toggleScreen, media, screens, onCancel, onFinish, creating,
}: any) {
  const stepIndex = step === "name" ? 0 : step === "media" ? 1 : 2;
  const canNext =
    (step === "name" && draftName.trim().length > 0) ||
    (step === "media" && draftMedia.length > 0) ||
    step === "screens";

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {["Nommer", "Médias", "Écrans"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : i < stepIndex
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < stepIndex ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              {label}
            </div>
            {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <Card className="p-6 border-border/50">
        {step === "name" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Comment s'appelle votre playlist ?</h3>
            <p className="text-sm text-muted-foreground">
              Choisissez un nom clair pour la retrouver facilement.
            </p>
            <Input
              placeholder="Ex: Promotions du midi"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              autoFocus
              className="text-base"
            />
          </div>
        )}

        {step === "media" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Sélectionnez les médias</h3>
            <p className="text-sm text-muted-foreground">
              Cliquez pour ajouter à la playlist. L'ordre sera celui de sélection.
            </p>
            {media.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
                Aucun média disponible. Importez d'abord des médias.
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1">
                {media.map((m: any) => {
                  const isSelected = draftMedia.includes(m.id);
                  const order = draftMedia.indexOf(m.id) + 1;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMedia(m.id)}
                      className={`relative rounded-lg border-2 transition-all text-left p-2 ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold z-10">
                          {order}
                        </div>
                      )}
                      <div className="aspect-video rounded bg-muted overflow-hidden mb-1.5 relative">
                        {m.type === "image" ? (
                          <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                        ) : m.type === "video" ? (
                          <>
                            <video src={m.url} className="w-full h-full object-cover" muted preload="metadata" />
                            <span className="absolute bottom-1 left-1 px-1 rounded bg-black/60 text-white text-[9px] font-semibold">VIDÉO</span>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ListMusic className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs truncate font-medium">{m.name}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === "screens" && (
          <div className="space-y-3">
            <h3 className="font-semibold">Assigner à des écrans (optionnel)</h3>
            <p className="text-sm text-muted-foreground">
              Sélectionnez les écrans qui diffuseront cette playlist. Vous pourrez le faire plus tard.
            </p>
            {screens.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Aucun écran disponible.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {screens.map((s: any) => {
                  const isSelected = draftScreens.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleScreen(s.id)}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Tv className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium flex-1 truncate">{s.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={creating}>
          Annuler
        </Button>
        <div className="flex gap-2">
          {step !== "name" && (
            <Button
              variant="outline"
              onClick={() => setStep(step === "screens" ? "media" : "name")}
              disabled={creating}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Précédent
            </Button>
          )}
          {step !== "screens" ? (
            <Button
              onClick={() => setStep(step === "name" ? "media" : "screens")}
              disabled={!canNext}
              className="gap-2"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={onFinish} disabled={creating || draftMedia.length === 0} className="gap-2">
              <Check className="h-4 w-4" /> {creating ? "Création..." : "Terminer"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== EDITOR (manage existing) ==========
function PlaylistEditor({
  playlistId, playlistName, onBack, onRename,
}: {
  playlistId: string;
  playlistName: string;
  onBack: () => void;
  onRename: (name: string) => void;
}) {
  const { items, isLoading, addItem, removeItem, reorderItems, updateItemDuration } = usePlaylistItems(playlistId);
  const { media } = useMedia();
  const [selectedMedia, setSelectedMedia] = useState("");
  const [durationEdits, setDurationEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(playlistName);

  const hasPendingChanges = Object.keys(durationEdits).length > 0;

  const handleAddMedia = async () => {
    if (!selectedMedia) return;
    try {
      await addItem.mutateAsync({ mediaId: selectedMedia, position: items.length });
      toast.success("Média ajouté");
      setSelectedMedia("");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleSave = async () => {
    if (!hasPendingChanges) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(durationEdits).map(([id, duration]) =>
          updateItemDuration.mutateAsync({ id, duration })
        )
      );
      setDurationEdits({});
      toast.success("Modifications sauvegardées");
    } catch {
      toast.error("Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setDragIndex(null);
    setDragOverIndex(null);
    try {
      await reorderItems.mutateAsync(reordered.map((i) => i.id));
      toast.success("Ordre mis à jour");
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Retour
        </Button>
        {editingName ? (
          <div className="flex gap-2 items-center flex-1">
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              className="max-w-xs"
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => {
                if (nameValue.trim() && nameValue !== playlistName) {
                  onRename(nameValue.trim());
                  toast.success("Nom mis à jour");
                }
                setEditingName(false);
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => {
              setNameValue(playlistName);
              setEditingName(true);
            }}
            className="flex items-center gap-2 hover:text-primary group"
          >
            <h2 className="text-lg font-semibold">{playlistName}</h2>
            <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      <Card className="p-4 space-y-3 border-border/50">
        <p className="text-sm font-medium">Ajouter un média</p>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedMedia} onValueChange={setSelectedMedia}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Choisir un média" />
            </SelectTrigger>
            <SelectContent>
              {media.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddMedia} disabled={!selectedMedia} className="gap-2">
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Chargement...</p>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <p className="text-sm text-muted-foreground">Aucun média dans cette playlist.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item: any, index: number) => {
            const mediaDuration = item.media?.duration ?? 10;
            const itemDuration = item.duration;
            const effectiveDuration = durationEdits[item.id] ?? itemDuration ?? mediaDuration;
            const isDragging = dragIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <Card
                key={item.id}
                className={`p-3 border-border/50 transition-all ${isDragging ? "opacity-40 scale-95" : ""} ${isDragOver ? "border-primary ring-1 ring-primary/30" : ""}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
                  <Badge variant="outline" className="text-xs shrink-0">{index + 1}</Badge>
                  <ListMusic className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium flex-1 truncate">{item.media?.name ?? "Média inconnu"}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      min={1}
                      value={effectiveDuration}
                      onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        if (!isNaN(num) && num >= 1) {
                          setDurationEdits((prev) => ({ ...prev, [item.id]: num }));
                        }
                      }}
                      className="w-16 h-7 text-xs text-center"
                    />
                    <span className="text-xs text-muted-foreground">s</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {items.length > 0 && hasPendingChanges && (
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder les durées"}
        </Button>
      )}
    </div>
  );
}
