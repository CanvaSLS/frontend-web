import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Bell, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleHelp, ClipboardList, CloudUpload, FileText, GraduationCap, Home,
  Inbox, Layers, LayoutDashboard, LogOut, Menu, MoreHorizontal, Pencil, Plus, RefreshCw, Search, ShieldAlert,
  Trash2, TriangleAlert, Users, X,
} from 'lucide-react'
import {
  formatDate, formatDateLong,
  type Assignment, type Course, type CourseModule, type CourseTab, type Notice,
  type Role, type Section, type Submission,
} from './data'
import { Login } from './live/Login'
import { Practica } from './views/Practica'
import { Riesgo, TarjetaRiesgoAlumno } from './views/Riesgo'
import { agregarMaterial, alCaducarSesion, crearCurso, descargarMaterial, eliminarCurso, guardarSesion, leerSesion, logout, matriculas, modificarCurso, publicarModulo, subirASS3 } from './live/api'
import { nombreTenant } from './live/config'
import { aRole } from './live/adapt'
import { useAcademia } from './live/useAcademia'
import type { Matricula, Sesion } from './live/types'

type Icon = typeof Home
type NavigationItem = { id: Section; label: string; icon: Icon; role?: Role }

const navigation: NavigationItem[] = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { id: 'courses', label: 'Cursos', icon: BookOpen },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'inbox', label: 'Bandeja', icon: Inbox },
  { id: 'grades', label: 'Calificaciones', icon: GraduationCap },
  { id: 'practica', label: 'Práctica', icon: Layers, role: 'student' },
  { id: 'riesgo', label: 'Riesgo', icon: ShieldAlert, role: 'teacher' },
]

const courseTabs: { id: CourseTab; label: string; icon: Icon }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'modules', label: 'Módulos', icon: BookOpen },
  { id: 'assignments', label: 'Tareas', icon: ClipboardList },
  { id: 'grades', label: 'Calificaciones', icon: GraduationCap },
  { id: 'people', label: 'Personas', icon: Users },
]

function IconBadge({ icon: IconComponent, tone = 'blue' }: { icon: Icon; tone?: 'blue' | 'green' | 'orange' | 'purple' }) {
  return <span className={`icon-badge ${tone}`}><IconComponent size={20} strokeWidth={1.8} /></span>
}

function EmptyState({ icon: IconComponent, title, detail }: { icon: Icon; title: string; detail: string }) {
  return <div className="empty-state"><IconComponent size={30} strokeWidth={1.5} /><strong>{title}</strong><span>{detail}</span></div>
}

function Button({ children, onClick, secondary = false, danger = false, type = 'button', disabled = false }: {
  children: ReactNode; onClick?: () => void; secondary?: boolean; danger?: boolean; type?: 'button' | 'submit'; disabled?: boolean
}) {
  const clase = danger ? 'button danger' : secondary ? 'button secondary' : 'button primary'
  return <button className={clase} type={type} onClick={onClick} disabled={disabled}>{children}</button>
}

/**
 * Puerta de entrada. Sin sesión válida solo existe el login: el tenant y el rol
 * salen del token, nunca de un selector de la interfaz.
 */
export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)

  useEffect(() => {
    alCaducarSesion(() => setSesion(null)) // un 401 devuelve al login
    return () => alCaducarSesion(null)
  }, [])

  function entrar(s: Sesion) {
    guardarSesion(s)
    setSesion(s)
  }

  async function salir() {
    try { await logout() } catch { /* la sesión local se cierra igual si el servidor falla */ }
    finally { guardarSesion(null); setSesion(null) }
  }

  if (!sesion) return <Login onEntrar={entrar} />
  // La `key` reinicia la navegación al cambiar de usuario o institución.
  return <Academia key={sesion.token} sesion={sesion} onSalir={salir} />
}

