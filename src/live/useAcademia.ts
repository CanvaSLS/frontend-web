/**
 * Única fuente de datos de la aplicación conectada.
 *
 * Consulta los microservicios y mantiene en memoria lo que las vistas necesitan.
 * Las mutaciones llaman a la API y recargan solo la parte afectada.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'
import { ApiError } from './api'
import { aAssignment, aCourse, aCourseModule, aNotice, aRole, aSubmission, calcularAvance } from './adapt'
import type { Sesion } from './types'
import type { Assignment, Course, CourseModule, Notice, Submission } from '../data'

export interface Academia {
  cargando: boolean
  error: string
  courses: Course[]
  assignments: Assignment[]
  submissions: Submission[]
  notices: Notice[]
  modulesByCourse: Record<string, CourseModule[]>
  noLeidas: number
  recargar: () => void
  cargarModulos: (cursoId: string) => void
  crearTarea: (cursoId: string, input: { title: string; description: string; dueAt: string; points: number }) => Promise<void>
  entregar: (cursoId: string, tareaId: string, texto: string, archivo?: string) => Promise<void>
  calificar: (cursoId: string, tareaId: string, alumnoId: string, nota: number, retro: string) => Promise<void>
  marcarTodasLeidas: () => Promise<void>
  marcarLeida: (usuarioTs: string) => Promise<void>
}

const mensaje = (e: unknown) =>
  e instanceof ApiError ? `${e.message} (${e.codigo})` : e instanceof Error ? e.message : 'Error inesperado'

export function useAcademia(sesion: Sesion): Academia {
  const role = aRole(sesion.usuario.rol)
  const tenantId = sesion.usuario.tenant_id
  const studentId = sesion.usuario.user_id

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cursosRaw, setCursosRaw] = useState<{ curso: Course; tareas: Assignment[]; entregas: Submission[] }[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [modulesByCourse, setModules] = useState<Record<string, CourseModule[]>>({})
  const [tick, setTick] = useState(0)

  // Descarta respuestas de una carga anterior si el usuario cambia de sesión.
  const generacion = useRef(0)

  useEffect(() => {
    const mia = ++generacion.current
    let vigente = true
    const vive = () => vigente && generacion.current === mia

    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const listaCursos = await api.cursos()

        // Las notas del alumno llegan de una sola llamada; las del docente hay
        // que pedirlas por tarea, así que primero se necesitan las tareas.
        const porCurso = await Promise.all(listaCursos.map(async (c) => {
          const tareas = (await api.tareas(c.curso_id)).map((t) => aAssignment(t, tenantId))
          return { curso: c, tareas }
        }))

        let entregasPorTarea: Record<string, Submission[]> = {}
        if (role === 'student') {
          const mis = await api.misNotas()
          for (const e of mis.entregas) {
            const s = aSubmission(e, tenantId)
            entregasPorTarea[s.assignmentId] = [...(entregasPorTarea[s.assignmentId] ?? []), s]
          }
        } else {
          const pares = porCurso.flatMap(({ curso, tareas }) => tareas.map((t) => ({ cursoId: curso.curso_id, tareaId: t.id })))
          const resultados = await Promise.all(pares.map(async ({ cursoId, tareaId }) => {
            try {
              return { tareaId, entregas: (await api.entregas(cursoId, tareaId)).map((e) => aSubmission(e, tenantId)) }
            } catch {
              return { tareaId, entregas: [] as Submission[] } // una tarea sin permiso no debe tumbar la carga
            }
          }))
          entregasPorTarea = Object.fromEntries(resultados.map((r) => [r.tareaId, r.entregas]))
        }

        const armados = porCurso.map(({ curso, tareas }, i) => {
          const entregas = tareas.flatMap((t) => entregasPorTarea[t.id] ?? [])
          const estudiantes = new Set(entregas.map((e) => e.studentId)).size
          const avance = calcularAvance(role, tareas, entregas, studentId)
          return { curso: aCourse(curso, i, estudiantes, avance), tareas, entregas }
        })

        let avisos: Notice[] = []
        let sinLeer = 0
        try {
          const n = await api.notificaciones(20)
          avisos = n.notificaciones.map((item) => aNotice(item, tenantId, role))
          sinLeer = n.no_leidas ?? 0
        } catch { /* la bandeja es accesoria: su fallo no bloquea el resto */ }

        if (!vive()) return
        setCursosRaw(armados)
        setNotices(avisos)
        setNoLeidas(sinLeer)
      } catch (e) {
        if (vive()) setError(mensaje(e))
      } finally {
        if (vive()) setCargando(false)
      }
    }

    void cargar()
    return () => { vigente = false }
  }, [sesion.token, role, tenantId, studentId, tick])

  /**
   * Cursos cuyos módulos ya se pidieron. Es un ref y no estado para que
   * `cargarModulos` sea estable: si dependiera de `modulesByCourse`, cambiaría
   * en cada carga y el efecto que lo llama dispararía peticiones repetidas
   * antes de que la primera respondiera.
   */
  const modulosPedidos = useRef<Set<string>>(new Set())

  const recargar = useCallback(() => {
    modulosPedidos.current.clear() // "Recargar" también vuelve a pedir los módulos
    setModules({})
    setTick((t) => t + 1)
  }, [])

  const cargarModulos = useCallback((cursoId: string) => {
    if (modulosPedidos.current.has(cursoId)) return
    modulosPedidos.current.add(cursoId)
    void api.modulos(cursoId)
      .then((ms) => setModules((prev) => ({ ...prev, [cursoId]: ms.map((m) => aCourseModule(m, cursoId)) })))
      .catch(() => {
        modulosPedidos.current.delete(cursoId) // permite reintentar tras un fallo
        setModules((prev) => ({ ...prev, [cursoId]: [] }))
      })
  }, [])

  const crearTarea = useCallback(async (
    cursoId: string, input: { title: string; description: string; dueAt: string; points: number },
  ) => {
    await api.crearTarea(cursoId, {
      titulo: input.title,
      descripcion: input.description,
      // el backend exige ISO UTC con Z; el <input type="datetime-local"> da hora local
      fecha_limite: new Date(input.dueAt).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      puntaje_max: input.points,
    })
    recargar()
  }, [recargar])

  const entregar = useCallback(async (cursoId: string, tareaId: string, texto: string, archivo?: string) => {
    await api.entregar(cursoId, tareaId, texto, archivo)
    recargar()
  }, [recargar])

  const calificar = useCallback(async (
    cursoId: string, tareaId: string, alumnoId: string, nota: number, retro: string,
  ) => {
    await api.calificar(cursoId, tareaId, alumnoId, nota, retro)
    recargar()
  }, [recargar])

  const marcarTodasLeidas = useCallback(async () => {
    await api.marcarTodas()
    recargar()
  }, [recargar])

  const marcarLeida = useCallback(async (usuarioTs: string) => {
    await api.marcarLeida(usuarioTs)
    recargar()
  }, [recargar])

  const courses = useMemo(() => cursosRaw.map((c) => c.curso), [cursosRaw])
  const assignments = useMemo(() => cursosRaw.flatMap((c) => c.tareas), [cursosRaw])
  const submissions = useMemo(() => cursosRaw.flatMap((c) => c.entregas), [cursosRaw])

  return {
    cargando, error, courses, assignments, submissions, notices, modulesByCourse, noLeidas,
    recargar, cargarModulos, crearTarea, entregar, calificar, marcarTodasLeidas, marcarLeida,
  }
}
