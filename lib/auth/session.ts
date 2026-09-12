import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyMemberToken } from "@/lib/auth/member-jwt";

export const MEMBER_TOKEN_COOKIE = "caravan_member_token";

export async function getAdminUser(): Promise<{ id: string; email: string } | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

export async function getMemberSession(): Promise<{ tripId: string; memberId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MEMBER_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return verifyMemberToken(token);
}
