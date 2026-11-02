export type Role = "admin" | "member" | "viewer";
export type Permission =
  | "read"
  | "write"
  | "delete"
  | "import"
  | "export"
  | "merge"
  | "manageStages"
  | "manageUsers"
  | "viewActivity"
  | "backup";

const MATRIX: Record<Role, Permission[]> = {
  viewer: ["read"],
  member: ["read", "write", "import", "export", "merge"],
  admin: ["read", "write", "delete", "import", "export", "merge", "manageStages", "manageUsers", "viewActivity", "backup"],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  return !!role && MATRIX[role].includes(permission);
}

export const ROLE_PERMISSIONS = MATRIX;
