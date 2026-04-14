import React from "react";
import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";
import { useEstablishments } from "@/hooks/useEstablishments";

export const EstablishmentSwitcher = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((_props, ref) => {
  const { memberships, currentEstablishmentId, setCurrentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();
  const { establishments } = useEstablishments();

  // Global admin sees all establishments, others see only their memberships
  const items = isGlobalAdmin
    ? establishments.map((e: any) => ({ id: e.id, name: e.name }))
    : memberships.map((m) => ({ id: m.establishment_id, name: m.establishment.name }));

  if (items.length === 0 && !isGlobalAdmin) return null;

  return (
    <div ref={ref} className="px-3 pb-2" {..._props}>
      <Select value={currentEstablishmentId || "all"} onValueChange={(v) => setCurrentEstablishmentId(v === "all" ? null : v)}>
        <SelectTrigger className="w-full h-8 text-xs bg-secondary/30 border-border/50">
          <Building2 className="h-3 w-3 mr-1.5 text-primary/60" />
          <SelectValue placeholder="Établissement..." />
        </SelectTrigger>
        <SelectContent>
          {isGlobalAdmin && <SelectItem value="all">Tous les établissements</SelectItem>}
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

EstablishmentSwitcher.displayName = "EstablishmentSwitcher";
