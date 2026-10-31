/**
 * Canonical web avatar URL shared by the navbar account button and voter rows.
 * Keep avatar identity deterministic so the same account has the same image
 * wherever it appears in the web UI.
 */
export function getFanAvatarUri(userId: string | null | undefined): string {
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(userId || 'guest')}`;
}