function Academia({ sesion, onSalir }: { sesion: Sesion; onSalir: () => void }) {
  const role = aRole(sesion.usuario.rol)
  const tenantId = sesion.usuario.tenant_id
  const studentId = sesion.usuario.user_id
  const userName = sesion.usuario.nombre

  const datos = useAcademia(sesion)

  const [section, setSection] = useState<Section>('dashboard')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [courseTab, setCourseTab] = useState<CourseTab>('home')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [selectedModuleItemId, setSelectedModuleItemId] = useState<string | null>(null)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [showEditCourse, setShowEditCourse] = useState(false)
  const [showDeleteCourse, setShowDeleteCourse] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')

  // El backend ya devuelve solo lo del tenant del token: no se filtra en el cliente.
  const tenantCourses = datos.courses
  const tenantAssignments = datos.assignments
  const tenantNotices = datos.notices
  const selectedCourse = tenantCourses.find((course) => course.id === selectedCourseId) ?? null
  const selectedAssignment = tenantAssignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null
  const unreadCount = datos.noLeidas || tenantNotices.filter((notice) => !notice.read).length
  const courseModules = selectedCourse ? datos.modulesByCourse[selectedCourse.id] ?? [] : []

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Módulos y tareas del curso se piden bajo demanda al abrirlo.
  const { cargarModulos, cargarTareasCurso, cargarEntregasTarea, cargarEntregasCurso } = datos
  useEffect(() => {
    if (!selectedCourseId) return
    cargarModulos(selectedCourseId)
    cargarTareasCurso(selectedCourseId)
  }, [selectedCourseId, cargarModulos, cargarTareasCurso])

  // Para docente/admin, las entregas se cargan bajo demanda al abrir una tarea o las pestañas de tareas/notas.
  useEffect(() => {
    if (role !== 'teacher') return
    if (selectedAssignment) {
      cargarEntregasTarea(selectedAssignment.courseId, selectedAssignment.id)
    } else if (selectedCourseId && (courseTab === 'assignments' || courseTab === 'grades')) {
      cargarEntregasCurso(selectedCourseId)
    }
  }, [role, selectedCourseId, courseTab, selectedAssignment, tenantAssignments.length, cargarEntregasTarea, cargarEntregasCurso])

  /** Recarga únicamente los módulos del curso abierto tras publicar o subir material. */
  function recargarModulos() {
    if (selectedCourseId) datos.recargarModulosCurso(selectedCourseId)
  }

  /** Envuelve una mutación para mostrar el error de la API en lugar de perderlo. */
  async function ejecutar(accion: () => Promise<void>, exito: string) {
    try {
      await accion()
      setToast(exito)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'La operación falló')
    }
  }

  function navigate(nextSection: Section) {
    setSection(nextSection)
    setSelectedCourseId(null)
    setSelectedAssignmentId(null)
    setSelectedModuleItemId(null)
    setMobileMenuOpen(false)
  }

  function openCourse(id: string, tab: CourseTab = 'home') {
    if (!tenantCourses.some((course) => course.id === id)) return
    setSelectedCourseId(id)
    setCourseTab(tab)
    setSelectedAssignmentId(null)
    setSelectedModuleItemId(null)
    setMobileMenuOpen(false)
  }

  function openAssignment(assignment: Assignment) {
    if (assignment.tenantId !== tenantId) return
    openCourse(assignment.courseId, 'assignments')
    setSelectedAssignmentId(assignment.id)
  }

  function addAssignment(input: { title: string; description: string; dueAt: string; points: number }) {
    if (!selectedCourse || role !== 'teacher') return
    setShowCreateAssignment(false)
    void ejecutar(
      () => datos.crearTarea(selectedCourse.id, input),
      `Tarea publicada en ${selectedCourse.name}`,
    )
  }

  function submitAssignment(assignment: Assignment, text: string, fileName?: string) {
    if (role !== 'student' || (!text.trim() && !fileName)) return
    void ejecutar(
      () => datos.entregar(assignment.courseId, assignment.id, text.trim(), fileName),
      'Entrega registrada · se publicó el evento EntregaRegistrada',
    )
  }

  function gradeSubmission(submission: Submission, assignment: Assignment, grade: number, feedback: string) {
    if (role !== 'teacher' || grade < 0 || grade > assignment.points) return
    void ejecutar(
      () => datos.calificar(assignment.courseId, assignment.id, submission.studentId, grade, feedback),
      'Nota publicada · analítica recalculará el riesgo del alumno',
    )
  }

  function markAllRead() {
    void ejecutar(() => datos.marcarTodasLeidas(), 'Avisos marcados como leídos')
  }

  function markRead(id: string) {
    void ejecutar(() => datos.marcarLeida(id), 'Aviso marcado como leído')
  }

  /** Cambia código, nombre y descripción del curso abierto y refresca la lista. */
  function editarCursoAbierto(cambios: { codigo: string; nombre: string; descripcion: string }) {
    if (!selectedCourse || role !== 'teacher') return
    const curso = selectedCourse
    setShowEditCourse(false)
    void ejecutar(async () => {
      await modificarCurso(curso.id, cambios)
      datos.recargar()
    }, `Curso ${curso.code} actualizado`)
  }

  /** Borra el curso abierto (y sus módulos y matrículas) y vuelve al panel. */
  function borrarCursoAbierto() {
    if (!selectedCourse || role !== 'teacher') return
    const curso = selectedCourse
    setShowDeleteCourse(false)
    void ejecutar(async () => {
      await eliminarCurso(curso.id)
      datos.recargar()
      navigate('dashboard')
    }, `Curso ${curso.code} eliminado`)
  }

  const breadcrumbs = selectedCourse
    ? selectedAssignment ? [selectedCourse.name, 'Tareas', selectedAssignment.title]
      : selectedModuleItemId ? [selectedCourse.name, 'Módulos', 'Contenido']
        : [selectedCourse.name, courseTabs.find((tab) => tab.id === courseTab)?.label ?? 'Inicio']
    : [navigation.find((item) => item.id === section)?.label ?? 'Panel']

  return <div className="app-shell">
    <aside className={`global-nav ${mobileMenuOpen ? 'open' : ''}`} aria-label="Navegación global">
      <div className="brand" onClick={() => navigate('dashboard')} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') navigate('dashboard') }}>
        <div className="brand-mark">C<span>S</span></div>
        <div className="brand-name">Canva<span>SLS</span></div>
      </div>
      <div className="global-nav-items">
        {navigation.filter((item) => !item.role || item.role === role).map(({ id, label, icon: IconComponent }) => <button key={id} className={`global-nav-item ${!selectedCourse && section === id ? 'active' : ''}`} onClick={() => navigate(id)}>
          <span className="nav-icon-wrap"><IconComponent size={22} strokeWidth={1.8} />{id === 'inbox' && unreadCount > 0 && <i className="nav-dot" />}</span>
          <span>{label}</span>
        </button>)}
      </div>
      <div className="global-nav-bottom">
        <button className="global-nav-item" onClick={() => { datos.recargar(); setToast('Recargando desde las APIs…') }}><RefreshCw size={22} strokeWidth={1.8} /><span>Recargar</span></button>
        <button className="global-nav-item" onClick={() => setToast(`Conectado a AWS como ${sesion.usuario.email ?? userName}`)}><CircleHelp size={22} strokeWidth={1.8} /><span>Ayuda</span></button>
        <button className="global-nav-item" onClick={onSalir}><LogOut size={22} strokeWidth={1.8} /><span>Salir</span></button>
      </div>
    </aside>

    <div className="app-body">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Abrir menú"><Menu size={22} /></button>
        <div className="breadcrumbs"><button onClick={() => navigate('dashboard')}>Inicio</button>{breadcrumbs.map((crumb, index) => <span key={`${crumb}-${index}`}><ChevronRight size={15} /><b>{crumb}</b></span>)}</div>
        <div className="topbar-actions">
          <div className="search-box"><Search size={17} /><input aria-label="Buscar cursos" placeholder="Buscar cursos..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <button className="icon-button notification-button" aria-label="Ver notificaciones" onClick={() => navigate('inbox')}><Bell size={20} />{unreadCount > 0 && <i />}</button>
          <div className="avatar" title={userName}>{userName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
        </div>
      </header>

      <div className="context-bar">
        <div className="tenant-context"><span className="context-label">INSTITUCIÓN</span><strong className="context-value">{nombreTenant(tenantId)} · {tenantId}</strong></div>
        <div className="context-divider" />
        <div className="role-context"><span className="context-label">SESIÓN</span><strong className="context-value">{sesion.usuario.nombre} · {sesion.usuario.rol}</strong></div>
        <span className="live-pill" title="El tenant y el rol provienen del token, no de la interfaz">Datos reales de AWS</span>
      </div>

      {datos.cargando && <div className="load-bar" role="status">Cargando desde los microservicios…</div>}
      {datos.error && <div className="load-bar error" role="alert">
        <TriangleAlert size={17} /> {datos.error}
        <button className="button secondary" onClick={datos.recargar}>Reintentar</button>
      </div>}

      {selectedCourse ? <div className="course-layout">
        <aside className="course-sidebar">
          <button className="back-link" onClick={() => navigate('dashboard')}><ChevronLeft size={16} /> Volver al panel</button>
          <div className="course-sidebar-heading"><span>{selectedCourse.code}</span><strong>{selectedCourse.name}</strong>{role === 'teacher' && <>
            <Button secondary onClick={() => setShowEditCourse(true)}><Pencil size={16} /> Editar curso</Button>
            <Button danger onClick={() => setShowDeleteCourse(true)}><Trash2 size={16} /> Eliminar curso</Button>
          </>}</div>
          <nav aria-label="Navegación del curso">{courseTabs.map(({ id, label, icon: IconComponent }) => <button key={id} className={courseTab === id ? 'selected' : ''} onClick={() => { setCourseTab(id); setSelectedAssignmentId(null); setSelectedModuleItemId(null) }}><IconComponent size={17} />{label}</button>)}</nav>
        </aside>
        <main className="main-content course-content">
          {selectedAssignment ? <AssignmentDetail assignment={selectedAssignment} course={selectedCourse} role={role} studentId={studentId} submissions={datos.submissions.filter((item) => item.assignmentId === selectedAssignment.id)} cargandoEntregas={datos.cargandoEntregas} onBack={() => setSelectedAssignmentId(null)} onSubmit={submitAssignment} onGrade={gradeSubmission} />
            : selectedModuleItemId ? <ModuleDetail itemId={selectedModuleItemId} course={selectedCourse} courseModules={courseModules} onBack={() => setSelectedModuleItemId(null)} />
              : <CourseContent course={selectedCourse} tab={courseTab} role={role} assignments={tenantAssignments.filter((item) => item.courseId === selectedCourse.id)} submissions={datos.submissions} courseModules={courseModules} studentId={studentId} onOpenAssignment={openAssignment} onOpenModuleItem={setSelectedModuleItemId} onCreateAssignment={() => setShowCreateAssignment(true)} onNotify={setToast} onReloadModulos={recargarModulos} />}
        </main>
      </div> : <main className="main-content root-content">
        {section === 'dashboard' && <Dashboard tenant={tenantId} role={role} userName={userName} courseList={tenantCourses.filter((course) => `${course.name} ${course.code}`.toLowerCase().includes(search.toLowerCase()))} assignments={tenantAssignments} notices={tenantNotices} submissions={datos.submissions} studentId={studentId} onCourse={openCourse} onAssignment={openAssignment} onNavigate={navigate} />}
        {section === 'courses' && <CoursesView courseList={tenantCourses.filter((course) => `${course.name} ${course.code}`.toLowerCase().includes(search.toLowerCase()))} role={role} onCourse={openCourse} onNotify={setToast} onReload={datos.recargar} />}
        {section === 'calendar' && <CalendarView assignments={tenantAssignments} courseList={tenantCourses} onAssignment={openAssignment} />}
        {section === 'inbox' && <InboxView notices={tenantNotices} onMarkAllRead={markAllRead} onRead={markRead} />}
        {section === 'grades' && <GradesView role={role} assignments={tenantAssignments} submissions={datos.submissions} courseList={tenantCourses} studentId={studentId} onAssignment={openAssignment} />}
        {section === 'practica' && <Practica courses={tenantCourses} onNotify={setToast} />}
        {section === 'riesgo' && <Riesgo />}
      </main>}
    </div>

    {showCreateAssignment && selectedCourse && <CreateAssignmentModal course={selectedCourse} onClose={() => setShowCreateAssignment(false)} onCreate={addAssignment} />}
    {showEditCourse && selectedCourse && <EditCourseModal course={selectedCourse} onClose={() => setShowEditCourse(false)} onSave={editarCursoAbierto} />}
    {showDeleteCourse && selectedCourse && <DeleteCourseModal course={selectedCourse} onClose={() => setShowDeleteCourse(false)} onConfirm={borrarCursoAbierto} />}
    {toast && <div className="toast"><Check size={17} />{toast}</div>}
    {mobileMenuOpen && <button className="mobile-scrim" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)} />}
  </div>
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>
}

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  return <button className="course-card" onClick={onClick}>
    <div className="course-card-art" style={{ '--course-color': course.color } as React.CSSProperties}><span className="course-art-ring one" /><span className="course-art-ring two" /><span className="course-code-badge">{course.code}</span></div>
    <div className="course-card-body"><div className="course-card-title-row"><strong>{course.name}</strong><MoreHorizontal size={19} /></div><span className="muted">{course.professor}</span><div className="course-card-meta"><span>{course.term}</span><span>{course.progress}% completado</span></div><div className="progress-track"><span style={{ width: `${course.progress}%`, backgroundColor: course.color }} /></div></div>
  </button>
}

