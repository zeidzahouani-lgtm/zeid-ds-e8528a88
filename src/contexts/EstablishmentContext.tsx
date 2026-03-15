import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface EstablishmentMembership {
  establishment_id: string;
  role: string;
  establishment: {
    id: string;
    name: string;
    address: string | null;
  };
}

interface EstablishmentContextType {
  /** The currently active establishment ID */
  currentEstablishmentId: string | null;
  /** Set the active establishment */
  setCurrentEstablishmentId: (id: string | null) => void;
  /** All establishments the user belongs to */
  memberships: EstablishmentMembership[];
  /** Whether the user is a global admin */
  isGlobalAdmin: boolean;
  /** Whether the user is an admin of the current establishment */
  isEstablishmentAdmin: boolean;
  /** The role in the current establishment */
  currentRole: string | null;
  /** Loading state */
  isLoading: boolean;
}

const EstablishmentContext = createContext<EstablishmentContextType>({
  currentEstablishmentId: null,
  setCurrentEstablishmentId: () => {},
  memberships: [],
  isGlobalAdmin: false,
  isEstablishmentAdmin: false,
  currentRole: null,
  isLoading: true,
});

export function EstablishmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentEstablishmentId, setCurrentEstablishmentId] = useState<string | null>(null);

  // Check global admin role
  const { data: isGlobalAdmin = false, isLoading: loadingAdmin } = useQuery({
    queryKey: ["global_admin_check", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });

  // Fetch user's establishment memberships
  const { data: memberships = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ["user_memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_establishments")
        .select("establishment_id, role, establishment:establishments(id, name, address)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        establishment_id: d.establishment_id,
        role: d.role,
        establishment: d.establishment,
      })) as EstablishmentMembership[];
    },
  });

  // Auto-select first establishment if none selected
  useEffect(() => {
    if (!currentEstablishmentId && memberships.length > 0 && !isGlobalAdmin) {
      setCurrentEstablishmentId(memberships[0].establishment_id);
    }
  }, [memberships, currentEstablishmentId, isGlobalAdmin]);

  // Persist selection in localStorage
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`est_${user.id}`);
      if (saved) setCurrentEstablishmentId(saved);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && currentEstablishmentId) {
      localStorage.setItem(`est_${user.id}`, currentEstablishmentId);
    }
  }, [user?.id, currentEstablishmentId]);

  const currentMembership = memberships.find(m => m.establishment_id === currentEstablishmentId);
  const currentRole = currentMembership?.role ?? null;
  const isEstablishmentAdmin = currentRole === "admin" || isGlobalAdmin;

  return (
    <EstablishmentContext.Provider
      value={{
        currentEstablishmentId,
        setCurrentEstablishmentId,
        memberships,
        isGlobalAdmin,
        isEstablishmentAdmin,
        currentRole,
        isLoading: loadingAdmin || loadingMemberships,
      }}
    >
      {children}
    </EstablishmentContext.Provider>
  );
}

export function useEstablishmentContext() {
  return useContext(EstablishmentContext);
}
