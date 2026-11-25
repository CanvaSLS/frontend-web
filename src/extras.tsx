import { useEffect, useState } from 'react'

const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* sin almacenamiento disponible */ }
}
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{sub}</p></div></div>
}

/* ---------- Práctica semanal (cajas de Leitner) ---------- */
const PK = 'canvasls-practice-v1'
const BASE: Record<string, number> = { 'Serverless y Lambda': 84, 'IAM y roles': 72, 'Multi-tenancy': 71, 'Eventos: SNS y SQS': 46, 'Observabilidad': 38 }
const P0 = { done: false, dom: BASE }
const DAYS = [1, 3, 7, 16, 35]
const CARDS: [string, string, string, string][] = [
  ['Serverless y Lambda', '¿Qué es un arranque en frío?', 'La primera invocación, que crea un entorno nuevo.', 'Las siguientes reutilizan el entorno y responden más rápido.'],
  ['IAM y roles', '¿Diferencia entre rol y política?', 'La política define permisos; el rol los asume quien lo usa.', 'Un rol no tiene credenciales fijas.'],
  ['Multi-tenancy', '¿Dónde nace el tenant_id?', 'En el token, nunca en el cliente.', 'El authorizer lo devuelve como context.'],
  ['Eventos: SNS y SQS', '¿Qué garantiza SQS estándar sobre la entrega?', 'Al menos una vez.', 'Por eso el consumidor debe ser idempotente.'],
  ['Eventos: SNS y SQS', '¿Para qué sirve una DLQ?', 'Guardar mensajes que fallaron varias veces.', 'Aquí: tras 3 recepciones y 14 días de retención.'],
  ['Eventos: SNS y SQS', '¿Qué hace una filter policy de SNS?', 'Entrega a cada cola solo sus eventos.', 'Sin filtrar en código.'],
  ['Observabilidad', '¿Qué hace ispresent() en Logs Insights?', 'Filtra los registros que tienen ese campo.', 'Útil con logs JSON estructurados.'],
  ['Serverless y Lambda', '¿Por qué se usa una URL prefirmada?', 'Para no pasar el archivo por el Lambda.', 'Solo se firman prefijos del tenant.'],
  ['Multi-tenancy', '¿Cómo se aísla un tenant en PostgreSQL?', 'Un schema por tenant (Patrón 2).', 'El search_path sale de una lista blanca.'],
  ['IAM y roles', '¿Qué pasa con un token vencido?', 'Responde 403: el TTL ya lo eliminó.', 'El authorizer igual compara la fecha.'],
]

export function PracticeView({ onDone }: { onDone: () => void }) {
  const [saved, setSaved] = useState(() => read(PK, P0))
  const [redo, setRedo] = useState(false)
  const [i, setI] = useState(0)
  const [show, setShow] = useState(false)
  const [box, setBox] = useState([2, 1, 3, 2, 4, 1, 2, 3, 1, 2])
  const [hits, setHits] = useState<Record<string, [number, number]>>({})
  const [ok, setOk] = useState(0)

  function answer(level: 0 | 1 | 2) {
    const b = box[i]
    const next = level === 2 ? Math.min(b + 1, 5) : level === 1 ? (b > 2 ? b - 1 : b) : 1
    const tema = CARDS[i][0]
    const h = hits[tema] ?? [0, 0]
    const nextHits = { ...hits, [tema]: [h[0] + (level === 2 ? 1 : 0), h[1] + 1] as [number, number] }
    setHits(nextHits)
    setBox(box.map((x, j) => (j === i ? next : x)))
    if (level === 2) setOk(ok + 1)
    setShow(false)
    setI(i + 1)
    if (i === CARDS.length - 1) {
      const dom = { ...saved.dom }
      for (const [t, [a, n]] of Object.entries(nextHits)) dom[t] = Math.round(0.7 * (dom[t] ?? 50) + 0.3 * (a / n) * 100)
      const done = { done: true, dom }
      setSaved(done); write(PK, done)
    }
  }

  if (i >= CARDS.length) return <><Head eyebrow="PRÁCTICA" title="¡Mazo completado! 🎉" sub="Gracias por repasar: así aprendes mejor y tu docente sabe qué reforzar." />
    <div className="content-card x-card"><b className="x-big">{ok} / {CARDS.length}</b><p>Dijiste «lo sé» en {ok} tarjetas. Tu dominio por tema ya se actualizó.</p><button className="button primary" onClick={onDone}>Ver cómo voy</button></div></>
  if (saved.done && !redo) return <><Head eyebrow="PRÁCTICA" title="Mazo de la semana" sub="Cierra el sábado 23:59." />
    <div className="content-card x-card"><b>Mazo completado ✅</b><p>Ya repasaste esta semana. ¡Buen trabajo!</p><div className="x-row"><button className="button primary" onClick={onDone}>Ver mi dominio</button><button className="button secondary" onClick={() => setRedo(true)}>Repetir mazo</button></div></div></>

  const [tema, q, a, why] = CARDS[i]
  const b = box[i]
  return <><Head eyebrow="PRÁCTICA" title="Mazo de la semana" sub="10 tarjetas · ≈ 4 minutos. Tu respuesta no cuenta para ninguna nota." />
    <div className="progress-track"><span style={{ width: `${i * 10}%` }} /></div><small className="muted">tarjeta {i + 1} de {CARDS.length}</small>
    <div className="content-card x-card"><div className="x-row"><span className="x-tag">{tema}</span><small>caja {b}</small></div><p className="x-q">{q}</p>
      {show ? <><p><b>{a}</b> {why}</p><div className="x-opts">
        <button className="x-opt no" onClick={() => answer(0)}>No lo sé<small>vuelve mañana</small></button>
        <button className="x-opt mid" onClick={() => answer(1)}>Me costó<small>sigue en caja {b > 2 ? b - 1 : b}</small></button>
        <button className="x-opt yes" onClick={() => answer(2)}>Lo sé<small>vuelve en {DAYS[Math.min(b, 5)] ?? 35} días</small></button></div></>
        : <button className="button primary" onClick={() => setShow(true)}>Mostrar respuesta</button>}</div></>
}

