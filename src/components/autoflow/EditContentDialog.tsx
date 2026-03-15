import { useState, useEffect } from "react";
import { Pencil, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Content } from "@/hooks/useContents";

interface EditContentDialogProps {
  content: Content | null;
  screens: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function EditContentDialog({ content, screens, open, onOpenChange, onSaved }: EditContentDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    screen_id: "",
    start_time: "",
    end_time: "",
    status: "pending",
  });

  useEffect(() => {
    if (content) {
      setForm({
        title: content.title || "",
        screen_id: content.screen_id || "",
        start_time: toLocalDatetime(content.start_time),
        end_time: toLocalDatetime(content.end_time),
        status: content.status,
      });
    }
  }, [content]);

  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        title: form.title || null,
        screen_id: form.screen_id && form.screen_id !== "none" ? form.screen_id : null,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
        status: form.status,
      };
      const { error } = await (supabase.from("contents") as any).update(updates).eq("id", content.id);
      if (error) throw error;
      toast.success("Contenu mis à jour");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erreur: " + (e.message || "Erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Modifier le contenu
          </DialogTitle>
        </DialogHeader>
        {content && (
          <div className="space-y-4">
            <div className="w-full h-32 rounded-md border border-border overflow-hidden bg-muted/30">
              <img src={content.image_url} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Sans titre" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Début</Label>
                <Input type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Écran</Label>
                <Select value={form.screen_id || "none"} onValueChange={v => setForm({ ...form, screen_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {screens?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="scheduled">Programmé</SelectItem>
                    <SelectItem value="rejected">Rejeté</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
