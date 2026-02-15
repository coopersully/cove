const DICEBEAR_BASE = "https://api.dicebear.com/9.x";

export function getUserAvatarUrl(userId: string): string {
  return `${DICEBEAR_BASE}/avataaars/svg?seed=${userId}`;
}

export function getServerAvatarUrl(serverId: string): string {
  return `${DICEBEAR_BASE}/avataaars/svg?seed=${serverId}`;
}
