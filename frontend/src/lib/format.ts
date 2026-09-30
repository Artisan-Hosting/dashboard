// Formats a unix-seconds cert expiry the way both the Domains page and a
// project's Domains panel need it: 0 means nothing is on disk yet.
export function formatExpiry(expiresAt: number): string {
  if (!expiresAt) return 'no certificate on disk';
  const days = Math.round((expiresAt * 1000 - Date.now()) / 86_400_000);
  const date = new Date(expiresAt * 1000).toLocaleDateString();
  if (days < 0) return `expired ${date}`;
  if (days === 0) return `expires today`;
  return `expires in ${days}d (${date})`;
}