/* ---------- Dominio por tema ---------- */
const COURSE_ROWS: [string, number, string, number, string][] = [
  ['Eventos: SNS y SQS', 44, '21 / 38', -9, '¿Qué garantiza SQS sobre la entrega?'],
  ['Observabilidad', 49, '18 / 38', -4, '¿Qué hace ispresent()?'],
  ['Multi-tenancy', 63, '11 / 38', 6, '¿Dónde nace el tenant_id?'],
  ['IAM y roles', 72, '7 / 38', 3, 'Diferencia entre rol y política'],
  ['Serverless y Lambda', 81, '4 / 38', 0, '¿Qué es un arranque en frío?'],
]
const arrow = (d: number) => (d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '—')

export function MasteryView({ role }: { role: 'student' | 'teacher' }) {
  const dom = read(PK, P0).dom
  if (role === 'teacher') return <><Head eyebrow="SEGUIMIENTO" title="Dominio por tema" sub="Cloud Computing · si muchos alumnos fallan la misma tarjeta, el problema no es de los alumnos." />
    <div className="content-card x-scroll"><table className="x-table"><thead><tr><th>Tema</th><th>Dominio</th><th>Bajo 50 %</th><th>2 semanas</th><th>Tarjeta que más se falla</th></tr></thead>
      <tbody>{COURSE_ROWS.map(([t, p, low, d, card]) => <tr key={t}><td>{t}</td><td><span className={`x-heat ${p < 50 ? 'high' : p < 70 ? 'mid' : 'ok'}`}>{p} %</span></td><td>{low}</td><td>{arrow(d)}</td><td>«{card}»</td></tr>)}</tbody></table></div></>
  return <><Head eyebrow="SEGUIMIENTO" title="Cómo vas realmente" sub="Cloud Computing · tu dominio por tema, sin notas de por medio." />
    <div className="content-card x-card"><b>6 semanas seguidas 🔥</b><div className="x-streak">{[0, 1, 2, 3, 4, 5, 6].map((n) => <i key={n} className={n < 6 ? '' : 'off'} />)}</div><small>Si no abres el mazo, solo deja de sumar: no hay castigos.</small></div>
    <div className="content-card x-card">{Object.entries(dom).map(([t, p]) => { const d = p - (BASE[t] ?? p); return <div key={t} className="x-dom"><div className="x-row"><span>{t}</span><b>{p} % {arrow(d)}</b></div><div className="progress-track"><span style={{ width: `${p}%`, background: p < 50 ? '#d03c3c' : undefined }} /></div></div> })}</div></>
}

/* ---------- Diario de aprendizaje (con eliminar y deshacer) ---------- */
type Entry = { id: string; date: string; mood: number; hours: number; learned: string; doubt: string }
const DK = 'canvasls-diary-v1'
const MOODS = ['😢', '😕', '😐', '🙂', '😄']
const SEED: Entry[] = [
  { id: 's1', date: '5 nov', mood: 4, hours: 2.5, learned: 'Patrón fan-out con SNS y colas por consumidor.', doubt: '¿Cuántos reintentos conviene antes de la DLQ?' },
  { id: 's2', date: '3 nov', mood: 3, hours: 1.5, learned: 'Filter policies de SNS.', doubt: '—' },
]

