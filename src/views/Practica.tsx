import { useEffect, useState } from 'react'
import {
  Award, CheckCircle2, Layers, Play, RefreshCw, Send, TriangleAlert, XCircle,
} from 'lucide-react'
import type { Course } from '../data'
import * as api from '../live/api'
import { ApiError } from '../live/api'
import { API } from '../live/config'
import type { Quiz, ResultadoQuiz } from '../live/types'

const LETRAS = ['A', 'B', 'C', 'D', 'E']

const mensaje = (e: unknown) =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'No se pudo cargar el quiz'

/**
 * Vista de práctica semanal conectada a ms-practica (rol alumno).
 * Pide 5 tarjetas aleatorias del curso elegido, envía las respuestas al
 * servidor para corrección y dispara el evento QuizCompletado.
 */
export function Practica({ courses, onNotify }: {
  courses: Course[]
  onNotify: (msg: string) => void
}) {
  const [cursoId, setCursoId] = useState<string>(courses[0]?.id ?? '')
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [respuestas, setRespuestas] = useState<Record<string, number>>({})
  const [resultado, setResultado] = useState<ResultadoQuiz | null>(null)
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cursoId && courses.length > 0) setCursoId(courses[0].id)
  }, [courses, cursoId])

  const cursoActual = courses.find((c) => c.id === cursoId) ?? null
  const sinApi = API.practica === ''

  async function cargarQuiz(id = cursoId) {
    if (!id) return
    setCargando(true)
    setError('')
    setResultado(null)
    setRespuestas({})
    try {
      const q = await api.obtenerQuiz(id)
      setQuiz(q)
    } catch (e) {
      setQuiz(null)
      setError(mensaje(e))
    } finally {
      setCargando(false)
    }
  }

  function seleccionar(tarjetaId: string, opcion: number) {
    if (resultado) return
    setRespuestas((prev) => ({ ...prev, [tarjetaId]: opcion }))
  }

  async function enviar() {
    if (!quiz || enviando) return
    const lista = quiz.preguntas.map((p) => ({
      tarjeta_id: p.tarjeta_id,
      opcion: respuestas[p.tarjeta_id] ?? -1,
    }))
    setEnviando(true)
    setError('')
    try {
      const res = await api.completarQuiz(quiz.curso_id, lista)
      setResultado(res)
      onNotify(`Quiz completado: ${res.aciertos}/${res.total} · evento QuizCompletado emitido`)
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setEnviando(false)
    }
  }

  const totalPreguntas = quiz?.preguntas.length ?? 0
  const respondidas = quiz ? quiz.preguntas.filter((p) => respuestas[p.tarjeta_id] !== undefined).length : 0
  const progreso = totalPreguntas > 0 ? Math.round((respondidas / totalPreguntas) * 100) : 0
  const detallePorId = resultado
    ? Object.fromEntries(resultado.detalle.map((d) => [d.tarjeta_id, d]))
    : null
  const porcentaje = resultado && resultado.total > 0
    ? Math.round((resultado.aciertos / resultado.total) * 100)
    : 0
  const valoracion = porcentaje >= 80 ? 'Excelente dominio' : porcentaje >= 60 ? 'Buen repaso' : 'Sigue practicando'

  return <>
    <div className="page-heading">
      <div>
        <span className="eyebrow">PRÁCTICA</span>
        <h1>Quiz de repaso</h1>
        <p>Responde 5 preguntas de tu curso. La corrección se realiza en el servidor y queda registrada en tu historial.</p>
      </div>
    </div>

    {sinApi && <div className="load-bar error" role="alert" style={{ marginBottom: 18 }}>
      <TriangleAlert size={17} /> Falta configurar <code>VITE_API_PRACTICA</code> en <code>.env.local</code> o en AWS Amplify.
    </div>}

    {courses.length === 0 ? <div className="content-card">
      <div className="empty-state">
        <Layers size={30} strokeWidth={1.5} />
        <strong>Sin cursos matriculados</strong>
        <span>Cuando estés matriculado en un curso podrás practicar sus quizzes aquí.</span>
      </div>
    </div> : <>
      <div className="content-card article-card quiz-toolbar">
        <div className="quiz-toolbar-field">
          <label className="field-label" htmlFor="quiz-curso" style={{ marginTop: 0 }}>Curso a practicar</label>
          <select
            id="quiz-curso"
            value={cursoId}
            onChange={(e) => {
              setCursoId(e.target.value)
              setQuiz(null)
              setResultado(null)
              setRespuestas({})
              setError('')
            }}
          >
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </div>
        <button
          className="button primary"
          type="button"
          disabled={cargando || sinApi || !cursoId}
          onClick={() => void cargarQuiz(cursoId)}
        >
          {cargando ? <><RefreshCw size={16} /> Cargando...</> : quiz ? <><RefreshCw size={16} /> Nuevo quiz</> : <><Play size={16} /> Iniciar quiz</>}
        </button>
      </div>

      {error && <div className="load-bar error" role="alert" style={{ marginTop: 16 }}>
        <TriangleAlert size={17} /> {error}
      </div>}

      {cargando && <div className="load-bar" role="status" style={{ marginTop: 16 }}>
        Obteniendo tarjetas de práctica desde ms-practica...
      </div>}

      {!cargando && !quiz && !error && <div className="content-card" style={{ marginTop: 18 }}>
        <div className="empty-state">
          <Layers size={30} strokeWidth={1.5} />
          <strong>Listo para repasar {cursoActual ? cursoActual.name : ''}</strong>
          <span>Pulsa «Iniciar quiz» para recibir 5 preguntas aleatorias del banco del curso.</span>
        </div>
      </div>}

      {resultado && <section className="section-block" style={{ marginTop: 22 }}>
        <section className="summary-grid">
          <div className="summary-card">
            <span className={`icon-badge ${porcentaje >= 60 ? 'green' : 'orange'}`}><Award size={20} strokeWidth={1.8} /></span>
            <div><strong>{resultado.aciertos} / {resultado.total}</strong><span>Respuestas correctas</span></div>
          </div>
          <div className="summary-card">
            <span className="icon-badge blue"><CheckCircle2 size={20} strokeWidth={1.8} /></span>
            <div><strong>{porcentaje}%</strong><span>Precisión</span></div>
          </div>
          <div className="summary-card">
            <span className="icon-badge purple"><Layers size={20} strokeWidth={1.8} /></span>
            <div><strong>{valoracion}</strong><span>Intento guardado · aviso enviado</span></div>
          </div>
        </section>
      </section>}

      {quiz && <section className="section-block" style={{ marginTop: 22 }}>
        <div className="section-heading">
          <div>
            <h2>{cursoActual ? `${cursoActual.code} · ${cursoActual.name}` : quiz.curso_id}</h2>
            <p>{resultado ? 'Revisión de respuestas corregidas en el servidor.' : `${respondidas} de ${totalPreguntas} preguntas respondidas.`}</p>
          </div>
          {!resultado && <span className="status-pill">{progreso}% completado</span>}
        </div>

        {!resultado && <div className="progress-track" style={{ marginBottom: 20 }}>
          <span style={{ width: `${progreso}%` }} />
        </div>}

        <div className="quiz-list">
          {quiz.preguntas.map((p, idx) => {
            const elegida = respuestas[p.tarjeta_id]
            const det = detallePorId?.[p.tarjeta_id]
            return <div className="content-card quiz-question" key={p.tarjeta_id}>
              <div className="quiz-q-head">
                <span className="module-number">{String(idx + 1).padStart(2, '0')}</span>
                {p.tema && <span className="status-pill">{p.tema}</span>}
                {det && <span className={`status-pill ${det.acerto ? 'success' : 'quiz-pill-error'}`} style={{ marginLeft: 'auto' }}>
                  {det.acerto ? 'Correcta' : 'Incorrecta'}
                </span>}
              </div>
              <h3 className="quiz-q-title">{p.pregunta}</h3>
              <div className="quiz-options" role="radiogroup" aria-label={p.pregunta}>
                {p.opciones.map((op, opIdx) => {
                  const esElegida = elegida === opIdx
                  const esCorrecta = det ? det.correcta === opIdx : false
                  const esError = det ? esElegida && !det.acerto : false
                  const clase = [
                    'quiz-option',
                    esElegida && !det ? 'selected' : '',
                    esCorrecta ? 'correct' : '',
                    esError ? 'wrong' : '',
                  ].filter(Boolean).join(' ')
                  return <button
                    key={opIdx}
                    type="button"
                    role="radio"
                    aria-checked={esElegida}
                    disabled={Boolean(resultado)}
                    className={clase}
                    onClick={() => seleccionar(p.tarjeta_id, opIdx)}
                  >
                    <span className="quiz-option-letter">{LETRAS[opIdx] ?? opIdx + 1}</span>
                    <span className="quiz-option-text">{op}</span>
                    {esCorrecta && <CheckCircle2 size={17} className="quiz-mark ok" />}
                    {esError && <XCircle size={17} className="quiz-mark err" />}
                  </button>
                })}
              </div>
            </div>
          })}
        </div>

        <div className="quiz-actions">
          {resultado ? (
            <button className="button primary" type="button" onClick={() => void cargarQuiz(cursoId)} disabled={cargando}>
              <RefreshCw size={16} /> Practicar otro quiz
            </button>
          ) : <>
            <button className="button secondary" type="button" onClick={() => void cargarQuiz(cursoId)} disabled={cargando || enviando}>
              <RefreshCw size={16} /> Cambiar preguntas
            </button>
            <button
              className="button primary"
              type="button"
              disabled={enviando || respondidas < totalPreguntas}
              onClick={() => void enviar()}
            >
              <Send size={16} /> {enviando ? 'Corrigiendo...' : respondidas < totalPreguntas ? `Responde todas (${respondidas}/${totalPreguntas})` : 'Enviar respuestas'}
            </button>
          </>}
        </div>
      </section>}
    </>}
  </>
}
