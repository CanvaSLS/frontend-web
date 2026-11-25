/**
 * Traductor entre el backend y la interfaz.
 *
 * Las vistas del diseño (Dashboard, CourseCard, GradeTable...) reciben Course,
 * Assignment, Submission y Notice. El backend habla de Curso, Tarea, Entrega y
 * Notificacion. Todo el mapeo ocurre aquí, de modo que las vistas y el CSS no
 * cambian cuando cambia el contrato del backend.
 */
import type {
  Assignment, Course, CourseModule, ModuleItem, Notice, Role, Submission,
} from '../data'
import type { Curso, Entrega, Modulo, Notificacion, Rol, Tarea } from './types'

/** El rol lo decide el token, no la interfaz: admin ve lo mismo que un docente. */
export function aRole(rol: Rol): Role {
  return rol === 'alumno' ? 'student' : 'teacher'
}

/** Colores de reserva cuando el curso no trae `color` desde la base. */
const PALETA = ['#176789', '#a44855', '#705a9c', '#947030', '#356e7e', '#8d596c', '#666d42']

export function aCourse(c: Curso, indice: number, estudiantes = 0, avance = 0): Course {
  return {
    id: c.curso_id,
    tenantId: c.tenant_id,
    code: c.codigo,
    name: c.nombre,
    professor: c.docente_nombre ?? 'Sin asignar',
    color: c.color || PALETA[indice % PALETA.length],
    progress: avance,
    students: estudiantes,
    term: c.ciclo ?? '',
    description: c.descripcion ?? '',
  }
}

export function aAssignment(t: Tarea, tenantId: string): Assignment {
  return {
    id: t.tarea_id,
    tenantId,
    courseId: t.curso_id,
    title: t.titulo,
    description: t.descripcion ?? '',
    dueAt: t.fecha_limite,
    points: Number(t.puntaje_max ?? 20),
    published: true, // ms-evaluaciones solo devuelve tareas publicadas
  }
}

export function aSubmission(e: Entrega, tenantId: string): Submission {
  return {
    id: `${e.tarea_id}#${e.alumno_id}`,
    assignmentId: e.tarea_id,
    tenantId,
    studentId: e.alumno_id,
    studentName: e.alumno_nombre ?? e.alumno_id,
    text: e.texto ?? '',
    fileName: e.archivo_nombre || undefined,
    submittedAt: e.entregado_en,
    // `nota` solo existe cuando el docente ya calificó; 0 es una nota válida,
    // así que se comprueba contra null/undefined y no por falsedad.
    grade: e.nota === null || e.nota === undefined ? undefined : Number(e.nota),
    feedback: e.retroalimentacion || undefined,
  }
}

export function aNotice(n: Notificacion, tenantId: string, role: Role): Notice {
  return {
    id: n.usuario_ts,
    tenantId,
    role,
    title: n.titulo,
    body: n.mensaje,
    date: n.creado_en,
    read: Boolean(n.leida),
  }
}

/**
 * Un módulo del backend trae materiales; la interfaz espera "items".
 * Los materiales se vuelven elementos de tipo archivo y el propio módulo
 * aporta una página de presentación cuando tiene descripción.
 */
export function aCourseModule(m: Modulo, cursoId: string): CourseModule {
  const items: ModuleItem[] = []
  if (m.descripcion) {
    items.push({ id: `${m.modulo_id}-intro`, title: m.titulo, type: 'page', description: m.descripcion })
  }
  for (const mat of m.materiales ?? []) {
    items.push({ id: mat.material_id, title: mat.nombre, type: 'file', moduleId: m.modulo_id })
  }
  return {
    id: m.modulo_id,
    courseId: cursoId,
    title: `Módulo ${m.numero}: ${m.titulo}`,
    items,
  }
}

/**
 * Avance del curso con datos reales, porque el backend no expone un porcentaje.
 * Alumno: proporción de tareas que ya entregó. Docente: proporción de entregas
 * que ya calificó. Sin tareas, el avance es 0 y no 100.
 */
export function calcularAvance(
  role: Role, tareasDelCurso: Assignment[], entregasDelCurso: Submission[], studentId: string,
): number {
  if (role === 'student') {
    if (tareasDelCurso.length === 0) return 0
    const entregadas = tareasDelCurso.filter((t) =>
      entregasDelCurso.some((e) => e.assignmentId === t.id && e.studentId === studentId)).length
    return Math.round((entregadas / tareasDelCurso.length) * 100)
  }
  if (entregasDelCurso.length === 0) return 0
  const calificadas = entregasDelCurso.filter((e) => e.grade !== undefined).length
  return Math.round((calificadas / entregasDelCurso.length) * 100)
}
