export const POST_AUTH_REDIRECT_COOKIE = "caravan_post_auth_redirect";

// Only ever an in-app path (set by JoinWithGoogleButton right before it
// kicks off OAuth) — never trust it as an absolute or external URL.
export function safePostAuthDestination(value: string | undefined | null): string {
  return value && value.startsWith("/") ? value : "/trips";
}
