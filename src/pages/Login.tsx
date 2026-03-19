import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { LoginParticles } from "@/components/LoginParticles";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { settings } = useAppSettings();
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background */}
      <AnimatedBackground />

      {/* Floating thematic particles */}
      <LoginParticles />

      {/* Login card */}
      <Card className="login-card w-full max-w-md p-8 space-y-6 relative z-10">
        <div className="flex flex-col items-center gap-3 login-header">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings.app_name}
              className="h-14 w-14 rounded-xl object-contain"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shadow-neon-cyan login-logo-pulse">
              <MonitorPlay className="h-8 w-8 text-primary icon-neon" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-widest neon-glow-cyan text-primary">
            {settings.app_name.toUpperCase()}
          </h1>
          <p className="text-sm text-muted-foreground normal-case tracking-normal">
            {settings.welcome_message}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 login-form-fields">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <Input
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="login-input-focus"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Mot de passe
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-input-focus"
            />
          </div>
          <Button
            type="submit"
            className="w-full login-btn-hover"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="login-spinner" />
                Connexion...
              </span>
            ) : (
              "Se connecter"
            )}
          </Button>
        </form>

        <div className="text-center text-sm space-y-2 normal-case login-footer">
          <Link
            to="/forgot-password"
            className="text-primary hover:underline block"
          >
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
