/**
 * Tipos de la interfaz y utilidades de formato.
 *
 * Son las formas que consumen las vistas. Los datos ya no se inventan aquí:
 * llegan de los microservicios y se traducen en `live/adapt.ts`.
 */
export type Role = 'student' | 'teacher'
/** Id de tenant tal como lo devuelve el token: UTEC, NORTE, ANDINO. */
export type TenantId = string
export type Section = 'dashboard' | 'courses' | 'calendar' | 'inbox' | 'grades' | 'riesgo'
export type CourseTab = 'home' | 'modules' | 'assignments' | 'grades' | 'people'

export interface Course {
  id: string
  tenantId: TenantId
  code: string
  name: string
  professor: string
  color: string
  progress: number
  students: number
  term: string
}

export interface ModuleItem {
  id: string
  title: string
  type: 'page' | 'assignment' | 'file'
  description?: string
  /** Módulo dueño del material, necesario para pedir su descarga. */
  moduleId?: string
}

export interface CourseModule {
  id: string
  courseId: string
  title: string
  items: ModuleItem[]
}

export interface Assignment {
  id: string
  tenantId: TenantId
  courseId: string
  title: string
  description: string
  dueAt: string
  points: number
  published: boolean
}

export interface Submission {
  id: string
  assignmentId: string
  tenantId: TenantId
  studentId: string
  studentName: string
  text: string
  fileName?: string
  submittedAt: string
  grade?: number
  feedback?: string
}

export interface Notice {
  id: string
  tenantId: TenantId
  role: Role
  title: string
  body: string
  date: string
  read: boolean
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(new Date(date))
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }).format(new Date(date))
}
