import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InboxEmail {
  id: string;
  message_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_preview: string | null;
  has_attachments: boolean;
  attachment_count: number;
  attachment_urls: string[];
  is_processed: boolean;
  content_id: string | null;
  raw_date: string | null;
  created_at: string;
}

export function useInboxEmails() {
  const queryClient = useQueryClient();

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["inbox_emails"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("inbox_emails") as any)
        .select("*")
        .order("raw_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as InboxEmail[];
    },
  });

  const subscribeRealtime = () => {
    const channel = supabase
      .channel("inbox-emails-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_emails" }, () => {
        queryClient.invalidateQueries({ queryKey: ["inbox_emails"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  return { emails, isLoading, subscribeRealtime };
}