function Dashboard({ tenant, role, userName, courseList, assignments, notices, submissions, studentId, onCourse, onAssignment, onNavigate }: {
  tenant: string; role: Role; userName: string; courseList: Course[]; assignments: Assignment[]; notices: Notice[]; submissions: Submission[]; studentId: string;
  onCourse: (id: string, tab?: CourseTab) => void; onAssignment: (assignment: Assignment) => void; onNavigate: (section: Section) => void
}) {
  const pending = assignments.filter((assignment) => !submissions.some((submission) => submission.assignmentId === assignment.id && submission.studentId === studentId))
  const graded = submissions.filter((submission) => submission.studentId === studentId && submission.grade !== undefined).length
  return <>
    <PageHeading eyebrow={`ESPACIO ACADÉMICO · ${tenant}`} title={`Hola, ${userName.split(' ')[0]} 👋`} subtitle={role === 'student' ? 'Aquí tienes un resumen de tus cursos y próximas actividades.' : 'Administra tus cursos y revisa la actividad de tus estudiantes.'} />
    <div className="dashboard-grid">
      <div className="dashboard-main">
        {role === 'student' && <TarjetaRiesgoAlumno studentId={studentId} />}
        <section className="summary-grid">
          <div className="summary-card"><IconBadge icon={BookOpen} tone="blue" /><div><strong>{courseList.length}</strong><span>Cursos activos</span></div></div>
          <div className="summary-card"><IconBadge icon={ClipboardList} tone="orange" /><div><strong>{role === 'student' ? pending.length : assignments.length}</strong><span>{role === 'student' ? 'Tareas pendientes' : 'Tareas publicadas'}</span></div></div>
          <div className="summary-card"><IconBadge icon={role === 'student' ? GraduationCap : Users} tone="green" /><div><strong>{role === 'student' ? graded : courseList.reduce((sum, course) => sum + course.students, 0)}</strong><span>{role === 'student' ? 'Notas disponibles' : 'Estudiantes'}</span></div></div>
        </section>
        <section className="section-block"><div className="section-heading"><div><h2>Mis cursos</h2><p>Continúa donde te quedaste</p></div><button className="text-link" onClick={() => onNavigate('courses')}>Ver todos <ChevronRight size={16} /></button></div><div className="course-grid">{courseList.length ? courseList.map((course) => <CourseCard key={course.id} course={course} onClick={() => onCourse(course.id)} />) : <EmptyState icon={BookOpen} title="Sin cursos" detail="No hay cursos que coincidan con tu búsqueda." />}</div></section>
        <section className="section-block"><div className="section-heading"><div><h2>Próximas tareas</h2><p>Actividades de tus cursos</p></div><button className="text-link" onClick={() => onNavigate('calendar')}>Ver calendario <ChevronRight size={16} /></button></div><div className="panel-list">{assignments.length ? assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 4).map((assignment) => { const course = courseList.find((item) => item.id === assignment.courseId); const submitted = submissions.some((item) => item.assignmentId === assignment.id && item.studentId === studentId); return <button key={assignment.id} className="assignment-row" onClick={() => onAssignment(assignment)}><span className="date-tile"><b>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { day: '2-digit', timeZone: 'America/Lima' })}</b><small>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { month: 'short', timeZone: 'America/Lima' })}</small></span><span className="assignment-row-main"><strong>{assignment.title}</strong><small>{course?.name ?? assignment.courseId} · {assignment.points} puntos</small></span><span className={`status-pill ${submitted ? 'success' : ''}`}>{submitted ? 'Entregada' : role === 'student' ? 'Pendiente' : 'Publicada'}</span><ChevronRight size={18} className="row-chevron" /></button> }) : <EmptyState icon={ClipboardList} title="Sin tareas" detail="Las tareas publicadas aparecerán aquí." />}</div></section>
      </div>
      <aside className="dashboard-aside"><div className="aside-panel"><div className="aside-heading"><span className="aside-icon"><CalendarDays size={18} /></span><h3>Para esta semana</h3></div><p className="aside-description">Mantente al día con lo que viene.</p>{assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 3).map((assignment) => <button className="aside-task" key={assignment.id} onClick={() => onAssignment(assignment)}><span className="aside-task-dot" /><span><strong>{assignment.title}</strong><small>Entrega: {formatDate(assignment.dueAt)}</small></span></button>)}{assignments.length === 0 && <span className="muted">No hay tareas próximas.</span>}</div><div className="aside-panel"><div className="aside-heading"><span className="aside-icon purple"><Bell size={18} /></span><h3>Actividad reciente</h3></div>{notices.slice(0, 3).map((notice) => <div className="activity-item" key={notice.id}><span className="activity-dot" /><div><strong>{notice.title}</strong><p>{notice.body}</p></div></div>)}{notices.length === 0 && <span className="muted">No hay actividad reciente.</span>}<button className="text-link aside-link" onClick={() => onNavigate('inbox')}>Ver bandeja <ChevronRight size={16} /></button></div></aside>
    </div>
  </>
}

