import { useState, useEffect, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Lock, KeyRound, LogOut, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SESSION_KEY = "screenflow.deploy_unlocked";

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function readSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings" as any)
    .select("value")
    .eq("key", key as any)
    .maybeSingle();
  return (data as any)?.value ?? null;
}

async function upsertSetting(key: string, value: string) {
  // Try update first, then insert if missing
  const existing = await readSetting(key);
  if (existing === null) {
    const { error } = await supabase.from("app_settings" as any).insert({ key, value } as any);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("app_settings" as any)
      .update({ value, updated_at: new Date().toISOString() } as any)
      .eq("key", key as any);
    if (error) throw error;
  }
}

interface Props {
  children: ReactNode;
}

export function DeployAuthGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Change credentials dialog
  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newUser, setNewUser] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [savingChange, setSavingChange] = useState(false);

  useEffect(() => {
    if (unlocked && changeOpen) {
      readSetting("deploy_username").then(u => setNewUser(u || "screenflow"));
    }
  }, [changeOpen, unlocked]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const storedUser = (await readSetting("deploy_username")) || "screenflow";
      const storedHash = await readSetting("deploy_password_hash");
      const inputHash = await sha256Hex(password);
      if (username.trim() === storedUser && storedHash && inputHash === storedHash) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setUnlocked(true);
        setPassword("");
        toast.success("Accès déploiement déverrouillé");
      } else {
        toast.error("Identifiants invalides");
      }
    } catch (err: any) {
      toast.error("Erreur: " + (err?.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  };

  const handleChangeCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== newPwd2) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPwd.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setSavingChange(true);
    try {
      // Verify current password
      const storedHash = await readSetting("deploy_password_hash");
      const currentHash = await sha256Hex(currentPwd);
      if (currentHash !== storedHash) {
        toast.error("Mot de passe actuel incorrect");
        return;
      }
      const newHash = await sha256Hex(newPwd);
      await upsertSetting("deploy_username", newUser.trim() || "screenflow");
      await upsertSetting("deploy_password_hash", newHash);
      toast.success("Identifiants mis à jour");
      setChangeOpen(false);
      setCurrentPwd("");
      setNewPwd("");
      setNewPwd2("");
    } catch (err: any) {
      toast.error("Erreur: " + (err?.message || String(err)));
    } finally {
      setSavingChange(false);
    }
  };

  if (!unlocked) {
    return (
      <Card className="max-w-md mx-auto mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" /> Accès Déploiement Protégé
          </CardTitle>
          <CardDescription>
            Cette zone est réservée. Connectez-vous avec le compte de déploiement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deploy-user">Nom d'utilisateur</Label>
              <Input
                id="deploy-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="screenflow"
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deploy-pwd">Mot de passe</Label>
              <Input
                id="deploy-pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              <KeyRound className="h-4 w-4" />
              {submitting ? "Vérification…" : "Déverrouiller"}
            </Button>
            <Alert>
              <AlertDescription className="text-xs">
                Compte par défaut : <code>screenflow</code> / <code>260390DS</code>. 
                Pensez à le changer après la première connexion.
              </AlertDescription>
            </Alert>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/40">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 text-primary" />
          Zone de déploiement déverrouillée
        </div>
        <div className="flex gap-2">
          <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" /> Changer identifiants
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modifier les identifiants de déploiement</DialogTitle>
                <DialogDescription>
                  Changez le nom d'utilisateur et/ou le mot de passe protégeant cette zone.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleChangeCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label>Mot de passe actuel</Label>
                  <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Nouveau nom d'utilisateur</Label>
                  <Input value={newUser} onChange={(e) => setNewUser(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Nouveau mot de passe</Label>
                  <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label>Confirmer le nouveau mot de passe</Label>
                  <Input type="password" value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} required minLength={6} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setChangeOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={savingChange}>
                    {savingChange ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={handleLock} className="gap-2">
            <LogOut className="h-4 w-4" /> Verrouiller
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
