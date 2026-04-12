import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";
import { validatePassword } from "@/lib/password-validation";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      navigate("/login");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      toast.error("Mot de passe invalide : " + pwCheck.errors.join(", "));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour !");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 glass-panel space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <MonitorPlay className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput value={password} onChange={setPassword} />
          <Button type="submit" className="w-full" disabled={loading || !validatePassword(password).valid}>
            {loading ? "Mise à jour..." : "Mettre à jour"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
