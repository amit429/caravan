import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { POST_AUTH_REDIRECT_COOKIE, safePostAuthDestination } from "@/lib/auth/post-auth-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Google/Supabase redirect here with `error`/`error_description` instead of
  // `code` when the user denies consent or the OAuth attempt otherwise fails
  // before a code is issued.
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent("Missing authorization code")}`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  const cookieStore = await cookies();
  const destination = safePostAuthDestination(cookieStore.get(POST_AUTH_REDIRECT_COOKIE)?.value);
  const response = NextResponse.redirect(`${origin}${destination}`);
  // One-shot — clear it so a later plain sign-in doesn't replay a stale join.
  response.cookies.delete(POST_AUTH_REDIRECT_COOKIE);
  return response;
}
