import { API } from './config'
import type {
  Curso, Entrega, EventoTraza, Indicador, Matricula, Modulo, Notificacion, Quiz, RespuestaQuiz, ResultadoQuiz, Resumen, Sesion, Tarea,
} from './types'

const CLAVE = 'sp_sesion'
export type Servicio = keyof typeof API

export class ApiError extends Error {
  status: number
  codigo: string
  constructor(status: number, codigo: string, mensaje: string) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
  }
}

/** La sesión vive en sessionStorage: se va al cerrar la pestaña y caduca con el token. */
export function leerSesion(): Sesion | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE)
    if (!crudo) return null
    const s = JSON.parse(crudo) as Sesion
    return s.expira_epoch * 1000 > Date.now() ? s : null
  } catch {
    return null
  }
}

export function guardarSesion(s: Sesion | null): void {
  try {
    if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s))
    else sessionStorage.removeItem(CLAVE)
  } catch { /* almacenamiento bloqueado: la sesión vive solo en memoria */ }
}

export interface Opciones {
  metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  cuerpo?: unknown
  query?: Record<string, string | number | undefined>
  /** Solo para la demo de aislamiento: usa otro token en vez del de la sesión. */
  token?: string
}

export interface Traza { metodo: string; ruta: string; status: number; ms: number; cuando: string }
let observador: ((t: Traza) => void) | null = null
export const observarLlamadas = (fn: ((t: Traza) => void) | null): void => { observador = fn }

/** Si el token caduca (401) la sesión se borra para forzar un nuevo login. */
let alExpirar: (() => void) | null = null
export const alCaducarSesion = (fn: (() => void) | null): void => { alExpirar = fn }

/**
 * Límite global de peticiones HTTP simultáneas en toda la aplicación.
 * Evita superar el tope de concurrencia de AWS Lambda (10) en AWS Academy,
 * considerando que cada petición protegida invoca Authorizer + handler.
 */
const MAX_CONCURRENTES = 2
let enVuelo = 0
const cola: (() => void)[] = []

function conLimite<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const ejecutar = () => {
      enVuelo++
      fn().then(resolve, reject).finally(() => {
        enVuelo--
        const siguiente = cola.shift()
        if (siguiente) siguiente()
      })
    }
    if (enVuelo < MAX_CONCURRENTES) ejecutar()
    else cola.push(ejecutar)
  })
}

export async function llamar<T>(servicio: Servicio, ruta: string, o: Opciones = {}): Promise<T> {
  const base = API[servicio]
  if (!base) throw new ApiError(0, 'SERVICIO_SIN_URL', `Falta la variable VITE_API_${servicio.toUpperCase()}`)
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(o.query ?? {})) if (v !== undefined && v !== '') qs.set(k, String(v))
  const url = `${base.replace(/\/$/, '')}/${ruta}${qs.size ? `?${qs}` : ''}`
  const token = o.token ?? leerSesion()?.token
  return conLimite(async () => {
    const t0 = performance.now()
    let r: Response
    try {
      r = await fetch(url, {
        method: o.metodo ?? 'GET',
        headers: {
          ...(o.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined,
      })
    } catch {
      throw new ApiError(0, 'RED', 'No se pudo conectar con la API (¿CORS, URL, o credenciales de AWS vencidas?)')
    }
    observador?.({
      metodo: o.metodo ?? 'GET', ruta: `/${ruta}`, status: r.status,
      ms: Math.round(performance.now() - t0), cuando: new Date().toISOString(),
    })
    const texto = await r.text()
    let data: unknown = null
    try { data = texto ? JSON.parse(texto) : null } catch { /* cuerpo no JSON */ }
    if (!r.ok) {
      const d = (data ?? {}) as { error?: string; mensaje?: string; message?: string }
      if (r.status === 401 && token) { guardarSesion(null); alExpirar?.() }
      throw new ApiError(
        r.status,
        d.error ?? (r.status === 401 ? 'NO_AUTENTICADO' : 'ERROR'),
        d.mensaje ?? d.message ?? `HTTP ${r.status}`,
      )
    }
    return data as T
  })
}

// ------------------------------------------------------------------ ms-auth
export const login = (tenant_id: string, email: string, password: string) =>
  llamar<Sesion & { expira_en: string }>('auth', 'auth/login', {
    metodo: 'POST', cuerpo: { tenant_id, email, password },
  })
export const logout = () =>
  llamar<unknown>('auth', 'auth/logout', { metodo: 'POST', cuerpo: {} })

// ------------------------------------------------------------------ ms-cursos
export const cursos = () => llamar<{ cursos: Curso[] }>('cursos', 'cursos').then((r) => r.cursos ?? [])
export const modulos = (curso: string) =>
  llamar<{ modulos: Modulo[] }>('cursos', `cursos/${curso}/modulos`).then((r) => r.modulos ?? [])
export const matriculas = (curso: string, limit = 50, cursor?: string) =>
  llamar<{ matriculas: Matricula[]; cursor: string | null }>('cursos', `cursos/${curso}/matriculas`, {
    query: { limit, cursor },
  })
export const crearCurso = (c: { codigo: string; nombre: string; descripcion?: string }) =>
  llamar<Curso>('cursos', 'cursos', { metodo: 'POST', cuerpo: c })
export const modificarCurso = (id: string, c: Partial<Pick<Curso, 'codigo' | 'nombre' | 'descripcion' | 'color'>>) =>
  llamar<Curso>('cursos', `cursos/${id}`, { metodo: 'PUT', cuerpo: c })
export const eliminarCurso = (id: string) =>
  llamar<{ eliminado: string }>('cursos', `cursos/${id}`, { metodo: 'DELETE' })
export const publicarModulo = (curso: string, titulo: string, descripcion?: string) =>
  llamar<Modulo>('cursos', `cursos/${curso}/modulos`, {
    metodo: 'POST', cuerpo: { titulo, ...(descripcion ? { descripcion } : {}) },
  })
export interface MaterialSubida { material: { material_id: string; nombre: string }; upload_url: string; metodo: string; expira_seg: number }
export const agregarMaterial = (curso: string, modulo: string, nombre_archivo: string, content_type: string) =>
  llamar<MaterialSubida>('cursos', `cursos/${curso}/modulos/${modulo}/materiales`, {
    metodo: 'POST', cuerpo: { nombre_archivo, content_type },
  })
export const descargarMaterial = (curso: string, modulo: string, material: string) =>
  llamar<{ url: string; nombre: string }>('cursos', `cursos/${curso}/modulos/${modulo}/materiales/${material}/descarga`)
/**
 * Sube el archivo a la URL prefirmada de S3. El `Content-Type` debe coincidir
 * con el que se declaró al registrar el material, o S3 rechaza la firma.
 */
export const subirASS3 = async (url: string, file: File): Promise<void> => {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!r.ok) throw new Error(`La subida a S3 falló (HTTP ${r.status})`)
}

