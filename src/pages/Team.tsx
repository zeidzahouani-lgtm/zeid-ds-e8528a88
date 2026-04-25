import { useState } from "react";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { validatePassword } from "@/lib/password-validation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Users, Trash2, Megaphone, ShieldAlert, Pencil, KeyRound } from "lucide-react";

interface TeamMember {
  user_id: string;
  email: string;
  display_name: string;
  establishment_role: string;
  roles: string[];
}

export default function Team() {
  const { currentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();
  const queryClient = useQueryClient();

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  // Edit profile dialog
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Password reset dialog
  const [pwMember, setPwMember] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team_members", currentEstablishmentId],
    enabled: !!currentEstablishmentId,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("user_establishments")
        .select("user_id, role")
        .eq("establishment_id", currentEstablishmentId!);
      if (error) throw error;

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

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingMember) throw new Error("Aucun membre");
      const body: Record<string, any> = {
        update_profile: true,
        user_id: editingMember.user_id,
      };
      if (editName.trim() && editName.trim() !== editingMember.display_name) {
        body.display_name = editName.trim();
      }
      if (editEmail.trim() && editEmail.trim().toLowerCase() !== editingMember.email.toLowerCase()) {
        body.new_email = editEmail.trim();
      }
      const res = await supabase.functions.invoke("invite-user", { body });
      if (res.error) throw new Error(res.error.message || "Erreur");
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Profil mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      setEditingMember(null);
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!pwMember) throw new Error("Aucun membre");
      const res = await supabase.functions.invoke("invite-user", {
        body: {
          update_password: true,
          user_id: pwMember.user_id,
          email: pwMember.email,
          password: newPassword,
        },
      });
      if (res.error) throw new Error(res.error.message || "Erreur");
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Mot de passe mis à jour" });
      setPwMember(null);
      setNewPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_establishments")
        .delete()
        .eq("user_id", userId)
        .eq("establishment_id", currentEstablishmentId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Membre retiré", description: `${memberToRemove?.display_name || memberToRemove?.email} a été retiré de l'équipe.` });
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      setMemberToRemove(null);
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

  const openEdit = (m: TeamMember) => {
    setEditingMember(m);
    setEditName(m.display_name);
    setEditEmail(m.email);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() && !editEmail.trim()) {
      toast({ title: "Aucun changement", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    try {
      await editMutation.mutateAsync();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSavePassword = async () => {
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      toast({ title: "Mot de passe invalide", description: pwCheck.errors.join(", "), variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      await passwordMutation.mutateAsync();
    } finally {
      setSavingPw(false);
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
          {members.map((member) => {
            const isMarketing = member.roles.includes("marketing");
            const isAdmin = member.roles.includes("admin");
            // Allow editing marketing accounts and plain users (not other admins, unless caller is global admin)
            const canEdit = isGlobalAdmin || !isAdmin;

            return (
              <Card key={member.user_id}>
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {isMarketing ? (
                        <Megaphone className="h-4 w-4 text-primary" />
                      ) : (
                        <Users className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{member.display_name || member.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && <Badge variant="default">Admin</Badge>}
                    {isMarketing && <Badge variant="secondary">Marketing</Badge>}
                    {member.roles.includes("user") && !isAdmin && !isMarketing && (
                      <Badge variant="outline">Utilisateur</Badge>
                    )}
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(member)}
                          title="Modifier le profil"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setPwMember(member); setNewPassword(""); }}
                          title="Changer le mot de passe"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {!isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setMemberToRemove(member)}
                            title="Retirer de l'équipe"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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

      {/* Edit profile dialog */}
      <Dialog open={!!editingMember} onOpenChange={(o) => !o && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
            <DialogDescription>Mettre à jour le nom affiché et l'adresse email de connexion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom d'affichage</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog open={!!pwMember} onOpenChange={(o) => !o && setPwMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le mot de passe</DialogTitle>
            <DialogDescription>
              Définir un nouveau mot de passe pour <strong>{pwMember?.display_name || pwMember?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <PasswordInput value={newPassword} onChange={setNewPassword} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwMember(null)}>Annuler</Button>
            <Button onClick={handleSavePassword} disabled={savingPw}>
              {savingPw ? "Enregistrement..." : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{memberToRemove?.display_name || memberToRemove?.email}</strong> sera retiré de l'équipe de cet établissement. Son compte ne sera pas supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && removeMutation.mutate(memberToRemove.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
