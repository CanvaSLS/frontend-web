export type Role = 'student' | 'teacher'
export type TenantId = 'utec' | 'norte'
export type Section = 'dashboard' | 'courses' | 'calendar' | 'inbox' | 'grades'
export type CourseTab = 'home' | 'modules' | 'assignments' | 'grades' | 'people'

export interface Tenant {
  id: TenantId
  name: string
  shortName: string
}

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

export interface DemoState {
  assignments: Assignment[]
  submissions: Submission[]
  notices: Notice[]
}

export const tenants: Tenant[] = [
  { id: 'utec', name: 'Universidad de Ingeniería y Tecnología', shortName: 'UTEC' },
  { id: 'norte', name: 'Instituto del Norte', shortName: 'NORTE' },
]

export const courses: Course[] = [
  { id: 'cloud', tenantId: 'utec', code: 'CS2032', name: 'Cloud Computing', professor: 'Gerardo Colchado', color: '#176789', progress: 72, students: 32, term: '2026-2' },
  { id: 'software', tenantId: 'utec', code: 'CS2043', name: 'Ingeniería de Software', professor: 'María Fernández', color: '#a44855', progress: 54, students: 38, term: '2026-2' },
  { id: 'data', tenantId: 'utec', code: 'CS2051', name: 'Ingeniería de Datos', professor: 'Lucía Morales', color: '#705a9c', progress: 38, students: 29, term: '2026-2' },
  { id: 'networks', tenantId: 'utec', code: 'CS2028', name: 'Redes de Computadoras', professor: 'Diego Rojas', color: '#947030', progress: 61, students: 34, term: '2026-2' },
  { id: 'systems', tenantId: 'norte', code: 'INF301', name: 'Sistemas Distribuidos', professor: 'Ana Torres', color: '#356e7e', progress: 64, students: 27, term: '2026-B' },
  { id: 'design', tenantId: 'norte', code: 'INF217', name: 'Diseño de Interfaces', professor: 'Carlos Vega', color: '#8d596c', progress: 47, students: 30, term: '2026-B' },
  { id: 'security', tenantId: 'norte', code: 'INF330', name: 'Seguridad Informática', professor: 'Sofía Paredes', color: '#666d42', progress: 25, students: 24, term: '2026-B' },
]

export const modules: CourseModule[] = [
  { id: 'm1', courseId: 'cloud', title: 'Módulo 1: Fundamentos de cloud computing', items: [
    { id: 'm1a', title: 'Introducción a la computación en la nube', type: 'page', description: 'Modelos de servicio, despliegue y conceptos fundamentales.' },
    { id: 'm1b', title: 'Modelos IaaS, PaaS y SaaS', type: 'page', description: 'Comparación de modelos y casos de uso.' },
    { id: 'm1c', title: 'Lectura: Arquitecturas en la nube', type: 'file' },
  ] },
  { id: 'm2', courseId: 'cloud', title: 'Módulo 2: Arquitecturas modernas', items: [
    { id: 'm2a', title: 'Aplicaciones serverless', type: 'page', description: 'Funciones, eventos y servicios administrados.' },
    { id: 'm2b', title: 'Arquitectura basada en eventos', type: 'page', description: 'Productores, consumidores y procesamiento asíncrono.' },
    { id: 'm2c', title: 'Proyecto final: propuesta de arquitectura', type: 'assignment' },
  ] },
  { id: 'm3', courseId: 'cloud', title: 'Módulo 3: Proyecto final', items: [
    { id: 'm3a', title: 'Diseño de solución SaaS', type: 'page', description: 'Definir dominios, usuarios, tenants y eventos.' },
    { id: 'm3b', title: 'Entrega del proyecto final', type: 'assignment' },
  ] },
]

const initialAssignments: Assignment[] = [
  { id: 'a1', tenantId: 'utec', courseId: 'cloud', title: 'Proyecto final: propuesta de arquitectura', description: 'Presenta un diagrama de arquitectura SaaS multitenant, los dominios de los microservicios y los eventos principales.', dueAt: '2026-11-14T23:59:00-05:00', points: 20, published: true },
  { id: 'a2', tenantId: 'utec', courseId: 'cloud', title: 'Entrega del proyecto final', description: 'Entrega el informe final y el enlace al repositorio. Incluye evidencia de despliegue y aislamiento entre tenants.', dueAt: '2026-11-22T23:59:00-05:00', points: 20, published: true },
  { id: 'a3', tenantId: 'utec', courseId: 'software', title: 'Diseño de componentes', description: 'Documenta los componentes principales de tu aplicación.', dueAt: '2026-11-18T23:59:00-05:00', points: 20, published: true },
  { id: 'a4', tenantId: 'norte', courseId: 'systems', title: 'Laboratorio de mensajería', description: 'Implementa un productor y consumidor de eventos.', dueAt: '2026-11-16T23:59:00-05:00', points: 20, published: true },
  { id: 'a5', tenantId: 'norte', courseId: 'design', title: 'Prototipo interactivo', description: 'Diseña y presenta el prototipo de la experiencia.', dueAt: '2026-11-19T23:59:00-05:00', points: 20, published: true },
]

const initialNotices: Notice[] = [
  { id: 'n1', tenantId: 'utec', role: 'student', title: 'Nueva tarea publicada', body: 'Proyecto final: propuesta de arquitectura · Cloud Computing', date: '2026-11-11T09:00:00-05:00', read: false },
  { id: 'n2', tenantId: 'utec', role: 'teacher', title: 'Curso activo', body: 'Cloud Computing tiene 32 estudiantes matriculados.', date: '2026-11-10T10:00:00-05:00', read: false },
  { id: 'n3', tenantId: 'norte', role: 'student', title: 'Nueva tarea publicada', body: 'Laboratorio de mensajería · Sistemas Distribuidos', date: '2026-11-11T08:00:00-05:00', read: false },
]

export const initialState: DemoState = {
  assignments: initialAssignments,
  submissions: [],
  notices: initialNotices,
}

const STORAGE_KEY = 'canvasls-demo-v1'

export function loadDemoState(): DemoState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialState
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) return initialState
    const value = parsed as Partial<DemoState>
    if (!Array.isArray(value.assignments) || !Array.isArray(value.submissions) || !Array.isArray(value.notices)) return initialState
    return value as DemoState
  } catch {
    return initialState
  }
}

export function saveDemoState(state: DemoState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(new Date(date))
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Lima' }).format(new Date(date))
}