function CoursesView({ courseList, role, onCourse, onNotify, onReload }: {
  courseList: Course[]; role: Role; onCourse: (id: string) => void
  onNotify: (mensaje: string) => void; onReload: () => void
}) {
  const [showCreate, setShowCreate] = useState(false)
  return <>
    <PageHeading eyebrow="APRENDIZAJE" title="Mis cursos" subtitle="Explora los cursos de tu institución." action={role === 'teacher' && <Button onClick={() => setShowCreate(true)}><Plus size={17} /> Nuevo curso</Button>} />
    <div className="course-grid all-courses">{courseList.map((course) => <CourseCard key={course.id} course={course} onClick={() => onCourse(course.id)} />)}{courseList.length === 0 && <EmptyState icon={BookOpen} title="Sin cursos" detail="No hay cursos que coincidan con tu búsqueda." />}</div>
    {showCreate && <CreateCourseModal onClose={() => setShowCreate(false)} onNotify={onNotify} onReload={onReload} />}
  </>
}

function CreateCourseModal({ onClose, onNotify, onReload }: {
  onClose: () => void; onNotify: (mensaje: string) => void; onReload: () => void
}) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!codigo.trim() || !nombre.trim()) return
    try {
      await crearCurso({ codigo: codigo.trim(), nombre: nombre.trim(), descripcion: descripcion.trim() || undefined })
      onClose()
      onNotify(`Curso ${codigo.trim()} creado`)
      onReload()
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'No se pudo crear el curso')
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-curso" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">NUEVO</span><h2 id="modal-curso">Nuevo curso</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div><form onSubmit={submit}><label className="field-label" htmlFor="curso-codigo">Código</label><input id="curso-codigo" required maxLength={20} value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="Ej. CC301" /><label className="field-label" htmlFor="curso-nombre">Nombre</label><input id="curso-nombre" required maxLength={160} value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Cloud Computing" /><label className="field-label" htmlFor="curso-desc">Descripción</label><textarea id="curso-desc" rows={3} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Breve descripción del curso..." /><div className="modal-actions"><Button secondary onClick={onClose}>Cancelar</Button><Button type="submit">Crear curso</Button></div></form></div></div>
}

