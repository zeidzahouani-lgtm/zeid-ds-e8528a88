import { supabase } from "@/integrations/supabase/client";

export async function uploadMediaFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage.from('media').getPublicUrl(fileName);
  return data.publicUrl;
}

export function getMediaType(file: File): 'image' | 'video' {
  return file.type.startsWith('video') ? 'video' : 'image';
}
