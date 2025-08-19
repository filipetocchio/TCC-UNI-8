export const ROLES_LIST = {
  Admin: 1000,
  Editor: 100,
  User: 1,
} as const;

export type Role = keyof typeof ROLES_LIST;