// ------------------------------------------------------------------ ms-evaluaciones
export const tareas = (curso: string) =>
  llamar<{ tareas: Tarea[] }>('eval', `evaluaciones/cursos/${curso}/tareas`).then((r) => r.tareas ?? [])
export const crearTarea = (
  curso: string,
  t: { titulo: string; descripcion?: string; fecha_limite: string; puntaje_max?: number },
) => llamar<Tarea>('eval', `evaluaciones/cursos/${curso}/tareas`, { metodo: 'POST', cuerpo: t })
export const entregar = (curso: string, tarea: string, texto: string, archivo_nombre?: string) =>
  llamar<Entrega>('eval', `evaluaciones/cursos/${curso}/tareas/${tarea}/entregas`, {
    metodo: 'POST', cuerpo: { texto, ...(archivo_nombre ? { archivo_nombre } : {}) },
  })
export const entregas = (curso: string, tarea: string) =>
  llamar<{ entregas: Entrega[] }>('eval', `evaluaciones/cursos/${curso}/tareas/${tarea}/entregas`, {
    query: { limit: 100 },
  }).then((r) => r.entregas ?? [])
export const calificar = (curso: string, tarea: string, alumno: string, nota: number, retroalimentacion: string) =>
  llamar<Entrega>('eval', `evaluaciones/cursos/${curso}/tareas/${tarea}/entregas/${alumno}/calificacion`, {
    metodo: 'PUT', cuerpo: { nota, retroalimentacion },
  })
export const misNotas = () =>
  llamar<{ alumno_id: string; entregas: Entrega[]; resumen: Resumen }>('eval', 'evaluaciones/mis-notas')

// ------------------------------------------------------------------ ms-analitica
export const resumenRiesgo = () =>
  llamar<{ total: number; niveles: Record<string, number> }>('analitica', 'analitica/resumen')
export const riesgo = (nivel: string, limit = 25, cursor?: string) =>
  llamar<{ alumnos: Indicador[]; cursor: string | null }>('analitica', 'analitica/riesgo', {
    query: { nivel, limit, cursor },
  })
export const indicadores = (alumno: string) =>
  llamar<Indicador>('analitica', `analitica/alumnos/${alumno}`)

// ------------------------------------------------------------------ ms-notificaciones
export const notificaciones = (limit = 20) =>
  llamar<{ notificaciones: Notificacion[]; no_leidas: number }>('notif', 'notificaciones', { query: { limit } })
export const marcarTodas = () =>
  llamar<{ marcadas: number }>('notif', 'notificaciones/leida-todas', { metodo: 'POST', cuerpo: {} })
/** Marca un solo aviso por su id (`usuario_ts`), el que devuelve la bandeja. */
export const marcarLeida = (usuarioTs: string) =>
  llamar<Notificacion>('notif', 'notificaciones/leida', { metodo: 'POST', cuerpo: { id: usuarioTs } })
export const trazaEventos = (limit = 15) =>
  llamar<{ eventos: EventoTraza[] }>('notif', 'notificaciones/traza', { query: { limit } })
    .then((r) => r.eventos ?? [])

// ------------------------------------------------------------------ ms-practica
export const obtenerQuiz = (cursoId: string) =>
  llamar<Quiz>('practica', 'practica/quiz', { query: { curso_id: cursoId } })
export const completarQuiz = (cursoId: string, respuestas: RespuestaQuiz[]) =>
  llamar<ResultadoQuiz>('practica', 'practica/quiz/completar', {
    metodo: 'POST', cuerpo: { curso_id: cursoId, respuestas },
  })
