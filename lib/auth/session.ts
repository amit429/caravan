import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthUser = { id: string; email: string; name: string };

// Everyone authenticates through Supabase Auth (Google) now — admins and
// members alike. There is no separate identity system anymore; the only
// distinction between an admin and a member is their role on a given trip's
// members row (see resolveCaller), not which auth mechanism got them there.
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  const name = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email.split("@")[0];
  return { id: user.id, email: user.email, name };
}