function EditCourseModal({ course, onClose, onSave }: {
  course: Course; onClose: () => void
  onSave: (cambios: { codigo: string; nombre: string; descripcion: string }) => void
}) {
  const [codigo, setCodigo] = useState(course.code)
  const [nombre, setNombre] = useState(course.name)
  const [descripcion, setDescripcion] = useState(course.description ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!codigo.trim() || !nombre.trim()) return
    onSave({ codigo: codigo.trim(), nombre: nombre.trim(), descripcion: descripcion.trim() })
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-editar-curso" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">EDITAR</span><h2 id="modal-editar-curso">Editar curso</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div><form onSubmit={submit}><label className="field-label" htmlFor="editar-codigo">Código</label><input id="editar-codigo" required maxLength={20} value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="Ej. CC301" /><label className="field-label" htmlFor="editar-nombre">Nombre</label><input id="editar-nombre" required maxLength={160} value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Cloud Computing" /><label className="field-label" htmlFor="editar-desc">Descripción</label><textarea id="editar-desc" rows={3} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Breve descripción del curso..." /><div className="modal-actions"><Button secondary onClick={onClose}>Cancelar</Button><Button type="submit">Guardar cambios</Button></div></form></div></div>
}

function DeleteCourseModal({ course, onClose, onConfirm }: {
  course: Course; onClose: () => void; onConfirm: () => void
}) {
  const [confirmacion, setConfirmacion] = useState('')
  const habilitado = confirmacion.trim() === course.code

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!habilitado) return
    onConfirm()
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-borrar-curso" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">ELIMINAR</span><h2 id="modal-borrar-curso">Eliminar curso</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div><form onSubmit={submit}><p>Se eliminará el curso <strong>{course.name}</strong>. También se borran sus módulos y matrículas, y la acción no se puede deshacer.</p><label className="field-label" htmlFor="borrar-codigo">Escribe <strong>{course.code}</strong> para confirmar</label><input id="borrar-codigo" value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} placeholder={course.code} autoComplete="off" /><div className="modal-actions"><Button secondary onClick={onClose}>Cancelar</Button><Button danger type="submit" disabled={!habilitado}><Trash2 size={16} /> Eliminar curso</Button></div></form></div></div>
}

function CourseContent({ course, tab, role, assignments, submissions, courseModules, studentId, onOpenAssignment, onOpenModuleItem, onCreateAssignment, onNotify, onReloadModulos }: {
  course: Course; tab: CourseTab; role: Role; assignments: Assignment[]; submissions: Submission[];
  courseModules: CourseModule[]; studentId: string;
  onOpenAssignment: (assignment: Assignment) => void; onOpenModuleItem: (id: string) => void; onCreateAssignment: () => void
  onNotify: (mensaje: string) => void; onReloadModulos: () => void
}) {
  if (tab === 'home') return <><PageHeading eyebrow={`${course.code} · ${course.term}`} title={course.name} subtitle={`Profesor: ${course.professor}`} /><div className="course-hero" style={{ '--course-color': course.color } as React.CSSProperties}><div><span>BIENVENIDO AL CURSO</span><h2>{course.name}</h2><p>Encuentra aquí tus módulos, tareas y calificaciones.</p></div><BookOpen size={112} strokeWidth={0.8} /></div><div className="course-home-grid"><div className="content-card"><div className="section-heading compact"><div><h2>Contenido del curso</h2><p>Materiales y recursos</p></div></div>{courseModules.length ? courseModules.map((module) => <div className="mini-module" key={module.id}><IconBadge icon={BookOpen} /><div><strong>{module.title}</strong><small>{module.items.length} elementos</small></div></div>) : <EmptyState icon={BookOpen} title="Contenido en preparación" detail="Pronto aparecerán los módulos del curso." />}</div><div className="content-card"><div className="section-heading compact"><div><h2>Próximas entregas</h2><p>Actividades pendientes</p></div></div>{assignments.length ? assignments.slice(0, 3).map((assignment) => <button className="compact-task" key={assignment.id} onClick={() => onOpenAssignment(assignment)}><FileText size={18} /><span><strong>{assignment.title}</strong><small>Hasta el {formatDate(assignment.dueAt)}</small></span><ChevronRight size={16} /></button>) : <EmptyState icon={ClipboardList} title="Sin tareas" detail="Todavía no hay tareas publicadas." />}</div></div></>
  if (tab === 'modules') return <ModulesTab course={course} role={role} courseModules={courseModules} onOpenModuleItem={onOpenModuleItem} onNotify={onNotify} onReloadModulos={onReloadModulos} />
  if (tab === 'assignments') return <><PageHeading eyebrow={course.code} title="Tareas" subtitle={role === 'teacher' ? 'Publica y revisa las actividades del curso.' : 'Consulta las consignas y entrega tu trabajo.'} action={role === 'teacher' && <Button onClick={onCreateAssignment}><Plus size={17} /> Nueva tarea</Button>} /><div className="content-card task-list">{assignments.length ? assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt)).map((assignment) => { const submission = submissions.find((item) => item.assignmentId === assignment.id && item.studentId === studentId); return <button className="task-list-row" key={assignment.id} onClick={() => onOpenAssignment(assignment)}><IconBadge icon={ClipboardList} tone="orange" /><span className="task-list-main"><strong>{assignment.title}</strong><small>Vence el {formatDateLong(assignment.dueAt)} · {assignment.points} puntos</small></span><span className={`status-pill ${submission ? 'success' : ''}`}>{role === 'teacher' ? `${submissions.filter((item) => item.assignmentId === assignment.id).length} entregas` : submission ? 'Entregada' : 'Pendiente'}</span><ChevronRight size={18} /></button> }) : <EmptyState icon={ClipboardList} title="Sin tareas" detail="Las tareas del curso aparecerán aquí." />}</div></>
  if (tab === 'grades') return <><PageHeading eyebrow={course.code} title="Calificaciones" subtitle={role === 'teacher' ? 'Revisa las calificaciones de este curso.' : 'Consulta tus resultados.'} /><GradeTable assignments={assignments} submissions={submissions} courseList={[course]} role={role} studentId={studentId} onAssignment={onOpenAssignment} /></>
  return <PeopleTab course={course} role={role} submissions={submissions} />
}

/**
 * Pestaña "Módulos". El docente publica módulos y sube materiales a S3; cualquier
 * usuario puede abrir el detalle y descargar un archivo.
 */
