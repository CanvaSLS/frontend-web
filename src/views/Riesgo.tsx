import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Activity, CircleCheck, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react'
import * as api from '../live/api'
import { ApiError } from '../live/api'
import type { EventoTraza, Indicador, Nivel } from '../live/types'

/** Niveles del semáforo, en el orden en que se ofrecen como pestañas. */
const NIVELES: { id: Nivel; etiqueta: string; tono: string; icono: typeof ShieldAlert }[] = [
  { id: 'ROJO', etiqueta: 'ROJO', tono: 'orange', icono: ShieldAlert },
  { id: 'AMBAR', etiqueta: 'ÁMBAR', tono: 'orange', icono: TriangleAlert },
  { id: 'VERDE', etiqueta: 'VERDE', tono: 'green', icono: CircleCheck },
]

const COLUMNAS: CSSProperties = { gridTemplateColumns: '1.7fr 1fr .7fr .6fr .6fr 2.4fr' }

const mensaje = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'No se pudo cargar la información'

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
  }).format(new Date(iso))

/**
 * Panel de riesgo para docente/admin: conteos del semáforo, alumnos por nivel
 * (con paginación por cursor) y la traza de eventos que alimenta la analítica.
 */
export function Riesgo() {
  const [resumen, setResumen] = useState<{ total: number; niveles: Record<string, number> } | null>(null)
  const [errorResumen, setErrorResumen] = useState('')
  const [nivel, setNivel] = useState<Nivel>('ROJO')
  const [alumnos, setAlumnos] = useState<Indicador[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [errorLista, setErrorLista] = useState('')
  const [cargandoMas, setCargandoMas] = useState(false)
  const [eventos, setEventos] = useState<EventoTraza[]>([])
  const [cargandoTraza, setCargandoTraza] = useState(true)
  const [errorTraza, setErrorTraza] = useState('')

  useEffect(() => {
    let vigente = true
    setErrorResumen('')
    api.resumenRiesgo()
      .then((r) => { if (vigente) setResumen(r) })
      .catch((e) => { if (vigente) setErrorResumen(mensaje(e)) })
    return () => { vigente = false }
  }, [])

  /** Carga la primera página del nivel elegido y reinicia el cursor. */
  const cargarNivel = useCallback((n: Nivel) => {
    setNivel(n)
    setCargandoLista(true)
    setErrorLista('')
    setAlumnos([])
    setCursor(null)
    api.riesgo(n, 25)
      .then((r) => { setAlumnos(r.alumnos); setCursor(r.cursor) })
      .catch((e) => setErrorLista(mensaje(e)))
      .finally(() => setCargandoLista(false))
  }, [])

  useEffect(() => { cargarNivel('ROJO') }, [cargarNivel])

  function cargarMas() {
    if (!cursor) return
    setCargandoMas(true)
    setErrorLista('')
    api.riesgo(nivel, 25, cursor)
      .then((r) => { setAlumnos((prev) => [...prev, ...r.alumnos]); setCursor(r.cursor) })
      .catch((e) => setErrorLista(mensaje(e)))
      .finally(() => setCargandoMas(false))
  }

  const cargarTraza = useCallback(() => {
    setCargandoTraza(true)
    setErrorTraza('')
    api.trazaEventos()
      .then((ev) => setEventos(ev))
      .catch((e) => setErrorTraza(mensaje(e)))
      .finally(() => setCargandoTraza(false))
  }, [])

  useEffect(() => { cargarTraza() }, [cargarTraza])

  return <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">ANALÍTICA</span>
        <h1>Riesgo académico</h1>
        <p>{resumen ? `Semáforo por nivel · ${resumen.total} alumnos con indicadores.` : 'Semáforo por nivel de riesgo.'}</p>
      </div>
    </div>

    {errorResumen && <div className="load-bar error" role="alert"><TriangleAlert size={17} /> {errorResumen}</div>}

    <section className="summary-grid">
      {NIVELES.map(({ id, etiqueta, tono, icono: Icono }) => <div className="summary-card" key={id}>
        <span className={`icon-badge ${tono}`}><Icono size={20} strokeWidth={1.8} /></span>
        <div><strong>{resumen?.niveles?.[id] ?? 0}</strong><span>{etiqueta}</span></div>
      </div>)}
    </section>
    {resumen && <p className="muted">Total con indicadores: {resumen.total}</p>}

    <section className="section-block">
      <div className="section-heading">
        <div><h2>Alumnos por nivel</h2><p>Ordenados por puntaje de riesgo.</p></div>
        <div className="segmented">
          {NIVELES.map(({ id, etiqueta }) => <button key={id} className={nivel === id ? 'selected' : ''} onClick={() => cargarNivel(id)}>{etiqueta}</button>)}
        </div>
      </div>

      {cargandoLista && <div className="load-bar" role="status">Cargando alumnos...</div>}
      {errorLista && <div className="load-bar error" role="alert"><TriangleAlert size={17} /> {errorLista}</div>}

      {!cargandoLista && !errorLista && (alumnos.length ? <div className="content-card grade-table">
        <div className="table-head" style={COLUMNAS}>
          <span>NOMBRE</span><span>ID</span><span>PROMEDIO</span><span>TARDÍAS</span><span>PUNTAJE</span><span>MOTIVOS</span>
        </div>
        {alumnos.map((a) => <div className="table-row" style={COLUMNAS} key={a.alumno_id}>
          <span><strong>{a.alumno_nombre}</strong></span>
          <span>{a.alumno_id}</span>
          <span>{a.promedio ?? '—'}</span>
          <span>{a.n_tardias}</span>
          <span><strong>{a.puntaje}</strong></span>
          <span>{a.motivos?.length ? a.motivos.join(' · ') : '—'}</span>
        </div>)}
        {cursor && <div style={{ padding: '14px 19px' }}><button className="button secondary" onClick={cargarMas} disabled={cargandoMas}>{cargandoMas ? 'Cargando...' : 'Cargar más'}</button></div>}
      </div> : <div className="content-card"><div className="empty-state"><ShieldAlert size={30} strokeWidth={1.5} /><strong>Sin alumnos en este nivel</strong><span>Cuando el semáforo marque a alguien, aparecerá aquí.</span></div></div>)}
    </section>

    <section className="section-block">
      <div className="section-heading">
        <div><h2>Traza de eventos</h2><p>Flujo asíncrono reciente de tu institución.</p></div>
        <button className="button secondary" onClick={cargarTraza} disabled={cargandoTraza}><RefreshCw size={16} /> Actualizar</button>
      </div>

      {cargandoTraza && <div className="load-bar" role="status">Cargando eventos...</div>}
      {errorTraza && <div className="load-bar error" role="alert"><TriangleAlert size={17} /> {errorTraza}</div>}

      {!cargandoTraza && !errorTraza && (eventos.length ? <div className="content-card inbox-list">
        {eventos.map((e) => <div className="inbox-item" key={e.event_id}>
          <span className="inbox-icon"><Activity size={18} /></span>
          <div><strong>{e.evento} · {e.titulo}</strong><p>{e.mensaje}</p><small>{fechaHora(e.creado_en)}</small></div>
        </div>)}
      </div> : <div className="content-card"><div className="empty-state"><Activity size={30} strokeWidth={1.5} /><strong>Aún no hay eventos en tu institución</strong><span>Los eventos de negocio aparecerán aquí.</span></div></div>)}
    </section>
  </>
}

/** Tarjeta del panel del alumno con su propio indicador de riesgo. */
export function TarjetaRiesgoAlumno({ studentId }: { studentId: string }) {
  const [indicador, setIndicador] = useState<Indicador | null>(null)
  const [sinDatos, setSinDatos] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError('')
    setSinDatos(false)
    setIndicador(null)
    api.indicadores(studentId)
      .then((r) => { if (vigente) setIndicador(r) })
      .catch((e) => {
        if (!vigente) return
        // Un alumno sin evaluaciones no es un error: aún no hay indicadores.
        if (e instanceof ApiError && e.status === 404 && e.codigo === 'SIN_INDICADORES') setSinDatos(true)
        else setError(mensaje(e))
      })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [studentId])

  return <section className="content-card article-card" style={{ marginBottom: 18 }}>
    <div className="section-heading compact">
      <div><h2>Tu riesgo académico</h2><p>Puntaje calculado con tus últimas evaluaciones.</p></div>
    </div>
    {cargando && <div className="load-bar" role="status">Calculando tu riesgo...</div>}
    {error && <div className="load-bar error" role="alert"><TriangleAlert size={17} /> {error}</div>}
    {sinDatos && <p className="muted">Sin evaluaciones registradas aún</p>}
    {indicador && <>
      <div className="detail-meta">
        <span><ShieldAlert size={16} /> Puntaje {indicador.puntaje}</span>
        <span><Activity size={16} /> Nivel {indicador.nivel}</span>
      </div>
      <p>{indicador.motivos?.length ? indicador.motivos.join(' · ') : 'Sin motivos registrados.'}</p>
    </>}
  </section>
}
