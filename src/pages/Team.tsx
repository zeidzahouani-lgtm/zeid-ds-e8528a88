import { useState } from "react";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { validatePassword } from "@/lib/password-validation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Users, Mail, Trash2, Megaphone, ShieldAlert } from "lucide-react";

export default function Team() {
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();
  const queryClient = useQueryClient();

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviting, setInviting] = useState(false);

  // Fetch team members for this establishment
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team_members", currentEstablishmentId],
    enabled: !!currentEstablishmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_establishments")
        .select("user_id, role")
        .eq("establishment_id", currentEstablishmentId!);
      if (error) throw error;

      // Fetch profiles and roles for each member
      const userIds = data.map((m) => m.user_id);
      if (userIds.length === 0) return [];

      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name").in("id", userIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      ]);

      return data.map((m) => {
        const profile = profilesRes.data?.find((p) => p.id === m.user_id);
        const roles = rolesRes.data?.filter((r) => r.user_id === m.user_id).map((r) => r.role) || [];
        return {
          user_id: m.user_id,
          email: profile?.email || "—",
          display_name: profile?.display_name || "",
          establishment_role: m.role,
          roles,
        };
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Non authentifié");

      const res = await supabase.functions.invoke("invite-user", {
        body: {
          email,
          password,
          display_name: displayName,
          role: "marketing",
          establishment_id: currentEstablishmentId,
        },
      });
      if (res.error) throw new Error(res.error.message || "Erreur lors de l'invitation");
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Compte marketing créé", description: `${email} a été ajouté à l'équipe.` });
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      setShowInvite(false);
      setEmail("");
      setPassword("");
      setDisplayName("");
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const handleInvite = async () => {
    if (!email || !password) {
      toast({ title: "Champs requis", description: "Email et mot de passe sont obligatoires.", variant: "destructive" });
      return;
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      toast({ title: "Mot de passe invalide", description: pwCheck.errors.join(", "), variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      await inviteMutation.mutateAsync();
    } finally {
      setInviting(false);
    }
  };

  if (!currentEstablishmentId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Aucun établissement sélectionné</h2>
        <p className="text-sm text-muted-foreground mt-1">Sélectionnez un établissement pour gérer votre équipe.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Équipe</h1>
          <p className="text-sm text-muted-foreground mt-1">Gérez les membres marketing de votre établissement</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="gap-2" size="sm">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Inviter un marketing</span>
          <span className="sm:hidden">Inviter</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground animate-pulse">Chargement...</div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun membre dans cet établissement.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {members.map((member) => (
            <Card key={member.user_id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    {member.roles.includes("marketing") ? (
                      <Megaphone className="h-4 w-4 text-primary" />
                    ) : (
                      <Users className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.display_name || member.email}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.roles.includes("admin") && <Badge variant="default">Admin</Badge>}
                  {member.roles.includes("marketing") && <Badge variant="secondary">Marketing</Badge>}
                  {member.roles.includes("user") && !member.roles.includes("admin") && !member.roles.includes("marketing") && (
                    <Badge variant="outline">Utilisateur</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un membre marketing</DialogTitle>
            <DialogDescription>
              Ce compte aura les mêmes accès qu'un utilisateur, sans la personnalisation de l'établissement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom d'affichage</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="marketing@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe</Label>
              <PasswordInput value={password} onChange={setPassword} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Annuler</Button>
            <Button onClick={handleInvite} disabled={inviting} className="gap-2">
              {inviting ? "Création..." : "Créer le compte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
