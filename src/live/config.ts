const env = import.meta.env as Record<string, string | undefined>

/** Una URL por microservicio. Vienen de .env.local (local) o de las variables de Amplify. */
export const API = {
  auth: env.VITE_API_AUTH ?? '',
  cursos: env.VITE_API_CURSOS ?? '',
  eval: env.VITE_API_EVAL ?? '',
  analitica: env.VITE_API_ANALITICA ?? '',
  notif: env.VITE_API_NOTIF ?? '',
} as const

/**
 * El modo "conectado a AWS" se activa cuando existe, al menos, la URL de ms-auth.
 * Si falta, la aplicación muestra un aviso en el login en lugar de fallar en silencio.
 */
export const MODO_AWS = API.auth !== ''

/**
 * Los tres tenants que acepta ms-auth. El `id` es lo que viaja en el login y
 * el `dominio` es el del correo, que NO coincide con el id en el caso de NORTE:
 * tenant_id "NORTE" + correos "@inorte.edu.pe".
 */
export const TENANTS = [
  { id: 'UTEC', nombre: 'UTEC', dominio: 'utec.edu.pe' },
  { id: 'NORTE', nombre: 'Instituto del Norte', dominio: 'inorte.edu.pe' },
  { id: 'ANDINO', nombre: 'Colegio Andino', dominio: 'andino.edu.pe' },
] as const

export type TenantId = (typeof TENANTS)[number]['id']

export const DEMO_PASSWORD = 'Demo2026!'

/** Usuarios sembrados por datos-seed, para los accesos rápidos del login. */
export const USUARIOS_DEMO = [
  { etiqueta: 'Docente', usuario: 'profe' },
  { etiqueta: 'Alumna', usuario: 'ana.torres' },
  { etiqueta: 'Admin', usuario: 'admin' },
] as const

export function nombreTenant(id: string): string {
  return TENANTS.find((t) => t.id === id.toUpperCase())?.nombre ?? id
}

export function correoDemo(tenant: string, usuario: string): string {
  const t = TENANTS.find((item) => item.id === tenant.toUpperCase())
  return `${usuario}@${t?.dominio ?? 'utec.edu.pe'}`
}
