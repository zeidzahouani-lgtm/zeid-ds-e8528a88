import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MonitorPlay } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 50% 30%, hsl(185 100% 55% / 0.03), transparent 60%), radial-gradient(ellipse at 50% 0%, hsl(0 0% 7%) 0%, hsl(0 0% 2%) 70%)' }}>
      <Card className="w-full max-w-md p-8 space-y-6 animate-cyber-in">
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shadow-neon-cyan">
            <MonitorPlay className="h-8 w-8 text-primary icon-neon" />
          </div>
          <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">SIGNAGEOS</h1>
          <p className="text-sm text-muted-foreground normal-case tracking-normal">Connectez-vous à votre tableau de bord</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</label>
            <Input
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mot de passe</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <div className="text-center text-sm space-y-2 normal-case">
          <Link to="/forgot-password" className="text-primary hover:underline block">
            Mot de passe oublié ?
          </Link>
          <p className="text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/register" className="text-primary hover:underline">
              S'inscrire
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
