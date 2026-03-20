import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Monitor, Key, CheckCircle, Loader2, ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";

interface AvailableLicense {
  id: string;
  license_key: string;
  valid_until: string;
  establishment_id: string | null;
  source: string;
}

export default function AssignLicense() {
  const { screenId } = useParams<{ screenId: string }>();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<{ id: string; name: string; establishment_id: string | null } | null>(null);
  const [licenses, setLicenses] = useState<AvailableLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!screenId) return;

    async function load() {
      setLoading(true);

      // Fetch screen info
      const { data: screenData, error: screenError } = await supabase
        .from("screens")
        .select("id, name, establishment_id")
        .eq("id", screenId)
        .single();

      if (screenError || !screenData) {
        toast.error("Écran introuvable");
        setLoading(false);
        return;
      }

      setScreen(screenData);

      // Fetch available licenses for this establishment (unassigned + active + not expired)
      let query = supabase
        .from("licenses")
        .select("id, license_key, valid_until, establishment_id, source")
        .is("screen_id", null)
        .eq("is_active", true)
        .gte("valid_until", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (screenData.establishment_id) {
        query = query.eq("establishment_id", screenData.establishment_id);
      }

      const { data: licensesData } = await query;
      setLicenses((licensesData || []) as unknown as AvailableLicense[]);
      setLoading(false);
    }

    load();
  }, [screenId]);

  const handleAssign = async (license: AvailableLicense) => {
    if (!screenId) return;
    setAssigning(license.id);

    const { error } = await supabase
      .from("licenses")
      .update({ screen_id: screenId, activated_at: new Date().toISOString() } as any)
      .eq("id", license.id);

    if (error) {
      toast.error("Erreur lors de l'assignation");
      setAssigning(null);
      return;
    }

    toast.success("Licence assignée avec succès !");
    setDone(true);
    setAssigning(null);
  };

  const daysRemaining = (validUntil: string) => {
    const diff = new Date(validUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Chargement des licences...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold">Licence activée !</h1>
          <p className="text-sm text-muted-foreground">
            L'écran <strong>{screen?.name}</strong> va démarrer automatiquement dans quelques secondes.
          </p>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2 mt-4">
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Assigner une licence</h1>
          {screen && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5" />
              {screen.name}
            </p>
          )}
        </div>
      </div>

      {licenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="font-medium">Aucune licence disponible</p>
            <p className="text-sm text-muted-foreground">
              Il n'y a pas de licence libre pour cet établissement. Créez-en une depuis le panneau d'administration.
            </p>
            <Button variant="outline" onClick={() => navigate("/admin/licenses")} className="mt-2 gap-2">
              <Key className="h-4 w-4" />
              Gérer les licences
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {licenses.length} licence{licenses.length > 1 ? "s" : ""} disponible{licenses.length > 1 ? "s" : ""} — appuyez pour assigner
          </p>
          {licenses.map((license) => {
            const days = daysRemaining(license.valid_until);
            return (
              <Card
                key={license.id}
                className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 active:scale-[0.98]"
                onClick={() => !assigning && handleAssign(license)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold tracking-wider">{license.license_key}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {license.source === "auto" ? "Auto" : "Manuel"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {days} jour{days > 1 ? "s" : ""} restant{days > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {assigning === license.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-muted-foreground/30 shrink-0" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
