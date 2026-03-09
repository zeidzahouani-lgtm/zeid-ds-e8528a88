import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users, Shield, ShieldCheck, Plus, Tv, UserPlus, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useScreens } from "@/hooks/useScreens";
import { useEstablishments } from "@/hooks/useEstablishments";

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  roles: string[];
  screenCount: number;
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { screens } = useScreens();
  const { establishments, assignUserToEstablishment } = useEstablishments();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEstablishmentId, setNewEstablishmentId] = useState("");
  const [showScreenDialog, setShowScreenDialog] = useState<string | null>(null);

  const { data: currentUserRoles = [] } = useQuery({
    queryKey: ["my_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user?.id || "");
      return data?.map((r) => r.role) || [];
    },
    enabled: !!user,
  });

  const isAdmin = currentUserRoles.includes("admin");

  const { data: allScreens = [] } = useQuery({
    queryKey: ["admin_all_screens"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("screens").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("*");
      const { data: screenData } = await supabase.from("screens").select("id, user_id");

      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        screenCount: (screenData || []).filter((s) => s.user_id === p.id).length,
      })) as UserProfile[];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast({ title: "Rôle mis à jour" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  const inviteUser = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("invite-user", {
        body: { email: newEmail, password: newPassword, display_name: newDisplayName },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: async (data) => {
      // If an establishment was selected, assign the new user
      if (newEstablishmentId && data?.user?.id) {
        try {
          await assignUserToEstablishment.mutateAsync({
            userId: data.user.id,
            establishmentId: newEstablishmentId,
          });
        } catch {}
      }
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["user_establishments"] });
      toast({ title: "Utilisateur créé avec succès" });
      setShowAddDialog(false);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewEstablishmentId("");
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const assignScreen = useMutation({
    mutationFn: async ({ screenId, userId }: { screenId: string; userId: string }) => {
      const { error } = await supabase.from("screens").update({ user_id: userId }).eq("id", screenId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      queryClient.invalidateQueries({ queryKey: ["admin_all_screens"] });
      queryClient.invalidateQueries({ queryKey: ["screens"] });
      toast({ title: "Écran assigné" });
    },
    onError: () => toast({ title: "Erreur", variant: "destructive" }),
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">Accès refusé</p>
        <p className="text-sm">Vous devez être administrateur pour accéder à cette page.</p>
      </div>
    );
  }

  const selectedUserScreens = showScreenDialog
    ? allScreens.filter((s) => s.user_id === showScreenDialog)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Administration des utilisateurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez les utilisateurs, rôles et écrans</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{users.length} utilisateur(s)</Badge>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    {u.roles.includes("admin") ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.display_name || "Sans nom"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setShowScreenDialog(u.id)}
                  >
                    <Tv className="h-3.5 w-3.5" />
                    {u.screenCount} écran(s)
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("fr-FR")}
                  </span>
                  <Select
                    value={u.roles[0] || "user"}
                    onValueChange={(role) => updateRole.mutate({ userId: u.id, role })}
                    disabled={u.id === user?.id}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Utilisateur</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add user dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un utilisateur</DialogTitle>
            <DialogDescription>Créez un nouveau compte utilisateur</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nom d'affichage</label>
              <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="Jean Dupont" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jean@exemple.com" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Mot de passe</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 caractères" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={() => inviteUser.mutate()} disabled={!newEmail || !newPassword || inviteUser.isPending}>
              {inviteUser.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screen assignment dialog */}
      <Dialog open={!!showScreenDialog} onOpenChange={() => setShowScreenDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Écrans assignés</DialogTitle>
            <DialogDescription>
              {users.find((u) => u.id === showScreenDialog)?.display_name || "Utilisateur"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedUserScreens.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun écran assigné à cet utilisateur.</p>
            )}
            {selectedUserScreens.map((s) => (
              <div key={s.id} className="flex items-center justify-between border rounded-md p-2">
                <div className="flex items-center gap-2">
                  <Tv className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{s.name}</span>
                </div>
                <Badge variant={s.status === "online" ? "default" : "secondary"} className="text-[10px]">
                  {s.status}
                </Badge>
              </div>
            ))}

            <div className="border-t pt-3">
              <label className="text-sm font-medium">Assigner un écran existant</label>
              <Select onValueChange={(screenId) => {
                if (showScreenDialog) assignScreen.mutate({ screenId, userId: showScreenDialog });
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choisir un écran..." />
                </SelectTrigger>
                <SelectContent>
                  {allScreens
                    .filter((s) => s.user_id !== showScreenDialog)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.user_id ? `(${users.find((u) => u.id === s.user_id)?.display_name || "autre"})` : "(non assigné)"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
