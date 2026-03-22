import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users, Shield, ShieldCheck, UserPlus, Building2, X, RefreshCw, CheckCircle2, CircleDashed } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEstablishments } from "@/hooks/useEstablishments";

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  roles: string[];
  establishments: { id: string; name: string; role: string }[];
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { establishments, assignUserToEstablishment, removeUserFromEstablishment } = useEstablishments();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEstablishmentId, setNewEstablishmentId] = useState("");
  const [showEstDialog, setShowEstDialog] = useState<string | null>(null);

  const { data: currentUserRoles = [] } = useQuery({
    queryKey: ["my_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user?.id || "");
      return data?.map((r) => r.role) || [];
    },
    enabled: !!user,
  });

  const isAdmin = currentUserRoles.includes("admin");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("*");
      const { data: userEsts } = await supabase.from("user_establishments").select("user_id, establishment_id, role, establishment:establishments(id, name)");

      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        establishments: (userEsts || [])
          .filter((ue: any) => ue.user_id === p.id && ue.establishment)
          .map((ue: any) => ({
            id: ue.establishment_id,
            name: ue.establishment?.name || "—",
            role: ue.role || "member",
          })),
      })) as UserProfile[];
    },
  });

  // Check sync status with support-dravox
  const { data: syncedEmails = [] } = useQuery({
    queryKey: ["dravox_sync_status", users.map((u) => u.email)],
    enabled: isAdmin && users.length > 0,
    queryFn: async () => {
      const emails = users.map((u) => ({ email: u.email || "" })).filter((u) => u.email);
      const res = await supabase.functions.invoke("sync-client-dravox", {
        body: { users: emails, mode: "check" },
      });
      if (res.error) throw res.error;
      return (res.data?.syncedEmails as string[]) || [];
    },
    staleTime: 60_000,
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
      const res = await supabase.functions.invoke("invite-user", {
        body: { email: newEmail, password: newPassword, display_name: newDisplayName },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: async (data) => {
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

  const syncToDravox = useMutation({
    mutationFn: async () => {
      const usersToSync = users.map((u) => {
        const est = u.establishments[0];
        return {
          email: u.email || "",
          display_name: u.display_name || "",
          establishment_name: est?.name || "",
        };
      });
      const res = await supabase.functions.invoke("sync-client-dravox", {
        body: { users: usersToSync },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      const created = data.results?.filter((r: any) => r.action === "created").length || 0;
      const updated = data.results?.filter((r: any) => r.action === "updated").length || 0;
      const errors = data.results?.filter((r: any) => r.action === "error").length || 0;
      queryClient.invalidateQueries({ queryKey: ["dravox_sync_status"] });
      toast({
        title: "Synchronisation terminée",
        description: `${created} créé(s), ${updated} mis à jour, ${errors} erreur(s)`,
      });
    },
    onError: (e) => toast({ title: "Erreur de synchronisation", description: e.message, variant: "destructive" }),
  });

  const handleAssignEstablishment = async (userId: string, establishmentId: string) => {
    try {
      await assignUserToEstablishment.mutateAsync({ userId, establishmentId });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast({ title: "Établissement assigné" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleRemoveEstablishment = async (userId: string, establishmentId: string) => {
    try {
      await removeUserFromEstablishment.mutateAsync({ userId, establishmentId });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast({ title: "Établissement retiré" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Shield className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">Accès refusé</p>
        <p className="text-sm">Vous devez être administrateur pour accéder à cette page.</p>
      </div>
    );
  }

  const selectedUser = showEstDialog ? users.find((u) => u.id === showEstDialog) : null;
  const selectedUserEsts = selectedUser?.establishments || [];
  const availableEstablishments = establishments.filter(
    (e: any) => !selectedUserEsts.some((ue) => ue.id === e.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Administration des utilisateurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez les utilisateurs, rôles et établissements</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{users.length} utilisateur(s)</Badge>
          <Button size="sm" variant="outline" onClick={() => syncToDravox.mutate()} disabled={syncToDravox.isPending || users.length === 0}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncToDravox.isPending ? "animate-spin" : ""}`} /> Sync Support
          </Button>
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{u.display_name || "Sans nom"}</p>
                      {u.email && syncedEmails.includes(u.email) ? (
                        <span className="inline-flex" aria-label="Synchronisé avec Support"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /></span>
                      ) : (
                        <span className="inline-flex" aria-label="Non synchronisé"><CircleDashed className="h-3.5 w-3.5 text-muted-foreground/40" /></span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setShowEstDialog(u.id)}
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {u.establishments.length} établissement(s)
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
            <div>
              <label className="text-sm font-medium">Établissement (optionnel)</label>
              <Select value={newEstablishmentId} onValueChange={setNewEstablishmentId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Aucun établissement" />
                </SelectTrigger>
                <SelectContent>
                  {establishments.map((est: any) => (
                    <SelectItem key={est.id} value={est.id}>{est.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      {/* Establishment assignment dialog */}
      <Dialog open={!!showEstDialog} onOpenChange={() => setShowEstDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Établissements assignés</DialogTitle>
            <DialogDescription>
              {selectedUser?.display_name || "Utilisateur"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {selectedUserEsts.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun établissement assigné à cet utilisateur.</p>
            )}
            {selectedUserEsts.map((est) => (
              <div key={est.id} className="flex items-center justify-between border border-border rounded-md p-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{est.name}</span>
                  <Badge variant="secondary" className="text-[10px]">{est.role}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => showEstDialog && handleRemoveEstablishment(showEstDialog, est.id)}
                >
                  <X className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}

            {availableEstablishments.length > 0 && (
              <div className="border-t border-border pt-3">
                <label className="text-sm font-medium">Assigner un établissement</label>
                <Select onValueChange={(estId) => {
                  if (showEstDialog) handleAssignEstablishment(showEstDialog, estId);
                }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choisir un établissement..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEstablishments.map((est: any) => (
                      <SelectItem key={est.id} value={est.id}>{est.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
