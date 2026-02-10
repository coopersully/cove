export const Permissions = {
  ADMINISTRATOR: 1n << 0n,
  MANAGE_SERVER: 1n << 1n,
  MANAGE_CHANNELS: 1n << 2n,
  MANAGE_ROLES: 1n << 3n,
  MANAGE_MESSAGES: 1n << 4n,
  SEND_MESSAGES: 1n << 5n,
  READ_MESSAGES: 1n << 6n,
  CONNECT: 1n << 7n,
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const DEFAULT_EVERYONE_PERMISSIONS =
  Permissions.SEND_MESSAGES | Permissions.READ_MESSAGES | Permissions.CONNECT;

export const ALL_PERMISSIONS = Object.values(Permissions).reduce((acc, p) => acc | p, 0n);

export function hasPermission(bitfield: bigint, permission: bigint): boolean {
  if ((bitfield & Permissions.ADMINISTRATOR) !== 0n) {
    return true;
  }
  return (bitfield & permission) === permission;
}
