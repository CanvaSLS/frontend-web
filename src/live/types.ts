/**
 * Formas que devuelven los microservicios de CanvaSLS.
 * Son el contrato del backend: no se tocan para acomodar la interfaz.
 * La traducción a los tipos de la interfaz vive en adapt.ts.
 */
export type Rol = 'alumno' | 'docente' | 'admin'
export type Nivel = 'VERDE' | 'AMBAR' | 'ROJO'

export interface Usuario { user_id: string; tenant_id: string; rol: Rol; nombre: string; email?: string }
export interface Sesion { token: string; expira_epoch: number; usuario: Usuario }

export interface Curso {
  tenant_id: string; curso_id: string; codigo: string; nombre: string; descripcion?: string
  docente_id: string; docente_nombre?: string; ciclo?: string; creditos?: number; color?: string
}

export interface Material { material_id: string; nombre: string }

export interface Modulo {
  modulo_id: string; curso_id?: string; numero: number; titulo: string; descripcion?: string
  publicado: boolean; materiales?: Material[]
}

export interface Tarea {
  curso_id: string; tarea_id: string; titulo: string; descripcion?: string
  fecha_limite: string; puntaje_max: number
}

export interface Entrega {
  tarea_id: string; curso_id: string; alumno_id: string; alumno_nombre?: string; titulo_tarea?: string
  estado: 'ENTREGADA' | 'CALIFICADA'; texto?: string; archivo_nombre?: string
  es_tardia: boolean; entregado_en: string; nota?: number; retroalimentacion?: string
}

export interface Resumen { n_entregas: number; n_notas: number; promedio: number | null; n_tardias: number; caida_ultima: number }

export interface Indicador {
  alumno_id: string; alumno_nombre: string; promedio: number | null; n_tardias: number
  puntaje: number; nivel: Nivel; motivos: string[]; actualizado_en: string
}

export interface Notificacion {
  usuario_ts: string; tipo: string; titulo: string; mensaje: string
  leida: boolean; evento: string; creado_en: string; origen?: string
}

export interface Matricula { curso_id: string; alumno_id: string; alumno_nombre?: string; estado?: string }
