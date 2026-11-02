// The app is Spanish-only. Display labels for enum values stored in English in the database.
export const TYPE_ES = { email: "correo", meeting: "reunión", call: "llamada" } as const;
export const ROLE_ES = { admin: "administrador", member: "miembro", viewer: "solo lectura" } as const;
export const STAGE_KIND_ES = { open: "abierta", won: "ganada", lost: "perdida" } as const;
export const ENTITY_ES = { contacts: "contactos", companies: "empresas", opportunities: "oportunidades", tasks: "tareas" } as const;
export const PERM_ES = {
  read: "ver todo",
  write: "crear y editar",
  delete: "eliminar",
  import: "importar",
  export: "exportar",
  merge: "fusionar duplicados",
  manageStages: "gestionar etapas",
  manageUsers: "gestionar usuarios",
  viewActivity: "ver el registro de actividad",
  backup: "copias de seguridad",
} as const;