function ModulesTab({ course, role, courseModules, onOpenModuleItem, onNotify, onReloadModulos }: {
  course: Course; role: Role; courseModules: CourseModule[]; onOpenModuleItem: (id: string) => void
  onNotify: (mensaje: string) => void; onReloadModulos: () => void
}) {
  const [showPublish, setShowPublish] = useState(false)
  const [subiendo, setSubiendo] = useState<string | null>(null)

  async function subirMaterial(moduloId: string, file: File) {
    setSubiendo(moduloId)
    try {
      const r = await agregarMaterial(course.id, moduloId, file.name, file.type || 'application/octet-stream')
      await subirASS3(r.upload_url, file)
      onNotify('Material agregado · se subió el archivo a S3')
      onReloadModulos()
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'No se pudo subir el material')
    } finally {
      setSubiendo(null)
    }
  }

  async function publicar(titulo: string, descripcion: string) {
    try {
      await publicarModulo(course.id, titulo, descripcion)
      setShowPublish(false)
      onNotify('Módulo publicado · evento ModuloPublicado emitido')
      onReloadModulos()
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'No se pudo publicar el módulo')
    }
  }

  return <>
    <PageHeading eyebrow={course.code} title="Módulos" subtitle="Material de aprendizaje organizado por temas." action={role === 'teacher' && <Button onClick={() => setShowPublish(true)}><Plus size={17} /> Publicar módulo</Button>} />
    {courseModules.length ? courseModules.map((module, index) => <div className="module-panel" key={module.id}>
      <div className="module-header"><span className="module-number">{String(index + 1).padStart(2, '0')}</span><h2>{module.title}</h2><span className="muted">{module.items.length} elementos</span></div>
      {module.items.map((item) => <button className="module-item" key={item.id} onClick={() => onOpenModuleItem(item.id)}><span className={`module-item-icon ${item.type}`}><FileText size={17} /></span><span>{item.title}</span><ChevronRight size={17} /></button>)}
      {role === 'teacher' && <label className="module-item" style={{ cursor: 'pointer' }}><span className="module-item-icon file"><CloudUpload size={17} /></span><span>{subiendo === module.id ? 'Subiendo material...' : 'Agregar material'}</span><input type="file" hidden disabled={subiendo === module.id} onChange={(event) => { const file = event.target.files?.[0]; if (file) void subirMaterial(module.id, file); event.target.value = '' }} /></label>}
    </div>) : <EmptyState icon={BookOpen} title="Sin módulos" detail="El contenido de este curso aún está en preparación." />}
    {showPublish && <PublishModuleModal course={course} onClose={() => setShowPublish(false)} onPublish={publicar} />}
  </>
}

function PublishModuleModal({ course, onClose, onPublish }: { course: Course; onClose: () => void; onPublish: (titulo: string, descripcion: string) => void }) {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!titulo.trim()) return
    onPublish(titulo.trim(), descripcion.trim())
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-modulo" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{course.code}</span><h2 id="modal-modulo">Publicar módulo</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div><form onSubmit={submit}><label className="field-label" htmlFor="mod-titulo">Título</label><input id="mod-titulo" required maxLength={120} value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ej. Unidad 3: colas y eventos" /><label className="field-label" htmlFor="mod-desc">Descripción</label><textarea id="mod-desc" rows={4} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Describe el contenido del módulo..." /><div className="modal-actions"><Button secondary onClick={onClose}>Cancelar</Button><Button type="submit">Publicar módulo</Button></div></form></div></div>
}

/**
 * Pestaña "Personas". El docente ve las matrículas reales de ms-cursos (paginadas
 * por cursor); el alumno ve los compañeros que ya entregaron alguna tarea.
 */
