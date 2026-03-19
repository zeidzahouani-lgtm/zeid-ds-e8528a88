import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MonitorPlay, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { LoginParticles } from "@/components/LoginParticles";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { settings } = useAppSettings();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const hasVideo = !!settings.login_video_url;

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
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-20 h-9 w-9 text-muted-foreground hover:text-primary backdrop-blur-sm bg-card/30 border border-border/30"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* LEFT SIDE — Login form */}
      <div className={`relative flex items-center justify-center p-6 ${hasVideo ? 'w-1/2' : 'w-full'}`}>
        {/* Animated gradient background */}
        <AnimatedBackground />
        {/* Floating thematic particles */}
        <LoginParticles />

        <Card className="login-card w-full max-w-md p-8 space-y-6 relative z-10 border-primary/10 shadow-glow-blue">
          {/* Gradient border glow */}
          <div className="absolute inset-0 rounded-[inherit] p-px bg-gradient-to-br from-primary/20 via-transparent to-accent/20 pointer-events-none -z-[1]" />

          <div className="flex flex-col items-center gap-3 login-header">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.app_name}
                className="h-14 w-14 rounded-xl object-contain login-logo-pulse"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center login-logo-pulse border border-primary/20">
                <MonitorPlay className="h-9 w-9 text-primary icon-neon" />
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-widest gradient-primary-text">
              {settings.app_name.toUpperCase()}
            </h1>
            <p className="text-sm text-muted-foreground normal-case tracking-normal">
              {settings.welcome_message}
            </p>

            {/* Animated status bar */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
              <span className="status-dot-live w-1.5 h-1.5 rounded-full bg-status-online inline-block" />
              <span>Système connecté</span>
            </div>
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
                className="login-input-focus bg-background/50 backdrop-blur-sm"
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
                className="login-input-focus bg-background/50 backdrop-blur-sm"
              />
            </div>
            <Button
              type="submit"
              className="w-full login-btn-hover gradient-primary text-primary-foreground font-semibold"
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
              className="text-primary hover:underline block transition-colors duration-200"
            >
              Mot de passe oublié ?
            </Link>
            <p className="text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link to="/register" className="text-primary hover:underline transition-colors duration-200">
                S'inscrire
              </Link>
            </p>
          </div>
        </Card>
      </div>

      {/* RIGHT SIDE — Video */}
      {hasVideo && (
        <div className="w-1/2 relative hidden md:block">
          <video
            src={settings.login_video_url}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Subtle overlay for contrast */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-background/60 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
