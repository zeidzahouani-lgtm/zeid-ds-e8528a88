import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ScreenData {
  id: string;
  name: string;
  orientation: string;
  status: string;
  current_media_id: string | null;
}

export function useScreenRealtime(screenId: string | undefined) {
  const [screen, setScreen] = useState<ScreenData | null>(null);
  const [media, setMedia] = useState<{ id: string; name: string; type: string; url: string; duration: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    if (!screenId) return;
    
    const fetchScreen = async () => {
      const { data } = await supabase
        .from("screens")
        .select("*")
        .eq("id", screenId)
        .single();
      
      if (data) {
        setScreen(data);
        // Mark as online
        await supabase.from("screens").update({ status: "online" }).eq("id", screenId);
        
        if (data.current_media_id) {
          const { data: mediaData } = await supabase
            .from("media")
            .select("*")
            .eq("id", data.current_media_id)
            .single();
          if (mediaData) setMedia(mediaData);
        }
      }
      setLoading(false);
    };

    fetchScreen();

    // Set offline on unmount
    return () => {
      supabase.from("screens").update({ status: "offline" }).eq("id", screenId);
    };
  }, [screenId]);

  // Real-time subscription
  useEffect(() => {
    if (!screenId) return;

    const channel = supabase
      .channel(`screen-${screenId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "screens",
        filter: `id=eq.${screenId}`,
      }, async (payload) => {
        const newData = payload.new as ScreenData;
        setScreen(newData);

        if (newData.current_media_id) {
          const { data: mediaData } = await supabase
            .from("media")
            .select("*")
            .eq("id", newData.current_media_id)
            .single();
          if (mediaData) setMedia(mediaData);
        } else {
          setMedia(null);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [screenId]);

  return { screen, media, loading };
}
