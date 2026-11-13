// Tylko na serwerze: klient Supabase zalogowanego administratora
import { createClient } from '@/lib/supabase/server';

export async function adminClient() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (!isAdmin) throw new Error('Brak uprawnień administratora');
  return supabase;
}
