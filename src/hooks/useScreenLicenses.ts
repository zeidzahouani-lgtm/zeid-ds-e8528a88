import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScreenLicenseStatus {
  screenId: string;
  valid: boolean;
  expired: boolean;
  inactive: boolean;
}

export function useScreenLicenses(screenIds: string[]) {
  return useQuery({
    queryKey: ["screen-licenses", screenIds],
    enabled: screenIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("screen_id, is_active, valid_until")
        .in("screen_id", screenIds);

      if (error) throw error;

      const now = new Date();
      const statusMap: Record<string, ScreenLicenseStatus> = {};

      // Initialize all screens as no license
      for (const id of screenIds) {
        statusMap[id] = { screenId: id, valid: false, expired: false, inactive: false };
      }

      // Process licenses
      for (const license of data || []) {
        if (!license.screen_id) continue;
        const isExpired = new Date(license.valid_until) < now;
        const isActive = license.is_active;

        if (isActive && !isExpired) {
          statusMap[license.screen_id] = { screenId: license.screen_id, valid: true, expired: false, inactive: false };
        } else if (!statusMap[license.screen_id].valid) {
          statusMap[license.screen_id] = {
            screenId: license.screen_id,
            valid: false,
            expired: isExpired,
            inactive: !isActive,
          };
        }
      }

      return statusMap;
    },
    refetchInterval: 30000,
  });
}
