import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Tv, Users, Trash2, MapPin, UserPlus, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEstablishments } from "@/hooks/useEstablishments";

export default function Establishments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    establishments, isLoading,
    addEstablishment, deleteEstablishment,
    assignScreenToEstablishment,
    assignUserToEstablishment,
    removeUserFromEstablishment,
  } = useEstablishments();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [selectedEstablishment, setSelectedEstablishment] = useState<string | null>(null);

  // Check admin
  const { data: currentUserRoles = [] } = useQuery({
    queryKey: ["my_roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user?.id || "");
      return data?.map((r) => r.role) || [];
    },
    enabled: !!user,
  });
  const isAdmin = currentUserRoles.includes("admin");

  // All screens (admin)
  const { data: allScreens = [] } = useQuery({
    queryKey: ["admin_all_screens"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("screens").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // All users (admin)
  const { data: allUsers = [] } = useQuery({
    queryKey: ["admin_users_list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("display_name");
      if (error) throw error;
      return data || [];
    },
  });

  // User-establishment assignments
  const { data: userEstablishments = [] } = useQuery({
    queryKey: ["user_establishments"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_establishments").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Building2 className="h-12 w-12 mb-3 opacity-30" />
        <p className="font-medium">Accès refusé</p>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addEstablishment.mutateAsync({ name: newName, address: newAddress || undefined });
      toast({ title: "Établissement créé" });
      setShowAddDialog(false);
      setNewName("");
      setNewAddress("");
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEstablishment.mutateAsync(id);
      toast({ title: "Établissement supprimé" });
      if (selectedEstablishment === id) setSelectedEstablishment(null);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const selected = establishments.find((e: any) => e.id === selectedEstablishment);
  const selectedScreens = allScreens.filter((s: any) => s.establishment_id === selectedEstablishment);
  const selectedUserIds = userEstablishments
    .filter((ue: any) => ue.establishment_id === selectedEstablishment)
    .map((ue: any) => ue.user_id);
  const selectedUsers = allUsers.filter((u: any) => selectedUserIds.includes(u.id));
  const availableScreens = allScreens.filter((s: any) => s.establishment_id !== selectedEstablishment);
  const availableUsers = allUsers.filter((u: any) => !selectedUserIds.includes(u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Établissements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez vos établissements, écrans et accès utilisateurs</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{establishments.length} établissement(s)</Badge>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: List */}
        <div className="space-y-3">
          {isLoading && <p className="text-muted-foreground text-sm">Chargement...</p>}
          {establishments.map((est: any) => {
            const screenCount = allScreens.filter((s: any) => s.establishment_id === est.id).length;
            const userCount = userEstablishments.filter((ue: any) => ue.establishment_id === est.id).length;
            return (
              <Card
                key={est.id}
                className={`cursor-pointer transition-colors ${selectedEstablishment === est.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
                onClick={() => setSelectedEstablishment(est.id)}
              >
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{est.name}</p>
                    {est.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {est.address}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Tv className="h-3 w-3" /> {screenCount}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Users className="h-3 w-3" /> {userCount}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!isLoading && establishments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun établissement. Cliquez sur "Ajouter" pour commencer.</p>
          )}
        </div>

        {/* Right: Detail */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Sélectionnez un établissement pour gérer ses écrans et utilisateurs
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" /> {selected.name}
                  </CardTitle>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(selected.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                  </Button>
                </CardHeader>
                {selected.address && (
                  <CardContent className="pt-0 pb-3">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {selected.address}
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Screens */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Tv className="h-4 w-4" /> Écrans ({selectedScreens.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedScreens.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between border rounded-md p-2">
                      <div className="flex items-center gap-2">
                        <Tv className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{s.name}</span>
                        <Badge variant={s.status === "online" ? "default" : "secondary"} className="text-[10px]">
                          {s.status}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          assignScreenToEstablishment.mutate({ screenId: s.id, establishmentId: null });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Select
                    onValueChange={(screenId) => {
                      assignScreenToEstablishment.mutate({
                        screenId,
                        establishmentId: selectedEstablishment!,
                      });
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Ajouter un écran..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableScreens.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.establishment_id ? "(autre établissement)" : "(non assigné)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Users */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" /> Utilisateurs ({selectedUsers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedUsers.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between border rounded-md p-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{u.display_name || u.email}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeUserFromEstablishment.mutate({
                            userId: u.id,
                            establishmentId: selectedEstablishment!,
                          });
                          queryClient.invalidateQueries({ queryKey: ["user_establishments"] });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Select
                    onValueChange={(userId) => {
                      assignUserToEstablishment.mutate({
                        userId,
                        establishmentId: selectedEstablishment!,
                      });
                      queryClient.invalidateQueries({ queryKey: ["user_establishments"] });
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Ajouter un utilisateur..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.display_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel établissement</DialogTitle>
            <DialogDescription>Créez un établissement pour regrouper écrans et utilisateurs</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Siège Paris" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Adresse (optionnel)</label>
              <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="123 rue..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!newName.trim() || addEstablishment.isPending}>
              {addEstablishment.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
