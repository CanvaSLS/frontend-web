/**
 * Única fuente de datos de la aplicación conectada.
 *
 * Consulta los microservicios y mantiene en memoria lo que las vistas necesitan.
 * Carga módulos, tareas (cuando hay muchos cursos) y entregas del docente bajo
 * demanda para no disparar ráfagas de Lambdas concurrentes; las mutaciones
 * actualizan únicamente la parte afectada.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as api from './api'
import { ApiError } from './api'
import { aAssignment, aCourse, aCourseModule, aNotice, aRole, aSubmission, calcularAvance } from './adapt'
import type { Curso, Sesion } from './types'
import type { Assignment, Course, CourseModule, Notice, Submission } from '../data'

/** Si el usuario ve más cursos que este umbral (p. ej. admin con 60), las tareas se cargan al abrir cada curso. */
const MAX_CURSOS_PRECARGA_TAREAS = 6

export interface Academia {
  cargando: boolean
  cargandoEntregas: boolean
  error: string
  courses: Course[]
  assignments: Assignment[]
  submissions: Submission[]
  notices: Notice[]
  modulesByCourse: Record<string, CourseModule[]>
  noLeidas: number
  recargar: () => void
  cargarModulos: (cursoId: string) => void
  recargarModulosCurso: (cursoId: string) => void
  cargarTareasCurso: (cursoId: string) => void
  cargarEntregasTarea: (cursoId: string, tareaId: string) => void
  cargarEntregasCurso: (cursoId: string) => void
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
  const [pendientesEntregas, setPendientesEntregas] = useState(0)
  const [error, setError] = useState('')
  const [cursosBase, setCursosBase] = useState<Curso[]>([])
  const [tareasByCourse, setTareasByCourse] = useState<Record<string, Assignment[]>>({})
  const [entregasByTarea, setEntregasByTarea] = useState<Record<string, Submission[]>>({})
  const [notices, setNotices] = useState<Notice[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [modulesByCourse, setModules] = useState<Record<string, CourseModule[]>>({})
  const [tick, setTick] = useState(0)

  // Descarta respuestas de una carga anterior si el usuario cambia de sesión o recarga.
  const generacion = useRef(0)
  const modulosPedidos = useRef<Set<string>>(new Set())
  const tareasPedidas = useRef<Set<string>>(new Set())
  const entregasPedidas = useRef<Set<string>>(new Set())
  const tareasRef = useRef<Record<string, Assignment[]>>({})
  tareasRef.current = tareasByCourse

  useEffect(() => {
    const mia = ++generacion.current
    let vigente = true
    const vive = () => vigente && generacion.current === mia

    async function cargar() {
      setCargando(true)
      setError('')
      try {
        const listaCursos = await api.cursos()
        if (!vive()) return

        const mapaTareas: Record<string, Assignment[]> = {}
        if (listaCursos.length <= MAX_CURSOS_PRECARGA_TAREAS) {
          // Secuencial/acotado por el semáforo global de api.ts
          const porCurso = await Promise.all(listaCursos.map(async (c) => {
            const ts = (await api.tareas(c.curso_id)).map((t) => aAssignment(t, tenantId))
            tareasPedidas.current.add(c.curso_id)
            return [c.curso_id, ts] as const
          }))
          for (const [cid, ts] of porCurso) mapaTareas[cid] = ts
        }

        const mapaEntregas: Record<string, Submission[]> = {}
        if (role === 'student') {
          const mis = await api.misNotas()
          for (const e of mis.entregas) {
            const s = aSubmission(e, tenantId)
            mapaEntregas[s.assignmentId] = [...(mapaEntregas[s.assignmentId] ?? []), s]
          }
        }

        let avisos: Notice[] = []
        let sinLeer = 0
        try {
          const n = await api.notificaciones(20)
          avisos = n.notificaciones.map((item) => aNotice(item, tenantId, role))
          sinLeer = n.no_leidas ?? 0
        } catch { /* la bandeja es accesoria: su fallo no bloquea el resto */ }

        if (!vive()) return
        setCursosBase(listaCursos)
        setTareasByCourse(mapaTareas)
        setEntregasByTarea(mapaEntregas)
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

  const recargar = useCallback(() => {
    modulosPedidos.current.clear()
    tareasPedidas.current.clear()
    entregasPedidas.current.clear()
    setModules({})
    setTick((t) => t + 1)
  }, [])

  const cargarModulos = useCallback((cursoId: string) => {
    if (modulosPedidos.current.has(cursoId)) return
    modulosPedidos.current.add(cursoId)
    void api.modulos(cursoId)
      .then((ms) => setModules((prev) => ({ ...prev, [cursoId]: ms.map((m) => aCourseModule(m, cursoId)) })))
      .catch(() => {
        modulosPedidos.current.delete(cursoId)
        setModules((prev) => ({ ...prev, [cursoId]: [] }))
      })
  }, [])

  const recargarModulosCurso = useCallback((cursoId: string) => {
    modulosPedidos.current.delete(cursoId)
    cargarModulos(cursoId)
  }, [cargarModulos])

  const cargarTareasCurso = useCallback((cursoId: string) => {
    if (tareasPedidas.current.has(cursoId)) return
    tareasPedidas.current.add(cursoId)
    void api.tareas(cursoId)
      .then((ts) => setTareasByCourse((prev) => ({ ...prev, [cursoId]: ts.map((t) => aAssignment(t, tenantId)) })))
      .catch(() => {
        tareasPedidas.current.delete(cursoId)
      })
  }, [tenantId])

  const cargarEntregasTarea = useCallback((cursoId: string, tareaId: string) => {
    if (role !== 'teacher' || entregasPedidas.current.has(tareaId)) return
    entregasPedidas.current.add(tareaId)
    setPendientesEntregas((n) => n + 1)
    void api.entregas(cursoId, tareaId)
      .then((es) => setEntregasByTarea((prev) => ({ ...prev, [tareaId]: es.map((e) => aSubmission(e, tenantId)) })))
      .catch(() => {
        entregasPedidas.current.delete(tareaId)
      })
      .finally(() => setPendientesEntregas((n) => Math.max(0, n - 1)))
  }, [role, tenantId])

  const cargarEntregasCurso = useCallback((cursoId: string) => {
    if (role !== 'teacher') return
    const tareasDelCurso = tareasRef.current[cursoId] ?? []
    for (const t of tareasDelCurso) {
      cargarEntregasTarea(cursoId, t.id)
    }
  }, [role, cargarEntregasTarea])

  const crearTarea = useCallback(async (
    cursoId: string, input: { title: string; description: string; dueAt: string; points: number },
  ) => {
    await api.crearTarea(cursoId, {
      titulo: input.title,
      descripcion: input.description,
      fecha_limite: new Date(input.dueAt).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      puntaje_max: input.points,
    })
    const ts = await api.tareas(cursoId)
    tareasPedidas.current.add(cursoId)
    setTareasByCourse((prev) => ({ ...prev, [cursoId]: ts.map((t) => aAssignment(t, tenantId)) }))
  }, [tenantId])

  const entregar = useCallback(async (cursoId: string, tareaId: string, texto: string, archivo?: string) => {
    await api.entregar(cursoId, tareaId, texto, archivo)
    const mis = await api.misNotas()
    const mapa: Record<string, Submission[]> = {}
    for (const e of mis.entregas) {
      const s = aSubmission(e, tenantId)
      mapa[s.assignmentId] = [...(mapa[s.assignmentId] ?? []), s]
    }
    setEntregasByTarea(mapa)
  }, [tenantId])

  const calificar = useCallback(async (
    cursoId: string, tareaId: string, alumnoId: string, nota: number, retro: string,
  ) => {
    await api.calificar(cursoId, tareaId, alumnoId, nota, retro)
    const es = await api.entregas(cursoId, tareaId)
    entregasPedidas.current.add(tareaId)
    setEntregasByTarea((prev) => ({ ...prev, [tareaId]: es.map((e) => aSubmission(e, tenantId)) }))
  }, [tenantId])

  const marcarTodasLeidas = useCallback(async () => {
    await api.marcarTodas()
    setNotices((prev) => prev.map((n) => ({ ...n, read: true })))
    setNoLeidas(0)
  }, [])

  const marcarLeida = useCallback(async (usuarioTs: string) => {
    await api.marcarLeida(usuarioTs)
    setNotices((prev) => prev.map((n) => (n.id === usuarioTs ? { ...n, read: true } : n)))
    setNoLeidas((n) => Math.max(0, n - 1))
  }, [])

  const courses = useMemo(() => cursosBase.map((curso, i) => {
    const tareas = tareasByCourse[curso.curso_id] ?? []
    const entregas = tareas.flatMap((t) => entregasByTarea[t.id] ?? [])
    const estudiantes = new Set(entregas.map((e) => e.studentId)).size
    const avance = calcularAvance(role, tareas, entregas, studentId)
    return aCourse(curso, i, estudiantes, avance)
  }), [cursosBase, tareasByCourse, entregasByTarea, role, studentId])

  const assignments = useMemo(() => Object.values(tareasByCourse).flat(), [tareasByCourse])
  const submissions = useMemo(() => Object.values(entregasByTarea).flat(), [entregasByTarea])

  return {
    cargando, cargandoEntregas: pendientesEntregas > 0, error,
    courses, assignments, submissions, notices, modulesByCourse, noLeidas,
    recargar, cargarModulos, recargarModulosCurso, cargarTareasCurso, cargarEntregasTarea, cargarEntregasCurso,
    crearTarea, entregar, calificar, marcarTodasLeidas, marcarLeida,
  }
}