export function DiaryView() {
  const [entries, setEntries] = useState<Entry[]>(() => read(DK, SEED))
  const [undo, setUndo] = useState<{ entry: Entry; index: number } | null>(null)
  const [mood, setMood] = useState(4)
  const [hours, setHours] = useState('2')
  const [learned, setLearned] = useState('')
  const [doubt, setDoubt] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => write(DK, entries), [entries])
  useEffect(() => { if (!undo) return; const t = window.setTimeout(() => setUndo(null), 6000); return () => window.clearTimeout(t) }, [undo])

  function save() {
    if (!learned.trim() && !doubt.trim()) { setMsg('Cuéntanos algo primero ✍️'); return }
    const date = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(new Date())
    setEntries([{ id: newId(), date, mood, hours: Number(hours) || 0, learned: learned.trim() || '—', doubt: doubt.trim() || '—' }, ...entries])
    setLearned(''); setDoubt(''); setMsg('Entrada guardada 💾')
  }
  function remove(index: number) { setUndo({ entry: entries[index], index }); setEntries(entries.filter((_, j) => j !== index)) }
  function restore() { if (!undo) return; const copy = entries.slice(); copy.splice(undo.index, 0, undo.entry); setEntries(copy); setUndo(null) }

  return <><Head eyebrow="BITÁCORA" title="Diario de aprendizaje" sub="Es privado: tu docente solo ve promedios, nunca el texto." />
    <div className="x-grid"><div className="content-card x-card"><h2>Nueva entrada</h2>
      <div className="x-moods" role="group" aria-label="Ánimo">{MOODS.map((m, n) => <button key={m} type="button" aria-pressed={mood === n + 1} className={mood === n + 1 ? 'on' : ''} onClick={() => setMood(n + 1)}>{m}</button>)}</div>
      <label className="field-label" htmlFor="d-h">Horas de estudio</label><input id="d-h" type="number" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
      <label className="field-label" htmlFor="d-l">¿Qué aprendiste hoy?</label><textarea id="d-l" rows={3} value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="Escríbelo con tus palabras ✍️" />
      <label className="field-label" htmlFor="d-d">Dudas abiertas</label><textarea id="d-d" rows={2} value={doubt} onChange={(e) => setDoubt(e.target.value)} placeholder="¿Qué te quedó sin entender? Aquí nadie te juzga 🙂" />
      <button className="button primary" onClick={save}>Guardar entrada</button>{msg && <small className="muted" role="status"> {msg}</small>}</div>
      <div>{entries.length ? entries.map((e, n) => <div key={e.id} className="content-card x-card"><div className="x-row"><b>{e.date} · {MOODS[e.mood - 1]} · {e.hours} h</b>
        <button className="button secondary" aria-label={`Eliminar entrada del ${e.date}`} onClick={() => remove(n)}>🗑️ Eliminar</button></div><p>{e.learned}</p><small className="muted">Duda: {e.doubt}</small></div>)
        : <div className="content-card x-card">Aún no tienes entradas. ¡Escribe la primera, aunque sea cortita! 🌱</div>}</div></div>
    {undo && <div className="toast" role="status">Entrada eliminada <button className="x-undo" onClick={restore}>Deshacer</button></div>}</>
}

/* ---------- Semáforo de la semana (para el panel) ---------- */
export function WeekPulse({ pending, onPractice }: { pending: number; onPractice: () => void }) {
  const done = read(PK, P0).done
  const score = pending * 10 + (done ? 0 : 12)
  const [key, label, msg] = score >= 50 ? ['high', 'Rojo', 'Vamos paso a paso: empieza por lo más urgente 🤝'] : score >= 25 ? ['mid', 'Ámbar', 'Vas bien: solo hay un par de cosas por ajustar 💪'] : ['ok', 'Verde', '¡Vas genial! Sigue así 🎉']
  return <div className="content-card x-pulse"><div><b className="x-big">{score}</b><small>Riesgo</small></div><span className={`x-pill ${key}`}>{label}</span>
    <div className="x-grow"><strong>{msg}</strong><small>{pending} tareas pendientes · {done ? 'mazo semanal completado' : 'mazo semanal sin abrir'}</small></div>
    {!done && <button className="button primary" onClick={onPractice}>Empezar mazo (≈ 4 min)</button>}</div>
}
