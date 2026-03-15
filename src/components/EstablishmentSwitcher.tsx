import { Building2, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstablishmentContext } from "@/contexts/EstablishmentContext";

export function EstablishmentSwitcher() {
  const { memberships, currentEstablishmentId, setCurrentEstablishmentId, isGlobalAdmin } = useEstablishmentContext();

  if (memberships.length <= 1 && !isGlobalAdmin) return null;

  return (
    <div className="px-3 pb-2">
      <Select value={currentEstablishmentId || "all"} onValueChange={(v) => setCurrentEstablishmentId(v === "all" ? null : v)}>
        <SelectTrigger className="w-full h-8 text-xs bg-secondary/30 border-border/50">
          <Building2 className="h-3 w-3 mr-1.5 text-primary/60" />
          <SelectValue placeholder="Établissement..." />
        </SelectTrigger>
        <SelectContent>
          {isGlobalAdmin && <SelectItem value="all">Tous les établissements</SelectItem>}
          {memberships.map((m) => (
            <SelectItem key={m.establishment_id} value={m.establishment_id}>
              {m.establishment.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
