import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonitorPlay, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const SECTEURS = [
  "Restauration",
  "Hôtellerie",
  "Commerce de détail",
  "Grande surface",
  "Santé / Clinique",
  "Éducation",
  "Services",
  "Industrie",
  "Autre",
];

export default function Register() {
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    establishment_name: "",
    num_screens: 1,
    phone: "",
    address: "",
    message: "",
    matricule_fiscal: "",
    registre_commerce: "",
    code_tva: "",
    code_categorie: "",
    secteur_activite: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("registration_requests" as any)
        .insert({
          email: form.email,
          display_name: form.display_name,
          establishment_name: form.establishment_name,
          num_screens: form.num_screens,
          phone: form.phone || null,
          address: form.address || null,
          message: form.message || null,
          matricule_fiscal: form.matricule_fiscal || null,
          registre_commerce: form.registre_commerce || null,
          code_tva: form.code_tva || null,
          code_categorie: form.code_categorie || null,
          secteur_activite: form.secteur_activite || null,
        } as any);
      if (error) throw error;
      setSent(true);
      toast.success("Votre demande d'inscription a été envoyée");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">Demande envoyée !</h1>
          <p className="text-muted-foreground">
            Votre demande d'inscription a été transmise à l'administrateur. Vous recevrez vos identifiants une fois votre demande approuvée.
          </p>
          <Link to="/login">
            <Button variant="outline" className="w-full mt-4">Retour à la connexion</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <MonitorPlay className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Demande d'inscription</h1>
          <p className="text-sm text-muted-foreground text-center">
            Remplissez le formulaire ci-dessous. Un administrateur examinera votre demande.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informations personnelles */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Informations personnelles</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom complet *</label>
              <Input
                placeholder="Jean Dupont"
                value={form.display_name}
                onChange={(e) => update("display_name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Téléphone</label>
              <Input
                type="tel"
                placeholder="+216 XX XXX XXX"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre d'écrans souhaité *</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.num_screens}
                onChange={(e) => update("num_screens", parseInt(e.target.value) || 1)}
                required
              />
            </div>
          </div>

          {/* Informations établissement */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4">Informations de l'établissement</p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nom de l'établissement *</label>
            <Input
              placeholder="Restaurant Le Gourmet"
              value={form.establishment_name}
              onChange={(e) => update("establishment_name", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Secteur d'activité</label>
              <Select value={form.secteur_activite} onValueChange={(v) => update("secteur_activite", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTEURS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Adresse</label>
              <Input
                placeholder="123 Rue de la Liberté, Tunis"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </div>

          {/* Informations fiscales */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4">Informations fiscales</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Matricule fiscal (MF)</label>
              <Input
                placeholder="1234567A/B/C/000"
                value={form.matricule_fiscal}
                onChange={(e) => update("matricule_fiscal", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Registre de commerce (RC)</label>
              <Input
                placeholder="B0123456789"
                value={form.registre_commerce}
                onChange={(e) => update("registre_commerce", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Code TVA</label>
              <Input
                placeholder="Ex: TVA123456"
                value={form.code_tva}
                onChange={(e) => update("code_tva", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Code catégorie</label>
              <Input
                placeholder="Ex: CAT-001"
                value={form.code_categorie}
                onChange={(e) => update("code_categorie", e.target.value)}
              />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium">Message (optionnel)</label>
            <Textarea
              placeholder="Décrivez votre projet ou vos besoins..."
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Envoi..." : "Soumettre la demande"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </Card>
    </div>
  );
}