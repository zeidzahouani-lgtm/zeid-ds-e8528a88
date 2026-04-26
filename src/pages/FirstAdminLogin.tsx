import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff,
} from "lucide-react";

export default function FirstAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // On mount, check if an admin already exists
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("bootstrap-admin", {
          body: { action: "check" },
        });
        if (error) throw error;
        setHasAdmin(Boolean(data?.has_admin));
      } catch (e) {
        console.error(e);
        setHasAdmin(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Renseignez l'email et le mot de passe.");
      return;
    }
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Sign up the user
      const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });

      // If user already exists, try sign-in to get its id
      let userId = signUp?.user?.id;
      if (signUpErr && /already|exist/i.test(signUpErr.message)) {
        const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw new Error("Cet email existe déjà avec un autre mot de passe.");
        userId = signIn.user?.id;
      } else if (signUpErr) {
        throw signUpErr;
      }

      // 2. Promote to admin via the bootstrap edge function
      const { data: promo, error: promoErr } = await supabase.functions.invoke("bootstrap-admin", {
        body: { action: "promote", user_id: userId, email: email.trim() },
      });
      if (promoErr) throw promoErr;
      if (promo?.error) throw new Error(promo.error);

      toast.success("Compte administrateur créé ✓");
      setHasAdmin(true);

      // Try to sign in (in case email confirmation was required)
      const { error: finalSignInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!finalSignInErr) {
        setTimeout(() => navigate("/"), 600);
      } else {
        setTimeout(() => navigate("/login"), 1200);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la création du compte admin.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Première connexion admin</CardTitle>
          <CardDescription>
            Créez le tout premier compte administrateur de cette instance.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {checking ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Vérification…
            </div>
          ) : hasAdmin ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Un administrateur existe déjà</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>Cette page n'est plus disponible. Connectez-vous depuis l'écran de login.</p>
                <Button onClick={() => navigate("/login")} className="w-full">
                  Aller au login
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Cette page se désactive automatiquement dès qu'un admin existe.
                </AlertDescription>
              </Alert>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email administrateur</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="admin@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Min. 8 caractères"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création…</>
                  ) : (
                    "Créer le compte admin"
                  )}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
