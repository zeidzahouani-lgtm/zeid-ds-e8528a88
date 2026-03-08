import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Shield, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  roles: string[];
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
      
      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
      })) as UserProfile[];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // Delete existing roles
      await supabase.from("user_roles").delete().eq("user_id", userId);
      // Insert new role
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast({ title: "Rôle mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le rôle.", variant: "destructive" });
    },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Administration des utilisateurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez les utilisateurs et leurs rôles
          </p>
        </div>
        <Badge variant="secondary">{users.length} utilisateur(s)</Badge>
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
    </div>
  );
}
