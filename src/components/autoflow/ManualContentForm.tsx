import { useState } from "react";
import { Plus, Loader2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ManualContentFormProps {
  screens: any[];
}

export function ManualContentForm({ screens }: ManualContentFormProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    image_url: "",
    screen_id: "",
    start_time: "",
    end_time: "",
    status: "pending" as string,
    sender_email: "",
  });

  const handleSubmit = async () => {
    if (!form.image_url) {
      toast.error("L'URL de l'image est requise");
      return;
    }
    setSubmitting(true);
    try {
      const insertData: Record<string, unknown> = {
        image_url: form.image_url,
        title: form.title || `Contenu manuel ${new Date().toLocaleString("fr-FR")}`,
        source: "manual",
        status: form.status,
      };
      if (form.screen_id && form.screen_id !== "none") insertData.screen_id = form.screen_id;
      if (form.start_time) insertData.start_time = new Date(form.start_time).toISOString();
      if (form.end_time) insertData.end_time = new Date(form.end_time).toISOString();
      if (form.sender_email) insertData.sender_email = form.sender_email;

      const { error } = await (supabase.from("contents") as any).insert(insertData);
      if (error) throw error;

      toast.success("Contenu ajouté avec succès");
      setForm({ title: "", image_url: "", screen_id: "", start_time: "", end_time: "", status: "pending", sender_email: "" });
      setOpen(false);
    } catch (e: any) {
      toast.error("Erreur: " + (e.message || "Erreur inconnue"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter un contenu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" />
            Ajouter un contenu manuellement
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Mon contenu" />
          </div>
          <div className="space-y-2">
            <Label>URL de l'image *</Label>
            <Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
            {form.image_url && (
              <div className="w-full h-32 rounded-md border border-border overflow-hidden bg-muted/30">
                <img src={form.image_url} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
              </div>
            )}
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
              <Select value={form.screen_id} onValueChange={v => setForm({ ...form, screen_id: v })}>
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
              <Label>Statut initial</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="scheduled">Programmé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email de notification (optionnel)</Label>
            <Input type="email" value={form.sender_email} onChange={e => setForm({ ...form, sender_email: e.target.value })} placeholder="destinataire@email.com" />
            <p className="text-[10px] text-muted-foreground">Un accusé de réception sera envoyé à cette adresse</p>
          </div>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {submitting ? "Ajout en cours..." : "Ajouter le contenu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