function PeopleTab({ course, role, submissions }: { course: Course; role: Role; submissions: Submission[] }) {
  const [lista, setLista] = useState<Matricula[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [cargandoMas, setCargandoMas] = useState(false)

  useEffect(() => {
    if (role !== 'teacher') return
    let vigente = true
    setCargando(true)
    setError('')
    setLista([])
    setCursor(null)
    matriculas(course.id, 50)
      .then((r) => { if (vigente) { setLista(r.matriculas); setCursor(r.cursor) } })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar las matrículas') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [course.id, role])

  function cargarMas() {
    if (!cursor) return
    setCargandoMas(true)
    matriculas(course.id, 50, cursor)
      .then((r) => { setLista((prev) => [...prev, ...r.matriculas]); setCursor(r.cursor) })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las matrículas'))
      .finally(() => setCargandoMas(false))
  }

  if (role !== 'teacher') {
    const alumnos = Array.from(new Map(submissions.map((s) => [s.studentId, s.studentName])).entries())
    return <><PageHeading eyebrow={course.code} title="Personas" subtitle="Participantes del curso." /><div className="content-card people-card"><IconBadge icon={Users} tone="purple" /><div><h2>{alumnos.length} estudiante{alumnos.length === 1 ? '' : 's'} con actividad</h2><p>Profesor responsable: {course.professor}</p>{alumnos.length ? <div className="people-chips">{alumnos.map(([id, nombre]) => <span className="file-chip" key={id}>{nombre}</span>)}</div> : <p className="muted">Aquí aparecen los alumnos que ya entregaron alguna tarea de este curso.</p>}</div></div></>
  }

  return <><PageHeading eyebrow={course.code} title="Personas" subtitle="Alumnos matriculados en el curso." /><div className="content-card people-card"><IconBadge icon={Users} tone="purple" /><div><h2>{lista.length} estudiante{lista.length === 1 ? '' : 's'} matriculado{lista.length === 1 ? '' : 's'}</h2><p>Profesor responsable: {course.professor}</p>{cargando && <div className="load-bar" role="status">Cargando matrículas...</div>}{error && <div className="load-bar error" role="alert"><TriangleAlert size={17} /> {error}</div>}{!cargando && !error && (lista.length ? <div className="people-chips">{lista.map((m) => <span className="file-chip" key={m.alumno_id}>{m.alumno_nombre ?? m.alumno_id} · {m.alumno_id} · {m.estado ?? 'ACTIVA'}</span>)}</div> : <p className="muted">Este curso aún no tiene alumnos matriculados.</p>)}{cursor && <button className="button secondary" style={{ marginTop: 12 }} onClick={cargarMas} disabled={cargandoMas}>{cargandoMas ? 'Cargando...' : 'Cargar más'}</button>}</div></div></>
}

function ModuleDetail({ itemId, course, courseModules, onBack }: { itemId: string; course: Course; courseModules: CourseModule[]; onBack: () => void }) {
  const item = courseModules.flatMap((module) => module.items).find((entry) => entry.id === itemId)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')

  async function descargar() {
    if (!item || !item.moduleId) return
    setDescargando(true)
    setError('')
    try {
      const r = await descargarMaterial(course.id, item.moduleId, item.id)
      window.open(r.url, '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar el material')
    } finally {
      setDescargando(false)
    }
  }

  if (!item) return null
  return <><button className="back-link inline" onClick={onBack}><ChevronLeft size={16} /> Volver a módulos</button><PageHeading eyebrow={course.code} title={item.title} subtitle={item.type === 'file' ? 'Material del curso' : 'Contenido del módulo'} /><div className="content-card article-card"><IconBadge icon={FileText} /><h2>{item.title}</h2>{item.description && <p>{item.description}</p>}{item.type === 'file' && item.moduleId && <div style={{ marginTop: 16 }}>{error && <div className="load-bar error" role="alert"><TriangleAlert size={17} /> {error}</div>}<button className="button primary" onClick={descargar} disabled={descargando}><CloudUpload size={17} /> {descargando ? 'Preparando descarga...' : 'Descargar'}</button></div>}</div></>
}

function AssignmentDetail({ assignment, course, role, studentId, submissions, cargandoEntregas, onBack, onSubmit, onGrade }: {
  assignment: Assignment; course: Course; role: Role; studentId: string; submissions: Submission[];
  cargandoEntregas: boolean;
  onBack: () => void; onSubmit: (assignment: Assignment, text: string, fileName?: string) => void;
  onGrade: (submission: Submission, assignment: Assignment, grade: number, feedback: string) => void
}) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | undefined>()
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')
  const ownSubmission = submissions.find((item) => item.studentId === studentId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(assignment, text, fileName)
    setText('')
    setFileName(undefined)
  }

  function handleGrade(event: FormEvent, submission: Submission) {
    event.preventDefault()
    const number = Number(grade)
    if (!grade.trim() || !Number.isFinite(number)) return
    onGrade(submission, assignment, number, feedback)
    setGrade('')
    setFeedback('')
  }

  return <><button className="back-link inline" onClick={onBack}><ChevronLeft size={16} /> Volver a tareas</button><PageHeading eyebrow={`${course.code} · TAREA`} title={assignment.title} subtitle={`Entrega hasta el ${formatDateLong(assignment.dueAt)}`} /><div className="detail-layout"><div className="detail-main"><div className="content-card article-card"><div className="detail-meta"><span><CalendarDays size={16} /> {formatDateLong(assignment.dueAt)}</span><span><GraduationCap size={17} /> {assignment.points} puntos</span></div><h2>Instrucciones</h2><p>{assignment.description}</p></div>{role === 'student' ? <div className="content-card form-card"><div className="section-heading compact"><div><h2>Tu entrega</h2><p>{ownSubmission ? `Entregada el ${formatDateLong(ownSubmission.submittedAt)}` : 'Envía tu trabajo para revisión.'}</p></div>{ownSubmission && <span className="status-pill success">Entregada</span>}</div>{ownSubmission ? <div className="submitted-box"><Check size={19} /><div><strong>Entrega recibida</strong><p>{ownSubmission.text || ownSubmission.fileName}</p>{ownSubmission.fileName && <small>Archivo seleccionado: {ownSubmission.fileName}</small>}</div></div> : <form onSubmit={handleSubmit}><label className="field-label" htmlFor="submission-text">Respuesta escrita</label><textarea id="submission-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Escribe tu respuesta o una nota para el profesor..." rows={5} /><label className="upload-zone"><CloudUpload size={23} /><span>{fileName ?? 'Seleccionar archivo'}</span><small>En esta demo se guarda el nombre; el archivo se subirá a S3 al conectar la API.</small><input type="file" onChange={(event) => setFileName(event.target.files?.[0]?.name)} /></label><Button type="submit" disabled={!text.trim() && !fileName}>Enviar entrega</Button></form>}</div> : <div className="content-card form-card"><div className="section-heading compact"><div><h2>Entregas de alumnos</h2><p>{submissions.length} entrega{submissions.length === 1 ? '' : 's'} recibida{submissions.length === 1 ? '' : 's'}</p></div></div>{cargandoEntregas && submissions.length === 0 ? <div className="load-bar" role="status">Cargando entregas...</div> : submissions.length ? submissions.map((submission) => <div className="review-card" key={submission.id}><div className="review-header"><span className="small-avatar">{submission.studentName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><strong>{submission.studentName}</strong><small>Entregó el {formatDateLong(submission.submittedAt)}</small></div>{submission.grade !== undefined && <span className="status-pill success">{submission.grade}/{assignment.points}</span>}</div><p>{submission.text || 'Entrega con archivo adjunto.'}</p>{submission.fileName && <span className="file-chip"><FileText size={15} />{submission.fileName}</span>}{submission.grade !== undefined && <div className="feedback-box"><strong>Comentario</strong><p>{submission.feedback || 'Sin comentario.'}</p></div>}{submission.grade === undefined && <form className="grade-form" onSubmit={(event) => handleGrade(event, submission)}><label className="field-label" htmlFor={`grade-${submission.id}`}>Calificación (0–{assignment.points})</label><input id={`grade-${submission.id}`} type="number" min="0" max={assignment.points} step="0.1" required value={grade} onChange={(event) => setGrade(event.target.value)} /><label className="field-label" htmlFor={`feedback-${submission.id}`}>Comentario</label><textarea id={`feedback-${submission.id}`} rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Escribe un comentario para el alumno..." /><Button type="submit">Publicar nota</Button></form>}</div>) : <EmptyState icon={Inbox} title="Aún no hay entregas" detail="Las entregas de tus estudiantes aparecerán aquí." />}</div>}</div><aside className="detail-aside"><div className="aside-panel"><h3>Detalles de la tarea</h3><div className="detail-fact"><span>Curso</span><strong>{course.name}</strong></div><div className="detail-fact"><span>Fecha límite</span><strong>{formatDate(assignment.dueAt)}</strong></div><div className="detail-fact"><span>Puntos</span><strong>{assignment.points}</strong></div><div className="detail-fact"><span>Estado</span><strong>{role === 'student' ? ownSubmission ? 'Entregada' : 'Pendiente' : 'Publicada'}</strong></div></div>{ownSubmission?.grade !== undefined && <div className="aside-panel grade-highlight"><span>TU CALIFICACIÓN</span><strong>{ownSubmission.grade}<small> / {assignment.points}</small></strong><p>{ownSubmission.feedback || 'Sin comentarios del profesor.'}</p></div>}</aside></div></>
}

function CreateAssignmentModal({ course, onClose, onCreate }: { course: Course; onClose: () => void; onCreate: (input: { title: string; description: string; dueAt: string; points: number }) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [points, setPoints] = useState('20')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || !dueAt || !points) return
    onCreate({ title: title.trim(), description: description.trim(), dueAt: new Date(dueAt).toISOString(), points: Number(points) })
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{course.code}</span><h2 id="modal-title">Nueva tarea</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={21} /></button></div><form onSubmit={submit}><label className="field-label" htmlFor="new-title">Título</label><input id="new-title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Entrega del proyecto" /><label className="field-label" htmlFor="new-description">Instrucciones</label><textarea id="new-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe lo que deben entregar los alumnos..." /><div className="form-two-columns"><div><label className="field-label" htmlFor="new-due">Fecha límite</label><input id="new-due" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div><div><label className="field-label" htmlFor="new-points">Puntos</label><input id="new-points" type="number" min="1" max="100" required value={points} onChange={(event) => setPoints(event.target.value)} /></div></div><div className="modal-actions"><Button secondary onClick={onClose}>Cancelar</Button><Button type="submit">Publicar tarea</Button></div></form></div></div>
}

function CalendarView({ assignments, courseList, onAssignment }: { assignments: Assignment[]; courseList: Course[]; onAssignment: (assignment: Assignment) => void }) {
  const ordered = assignments.slice().sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return <><PageHeading eyebrow="PLANIFICACIÓN" title="Calendario" subtitle="Fechas importantes de tus cursos." /><div className="content-card calendar-list"><div className="calendar-list-title"><CalendarDays size={21} /><h2>Próximas entregas</h2></div>{ordered.length ? ordered.map((assignment) => <button className="calendar-item" key={assignment.id} onClick={() => onAssignment(assignment)}><span className="date-tile"><b>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { day: '2-digit', timeZone: 'America/Lima' })}</b><small>{new Date(assignment.dueAt).toLocaleDateString('es-PE', { month: 'short', timeZone: 'America/Lima' })}</small></span><span><strong>{assignment.title}</strong><small>{courseList.find((course) => course.id === assignment.courseId)?.name ?? assignment.courseId} · {formatDateLong(assignment.dueAt)}</small></span><ChevronRight size={17} /></button>) : <EmptyState icon={CalendarDays} title="Sin eventos" detail="Las fechas de tus tareas aparecerán aquí." />}</div></>
}

function InboxView({ notices, onMarkAllRead, onRead }: { notices: Notice[]; onMarkAllRead: () => void; onRead: (id: string) => void }) {
  return <><PageHeading eyebrow="COMUNICACIÓN" title="Bandeja" subtitle="Avisos de tus cursos." action={<Button secondary onClick={onMarkAllRead}><Check size={17} /> Marcar como leídos</Button>} /><div className="content-card inbox-list">{notices.length ? notices.map((notice) => <div className={`inbox-item ${notice.read ? '' : 'unread'}`} key={notice.id} role={notice.read ? undefined : 'button'} tabIndex={notice.read ? undefined : 0} onClick={notice.read ? undefined : () => onRead(notice.id)} onKeyDown={notice.read ? undefined : (event) => { if (event.key === 'Enter') onRead(notice.id) }}><span className="inbox-icon"><Bell size={18} /></span><div><strong>{notice.title}</strong><p>{notice.body}</p><small>{formatDateLong(notice.date)}</small></div>{!notice.read && <span className="unread-dot" />}</div>) : <EmptyState icon={Inbox} title="Bandeja vacía" detail="Los avisos de tus cursos aparecerán aquí." />}</div></>
}

function GradesView({ role, assignments, submissions, courseList, studentId, onAssignment }: { role: Role; assignments: Assignment[]; submissions: Submission[]; courseList: Course[]; studentId: string; onAssignment: (assignment: Assignment) => void }) {
  return <><PageHeading eyebrow="SEGUIMIENTO" title="Calificaciones" subtitle={role === 'student' ? 'Consulta tus resultados por actividad.' : 'Consulta y revisa las calificaciones publicadas.'} /><GradeTable role={role} assignments={assignments} submissions={submissions} courseList={courseList} studentId={studentId} onAssignment={onAssignment} /></>
}

function GradeTable({ role, assignments, submissions, courseList, studentId, onAssignment }: { role: Role; assignments: Assignment[]; submissions: Submission[]; courseList: Course[]; studentId: string; onAssignment: (assignment: Assignment) => void }) {
  return <div className="content-card grade-table"><div className="table-head"><span>TAREA</span><span>CURSO</span><span>ESTADO</span><span>NOTA</span></div>{assignments.length ? assignments.map((assignment) => { const related = submissions.filter((item) => item.assignmentId === assignment.id && (role === 'teacher' || item.studentId === studentId)); const submission = related[0]; return <button className="table-row" key={assignment.id} onClick={() => onAssignment(assignment)}><span><strong>{assignment.title}</strong><small>{formatDate(assignment.dueAt)}</small></span><span>{courseList.find((course) => course.id === assignment.courseId)?.name ?? assignment.courseId}</span><span><span className={`status-pill ${submission?.grade !== undefined ? 'success' : ''}`}>{submission?.grade !== undefined ? 'Calificada' : submission ? 'Entregada' : 'Pendiente'}</span></span><span><strong>{submission?.grade !== undefined ? `${submission.grade} / ${assignment.points}` : '—'}</strong></span></button> }) : <EmptyState icon={GraduationCap} title="Sin calificaciones" detail="Las calificaciones aparecerán aquí." />}</div>
}
